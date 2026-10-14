import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import Segmented from '../dashboard/Segmented'
import { PlatformIcon } from '../dashboard/icons'
import { useToast } from '../dashboard/overlays'
import ConfirmPopover from '../prompts/ConfirmPopover'
import Select from '../ui/Select'
import Switch from '../ui/Switch'
import { account } from '../../data/mock'
import { linkClick } from '../../router'
import { billingLive } from '../../data/mock'
import {
  CURRENCIES, FREQUENCIES, LANGUAGES, REGIONS, countryInfo, fmtDay, fmtTime, fmtWeekday, useTracking,
} from '../../store/trackingSettings'

const CURRENCY_NAMES = { USD: 'US dollar', GBP: 'British pound', EUR: 'Euro', AED: 'UAE dirham', SGD: 'Singapore dollar' }
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

// name + meta on the left, one control on the right
function Row({ icon, name, meta, muted, saved, children }) {
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
        <Saved show={saved} />
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
  const [confirm, setConfirm] = useState(null) // { kind: 'pause' | 'market', ... }

  const engines = t.platforms.filter((p) => p.enabled).length
  const prompts = t.quota.used // every engine runs every tracked prompt
  const { region, country, language, currency } = t.market
  const { used, limit, resetsOn } = t.quota
  const pct = used / limit
  const syncNow = () => { t.syncNow(); toast('Sync started') }

  // market changes ask first; region picks that region's first country
  const askMarket = (field, value, anchor) => {
    const patch = field === 'region' ? { region: value, country: REGIONS[value][0].name } : { [field]: value }
    setConfirm({ kind: 'market', field, patch, anchor })
  }
  const marketCopy = (c) => {
    if (c.field === 'language') return { title: `Switch language to ${c.patch.language}?`, body: `Next sync runs prompts in ${c.patch.language}; past data stays under ${language}.` }
    const to = c.patch.country
    return { title: `Switch market to ${to}?`, body: `Next sync tracks ${countryInfo(to)?.short ?? to} answers; past data stays under ${country}.` }
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
        <div className="flex items-center gap-3 md:pt-1">
          <span className="hidden text-[13px] leading-[18px] text-stone-600 tabular-nums md:inline">{t.syncing ? 'Syncing…' : `Updated ${fmtDay(t.schedule.lastSync)}`}</span>
          <button
            type="button"
            onClick={syncNow}
            disabled={t.syncing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-small font-medium text-stone-700 max-md:flex-1 md:h-9 outline-none transition-colors duration-150 ease-out hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw size={14} className={t.syncing ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
            Sync now
          </button>
        </div>
      </div>

      {/* 1 — platforms: a pure on/off setting */}
      <SettingsCard
        title="AI platforms"
        description={`Choose which AI engines Kraffic runs your prompts on. Each one runs all ${prompts} prompts every sync.`}
        footer={(
          <>
            <span>{engines} of {t.platforms.length} engines on · {engines * prompts} prompt runs per sync</span>
            <a href="/overview" onClick={linkClick('/overview')} className="inline-flex items-center gap-1 rounded font-medium text-stone-700 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
              See results on dashboard <ArrowRight size={12} aria-hidden />
            </a>
          </>
        )}
      >
        {t.platforms.map((p) => (
          <Row
            key={p.id}
            icon={<span className={`flex transition-opacity duration-150 ${p.enabled ? '' : 'opacity-50'}`}><PlatformIcon id={p.id} size={18} /></span>}
            name={p.name}
            meta={ENGINE_INFO[p.id]}
            saved={savedKey === `p-${p.id}`}
          >
            <span className={`w-16 text-right text-[13px] leading-[18px] ${p.enabled ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{p.enabled ? 'Tracking' : 'Off'}</span>
            <Switch
              size="sm"
              checked={p.enabled}
              aria-label={`Track ${p.name}`}
              onChange={(on, anchor) => { if (on) { t.setPlatform(p.id, true); flash(`p-${p.id}`) } else setConfirm({ kind: 'pause', platform: p, anchor }) }}
            />
          </Row>
        ))}
      </SettingsCard>

      {/* 2 — market */}
      <SettingsCard title="Market" description="Where and how answers are checked · saved per user">
        <Row name="Region" meta="Where answers are checked from" saved={savedKey === 'region'}>
          <Select size="row" className={selectWidth} label="Region" value={region} options={Object.keys(REGIONS).map((r) => [r, r])} onChange={(v, el) => askMarket('region', v, el)} />
        </Row>
        <Row name="Country" meta="Answers as a user in this country" saved={savedKey === 'country'}>
          <Select size="row" className={selectWidth} label="Country" value={country} options={REGIONS[region].map((c) => [c.name, c.name])} onChange={(v, el) => askMarket('country', v, el)} />
        </Row>
        <Row name="Language" meta="Language prompts are run in" saved={savedKey === 'language'}>
          <Select size="row" className={selectWidth} label="Language" value={language} options={LANGUAGES.map((l) => [l, l])} onChange={(v, el) => askMarket('language', v, el)} />
        </Row>
        <Row name="Currency" meta="Used for prices in AI answers" saved={savedKey === 'currency'}>
          <Select size="row" className={selectWidth} label="Currency" value={currency} options={CURRENCIES.map((c) => [c.code, `${c.symbol} ${c.code} · ${CURRENCY_NAMES[c.code]}`])} onChange={(v) => { t.setMarket({ currency: v }); flash('currency') }} />
        </Row>
      </SettingsCard>

      {/* 3 — schedule & limits */}
      <SettingsCard title="Schedule & limits" description={`How often prompts are re-checked · applies to everyone on ${account.name}`}>
        <Row name="Sync frequency" meta={`Next sync ${fmtWeekday(t.schedule.nextSync)} · ${fmtTime(t.schedule.nextSync)}`} saved={savedKey === 'frequency'}>
          <Segmented
            label="Sync frequency"
            size="sm"
            value={t.schedule.frequency}
            onChange={(v) => { if (v !== t.schedule.frequency) { t.setFrequency(v); flash('frequency') } }}
            options={FREQUENCIES.map(([value, label]) => ({ value, label }))}
          />
        </Row>
        {/* billing not live (production today): count only, no limit, bar or Upgrade */}
        {!billingLive ? (
        <Row name="Prompt quota" meta={`Resets ${fmtDay(resetsOn)} · no limit for now`}>
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

      {confirm?.kind === 'pause' && (
        <ConfirmPopover
          anchor={confirm.anchor}
          title={`Stop running prompts on ${confirm.platform.name}?`}
          body="Past results are kept."
          confirmLabel="Turn off"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { t.setPlatform(confirm.platform.id, false); flash(`p-${confirm.platform.id}`); setConfirm(null) }}
        />
      )}
      {confirm?.kind === 'market' && (
        <ConfirmPopover
          anchor={confirm.anchor}
          {...marketCopy(confirm)}
          confirmLabel="Switch"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { t.setMarket(confirm.patch); flash(confirm.field); setConfirm(null) }}
        />
      )}
      {toastNode}
    </div>
  )
}
