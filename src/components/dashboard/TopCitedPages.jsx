import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import Card from './Card'
import Insight, { hl, useExplain } from '../ui/Insight'
import { citedEvidence, uncitedEvidence } from './insights'
import { showPromptSets } from './promptSet'
import { useTracking } from '../../store/trackingSettings'
import SectionHeader from './SectionHeader'
import { PlatformIcon } from './icons'
import { openEngineDrawer } from '../answer/EngineDrawer'
import { platformNames, uncitedPages } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'

// Adapts to the height the row gives it (Sync history beside it can expand): cited pages first, all of them
// when they fit (else the rest collapse into "N other pages"), then — Dermasuri only — "Not cited yet".
// Never a half row: whatever is left over (< 1 row) is plain padding.
const ROW_H = 44 // h-11 cited rows
const UNCITED_H = 48 // h-12 "Not cited yet" rows
const SECTION_H = 84 // mt-6 + border-t pt-4 + label + description + mb-2
const BASE_ROWS = 6 // natural size: 5 pages + "N other pages", like the card always had
const PAD_B = 16
const ROW = 'grid grid-cols-[minmax(0,1fr)_auto_40px_40px] items-center gap-x-3'
const iconId = (p) => (p === 'google' ? 'aio' : p)

// "▲3" ink · "▼1" negative · "—" muted
function Delta({ d }) {
  if (!d) return <span className="text-right text-[12px] leading-4 font-medium text-stone-500">—</span>
  return <span className={`text-right text-[12px] leading-4 font-medium tabular-nums ${d > 0 ? 'text-ink' : 'text-negative'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>
}

// how many rows of each kind fit in `h` px
function fill(h, cited, uncitedCount) {
  const fits = Math.floor(h / ROW_H)
  if (cited.length <= fits) {
    const rest = h - cited.length * ROW_H
    const n = uncitedCount && rest >= SECTION_H + UNCITED_H ? Math.min(uncitedCount, Math.floor((rest - SECTION_H) / UNCITED_H)) : 0
    return { shown: cited, other: null, uncited: n }
  }
  const k = Math.max(1, fits - 1) // the last row becomes "N other pages"
  const rest = cited.slice(k)
  return {
    shown: cited.slice(0, k),
    other: { label: `${rest.length} other page${rest.length === 1 ? '' : 's'}`, count: rest.reduce((n, p) => n + p.count, 0), delta: rest.reduce((n, p) => n + p.delta, 0) },
    uncited: 0,
  }
}

export default function TopCitedPages() {
  const view = useBrandView()
  const tracking = useTracking()
  const { citedAll, focal, isOwnBrand, engine } = view
  const explain = useExplain(`${focal.domain}|${engine}`)
  const total = citedAll.reduce((n, p) => n + p.count, 0)
  const uncitedList = isOwnBrand ? uncitedPages : []
  // every cited page, all engines: the same drawer as the Citations and Mentions card
  const openAll = (e) => openEngineDrawer({ engine: 'all', tab: 'pages', brand: focal.domain, opener: e.currentTarget })

  // measure the body (debounced 100ms); first measure is synchronous so nothing pops in on load
  const body = useRef(null)
  const [avail, setAvail] = useState(BASE_ROWS * ROW_H)
  useLayoutEffect(() => {
    const el = body.current
    const read = () => setAvail(Math.max(0, el.clientHeight - PAD_B))
    read()
    let t
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(read, 100) })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [])
  const { shown, other, uncited } = fill(avail, citedAll, uncitedList.length)
  const uncitedShown = uncitedList.slice(0, uncited)
  const insight = uncitedShown.length
    ? uncitedEvidence(uncitedShown[0], { tracking })
    : citedEvidence(citedAll, { view, tracking, engine })

  return (
    <Card ref={explain.cardRef} id="top-cited-pages" className="flex h-full min-w-0 flex-col p-5">
      <SectionHeader
        title="Top cited pages"
        subtitle={`${isOwnBrand ? 'Your' : `${focal.name}`} URLs that AI answers cite · ${total} citations`}
        right={(
          <button type="button" onClick={openAll} aria-label={`All ${citedAll.length} cited pages`}
            className="inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus tabular-nums">
            All {citedAll.length} <ArrowRight size={14} aria-hidden />
          </button>
        )}
      />

      {/* the measured body: at least its natural size, taller when the row is */}
      <div ref={body} className="relative mt-4 flex-1" style={{ minHeight: BASE_ROWS * ROW_H + PAD_B }}>
        <div className="absolute inset-0 overflow-hidden">
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {shown.map((p) => (
              <li key={p.path} className={`${ROW} row-in h-11`} {...hl(explain, `page:${p.path}`, { row: true })}>
                <a
                  href={`https://${focal.domain}${p.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${focal.domain}${p.path}`}
                  className="group/link flex min-w-0 items-center gap-1 rounded text-[14px] leading-5 text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {/* fills its column so the path truncates; underline sits on the text only */}
                  <span className="truncate underline-offset-4 group-hover/link:underline">{p.path}</span>
                  <ArrowUpRight size={12} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100 group-focus-visible/link:opacity-100" aria-hidden />
                </a>
                <span className="flex items-center justify-end gap-1">
                  {p.platforms.map((x) => <span key={x} title={platformNames[x]} className="flex"><PlatformIcon id={iconId(x)} size={14} /></span>)}
                </span>
                <span className="text-right text-[14px] leading-5 font-semibold text-ink tabular-nums">{p.count}</span>
                <Delta d={p.delta} />
              </li>
            ))}
            {other && (
              <li className={`${ROW} h-11`} {...hl(explain, 'page:other', { row: true })}>
                <button type="button" onClick={openAll} className="group/other flex min-w-0 items-center gap-1 rounded text-left text-[14px] leading-5 text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                  <span className="truncate">{other.label}</span>
                  <ArrowRight size={12} className="shrink-0 opacity-0 transition-opacity duration-150 group-hover/other:opacity-100 group-focus-visible/other:opacity-100" aria-hidden />
                </button>
                <span />
                <span className="text-right text-[14px] leading-5 font-semibold text-ink tabular-nums">{other.count}</span>
                <Delta d={other.delta} />
              </li>
            )}
          </ul>

          {uncitedShown.length > 0 && (
            <section className="row-in-section mt-6 border-t border-[var(--color-line)] pt-4" aria-label="Not cited yet">
              <h3 className="text-[13px] leading-[18px] font-medium text-stone-600">Not cited yet</h3>
              <p className="mb-2 mt-0.5 text-[12px] leading-4 text-stone-500">Your pages that match tracked prompts but AI never links to</p>
              <ul className="divide-y divide-[var(--color-line-soft)]">
                {uncitedShown.map((u) => (
                  <li key={u.path} className="group row-in-12 flex h-12 items-center justify-between gap-3" {...hl(explain, `uncited:${u.path}`, { row: true })}>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] leading-5 text-stone-900" title={`${focal.domain}${u.path}`}>{u.path}</span>
                      <span className="block text-[12px] leading-4 text-stone-500 tabular-nums">Relevant to {u.relevant} prompts</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => showPromptSets(u.keys, `Relevant to ${u.path}`)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[13px] leading-[18px] font-medium text-stone-600 opacity-0 outline-none transition-[opacity,color] duration-150 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover:opacity-100"
                    >
                      View prompts <ArrowRight size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <Insight explain={explain} {...insight} />
    </Card>
  )
}
