import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, ChevronRight, Library, Link2, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Segmented from '../../components/dashboard/Segmented'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { HBar, openDrawer, setParams, useParams } from '../../components/audit/parts'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import ToolPage, { cardTitle, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { evidenceStates } from '../../data/mock'

// /more-tools/evidence — the claims your site makes and the sources that back them.
// Production: evidence module (GET evidence/vault → CentralEvidenceItem, POST evidence/sync). GAP: backed / weak /
// unbacked (mapped from confidenceTier: HIGH → backed, MEDIUM/LOW → weak, UNVERIFIED → unbacked), several sources per
// claim with titles, the page a claim is on. No "add a source" endpoint, so there's no Add a source form.
// ?mock=none|running|error|full (default full).
const STATUS = { HIGH: 'backed', MEDIUM: 'weak', LOW: 'weak', UNVERIFIED: 'unbacked' }
const WORD = { backed: 'Backed', weak: 'Weak', unbacked: 'Unbacked' }
const pathOf = (url) => { try { return new URL(url).pathname } catch { return url } }
const head = `hidden h-9 items-center gap-3 border-y border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} md:grid`
const COLS = 'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_96px_72px_16px]'

export default function EvidencePage() {
  useEffect(() => { document.title = 'Evidence Vault · Toolkit · Kraffic' }, [])
  const q = useParams()
  const key = evidenceStates[q.get('mock')] ? q.get('mock') : 'full'
  const st = evidenceStates[key]
  const [filter, setFilter] = useState('all')
  const items = useMemo(() => st.items.map((i) => ({ ...i, status: STATUS[i.confidenceTier] })), [st])
  const count = (s) => items.filter((i) => i.status === s).length
  const sources = new Set(items.flatMap((i) => i.sources.map((s) => s.url))).size
  const shown = items.filter((i) => filter === 'all' || i.status === filter)
  const state = key === 'error' ? 'error' : key === 'running' ? 'running' : !items.length ? 'not-run' : 'ready'
  const sync = () => setParams({ mock: 'running' })
  const show = (f) => () => { setFilter(f); document.getElementById('evidence-claims')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <>
      <ToolPage title="Evidence Vault" subtitle="The claims your site makes, and the sources that back them up"
        primary={{ label: 'Sync now', icon: RefreshCw, onClick: sync }} state={state}
        empty={{ icon: Library, title: 'No claims collected yet', body: 'We’ll read your pages, pull out the claims they make and look for sources that back each one. It takes a few minutes.', action: { label: 'Collect claims', icon: RefreshCw, onClick: sync } }}
        running={{ label: 'Reading your pages for claims…', since: st.syncing?.startedAt ?? new Date().toISOString() }}
        error={{ title: 'The sync didn’t finish', reason: st.error, onRetry: sync, keepBody: true }}>
        <KpiStrip items={[
          { label: 'Claims found', icon: Library, value: items.length, meta: `On ${new Set(items.map((i) => i.pageUrl)).size} pages`, link: 'View claims', onOpen: show('all') },
          { label: 'Backed by a source', icon: ShieldCheck, value: count('backed'), meta: `${count('weak')} more are weak`, link: 'View backed', onOpen: show('backed') },
          { label: 'Unbacked', icon: ShieldAlert, value: count('unbacked'), meta: <span className={count('unbacked') ? 'text-negative' : ''}>No source at all</span>, link: 'View unbacked', onOpen: show('unbacked') },
          { label: 'Sources linked', icon: Link2, value: sources, meta: `From ${new Set(items.flatMap((i) => i.sources.map((s) => s.domain))).size} sites`, link: 'View sources', onOpen: () => document.getElementById('evidence-sources')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
        ]} />

        <Card id="evidence-claims" className="scroll-mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 max-md:px-4">
            <div className="min-w-0">
              <h2 className={cardTitle}>Claims</h2>
              <p className={subtitleCls}>What your pages say, and whether a trusted source says it too.</p>
            </div>
            <div className="no-scrollbar max-w-full overflow-x-auto">
              <Segmented size="md" label="Evidence" value={filter} onChange={setFilter} options={[
                { value: 'all', label: `All ${items.length}` }, ...['backed', 'weak', 'unbacked'].map((s) => ({ value: s, label: `${WORD[s]} ${count(s)}` })),
              ]} />
            </div>
          </div>
          <div className={`${head} ${COLS}`}><span>Claim</span><span>Page</span><span>Evidence</span><span>Sources</span><span /></div>
          {shown.length === 0 ? <p className={`border-t border-[var(--div)] px-5 py-10 text-center text-[14px] leading-5 ${t2}`}>No claims here.</p> : (
            <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
              {shown.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => openDrawer('claim', c.id)}
                    className={`group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 px-5 py-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4 ${COLS}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] leading-5 font-medium text-stone-900" title={c.claim}>{c.claim}</span>
                      <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>
                        <span className={c.status === 'unbacked' ? 'text-negative' : t2}>{WORD[c.status]}</span> · {c.sources.length} sources · {pathOf(c.pageUrl)}
                      </span>
                    </span>
                    <span className={`hidden truncate text-[13px] leading-[18px] ${t3} md:block`}>{pathOf(c.pageUrl)}</span>
                    <span className={`hidden text-[13px] leading-[18px] md:block ${c.status === 'unbacked' ? 'text-negative' : t2}`}>{WORD[c.status]}</span>
                    <span className={`hidden text-[14px] leading-5 tabular-nums md:block ${c.sources.length ? 'text-stone-900' : t3}`}>{c.sources.length || '—'}</span>
                    <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <SourcesCard items={items} />
      </ToolPage>
      <ClaimDrawer items={items} />
    </>
  )
}

// ---- Most used sources: the sites that back the most claims
function SourcesCard({ items }) {
  const explain = useExplain('evidence-sources')
  const rows = Object.values(items.flatMap((i) => i.sources.map((s) => ({ ...s, claim: i.id }))).reduce((m, s) => {
    m[s.domain] ??= { domain: s.domain, claims: new Set() }
    m[s.domain].claims.add(s.claim)
    return m
  }, {})).map((r) => ({ domain: r.domain, n: r.claims.size })).sort((a, b) => b.n - a.n || a.domain.localeCompare(b.domain)).slice(0, 6)
  const top = rows[0]
  return (
    <Card id="evidence-sources" ref={explain.cardRef} className="scroll-mt-6 px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Most used sources</h2>
      <p className={subtitleCls}>The sites that back the most of your claims.</p>
      <ul className="mt-3 divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={r.domain} {...hl(explain, r === top ? 'top' : r.domain, { row: true })} className="grid h-11 grid-cols-[20px_minmax(0,1fr)_88px_minmax(48px,160px)] items-center gap-3">
            <SiteLogo domain={r.domain} name={r.domain} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
            <span className="truncate text-[14px] leading-5 text-stone-900">{r.domain}</span>
            <span className={`text-right text-[13px] leading-[18px] ${t2} tabular-nums`}>{r.n} {r.n === 1 ? 'claim' : 'claims'}</span>
            <HBar value={r.n} max={top.n} className="w-full" />
          </li>
        ))}
      </ul>
      <Insight explain={explain} text={`${top.domain} backs ${top.n} claims, more than any other site.`} evidence={{ keys: ['top'], calc: 'Claims with at least one source on each site. Highlighted: the site that backs the most.' }} />
    </Card>
  )
}

function ClaimDrawer({ items }) {
  const map = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const drawer = useDrawer('claim', (id) => map.get(id) ?? null)
  const c = drawer.item
  if (!c) return null
  return (
    <DrawerShell drawer={drawer} title={c.claim}
      meta={<span className="flex flex-wrap items-center gap-2"><span className={c.status === 'unbacked' ? 'text-negative' : ''}>{WORD[c.status]}</span><Dot />{c.sources.length} {c.sources.length === 1 ? 'source' : 'sources'}</span>}
      footer={(
        <>
          <a href={c.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
          <span />
        </>
      )}>
      <section className="mt-5">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Where it’s said</h3>
        <p className={`mt-1 truncate text-[14px] leading-5 ${t2}`} title={c.pageUrl}>{pathOf(c.pageUrl)}</p>
      </section>
      <section className="mt-6">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Sources</h3>
        {c.sources.length ? (
          <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
            {c.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="group -mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                  <SiteLogo domain={s.domain} name={s.domain} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] leading-5 text-stone-900">{s.title}</span>
                    <span className={`block truncate text-[13px] leading-[18px] ${t3}`}>{s.domain}</span>
                  </span>
                  <ArrowUpRight size={14} className="text-stone-500" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : <p className={`mt-1 text-[14px] leading-5 ${t2}`}>No source backs this yet. AI engines are less likely to repeat a claim nobody else makes. Link a study, a test result or a trusted site on the page.</p>}
      </section>
    </DrawerShell>
  )
}
