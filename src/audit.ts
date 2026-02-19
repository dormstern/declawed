import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import type { AuditEvent } from './types.js'

export interface AuditLogger {
  log(event: AuditEvent): void
  query(filters?: AuditFilters): AuditEvent[]
  export(): AuditEvent[]
}

export interface AuditFilters {
  action?: AuditEvent['action']
  agent?: string
  since?: Date
}

/**
 * Creates an append-only JSONL audit logger.
 */
export function createAuditLogger(filePath: string = './shield-audit.jsonl'): AuditLogger {
  return {
    log(event: AuditEvent): void {
      const line = JSON.stringify(event) + '\n'
      appendFileSync(filePath, line)
    },

    query(filters?: AuditFilters): AuditEvent[] {
      const events = readEvents(filePath)
      if (!filters) return events

      return events.filter((e) => {
        if (filters.action && e.action !== filters.action) return false
        if (filters.agent && e.agent !== filters.agent) return false
        if (filters.since && new Date(e.timestamp) < filters.since) return false
        return true
      })
    },

    export(): AuditEvent[] {
      return readEvents(filePath)
    },
  }
}

function readEvents(filePath: string): AuditEvent[] {
  if (!existsSync(filePath)) return []

  const content = readFileSync(filePath, 'utf-8')
  const events: AuditEvent[] = []
  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      events.push(JSON.parse(line) as AuditEvent)
    } catch {
      // Skip corrupt lines — append-only log may have partial writes
    }
  }
  return events
}
