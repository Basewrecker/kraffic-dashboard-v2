// Evidence for every lightbulb line: { text, evidence: { keys, calc, source, action } } (see ui/Insight).
// keys = the data-insight-key values of the card elements the sentence is computed from; explain mode keeps
// those lit and dims the rest. Everything is computed from the data the card renders (follows ?view= / ?engine=).
import { enginePid, focalPromptIds } from '../../data/brandViews'
import { marketplace } from '../../data/mock'
import { brandName, isDomain } from '../../utils/brand'
import { fmtDay } from '../../store/trackingSettings'
import { showMarketplacePrompts } from './MarketplaceVisibility'
import { showPromptSet, showPromptSets } from './promptSet'

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const short = (d) => d.replace(/, \d{4}$/, '') // "Oct 5, 2026" → "Oct 5"
const VIEW_PROMPTS = 'View prompts'
// "/products/vitamin-c-serum" → "vitamin C serum" (single letters upper-cased: "c" → "C")
const pageName = (path) => (path.split('/').filter(Boolean).pop() ?? 'home').split('-').map((w) => (w.length === 1 ? w.toUpperCase() : w)).join(' ')
const scrollTo = (id) => requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })))

// Evidence lines are one plain-English sentence (no symbols or formulas): what we counted, where.
// The sync date follows as a quiet suffix: "(Oct 5 update)".
export const sourceLine = (tracking) => `(${fmtDay(tracking.schedule.lastSync)} update)`
const times = (n) => (n === 1 ? 'once' : `${n} times`)

// ---------------------------------------------------------------- Platform visibility (per engine)
// keys: 'engine:<id>' (the columns). Same rules as the sentence: cites the most → "N× more often";
// mentioned ≥ 50% but cited < 5% → "almost never links"; otherwise → "about 1 of N prompts".
export function platformEvidence(r, rows, { view, tracking, setEngine }) {
  const brand = view.focal.name
  const own = view.isOwnBrand
  const you = own ? 'you' : brand
  const site = own ? 'your site' : `${brand}’s site`
  const pid = enginePid(r.id)
  const total = view.total
  const source = sourceLine(tracking)
  const viewCited = { label: VIEW_PROMPTS, onClick: () => showPromptSet('visible-prompts', focalPromptIds(view, (a) => a.citedPlatforms.includes(pid)), `Cited by ${r.name}`) }

  const byCited = rows.filter((x) => x.cited > 0).sort((a, b) => b.cited - a.cited)
  if (byCited[0]?.id === r.id) {
    const next = byCited[1]
    if (!next) {
      return {
        text: `${r.name} is the only engine that links to ${site}.`,
        evidence: { keys: rows.map((x) => `engine:${x.id}`), calc: `Only ${r.name} linked to ${site}, in ${plural(r.cited, 'answer')}.`, source, action: viewCited },
      }
    }
    const ratio = Math.floor(r.cited / next.cited)
    if (ratio >= 2) {
      return {
        text: `${r.name} cites ${you} ${ratio}× more often than ${next.name}.`,
        evidence: {
          keys: [`engine:${r.id}`, `engine:${next.id}`],
          calc: `${r.name} linked to ${site} in ${plural(r.cited, 'answer')}. ${next.name} did in ${next.cited}.`,
          source,
          action: viewCited,
        },
      }
    }
  }
  if (r.mentionedPct >= 50 && r.citedPct < 5) {
    return {
      text: `${r.name} mentions ${you} often but almost never links to ${site}.`,
      evidence: {
        keys: [`engine:${r.id}`],
        calc: `${r.name} mentioned ${you} in ${plural(r.visible, 'answer')} but linked to ${site} in only ${r.cited}.`,
        source,
        action: {
          label: VIEW_PROMPTS,
          onClick: () => showPromptSet('visible-prompts', focalPromptIds(view, (a) => a.platforms.includes(pid) && !a.citedPlatforms.includes(pid)), `${r.name}: mentioned, no link`),
        },
      },
    }
  }
  const n = Math.max(1, Math.round(100 / r.mentionedPct))
  return {
    text: n === 1 ? `${r.name} mentions ${you} in almost every prompt.` : `${r.name} mentions ${you} in about 1 of ${n} prompts.`,
    evidence: {
      keys: [`engine:${r.id}`],
      calc: `${r.name} mentioned ${you} in ${r.visible} of ${own ? 'your' : 'the'} ${total} prompts.`,
      source,
      action: { label: VIEW_PROMPTS, onClick: () => { setEngine(r.id); scrollTo('visible-prompts') } },
    },
  }
}

// ---------------------------------------------------------------- Marketplace visibility (per segment)
// keys: 'seg:<key>' (donut slices), 'row:<label>' (panel rows)
const rowName = (r) => (isDomain(r.label) ? brandName(r.label) : r.label)
const fmtRatio = (x) => `${Math.round(x * 10) / 10}`.replace(/\.0$/, '')
// what AI linked to instead of a store, as a phrase: "Brand websites" → "a brand's own website"
const INSTEAD = { 'Brand websites': 'a brand’s own website', 'Review sites': 'a review site', 'Reddit & forums': 'Reddit or a forum' }
const oneOf = (label) => INSTEAD[label] ?? label.toLowerCase()

export function marketplaceEvidence(s, { tracking }) {
  const [top, second] = [...s.rows].sort((a, b) => b.value - a.value)
  const source = sourceLine(tracking)
  const yourProduct = 'your product'
  if (s.key === 'yours') {
    // no listing linked yet, or only one marketplace: nothing to compare
    if (!top) {
      return { text: `No AI answer links to a ${s.label} listing yet.`, evidence: { keys: ['seg:yours'], calc: `None of the ${plural(marketplace.total, 'tracked prompt')} links to your product on a marketplace.`, source } }
    }
    if (!second) {
      return {
        text: `${rowName(top)} is the only marketplace linking to ${s.label}.`,
        evidence: { keys: ['seg:yours', `row:${top.label}`], calc: `${rowName(top)} linked to ${yourProduct} in ${plural(top.value, 'AI answer')}.`, source },
      }
    }
    const ratio = fmtRatio(top.value / second.value)
    const ids = marketplace.prompts.filter((p) => p.result === 'yours' && p.markets.includes(top.label)).map((p) => p.id)
    return {
      text: `${rowName(top)} links to ${s.label} ${ratio}× more often than ${rowName(second)}.`,
      evidence: {
        keys: ['seg:yours', `row:${top.label}`, `row:${second.label}`],
        calc: `${rowName(top)} linked to ${yourProduct} in ${plural(top.value, 'AI answer')}, ${rowName(second)} in ${second.value}.`,
        source,
        action: { label: VIEW_PROMPTS, onClick: () => showPromptSet('marketplace-prompts', ids, `${rowName(top)} listings`) },
      },
    }
  }
  if (s.key === 'others') {
    // the competitor with the most marketplace links, against yours
    const you = s.rows.find((r) => r.you)
    const rival = s.rows.filter((r) => !r.you && !r.muted).sort((a, b) => b.value - a.value)[0]
    if (!rival) {
      return { text: 'No competitor gets a marketplace link.', evidence: { keys: ['seg:others', `row:${you.label}`], calc: `Of ${s.panelCount} answers linking to a store, ${you.value} went to your listings and none to a competitor’s.`, source } }
    }
    const x = rival.value / you.value
    const vs = !you.value ? 'and you have none' : x > 2 ? `more than double your ${you.value}` : x > 1 ? `more than your ${you.value}` : x === 1 ? `the same as your ${you.value}` : `fewer than your ${you.value}`
    const ids = marketplace.prompts.filter((p) => p.result === 'competitor' && p.brand === rival.label).map((p) => p.id)
    return {
      text: `${rowName(rival)} gets ${plural(rival.value, 'marketplace link')} — ${vs}.`,
      evidence: {
        keys: ['seg:others', `row:${rival.label}`, `row:${you.label}`],
        calc: `Of ${s.panelCount} answers linking to a store, ${rival.value} went to ${rowName(rival)} and ${you.value} to your listings.`,
        source,
        action: { label: VIEW_PROMPTS, onClick: () => showPromptSet('marketplace-prompts', ids, `${rowName(rival)} listings`) },
      },
    }
  }
  if (!top) {
    return { text: 'Every tracked prompt’s answers link to a marketplace.', evidence: { keys: [`seg:${s.key}`], calc: `None of the ${plural(marketplace.total, 'tracked prompt')} cites only other websites.`, source } }
  }
  return {
    text: `AI cites ${rowName(top).toLowerCase()} instead of stores for these prompts.`,
    evidence: {
      keys: [`seg:${s.key}`, `row:${top.label}`],
      calc: `In ${top.value} of these ${s.count} answers, AI linked to ${oneOf(top.label)} instead.`,
      source,
      action: { label: VIEW_PROMPTS, onClick: () => showMarketplacePrompts('none') },
    },
  }
}

// ---------------------------------------------------------------- Sync history
// keys: 'sync:<id>' (rows)
export function syncEvidence(shown, { view, tracking, openRows }) {
  // no sync on record (for this brand or engine): nothing to say
  if (!shown.length) return null
  const latest = shown[0]
  const best = shown.reduce((a, r) => (r.visibility > a.visibility ? r : a), shown[0])
  const gap = best.visibility - latest.visibility
  const who = view.isOwnBrand ? 'You’re' : `${view.focal.name} is`
  const source = sourceLine(tracking)
  const whose = view.isOwnBrand ? 'Your' : `${view.focal.name}’s`
  const now = view.isOwnBrand ? 'you’re' : 'it’s'
  if (gap > 0) {
    return {
      text: `Best sync: ${short(best.date)} (${best.visibility}%). ${who} ${gap} below it.`,
      evidence: {
        keys: [`sync:${best.id}`, `sync:${latest.id}`],
        calc: `${whose} best week was ${short(best.date)} at ${best.visibility}%. This week ${now} at ${latest.visibility}%.`,
        source,
        action: { label: 'Compare syncs', onClick: () => openRows([best.id, latest.id]) },
      },
    }
  }
  return {
    text: `${short(latest.date)} is ${view.isOwnBrand ? 'your' : `${view.focal.name}’s`} best of the last ${shown.length} syncs (${latest.visibility}%).`,
    evidence: {
      keys: [`sync:${latest.id}`],
      calc: `This week is ${whose.toLowerCase() === 'your' ? 'your' : `${view.focal.name}’s`} best of the last ${shown.length}, at ${latest.visibility}%.`,
      source,
      action: { label: 'Open sync', onClick: () => openRows([latest.id]) },
    },
  }
}

// ---------------------------------------------------------------- Top cited pages
// keys: 'page:<path>' (rows; the "N other pages" row is 'page:other')
export function citedEvidence(pages, { view, tracking, engine }) {
  const total = pages.reduce((n, p) => n + p.count, 0)
  const top = pages.filter((p) => p.path).reduce((a, p) => (!a || p.count > a.count ? p : a), null)
  const source = sourceLine(tracking)
  if (!top) return { text: `No ${view.focal.name} pages cited yet.`, evidence: { keys: [], calc: `We found no answer linking to a ${view.focal.name} page yet.`, source } }
  const pid = engine && engine !== 'all' ? enginePid(engine) : null
  return {
    text: `${view.isOwnBrand ? 'Your' : `${view.focal.name}’s`} top page earns ${pct(top.count, total)}% of all citations.`,
    evidence: {
      keys: [`page:${top.path}`],
      calc: `${view.isOwnBrand ? 'Your' : `${view.focal.name}’s`} ${pageName(top.path)} page was linked ${times(top.count)} out of ${total}.`,
      source,
      action: {
        label: VIEW_PROMPTS,
        onClick: () => showPromptSet('visible-prompts', focalPromptIds(view, (a) => a.citedPage === top.path && (!pid || a.citedPlatforms.includes(pid))), `Cites ${top.path}`),
      },
    },
  }
}

// Top cited pages, when "Not cited yet" is showing: the most relevant page AI never links to
// keys: 'uncited:<path>'
export function uncitedEvidence(u, { tracking }) {
  return {
    text: `Your ${u.subject} page matches ${u.relevant} prompts but hasn’t been cited yet.`,
    evidence: {
      keys: [`uncited:${u.path}`],
      calc: `We found ${u.relevant} tracked prompts about ${u.subject}; no answer links to this page.`,
      source: sourceLine(tracking),
      action: { label: VIEW_PROMPTS, onClick: () => showPromptSets(u.keys, `Relevant to ${u.path}`) },
    },
  }
}
