import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import Modal from '../ui/Modal'
import Segmented from '../dashboard/Segmented'
import { PrimaryButton, SecondaryButton } from '../dashboard/overlays'
import ConfirmPopover from './ConfirmPopover'
import { getResearch, researchMeta } from '../../data/research'
import { promptActions } from '../../data/mock'

const SOURCE = { site: 'From your site', competitor: 'From competitors' }
const SKELETON_MS = 1200
const Spinner = (props) => <Loader2 {...props} className="animate-spin motion-reduce:animate-none" />
const stamp = () => {
  const d = new Date()
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toTimeString().slice(0, 5)}`
}
const textBtn = 'rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'

function Checkbox({ checked, indeterminate = false, disabled, onChange, label }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(el) => { if (el) el.indeterminate = indeterminate }}
      onChange={onChange}
      className="size-4 shrink-0 cursor-pointer accent-ink disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}

// trackedTexts: lowercase prompt texts already in the table, so "Already tracking" stays true after adds.
// topic: opened from Setup's "Run research" for a new product/topic → its prompts are added and the list starts filtered to it.
export default function ResearchModal({ open, onClose, trackedTexts, onAdd, topic = null }) {
  const [run, setRun] = useState({ round: 0, extraPages: 0, updated: researchMeta.updated, pagesFound: researchMeta.pagesFound, pagesAnalyzed: researchMeta.pagesAnalyzed })
  const [loading, setLoading] = useState(null) // 'check' | 'rerun' | null
  const [tab, setTab] = useState('all')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [confirmAnchor, setConfirmAnchor] = useState(null)

  const suggestions = useMemo(
    () => getResearch({ ...run, topic }).map((s) => ({ ...s, status: trackedTexts.has(s.text.toLowerCase()) ? 'tracking' : 'new' })),
    [run, trackedTexts, topic],
  )
  const newOnes = suggestions.filter((s) => s.status === 'new')
  const counts = { all: suggestions.length, new: newOnes.length, tracking: suggestions.length - newOnes.length }
  const categories = [...new Set(suggestions.map((s) => s.category))]

  // every new suggestion starts selected (on open, and whenever the results change)
  useEffect(() => {
    if (open) setSelected(new Set(newOnes.map((s) => s.id)))
  }, [open, suggestions]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setTab('all'); setCategory('all'); setQuery(topic ?? '') } }, [open, topic])

  const shown = suggestions.filter((s) =>
    (tab === 'all' || s.status === tab) &&
    (category === 'all' || s.category === category) &&
    (!query.trim() || s.text.toLowerCase().includes(query.trim().toLowerCase())))
  const groups = categories.map((c) => [c, shown.filter((s) => s.category === c)]).filter(([, items]) => items.length)
  const selectedCount = newOnes.filter((s) => selected.has(s.id)).length

  const toggle = (ids, on) => setSelected((sel) => {
    const next = new Set(sel)
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
    return next
  })

  // the loading skeleton shows at least SKELETON_MS; a re-run waits for the new research before the list updates
  const [runError, setRunError] = useState(null)
  const refresh = (kind) => {
    setLoading(kind)
    setRunError(null)
    const work = kind === 'rerun' ? promptActions.onRerunResearch() : Promise.resolve()
    Promise.all([work, new Promise((r) => setTimeout(r, SKELETON_MS))])
      .then(() => setRun((r) => kind === 'check'
        ? { ...r, extraPages: r.extraPages + 1, pagesFound: r.pagesFound + 3, pagesAnalyzed: r.pagesAnalyzed + 3, updated: stamp() }
        : { ...r, round: r.round + 1, extraPages: 0, updated: stamp() }))
      .catch((err) => setRunError(err?.message || 'Research couldn’t run. Try again.'))
      .finally(() => setLoading(null))
  }

  const toolbar = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Suggestions"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: `All ${counts.all}` },
            { value: 'new', label: `New ${counts.new}` },
            // "Already tracking" doesn't fit a 390px screen next to the other two
            { value: 'tracking', label: <><span className="hidden sm:inline">Already tracking</span><span className="sm:hidden">Tracking</span>{`\u00a0${counts.tracking}`}</> }, // nbsp: flex drops a plain leading space
          ]}
        />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-lg border border-line bg-raised px-2 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <span className="sr-only">Search suggestions</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-8 w-full rounded-lg border border-line bg-raised pl-8 sm:w-48 pr-2.5 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px] leading-[18px]">
        <span className="tabular-nums">
          <span className="font-medium text-stone-900">{selectedCount} selected</span>
          <span className="text-stone-600"> of {counts.new} new</span>
        </span>
        <span className="flex items-center gap-3">
          <button type="button" className={textBtn} disabled={loading} onClick={() => toggle(shown.filter((s) => s.status === 'new').map((s) => s.id), true)}>Select all</button>
          <button type="button" className={textBtn} disabled={loading} onClick={() => setSelected(new Set())}>Clear</button>
        </span>
      </div>
    </>
  )

  const footer = (
    <>
      <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        Close
      </button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {runError && <span role="alert" className="text-[13px] leading-[18px] text-negative">{runError}</span>}
        {promptActions.canCheckNewPages && (
          <SecondaryButton size="sm" icon={loading === 'check' ? Spinner : undefined} disabled={Boolean(loading)} onClick={() => refresh('check')}>
            Check for new pages
          </SecondaryButton>
        )}
        {promptActions.canRerunResearch && <SecondaryButton size="sm" icon={loading === 'rerun' ? Spinner : undefined} disabled={Boolean(loading)} onClick={(e) => setConfirmAnchor(e.currentTarget)}>
          Re-run research
        </SecondaryButton>}
        <PrimaryButton size="sm" disabled={!selectedCount || Boolean(loading)} onClick={() => onAdd(newOnes.filter((s) => selected.has(s.id)))}>
          Add {selectedCount} prompt{selectedCount === 1 ? '' : 's'}
        </PrimaryButton>
      </div>
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Prompt research"
      subtitle={`${researchMeta.domain} · ${counts.all} suggestions · updated ${run.updated}`}
      meta={`Based on ${run.pagesFound} pages (${run.pagesAnalyzed} analyzed) and competitors ${researchMeta.competitors.join(', ')}`}
      toolbar={toolbar}
      footer={footer}
    >
      {loading ? (
        <div aria-busy="true" aria-label="Loading suggestions" className="pt-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-10 items-center gap-3 px-2">
              <span className="shimmer size-4 rounded" />
              <span className="shimmer h-3 rounded" style={{ width: `${48 + ((i * 17) % 30)}%` }} />
              <span className="shimmer ml-auto h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-small text-stone-600">No suggestions match these filters</p>
      ) : (
        groups.map(([cat, items]) => {
          const selectable = items.filter((s) => s.status === 'new')
          const on = selectable.filter((s) => selected.has(s.id)).length
          return (
            <section key={cat} aria-label={cat}>
              {/* sticky inside the scrolling body */}
              <div className="sticky top-0 z-10 flex h-8 items-center gap-3 bg-surface px-2 text-[12px] leading-4 font-medium text-stone-600">
                <Checkbox
                  label={`Select all ${cat}`}
                  checked={selectable.length > 0 && on === selectable.length}
                  indeterminate={on > 0 && on < selectable.length}
                  disabled={!selectable.length}
                  onChange={() => toggle(selectable.map((s) => s.id), on < selectable.length)}
                />
                <span>{cat} <span className="text-stone-500 tabular-nums">{items.length}</span></span>
              </div>
              <ul>
                {items.map((s) => {
                  const tracking = s.status === 'tracking'
                  return (
                    <li key={s.id}>
                      <label className={`flex h-10 items-center gap-3 rounded-md px-2 transition-colors duration-150 ${tracking ? 'cursor-default' : 'cursor-pointer hover:bg-tint'}`}>
                        <Checkbox label={s.text} checked={!tracking && selected.has(s.id)} disabled={tracking} onChange={() => toggle([s.id], !selected.has(s.id))} />
                        <span title={s.text} className={`min-w-0 flex-1 truncate text-[14px] leading-5 ${tracking ? 'text-stone-500' : 'text-stone-900'}`}>{s.text}</span>
                        <span className="inline-flex h-5 shrink-0 items-center rounded bg-tint px-1.5 text-[11px] leading-none font-medium text-stone-600">
                          {tracking ? 'Tracking' : SOURCE[s.source]}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
      {confirmAnchor && (
        <ConfirmPopover
          anchor={confirmAnchor}
          title="Re-run research?"
          body="This replaces current suggestions."
          confirmLabel="Re-run"
          onCancel={() => setConfirmAnchor(null)}
          onConfirm={() => { setConfirmAnchor(null); refresh('rerun') }}
        />
      )}
    </Modal>
  )
}
