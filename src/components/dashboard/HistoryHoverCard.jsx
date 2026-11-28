import SiteLogo from '../ui/SiteLogo'

// The chart hover card (as the app's ui/ChartHoverCard, #216 / #223): one dark card for the line charts, the same in
// light and dark (the --hc-* tokens at the end of index.css, the dark tip's). A period title, then one row per brand,
// highest first: a short dash in the line's colour, the logo, the name, the value, and the change when there is one
// (↑n / ↓n; no value: "—"). While a brand is focused its row is white and the rest stay muted.
//   title    "Week of Oct 26 · synced Wed Oct 28"
//   rows     [{ key, color, ink?: the line is ink (drawn as a light outline here: ink would vanish on the card),
//               domain?, name, value: text, change?: number | null, focus?: bool, text?: node in place of the value }]
//   notes    small lines under the rows (why a brand has one point, engines that didn't run)
//   footer   { label, value } a last line ("vs last week  ↑2")
// It fades in over 120ms (none with reduced motion); the chart moves it with the pointer.
export const fmtChange = (d) => (d == null ? '—' : d > 0 ? `↑${d}` : d < 0 ? `↓${Math.abs(d)}` : '0')
const changeTone = (d) => (d == null || d === 0 ? 'text-[var(--hc-muted)]' : d > 0 ? 'text-[var(--hc-up)]' : 'text-[var(--hc-down)]')

export default function HistoryHoverCard({ title, rows = [], notes = [], footer = null, onFocusRow }) {
  const anyFocus = rows.some((r) => r.focus)
  const anyChange = rows.some((r) => r.change !== undefined)
  return (
    <div data-history-hover className="tip-dark !max-w-[360px] !px-3.5 !py-3 text-[13px] leading-[18px] motion-safe:animate-[fade-in_120ms_ease-out]">
      {title && <div className="mb-2 whitespace-nowrap font-medium text-[var(--hc-ink)] tabular-nums">{title}</div>}
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const lit = !anyFocus || r.focus
          return (
            <div key={r.key} className="flex items-center gap-2.5" onMouseEnter={() => onFocusRow?.(r.key)} onMouseLeave={() => onFocusRow?.(null)}>
              {/* the line's colour as a short dash; an ink line as a light outline */}
              <span aria-hidden className="h-[5px] w-3 shrink-0 rounded-full" style={r.ink ? { boxShadow: 'inset 0 0 0 1.5px var(--hc-ink)' } : { background: r.color }} />
              {r.domain && <SiteLogo domain={r.domain} name={r.name} className="h-5 w-5 shrink-0 rounded" initialClass="text-[10px]" />}
              <span className={`min-w-0 flex-1 truncate ${anyFocus ? (r.focus ? 'font-semibold text-[var(--hc-ink)]' : 'text-[var(--hc-muted)]') : r.lead ? 'font-semibold text-[var(--hc-ink)]' : 'text-[var(--hc-muted)]'}`}>{r.name}</span>
              <span className={`shrink-0 pl-4 text-right font-semibold tabular-nums ${lit ? 'text-[var(--hc-ink)]' : 'text-[var(--hc-muted)]'}`}>{r.text ?? r.value}</span>
              {anyChange && <span className={`w-8 shrink-0 text-right font-medium tabular-nums ${changeTone(r.change)}`}>{fmtChange(r.change ?? null)}</span>}
            </div>
          )
        })}
      </div>
      {notes.map((n, i) => <div key={i} className="mt-2 max-w-[260px] border-t border-[var(--hc-line)] pt-2 font-normal text-[var(--hc-muted)]">{n}</div>)}
      {footer && (
        <div className="mt-2 flex items-center justify-between gap-6 border-t border-[var(--hc-line)] pt-2 text-[var(--hc-muted)]">
          <span>{footer.label}</span>
          <span className={`font-semibold tabular-nums ${changeTone(footer.change)}`}>{fmtChange(footer.change)}</span>
        </div>
      )}
    </div>
  )
}
