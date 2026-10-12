import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import Sheet, { SheetItem } from './Sheet'

// Phones / tablets (below lg): a page's secondary actions (Export, Share, API…) behind a ⋯ button → bottom sheet.
//   items: [{ label, icon?, onClick }]
export default function MobileActions({ items, label = 'More actions', className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} aria-haspopup="dialog"
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-stone-700 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus lg:hidden ${className}`}>
        <MoreHorizontal size={18} aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        {items.map((it) => <SheetItem key={it.label} icon={it.icon} onClick={it.onClick}>{it.label}</SheetItem>)}
      </Sheet>
    </>
  )
}

// ask a page-level PromptTable (by id) to download its CSV (the page's ⋯ menu on phones)
export const EXPORT_EVENT = 'prompt-table:export'
export const exportTable = (id) => window.dispatchEvent(new CustomEvent(EXPORT_EVENT, { detail: { id } }))
