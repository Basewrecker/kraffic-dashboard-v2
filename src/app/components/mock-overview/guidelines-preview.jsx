// The Brand Guidelines preview pull-out (as the app, #233; components/mock-overview/guidelines-preview.jsx and
// guidelines-text.jsx there), opened from the eye beside the Brand Guidelines button and from "View" on Add your data.
//   header   file name · type · words · added date · Replace · close
//   What we read: Tone of voice, Words to use, Words to avoid, Not found in the guide (a note when no brand rules were found)
//   Text from the file, as a document: headings, bold, lists, real tables
// No pages and no Download: the original file isn't stored, only its text.
import { FileText, X } from 'lucide-react'
import { guidelinesFile, guidelinesRead, guidelinesStamp, loadGuidelines } from '@/lib/mock-adapter-guidelines'
import { useDrawer } from '../../../components/audit/DrawerShell'
import { openDrawer } from '../../../components/audit/parts'
import { lineBtn } from '../../../components/tool/ToolPage'
import { PullOut } from '../../../whatChanged/WhatChanged'

export const GUIDE_KEY = 'guide'
export const openGuidelinesPreview = () => openDrawer(GUIDE_KEY, '1')

// **bold** inside a line
const inline = (text) => String(text).split(/(\*\*[^*]+\*\*)/).map((part, i) => (
  part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-stone-900">{part.slice(2, -2)}</strong> : part
))
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

// the file's text as a document: "# " and "## " headings, "- " lists, "| a | b |" tables, the rest paragraphs
export function GuidelinesText({ text }) {
  const lines = String(text ?? '').split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (line.startsWith('# ')) out.push(<h3 key={i} className="mt-1 text-[26px] leading-8 font-semibold tracking-[-0.02em] text-stone-900">{inline(line.slice(2))}</h3>)
    else if (/^#{2,3} /.test(line)) out.push(<h4 key={i} className="mt-3 text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">{inline(line.replace(/^#+ /, ''))}</h4>)
    else if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) items.push(lines[i++].slice(2))
      i--
      out.push(
        <ul key={i} className="flex flex-col gap-1.5">
          {items.map((it, k) => <li key={k} className="flex gap-3 text-[15px] leading-6 text-stone-700"><span aria-hidden className="mt-[10px] size-1 shrink-0 rounded-full bg-stone-400" /><span className="min-w-0">{inline(it)}</span></li>)}
        </ul>,
      )
    } else if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
      i--
      const [head, ...body] = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)))
      out.push(
        <div key={i} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-[14px] leading-5">
            <thead><tr className="bg-tint">{head.map((c, k) => <th key={k} className="px-3 py-2.5 font-medium text-stone-600">{inline(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-3 py-2.5 text-stone-900 tabular-nums">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
    } else out.push(<p key={i} className="text-[15px] leading-6 text-stone-700 text-pretty">{inline(line)}</p>)
  }
  return <div className="flex flex-col gap-3" data-guidelines-text>{out}</div>
}

const Chips = ({ items }) => <span className="flex flex-wrap gap-1.5">{items.map((w) => <span key={w} className="rounded-md bg-tint px-2 py-0.5 text-[13px] leading-[18px] text-stone-700">{w}</span>)}</span>
const label = 'text-[13px] leading-[18px] font-semibold text-stone-900'

// onReplace: closes the preview and opens the guidelines form
export default function GuidelinesPreview({ domain, onReplace }) {
  const drawer = useDrawer(GUIDE_KEY, () => loadGuidelines(domain))
  const g = drawer.item
  if (!g) return null
  const file = guidelinesFile(g)
  const read = guidelinesRead(g)
  const rows = [
    read.tone && ['Tone of voice', <span key="t" className="text-pretty">{read.tone}</span>],
    read.use.length > 0 && ['Words to use', <Chips key="u" items={read.use} />],
    read.avoid.length > 0 && ['Words to avoid', <Chips key="a" items={read.avoid} />],
    read.missing.length > 0 && ['Not found in the guide', <span key="m" className="text-pretty">{read.missing.join(', ')}</span>],
  ].filter(Boolean)
  return (
    <PullOut drawer={drawer} labelledBy="guide-preview-title" wide>
      <div className="flex flex-col gap-7" data-guidelines-preview>
        <header className="flex items-start gap-3">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-stone-600"><FileText size={16} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="guide-preview-title" className="truncate text-[16px] leading-[22px] font-semibold text-stone-900">{file.name}</h2>
            <p className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{[file.type, file.words ? `${file.words.toLocaleString('en-US')} words` : null, guidelinesStamp(g)].filter(Boolean).join(' · ')}</p>
          </div>
          {onReplace && <button type="button" onClick={() => { drawer.close(); onReplace() }} className={lineBtn}>Replace</button>}
          <button type="button" onClick={drawer.close} aria-label="Close"
            className="-mr-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus md:h-9 md:w-9">
            <X size={16} aria-hidden />
          </button>
        </header>

        <section aria-labelledby="guide-read">
          <h3 id="guide-read" className={label}>What we read</h3>
          {read.none && <p className="mt-2 text-[13px] leading-[18px] text-stone-600 text-pretty">We didn’t find brand rules in this guide. Drafts still read its text for tone.</p>}
          {rows.length > 0 && (
            <dl className="mt-3 divide-y divide-line border-y border-line">
              {rows.map(([name, value]) => (
                <div key={name} className="grid gap-x-4 gap-y-1 py-3.5 md:grid-cols-[156px_minmax(0,1fr)]">
                  <dt className={label}>{name}</dt>
                  <dd className="text-[13px] leading-[20px] text-stone-600">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {file.text.trim() && (
          <section aria-labelledby="guide-text">
            <h3 id="guide-text" className={`${label} mb-3`}>Text from the file</h3>
            <GuidelinesText text={file.text} />
          </section>
        )}
      </div>
    </PullOut>
  )
}
