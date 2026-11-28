import { navigate } from '../../router'
import { PLANS } from '../../plan/catalog.js'
import { money } from '../../billing/format.js'
import { priceOf } from '../../billing/state.js'
import { activePlan } from '../../plan/plan.js'

// NOT a design. A labelled stand-in for the pages the payment provider hosts (the card form, the invoice pay page,
// update card), so the click-through can pass through them: "Stripe's payment page (not ours)". Its buttons choose how
// the visit ends. Nothing here is ported to the app.
export default function PayPlaceholder() {
  const q = new URLSearchParams(window.location.search)
  const kind = q.get('kind') ?? 'checkout'
  const plan = PLANS.find((p) => p.id === q.get('plan')) ?? PLANS[1]
  const back = q.get('back') ?? '/plans?billing=live'
  const from = q.get('from') ?? activePlan().id // the plan before this one (the confirmation counts from it)
  const withParams = (patch) => { const u = new URL(back, window.location.origin); for (const [k, v] of Object.entries(patch)) (v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v)); return u.pathname + u.search }
  const paid = () => {
    if (kind === 'checkout') navigate(`/plans/return?billing=live&show=processing&then=paid&plan=${plan.id}&from=${from}`)
    else if (kind === 'invoice') navigate(withParams({ sub: 'active', msg: 'paid', days: null }))
    else navigate(withParams({ msg: 'card' }))
  }
  const btn = 'inline-flex h-9 items-center justify-center rounded-lg border border-dashed border-[var(--color-line-strong)] px-3.5 text-[13px] font-medium text-stone-700 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus'
  const what = { checkout: 'Card form (first payment)', invoice: 'Invoice pay page (a failed renewal)', card: 'Update card' }[kind]
  return (
    <div className="grid min-h-[60vh] place-items-center py-8">
      <section className="w-full max-w-[520px] rounded-2xl border-2 border-dashed border-[var(--color-line-strong)] px-6 py-10 text-center">
        <p className="text-[13px] leading-[18px] font-semibold text-stone-500">Placeholder</p>
        <h1 className="mt-2 text-[22px] leading-7 font-semibold text-stone-900">Stripe’s payment page (not ours)</h1>
        <p className="mt-2 text-[14px] leading-5 text-stone-600 text-pretty">{what}{kind !== 'card' && <> · {plan.name} · {money(priceOf(plan.id))}</>}. Stripe hosts this page; it is not designed here. Choose how the visit ends:</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className={btn} onClick={paid}>{kind === 'card' ? 'Card updated' : 'Payment succeeds'}</button>
          {kind === 'checkout' && <button type="button" className={btn} onClick={() => navigate(`/plans/return?billing=live&show=processing&then=declined&reason=funds&plan=${plan.id}&from=${from}`)}>Card declined</button>}
          {kind === 'checkout' && <button type="button" className={btn} onClick={() => navigate(`/plans/return?billing=live&show=processing&then=bank&plan=${plan.id}&from=${from}`)}>Needs bank approval</button>}
          {kind === 'checkout' && <button type="button" className={btn} onClick={() => navigate(`/plans/return?billing=live&show=processing&then=hold&plan=${plan.id}&from=${from}`)}>Still processing</button>}
          <button type="button" className={btn} onClick={() => navigate(kind === 'checkout' ? withParams({ sub: 'pending', review: plan.id }) : back)}>Leave without {kind === 'card' ? 'changing' : 'paying'}</button>
        </div>
      </section>
    </div>
  )
}
