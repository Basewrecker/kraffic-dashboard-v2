// App-only piece of the Fact Check page (components/mock/pages/facts/WebsiteFactsPage.jsx), kept out of the copied file
// so a later copy from the mock can't drop it. The mock has no design for a failed save or a failed read: one plain
// line, the message in the Sentiment page's negative token, then Retry, in the text classes of the place it sits.
export function FailLine({ fail, className = '', text = 'text-[13px] leading-[18px]' }) {
  if (!fail) return null
  return (
    <p role="alert" className={`flex flex-wrap items-baseline gap-x-1.5 ${text} ${className}`}>
      <span className="text-negative">{fail.message}</span>
      <button type="button" onClick={fail.retry} className="rounded font-semibold text-stone-900 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
    </p>
  )
}
