import { useState } from 'react'
import { Copy, ExternalLink, FileDown, FileText } from 'lucide-react'
import { Favicon, Modal, PrimaryButton, SecondaryButton, Sheet } from './overlays'
import { PlatformIcon } from './icons'
import { PriorityLabel, STATUSES } from './StatusControl'
import { brands, platformNames, recentSyncs } from '../../data/mock'
import { chart } from '../../theme/chart'
import { brandName } from '../../utils/brand'

const iconId = (p) => (p === 'google' ? 'aio' : p)
const syncs = (n) => `${n} sync${n === 1 ? '' : 's'}`

export function Section({ title, children }) {
  return (
    <section className="border-t border-stone-100 px-7 py-6">
      <h3 className="text-small font-semibold text-stone-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// Highlights brand names inside an answer excerpt.
// marks: [{ names: string[], className }]; default style = stone-100 (competitors)
export function Highlighted({ text, names = [], marks = [{ names, className: 'bg-stone-100' }] }) {
  const all = marks.flatMap((m) => m.names)
  if (!all.length) return text
  const esc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${all.map(esc).join('|')})`, 'g')
  return text.split(re).map((part, i) => {
    const m = marks.find((mk) => mk.names.includes(part))
    return m
      ? <mark key={i} className={`-mx-0.5 rounded-sm px-0.5 font-medium text-stone-900 [box-decoration-break:clone] ${m.className}`}>{part}</mark>
      : part
  })
}

export function MissedPromptSheet({ row, priority, status, onClose, onCreateBrief, onMarkInProgress }) {
  const [full, setFull] = useState(false)
  const open = !!row
  const r = row
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={r ? `Missed prompt: ${r.prompt}` : 'Missed prompt'}
      footer={r && (
        <div className="flex gap-2">
          <PrimaryButton icon={FileText} onClick={() => onCreateBrief([r])} data-autofocus>Create content brief</PrimaryButton>
          <SecondaryButton onClick={() => onMarkInProgress([r.id])} disabled={status === 'in_progress'}>
            {status === 'in_progress' ? 'In progress' : 'Mark in progress'}
          </SecondaryButton>
        </div>
      )}
    >
      {r && (
        <>
          <header className="px-7 pb-6 pr-16 pt-7">
            <h2 className="text-title font-semibold text-stone-900">{r.prompt}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-stone-500">
              <span>{r.topic}</span>
              <span aria-hidden>·</span>
              <PriorityLabel level={priority.level} />
              <span aria-hidden>·</span>
              <span className="proportional-nums">Missed for {syncs(r.streak)}</span>
              {status && (<><span aria-hidden>·</span><span>{STATUSES[status].label}</span></>)}
            </div>
          </header>

          <Section title="What AI answered">
            <p className={`text-small leading-[22px] text-stone-700 ${full ? '' : 'line-clamp-6'}`}>
              <Highlighted text={r.answer} names={r.competitors.map((d) => brands[d].name)} />
            </p>
            <button onClick={() => setFull((f) => !f)} className="mt-2 rounded text-small font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
              {full ? 'Show less' : 'Show full answer'}
            </button>
          </Section>

          <Section title="Brands mentioned">
            {r.brandsMentioned.length ? (
              <ul className="divide-y divide-stone-100">
                {r.brandsMentioned.map((b) => (
                  <li key={b.domain} className="flex h-11 items-center gap-3">
                    <Favicon domain={b.domain} />
                    <span className="flex-1 truncate text-small text-stone-900" title={b.domain}>{brandName(b.domain)}</span>
                    <span className="flex items-center gap-1.5">
                      {b.platforms.map((p) => <span key={p} title={platformNames[p]} className="flex"><PlatformIcon id={iconId(p)} size={14} /></span>)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-stone-500">No brand was named in this answer, so the first clear, cited answer can win it.</p>
            )}
          </Section>

          <Section title="Sources cited">
            <ul className="divide-y divide-stone-100">
              {r.sources.map((s) => (
                <li key={s.domain + s.path} className="flex min-h-11 items-center gap-3 py-2">
                  {/* mock URLs: shown as links, navigation disabled */}
                  <a
                    href={`https://${s.domain}${s.path}`}
                    onClick={(e) => e.preventDefault()}
                    className="group/link flex min-w-0 flex-1 items-center gap-1.5 rounded text-small outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="truncate">
                      <span className="font-semibold text-stone-900">{s.domain}</span>
                      <span className="text-stone-500">{s.path}</span>
                    </span>
                    <ExternalLink size={14} className="shrink-0 text-stone-400 group-hover/link:text-stone-900" aria-hidden />
                  </a>
                  <button onClick={() => onCreateBrief([r])} className="shrink-0 rounded px-1 text-small text-stone-400 transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
                    Outrank this page
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="History">
            <div className="flex items-center gap-2" role="list" aria-label="Last 8 syncs">
              {r.history.map((h, i) => (
                <span
                  key={i}
                  role="listitem"
                  title={`${recentSyncs[i]} · ${h === 'visible' ? 'Visible' : h === 'missed' ? 'Missed' : 'Not tracked yet'}`}
                  className="h-3 w-3 rounded-full"
                  style={h === 'visible' ? { background: chart.you } : h === 'missed' ? { background: 'var(--color-stone-300)' } : { boxShadow: 'inset 0 0 0 1px var(--color-stone-200)' }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-stone-500" style={{ width: 8 * 12 + 7 * 8 }}>
              <span>{recentSyncs[0].replace(', 2026', '')}</span>
              <span>Latest</span>
            </div>
          </Section>
        </>
      )}
    </Sheet>
  )
}

export function BriefModal({ brief, onClose, onCopy, onExport }) {
  return (
    <Modal
      open={!!brief}
      onClose={onClose}
      title="Content brief"
      footer={brief && (
        <>
          <SecondaryButton icon={FileDown} onClick={onExport}>Export as .md</SecondaryButton>
          <PrimaryButton icon={Copy} onClick={onCopy} data-autofocus>Copy brief</PrimaryButton>
        </>
      )}
    >
      {brief && (
        <div className="space-y-5 text-small text-stone-700">
          <div>
            <h3 className="font-semibold text-stone-900">Target prompt{brief.prompts.length > 1 ? 's' : ''}</h3>
            <ul className="mt-2 space-y-1">{brief.prompts.map((p) => <li key={p}>“{p}”</li>)}</ul>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Competitors to beat</h3>
            {brief.competitors.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {brief.competitors.map((d) => (
                  <li key={d} className="inline-flex h-8 items-center gap-2 rounded-full border border-line pl-1.5 pr-3">
                    <Favicon domain={d} /> {brandName(d)}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-stone-500">No brand is cited yet: the first clear answer wins.</p>}
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Sources to outrank</h3>
            <ul className="mt-2 space-y-1">
              {brief.sources.map((s) => (
                <li key={s.domain + s.path}><span className="font-semibold text-stone-900">{s.domain}</span><span className="text-stone-500">{s.path}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Suggested angle</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">{brief.angles.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
