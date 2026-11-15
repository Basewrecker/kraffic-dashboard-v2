// Mock stand-in for the app's lib/publication-contacts-client.js (synced 2026-11-15). In the app this reads the saved
// contact lookups for the Opportunities rows and asks its server to find the missing ones. Here a few sample lookups
// (invented addresses on the sample publications) arrive after a short wait, so the Reach out buttons show each of
// their states: a bundled contact, a found contact page, an author page, and "Find contact".
import { useEffect, useState } from 'react'

const bare = (d) => String(d || '').toLowerCase().replace(/^www\./, '')
// keyed as the app's API answers: contacts by publication domain, authors by the cited page's address
const SAMPLE = {
  contacts: {
    'incidecoder.com': { contactUrl: 'https://incidecoder.com/contact', kind: 'contact', status: 'found' },
    'skincarisma.com': { contactUrl: 'https://www.skincarisma.com/corrections', kind: 'corrections', status: 'found' },
    'theskincareedit.com': { contactUrl: 'https://theskincareedit.com/tips', kind: 'tips', status: 'found' },
    'dermstore.com': { contactUrl: 'https://www.dermstore.com/press', kind: 'press', status: 'found' },
    'cosmopolitan.com': { contactUrl: 'https://www.cosmopolitan.com/about/a26950060/contact-us/', kind: 'editorial', status: 'found' },
  },
  authors: {
    'https://www.glamour.com/story/best-moisturizers-for-dry-skin?fbclid=IwAR0x': { authorUrl: 'https://www.glamour.com/contributor/sample-author', authorName: 'Sample Author', status: 'found' },
    'https://www.newbeauty.com/dermasuri-barrier-cream-review/': { authorUrl: 'https://www.newbeauty.com/author/sample-author/', authorName: 'Sample Author', status: 'found' },
  },
}
export const foundFor = (found, row) => ({ contact: found?.contacts?.[bare(row?.domain)] ?? null, author: row?.url ? found?.authors?.[row.url] ?? null : null })
export function usePublicationContacts(domainUrl, rows) {
  const [found, setFound] = useState({ contacts: {}, authors: {} })
  useEffect(() => { const t = setTimeout(() => setFound(SAMPLE), 900); return () => clearTimeout(t) }, [domainUrl, rows?.length])
  return found
}
