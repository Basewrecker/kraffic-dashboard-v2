// The Content list's Status column (owner, 2026-11-04, round 5): ONE line per cell, 14px, a 14px icon then the label,
// left-aligned in a fixed 180px column so the icons line up. Quiet: muted or ink; the only colour is Improved's green.
// The per-engine detail lives in the row's hover tooltip (RowTip). "Create content" uses PenLine (no sparkles).
import { FileText, Minus, PenLine } from 'lucide-react'
import { Ring } from '../parts'
import { statusText } from './model'

export const STATUS_WIDTH = 180

function Line({ icon, children, className = 'text-stone-900' }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 whitespace-nowrap text-[14px] leading-5 ${className}`}>
      <span className="grid h-3.5 w-3.5 shrink-0 place-items-center" aria-hidden>{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  )
}

export default function StatusCell({ row, onOpen }) {
  const d = row.draft
  switch (row.stage) {
    case 'draft':
      return <Line icon={<FileText size={14} />}>Draft ready</Line>
    case 'waiting':
      return <Line icon={<span className="status-pulse h-1.5 w-1.5 rounded-full bg-ink" />}>Waiting to publish</Line>
    case 'monitoring':
      return <Line icon={<Ring value={d.week} total={4} size={14} stroke={2.5} />}>Week {d.week} of 4</Line>
    case 'nochange':
      return <Line icon={<Minus size={14} />} className="text-stone-500">No change yet</Line>
    case 'improved':
      return <Line icon={<span className="text-[12px] leading-none">▲</span>} className="font-semibold text-[var(--co-improved)]">Improved</Line>
    default:
      // muted; ink and underlined while its row is hovered (PromptTable rows are `group`)
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row) }} aria-label={statusText(row)}
          className="rounded text-stone-500 outline-none transition-colors duration-150 group-hover:text-ink focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          <Line icon={<PenLine size={14} strokeWidth={1.5} />} className="underline-offset-4 group-hover:underline">Create content</Line>
        </button>
      )
  }
}
