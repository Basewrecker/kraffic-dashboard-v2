// "https://www.CeraVe.com/shop?x=1" → "cerave.com"
export function normalizeDomain(input) {
  return String(input ?? '').trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/\.$/, '')
}
export const isValidDomain = (d) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(d)
