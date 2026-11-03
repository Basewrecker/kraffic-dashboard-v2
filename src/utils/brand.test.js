// Run with: npm test. Brand names in Share of voice's list and the account picker (owner, 2026-11-02): the name Brand
// Setup holds; a tidied domain only when no name is set (ported from the app's lib/citation-rules.js brandListName).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brandListName, brandName, cleanDomainName } from './brand.js'

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
