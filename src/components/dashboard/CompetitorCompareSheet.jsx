import { useState } from 'react'
import { ArrowUpRight, Bell, BellRing, FileText, Sparkles } from 'lucide-react'
import { Favicon, PrimaryButton, SecondaryButton, Sheet } from './overlays'
import { Highlighted, Section } from './MissedPromptSheet'
import { RowAction } from './PromptTable'
import { account, brands, competitors, recentSyncs } from '../../data/mock'
import { chart } from '../../theme/chart'
import { getCompetitorColor } from '../../theme/colors'
import { brandName } from '../../utils/brand'

const compColor = (d) => getCompetitorColor(d).fill
// "Oct 5, 2026" → "5 Oct 2026"
const fmtDate = (s) => {
  const [mon, day, year] = s.replace(',', '').split(' ')
  return `${day} ${mon} ${year}`
}

export function WonFor({ row }) {
  if (row.isNew) return <span className="inline-flex h-5 items-center rounded-full bg-tint px-2 text-[12px] leading-none font-medium text-ink">New</span>
  // how long isn't known (no earlier sync to compare with): say nothing
  if (row.streak == null) return null
  return <span className="proportional-nums">Won {row.streak} sync{row.streak === 1 ? '' : 's'}</span>
}

function PageLink({ page }) {
  const url = `https://${page.domain}${page.path}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="group/link block min-w-0 rounded text-small outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <span className="flex items-center gap-1">
        <span className="truncate font-semibold text-stone-900">{page.domain}</span>
        <ArrowUpRight size={14} className="shrink-0 text-stone-400 group-hover/link:text-stone-900" aria-hidden />
      </span>
      <span className="block truncate text-stone-500">{page.path}</span>
    </a>
  )
}

function Dots({ label, values, filled }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-[13px] text-stone-500">{label}</span>
      <div className="flex items-center gap-2" role="list" aria-label={`${label}: last 8 syncs`}>
        {values.map((v, i) => (
          <span
            key={i}
            role="listitem"
            title={`${recentSyncs[i]} · ${v ? 'Cited' : 'Not cited'}`}
            className="h-3 w-3 rounded-full"
            style={v ? { background: filled } : { boxShadow: 'inset 0 0 0 1px var(--color-stone-200)' }}
          />
        ))}
      </div>
    </div>
  )
}

export function CompetitorCompareSheet({ row, tracked, onClose, onCreateBrief, onToggleTrack }) {
  const [full, setFull] = useState(false)
  const r = row
  return (
    <Sheet
      open={!!row}
      onClose={onClose}
      label={r ? `Compare: ${r.prompt}` : 'Compare'}
      footer={r && (
        <div className="flex gap-2">
          <PrimaryButton icon={FileText} onClick={() => onCreateBrief(r)} data-autofocus>Create content brief</PrimaryButton>
          <SecondaryButton icon={tracked ? BellRing : Bell} aria-pressed={tracked} onClick={() => onToggleTrack(r)}>
            {tracked ? 'Tracking' : 'Track this prompt'}
          </SecondaryButton>
        </div>
      )}
    >
      {r && (
        <>
          <header className="px-7 pb-6 pr-16 pt-7">
            <h2 className="text-title font-semibold text-stone-900">{r.prompt}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-stone-500">
              <span className="inline-flex items-center gap-2 text-stone-800"><Favicon domain={r.competitor} size={16} /> <span title={r.competitor}>{brandName(r.competitor)}</span></span>
              <span aria-hidden>·</span>
              <WonFor row={r} />
              {/* no topic: no trailing tag or separator */}
              {r.topic && <><span aria-hidden>·</span><span>{r.topic}</span></>}
            </div>
          </header>

          <Section title="What AI answered">
            <p className={`text-small leading-[22px] text-stone-700 ${full ? '' : 'line-clamp-6'}`}>
              <Highlighted
                text={r.answer}
                marks={[
                  { names: [brands[r.competitor].name], className: 'bg-stone-100' },
                  { names: [account.name], className: 'bg-stone-200' },
                ]}
              />
            </p>
            <button onClick={() => setFull((f) => !f)} className="mt-2 rounded text-small font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
              {full ? 'Show less' : 'Show full answer'}
            </button>
          </Section>

          <Section title="Pages cited">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 rounded-lg border border-line p-4">
                <div className="text-[13px] text-stone-500">Them</div>
                <div className="mt-2"><PageLink page={r.theirPage} /></div>
                <p className="mt-1.5 line-clamp-2 text-small text-stone-700">{r.theirPage.title}</p>
                <p className="mt-2 text-[13px] text-stone-500 tabular-nums">Last seen {fmtDate(r.theirPage.lastSeen)}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-line p-4">
                <div className="text-[13px] text-stone-500">You</div>
                {r.yourPage ? (
                  <>
                    <div className="mt-2"><PageLink page={r.yourPage} /></div>
                    <p className="mt-1.5 line-clamp-2 text-small text-stone-700">{r.yourPage.title}</p>
                    <p className={`mt-2 text-[13px] ${r.yourPage.cited ? 'text-ink' : 'text-stone-600'}`}>
                      {r.yourPage.cited ? 'Cited in the latest sync' : 'Exists, but not cited yet'}
                    </p>
                  </>
                ) : (
                  <div className="mt-2">
                    <p className="text-small text-stone-600">No matching page yet</p>
                    <div className="-ml-2.5 mt-2"><RowAction icon={Sparkles} onClick={() => onCreateBrief(r)}>Create content</RowAction></div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="History">
            <div className="space-y-2.5">
              <Dots label="Them" values={r.history.them} filled={compColor(r.competitor)} />
              <Dots label="You" values={r.history.you} filled={chart.you} />
            </div>
            <div className="ml-[60px] mt-2 flex justify-between text-[13px] text-stone-500" style={{ width: 8 * 12 + 7 * 8 }}>
              <span>{recentSyncs[0].replace(', 2026', '')}</span>
              <span>Latest</span>
            </div>
          </Section>
        </>
      )}
    </Sheet>
  )
}
