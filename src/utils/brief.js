import { brandName } from './brand'

// Builds a content brief (structured + markdown) for one or more missed prompts.
export function buildBrief(rows, account) {
  const competitors = [...new Set(rows.flatMap((r) => r.competitors))]
  const seen = new Set()
  const sources = rows.flatMap((r) => r.sources).filter((s) => {
    const k = s.domain + s.path
    return seen.has(k) ? false : seen.add(k)
  }).slice(0, 8)
  const angles = [...new Set(rows.map((r) => r.angle))]
  const topics = [...new Set(rows.map((r) => r.topic))]

  const title = rows.length === 1 ? `Brief: ${rows[0].prompt}` : `Brief: ${rows.length} prompts (${topics.join(', ')})`
  const md = [
    `# ${title}`,
    '',
    `Brand: ${account.name} (${account.domain})`,
    '',
    `## Target prompt${rows.length > 1 ? 's' : ''}`,
    ...rows.map((r) => `- ${r.prompt}: ${r.briefLine ?? `missed for ${r.streak} sync${r.streak === 1 ? '' : 's'}`} (${r.topic})`),
    '',
    '## Competitors to beat',
    ...(competitors.length ? competitors.map((d) => `- ${brandName(d)} (${d})`) : ['- No brand is cited yet: first to publish a clear answer wins.']),
    '',
    '## Sources to outrank',
    ...sources.map((s) => `- https://${s.domain}${s.path}`),
    '',
    '## Suggested angle',
    ...angles.map((a) => `- ${a}`),
    '',
  ].join('\n')

  return { title, prompts: rows.map((r) => r.prompt), competitors, sources, angles, md }
}
