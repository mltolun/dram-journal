/**
 * print-user-configs.js
 *
 * Prints each user's email, locale, and created_at from Supabase user_metadata.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/print-user-configs.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const allUsers = []
let page = 1
while (true) {
  const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) { console.error('listUsers error:', error.message); process.exit(1) }
  if (!users?.length) break
  allUsers.push(...users)
  if (users.length < 1000) break
  page++
}

console.log(`\n${'Email'.padEnd(40)} ${'Locale'.padEnd(8)} Created At`)
console.log('-'.repeat(72))
for (const u of allUsers) {
  const locale    = u.user_metadata?.locale || '(none)'
  const createdAt = new Date(u.created_at).toISOString().slice(0, 10)
  console.log(`${(u.email ?? '(no email)').padEnd(40)} ${locale.padEnd(8)} ${createdAt}`)
}
console.log(`\nTotal: ${allUsers.length} users`)
