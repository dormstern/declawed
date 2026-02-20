import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { AuditEvent } from '../src/types.js'

describe('CLI', () => {
  const tmpDir = join(__dirname, '.tmp-cli-test')

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeAuditLog(events: Partial<AuditEvent>[]) {
    const lines = events.map(e =>
      JSON.stringify({
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: 'test-agent',
        task: 'test task',
        action: 'allowed',
        ...e,
      }),
    )
    writeFileSync(join(tmpDir, 'leash-audit.jsonl'), lines.join('\n') + '\n')
  }

  function runCli(args: string): string {
    const cliPath = join(__dirname, '..', 'src', 'cli.ts')
    return execFileSync(
      'npx',
      ['tsx', cliPath, ...args.split(' ').filter(Boolean)],
      { cwd: tmpDir, encoding: 'utf-8', env: { ...process.env, ANCHOR_API_KEY: 'test-key' } },
    )
  }

  it('shows usage with no args', () => {
    const output = runCli('')
    expect(output).toContain('Usage:')
    expect(output).toContain('kill')
    expect(output).toContain('status')
    expect(output).toContain('audit')
  })

  it('status shows stats from audit log', () => {
    writeAuditLog([
      { action: 'allowed', task: 'read inbox' },
      { action: 'blocked', task: 'send message' },
      { action: 'allowed', task: 'list contacts' },
    ])

    const output = runCli('status')
    expect(output).toContain('Allowed: 2')
    expect(output).toContain('Blocked: 1')
    expect(output).toContain('test-agent')
  })

  it('status reports no events when log missing', () => {
    const output = runCli('status')
    expect(output).toContain('No audit events')
  })

  it('audit prints events', () => {
    writeAuditLog([
      { action: 'allowed', task: 'read inbox' },
      { action: 'blocked', task: 'send message', reason: 'blocked by deny pattern: *send*' },
    ])

    const output = runCli('audit')
    expect(output).toContain('read inbox')
    expect(output).toContain('send message')
    expect(output).toContain('blocked')
  })

  it('audit reports no events when log missing', () => {
    const output = runCli('audit')
    expect(output).toContain('No audit events')
  })

  it('kill reports no session when file missing', () => {
    const output = runCli('kill')
    expect(output).toContain('No active session')
  })
})
