import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, AlignLeft, Calendar, Check, Cpu, UserRound, Users } from 'lucide-react'
import SiteLogo from '../../components/ui/SiteLogo'
import { EngineMark } from '../insights/parts'
import { AUDIENCES, ENGINE_IDS, ENGINE_NAMES, LENGTHS, MAX_COMPARE, PERIODS, REPORT_BRANDS, dataFor, inferOpts, rivalsOf } from '../../data/reports'
import { BrandLogo, ChipMenu, menuItem, menuLabel, t3 } from './parts'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const Tick = ({ on }) => <Check size={14} className={on ? 'shrink-0 text-ink' : 'invisible shrink-0'} aria-hidden />
const Box = ({ on }) => (
  <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${on ? 'bg-ink' : ''}`} style={on ? undefined : { boxShadow: 'inset 0 0 0 1.5px var(--color-stone-500)' }}>
    {on && <Check size={12} strokeWidth={3} style={{ color: 'var(--line-check)' }} />}
  </span>
)

// The composer: a large multi-line box (⌘↵ sends), and the option chips under it. A chip you set shows its value; one
// the question implies (but you haven't set) shows it dashed, "from your question". compact: the report page's top.
export default function Composer({ prompt, setPrompt, opts, setOpts, onSend, compact = false, autoFocus = false, busy = false }) {
  const area = useRef(null)
  const [swapNote, setSwapNote] = useState('')
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(compact ? 120 : 240, Math.max(compact ? 24 : 84, el.scrollHeight))}px`
  }, [prompt, compact])
  const d = dataFor(opts.brand)
  const inf = inferOpts(prompt, d)
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }))
  const canSend = prompt.trim().length > 0 && !busy
  const send = () => { if (canSend) onSend() }
  const rivals = rivalsOf(opts.brand)

  // a chip's value: what you set, else what the question implies (dashed), else nothing (it shows its label)
  const shown = (k, render) => {
    const v = opts[k]
    if (v != null && (!Array.isArray(v) || v.length)) return { value: render(v), inferred: false }
    const i = inf[k]
    if (i != null && (!Array.isArray(i) || i.length)) return { value: render(i), inferred: true }
    return { value: null, inferred: false }
  }
  const period = shown('period', (v) => (v === 'custom' && opts.from && opts.to ? `${opts.from} – ${opts.to}` : PERIODS.find((p) => p.id === v)?.label))
  const engines = shown('engines', (v) => (v.length === 1 ? ENGINE_NAMES[v[0]] : `${v.length} engines`))
  const compare = shown('compare', (v) => (v.length === 1 ? rivals.find((r) => r.key === v[0])?.name : `${v.length} competitors`))
  const audience = shown('audience', (v) => AUDIENCES.find((a) => a.id === v)?.label)
  const length = shown('length', (v) => LENGTHS.find((l) => l.id === v)?.label)
  const brand = REPORT_BRANDS.find((b) => b.id === opts.brand)

  const toggleCompare = (key) => {
    const cur = opts.compare
    if (cur.includes(key)) { set({ compare: cur.filter((k) => k !== key) }); setSwapNote(''); return }
    if (cur.length < MAX_COMPARE) { set({ compare: [...cur, key] }); setSwapNote(''); return }
    const out = cur[cur.length - 1]
    set({ compare: [...cur.slice(0, -1), key] })
    setSwapNote(`Up to ${MAX_COMPARE} at a time: ${rivals.find((r) => r.key === key)?.name} replaced ${rivals.find((r) => r.key === out)?.name}.`)
  }
  const toggleEngine = (id) => {
    const next = opts.engines.includes(id) ? opts.engines.filter((e) => e !== id) : [...opts.engines, id]
    set({ engines: next.length === ENGINE_IDS.length ? [] : next })
  }

  return (
    <div className={`rounded-2xl border border-line bg-surface transition-shadow duration-150 focus-within:border-line-strong focus-within:shadow-[0_0_0_4px_var(--tint)] ${compact ? 'p-3' : 'p-4 max-md:p-3'}`}>
      <label className="sr-only" htmlFor="report-q">What do you want to know?</label>
      <textarea id="report-q" ref={area} value={prompt} autoFocus={autoFocus} rows={compact ? 1 : 3}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
        placeholder="What do you want to know?"
        className={`block w-full resize-none bg-transparent px-1 text-stone-900 outline-none placeholder:text-stone-500 ${compact ? 'text-[15px] leading-6' : 'text-[17px] leading-7 max-md:text-[16px]'}`} />
      <div className={`flex items-end gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ChipMenu label="Brand" value={brand?.name} logo={<BrandLogo id={opts.brand} />} width={260}>
            {(close) => (
              <>
                <div className={menuLabel}>Brand</div>
                {REPORT_BRANDS.map((b) => (
                  <button key={b.id} type="button" role="menuitemradio" aria-checked={opts.brand === b.id} onClick={() => { set({ brand: b.id, compare: [] }); close() }} className={`${menuItem} text-stone-900`}>
                    <BrandLogo id={b.id} className="h-5 w-5" /><span className="min-w-0 flex-1 truncate">{b.name}</span><Tick on={opts.brand === b.id} />
                  </button>
                ))}
              </>
            )}
          </ChipMenu>
          <ChipMenu label="Period" icon={Calendar} {...period} width={240}>
            {(close) => (
              <>
                {PERIODS.map((p) => (
                  <button key={p.id} type="button" role="menuitemradio" aria-checked={opts.period === p.id}
                    onClick={() => { set({ period: p.id }); if (p.id !== 'custom') close() }} className={`${menuItem} text-stone-900`}>
                    <span className="flex-1">{p.label}</span><Tick on={opts.period === p.id} />
                  </button>
                ))}
                {opts.period === 'custom' && (
                  <div className="mx-1 mt-1 grid grid-cols-2 gap-2 border-t border-line px-1 pb-1 pt-2">
                    <label className="text-[12px] text-stone-600">From<input type="date" value={opts.from ?? '2026-09-28'} onChange={(e) => set({ from: e.target.value })} className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-stone-900 outline-none focus:border-stone-400" /></label>
                    <label className="text-[12px] text-stone-600">To<input type="date" value={opts.to ?? '2026-10-26'} onChange={(e) => set({ to: e.target.value })} className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-stone-900 outline-none focus:border-stone-400" /></label>
                  </div>
                )}
              </>
            )}
          </ChipMenu>
          <ChipMenu label="Engines" icon={Cpu} {...engines} width={240}>
            {() => (
              <>
                <button type="button" role="menuitemcheckbox" aria-checked={!opts.engines.length} onClick={() => set({ engines: [] })} className={`${menuItem} text-stone-900`}>
                  <Box on={!opts.engines.length} /><span className="flex-1">All engines</span>
                </button>
                <div className="mx-2 my-1 h-px bg-[var(--div)]" aria-hidden />
                {ENGINE_IDS.map((e) => {
                  const on = opts.engines.includes(e)
                  return (
                    <button key={e} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggleEngine(e)} className={`${menuItem} text-stone-900`}>
                      <Box on={on} /><EngineMark id={e} size={14} /><span className="flex-1">{ENGINE_NAMES[e]}</span>
                      {d && !d.ran.includes(e) && <span className={`text-[12px] ${t3}`}>No data</span>}
                    </button>
                  )
                })}
              </>
            )}
          </ChipMenu>
          <ChipMenu label="Compare with" icon={Users} {...compare} width={280}>
            {() => (
              <>
                <div className={menuLabel}>Up to {MAX_COMPARE}. None picked: every tracked competitor</div>
                {rivals.length === 0 && <p className={`px-2 py-2 text-[13px] ${t3}`}>No competitors tracked for this brand yet</p>}
                {rivals.map((r) => {
                  const on = opts.compare.includes(r.key)
                  return (
                    <button key={r.key} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggleCompare(r.key)} className={`${menuItem} ${on ? 'font-medium text-stone-900' : 'text-stone-700'}`}>
                      <Box on={on} /><SiteLogo domain={r.domain} name={r.name} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    </button>
                  )
                })}
                <div aria-live="polite" className={swapNote ? 'mx-1 mt-1 border-t border-line px-1 pb-1 pt-2 text-[12px] leading-4 text-stone-600' : 'sr-only'}>{swapNote}</div>
              </>
            )}
          </ChipMenu>
          <ChipMenu label="Audience" icon={UserRound} {...audience} width={280}>
            {(close) => AUDIENCES.map((a) => (
              <button key={a.id} type="button" role="menuitemradio" aria-checked={opts.audience === a.id} onClick={() => { set({ audience: a.id }); close() }} className={`${menuItem} items-start text-stone-900`}>
                <span className="min-w-0 flex-1"><span className="block font-medium">{a.label}</span><span className={`block text-[12px] leading-4 ${t3}`}>{a.hint}</span></span><Tick on={opts.audience === a.id} />
              </button>
            ))}
          </ChipMenu>
          <ChipMenu label="Length" icon={AlignLeft} {...length} width={240}>
            {(close) => LENGTHS.map((l) => (
              <button key={l.id} type="button" role="menuitemradio" aria-checked={opts.length === l.id} onClick={() => { set({ length: l.id }); close() }} className={`${menuItem} items-start text-stone-900`}>
                <span className="min-w-0 flex-1"><span className="block font-medium">{l.label}</span><span className={`block text-[12px] leading-4 ${t3}`}>{l.hint}</span></span><Tick on={opts.length === l.id} />
              </button>
            ))}
          </ChipMenu>
        </div>
        <span className={`hidden pb-2 text-[12px] ${t3} md:inline`}>{isMac ? '⌘' : 'Ctrl'} ↵</span>
        <button type="button" onClick={send} disabled={!canSend} aria-label="Write the report"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-on-ink outline-none transition-[background-color,opacity] duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-30">
          <ArrowUp size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  )
}
