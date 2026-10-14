import { useEffect, useState } from 'react'
import { Bell, FileSearch, FlaskConical, Library, Plug, Presentation, Route, ShieldAlert, Wallet } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import { useToast } from '../../components/dashboard/overlays'
import { useParams } from '../../components/audit/parts'
import { useIsMobile } from '../../hooks/useMedia'
import { account } from '../../data/mock'
import { navigate } from '../../router'
import { SECTIONS, toolkitView } from './toolkit'

// /more-tools — "Toolkit": what needs attention first, then every tool as one table row with its latest result.
// ?mock=new (new project) | healthy (nothing needs attention); default = the full demo project.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const ICONS = { plug: Plug, wallet: Wallet, 'file-search': FileSearch, library: Library, 'shield-alert': ShieldAlert, bell: Bell, route: Route, flask: FlaskConical, presentation: Presentation }
const inkBtn = 'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-ink px-3 text-[13px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const lineBtn = 'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const CAT_KEY = `kraffic:toolkit:category:${account.domain}`
const readCat = () => { try { return localStorage.getItem(CAT_KEY) ?? 'all' } catch { return 'all' } }

const Tile = ({ icon }) => { const Icon = ICONS[icon]; return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint text-ink" aria-hidden><Icon size={16} /></span> }

export default function ToolkitPage() {
  useEffect(() => { document.title = 'Toolkit · Kraffic' }, [])
  const q = useParams()
  const view = toolkitView(q.get('mock') ?? 'full')
  const [toastNode, toast] = useToast({ position: 'center' })
  // open a tool: Site Kit has a page; the others aren't designed in the mock yet
  const open = (t) => (t.href ? navigate(t.href) : toast(t.movedTo ? `${t.name} is part of ${t.movedTo}, designed in Phase 7` : `${t.name} isn’t designed in the mock yet`))
  return (
    <>
      <div>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Toolkit</h1>
        <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>Tools that help AI engines find and trust {account.name}.</p>
      </div>
      {view.attention.length > 0 && <Attention rows={view.attention} open={open} />}
      <AllTools tools={view.tools} open={open} />
      {toastNode}
    </>
  )
}

// ---- Needs attention: up to 3 rows — not connected → new findings → never run
function Attention({ rows, open }) {
  return (
    <Card className="px-5 pt-5 pb-2 max-md:px-4">
      <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Needs attention</h2>
      <ul className="mt-2 divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={r.tool.id} className="grid min-h-12 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 py-2 max-md:grid-cols-[32px_minmax(0,1fr)] max-md:items-start">
            <Tile icon={r.tool.icon} />
            <p className="text-[14px] leading-5 text-stone-900 max-md:pt-1.5">{r.sentence}</p>
            <button type="button" onClick={() => open(r.tool)} className={`${r.button === 'Connect' ? inkBtn : lineBtn} max-md:col-start-2 max-md:justify-self-start`}>{r.button}</button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---- All tools: category chips (saved per project) + one row per tool
function AllTools({ tools, open }) {
  const mobile = useIsMobile()
  const [cat, setCat] = useState(readCat)
  const pick = (c) => { setCat(c); try { localStorage.setItem(CAT_KEY, c) } catch { /* private mode */ } }
  const rows = tools.filter((t) => cat === 'all' || t.section === cat)
  const chip = (on) => `inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink bg-ink text-on-ink' : 'border-transparent bg-tint text-stone-700 hover:text-stone-900'}`
  const resultCls = (t) => (t.result.tone === 'problem' ? 'text-negative' : t.result.tone === 'muted' ? t3 : 'text-stone-900')
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 max-md:px-4">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">All tools</h2>
        <div role="toolbar" aria-label="Category" className="no-scrollbar flex gap-1.5 overflow-x-auto max-md:-mx-4 max-md:w-[calc(100%+32px)] max-md:px-4">
          {[['all', `All ${tools.length}`], ...SECTIONS.map((s) => [s, s])].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={cat === v} onClick={() => pick(v)} className={chip(cat === v)}>{l}</button>
          ))}
        </div>
      </div>
      {mobile ? (
        <ul className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
          {rows.map((t) => (
            <li key={t.id}>
              <div role="button" tabIndex={0} onClick={() => open(t)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(t) }}
                className="flex flex-col gap-1 px-4 py-3 outline-none active:bg-tint focus-visible:bg-tint">
                <span className="flex items-center gap-3">
                  <Tile icon={t.icon} />
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{t.name}</span>
                  <span className="shrink-0 text-[13px] font-medium text-stone-900">{t.action}</span>
                </span>
                <span className="flex items-center gap-1.5 pl-11 text-[13px] leading-[18px] tabular-nums">
                  <span className={`truncate ${resultCls(t)}`}>{t.result.text}</span>
                  {t.when && <><span className="text-stone-400" aria-hidden>·</span><span className={`shrink-0 ${t3}`}>{t.when}</span></>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full table-fixed">
          <thead>
            <tr className="h-9 border-y border-[var(--div)] bg-tint text-left text-[13px] leading-5 font-medium text-stone-500">
              <th className="w-[64px] pl-5 pr-3"><span className="sr-only">Icon</span></th>
              <th className="w-[220px] px-3 font-medium">Tool</th>
              <th className="px-3 font-medium">What it does</th>
              <th className="w-[220px] px-3 font-medium">Latest result</th>
              <th className="w-[110px] px-3 font-medium">When</th>
              <th className="w-[96px] pl-3 pr-5 text-right font-medium"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} tabIndex={0} onClick={() => open(t)} onKeyDown={(e) => { if (e.key === 'Enter') open(t) }}
                aria-label={`${t.name}: ${t.result.text}. ${t.action}`}
                className="group h-14 cursor-pointer border-b border-[var(--div)] outline-none transition-colors duration-150 last:border-0 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                <td className="pl-5 pr-3"><Tile icon={t.icon} /></td>
                <td className="truncate px-3 text-[14px] leading-5 font-medium text-stone-900">{t.name}</td>
                <td className={`px-3 text-[13px] leading-[18px] ${t2} max-[1279px]:truncate`} title={t.desc}>{t.desc}</td>
                <td className={`truncate px-3 text-[14px] leading-5 tabular-nums ${resultCls(t)}`} title={t.result.text}>{t.result.text}</td>
                <td className={`px-3 text-[13px] leading-[18px] ${t3} tabular-nums`}>{t.when ?? '—'}</td>
                <td className="pl-3 pr-5 text-right">
                  <span className="inline-flex h-8 items-center rounded-md px-2 text-[13px] font-medium text-stone-900 transition-colors duration-150 group-hover:bg-[var(--color-line)]">{t.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
