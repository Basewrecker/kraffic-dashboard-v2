import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, FlaskConical, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import Segmented from '../dashboard/Segmented'
import { brandName } from '../../utils/brand'
import { PrimaryButton, SecondaryButton, useToast } from '../dashboard/overlays'
import { PlatformIcon } from '../dashboard/icons'
import ConfirmPopover from './ConfirmPopover'
import { useInlineEdit } from '../../hooks/useInlineEdit'
import ResearchModal from './ResearchModal'
import ImportModal from './ImportModal'
import CategorySelect from './CategorySelect'
import { UNCATEGORIZED, allCategories } from '../../store/categories'
import { OWN, TRACKED_BRANDS, appearances, engineName, enginePid, getBrandView } from '../../data/brandViews'
import { slugOf, trackedKey } from '../../data/syncChanges'
import { matchesTopic } from '../../data/topics'
import { account, guessCategory, platformNames, promptLists, trackedPrompts } from '../../data/mock'

const STATUS_LABEL = { visible: 'Visible', missed: 'Missed', pending: 'Pending' }
const PLATFORM_ORDER = ['google', 'chatgpt', 'gemini', 'claude', 'grok']
const iconId = (p) => (p === 'google' ? 'aio' : p)
const shortDate = (d) => d.replace(/, \d{4}$/, '') // "Oct 2, 2026" → "Oct 2"
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// shared control styles (match the dashboard toolbar: h-9, 1px line border, raised fill)
const selectCls = 'h-9 rounded-lg border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus'
// inline fields (add row, inline edit): same as the Search prompts field, plus an ink focus ring
const fieldCls = 'h-9 appearance-none rounded-md border border-line bg-raised px-3 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 ease-out focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
const ghostCls = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus'

function StatusCell({ r }) {
  const dot = r.status === 'visible'
    ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
    : r.status === 'missed'
      ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--data-c2)' }} />
      : <span className="h-1.5 w-1.5 shrink-0 rounded-full border-[1.5px] border-stone-400" />
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] text-stone-900">
      {dot}
      {STATUS_LABEL[r.status]}
      {r.status === 'visible' && r.platforms.length > 0 && (
        <span className="ml-0.5 flex items-center gap-1">
          {PLATFORM_ORDER.filter((p) => r.platforms.includes(p)).map((p) => (
            <span key={p} title={platformNames[p]} className="flex"><PlatformIcon id={iconId(p)} size={12} /></span>
          ))}
        </span>
      )}
    </span>
  )
}

// Filters are remembered per brand (localStorage) and the category is mirrored to ?category= for sharing;
// the URL wins over storage. Anything unreadable or no longer valid falls back to the default.
const STATUSES = ['all', 'visible', 'missed', 'pending']
const PAGE_SIZES = [10, 25, 50]
const STORE_KEY = `kraffic:prompts:filters:${account.domain}`
const catSlug = (c) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function initialFilters() {
  let saved = {}
  try { saved = JSON.parse(window.localStorage.getItem(STORE_KEY)) ?? {} } catch { saved = {} }
  const urlCat = new URLSearchParams(window.location.search).get('category')
  const known = [...allCategories(), UNCATEGORIZED]
  const fromUrl = urlCat && known.find((c) => catSlug(c) === urlCat.toLowerCase())
  const urlStatus = new URLSearchParams(window.location.search).get('visibility') // Prompt coverage → ?visibility=missed
  return {
    category: fromUrl ?? (known.includes(saved.category) ? saved.category : 'all'),
    status: STATUSES.includes(urlStatus) ? urlStatus : STATUSES.includes(saved.status) ? saved.status : 'all',
    list: promptLists.includes(saved.list) ? saved.list : 'all',
    pageSize: PAGE_SIZES.includes(saved.rowsPerPage) ? saved.rowsPerPage : PAGE_SIZES[0],
  }
}

export default function PromptsPage() {
  useEffect(() => { document.title = 'Prompt Hub · Kraffic' }, [])
  const [prompts, setPrompts] = useState(trackedPrompts)
  const [initial] = useState(initialFilters)
  const [status, setStatus] = useState(initial.status)
  const [list, setList] = useState(initial.list)
  const [category, setCategory] = useState(initial.category)
  // ?visibility= only seeds the status tab (which is remembered from then on)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('visibility')) return
    url.searchParams.delete('visibility')
    window.history.replaceState(window.history.state, '', url)
  }, [])
  // ?brand=<key>[&brandEngine=<engine>] (Prompt coverage rows): prompts whose answers mention that brand
  const [brandFilter, setBrandFilterState] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    const b = TRACKED_BRANDS.find((x) => x.key === q.get('brand'))
    return b ? { domain: b.domain, name: b.name, key: b.key, engine: enginePid(q.get('brandEngine')) ? q.get('brandEngine') : null } : null
  })
  const setBrandFilter = (v) => {
    setBrandFilterState(v)
    const url = new URL(window.location.href)
    url.searchParams.delete('brand'); url.searchParams.delete('brandEngine')
    window.history.replaceState(window.history.state, '', url)
  }
  // ?sync=sep-28&change=lost|gained (Sync history drawer → "Open in Prompt Hub"): the prompts that sync lost / gained
  const [syncFilter, setSyncFilterState] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    const row = getBrandView(OWN.domain).syncHistory.find((r) => slugOf(r.date) === q.get('sync'))
    const change = q.get('change') === 'gained' ? 'gained' : 'lost'
    return row?.changes ? { label: `${shortDate(row.date)} · ${change}`, ids: new Set(row.changes[change].map((p) => trackedKey(p.id, change))) } : null
  })
  const setSyncFilter = (v) => {
    setSyncFilterState(v)
    const url = new URL(window.location.href)
    url.searchParams.delete('sync'); url.searchParams.delete('change')
    window.history.replaceState(window.history.state, '', url)
  }
  const mentionsBrand = (r) => {
    const a = appearances[r.id]?.[brandFilter.domain]
    return Boolean(a && (brandFilter.engine ? a.platforms.includes(enginePid(brandFilter.engine)) : a.visible))
  }
  const [pageSize, setPageSize] = useState(initial.pageSize)
  // remember the choice (per brand) and mirror the category to the URL
  useEffect(() => {
    try {
      // merge: the dashboard's Missed prompts keeps its sort (missedSort) under the same key
      const saved = JSON.parse(window.localStorage.getItem(STORE_KEY)) ?? {}
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...saved, category, list, status, rowsPerPage: pageSize }))
    } catch { /* storage unavailable: nothing to remember */ }
  }, [category, list, status, pageSize])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', catSlug(category))
    window.history.replaceState(window.history.state, '', url)
  }, [category])
  const [selected, setSelected] = useState(() => new Set())
  const [editing, setEditing] = useState(null) // { id, draft, original }
  const editRef = useRef(null)
  const [adding, setAdding] = useState(null) // { text, category, categoryTouched, leaving }
  const [confirm, setConfirm] = useState(null) // { anchor, ids }
  // /prompts?research=<topic> (Setup → Products & topics → "Run research") opens research filtered to that topic
  const [researchTopic, setResearchTopic] = useState(() => new URLSearchParams(window.location.search).get('research'))
  // /prompts?topic=<name> (Setup → Products & topics chip): only prompts about that product / topic
  const [topic, setTopicState] = useState(() => new URLSearchParams(window.location.search).get('topic'))
  const setTopic = (t) => {
    setTopicState(t)
    const url = new URL(window.location.href)
    if (t) url.searchParams.set('topic', t); else url.searchParams.delete('topic')
    window.history.replaceState(window.history.state, '', url)
  }
  const [modal, setModal] = useState(() => (researchTopic ? 'research' : null)) // 'research' | 'import'
  useEffect(() => {
    if (!researchTopic) return
    const url = new URL(window.location.href)
    url.searchParams.delete('research')
    window.history.replaceState(window.history.state, '', url)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [toastNode, toast] = useToast({ position: 'center' })
  const nextId = useRef(1)
  const addRowRef = useRef(null)
  const addBtnRef = useRef(null)
  const addingRef = useRef(adding)
  addingRef.current = adding

  const trackedTexts = useMemo(() => new Set(prompts.map((r) => r.prompt.toLowerCase())), [prompts])
  // the fixed lists plus any created by an import / research add
  const lists = useMemo(() => [...new Set([...promptLists, ...prompts.map((r) => r.list)])], [prompts])

  const counts = useMemo(() => ({
    all: prompts.length,
    visible: prompts.filter((r) => r.status === 'visible').length,
    missed: prompts.filter((r) => r.status === 'missed').length,
    pending: prompts.filter((r) => r.status === 'pending').length,
  }), [prompts])

  // every filter except category: what the category menu counts
  const inScope = useMemo(
    () => prompts.filter((r) => (status === 'all' || r.status === status) && (list === 'all' || r.list === list) && (!topic || matchesTopic(topic, r.prompt)) && (!brandFilter || mentionsBrand(r)) && (!syncFilter || syncFilter.ids.has(r.id))),
    [prompts, status, list, topic, brandFilter, syncFilter], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const rows = useMemo(() => (category === 'all' ? inScope : inScope.filter((r) => r.category === category)), [inScope, category])
  const categoryCounts = useMemo(() => {
    const n = {}
    inScope.forEach((r) => { n[r.category] = (n[r.category] ?? 0) + 1 })
    return n
  }, [inScope])
  const totalCounts = useMemo(() => {
    const n = {}
    prompts.forEach((r) => { n[r.category] = (n[r.category] ?? 0) + 1 })
    return n
  }, [prompts])
  const filtered = category !== 'all' || list !== 'all' || status !== 'all' || Boolean(topic) || Boolean(brandFilter) || Boolean(syncFilter)
  const clearFilters = () => { setStatus('all'); setList('all'); setCategory('all'); if (topic) setTopic(null); if (brandFilter) setBrandFilter(null); if (syncFilter) setSyncFilter(null) }

  const update = (ids, fn) => setPrompts((ps) => ps.map((r) => (ids.includes(r.id) ? fn(r) : r)))
  const remove = (ids) => {
    setPrompts((ps) => ps.filter((r) => !ids.includes(r.id)))
    setSelected((sel) => { const n = new Set(sel); ids.forEach((i) => n.delete(i)); return n })
  }

  // ---- add prompt (inline row at the top)
  // new rows always arrive as Pending, dated today
  const insert = (items, listName) => {
    const rows = items.map((it) => ({ id: `new${nextId.current++}`, prompt: it.text, category: it.category, list: listName, status: 'pending', platforms: [], added: today() }))
    setPrompts((ps) => [...rows, ...ps])
    return rows.length
  }

  // ---- add prompt (one inline row at the top)
  const isAdding = Boolean(adding && !adding.leaving)
  const startAdd = () => setAdding({ text: '', category: 'Moisturizers', categoryTouched: false, leaving: false })
  // close the row; a typed draft is discarded with a 5s Undo that restores it
  const closeAdd = () => {
    const a = addingRef.current
    if (!a || a.leaving) return
    setAdding({ ...a, leaving: true })
    if (a.text.trim()) {
      toast('Draft discarded', { duration: 5000, action: { label: 'Undo', onClick: () => setAdding({ ...a, leaving: false }) } })
    }
  }
  const saveAdd = () => {
    const text = adding.text.trim()
    if (!text) return
    insert([{ text, category: adding.category }], 'Manual entry')
    // make sure the new (pending, manual) row is visible
    if (status !== 'all' && status !== 'pending') setStatus('all')
    if (list !== 'all' && list !== 'Manual entry') setList('all')
    setAdding((a) => ({ ...a, text: '', leaving: true }))
    toast('Prompt added')
  }
  // unmount after the 150ms exit animation
  useEffect(() => {
    if (!adding?.leaving) return
    const t = setTimeout(() => setAdding((a) => (a?.leaving ? null : a)), 150)
    return () => clearTimeout(t)
  }, [adding?.leaving])
  // shared inline-edit rules: Esc discards (with Undo if text was typed), Enter / a click outside saves typed text,
  // an empty row just closes. The Add button toggles the row itself, so its clicks don't count as outside.
  const hasText = Boolean(adding?.text.trim())
  const addRowKeys = useInlineEdit({ ref: addRowRef, active: isAdding, isDirty: hasText, isValid: hasText, onSave: () => saveAdd(), onCancel: closeAdd, ignore: [addBtnRef] }).onKeyDown

  // ---- inline edit
  const saveEdit = () => {
    const text = editing.draft.trim()
    if (text) update([editing.id], (r) => ({ ...r, prompt: text, category: editing.category }))
    setEditing(null)
  }
  const editText = editing?.draft.trim() ?? ''
  const editKeys = useInlineEdit({
    ref: editRef,
    active: Boolean(editing),
    isDirty: Boolean(editing) && (editText !== editing.original || editing.category !== editing.originalCategory),
    isValid: Boolean(editText),
    onSave: saveEdit,
    onCancel: () => setEditing(null),
    // emptied the prompt, then clicked away: drop it, but let Undo bring the edit back
    onDiscard: () => {
      const prev = editing
      setEditing(null)
      toast('Changes discarded', { duration: 5000, action: { label: 'Undo', onClick: () => setEditing(prev) } })
    },
  }).onKeyDown

  const columns = [
    {
      key: 'prompt',
      label: 'Prompt',
      skeleton: '60%',
      sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' },
      cell: (r) => editing?.id === r.id ? (
        <div ref={editRef} onKeyDown={editKeys}>
        <input
          autoFocus
          aria-label="Edit prompt"
          value={editing.draft}
          onFocus={(e) => e.target.select()} // typing replaces the prompt; arrow keys still edit it
          onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
          className={`${fieldCls} -ml-[13px] w-[calc(100%+13px)]`}
        />
        </div>
      ) : (
        <span title={r.prompt} className="block truncate text-[14px] leading-5 text-stone-900">{r.prompt}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: 140,
      cell: (r) => (editing?.id === r.id
        ? <CategorySelect value={editing.category} onChange={(c) => setEditing((e) => ({ ...e, category: c }))} counts={totalCounts} triggerClassName={cellTrigger} {...categoryEvents} />
        : <span className="inline-flex h-6 max-w-full items-center truncate rounded-md bg-tint px-2 text-[12px] leading-none text-stone-700">{r.category}</span>),
    },
    { key: 'list', label: 'List', width: 140, cell: (r) => <span className="block truncate text-[13px] leading-[18px] text-stone-600" title={r.list}>{r.list}</span> },
    {
      key: 'status',
      label: 'AI visibility',
      width: 132,
      csv: (r) => `${STATUS_LABEL[r.status]}${r.platforms.length ? ` (${r.platforms.map((p) => platformNames[p]).join(', ')})` : ''}`,
      cell: (r) => <StatusCell r={r} />,
    },
    {
      key: 'added',
      label: 'Added',
      width: 112,
      sort: { value: (r) => Date.parse(r.added), first: 'desc' },
      csv: (r) => r.added,
      cell: (r) => <span className="text-[13px] leading-[18px] text-stone-600 tabular-nums">{shortDate(r.added)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: 72,
      pad: 'pl-0 pr-4',
      align: 'right',
      csv: false,
      // hidden until the row is hovered or something in it has focus
      cell: (r) => (
        <span className="inline-flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            aria-label={`Edit “${r.prompt}”`}
            onClick={() => setEditing({ id: r.id, draft: r.prompt, original: r.prompt, category: r.category, originalCategory: r.category })}
            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Pencil size={14} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete “${r.prompt}”`}
            onClick={(e) => setConfirm({ anchor: e.currentTarget, ids: [r.id] })}
            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-negative focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </span>
      ),
    },
  ]

  // one category picked: every row is that category, so its pill goes (same rule as the dashboard)
  const shownColumns = category === 'all' ? columns : columns.filter((c) => c.key !== 'category')
  // category combobox (toolbar, add row, inline edit): created / renamed / deleted custom categories
  const cellTrigger = 'inline-flex h-9 w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-raised pl-2.5 pr-2 text-left text-[12px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus' // 12px like the category pills
  const categoryEvents = {
    usage: totalCounts,
    onCreated: (name) => toast(`Category “${name}” created`),
    onRenamed: (from, to) => {
      setPrompts((ps) => ps.map((r) => (r.category === from ? { ...r, category: to } : r)))
      setCategory((c) => (c === from ? to : c))
      setAdding((a) => (a && a.category === from ? { ...a, category: to } : a))
      setEditing((e) => (e && e.category === from ? { ...e, category: to } : e))
      toast(`Renamed to “${to}”`)
    },
    onDeleted: (name, moved) => {
      setPrompts((ps) => ps.map((r) => (r.category === name ? { ...r, category: UNCATEGORIZED } : r)))
      setCategory((c) => (c === name ? 'all' : c))
      setAdding((a) => (a && a.category === name ? { ...a, category: UNCATEGORIZED } : a))
      setEditing((e) => (e && e.category === name ? { ...e, category: UNCATEGORIZED } : e))
      toast(moved ? `“${name}” deleted · ${plural(moved, 'prompt')} moved to ${UNCATEGORIZED}` : `“${name}” deleted`)
    },
  }

  // the editable row inserted above the data rows (checkbox | prompt | category | list | status | added | actions)
  const anim = adding?.leaving ? 'row-out' : 'row-in'
  const addRow = adding && (
    <tr ref={addRowRef} onKeyDown={addRowKeys} className="border-b border-stone-100 bg-[var(--subtle-bg)]">
      <td className="pl-5 pr-0"><div className={anim} /></td>
      <td className="px-3">
        <div className={`${anim} flex h-[43px] items-center gap-3`}>
          <input
            autoFocus
            aria-label="New prompt"
            placeholder="Type a prompt and press Enter"
            value={adding.text}
            onChange={(e) => {
              const text = e.target.value
              // guess the category from the text until the user picks one
              setAdding((a) => ({ ...a, text, category: a.categoryTouched ? a.category : guessCategory(text.toLowerCase()) }))
            }}
            className={`${fieldCls} -ml-[13px] min-w-0 flex-1`} // 12px padding + 1px border: text lines up with the rows below
          />
          <span className="shrink-0 whitespace-nowrap text-[12px] leading-4 text-stone-500">Enter saves · Esc cancels</span>
        </div>
      </td>
      <td className="px-3">
        <div className={`${anim} flex h-[43px] items-center`}>
          <CategorySelect value={adding.category} onChange={(c) => setAdding((a) => ({ ...a, category: c, categoryTouched: true }))} counts={totalCounts} triggerClassName={cellTrigger} {...categoryEvents} />
        </div>
      </td>
      <td className="px-3"><div className={`${anim} flex h-[43px] items-center text-[13px] text-stone-600`}>Manual entry</div></td>
      <td className="px-3"><div className={`${anim} flex h-[43px] items-center`}><StatusCell r={{ status: 'pending', platforms: [] }} /></div></td>
      <td className="px-3"><div className={`${anim} flex h-[43px] items-center text-[13px] text-stone-500 tabular-nums`}>{shortDate(today())}</div></td>
      <td className="pl-0 pr-4"><div className={anim} /></td>
    </tr>
  )

  const statusOptions = [
    { value: 'all', label: `All ${counts.all}` },
    { value: 'visible', label: `Visible ${counts.visible}` },
    { value: 'missed', label: `Missed ${counts.missed}` },
    { value: 'pending', label: `Pending ${counts.pending}` },
  ]

  const toolbar = ({ search, exportButton, selectedCount }) => {
    const bulk = selectedCount > 0
    const ids = [...selected]
    return (
      // toolbar and bulk bar share one grid cell and crossfade, so the row height never changes
      <div className="grid">
        <div inert={bulk ? '' : undefined} aria-hidden={bulk} className={`[grid-area:1/1] flex items-center gap-2 transition-opacity duration-150 ${bulk ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          {search}
          <Segmented label="Status" value={status} onChange={setStatus} options={statusOptions} />
          <CategorySelect value={category} onChange={setCategory} allLabel="All categories" counts={categoryCounts} usage={totalCounts}
            triggerClassName="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus" {...categoryEvents} />
          <select aria-label="List" value={list} onChange={(e) => setList(e.target.value)} className={selectCls}>
            <option value="all">All lists</option>
            {lists.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {syncFilter && (
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-tint pl-2.5 pr-1 text-[13px] font-medium text-stone-900">
              <span className="font-normal text-stone-500">Sync</span> {syncFilter.label}
              <button type="button" aria-label="Clear sync filter" onClick={() => setSyncFilter(null)} className="grid h-6 w-6 place-items-center rounded text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
            </span>
          )}
          {brandFilter && (
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-tint pl-2.5 pr-1 text-[13px] font-medium text-stone-900">
              <span className="font-normal text-stone-500">Mentions</span> {brandFilter.name}{brandFilter.engine && <span className="font-normal text-stone-500">· {engineName(brandFilter.engine)}</span>}
              <button type="button" aria-label={`Clear brand ${brandFilter.name}`} onClick={() => setBrandFilter(null)} className="grid h-6 w-6 place-items-center rounded text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
            </span>
          )}
          {topic && (
            <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-tint pl-2.5 pr-1 text-[13px] font-medium text-stone-900">
              <span className="font-normal text-stone-500">Topic</span> {topic}
              <button type="button" aria-label={`Clear topic ${topic}`} onClick={() => setTopic(null)} className="grid h-6 w-6 place-items-center rounded text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {filtered && (
              <button type="button" onClick={clearFilters} className="rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                Clear filters
              </button>
            )}
            {exportButton}
          </div>
        </div>
        <div inert={bulk ? undefined : ''} aria-hidden={!bulk} className={`[grid-area:1/1] flex items-center gap-1 transition-opacity duration-150 ${bulk ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <span className="mr-2 text-[14px] leading-5 font-medium text-stone-900 tabular-nums">{selectedCount} selected</span>
          {/* fixed width: a native select is otherwise as wide as its longest option */}
          <label className="relative inline-flex">
          <select
            aria-label="Move to list"
            value=""
            onChange={(e) => {
              const to = e.target.value
              update(ids, (r) => ({ ...r, list: to }))
              toast(`${plural(ids.length, 'prompt')} moved to ${to}`)
              setSelected(new Set())
            }}
            className={`${ghostCls} w-[128px] cursor-pointer appearance-none bg-transparent pr-7 text-stone-700 hover:bg-stone-100 hover:text-stone-900`}
          >
            <option value="" disabled>Move to list</option>
            {lists.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          </label>
          <button
            type="button"
            onClick={() => {
              update(ids, (r) => ({ ...r, status: 'pending' }))
              toast(`${plural(ids.length, 'prompt')} queued for rescan`)
              setSelected(new Set())
            }}
            className={`${ghostCls} text-stone-700 hover:bg-stone-100 hover:text-stone-900`}
          >
            Rescan
          </button>
          <button
            type="button"
            onClick={(e) => setConfirm({ anchor: e.currentTarget, ids })}
            className={`${ghostCls} text-negative hover:bg-stone-100`}
          >
            Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={`${ghostCls} ml-auto text-stone-600 hover:bg-stone-100 hover:text-stone-900`}>
            Clear
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* header: title + domain on the left, actions on the right (one row, like the dashboard) */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-h1 font-semibold text-stone-900">Prompt Hub</h1>
          <p className="mt-1 text-[14px] leading-5 text-stone-600">Manage the prompts tracked for {brandName(account.domain)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <SecondaryButton size="sm" icon={FlaskConical} onClick={() => setModal('research')}>Research</SecondaryButton>
          <SecondaryButton size="sm" icon={Upload} onClick={() => setModal('import')}>Import</SecondaryButton>
          {/* a second click closes the open row (span: the button doesn't forward refs) */}
          <span ref={addBtnRef} className="inline-flex">
            <PrimaryButton size="sm" icon={Plus} aria-expanded={isAdding} onClick={() => (isAdding ? closeAdd() : startAdd())}>Add prompt</PrimaryButton>
          </span>
        </div>
      </div>

      <PromptTable
        id="tracked-prompts"
        rows={rows}
        columns={shownColumns}
        pageSize={pageSize}
        onPageSize={setPageSize}
        resetKey={`${status}|${list}|${category}|${topic}|${brandFilter?.key}|${syncFilter?.label}`}
        filterKeys={['prompt', 'category', 'list']}
        csvName="prompts.csv"
        defaultSort={{ key: 'added', dir: 'desc' }}
        selection={{ selected, setSelected }}
        toolbar={toolbar}
        topRow={addRow}
        rowHover="hover:bg-tint"
        emptyMessage={status === 'pending' ? 'No prompts waiting for a scan' : 'No prompts match these filters'}
        onClearFilters={filtered ? clearFilters : null}
      />

      {confirm && (
        <ConfirmPopover
          anchor={confirm.anchor}
          title={confirm.ids.length === 1 ? 'Delete prompt?' : `Delete ${confirm.ids.length} prompts?`}
          body={confirm.ids.length === 1 ? 'This removes its history.' : 'This removes their history.'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            remove(confirm.ids)
            toast(confirm.ids.length === 1 ? 'Prompt deleted' : `${confirm.ids.length} prompts deleted`)
            setConfirm(null)
          }}
        />
      )}
      <ResearchModal
        open={modal === 'research'}
        onClose={() => { setModal(null); setResearchTopic(null) }}
        topic={researchTopic}
        trackedTexts={trackedTexts}
        onAdd={(items) => {
          const n = insert(items.map((s) => ({ text: s.text, category: s.category })), 'Prompt research')
          setModal(null)
          toast(`${plural(n, 'prompt')} added`, { duration: 5000, action: { label: 'View', onClick: () => { setStatus('pending'); setList('all') } } })
        }}
      />
      <ImportModal
        open={modal === 'import'}
        onClose={() => setModal(null)}
        trackedTexts={trackedTexts}
        onImport={(rows, listName) => insert(rows, listName)}
        onView={(listName) => { setModal(null); setStatus('all'); setList(listName) }}
      />
      {toastNode}
    </>
  )
}
