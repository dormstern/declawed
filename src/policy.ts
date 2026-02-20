import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import picomatch from 'picomatch'
import type { LeashConfig, YamlPolicy } from './types.js'

/**
 * Strip invisible Unicode characters that could bypass deny patterns.
 * Removes: zero-width spaces, joiners, combining diacriticals, control chars.
 */
function sanitizeTask(task: string): string {
  return task
    // Zero-width characters (U+200B-U+200F, U+FEFF, U+2060-U+2064)
    .replace(/[\u200B-\u200F\uFEFF\u2060-\u2064]/g, '')
    // Combining diacritical marks (U+0300-U+036F)
    .replace(/[\u0300-\u036F]/g, '')
    // Other invisible format characters (U+00AD soft hyphen, U+034F combining grapheme joiner)
    .replace(/[\u00AD\u034F]/g, '')
    // Bidirectional control chars (U+202A-U+202E, U+2066-U+2069)
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
}

/**
 * Validate that an array contains only strings (YAML can coerce bare values to booleans/numbers).
 */
function ensureStringArray(arr: unknown[], label: string): string[] {
  for (const item of arr) {
    if (typeof item !== 'string') {
      throw new Error(`Policy ${label} pattern must be a string, got ${typeof item}: ${JSON.stringify(item)}`)
    }
  }
  return arr as string[]
}

/**
 * Load policy from a YAML file path or inline config object.
 */
export function loadPolicy(configOrPath: string | LeashConfig): LeashConfig {
  if (typeof configOrPath === 'string') {
    const raw = readFileSync(configOrPath, 'utf-8')
    const doc = yaml.load(raw)

    if (!doc || typeof doc !== 'object') {
      throw new Error('Invalid YAML policy: expected an object')
    }

    const policy = doc as YamlPolicy
    return {
      agent: policy.agent,
      allow: ensureStringArray(policy.rules?.allow ?? [], 'allow'),
      deny: ensureStringArray(policy.rules?.deny ?? [], 'deny'),
      default: policy.default ?? 'deny',
      expire: policy.expire_after,
      maxActions: policy.max_actions,
      domains: policy.domains,
    }
  }
  return {
    default: 'deny',
    ...configOrPath,
  }
}

/**
 * Check if a task string matches a glob pattern (case-insensitive).
 */
export function matchesPattern(task: string, pattern: string): boolean {
  const matcher = picomatch(pattern, { nocase: true })
  return matcher(task)
}

/**
 * Evaluate a task against the policy. Deny rules checked first.
 * Task strings are sanitized to strip invisible Unicode before matching.
 */
export function evaluatePolicy(
  task: string,
  config: LeashConfig,
): { allowed: boolean; reason?: string } {
  const sanitized = sanitizeTask(task)

  // Check deny rules first
  for (const pattern of config.deny ?? []) {
    if (matchesPattern(sanitized, pattern)) {
      return { allowed: false, reason: `blocked by deny pattern: ${pattern}` }
    }
  }

  // Check allow rules
  for (const pattern of config.allow ?? []) {
    if (matchesPattern(sanitized, pattern)) {
      return { allowed: true }
    }
  }

  // No match — use default
  const defaultAction = config.default ?? 'deny'
  if (defaultAction === 'allow') {
    return { allowed: true }
  }
  return { allowed: false, reason: 'no matching allow rule (default: deny)' }
}
