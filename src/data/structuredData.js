// Structured Data (mock): one crawl of dermasuri.com, in the shape the app's API returns
// (GET /projects/:id/crawl/schema-validator → pages with their page type, schema types and issues).
// The page's numbers are worked out from this by components/structured/analyze.js; what each schema is for (why it
// matters, how to add it, its example) is reference content in src/lib/schema-reference.js.

export const SD = {
  domain: 'dermasuri.com',
  brand: 'Dermasuri',
  crawled: true,
  // the last crawl. failed: the pages it couldn't read (crawl pages with an error status: GET /projects/:id/crawl/pages,
  // WebPage.status), listed in the header's "{n} errors" drawer (a backend with only a count passes errors instead).
  // No run history (no data for it).
  lastRun: {
    date: 'Oct 12', time: '09:04', took: '3 min', pages: 50, skipped: 0,
    failed: [
      { path: '/pages/stores', status: 404, reason: 'Not found' },
      { path: '/blog/post-12', status: 500, reason: 'Server error' },
    ],
  },
  // the run before, for the Overview's change lines (null when there's no earlier run to compare with)
  previous: { date: 'Sep 14', required: 33, coverage: 44, fullyValid: 3, warnings: 13 },
}

// ---- 50 pages: home, 20 products, 8 collections, 15 posts, 6 info pages
const products = ['vitamin-c-serum', 'niacinamide-booster', 'retinol-night-cream', 'hyaluronic-moisturizer', 'mineral-sunscreen-spf-50',
  'gentle-gel-cleanser', 'azelaic-acid-cream', 'peptide-eye-cream', 'barrier-repair-balm', 'bha-exfoliant', 'tinted-spf-30',
  'ceramide-toner', 'brightening-mask', 'clarifying-clay-mask', 'overnight-lip-mask', 'squalane-oil', 'snail-mucin-essence',
  'sensitive-skin-kit', 'body-lotion-spf-15', 'hand-cream']
const collections = ['serums', 'moisturizers', 'sunscreen', 'cleansers', 'acne', 'bestsellers', 'sets', 'new']
const info = ['about', 'contact', 'shipping', 'faq', 'stores', 'ingredients']
const pages = [
  { path: '/', kind: 'home', i: 0 },
  ...products.map((s, i) => ({ path: `/products/${s}`, kind: 'product', i })),
  ...collections.map((s, i) => ({ path: `/collections/${s}`, kind: 'collection', i })),
  ...Array.from({ length: 15 }, (_, i) => ({ path: `/blog/post-${i + 1}`, kind: 'blog', i })),
  ...info.map((s, i) => ({ path: `/pages/${s}`, kind: 'other', i, slug: s })),
]
// the API's page type for each mock page kind
const PAGE_TYPE = { home: 'HOME', product: 'PRODUCT', collection: 'CATEGORY', blog: 'ARTICLE' }
const OTHER_TYPE = { about: 'ABOUT', contact: 'CONTACT', faq: 'FAQ', stores: 'LOCATION' }

const any = () => true
const is = (...kinds) => (p) => kinds.includes(p.kind)
const ld = (type, body) => JSON.stringify({ '@context': 'https://schema.org', '@type': type, ...body }, null, 2)

// which schema types each mock page carries, and the problems on them (generator rules, not reference content)
const rules = [
  {
    id: 'organization', name: 'Organization', importance: 'required', applies: is('home'), has: any,
    snippet: ld('Organization', { name: 'Dermasuri', url: 'https://dermasuri.com', logo: 'https://dermasuri.com/logo.png', sameAs: ['https://www.instagram.com/dermasuri'] }),
    problems: [{
      id: 'logo-404', effort: 5, action: 'Fix the broken logo link', text: 'Logo URL returns 404', code: 'logo → URL returns 404', lastValid: 'Aug 30', level: 'error', impact: 'high', test: any,
      fix: ['Upload a square logo at least 112×112 px.', 'Point `logo` to https://dermasuri.com/assets/logo-512.png.', 'Re-run the analysis to confirm the URL returns 200.'],
      snippet: ld('Organization', { name: 'Dermasuri', url: 'https://dermasuri.com', logo: 'https://dermasuri.com/assets/logo-512.png', sameAs: ['https://www.instagram.com/dermasuri', 'https://www.tiktok.com/@dermasuri'] }),
    }],
  },
  {
    id: 'website', name: 'WebSite', importance: 'required', applies: is('home'), has: any,
    snippet: ld('WebSite', { name: 'Dermasuri', url: 'https://dermasuri.com' }),
  },
  {
    id: 'product', name: 'Product', importance: 'required', applies: is('product'), has: any,
    warnings: [['No gtin or mpn', (p) => p.i < 12], ['Missing brand name', (p) => p.i >= 12 && p.i < 15], ['Image smaller than 500 px', (p) => p.i === 15 || p.i === 16], ['No description', (p) => p.i === 17]],
    snippet: ld('Product', { name: 'Vitamin C Serum 15%', image: 'https://dermasuri.com/img/vitamin-c-serum.jpg', brand: { '@type': 'Brand', name: 'Dermasuri' }, sku: 'DS-VC15', gtin13: '0850012345678' }),
    problems: [
      {
        id: 'review-count', effort: 15, action: 'Add review counts to product ratings', text: 'aggregateRating is missing reviewCount', code: 'aggregateRating → reviewCount is missing', lastValid: 'Sep 28', level: 'error', impact: 'high', test: (p) => [0, 4, 8, 12].includes(p.i),
        fix: ['Add `reviewCount` (or `ratingCount`) next to `ratingValue` in each aggregateRating.', 'Use the number of reviews shown on the page.', 'Re-run the analysis to confirm the 4 pages pass.'],
        snippet: ld('Product', { name: 'Vitamin C Serum 15%', image: 'https://dermasuri.com/img/vitamin-c-serum.jpg', brand: { '@type': 'Brand', name: 'Dermasuri' }, aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.6', reviewCount: '212' } }),
      },
      {
        id: 'price-valid-until', effort: 30, action: 'Update expired product prices', text: 'priceValidUntil date is in the past', level: 'warning', impact: 'medium', test: (p) => [1, 2, 3, 5, 6, 7].includes(p.i),
        fix: ['Remove `priceValidUntil` from offers with no end date.', 'For sales, set it to the real end date of the sale.', 'Generate the date from your store platform so it never goes stale.'],
        snippet: ld('Product', { name: 'Niacinamide Booster 10%', offers: { '@type': 'Offer', url: 'https://dermasuri.com/products/niacinamide-booster', price: '28.00', priceCurrency: 'USD', priceValidUntil: '2026-12-31', availability: 'https://schema.org/InStock' } }),
      },
    ],
  },
  {
    id: 'breadcrumb', effort: 60, action: 'Add breadcrumbs to products, blog and collections', name: 'BreadcrumbList', importance: 'recommended', applies: (p) => p.kind !== 'home',
    has: (p) => (p.kind === 'product' ? p.i >= 10 : p.kind === 'blog' ? p.i >= 13 : p.kind === 'collection' ? p.i < 5 : true),
    warnings: [['Last item has no URL', (p) => p.kind === 'blog']],
    problems: [{
      id: 'http-urls', effort: 25, action: 'Switch breadcrumb links to https', text: 'Item URLs use http:// not https://', level: 'warning', impact: 'low', test: (p) => p.kind === 'product' || p.kind === 'blog',
      fix: ['Change every `item` URL in the trail to https://.', 'Fix it in the theme’s breadcrumb snippet, not page by page.', 'Re-run the analysis to confirm the 12 pages pass.'],
      snippet: ld('BreadcrumbList', { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dermasuri.com/' }, { '@type': 'ListItem', position: 2, name: 'Serums', item: 'https://dermasuri.com/collections/serums' }, { '@type': 'ListItem', position: 3, name: 'Vitamin C Serum', item: 'https://dermasuri.com/products/vitamin-c-serum' }] }),
    }],
    snippet: ld('BreadcrumbList', { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dermasuri.com/' }, { '@type': 'ListItem', position: 2, name: 'Serums', item: 'https://dermasuri.com/collections/serums' }, { '@type': 'ListItem', position: 3, name: 'Vitamin C Serum', item: 'https://dermasuri.com/products/vitamin-c-serum' }] }),
  },
  {
    id: 'merchant-listing', effort: 45, action: 'Add shipping and returns to product offers', name: 'Google Merchant listing', importance: 'recommended', impact: 'high', applies: is('product'), has: (p) => p.i >= 8,
    snippet: ld('Offer', {
      price: '34.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock',
      shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' }, deliveryTime: { '@type': 'ShippingDeliveryTime', transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' } } },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'US', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 30 },
    }),
  },
  {
    id: 'review-snippet', effort: 30, action: 'Add star ratings to product pages', name: 'Review snippet', importance: 'recommended', impact: 'high', applies: is('product'), has: (p) => p.i % 4 === 0 || p.i >= 18,
    snippet: ld('Product', { name: 'Vitamin C Serum 15%', aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', reviewCount: '312' } }),
  },
  {
    id: 'local-business', name: 'LocalBusiness', importance: 'optional', applies: (p) => p.kind === 'home' || p.slug === 'stores', has: any,
    warnings: [['No priceRange', any], ['No geo coordinates', (p) => p.slug === 'stores']],
    snippet: ld('HealthAndBeautyBusiness', { name: 'Dermasuri Flagship', address: { '@type': 'PostalAddress', streetAddress: '120 Grand St', addressLocality: 'New York', addressRegion: 'NY', postalCode: '10013', addressCountry: 'US' }, telephone: '+1-212-555-0142' }),
  },
  {
    id: 'offer', name: 'Offer', importance: 'optional', applies: is('product'), has: any,
    warnings: [['No itemCondition', (p) => p.i >= 4 && p.i <= 7], ['availability uses plain text', (p) => p.i === 9]],
    snippet: ld('Offer', { price: '34.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' }),
  },
  { id: 'brand', name: 'Brand', importance: 'optional', applies: is('product'), has: (p) => p.i >= 11, snippet: ld('Brand', { name: 'Dermasuri' }) },
  { id: 'image-object', name: 'ImageObject', importance: 'optional', applies: is('product'), has: (p) => p.i >= 14, snippet: ld('ImageObject', { contentUrl: 'https://dermasuri.com/img/vitamin-c-serum.jpg', caption: 'Vitamin C Serum 15%, 30 ml' }) },
  {
    id: 'item-list', effort: 20, action: 'List the products on collection pages', name: 'ItemList', importance: 'optional', suggest: true, impact: 'low', applies: is('collection'), has: () => false,
    snippet: ld('ItemList', { name: 'Serums', itemListElement: [{ '@type': 'ListItem', position: 1, url: 'https://dermasuri.com/products/vitamin-c-serum' }, { '@type': 'ListItem', position: 2, url: 'https://dermasuri.com/products/niacinamide-booster' }, { '@type': 'ListItem', position: 3, url: 'https://dermasuri.com/products/hyaluronic-moisturizer' }] }),
  },
  { id: 'collection-page', name: 'CollectionPage', importance: 'optional', applies: is('collection'), has: any, snippet: ld('CollectionPage', { name: 'Serums' }) },
  {
    id: 'article', effort: 30, action: 'Add authors and dates to blog posts', name: 'Article', importance: 'optional', suggest: true, impact: 'high', applies: is('blog'), has: () => false,
    snippet: ld('Article', { headline: 'Vitamin C vs niacinamide: can you use them together?', image: 'https://dermasuri.com/img/journal/vitamin-c-niacinamide.jpg', author: { '@type': 'Person', name: 'Dr. Lena Ortiz', url: 'https://dermasuri.com/pages/about' }, datePublished: '2026-03-02', dateModified: '2026-10-02', description: 'Yes. Modern formulas are stable together. Here’s how to layer them morning and night without irritation.' }),
  },
  {
    id: 'faq', effort: 45, action: 'Mark up the Q&As on blog posts', name: 'FAQPage', importance: 'optional', suggest: true, impact: 'medium', applies: (p) => p.kind === 'blog' || p.slug === 'faq', has: (p) => p.slug === 'faq',
    snippet: ld('FAQPage', { mainEntity: [{ '@type': 'Question', name: 'Can I use vitamin C with niacinamide?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Modern formulas are stable together. Apply vitamin C first, then niacinamide.' } }, { '@type': 'Question', name: 'Is mineral sunscreen better for sensitive skin?', acceptedAnswer: { '@type': 'Answer', text: 'Often, yes. Zinc oxide is less likely to sting than chemical filters.' } }] }),
  },
  {
    id: 'person', effort: 20, action: 'Name the experts behind each guide', name: 'Person', importance: 'optional', suggest: true, impact: 'medium', applies: is('blog'), has: () => false,
    snippet: ld('Person', { name: 'Dr. Lena Ortiz', jobTitle: 'Board-certified dermatologist', url: 'https://dermasuri.com/pages/about', worksFor: { '@type': 'Organization', name: 'Dermasuri' } }),
  },
  { id: 'video', name: 'VideoObject', importance: 'optional', applies: is('blog'), has: (p) => p.i < 1, snippet: ld('VideoObject', { name: 'Morning routine in 3 steps', thumbnailUrl: 'https://dermasuri.com/img/routine.jpg', uploadDate: '2026-04-01' }) },
  {
    id: 'howto', effort: 30, action: 'Mark up the steps in routine posts', name: 'HowTo', importance: 'optional', suggest: true, impact: 'medium', applies: (p) => p.kind === 'blog' && p.i % 3 === 0, has: () => false,
    snippet: ld('HowTo', { name: 'Morning routine for oily skin', totalTime: 'PT5M', step: [{ '@type': 'HowToStep', name: 'Cleanse', text: 'Wash with Gentle Gel Cleanser and pat dry.' }, { '@type': 'HowToStep', name: 'Treat', text: 'Apply two drops of Vitamin C Serum 15%.' }, { '@type': 'HowToStep', name: 'Protect', text: 'Finish with Mineral Sunscreen SPF 50.' }] }),
  },
  { id: 'search-action', name: 'SearchAction', importance: 'optional', applies: is('home'), has: any, snippet: ld('WebSite', { url: 'https://dermasuri.com', potentialAction: { '@type': 'SearchAction', target: 'https://dermasuri.com/search?q={q}', 'query-input': 'required name=q' } }) },
  { id: 'contact-point', name: 'ContactPoint', importance: 'optional', applies: (p) => p.kind === 'home' || p.slug === 'contact', has: any, snippet: ld('ContactPoint', { contactType: 'customer service', email: 'hello@dermasuri.com' }) },
  { id: 'postal-address', name: 'PostalAddress', importance: 'optional', applies: (p) => p.slug === 'stores', has: any, snippet: ld('PostalAddress', { streetAddress: '120 Grand St', addressLocality: 'New York', addressCountry: 'US' }) },
  { id: 'opening-hours', name: 'OpeningHoursSpecification', importance: 'optional', applies: (p) => p.slug === 'stores', has: any, snippet: ld('OpeningHoursSpecification', { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '19:00' }) },
  { id: 'web-page', name: 'WebPage', importance: 'optional', applies: any, has: (p) => p.kind !== 'blog', snippet: ld('WebPage', { name: 'Vitamin C Serum 15%', description: 'A 15% vitamin C serum for dull, uneven skin.' }) },
  { id: 'site-navigation', name: 'SiteNavigationElement', importance: 'optional', applies: is('home'), has: any, snippet: ld('SiteNavigationElement', { name: ['Shop', 'Journal', 'Stores'] }) },
  { id: 'event', name: 'Event', importance: 'optional', applies: (p) => p.slug === 'stores', has: () => false, snippet: ld('Event', { name: 'Skin consultation day', startDate: '2026-07-12T10:00', location: { '@type': 'Place', name: 'Dermasuri Flagship' } }) },
]

// rules → the schema type the crawler would report (merchant listing details live on Offer; review snippets are AggregateRating)
const TYPE_OF = { 'merchant-listing': null, 'review-snippet': 'AggregateRating' }
const slugOf = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const crawlPages = pages.map((p) => {
  const on = rules.filter((r) => r.applies(p) && r.has(p) && TYPE_OF[r.id] !== null)
  const schemaTypes = [...new Set(on.map((r) => TYPE_OF[r.id] ?? r.name))]
  const issues = on.flatMap((r) => {
    const type = TYPE_OF[r.id] ?? r.name
    return [
      ...(r.problems ?? []).filter((pr) => pr.test(p)).map((pr) => ({ severity: pr.level, code: pr.id, message: pr.text, fix: pr.fix, example: pr.snippet, path: pr.code ? `${type}.${pr.code.split(' → ')[0]}` : type })),
      ...(r.warnings ?? []).filter(([, test]) => test(p)).map(([text]) => ({ severity: 'info', code: slugOf(text), message: text, path: type })),
    ]
  })
  return { url: `https://${SD.domain}${p.path}`, path: p.path, title: p.slug ?? p.path, pageType: p.kind === 'other' ? OTHER_TYPE[p.slug] ?? 'OTHER' : PAGE_TYPE[p.kind], schemaTypes, issues }
})

// Structured Data saves. Here: in memory, after a moment. can*: controls shown only where the app can save them.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const crawlActions = {
  canMarkDone: true, // "What to do next": mark a step done
  canMarkAdded: true, // schema drawer: Mark as added / Mark as fixed
  canEditCrawlSettings: false, // sitemap, include / exclude paths, schedule, alerts (no save for them yet): the Settings tab
  // Pages to crawl (25 / 50 / 100 / 200) is in Re-run's menu: saved with the page's settings, sent with the next run.
  // → { lastRun } when the crawl has finished; rejects with the reason when it fails
  async onRunCrawl({ maxPages } = {}) {
    await sleep(1800)
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    SD.lastRun = { ...SD.lastRun, date: today, pages: Math.min(maxPages ?? 50, pages.length) }
    return { lastRun: SD.lastRun }
  },
}
