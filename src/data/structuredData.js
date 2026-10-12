// Structured Data (mock): which schema.org types dermasuri.com publishes, page by page.
// One crawl of 50 pages. A schema applies to some page kinds; `has(page)` says whether that page carries it.
// Everything on /structured-data (site or one-page scope) is derived from here by analyze().

export const SD = {
  domain: 'dermasuri.com',
  lastRun: 'Oct 12',
  // the run before, for the Overview's change lines
  previous: { date: 'Sep 14', required: 33, coverage: 44, fullyValid: 3, warnings: 13 },
  // run history, newest first (Settings → Last run / View run history)
  runs: [
    { date: 'Oct 12', time: '09:04', took: '3 min', pages: 50, errors: 2, skipped: 0, valid: 9, of: 24 },
    { date: 'Sep 14', time: '09:02', took: '3 min', pages: 50, errors: 2, skipped: 0, valid: 8, of: 24 },
    { date: 'Aug 17', time: '09:05', took: '4 min', pages: 48, errors: 3, skipped: 2, valid: 8, of: 23 },
    { date: 'Jul 13', time: '09:03', took: '3 min', pages: 47, errors: 3, skipped: 0, valid: 7, of: 23 },
    { date: 'Jun 16', time: '09:01', took: '3 min', pages: 45, errors: 4, skipped: 1, valid: 7, of: 23 },
  ],
  detected: ['Local business', 'E-commerce'],
}

// ---- 50 pages: home, 20 products, 8 collections, 15 posts, 6 info pages
const products = ['vitamin-c-serum', 'niacinamide-booster', 'retinol-night-cream', 'hyaluronic-moisturizer', 'mineral-sunscreen-spf-50',
  'gentle-gel-cleanser', 'azelaic-acid-cream', 'peptide-eye-cream', 'barrier-repair-balm', 'bha-exfoliant', 'tinted-spf-30',
  'ceramide-toner', 'brightening-mask', 'clarifying-clay-mask', 'overnight-lip-mask', 'squalane-oil', 'snail-mucin-essence',
  'sensitive-skin-kit', 'body-lotion-spf-15', 'hand-cream']
const collections = ['serums', 'moisturizers', 'sunscreen', 'cleansers', 'acne', 'bestsellers', 'sets', 'new']
const info = ['about', 'contact', 'shipping', 'faq', 'stores', 'ingredients']
export const pages = [
  { path: '/', kind: 'home', i: 0 },
  ...products.map((s, i) => ({ path: `/products/${s}`, kind: 'product', i })),
  ...collections.map((s, i) => ({ path: `/collections/${s}`, kind: 'collection', i })),
  ...Array.from({ length: 15 }, (_, i) => ({ path: `/blog/post-${i + 1}`, kind: 'blog', i })),
  ...info.map((s, i) => ({ path: `/pages/${s}`, kind: 'other', i, slug: s })),
]
export const PAGE_COUNT = pages.length // 50
// page types, in the order the Overview lists them
export const KINDS = { product: 'Product pages', blog: 'Blog posts', collection: 'Collections', home: 'Home', other: 'Other' }
export const isPageType = (t) => Object.hasOwn(KINDS, t)

// a URL typed into "One page": a crawled page, or one we can classify from its path
export function pageFor(input) {
  let path
  try {
    const u = new URL(/^https?:\/\//.test(input) ? input : `https://${SD.domain}${input.startsWith('/') ? '' : '/'}${input}`)
    if (u.hostname.replace(/^www\./, '') !== SD.domain) return { error: `Enter a page on ${SD.domain}` }
    path = u.pathname.replace(/\/+$/, '') || '/'
  } catch { return { error: 'Enter a valid URL' } }
  const known = pages.find((p) => p.path === path)
  if (known) return known
  const kind = path === '/' ? 'home' : path.startsWith('/products/') ? 'product' : path.startsWith('/collections/') ? 'collection'
    : /^\/(blog|blogs)\//.test(path) ? 'blog' : 'other'
  return { path, kind, i: [...path].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 20, slug: path.split('/').pop() }
}

const any = () => true
const is = (...kinds) => (p) => kinds.includes(p.kind)
const ld = (type, body) => JSON.stringify({ '@context': 'https://schema.org', '@type': type, ...body }, null, 2)
const gdoc = (slug) => `https://developers.google.com/search/docs/appearance/structured-data/${slug}`

// importance: required (the site's type needs it) · recommended · optional
// suggest: an optional schema worth adding anyway (shows in Recommendations)
// warnings: non-blocking field problems on valid markup [text, (page) => affected?]
// problems: broken markup already on the site (the Recommendations "Fix" list), each with its own drawer data:
//   { id, text, level: 'error' | 'warning', impact, test: (page) => affected?, why, fix: [steps], snippet }
//   errors make the schema Invalid; warnings show in its Issues
// how: steps to add a missing schema (falls back to the generic three)
export const schemas = [
  {
    id: 'organization', name: 'Organization', importance: 'required', applies: is('home'), has: any,
    desc: 'Your brand’s name, logo and social profiles',
    why: 'Engines use it to tie mentions of “Dermasuri” to your site, logo and social accounts.',
    doc: gdoc('organization'),
    snippet: ld('Organization', { name: 'Dermasuri', url: 'https://dermasuri.com', logo: 'https://dermasuri.com/logo.png', sameAs: ['https://www.instagram.com/dermasuri'] }),
    problems: [{
      id: 'logo-404', text: 'Logo URL returns 404', code: 'logo → URL returns 404', lastValid: 'Aug 30', level: 'error', impact: 'high', test: any,
      why: 'Engines show your logo next to brand answers and knowledge panels. A logo that 404s is dropped, so answers show a blank or another site’s image.',
      fix: ['Upload a square logo at least 112×112 px.', 'Point `logo` to https://dermasuri.com/assets/logo-512.png.', 'Re-run the analysis to confirm the URL returns 200.'],
      snippet: ld('Organization', { name: 'Dermasuri', url: 'https://dermasuri.com', logo: 'https://dermasuri.com/assets/logo-512.png', sameAs: ['https://www.instagram.com/dermasuri', 'https://www.tiktok.com/@dermasuri'] }),
    }],
  },
  {
    id: 'website', name: 'WebSite', importance: 'required', applies: is('home'), has: any,
    desc: 'Site name shown in search results',
    why: 'Sets the site name Google shows above your results and that AI answers attribute quotes to.',
    doc: gdoc('site-names'),
    snippet: ld('WebSite', { name: 'Dermasuri', url: 'https://dermasuri.com' }),
  },
  {
    id: 'product', name: 'Product', importance: 'required', applies: is('product'), has: any,
    desc: 'Name, image, price and stock for each product',
    why: 'Shopping answers read product name, price and availability from this markup.',
    warnings: [['No gtin or mpn', (p) => p.i < 12], ['Missing brand name', (p) => p.i >= 12 && p.i < 15], ['Image smaller than 500 px', (p) => p.i === 15 || p.i === 16], ['No description', (p) => p.i === 17]],
    doc: gdoc('product'),
    snippet: ld('Product', { name: 'Vitamin C Serum 15%', image: 'https://dermasuri.com/img/vitamin-c-serum.jpg', brand: { '@type': 'Brand', name: 'Dermasuri' }, sku: 'DS-VC15', gtin13: '0850012345678' }),
    problems: [
      {
        id: 'review-count', text: 'aggregateRating is missing reviewCount', code: 'aggregateRating → reviewCount is missing', lastValid: 'Sep 28', level: 'error', impact: 'high', test: (p) => [0, 4, 8, 12].includes(p.i),
        why: 'A rating without a review count fails Google’s rules, so the stars are dropped from search and shopping answers on these pages.',
        fix: ['Add `reviewCount` (or `ratingCount`) next to `ratingValue` in each aggregateRating.', 'Use the number of reviews shown on the page.', 'Re-run the analysis to confirm the 4 pages pass.'],
        snippet: ld('Product', { name: 'Vitamin C Serum 15%', image: 'https://dermasuri.com/img/vitamin-c-serum.jpg', brand: { '@type': 'Brand', name: 'Dermasuri' }, aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.6', reviewCount: '212' } }),
      },
      {
        id: 'price-valid-until', text: 'priceValidUntil date is in the past', level: 'warning', impact: 'medium', test: (p) => [1, 2, 3, 5, 6, 7].includes(p.i),
        why: 'An expired price date tells engines the price may be out of date, so they’re less likely to quote it in shopping answers.',
        fix: ['Remove `priceValidUntil` from offers with no end date.', 'For sales, set it to the real end date of the sale.', 'Generate the date from your store platform so it never goes stale.'],
        snippet: ld('Product', { name: 'Niacinamide Booster 10%', offers: { '@type': 'Offer', url: 'https://dermasuri.com/products/niacinamide-booster', price: '28.00', priceCurrency: 'USD', priceValidUntil: '2026-12-31', availability: 'https://schema.org/InStock' } }),
      },
    ],
  },
  {
    id: 'breadcrumb', name: 'BreadcrumbList', importance: 'recommended', applies: (p) => p.kind !== 'home',
    has: (p) => (p.kind === 'product' ? p.i >= 10 : p.kind === 'blog' ? p.i >= 13 : p.kind === 'collection' ? p.i < 5 : true),
    desc: 'Where the page sits in your site',
    why: 'Shows where a page sits in your site. Helps AI understand how products and guides connect.',
    how: ['Add BreadcrumbList to the product, blog and collection templates.', 'List each level from the collection down to the page, with full https URLs.', 'Match the breadcrumb trail shown on the page.'],
    warnings: [['Last item has no URL', (p) => p.kind === 'blog']],
    problems: [{
      id: 'http-urls', text: 'Item URLs use http:// not https://', level: 'warning', impact: 'low', test: (p) => p.kind === 'product' || p.kind === 'blog',
      why: 'Engines treat http:// and https:// as different pages, so the trail points to URLs that redirect instead of the page itself.',
      fix: ['Change every `item` URL in the trail to https://.', 'Fix it in the theme’s breadcrumb snippet, not page by page.', 'Re-run the analysis to confirm the 12 pages pass.'],
      snippet: ld('BreadcrumbList', { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dermasuri.com/' }, { '@type': 'ListItem', position: 2, name: 'Serums', item: 'https://dermasuri.com/collections/serums' }, { '@type': 'ListItem', position: 3, name: 'Vitamin C Serum', item: 'https://dermasuri.com/products/vitamin-c-serum' }] }),
    }],
    doc: gdoc('breadcrumb'),
    snippet: ld('BreadcrumbList', { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dermasuri.com/' }, { '@type': 'ListItem', position: 2, name: 'Serums', item: 'https://dermasuri.com/collections/serums' }, { '@type': 'ListItem', position: 3, name: 'Vitamin C Serum', item: 'https://dermasuri.com/products/vitamin-c-serum' }] }),
  },
  {
    id: 'merchant-listing', name: 'Google Merchant listing', importance: 'recommended', impact: 'high', applies: is('product'), has: (p) => p.i >= 8,
    desc: 'Shipping and return details on each offer',
    why: 'Products with shipping and return policies are eligible for merchant listings in Google and get shown with delivery details in shopping answers.',
    how: ['Add shippingDetails and hasMerchantReturnPolicy to each product’s Offer.', 'Use the same values as your shipping and returns pages.', 'Re-run the analysis to confirm the 8 pages pass.'],
    doc: gdoc('merchant-listing'),
    snippet: ld('Offer', {
      price: '34.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock',
      shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' }, deliveryTime: { '@type': 'ShippingDeliveryTime', transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' } } },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'US', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 30 },
    }),
  },
  {
    id: 'review-snippet', name: 'Review snippet', importance: 'recommended', impact: 'high', applies: is('product'), has: (p) => p.i % 4 === 0 || p.i >= 18,
    desc: 'Star ratings and review counts',
    why: 'Ratings are one of the first things AI shopping answers compare. Without markup, your reviews are invisible to them.',
    how: ['Add aggregateRating (ratingValue, reviewCount) to each Product.', 'Only mark up reviews that are shown on the page.', 'Pull the numbers from your reviews app so they stay current.'],
    doc: gdoc('review-snippet'),
    snippet: ld('Product', { name: 'Vitamin C Serum 15%', aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', reviewCount: '312' } }),
  },
  {
    id: 'local-business', name: 'LocalBusiness', importance: 'optional', applies: (p) => p.kind === 'home' || p.slug === 'stores', has: any,
    desc: 'Store address, hours and phone',
    why: 'Answers “where can I buy…” questions with your store address and opening hours.',
    warnings: [['No priceRange', any], ['No geo coordinates', (p) => p.slug === 'stores']],
    doc: gdoc('local-business'),
    snippet: ld('HealthAndBeautyBusiness', { name: 'Dermasuri Flagship', address: { '@type': 'PostalAddress', streetAddress: '120 Grand St', addressLocality: 'New York', addressRegion: 'NY', postalCode: '10013', addressCountry: 'US' }, telephone: '+1-212-555-0142' }),
  },
  {
    id: 'offer', name: 'Offer', importance: 'optional', applies: is('product'), has: any,
    desc: 'Price and availability',
    why: 'Price and stock are what shopping answers quote first. Without them, the answer can’t say what a product costs.',
    warnings: [['No itemCondition', (p) => p.i >= 4 && p.i <= 7], ['availability uses plain text', (p) => p.i === 9]],
    doc: gdoc('product'),
    snippet: ld('Offer', { price: '34.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' }),
  },
  { id: 'brand', name: 'Brand', importance: 'optional', applies: is('product'), has: (p) => p.i >= 11, desc: 'The brand behind each product', why: 'Links each product back to the Dermasuri brand, so engines count every product mention toward your brand.', doc: 'https://schema.org/Brand', snippet: ld('Brand', { name: 'Dermasuri' }) },
  { id: 'image-object', name: 'ImageObject', importance: 'optional', applies: is('product'), has: (p) => p.i >= 14, desc: 'Product photos with captions', why: 'Gives image answers a caption and licence for your photos, so they can show them with credit.', doc: gdoc('image-license-metadata'), snippet: ld('ImageObject', { contentUrl: 'https://dermasuri.com/img/vitamin-c-serum.jpg', caption: 'Vitamin C Serum 15%, 30 ml' }) },
  {
    id: 'item-list', name: 'ItemList', importance: 'optional', suggest: true, impact: 'low', applies: is('collection'), has: () => false,
    desc: 'The products on a collection page',
    why: 'Lets engines read collection pages as ordered product lists. That’s the shape of “best serums for…” answers.',
    how: ['Add ItemList to the collection template.', 'List the products in the order the page shows them, each with its URL.', 'Keep it to the products visible on the first page.'],
    doc: gdoc('carousel'),
    snippet: ld('ItemList', { name: 'Serums', itemListElement: [{ '@type': 'ListItem', position: 1, url: 'https://dermasuri.com/products/vitamin-c-serum' }, { '@type': 'ListItem', position: 2, url: 'https://dermasuri.com/products/niacinamide-booster' }, { '@type': 'ListItem', position: 3, url: 'https://dermasuri.com/products/hyaluronic-moisturizer' }] }),
  },
  { id: 'collection-page', name: 'CollectionPage', importance: 'optional', applies: is('collection'), has: any, desc: 'Marks a page as a product collection', why: 'Tells engines the page is a category, not a single product, so they don’t quote it as one.', doc: 'https://schema.org/CollectionPage', snippet: ld('CollectionPage', { name: 'Serums' }) },
  {
    id: 'article', name: 'Article', importance: 'optional', suggest: true, impact: 'high', applies: is('blog'), has: () => false,
    desc: 'Headline, author and dates for posts',
    why: 'Adds author and publish/update dates. AI uses these to judge freshness and expertise.',
    how: ['Add Article markup to the blog post template.', 'Fill `author`, `datePublished` and `dateModified` from the post.', 'Re-run the analysis to confirm all 15 posts pass.'],
    doc: gdoc('article'),
    snippet: ld('Article', { headline: 'Vitamin C vs niacinamide: can you use them together?', image: 'https://dermasuri.com/img/journal/vitamin-c-niacinamide.jpg', author: { '@type': 'Person', name: 'Dr. Lena Ortiz', url: 'https://dermasuri.com/pages/about' }, datePublished: '2026-03-02', dateModified: '2026-10-02', description: 'Yes. Modern formulas are stable together. Here’s how to layer them morning and night without irritation.' }),
  },
  {
    id: 'faq', name: 'FAQPage', importance: 'optional', suggest: true, impact: 'medium', applies: (p) => p.kind === 'blog' || p.slug === 'faq', has: (p) => p.slug === 'faq',
    desc: 'Questions and answers on a page',
    why: 'Question-and-answer pairs are the format AI answers are built from. Your posts already answer questions; markup makes them easy to lift.',
    how: ['Add FAQPage markup to posts that end with a Q&A section.', 'Keep each answer under 60 words and identical to the visible text.', 'Don’t mark up questions that aren’t shown on the page.'],
    doc: gdoc('faqpage'),
    snippet: ld('FAQPage', { mainEntity: [{ '@type': 'Question', name: 'Can I use vitamin C with niacinamide?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Modern formulas are stable together. Apply vitamin C first, then niacinamide.' } }, { '@type': 'Question', name: 'Is mineral sunscreen better for sensitive skin?', acceptedAnswer: { '@type': 'Answer', text: 'Often, yes. Zinc oxide is less likely to sting than chemical filters.' } }] }),
  },
  {
    id: 'person', name: 'Person', importance: 'optional', suggest: true, impact: 'medium', applies: is('blog'), has: () => false,
    desc: 'Authors and reviewers',
    why: 'Names the dermatologist or writer behind each guide. Builds trust signals for health topics.',
    how: ['Add a Person block for each author and reviewer.', 'Include `jobTitle` and a link to their bio page.', 'Reference it from each post’s Article `author`.'],
    doc: 'https://schema.org/Person',
    snippet: ld('Person', { name: 'Dr. Lena Ortiz', jobTitle: 'Board-certified dermatologist', url: 'https://dermasuri.com/pages/about', worksFor: { '@type': 'Organization', name: 'Dermasuri' } }),
  },
  { id: 'video', name: 'VideoObject', importance: 'optional', applies: is('blog'), has: (p) => p.i < 1, desc: 'How-to and routine videos', why: 'Makes your routine videos eligible for video results. AI answers can then link the clip next to the steps.', doc: gdoc('video'), snippet: ld('VideoObject', { name: 'Morning routine in 3 steps', thumbnailUrl: 'https://dermasuri.com/img/routine.jpg', uploadDate: '2026-04-01' }) },
  {
    id: 'howto', name: 'HowTo', importance: 'optional', suggest: true, impact: 'medium', applies: (p) => p.kind === 'blog' && p.i % 3 === 0, has: () => false,
    desc: 'Step-by-step routines',
    why: 'Step-by-step routines can appear as numbered steps in AI answers.',
    how: ['Add HowTo markup to the routine posts.', 'Give each step a short name and one sentence of text.', 'Keep the steps in the same order as the post.'],
    doc: 'https://schema.org/HowTo',
    snippet: ld('HowTo', { name: 'Morning routine for oily skin', totalTime: 'PT5M', step: [{ '@type': 'HowToStep', name: 'Cleanse', text: 'Wash with Gentle Gel Cleanser and pat dry.' }, { '@type': 'HowToStep', name: 'Treat', text: 'Apply two drops of Vitamin C Serum 15%.' }, { '@type': 'HowToStep', name: 'Protect', text: 'Finish with Mineral Sunscreen SPF 50.' }] }),
  },
  { id: 'search-action', name: 'SearchAction', importance: 'optional', applies: is('home'), has: any, desc: 'Your site search', why: 'Tells engines how to search your catalogue, so they can send people straight to the right products.', doc: 'https://schema.org/SearchAction', snippet: ld('WebSite', { url: 'https://dermasuri.com', potentialAction: { '@type': 'SearchAction', target: 'https://dermasuri.com/search?q={q}', 'query-input': 'required name=q' } }) },
  { id: 'contact-point', name: 'ContactPoint', importance: 'optional', applies: (p) => p.kind === 'home' || p.slug === 'contact', has: any, desc: 'Customer service phone and email', why: 'Lets AI answer “how do I contact Dermasuri?” with your real phone and email. Without it, answers may show an old number or none.', doc: 'https://schema.org/ContactPoint', snippet: ld('ContactPoint', { contactType: 'customer service', email: 'hello@dermasuri.com' }) },
  { id: 'postal-address', name: 'PostalAddress', importance: 'optional', applies: (p) => p.slug === 'stores', has: any, desc: 'Store address', why: 'Gives local answers and maps your exact store address, so people asking “where can I buy Dermasuri?” get a place to go.', doc: 'https://schema.org/PostalAddress', snippet: ld('PostalAddress', { streetAddress: '120 Grand St', addressLocality: 'New York', addressCountry: 'US' }) },
  { id: 'opening-hours', name: 'OpeningHoursSpecification', importance: 'optional', applies: (p) => p.slug === 'stores', has: any, desc: 'Store opening hours', why: 'Lets engines answer “is Dermasuri open now?” from your real hours instead of guessing.', doc: 'https://schema.org/OpeningHoursSpecification', snippet: ld('OpeningHoursSpecification', { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '19:00' }) },
  { id: 'web-page', name: 'WebPage', importance: 'optional', applies: any, has: (p) => p.kind !== 'blog', desc: 'Basic page name and description', why: 'It’s the basic description engines fall back to when a page has no more specific markup.', doc: 'https://schema.org/WebPage', snippet: ld('WebPage', { name: 'Vitamin C Serum 15%', description: 'A 15% vitamin C serum for dull, uneven skin.' }) },
  { id: 'site-navigation', name: 'SiteNavigationElement', importance: 'optional', applies: is('home'), has: any, desc: 'Main menu links', why: 'Helps crawlers find your main sections, so the pages you link from the menu get crawled first.', doc: 'https://schema.org/SiteNavigationElement', snippet: ld('SiteNavigationElement', { name: ['Shop', 'Journal', 'Stores'] }) },
  { id: 'event', name: 'Event', importance: 'optional', applies: (p) => p.slug === 'stores', has: () => false, desc: 'In-store events and launches', why: 'AI and search answers can list your in-store events with date and location. Without it, they don’t know the event exists.', doc: gdoc('event'), snippet: ld('Event', { name: 'Skin consultation day', startDate: '2026-07-12T10:00', location: { '@type': 'Place', name: 'Dermasuri Flagship' } }) },
]
// every schema's page types (['product'], ['blog', 'other'] …), so the Schemas tab can filter by ?type=
for (const s of schemas) s.pageTypes = Object.keys(KINDS).filter((k) => pages.some((p) => p.kind === k && s.applies(p)))
export const schemaById = (id) => schemas.find((s) => s.id === id)

export const IMPORTANCE = { required: 'Required', recommended: 'Recommended', optional: 'Optional' }
export const STATUS = { valid: 'Valid', invalid: 'Invalid', missing: 'Missing' }

const label = (score) => (score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor')

// "Used on": where a schema applies, in words — "Home page", "Product pages", "FAQ & blog", "All pages"
const SLUG_LABEL = { faq: 'FAQ' }
const KIND_WORD = { home: ['Home page', 'home'], product: ['Product pages', 'product pages'], collection: ['Collections', 'collections'], blog: ['Blog posts', 'blog'] }
function usedOnLabel(applicable, scopeSize) {
  if (!applicable.length) return '' // doesn't apply in this scope (the row is dropped below)
  if (applicable.length === scopeSize && scopeSize > 1) return 'All pages'
  if (applicable.length === scopeSize - 1 && scopeSize > 2 && !applicable.some((p) => p.kind === 'home')) return 'All but the home page'
  // other (info) pages are named one by one (Stores, Contact); the rest by page type; home first, blog last
  const order = ['home', 'other', 'product', 'collection', 'blog']
  const parts = []
  for (const k of order) {
    const ps = applicable.filter((p) => p.kind === k)
    if (!ps.length) continue
    if (k === 'other') ps.forEach((p) => parts.push(SLUG_LABEL[p.slug] ?? p.slug[0].toUpperCase() + p.slug.slice(1)))
    else parts.push(k)
  }
  if (parts.length > 2) return `${parts.length} page types`
  // one part: its full name ("Product pages"); two: short words joined, first one capitalised ("FAQ & blog", "Home & stores")
  const words = parts.map((w, i) => (KIND_WORD[w] ? KIND_WORD[w][parts.length > 1 ? 1 : 0] : i && w !== 'FAQ' ? w.toLowerCase() : w))
  const label = words.join(' & ')
  return label && label[0].toUpperCase() + label.slice(1)
}

const IMPACT_BY_IMPORTANCE = { required: 'high', recommended: 'medium', optional: 'low' }
export const IMPACT_LEVEL = { high: 3, medium: 2, low: 1 }

// one page, one page type (kind), or the whole site → rows + KPIs for every tab
export function analyze(page = null, kind = null) {
  const list = page ? [page] : kind ? pages.filter((p) => p.kind === kind) : pages
  const rows = schemas.map((s) => {
    const applicable = list.filter(s.applies)
    const found = applicable.filter(s.has).map((p) => p.path)
    const missing = applicable.filter((p) => !s.has(p)).map((p) => p.path)
    const carries = applicable.filter(s.has)
    // broken markup already on the site, on the pages in scope that carry this schema
    const problems = (s.problems ?? []).map((pr) => ({ ...pr, on: carries.filter(pr.test) })).filter((pr) => pr.on.length)
    const invalid = [...new Set(problems.filter((pr) => pr.level === 'error').flatMap((pr) => pr.on.map((p) => p.path)))]
    // [text, affected paths], only for warnings that hit a page in scope (field warnings + warning-level problems)
    const warnings = [
      ...(s.warnings ?? []).map(([text, test]) => [text, carries.filter(test).map((p) => p.path)]),
      ...problems.filter((pr) => pr.level === 'warning').map((pr) => [pr.text, pr.on.map((p) => p.path)]),
    ].filter(([, w]) => w.length)
    const status = invalid.length ? 'invalid' : missing.length ? 'missing' : 'valid'
    // the page types the problem pages belong to: "Product pages" / "Blog posts and Other"
    const kinds = [...new Set(applicable.filter((p) => missing.includes(p.path) || invalid.includes(p.path)).map((p) => KINDS[p.kind]))]
    const usedOn = usedOnLabel(applicable, list.length)
    const fixes = problems.map((pr) => ({
      id: `${s.id}--${pr.id}`, kind: 'fix', schemaId: s.id, name: `${s.name} · ${pr.text}`, title: pr.text, level: pr.level,
      status: pr.level === 'error' ? 'invalid' : 'warning', importance: s.importance, impact: pr.impact, desc: pr.text,
      why: pr.why, how: pr.fix, snippet: pr.snippet, doc: s.doc, type: s.name,
      affected: pr.on.map((p) => p.path), applicable: applicable.length, usedOn: usedOnLabel(pr.on, list.length),
      kinds: [...new Set(pr.on.map((p) => KINDS[p.kind]))], found: [], missing: [], invalid: [], warnings: [],
    }))
    const firstError = problems.find((pr) => pr.level === 'error')
    const error = firstError && { code: firstError.code ?? firstError.text, why: firstError.why, lastValid: firstError.lastValid ?? null }
    return { ...s, kind: 'schema', type: s.name, applicable: applicable.length, usedOn, found, missing, invalid, warnings, status, fixes, error, impact: s.impact ?? IMPACT_BY_IMPORTANCE[s.importance], kinds, affected: invalid.length ? invalid : missing }
  }).filter((r) => r.applicable > 0)

  const req = rows.filter((r) => r.importance === 'required')
  const add = rows.filter((r) => r.importance === 'recommended')
  const invalid = rows.filter((r) => r.status === 'invalid')
  // Recommendations: Fix = broken markup on the site, Add = missing schemas worth adding; both by impact, then pages
  const byImpact = (a, b) => IMPACT_LEVEL[b.impact] - IMPACT_LEVEL[a.impact] || b.affected.length - a.affected.length
  const fix = rows.flatMap((r) => r.fixes).sort(byImpact)
  const toAdd = rows.filter((r) => r.status === 'missing' && (r.importance !== 'optional' || r.suggest)).sort(byImpact)
  const score = Math.max(0, 100 - 25 * req.filter((r) => r.status !== 'valid').length - 15 * invalid.length)
  const slots = rows.reduce((n, r) => n + r.applicable, 0)
  const filled = rows.reduce((n, r) => n + r.found.length, 0)
  // a page is fully valid when nothing that applies to it is missing, broken or warned about
  const fullyValid = list.filter((p) => rows.every((r) => !r.applies(p) || (r.has(p) && !r.invalid.includes(p.path) && !r.warnings.some(([, w]) => w.includes(p.path))))).length
  const warnings = rows.reduce((n, r) => n + r.warnings.length, 0)

  // filled share of the applicable slots, per page type (site and page-type scope only)
  const byKind = Object.entries(KINDS).map(([k, label]) => {
    const ps = list.filter((p) => p.kind === k)
    let slotsK = 0, filledK = 0
    for (const r of rows) for (const p of ps) if (r.applies(p)) { slotsK++; if (r.has(p)) filledK++ }
    return { kind: k, label, pages: ps.length, coverage: slotsK ? Math.round((filledK * 100) / slotsK) : 0 }
  }).filter((k) => k.pages)

  return {
    rows,
    list, // the pages in scope (the Coverage map groups them by the Settings page-type rules)
    byKind,
    notRelevant: schemas.length - rows.length,
    pageCount: list.length,
    score, scoreLabel: label(score),
    coverage: slots ? Math.round((filled * 100) / slots) : 0,
    fullyValid,
    critical: fix.filter((f) => f.level === 'error').length,
    warnings,
    required: { valid: req.filter((r) => r.status === 'valid').length, total: req.length },
    additional: { valid: add.filter((r) => r.status === 'valid').length, total: add.length },
    fix,
    toAdd,
    // Coverage map cell: how many of this page type's pages the schema applies to, and how many carry it
    cell: (schemaId, k) => {
      const sc = schemaById(schemaId)
      const ps = list.filter((p) => p.kind === k && sc.applies(p))
      return { applies: ps.length, found: ps.filter(sc.has).length }
    },
    // the same, for any set of pages (a Settings page-type rule)
    cellFor: (schemaId, ps) => {
      const sc = schemaById(schemaId)
      const on = ps.filter(sc.applies)
      return { applies: on.length, found: on.filter(sc.has).length }
    },
    // the Schema drawer opens rows and Fix items alike
    find: (id) => rows.find((r) => r.id === id) ?? fix.find((f) => f.id === id),
  }
}
