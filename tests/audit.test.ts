import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { createAuditLogger } from '../src/audit.js'
import type { AuditEvent } from '../src/types.js'

describe('AuditLogger', () => {
  const tmpDir = join(__dirname, '.tmp-audit-test')
  const logPath = join(tmpDir, 'test-audit.jsonl')

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
    return {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: 'test-agent',
      task: 'read inbox',
      action: 'allowed',
      ...overrides,
    }
  }

  it('creates log file on first write', () => {
    const logger = createAuditLogger(logPath)
    expect(existsSync(logPath)).toBe(false)

    logger.log(makeEvent())
    expect(existsSync(logPath)).toBe(true)
  })

  it('appends events as JSONL', () => {
    const logger = createAuditLogger(logPath)

    logger.log(makeEvent({ task: 'read inbox' }))
    logger.log(makeEvent({ task: 'list contacts' }))

    const events = logger.export()
    expect(events).toHaveLength(2)
    expect(events[0].task).toBe('read inbox')
    expect(events[1].task).toBe('list contacts')
  })

  it('returns empty array for non-existent file', () => {
    const logger = createAuditLogger(join(tmpDir, 'nonexistent.jsonl'))
    expect(logger.export()).toEqual([])
  })

  it('filters by action', () => {
    const logger = createAuditLogger(logPath)
    logger.log(makeEvent({ action: 'allowed', task: 'read' }))
    logger.log(makeEvent({ action: 'blocked', task: 'send' }))
    logger.log(makeEvent({ action: 'allowed', task: 'list' }))

    const blocked = logger.query({ action: 'blocked' })
    expect(blocked).toHaveLength(1)
    expect(blocked[0].task).toBe('send')
  })

  it('filters by agent', () => {
    const logger = createAuditLogger(logPath)
    logger.log(makeEvent({ agent: 'agent-a', task: 'read' }))
    logger.log(makeEvent({ agent: 'agent-b', task: 'write' }))

    const results = logger.query({ agent: 'agent-a' })
    expect(results).toHaveLength(1)
    expect(results[0].agent).toBe('agent-a')
  })

  it('filters by since date', () => {
    const logger = createAuditLogger(logPath)
    const old = new Date('2024-01-01T00:00:00Z').toISOString()
    const recent = new Date().toISOString()

    logger.log(makeEvent({ timestamp: old, task: 'old task' }))
    logger.log(makeEvent({ timestamp: recent, task: 'recent task' }))

    const results = logger.query({ since: new Date('2025-01-01') })
    expect(results).toHaveLength(1)
    expect(results[0].task).toBe('recent task')
  })

  it('returns all events when no filters', () => {
    const logger = createAuditLogger(logPath)
    logger.log(makeEvent())
    logger.log(makeEvent())
    logger.log(makeEvent())

    expect(logger.query()).toHaveLength(3)
  })

  it('skips corrupt JSONL lines gracefully', () => {
    const { writeFileSync } = require('node:fs')
    const validEvent = JSON.stringify(makeEvent({ task: 'valid task' }))
    const content = `${validEvent}\n{corrupt json\n${validEvent}\n`
    writeFileSync(logPath, content)

    const logger = createAuditLogger(logPath)
    const events = logger.export()
    expect(events).toHaveLength(2)
    expect(events[0].task).toBe('valid task')
    expect(events[1].task).toBe('valid task')
  })

  it('handles completely corrupt audit file', () => {
    const { writeFileSync } = require('node:fs')
    writeFileSync(logPath, 'not json at all\n{also bad}\n')

    const logger = createAuditLogger(logPath)
    expect(logger.export()).toEqual([])
  })
})
