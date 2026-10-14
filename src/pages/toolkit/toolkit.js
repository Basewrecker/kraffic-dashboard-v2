// Toolkit index view model: per tool, its headline result, date and next action, plus the "Needs attention" rows.
// Built from the production-shaped summaries in data/mock.js (toolkitSummaries[state]).
import { toolkitSummaries, toolkitTools } from '../../data/mock.js'

export const SECTIONS = ['Connect', 'Analyze', 'Improve', 'Report']
const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const nf = new Intl.NumberFormat('en-US')
const n = (v, one, many = `${one}s`) => `${nf.format(v)} ${v === 1 ? one : many}`

// what each tool says when it hasn't run yet (the attention sentence)
const NEVER = {
  content: 'Content Intelligence hasn’t looked for topics your site doesn’t cover yet.',
  evidence: 'Evidence Vault hasn’t collected sources for your claims yet.',
  'entity-intelligence': 'Entity & Hallucinations hasn’t checked what AI gets wrong about you yet.',
  'competitor-alerts': 'Competitor Alerts isn’t watching any competitor sites yet.',
  'action-mappings': 'Action Mappings hasn’t linked recommendations to your prompts yet.',
  experiments: 'GEO Experiment Lab hasn’t tested a change yet.',
  'executive-reports': 'Executive Reports hasn’t sent a report yet.',
}

// → { kind: 'soon' | 'connect' | 'never' | 'ok', result: { text, tone }, when, findings? }
// s.soon: the tool isn't available yet (an inert "Coming soon" row: no result, no action, doesn't open)
function summarize(t, s) {
  const muted = (text) => ({ text, tone: 'muted' })
  if (s.soon) return { kind: 'soon', result: muted('Coming soon'), when: null }
  switch (t.id) {
    case 'integrations': {
      // canConnect false: nothing to connect from here, so the row just opens the page (no Connect, no attention row)
      if (!s.connectedProviders.length) return { kind: s.canConnect === false ? 'ok' : 'connect', result: muted('Not connected'), when: null }
      return { kind: 'ok', result: { text: s.totalClicks == null ? 'Connected' : `${n(s.totalClicks, 'Google click')}` }, when: s.lastSyncAt }
    }
    case 'crm-attribution':
      if (!s.connected) return { kind: 'connect', result: muted('Not connected'), when: null }
      return { kind: 'ok', result: { text: `${n(s.totalConversions, 'sale')} from AI answers` }, when: s.lastRunAt }
    case 'executive-reports': {
      const last = s.exports[0]?.createdAt
      return last ? { kind: 'ok', result: { text: `Report sent ${fmt(last)}` }, when: last } : { kind: 'never', result: muted('Not run yet'), when: null }
    }
    default:
      if (!s.lastRunAt) return { kind: 'never', result: muted('Not run yet'), when: null }
  }
  switch (t.id) {
    case 'content': return { kind: 'ok', result: { text: n(s.totalGapsIdentified, 'topic') + ' not covered' }, when: s.lastRunAt }
    case 'evidence': return { kind: 'ok', result: { text: n(s.totalEvidenceCount, 'source') + ' linked' }, when: s.lastRunAt }
    case 'entity-intelligence':
      return s.contradictedCount
        ? { kind: 'ok', result: { text: `${n(s.contradictedCount, 'wrong claim')} about you`, tone: 'problem' }, when: s.lastRunAt }
        : { kind: 'ok', result: { text: 'No wrong claims found' }, when: s.lastRunAt }
    case 'competitor-alerts':
      return {
        kind: 'ok', when: s.lastRunAt,
        result: { text: s.unacknowledgedChanges ? n(s.unacknowledgedChanges, 'new competitor change') : n(s.totalChangesDetected, 'competitor change') },
        findings: s.unacknowledgedChanges ? `Competitor Alerts found ${n(s.unacknowledgedChanges, 'change')} since ${fmt(s.lastAcknowledgedAt)}.` : null,
      }
    case 'action-mappings': return { kind: 'ok', result: { text: `${n(s.coverageMetrics.totalActionsCount, 'action')} for ${n(s.coverageMetrics.promptsAddressedCount, 'prompt')}` }, when: s.lastRunAt }
    case 'experiments': return { kind: 'ok', result: { text: s.runningCount ? `${n(s.runningCount, 'test')} running` : n(s.concludedCount, 'test') + ' done' }, when: s.lastRunAt }
    default: return { kind: 'ok', result: { text: `Last run ${fmt(s.lastRunAt)}` }, when: s.lastRunAt }
  }
}

const CONNECT_SENTENCE = {
  integrations: 'Connect Search Console to see Google clicks next to your AI visibility.',
  'crm-attribution': 'Connect your CRM to see which sales started with an AI answer.',
}

export function toolkitView(state) {
  const sums = toolkitSummaries[state] ?? toolkitSummaries.full
  const tools = toolkitTools.map((t) => {
    const s = summarize(t, sums[t.id])
    return { ...t, ...s, when: s.when ? fmt(s.when) : null, action: s.kind === 'soon' ? null : s.kind === 'connect' ? 'Connect' : s.kind === 'never' ? 'Run' : 'Open' }
  })
  // not connected → new findings → never run; at most 3
  const attention = [
    ...tools.filter((t) => t.kind === 'connect').map((t) => ({ tool: t, sentence: CONNECT_SENTENCE[t.id], button: 'Connect' })),
    ...tools.filter((t) => t.findings).map((t) => ({ tool: t, sentence: t.findings, button: 'Review' })),
    ...tools.filter((t) => t.kind === 'never').map((t) => ({ tool: t, sentence: NEVER[t.id], button: 'Run check' })),
  ].slice(0, 3)
  return { tools, attention }
}
