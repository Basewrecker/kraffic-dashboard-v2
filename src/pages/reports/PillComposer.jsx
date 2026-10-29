import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, AlignLeft, Calendar, Check, ChevronLeft, ChevronRight, Plus, Square, UserRound, X } from 'lucide-react'
import SiteLogo from '../../components/ui/SiteLogo'
import { EngineMark } from '../insights/parts'
import { textHeight } from '../../data/composer'
import { AUDIENCES, ENGINE_IDS, ENGINE_NAMES, LENGTHS, MAX_COMPARE, PERIODS, REPORT_BRANDS, dataFor, inferOpts, rivalsOf, suggestionsFor } from '../../data/reports'
import { BrandLogo, ChipMenu, brandOf, menuItem, menuLabel, t3 } from './parts'

// New report's box: the question on top, full width; under it, in the same box, "+" (brand, engines, competitors), any
// chips "+" set (removable), Period / Audience / Length as ghost dropdowns that always show their value, and send.
// It grows upward only as the question wraps; the bottom row stays put.
// Empty and focused: up to 4 suggestions under it (arrow keys + Enter pick one). Enter sends; Shift+Enter is a new line.
// The dropdowns show what the report will use: what you picked, else what the question implies, else the default.
export const PILL_DEFAULTS = { period: 'week', audience: 'team', length: 'one' }
export const shownOpts = (opts, prompt) => {
  const inf = inferOpts(prompt, dataFor(opts.brand))
  const pick = (k) => opts[k] ?? inf[k] ?? PILL_DEFAULTS[k]
  return { ...opts, period: pick('period'), audience: pick('audience'), length: pick('length') }
}

const Tick = ({ on }) => <Check size={14} className={on ? 'shrink-0 text-ink' : 'invisible shrink-0'} aria-hidden />
const Box = ({ on }) => (
  <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${on ? 'bg-ink' : ''}`} style={on ? undefined : { boxShadow: 'inset 0 0 0 1.5px var(--color-stone-500)' }}>
    {on && <Check size={12} strokeWidth={3} style={{ color: 'var(--line-check)' }} />}
  </span>
)

// docked: the box sits at the bottom of a thread, so its suggestions and menus open upward. placeholder / suggestions:
// the thread's own ("Change this report…" and the refine options: { id, text, icon }).
const PillComposer = forwardRef(function PillComposer({ prompt, setPrompt, opts, setOpts, onSend, busy = false, onStop = null, homeBrand, autoFocus = false, suggest = true, docked = false, placeholder = null, suggestions = null }, ref) {
  const area = useRef(null)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const [closed, setClosed] = useState(false) // Esc hides the suggestions until the box is focused again
  // the box is as tall as its text; measured again when the text changes or its width does (a chip comes or goes)
  // (one line while empty, up to 8 lines, then it scrolls inside itself)
  const fitW = useRef(-1)
  const fit = () => {
    const el = area.current
    if (!el) return
    fitW.current = el.clientWidth
    el.style.height = 'auto'
    const { height, scroll } = textHeight(el.value, el.scrollHeight)
    el.style.height = `${height}px`
    el.style.overflowY = scroll ? 'auto' : 'hidden'
  }
  useLayoutEffect(fit, [prompt])
  useEffect(() => {
    // compared with the width it was last fitted at, so a width that changes and settles before the observer runs still refits
    const ro = new ResizeObserver(() => { if (area.current && area.current.clientWidth !== fitW.current) fit() })
    if (area.current) ro.observe(area.current)
    return () => ro.disconnect()
  }, [])
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }))
  const shown = shownOpts(opts, prompt)
  const canSend = prompt.trim().length > 0 && !busy
  const send = () => { if (canSend) { setClosed(true); onSend(shownOpts(opts, prompt)) } }
  const brand = brandOf(opts.brand)
  const rivals = rivalsOf(opts.brand)
  // suggestions: shown while the empty box is focused. They fade up in a stagger, and fade out together (their space
  // kept until the fade ends). Transitions, not keyframes, so focusing again mid-fade carries on from where it is.
  const want = suggest && focused && !closed && !prompt
  const list = (suggestions ?? suggestionsFor(opts.brand)).slice(0, 4)
  const [phase, setPhase] = useState('gone') // gone → pre (mounted, hidden) → in → out → gone
  const seq = useRef(0)
  useEffect(() => {
    const me = ++seq.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (want) {
      if (reduced) { setPhase('in'); return undefined }
      setPhase((ph) => (ph === 'gone' ? 'pre' : 'in'))
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => { if (seq.current === me) setPhase('in') }))
      return () => cancelAnimationFrame(raf)
    }
    setPhase((ph) => (ph === 'gone' ? ph : 'out'))
    const t = setTimeout(() => { if (seq.current === me) setPhase('gone') }, reduced ? 0 : 120)
    return () => clearTimeout(t)
  }, [want])
  const sugg = want ? list : []
  const pick = (s) => {
    setPrompt(s.text)
    if (s.sets) setOpts((o) => ({ ...o, kind: null, compare: [], ...s.sets }))
    setActive(-1)
    requestAnimationFrame(() => { const el = area.current; el?.focus(); el?.setSelectionRange(s.text.length, s.text.length) })
  }
  const onKey = (e) => {
    if (sugg.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const n = sugg.length
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a <= 0 ? n - 1 : a - 1)))
      return
    }
    if (e.key === 'Escape' && sugg.length) { e.preventDefault(); setClosed(true); setActive(-1); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (sugg.length && active >= 0) pick(sugg[active])
      else send()
    }
  }

  // chips: what "+" set that isn't the default
  const engineLabel = opts.engines.length === 1 ? `${ENGINE_NAMES[opts.engines[0]]} only` : opts.engines.map((e) => ENGINE_NAMES[e]).join(' + ')
  const rivalName = (k) => rivals.find((r) => r.key === k)?.name.split(' ')[0] ?? k
  const chips = [
    homeBrand && opts.brand !== homeBrand && { key: 'brand', label: brand?.name, logo: <BrandLogo id={opts.brand} className="h-3.5 w-3.5" />, clear: () => set({ brand: homeBrand, compare: [] }) },
    opts.engines.length > 0 && { key: 'engines', label: engineLabel, clear: () => set({ engines: [] }) },
    opts.compare.length > 0 && { key: 'compare', label: `vs ${opts.compare.length === 1 ? rivalName(opts.compare[0]) : `${opts.compare.length} competitors`}`, clear: () => set({ compare: [], kind: opts.kind === 'rival' ? null : opts.kind }) },
  ].filter(Boolean)

  const radio = (list, k, close) => list.map((x) => (
    <button key={x.id} type="button" role="menuitemradio" aria-checked={shown[k] === x.id} onClick={() => { set({ [k]: x.id }); close() }} className={`${menuItem} items-start text-stone-900`}>
      <span className="min-w-0 flex-1"><span className="block">{x.label}</span>{x.hint && <span className={`block text-[12px] leading-4 ${t3}`}>{x.hint}</span>}</span><Tick on={shown[k] === x.id} />
    </button>
  ))
  const label = (list, k) => list.find((x) => x.id === shown[k])?.label

  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
  const rowStyle = (i) => (phase === 'in'
    ? { opacity: 1, transform: 'none', transition: `opacity 180ms ${EASE} ${60 + i * 35}ms, transform 180ms ${EASE} ${60 + i * 35}ms, color 120ms, background-color 120ms` }
    : phase === 'out'
      ? { opacity: 0, transform: 'none', transition: 'opacity 120ms ease-out, transform 120ms ease-out, color 120ms, background-color 120ms' }
      : { opacity: 0, transform: 'translateY(4px)', transition: 'none' })

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[760px]">
      {/* the page's one focal surface: the raised layer (lighter than cards in dark, white in light).
          row 1: the question, full width (grows as it wraps); row 2, pinned to the bottom: "+", chips, the dropdowns, send */}
      <div className="flex flex-col rounded-[24px] border border-line bg-raised px-5 pb-[11px] pt-[15px] transition-[border-color] duration-150 focus-within:border-line-strong max-md:px-3.5">
        <label className="sr-only" htmlFor="report-q">Ask about {brand?.name ?? 'your brand'}’s AI visibility</label>
        <textarea id="report-q" ref={area} value={prompt} rows={1} autoFocus={autoFocus}
          role="combobox" aria-expanded={phase === 'in'} aria-controls="report-suggestions" aria-autocomplete="list" aria-activedescendant={active >= 0 && sugg[active] ? `sugg-${sugg[active].id}` : undefined}
          onChange={(e) => { setPrompt(e.target.value); setClosed(false) }} onKeyDown={onKey}
          onFocus={() => { setFocused(true); setClosed(false) }} onBlur={() => { setFocused(false); setActive(-1) }}
          placeholder={placeholder ?? `Ask about ${brand?.name ?? 'your brand'}’s AI visibility`}
          className="block h-6 w-full resize-none overflow-hidden bg-transparent p-0 text-[16px] leading-6 font-normal tracking-normal text-stone-900 outline-none placeholder:truncate placeholder:text-stone-500" />
        <div className="mt-4 flex items-end gap-2 md:gap-3">
          {/* one wrapping row: "+" (12px to what follows), chips, the dropdowns 6px apart */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1.5">
            <PlusMenu opts={opts} set={set} rivals={rivals} up={docked} />
            {chips.map((c) => (
              <span key={c.key} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-tint pl-2.5 pr-1 text-[13px] leading-4 text-stone-800 motion-safe:animate-[chip-in_160ms_ease-out]">
                {c.logo}{c.label}
                <button type="button" onClick={c.clear} aria-label={`Remove ${c.label}`} className="grid h-5 w-5 place-items-center rounded-full text-stone-500 outline-none hover:bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
              </span>
            ))}
            <ChipMenu ghost label="Period" icon={Calendar} value={label(PERIODS, 'period')} width={220}>{(close) => radio(PERIODS.filter((p) => p.id !== 'custom'), 'period', close)}</ChipMenu>
            <ChipMenu ghost label="Audience" icon={UserRound} value={label(AUDIENCES, 'audience')} width={280}>{(close) => radio(AUDIENCES, 'audience', close)}</ChipMenu>
            <ChipMenu ghost label="Length" icon={AlignLeft} value={label(LENGTHS, 'length')} width={240}>{(close) => radio(LENGTHS, 'length', close)}</ChipMenu>
          </div>
          {/* send: the --send blue (40% and inactive while the box is empty); while a report is written, stop */}
          {busy && onStop ? (
            <button type="button" onClick={onStop} aria-label="Stop writing the report" title="Stop"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--send)] text-[var(--send-fg)] outline-none transition-[background-color,transform] duration-100 hover:bg-[var(--send-hover)] active:scale-[0.96] active:bg-[var(--send-active)] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
              <Square size={12} fill="currentColor" strokeWidth={0} aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={send} disabled={!canSend} aria-label="Write the report"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--send)] text-[var(--send-fg)] outline-none transition-[background-color,opacity,transform] duration-150 hover:bg-[var(--send-hover)] active:scale-[0.96] active:bg-[var(--send-active)] active:duration-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40">
              <ArrowUp size={18} strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {phase !== 'gone' && (
        <ul id="report-suggestions" role="listbox" aria-label="Suggestions" aria-hidden={phase === 'out' || undefined} className={`absolute inset-x-0 z-20 flex flex-col px-2 ${docked ? 'bottom-full mb-2 rounded-2xl border border-line bg-raised p-1.5 shadow-md' : 'top-full mt-3'} ${phase === 'out' ? 'pointer-events-none' : ''}`}>
          {list.map((s, i) => (
            <li key={s.id} id={`sugg-${s.id}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)}
              className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[15px] leading-6 font-normal ${i === active ? 'bg-tint text-stone-900' : 'text-stone-600'}`}
              style={rowStyle(i)}>
              {s.icon ? <s.icon size={18} strokeWidth={1.5} className="shrink-0" aria-hidden /> : <MiniIcon kind={s.kind} />}{s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
export default PillComposer

// "+": brand, engines, competitors — a short list; each opens its options (← goes back)
function PlusMenu({ opts, set, rivals, up = false }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(null)
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    menu.current?.querySelector('[role^=menuitem]')?.focus()
    const out = (e) => { if (!wrap.current?.contains(e.target)) { setOpen(false); setView(null) } }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open, view])
  const close = () => { setOpen(false); setView(null); btn.current?.focus() }
  const onKey = (e) => {
    const els = [...(menu.current?.querySelectorAll('[role^=menuitem]') ?? [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (view) setView(null); else close() }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && els.length) { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
  }
  const d = dataFor(opts.brand)
  const toggleEngine = (id) => {
    const next = opts.engines.includes(id) ? opts.engines.filter((e) => e !== id) : [...opts.engines, id]
    set({ engines: next.length === ENGINE_IDS.length ? [] : next })
  }
  const toggleRival = (key) => {
    const cur = opts.compare
    set({ compare: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key].slice(-MAX_COMPARE) })
  }
  const rows = [
    { id: 'brand', label: 'Brand', value: brandOf(opts.brand)?.name },
    { id: 'engines', label: 'Engines', value: opts.engines.length ? opts.engines.map((e) => ENGINE_NAMES[e]).join(', ') : 'All engines' },
    { id: 'compare', label: 'Compare with', value: opts.compare.length ? `${opts.compare.length} picked` : 'Every competitor' },
  ]
  return (
    <div ref={wrap} className="relative -ml-2 shrink-0 md:mr-1.5" onKeyDown={open ? onKey : undefined}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Brand, engines and competitors" title="Brand, engines and competitors"
        onClick={() => { setOpen((o) => !o); setView(null) }}
        className={`grid h-9 w-9 place-items-center rounded-full text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${open ? 'bg-tint text-stone-900' : ''}`}>
        <Plus size={20} strokeWidth={1.75} className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={view ? rows.find((r) => r.id === view).label : 'Options'} style={{ width: 'min(288px, calc(100vw - 32px))' }}
          className={`absolute left-0 z-40 rounded-xl border border-line bg-raised p-1 shadow-md motion-safe:animate-[fade-in_120ms_ease-out] ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {!view && rows.map((r) => (
            <button key={r.id} type="button" role="menuitem" onClick={() => setView(r.id)} className={`${menuItem} text-stone-900`}>
              <span className="min-w-0 flex-1"><span className="block font-medium">{r.label}</span><span className={`block truncate text-[12px] leading-4 ${t3}`}>{r.value}</span></span>
              <ChevronRight size={14} className="shrink-0 text-stone-500" aria-hidden />
            </button>
          ))}
          {view && (
            <>
              <button type="button" role="menuitem" onClick={() => setView(null)} className={`${menuItem} font-medium text-stone-700`}><ChevronLeft size={14} aria-hidden />{rows.find((r) => r.id === view).label}</button>
              <div className="my-1 border-t border-line" />
            </>
          )}
          {view === 'brand' && REPORT_BRANDS.map((b) => (
            <button key={b.id} type="button" role="menuitemradio" aria-checked={opts.brand === b.id} onClick={() => { set({ brand: b.id, compare: [] }); close() }} className={`${menuItem} text-stone-900`}>
              <BrandLogo id={b.id} className="h-5 w-5" /><span className="min-w-0 flex-1 truncate">{b.name}</span><Tick on={opts.brand === b.id} />
            </button>
          ))}
          {view === 'engines' && (
            <>
              <button type="button" role="menuitemcheckbox" aria-checked={!opts.engines.length} onClick={() => set({ engines: [] })} className={`${menuItem} text-stone-900`}><Box on={!opts.engines.length} /><span className="flex-1">All engines</span></button>
              {ENGINE_IDS.map((e) => (
                <button key={e} type="button" role="menuitemcheckbox" aria-checked={opts.engines.includes(e)} onClick={() => toggleEngine(e)} className={`${menuItem} text-stone-900`}>
                  <Box on={opts.engines.includes(e)} /><EngineMark id={e} size={14} /><span className="flex-1">{ENGINE_NAMES[e]}</span>
                  {d && !d.ran.includes(e) && <span className={`text-[12px] ${t3}`}>No data</span>}
                </button>
              ))}
            </>
          )}
          {view === 'compare' && (
            <>
              <div className={menuLabel}>Up to {MAX_COMPARE}. None picked: every tracked competitor</div>
              {rivals.length === 0 && <p className={`px-2 py-2 text-[13px] ${t3}`}>No competitors tracked for this brand yet</p>}
              {rivals.map((r) => {
                const on = opts.compare.includes(r.key)
                return (
                  <button key={r.key} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggleRival(r.key)} className={`${menuItem} ${on ? 'font-medium text-stone-900' : 'text-stone-700'}`}>
                    <Box on={on} /><SiteLogo domain={r.domain} name={r.name} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// a tiny line drawing of each report's hero, for the suggestions: one set, an 18px box, 1.5px strokes, optically centred
function MiniIcon({ kind }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" className="shrink-0" aria-hidden>
      {kind === 'weekly' && <><path d="M3 4v10M15 4v10" {...p} /><path d="M3 6.5h12M3 11.5c5 0 7-3.5 12-3.5" {...p} /></>}
      {kind === 'ceo' && <><path d="M3 12.5 15 5" {...p} /><path d="M3 8l12 2.5" {...p} /><circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" /></>}
      {kind === 'rival' && <><rect x="3" y="3" width="5" height="5" rx="1.25" {...p} /><rect x="10" y="3" width="5" height="5" rx="1.25" {...p} /><rect x="3" y="10" width="5" height="5" rx="1.25" {...p} /><rect x="10" y="10" width="5" height="5" rx="1.25" {...p} /></>}
      {kind === 'content' && <><circle cx="6.5" cy="10.5" r="2.5" {...p} /><circle cx="11.5" cy="6.5" r="3" {...p} /><path d="M3 15h12" {...p} /></>}
    </svg>
  )
}
