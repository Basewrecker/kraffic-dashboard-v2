// Citations' "What changed" (/citations): citations to your site, sync by sync, and your cited pages.
// From what the page already loads: the citation count per sync is the Sync history's `cited` (data/mock.js
// syncHistory; its latest two are the page's you.citations / you.previous, 30 / 27), kept to the syncs the page counts
// (st.syncs). The page's per-page change (pages[].delta) is against the sync before only, so the page rows show for
// Last scan; 30 / 90 days compare the count alone. ?mock=small (no previous sync) → 'one'.
// Not used: the "Who gets cited, by engine" card's numbers have no history, and the Sync history's per-engine counts
// don't add up to that card's, so there is no by-engine breakdown here.
import { citationsStates } from '../data/insights.js'
import { syncHistory } from '../data/mock.js'
import { B, baseIndex, delta, fmtDay, fmtWeekday, heroOf, isoOf, noiseCount, plural, preview } from './util.js'

function syncs(st) {
  let list = syncHistory.slice(0, st.syncs).map((r) => ({ iso: isoOf(r.date), t: Date.parse(isoOf(r.date)), value: r.cited }))
  if (st.you.previous == null || preview() === 'one') list = list.slice(0, 1)
  list[0] = { ...list[0], value: st.you.citations } // the page's own number for the latest sync
  if (preview() === 'none' && list.length > 1) list = [{ ...list[1], iso: list[0].iso, t: list[0].t }, ...list.slice(1)]
  return list
}

function config(key) {
  return {
    page: 'citations',
    title: 'Citations',
    build(period) {
      const st = citationsStates[key] ?? citationsStates.full
      const rs = syncs(st)
      const now = rs[0]
      const footer = [plural(st.pages.length, 'cited page'), `last sync ${fmtWeekday(now.iso)}`]
      if (rs.length < 2) return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null }, oneText: 'Only one sync with citations so far. Changes show after the next one.' }
      const bi = baseIndex(rs, period)
      const then = rs[bi]
      const since = fmtDay(then.iso)
      const d = now.value - then.value
      const flat = noiseCount(d, then.value)

      // ---- your pages, against the sync before (the only change the page keeps per page)
      const perPage = period === 'scan'
      const pages = st.pages.filter((p) => p.delta != null).map((p) => ({ ...p, before: p.citations - p.delta }))
      const moved = perPage ? pages.filter((p) => !noiseCount(p.delta, p.before)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.citations - a.citations) : []
      const driver = flat ? null : moved.find((p) => Math.sign(p.delta) === Math.sign(d))
      const pagesBefore = pages.filter((p) => p.before > 0).length

      const glance = [
        { label: 'Citations', value: `${now.value}`, delta: delta(d, { noise: flat }) },
        { label: 'Pages', value: `${st.pages.length}`, delta: perPage && pages.length === st.pages.length ? delta(st.pages.length - pagesBefore, { noise: noiseCount(st.pages.length - pagesBefore, pagesBefore) }) : null },
        { label: 'Syncs', value: `${bi}`, delta: { text: `since ${since}`, good: null, flat: true } },
      ]

      const headline = flat
        ? [B(`Citations to your site held at ${now.value}`), `, about the same as on ${since}.`]
        : [B(`Citations to your site ${d > 0 ? 'rose' : 'fell'} by ${Math.abs(d)} to ${now.value}`),
          ...(driver ? [', mostly from ', B(driver.path), ` (${driver.delta > 0 ? '+' : '−'}${Math.abs(driver.delta)}).`] : [` since ${since}.`])]

      const row = (p) => ({
        id: `page-${p.path}`, mark: { status: p.delta > 0 ? 'good' : 'bad' }, open: { drawer: ['citedPage', p.path] },
        text: p.before === 0 ? [B(p.path), ' is cited for the first time'] : [B(p.path), ` cited ${p.citations} ${p.citations === 1 ? 'time' : 'times'}, was ${p.before}`],
        delta: delta(p.delta),
      })
      const rest = moved.filter((p) => p !== driver)
      const more = rest.filter((p) => p.delta > 0).map(row)
      const less = rest.filter((p) => p.delta < 0).map(row)

      return {
        state: 'changed', since, flat,
        headline, glance,
        hero: heroOf(rs, bi, period, (n, g) => `Citations to your site, ${period === 'scan' ? `last ${n} syncs` : `since ${since}`}.${g ? ` Grey: the ${g} before.` : ''}`),
        breakdown: null,
        lists: [
          { id: 'more', title: 'Cited more', count: more.length, rows: more.slice(0, 4) },
          { id: 'less', title: 'Cited less', count: less.length, rows: less.slice(0, 4) },
        ],
        next: [],
        footer: [...footer, ...(perPage ? [] : ['Page changes are kept for the last sync only'])],
        latestIso: now.iso,
        trigger: { delta: flat ? null : { text: `${Math.abs(d)}`, up: d > 0, good: d > 0 }, flatText: `No change since ${since}` },
      }
    },
  }
}

// one config per ?mock= state, kept so the button's memo holds
const cache = {}
export const citationsChangesFor = (key) => (cache[key] ??= config(key))
export const citations = citationsChangesFor('full')
