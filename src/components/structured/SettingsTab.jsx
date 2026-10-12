import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import Card from '../dashboard/Card'
import Segmented from '../dashboard/Segmented'
import Switch from '../ui/Switch'
import DrawerShell, { useDrawer } from '../audit/DrawerShell'
import { openDrawer } from '../audit/parts'
import { SD, pages as allPages } from '../../data/structuredData'
import { WEEKDAYS, groupPages, matches, nextRun, saveSettings, useSettings } from './settings'

// Settings tab: settings cards on the left (Tracking page row style, autosave with a "Saved" tick by the row),
// the last run on the right (sticky). Page-type rules here drive the Overview's Coverage map rows.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const textBtn = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50'
const input = 'h-9 rounded-lg border border-line bg-raised px-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400'
const RECIPIENT = 'you@dermasuri.com'

// "Saved ✓" beside the row that changed, for 1.5s
function useSaved() {
  const [key, setKey] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  return [key, (k) => { setKey(k); clearTimeout(timer.current); timer.current = setTimeout(() => setKey(null), 1500) }]
}
const Saved = ({ show }) => (
  <span aria-live="polite" className={`inline-flex items-center gap-1 text-[13px] leading-[18px] ${t3} transition-opacity duration-200 ease-out ${show ? 'opacity-100' : 'opacity-0'}`}>
    {show && <><Check size={12} aria-hidden /> Saved</>}
  </span>
)

function SettingsCard({ title, description, children }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <header className="border-b border-[var(--div)] px-5 pb-3.5 pt-[18px]">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>
        {description && <p className={`mt-0.5 text-[13px] leading-[18px] ${t2}`}>{description}</p>}
      </header>
      <ul className="divide-y divide-[var(--div)]">{children}</ul>
    </section>
  )
}
// label + meta on the left (with the Saved tick), the control on the right; grows past 64px when the control does
function Row({ name, meta, saved, children, top = false }) {
  return (
    <li className={`flex min-h-16 justify-between gap-6 px-5 py-3 ${top ? 'items-start' : 'items-center'}`}>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] leading-5 font-medium text-stone-900">{name}<Saved show={saved} /></span>
        {meta && <span className={`block text-[13px] leading-[18px] ${t3}`}>{meta}</span>}
      </span>
      <span className="flex min-w-0 shrink-0 flex-col items-end gap-1.5">{children}</span>
    </li>
  )
}

// path chips ("/products/*" ×) + "Add path" (inline input, Enter adds, Esc cancels)
function PathChips({ label, value, onChange }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v.startsWith('/') ? v : `/${v}`])
    setDraft(''); setAdding(false)
  }
  return (
    <span className="flex max-w-[420px] flex-wrap items-center justify-end gap-1.5">
      {value.map((p) => (
        <span key={p} className="inline-flex h-7 items-center gap-1 rounded-md bg-tint pl-2 pr-1 font-mono text-[12px] text-stone-900">
          {p}
          <button type="button" aria-label={`Remove ${p} from ${label}`} onClick={() => onChange(value.filter((x) => x !== p))}
            className="grid h-5 w-5 place-items-center rounded text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
        </span>
      ))}
      {adding ? (
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={add} placeholder="/path/*" aria-label={`Add a path to ${label}`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } if (e.key === 'Escape') { e.stopPropagation(); setDraft(''); setAdding(false) } }}
          className={`${input} h-7 w-32 px-2 font-mono text-[12px]`} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={textBtn}><Plus size={14} aria-hidden />Add path</button>
      )}
    </span>
  )
}

// one page-type rule: name · pattern chip · page count · Edit (inline)
function PageTypeRow({ t, count, onSave, onDelete, startEditing = false }) {
  const [edit, setEdit] = useState(startEditing)
  const [name, setName] = useState(t.name)
  const [pattern, setPattern] = useState(t.pattern)
  const save = () => { if (name.trim() && pattern.trim()) { onSave({ ...t, name: name.trim(), pattern: pattern.trim() }); setEdit(false) } }
  if (edit) {
    return (
      <li className="flex min-h-16 flex-wrap items-center gap-2 px-5 py-3"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); if (startEditing) onDelete(); else setEdit(false) } }}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Page type name" placeholder="Name" className={`${input} w-44`} />
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="URL pattern" placeholder="/path/*" className={`${input} w-40 font-mono text-[13px]`} />
        <span className={`text-[13px] ${t3} tabular-nums`}>{allPages.filter((p) => pattern.trim() && matches(pattern, p.path)).length} pages</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onDelete} aria-label={`Delete ${t.name || 'page type'}`} className="grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><Trash2 size={14} aria-hidden /></button>
          <button type="button" onClick={() => (startEditing ? onDelete() : setEdit(false))} className="h-8 rounded-md px-2.5 text-[13px] font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
          <button type="button" onClick={save} disabled={!name.trim() || !pattern.trim()} className="h-8 rounded-md bg-ink px-3 text-[13px] font-medium text-on-ink outline-none hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">Save</button>
        </span>
      </li>
    )
  }
  return (
    <li className="flex h-16 items-center gap-3 px-5">
      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{t.name}</span>
      <code className="shrink-0 rounded-md bg-tint px-2 py-1 font-mono text-[12px] leading-4 text-stone-900">{t.pattern}</code>
      <span className={`w-20 shrink-0 text-right text-[13px] leading-[18px] ${t3} tabular-nums`}>{count} {count === 1 ? 'page' : 'pages'}</span>
      <button type="button" onClick={() => setEdit(true)} aria-label={`Edit ${t.name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><Pencil size={14} aria-hidden /></button>
    </li>
  )
}

export default function SettingsTab({ onRun, running, lastRun }) {
  const s = useSettings()
  const [savedKey, flash] = useSaved()
  const set = (patch, key) => { saveSettings(patch); flash(key) }
  const [sitemap, setSitemap] = useState(s.sitemap)
  const [testing, setTesting] = useState(false)
  const [newType, setNewType] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  // mock check: a .xml URL on the site is "found", anything else isn't reachable
  const test = () => {
    setTesting(true)
    timer.current = setTimeout(() => {
      let ok = false
      try { const u = new URL(sitemap); ok = u.hostname.replace(/^www\./, '') === SD.domain && u.pathname.endsWith('.xml') } catch { /* not a URL */ }
      set({ sitemap, sitemapCheck: ok ? { ok: true, count: 52 } : { ok: false } }, 'sitemap')
      setTesting(false)
    }, 700)
  }
  const groups = groupPages(s.pageTypes, allPages)
  const countOf = (id) => groups.find((g) => g.id === id)?.pages.length ?? 0
  const run = SD.runs[0]
  const sched = s.schedule

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <SettingsCard title="Crawl" description="How Kraffic finds the pages to analyze. Changes apply on the next run.">
          <Row name="Sitemap URL" meta="Only used if robots.txt has no sitemap" saved={savedKey === 'sitemap'} top>
            <span className="flex items-center gap-3">
              <input aria-label="Sitemap URL" value={sitemap} onChange={(e) => setSitemap(e.target.value)} placeholder={`https://${SD.domain}/sitemap.xml`}
                onBlur={() => { if (sitemap.trim() !== s.sitemap) set({ sitemap: sitemap.trim(), sitemapCheck: null }, 'sitemap') }}
                onKeyDown={(e) => { if (e.key === 'Enter') test() }}
                className={`${input} w-96 max-w-[50vw]`} />
              <button type="button" onClick={test} disabled={testing || !sitemap.trim()} className={textBtn}>{testing ? 'Testing…' : 'Test'}</button>
            </span>
            {s.sitemapCheck && (
              <span className={`flex items-center gap-1.5 text-[13px] leading-[18px] ${s.sitemapCheck.ok ? 'text-stone-900' : 'text-negative'}`} role="status">
                {s.sitemapCheck.ok ? <><Check size={14} className="text-ink" aria-hidden />Found {s.sitemapCheck.count} URLs</> : <><AlertCircle size={14} aria-hidden />Not reachable</>}
              </span>
            )}
          </Row>
          <Row name="Max pages" meta="Larger crawls take longer" saved={savedKey === 'max'}>
            <Segmented label="Max pages" size="sm" value={s.maxPages} onChange={(v) => set({ maxPages: v }, 'max')} options={[25, 50, 100, 200].map((n) => ({ value: n, label: String(n) }))} />
          </Row>
          <Row name="Include paths" meta="Only crawl these (empty = the whole site)" saved={savedKey === 'include'} top>
            <PathChips label="Include paths" value={s.include} onChange={(v) => set({ include: v }, 'include')} />
          </Row>
          <Row name="Exclude paths" meta="Never crawl these" saved={savedKey === 'exclude'} top>
            <PathChips label="Exclude paths" value={s.exclude} onChange={(v) => set({ exclude: v }, 'exclude')} />
          </Row>
        </SettingsCard>

        <SettingsCard title="Page types" description="How Kraffic groups your pages. These rules are the rows of the Coverage map.">
          {s.pageTypes.map((t) => (
            <PageTypeRow key={t.id} t={t} count={countOf(t.id)}
              onSave={(next) => set({ pageTypes: s.pageTypes.map((x) => (x.id === t.id ? next : x)) }, 'types')}
              onDelete={() => set({ pageTypes: s.pageTypes.filter((x) => x.id !== t.id) }, 'types')} />
          ))}
          {newType && (
            <PageTypeRow key={newType.id} t={newType} count={0} startEditing
              onSave={(next) => { set({ pageTypes: [...s.pageTypes, next] }, 'types'); setNewType(null) }}
              onDelete={() => setNewType(null)} />
          )}
          <li className="flex h-12 items-center justify-between px-5">
            <button type="button" onClick={() => setNewType({ id: `custom-${Date.now()}`, name: '', pattern: '' })} disabled={Boolean(newType)} className={textBtn}>
              <Plus size={14} aria-hidden />Add page type
            </button>
            <Saved show={savedKey === 'types'} />
          </li>
        </SettingsCard>

        <SettingsCard title="Schedule">
          <Row name="Auto re-run" meta={sched.auto ? `Next run ${nextRun(sched)}` : 'Off · runs only when you press Re-run'} saved={savedKey === 'schedule'}>
            <span className="flex items-center gap-3">
              {sched.auto && (
                <>
                  <Segmented label="How often" size="sm" value={sched.freq}
                    onChange={(v) => set({ schedule: { ...sched, freq: v, day: v === 'weekly' ? 1 : 1 } }, 'schedule')}
                    options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
                  <select aria-label={sched.freq === 'weekly' ? 'Day of the week' : 'Day of the month'} value={sched.day}
                    onChange={(e) => set({ schedule: { ...sched, day: Number(e.target.value) } }, 'schedule')}
                    className="h-8 rounded-md border border-line bg-raised px-2 text-[13px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    {sched.freq === 'weekly'
                      ? [1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)
                      : Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}
                  </select>
                </>
              )}
              <Switch size="sm" checked={sched.auto} onChange={(v) => set({ schedule: { ...sched, auto: v } }, 'schedule')} aria-label="Auto re-run" />
            </span>
          </Row>
        </SettingsCard>

        <SettingsCard title="Alerts">
          <Row name="Email me when a schema breaks" meta={RECIPIENT} saved={savedKey === 'breaks'}>
            <Switch size="sm" checked={s.alerts.breaks} onChange={(v) => set({ alerts: { ...s.alerts, breaks: v } }, 'breaks')} aria-label="Email me when a schema breaks" />
          </Row>
          <Row name="Email me when coverage drops by 10% or more" meta={RECIPIENT} saved={savedKey === 'drops'}>
            <Switch size="sm" checked={s.alerts.drops} onChange={(v) => set({ alerts: { ...s.alerts, drops: v } }, 'drops')} aria-label="Email me when coverage drops by 10% or more" />
          </Row>
        </SettingsCard>
      </div>

      {/* the last run */}
      <Card className="p-5 lg:sticky lg:top-6">
        <div className={`text-[13px] leading-[18px] ${t2}`}>Last run</div>
        <div className="mt-1 text-[15px] leading-5 font-semibold text-stone-900 tabular-nums">{running ? 'Running…' : `${lastRun} · ${lastRun === run.date ? run.time : new Date().toTimeString().slice(0, 5)}`}</div>
        <div className={`mt-0.5 text-[13px] leading-[18px] ${t2} tabular-nums`}>Took {run.took} · {run.pages} pages</div>
        <ul className="mt-4 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          {[['Pages crawled', run.pages], ['Errors', run.errors], ['Skipped', run.skipped]].map(([k, v]) => (
            <li key={k} className="flex h-10 items-center justify-between text-[14px] leading-5 tabular-nums">
              <span className={t2}>{k}</span><span className="font-semibold text-stone-900">{v}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onRun} disabled={running}
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-ink text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60">
          <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />Re-run now
        </button>
        <button type="button" onClick={() => openDrawer('runs', 'all')} className={`${textBtn} mt-3`}>View run history <ArrowRight size={14} aria-hidden /></button>
      </Card>
      <RunHistory />
    </div>
  )
}

// ?runs=all: past runs, newest first. The lookup must return the same object each render (the drawer keeps it in state).
const RUNS_ITEM = { id: 'runs' }
const findRuns = () => RUNS_ITEM
function RunHistory() {
  const drawer = useDrawer('runs', findRuns)
  if (!drawer.item) return null
  return (
    <DrawerShell drawer={drawer} title="Run history" meta={<span>Last {SD.runs.length} runs of {SD.domain}</span>}>
      <table className="mt-4 w-full text-[14px] leading-5 tabular-nums">
        <thead>
          <tr className="h-9 border-b border-[var(--div)] text-left text-[13px] font-medium text-stone-500">
            <th className="font-medium">Run</th><th className="text-right font-medium">Pages</th><th className="text-right font-medium">Errors</th><th className="text-right font-medium">Valid schemas</th><th className="text-right font-medium">Took</th>
          </tr>
        </thead>
        <tbody>
          {SD.runs.map((r, i) => (
            <tr key={r.date} className="h-11 border-b border-[var(--div)] last:border-0">
              <td className="text-stone-900">{r.date} <span className={t3}>· {r.time}</span>{i === 0 && <span className={`ml-2 text-[12px] ${t3}`}>Latest</span>}</td>
              <td className="text-right text-stone-900">{r.pages}{r.skipped > 0 && <span className={`ml-1 text-[12px] ${t3}`}>({r.skipped} skipped)</span>}</td>
              <td className={`text-right ${r.errors ? 'text-negative' : 'text-stone-900'}`}>{r.errors}</td>
              <td className="text-right text-stone-900">{r.valid} of {r.of}</td>
              <td className={`text-right ${t2}`}>{r.took}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DrawerShell>
  )
}
