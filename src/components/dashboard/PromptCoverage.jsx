import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Card from './Card'
import Insight, { hl, hlOpacity, useExplain } from '../ui/Insight'
import SiteLogo from '../ui/SiteLogo'
import Pie from '../ui/Pie'
import { sourceLine } from './insights'
import { OWN, TRACKED_BRANDS, appearances, brandByDomain, enginePid, getBrandView } from '../../data/brandViews'
import { trackedPrompts } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'
import { navigate } from '../../router'
import { useTracking } from '../../store/trackingSettings'
import { useBrandColors } from '../../hooks/useBrandColors' // one colour per brand, the same as Visibility history
import { MEDALS, TOP_TEXT, TOP_TINT, displayShares, medalSize, rankShares, topShare, wholeShares } from '../../utils/shareOfVoice' // places and medals by exact counts
import { brandListName } from '../../utils/brand' // Brand Setup's names, never a domain-style one
import { OTHER_COLOR } from '../../utils/brandColors'

// "Share of voice" (was "Prompt coverage"): share of brand appearances — each brand's appearances (tracked prompts whose answers on any
// filtered engine name it) out of all brands' appearances. Every brand in its palette colour by rank
// (utils/brandColors.js rankColors, owner 2026-11-03), the same map as Visibility history; the account's brand is
// marked by its bold row and its pulled-out slice. The #1 brand stands out: its row has a 22px gold medal, 600 weight,
// a gold tint at 12% and a 2px gold bar on its left edge, and the hero's medal shows only for #1 (a gold "Top share"
// pill beside it). Pie: every brand with a palette colour (the top 7 by count, owner 2026-11-03) has its own slice;
// brands past the 7th are one "Other brands" slice in mid graphite (never a near-white tint); solid fills, 2px card-colour gaps. The list ranks
// every brand by its exact count, most first, with gold / silver / bronze for the top three counts (only an exact tie
// shares one; utils/shareOfVoice.js); prompts that name no brand are a different base, so they're a line under the
// list, not a slice.
const HOVER_DELAY = 80 // ms; sweeping across slices doesn't flicker through each one
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

const promptsLink = (domain, engine) => `/tracker?brand=${brandByDomain(domain).key}${engine !== 'all' ? `&brandEngine=${engine}` : ''}`

const ROWS = 5 // the brand + its top 4 competitors; the rest under "+N more"
export default function PromptCoverage() {
  // always the brand picked in the sidebar (no brand menu of its own, like Sentiment)
  const page = useBrandView()
  const { engine } = page
  const domain = page.focal.domain
  const tracking = useTracking()
  const [showAll, setShowAll] = useState(false)
  // each brand by its Brand Setup / competitor name, else its domain tidied (utils/brand.js brandListName)
  const counts = TRACKED_BRANDS.map((b) => ({ ...b, name: brandListName([b.name], b.site ?? b.domain), prompts: getBrandView(b.domain, engine).kpis.visible }))
  // whole % adding up to 100 (equal counts, equal %), for the "Other brands" slice; each brand shows one decimal
  // when a different count would show the same whole % (utils/shareOfVoice.js)
  const pct = wholeShares(counts.map((b) => b.prompts))
  const shown = displayShares(counts.map((b) => b.prompts))
  // the selected brand first, then the others by size: each brand with a palette colour (the top 7) its own slice,
  // the rest (8th and later) one "Other brands" slice
  const focal = counts.find((b) => b.domain === domain)
  const others = counts.filter((b) => b.domain !== domain).sort((a, b) => b.prompts - a.prompts)
  const brandColors = useBrandColors(engine)
  const top = others.filter((b) => b.prompts > 0 && brandColors[b.domain])
  const rest = others.filter((b) => b.prompts > 0 && !top.includes(b))
  const own = domain === OWN.domain
  const brandColor = (b) => brandColors[b.domain]?.css ?? OTHER_COLOR
  const colorOf = (b) => (b.domain === domain || top.includes(b) ? brandColor(b) : rest.includes(b) ? OTHER_COLOR : 'transparent')
  const rows = [focal, ...others].map((b) => ({ ...b, share: shown[counts.indexOf(b)], color: colorOf(b) }))
  // the list by place (most appearances first), each with its medal; the selected brand stays in view
  const ranked = rankShares(rows)
  const rankOf = (d) => ranked.find((r) => r.domain === d) ?? null
  const otherSlice = rest.length
    ? { domain: 'other', name: 'Other brands', prompts: rest.reduce((n, b) => n + b.prompts, 0), share: rest.reduce((n, b) => n + pct[counts.indexOf(b)], 0), color: OTHER_COLOR }
    : null
  const slices = [...rows.filter((r) => r.prompts > 0 && (r.domain === domain || top.some((b) => b.domain === r.domain))), ...(otherSlice ? [otherSlice] : [])]
  // prompts whose answers (on the filtered engine) name no tracked brand
  const pid = engine === 'all' ? null : enginePid(engine)
  const noBrand = trackedPrompts.filter((p) => TRACKED_BRANDS.every((b) => {
    const a = appearances[p.id]?.[b.domain]
    return !(pid ? a?.platforms.includes(pid) : a?.visible)
  })).length

  const [hover, setHover] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const explain = useExplain(`${domain}|${engine}`)
  const preview = (d) => { if (explain.on) return; clearTimeout(timer.current); timer.current = setTimeout(() => setHover(d), HOVER_DELAY) }
  const hovered = hover === 'other' ? otherSlice : rows.find((r) => r.domain === hover)

  // insight: the selected brand against its biggest rival, and the prompts it's missing from
  const rival = others[0]
  const name = focal.name
  // the brand's missed prompts, as its KPI counts them
  const missed = getBrandView(domain, engine).kpis.missed
  // a ratio only when both appear (a brand in 0 answers: "more", never "Infinity×")
  const ratio = rival?.prompts && focal.prompts ? Math.floor((focal.prompts >= rival.prompts ? focal.prompts / rival.prompts : rival.prompts / focal.prompts) || 0) : 0
  const x = ratio >= 2 ? `${ratio}× more` : 'More'
  const more = x === 'More' ? 'more' : x
  // one short line ("Aurelia Labs appears in more answers than you.")
  const focalShare = rows.find((r) => r.domain === focal.domain)?.share ?? 0
  const rivalShare = rival ? rows.find((r) => r.domain === rival.domain)?.share ?? 0 : 0
  const first = !rival || !rival.prompts ? `${focalShare}% of brand appearances.`
    : focal.prompts >= rival.prompts ? `${own ? 'You appear' : `${name} appears`} in ${more} answers than ${rival.name}.`
      : `${rival.name} appears in ${more} answers than ${own ? 'you' : name}.`
  const insight = {
    text: first, // short, so it fits; the missed prompts are in the evidence line
    evidence: {
      keys: [`brand:${focal.domain}`, ...(rival ? [`brand:${rival.domain}`] : [])],
      calc: `${name}: ${focalShare}% of brand appearances${rival ? `; ${rival.name}: ${rivalShare}%` : ''}.`,
      source: sourceLine(tracking),
      // the missed prompts live on /prompts for your own brand only (the action never truncates, unlike the line)
      ...(own && missed > 0 && { action: { label: plural(missed, 'prompt'), onClick: () => navigate('/tracker?visibility=missed') } }),
    },
  }

  // hero: the selected brand, or the hovered one (crossfades)
  const hero = (r) => (
    <>
      {/* the medal only for #1, with a gold "Top share" pill beside it (darker gold #A87700 text on gold 12%) */}
      <div className="flex items-center gap-2 text-[32px] leading-none font-semibold text-stone-900 tabular-nums">{r.share}%{topShare(rankOf(r.domain)) && <span className="flex items-center gap-1"><Medal medal={MEDALS[1]} size={medalSize(rankOf(r.domain))} /><span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] leading-4 font-semibold" style={{ color: TOP_TEXT, background: TOP_TINT }}>Top share</span></span>}</div>
      <div className="mt-1.5 line-clamp-2 break-words text-[13px] leading-[18px] text-stone-600">{r.domain === OWN.domain ? 'your share' : r.domain === 'other' ? 'other brands’ share' : `${r.name}’s share`}</div>
    </>
  )

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5">
      <div className="min-w-0">
        <h2 className="whitespace-nowrap text-[15px] leading-5 font-semibold text-stone-900">Share of voice</h2>
        {/* wraps, never cut */}
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">Share of all brand mentions in AI answers</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mt-4 flex items-center gap-6">
          <Pie
            radius={62} // a 140px box (62 + 8px push-out room, each side)
            labels={false}
            separator={2}
            pulled={domain} // your brand's slice is the one pulled out (owner, 2026-11-03)
            label={`Share of brand appearances: ${slices.map((r) => `${r.name} ${r.share}%`).join(', ')}`}
            slices={slices.map((r) => ({ key: r.domain, name: r.name, value: r.prompts, pct: r.share, fill: r.color, insightKey: `brand:${r.domain}` }))}
            hover={explain.on ? null : hover}
            onHover={preview}
            onSelect={(d) => d !== 'other' && navigate(promptsLink(d, engine))}
            dim={(d) => hlOpacity(explain, `brand:${d}`)}
          />
          <div className="grid min-w-0 flex-1" aria-live="polite">
            <div className={`[grid-area:1/1] min-w-0 transition-opacity duration-150 ease-out ${hovered ? 'opacity-0' : 'opacity-100'}`}>{hero(rows[0])}</div>
            <div className={`[grid-area:1/1] min-w-0 transition-opacity duration-150 ease-out ${hovered ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!hovered}>{hovered && hero(hovered)}</div>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-y-0.5">
          {/* the brand + its top 4 (5 rows); the rest behind "+N more", which opens in place */}
          {(showAll ? ranked : [...ranked.slice(0, ROWS), ...ranked.slice(ROWS).filter((r) => r.domain === domain)]).map((r) => {
            const first = topShare(r) // the #1 row: 22px gold medal, 600 weight, gold at 12% behind it, a 2px gold bar on its left edge
            return (
              <li key={r.domain} {...hl(explain, `brand:${r.domain}`, { row: true })}>
                <button
                  type="button"
                  onMouseEnter={() => preview(r.domain)}
                  onMouseLeave={() => preview(null)}
                  onFocus={() => preview(r.domain)}
                  onBlur={() => preview(null)}
                  onClick={() => navigate(promptsLink(r.domain, engine))}
                  aria-label={`${r.medal ? `${r.medal.name}, ` : ''}${r.name}: ${r.share}%. View prompts`}
                  style={first ? { '--row-bg': TOP_TINT } : undefined}
                  className={`relative -mx-2 flex min-h-9 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-1 text-left outline-none transition-[opacity,background-color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-focus hover:bg-[var(--tint)] ${first ? 'bg-[var(--row-bg)]' : ''} ${hover && hover !== r.domain && !explain.on ? 'opacity-50' : ''}`}
                >
                  {first && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full" style={{ background: MEDALS[1].fill }} aria-hidden />}
                  {/* the top three counts: the medal (an exact tie shares one), gold 22px, silver / bronze 16px; the rest keep the column */}
                  <span className="grid h-5 w-5 shrink-0 place-items-center">{r.medal && <Medal medal={r.medal} size={medalSize(r)} />}</span>
                  <SiteLogo domain={r.domain} name={r.name} className="h-5 w-5 rounded-md" initialClass="text-[10px]" />
                  <span className={`min-w-0 break-words text-[14px] leading-5 ${r.domain === OWN.domain ? 'font-semibold text-ink' : first ? 'font-semibold text-stone-900' : 'font-medium text-stone-900'}`}>{r.name}</span>
                  {/* the slice-colour dot is the row's only link to the pie */}
                  <span className={`ml-auto flex shrink-0 items-center justify-end gap-1.5 text-[14px] leading-5 text-ink tabular-nums ${first ? 'font-semibold' : 'font-medium'}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />{r.share}%
                  </span>
                </button>
              </li>
            )
          })}
          {ranked.length > ROWS && (
            <li>
              <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}
                className="-mx-2 flex h-9 w-[calc(100%+16px)] items-center gap-1 rounded-lg px-2 text-left text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                {showAll ? 'Show fewer' : `+${ranked.length - ROWS - (ranked.slice(ROWS).some((r) => r.domain === domain) ? 1 : 0)} more`}
                <ChevronDown size={14} className={`text-stone-500 transition-transform duration-150 ${showAll ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </li>
          )}
        </ul>
        {noBrand > 0 && <p className="mt-2 text-[13px] leading-[18px] text-stone-500 tabular-nums">{Math.round((noBrand / Math.max(1, trackedPrompts.length)) * 100)}% of prompts mention no brand</p>}
      </div>

      <div className="mt-auto pb-3 pt-2"><Insight explain={explain} {...insight} wrap /></div>
    </Card>
  )
}

// a medal (SVG, 16px; the #1 gold 22px): ribbon and disc in the place's colour (utils/shareOfVoice.js MEDALS)
function Medal({ medal, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={medal.name} className="shrink-0">
      <path d="M4.2 1h3l1.6 4.2-2.2 1.4z" fill={medal.fill} fillOpacity={0.7} />
      <path d="M11.8 1h-3L7.2 5.2l2.2 1.4z" fill={medal.fill} fillOpacity={0.85} />
      <circle cx={8} cy={10.2} r={4.8} fill={medal.fill} />
      <circle cx={8} cy={10.2} r={3.1} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1} />
    </svg>
  )
}
