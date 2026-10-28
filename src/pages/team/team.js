// Settings → Team: who can open the current brand. Mock only: fake people, fake delays, no emails go out.
// ?mock= picks the state the page opens in (a dev-only switcher on the page flips them too):
//   normal (default) · owner-only (just the owner: the empty state) · loading (stays on the skeleton) · error (Retry loads)

export const TEAM_STATES = [
  { value: 'normal', label: 'Normal' },
  { value: 'owner-only', label: 'Just owner' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
]

export const initialState = () => {
  const q = new URLSearchParams(window.location.search).get('mock')
  return TEAM_STATES.some((s) => s.value === q) ? q : 'normal'
}

const DAY = 864e5
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let seq = 0
const id = () => `m${Date.now()}${seq++}`

// role: owner | member · status: active | pending (sentAt: when the invite last went out) · you: the signed-in user
// lastActiveAt: when they last used the app. PORT NOTE: production may not track this yet; without it the row just
// leaves the "Active … / Last seen …" text out.
export function seedMembers(state, now = Date.now()) {
  const owner = { id: 'u1', name: 'Alex Morgan', email: 'alex@example.com', role: 'owner', status: 'active', you: true, lastActiveAt: now }
  if (state === 'owner-only') return [owner]
  return [
    owner,
    { id: 'u2', name: 'Harsh Mehta', email: 'harsh@example.com', role: 'member', status: 'active', lastActiveAt: now - 7 * DAY },
    { id: 'u3', name: 'Jordan Lee', email: 'jordan@example.com', role: 'member', status: 'pending', sentAt: now - 2 * DAY },
  ]
}

// the fake backend: every call takes a moment, like the real one
export const teamApi = {
  load: async (state) => { await wait(700); if (state === 'error') throw new Error('The server didn’t answer in time.'); return seedMembers(state) },
  invite: async ({ name, email }) => { await wait(900); return { id: id(), name: name.trim(), email: email.trim(), role: 'member', status: 'pending', sentAt: Date.now() } },
  resend: async () => { await wait(700); return Date.now() },
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

// "Alex Morgan" → AM · no name → the email's first letter
export const initials = (m) => {
  const words = (m.name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return m.email[0].toUpperCase()
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

export const firstName = (m) => (m.name || '').trim().split(/\s+/)[0] || m.email

// "Active now" (you) · "Active 2h ago" (today) · "Last seen Oct 18" (earlier) · null when it isn't known
export function lastActive(m, now = Date.now()) {
  if (m.you) return 'Active now'
  if (!m.lastActiveAt) return null
  const h = Math.floor((now - m.lastActiveAt) / 36e5)
  if (h < 1) return 'Active just now'
  if (h < 24) return `Active ${h}h ago`
  const d = new Date(m.lastActiveAt)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return `Last seen ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })}`
}

// "just now" · "3h ago" · "2d ago"
export function sentAgo(ts, now = Date.now()) {
  const h = Math.floor((now - ts) / 36e5)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
