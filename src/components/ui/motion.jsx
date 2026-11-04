// Shared motion pieces, extracted from Sentiment (pages/insights/SentimentPage.jsx) unchanged so other pages move the
// same way: the segmented toggle with its sliding pill (Seg), a number that counts to its value (useCountUp), a
// crossfade between two renders (CrossFade) and an element's width (useWidth). Sentiment imports them from here.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const GLIDE = 'cubic-bezier(.2,.8,.2,1)'
// Segmented's look and keys, with the white pill sliding to the picked option (transform + width, 220ms)
export function Seg({ label, value, onChange, options, size = 'md', className = '', full = false, progress = null }) {
  const refs = useRef([])
  const box = useRef(null)
  const ready = useRef(false)
  const [pill, setPill] = useState(null)
  const idx = options.findIndex((o) => o.value === value)
  useLayoutEffect(() => {
    const measure = () => { const el = refs.current[idx]; if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth }) }
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    const t = requestAnimationFrame(() => { ready.current = true })
    return () => { ro.disconnect(); cancelAnimationFrame(t) }
  }, [idx, options.map((o) => o.label).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (idx + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  const glide = ready.current && !reduced() ? `transform 220ms ${GLIDE}, width 220ms ${GLIDE}` : 'none'
  return (
    <div ref={box} role="radiogroup" aria-label={label} onKeyDown={onKey} className={`relative ${full ? 'flex w-full' : 'inline-flex'} ${size === 'sm' ? 'h-8' : 'h-9'} shrink-0 items-center rounded-lg bg-tint p-1 ${className}`}>
      {pill && (
        <span aria-hidden className="absolute bottom-1 left-0 top-1 rounded-md bg-raised shadow-sm" style={{ transform: `translateX(${pill.x}px)`, width: pill.w, transition: glide }}>
          {/* a 2px line under the active option that fills while an automatic switch counts down (Over time) */}
          {progress && <span className="absolute inset-x-2 bottom-0 h-[2px] overflow-hidden rounded-full">{progress}</span>}
        </span>
      )}
      {options.map((o, i) => {
        const on = i === idx
        return (
          <button key={o.value} ref={(el) => (refs.current[i] = el)} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.value)}
            className={`relative inline-flex ${size === 'sm' ? 'h-6' : 'h-7'} ${full ? 'flex-1' : ''} items-center justify-center whitespace-nowrap rounded-md px-3 text-small font-medium outline-none transition-colors duration-150 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-ink' : 'text-stone-600 hover:text-stone-900'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// a number that counts to its new value (300ms); reduced motion: it changes at once. start (a number) counts in
// from it on the first render (the hero's score and its change, on load)
export function useCountUp(value, dur = 300, start = undefined) {
  const first = start !== undefined && value != null && typeof window !== 'undefined' && !reduced()
  const [shown, setShown] = useState(first ? start : value)
  const from = useRef(first ? start : value)
  useEffect(() => {
    const a = from.current
    if (value == null || a == null || a === value || reduced()) { from.current = value; setShown(value); return undefined }
    const t0 = performance.now()
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const v = Math.round(a + (value - a) * (1 - (1 - k) ** 3))
      from.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, dur])
  return shown
}

export function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}


export function CrossFade({ k, children, ms = 150 }) { // ms: the fade (Sentiment: 150)
  // items: the outgoing view (a snapshot of its last children) and the current key; the current one always renders the
  // live children, so a parent that re-renders often (a ticking clock) doesn't hold the outgoing view on screen. Only a
  // change of k schedules the cleanup.
  const [items, setItems] = useState([{ k }])
  const prev = useRef(children) // the children of the last commit
  const shown = items.at(-1).k === k ? items : [{ k: items.at(-1).k, node: prev.current }, { k }]
  useEffect(() => {
    setItems((xs) => (xs.at(-1).k === k ? xs : [{ k: xs.at(-1).k, node: prev.current }, { k }]))
    const t = setTimeout(() => setItems((xs) => xs.slice(-1)), ms + 10)
    return () => clearTimeout(t)
  }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prev.current = children })
  const still = typeof window !== 'undefined' && reduced()
  return (
    <div className="grid">
      {shown.map((it, i) => (
        <div key={it.k} style={{ gridArea: '1 / 1', animation: still || shown.length < 2 ? undefined : `${i === shown.length - 1 ? 'fade-in' : 'sent-fade-out'} ${ms}ms ease-out both` }} aria-hidden={i < shown.length - 1 || undefined}>{it.k === k ? children : it.node}</div>
      ))}
    </div>
  )
}
