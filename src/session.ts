import AnchorClient from 'anchorbrowser'

const SESSION_DEFAULTS = {
  session: {
    proxy: {
      active: true,
      country_code: 'us',
    },
    timeout: {
      idle_timeout: 15,
      max_duration: 30,
    },
  },
  browser: {
    extra_stealth: { active: true },
    captcha_solver: { active: true },
    adblock: { active: true },
    popup_blocker: { active: true },
  },
} as const

export interface SessionManager {
  create(): Promise<string>
  execute(task: string): Promise<string>
  kill(): Promise<void>
  isAlive(): Promise<boolean>
  getSessionId(): string | undefined
}

/**
 * Creates an AnchorBrowser session manager with hardened defaults.
 */
export function createSessionManager(apiKey: string): SessionManager {
  const client = new AnchorClient({ apiKey })
  let sessionId: string | undefined

  return {
    async create(): Promise<string> {
      const response = await client.sessions.create({
        browser: SESSION_DEFAULTS.browser,
        session: SESSION_DEFAULTS.session,
      })

      sessionId = response.data?.id
      if (!sessionId) {
        throw new Error('AnchorBrowser returned no session ID')
      }
      return sessionId
    },

    async execute(task: string): Promise<string> {
      if (!sessionId) {
        await this.create()
      }

      const result = await client.tools.performWebTask({
        sessionId: sessionId!,
        prompt: task,
        max_steps: 30,
      })

      return parseResult(result.data?.result) ?? ''
    },

    async kill(): Promise<void> {
      if (sessionId) {
        try {
          await client.sessions.delete(sessionId)
        } catch (err: unknown) {
          // Swallow 404 (already expired) — rethrow real failures
          const status = (err as { status?: number })?.status
          const message = err instanceof Error ? err.message : String(err)
          if (status !== 404 && !message.includes('not found')) {
            sessionId = undefined
            throw err
          }
        }
        sessionId = undefined
      }
    },

    async isAlive(): Promise<boolean> {
      if (!sessionId) return false
      try {
        const info = await client.sessions.retrieve(sessionId)
        const status = (info as { data?: { status?: string } }).data?.status ?? info.status
        return status === 'running'
      } catch (err: unknown) {
        // 404 means session is gone — that's a definite "not alive"
        const status = (err as { status?: number })?.status
        if (status === 404) return false
        // Network/server errors: we genuinely don't know — throw so caller can decide
        throw err
      }
    },

    getSessionId(): string | undefined {
      return sessionId
    },
  }
}

function parseResult(result: unknown): string | null {
  if (!result) return null
  if (typeof result === 'string') return result
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>
    if ('result' in obj && typeof obj.result === 'string') return obj.result
    return JSON.stringify(obj)
  }
  return null
}
