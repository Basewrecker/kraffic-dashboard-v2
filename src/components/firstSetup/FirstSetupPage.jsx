import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useToast } from '../dashboard/overlays'
import SiteLogo from '../ui/SiteLogo'
import ViewAsBar from '../clients/ViewAsBar'
import { firstSetupClient, firstSetupStates } from '../../data/mock'
import BrandStep from './BrandStep'
import CompetitorsStep from './CompetitorsStep'
import PromptsStep from './PromptsStep'
import ScanStep from './ScanStep'
import { t2, t3, textBtn } from './ui'

// /first-setup — First-time setup (/setup is the old Brand Setup address): four steps on a thin vertical line, one column (760px). The current step is open with its
// controls; a done step is one line (summary + Edit); an upcoming step is one muted line. ?mock=<state> picks the
// starting point (data/mock.js firstSetupStates). Setup mode: the sidebar shows First-time setup, Prompt Hub, Trends.
const STEPS = [
  { id: 'brand', title: 'Brand' },
  { id: 'competitors', title: 'Competitors' },
  { id: 'prompts', title: 'Prompts' },
  { id: 'scan', title: 'First scan' },
]
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const startState = () => {
  const key = new URLSearchParams(window.location.search).get('mock')
  return structuredClone(firstSetupStates[key] ?? firstSetupStates.new)
}

// where a mock state starts: the first step that isn't done (the scan step stays current once it's reached)
const currentOf = (s) => (!s.brand ? 0 : !s.competitors.length ? 1 : !s.prompts.length ? 2 : 3)

export default function FirstSetupPage() {
  const [s, setS] = useState(startState)
  const [current, setCurrent] = useState(() => currentOf(s))
  const [editing, setEditing] = useState(null) // a done step reopened with Edit
  const [toastNode, toast] = useToast({ position: 'center' })
  const name = s.brand?.name
  useEffect(() => { document.title = `Set up ${name ?? 'your brand'} · Kraffic` }, [name])

  const open = editing ?? current
  const update = (patch) => setS((x) => ({ ...x, ...(typeof patch === 'function' ? patch(x) : patch) }))
  // Continue: a reopened step closes; the current one hands over to the next
  const next = () => { if (editing != null) setEditing(null); else setCurrent((c) => Math.min(c + 1, STEPS.length - 1)) }

  const summary = {
    brand: s.brand && (
      <span className="flex min-w-0 items-center gap-2">
        <SiteLogo domain={s.brand.domain} name={s.brand.name} className="h-5 w-5 shrink-0 rounded" imgPad="p-0" initialClass="text-[10px]" bordered={false} />
        <span className="truncate"><span className="text-stone-900">{s.brand.name}</span> · {s.brand.domain ?? 'Name-only brand'}</span>
      </span>
    ),
    competitors: s.competitors.length > 0 && <span className="truncate">{plural(s.competitors.length, 'competitor')} · {s.competitors.map((c) => c.name).join(', ')}</span>,
    prompts: s.prompts.length > 0 && <span className="truncate">{plural(s.prompts.length, 'prompt')} added</span>,
  }
  // what an upcoming step will ask for
  const upcoming = {
    competitors: 'Brands AI answers compare you with',
    prompts: 'The questions people ask AI',
    scan: 'Kraffic checks your prompts across AI engines',
  }

  const body = (id) => ({
    brand: <BrandStep brand={s.brand} onSave={(b) => { update({ brand: b }); next() }} editing={editing === 0} onCancel={() => setEditing(null)} />,
    competitors: <CompetitorsStep brand={s.brand} list={s.competitors} suggested={s.suggested} update={update} toast={toast} onContinue={next} />,
    prompts: <PromptsStep brand={s.brand} prompts={s.prompts} competitors={s.competitors} update={update} toast={toast} onContinue={next} />,
    scan: <ScanStep scan={s.scan} update={update} />,
  }[id])

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pt-2">
      <ViewAsBar name={name} fallback={firstSetupClient} className="mb-6" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Set up {name ?? 'your brand'}</h1>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>A few steps before Kraffic can start tracking AI answers.</p>
        </div>
        <span className={`shrink-0 pt-1.5 text-[13px] leading-[18px] ${t3} tabular-nums lg:pt-2.5`}>Step {current + 1} of {STEPS.length}</span>
      </div>

      <ol className="mt-8 flex flex-col" aria-label="Setup steps">
        {STEPS.map((step, i) => {
          const state = i === open ? 'open' : i < current ? 'done' : 'upcoming'
          const isDone = i < current || (i === 3 && s.scan.status === 'done')
          return (
            <li key={step.id} aria-current={i === open ? 'step' : undefined} className={`relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 ${i < STEPS.length - 1 ? 'pb-6' : ''}`}>
              {/* the line down to the next step */}
              {i < STEPS.length - 1 && <span className="absolute bottom-0 left-[13.5px] top-8 w-px bg-[var(--div)]" aria-hidden />}
              <Marker n={i + 1} state={isDone ? 'done' : i === open ? 'current' : state} />
              <div className="min-w-0">
                {state === 'open' ? (
                  <>
                    <h2 className="flex h-7 items-center text-[15px] leading-5 font-semibold text-stone-900">{step.title}{i === 1 && <span className={`ml-1.5 text-[13px] font-normal ${t3}`}>Required</span>}</h2>
                    {body(step.id)}
                  </>
                ) : state === 'done' ? (
                  <div className="flex h-7 items-center gap-3">
                    <h2 className="shrink-0 text-[15px] leading-5 font-semibold text-stone-900">{step.title}</h2>
                    <span className={`flex min-w-0 flex-1 items-center text-[13px] leading-[18px] ${t2}`}>{summary[step.id]}</span>
                    {/* a scan that started can't be undone, so Brand and the rest stay editable only before it */}
                    {(s.scan.status === 'idle' || s.scan.status === 'none') && <button type="button" onClick={() => setEditing(i)} className={textBtn}>Edit</button>}
                  </div>
                ) : (
                  <div className="flex h-7 items-center gap-3">
                    <h2 className="shrink-0 text-[15px] leading-5 font-medium text-stone-500">{step.title}</h2>
                    <span className={`min-w-0 truncate text-[13px] leading-[18px] ${t3}`}>{upcoming[step.id]}</span>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {toastNode}
    </div>
  )
}

// numbered circle: done = ink + check, current = ink outline, upcoming = muted
function Marker({ n, state }) {
  const cls = state === 'done' ? 'bg-ink text-on-ink' : state === 'current' ? 'border-[1.5px] border-ink bg-surface text-ink' : 'border border-line bg-surface text-stone-500'
  return (
    <span className={`relative z-[1] grid h-7 w-7 place-items-center rounded-full text-[13px] leading-none font-semibold tabular-nums ${cls}`}>
      {state === 'done' ? <><Check size={14} strokeWidth={2.5} aria-hidden /><span className="sr-only">Step {n}, done</span></> : n}
    </span>
  )
}
