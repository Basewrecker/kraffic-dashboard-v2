// Prompt research for /prompts: suggested prompts for dermasuri.com, found from the site's own pages
// and from competitors. Deterministic per "round" so re-running gives a fresh but stable set.
import { guessCategory, trackedPrompts } from './mock.js'

export const researchMeta = {
  domain: 'dermasuri.com',
  pagesFound: 178,
  pagesAnalyzed: 12,
  competitors: ['CeraVe', 'The Ordinary', 'Paula’s Choice'],
  updated: 'Oct 8, 09:25',
}

const CATALOG = {
  Sunscreen: ['tinted mineral sunscreen', 'water resistant sunscreen', 'sunscreen stick SPF 50', 'matte sunscreen for oily skin', 'sunscreen for kids sensitive skin'],
  Serums: ['vitamin C serum for beginners', 'niacinamide and zinc serum', 'peptide serum for fine lines', 'hyaluronic acid serum for dehydrated skin', 'bakuchiol serum for pregnancy'],
  Moisturizers: ['gel moisturizer for humid weather', 'ceramide moisturizer for eczema', 'oil free moisturizer with SPF', 'night cream for dull skin', 'barrier cream for winter'],
  Acne: ['spot treatment for hormonal acne', 'azelaic acid for acne marks', 'non comedogenic moisturizer for acne', 'benzoyl peroxide face wash'],
  Pigmentation: ['serum for melasma', 'tranexamic acid cream', 'underarm darkness cream', 'kojic acid serum for dark spots'],
  Cleansers: ['cream cleanser for dry skin', 'micellar water for sensitive skin', 'low pH gel cleanser', 'cleansing balm for makeup'],
  'Eye & lip': ['eye cream for puffiness', 'caffeine eye serum', 'lip mask for chapped lips', 'tinted lip balm SPF'],
}
const FRAMES = [
  (p) => `best ${p} for sensitive skin`, (p) => `${p} dermatologist recommended`, (p) => `is ${p} worth it`,
  (p) => `${p} under $25`, (p) => `${p} vs alternatives`, (p) => `how to use ${p}`,
]
// how many suggestions per category (sums to 55 new)
const SHARE = { Sunscreen: 10, Serums: 10, Moisturizers: 9, Acne: 7, Pigmentation: 7, Cleansers: 6, 'Eye & lip': 6 }

function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// round 0 = the stored research; later rounds = "Re-run research". extraPages adds suggestions from newly found pages.
// topic (from Setup → Products & topics → "Run research") adds prompts for that topic first.
export function getResearch({ round = 0, extraPages = 0, topic = null } = {}) {
  const r = rng(9000 + round * 97)
  const tracked = new Set(trackedPrompts.map((p) => p.prompt.toLowerCase()))
  const seen = new Set()
  const out = []
  const add = (text, category, source) => {
    const k = text.toLowerCase()
    if (seen.has(k) || tracked.has(k)) return false
    seen.add(k)
    out.push({ id: `r${round}-${out.length}`, text, category, source, status: 'new' })
    return true
  }
  if (topic) {
    const t = topic.toLowerCase()
    FRAMES.forEach((f) => add(f(t), guessCategory(t), 'site'))
  }
  for (const [category, n] of Object.entries(SHARE)) {
    const combos = shuffle(CATALOG[category].flatMap((p) => FRAMES.map((f) => f(p))), r)
    let added = 0
    for (const text of combos) {
      if (added === n) break
      if (add(text, category, r() < 0.6 ? 'site' : 'competitor')) added++
    }
  }
  // one suggestion we already track (shown, but can't be added again)
  const t = trackedPrompts.find((p) => p.category === 'Serums')
  out.push({ id: `r${round}-tracked`, text: t.prompt, category: t.category, source: 'site', status: 'tracking' })
  // "Check for new pages": 3 more suggestions from each batch of new pages
  for (let i = 0; i < extraPages * 3; i++) {
    const category = Object.keys(CATALOG)[i % 7]
    const p = CATALOG[category][(i + round) % CATALOG[category].length]
    add(`${p} for ${['men', 'teenagers', 'over 40', 'sensitive skin', 'travel'][i % 5]}`, category, 'site')
  }
  return out
}
