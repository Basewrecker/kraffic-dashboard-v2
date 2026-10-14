import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import Card from './dashboard/Card'
import { linkClick } from '../router'
import { account } from '../data/mock'

// A brand with no data yet (switched to from the workspace menu): every data page shows this instead of its content.
const TITLES = { '/overview': 'Visibility Overview', '/tracker': 'Prompt Hub', '/trends': 'Trends', '/audit': 'Site Audit', '/structured-data': 'Structured Data', '/more-tools': 'Toolkit', '/more-tools/tool': 'Toolkit', '/citations': 'Citations', '/sentiment': 'Sentiment', '/fact-check': 'Fact Check' }
export default function EmptyBrand({ route }) {
  const title = TITLES[route] ?? 'Overview'
  useEffect(() => { document.title = `${title} · ${account.name} · Kraffic` }, [title])
  return (
    <>
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{title}</h1>
      <Card className="flex flex-col items-center px-5 py-14 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-ink" aria-hidden><Sparkles size={20} /></span>
        <h2 className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">No data for {account.name} yet</h2>
        <p className="mt-1 max-w-[440px] text-[14px] leading-5 text-stone-600">Add the prompts {account.name} should show up for and its competitors. The first sync runs within a day and fills this page.</p>
        <a href="/brands" onClick={linkClick('/brands')} className="mt-5 inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">Set up {account.name}</a>
      </Card>
    </>
  )
}
