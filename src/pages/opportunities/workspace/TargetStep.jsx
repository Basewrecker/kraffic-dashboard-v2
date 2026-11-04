// Step 2 — Choose the target page: the brand's pages that get Search Console impressions for the prompt's queries,
// ranked, fixed 56px rows (they never change height): the path (15/500, middle-truncated, "Best match" on the top row;
// its top query in a tooltip) · the AI engines that cite the page now (only those, full colour; none → "—") · an
// impressions bar with its number. Hover (or focus) a row: in the same space the bar and number crossfade (150ms) to
// "28 clicks · pos. 14.1 · trend", and the Search Console column previews the page (onPreview); nothing else moves.
// Click selects it (soft tint + 1px ink ring); the pointer leaving gives the column back.
// Last, the new page as an ordinary row: "+" where the engines sit, the slug, a muted "New" chip, the reason in an ⓘ
// tooltip. No candidates (or no Search Console) → only the new page, selected. One radio group: arrows move, Space
// picks. Continue and Skip to draft live in the step deck's action panel (Deck.jsx), not here.
import { useRef, useState } from 'react'
import { Info, Plus } from 'lucide-react'
import { ENGINE_NAME } from '../../../data/contentOpportunities'
import { Engines, MidText, pathOf } from '../parts'
import { barPct, compactNum, sparkPoints } from './flow'
import { ROW_H } from './SearchConsolePanel'

const nf = new Intl.NumberFormat('en-US')
const num = (n) => nf.format(n)
const ROW = 'grid grid-cols-[minmax(0,1fr)_96px_216px] items-center gap-x-4 px-3 @max-[520px]:grid-cols-[minmax(0,1fr)_120px]'

// a selectable row: the soft tint and a 1px ink ring when selected (150ms), a lighter tint on hover
const option = (selected) => `relative rounded-[10px] transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none ${selected
  ? 'bg-tint shadow-[inset_0_0_0_1px_var(--ink)]'
  : 'shadow-[inset_0_0_0_1px_transparent] hover:bg-[color-mix(in_srgb,var(--tint)_60%,transparent)]'}`
const radioArea = 'block w-full cursor-pointer rounded-[10px] text-left outline-none focus-visible:ring-2 focus-visible:ring-focus'

export default function TargetStep({ candidates, newPage, target, onTarget, onPreview = () => {}, citing = () => [] }) {
  const max = Math.max(0, ...candidates.map((c) => c.impressions))
  const options = [...candidates.map((c) => ({ kind: 'page', url: c.url })), { kind: 'new', slug: newPage.slug }]
  const isSel = (o) => o.kind === target.kind && (o.kind === 'new' || o.url === target.url)
  const selIndex = Math.max(0, options.findIndex(isSel))
  const refs = useRef([])
  const [open, setOpen] = useState(null) // the row hovered or focused: its details show, Search Console previews it
  const show = (url) => { setOpen(url); onPreview(url) }
  const hide = () => { setOpen(null); onPreview(null) }
  const onKey = (e, i) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (d) {
      e.preventDefault()
      const j = (i + d + options.length) % options.length
      onTarget(options[j]); refs.current[j]?.focus()
    } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onTarget(options[i]) }
  }
  const radio = (i) => ({
    role: 'radio', 'aria-checked': i === selIndex, tabIndex: i === selIndex ? 0 : -1,
    ref: (el) => { refs.current[i] = el }, onClick: () => onTarget(options[i]), onKeyDown: (e) => onKey(e, i),
  })
  const creating = target.kind === 'new'

  return (
    <div className="@container">
      <div role="radiogroup" aria-label="Target page" className="flex flex-col gap-0.5 pt-1" onMouseLeave={hide}>
        {candidates.length > 0 && (
          <div className={`${ROW} h-8 text-[12px] leading-4 text-stone-500`} aria-hidden>
            <span>Page</span><span className="@max-[520px]:hidden">Cited by</span><span className="text-right">Impressions</span>
          </div>
        )}
        {candidates.map((c, i) => {
          const path = pathOf(c.url)
          const top = c.queries[0]
          const isOpen = open === c.url
          const by = citing(c.url, i)
          return (
            <div key={c.url} className={option(i === selIndex)} onMouseEnter={() => show(c.url)}>
              <div {...radio(i)} onFocus={() => show(c.url)} onBlur={hide}
                aria-label={`${path}, ${num(c.impressions)} impressions, cited by ${by.length ? by.map((e) => ENGINE_NAME[e]).join(', ') : 'no AI engine'}${c.bestMatch ? ', best match' : ''}`} className={radioArea}>
                <span className={ROW} style={{ height: ROW_H }}>
                  {/* the path; its top query in a tooltip */}
                  <span className="group/q relative flex min-w-0 items-center gap-2">
                    <MidText text={path} className="flex-1 text-[15px] leading-[22px] font-medium text-stone-900" />
                    {c.bestMatch && <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-line bg-surface px-2 text-[12px] leading-4 font-medium text-stone-700">Best match</span>}
                    {top && (
                      <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-max max-w-[320px] rounded-md border border-line bg-raised px-3 py-2 text-[12px] leading-4 text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/q:opacity-100">
                        <span className="block text-stone-500">Top query</span>
                        <span className="font-medium text-stone-900">{top.keyword}</span><span className="tabular-nums"> · {compactNum(top.impressions)} impr.</span>
                      </span>
                    )}
                  </span>
                  {/* only the engines that cite the page, in full colour; none → a muted "—" */}
                  <span className="flex items-center @max-[520px]:hidden">
                    <Engines ids={by} engineName={(e) => ENGINE_NAME[e]} />
                  </span>
                  {/* the same space, crossfaded on hover (150ms): the impressions bar and number ⇄ clicks · position · trend */}
                  <span className="relative h-full">
                    <span className="absolute inset-0 flex items-center justify-end gap-2.5 transition-opacity duration-150 ease-out" style={{ opacity: isOpen ? 0 : 1 }} aria-hidden={isOpen}>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
                        <span className="block h-full rounded-full bg-ink" style={{ width: `${barPct(c.impressions, max)}%` }} />
                      </span>
                      <span className="w-12 text-right text-[14px] leading-5 font-medium tabular-nums text-stone-900">{num(c.impressions)}</span>
                    </span>
                    <span className="absolute inset-0 flex items-center justify-end gap-3 whitespace-nowrap text-[13px] leading-[18px] tabular-nums text-stone-500 transition-opacity duration-150 ease-out" style={{ opacity: isOpen ? 1 : 0 }} aria-hidden={!isOpen}>
                      <span><span className="font-medium text-stone-900">{num(c.clicks)}</span> clicks</span>
                      <span>pos. <span className="font-medium text-stone-900">{c.position.toFixed(1)}</span></span>
                      <Spark values={c.trend} />
                    </span>
                  </span>
                </span>
              </div>
            </div>
          )
        })}
        {/* the new page: an ordinary row ("+" where the engines sit, a "New" chip, the reason behind an ⓘ) */}
        <div className={option(creating)} onMouseEnter={hide}>
          <div {...radio(options.length - 1)} className={radioArea} aria-label={`Create a new page at ${newPage.slug}. ${newPage.reason}`}>
            <span className={ROW} style={{ height: ROW_H }}>
              <span className="flex min-w-0 items-center gap-2">
                <MidText text={newPage.slug} className="flex-1 text-[15px] leading-[22px] font-medium text-stone-900" />
                <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-tint px-2 text-[12px] leading-4 font-medium text-stone-600">New</span>
                <span className="group/i relative inline-flex shrink-0">
                  <span tabIndex={0} aria-label={newPage.reason} className="grid h-6 w-6 place-items-center rounded-md text-stone-500 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"><Info size={14} aria-hidden /></span>
                  <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1 w-[260px] rounded-md border border-line bg-raised px-3 py-2 text-[12px] leading-4 text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/i:opacity-100 group-focus-within/i:opacity-100">
                    {newPage.reason}
                  </span>
                </span>
              </span>
              <span className="flex items-center @max-[520px]:hidden" aria-hidden><span className="grid h-5 w-5 place-items-center rounded-md border border-dashed border-[var(--color-line-strong)] text-stone-500"><Plus size={12} strokeWidth={2.5} /></span></span>
              <span className="text-right text-[13px] leading-[18px] text-stone-500">{candidates.length ? 'Start fresh' : 'No page ranks yet'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// weekly impressions, 8 weeks, as a 56×18 line (ink; no axes, no fill)
function Spark({ values }) {
  const up = values[values.length - 1] >= values[0]
  return (
    <svg width="56" height="18" viewBox="0 0 56 18" className="shrink-0 overflow-visible" role="img"
      aria-label={`Impressions ${up ? 'up' : 'down'} over 8 weeks, ${num(values[0])} to ${num(values[values.length - 1])} a week`}>
      <polyline points={sparkPoints(values, 56, 18, 2)} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
