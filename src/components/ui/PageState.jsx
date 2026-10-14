import { AlertCircle, RefreshCw } from 'lucide-react'
import Card from '../dashboard/Card'

// Page-level states for pages whose data loads from the app. The mock's data is instant, so it shows them only on
// ?state=loading | error | notfound | app-loading (App.jsx).
//   PageLoading   skeletons in the page's shape: header, KPI strip, two cards (fixed heights, so nothing jumps)
//   PageError     the page couldn't load: what happened, and Try again
//   PageNotFound  the link points nowhere
//   AppLoading    before the sidebar can draw (the session is being checked): the shell's outline, then PageLoading
const sk = 'animate-pulse rounded-2xl bg-tint motion-reduce:animate-none'
const line = 'animate-pulse rounded-md bg-tint motion-reduce:animate-none'

export function PageLoading({ label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-col gap-2 pb-1">
        <span className={`${line} h-7 w-56 lg:h-9 lg:w-72`} />
        <span className={`${line} h-4 w-72 max-w-full`} />
      </div>
      <div className={`${sk} h-[104px]`} />
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`${sk} h-[320px]`} />
        <div className={`${sk} h-[320px] max-lg:hidden`} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageError({ title = 'We couldn’t load this page', message, onRetry }) {
  return (
    <Card role="alert" className="flex items-start gap-3 p-5">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-negative" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>
        {message && <p className="mt-1 text-[14px] leading-5 text-stone-600">{message}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <RefreshCw size={14} aria-hidden />Try again
          </button>
        )}
      </div>
    </Card>
  )
}

export function PageNotFound({ homeHref = '/overview', homeLabel = 'Go to Visibility Overview', onHome }) {
  return (
    <Card className="flex flex-col items-center px-5 py-14 text-center">
      <span className="text-[13px] leading-[18px] font-medium text-stone-500 tabular-nums">404</span>
      <h1 className="mt-2 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900">This page doesn’t exist</h1>
      <p className="mt-1 max-w-[440px] text-[14px] leading-5 text-stone-600">The link may be out of date, or the page has moved.</p>
      <a href={homeHref} onClick={onHome}
        className="mt-5 inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
        {homeLabel}
      </a>
    </Card>
  )
}

export function AppLoading({ label = 'Loading' }) {
  return (
    <div className="flex min-h-screen bg-page">
      {/* the sidebar's outline (desktop) / the top bar (phones) */}
      <aside aria-hidden className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-3 border-r border-stone-200 bg-stone-50 px-3 pt-4 lg:flex">
        <span className={`${line} h-7 w-28`} />
        <span className={`${line} mt-6 h-4 w-20`} />
        {[0, 1, 2].map((i) => <span key={i} className={`${line} h-8 w-full`} />)}
        <span className={`${line} mt-4 h-4 w-20`} />
        {[0, 1, 2].map((i) => <span key={i} className={`${line} h-8 w-full`} />)}
      </aside>
      <div className="min-w-0 flex-1">
        <div aria-hidden className="flex h-14 items-center border-b border-line px-3 lg:hidden"><span className={`${line} h-6 w-24`} /></div>
        <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 pb-10 pt-4 md:gap-4 md:px-6 lg:pt-8">
          <PageLoading label={label} />
        </main>
      </div>
    </div>
  )
}
