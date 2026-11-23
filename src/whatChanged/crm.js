// CRM & Revenue Attribution's "What changed": revenue from AI visits (the page's first number) from the sales rows
// the page loads (crmStates[state].conversions, the last 60 days) and the AI visits it takes from Site Kit's referral
// rows. Sales come in with each CRM sync, not scans: Last scan compares the last 7 days with the 7 before, 30 days
// the last 30 with the 30 before. 90 days needs 180 days of sales, and the CRM's first sync reads 60.
import { crmStates, skAiReferrals, trackedPrompts } from '../data/mock.js'
import { B, DAY, fmtDay, noiseCount, preview } from './util.js'

const END = '2026-10-13' // the page's last day of data
const LEN = { scan: 7, '30d': 30, '90d': 90 }
const ENGINES = { chatgpt: ['ChatGPT', 'chatgpt.com'], perplexity: ['Perplexity', 'perplexity.ai'], gemini: ['Gemini', 'gemini.google.com'], copilot: ['Copilot', 'copilot.microsoft.com'], claude: ['Claude', 'claude.ai'] }
const iso = (t) => new Date(t).toISOString().slice(0, 10)
const money = (v) => `$${Math.round(v).toLocaleString('en-US')}`
const sum = (list) => list.reduce((n, c) => n + c.conversionValue, 0)
// a money change: "+$120" / "−$80"; more revenue is good
const dMoney = (d, base) => (noiseCount(d, base) ? { text: 'No change', good: null, flat: true } : { text: `${d > 0 ? '+' : '−'}${money(Math.abs(d))}`, good: d > 0, up: d > 0 })
const dCount = (d, base) => (noiseCount(d, base) ? { text: 'No change', good: null, flat: true } : { text: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, good: d > 0, up: d > 0 })

function build(state, period) {
  const st = crmStates[state] ?? crmStates.full
  const conv = st.conversions
  const len = LEN[period]
  const endT = Date.parse(`${END}T00:00:00Z`)
  const w = { start: iso(endT - (len - 1) * DAY), prevStart: iso(endT - (2 * len - 1) * DAY), prevEnd: iso(endT - len * DAY) }
  const dayOf = (c) => c.occurredAt.slice(0, 10)
  const cur = conv.filter((c) => dayOf(c) >= w.start && dayOf(c) <= END), prev = conv.filter((c) => dayOf(c) >= w.prevStart && dayOf(c) <= w.prevEnd)
  const oldest = conv.reduce((m, c) => (dayOf(c) < m ? dayOf(c) : m), END)
  const footer = [`${conv.length} sales from AI visits`, `data to ${fmtDay(END)}`]
  if (!conv.length || oldest > w.prevStart || preview() === 'one') {
    return { state: 'one', footer, latestIso: END, trigger: { delta: null }, oneText: conv.length ? `Sales go back to ${fmtDay(oldest)}, not the ${len * 2} days this needs. Compare a shorter period instead.` : 'No sales synced yet. Changes show after the first sync.' }
  }
  const since = fmtDay(w.prevStart)
  const span = period === 'scan' ? 'the last 7 days' : `the last ${len} days`
  const rev = sum(cur), revThen = sum(prev), d = rev - revThen
  const flat = noiseCount(d, revThen)
  const visits = skAiReferrals.filter((r) => r.date >= w.start && r.date <= END).reduce((n, r) => n + r.sessions, 0)
  const visitsThen = skAiReferrals.filter((r) => r.date >= w.prevStart && r.date <= w.prevEnd).reduce((n, r) => n + r.sessions, 0)
  const glance = [
    { label: 'Revenue', value: money(rev), delta: dMoney(d, revThen) },
    { label: 'Orders', value: `${cur.length}`, delta: dCount(cur.length - prev.length, prev.length) },
    { label: 'AI visits', value: visits.toLocaleString('en-US'), delta: dCount(visits - visitsThen, visitsThen) },
  ]

  // ---- by assistant: revenue, its change
  const engines = Object.entries(ENGINES).map(([id, [name, domain]]) => {
    const a = sum(cur.filter((c) => c.referralEngine === id)), b = sum(prev.filter((c) => c.referralEngine === id))
    return { id, mark: { domain }, name, value: a, valueText: money(a), share: rev ? a / rev : 0, d: a - b, delta: dMoney(a - b, b) }
  }).filter((e) => e.value || e.d).sort((x, y) => (noiseCount(y.d, y.value - y.d) ? 0 : Math.abs(y.d)) - (noiseCount(x.d, x.value - x.d) ? 0 : Math.abs(x.d)) || y.value - x.value)

  const driver = flat ? null : engines.find((e) => !e.delta.flat && Math.sign(e.d) === Math.sign(d))
  const headline = flat
    ? [B(`Revenue from AI visits held at ${money(rev)}`), ` in ${span}, within 5% of the ${len} days before.`]
    : [B(`Revenue from AI visits ${d > 0 ? 'rose' : 'fell'} by ${money(Math.abs(d))} to ${money(rev)}`), ` in ${span}`,
      ...(driver ? [', mostly from ', B(driver.name), ` (${driver.delta.text}).`] : ['.'])]

  // ---- prompts behind the sales: revenue change, biggest first
  const byPrompt = new Map()
  for (const c of cur) { const p = byPrompt.get(c.promptKey) ?? { now: 0, then: 0 }; p.now += c.conversionValue; byPrompt.set(c.promptKey, p) }
  for (const c of prev) { const p = byPrompt.get(c.promptKey) ?? { now: 0, then: 0 }; p.then += c.conversionValue; byPrompt.set(c.promptKey, p) }
  const prompts = [...byPrompt].map(([key, p]) => ({ key, ...p, d: p.now - p.then })).filter((p) => !noiseCount(p.d, p.then))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 4).map((p) => ({
      id: `p-${p.key}`, mark: { status: p.d > 0 ? 'good' : 'bad' }, target: '#crm-prompts',
      text: [B(trackedPrompts.find((t) => t.id === p.key)?.prompt ?? p.key), ` brought ${money(p.now)}, from ${money(p.then)}`], delta: dMoney(p.d, p.then),
    }))

  // ---- hero: revenue a day (Last scan) or a week (30 days); grey, the days or weeks before
  const size = period === 'scan' ? 1 : 7
  const n = Math.floor(len / size)
  const startT = endT - (n * size - 1) * DAY
  const bucket = (from) => Array.from({ length: n }, (_, i) => {
    const a = iso(from + i * size * DAY), b = iso(from + ((i + 1) * size - 1) * DAY)
    return { date: fmtDay(a), value: sum(conv.filter((c) => dayOf(c) >= a && dayOf(c) <= b)) }
  })
  const points = bucket(startT)
  const ghost = bucket(startT - n * size * DAY).map((p) => p.value)

  return {
    state: 'changed', since, flat,
    headline, glance,
    hero: { points, ghost, compareAt: -1, caption: `Revenue from AI visits a ${size === 1 ? 'day' : 'week'}, ${span}. Grey: the ${size === 1 ? 'days' : 'weeks'} before.` },
    breakdown: { title: 'Revenue by AI assistant', rows: engines },
    lists: [{ id: 'prompts', title: 'Prompts behind the sales', rows: prompts }],
    next: [],
    footer,
    latestIso: END,
    trigger: { delta: flat ? null : { text: money(Math.abs(d)), up: d > 0, good: d > 0 }, flatText: `No change on the ${len} days before`, spark: points.slice(-6).map((p) => p.value) },
  }
}

const cache = {}
export const crmChanges = (state = 'full') => (cache[state] ??= { page: 'crm', title: 'CRM & Revenue Attribution', build: (period) => build(state, period) })
