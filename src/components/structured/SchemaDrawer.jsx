import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import DrawerShell, { Dot, PageList, SectionTitle, Steps, useDrawer } from '../audit/DrawerShell'
import { IMPORTANCE, SD } from '../../data/structuredData'
import { StatusLabel, pagesLine } from './parts'

// a section to scroll to when the drawer opens (the Schemas table's "2 warnings" → Issues)
let pendingSection = null
export const setSchemaSection = (section) => { pendingSection = section ?? null }

const DEFAULT_HOW = ['Paste the snippet into the page template inside a <script type="application/ld+json"> tag.', 'Replace the example values with the ones shown on the page.', 'Re-run the analysis to check it validates.']

// Schema drawer (?schema=, pushed so Back closes it). Reads the row for the current scope (site or one page).
export default function SchemaDrawer({ rows }) {
  const drawer = useDrawer('schema', (id) => rows?.find((r) => r.id === id))
  const s = drawer.item
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t) }, [copied])
  useEffect(() => {
    if (!drawer.shown || !pendingSection) return
    const el = document.getElementById(`schema-${pendingSection}`)
    pendingSection = null
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [drawer.shown, s?.id])
  if (!s) return null
  const copy = () => { navigator.clipboard?.writeText(s.snippet).catch(() => {}); setCopied(true) }
  const problem = s.status === 'invalid' ? s.invalid : s.missing
  const google = s.doc.includes('developers.google.com')

  return (
    <DrawerShell
      drawer={drawer}
      title={s.name}
      meta={<><StatusLabel status={s.status} /><Dot /><span>{IMPORTANCE[s.importance]}</span><Dot /><span>{pagesLine(s)}</span></>}
      footer={(
        <a href={s.doc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded text-stone-600 underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">
          {google ? 'Google’s documentation' : 'schema.org reference'} <ArrowUpRight size={14} aria-hidden />
        </a>
      )}
    >
      <SectionTitle>Why it matters</SectionTitle>
      <p className="mt-1.5 text-[14px] leading-[22px] text-stone-600">{s.why}</p>

      {s.status !== 'valid' && (<><SectionTitle>How to add it</SectionTitle><Steps items={s.how ?? DEFAULT_HOW} /></>)}

      {s.warnings.length > 0 && (
        <>
          <div id="schema-issues" className="scroll-mt-4"><SectionTitle>Issues <span className="font-normal text-stone-500 tabular-nums">{s.warnings.length} {s.warnings.length === 1 ? 'warning' : 'warnings'}</span></SectionTitle></div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {s.warnings.map(([text, on]) => (
              <li key={text} className="flex items-baseline justify-between gap-4 text-[14px] leading-[22px] text-stone-900">
                <span className="min-w-0">{text}</span>
                <span className="shrink-0 text-[13px] text-stone-500 tabular-nums">{on.length} {on.length === 1 ? 'page' : 'pages'}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Snippet</SectionTitle>
      <div className="relative mt-2">
        <pre className="max-h-72 overflow-auto rounded-lg bg-tint p-4 pr-20 font-mono text-[13px] leading-5 text-stone-900">{`<script type="application/ld+json">\n${s.snippet}\n</script>`}</pre>
        <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy snippet'}
          className="absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <SectionTitle>
        {problem.length ? 'Affected pages' : 'Found on'} <span className="font-normal text-stone-500 tabular-nums">{(problem.length ? problem : s.found).length}</span>
      </SectionTitle>
      <PageList domain={SD.domain} paths={problem.length ? problem : s.found} />
    </DrawerShell>
  )
}
