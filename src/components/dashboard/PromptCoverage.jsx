import { useEffect, useRef, useState } from 'react'
import Card from './Card'
import Insight, { hl, hlOpacity, useExplain } from '../ui/Insight'
import SiteLogo from '../ui/SiteLogo'
import Pie from '../ui/Pie'
import { useCardBrand } from './BrandSelect'
import { sourceLine } from './insights'
import { OWN, TRACKED_BRANDS, brandByDomain, getBrandView } from '../../data/brandViews'
import { trackedPrompts } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'
import { navigate } from '../../router'
import { useTracking } from '../../store/trackingSettings'

// "Prompt coverage": how the tracked prompts split between the brands that show up in them — the selected brand
// in ink, the rest in graphite steps by size. Same anatomy as Marketplace visibility: headline + pie + rows + insight.
// prompts = tracked prompts where the brand appears in any (filtered) engine's answer; share = of all brands' prompts.
const HOVER_DELAY = 80 // ms; sweeping across slices doesn't flicker through each one
const STEPS = ['var(--data-c1)', 'var(--data-c2)', 'var(--data-c3)']
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

// whole percentages that still add up to 100 (largest remainder)
function shares(values) {
  const total = values.reduce((a, b) => a + b, 0)
  if (!total) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left-- } })
  return out
}
const promptsLink = (domain, engine) => `/tracker?brand=${brandByDomain(domain).key}${engine !== 'all' ? `&brandEngine=${engine}` : ''}`

export default function PromptCoverage() {
  const { engine } = useBrandView()
  const tracking = useTracking()
  const [domain, brandSelect] = useCardBrand({ triggerClassName: 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line bg-raised px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-focus' })
  const total = trackedPrompts.length
  const counts = TRACKED_BRANDS.map((b) => ({ ...b, prompts: getBrandView(b.domain, engine).kpis.visible }))
  const pct = shares(counts.map((b) => b.prompts))
  // the selected brand first (ink), then the others by size (c1 → c3)
  const focal = counts.find((b) => b.domain === domain)
  const others = counts.filter((b) => b.domain !== domain).sort((a, b) => b.prompts - a.prompts)
  const rows = [focal, ...others].map((b) => ({ ...b, share: pct[counts.indexOf(b)], color: b.domain === domain ? 'var(--ink)' : STEPS[others.indexOf(b)] }))
  const own = domain === OWN.domain

  const [hover, setHover] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const explain = useExplain(`${domain}|${engine}`)
  const preview = (d) => { if (explain.on) return; clearTimeout(timer.current); timer.current = setTimeout(() => setHover(d), HOVER_DELAY) }
  const hovered = rows.find((r) => r.domain === hover)

  // insight: the selected brand against its biggest rival, and the prompts it's missing from
  const rival = others[0]
  const name = focal.name
  const missed = total - focal.prompts
  const ratio = rival?.prompts ? Math.floor((focal.prompts >= rival.prompts ? focal.prompts / rival.prompts : rival.prompts / focal.prompts) || 0) : 0
  const x = ratio >= 2 ? `${ratio}× more` : 'More'
  // one short line: the selected brand is implied ("4× more prompts than CeraVe.")
  const first = !rival || !rival.prompts ? `In ${plural(focal.prompts, 'prompt')}.`
    : focal.prompts >= rival.prompts ? `${x} prompts than ${rival.name}.`
      : `${rival.name} has ${x.toLowerCase()} prompts than ${own ? 'you' : name}.`
  const insight = {
    text: first, // short, so it fits; the missed prompts are in the evidence line
    evidence: {
      keys: [`brand:${focal.domain}`, ...(rival ? [`brand:${rival.domain}`] : [])],
      calc: `${name} shows up in ${plural(focal.prompts, 'prompt')}${rival ? `, ${rival.name} in ${rival.prompts}` : ''}. ${missed} of ${total} prompts have no ${name} mention.`,
      source: sourceLine(tracking),
      // the missed prompts live on /prompts for your own brand only (the action never truncates, unlike the line)
      ...(own && missed > 0 && { action: { label: plural(missed, 'prompt'), onClick: () => navigate('/tracker?visibility=missed') } }),
    },
  }

  // hero: the selected brand, or the hovered one (crossfades)
  const hero = (r) => (
    <>
      <div className="text-[32px] leading-none font-semibold text-stone-900 tabular-nums">{r.share}%</div>
      <div className="mt-1.5 truncate text-[13px] leading-[18px] text-stone-600">{r.domain === OWN.domain ? 'your share' : `${r.name}’s share`}</div>
      <div className="mt-0.5 text-[12px] leading-4 text-stone-500 tabular-nums">{r.prompts} of {total} prompts</div>
    </>
  )

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5">
      <div className="flex h-9 items-center justify-between gap-3">
        <h2 className="truncate text-[15px] leading-5 font-semibold text-stone-900">Prompt coverage</h2>
        {brandSelect}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mt-4 flex items-center gap-6">
          <Pie
            radius={60}
            labels={false}
            separator={1.5}
            label={`Share of prompt appearances: ${rows.map((r) => `${r.name} ${r.share}%`).join(', ')}`}
            slices={rows.map((r) => ({ key: r.domain, name: r.name, value: r.prompts, pct: r.share, fill: r.color, insightKey: `brand:${r.domain}` }))}
            hover={explain.on ? null : hover}
            onHover={preview}
            onSelect={(d) => navigate(promptsLink(d, engine))}
            dim={(d) => hlOpacity(explain, `brand:${d}`)}
          />
          <div className="grid min-w-0 flex-1" aria-live="polite">
            <div className={`[grid-area:1/1] min-w-0 transition-opacity duration-150 ease-out ${hovered ? 'opacity-0' : 'opacity-100'}`}>{hero(rows[0])}</div>
            <div className={`[grid-area:1/1] min-w-0 transition-opacity duration-150 ease-out ${hovered ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!hovered}>{hovered && hero(hovered)}</div>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-y-0.5">
          {rows.map((r) => {
            return (
              <li key={r.domain} {...hl(explain, `brand:${r.domain}`, { row: true })}>
                <button
                  type="button"
                  onMouseEnter={() => preview(r.domain)}
                  onMouseLeave={() => preview(null)}
                  onFocus={() => preview(r.domain)}
                  onBlur={() => preview(null)}
                  onClick={() => navigate(promptsLink(r.domain, engine))}
                  aria-label={`${r.name}: ${r.prompts} prompts, ${r.share}%. View prompts`}
                  className={`-mx-2 flex h-10 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 text-left outline-none transition-[opacity,background-color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-focus hover:bg-[var(--tint)] ${hover && hover !== r.domain && !explain.on ? 'opacity-60' : ''}`}
                >
                  <SiteLogo domain={r.domain} name={r.name} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" plate />
                  <span className={`min-w-0 truncate text-[14px] leading-5 ${r.domain === OWN.domain ? 'font-semibold text-ink' : 'font-medium text-stone-900'}`}>{r.name}</span>
                  <span className="ml-auto text-[14px] leading-5 font-semibold text-ink tabular-nums">{r.prompts}</span>
                  {/* the slice-colour dot is the row's only link to the pie */}
                  <span className="flex w-14 shrink-0 items-center justify-end gap-1.5 text-[13px] leading-[18px] text-stone-500 tabular-nums">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />{r.share}%
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-auto pb-3 pt-2"><Insight explain={explain} {...insight} /></div>
    </Card>
  )
}
