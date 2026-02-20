import { createLeash } from 'leashed'

// Create a leash with inline policy
const leash = createLeash({
  allow: ['read*', 'list*', 'check*'],
  deny: ['*send*', '*delete*', '*settings*'],
  expire: '60min',
  agent: 'demo-agent',
})

// These will be policy-checked + audited
const r1 = await leash.task('read my inbox')
console.log('read inbox:', r1.allowed, r1.output?.slice(0, 80))

const r2 = await leash.task('send message to Bob')
console.log('send message:', r2.allowed, r2.reason)

// Check status
console.log('status:', leash.status())

// View audit log
console.log('audit:', leash.audit())

// Kill when done
await leash.yank()
