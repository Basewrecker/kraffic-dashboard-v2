import { useEffect, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import Segmented from '../dashboard/Segmented'
import Switch from '../ui/Switch'
import { SD, crawlActions } from '../../data/structuredData'
import { WEEKDAYS, nextRun, saveSettings, useSettings } from './settings'

// Settings tab: settings cards (Tracking page row style, autosave with a "Saved" tick by the row), only the rows the
// app can save (crawlSettings()). Pages to crawl lives in Re-run's menu; the last run's numbers in the header meta.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const textBtn = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50'
const input = 'h-9 rounded-lg border border-line bg-raised px-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400'

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
// stack: phones put the label above a wide control (inputs, chip lists, segmented rows); toggles stay on the right
function Row({ name, meta, saved, children, top = false, stack = top }) {
  return (
    <li className={`flex min-h-16 justify-between gap-6 px-5 py-3 ${top ? 'items-start' : 'items-center'} ${stack ? 'max-md:flex-col max-md:items-stretch max-md:gap-3' : ''}`}>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] leading-5 font-medium text-stone-900">{name}<Saved show={saved} /></span>
        {meta && <span className={`block text-[13px] leading-[18px] ${t3}`}>{meta}</span>}
      </span>
      <span className={`flex min-w-0 shrink-0 flex-col items-end gap-1.5 ${stack ? 'max-md:items-stretch' : ''}`}>{children}</span>
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
    <span className="flex max-w-[420px] flex-wrap items-center justify-end gap-1.5 max-md:max-w-none max-md:justify-start">
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


// the crawl settings a backend can save, besides Pages to crawl (that one is in Re-run's menu). The tab exists only
// when there are 2 or more: one setting alone isn't worth a tab.
export const crawlSettings = () => (crawlActions.canEditCrawlSettings ? ['sitemap', 'include', 'exclude', 'schedule', 'alerts'] : [])

export default function SettingsTab() {
  const s = useSettings()
  const [savedKey, flash] = useSaved()
  const set = (patch, key) => { saveSettings(patch); flash(key) }
  const [sitemap, setSitemap] = useState(s.sitemap)
  const has = new Set(crawlSettings())
  const sched = s.schedule

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
      {(has.has('sitemap') || has.has('include') || has.has('exclude')) && (
        <SettingsCard title="Crawl" description="How Kraffic finds the pages to analyze. Changes apply on the next run.">
          {has.has('sitemap') && (
            <Row name="Sitemap URL" meta="Only used if robots.txt has no sitemap" saved={savedKey === 'sitemap'} top>
              <input aria-label="Sitemap URL" value={sitemap} onChange={(e) => setSitemap(e.target.value)} placeholder={`https://${SD.domain}/sitemap.xml`}
                onBlur={() => { if (sitemap.trim() !== s.sitemap) set({ sitemap: sitemap.trim() }, 'sitemap') }}
                className={`${input} w-96 max-w-[50vw] max-md:h-10 max-md:min-w-0 max-md:max-w-none max-md:flex-1`} />
            </Row>
          )}
          {has.has('include') && (
            <Row name="Include paths" meta="Only crawl these (empty = the whole site)" saved={savedKey === 'include'} top>
              <PathChips label="Include paths" value={s.include} onChange={(v) => set({ include: v }, 'include')} />
            </Row>
          )}
          {has.has('exclude') && (
            <Row name="Exclude paths" meta="Never crawl these" saved={savedKey === 'exclude'} top>
              <PathChips label="Exclude paths" value={s.exclude} onChange={(v) => set({ exclude: v }, 'exclude')} />
            </Row>
          )}
        </SettingsCard>
      )}

      {has.has('schedule') && (
        <SettingsCard title="Schedule">
          <Row name="Auto re-run" meta={sched.auto ? `Next run ${nextRun(sched)}` : 'Off · runs only when you press Re-run'} saved={savedKey === 'schedule'} stack>
            <span className="flex items-center gap-3 max-md:flex-wrap">
              {sched.auto && (
                <>
                  <Segmented label="How often" size="sm" value={sched.freq}
                    onChange={(v) => set({ schedule: { ...sched, freq: v, day: 1 } }, 'schedule')}
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
      )}

      {has.has('alerts') && (
        <SettingsCard title="Alerts">
          <Row name="Email me when a schema breaks" meta="To the account owner" saved={savedKey === 'breaks'}>
            <Switch size="sm" checked={s.alerts.breaks} onChange={(v) => set({ alerts: { ...s.alerts, breaks: v } }, 'breaks')} aria-label="Email me when a schema breaks" />
          </Row>
          <Row name="Email me when coverage drops by 10% or more" meta="To the account owner" saved={savedKey === 'drops'}>
            <Switch size="sm" checked={s.alerts.drops} onChange={(v) => set({ alerts: { ...s.alerts, drops: v } }, 'drops')} aria-label="Email me when coverage drops by 10% or more" />
          </Row>
        </SettingsCard>
      )}
    </div>
  )
}
