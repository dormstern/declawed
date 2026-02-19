import { createShield } from '../src/index.js'

// Create a shield with inline policy
const shield = createShield({
  allow: ['read*', 'list*', 'check*'],
  deny: ['*send*', '*delete*', '*settings*'],
  expire: '60min',
  agent: 'demo-agent',
})

// These will be policy-checked + audited
const r1 = await shield.task('read my inbox')
console.log('read inbox:', r1.allowed, r1.output?.slice(0, 80))

const r2 = await shield.task('send message to Bob')
console.log('send message:', r2.allowed, r2.reason)

// Check status
console.log('status:', shield.status())

// View audit log
console.log('audit:', shield.audit())

// Kill when done
await shield.kill()
