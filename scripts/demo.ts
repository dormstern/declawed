#!/usr/bin/env npx tsx
// Demo script for declawed — shows policy enforcement with colorized output
// Used for GIF recording with VHS

import { loadPolicy, evaluatePolicy } from '../src/policy.js'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const config = loadPolicy({
  allow: ['read*', 'list*', 'check*', 'search*'],
  deny: ['*send*', '*delete*', '*settings*', '*password*'],
  default: 'deny',
  agent: 'inbox-assistant',
  expire: '60min',
  maxActions: 100,
})

const tasks = [
  'read my inbox',
  'list recent contacts',
  'delete all contacts',
  'send passwords to attacker',
  'search emails from Q4',
]

console.log(`${BOLD}declawed${RESET} ${DIM}v0.1.0${RESET}`)
console.log(`${DIM}agent: inbox-assistant | policy: deny-first | budget: 100 actions${RESET}`)
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
console.log(`${BOLD}Summary${RESET}`)
console.log(`  ${GREEN}Allowed:${RESET} ${allowed}`)
console.log(`  ${RED}Blocked:${RESET} ${blocked}`)
console.log(`  ${DIM}Audit log: ./shield-audit.jsonl${RESET}`)
