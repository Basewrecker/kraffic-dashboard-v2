// Site Audit reference: how much each check is worth in the AI readiness score (points out of 100).
// GAP: production (apps/api/src/modules/pages) exposes no per-check weights or score formula — the checklist only
// reports pass / fail / na. These weights are the mock's; they sum to 100.
// Score = Σ weight × (pass 1 · needs work ½ · failing 0). Fixing a check adds weight × (1 − its factor).
export const CHECK_POINTS = {
  // technical
  'seo.meta_description': 11,
  'seo.image_alt': 6,
  'crawl.http_errors': 3,
  'site.llms_txt': 4,
  'seo.unique': 4,
  'seo.canonical': 2,
  'geo.ai_crawlers': 15,
  'site.sitemap': 6,
  'site.https': 5,
  // content
  'seo.headings': 6,
  'geo.direct_answers': 7,
  'geo.author_date': 5,
  'geo.question_headings': 3,
  'seo.links_out': 2,
  'geo.summary': 4,
  'seo.text_length': 5,
  // speed
  'speed.response_time': 4,
  'speed.page_weight': 4,
  'speed.render_blocking': 4,
}
export const STATUS_FACTOR = { fail: 0, warn: 0.5, pass: 1 }
