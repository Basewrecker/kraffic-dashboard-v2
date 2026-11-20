// Sentiment's "What changed": sentiment health (the score card's 0–100), positive and negative sources, from the
// runs the page loads (each run keeps its own pages: data/sentiment.js runPages).
import { RUNS, runPages } from '../data/sentiment.js'
import { countTones, scoreOf } from '../app/lib/sentiment-adapter.js'
import { ENGINE_NAME, SENTIMENT_ENGINES } from '../app/lib/sentiment-sections.js'
import { B, baseIndex, delta, fmtDay, fmtWeekday, heroOf, noiseCount, noisePts, plural, preview } from './util.js'

const RANK = { negative: 0, mixed: 1, neutral: 2, positive: 3 } // unscored: no rank
const ENGINE_ICON = { google: 'aio' }
const pagesOn = (pages, e) => pages.filter((p) => p.engines.includes(e))
const health = (pages) => scoreOf(countTones(pages))

function runs() {
  let list = [...RUNS].reverse().map((r) => ({ id: r.id, iso: r.date, t: Date.parse(r.createdAt), pages: runPages(null, null, r.id) }))
  if (preview() === 'one') list = list.slice(0, 1)
  if (preview() === 'none') list = [{ ...list[1], id: list[0].id, iso: list[0].iso, t: list[0].t }, ...list.slice(1)]
  return list.map((r) => ({ ...r, value: health(r.pages) }))
}

export const sentiment = {
  page: 'sentiment',
  title: 'Sentiment',
  build(period) {
    const rs = runs()
    const now = rs[0]
    const footer = [plural(now.pages.length, 'source'), `last analysis ${fmtWeekday(now.iso)}`]
    if (rs.length < 2) return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null }, oneText: 'Only one analysis so far. Changes show after the next one.' }
    const bi = baseIndex(rs, period)
    const then = rs[bi]
    const since = fmtDay(then.iso)
    const d = now.value != null && then.value != null ? now.value - then.value : null
    const flat = noisePts(d)
    const c = countTones(now.pages), cp = countTones(then.pages)

    // ---- tone changes, source by source (the same page in both runs)
    const before = new Map(then.pages.map((p) => [p.url, p]))
    const after = new Set(now.pages.map((p) => p.url))
    const flips = now.pages.filter((p) => before.has(p.url) && RANK[p.tone] != null && RANK[before.get(p.url).tone] != null && p.tone !== before.get(p.url).tone)
      .map((p) => ({ p, from: before.get(p.url).tone, step: RANK[p.tone] - RANK[before.get(p.url).tone] }))
    const fresh = now.pages.filter((p) => !before.has(p.url))
    const gone = then.pages.filter((p) => !after.has(p.url))

    const glance = [
      { label: 'Health', value: now.value == null ? '—' : `${now.value}`, delta: delta(d, { noise: flat }) },
      { label: 'Positive', value: `${c.positive}`, delta: delta(c.positive - cp.positive) },
      { label: 'Negative', value: `${c.negative}`, delta: delta(c.negative - cp.negative, { higherIsBetter: false }) },
      { label: 'Sources', value: `${now.pages.length}`, delta: delta(now.pages.length - then.pages.length, { noise: noiseCount(now.pages.length - then.pages.length, then.pages.length) }) },
    ]

    // ---- by engine: health from the sources each engine cites
    const engines = SENTIMENT_ENGINES.map((e) => {
      const v = health(pagesOn(now.pages, e)), p = health(pagesOn(then.pages, e))
      const dd = v != null && p != null ? v - p : null
      return { id: e, mark: { engine: ENGINE_ICON[e] ?? e }, name: ENGINE_NAME[e], value: v, valueText: v == null ? '—' : `${v}`, share: (v ?? 0) / 100, d: dd, delta: delta(dd, { noise: noisePts(dd) }) }
    }).sort((a, b) => (noisePts(b.d) ? 0 : Math.abs(b.d)) - (noisePts(a.d) ? 0 : Math.abs(a.d)) || (b.value ?? 0) - (a.value ?? 0))

    // ---- headline: health, and the biggest reason the same way (a source that flipped, or new sources)
    const sameWay = flat ? null : flips.filter((f) => Math.sign(f.step) === Math.sign(d)).sort((a, b) => Math.abs(b.step) - Math.abs(a.step))[0]
    const freshSame = flat ? [] : fresh.filter((p) => (d > 0 ? p.tone === 'positive' : p.tone === 'negative'))
    const headline = flat
      ? [B(`Sentiment health held at ${now.value}`), `, within 2 pts of ${since}.`]
      : [B(`Sentiment health ${d > 0 ? 'rose' : 'fell'} ${plural(Math.abs(d), 'pt')} to ${now.value}`),
        ...(sameWay ? [', mostly because ', B(sameWay.p.domain), ' turned ', B(sameWay.p.tone), '.']
          : freshSame.length ? [', with ', B(plural(freshSame.length, `new ${d > 0 ? 'positive' : 'negative'} source`)), '.'] : [` since ${since}.`])]

    const open = (p) => (now.pages.some((x) => x.id === p.id) ? { drawer: ['page', p.id] } : null)
    const toneDelta = (tone) => ({ text: tone === 'unscored' ? 'Not scored' : tone[0].toUpperCase() + tone.slice(1), good: tone === 'positive' ? true : tone === 'negative' ? false : null })
    const changed = flips.filter((f) => f !== sameWay).sort((a, b) => Math.abs(b.step) - Math.abs(a.step)).map((f) => ({
      id: `flip-${f.p.url}`, mark: { domain: f.p.domain }, open: open(f.p),
      text: [B(f.p.domain), ` went from ${f.from} to `, B(f.p.tone)], delta: { ...toneDelta(f.p.tone), good: f.step > 0 },
    }))
    const order = { negative: 0, positive: 1, mixed: 2, neutral: 3, unscored: 4 }
    const news = [...fresh].sort((a, b) => order[a.tone] - order[b.tone]).map((p) => ({
      id: `new-${p.url}`, mark: { domain: p.domain }, open: open(p),
      text: [B(p.domain), ' is a new ', B(p.tone === 'unscored' ? 'unscored' : p.tone), ' source'], delta: toneDelta(p.tone),
    }))
    const goneRows = gone.map((p) => ({
      id: `gone-${p.url}`, mark: { domain: p.domain }, text: [B(p.domain), ` (${p.tone}) is no longer cited`],
      delta: { text: 'Gone', good: p.tone === 'negative' ? true : p.tone === 'positive' ? false : null },
    }))

    // ---- worth doing next: a source that is negative now and wasn't before → read what it says (Reach out is there)
    const turnedNeg = [...flips.filter((f) => f.p.tone === 'negative').map((f) => f.p), ...fresh.filter((p) => p.tone === 'negative')]
    const next = turnedNeg.slice(0, 2).map((p) => ({ id: `neg-${p.url}`, mark: { domain: p.domain }, action: 'See why', open: open(p), text: [B(p.domain), ' is negative about you now'] }))

    const series = rs.filter((r) => r.value != null).map((r) => ({ iso: r.iso, value: r.value }))
    return {
      state: 'changed', since, flat,
      headline, glance,
      hero: heroOf(series, bi, period, (n, g) => `Sentiment health, ${period === 'scan' ? `last ${n} analyses` : `since ${since}`}.${g ? ` Grey: the ${g} before.` : ''}`),
      breakdown: { title: 'By engine', rows: engines },
      lists: [
        { id: 'changed', title: 'Changed tone', count: changed.length, rows: changed.slice(0, 5) },
        { id: 'new', title: 'New sources', count: news.length, rows: news.slice(0, 4) },
        { id: 'gone', title: 'No longer cited', count: goneRows.length, rows: goneRows.slice(0, 3) },
      ],
      next,
      footer,
      latestIso: now.iso,
      trigger: { delta: flat ? null : { text: `${Math.abs(d)} pts`, up: d > 0, good: d > 0 }, flatText: `No change since ${since}` },
    }
  },
}
