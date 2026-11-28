// The exact quote behind a fact (as the app, #229; components/mock-overview/fact-quote.jsx there): the sentence as the
// page has it, with the year set apart, and the page it's on. Text read from the page's hidden product data says so.
// An older claim saved without its sentence: "No quote saved".
//   evidence: { url, snippet, hidden? } (the fact's website evidence), or null
const YEAR = /\b((?:19|20)\d{2})\b/
const pathOf = (url) => { try { const u = new URL(url); return (u.pathname === '/' ? u.hostname : u.pathname).replace(/\/$/, '') || u.hostname } catch { return url } }

export function FactQuote({ evidence, className = '' }) {
  const quote = String(evidence?.snippet ?? '').trim()
  const parts = quote ? quote.split(YEAR) : []
  return (
    <span className={`flex flex-col gap-0.5 ${className}`} data-fact-quote={quote ? '' : 'none'}>
      {quote
        ? <span className="text-stone-700 text-pretty">“{parts.map((p, i) => (i % 2 ? <span key={i} className="font-semibold text-stone-900 tabular-nums">{p}</span> : p))}”</span>
        : <span className="text-stone-500">No quote saved</span>}
      {evidence?.hidden && <span className="text-stone-500">Found in the page’s hidden product data</span>}
      {evidence?.url && (
        <a href={evidence.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          className="self-start truncate rounded text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">{pathOf(evidence.url)}</a>
      )}
    </span>
  )
}
