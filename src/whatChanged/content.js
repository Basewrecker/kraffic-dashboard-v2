// Opportunities → Content's "What changed": the content work on the list's prompts and what it earned. From what the
// list already loads: each prompt's draft (contentOpportunities-proposed draftFor: saved, copied for publishing,
// published dates, the 4 tracking checks after publishing and the engines named on each), and each missed prompt's
// sync history (its missing streak).
// Main number: published pages named by at least one AI engine, per sync. Last scan: the sync before the latest;
// 30 / 90 days: the sync closest to that many days back (baseIndex). Pipeline counts compare now with that sync's date.
// The tracking checks are placed on the syncs so the latest done check is the latest sync (week w of 4 → the last w
// syncs); the list's hover card shows them as Wk 1–4 without dates.
import { missedPrompts } from '../data/mock.js'
import { ENGINES, ENGINE_NAME, SYNCS, engineIcon } from '../data/contentOpportunities.js'
import { NOW, draftFor, trackingFor } from '../data/contentOpportunities-proposed.js'
import { B, DAYS, baseIndex, delta, fmtDay, fmtWeekday, heroOf, isoOf, noiseCount, plural, preview } from './util.js'

const PUBLISHED = ['monitoring', 'improved', 'nochange']
const L = SYNCS.length - 1
const syncT = SYNCS.map((s) => Date.parse(`${s} UTC`))
const pathOf = (r) => `/opportunities/content/${encodeURIComponent(r.id)}` // the list's rows (no promptId in the mock)
const q = (r) => B(`“${r.prompt}”`)
const names = (es) => es.map((e) => ENGINE_NAME[e] ?? e)
const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const t = (iso) => (iso ? Date.parse(iso) : null)

// the done tracking checks, each on its sync: [{ si, engines: [named…] | null (the sync failed) }]
function checksOf(d) {
  if (!PUBLISHED.includes(d.stage) || !d.week) return []
  return trackingFor(d).slice(0, d.week).map((c, i) => ({ si: L - (d.week - 1) + i, engines: c.engines ? ENGINES.filter((e) => c.engines[e]) : null }))
}
// engines naming the page at sync k (a failed sync keeps the check before it; before the first check: none)
function namedAt(checks, k) {
  let out = []
  for (const c of checks) if (c.si <= k && c.engines) out = c.engines
  return out
}
// the prompt's content state at time ts: 'published' | 'waiting' | 'draft' | null
function stageAt(d, ts) {
  const pub = t(d.published_at), copied = t(d.copied_at)
  const start = Math.min(...[t(d.created_at), copied, pub, t(d.updated_at)].filter((x) => x != null))
  if (pub != null && pub <= ts) return 'published'
  if (copied != null && copied <= ts && d.stage === 'waiting') return 'waiting'
  if (start <= ts) return 'draft'
  return null
}
const stageNow = (d) => (PUBLISHED.includes(d.stage) ? 'published' : d.stage)

function rows() {
  return missedPrompts.map((r) => {
    const raw = draftFor(r.id, r)
    // the draft object has no copy date: a copied draft's last update (updated_at) stands for it
    const d = raw ? { ...raw, copied_at: raw.stage === 'waiting' ? raw.updated_at : null } : null
    return { r, d, checks: d ? checksOf(d) : [] }
  })
}

export const content = {
  page: 'content',
  title: 'Content',
  build(period) {
    const all = rows()
    const work = all.filter((x) => x.d)
    const syncs = SYNCS.map((s, i) => ({ iso: isoOf(s), t: syncT[i], k: i })).reverse() // newest first
    const latest = syncs[0]
    const pubNow = work.filter((x) => stageNow(x.d) === 'published')
    const footer = [plural(all.length, 'missed prompt'), plural(pubNow.length, 'published page'), `last sync ${fmtWeekday(latest.iso)}`]
    if (syncs.length < 2 || preview() === 'one') {
      return { state: 'one', footer, latestIso: latest.iso, trigger: { delta: null }, oneText: 'Only one sync so far. Changes show after the next sync.' }
    }
    const bi = baseIndex(syncs, period)
    const base = syncs[bi]
    const kb = base.k
    const since = fmtDay(base.iso)
    const nowT = Date.parse(NOW)
    const inWindow = (iso) => iso != null && t(iso) > base.t && t(iso) <= nowT

    // ---- at a glance: pages named by AI (at the latest sync vs the compared one), then the work, now vs that date
    const citedAt = (k) => work.filter((x) => namedAt(x.checks, k).length > 0).length
    const cited = citedAt(L), citedThen = citedAt(kb), dc = cited - citedThen
    const countNow = (s) => work.filter((x) => stageNow(x.d) === s).length
    const countThen = (s) => work.filter((x) => stageAt(x.d, base.t) === s).length
    const neutral = (x) => (x && !x.flat ? { ...x, good: null } : x) // more drafts or waiting isn't good or bad in itself
    const count = (label, s, good = true) => {
      const a = countNow(s), b = countThen(s), dd = a - b
      const dl = delta(dd, { noise: noiseCount(dd, b) })
      return { label, value: `${a}`, delta: good ? dl : neutral(dl) }
    }
    const flat = noiseCount(dc, citedThen)
    const glance = [
      { label: 'Cited', value: `${cited}`, delta: delta(dc, { noise: flat }) },
      count('Published', 'published'),
      count('Waiting', 'waiting', false),
      count('Drafts', 'draft', false),
    ]

    // ---- by engine: published pages each engine names, of the published pages
    const engines = ENGINES.map((e) => {
      const a = work.filter((x) => namedAt(x.checks, L).includes(e)).length
      const b = work.filter((x) => namedAt(x.checks, kb).includes(e)).length
      const d = a - b
      return { id: e, mark: { engine: engineIcon(e) }, name: ENGINE_NAME[e], value: a, valueText: `${a}`, share: pubNow.length ? a / pubNow.length : 0, d, delta: delta(d, { noise: noiseCount(d, b) }) }
    }).filter((e) => pubNow.length && (e.value > 0 || e.d !== 0)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || b.value - a.value)

    // ---- headline: the main number, and the engine that moved most the same way
    const driver = flat ? null : engines.find((e) => e.d && Math.sign(e.d) === Math.sign(dc))
    const headline = !pubNow.length
      ? [B('No published pages yet'), '. Pages show here once they’re published and checked on a sync.']
      : flat
        ? [B(`Pages named by AI held at ${cited}`), ` of ${pubNow.length} published, the same as ${since}.`]
        : [B(`Pages named by AI ${dc > 0 ? 'rose' : 'fell'} from ${citedThen} to ${cited}`), ` since ${since}`,
          ...(driver ? [', led by ', B(driver.name)] : []), '.']

    // ---- engines gained or lost by each published page, biggest change first
    const named = work.map((x) => {
      const a = namedAt(x.checks, L), b = namedAt(x.checks, kb)
      return { x, gained: a.filter((e) => !b.includes(e)), lost: b.filter((e) => !a.includes(e)) }
    }).filter((n) => n.gained.length || n.lost.length)
      .sort((a, b) => Math.abs(b.gained.length - b.lost.length) - Math.abs(a.gained.length - a.lost.length) || b.gained.length - a.gained.length)
    const namedRows = named.map(({ x, gained, lost }) => {
      const dd = gained.length - lost.length
      return {
        id: `named-${x.r.id}`, mark: { engine: engineIcon((gained[0] ?? lost[0])) }, href: pathOf(x.r),
        text: gained.length
          ? [q(x.r), ' is now named by ', B(andList(names(gained))), ...(lost.length ? [', no longer by ', B(andList(names(lost)))] : [])]
          : [q(x.r), ' is no longer named by ', B(andList(names(lost)))],
        delta: dd ? delta(dd, { unit: Math.abs(dd) === 1 ? ' engine' : ' engines' }) : { text: 'Mixed', good: null },
      }
    })

    // ---- published pages still not named, with checks done in the period (most checks first)
    const notNamed = pubNow.filter((x) => x.checks.length && x.checks[x.checks.length - 1].si > kb && !namedAt(x.checks, L).length)
      .sort((a, b) => b.checks.length - a.checks.length)
    const done = notNamed.find((x) => x.checks.length >= 4) // in Worth doing next instead of a row
    const notNamedRows = notNamed.filter((x) => x !== done).map((x) => ({
      id: `unnamed-${x.r.id}`, mark: { status: x.checks.length >= 4 ? 'bad' : 'neutral' }, href: pathOf(x.r),
      text: [q(x.r), ` not named after ${x.checks.length} of 4 checks`],
    }))

    // ---- content work in the period: published, then sent for publishing (drafts are in Worth doing next)
    const workRows = [
      ...work.filter((x) => inWindow(x.d.published_at)).sort((a, b) => b.d.published_at.localeCompare(a.d.published_at)).map((x) => ({
        id: `pub-${x.r.id}`, mark: { status: 'good' }, href: pathOf(x.r), text: [q(x.r), ` published ${fmtDay(x.d.published_at)}`],
      })),
      ...work.filter((x) => x.d.stage === 'waiting' && inWindow(x.d.copied_at)).map((x) => ({
        id: `wait-${x.r.id}`, mark: { status: 'neutral' }, href: pathOf(x.r), text: [q(x.r), ' copied, not found on the page yet'],
      })),
    ]

    // ---- prompts that started missing in the period (no published page on them), most engines missed first
    const span = L - kb
    const started = all.filter((x) => (!x.d || !PUBLISHED.includes(x.d.stage)) && x.r.history?.[L] === 'missed' && x.r.streak <= span)
      .sort((a, b) => (b.r.platforms?.length ?? 0) - (a.r.platforms?.length ?? 0) || a.r.streak - b.r.streak)
    const startedRows = started.slice(0, 3).map((x) => {
      const isNew = x.r.history.slice(0, L).every((h) => h == null)
      return {
        id: `missed-${x.r.id}`, mark: { status: 'bad' }, href: pathOf(x.r),
        text: isNew ? [q(x.r), ' first tracked, not named'] : [q(x.r), ` not named since ${fmtDay(isoOf(SYNCS[L - x.r.streak + 1]))}`],
      }
    })

    // ---- worth doing next: a page not named after all 4 checks → what to try; drafts ready → review the oldest
    const next = []
    if (done) next.push({ id: 'try', mark: { status: 'bad' }, action: 'See what to try', href: pathOf(done.r), text: [q(done.r), ' wasn’t named after 4 checks'] })
    const drafts = work.filter((x) => x.d.stage === 'draft' && inWindow(x.d.updated_at)).sort((a, b) => a.d.updated_at.localeCompare(b.d.updated_at))
    if (drafts.length) next.push({ id: 'review', mark: { status: 'neutral' }, action: 'Review draft', href: pathOf(drafts[0].r), text: [B(plural(drafts.length, 'draft')), ` ready to review, the oldest for `, q(drafts[0].r)] })

    const series = syncs.map((s) => ({ iso: s.iso, value: citedAt(s.k) }))
    return {
      state: 'changed', since, flat,
      headline, glance,
      hero: heroOf(series, bi, period, (n, g) => `Published pages named by AI, ${period === 'scan' ? `last ${n} syncs` : `the last ${DAYS[period]} days`}.${g ? ` Grey: the ${g} syncs before.` : ''}`),
      breakdown: { title: 'By engine', rows: engines },
      lists: [
        { id: 'named', title: 'Pages named by AI', rows: namedRows.slice(0, 4) },
        { id: 'work', title: 'Content work', rows: workRows.slice(0, 4) },
        { id: 'unnamed', title: 'Not named yet', count: notNamedRows.length, rows: notNamedRows.slice(0, 3) },
        { id: 'missed', title: 'Started missing', count: started.length, rows: startedRows },
      ],
      next: next.slice(0, 2),
      footer,
      latestIso: latest.iso,
      trigger: { delta: flat ? null : { text: plural(Math.abs(dc), 'page'), up: dc > 0, good: dc > 0 }, flatText: `No change since ${since}` },
    }
  },
}
