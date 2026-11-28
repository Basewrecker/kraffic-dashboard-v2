import { History } from 'lucide-react'
import DrawerShell, { useDrawer } from '../audit/DrawerShell'
import { openDrawer } from '../audit/parts'
import { HeaderIconButton } from './PageHeader'
import { account, getHistory, kpis } from '../../data/mock'
import { folderWeeks } from '../../data/citedFolders'
import { displayName } from '../../utils/brand'

// The History button and its week-by-week pull-out for the cards that had none in the mock: Share of voice, Missed
// prompts and Cited pages by folder (owner, 2026-11-28: the app shows the button on these cards, so the mock must too;
// sample data is fine). ?history=share|missed|folders. The numbers are worked out from the sample history the page
// already has (Visibility history's weekly points, the folder card's stored weeks); the app has its own.
// Citations and Marketplace keep their own, richer week-by-week drawers (WeekHistoryDrawer).
const KINDS = {
  share: { title: 'Share of voice', sub: 'Each brand’s share of all brand mentions, week by week', unit: '%' },
  missed: { title: 'Missed prompts', sub: `Prompts where ${account.name} didn’t appear, week by week`, unit: '' },
  folders: { title: 'Cited pages by folder', sub: 'Citations to your pages, week by week', unit: '' },
}
export function HistoryButton({ kind, tipAlign = 'right', className = '' }) {
  return <HeaderIconButton label="Week by week" icon={History} tipAlign={tipAlign} className={className} onClick={() => openDrawer('history', kind)} />
}

function build(kind) {
  const h = getHistory({ granularity: 'weekly' })
  const points = (h.data ?? h.points ?? []).filter((p) => p.dermasuri != null || p[h.series?.[0]?.key] != null)
  const you = h.series.find((s) => s.label === account.domain) ?? h.series[0]
  if (kind === 'share') {
    const cols = h.series.map((s) => ({ key: s.key, label: displayName(s.label), you: s.key === you.key }))
    const rows = points.map((p) => {
      const sum = h.series.reduce((n, s) => n + (p[s.key] ?? 0), 0) || 1
      return { date: p.date, values: Object.fromEntries(h.series.map((s) => [s.key, p[s.key] == null ? null : Math.round((p[s.key] * 100) / sum)])) }
    })
    return { cols, rows, main: you.key }
  }
  if (kind === 'missed') {
    const rows = points.map((p) => ({ date: p.date, values: { n: p[you.key] == null ? null : Math.round(kpis.total * (1 - p[you.key] / 100)) } }))
    return { cols: [{ key: 'n', label: 'Missed prompts', you: true }], rows, main: 'n', lowerIsBetter: true }
  }
  const weeks = [...folderWeeks(account.domain)].reverse()
  return { cols: [{ key: 'n', label: 'Citations', you: true }], rows: weeks.map((w) => ({ date: w.label ?? w.date, values: { n: w.groups?.total ?? null } })), main: 'n' }
}

// a small line of the main series (the card's own number over the weeks)
function Spark({ values }) {
  const v = values.filter((x) => x != null)
  if (v.length < 2) return null
  const min = Math.min(...v), max = Math.max(...v), W = 380, H = 72, pad = 6
  const y = (n) => H - pad - ((n - min) / (max - min || 1)) * (H - pad * 2)
  const pts = values.map((n, i) => (n == null ? null : `${(i * (W - pad * 2)) / (values.length - 1) + pad},${y(n)}`)).filter(Boolean)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" role="img" aria-label="The last weeks as a line">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.length > 0 && (() => { const [x, yy] = pts.at(-1).split(','); return <circle cx={x} cy={yy} r="3" fill="var(--ink)" /> })()}
    </svg>
  )
}

export default function HistoryPanel() {
  const drawer = useDrawer('history', (id) => (KINDS[id] ? id : null))
  const kind = drawer.item
  if (!kind) return null
  const k = KINDS[kind]
  const d = build(kind)
  const rows = [...d.rows].reverse() // newest first
  const delta = (i) => { const a = rows[i]?.values[d.main], b = rows[i + 1]?.values[d.main]; return a == null || b == null ? null : a - b }
  return (
    <DrawerShell drawer={drawer} title={k.title} meta={k.sub}>
      {rows.length < 2 ? <p className="text-[14px] leading-5 text-stone-600">History appears here after the second weekly sync.</p> : (
        <>
          <Spark values={d.rows.map((r) => r.values[d.main])} />
          <table className="mt-4 w-full border-collapse text-[13px] leading-[18px]">
            <thead><tr className="border-b border-line text-left text-[12px] font-medium text-stone-500">
              <th scope="col" className="py-2 font-medium">Week</th>
              {d.cols.map((c) => <th key={c.key} scope="col" className="py-2 text-right font-medium">{c.label}</th>)}
              <th scope="col" className="py-2 text-right font-medium">Change</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const ch = delta(i)
                const good = ch == null || ch === 0 ? null : (ch > 0) !== Boolean(d.lowerIsBetter)
                return (
                  <tr key={r.date} className="border-b border-[var(--div)] last:border-b-0">
                    <td className="py-2 text-stone-700 tabular-nums">{r.date}{i === 0 && <span className="ml-2 rounded-full bg-tint px-1.5 py-px text-[11px] font-medium text-stone-600">Latest</span>}</td>
                    {d.cols.map((c) => <td key={c.key} className={`py-2 text-right tabular-nums ${c.you ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>{r.values[c.key] == null ? '—' : `${r.values[c.key]}${k.unit}`}</td>)}
                    <td className={`py-2 text-right tabular-nums ${good === true ? 'text-[var(--rep-up-fg)]' : good === false ? 'text-negative' : 'text-stone-400'}`}>{ch == null ? '—' : ch === 0 ? '0' : `${ch > 0 ? '↑' : '↓'} ${Math.abs(ch)}`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </DrawerShell>
  )
}
