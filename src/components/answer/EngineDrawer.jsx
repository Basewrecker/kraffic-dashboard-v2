import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import { ArrowUpRight, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { PlatformIcon } from '../dashboard/icons'
import { LATEST, getAnswer } from '../../data/answers'
import { ENGINES, TRACKED_BRANDS, brandByDomain, engineDetail, engineName, getBrandView } from '../../data/brandViews'
import { promptCategories } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'
import { openAnswer } from './AnswerDrawer'

// "Where ChatGPT mentions Dermasuri": the prompts an engine mentions the focal brand in, and the brand's pages it cites.
// openEngineDrawer({ engine, tab, opener, brand }): engine = 'all' | 'aio' | …; tab = 'mentions' | 'pages';
// brand = a tracked domain to see it for (default: the page's "Viewing as").
// URL: ?drawer=engine&tab=mentions|cited&drawerEngine=<engine>[&drawerBrand=<key>] (?engine= is the dashboard's filter).
// Opening pushes a history entry, so Back closes it; refresh reopens it. Opening a prompt swaps the Answer drawer in
// (with "← Mentions"), never stacks.
const EVENT = 'engine-drawer:open'
export function openEngineDrawer({ engine = 'all', tab = 'mentions', opener, brand = null }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { engine, tab, opener, brand } }))
}

const TABS = [['mentions', 'Mentions'], ['pages', 'Cited pages']]
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`
const short = (d) => d.replace(/, \d{4}$/, '')
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

function readUrl() {
  const q = new URLSearchParams(window.location.search)
  if (q.get('drawer') !== 'engine') return null
  const brand = TRACKED_BRANDS.find((b) => b.key === q.get('drawerBrand'))?.domain ?? null
  return { engine: q.get('drawerEngine') ?? 'all', tab: q.get('tab') === 'cited' ? 'pages' : 'mentions', brand }
}
function urlFor(s) {
  const url = new URL(window.location.href)
  for (const k of ['drawer', 'tab', 'drawerEngine', 'drawerBrand']) url.searchParams.delete(k)
  if (s) {
    url.searchParams.set('drawer', 'engine')
    url.searchParams.set('tab', s.tab === 'pages' ? 'cited' : 'mentions')
    url.searchParams.set('drawerEngine', s.engine)
    const key = s.brand && brandByDomain(s.brand)?.key
    if (key) url.searchParams.set('drawerBrand', key)
  }
  return url
}
const writeUrl = (s) => window.history.replaceState(window.history.state, '', urlFor(s))

// "/products/organic-lavender-shower-steamers" → "/products/…-shower-steamers"
function middle(path, max = 46) {
  if (path.length <= max) return path
  const cut = path.lastIndexOf('/') + 1
  const head = path.slice(0, cut)
  const tail = path.slice(cut)
  const keep = Math.max(12, max - head.length - 1)
  return head.length + 1 + keep >= path.length ? path : `${head}…${tail.slice(-keep)}`
}

function download(name, rows) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 0)
}

const pill = 'inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] leading-none font-medium'
const field = 'h-9 rounded-md border border-line bg-raised text-[14px] leading-5 text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus'

// ------------------------------------------------------------------ tabs
function MentionsTab({ rows, focalDomain, onOpen }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const cats = promptCategories.filter((c) => rows.some((r) => r.category === c))
  const shown = rows.filter((r) => (cat === 'all' || r.category === cat) && r.prompt.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <div className="flex gap-2 px-6 py-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search prompts</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts" data-nav-start
            className={`${field} w-full pl-8 pr-3 placeholder:text-stone-500`} />
        </label>
        <span className="relative inline-flex shrink-0">
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} cursor-pointer appearance-none pl-3 pr-8 font-medium`}>
            <option value="all">All categories</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="px-6 py-12 text-center text-[14px] leading-5 text-stone-600">
          {q.trim() ? `No prompts match ‘${q.trim()}’` : 'No prompts in this category'}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line-soft)]">
          {shown.map((r) => {
            const a = getAnswer(r.key, r.engine, LATEST, focalDomain)
            return (
              <li key={r.key}>
                <button type="button" data-nav onClick={(e) => onOpen(r, shown, e.currentTarget)}
                  className="group flex h-12 w-full items-center gap-3 px-6 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{r.prompt}</span>
                  <span className={`${pill} hidden bg-tint text-stone-600 sm:inline-flex`}>{r.category}</span>
                  {r.cited && <span className={`${pill} border border-ink text-stone-900`}>Cited</span>}
                  {a?.position && <span className="hidden shrink-0 text-[12px] leading-4 text-stone-500 tabular-nums sm:inline">{ordinal(a.position)} of {a.brands.length} brands</span>}
                  <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function PageRow({ page, domain, onOpen }) {
  const [all, setAll] = useState(false)
  const chips = all ? page.prompts : page.prompts.slice(0, 2)
  const more = page.prompts.length - chips.length
  const chip = 'inline-flex h-6 max-w-full items-center rounded-md bg-tint px-2 text-[12px] leading-4 text-stone-700 outline-none transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <li className="group px-6 py-4">
      <div className="flex items-center gap-2">
        <span title={page.path} className="min-w-0 truncate text-[14px] leading-5 font-medium text-stone-900">{middle(page.path)}</span>
        <a href={`https://${domain}${page.path}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${domain}${page.path}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-500 opacity-0 outline-none transition-[opacity,color,background-color] duration-150 hover:bg-tint hover:text-stone-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
      <div className="mt-1 text-[12px] leading-4">
        <span className="text-stone-500">{domain}</span>
        <span className="text-stone-500"> · </span>
        <span className="text-stone-600 tabular-nums">{plural(page.prompts.length, 'prompt')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((p, i) => (
          <button key={p.key} type="button" {...(i === 0 && { 'data-nav': '' })} onClick={(e) => onOpen(p, page.prompts, e.currentTarget)} className={chip}>
            <span className="truncate">{p.prompt}</span>
          </button>
        ))}
        {more > 0 && <button type="button" onClick={() => setAll(true)} aria-label={`Show ${more} more prompts`} className={`${chip} font-medium tabular-nums`}>+{more}</button>}
      </div>
    </li>
  )
}

function PagesTab({ pages, domain, onOpen }) {
  const [sort, setSort] = useState('prompts')
  const sorted = sort === 'az' ? [...pages].sort((a, b) => a.path.localeCompare(b.path)) : pages
  if (!pages.length) return <p className="px-6 py-12 text-center text-[14px] leading-5 text-stone-600">No pages cited yet</p>
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <span className="text-[13px] leading-[18px] text-stone-600 tabular-nums">{plural(pages.length, 'page')}</span>
        <span className="relative inline-flex">
          <select aria-label="Sort pages" value={sort} onChange={(e) => setSort(e.target.value)}
            className="h-8 cursor-pointer appearance-none rounded-md border border-line bg-raised pl-3 pr-8 text-[13px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <option value="prompts">Most prompts</option>
            <option value="az">A–Z</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
        </span>
      </div>
      <ul className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line-soft)]">
        {sorted.map((p) => <PageRow key={p.path} page={p} domain={domain} onOpen={onOpen} />)}
      </ul>
    </>
  )
}

// ------------------------------------------------------------------ drawer
export default function EngineDrawer() {
  const { focal: pageFocal, engine: dashEngine, setEngine: filterDashboard } = useBrandView()
  const tracking = useTracking()
  const [state, setState] = useState(readUrl) // { engine, tab, brand }
  const focal = (state?.brand && brandByDomain(state.brand)) || pageFocal
  const [shown, setShown] = useState(false)
  const [swapped, setSwapped] = useState(false) // the Answer drawer is standing in for this one
  const pushed = useRef(false) // opened by a click (not a refresh): closing goes Back, so the history entry goes too
  const panel = useRef(null)
  const opener = useRef(null)
  const lastRow = useRef(null)
  const bodyRef = useRef(null)

  // engines with data for this brand (the select lists only these)
  const stats = getBrandView(focal.domain).platforms
  const engines = ENGINES.filter((e) => (stats.find((p) => p.id === e.id)?.visible ?? 0) > 0)
  const open = state != null
  const engine = open && (state.engine === 'all' || engines.some((e) => e.id === state.engine)) ? state.engine : 'all'
  const tab = state?.tab ?? 'mentions'
  const data = useMemo(() => engineDetail(focal.domain, engine), [focal.domain, engine])

  useEffect(() => {
    const on = (e) => {
      opener.current = e.detail.opener ?? document.activeElement
      setSwapped(false)
      const next = { engine: e.detail.engine, tab: e.detail.tab, brand: e.detail.brand }
      if (!readUrl()) { window.history.pushState(window.history.state, '', urlFor(next)); pushed.current = true }
      setState(next)
    }
    // Back (or Forward) moves the drawer with the URL
    const pop = () => { pushed.current = false; setSwapped(false); setState(readUrl()) }
    window.addEventListener(EVENT, on)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('popstate', pop) }
  }, [])
  useEffect(() => { writeUrl(open && !swapped ? { engine, tab, brand: state.brand } : null) }, [open, swapped, engine, tab, state?.brand]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!open) { setShown(false); return }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown && !swapped) panel.current?.focus() }, [open, shown]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0) }, [engine, tab])

  // closed: drop the history entry we added (popstate then clears the state), or just clear it
  const finish = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back() } else setState(null)
    setSwapped(false)
    opener.current?.focus?.()
  }, [])
  const close = useCallback(() => {
    setShown(false)
    setTimeout(finish, reduced() ? 0 : 200)
  }, [finish])

  // a prompt → the Answer drawer takes this drawer's place; "← Mentions" brings it back as it was
  const openPrompt = (row, list, el) => {
    lastRow.current = el
    setSwapped(true)
    const label = TABS.find(([id]) => id === tab)[1]
    openAnswer({
      key: row.key,
      engine: row.engine,
      brand: focal.domain,
      list: list.map((r) => r.key),
      back: {
        label,
        onBack: () => { setSwapped(false); requestAnimationFrame(() => (lastRow.current?.isConnected ? lastRow.current : panel.current)?.focus({ preventScroll: true })) },
        onClose: finish,
      },
    })
  }

  const setEngine = (id) => setState((s) => ({ ...s, engine: id }))
  const setTab = (id) => setState((s) => ({ ...s, tab: id }))

  // Esc closes; ↑/↓ walk the rows (from the search box ↓ enters the list); Enter opens (rows are buttons); focus trap
  const onKeyDown = (e) => {
    if (e.defaultPrevented) return
    const t = e.target
    if (e.key === 'Escape') {
      if (t.closest('[role=listbox]')) return // the engine menu closes itself
      e.preventDefault(); close()
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && t.tagName !== 'SELECT' && !t.closest('[role=listbox]') && !t.closest('[aria-haspopup]')) {
      const rows = [...panel.current.querySelectorAll('[data-nav]')]
      if (!rows.length) return
      const i = rows.indexOf(t)
      const next = i === -1 ? (e.key === 'ArrowDown' ? rows[0] : null) : rows[i + (e.key === 'ArrowDown' ? 1 : -1)]
      if (i === -1 && t.tagName === 'INPUT' && e.key === 'ArrowUp') return
      e.preventDefault()
      if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }) } else if (i === 0) panel.current.querySelector('[data-nav-start]')?.focus()
    } else if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  const onTabKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = TABS.findIndex(([id]) => id === tab)
    const next = TABS[(i + step + TABS.length) % TABS.length][0]
    setTab(next)
    requestAnimationFrame(() => panel.current?.querySelector(`[data-tab="${next}"]`)?.focus())
  }

  if (!open) return null
  const name = engineName(engine)
  const counts = { mentions: data.mentions.length, pages: data.pages.length }
  const engineChips = [{ id: 'all', name: 'All' }, ...engines]
  // ←/→ move between the engine chips
  const onChipKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = engineChips.findIndex((x) => x.id === engine)
    const next = engineChips[(i + step + engineChips.length) % engineChips.length].id
    setEngine(next)
    requestAnimationFrame(() => panel.current?.querySelector(`[data-engine-chip="${next}"]`)?.focus())
  }
  const exportCsv = () => {
    const slug = `${focal.name}-${engine}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (tab === 'mentions') download(`${slug}-mentions.csv`, [['Prompt', 'Category', 'Engine', 'Cited'], ...data.mentions.map((r) => [r.prompt, r.category, engineName(r.engine), r.cited ? 'Yes' : 'No'])])
    else download(`${slug}-cited-pages.csv`, [['Page', 'Prompts', 'Prompt list'], ...data.pages.map((p) => [`https://${focal.domain}${p.path}`, p.prompts.length, p.prompts.map((x) => x.prompt).join(' | ')])])
  }

  return (
    // swapped: hidden, not unmounted, so the search, filters and scroll are still there after "← Mentions"
    <div className={`fixed inset-0 z-50 ${swapped ? 'invisible' : ''}`} onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Where ${engine === 'all' ? 'AI engines mention' : `${name} mentions`} ${focal.name}`}
        tabIndex={-1}
        className={`${SHEET_BASE} md:w-[min(720px,100vw)] ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={panel} onClose={close} />
        <header className="shrink-0 border-b border-line px-6 pb-0 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Engine" onKeyDown={onChipKey} className="inline-flex h-8 min-w-0 items-center overflow-x-auto rounded-lg bg-tint p-0.5 [scrollbar-width:none]">
              {engineChips.map((e) => {
                const on = e.id === engine
                return (
                  <button key={e.id} data-engine-chip={e.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => setEngine(e.id)}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-raised text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
                    {e.id !== 'all' && <PlatformIcon id={e.id} size={14} />}{e.name}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={close} aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <X size={16} />
            </button>
          </div>
          <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">
            Where {engine === 'all' ? 'AI engines mention' : `${name} mentions`} {focal.name}
          </h2>
          <div role="tablist" aria-label="Mentions and cited pages" onKeyDown={onTabKey} className="mt-4 flex gap-6">
            {TABS.map(([id, label]) => (
              <button key={id} data-tab={id} type="button" role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}
                className={`-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
                {label}<span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums">{counts[id]}</span>
              </button>
            ))}
          </div>
        </header>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'mentions'
            ? <MentionsTab key={`${focal.domain}|${engine}`} rows={data.mentions} focalDomain={focal.domain} onOpen={openPrompt} />
            : <PagesTab key={`${focal.domain}|${engine}`} pages={data.pages} domain={focal.domain} onOpen={openPrompt} />}
        </div>

        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pt-3 text-[13px] leading-[18px] text-stone-600 md:px-6 ${SHEET_FOOTER_PAD}`}>
          <span className="min-w-0 truncate tabular-nums">
            {tab === 'mentions' ? plural(data.mentions.length, 'prompt') : `${plural(data.citations, 'citation')} across ${plural(data.pages.length, 'page')}`} · {name} · updated {short(fmtDay(tracking.schedule.lastSync))}
          </span>
          <span className="flex shrink-0 items-center gap-4">
            {/* engine filtering lives in the header select; this is the shortcut from here (and closes the drawer) */}
            {engine !== 'all' && dashEngine !== engine && (
              <button type="button" onClick={() => { filterDashboard(engine); close() }} className="rounded font-medium text-stone-700 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                Filter dashboard to {name}
              </button>
            )}
            <button type="button" onClick={exportCsv} className="rounded font-medium text-stone-700 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Export CSV</button>
          </span>
        </footer>
        <div className="sr-only" aria-live="polite">{`${name}: ${plural(counts.mentions, 'mention')}, ${plural(counts.pages, 'cited page')}`}</div>
      </div>
    </div>
  )
}
