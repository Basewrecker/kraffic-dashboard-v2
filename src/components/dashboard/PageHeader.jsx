import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { account } from '../../data/mock'
import { ENGINES, OWN, TRACKED_BRANDS, getBrandView } from '../../data/brandViews'
import { PlatformIcon } from './icons'
import { PlatformFilterPill } from './PlatformFilter'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'

// size 'sm' = h-8 (header and page toolbars), 'md' = h-10; label optional
const triggerClass = (size) =>
  `inline-flex ${size === 'sm' ? 'h-8 rounded-md px-3 text-[13px]' : 'h-10 rounded-lg px-3.5 text-small'} shrink-0 items-center gap-2 whitespace-nowrap border border-line bg-raised outline-none focus-visible:ring-2 focus-visible:ring-focus`

const score = (domain) => getBrandView(domain).kpis.score
// header selects: full width, 40px tall below lg; exactly the old h-8 trigger from lg
const MOBILE_TRIGGER = `${triggerClass('sm')} max-lg:h-10 max-lg:w-full max-lg:rounded-lg max-lg:text-[14px] [&>svg:last-child]:max-lg:ml-auto`

// Header dropdown: trigger like the other selects ("Prefix  Value ▾"), grouped listbox, optional footer.
// ↓ opens; ↑/↓ move, Enter/Space pick, Esc closes and returns focus to the trigger.
// groups: [{ label?, items: [{ id, label, short?, icon?, meta }] }] (short: the trigger's text, if shorter); prefix optional (aria-label falls back to listLabel);
// showIcon puts the current item's icon in the trigger; align 'left' opens the menu from the trigger's left edge.
// triggerClassName replaces the trigger's size / shape classes (e.g. to match a toolbar's h-9 selects).
export function MenuSelect({ prefix = '', value, onChange, groups, footer, title, listLabel, showIcon, align = 'right', triggerClassName, className = '' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef(null)
  const trigger = useRef(null)
  const list = useRef(null)
  const order = groups.flatMap((g) => g.items)
  const current = order.find((x) => x.id === value) ?? order[0]
  const uid = (prefix || listLabel).replace(/\W+/g, '-').toLowerCase()

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, order.findIndex((x) => x.id === value)))
    list.current?.focus()
    const close = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, value]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (x) => { onChange(x.id); setOpen(false); trigger.current?.focus() }
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + order.length) % order.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); pick(order[active])
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false); if (e.key === 'Escape') trigger.current?.focus()
    }
  }

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${prefix || listLabel}: ${current.label}`}
        title={title}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        className={triggerClassName ?? triggerClass('sm')}
      >
        {prefix && <span className="font-normal text-stone-500">{prefix}</span>}
        {showIcon && current.icon}
        <span className={`${prefix ? '-ml-0.5 ' : ''}font-medium text-stone-900`}>{current.short ?? current.label}</span>
        <ChevronDown size={14} className="text-ink-3" />
      </button>
      {open && (
        <div
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-label={listLabel}
          aria-activedescendant={`${uid}-opt-${active}`}
          onKeyDown={onKey}
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-30 mt-1 w-64 max-lg:left-0 max-lg:right-0 max-lg:w-auto rounded-lg border border-line bg-raised p-1 shadow-md outline-none`}
        >
          {groups.map((g, gi) => (
            <div key={g.label ?? gi} role="group" aria-label={g.label}>
              {g.label && <div className="px-2 pb-1 pt-1.5 text-[11px] leading-4 font-medium text-stone-500">{g.label}</div>}
              {g.items.map((x) => {
                const i = order.indexOf(x)
                const selected = x.id === value
                return (
                  <div
                    key={x.id}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(x)}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] leading-[18px] text-stone-900 ${active === i ? 'bg-tint' : ''}`}
                  >
                    {selected ? <Check size={14} className="shrink-0 text-ink" aria-hidden /> : <span className="w-3.5 shrink-0" aria-hidden />}
                    {x.icon}
                    <span className={`flex-1 truncate ${selected ? 'font-medium' : ''}`}>{x.label}</span>
                    {x.meta != null && <span className="text-[12px] leading-4 text-stone-500 tabular-nums">{x.meta}</span>}
                  </div>
                )
              })}
            </div>
          ))}
          {footer && <div className="mt-1 border-t border-line px-2 py-2 text-[12px] leading-4 text-stone-500">{footer}</div>}
        </div>
      )}
    </div>
  )
}

const BRAND_GROUPS = [
  { label: 'Your brand', items: TRACKED_BRANDS.filter((b) => b.you) },
  { label: 'View as a competitor', items: TRACKED_BRANDS.filter((b) => !b.you) },
].map((g) => ({ ...g, items: g.items.map((b) => ({ id: b.domain, label: b.name, meta: `${score(b.domain)}%` })) }))

export default function PageHeader() {
  const tracking = useTracking()
  const { focal, isOwnBrand, setView, engine, setEngine } = useBrandView()
  // prompts where each engine mentions the brand being viewed (unfiltered: the card data covers all engines)
  const perEngine = Object.fromEntries(getBrandView(focal.domain).platforms.map((p) => [p.id, p.visible]))
  const engineGroups = [{
    items: [
      { id: 'all', label: 'All engines' },
      ...ENGINES.map((e) => ({ id: e.id, label: e.name, icon: <PlatformIcon id={e.id} size={16} />, meta: `${perEngine[e.id] ?? 0} prompts` })),
    ],
  }]

  return (
    // mb-2: with the page gap-4 this gives header → KPI row = 24px
    <div className="mb-2">
      {/* phones / tablets: title, subtitle, then the two filters full width (one row each) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Visibility Overview</h1>
          {/* the only competitor-view indicator: same line, same height */}
          <p className="mt-1 text-body font-normal text-stone-600">
            {isOwnBrand ? (
              <>Track how often {account.name} appears in AI answers across Google, ChatGPT, Gemini &amp; Claude.</>
            ) : (
              <>
                {focal.name}’s view · read-only ·{' '}
                <button type="button" onClick={() => setView(OWN.domain)} className="rounded font-medium text-ink outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">
                  Back to {OWN.name}
                </button>
              </>
            )}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-600 lg:hidden">
            <span className="h-2 w-2 rounded-full bg-ink" /> {tracking.syncing ? 'Syncing…' : `Updated ${fmtDay(tracking.schedule.lastSync)}`}
          </p>
        </div>
        <div className="relative flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2.5 lg:pt-1">
          {/* engine filter chip sits just above the KPI row's right edge; absolute, so nothing shifts */}
          <PlatformFilterPill className="self-start lg:absolute lg:right-0 lg:top-full lg:mt-1.5" />
          <MenuSelect prefix="Engine" value={engine} onChange={setEngine} groups={engineGroups} listLabel="Filter by engine" footer="Filters every card to answers from this engine."
            className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER} />
          <MenuSelect
            className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER}
            prefix="Viewing as"
            value={focal.domain}
            onChange={setView}
            groups={BRAND_GROUPS}
            listLabel="View the dashboard as"
            title="See the dashboard from a competitor’s point of view"
          />
          {/* from the tracking store, so a sync on /tracking or /brands shows here too */}
          <span className="hidden items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] font-normal text-stone-600 lg:inline-flex">
            <span className="h-2 w-2 rounded-full bg-ink" /> {tracking.syncing ? 'Syncing…' : `Updated ${fmtDay(tracking.schedule.lastSync)}`}
          </span>
        </div>
      </div>
    </div>
  )
}
