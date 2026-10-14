import { useLayoutEffect, useRef } from 'react'
import { ArrowRight, Check } from 'lucide-react'

// The numbered "What to do next" plan, shared by /structured-data and /audit.
// Each step: a numbered circle that doubles as the mark-done checkbox (hover shows the check), a plain-English action,
// a meta line (chip · facts), and Impact / Effort / "Open fix" on the right. Done steps sink to the end (FLIP slide).
//   steps: [{ id, n, title, chip, chipMono?, meta: [node…], impact: 'high'|'medium'|'low', effort: 'min label' }]
//   done: Set<id> · onToggle(step) · onOpen(step)
//   impactTone: 'weighted' (high = ink/semibold, as on /structured-data) | 'plain' (t2 text, /audit's status system)
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const IMPACT_WORD = { high: 'High', medium: 'Medium', low: 'Low' }

export default function ActionSteps({ steps, done, onToggle, onOpen, impactTone = 'weighted' }) {
  const listRef = useRef(null)
  const before = useRef(null) // row positions before a reorder

  const ordered = [...steps.filter((s) => !done.has(s.id)), ...steps.filter((s) => done.has(s.id))]

  // the rows below a newly done step slide up into place
  useLayoutEffect(() => {
    if (!before.current || !listRef.current) return
    const prev = before.current
    before.current = null
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    listRef.current.querySelectorAll('[data-step]').forEach((el) => {
      const was = prev.get(el.dataset.step)
      const now = el.getBoundingClientRect().top
      if (was == null || was === now) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${was - now}px)`
      requestAnimationFrame(() => { el.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)'; el.style.transform = '' })
    })
  })
  const toggle = (s) => {
    before.current = new Map([...listRef.current.querySelectorAll('[data-step]')].map((el) => [el.dataset.step, el.getBoundingClientRect().top]))
    onToggle(s)
  }

  return (
    <ol ref={listRef} className="mt-3 flex flex-col">
      {ordered.map((s, i) => {
        const isDone = done.has(s.id)
        const circle = s.impact === 'high' ? 'bg-ink text-[var(--color-surface)]' : s.impact === 'medium' ? 'border border-ink text-ink' : 'border border-line text-stone-500'
        const impactCls = impactTone === 'plain' ? t2
          : s.impact === 'high' ? 'font-semibold text-ink' : s.impact === 'medium' ? `font-semibold ${t2}` : `font-semibold ${t3}`
        const word = IMPACT_WORD[s.impact]
        return (
          <li key={s.id} data-step={s.id} className={`relative transition-opacity duration-200 ${isDone ? 'opacity-50' : ''}`}>
            {/* the thread between the step circles */}
            {i < ordered.length - 1 && <span className="pointer-events-none absolute left-[25.5px] top-[calc(50%+14px)] h-[calc(100%-28px)] w-px bg-[var(--div)] max-md:left-[13.5px]" aria-hidden />}
            <div role="button" tabIndex={0} onClick={() => onOpen(s)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(s) }}
              aria-label={`Step ${s.n}: ${s.title}. ${word} impact, ${s.effort}. Open fix`}
              className="group/step -mx-3 grid min-h-16 cursor-pointer grid-cols-[28px_minmax(0,1fr)] items-center gap-4 rounded-lg px-3 py-2 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus max-md:mx-0 max-md:px-0 md:grid-cols-[28px_minmax(0,1fr)_auto]">
              {/* the number; hover shows it's a checkbox */}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(s) }} aria-pressed={isDone} aria-label={isDone ? `Mark step ${s.n} not done` : `Mark step ${s.n} done`}
                className={`group/num relative grid h-7 w-7 place-items-center rounded-full text-[13px] leading-none font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus ${isDone ? 'bg-ink text-[var(--color-surface)]' : circle}`}>
                <span className={`transition-opacity duration-150 ${isDone ? 'opacity-0' : 'group-hover/num:opacity-0'}`}>{s.n}</span>
                <Check size={14} strokeWidth={2.5} className={`absolute transition-opacity duration-150 ${isDone ? 'opacity-100' : 'opacity-0 group-hover/num:opacity-100'}`} aria-hidden />
              </button>
              <div className="min-w-0">
                <div className={`truncate text-[14px] leading-5 font-medium ${isDone ? `line-through ${t3}` : 'text-stone-900'}`} title={s.title}>{s.title}</div>
                <div className={`mt-1 flex min-w-0 items-center gap-2 text-[13px] leading-[18px] ${t3}`}>
                  {s.chipMono
                    ? <code className="inline-flex h-5 shrink-0 items-center rounded bg-tint px-1.5 font-mono text-[12px] text-stone-700">{s.chip}</code>
                    : <span className={`inline-flex h-5 shrink-0 items-center rounded bg-tint px-1.5 text-[12px] font-medium ${t2}`}>{s.chip}</span>}
                  {s.meta.map((m, k) => <MetaBit key={k}>{m}</MetaBit>)}
                </div>
                {/* phones: the right cluster as one meta line */}
                <div className={`mt-0.5 text-[13px] leading-[18px] ${t2} md:hidden tabular-nums`}>
                  <span className={impactTone !== 'plain' && s.impact === 'high' ? 'font-medium text-ink' : ''}>{word} impact</span> · {s.effort}
                </div>
              </div>
              <div className="hidden items-center gap-6 md:flex">
                <div className="w-20">
                  <div className={`text-[11px] leading-4 font-medium ${t3}`}>Impact</div>
                  <div className={`text-[13px] leading-[18px] ${impactCls}`}>{word}</div>
                </div>
                <div className="w-20">
                  <div className={`text-[11px] leading-4 font-medium ${t3}`}>Effort</div>
                  <div className={`text-[13px] leading-[18px] ${t2} tabular-nums`}>{s.effort}</div>
                </div>
                <div className="flex w-24 justify-end">
                  <span className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-0 text-[13px] leading-[18px] font-medium text-ink transition-[background-color,color,padding] duration-150 group-hover/step:bg-ink group-hover/step:px-3 group-hover/step:text-on-ink">
                    Open fix <ArrowRight size={14} aria-hidden />
                  </span>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// one "· fact" in the meta line; a fact can carry its own class via [text, className]
function MetaBit({ children }) {
  const [text, cls] = Array.isArray(children) ? children : [children, '']
  return <><span aria-hidden>·</span><span className={`truncate tabular-nums ${cls}`}>{text}</span></>
}

export const fmtMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`)
