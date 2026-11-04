// Draft step v1, step 3 of 3: Copy & publish, the copy / export moment (in the focus panel, 880). The route stops at
// the draft: there's no publish check or tracking yet (behind ?backend=full: Publish & track). So this step says where
// the copy goes and what each action carries:
//   Where it goes: the recommended page (Update <path> / Create <path>, the reason, Open page ↗).
//   What you copy: Copy content (the panel header's button) and Copy as HTML: the publishable sections, listed;
//     Export .md: the full brief (with the page recommendation, flags and notes).
//   Before you publish: the flags not yet ticked, by score, with a way back to the draft.
//   "Saved in this browser" and when it was last copied.
import { ArrowUpRight, Check, Code, Download } from 'lucide-react'
import { lineBtn } from '../../../components/tool/ToolPage'
import { draftSections, pageOf, sortedFlags } from '../draft/recommend'
import { savedLabel } from '../DraftStep'

const H = 'border-b border-line-strong pb-2 text-[17px] leading-6 font-semibold text-stone-900'
const META = 'text-[13px] leading-[18px] text-stone-500'

// page: THE target page (Workspace: the user's pick, else Search Console's Publish on, else the route's page), the same
// one the Target page and the payoff bar show; the route's own when not given
export default function CopyPublish({ res, page: given = null, ticked, copiedAt, onCopyHtml, onExport, onBack }) {
  const page = given ?? pageOf(res.pageRecommendation)
  const sections = draftSections(res.contentMarkdown).shown.map((s) => s.title)
  const open = sortedFlags(res.flags).filter((f) => !ticked.includes(f.id))
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className={H}>Where it goes</h3>
        <p className="mt-3 text-[15px] leading-[22px] text-stone-900"><span className="font-semibold">{page.action === 'update' ? 'Update' : 'Create'}</span> <span className="break-all">{page.url}</span></p>
        <p className={`mt-1 ${META}`}>{page.reason}</p>
        {page.action === 'update' && page.href && <a href={page.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 rounded text-[14px] font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">Open page<ArrowUpRight size={14} aria-hidden /></a>}
      </section>
      <section>
        <h3 className={H}>What you copy</h3>
        <p className="mt-3 text-[15px] leading-[22px] text-stone-700">Copy content and Copy as HTML carry the publishable sections only: {sections.join(', ')}.</p>
        <p className={`mt-1 ${META}`}>Export .md is the full brief, with the page recommendation, the flags and any publishing notes.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onCopyHtml} className={lineBtn}><Code size={16} aria-hidden />Copy as HTML</button>
          <button type="button" onClick={onExport} className={lineBtn}><Download size={16} aria-hidden />Export .md</button>
          <span className={`ml-2 ${META}`}>{copiedAt ? <><Check size={13} className="mr-1 inline text-[var(--rep-up-fg)]" aria-hidden />Copied {savedLabel(copiedAt)} · saved in this browser</> : 'Saved in this browser'}</span>
        </div>
      </section>
      <section>
        <h3 className={H}>Before you publish {open.length > 0 && <span className="font-normal tabular-nums text-stone-500">{open.length}</span>}</h3>
        {open.length ? (
          <ul>
            {open.map((f) => (
              <li key={f.id} className="flex min-h-11 items-center gap-3 border-b border-[var(--div)] py-2">
                <span className="min-w-0 flex-1 text-[14px] leading-5 text-stone-800">{f.text}</span>
                <span className={`inline-flex h-5 items-center rounded px-1.5 text-[12px] leading-4 font-medium ${f.label === 'Expert review' ? 'bg-[color-mix(in_srgb,var(--negative)_12%,transparent)] text-negative' : 'bg-tint text-stone-700'}`}>{f.label}</span>
                <span className="w-5 text-right text-[13px] font-semibold tabular-nums text-stone-900">{f.score}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-[15px] leading-[22px] text-stone-700">Every flag is ticked.</p>}
        <button type="button" onClick={onBack} className="mt-3 rounded text-[14px] font-medium text-stone-700 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Back to the draft</button>
      </section>
    </div>
  )
}
