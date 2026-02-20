/**
 * Example: Using Leash to govern an OpenClaw-style inbox assistant.
 *
 * Instead of giving the agent unrestricted access to your email,
 * Leash enforces read-only access with a 1-hour time limit.
 */
import { createLeash } from 'leashed'

// Load policy from YAML (production pattern)
const leash = createLeash('./examples/leash.yaml')

// Simulate an agent workflow
async function agentLoop() {
  // Step 1: Agent reads inbox (allowed)
  const inbox = await leash.task('read my email inbox')
  if (!inbox.allowed) {
    console.log('Cannot read inbox:', inbox.reason)
    return
  }
  console.log('Inbox:', inbox.output?.slice(0, 200))

  // Step 2: Agent tries to send a reply (blocked by policy)
  const reply = await leash.task('send reply to John: Thanks for the update')
  console.log('Send reply blocked:', reply.reason)
  // -> "blocked by deny pattern: *send*"

  // Step 3: Agent tries to change settings (blocked)
  const settings = await leash.task('update email notification settings')
  console.log('Settings blocked:', settings.reason)
  // -> "blocked by deny pattern: *settings*"

  // Step 4: Agent searches (allowed)
  const search = await leash.task('search emails from Q4 report')
  console.log('Search:', search.allowed)

  // Print final status
  const status = leash.status()
  console.log(`\nSession stats:`)
  console.log(`  Allowed: ${status.allowed}`)
  console.log(`  Blocked: ${status.blocked}`)
  console.log(`  Uptime:  ${status.uptime}`)

  // Clean up
  await leash.yank()
}

agentLoop().catch(console.error)
