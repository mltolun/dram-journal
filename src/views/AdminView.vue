<template>
  <!-- Auth gate -->
  <div v-if="!currentUser" style="position:fixed;inset:0;z-index:500;background:var(--peat);display:flex;align-items:center;justify-content:center;">
    <div class="auth-box" style="text-align:center">
      <div class="auth-logo">Dram <span>Admin</span></div>
      <div class="auth-tagline">Sign in to continue</div>
      <div v-if="authError" class="auth-msg auth-error">{{ authError }}</div>
      <input v-model="email"    class="field-input" type="email"    placeholder="Email"    style="margin-bottom:0.5rem" @keyup.enter="login" />
      <input v-model="password" class="field-input" type="password" placeholder="Password" style="margin-bottom:0.5rem" @keyup.enter="login" />
      <button class="btn-auth" :disabled="loggingIn" @click="login">
        {{ loggingIn ? 'Signing in…' : 'Sign in' }}
      </button>
    </div>
  </div>

  <!-- Dashboard -->
  <div v-else class="admin-shell">

    <!-- Header -->
    <header class="admin-header">
      <div>
        <div class="brand-title">Dram <span>Admin</span></div>
        <div class="brand-sub">Management dashboard</div>
      </div>
      <div style="display:flex;align-items:center;gap:1.5rem">
        <div v-if="lastRefreshed" class="admin-refresh-label">
          Updated {{ lastRefreshed }}
        </div>
        <button class="btn-icon" :class="{ spinning: loading }" title="Refresh" @click="loadData">
          ↻
        </button>
        <div class="header-email">{{ currentUser.email }}</div>
        <button class="btn-signout" @click="logout">Sign out</button>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="loading && !rows.length" class="admin-loading">
      <div class="scan-spinner"></div>
      <div style="font-family:'DM Mono',monospace;font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--peat-light);">Loading data…</div>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="admin-loading">
      <div style="font-size:2rem;opacity:0.4">⚠</div>
      <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--peat-light)">{{ loadError }}</div>
      <button class="btn-auth" style="margin-top:1rem;width:auto;padding:8px 24px" @click="loadData">Retry</button>
    </div>

    <template v-else>
      <!-- Stat cards -->
      <div class="stat-strip">
        <div class="stat-card">
          <div class="stat-card-value">{{ rows.length }}</div>
          <div class="stat-card-label">Registered Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">{{ totalJournal }}</div>
          <div class="stat-card-label">Journal Entries</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">{{ totalWishlist }}</div>
          <div class="stat-card-label">Wishlist Entries</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">{{ totalWhiskies }}</div>
          <div class="stat-card-label">Total Whiskies</div>
        </div>
      </div>

      <!-- User table -->
      <div class="table-wrap">
        <div class="table-header-row">
          <div class="table-title">Users</div>
          <div class="table-search-wrap">
            <input v-model="search" class="table-search" placeholder="Search by email…" />
          </div>
        </div>

        <table class="admin-table">
          <thead>
            <tr>
              <th class="col-email" @click="setSort('email')">
                Email <span class="sort-arrow">{{ sortIndicator('email') }}</span>
              </th>
              <th class="col-num" @click="setSort('journal')">
                Journal <span class="sort-arrow">{{ sortIndicator('journal') }}</span>
              </th>
              <th class="col-num" @click="setSort('wishlist')">
                Wishlist <span class="sort-arrow">{{ sortIndicator('wishlist') }}</span>
              </th>
              <th class="col-num" @click="setSort('total')">
                Total <span class="sort-arrow">{{ sortIndicator('total') }}</span>
              </th>
              <th class="col-date" @click="setSort('created')">
                Joined <span class="sort-arrow">{{ sortIndicator('created') }}</span>
              </th>
              <th class="col-date" @click="setSort('lastScan')">
                Last scan <span class="sort-arrow">{{ sortIndicator('lastScan') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredRows.length === 0">
              <td colspan="6" class="empty-row">No users match your search</td>
            </tr>
            <tr v-for="row in filteredRows" :key="row.id" class="data-row">
              <td class="col-email">
                <span class="user-email">{{ row.email }}</span>
                <span v-if="row.id === currentUser.id" class="you-badge">you</span>
              </td>
              <td class="col-num">
                <span class="num-pill journal-pill">{{ row.journal }}</span>
              </td>
              <td class="col-num">
                <span class="num-pill wishlist-pill">{{ row.wishlist }}</span>
              </td>
              <td class="col-num">
                <span class="num-total">{{ row.total }}</span>
              </td>
              <td class="col-date">{{ row.createdFmt }}</td>
              <td class="col-date">{{ row.lastScanFmt }}</td>
            </tr>
          </tbody>
        </table>

        <div class="table-footer">
          Showing {{ filteredRows.length }} of {{ rows.length }} users
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from '../composables/useAuth.js'
import { useAuth } from '../composables/useAuth.js'

const { signIn, signOut, getSession } = useAuth()

// ── Admin guard ───────────────────────────────────────────────────────────────
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

async function guardCheck() {
  if (currentUser.value?.email !== ADMIN_EMAIL) {
    await signOut()
    authError.value = 'Not authorised.'
    return false
  }
  return true
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const email      = ref('')
const password   = ref('')
const authError  = ref('')
const loggingIn  = ref(false)

async function login() {
  authError.value = ''
  loggingIn.value = true
  try {
    await signIn(email.value, password.value)
    if (await guardCheck()) await loadData()
  } catch (e) {
    authError.value = e.message || 'Sign in failed'
  } finally {
    loggingIn.value = false
  }
}

async function logout() {
  await signOut()
  rows.value = []
}

// ── Data loading ──────────────────────────────────────────────────────────────
const rows          = ref([])
const loading       = ref(false)
const loadError     = ref('')
const lastRefreshed = ref('')

async function loadData() {
  loading.value   = true
  loadError.value = ''
  try {
    // Fetch all users via admin RPC (requires service-role or admin function)
    // Fallback: fetch distinct user_ids from whiskies + scan_usage and join what we can
    const [whiskiesRes, scansRes, usersRes] = await Promise.all([
      sb.from('whiskies').select('user_id, list'),
      sb.from('scan_usage').select('user_id, date').order('date', { ascending: false }),
      sb.from('user_profiles').select('id, email, created_at').order('created_at', { ascending: true }),
    ])

    if (whiskiesRes.error)  throw whiskiesRes.error
    if (scansRes.error)     throw scansRes.error
    if (usersRes.error)     throw usersRes.error

    const allWhiskies  = whiskiesRes.data  || []
    const allScans     = scansRes.data     || []
    const allUsers     = usersRes.data     || []

    // Index whiskies per user
    const journalCount  = {}
    const wishlistCount = {}
    for (const w of allWhiskies) {
      const uid = w.user_id
      if ((w.list || 'journal') === 'journal') {
        journalCount[uid]  = (journalCount[uid]  || 0) + 1
      } else {
        wishlistCount[uid] = (wishlistCount[uid] || 0) + 1
      }
    }

    // Last scan date per user (rows already ordered desc)
    const lastScan = {}
    for (const s of allScans) {
      if (!lastScan[s.user_id]) lastScan[s.user_id] = s.date
    }

    rows.value = allUsers.map(u => {
      const j = journalCount[u.id]  || 0
      const w = wishlistCount[u.id] || 0
      return {
        id:         u.id,
        email:      u.email,
        journal:    j,
        wishlist:   w,
        total:      j + w,
        created:    u.created_at,
        createdFmt: fmtDate(u.created_at),
        lastScan:   lastScan[u.id] || null,
        lastScanFmt: lastScan[u.id] ? fmtDate(lastScan[u.id]) : '—',
      }
    })

    lastRefreshed.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    loadError.value = e.message || 'Failed to load data'
  } finally {
    loading.value = false
  }
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Totals ────────────────────────────────────────────────────────────────────
const totalJournal  = computed(() => rows.value.reduce((s, r) => s + r.journal, 0))
const totalWishlist = computed(() => rows.value.reduce((s, r) => s + r.wishlist, 0))
const totalWhiskies = computed(() => totalJournal.value + totalWishlist.value)

// ── Search & sort ─────────────────────────────────────────────────────────────
const search  = ref('')
const sortKey = ref('total')
const sortDir = ref(-1) // -1 desc, 1 asc

function setSort(key) {
  if (sortKey.value === key) sortDir.value *= -1
  else { sortKey.value = key; sortDir.value = key === 'email' ? 1 : -1 }
}

function sortIndicator(key) {
  if (sortKey.value !== key) return ''
  return sortDir.value === -1 ? '↓' : '↑'
}

const filteredRows = computed(() => {
  const q = search.value.toLowerCase()
  let list = q ? rows.value.filter(r => r.email.toLowerCase().includes(q)) : [...rows.value]
  list.sort((a, b) => {
    let av = a[sortKey.value], bv = b[sortKey.value]
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    if (av == null) return 1
    if (bv == null) return -1
    return av < bv ? -sortDir.value : av > bv ? sortDir.value : 0
  })
  return list
})

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await getSession()
  if (currentUser.value) {
    if (await guardCheck()) await loadData()
  }
})
</script>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: var(--bg);
}

/* ── Header ── */
.admin-header {
  padding: 1.2rem 2rem;
  border-bottom: 0.5px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}
.admin-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--amber), transparent);
  opacity: 0.35;
}
.admin-refresh-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
}
.btn-icon {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 6px;
  color: var(--peat-light);
  font-size: 1.1rem;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
}
.btn-icon:hover { border-color: var(--amber); color: var(--amber-light); }
.btn-icon.spinning { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Loading ── */
.admin-loading {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 1rem;
  min-height: 40vh;
}
.scan-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── Stat strip ── */
.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  border-bottom: 0.5px solid var(--border);
  background: var(--border);
  margin-bottom: 2rem;
}
.stat-card {
  background: var(--bg);
  padding: 1.6rem 2rem;
  display: flex; flex-direction: column; gap: 4px;
}
.stat-card-value {
  font-family: 'DM Mono', monospace;
  font-size: 2.4rem;
  font-weight: 300;
  color: var(--amber-light);
  line-height: 1;
}
.stat-card-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--peat-light);
}
@media (max-width: 640px) {
  .stat-strip { grid-template-columns: repeat(2, 1fr); }
}

/* ── Table wrapper ── */
.table-wrap {
  margin: 0 2rem 3rem;
  border: 0.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.table-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 0.5px solid var(--border);
  background: var(--bg-card);
  gap: 1rem;
}
.table-title {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--peat-light);
}
.table-search-wrap { flex: 1; max-width: 260px; }
.table-search {
  width: 100%;
  background: var(--bg-input);
  border: 0.5px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}
.table-search::placeholder { color: var(--peat-light); }
.table-search:focus { border-color: var(--amber); }

/* ── Table ── */
.admin-table {
  width: 100%;
  border-collapse: collapse;
}
.admin-table thead tr {
  background: var(--bg-card);
  border-bottom: 0.5px solid var(--border);
}
.admin-table th {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--peat-light);
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: color 0.15s;
}
.admin-table th:hover { color: var(--amber-light); }
.sort-arrow { color: var(--amber); margin-left: 3px; }

.data-row {
  border-bottom: 0.5px solid var(--border);
  transition: background 0.15s;
}
.data-row:last-child { border-bottom: none; }
.data-row:hover { background: rgba(200,130,42,0.04); }

.admin-table td {
  padding: 10px 14px;
  vertical-align: middle;
}
.col-email  { width: 40%; }
.col-num    { width: 10%; text-align: center; }
.col-date   { width: 15%; }

.user-email {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--text-primary);
  word-break: break-all;
}
.you-badge {
  font-family: 'DM Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--amber-light);
  background: rgba(200,130,42,0.12);
  border: 0.5px solid var(--border);
  border-radius: 20px;
  padding: 2px 6px;
  margin-left: 8px;
  vertical-align: middle;
}
.num-pill {
  display: inline-block;
  min-width: 28px;
  text-align: center;
  border-radius: 20px;
  padding: 2px 8px;
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
}
.journal-pill  { background: rgba(200,130,42,0.12); color: var(--amber-light); border: 0.5px solid var(--border); }
.wishlist-pill { background: rgba(50,170,100,0.12);  color: #6ecb93;            border: 0.5px solid rgba(50,170,100,0.2); }
.num-total {
  font-family: 'DM Mono', monospace;
  font-size: 0.82rem;
  color: var(--text-primary);
  display: block;
  text-align: center;
}
.col-date {
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  color: var(--peat-light);
  white-space: nowrap;
}

.empty-row {
  text-align: center;
  padding: 3rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--peat-light);
}

.table-footer {
  padding: 8px 14px;
  border-top: 0.5px solid var(--border);
  background: var(--bg-card);
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
}

/* ── Field input (used in login form) ── */
.field-input {
  width: 100%;
  background: var(--bg-input);
  border: 0.5px solid var(--border);
  border-radius: 7px;
  padding: 10px 12px;
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
  outline: none;
  display: block;
  transition: border-color 0.2s;
}
.field-input::placeholder { color: var(--peat-light); }
.field-input:focus { border-color: var(--amber); }
</style>
