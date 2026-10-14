// Schema reference: product content about schema.org types, not project data. Keyed by schema type.
// Used by the Structured Data page (components/structured/analyze.js) for importance, impact, effort, why it matters,
// the steps to add it, the example snippet and the "What it unlocks" preview. {brand} and {domain} are filled in
// with the project's name and site.
//
//   importance  required | recommended | optional
//   pageTypes   the page types (the API's PageType) it belongs on; it's "missing" on those pages when absent
//   suggest     an optional schema worth recommending anyway (Recommendations → Add)
//   problems    extra words for known issue codes: { why, action, effort, impact }

const gdoc = (slug) => `https://developers.google.com/search/docs/appearance/structured-data/${slug}`
const ld = (type, body) => JSON.stringify({ '@context': 'https://schema.org', '@type': type, ...body }, null, 2)
const site = ({ domain }) => `https://${domain}`

// the API's page types, in plain English (the Coverage map rows, the page-type filter)
export const PAGE_TYPE_LABEL = {
  HOME: 'Home', ABOUT: 'About', SERVICE: 'Service pages', PRODUCT: 'Product pages', SOLUTION: 'Solution pages',
  CATEGORY: 'Collections', PRICING: 'Pricing', CASE_STUDY: 'Case studies', PORTFOLIO: 'Portfolio', LOCATION: 'Locations',
  FAQ: 'FAQ', BLOG: 'Blog', ARTICLE: 'Blog posts', CONTACT: 'Contact', LEGAL: 'Legal', OTHER: 'Other pages',
}
// display order of the page types (home first)
export const PAGE_TYPE_ORDER = Object.keys(PAGE_TYPE_LABEL)

const POSTS = ['ARTICLE', 'BLOG']
const LISTINGS = ['PRODUCT', 'CATEGORY', 'ARTICLE', 'BLOG']

export const SCHEMA_REFERENCE = {
  Organization: {
    importance: 'required', pageTypes: ['HOME'],
    desc: 'Your brand’s name, logo and social profiles',
    why: 'Engines use it to tie mentions of “{brand}” to your site, logo and social accounts.',
    doc: gdoc('organization'),
    snippet: (c) => ld('Organization', { name: c.brand, url: site(c), logo: `${site(c)}/logo.png`, sameAs: [] }),
    problems: {
      'logo-404': { action: 'Fix the broken logo link', effort: 5, impact: 'high', why: 'Engines show your logo next to brand answers and knowledge panels. A logo that 404s is dropped, so answers show a blank or another site’s image.' },
    },
  },
  WebSite: {
    importance: 'required', pageTypes: ['HOME'],
    desc: 'Site name shown in search results',
    why: 'Sets the site name Google shows above your results and that AI answers attribute quotes to.',
    doc: gdoc('site-names'),
    snippet: (c) => ld('WebSite', { name: c.brand, url: site(c) }),
  },
  Product: {
    importance: 'required', pageTypes: ['PRODUCT'],
    desc: 'Name, image, price and stock for each product',
    why: 'Shopping answers read product name, price and availability from this markup.',
    doc: gdoc('product'),
    snippet: (c) => ld('Product', { name: 'Product name', image: `${site(c)}/img/product.jpg`, brand: { '@type': 'Brand', name: c.brand }, sku: 'SKU-1' }),
    problems: {
      'review-count': { action: 'Add review counts to product ratings', effort: 15, impact: 'high', why: 'A rating without a review count fails Google’s rules, so the stars are dropped from search and shopping answers on these pages.' },
      'price-valid-until': { action: 'Update expired product prices', effort: 30, impact: 'medium', why: 'An expired price date tells engines the price may be out of date, so they’re less likely to quote it in shopping answers.' },
    },
  },
  BreadcrumbList: {
    importance: 'recommended', pageTypes: LISTINGS, effort: 60, action: 'Add breadcrumbs to products, posts and collections',
    desc: 'Where the page sits in your site',
    why: 'Shows where a page sits in your site. Helps AI understand how products and guides connect.',
    how: ['Add BreadcrumbList to the product, blog and collection templates.', 'List each level from the collection down to the page, with full https URLs.', 'Match the breadcrumb trail shown on the page.'],
    doc: gdoc('breadcrumb'),
    snippet: (c) => ld('BreadcrumbList', { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${site(c)}/` }, { '@type': 'ListItem', position: 2, name: 'Section', item: `${site(c)}/section` }] }),
    problems: {
      'http-urls': { action: 'Switch breadcrumb links to https', effort: 25, impact: 'low', why: 'Engines treat http:// and https:// as different pages, so the trail points to URLs that redirect instead of the page itself.' },
    },
  },
  Offer: {
    importance: 'recommended', pageTypes: ['PRODUCT'], impact: 'high', effort: 45, action: 'Add price, shipping and returns to product offers',
    desc: 'Price, availability, shipping and returns',
    why: 'Price and stock are what shopping answers quote first; offers with shipping and return details are eligible for merchant listings.',
    how: ['Add an Offer with price, priceCurrency and availability to each Product.', 'Add shippingDetails and hasMerchantReturnPolicy, matching your shipping and returns pages.', 'Re-run the analysis to confirm the pages pass.'],
    doc: gdoc('merchant-listing'),
    snippet: () => ld('Offer', { price: '0.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock', hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', merchantReturnDays: 30 } }),
  },
  AggregateRating: {
    importance: 'recommended', pageTypes: ['PRODUCT'], impact: 'high', effort: 30, action: 'Add star ratings to product pages',
    desc: 'Star ratings and review counts',
    why: 'Ratings are one of the first things AI shopping answers compare. Without markup, your reviews are invisible to them.',
    how: ['Add aggregateRating (ratingValue, reviewCount) to each Product.', 'Only mark up reviews that are shown on the page.', 'Pull the numbers from your reviews app so they stay current.'],
    doc: gdoc('review-snippet'),
    snippet: () => ld('AggregateRating', { ratingValue: '4.6', reviewCount: '120' }),
  },
  LocalBusiness: {
    importance: 'optional', pageTypes: ['LOCATION'],
    desc: 'Store address, hours and phone',
    why: 'Answers “where can I buy…” questions with your store address and opening hours.',
    doc: gdoc('local-business'),
    snippet: (c) => ld('LocalBusiness', { name: c.brand, url: site(c), address: { '@type': 'PostalAddress', streetAddress: '', addressLocality: '' } }),
  },
  Brand: { importance: 'optional', pageTypes: ['PRODUCT'], desc: 'The brand behind each product', why: 'Links each product back to the {brand} brand, so engines count every product mention as a brand mention.', doc: 'https://schema.org/Brand', snippet: (c) => ld('Brand', { name: c.brand }) },
  ImageObject: { importance: 'optional', pageTypes: ['PRODUCT'], desc: 'Product photos with captions', why: 'Gives image answers a caption and licence for your photos, so they can show and credit them.', doc: 'https://schema.org/ImageObject', snippet: (c) => ld('ImageObject', { contentUrl: `${site(c)}/img/photo.jpg`, caption: '' }) },
  ItemList: {
    importance: 'optional', suggest: true, pageTypes: ['CATEGORY'], impact: 'low', effort: 20, action: 'List the products on collection pages',
    desc: 'The products on a collection page',
    why: 'Lets engines read collection pages as ordered product lists. That’s the shape of “best … for …” answers.',
    how: ['Add ItemList to the collection template.', 'List the products in the order the page shows them, each with its URL.', 'Keep it to the products visible on the first page.'],
    doc: gdoc('carousel'),
    snippet: (c) => ld('ItemList', { itemListElement: [{ '@type': 'ListItem', position: 1, url: `${site(c)}/products/item` }] }),
  },
  CollectionPage: { importance: 'optional', pageTypes: ['CATEGORY'], desc: 'Marks a page as a product collection', why: 'Tells engines the page is a category, not a single product, so they read it as a list of options.', doc: 'https://schema.org/CollectionPage', snippet: () => ld('CollectionPage', { name: '' }) },
  Article: {
    importance: 'optional', suggest: true, pageTypes: POSTS, impact: 'high', effort: 30, action: 'Add authors and dates to blog posts',
    desc: 'Headline, author and dates for posts',
    why: 'Adds author and publish/update dates. AI uses these to judge freshness and expertise.',
    how: ['Add Article markup to the blog post template.', 'Fill `headline`, `author`, `datePublished` and `dateModified` from the post.', 'Re-run the analysis to confirm the posts pass.'],
    doc: gdoc('article'),
    snippet: () => ld('Article', { headline: 'Post title', author: { '@type': 'Person', name: '' }, datePublished: '', dateModified: '' }),
  },
  FAQPage: {
    importance: 'optional', suggest: true, pageTypes: ['FAQ', ...POSTS], impact: 'medium', effort: 45, action: 'Mark up the Q&As on your pages',
    desc: 'Questions and answers on a page',
    why: 'Question-and-answer pairs are the format AI answers are built from. Pages that already answer questions are easy to lift once marked up.',
    how: ['Add FAQPage markup to pages with a Q&A section.', 'Keep each answer under 60 words and identical to the visible text.', 'Don’t mark up questions that aren’t shown on the page.'],
    doc: gdoc('faqpage'),
    snippet: () => ld('FAQPage', { mainEntity: [{ '@type': 'Question', name: 'Question?', acceptedAnswer: { '@type': 'Answer', text: 'Answer.' } }] }),
  },
  Person: {
    importance: 'optional', suggest: true, pageTypes: POSTS, impact: 'medium', effort: 20, action: 'Name the experts behind each guide',
    desc: 'Authors and reviewers',
    why: 'Names the expert or writer behind each guide. Builds trust signals, above all for health and finance topics.',
    how: ['Add a Person block for each author and reviewer.', 'Include `jobTitle` and a link to their bio page.', 'Reference it from each post’s Article `author`.'],
    doc: 'https://schema.org/Person',
    snippet: () => ld('Person', { name: '', jobTitle: '' }),
  },
  VideoObject: { importance: 'optional', pageTypes: [], desc: 'How-to and product videos', why: 'Makes your videos eligible for video results; AI answers can then link to the right moment.', doc: gdoc('video'), snippet: () => ld('VideoObject', { name: '', thumbnailUrl: '', uploadDate: '' }) },
  HowTo: {
    importance: 'optional', pageTypes: [], impact: 'medium', effort: 30, action: 'Mark up the steps in how-to posts',
    desc: 'Step-by-step instructions',
    why: 'Step-by-step instructions can appear as numbered steps in AI answers.',
    how: ['Add HowTo markup to the how-to posts.', 'Give each step a short name and one sentence of text.', 'Keep the steps in the same order as the post.'],
    doc: 'https://schema.org/HowTo',
    snippet: () => ld('HowTo', { name: '', step: [{ '@type': 'HowToStep', text: 'First step.' }] }),
  },
  SearchAction: { importance: 'optional', pageTypes: [], desc: 'Your site search', why: 'Tells engines how to search your site, so they can send people straight to the right results.', doc: 'https://schema.org/SearchAction', snippet: (c) => ld('WebSite', { url: site(c), potentialAction: { '@type': 'SearchAction', target: `${site(c)}/search?q={query}`, 'query-input': 'required name=query' } }) },
  ContactPoint: { importance: 'optional', pageTypes: ['CONTACT'], desc: 'Customer service phone and email', why: 'Lets AI answer “how do I contact {brand}?” with your real phone and email.', doc: 'https://schema.org/ContactPoint', snippet: () => ld('ContactPoint', { telephone: '', contactType: 'customer service' }) },
  PostalAddress: { importance: 'optional', pageTypes: ['LOCATION'], desc: 'Store address', why: 'Gives local answers and maps your exact address.', doc: 'https://schema.org/PostalAddress', snippet: () => ld('PostalAddress', { streetAddress: '', addressLocality: '' }) },
  OpeningHoursSpecification: { importance: 'optional', pageTypes: ['LOCATION'], desc: 'Opening hours', why: 'Lets engines answer “is {brand} open now?” from your own hours.', doc: 'https://schema.org/OpeningHoursSpecification', snippet: () => ld('OpeningHoursSpecification', { dayOfWeek: [], opens: '09:00', closes: '18:00' }) },
  WebPage: { importance: 'optional', pageTypes: [], desc: 'Basic page name and description', why: 'It’s the basic description engines fall back to when a page has no other markup.', doc: 'https://schema.org/WebPage', snippet: () => ld('WebPage', { name: '', description: '' }) },
  SiteNavigationElement: { importance: 'optional', pageTypes: [], desc: 'Main menu links', why: 'Helps crawlers find your main sections, so the pages you link from the menu get found first.', doc: 'https://schema.org/SiteNavigationElement', snippet: () => ld('SiteNavigationElement', { name: '', url: '' }) },
  Event: { importance: 'optional', pageTypes: [], desc: 'Events and launches', why: 'AI and search answers can list your events with date and place.', doc: gdoc('event'), snippet: () => ld('Event', { name: '', startDate: '', location: { '@type': 'Place', name: '' } }) },
}
