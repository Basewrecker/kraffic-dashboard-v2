// Run with: npm test. Brand names in Share of voice's list and the account picker (owner, 2026-11-02): the name Brand
// Setup holds; a tidied domain only when no name is set (ported from the app's lib/citation-rules.js brandListName).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { brandListName, brandName, cleanDomainName, displayName } from './brand.js'

test('a competitor\'s display name: never a slug or a name built from its domain (Mentions and citations drawer)', () => {
  assert.equal(displayName({ name: 'Longbridge-financial', domain: 'longbridge-financial.com' }), 'Longbridge Financial')
  assert.equal(displayName({ name: '', domain: 'longbridge-financial.com' }), 'Longbridge Financial')
  assert.equal(displayName({ name: 'longbridge-financial.com', domain: 'longbridge-financial.com' }), 'Longbridge Financial')
  assert.equal(displayName({ name: 'Paula’s Choice', domain: 'paulaschoice.com' }), 'Paula’s Choice', 'a real name is kept as written')
  assert.equal(displayName(null), '')
  // the drawer's Compare with chips, its tooltip and CSV, and the "now X shows instead" rows all read it
  const drawer = readFileSync(new URL('../components/answer/WeekHistoryDrawer.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(drawer, /\{b\.name\}|\{rival\.name\}|\$\{rival\.name\}/)
  assert.match(drawer, /\{displayName\(b\)\}/)
  const changes = readFileSync(new URL('../data/syncChanges.js', import.meta.url), 'utf8')
  assert.match(changes, /now \$\{displayName\(instead\)\} shows instead/)
})

test('list names: Brand Setup\'s name; a domain or the domain\'s slug counts as no name → the domain tidied', () => {
  assert.equal(brandListName(['Longbridge Financial'], 'longbridge-financial.com'), 'Longbridge Financial')
  assert.equal(brandListName(['Longbridge-financial'], 'longbridge-financial.com'), 'Longbridge Financial')
  assert.equal(brandListName([], 'longbridge-financial.com'), 'Longbridge Financial')
  assert.equal(brandListName(['rocketmortgage'], 'rocketmortgage.com'), 'Rocketmortgage')
  assert.equal(brandListName([''], 'rocketmortgage.com'), 'Rocketmortgage', 'no word split without a name')
  assert.equal(brandListName(['financeofamerica.com'], 'financeofamerica.com'), 'Financeofamerica')
  assert.equal(brandListName(['financeofamerica.com', 'Finance of America'], 'financeofamerica.com'), 'Finance of America')
  assert.equal(brandListName([null, 'Rocket Mortgage'], 'rocketmortgage.com'), 'Rocket Mortgage')
  assert.equal(brandListName(['CeraVe'], 'cerave.com'), 'CeraVe', 'a real name is kept as written')
  assert.equal(brandListName([], 'www.reverse.mortgage'), 'Reverse')
  assert.equal(brandListName(['Brand X'], null), 'Brand X', 'a name-only brand')
  assert.equal(brandListName([], null), '')
})

test('the tidied domain matches the chart\'s brandName for a brand with no name set', () => {
  for (const d of ['byoma.com', 'versedskin.com', 'good-molecules.com', 'shop.renpho.co.uk']) assert.equal(cleanDomainName(d), brandName(d), d)
})
