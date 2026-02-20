#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs'
import AnchorClient from 'anchorbrowser'
import type { AuditEvent } from './types.js'
import { SESSION_FILE, DEFAULT_AUDIT_FILE } from './constants.js'

const AUDIT_FILE = DEFAULT_AUDIT_FILE

const command = process.argv[2]

async function main() {
  switch (command) {
    case 'kill':
      await killSession()
      break
    case 'status':
      printStatus()
      break
    case 'audit':
      printAudit()
      break
    default:
      console.log('Usage: leashed <kill|status|audit>')
      console.log('')
      console.log('Commands:')
      console.log('  kill    Kill the active Leash session')
      console.log('  status  Show session stats from audit log')
      console.log('  audit   Print the full audit log')
      process.exit(command ? 1 : 0)
  }
}

async function killSession() {
  if (!existsSync(SESSION_FILE)) {
    console.log('No active session found.')
    return
  }

  const sessionId = readFileSync(SESSION_FILE, 'utf-8').trim()
  const apiKey = process.env.ANCHOR_API_KEY
  if (!apiKey) {
    console.error('ANCHOR_API_KEY environment variable required')
    process.exit(1)
  }

  const client = new AnchorClient({ apiKey })
  try {
    await client.sessions.delete(sessionId)
    console.log(`Session ${sessionId} killed.`)
  } catch {
    console.log(`Session ${sessionId} already expired or not found.`)
  }

  const { unlinkSync } = await import('node:fs')
  try { unlinkSync(SESSION_FILE) } catch {}
}

function readAuditEvents(): AuditEvent[] {
  if (!existsSync(AUDIT_FILE)) return []
  const events: AuditEvent[] = []
  for (const line of readFileSync(AUDIT_FILE, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try {
      events.push(JSON.parse(line) as AuditEvent)
    } catch {
      // Skip corrupt lines
    }
  }
  return events
}

function printStatus() {
  const events = readAuditEvents()
  if (events.length === 0) {
    console.log('No audit events found.')
    return
  }

  const allowed = events.filter(e => e.action === 'allowed').length
  const blocked = events.filter(e => e.action === 'blocked').length
  const errors = events.filter(e => e.action === 'error').length
  const killed = events.some(e => e.action === 'killed')
  const agent = events[0]?.agent ?? 'unknown'

  console.log(`Agent:   ${agent}`)
  console.log(`Status:  ${killed ? 'killed' : 'active'}`)
  console.log(`Allowed: ${allowed}`)
  console.log(`Blocked: ${blocked}`)
  console.log(`Errors:  ${errors}`)
  console.log(`Total:   ${events.length}`)
}

function printAudit() {
  const events = readAuditEvents()
  if (events.length === 0) {
    console.log('No audit events found.')
    return
  }

  // Simple table output
  console.log('Time                      Action    Task')
  console.log('─'.repeat(70))
  for (const e of events) {
    const time = e.timestamp.slice(0, 19).replace('T', ' ')
    const action = e.action.padEnd(9)
    const task = e.task.length > 40 ? e.task.slice(0, 37) + '...' : e.task
    const reason = e.reason ? ` (${e.reason})` : ''
    console.log(`${time}  ${action} ${task}${reason}`)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
