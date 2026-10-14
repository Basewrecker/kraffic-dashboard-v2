import { ArrowUpRight } from 'lucide-react'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { CHANNELS, snippetOf, sourceName } from './analyze'
import { SENTIMENT, STANCE, fmtDate, t2, t3, Logo } from './parts'

// Mention drawer (?mention=<id>; a bottom sheet on phones): the full text, why it was scored the way it was, who's named.
const URL_SPLIT = /(https?:\/\/\S+)/g
function Linked({ text }) {
  return text.split(URL_SPLIT).map((part, i) => (/^https?:\/\//.test(part)
    ? <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-ink underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">{part}</a>
    : <span key={i}>{part}</span>))
}

export default function MentionDrawer({ run }) {
  const drawer = useDrawer('mention', (id) => run.raw.mentions.find((m) => m.id === id) ?? null)
  const m = drawer.item
  if (!m) return null
  const snippet = snippetOf(m)
  const host = m.channel === 'NEWS' ? m.domain : CHANNELS[m.channel].domain
  return (
    <DrawerShell
      drawer={drawer}
      title={`${sourceName(m)} · ${fmtDate(m.publishedAt)}`}
      meta={<span className="flex items-center gap-2"><Logo domain={m.domain} name={sourceName(m)} className="h-4 w-4 rounded-[4px]" imgPad="p-0" initialClass="text-[10px]" />{CHANNELS[m.channel].label}{m.handle && m.author && <><Dot /><span>{m.author}</span></>}</span>}
      footer={(
        <a href={m.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
          Open on {host} <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    >
      <div className="mt-5 text-[15px] leading-[24px] text-stone-900">
        {m.title && <p className="font-semibold">{m.title}</p>}
        {(m.channel !== 'NEWS' || snippet) && <p className={m.title ? 'mt-2' : ''}><Linked text={m.channel === 'NEWS' ? snippet : m.text} /></p>}
      </div>

      <dl className="mt-6 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {[['Sentiment', SENTIMENT[m.sentiment], m.sentimentReason], ['Stance', STANCE[m.stance], m.stanceReason]].map(([label, v, reason]) => (
          <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-3 text-[14px] leading-5">
            <dt className={t3}>{label}</dt>
            <dd>
              <span className={v.text === 'text-negative' ? 'font-medium text-negative' : 'font-medium text-stone-900'}>{v.label}</span>
              {reason && <span className={`mt-0.5 block text-[13px] leading-[18px] ${t2}`}>{reason}</span>}
            </dd>
          </div>
        ))}
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-3 text-[14px] leading-5">
          <dt className={t3}>Mentioned</dt>
          <dd className={t2}>{m.entities.length ? m.entities.join(', ') : <span className={t3}>No people or organizations named</span>}</dd>
        </div>
      </dl>
    </DrawerShell>
  )
}
