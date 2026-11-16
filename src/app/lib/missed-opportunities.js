/**
 * Missed opportunities (Sentiment): the CSV of the rows as they're shown (owner, 2026-11-14). The view passes its rows
 * already filtered (engine, tone, date range, search) and in display order; this only writes them out.
 * Columns: Title · Article URL · Publication · Tone · Found date · Cited by · Reach out link · Reach out type.
 * A cell that starts like a spreadsheet formula (= + - @) gets a leading apostrophe, since titles come from the web.
 */
const TONE = { neutral: 'Neutral', mixed: 'Mixed' }
export const MISSED_CSV_HEAD = ['Title', 'Article URL', 'Publication', 'Tone', 'Found date', 'Cited by', 'Reach out link', 'Reach out type']

const cell = (v) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// rows: [{ title, url, publication, tone, found, engines: [id] (in display order), reach: { href, label } }]
// Reach out type: the button's own words (lib/publication-contacts.js reachOutFor: "Contact page", "Corrections",
// "Author page", "Reply on Trustpilot", "Find contact", …)
export function missedCsv(rows, engineName = (e) => e) {
  const lines = [MISSED_CSV_HEAD, ...(rows ?? []).map((x) => [
    x.title, x.url ?? '', x.publication, TONE[x.tone] ?? x.tone ?? '', String(x.found ?? '').slice(0, 10),
    (x.engines ?? []).map(engineName).join('; '), x.reach?.href ?? '', x.reach?.label ?? '',
  ])]
  return `${lines.map((l) => l.map(cell).join(',')).join('\r\n')}\r\n`
}

// missed-opportunities-<brand>-<YYYY-MM-DD>.csv
export const missedCsvName = (brand, day) => {
  const slug = String(brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand'
  return `missed-opportunities-${slug}-${day}.csv`
}
