import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { brandName, isDomain } from '../../utils/brand'
import { isValidDomain, normalizeDomain } from '../../utils/domain'

// A domain is stored normalised ("cerave.com"); anything else is kept as typed ("Derma Suri").
export const toEntry = (raw) => {
  const t = String(raw).trim().replace(/\s+/g, ' ')
  const d = normalizeDomain(t)
  return /\s/.test(t) || !isValidDomain(d) ? t : d
}
const label = (v) => (isDomain(v) ? brandName(v) : v)
const same = (a, b) => label(a).toLowerCase() === label(b).toLowerCase() // "The Ordinary" ≡ "theordinary.com"

// One bordered field holding chips + a trailing input.
// Enter / comma / paste-multiple add; Backspace on an empty input removes the last chip;
// a duplicate is ignored and the chip it matches shakes. At `max` the input hides.
export default function ChipField({ id, value, onChange, max = 5, placeholder, reject, onBlur, ariaLabel, ariaDescribedBy }) {
  const [draft, setDraft] = useState('')
  const [shake, setShake] = useState(null) // index of the chip to shake
  const input = useRef(null)
  const full = value.length >= max

  const add = (raws) => {
    const next = [...value]
    for (const raw of raws) {
      if (next.length >= max) break
      const v = toEntry(raw)
      if (!v) continue
      if (reject?.(v)) continue
      const dup = next.findIndex((x) => same(x, v))
      if (dup !== -1) {
        // replay the shake even if it's the same chip twice in a row
        setShake(null); requestAnimationFrame(() => setShake(dup))
        continue
      }
      next.push(v)
    }
    if (next.length !== value.length) onChange(next)
    setDraft('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault() // Enter must not submit the form while typing a chip
      if (draft.trim()) add([draft])
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  const onPaste = (e) => {
    const text = e.clipboardData.getData('text')
    if (!/[,\n;\t]/.test(text)) return
    e.preventDefault()
    add(text.split(/[,\n;\t]+/))
  }

  return (
    <div
      onClick={() => input.current?.focus()}
      className="flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-line bg-raised p-1.5 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus-within:ring-[3px] focus-within:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
    >
      {value.map((v, i) => (
        <span
          key={v}
          onAnimationEnd={() => setShake(null)}
          className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line bg-surface pl-1 pr-1 ${shake === i ? 'chip-shake' : ''}`}
        >
          <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded bg-tint text-[11px] font-semibold text-stone-600">{label(v)[0]?.toUpperCase()}</span>
          <span className="truncate text-[13px] leading-[18px] font-medium text-stone-900">{label(v)}</span>
          {isDomain(v) && <span className="hidden truncate text-[12px] leading-4 text-stone-500 sm:inline">{v}</span>}
          <button
            type="button"
            aria-label={`Remove ${label(v)}`}
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); input.current?.focus() }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-stone-500 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      {!full && (
        <input
          ref={input}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          value={draft}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value.replace(/,/g, ''))}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => { if (draft.trim()) add([draft]); onBlur?.() }}
          className="h-7 min-w-[140px] flex-1 bg-transparent px-1.5 text-[14px] text-stone-900 outline-none placeholder:text-stone-500"
        />
      )}
    </div>
  )
}
