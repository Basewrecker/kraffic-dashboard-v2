import { useSyncExternalStore } from 'react'
import { trendMarket, trendNow, trendRegions, trendRuns } from '../../data/mock'

// Trends runs for this browser tab: seeded from mock.js (?mock=empty → none), changed by Analyze / Re-run / Delete.
// A run started here walks Collecting → Reading → Scoring → Done on a timer. A re-run of a known question comes back
// with that question's mentions; a new question comes back with none (the mock has nothing to find for it).
const PHASES = ['collecting', 'reading', 'scoring', 'done']
const STEP_MS = 2200
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
let seq = 100

const seed = () => (new URLSearchParams(window.location.search).get('mock') === 'empty' ? [] : trendRuns.map((r) => ({ ...r })))
let raw = typeof window === 'undefined' ? [] : seed()
let snapshot = null

// API shape → what the pages use
function derive(list) {
  const byQuery = new Map()
  for (const r of [...list].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) byQuery.set(r.query, [...(byQuery.get(r.query) ?? []), r.id])
  return list.map((r) => ({
    id: r.id,
    prompt: r.query,
    region: r.region,
    status: r.status.toLowerCase(), // running | done | failed
    step: PHASES.indexOf(r.phase ?? 'collecting'),
    error: r.error,
    createdAt: r.startedAt,
    finishedAt: r.finishedAt,
    mentions: r.mentionCount,
    sentiment: r.sentimentDistribution,
    runNo: byQuery.get(r.query).indexOf(r.id) + 1,
    previousRunId: r.previousRunId,
    raw: r,
  }))
}
const get = () => (snapshot ??= derive(raw))
const set = (next) => { raw = next; snapshot = null; emit() }

function advance(id) {
  setTimeout(() => {
    const r = raw.find((x) => x.id === id)
    if (!r || r.status !== 'RUNNING') return
    const i = PHASES.indexOf(r.phase)
    if (i < PHASES.length - 2) { set(raw.map((x) => (x.id === id ? { ...x, phase: PHASES[i + 1] } : x))); advance(id); return }
    const source = raw.find((x) => x.query === r.query && x.status === 'DONE' && x.id !== id && x.mentions.length)
    const mentions = (source?.mentions ?? []).map((m) => ({ ...m, id: `${m.id}_${id}` }))
    const dist = { positive: 0, neutral: 0, negative: 0 }
    for (const m of mentions) dist[m.sentiment] += 1
    set(raw.map((x) => (x.id === id ? { ...x, status: 'DONE', phase: 'done', finishedAt: new Date().toISOString(), mentions, mentionCount: mentions.length, sentimentDistribution: dist, themes: source?.themes ?? null } : x)))
  }, STEP_MS)
}

function start(query, region, { previousRunId = null, replaceId = null } = {}) {
  const id = `tr_${++seq}`
  const run = {
    id, query, region, countryCode: trendMarket.countryCode, status: 'RUNNING', phase: 'collecting', error: null,
    startedAt: new Date().toISOString(), finishedAt: null, mentionCount: 0, sentimentDistribution: { positive: 0, neutral: 0, negative: 0 }, mentions: [],
    previousRunId: previousRunId ?? [...raw].filter((x) => x.query === query && x.status === 'DONE').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.id ?? null,
  }
  set([run, ...raw.filter((x) => x.id !== replaceId)])
  advance(id)
  return id
}

const actions = {
  start: (query, region) => start(query, region),
  // retry (replace: true) swaps a failed run for a new one; a plain re-run adds a row
  rerun: (r, { replace = false } = {}) => start(r.prompt, r.region, { replaceId: replace ? r.id : null }),
  remove: (id) => set(raw.filter((x) => x.id !== id)),
  clear: () => set([]),
}

export function useTrends() {
  const runs = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, get, get)
  return {
    runs,
    now: trendNow,
    regions: trendRegions,
    defaultRegion: trendMarket.countryName,
    runById: (id) => runs.find((r) => r.id === id) ?? null,
    ...actions,
  }
}
