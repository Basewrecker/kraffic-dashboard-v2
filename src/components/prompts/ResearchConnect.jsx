import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, MoreHorizontal, Unplug, Upload } from 'lucide-react'
import ActionMenu from '../audit/ActionMenu'
import SiteLogo from '../ui/SiteLogo'
import { GoogleIcon } from '../dashboard/icons'
import ConfirmPopover from './ConfirmPopover'

// The first step of Research: "Connect and Research" (as the app, #223 / #232). One row per source:
//   logo · name and a one-line description · ONE control, right-aligned
// The control is an outlined "Connect", the split button ("Connect │ ▾", the caret opens "Upload a file"), a disabled
// Connect with the reason on the row ("Needs Amazon approval"), an outlined "Upload", or the Connected pill.
// Rows fade in once. On phones the control sits under the text and the Connected pill comes first.
// The mock connects nothing: Connect takes 900ms and the state lasts for the visit. ?sources=connected (preview only)
// shows Google Analytics 4 as connected, as in the app's screenshots.
export const RESEARCH_SOURCES = [
  { id: 'gsc', name: 'Google Search Console', desc: 'The searches that bring people to your site', logo: 'google', split: true, managed: true },
  { id: 'ga4', name: 'Google Analytics 4', desc: 'Pages people land on and where they come from', logo: 'google' },
  { id: 'shopify', name: 'Shopify', desc: 'Your products, best sellers first', logo: 'shopify.com' },
  { id: 'cloudflare', name: 'Cloudflare', desc: 'Which pages AI crawlers read', logo: 'cloudflare.com' },
  { id: 'amazon-ads', name: 'Amazon Ads', desc: 'Search terms from your ads, last 30 days', logo: 'amazon.com', split: true, locked: 'Needs Amazon approval' },
  { id: 'amazon-sqp', name: 'Amazon Search Query Performance', desc: 'What shoppers search for, last quarter', logo: 'amazon.com', split: true, locked: 'Needs Amazon approval' },
  { id: 'file', name: 'Any other file', desc: 'Keyword lists, search exports or customer questions', note: 'CSV, TSV, XLSX or TXT · up to 25 MB', upload: true },
]
const ACCEPT = '.csv,.tsv,.xlsx,.txt'
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// what's connected or uploaded, kept for the visit (the dialog can be closed and reopened)
const preview = () => new URLSearchParams(window.location.search).get('sources') === 'connected'
let memory = null
const initial = () => memory ?? (preview() ? { ga4: { connectedAt: '2026-11-26T12:00:00Z' } } : {})
let rowsSeen = false // the rows fade in once per visit

const outline = 'inline-flex h-9 items-center justify-center whitespace-nowrap border border-line bg-surface text-small font-medium text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:text-stone-400'

// The Connected pill: a green dot + "Connected" (--connected for the dot and the tint's base, never text;
// --connected-ink for the text). fresh: it has just replaced the Connect button (the morph, 250ms).
export function ConnectedPill({ fresh = false, className = '' }) {
  return (
    <span data-connected-pill className={`inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--connected-bg)] px-3 text-[13px] leading-[18px] font-medium text-[var(--connected-ink)] ${fresh ? 'rc-morph' : ''} ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--connected)]" />Connected
    </span>
  )
}

// One source's control. Only one menu is open at a time (onMenu tells the dialog which).
export function SourceAction({ source, state, busy, fresh, onConnect, onUpload, onDisconnect }) {
  const input = useRef(null)
  const more = useRef(null)
  const [menu, setMenu] = useState(false)
  const [ask, setAsk] = useState(false)
  const pick = () => input.current?.click()
  const file = (
    <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f) }} />
  )
  if (state?.connectedAt) {
    const items = source.managed
      ? [{ label: 'Manage in Site Kit', icon: ExternalLink, onClick: () => window.open('/more-tools/site-kit', '_blank', 'noopener') }]
      : [{ label: 'Disconnect', icon: Unplug, danger: true, onClick: () => setAsk(true) }]
    return (
      <span className="flex items-center gap-2 max-md:flex-row-reverse max-md:justify-end">
        <span ref={more} className="inline-flex">
          <ActionMenu portal label={`More for ${source.name}`} items={items}
            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus aria-expanded:bg-tint aria-expanded:text-stone-900">
            <MoreHorizontal size={16} aria-hidden />
          </ActionMenu>
        </span>
        <ConnectedPill fresh={fresh} />
        {ask && (
          <ConfirmPopover anchor={more.current} title={`Disconnect ${source.name}?`} body="Research stops reading it. You can connect it again anytime." confirmLabel="Disconnect"
            onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); onDisconnect() }} />
        )}
      </span>
    )
  }
  if (source.upload) return <>{file}<button type="button" onClick={pick} className={`${outline} min-w-[104px] rounded-lg px-3`}>Upload</button></>
  const connect = (
    <button type="button" onClick={onConnect} disabled={Boolean(source.locked) || busy} aria-busy={busy || undefined}
      className={`${outline} ${source.split ? 'relative min-w-[77px] rounded-l-lg px-3' : 'min-w-[104px] rounded-lg px-3'}`}>
      {busy ? <><Loader2 size={14} className="mr-1.5 animate-spin motion-reduce:animate-none" aria-hidden />Connecting…</> : 'Connect'}
    </button>
  )
  if (!source.split) return connect
  // the split button: two halves that share one border (they overlap by 1px); the caret half tints while open
  return (
    <span className="inline-flex" data-split-button>
      {file}
      {connect}
      <ActionMenu portal label={`Other ways to add ${source.name}`} onOpenChange={setMenu} items={[{ label: 'Upload a file', icon: Upload, onClick: pick }]}
        className={`${outline} relative -ml-px w-7 rounded-r-lg aria-expanded:bg-tint`}>
        {menu ? <ChevronUp size={15} className="text-stone-600" aria-hidden /> : <ChevronDown size={15} className="text-stone-600" aria-hidden />}
      </ActionMenu>
    </span>
  )
}

const Logo = ({ source }) => (
  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center">
    {source.logo === 'google' ? <GoogleIcon size={26} />
      : source.logo ? <SiteLogo domain={source.logo} name={source.name} className="h-8 w-8 rounded-md" initialClass="text-[12px]" />
        : <span className="grid h-8 w-8 place-items-center rounded-md bg-tint text-stone-600"><FileText size={16} /></span>}
  </span>
)

// The step's body: the rows. Its title, the one-line subtitle and the footer are the dialog's (ResearchModal).
export default function ResearchConnect() {
  const [states, setStates] = useState(initial)
  const [busy, setBusy] = useState(null)
  const [fresh, setFresh] = useState(null) // the source whose Connect has just become the pill
  const timer = useRef(null)
  const stagger = useRef(!rowsSeen)
  useEffect(() => { rowsSeen = true; return () => clearTimeout(timer.current) }, [])
  const set = (next) => { memory = next; setStates(next) }
  const connect = (s) => {
    setBusy(s.id)
    timer.current = setTimeout(() => { setBusy(null); setFresh(s.id); set({ ...states, [s.id]: { connectedAt: new Date().toISOString() } }) }, 900)
  }
  return (
    <ul className="divide-y divide-line border-y border-line" data-research-connect>
      {RESEARCH_SOURCES.map((s, i) => {
        const st = states[s.id]
        return (
          <li key={s.id} className={`flex flex-wrap items-center gap-x-5 gap-y-2 py-4 pl-2 md:flex-nowrap ${stagger.current ? 'rc-row' : ''}`} style={stagger.current ? { '--i': i } : undefined}>
            <Logo source={s} />
            <div className="min-w-0 flex-1 basis-[200px]">
              <p className="text-[14px] leading-5 font-medium text-stone-900">{s.name}</p>
              <p className="text-[13px] leading-[18px] text-stone-600 text-pretty">{s.desc}</p>
              {st?.connectedAt
                ? <><p className="text-[13px] leading-[18px] text-stone-600 tabular-nums">connected {day(st.connectedAt)}</p><p className="text-[13px] leading-[18px] text-stone-500">Not read yet</p></>
                : st?.file ? <p className="truncate text-[13px] leading-[18px] text-stone-500">{st.file} · ready to read</p>
                  : (s.locked || s.note) && <p className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{s.locked ?? s.note}</p>}
            </div>
            <div className="flex shrink-0 justify-end max-md:basis-full max-md:justify-start max-md:pl-[52px]">
              <SourceAction source={s} state={st} busy={busy === s.id} fresh={fresh === s.id}
                onConnect={() => connect(s)} onUpload={(f) => set({ ...states, [s.id]: { file: f.name } })}
                onDisconnect={() => { const { [s.id]: _gone, ...rest } = states; setFresh(null); set(rest) }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
