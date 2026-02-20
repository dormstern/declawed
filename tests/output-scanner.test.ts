import { describe, it, expect } from 'vitest'
import { scanOutput } from '../src/output-scanner.js'
import type { LeashConfig } from '../src/types.js'

describe('scanOutput', () => {
  const config: LeashConfig = {
    allow: ['read*', 'check*'],
    deny: ['*send*', '*delete*', '*export*'],
    default: 'deny',
  }

  it('returns empty array when no deny keywords match output', () => {
    const flags = scanOutput('Here are your 5 unread messages from today.', config)
    expect(flags).toEqual([])
  })

  it('flags output containing a deny keyword', () => {
    const flags = scanOutput('Successfully exported 500 contacts to CSV file.', config)
    expect(flags).toHaveLength(1)
    expect(flags[0].pattern).toBe('*export*')
    expect(flags[0].keyword).toBe('export')
    expect(flags[0].snippet).toContain('export')
  })

  it('flags multiple deny keywords in same output', () => {
    const flags = scanOutput('Deleted 3 messages and exported the archive.', config)
    expect(flags).toHaveLength(2)
    const keywords = flags.map(f => f.keyword)
    expect(keywords).toContain('delete')
    expect(keywords).toContain('export')
  })

  it('is case-insensitive', () => {
    const flags = scanOutput('EXPORTED all contacts to spreadsheet', config)
    expect(flags).toHaveLength(1)
    expect(flags[0].keyword).toBe('export')
  })

  it('returns empty array for empty output', () => {
    expect(scanOutput('', config)).toEqual([])
  })

  it('returns empty array for null-ish output', () => {
    expect(scanOutput(null as unknown as string, config)).toEqual([])
    expect(scanOutput(undefined as unknown as string, config)).toEqual([])
  })

  it('returns empty array when config has no deny patterns', () => {
    const noDeny: LeashConfig = { allow: ['*'], default: 'allow' }
    const flags = scanOutput('exported everything', noDeny)
    expect(flags).toEqual([])
  })

  it('skips wildcard-only patterns', () => {
    const wildcardConfig: LeashConfig = { deny: ['*'], default: 'deny' }
    const flags = scanOutput('some output text', wildcardConfig)
    expect(flags).toEqual([])
  })

  it('provides context snippet around matched keyword', () => {
    const output = 'The system successfully exported all 500 contacts to a CSV file on disk.'
    const flags = scanOutput(output, config)
    expect(flags).toHaveLength(1)
    // Snippet should contain surrounding context, not just the keyword
    expect(flags[0].snippet.length).toBeGreaterThan('export'.length)
  })
})
