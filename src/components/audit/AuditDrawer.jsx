import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, ChevronRight, Copy, Download, Sparkles, Wrench } from 'lucide-react'
import { downloadCsv } from '../dashboard/csv'
import { AUDIT, CATEGORIES, IMPACT, PAGE_COUNT, STATUS, checkById, groupBySection, pageByPath } from '../../data/audit'
import DrawerShell, { Dot, SectionTitle, useDrawer } from './DrawerShell'
import { CheckIcon, ImpactMeter, StatusLabel, pct, plural, swapDrawer } from './parts'

const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`)
const PREVIEW = 5
const lineBtn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const textBtn = 'inline-flex items-center gap-1.5 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'

// "Copy URLs" → "Copied" for 1.5s
function useCopy() {
  const [done, setDone] = useState(false)
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1500); return () => clearTimeout(t) }, [done])
  return [done, (text) => { navigator.clipboard?.writeText(text).catch(() => {}); setDone(true) }]
}

// a section: 28px tint box with its icon, title 14/600; body indented under the title
function Section({ icon: Icon, title, children }) {
  return (
    <section className="py-5">
      <h3 className="flex items-center gap-3 text-[14px] leading-5 font-semibold text-stone-900">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-tint text-stone-700" aria-hidden><Icon size={16} /></span>
        {title}
      </h3>
      <div className="mt-2 pl-10 text-[14px] leading-[1.6] text-stone-600">{children}</div>
    </section>
  )
}

// Check drawer (?check=, pushed so Back closes it): one check from the merged list, from any tab.
export default function AuditDrawer() {
  const drawer = useDrawer('check', checkById)
  const c = drawer.item
  const [all, setAll] = useState(false)
  const [copied, copy] = useCopy()
  useEffect(() => setAll(false), [c?.id])
  if (!c) return null

  const passing = c.status === 'pass'
  const n = c.pages.length
  const groups = groupBySection(c.pages)
  const top = groups[0]
  const urls = c.pages.map((p) => `https://${AUDIT.domain}${p}`)
  const copyUrls = () => copy(urls.join('\n'))
  const exportPages = () => downloadCsv(`audit-${c.id}.csv`, c.pages.map((p) => ({ path: p })), [
    { label: 'Check', csv: () => c.name },
    { label: 'Status', csv: () => STATUS[c.status].label },
    { label: 'Page', key: 'path' },
    { label: 'URL', csv: (r) => `https://${AUDIT.domain}${r.path}` },
  ])
  // the first 5 rows across the groups, or all of them
  let budget = all ? Infinity : PREVIEW
  const shown = groups.map((g) => { const take = g.paths.slice(0, Math.max(0, budget)); budget -= take.length; return { ...g, take } }).filter((g) => g.take.length)

  return (
    <DrawerShell
      drawer={drawer}
      title={c.name}
      meta={(
        <span className="flex flex-wrap items-center gap-3">
          <StatusLabel status={c.status} /><Dot />
          <span>{CATEGORIES[c.category]}</span><Dot />
          <span className="inline-flex items-center gap-1.5"><ImpactMeter impact={c.impact} />{IMPACT[c.impact].label} impact</span>
        </span>
      )}
      footer={!passing && (
        <>
          <span />
          <span className="flex items-center gap-2">
            <button type="button" onClick={copyUrls} className={lineBtn}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? 'Copied' : 'Copy URLs'}</button>
            <button type="button" onClick={exportPages} className={lineBtn}><Download size={14} aria-hidden /> Export CSV</button>
          </span>
        </>
      )}
    >
      {!passing && (
        <div className="mt-5 grid grid-cols-2 divide-x divide-[var(--div)] rounded-lg bg-tint p-4">
          <div className="min-w-0 pr-4">
            <div className="text-[13px] leading-[18px] text-stone-600">Pages affected</div>
            <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
              <span className="text-[24px] leading-8 font-semibold text-stone-900">{n}</span>
              <span className="text-[13px] leading-[18px] text-stone-500">of {PAGE_COUNT}</span>
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--data-track)]" role="img" aria-label={`${pct(n)}% of pages`}>
              <span className="block h-full rounded-full bg-ink" style={{ width: `${(n / PAGE_COUNT) * 100}%` }} />
            </span>
          </div>
          <div className="min-w-0 pl-4">
            <div className="text-[13px] leading-[18px] text-stone-600">Most affected</div>
            <div className="mt-1 truncate text-[14px] leading-8 font-medium text-stone-900">{top.section === '/' ? 'Home page' : top.section}</div>
            <div className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{top.paths.length} of {n} {n === 1 ? 'page' : 'pages'}</div>
          </div>
        </div>
      )}

      <div className="mt-6 divide-y divide-[var(--div)] border-t border-[var(--div)]">
        <Section icon={passing ? Check : AlertCircle} title={passing ? 'Result' : 'What’s wrong'}><p>{c.finding}.</p></Section>
        <Section icon={Sparkles} title="Why it matters for AI"><p>{c.why}</p></Section>
        <Section icon={Wrench} title={passing ? 'Keep it that way' : 'How to fix'}>
          <ol>
            {c.fix.map((step, i) => (
              <li key={i} className="mb-3 flex gap-3 last:mb-0">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-[12px] leading-none font-semibold text-stone-700 tabular-nums">{i + 1}</span>
                <span className="min-w-0 text-stone-900">{step}</span>
              </li>
            ))}
          </ol>
          {c.example && (
            <>
              <div className="mt-4 text-[13px] leading-[18px] font-semibold text-stone-900">Example</div>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre rounded-md bg-tint p-3 font-mono text-[13px] leading-5 text-stone-900">{c.example}</pre>
            </>
          )}
        </Section>
      </div>

      {!passing && (
        <section className="border-t border-[var(--div)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Affected pages <span className="font-normal text-stone-500 tabular-nums">{n}</span></h3>
            <button type="button" onClick={copyUrls} className={textBtn}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? 'Copied' : 'Copy URLs'}</button>
          </div>
          {shown.map((g) => (
            <div key={g.section} className="mt-3">
              <div className="text-[13px] leading-[18px] font-semibold text-stone-600 tabular-nums">{g.section} <span className="font-normal text-stone-500">{g.paths.length}</span></div>
              <ul className="mt-1">
                {g.take.map((p) => (
                  <li key={p}>
                    <a href={`https://${AUDIT.domain}${p}`} target="_blank" rel="noreferrer"
                      className="group -mx-2 flex h-10 items-center gap-2 rounded-md px-2 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{p}</span>
                      <ArrowUpRight size={14} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {n > PREVIEW && (
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={`${textBtn} mt-3`}>
              {all ? 'Show fewer' : `Show all ${n}`}
            </button>
          )}
        </section>
      )}
    </DrawerShell>
  )
}

// Page drawer (?page=<path>): the open checks on one URL. A check swaps the Check drawer in (never stacks).
export function PageDrawer() {
  const drawer = useDrawer('page', pageByPath)
  const p = drawer.item
  if (!p) return null
  const fails = p.checks.filter((c) => c.status === 'fail').length
  return (
    <DrawerShell
      drawer={drawer}
      title={p.path}
      meta={<><span>{plural(p.checks.length, 'problem')}</span>{fails > 0 && <><Dot /><span className="text-negative">{fails} failing</span></>}<Dot /><span className={p.ms >= 1000 ? 'text-negative' : undefined}>Loads in {fmtMs(p.ms)}</span></>}
      footer={(
        <a href={`https://${AUDIT.domain}${p.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded text-stone-600 underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">
          Open page <ArrowUpRight size={14} aria-hidden />
        </a>
      )}
    >
      <SectionTitle>Checks this page fails</SectionTitle>
      {p.checks.length === 0 ? (
        <p className="mt-1.5 text-[14px] leading-[22px] text-stone-600">Nothing to fix on this page.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          {p.checks.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => swapDrawer('page', 'check', c.id)}
                className="group -mx-2 flex h-14 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                <CheckIcon status={c.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{c.name}</span>
                  <span className="block truncate text-[13px] leading-[18px] text-stone-500">{c.finding}</span>
                </span>
                <ImpactMeter impact={c.impact} />
                <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  )
}
