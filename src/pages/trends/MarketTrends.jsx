import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import MenuSelect, { MOBILE_TRIGGER } from '../../components/ui/MenuSelect'
import FilterPills from '../../components/ui/FilterPills'
import CompareMenu from '../../components/dashboard/CompareMenu'
import { openDrawer, useParams } from '../../components/audit/parts'
import { WhatChangedButton, WhatChangedPanel } from '../../whatChanged/WhatChanged'
import { trends as trendsChanges } from '../../whatChanged/trends'
import HeaderBell from '../../notifications/NotificationsBell'
import LimitTip from '../../plan/LimitTip'
import {
  MAX_TERMS, interestOverTime, marketCountries, marketNextUpdate, marketRegions, marketSearchTypes, marketStaleReason, marketStaleSince,
  marketTerms, marketToday, marketUpdatedAt, relatedQueries,
} from '../../data/marketTrends'
import { DEFAULT_COMPARE, PERIOD_OPTIONS, againstWords, comparedRange, fmtDate, periodWords, rangeOf } from '../../lib/trendsCompare'
import MarketChart from './MarketChart'
import PromptList from './RelatedSearches'
import SearchesPanel, { ALL_KEY } from './SearchesPanel'
import { InfoTip, TermChips, termColor } from './marketParts'
import { FILTERS, countFilters, fillRising, filterRows } from './view'

// /trends (as the app's MarketTrends, #203 / #207 / #209 / #216): Google Trends market data for the brand's terms.
//   header     Country · Region · search type · time range · Compare · Refresh, then Summary (real data only) and the bell
//   chips      up to 5 terms, one "Add term" input, "4 of 5"
//   chart      Interest over time: a line per term (MarketChart)
//   lists      Top prompts and Rising prompts for the selected term; "View all N" opens the drawer (SearchesPanel)
// Previews (URL): ?data=real (the brand's own data: no "Sample data" tag, Summary, the tracking column and filter) ·
// ?state=first (first load) · ?state=stale (the refresh failed) · ?rising=few (Rising filled from the other terms) ·
// ?rising=none (nothing rising) · ?all=top|rising (the drawer) · ?term= ?country= ?region= ?type= ?period= ?against=
const fmtWeekday = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '')
const control = 'grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end'

export default function MarketTrends() {
  useEffect(() => { document.title = 'Trends · Auden AI' }, [])
  const q = useParams()
  const real = q.get('data') === 'real'
  const state = q.get('state') // 'first' | 'stale' | null
  const risingMode = q.get('rising') // 'few' | 'none' | null

  const [terms, setTerms] = useState(marketTerms)
  const [selected, setSelected] = useState(() => (marketTerms.includes(q.get('term')) ? q.get('term') : marketTerms[0]))
  const [country, setCountry] = useState(() => (marketCountries.some((c) => c.id === q.get('country')) ? q.get('country') : 'US'))
  const [region, setRegion] = useState(() => q.get('region') ?? 'all')
  const [type, setType] = useState(() => (marketSearchTypes.some((t) => t.id === q.get('type')) ? q.get('type') : 'web'))
  const [compare, setCompare] = useState(() => ({
    ...DEFAULT_COMPARE,
    period: PERIOD_OPTIONS.some((p) => p.id === q.get('period')) ? q.get('period') : DEFAULT_COMPARE.period,
    against: ['previous', 'year'].includes(q.get('against')) ? q.get('against') : 'off',
  }))
  const [focus, setFocus] = useState(null) // the term brought forward (hovering a line, an end label or a chip)
  const [hoverRow, setHoverRow] = useState(null) // a list row under the pointer: its line, dashed
  const [pinned, setPinned] = useState(null) // a clicked row: its line, solid, until closed
  const [filter, setFilter] = useState('all')
  const [tracked, setTracked] = useState(() => new Set()) // prompts tracked from this page (mock: kept until reload)
  const [refreshing, setRefreshing] = useState(false)

  const range = rangeOf(compare, marketToday)
  const compared = comparedRange(compare, marketToday)
  const words = periodWords(compare, marketToday)
  const regions = marketRegions[country] ?? []
  const place = region === 'all' ? marketCountries.find((c) => c.id === country)?.label : region

  // ---- the chart's data: the terms, plus the previewed / pinned search as one more line
  const previews = useMemo(() => {
    const rows = [pinned, hoverRow && hoverRow.query !== pinned?.query ? hoverRow : null].filter(Boolean)
    return rows.map((r) => ({ query: r.query, term: r.term, share: (r.score ?? 50) / 100 }))
  }, [pinned, hoverRow])
  const data = useMemo(
    () => interestOverTime({ terms, range, compared, country, region, type, previews }),
    [terms, range.from, range.to, compared.from, country, region, type, previews], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const empty = terms.filter((t) => data.points.every((p) => p.values[t] == null))
  const series = [
    ...terms.map((t, i) => ({ id: t, name: t, color: termColor(i), kind: 'term' })),
    ...previews.map((p) => ({ id: p.query, name: p.query, color: 'var(--color-stone-500)', kind: p.query === pinned?.query ? 'pinned' : 'preview' })),
  ]
  const change = data.change[selected]

  // ---- the lists: the selected term's related searches; Rising is never empty (view.js fillRising)
  const related = useMemo(() => {
    const all = Object.fromEntries(terms.map((t) => [t, relatedQueries(t, { country, region, type, period: compare.period })]))
    if (risingMode === 'none') for (const t of terms) all[t] = { ...all[t], rising: [] }
    if (risingMode === 'few') all[selected] = { ...all[selected], rising: all[selected].rising.slice(0, 3) }
    return all
  }, [terms, selected, country, region, type, compare.period, risingMode])
  const others = terms.filter((t) => t !== selected)
  const fill = fillRising({ own: related[selected].rising, others: others.flatMap((t) => related[t].rising), top: terms.flatMap((t) => related[t].top), tracked })
  const shownFilter = real ? filter : 'all'
  const term = <span className="font-medium text-stone-900">{selected}</span>
  const noRows = `Google has too few searches for ${selected} in ${place} to list prompts.`
  const lists = {
    top: {
      id: 'top', title: 'Top prompts', rising: false, all: related[selected].top, empty: noRows,
      sub: <>With {term} · {words}</>,
      tip: `Searches people make on Google alongside ${selected}, ${words}. Each one is scored against the most-searched one, which is set to 100. A score of 66 means about two-thirds as many searches as the top one. It’s not a count of searches. Track a prompt to see if AI names you for it.`,
    },
    rising: fill.kind === 'next' ? {
      id: 'rising', title: 'Worth tracking next', rising: false, all: fill.rows, empty: 'Every top prompt for your terms is tracked.',
      sub: <>Most searched with your terms, not tracked yet · {words}</>,
      tip: `Nothing is rising with your terms, ${words}. These are the most-searched prompts across your terms that aren’t tracked yet, scored against the most-searched one (100).`,
    } : {
      id: 'rising', title: 'Rising prompts', rising: true, all: fill.rows, empty: noRows,
      sub: <>With {term}{fill.kind === 'filled' ? ' + your other terms' : ''} · {words}</>,
      tip: `Searches alongside ${selected}${fill.kind === 'filled' ? ' and your other terms' : ''} that grew the most, ${words}, against the period before. “Breakout” is Google’s word for growth above 5,000%, usually a search that is new.`,
    },
  }
  for (const l of Object.values(lists)) l.rows = filterRows(l.all, shownFilter, tracked)
  const counts = countFilters([...new Map([...lists.top.all, ...lists.rising.all].map((r) => [r.query, r])).values()], tracked)

  // ---- actions
  const selectTerm = (t) => { setSelected(t); setPinned(null); setHoverRow(null) }
  const addTerm = (t) => {
    if (terms.includes(t)) return selectTerm(t)
    if (terms.length >= MAX_TERMS) return
    setTerms([...terms, t]); selectTerm(t)
  }
  const removeTerm = (t) => {
    const next = terms.filter((x) => x !== t)
    if (!next.length) return
    setTerms(next)
    if (selected === t) selectTerm(next[0])
  }
  const track = (queries) => setTracked((s) => new Set([...s, ...[].concat(queries)]))
  const refresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200) }
  const lastGood = state === 'stale' ? marketStaleSince : marketUpdatedAt
  const full = terms.length >= MAX_TERMS
  const periodItems = [
    ...PERIOD_OPTIONS.map((p) => ({ id: p.id, label: p.past })),
    ...(compare.period === 'custom' ? [{ id: 'custom', label: `${fmtDate(range.from)} – ${fmtDate(range.to)}` }] : []),
  ]
  const chartLabel = `Interest over time, ${words}, ${place}. ${terms.map((t) => { const v = data.points.findLast((p) => p.values[t] != null)?.values[t]; return `${t}: ${v ?? 'no data'}` }).join(', ')}.`
  const resetKey = `${selected}|${country}|${region}|${type}|${compare.period}|${shownFilter}`

  return (
    <>
      {/* header: title + subtitle left, controls right (one row from lg, like the other pages) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-8">Trends</h1>
            {/* a brand with no data of its own yet sees example data, and is told so beside the title */}
            {!real && <span className="inline-flex h-6 items-center rounded-md border border-dashed border-[var(--dashed-border)] px-2 text-[12px] leading-4 font-medium text-stone-600 lg:mt-0.5">Sample data</span>}
          </div>
          <p className="mt-1 text-pretty text-[13px] leading-[18px] text-stone-600 lg:text-[14px] lg:leading-5">How much people search for your topics on Google, and what’s rising.</p>
        </div>
        <div className={`${control} lg:shrink-0 lg:pt-0.5`}>
          <MenuSelect listLabel="Country" value={country} onChange={(id) => { setCountry(id); setRegion('all') }} groups={[{ items: marketCountries }]} triggerClassName={MOBILE_TRIGGER} width="w-56" />
          <MenuSelect listLabel="Region" value={regions.includes(region) ? region : 'all'} onChange={setRegion} disabled={!regions.length} search={regions.length > 8}
            groups={[{ items: [{ id: 'all', label: 'All regions' }] }, { divider: true, items: regions.map((r) => ({ id: r, label: r })) }]} triggerClassName={MOBILE_TRIGGER} width="w-56" />
          <MenuSelect listLabel="Search type" value={type} onChange={setType} groups={[{ items: marketSearchTypes }]} triggerClassName={MOBILE_TRIGGER} width="w-52" />
          <MenuSelect listLabel="Time range" value={compare.period} onChange={(id) => setCompare((c) => ({ ...c, period: id }))} groups={[{ items: periodItems }]} triggerClassName={MOBILE_TRIGGER} width="w-52" />
          <CompareMenu value={compare} onChange={setCompare} today={marketToday} triggerClassName={MOBILE_TRIGGER} />
          {/* Refresh: the data also updates by itself every Monday; the dark tip says so and when it last did */}
          <span className="group/rf relative">
            <button type="button" onClick={refresh} disabled={refreshing} aria-describedby="trends-refresh-tip"
              className="inline-flex h-8 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-raised px-3 text-[13px] font-medium text-stone-900 outline-none transition-[border-color] duration-150 hover:border-[var(--color-line-strong)] focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default max-lg:h-10 max-lg:rounded-lg max-lg:text-[14px]">
              <RefreshCw size={14} aria-hidden className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />{refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <span id="trends-refresh-tip" role="tooltip" className="tip-dark pointer-events-none absolute right-0 top-full z-30 mt-2 w-max max-w-[260px] text-left opacity-0 transition-opacity duration-150 group-hover/rf:opacity-100 group-focus-within/rf:opacity-100">
              Updates automatically every Monday. Last updated {fmtDate(lastGood)}.
            </span>
          </span>
          {/* Summary compares the brand's own numbers over time, so it shows only on real data; the bell always */}
          {real ? <WhatChangedButton config={trendsChanges} className="max-lg:col-span-2 max-lg:[&>button]:h-10 max-lg:[&>button]:flex-1 max-lg:[&>button]:justify-center max-lg:[&>button]:rounded-lg" /> : <HeaderBell />}
        </div>
      </div>
      {real && <WhatChangedPanel config={trendsChanges} />}

      <div>
        <TermChips terms={terms} selected={selected} max={MAX_TERMS} empty={empty} onSelect={selectTerm} onRemove={removeTerm} onAdd={addTerm} onFocus={setFocus} />
      </div>

      {state === 'stale' && (
        <div role="status" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-raised px-3.5 py-2.5 text-[13px] leading-[18px]">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-negative" />
          <span className="font-semibold text-stone-900">Couldn’t refresh. Showing data from {fmtDate(marketStaleSince)}.</span>
          <span className="min-w-0 flex-1 text-stone-600">{marketStaleReason}</span>
          <button type="button" onClick={refresh} className="font-semibold text-stone-900 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Try again</button>
        </div>
      )}

      {/* ---- Interest over time */}
      <section aria-labelledby="trends-interest" className="mt-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="relative">
            <h2 id="trends-interest" className="flex items-center gap-2 text-[16px] leading-6 font-semibold text-stone-900">
              Interest over time
              <InfoTip label="About Interest over time">
                How much people search for each term on Google in {place}, {words}. 100 is the busiest point of your terms in this range; 50 is half as many searches. It’s not a count of searches. A dotted end means Google is still counting that point.
              </InfoTip>
            </h2>
          </div>
          {state !== 'first' && change != null && (
            <p className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-tint px-2.5 py-1 text-[13px] leading-[18px] text-stone-600">
              <span aria-hidden className={change >= 0 ? 'text-[var(--rep-up-fg)]' : 'text-negative'}>{change >= 0 ? '↑' : '↓'}</span>
              <span><span className="sr-only">{change >= 0 ? 'Up' : 'Down'} </span><span className="font-semibold text-stone-900 tabular-nums">{Math.abs(change)}%</span> for {selected} {againstWords(compare)}</span>
            </p>
          )}
        </div>

        {/* a search pinned from the lists: its line stays on the chart until closed; it can become a term */}
        {pinned && state !== 'first' && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-stone-600">
            <span className="inline-flex min-w-0 items-center gap-2"><span aria-hidden className="h-0.5 w-4 shrink-0 rounded-full bg-stone-500" /><span className="truncate font-semibold text-stone-900">{pinned.query}</span></span>
            <LimitTip reason={full ? `You have ${MAX_TERMS} of ${MAX_TERMS} terms. Remove one to add this.` : null} align="left">
              <button type="button" disabled={full} onClick={() => addTerm(pinned.query)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-raised px-2 font-medium text-stone-900 outline-none transition-[border-color] duration-150 hover:border-[var(--color-line-strong)] focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50">
                <Plus size={13} aria-hidden />Add as term
              </button>
            </LimitTip>
            <button type="button" aria-label={`Take ${pinned.query} off the chart`} onClick={() => setPinned(null)}
              className="grid size-7 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={14} aria-hidden /></button>
          </div>
        )}

        <div className="mt-[26px]">
          {state === 'first' ? (
            <div role="status" className="shimmer grid h-[365px] place-items-center rounded-xl motion-reduce:animate-none">
              <p className="text-[14px] leading-5 text-stone-600">First load, this takes a few seconds.</p>
            </div>
          ) : (
            <MarketChart data={data} series={series} selected={selected} focus={focus} onFocus={setFocus} onSelect={selectTerm}
              showBefore={compare.against !== 'off'} days={range.days} label={chartLabel}
              drawKey={`${terms.join('|')}|${country}|${region}|${type}|${range.from}|${range.to}`} />
          )}
        </div>
        {state !== 'first' && (
          <p className="mt-4 text-[13px] leading-[18px] text-stone-500 tabular-nums">
            {real ? `Updated ${fmtDate(lastGood)} · next update ${fmtWeekday(marketNextUpdate)}` : 'Example data. Your own Google Trends data is coming soon.'}
            {compare.against !== 'off' && ` · Grey line: ${selected}, ${fmtDate(compared.from, true)} – ${fmtDate(compared.to, true)}`}
            {empty.length > 0 && ` · Too few searches in ${place} for ${empty.join(', ')}`}
          </p>
        )}
      </section>

      {/* ---- the two lists */}
      <div className="mt-4 border-t border-line pt-8">
        {state === 'first' ? (
          <div aria-hidden className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            {[0, 1].map((k) => <div key={k} className="flex flex-col gap-3">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`shimmer h-9 rounded-md motion-reduce:animate-none ${i === 0 ? 'w-40' : 'w-full'}`} />)}</div>)}
          </div>
        ) : (
          <>
            {real && (
              <FilterPills label="Show prompts" className="mb-6" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} />
            )}
            {/* nothing rising for any term: one slim line says so; the second column becomes "Worth tracking next" */}
            {fill.strip && (
              <p className="mb-6 rounded-lg bg-tint px-3.5 py-2 text-[13px] leading-[18px] text-stone-600">
                <span className="font-semibold text-stone-900">Nothing is rising with your terms, {words}.</span> Instead, here’s what people search most that you don’t track yet.
              </p>
            )}
            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
              {['top', 'rising'].map((id) => (
                <PromptList key={id} list={lists[id]} real={real} tracked={tracked} onTrack={track} resetKey={resetKey}
                  onPreview={setHoverRow} pinned={pinned?.query} onPin={(r) => setPinned((p) => (p?.query === r.query ? null : r))}
                  onViewAll={() => openDrawer(ALL_KEY, id)} />
              ))}
            </div>
          </>
        )}
      </div>

      <SearchesPanel lists={lists} terms={terms} selected={selected} onSelect={selectTerm} filter={filter} onFilter={setFilter} tracked={tracked} onTrack={track} real={real} periodWords={words} />
    </>
  )
}
