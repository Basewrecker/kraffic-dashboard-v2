import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, ChevronRight, Copy, Sparkles, Wrench } from 'lucide-react'
import { CATEGORIES, IMPACT, STATUS, groupBySection, sectionLabel, SLOW_MS } from '../../data/audit'
import DrawerShell, { Dot, useDrawer } from './DrawerShell'
import { useAudit } from './context'
import { auditActions } from '../../data/mock'
import { CheckIcon, HBar, StatusLabel, fmtMs, plural, swapDrawer } from './parts'

const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const PREVIEW = 5
const inkBtn = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-3.5 text-[13px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const lineBtn = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
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
// the tinted stat strip under a drawer's header: 2–3 cells split by hairlines
function StatStrip({ cells }) {
  return (
    <div className={`mt-5 grid divide-x divide-[var(--div)] rounded-lg bg-tint p-4 ${cells.length === 3 ? 'grid-cols-3' : cells.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {cells.map((c, i) => (
        <div key={c.label} className={`min-w-0 ${i ? 'pl-4' : ''} ${i < cells.length - 1 ? 'pr-4' : ''}`}>
          <div className={`text-[13px] leading-[18px] ${t2}`}>{c.label}</div>
          <div className="mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
const big = 'whitespace-nowrap text-[18px] leading-8 font-semibold text-stone-900 tabular-nums md:text-[22px]'

// Check drawer (?check=, pushed so Back closes it): one check, from any tab. Mark as fixed only with auditActions.canMarkFixed.
export default function AuditDrawer() {
  const { a, fixed, toggleFixed } = useAudit()
  const drawer = useDrawer('check', a.checkById)
  const c = drawer.item
  const [all, setAll] = useState(false)
  const [copied, copy] = useCopy()
  useEffect(() => setAll(false), [c?.id])
  if (!c) return null

  const passing = c.status === 'pass'
  const isFixed = fixed.has(c.id)
  const n = c.pages.length
  const groups = groupBySection(c.pages)
  const top = groups[0]
  const copyUrls = () => copy(c.pages.map((p) => `https://${a.domain}${p}`).join('\n'))
  // the first 5 rows across the groups, or all of them
  let budget = all ? Infinity : PREVIEW
  const shown = groups.map((g) => { const take = g.paths.slice(0, Math.max(0, budget)); budget -= take.length; return { ...g, take } }).filter((g) => g.take.length)

  return (
    <DrawerShell
      drawer={drawer}
      title={c.label}
      meta={(
        <span className="flex flex-wrap items-center gap-2">
          <StatusLabel status={c.status} /><Dot />
          <span>{CATEGORIES[c.category]}</span>
          {c.impact && <><Dot /><span>{IMPACT[c.impact].label} impact</span></>}
        </span>
      )}
      footer={!passing && auditActions.canMarkFixed && (
        <>
          <span className={t3}>{isFixed ? 'Marked as fixed. We’ll verify on the next run.' : 'Fixed it? We’ll check again on the next run.'}</span>
          {isFixed
            ? <button type="button" onClick={() => toggleFixed(c.id)} className={lineBtn}>Undo</button>
            : <button type="button" onClick={() => toggleFixed(c.id)} className={inkBtn}><Check size={14} aria-hidden />Mark as fixed</button>}
        </>
      )}
    >
      {!passing && c.pageBased && n > 0 && (
        <StatStrip cells={[
          {
            label: 'Pages affected',
            value: (
              <>
                <div className="flex items-baseline gap-1.5"><span className={big}>{n}</span><span className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>of {a.pages.length}</span></div>
                <HBar value={n} max={a.pages.length} className="mt-2 w-full" />
              </>
            ),
          },
          {
            label: 'Most affected section',
            value: (
              <>
                <div className="truncate text-[15px] leading-8 font-medium text-stone-900">{sectionLabel(top.section)}</div>
                <div className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>{plural(top.paths.length, 'page')} here</div>
              </>
            ),
          },
        ]} />
      )}
      {!passing && !c.pageBased && (
        <p className={`mt-5 rounded-lg bg-tint p-4 text-[13px] leading-[18px] ${t2}`}>Site-wide check: it’s about the site as a whole, not individual pages.</p>
      )}

      <div className="mt-6 divide-y divide-[var(--div)] border-t border-[var(--div)]">
        <Section icon={passing ? Check : AlertCircle} title={passing ? 'Result' : 'What’s wrong'}><p>{c.finding}.</p></Section>
        {c.why && <Section icon={Sparkles} title="Why it matters for AI"><p>{c.why}</p></Section>}
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

      {!passing && n > 0 && (
        <section className="border-t border-[var(--div)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Affected pages</h3>
            <button type="button" onClick={copyUrls} className={textBtn}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? 'Copied' : 'Copy URLs'}</button>
          </div>
          {shown.map((g) => (
            <div key={g.section} className="mt-3">
              <div className={`text-[13px] leading-[18px] font-semibold ${t2}`}>{sectionLabel(g.section)}</div>
              <ul className="mt-1">
                {g.take.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => swapDrawer('check', 'page', p)}
                      className="group -mx-2 flex h-10 w-[calc(100%+16px)] items-center gap-2 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{p}</span>
                      <ChevronRight size={14} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 touch:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {n > PREVIEW && (
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={`${textBtn} mt-3`}>
              {all ? 'Show fewer' : 'Show all'}
            </button>
          )}
        </section>
      )}
    </DrawerShell>
  )
}

// Page drawer (?page=<path>): every check on one URL, grouped Failing / Needs work / Passing.
// A check swaps the Check drawer in (never stacks).
export function PageDrawer() {
  const { a } = useAudit()
  const drawer = useDrawer('page', a.pageByPath)
  const p = drawer.item
  if (!p) return null
  const groups = ['fail', 'warn', 'pass'].map((s) => ({ s, list: p.checks.filter((c) => c.pageStatus === s) })).filter((g) => g.list.length)
  const checked = p.code === 200
  return (
    <DrawerShell
      drawer={drawer}
      title={p.path}
      meta={(
        <span className="flex flex-wrap items-center gap-2">
          <span>{p.type}</span><Dot />
          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
            Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </span>
      )}
    >
      {/* only the numbers known for this page */}
      <StatStrip cells={[
        p.ms != null && { label: 'Load time', value: <span className={`${big} ${p.ms > SLOW_MS ? '!text-negative' : ''}`}>{fmtMs(p.ms)}</span> },
        p.depth != null && { label: 'Depth', value: <span className={big}>{p.depth} <span className={`text-[13px] font-normal ${t3}`}>{p.depth === 1 ? 'click' : 'clicks'}</span></span> },
        p.code != null && { label: 'Status', value: <span className={`${big} ${p.code >= 400 ? '!text-negative' : ''}`}>{p.code}</span> },
      ].filter(Boolean)} />

      {!checked ? (
        <p className={`mt-6 text-[14px] leading-[22px] ${t2}`}>{p.code >= 400 ? 'This page returns an error, so its content wasn’t checked.' : 'This address redirects, so its content wasn’t checked.'}</p>
      ) : !groups.length ? (
        <p className={`mt-6 flex items-center gap-2 text-[14px] leading-5 ${t2}`}><CheckIcon status="pass" />No check fails on this page.</p>
      ) : groups.map((g) => (
        <section key={g.s} className="mt-6">
          <h3 className={`text-[13px] leading-[18px] font-semibold ${t2}`}>{STATUS[g.s].label}</h3>
          <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
            {g.list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => swapDrawer('page', 'check', c.id)}
                  className="group -mx-2 flex h-11 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                  <CheckIcon status={g.s} />
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{c.label}</span>
                  {c.impact && <span className={`shrink-0 text-[13px] leading-[18px] ${t2}`}>{IMPACT[c.impact].label}</span>}
                  <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </DrawerShell>
  )
}

// Status-code drawer (?codes=2xx|3xx|4xx|5xx): every address in one class — path, code, redirect target.
// A row swaps the Page drawer in.
const CODE_NOTES = {
  '2xx': 'These load normally for crawlers.',
  '3xx': 'These addresses send crawlers somewhere else. Link straight to the final URL.',
  '4xx': 'Crawlers get an error page instead of content. Redirect them or remove the links.',
  '5xx': 'The server failed while answering. Crawlers will retry, then give up.',
}
export function CodesDrawer() {
  const { a } = useAudit()
  const drawer = useDrawer('codes', a.codeGroup)
  const g = drawer.item
  if (!g) return null
  const n = g.count
  return (
    <DrawerShell
      drawer={drawer}
      title={`${n} ${n === 1 ? 'page returns' : 'pages return'} ${g.name}`}
      meta={<span>{g.id} · {g.id === '2xx' ? 'loads' : g.id === '3xx' ? 'redirects' : 'error'}</span>}
    >
      <p className={`mt-4 text-[14px] leading-[22px] ${t2}`}>{CODE_NOTES[g.id]}</p>
      <ul className="mt-3 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {g.pages.map((p) => (
          <li key={p.path}>
            <button type="button" onClick={() => swapDrawer('codes', 'page', p.path)}
              className="group -mx-2 grid h-11 w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
              <span className="min-w-0 truncate text-[14px] leading-5 text-stone-900" title={p.path}>
                {p.path}{p.redirectTo && <span className={t3}> → {p.redirectTo}</span>}
              </span>
              <span className={`text-[13px] leading-[18px] tabular-nums ${p.code >= 400 ? 'text-negative' : t2}`}>{p.code}</span>
              <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </DrawerShell>
  )
}
