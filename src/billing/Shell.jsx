import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { navigate, usePath } from '../router'
import { setParams, useParams } from '../components/audit/parts'
import { Wordmark } from '../components/ui/Logo'
import { billingState, tabFor, WORKSPACE } from './state.js'
import { daysLeftParts, money, monthName } from './format.js'
import { B, Btn, InlineError, Pending, ShellBanner, SplitBtn } from './ui.jsx'

// Screen 5. The shell's notices, above the page content at the content's left edge and width: one rounded card,
// surface fill, hairline border, small text, role="status". They scroll with the page (not sticky).
//  · Past due: neutral, only the 14px alert icon is red; it can't be dismissed. Hidden while the Plans page's Billing
//    tab is open (the same facts are there: never repeat a number) and on the return and payment pages. It never shows
//    a skeleton: its space is taken only once the state is known.
//  · Demo: the plain sentence [keep], with "See plans" once the workspace's billing is live (pending decision 14).
//  · After paying: "Payment received. Thank you.", once.
// Previews: ?sub=pastdue&days=14…0 · ?who=member · ?userId= · ?seller=paused · ?pay=fail · ?msg=paid
export function ShellNotices() {
  const params = useParams()
  const path = usePath()
  const b = billingState()
  const [opening, setOpening] = useState(null)
  const [more, setMore] = useState(false)
  const onPlans = path.startsWith('/plans')
  const here = path + window.location.search
  const leave = (kind) => { setOpening(kind); setTimeout(() => { setOpening(null); navigate(`/plans/pay?kind=${kind}&plan=${b.plan.id}&back=${encodeURIComponent(here)}`) }, 700) }

  if (b.live && b.status === 'pastdue') {
    if (path.startsWith('/plans/return') || path.startsWith('/plans/pay') || (path === '/plans' && tabFor(b) === 'billing')) return null
    const d = daysLeftParts(b.daysLeft)
    const paused = b.seller === 'paused'
    const month = monthName(b.failedOn)
    const head = (
      <a href="/plans?tab=billing" onClick={(e) => { e.preventDefault(); navigate('/plans?tab=billing') }} className="rounded font-semibold text-stone-900 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
        {paused ? `Your ${month} payment is due` : `Your ${month} payment didn’t go through`}
      </a>
    )
    const pausedLine = <Pending n="decision 10">Until then, scans, Sync now and adding prompts or brands are paused. Your dashboard stays open.</Pending>
    return (
      <ShellBanner alert data-past-due
        actions={paused || b.who === 'member' ? null : (
          <>
            <SplitBtn busy={Boolean(opening)} off={b.who === 'viewas' ? 'Can’t change plans from this view' : null} onClick={() => leave('invoice')} menuLabel="More ways to pay"
              items={[{ label: 'Update card', onClick: () => leave('card') }]}>Pay now</SplitBtn>
            {params.get('pay') === 'fail'
              ? <InlineError onRetry={() => setParams({ pay: null })}>Couldn’t open the payment page.</InlineError>
              : <p className="text-[12px] leading-4 text-stone-500">Opens a secure payment page.</p>}
          </>
        )}>
        {paused ? (
          <p>{head}, and online payment isn’t available right now. Your access is not affected. We’ll email you when you can pay.</p>
        ) : (
          <>
            <p className="text-stone-700">{head}<span className="max-md:block md:before:mx-2 md:before:content-['·']"><B>{money(b.due.amount)}</B> is due · <Pending n="decision 11">{d.before}<B>{d.bold}</B>{d.after}{b.daysLeft > 0 ? '. After that, your plan ends.' : '.'}</Pending></span></p>
            {/* phones: the "what's paused" line sits behind a disclosure */}
            <p className="mt-0.5 max-md:hidden">{pausedLine}{b.who === 'member' && ' Ask the account owner to pay the invoice.'}</p>
            <div className="mt-1 md:hidden">
              <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">What’s paused?</button>
              {more && <p className="mt-1">{pausedLine}</p>}
              {b.who === 'member' && <p className="mt-1">Ask the account owner to pay the invoice.</p>}
            </div>
          </>
        )}
      </ShellBanner>
    )
  }
  // back from the pay page, paid: one message, once (the Plans page shows its own)
  if (params.get('msg') === 'paid' && !onPlans) {
    return <ShellBanner data-paid actions={<Btn look="quiet" size="sm" onClick={() => setParams({ msg: null })}>Dismiss</Btn>}><p className="text-stone-700">Payment received. Thank you. <Pending n="Q6">Your plan now renews <B>Dec 27</B>.</Pending></p></ShellBanner>
  }
  if (b.status === 'demo') {
    return (
      <ShellBanner data-demo actions={b.live && b.canPay && !onPlans ? <Pending n="decision 14"><Btn look="line" size="sm" onClick={() => navigate('/plans')}>See plans</Btn></Pending> : null}>
        <p>You have <B>{b.demoDays}</B> days remaining in your demo period.</p>
      </ShellBanner>
    )
  }
  return null
}

// Screen 6. An ended account can still sign in, and every page sends it to Plans. The shell is reduced: the logo, the
// account menu (Sign out), and the Plans page. No sidebar navigation.
export const isReduced = (b) => b.live && (b.status === 'ended' || b.status === 'demo-ended')
export function ReducedShell({ children }) {
  const b = billingState()
  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-[var(--div)] px-4 md:px-6">
        <span className="flex h-10 items-center px-1"><Wordmark /></span>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><LogOut size={16} aria-hidden />Sign out</button>
      </header>
      <main className="page-gutters mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 pb-10 pt-4 md:gap-4 md:px-6 lg:pt-8">
        {/* why the rest is locked (owner, 2026-11-28): one line, the same notice card as the shell's others */}
        <ShellBanner data-locked><p className="text-stone-700">The rest of {WORKSPACE.product} is locked until {b.who === 'member' ? 'the account owner' : 'you'} {b.status === 'demo-ended' ? (b.who === 'member' ? 'picks a plan' : 'pick a plan') : (b.who === 'member' ? 'subscribes again' : 'subscribe again')}.</p></ShellBanner>
        {children}
      </main>
    </div>
  )
}
// A demo that expired where billing is NOT live: today's small card [keep], restyled with tokens (it was amber)
export function AccessEnded() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-[420px] rounded-2xl border border-line bg-surface px-6 py-8 text-center">
        <h1 className="text-[20px] leading-7 font-semibold text-stone-900">Account access ended</h1>
        <p className="mt-2 text-[14px] leading-5 text-stone-600 text-pretty">Your demo period has ended. Please contact the {WORKSPACE.product} Support team to renew or upgrade your account.</p>
        <div className="mt-5 flex justify-center"><Btn look="line">Back to sign in</Btn></div>
      </section>
    </div>
  )
}
