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

// Mock AnchorBrowser before importing leash
vi.mock('anchorbrowser', () => {
  return {
    default: class MockAnchorClient {
      sessions = { create: mockCreate, delete: mockDelete, retrieve: mockRetrieve }
      tools = { performWebTask: mockPerformWebTask }
    },
  }
})

import { createLeash } from '../src/index.js'

describe('Leash', () => {
  const tmpDir = join(__dirname, '.tmp-leash-test')
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
    // Clean up .leash-session if created
    try { rmSync('.leash-session', { force: true }) } catch {}
    vi.useRealTimers()
  })

  it('allows a matching task', async () => {
    const leash = createLeash(
      { allow: ['read*'], deny: ['*send*'], default: 'deny' },
      { auditPath },
    )

    const result = await leash.task('read my inbox')
    expect(result.allowed).toBe(true)
    expect(result.output).toBeDefined()
    expect(result.auditId).toMatch(/^evt-/)

    await leash.yank()
  })

  it('blocks a denied task', async () => {
    const leash = createLeash(
      { allow: ['read*'], deny: ['*send*'], default: 'deny' },
      { auditPath },
    )

    const result = await leash.task('send message to Bob')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')

    await leash.yank()
  })

  it('blocks unmatched tasks when default is deny', async () => {
    const leash = createLeash(
      { allow: ['read*'], default: 'deny' },
      { auditPath },
    )

    const result = await leash.task('do something unexpected')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('default: deny')

    await leash.yank()
  })

  it('tracks status correctly', async () => {
    const leash = createLeash(
      { allow: ['read*'], deny: ['*send*'], default: 'deny', agent: 'test-bot' },
      { auditPath },
    )

    await leash.task('read inbox')
    await leash.task('send message')

    const status = leash.status()
    expect(status.active).toBe(true)
    expect(status.agent).toBe('test-bot')
    expect(status.allowed).toBe(1)
    expect(status.blocked).toBe(1)

    await leash.yank()
  })

  it('records audit events', async () => {
    const leash = createLeash(
      { allow: ['read*'], deny: ['*send*'], default: 'deny' },
      { auditPath },
    )

    await leash.task('read inbox')
    await leash.task('send message')

    const events = leash.audit()
    expect(events).toHaveLength(2)
    expect(events[0].action).toBe('allowed')
    expect(events[1].action).toBe('blocked')

    await leash.yank()
  })

  it('yank terminates session and logs event', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    await leash.task('do something')
    await leash.yank()

    const status = leash.status()
    expect(status.active).toBe(false)

    const events = leash.audit()
    const killEvent = events.find(e => e.action === 'killed')
    expect(killEvent).toBeDefined()
  })

  it('blocks tasks after yank', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    await leash.yank()
    const result = await leash.task('read inbox')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('session killed')
  })

  it('enforces action budget', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow', maxActions: 2 },
      { auditPath },
    )

    await leash.task('task 1')
    await leash.task('task 2')
    const result = await leash.task('task 3')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('action budget exhausted')

    await leash.yank()
  })

  it('throws without API key', () => {
    delete process.env.ANCHOR_API_KEY
    expect(() =>
      createLeash({ allow: ['*'] }),
    ).toThrow('ANCHOR_API_KEY')
  })

  it('accepts API key via options', async () => {
    delete process.env.ANCHOR_API_KEY
    const leash = createLeash(
      { allow: ['*'], default: 'allow' },
      { anchorApiKey: 'override-key', auditPath },
    )

    const result = await leash.task('read inbox')
    expect(result.allowed).toBe(true)

    await leash.yank()
  })

  it('double yank is idempotent', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    await leash.yank()
    await leash.yank() // should not throw

    const events = leash.audit()
    const killEvents = events.filter(e => e.action === 'killed')
    expect(killEvents).toHaveLength(1) // only one kill event logged
  })

  it('blocked tasks do not consume action budget', async () => {
    const leash = createLeash(
      { allow: ['read*'], deny: ['*send*'], default: 'deny', maxActions: 2 },
      { auditPath },
    )

    // These are blocked — should NOT consume budget
    await leash.task('send message 1')
    await leash.task('send message 2')
    await leash.task('send message 3')

    // These should still work because blocked tasks didn't consume budget
    const r1 = await leash.task('read inbox')
    expect(r1.allowed).toBe(true)

    const r2 = await leash.task('read contacts')
    expect(r2.allowed).toBe(true)

    // Now budget should be exhausted
    const r3 = await leash.task('read calendar')
    expect(r3.allowed).toBe(false)
    expect(r3.reason).toBe('action budget exhausted')

    await leash.yank()
  })

  it('throws on invalid maxActions', () => {
    expect(() =>
      createLeash({ allow: ['*'], maxActions: -5 }),
    ).toThrow('Invalid maxActions')
  })

  it('throws on invalid expire duration', () => {
    expect(() =>
      createLeash({ allow: ['*'], expire: 'invalid' }),
    ).toThrow('Invalid duration')
  })

  it('rejects empty task description', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    const r1 = await leash.task('')
    expect(r1.allowed).toBe(false)
    expect(r1.reason).toBe('empty task description')

    const r2 = await leash.task('   ')
    expect(r2.allowed).toBe(false)
    expect(r2.reason).toBe('empty task description')

    await leash.yank()
  })

  it('fails closed when AnchorBrowser throws during execute', async () => {
    mockPerformWebTask.mockRejectedValueOnce(
      new Error('AnchorBrowser 500: Internal Server Error'),
    )

    const leash = createLeash(
      { allow: ['*'], default: 'allow' },
      { auditPath },
    )

    const result = await leash.task('read inbox')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('error:')
    expect(result.reason).toContain('500')

    // Error event recorded in audit log
    const events = leash.audit()
    expect(events.some(e => e.action === 'error')).toBe(true)

    await leash.yank()
  })

  it('enforces budget under concurrent task() calls', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow', maxActions: 3 },
      { auditPath },
    )

    const results = await Promise.all([
      leash.task('task 1'),
      leash.task('task 2'),
      leash.task('task 3'),
      leash.task('task 4'),
      leash.task('task 5'),
    ])

    const allowed = results.filter(r => r.allowed).length
    expect(allowed).toBe(3)
    const blocked = results.filter(r => !r.allowed).length
    expect(blocked).toBe(2)

    await leash.yank()
  })

  it('blocks tasks after expire duration elapses', async () => {
    vi.useFakeTimers()

    const leash = createLeash(
      { allow: ['*'], default: 'allow', expire: '1min' },
      { auditPath },
    )

    const r1 = await leash.task('task before expire')
    expect(r1.allowed).toBe(true)

    // Advance past 1 minute — timer fires leash.yank()
    await vi.advanceTimersByTimeAsync(61_000)

    const r2 = await leash.task('task after expire')
    expect(r2.allowed).toBe(false)
    expect(r2.reason).toBe('session killed')

    const status = leash.status()
    expect(status.active).toBe(false)
  })

  it('output flags appear in task result when deny keywords found in output', async () => {
    // Override mock to return output containing a deny keyword
    mockPerformWebTask.mockResolvedValueOnce({
      data: { result: 'exported 500 contacts to CSV successfully' },
    })

    // Task description is allowed (matches 'read*'), but output contains '*export*' keyword
    const leash = createLeash(
      { allow: ['read*'], deny: ['*export*'], default: 'deny' },
      { auditPath },
    )

    const result = await leash.task('read contacts list')
    expect(result.allowed).toBe(true)
    expect(result.flags).toBeDefined()
    expect(result.flags!.length).toBeGreaterThan(0)
    expect(result.flags![0].pattern).toBe('*export*')
    expect(result.flags![0].keyword).toBe('export')
    expect(result.flags![0].snippet).toContain('export')

    await leash.yank()
  })

  it('domains appear in audit events', async () => {
    const leash = createLeash(
      { allow: ['*'], default: 'allow', domains: ['linkedin.com'] },
      { auditPath },
    )

    await leash.task('read my profile')

    const events = leash.audit()
    const taskEvent = events.find(e => e.action === 'allowed')
    expect(taskEvent).toBeDefined()
    expect(taskEvent!.domains).toEqual(['linkedin.com'])

    await leash.yank()
  })

  it('no flags when output is clean', async () => {
    // Default mock returns 'task completed successfully' — no deny keywords
    const leash = createLeash(
      { allow: ['*'], deny: ['*export*'], default: 'allow' },
      { auditPath },
    )

    const result = await leash.task('read inbox')
    expect(result.allowed).toBe(true)
    expect(result.flags).toBeUndefined()

    await leash.yank()
  })
})
