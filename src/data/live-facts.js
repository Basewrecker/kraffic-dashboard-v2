// The signed-in client's scans, set by the Reports page after they load. While this is set, a report is
// written only from it. Sample brands stay in the preview data and are not listed.
let facts = null
const listeners = new Set()

export function setLiveFacts(next) {
  facts = next
  listeners.forEach((fn) => fn())
}

export function liveFacts() {
  return facts
}

export function subscribeLiveFacts(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// The fields the composer reads (engines that ran, tracked competitors). No invented head-to-head.
export function liveDataset(brandId) {
  const f = facts
  if (!f || f.brandId !== brandId) return null
  return { ran: f.ran, rivals: f.competitors, prompts: f.prompts, name: f.name, h2h: {}, missing: {} }
}
