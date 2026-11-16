// Report verdicts: the words, their tone, and the softer words that replaced the old critical ones.
// Reports saved before the change store their verdict as written ("Tough week", "Losing"), so every place that shows
// a verdict reads it through verdictWord(), which shows the old word as the new one.
// Tones: up = ink dot · mid = grey dot · caution = muted amber dot (var(--caution)); the label's text is never red.
export const VERDICT_RENAME = { 'Tough week': 'Slower week', 'Tough month': 'Slower month', Losing: 'Room to grow' }
export const VERDICT_TONE = {
  'Good week': 'up', 'Good month': 'up', Winning: 'up',
  Mixed: 'mid', Opportunity: 'mid',
  'Slower week': 'caution', 'Slower month': 'caution', 'Room to grow': 'caution', Dipped: 'caution',
}
export const verdictWord = (v) => (v == null ? v : VERDICT_RENAME[v] ?? v)
export const verdictTone = (v) => VERDICT_TONE[verdictWord(v)] ?? 'mid'
