import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import Segmented from '../dashboard/Segmented'
import { PlatformIcon } from '../dashboard/icons'
import { useToast } from '../dashboard/overlays'
import ConfirmPopover from '../prompts/ConfirmPopover'
import Select from '../ui/Select'
import Switch from '../ui/Switch'
import SyncSheet, { SYNC_ENGINE } from './SyncSheet'
import { account, missedPrompts, syncModes } from '../../data/mock'
import { role } from '../../store/workspace'
import { linkClick } from '../../router'
import { fmtAvailable, fmtDay, useTracking } from '../../store/trackingSettings'

const selectWidth = 'min-w-[140px] sm:min-w-[200px]'
const EVERY = { daily: 'every day', weekly: 'every week', monthly: 'every month' }
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

// Every row is prop-driven: it renders only when its options and its save handler are passed, so each backend shows
// just what it can save (data/mock.js appTracking for app.kraffic.ai, krafficTracking for kraffic.ai). A card with no
// rows isn't drawn.
//   onSetEngine(id, on)                   engine on / off switches; without it the engines are read-only (ready or not)
//   onSaveMarket(patch) + regions         Region ([{ value, countries }]; the Country select follows it)
//                       + countries       Country (a flat list, when there are no regions)
//                       + languages       Language
//                       + currencies      Currency ([value, label] pairs)
//   onSetFrequency(f) + frequencies       Schedule: sync frequency ([value, label] pairs)
//   onSetDaily(on)                        Schedule: the daily-check switch
//   onSyncNow()                           Sync now in the header ({ lastSync, nextScanAt })
export default function LlmSettingsPage({
  regions, countries, languages, currencies, frequencies,
  onSetEngine, onSaveMarket, onSetFrequency, onSetDaily, onSyncNow,
}) {
  useEffect(() => { document.title = 'Tracking · Kraffic' }, [])
  const t = useTracking()
  const [savedKey, flash] = useSaved()
  const [toastNode, toast] = useToast({ position: 'center' })
  const [confirm, setConfirm] = useState(null) // { kind: 'pause', platform, anchor } | { kind: 'market', field, patch, anchor }
  const [failed, setFailed] = useState(null) // { key, retry }: the row whose save failed

  const toggles = Boolean(onSetEngine)
  const engines = t.platforms.filter((p) => (toggles ? p.enabled : p.ready)).length
  const prompts = t.quota.used // every engine runs every tracked prompt
  const { region, country, language, currency } = t.market
  // Sync now: allowed again at schedule.nextScanAt (null = now)
  const tooSoon = Boolean(t.schedule.nextScanAt) && new Date(t.schedule.nextScanAt) > new Date()
  // a save: the page shows the new value at once; a failure puts it back and offers Retry beside the control
  const save = (key, run) => {
    setFailed(null)
    run().then(() => flash(key), () => setFailed({ key, retry: () => save(key, run) }))
  }
  const failedFor = (key) => (failed?.key === key ? failed : null)
  // Sync now: a sheet first (what runs and roughly how many paid calls), then the sync; "Sync started" once the server
  // took it, the engines' progress while it runs, "still running in the background" when it outlasts the wait (followed
  // to the end), "Sync finished" when the results are in
  const [syncSheet, setSyncSheet] = useState(false)
  const modes = account.domain ? syncModes.website : syncModes.brand
  const syncNow = (mode) => {
    setFailed(null)
    setSyncSheet(false)
    t.syncNow(onSyncNow, { mode, onAccepted: () => toast('Sync started'), onDone: () => toast('Sync finished') })
      .then((res) => res?.status === 'complete' && toast('Sync finished'), () => setFailed({ key: 'sync', retry: () => syncNow(mode) }))
  }
  // client users don't start syncs (their agency or Kraffic runs them): no button, a line saying so
  const canSync = Boolean(onSyncNow) && role() !== 'client'

  // which rows this backend can save
  const regionList = onSaveMarket && regions?.length ? regions : null
  const countryList = onSaveMarket ? (regionList ? regionList.find((r) => r.value === region)?.countries ?? [] : countries) : null
  const show = {
    region: Boolean(regionList),
    country: Boolean(countryList),
    language: Boolean(onSaveMarket && languages?.length),
    currency: Boolean(onSaveMarket && currencies?.length),
    frequency: Boolean(onSetFrequency && frequencies?.length),
    daily: Boolean(onSetDaily),
  }

  // market changes ask first (a value not set yet: "Set …" instead of "Switch …"); region picks its first country
  const askMarket = (field, value, anchor) => {
    if (!value) return
    const patch = field === 'region' ? { region: value, country: regionList.find((r) => r.value === value)?.countries[0] ?? null } : { [field]: value }
    setConfirm({ kind: 'market', field, patch, anchor })
  }
  const marketCopy = (c) => {
    if (c.field === 'language') {
      const to = c.patch.language
      return language ? { title: `Switch language to ${to}?`, body: `Next sync runs prompts in ${to}; past data stays under ${language}.` }
        : { title: `Set language to ${to}?`, body: `Next sync runs prompts in ${to}.` }
    }
    const to = c.patch.country
    return country ? { title: `Switch market to ${to}?`, body: `Next sync checks answers as a user in ${to}; past data stays under ${country}.` }
      : { title: `Set market to ${to}?`, body: `Next sync checks answers as a user in ${to}.` }
  }
  // a select whose value isn't set yet starts with "Not set"; a saved value the list doesn't have stays listed
  const optionsFor = (list, value) => {
    const pairs = list.map((x) => (Array.isArray(x) ? x : [x, x]))
    return [...(!value ? [['', 'Not set']] : pairs.some(([v]) => v === value) ? [] : [[value, value]]), ...pairs]
  }
  const updated = t.syncing ? 'Syncing…' : t.schedule.lastSync ? `Updated ${fmtDay(t.schedule.lastSync)}` : 'Not synced yet'

  return (
    // settings read better narrow: labels stay close to their controls
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 pt-2">
      <div className="mb-2 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold text-stone-900 lg:text-[28px] lg:leading-9">Tracking</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-600 md:text-[14px] md:leading-5">How Kraffic checks AI answers for {account.domain}</p>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-500 tabular-nums md:hidden">{updated}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:pt-1">
          {failed?.key === 'sync' && <Failed onRetry={failed.retry} />}
          {/* too soon for another sync: when it's possible again */}
          {canSync && tooSoon && !t.syncing && <span className="text-[13px] leading-[18px] text-stone-500 tabular-nums max-md:order-last max-md:w-full">Available {fmtAvailable(t.schedule.nextScanAt)}</span>}
          <span className="hidden text-[13px] leading-[18px] text-stone-600 tabular-nums md:inline">{updated}</span>
          {onSyncNow && !canSync && <span className="text-[13px] leading-[18px] text-stone-500">Your agency runs syncs</span>}
          {canSync && (
          <button
            type="button"
            onClick={() => setSyncSheet(true)}
            disabled={t.syncing || t.syncBackground || tooSoon}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-small font-medium text-stone-700 max-md:flex-1 md:h-9 outline-none transition-colors duration-150 ease-out hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw size={14} className={t.syncing ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
            Sync now
          </button>
          )}
        </div>
      </div>

      {/* a sync on its way: starting, each engine's progress, or still running in the background */}
      {canSync && (t.syncing || t.syncBackground) && (
        <p role="status" className="-mt-3 text-[13px] leading-[18px] text-stone-600 tabular-nums">
          {t.syncBackground
            ? 'Still running in the background. Results appear as each engine finishes.'
            : !t.syncAccepted ? 'Starting the sync…'
              : t.syncProgress ? Object.entries(t.syncProgress).map(([e, p]) => `${SYNC_ENGINE[e] ?? e} ${p.done}/${p.total}`).join(' · ')
                : 'Sync started'}
        </p>
      )}
      <SyncSheet open={syncSheet} onClose={() => setSyncSheet(false)} name={account.name} modes={modes}
        counts={{ prompts, missed: missedPrompts.length }} onStart={syncNow} />

      {/* 1 — platforms: on/off switches when the backend saves them; otherwise read-only (ready or not) */}
      <SettingsCard
        title="AI platforms"
        description={toggles
          ? `Choose which AI engines Kraffic runs your prompts on. Each one runs all ${prompts} prompts every sync.`
          : `The AI engines Kraffic runs your prompts on. Each one that's ready runs all ${prompts} prompts every sync.`}
        footer={(
          <>
            <span>{engines} of {t.platforms.length} engines {toggles ? 'on' : 'ready'} · {engines * prompts} prompt runs per sync</span>
            <a href="/overview" onClick={linkClick('/overview')} className="inline-flex items-center gap-1 rounded font-medium text-stone-700 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
              See results on dashboard <ArrowRight size={12} aria-hidden />
            </a>
          </>
        )}
      >
        {t.platforms.map((p) => {
          const on = toggles ? p.enabled : p.ready
          return (
            <Row
              key={p.id}
              icon={<span className={`flex transition-opacity duration-150 ${on ? '' : 'opacity-50'}`}><PlatformIcon id={p.id} size={18} /></span>}
              name={p.name}
              meta={ENGINE_INFO[p.id]}
              saved={savedKey === `p-${p.id}`}
              failed={failedFor(`p-${p.id}`)}
            >
              <span className={`w-16 text-right text-[13px] leading-[18px] ${on ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{on ? 'Tracking' : toggles ? 'Off' : 'Not ready'}</span>
              {toggles && (
                <Switch
                  size="sm"
                  checked={p.enabled}
                  aria-label={`Track ${p.name}`}
                  onChange={(next, anchor) => {
                    if (next) save(`p-${p.id}`, () => t.setPlatform(p.id, true, onSetEngine))
                    // the last engine on stays on (the API needs one)
                    else if (engines === 1) toast('Keep at least one engine on')
                    else setConfirm({ kind: 'pause', platform: p, anchor })
                  }}
                />
              )}
            </Row>
          )
        })}
      </SettingsCard>

      {/* 2 — market */}
      {(show.region || show.country || show.language || show.currency) && (
      <SettingsCard title="Market" description="Where and how answers are checked">
        {show.region && (
          <Row name="Region" meta="Where answers are checked from" saved={savedKey === 'region'} failed={failedFor('region')}>
            <Select size="row" className={selectWidth} label="Region" value={region ?? ''} options={optionsFor(regionList.map((r) => r.value), region)} onChange={(v, el) => askMarket('region', v, el)} />
          </Row>
        )}
        {show.country && (
          <Row name="Country" meta="Answers as a user in this country" saved={savedKey === 'country'} failed={failedFor('country')}>
            <Select size="row" className={selectWidth} label="Country" value={country ?? ''} options={optionsFor(countryList, country)} onChange={(v, el) => askMarket('country', v, el)} />
          </Row>
        )}
        {show.language && (
          <Row name="Language" meta="Language prompts are run in" saved={savedKey === 'language'} failed={failedFor('language')}>
            <Select size="row" className={selectWidth} label="Language" value={language ?? ''} options={optionsFor(languages, language)} onChange={(v, el) => askMarket('language', v, el)} />
          </Row>
        )}
        {show.currency && (
          <Row name="Currency" meta="Used for prices in AI answers" saved={savedKey === 'currency'} failed={failedFor('currency')}>
            <Select size="row" className={selectWidth} label="Currency" value={currency ?? ''} options={optionsFor(currencies, currency)} onChange={(v) => { if (v) save('currency', () => t.setMarket({ currency: v }, onSaveMarket)) }} />
          </Row>
        )}
      </SettingsCard>
      )}

      {/* 3 — schedule */}
      {(show.frequency || show.daily) && (
      <SettingsCard title="Schedule" description="How often prompts are re-checked">
        {show.frequency && (
          <Row name="Sync frequency" meta={EVERY[t.schedule.frequency] ? `Prompts are re-checked ${EVERY[t.schedule.frequency]}` : 'Not set'} saved={savedKey === 'frequency'} failed={failedFor('frequency')}>
            <Segmented
              label="Sync frequency"
              size="sm"
              value={t.schedule.frequency}
              onChange={(v) => { if (v !== t.schedule.frequency) save('frequency', () => t.setFrequency(v, onSetFrequency)) }}
              options={frequencies.map(([value, label]) => ({ value, label }))}
            />
          </Row>
        )}
        {show.daily && (
          <Row name="Check prompts every day" meta={t.schedule.daily ? 'Prompts are re-checked once a day' : 'Prompts are checked when you press Sync now'} saved={savedKey === 'daily'} failed={failedFor('daily')}>
            <span className={`w-8 text-right text-[13px] leading-[18px] ${t.schedule.daily ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{t.schedule.daily ? 'On' : 'Off'}</span>
            <Switch size="sm" checked={t.schedule.daily} aria-label="Check prompts every day" onChange={(on) => save('daily', () => t.setDaily(on, onSetDaily))} />
          </Row>
        )}
      </SettingsCard>
      )}

      {confirm?.kind === 'pause' && (
        <ConfirmPopover
          anchor={confirm.anchor}
          title={`Stop running prompts on ${confirm.platform.name}?`}
          body="Past results are kept."
          confirmLabel="Turn off"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const id = confirm.platform.id; setConfirm(null); save(`p-${id}`, () => t.setPlatform(id, false, onSetEngine)) }}
        />
      )}
      {confirm?.kind === 'market' && (
        <ConfirmPopover
          anchor={confirm.anchor}
          {...marketCopy(confirm)}
          confirmLabel="Switch"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); save(c.field, () => t.setMarket(c.patch, onSaveMarket)) }}
        />
      )}
      {toastNode}
    </div>
  )
}
