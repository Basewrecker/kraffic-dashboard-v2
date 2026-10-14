import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import { PlatformIcon } from '../dashboard/icons'
import { useToast } from '../dashboard/overlays'
import ConfirmPopover from '../prompts/ConfirmPopover'
import Select from '../ui/Select'
import Switch from '../ui/Switch'
import { account } from '../../data/mock'
import { linkClick } from '../../router'
import { billingLive } from '../../data/mock'
import { fmtAvailable, fmtDay, trackingOptions, useTracking } from '../../store/trackingSettings'

const selectWidth = 'min-w-[140px] sm:min-w-[200px]'
// what each engine is (performance lives on the dashboard's Platform visibility card)
const ENGINE_INFO = {
  aio: 'Google’s AI answers in search results',
  gemini: 'Google’s AI assistant',
  chatgpt: 'OpenAI’s assistant',
  claude: 'Anthropic’s assistant',
  grok: 'xAI’s assistant on X',
}

// "Saved ✓" beside the control that changed, for 1.5s
function useSaved() {
  const [key, setKey] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  return [key, (k) => { setKey(k); clearTimeout(timer.current); timer.current = setTimeout(() => setKey(null), 1500) }]
}
const Saved = ({ show }) => (
  <span aria-live="polite" className={`inline-flex items-center gap-1 text-[12px] leading-4 text-stone-600 transition-opacity duration-200 ease-out ${show ? 'opacity-100' : 'opacity-0'}`}>
    {show && <><Check size={12} aria-hidden /> Saved</>}
  </span>
)
// a save that failed: said beside the control (its value is already back), with Retry
const Failed = ({ onRetry }) => (
  <span role="alert" className="inline-flex items-center gap-1.5 text-[12px] leading-4">
    <span className="text-negative">Couldn’t save</span>
    <button type="button" onClick={onRetry} className="rounded font-medium text-stone-900 underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
  </span>
)

function SettingsCard({ title, description, children, footer }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <header className="border-b border-[var(--div)] px-5 pb-3.5 pt-[18px]">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{description}</p>
      </header>
      <ul className="divide-y divide-[var(--div)]">{children}</ul>
      {footer && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-tint px-5 py-3 text-[12.5px] leading-[18px] text-stone-600 tabular-nums">{footer}</div>}
    </section>
  )
}

// name + meta on the left, one control on the right; failed: { retry } when this row's save failed
function Row({ icon, name, meta, muted, saved, failed, children }) {
  return (
    <li className="flex h-[60px] items-center justify-between gap-4 px-5">
      <span className="flex min-w-0 items-center gap-3">
        {icon}
        <span className="min-w-0">
          <span className={`block truncate text-[14px] leading-5 font-medium ${muted ? 'text-stone-500' : 'text-stone-900'}`}>{name}</span>
          <span className={`block truncate text-[12.5px] leading-[18px] tabular-nums ${muted ? 'text-stone-500' : 'text-stone-600'}`}>{meta}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {failed ? <Failed onRetry={failed.retry} /> : <Saved show={saved} />}
        {children}
      </span>
    </li>
  )
}

export default function LlmSettingsPage() {
  useEffect(() => { document.title = 'Tracking · Kraffic' }, [])
  const t = useTracking()
  const [savedKey, flash] = useSaved()
  const [toastNode, toast] = useToast({ position: 'center' })
  const [confirm, setConfirm] = useState(null) // { field, patch, anchor }: a market change waiting for a yes
  const [failed, setFailed] = useState(null) // { key, retry }: the row whose save failed

  const engines = t.platforms.filter((p) => p.ready).length
  const prompts = t.quota.used // every engine runs every tracked prompt
  const { country, language } = t.market
  const { used, limit, resetsOn } = t.quota
  const pct = used / limit
  // Sync now: allowed again at schedule.nextScanAt (null = now)
  const tooSoon = Boolean(t.schedule.nextScanAt) && new Date(t.schedule.nextScanAt) > new Date()
  // a save: the page shows the new value at once; a failure puts it back and offers Retry beside the control
  const save = (key, run) => {
    setFailed(null)
    run().then(() => flash(key), () => setFailed({ key, retry: () => save(key, run) }))
  }
  const syncNow = () => {
    setFailed(null)
    t.syncNow().then(() => toast('Sync finished'), () => setFailed({ key: 'sync', retry: syncNow }))
    toast('Sync started')
  }

  // market changes ask first
  const askMarket = (field, value, anchor) => setConfirm({ field, patch: { [field]: value }, anchor })
  const marketCopy = (c) => {
    if (c.field === 'language') return { title: `Switch language to ${c.patch.language}?`, body: `Next sync runs prompts in ${c.patch.language}; past data stays under ${language}.` }
    const to = c.patch.country
    return { title: `Switch market to ${to}?`, body: `Next sync checks answers as a user in ${to}; past data stays under ${country}.` }
  }

  return (
    // settings read better narrow: labels stay close to their controls
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 pt-2">
      <div className="mb-2 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold text-stone-900 lg:text-[28px] lg:leading-9">Tracking</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-600 md:text-[14px] md:leading-5">How Kraffic checks AI answers for {account.domain}</p>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-500 tabular-nums md:hidden">{t.syncing ? 'Syncing…' : `Updated ${fmtDay(t.schedule.lastSync)}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:pt-1">
          {failed?.key === 'sync' && <Failed onRetry={failed.retry} />}
          {/* too soon for another sync: when it's possible again */}
          {tooSoon && !t.syncing && <span className="text-[13px] leading-[18px] text-stone-500 tabular-nums max-md:order-last max-md:w-full">Available {fmtAvailable(t.schedule.nextScanAt)}</span>}
          <span className="hidden text-[13px] leading-[18px] text-stone-600 tabular-nums md:inline">{t.syncing ? 'Syncing…' : `Updated ${fmtDay(t.schedule.lastSync)}`}</span>
          <button
            type="button"
            onClick={syncNow}
            disabled={t.syncing || tooSoon}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-small font-medium text-stone-700 max-md:flex-1 md:h-9 outline-none transition-colors duration-150 ease-out hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw size={14} className={t.syncing ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
            Sync now
          </button>
        </div>
      </div>

      {/* 1 — platforms: which engines run your prompts (read-only: set by the app, not per brand) */}
      <SettingsCard
        title="AI platforms"
        description={`The AI engines Kraffic runs your prompts on. Each one that's ready runs all ${prompts} prompts every sync.`}
        footer={(
          <>
            <span>{engines} of {t.platforms.length} engines ready · {engines * prompts} prompt runs per sync</span>
            <a href="/overview" onClick={linkClick('/overview')} className="inline-flex items-center gap-1 rounded font-medium text-stone-700 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
              See results on dashboard <ArrowRight size={12} aria-hidden />
            </a>
          </>
        )}
      >
        {t.platforms.map((p) => (
          <Row
            key={p.id}
            icon={<span className={`flex transition-opacity duration-150 ${p.ready ? '' : 'opacity-50'}`}><PlatformIcon id={p.id} size={18} /></span>}
            name={p.name}
            meta={ENGINE_INFO[p.id]}
          >
            <span className={`text-right text-[13px] leading-[18px] ${p.ready ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{p.ready ? 'Tracking' : 'Not ready'}</span>
          </Row>
        ))}
      </SettingsCard>

      {/* 2 — market */}
      <SettingsCard title="Market" description="Where and how answers are checked">
        <Row name="Country" meta="Answers as a user in this country" saved={savedKey === 'country'} failed={failed?.key === 'country' ? failed : null}>
          <Select size="row" className={selectWidth} label="Country" value={country} options={trackingOptions.countries.map((c) => [c, c])} onChange={(v, el) => askMarket('country', v, el)} />
        </Row>
        <Row name="Language" meta="Language prompts are run in" saved={savedKey === 'language'} failed={failed?.key === 'language' ? failed : null}>
          <Select size="row" className={selectWidth} label="Language" value={language} options={trackingOptions.languages.map((l) => [l, l])} onChange={(v, el) => askMarket('language', v, el)} />
        </Row>
      </SettingsCard>

      {/* 3 — schedule & limits */}
      <SettingsCard title="Schedule & limits" description={`How often prompts are re-checked · applies to everyone on ${account.name}`}>
        <Row name="Check prompts every day" meta={t.schedule.daily ? 'Prompts are re-checked once a day' : 'Prompts are checked when you press Sync now'} saved={savedKey === 'daily'} failed={failed?.key === 'daily' ? failed : null}>
          <span className={`w-8 text-right text-[13px] leading-[18px] ${t.schedule.daily ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{t.schedule.daily ? 'On' : 'Off'}</span>
          <Switch size="sm" checked={t.schedule.daily} aria-label="Check prompts every day" onChange={(on) => save('daily', () => t.setDaily(on))} />
        </Row>
        {/* billing not live (production today): count only, no limit, bar or Upgrade */}
        {!billingLive ? (
        <Row name="Prompt quota" meta="No limit for now">
          <span className="text-[13px] leading-[18px] font-medium text-stone-900 tabular-nums">{used} used</span>
        </Row>
        ) : (
        <Row
          name="Prompt quota"
          meta={pct >= 1 ? 'Limit reached — new prompts won’t be scanned' : `${limit - used} left · resets ${fmtDay(resetsOn)}${pct > 0.75 ? ' · running low' : ''}`}
        >
          <span className="text-[13px] leading-[18px] font-medium text-stone-900 tabular-nums">{used} / {limit}</span>
          <span className="h-1.5 w-[72px] overflow-hidden rounded-full sm:w-[120px]" style={{ background: 'var(--data-track)' }} aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.min(pct, 1) * 100}%`, background: pct >= 1 ? 'var(--negative)' : 'var(--ink)' }} />
          </span>
          <a href="/billing/plans" onClick={linkClick('/billing/plans')} className="rounded text-[13px] leading-[18px] font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Upgrade</a>
        </Row>
        )}
      </SettingsCard>

      {confirm && (
        <ConfirmPopover
          anchor={confirm.anchor}
          {...marketCopy(confirm)}
          confirmLabel="Switch"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); save(c.field, () => t.setMarket(c.patch)) }}
        />
      )}
      {toastNode}
    </div>
  )
}
