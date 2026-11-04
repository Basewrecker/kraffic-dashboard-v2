// Shared matcher cases: the mock's data/gscMatch.js and the app's lib/gsc-match.js must both pass these (the app copies
// src/ into components/mock, so its test can import this file). Owner's rule, 2026-11-04: a query is eligible as Best
// only with at least half of the prompt's specific (intent) words, minimum 1; eligible queries rank by how many intent
// words they have, then by impressions; a word opposite to the prompt's (dry/oily, cheap/expensive/luxury, men/women,
// beginner/advanced, small/large) disqualifies a query. Rows are gsc_keywords-shaped; made-up data.
const u = (path) => `https://example-brand.com${path}/`
export const GSC_SHARED_CASES = [
  {
    name: '"best face mist for dry skin" picks a "dry skin" query, never an "oily skin" one',
    prompt: 'best face mist for dry skin',
    // the same rows as the app's test fixture (lib/gsc-match.js), so both matchers check one case
    rows: [
      { keyword: 'face mist', impressions: 9000, clicks: 140, position: 9.1, url: u('/products/face-mist') },
      { keyword: 'best face mist', impressions: 6000, clicks: 90, position: 7.4, url: u('/blog/best-face-mists') },
      { keyword: 'face mist for oily skin', impressions: 4000, clicks: 60, position: 6.2, url: u('/oily') },
      { keyword: 'hydrating face mist', impressions: 3000, clicks: 40, position: 8.0, url: u('/products/hydrating-mist') },
      { keyword: 'face mist for dry skin', impressions: 120, clicks: 3, position: 11.8, url: u('/dry') },
      { keyword: 'face mist dry skin overnight', impressions: 60, clicks: 1, position: 14.0, url: u('/dry') },
    ],
    best: 'face mist for dry skin',
    publishOn: '/dry',
    bestIncludes: 'dry skin',
    never: ['face mist for oily skin'],
  },
]
