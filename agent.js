#!/usr/bin/env node
// Demo: an OpenClaw sales bot — governed by leashed
// This is what it looks like when your agent has rules.

import { loadPolicy, evaluatePolicy } from './dist/policy.js'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const config = loadPolicy({
  allow: ['read*', 'list*', 'check*', 'search*'],
  deny: ['*send*', '*delete*', '*export*', '*password*'],
  default: 'deny',
  agent: 'my-openclaw-sales-bot',
  expire: '60min',
  maxActions: 50,
})

const tasks = [
  'check linkedin inbox',
  'read messages from Sarah Chen',
  'list connection requests',
  'export all contacts to CSV',
  'change account password',
  'send bulk connection requests',
]

console.log(`${BOLD}leashed${RESET} ${DIM}v0.1.0${RESET}`)
console.log(`${DIM}agent: my-openclaw-sales-bot | policy: deny-first | budget: 50 actions | expires: 60min${RESET}`)
console.log()

let allowed = 0
let blocked = 0

for (const task of tasks) {
  const result = evaluatePolicy(task, config)
  if (result.allowed) {
    allowed++
    console.log(`  ${GREEN}✓ ALLOWED${RESET}  ${task}`)
  } else {
    blocked++
    console.log(`  ${RED}✗ BLOCKED${RESET}  ${task}  ${DIM}(${result.reason})${RESET}`)
  }
}

console.log()
console.log(`${DIM}${allowed} allowed · ${blocked} blocked · audit: leash-audit.jsonl${RESET}`)
