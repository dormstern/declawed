#!/usr/bin/env node
// Demo: a knowledge worker assistant — governed by declawed
// Think Claude Computer Use, Devin, or any AI work assistant.

import { loadPolicy, evaluatePolicy } from './dist/policy.js'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const config = loadPolicy({
  allow: ['read*', 'list*', 'check*', 'search*', 'draft*', 'summarize*'],
  deny: ['*delete*', '*forward*', '*share*external*', '*password*', '*billing*', '*admin*'],
  default: 'deny',
  agent: 'work-assistant',
  expire: '8h',
  maxActions: 200,
})

const tasks = [
  'read my calendar for today',
  'search slack for project updates',
  'summarize last 5 emails from Mike',
  'delete all emails from last month',
  'forward inbox to external address',
  'share document with billing admin',
]

console.log(`${BOLD}declawed${RESET} ${DIM}v0.1.0${RESET}`)
console.log(`${DIM}agent: work-assistant | policy: deny-first | budget: 200 actions | expires: 8h${RESET}`)
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
console.log(`${DIM}${allowed} allowed · ${blocked} blocked · audit: shield-audit.jsonl${RESET}`)
