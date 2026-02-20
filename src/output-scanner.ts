import type { LeashConfig, OutputFlag } from './types.js'

/**
 * Scan AnchorBrowser output for keywords from deny patterns.
 * Detection only — flags suspicious content for audit review.
 */
export function scanOutput(output: string, config: LeashConfig): OutputFlag[] {
  if (!output || !config.deny?.length) return []

  const flags: OutputFlag[] = []
  const normalizedOutput = output.toLowerCase()

  for (const pattern of config.deny) {
    const keyword = extractKeyword(pattern)
    if (!keyword) continue

    const idx = normalizedOutput.indexOf(keyword)
    if (idx !== -1) {
      const start = Math.max(0, idx - 20)
      const end = Math.min(output.length, idx + keyword.length + 20)
      const snippet = output.slice(start, end).trim()
      flags.push({ pattern, keyword, snippet })
    }
  }

  return flags
}

/**
 * Extract a matchable keyword from a glob pattern.
 * "*send*" → "send", "delete*" → "delete", "*" → null
 */
function extractKeyword(pattern: string): string | null {
  const keyword = pattern.replace(/\*/g, '').trim().toLowerCase()
  return keyword.length >= 2 ? keyword : null
}
