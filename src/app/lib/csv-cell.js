// One CSV cell for every export (security review 2026-11-04). Spreadsheets run a cell that starts with = + - @, tab or
// CR as a formula, and prompt texts, page titles and domains come from users and third-party pages. Such a cell gets
// a leading ' so it opens as text. Plain numbers (-3, +15, 12.5%) stay numbers. A cell is quoted when it holds a
// comma, a quote or a line break, with quotes doubled.
const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?%?$/

export function csvCell(value) {
  let s = String(value ?? '')
  if (typeof value !== 'number' && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const csvLine = (cells) => cells.map(csvCell).join(',')
