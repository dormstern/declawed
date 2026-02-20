import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { loadPolicy, matchesPattern, evaluatePolicy } from '../src/policy.js'
import type { LeashConfig } from '../src/types.js'

describe('matchesPattern', () => {
  it('matches exact string', () => {
    expect(matchesPattern('read inbox', 'read inbox')).toBe(true)
  })

  it('matches wildcard prefix', () => {
    expect(matchesPattern('read my inbox', 'read*')).toBe(true)
  })

  it('matches wildcard contains', () => {
    expect(matchesPattern('please send a message', '*send*')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matchesPattern('READ INBOX', 'read*')).toBe(true)
    expect(matchesPattern('read inbox', 'READ*')).toBe(true)
  })

  it('rejects non-matching', () => {
    expect(matchesPattern('send message', 'read*')).toBe(false)
  })

  it('matches wildcard suffix', () => {
    expect(matchesPattern('check email', '*email')).toBe(true)
  })
})

describe('Unicode bypass protection', () => {
  const config: LeashConfig = {
    allow: ['read*'],
    deny: ['*send*', '*delete*'],
    default: 'deny',
  }

  it('blocks task with zero-width spaces in deny keyword', () => {
    // "s\u200Bend" should still match *send*
    const result = evaluatePolicy('s\u200Bend message', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })

  it('blocks task with zero-width joiners in deny keyword', () => {
    const result = evaluatePolicy('de\u200Dlete files', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*delete*')
  })

  it('blocks task with combining diacriticals in deny keyword', () => {
    // "se\u0301nd" — combining acute accent on 'e'
    const result = evaluatePolicy('se\u0301nd message', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })

  it('blocks task with zero-width non-joiner', () => {
    const result = evaluatePolicy('s\u200Ce\u200Cnd message', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })

  it('blocks task with FEFF (BOM) characters', () => {
    const result = evaluatePolicy('\uFEFFsend message', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })

  it('blocks task with bidirectional control characters', () => {
    const result = evaluatePolicy('send\u202A message', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })
})

describe('evaluatePolicy', () => {
  const config: LeashConfig = {
    allow: ['read*', 'list*', 'check*'],
    deny: ['*send*', '*delete*', '*settings*'],
    default: 'deny',
  }

  it('allows matching allow pattern', () => {
    const result = evaluatePolicy('read my inbox', config)
    expect(result.allowed).toBe(true)
  })

  it('blocks matching deny pattern', () => {
    const result = evaluatePolicy('send message to Bob', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })

  it('deny takes priority over allow', () => {
    // "read and send" matches both read* and *send*
    const result = evaluatePolicy('read and send messages', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('*send*')
  })

  it('falls back to default deny', () => {
    const result = evaluatePolicy('do something random', config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('default: deny')
  })

  it('falls back to default allow when configured', () => {
    const permissive: LeashConfig = {
      deny: ['*delete*'],
      default: 'allow',
    }
    const result = evaluatePolicy('do something random', permissive)
    expect(result.allowed).toBe(true)
  })

  it('handles empty config with default deny', () => {
    const empty: LeashConfig = { default: 'deny' }
    const result = evaluatePolicy('anything', empty)
    expect(result.allowed).toBe(false)
  })

  it('handles empty config with default allow', () => {
    const empty: LeashConfig = { default: 'allow' }
    const result = evaluatePolicy('anything', empty)
    expect(result.allowed).toBe(true)
  })
})

describe('loadPolicy', () => {
  const tmpDir = join(__dirname, '.tmp-policy-test')

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loads inline config object', () => {
    const config = loadPolicy({
      allow: ['read*'],
      deny: ['*send*'],
      default: 'deny',
    })
    expect(config.allow).toEqual(['read*'])
    expect(config.deny).toEqual(['*send*'])
    expect(config.default).toBe('deny')
  })

  it('sets default to deny when not specified', () => {
    const config = loadPolicy({ allow: ['read*'] })
    expect(config.default).toBe('deny')
  })

  it('loads YAML file', () => {
    const yamlContent = `
agent: inbox-assistant
rules:
  allow:
    - "read*"
    - "list*"
  deny:
    - "*send*"
    - "*delete*"
default: deny
expire_after: 60min
max_actions: 100
`
    const filePath = join(tmpDir, 'leash.yaml')
    writeFileSync(filePath, yamlContent)

    const config = loadPolicy(filePath)
    expect(config.agent).toBe('inbox-assistant')
    expect(config.allow).toEqual(['read*', 'list*'])
    expect(config.deny).toEqual(['*send*', '*delete*'])
    expect(config.default).toBe('deny')
    expect(config.expire).toBe('60min')
    expect(config.maxActions).toBe(100)
  })

  it('handles YAML with missing optional fields', () => {
    const yamlContent = `
agent: minimal
rules:
  allow:
    - "*"
`
    const filePath = join(tmpDir, 'minimal.yaml')
    writeFileSync(filePath, yamlContent)

    const config = loadPolicy(filePath)
    expect(config.agent).toBe('minimal')
    expect(config.allow).toEqual(['*'])
    expect(config.deny).toEqual([])
    expect(config.default).toBe('deny')
  })

  it('throws for non-existent file', () => {
    expect(() => loadPolicy('/nonexistent/leash.yaml')).toThrow()
  })

  it('throws for YAML that parses to a non-object', () => {
    const filePath = join(tmpDir, 'bad.yaml')
    writeFileSync(filePath, 'just a string\n')
    expect(() => loadPolicy(filePath)).toThrow('Invalid YAML policy')
  })

  it('throws for empty YAML file', () => {
    const filePath = join(tmpDir, 'empty.yaml')
    writeFileSync(filePath, '')
    expect(() => loadPolicy(filePath)).toThrow('Invalid YAML policy')
  })

  it('throws for non-string values in allow array (YAML type coercion)', () => {
    const yamlContent = `
rules:
  allow:
    - true
    - 123
  deny:
    - "*send*"
`
    const filePath = join(tmpDir, 'coercion.yaml')
    writeFileSync(filePath, yamlContent)
    expect(() => loadPolicy(filePath)).toThrow('pattern must be a string')
  })

  it('throws for non-string values in deny array', () => {
    const yamlContent = `
rules:
  allow:
    - "read*"
  deny:
    - false
`
    const filePath = join(tmpDir, 'coercion-deny.yaml')
    writeFileSync(filePath, yamlContent)
    expect(() => loadPolicy(filePath)).toThrow('pattern must be a string')
  })

  it('loads domains from YAML', () => {
    const yamlContent = `
agent: linkedin-bot
rules:
  allow:
    - "read*"
  deny:
    - "*export*"
domains:
  - linkedin.com
  - gmail.com
default: deny
`
    const filePath = join(tmpDir, 'domains.yaml')
    writeFileSync(filePath, yamlContent)
    const config = loadPolicy(filePath)
    expect(config.domains).toEqual(['linkedin.com', 'gmail.com'])
  })
})
