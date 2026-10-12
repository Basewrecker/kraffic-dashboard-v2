// Pure helpers for the "Platform visibility" card. Same input → same output; no copy is hardcoded per platform.

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

// Both rates are shares of all tracked prompts, so the two bars share one scale.
export function platformRates(p) {
  return {
    mentionedPct: pct(p.visible, p.total), // prompts where the platform mentions the brand
    citedPct: pct(p.cited, p.total), // prompts where it also links to the brand's site
    isZero: p.visible === 0,
  }
}

