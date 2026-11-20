// Structured Data's "What changed": required schemas valid (%), the page's first KPI, from the two crawls the page
// loads: the latest one (worked out by analyze()) and the run before (SD.previous: its four KPI numbers only, the
// same ones the Overview's change lines use). There's no per-schema history and no older run, so the panel shows
// the four numbers' change; 90 days says the history doesn't reach that far yet.
import { SD } from '../data/structuredData.js'
import { analyze } from '../components/structured/analyze.js'
import { B, DAY, DAYS, delta, fmtDay, fmtWeekday, isoOf, noiseCount, noisePts, plural, preview } from './util.js'

// "Oct 12" (no year in the crawl data) → ISO, this year's
const isoOfDay = (d) => isoOf(`${d}, ${new Date().getUTCFullYear()}`)
const reqPct = (r) => (r.required.total ? Math.round((r.required.valid * 100) / r.required.total) : null)

export const structured = {
  page: 'structured-data',
  title: 'Structured Data',
  build(period) {
    const r = analyze()
    const nowIso = isoOfDay(SD.lastRun.date)
    const footer = [plural(SD.lastRun.pages ?? r.pageCount, 'page'), `last crawl ${fmtWeekday(nowIso)}`]
    const prev = preview() === 'one' ? null : SD.previous
    if (!prev) return { state: 'one', footer, latestIso: nowIso, trigger: { delta: null }, oneText: 'Only one crawl so far. Changes show after the next crawl.' }
    const thenIso = isoOfDay(prev.date)
    const since = fmtDay(thenIso)
    const back = Date.parse(nowIso) - Date.parse(thenIso)
    if (period !== 'scan' && back < (DAYS[period] * DAY) / 2) {
      return { state: 'one', footer, latestIso: nowIso, trigger: { delta: null }, oneText: `Crawls go back to ${since}, not ${DAYS[period]} days yet. Compare with the last crawl instead.` }
    }

    const req = reqPct(r)
    const reqD = req == null ? null : req - prev.required
    const flat = noisePts(reqD)
    const covD = r.coverage - prev.coverage
    const validD = r.fullyValid - prev.fullyValid
    const warnD = r.warnings - prev.warnings
    const glance = [
      { label: 'Required', value: req == null ? '—' : `${req}%`, delta: delta(reqD, { unit: ' pts', noise: flat }) },
      { label: 'Coverage', value: `${r.coverage}%`, delta: delta(covD, { unit: ' pts', noise: noisePts(covD) }) },
      { label: 'Valid', value: `${r.fullyValid}`, delta: delta(validD, { noise: noiseCount(validD, prev.fullyValid) }) },
      { label: 'Warnings', value: `${r.warnings}`, delta: delta(warnD, { higherIsBetter: false, noise: noiseCount(warnD, prev.warnings) }) },
    ]
    const headline = flat
      ? [B(`Required schemas held at ${req}% valid`), ...(noisePts(covD) ? [`, within 2 pts of ${since}.`] : [` since ${since}, while coverage `, B(`${covD > 0 ? 'rose' : 'fell'} ${plural(Math.abs(covD), 'pt')} to ${r.coverage}%`), '.'])]
      : [B(`Required schemas ${reqD > 0 ? 'rose' : 'fell'} ${plural(Math.abs(reqD), 'pt')} to ${req}% valid`), ` since ${since}.`]

    // worth doing next: required schemas still not valid → the first one's fix (Schema drawer); more warnings → the list
    const next = []
    const broken = r.rows.filter((x) => x.importance === 'required' && x.status !== 'valid')
    if (!flat && reqD < 0 && broken[0]) next.push({ id: 'required', mark: { status: 'bad' }, action: 'See the fix', open: { drawer: ['schema', broken[0].id] }, text: [B(broken[0].name), ` is ${broken[0].status === 'invalid' ? 'invalid' : 'missing'} on ${plural(broken[0].affected.length, 'page')}`] })
    if (!noiseCount(warnD, prev.warnings) && warnD > 0) next.push({ id: 'warnings', mark: { status: 'bad' }, action: 'See warnings', href: '/structured-data?tab=recommendations', text: [B(`${warnD} more ${warnD === 1 ? 'warning' : 'warnings'}`), ` than on ${since}`] })

    const values = [prev.required, req]
    return {
      state: 'changed', since, flat,
      headline, glance,
      hero: { points: [{ date: since, value: prev.required }, { date: fmtDay(nowIso), value: req }], ghost: [], compareAt: 0, caption: 'Required schemas valid (%), the last 2 crawls.' },
      lists: [],
      next: next.slice(0, 2),
      footer: [...footer, 'Earlier crawls aren’t kept'],
      latestIso: nowIso,
      trigger: { delta: flat ? null : { text: `${Math.abs(reqD)} pts`, up: reqD > 0, good: reqD > 0 }, flatText: `No change since ${since}`, spark: values },
    }
  },
}
