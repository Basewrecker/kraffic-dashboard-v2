// Draft step v1, step 3 of 3: Copy & publish, the copy / export moment (in the focus panel, 880). The route stops at
// the draft: there's no publish check or tracking yet (behind ?backend=full: Publish & track). So this step says where
// the copy goes and what each action carries:
//   Where it goes: the recommended page (Update <path> / Create <path>, the reason, Open page ↗).
//   What you copy: Copy content (the panel header's button) and Copy as HTML: the publishable sections, listed;
//     Export .md: the full brief (with the page recommendation, flags and notes).
//   Before you publish: the flags not yet ticked, by score, with a way back to the draft.
//   "Saved in this browser" and when it was last copied.
import { ArrowUpRight } from 'lucide-react'
import { pageOf } from '../draft/recommend'
import { CO_BRAND } from '../../../data/contentOpportunities'
import { cmsLinkOf } from '../../../data/contentApp' // as the app

const H = 'border-b border-line-strong pb-2 text-[17px] leading-6 font-semibold text-stone-900'
const META = 'text-[13px] leading-[18px] text-stone-500'

// page: THE target page (Workspace: the user's pick, else Search Console's Publish on, else the route's page), the same
// one the Target page and the payoff bar show; the route's own when not given
export default function CopyPublish({ res, page: given = null, ticked, copiedAt, onCopyHtml, onExport, onBack }) {
  const page = given ?? pageOf(res.pageRecommendation)
  const cms = cmsLinkOf(page, CO_BRAND.domain) // as the app
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className={H}>Where it goes</h3>
        <p className="mt-3 text-[15px] leading-[22px] text-stone-900"><span className="font-semibold">{page.action === 'update' ? 'Update' : 'Create'}</span> <span className="break-all">{page.url}</span></p>
        <p className={`mt-1 ${META}`}>{page.reason}</p>
        {/* app (owner, 2026-11-05): the CMS when we know it (WordPress / Shopify admin: "Open page in CMS", "Open CMS" for a
            new page), else the live page ("Open page"); lib/content-cms.js cmsLinkFor */}
        {cms && <a href={cms.href} target="_blank" rel="noopener noreferrer" data-cms-link className="mt-2 inline-flex items-center gap-1 rounded text-[14px] font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">{cms.label}<ArrowUpRight size={14} aria-hidden /></a>}
      </section>
      {/* app (owner, 2026-11-05): no "What you copy" (Copy as HTML / Export .md are in the header's More menu, and its
          sub-line says when it was copied) and no "Before you publish" (the draft check isn't shown for now) */}
    </div>
  )
}
