import { useSyncExternalStore } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import Card from '../dashboard/Card'
import { cardStatus, retryCard, subscribeCards } from '../../data/cards'

// Card-level states (data/cards.js): the page-level states (PageState.jsx) at the size of one card, so a card that is
// still loading or failed never holds the rest of the page.
//   CardLoading  the card's skeleton at its own fixed height (nothing jumps when it arrives)
//   CardError    what happened, and Try again (that card only)
//   CardGate     a card, its skeleton or its error, from the card's status
const sk = 'animate-pulse rounded-2xl bg-tint motion-reduce:animate-none'

export function CardLoading({ className = '', label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className={`${sk} ${className}`}>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function CardError({ className = '', message, onRetry }) {
  return (
    <Card role="alert" className={`flex items-start gap-3 p-5 ${className}`}>
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-negative" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-5 text-stone-600">{message || 'This card couldn’t load.'}</p>
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

// height: the card's own height classes (e.g. "h-[443px] lg:h-[457px]"), used by the skeleton and the error alike
export function CardGate({ card, height, label, children }) {
  const status = useSyncExternalStore(subscribeCards, () => cardStatus(card), () => cardStatus(card))
  if (status.state === 'loading') return <CardLoading className={height} label={label} />
  if (status.state === 'error') return <CardError className={height} message={status.message} onRetry={() => retryCard(card)} />
  return children
}
