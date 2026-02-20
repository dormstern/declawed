import { writeFileSync, existsSync } from 'node:fs'
import { loadPolicy, evaluatePolicy } from './policy.js'
import { createAuditLogger, type AuditLogger } from './audit.js'
import { createSessionManager, type SessionManager } from './session.js'
import { scanOutput } from './output-scanner.js'
import type { LeashConfig, LeashResult, AuditEvent, LeashStatus, OutputFlag } from './types.js'
import { SESSION_FILE, DEFAULT_AUDIT_FILE } from './constants.js'

export type { LeashConfig, LeashResult, AuditEvent, LeashStatus, OutputFlag } from './types.js'
export { loadPolicy, evaluatePolicy, matchesPattern } from './policy.js'
export { createAuditLogger } from './audit.js'
export { createSessionManager } from './session.js'
export { scanOutput } from './output-scanner.js'
export { SESSION_FILE, DEFAULT_AUDIT_FILE } from './constants.js'

export interface Leash {
  task(description: string): Promise<LeashResult>
  yank(): Promise<void>
  audit(): AuditEvent[]
  status(): LeashStatus
}

export interface CreateLeashOptions {
  anchorApiKey?: string
  auditPath?: string
}

/**
 * Create a governance-wrapped AnchorBrowser session.
 *
 * @param configOrPath - YAML file path or inline LeashConfig
 * @param options - Optional overrides (API key, audit path)
 */
export function createLeash(
  configOrPath: string | LeashConfig,
  options?: CreateLeashOptions,
): Leash {
  const config = loadPolicy(configOrPath)

  // Validate config at construction time
  if (config.maxActions !== undefined && (config.maxActions < 0 || !Number.isFinite(config.maxActions))) {
    throw new Error(`Invalid maxActions: ${config.maxActions} (must be a non-negative number)`)
  }

  const apiKey = options?.anchorApiKey ?? process.env.ANCHOR_API_KEY
  if (!apiKey) {
    throw new Error('ANCHOR_API_KEY required (env var or options.anchorApiKey)')
  }

  const auditPath = options?.auditPath ?? DEFAULT_AUDIT_FILE
  const logger: AuditLogger = createAuditLogger(auditPath)
  const session: SessionManager = createSessionManager(apiKey)
  const agentName = config.agent ?? 'leash-agent'

  const startTime = Date.now()
  let actionCount = 0
  let allowedCount = 0
  let blockedCount = 0
  let killed = false

  // Parse expire duration to milliseconds (validates at construction)
  const expireMs = config.expire ? parseDuration(config.expire) : null
  let expireTimer: ReturnType<typeof setTimeout> | null = null

  if (expireMs) {
    expireTimer = setTimeout(() => {
      leash.yank()
    }, expireMs)
    expireTimer.unref()
  }

  function generateId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }

  function checkExpired(): string | null {
    if (killed) return 'session killed'
    if (expireMs && Date.now() - startTime > expireMs) return 'session expired'
    if (config.maxActions && actionCount >= config.maxActions) return 'action budget exhausted'
    return null
  }

  const leash: Leash = {
    async task(description: string): Promise<LeashResult> {
      const auditId = generateId()
      const taskStart = Date.now()

      // Reject empty/whitespace-only tasks
      if (!description || !description.trim()) {
        return { allowed: false, reason: 'empty task description', auditId }
      }

      // Check expiration / budget
      const expiredReason = checkExpired()
      if (expiredReason) {
        const event: AuditEvent = {
          id: auditId,
          timestamp: new Date().toISOString(),
          agent: agentName,
          task: description,
          action: 'blocked',
          reason: expiredReason,
          ...(config.domains?.length ? { domains: config.domains } : {}),
        }
        logger.log(event)
        blockedCount++
        return { allowed: false, reason: expiredReason, auditId }
      }

      // Evaluate policy
      const decision = evaluatePolicy(description, config)

      if (!decision.allowed) {
        const event: AuditEvent = {
          id: auditId,
          timestamp: new Date().toISOString(),
          agent: agentName,
          task: description,
          action: 'blocked',
          reason: decision.reason,
          ...(config.domains?.length ? { domains: config.domains } : {}),
        }
        logger.log(event)
        blockedCount++
        return { allowed: false, reason: decision.reason, auditId }
      }

      // Execute via AnchorBrowser — only allowed tasks consume the action budget
      actionCount++

      try {
        const output = await session.execute(description)
        const duration = Date.now() - taskStart

        // Persist session ID for CLI yank switch
        try {
          const sid = session.getSessionId()
          if (sid) writeFileSync(SESSION_FILE, sid, { mode: 0o600 })
        } catch {
          // Non-fatal: CLI yank won't work but task still succeeds
        }

        // Post-execution output scan — detect deny keywords in output
        const flags = scanOutput(output, config)

        const event: AuditEvent = {
          id: auditId,
          timestamp: new Date().toISOString(),
          agent: agentName,
          task: description,
          action: 'allowed',
          duration,
          ...(flags.length > 0 ? { flags } : {}),
          ...(config.domains?.length ? { domains: config.domains } : {}),
        }
        logger.log(event)
        allowedCount++

        const result: LeashResult = { allowed: true, output, auditId }
        if (flags.length > 0) result.flags = flags
        return result
      } catch (err) {
        const event: AuditEvent = {
          id: auditId,
          timestamp: new Date().toISOString(),
          agent: agentName,
          task: description,
          action: 'error',
          reason: err instanceof Error ? err.message : 'unknown error',
        }
        logger.log(event)
        blockedCount++
        return {
          allowed: false,
          reason: `error: ${err instanceof Error ? err.message : 'unknown'}`,
          auditId,
        }
      }
    },

    async yank(): Promise<void> {
      if (killed) return
      killed = true
      if (expireTimer) clearTimeout(expireTimer)

      try {
        await session.kill()
      } catch {
        // Log the yank event regardless — session may be gone but we need the audit record
      }

      const event: AuditEvent = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        agent: agentName,
        task: '',
        action: 'killed',
      }
      logger.log(event)

      // Clean up session file
      try {
        const { unlinkSync } = await import('node:fs')
        if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE)
      } catch {
        // Non-fatal
      }
    },

    audit(): AuditEvent[] {
      return logger.export()
    },

    status(): LeashStatus {
      const uptimeMs = Date.now() - startTime
      return {
        active: !killed,
        agent: agentName,
        uptime: formatDuration(uptimeMs),
        allowed: allowedCount,
        blocked: blockedCount,
        sessionId: session.getSessionId(),
      }
    },
  }

  return leash
}

function parseDuration(str: string): number {
  const match = str.match(/^(\d+)(min|h|d)$/)
  if (!match) throw new Error(`Invalid duration: ${str}`)
  const value = parseInt(match[1], 10)
  switch (match[2]) {
    case 'min': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: throw new Error(`Unknown duration unit: ${match[2]}`)
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}min`
}
