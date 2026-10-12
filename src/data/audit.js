// Site Audit (mock): one crawl of dermasuri.com — 40 HTML pages and 19 checks (technical, content, speed).
// Every count on /audit is derived from these lists.

export const AUDIT = {
  domain: 'dermasuri.com',
  lastRun: 'Apr 20',
  note: 'Data source: Kraffic crawler (desktop user agent). Last full crawl of dermasuri.com on Apr 20, 2026: 40 HTML pages, robots.txt respected. Results update when you run the audit again.',
}

// ---- pages: path, depth (clicks from home: collections + info pages 1, products + posts 2), response time (ms), status, word count
const products = ['vitamin-c-serum', 'niacinamide-booster', 'retinol-night-cream', 'hyaluronic-moisturizer', 'mineral-sunscreen-spf-50', 'gentle-gel-cleanser',
  'azelaic-acid-cream', 'peptide-eye-cream', 'barrier-repair-balm', 'bha-exfoliant', 'tinted-spf-30', 'ceramide-toner',
  'brightening-mask', 'clarifying-clay-mask', 'overnight-lip-mask', 'squalane-oil', 'snail-mucin-essence', 'sensitive-skin-kit']
const collections = ['serums', 'moisturizers', 'sunscreen', 'cleansers', 'acne', 'bestsellers']
const posts = ['vitamin-c-vs-niacinamide', 'how-to-layer-skincare', 'best-sunscreen-for-oily-skin', 'retinol-for-beginners', 'what-is-azelaic-acid',
  'skin-barrier-guide', 'morning-vs-night-routine', 'fragrance-free-skincare', 'dark-spots-treatment', 'is-mineral-sunscreen-better']
const info = ['about', 'shipping', 'ingredients', 'contact']

// response times are spread so the buckets read 12 / 23 / 4 / 1
const MS = [142, 188, 171, 165, 120, 199, 156, 133, 181, 177, 149, 160, // < 200
  240, 310, 285, 420, 365, 230, 455, 275, 330, 390, 260, 480, 345, 300, 410, 255, 370, 295, 440, 320, 215, 385, 470, // 200–500
  620, 740, 880, 560, // 500–1000
  1320] // 1 s+

export const pages = [
  { path: '/', depth: 0, words: 640 },
  { path: '/index.html', depth: 0, words: 640 },
  ...products.map((s) => ({ path: `/products/${s}`, depth: 2, words: 380 })),
  ...collections.map((s) => ({ path: `/collections/${s}`, depth: 1, words: 180 })),
  ...posts.map((s) => ({ path: `/blogs/journal/${s}`, depth: 2, words: 1400 })),
  ...info.map((s) => ({ path: `/pages/${s}`, depth: 1, words: 260 })),
].map((p, i) => ({ ...p, ms: MS[i], status: 200 }))
export const PAGE_COUNT = pages.length // 40

const only = (re) => pages.filter((p) => re.test(p.path)).map((p) => p.path)
const all = pages.map((p) => p.path)
const pick = (n, from = all) => from.slice(0, n)

// ---- the shared vocabulary
export const CATEGORIES = { technical: 'Technical', content: 'Content', speed: 'Speed' }
export const STATUS = {
  fail: { label: 'Failing', rank: 0, weight: 0, color: 'var(--negative)' },
  warn: { label: 'Needs work', rank: 1, weight: 0.5, color: 'var(--data-c1)' },
  pass: { label: 'Passing', rank: 2, weight: 1, color: 'var(--ink)' },
}
export const IMPACT = { high: { label: 'High', level: 3 }, medium: { label: 'Medium', level: 2 }, low: { label: 'Low', level: 1 } }

// ---- every check, once: { id, name, category, status, impact, pages (affected paths; none when passing), finding, why, fix }
export const checks = [
  // technical
  {
    id: 'meta-description', category: 'technical', status: 'fail', impact: 'high', name: 'Missing meta descriptions',
    finding: '39 of 40 pages have no meta description',
    pages: all.filter((p) => p !== '/'),
    why: 'Answer engines often quote the meta description as the page summary. Without one they pick a random paragraph, which can be a shipping note or a cookie banner.',
    example: '<meta name="description"\n  content="A 15% vitamin C serum for dull, uneven skin. Fragrance-free, 30 ml.">',
    fix: ['Write a 140–160 character description for each product, collection and article page.', 'Lead with what the page answers, e.g. “A 15% vitamin C serum for dull, uneven skin.”', 'Set it in the theme template so new pages get one by default.'],
  },
  {
    id: 'image-alt', category: 'technical', status: 'fail', impact: 'medium', name: 'Images without alt text',
    finding: 'Product photos have no description AI can read',
    pages: [...only(/^\/products\//), ...only(/^\/collections\//), '/'],
    why: 'Multimodal answers and shopping results describe products from their images. Alt text is the only description they can rely on.',
    fix: ['Describe each product photo in one sentence: product, size, texture.', 'Leave decorative images with an empty alt="" on purpose.', 'Add an alt field to the product image upload form.'],
  },
  {
    id: 'llms-txt', category: 'technical', status: 'fail', impact: 'medium', name: 'No llms.txt file',
    finding: 'dermasuri.com/llms.txt returns 404',
    pages: ['/'],
    why: 'llms.txt gives AI crawlers a short map of the site and the pages you most want cited.',
    fix: ['Create /llms.txt with a one-paragraph brand summary.', 'List your top product, collection and guide pages with one line each.'],
  },
  {
    id: 'duplicate-titles', category: 'technical', status: 'warn', impact: 'medium', name: 'Duplicate title tags',
    finding: '10 pages share “Dermasuri | Clinical Skincare”',
    pages: [...only(/^\/collections\//), '/', '/index.html', '/pages/about', '/pages/contact'],
    why: 'When titles repeat, engines can’t tell the pages apart and tend to cite only one of them.',
    fix: ['Give each page a title that names its subject first, then the brand.', 'Use “Serums | Dermasuri” style titles for collections.', 'Redirect /index.html to / so the home page has one URL.'],
  },
  {
    id: 'canonical', category: 'technical', status: 'warn', impact: 'low', name: 'Missing canonical tags',
    finding: 'Some pages don’t say which URL is the original',
    pages: ['/index.html', ...pick(4, only(/^\/pages\//))],
    why: 'Without a canonical URL, mentions and links can be split between duplicates of the same page.',
    fix: ['Add a self-referencing canonical tag to every page in the theme layout.', 'Point /index.html to /.'],
  },
  {
    id: 'ai-crawlers', category: 'technical', status: 'pass', impact: 'high', name: 'AI crawlers allowed',
    finding: 'robots.txt lets GPTBot, ClaudeBot and PerplexityBot in', pages: [],
    why: 'If robots.txt blocks AI crawlers, engines can only cite you from second-hand sources.',
    fix: ['Nothing to fix. Re-check after any robots.txt change.'],
  },
  {
    id: 'sitemap', category: 'technical', status: 'pass', impact: 'medium', name: 'XML sitemap',
    finding: 'The sitemap lists all 40 pages', pages: [],
    why: 'A complete sitemap is how crawlers find pages that few links point to.',
    fix: ['Nothing to fix. Keep the sitemap generated by the store platform.'],
  },
  {
    id: 'https', category: 'technical', status: 'pass', impact: 'low', name: 'HTTPS everywhere',
    finding: 'Every page is served over HTTPS', pages: [],
    why: 'Engines distrust pages that load over plain HTTP or mix secure and insecure content.',
    fix: ['Nothing to fix.'],
  },
  // content
  {
    id: 'page-hierarchy', category: 'content', status: 'fail', impact: 'high', name: 'Page Hierarchy',
    finding: '14 pages skip from H1 to H3 or have more than one H1',
    pages: [...pick(8, only(/^\/products\//)), ...only(/^\/collections\//)],
    why: 'Engines use headings to split a page into answerable sections. Broken nesting merges unrelated sections together.',
    fix: ['Use one H1 per page.', 'Use H2 for each section and H3 only inside an H2.'],
    example: 'H1  Vitamin C Serum 15%\n├ H2  What it does\n│ └ H3  Who it’s for\n├ H2  How to use it\n└ H2  Ingredients',
  },
  {
    id: 'answer-capsules', category: 'content', status: 'fail', impact: 'high', name: 'Answer Capsules',
    finding: '9 of 10 articles don’t answer the title question in the first paragraph',
    pages: pick(9, only(/^\/blogs\//)),
    why: 'AI answers quote short, self-contained passages. A 40–60 word answer right under the heading is the easiest thing to cite.',
    fix: ['Open each article with a 2–3 sentence answer to its title.', 'Then go into detail below it.'],
    example: 'H1  Can you use vitamin C with niacinamide?\nYes. Modern formulas are stable together, so you can layer them\nin the same routine. Apply vitamin C first, then niacinamide.',
  },
  {
    id: 'author', category: 'content', status: 'warn', impact: 'high', name: 'Author & Expertise',
    finding: 'No author or reviewer is named on any article',
    pages: only(/^\/blogs\//),
    why: 'For skincare advice, engines weigh who wrote it. Unattributed health content is cited less.',
    fix: ['Add an author byline to every article.', 'Add a “Reviewed by” line with the dermatologist’s name and credentials.'],
  },
  {
    id: 'question-headings', category: 'content', status: 'warn', impact: 'medium', name: 'Question Headings',
    finding: 'Only 6 of 74 H2s are phrased as questions',
    pages: only(/^\/blogs\//),
    why: 'People ask AI questions. Headings that match the question make the section easy to match to a prompt.',
    fix: ['Rewrite H2s as the questions customers ask.', 'Keep the answer in the first sentence under each one.'],
    example: 'Before  H2  Layering\nAfter   H2  Can I use vitamin C with niacinamide?',
  },
  {
    id: 'freshness', category: 'content', status: 'warn', impact: 'medium', name: 'Freshness',
    finding: '7 articles show no published or updated date',
    pages: pick(7, only(/^\/blogs\//)),
    why: 'Engines favour recent sources for product advice. A missing date reads as possibly out of date.',
    fix: ['Show “Updated <date>” at the top of each article.', 'Set dateModified in the article markup.'],
  },
  {
    id: 'internal-links', category: 'content', status: 'warn', impact: 'low', name: 'Internal Linking',
    finding: 'Product pages link to no related guides',
    pages: only(/^\/products\//),
    why: 'Links between products and guides help crawlers see which page is the authority on a topic.',
    fix: ['Link each product to the one or two guides that explain its main ingredient.'],
  },
  {
    id: 'definitions', category: 'content', status: 'pass', impact: 'low', name: 'Definitions Upfront',
    finding: 'Ingredient pages define each ingredient in the first sentence', pages: [],
    why: '“What is…” prompts are answered with a one-sentence definition. Put it where it’s found first.',
    fix: ['Nothing to fix. Keep opening new ingredient pages with “<Ingredient> is…”.'],
  },
  {
    id: 'readability', category: 'content', status: 'pass', impact: 'low', name: 'Readability',
    finding: 'Average sentence length is 16 words', pages: [],
    why: 'Shorter sentences survive being quoted out of context; long ones get cut mid-thought.',
    fix: ['Nothing to fix. Keep sentences under 20 words and one idea per sentence.'],
  },
  // speed
  {
    id: 'server-response', category: 'speed', status: 'pass', impact: 'high', name: 'Server response',
    finding: 'Median response is 300 ms', pages: [],
    why: 'Slow pages get dropped from crawls before they’re read in full.',
    fix: ['Nothing to fix. The slowest single page is listed under Crawl health.'],
  },
  {
    id: 'page-weight', category: 'speed', status: 'pass', impact: 'medium', name: 'Page weight',
    finding: 'Median page is 1.2 MB', pages: [],
    why: 'Heavy pages take longer to fetch and are more likely to time out for crawlers.',
    fix: ['Nothing to fix.'],
  },
  {
    id: 'render-blocking', category: 'speed', status: 'pass', impact: 'low', name: 'Render-blocking scripts',
    finding: 'Main content renders without waiting on scripts', pages: [],
    why: 'Crawlers that don’t run JavaScript only see what renders without it.',
    fix: ['Nothing to fix.'],
  },
]
export const checkById = (id) => checks.find((c) => c.id === id)

// first path segment: "/products/vitamin-c-serum" → "/products"; the home page is "/"
export const sectionOf = (path) => (path.split('/')[1] ? `/${path.split('/')[1]}` : '/')
export function groupBySection(paths) {
  const groups = new Map()
  for (const p of paths) { const k = sectionOf(p); groups.set(k, [...(groups.get(k) ?? []), p]) }
  return [...groups].map(([section, list]) => ({ section, paths: list })).sort((a, b) => b.paths.length - a.paths.length)
}

// crawl summary for the Crawl tab
export const STATUS_CODES = ['2xx', '3xx', '4xx', '5xx'].map((k) => ({ id: k, count: pages.filter((p) => String(p.status)[0] === k[0]).length }))
export const crawl = {
  avgMs: Math.round(pages.reduce((n, p) => n + p.ms, 0) / pages.length),
  slowest: [...pages].sort((a, b) => b.ms - a.ms),
  deepest: Math.max(...pages.map((p) => p.depth)),
  errors: pages.filter((p) => p.status >= 400).length,
  depths: [0, 1, 2].map((d) => ({ depth: d, count: pages.filter((p) => p.depth === d).length })),
}
export const technicalChecks = checks.filter((c) => c.category !== 'content') // the Issues tab: technical + speed
export const contentChecks = checks.filter((c) => c.category === 'content')
export const open = (c) => c.status !== 'pass'

// Fix first: failing / needs-work checks by impact × pages affected
export const priority = (c) => IMPACT[c.impact].level * c.pages.length
// lists: Failing → Needs work → Passing, then impact, then pages
export const byStatus = (a, b) => STATUS[a.status].rank - STATUS[b.status].rank || IMPACT[b.impact].level - IMPACT[a.impact].level || b.pages.length - a.pages.length

// AI readiness: weighted pass rate (fail 0 · warn 0.5 · pass 1), overall and per category
const rate = (list) => Math.round((list.reduce((n, c) => n + STATUS[c.status].weight, 0) / list.length) * 100)
export const readiness = {
  score: rate(checks),
  previous: { date: 'Mar 20', score: 54 },
  categories: Object.entries(CATEGORIES).map(([id, label]) => ({ id, label, score: rate(checks.filter((c) => c.category === id)) })),
}

// pages ranked by how much is wrong on them: open checks weighted by impact (fail counts double), then load time
export const pageProblems = pages.map((p) => {
  const list = checks.filter((c) => open(c) && c.pages.includes(p.path)).sort(byStatus)
  const weight = list.reduce((n, c) => n + IMPACT[c.impact].level * (c.status === 'fail' ? 2 : 1), 0)
  return { ...p, checks: list, weight }
}).sort((a, b) => b.weight - a.weight || b.ms - a.ms)
export const pageByPath = (path) => pageProblems.find((p) => p.path === path)

// ---- response time buckets
export const BUCKETS = [
  { id: 'fast', label: '<200 ms', test: (ms) => ms < 200, color: 'var(--ink)' },
  { id: 'ok', label: '200–500 ms', test: (ms) => ms >= 200 && ms < 500, color: 'var(--data-c1)' },
  { id: 'slow', label: '500 ms–1 s', test: (ms) => ms >= 500 && ms < 1000, color: 'var(--data-c2)' },
  { id: 'slowest', label: '1 s+', test: (ms) => ms >= 1000, color: 'var(--data-c3)' },
].map((b) => ({ ...b, count: pages.filter((p) => b.test(p.ms)).length }))
