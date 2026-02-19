/**
 * Example: Using Shield to govern an OpenClaw-style inbox assistant.
 *
 * Instead of giving the agent unrestricted access to your email,
 * Shield enforces read-only access with a 1-hour time limit.
 */
import { createShield } from '../src/index.js'

// Load policy from YAML (production pattern)
const shield = createShield('./examples/shield.yaml')

// Simulate an agent workflow
async function agentLoop() {
  // Step 1: Agent reads inbox (allowed)
  const inbox = await shield.task('read my email inbox')
  if (!inbox.allowed) {
    console.log('Cannot read inbox:', inbox.reason)
    return
  }
  console.log('Inbox:', inbox.output?.slice(0, 200))

  // Step 2: Agent tries to send a reply (blocked by policy)
  const reply = await shield.task('send reply to John: Thanks for the update')
  console.log('Send reply blocked:', reply.reason)
  // -> "blocked by deny pattern: *send*"

  // Step 3: Agent tries to change settings (blocked)
  const settings = await shield.task('update email notification settings')
  console.log('Settings blocked:', settings.reason)
  // -> "blocked by deny pattern: *settings*"

  // Step 4: Agent searches (allowed)
  const search = await shield.task('search emails from Q4 report')
  console.log('Search:', search.allowed)

  // Print final status
  const status = shield.status()
  console.log(`\nSession stats:`)
  console.log(`  Allowed: ${status.allowed}`)
  console.log(`  Blocked: ${status.blocked}`)
  console.log(`  Uptime:  ${status.uptime}`)

  // Clean up
  await shield.kill()
}

agentLoop().catch(console.error)
