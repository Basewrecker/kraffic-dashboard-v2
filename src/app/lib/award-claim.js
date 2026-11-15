// What counts as an AWARD claim on Website facts (AUD-018). An ordinary "best" phrase in marketing copy ("the best way
// to find a home", "Best price guarantee", "best in class service") is not an award; an award is something an outside
// body gave: "Voted Best Reverse Mortgage Lender 2026 by Money" (a title-case name ending in a year, with an award word
// or a publisher beside it), or words that say it was won, awarded, named or ranked ("named one of the best places to
// work", "award-winning"). A bare verb is not enough: "won", "listed", "named", "recognized", "ranking", "voted" are
// everyday words ("we won't charge a fee", "listed below", "ranking factors"); each counts only when what follows it
// names an award, a rank or a superlative. Pure: no React, no window.

// the thing a verb of recognition is followed by that makes it an award: a superlative, a rank, an award word
const GIVEN = String.raw`(?:as\s+|by\s+[^.\n]{1,40}?\s+as\s+)?(?:one\s+of\s+)?(?:the\s+|a\s+|an\s+)?(?:#\s?\d+|no\.?\s?\d+|number\s+(?:one|\d+)|top\b|best\b|leading\b|finest\b|fastest\b|most\s+(?:trusted|innovative|admired|popular|loved)\b|award|winner|finalist)`

// words that assert something was given or earned by someone
const ASSERT = new RegExp(
  [
    String.raw`\b(?:awards?|awarded|award[- ]winning|winners?|finalists?|prizes?|certified\s+as)\b`,
    String.raw`\bhonou?red\s+(?:with|as)\b`,
    // won: "won the Best … award", never "won't" or a bare "won"
    String.raw`\b(?:won|wins|winning)(?!['’]t)\s+(?:the\s+|a\s+|an\s+|our\s+|its\s+)?(?:[\w'’&-]+\s+){0,3}?(?:award|prize|trophy|title|medal|honou?rs?|best\b|first\s+place|gold|silver|bronze)`,
    // named / voted / listed / recognized / selected + a superlative or rank (not a bare verb)
    String.raw`\b(?:named|voted|listed|recogni[sz]ed|selected|chosen)\s+${GIVEN}`,
    String.raw`\blisted\s+(?:among|in|on)\s+(?:the\s+)?(?:top\b|best\b|fastest\b|#\s?\d+|inc\.?\s?5000|fortune\b|forbes\b)`,
    String.raw`\brecogni[sz]ed\s+(?:for|by)\b[^.\n]{0,60}\b(?:award|best|top|winner)`,
    // ranked / ranking: "ranked #1", "ranked among the top", "top-ranked"; never "ranking factors"
    String.raw`\b(?:ranked|ranks)\s+(?:#\s?\d+|no\.?\s?\d+|number\s+(?:one|\d+)|first\b|top\b|among\b|in\s+the\s+top\b|(?:the\s+)?(?:best|top)\b)`,
    String.raw`\btop[- ]ranked\b`,
  ].join('|'),
  'i',
)
// a body that gives awards, which makes a titled "Best … 2026" a real award (case-sensitive: TIME, Money are also words)
const PUBLISHER = /\b(?:TIME|Forbes|Fortune|Inc\.?\s?5000|Newsweek|U\.?S\.?\s+News|J\.?D\.?\s+Power|Consumer\s+Reports|Glassdoor|Great\s+Place\s+to\s+Work|Stevie|Webby|Gartner|Capterra|Trustpilot|BBB|Better\s+Business\s+Bureau)\b|\bMoney(?:\.com|\s+magazine|['’]s|:|\s+(?=Best\b))/
// a title-case "Best <Name> <year>": the name of an award list, not a sentence about the brand
const TITLED_BEST_YEAR = /\bBest(?:\s+[A-Z][\w&'’.-]*)+\s+(?:19|20)\d{2}\b/

const flat = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
/** The text of a claim states an actual award (the whole claim text, quote or value). A titled "Best … 2026" counts only
 *  with an award word or a publisher in the same text. */
export function assertsAward(text) {
  const t = flat(text)
  if (!t) return false
  return ASSERT.test(t) || (TITLED_BEST_YEAR.test(t) && PUBLISHER.test(t))
}

/** A regex match at `index` in `body` stands near wording that says it was won, awarded, named or ranked (±80 chars), or
 *  in the same sentence as a publisher that gives awards (a publisher in the next sentence belongs to something else). */
export function nearAssertion(body, index, length = 0) {
  const s = String(body ?? '')
  const end = index + length
  if (ASSERT.test(s.slice(Math.max(0, index - 80), Math.min(s.length, end + 80)))) return true
  const before = s.slice(0, index).split(/[.!?\n]/).pop()
  const after = s.slice(end).split(/[.!?\n]/)[0]
  return PUBLISHER.test(`${before}${s.slice(index, end)}${after}`)
}

/** The field a stored or extracted claim is shown under: 'award' only with an actual award assertion, in the claim's quote,
 *  its value, or the snippet of the site page it was read from (`snippet`: the sentence around it), or when a publisher's award
 *  page was stored as its outside evidence (`awardPage`). A fact the person added
 *  themselves keeps what they chose. */
export function awardFieldOf({ field, value, quote = '', snippet = '', awardPage = false, status = '' }) {
  if (field !== 'award' || status === 'ADDED_BY_YOU') return field
  // awardPage: the outside check stored a publisher's award page for it (source type AWARD_PAGE)
  if (awardPage) return 'award'
  return assertsAward(quote) || assertsAward(value) || assertsAward(snippet) ? 'award' : 'claim'
}
