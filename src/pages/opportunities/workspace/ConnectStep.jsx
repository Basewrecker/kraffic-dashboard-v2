// Step 1 — Connect Search Console: once per brand. What it is and where it stands: not asked yet → what it's for;
// declined → what's missing; connecting → a spinner; connected → green tick + property + Change. The action itself
// ("Connect →", then "Find the page →") is the payoff bar's button (PayoffBar.jsx), the one place to act.
// Beside it, the Search Console column shows what connecting fills in (workspace/SearchConsolePanel.jsx, not connected).
import { Loader2 } from 'lucide-react'
import { GoogleIcon } from '../../../components/dashboard/icons'
import { stepCard, t2, textBtn } from '../../../components/firstSetup/ui'
import { DashedRing, GreenTick } from './ui'

// status: 'new' | 'declined' | 'connected' | 'skipped' (continued without it); connecting: the OAuth round trip
export default function ConnectStep({ status, property, onStatus, connecting = false }) {
  const connected = status === 'connected'
  const declined = status === 'declined' || status === 'skipped'
  return (
    <div className={stepCard}>
      <div className="flex items-center gap-4 px-5 py-4 max-md:flex-wrap max-md:px-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line bg-surface"><GoogleIcon size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] leading-5 font-semibold text-stone-900">
            Google Search Console
            {connected && <GreenTick size={14} label="Connected" />}
            {connecting && <span className="inline-flex items-center gap-1.5 text-[13px] font-normal text-stone-600"><Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden />Connecting…</span>}
            {declined && !connecting && <span className="inline-flex items-center gap-1.5 text-[13px] font-normal text-stone-600"><DashedRing size={12} />No access</span>}
          </p>
          <p className={`mt-0.5 text-[13px] leading-[18px] ${t2} ${connected ? 'truncate' : ''}`}>
            {connected ? <><span className="font-medium text-stone-900">{property}</span> · read-only</>
              : declined ? 'Access wasn’t given, so we can’t see which of your pages already ranks.'
                : 'Read-only. We use it to find which of your pages already gets impressions for this topic.'}
          </p>
        </div>
        {connected && <button type="button" onClick={() => onStatus('new')} className={textBtn}>Change</button>}
      </div>
    </div>
  )
}
