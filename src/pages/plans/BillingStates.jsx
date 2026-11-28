import { FLOW, SCREENS } from '../../billing/checklist.js'

// /billing-states (mock only, not for the app): the design round's living checklist. Every billing screen × state as a
// link (billing/checklist.js); each opens in a new tab so its switches don't stick to this one. "+ notes" opens the
// same state with the pending-decision elements outlined.
const link = 'rounded text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus'
const withNotes = (u) => `${u}${u.includes('?') ? '&' : '?'}notes=1`
export default function BillingStates() {
  const total = SCREENS.reduce((n, s) => n + s.states.length, 0)
  return (
    <>
      <div>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Billing states</h1>
        <p className="mt-1 text-[14px] leading-5 text-stone-600 text-pretty">The design round’s checklist: <span className="font-semibold text-stone-900 tabular-nums">{total}</span> states across 8 screens, each at its own address. Mock only. Written notes: docs/billing-design.md.</p>
      </div>
      <section className="rounded-2xl border border-line bg-surface px-5 py-4">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">The main flow</h2>
        <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5 text-stone-700">
          {FLOW.map(([label, url], i) => <li key={label} className="flex items-center gap-2">{i > 0 && <span aria-hidden className="text-stone-400">→</span>}<a href={url} target="_blank" rel="noreferrer" className={link}>{label}</a></li>)}
        </ol>
      </section>
      <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-2">
        {SCREENS.map((s) => (
          <section key={s.n} className="rounded-2xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[15px] leading-5 font-semibold text-stone-900"><span className="tabular-nums">{s.n}</span> · {s.title} <span className="font-normal text-stone-500 tabular-nums">{s.states.length}</span></h2>
            <ul className="mt-2 divide-y divide-[var(--div)]">
              {s.states.map(([label, url, opt]) => (
                <li key={label} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px] leading-5">
                  <span className="min-w-0"><a href={url} target="_blank" rel="noreferrer" className={link}>{label}</a>{(opt?.click || opt?.hover) && <span className="ml-2 text-[12px] text-stone-500">{opt.click ? 'then click' : 'then hover'}</span>}</span>
                  <a href={withNotes(url)} target="_blank" rel="noreferrer" className={`${link} shrink-0 text-[12px] !text-stone-500`}>+ notes</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
