import { ArrowRight, ArrowUpRight } from 'lucide-react'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { navigate } from '../../router'
import { CHANNELS, leanWord } from './analyze'
import { SENTIMENT, STANCE, fmtDay, t2, t3, Logo } from './parts'

// Run-detail drawers on ?panel=: "sources" (every source, ranked) and "compare" (this run vs the one before).
const ITEMS = { sources: { id: 'sources' }, compare: { id: 'compare' } } // stable objects for useDrawer
const find = (want) => (id) => (id === want ? ITEMS[want] : null)
const h3 = 'text-[14px] leading-5 font-semibold text-stone-900'

export function SourcesPanel({ a }) {
  const drawer = useDrawer('panel', find('sources'))
  if (!drawer.item) return null
  return (
    <DrawerShell drawer={drawer} title={`${a.sources.length} sources`} meta={<span>Every site and account, most mentions first</span>}>
      <ol className="mt-4 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {a.sources.map((s, i) => (
          <li key={s.key}>
            <a href={s.url} target="_blank" rel="noreferrer" aria-label={`${s.name}, ${CHANNELS[s.channel].label}: ${s.count} mentions, leans ${leanWord(s.lean)}. Opens in a new tab`}
              className="group -mx-2 grid min-h-12 w-[calc(100%+16px)] grid-cols-[20px_20px_minmax(0,1fr)_auto_16px] items-center gap-3 rounded-md px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
              <span className={`text-right text-[13px] ${t3} tabular-nums`}>{i + 1}</span>
              <Logo domain={s.domain} name={s.name} className="h-5 w-5 rounded" imgPad="p-0.5" initialClass="text-[10px]" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] leading-5 text-stone-900">{s.name}</span>
                <span className={`block text-[12px] leading-4 ${t3}`}>{CHANNELS[s.channel].label} · leans {leanWord(s.lean)}</span>
              </span>
              <span className="text-[14px] leading-5 text-stone-900 tabular-nums">{s.count}</span>
              <ArrowUpRight size={14} className={`${t3} transition-colors group-hover:text-stone-900`} aria-hidden />
            </a>
          </li>
        ))}
      </ol>
    </DrawerShell>
  )
}

// before → after, e.g. "Negative 18% → 29%"; for tone, the higher negative value is in the negative colour
function Shift({ label, before, after, negative = false }) {
  const hi = (v) => negative && v === Math.max(before, after) && before !== after
  return (
    <li className="grid h-8 grid-cols-[minmax(0,1fr)_auto] items-center text-[14px] leading-5">
      <span className={t2}>{label}</span>
      <span className="tabular-nums">
        <span className={hi(before) ? 'text-negative' : t3}>{before}%</span>
        <span className={t3}> → </span>
        <span className={hi(after) ? 'font-medium text-negative' : 'font-medium text-stone-900'}>{after}%</span>
      </span>
    </li>
  )
}

export function ComparePanel({ a }) {
  const drawer = useDrawer('panel', find('compare'))
  const c = a.compare
  if (!drawer.item || !c) return null
  const prevDate = fmtDay(c.previous.createdAt)
  const more = a.delta
  const lead = c.newSources[0]
  const summary = `${Math.abs(more)} ${more >= 0 ? 'more' : 'fewer'} mentions than on ${prevDate}, and the tone is ${c.toneWord === 'tone about the same' ? 'about the same' : c.toneWord}.`
    + (c.newSources.length ? ` ${c.newSources.length} new ${c.newSources.length === 1 ? 'source' : 'sources'} joined, led by ${lead.name}.` : '')
    + (c.grew[0] ? ` “${c.grew[0].theme}” grew the most.` : '')
  return (
    <DrawerShell drawer={drawer} title="Compare runs" meta={<><span>{prevDate}</span><span className={t3}>→</span><span>this run</span><Dot /><span>run {c.previous.runNo} vs run {c.previous.runNo + 1}</span></>}
      footer={(
        <button type="button" onClick={() => navigate(`/trends/${c.previous.id}`)} className="ml-auto inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
          Open the {prevDate} run <ArrowRight size={14} aria-hidden />
        </button>
      )}>
      <section className="mt-5">
        <h3 className={h3}>What changed</h3>
        <p className="mt-1.5 text-[14px] leading-[22px] text-stone-900">{summary}</p>
      </section>
      <section className="mt-6">
        <h3 className={h3}>Tone</h3>
        <ul className="mt-1">{c.tone.map((r) => <Shift key={r.key} label={SENTIMENT[r.key].label} before={r.before} after={r.after} negative={r.key === 'negative'} />)}</ul>
      </section>
      <section className="mt-5">
        <h3 className={h3}>Stance</h3>
        <ul className="mt-1">{c.stance.map((r) => <Shift key={r.key} label={STANCE[r.key].label} before={r.before} after={r.after} />)}</ul>
      </section>
      <section className="mt-5">
        <h3 className={h3}>New sources</h3>
        {c.newSources.length ? (
          <ul className="mt-1">
            {c.newSources.map((s) => (
              <li key={s.key} className="flex h-9 items-center gap-2.5 text-[14px] leading-5">
                <Logo domain={s.domain} name={s.name} className="h-5 w-5 rounded" imgPad="p-0.5" initialClass="text-[10px]" />
                <span className="min-w-0 truncate text-stone-900">{s.name}</span>
                <span className={`text-[13px] ${t3}`}>{CHANNELS[s.channel].label}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`mt-1 text-[14px] leading-5 ${t3}`}>Same sources as last time.</p>}
      </section>
      <section className="mt-5">
        <h3 className={h3}>Talking points that grew</h3>
        {c.grew.length ? (
          <ul className="mt-1">
            {c.grew.map((t) => (
              <li key={t.themeKey} className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[14px] leading-5">
                <span className="text-stone-900">{t.theme}</span>
                <span className="tabular-nums">{t.before ? <><span className={t3}>{t.before} → </span><span className="font-medium text-stone-900">{t.after}</span></> : <span className={`text-[13px] font-medium ${t2}`}>New</span>}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`mt-1 text-[14px] leading-5 ${t3}`}>No talking point grew.</p>}
      </section>
    </DrawerShell>
  )
}
