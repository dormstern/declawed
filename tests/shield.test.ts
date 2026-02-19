import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, rmSync, existsSync } from 'node:fs'

// Shared mock functions — can be overridden per-test via mockRejectedValueOnce etc.
const mockCreate = vi.fn().mockResolvedValue({ data: { id: 'mock-session-123' } })
const mockDelete = vi.fn().mockResolvedValue(undefined)
const mockRetrieve = vi.fn().mockResolvedValue({ data: { status: 'running' } })
const mockPerformWebTask = vi.fn().mockResolvedValue({
  data: { result: 'task completed successfully' },
})

// Mock AnchorBrowser before importing shield
vi.mock('anchorbrowser', () => {
  return {
    default: class MockAnchorClient {
      sessions = { create: mockCreate, delete: mockDelete, retrieve: mockRetrieve }
      tools = { performWebTask: mockPerformWebTask }
    },
  }
})

import { createShield } from '../src/index.js'

describe('Shield', () => {
  const tmpDir = join(__dirname, '.tmp-shield-test')
  const auditPath = join(tmpDir, 'audit.jsonl')

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true })
    process.env.ANCHOR_API_KEY = 'test-key-123'
    // Reset mocks to default behavior
    mockCreate.mockResolvedValue({ data: { id: 'mock-session-123' } })
    mockDelete.mockResolvedValue(undefined)
    mockRetrieve.mockResolvedValue({ data: { status: 'running' } })
    mockPerformWebTask.mockResolvedValue({ data: { result: 'task completed successfully' } })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.ANCHOR_API_KEY
    // Clean up .shield-session if created
    try { rmSync('.shield-session', { force: true }) } catch {}
    vi.useRealTimers()
  })

  it('allows a matching task', async () => {
    const shield = createShield(
      { allow: ['read*'], deny: ['*send*'], default: 'deny' },
      { auditPath },
    )

    const result = await shield.task('read my inbox')
    expect(result.allowed).toBe(true)
    expect(result.output).toBeDefined()
    expect(result.auditId).toMatch(/^evt-/)

    await shield.kill()
  })

  it('blocks a denied task', async () => {
    const shield = createShield(
      { allow: ['read*'], deny: ['*send*'], default: 'deny' },
      { auditPath },
    )

    const result = await shield.task('send message to Bob')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')

    await shield.kill()
  })

  it('blocks unmatched tasks when default is deny', async () => {
    const shield = createShield(
      { allow: ['read*'], default: 'deny' },
      { auditPath },
    )

    const result = await shield.task('do something unexpected')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('default: deny')

    await shield.kill()
  })

  it('tracks status correctly', async () => {
    const shield = createShield(
      { allow: ['read*'], deny: ['*send*'], default: 'deny', agent: 'test-bot' },
      { auditPath },
    )

    await shield.task('read inbox')
    await shield.task('send message')

    const status = shield.status()
    expect(status.active).toBe(true)
    expect(status.agent).toBe('test-bot')
    expect(status.allowed).toBe(1)
    expect(status.blocked).toBe(1)

    await shield.kill()
  })

  it('records audit events', async () => {
    const shield = createShield(
      { allow: ['read*'], deny: ['*send*'], default: 'deny' },
      { auditPath },
    )

    await shield.task('read inbox')
    await shield.task('send message')

    const events = shield.audit()
    expect(events).toHaveLength(2)
    expect(events[0].action).toBe('allowed')
    expect(events[1].action).toBe('blocked')

    await shield.kill()
  })

  it('kill terminates session and logs event', async () => {
    const shield = createShield(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    await shield.task('do something')
    await shield.kill()

    const status = shield.status()
    expect(status.active).toBe(false)

    const events = shield.audit()
    const killEvent = events.find(e => e.action === 'killed')
    expect(killEvent).toBeDefined()
  })

  it('blocks tasks after kill', async () => {
    const shield = createShield(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    await shield.kill()
    const result = await shield.task('read inbox')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('session killed')
  })

  it('enforces action budget', async () => {
    const shield = createShield(
      { allow: ['*'], default: 'allow', maxActions: 2 },
      { auditPath },
    )

    await shield.task('task 1')
    await shield.task('task 2')
    const result = await shield.task('task 3')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('action budget exhausted')

    await shield.kill()
  })

  it('throws without API key', () => {
    delete process.env.ANCHOR_API_KEY
    expect(() =>
      createShield({ allow: ['*'] }),
    ).toThrow('ANCHOR_API_KEY')
  })

  it('accepts API key via options', async () => {
    delete process.env.ANCHOR_API_KEY
    const shield = createShield(
      { allow: ['*'], default: 'allow' },
      { anchorApiKey: 'override-key', auditPath },
    )

    const result = await shield.task('read inbox')
    expect(result.allowed).toBe(true)

    await shield.kill()
  })

  it('double kill is idempotent', async () => {
    const shield = createShield(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    await shield.kill()
    await shield.kill() // should not throw

    const events = shield.audit()
    const killEvents = events.filter(e => e.action === 'killed')
    expect(killEvents).toHaveLength(1) // only one kill event logged
  })

  it('blocked tasks do not consume action budget', async () => {
    const shield = createShield(
      { allow: ['read*'], deny: ['*send*'], default: 'deny', maxActions: 2 },
      { auditPath },
    )

    // These are blocked — should NOT consume budget
    await shield.task('send message 1')
    await shield.task('send message 2')
    await shield.task('send message 3')

    // These should still work because blocked tasks didn't consume budget
    const r1 = await shield.task('read inbox')
    expect(r1.allowed).toBe(true)

    const r2 = await shield.task('read contacts')
    expect(r2.allowed).toBe(true)

    // Now budget should be exhausted
    const r3 = await shield.task('read calendar')
    expect(r3.allowed).toBe(false)
    expect(r3.reason).toBe('action budget exhausted')

    await shield.kill()
  })

  it('throws on invalid maxActions', () => {
    expect(() =>
      createShield({ allow: ['*'], maxActions: -5 }),
    ).toThrow('Invalid maxActions')
  })

  it('throws on invalid expire duration', () => {
    expect(() =>
      createShield({ allow: ['*'], expire: 'invalid' }),
    ).toThrow('Invalid duration')
  })

  it('rejects empty task description', async () => {
    const shield = createShield(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    const r1 = await shield.task('')
    expect(r1.allowed).toBe(false)
    expect(r1.reason).toBe('empty task description')

    const r2 = await shield.task('   ')
    expect(r2.allowed).toBe(false)
    expect(r2.reason).toBe('empty task description')

    await shield.kill()
  })

  it('fails closed when AnchorBrowser throws during execute', async () => {
    mockPerformWebTask.mockRejectedValueOnce(
      new Error('AnchorBrowser 500: Internal Server Error'),
    )

    const shield = createShield(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    const result = await shield.task('read inbox')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('error:')
    expect(result.reason).toContain('500')

    // Error event recorded in audit log
    const events = shield.audit()
    expect(events.some(e => e.action === 'error')).toBe(true)

    await shield.kill()
  })

  it('enforces budget under concurrent task() calls', async () => {
    const shield = createShield(
      { allow: ['*'], default: 'allow', maxActions: 3 },
      { auditPath },
    )

    const results = await Promise.all([
      shield.task('task 1'),
      shield.task('task 2'),
      shield.task('task 3'),
      shield.task('task 4'),
      shield.task('task 5'),
    ])

    const allowed = results.filter(r => r.allowed).length
    expect(allowed).toBe(3)
    const blocked = results.filter(r => !r.allowed).length
    expect(blocked).toBe(2)

    await shield.kill()
  })

  it('blocks tasks after expire duration elapses', async () => {
    vi.useFakeTimers()

    const shield = createShield(
      { allow: ['*'], default: 'allow', expire: '1min' },
      { auditPath },
    )

    const r1 = await shield.task('task before expire')
    expect(r1.allowed).toBe(true)

    // Advance past 1 minute — timer fires shield.kill()
    await vi.advanceTimersByTimeAsync(61_000)

    const r2 = await shield.task('task after expire')
    expect(r2.allowed).toBe(false)
    expect(r2.reason).toBe('session killed')

    const status = shield.status()
    expect(status.active).toBe(false)
  })
})
