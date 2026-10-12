// Competitor color assignment. Every component that colors a competitor goes through getCompetitorColor.
// Focal-aware ("Viewing as"): the focal brand is ink; every other brand — Dermasuri included — gets a grey by
// share rank among the non-focal brands, so Dermasuri as a rival is always the darkest grey (c1).
import { chart } from './chart'
import { competitors } from '../data/mock'

const SLOTS = ['c1', 'c2', 'c3']
const byShare = [...competitors].sort((a, b) => b.share - a.share).map((c) => c.domain)
export const youDomain = competitors.find((c) => c.you)?.domain

// The ONLY way a component picks a competitor color. fill = chart color; soft/text = a light mix for favicon marks.
export function getCompetitorColor(domain, focal = youDomain) {
  const idx = byShare.filter((d) => d !== focal).indexOf(domain)
  const fill = domain === focal ? chart.you : chart[SLOTS[idx === -1 ? 2 : Math.min(idx, 2)]]
  return { fill, soft: `color-mix(in oklab, ${fill} 22%, var(--color-surface))`, text: chart.you }
}

// Line-chart colors (Visibility history, line mode only): every brand keeps one fixed hue whoever is focal
// (cerave indigo, ordinary red, paulas mint, Dermasuri fuchsia); the focal brand is drawn in ink.
const LINE = { 'cerave.com': 'line1', 'theordinary.com': 'line2', 'paulaschoice.com': 'line3', [youDomain]: 'line4' }
export function getLineColor(domain, focal = youDomain) {
  return domain === focal ? chart.lineYou : chart[LINE[domain] ?? 'line3']
}
