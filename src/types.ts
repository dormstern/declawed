export interface LeashConfig {
  allow?: string[]
  deny?: string[]
  default?: 'allow' | 'deny'
  expire?: string
  maxActions?: number
  agent?: string
  domains?: string[]
}

export interface OutputFlag {
  pattern: string
  keyword: string
  snippet: string
}

export interface LeashResult {
  allowed: boolean
  output?: string
  reason?: string
  auditId: string
  flags?: OutputFlag[]
}

export interface AuditEvent {
  id: string
  timestamp: string
  agent: string
  task: string
  action: 'allowed' | 'blocked' | 'error' | 'killed'
  reason?: string
  duration?: number
  flags?: OutputFlag[]
  domains?: string[]
}

export interface LeashStatus {
  active: boolean
  agent: string
  uptime: string
  allowed: number
  blocked: number
  sessionId?: string
}

export interface YamlPolicy {
  agent?: string
  rules?: {
    allow?: string[]
    deny?: string[]
  }
  default?: 'allow' | 'deny'
  expire_after?: string
  max_actions?: number
  domains?: string[]
}
