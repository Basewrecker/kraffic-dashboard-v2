import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import Card from './dashboard/Card'
import { linkClick } from '../router'
import { account } from '../data/mock'

// A brand with no data yet (switched to from the workspace menu): every data page shows this instead of its content.
const TITLES = { '/overview': 'Visibility Overview', '/tracker': 'Prompt Hub', '/trends': 'Trends', '/audit': 'Site Audit', '/structured-data': 'Structured Data', '/more-tools': 'Toolkit', '/more-tools/tool': 'Toolkit', '/citations': 'Citations', '/sentiment': 'Sentiment', '/fact-check': 'Fact Check' }
// onSetup (optional): what "Set up {brand}" does instead of linking to /brands (e.g. the app's own Brand Setup route)
// setUp: the brand has its prompts and competitors, only the first sync is missing → "View prompts" (Prompt Hub);
// onPrompts (optional): what "View prompts" does instead of linking to /tracker
const button = 'mt-5 inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'

export default function EmptyBrand({ route, onSetup, setUp = false, onPrompts }) {
  const title = TITLES[route] ?? 'Overview'
  useEffect(() => { document.title = `${title} · ${account.name} · Kraffic` }, [title])
  return (
    <>
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{title}</h1>
      <Card className="flex flex-col items-center px-5 py-14 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-ink" aria-hidden><Sparkles size={20} /></span>
        <h2 className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">No data for {account.name} yet</h2>
        {setUp ? (
          <>
            <p className="mt-1 max-w-[440px] text-[14px] leading-5 text-stone-600">Your first sync runs within a day.</p>
            <a href="/tracker" onClick={onPrompts ? (e) => { e.preventDefault(); onPrompts() } : linkClick('/tracker')} className={button}>View prompts</a>
          </>
        ) : (
          <>
            <p className="mt-1 max-w-[440px] text-[14px] leading-5 text-stone-600">Add the prompts {account.name} should show up for and its competitors. The first sync runs within a day and fills this page.</p>
            <a href="/brands" onClick={onSetup ? (e) => { e.preventDefault(); onSetup() } : linkClick('/brands')} className={button}>Set up {account.name}</a>
          </>
        )}
      </Card>
    </>
  )
}
