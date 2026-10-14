import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FlaskConical, MessageSquarePlus, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import { useIsMobile } from '../../hooks/useMedia'
import MobileActions, { exportTable } from '../ui/MobileActions'
import Segmented from '../dashboard/Segmented'
import { brandName } from '../../utils/brand'
import { PrimaryButton, SecondaryButton, useToast } from '../dashboard/overlays'
import { PlatformIcon } from '../dashboard/icons'
import { MenuSelect } from '../dashboard/PageHeader'
import LogoStack from '../dashboard/LogoStack'
import AnswerDrawer, { openAnswer } from '../answer/AnswerDrawer'
import ConfirmPopover from './ConfirmPopover'
import { useInlineEdit } from '../../hooks/useInlineEdit'
import ResearchModal from './ResearchModal'
import ImportModal from './ImportModal'
import CategorySelect from './CategorySelect'
import { UNCATEGORIZED, allCategories, deleteCategory } from '../../store/categories'
import { DashboardViewProvider, useDashboardView } from '../../hooks/useBrandView'
import { ENGINES, OWN, TRACKED_BRANDS, appearances, engineName, enginePid, getBrandView } from '../../data/brandViews'
import { slugOf, trackedKey } from '../../data/syncChanges'
import { matchesTopic } from '../../data/topics'
import { account, guessCategory, promptActions, trackedPrompts } from '../../data/mock'

// Prompt Hub (/prompts): every tracked prompt with its topic, the brands its AI answers name and miss, and its status
// in the latest sync. Every change is shown at once and saved through promptActions; a failed save puts the row back
// and says so in the row, with Retry.
const STATUS_LABEL = { visible: 'Visible', missed: 'Missed', lost: 'Lost', pending: 'Pending' }
const shortDate = (d) => d.replace(/, \d{4}$/, '') // "Oct 2, 2026" → "Oct 2"
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// inline fields (add row, inline edit): same as the Search prompts field, plus an ink focus ring
const fieldCls = 'h-9 appearance-none rounded-md border border-line bg-raised px-3 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 ease-out focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
const ghostCls = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus'

// Status: plain text; Lost in the negative colour. A row whose save failed shows that instead, with Retry.
function StatusCell({ r, error }) {
  if (error) {
    return (
      <span className="flex items-center gap-2 whitespace-nowrap text-[13px] leading-[18px]" title={error.message}>
        <span className="text-negative">Not saved</span>
        <button type="button" data-stop-row onClick={(e) => { e.stopPropagation(); error.retry() }}
          className="rounded font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">
          Retry
        </button>
      </span>
    )
  }
  return <span className={`whitespace-nowrap text-[13px] leading-[18px] ${r.status === 'lost' ? 'text-negative' : 'text-stone-600'}`}>{STATUS_LABEL[r.status]}</span>
}

// Filters are remembered per brand (localStorage) and mirrored to the URL for sharing; the URL wins over storage.
// Anything unreadable or no longer valid falls back to the default.
const STATUSES = ['all', 'visible', 'missed', 'lost', 'pending']
const PAGE_SIZES = [10, 25, 50]
const SORT_KEYS = ['appearingFor', 'missedBy']
const STORE_KEY = `kraffic:prompts:filters:${account.domain}`
const catSlug = (c) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function initialFilters() {
  let saved = {}
  try { saved = JSON.parse(window.localStorage.getItem(STORE_KEY)) ?? {} } catch { saved = {} }
  const q = new URLSearchParams(window.location.search)
  const urlCat = q.get('category')
  const known = [...allCategories(), UNCATEGORIZED]
  const fromUrl = urlCat && known.find((c) => catSlug(c) === urlCat.toLowerCase())
  const urlStatus = q.get('visibility') // Prompt coverage → ?visibility=missed
  const urlSort = SORT_KEYS.includes(q.get('sort')) ? { key: q.get('sort'), dir: q.get('dir') === 'asc' ? 'asc' : 'desc' } : null
  const savedSort = SORT_KEYS.includes(saved.hubSort?.key) ? { key: saved.hubSort.key, dir: saved.hubSort.dir === 'asc' ? 'asc' : 'desc' } : null
  return {
    category: fromUrl ?? (known.includes(saved.category) ? saved.category : 'all'),
    status: STATUSES.includes(urlStatus) ? urlStatus : STATUSES.includes(saved.status) ? saved.status : 'all',
    engine: q.has('engine') ? null : ENGINES.some((e) => e.id === saved.engine) ? saved.engine : null, // null: the URL's (or all)
    sort: urlSort ?? savedSort,
    pageSize: PAGE_SIZES.includes(saved.rowsPerPage) ? saved.rowsPerPage : PAGE_SIZES[0],
  }
}

// the engine filter is the dashboard's (?engine=), so Prompt mix below follows it too
export default function PromptsPage() {
  return (
    <DashboardViewProvider>
      <PromptHub />
    </DashboardViewProvider>
  )
}

function PromptHub() {
  const mobile = useIsMobile()
  useEffect(() => { document.title = 'Prompt Hub · Kraffic' }, [])
  const [prompts, setPrompts] = useState(() => [...trackedPrompts])
  const [initial] = useState(initialFilters)
  const [status, setStatus] = useState(initial.status)
  const [category, setCategory] = useState(initial.category)
  const [sort, setSort] = useState(initial.sort)
  const { engine, setEngine } = useDashboardView()
  useEffect(() => { if (initial.engine) setEngine(initial.engine) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pid = engine === 'all' ? null : enginePid(engine)
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
  // remember the choices (per brand) and mirror category + sort to the URL
  useEffect(() => {
    try {
      // merge: the dashboard's Missed prompts keeps its sort (missedSort) under the same key
      const saved = JSON.parse(window.localStorage.getItem(STORE_KEY)) ?? {}
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...saved, category, status, engine, hubSort: sort, rowsPerPage: pageSize }))
    } catch { /* storage unavailable: nothing to remember */ }
  }, [category, status, engine, sort, pageSize])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', catSlug(category))
    if (sort) { url.searchParams.set('sort', sort.key); url.searchParams.set('dir', sort.dir) } else { url.searchParams.delete('sort'); url.searchParams.delete('dir') }
    window.history.replaceState(window.history.state, '', url)
  }, [category, sort])
  const [selected, setSelected] = useState(() => new Set())
  const [editing, setEditing] = useState(null) // { id, draft, original, category, originalCategory }
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

  // ---- saving: show the change, then save it; a failed save puts the row back and marks it (Not saved · Retry)
  const [rowErrors, setRowErrors] = useState({}) // id → { message, retry }
  const setRowError = (id, error) => setRowErrors((e) => { const n = { ...e }; if (error) n[id] = error; else delete n[id]; return n })
  const failed = (err) => err?.message || 'Couldn’t save this change'
  const replaceId = (from, to) => {
    setPrompts((ps) => ps.map((r) => (r.id === from ? { ...r, id: to } : r)))
    setRowError(from, null)
  }
  const saveNew = (row, save) => {
    setRowError(row.id, null)
    save()
      .then((res) => { if (res?.error) throw new Error(res.error); if (res?.id) replaceId(row.id, res.id) })
      .catch((err) => setRowError(row.id, { message: failed(err), retry: () => saveNew(row, save) }))
  }

  const trackedTexts = useMemo(() => new Set(prompts.map((r) => r.prompt.toLowerCase())), [prompts])

  // the brands each row's answers name / miss (the dashboard's engine filter applies); status follows it too
  const view = useMemo(() => prompts.map((r) => {
    const a = appearances[r.id]
    const seen = (d) => Boolean(a?.[d] && (pid ? a[d].platforms.includes(pid) : a[d].visible))
    const appearingFor = a ? TRACKED_BRANDS.filter((b) => seen(b.domain)).map((b) => b.domain) : []
    const missedBy = a ? TRACKED_BRANDS.filter((b) => !seen(b.domain)).map((b) => b.domain) : []
    const shown = pid && (r.status === 'visible' || r.status === 'missed') ? (seen(OWN.domain) ? 'visible' : 'missed') : r.status
    return { ...r, status: shown, appearingFor, missedBy }
  }), [prompts, pid])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, s === 'all' ? view.length : view.filter((r) => r.status === s).length])), [view])

  // every filter except category: what the category menu counts
  const inScope = useMemo(
    () => view.filter((r) => (status === 'all' || r.status === status) && (!topic || matchesTopic(topic, r.prompt)) && (!brandFilter || mentionsBrand(r)) && (!syncFilter || syncFilter.ids.has(r.id))),
    [view, status, topic, brandFilter, syncFilter], // eslint-disable-line react-hooks/exhaustive-deps
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
  // the project's most used topic (the add row's topic when the text doesn't suggest one)
  const usualTopic = Object.entries(totalCounts).filter(([c]) => c && c !== 'null').sort((a, b) => b[1] - a[1])[0]?.[0] ?? UNCATEGORIZED
  const filtered = category !== 'all' || status !== 'all' || Boolean(topic) || Boolean(brandFilter) || Boolean(syncFilter)
  const clearFilters = () => { setStatus('all'); setCategory('all'); if (topic) setTopic(null); if (brandFilter) setBrandFilter(null); if (syncFilter) setSyncFilter(null) }

  // ---- new rows (add, import, research) arrive as Pending, dated today, and save one by one
  const insert = (items, save) => {
    const fresh = items.map((it) => ({ id: `tmp${nextId.current++}`, prompt: it.text, category: it.category, list: null, status: 'pending', platforms: [], added: today() }))
    setPrompts((ps) => [...fresh, ...ps])
    const results = save(items)
    fresh.forEach((row, i) => saveNew(row, () => results.then((res) => res[i])))
    return fresh.length
  }

  // ---- add prompt (one inline row at the top)
  const isAdding = Boolean(adding && !adding.leaving)
  const startAdd = () => setAdding({ text: '', category: usualTopic, categoryTouched: false, leaving: false })
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
    insert([{ text, category: adding.category }], (items) => promptActions.onAddPrompt(items[0]).then((res) => [res]))
    // make sure the new (pending) row is visible
    if (status !== 'all' && status !== 'pending') setStatus('all')
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
    const before = prompts.find((r) => r.id === editing.id)
    if (text && before) {
      const next = { prompt: text, category: editing.category }
      const apply = (values) => setPrompts((ps) => ps.map((r) => (r.id === before.id ? { ...r, ...values } : r)))
      const save = () => {
        apply(next)
        setRowError(before.id, null)
        promptActions.onEditPrompt(before.id, { text, category: editing.category })
          .catch((err) => { apply({ prompt: before.prompt, category: before.category }); setRowError(before.id, { message: failed(err), retry: save }) })
      }
      save()
    }
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

  // ---- delete: rows go at once; a failed save brings them back where they were, marked
  const remove = (ids) => {
    const gone = prompts.map((r, i) => [r, i]).filter(([r]) => ids.includes(r.id))
    setPrompts((ps) => ps.filter((r) => !ids.includes(r.id)))
    setSelected((sel) => { const n = new Set(sel); ids.forEach((i) => n.delete(i)); return n })
    promptActions.onDeletePrompt(ids).catch((err) => {
      setPrompts((ps) => { const n = [...ps]; gone.forEach(([r, i]) => n.splice(Math.min(i, n.length), 0, r)); return n })
      gone.forEach(([r]) => setRowError(r.id, { message: failed(err), retry: () => { setRowError(r.id, null); remove([r.id]) } }))
    })
  }

  // the brand cells are the dashboard's Missed prompts cells; both sort by how many brands are in the cell
  const byPrompt = (r) => r.prompt.toLowerCase()
  const noData = <span className="text-small text-stone-400">—</span>
  // category combobox (toolbar, add row, inline edit): created / renamed / deleted custom categories
  const cellTrigger = 'inline-flex h-9 w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-raised pl-2.5 pr-2 text-left text-[12px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus' // 12px like the category pills
  const categoryEvents = {
    usage: totalCounts,
    onCreated: (name) => {
      toast(`Category “${name}” created`)
      promptActions.onAddCategory(name).catch(() => {
        deleteCategory(name)
        setCategory((c) => (c === name ? 'all' : c))
        setAdding((a) => (a && a.category === name ? { ...a, category: usualTopic } : a))
        setEditing((e) => (e && e.category === name ? { ...e, category: e.originalCategory } : e))
        toast(`Couldn’t save the category “${name}”`)
      })
    },
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
  const columns = [
    {
      key: 'prompt',
      label: 'Prompt',
      skeleton: '60%',
      sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' },
      cell: (r) => editing?.id === r.id && promptActions.canEditText ? (
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
      label: 'Topic',
      width: 140,
      // wording can't change where the app has no save for it: the edit row is then the topic alone
      cell: (r) => (editing?.id === r.id
        ? <div ref={promptActions.canEditText ? undefined : editRef} onKeyDown={promptActions.canEditText ? undefined : editKeys}><CategorySelect value={editing.category} onChange={(c) => setEditing((e) => ({ ...e, category: c }))} counts={totalCounts} triggerClassName={cellTrigger} {...categoryEvents} /></div>
        : r.category ? <span className="inline-flex h-6 max-w-full items-center truncate rounded-md bg-tint px-2 text-[12px] leading-none text-stone-700">{r.category}</span> : noData),
    },
    {
      key: 'appearingFor',
      label: 'Appearing for',
      width: 168,
      skeleton: '56px',
      mobile: 'extra',
      csv: (r) => r.appearingFor.map(brandName).join(' '),
      sort: { value: (r) => r.appearingFor.length, first: 'desc', cycle: true, tie: byPrompt },
      cell: (r) => (r.status === 'pending' ? noData : <LogoStack domains={r.appearingFor} empty={<span className="text-small text-stone-400">No brand cited</span>} />),
    },
    {
      key: 'missedBy',
      label: 'Missed by',
      width: 168,
      pad: 'pl-6 pr-3',
      skeleton: '56px',
      mobile: false,
      csv: (r) => r.missedBy.map(brandName).join(' '),
      sort: { value: (r) => r.missedBy.length, first: 'desc', cycle: true, tie: byPrompt },
      cell: (r) => (r.status === 'pending' ? noData : <LogoStack domains={r.missedBy} empty={noData} />),
    },
    {
      key: 'status',
      label: 'Status',
      width: 132,
      csv: (r) => STATUS_LABEL[r.status],
      sort: { value: (r) => STATUSES.indexOf(r.status), first: 'asc' },
      cell: (r) => <StatusCell r={r} error={rowErrors[r.id]} />,
    },
    {
      key: 'actions',
      label: '',
      mobile: 'extra',
      stopRowClick: true,
      width: 72,
      pad: 'pl-0 pr-4',
      align: 'right',
      csv: false,
      // hidden until the row is hovered or something in it has focus
      cell: (r) => (
        <span className="inline-flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 touch:opacity-100 group-focus-within:opacity-100 touch:opacity-100 max-md:opacity-100">
          <button
            type="button"
            aria-label={promptActions.canEditText ? `Edit “${r.prompt}”` : `Change the topic of “${r.prompt}”`}
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

  // the editable row inserted above the data rows (checkbox | prompt | topic | appearing for | missed by | status | actions)
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
              // guess the topic from the text until the user picks one; else the project's most used topic
              setAdding((a) => ({ ...a, text, category: a.categoryTouched ? a.category : guessCategory(text.toLowerCase()) ?? usualTopic }))
            }}
            className={`${fieldCls} -ml-[13px] min-w-0 flex-1`} // 12px padding + 1px border: text lines up with the rows below
          />
          <span className="shrink-0 whitespace-nowrap text-[12px] leading-4 text-stone-500">Enter saves · Esc cancels</span>
        </div>
      </td>
      {category === 'all' && (
        <td className="px-3">
          <div className={`${anim} flex h-[43px] items-center`}>
            <CategorySelect value={adding.category} onChange={(c) => setAdding((a) => ({ ...a, category: c, categoryTouched: true }))} counts={totalCounts} triggerClassName={cellTrigger} {...categoryEvents} />
          </div>
        </td>
      )}
      <td className="px-3"><div className={`${anim} flex h-[43px] items-center`}>{noData}</div></td>
      <td className="pl-6 pr-3"><div className={`${anim} flex h-[43px] items-center`}>{noData}</div></td>
      <td className="px-3"><div className={`${anim} flex h-[43px] items-center`}><StatusCell r={{ status: 'pending' }} /></div></td>
      <td className="pl-0 pr-4"><div className={anim} /></td>
    </tr>
  )

  const statusOptions = STATUSES.map((s) => ({ value: s, label: `${s === 'all' ? 'All' : STATUS_LABEL[s]} ${counts[s]}` }))
  const engineGroups = [{
    items: [
      { id: 'all', label: 'All engines' },
      ...ENGINES.map((e) => ({ id: e.id, label: e.name, icon: <PlatformIcon id={e.id} size={16} /> })),
    ],
  }]

  const toolbar = ({ search, exportButton, selectedCount, sortButton }) => {
    const bulk = selectedCount > 0
    const hideTools = bulk && !mobile // phones keep the filters; the bulk actions sit in a bar at the bottom
    const ids = [...selected]
    return (
      // toolbar and bulk bar share one grid cell and crossfade, so the row height never changes
      // phones: search + Sort on row 1, the filters scroll sideways on row 2 (minmax(0,1fr): the scrolling row can't widen it)
      <div className="grid grid-cols-[minmax(0,1fr)]">
        <div inert={hideTools ? '' : undefined} aria-hidden={hideTools} className={`[grid-area:1/1] flex items-center gap-2 transition-opacity duration-150 max-md:flex-wrap ${hideTools ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          {search}
          {sortButton}
          <div className="no-scrollbar flex items-center gap-2 max-md:-mx-4 max-md:w-[calc(100%+32px)] max-md:overflow-x-auto max-md:px-4 md:contents">
          <Segmented label="Status" value={status} onChange={setStatus} options={statusOptions} />
          <CategorySelect value={category} onChange={setCategory} allLabel="All categories" counts={categoryCounts} usage={totalCounts}
            triggerClassName="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus" {...categoryEvents} />
          <MenuSelect prefix="Engine" value={engine} onChange={setEngine} groups={engineGroups} listLabel="Filter by engine" showIcon align="left"
            triggerClassName="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 text-small outline-none focus-visible:ring-2 focus-visible:ring-focus" />
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
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-tint pl-2.5 pr-1 text-[13px] font-medium text-stone-900">
              <span className="font-normal text-stone-500">Topic</span> {topic}
              <button type="button" aria-label={`Clear topic ${topic}`} onClick={() => setTopic(null)} className="grid h-6 w-6 place-items-center rounded text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {filtered && (
              <button type="button" onClick={clearFilters} className="whitespace-nowrap rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus max-md:h-10">
                Clear filters
              </button>
            )}
            {exportButton}
          </div>
          </div>
        </div>
        <div inert={bulk ? undefined : ''} aria-hidden={!bulk} className={`[grid-area:1/1] flex items-center gap-1 transition-opacity duration-150 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:overflow-x-auto max-md:border-t max-md:border-line max-md:bg-surface max-md:px-4 max-md:pt-2 max-md:pb-[max(8px,env(safe-area-inset-bottom))] max-md:shadow-[0_-4px_12px_rgb(0_0_0/0.06)] ${bulk ? 'opacity-100' : 'pointer-events-none opacity-0 max-md:hidden'}`}>
          <span className="mr-2 text-[14px] leading-5 font-medium text-stone-900 tabular-nums">{selectedCount} selected</span>
          {promptActions.canRescan && (
            <button
              type="button"
              onClick={() => {
                setPrompts((ps) => ps.map((r) => (ids.includes(r.id) ? { ...r, status: 'pending' } : r)))
                toast(`${plural(ids.length, 'prompt')} queued for rescan`)
                setSelected(new Set())
              }}
              className={`${ghostCls} text-stone-700 hover:bg-stone-100 hover:text-stone-900`}
            >
              Rescan
            </button>
          )}
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

  const empty = prompts.length === 0 && !adding
  return (
    <>
      {/* header: title + domain on the left, actions on the right (one row, like the dashboard) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Prompt Hub</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-600 lg:text-[14px] lg:leading-5">Manage the prompts tracked for {brandName(account.domain)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:pt-1">
          <span className="hidden items-center gap-2 lg:flex">
            <SecondaryButton size="sm" icon={FlaskConical} onClick={() => setModal('research')}>Research</SecondaryButton>
            <SecondaryButton size="sm" icon={Upload} onClick={() => setModal('import')}>Import</SecondaryButton>
          </span>
          {/* a second click closes the open row (span: the button doesn't forward refs) */}
          <span ref={addBtnRef} className="inline-flex max-lg:flex-1 max-lg:[&>button]:h-10 max-lg:[&>button]:w-full max-lg:[&>button]:justify-center">
            <PrimaryButton size="sm" icon={Plus} aria-expanded={isAdding} onClick={() => (isAdding ? closeAdd() : startAdd())}>Add prompt</PrimaryButton>
          </span>
          <MobileActions items={[
            { label: 'Research prompts', icon: FlaskConical, onClick: () => setModal('research') },
            { label: 'Import prompts', icon: Upload, onClick: () => setModal('import') },
            { label: 'Export CSV', icon: Download, onClick: () => exportTable('tracked-prompts') },
          ]} />
        </div>
      </div>

      {empty ? (
        // a project with no prompts yet: the three ways to get some
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-16 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-stone-600" aria-hidden><MessageSquarePlus size={18} /></span>
          <h2 className="text-title font-semibold text-stone-900">No prompts yet</h2>
          <p className="max-w-md text-[14px] leading-5 text-stone-600">Prompts are the questions buyers ask AI assistants. Add your own, import a list, or let research find them from your site.</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <PrimaryButton size="sm" icon={Plus} onClick={startAdd}>Add prompt</PrimaryButton>
            <SecondaryButton size="sm" icon={Upload} onClick={() => setModal('import')}>Import CSV</SecondaryButton>
            <SecondaryButton size="sm" icon={FlaskConical} onClick={() => setModal('research')}>Find prompts</SecondaryButton>
          </div>
        </div>
      ) : (
        <PromptTable
          id="tracked-prompts"
          rows={rows}
          columns={shownColumns}
          pageSize={pageSize}
          onPageSize={setPageSize}
          resetKey={`${status}|${category}|${engine}|${topic}|${brandFilter?.key}|${syncFilter?.label}`}
          filterKeys={['prompt', 'category']}
          csvName="prompts.csv"
          sort={sort}
          onSortChange={setSort}
          selection={{ selected, setSelected }}
          toolbar={toolbar}
          topRow={addRow}
          rowHover="hover:bg-tint"
          // a row opens its AI answers (a pending prompt has none yet)
          onRowClick={(r, el) => r.status !== 'pending' && !editing && openAnswer({ key: r.id, list: rows.filter((x) => x.status !== 'pending').map((x) => x.id), opener: el })}
          emptyMessage={status === 'pending' ? 'No prompts waiting for a scan' : 'No prompts match these filters'}
          onClearFilters={filtered ? clearFilters : null}
        />
      )}

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
          const n = insert(items, (rows) => promptActions.onAddFromResearch(rows))
          setModal(null)
          toast(`${plural(n, 'prompt')} added`, { duration: 5000, action: { label: 'View', onClick: () => setStatus('pending') } })
        }}
      />
      <ImportModal
        open={modal === 'import'}
        onClose={() => setModal(null)}
        trackedTexts={trackedTexts}
        onImport={(rows) => insert(rows, (items) => promptActions.onImportPrompts(items))}
        onView={() => { setModal(null); setStatus('all') }}
      />
      <AnswerDrawer />
      {toastNode}
    </>
  )
}
