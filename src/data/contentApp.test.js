import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cmsLinkFor, detectFormatsOnPage, pageSourceLabel, regenStateOf, regenerate, restoreDraft, saveDraftEdit, verifyStateOf, verifyWait, withEdit, yourDataOf } from './contentApp.js'

test('page source: Your pick · From Search Console · Suggested from your site · New page we suggest', () => {
  assert.equal(pageSourceLabel({ source: 'pick', action: 'update' }), 'Your pick')
  assert.equal(pageSourceLabel({ source: 'sc', action: 'create' }), 'From Search Console')
  assert.equal(pageSourceLabel({ source: 'route', action: 'update' }), 'Suggested from your site')
  assert.equal(pageSourceLabel({ source: 'route', action: 'create' }), 'New page we suggest')
})

test('CMS link: WordPress / Shopify admin, else the live page, nothing for a new page on an unknown CMS', () => {
  assert.deepEqual(cmsLinkFor({ cms: 'wordpress', domain: 'a.com', url: 'https://a.com/blog/serum/' }), { label: 'Open page in CMS', href: 'https://a.com/wp-admin/edit.php?post_type=any&s=serum' })
  assert.equal(cmsLinkFor({ cms: 'wordpress', domain: 'a.com', url: 'https://a.com/new', action: 'create' }).label, 'Open CMS')
  assert.deepEqual(cmsLinkFor({ cms: 'shopify', domain: 'a.com', url: 'https://a.com/x' }), { label: 'Open page in CMS', href: 'https://a.com/admin/' })
  assert.deepEqual(cmsLinkFor({ cms: null, domain: 'a.com', url: 'https://a.com/x' }), { label: 'Open page', href: 'https://a.com/x' })
  assert.equal(cmsLinkFor({ cms: null, domain: 'a.com', url: 'https://a.com/x', action: 'create' }), null)
})

test('Verify: 60% of the key sentences = found; some = partial; none = not found; a failed open = error', () => {
  assert.equal(verifyStateOf(null).kind, 'idle')
  assert.equal(verifyStateOf({ checking: true }).kind, 'running')
  assert.equal(verifyStateOf({ check: { ok: true, found: 3, total: 5 } }).kind, 'found')
  assert.equal(verifyStateOf({ check: { ok: true, found: 2, total: 5 } }).kind, 'partial')
  assert.equal(verifyStateOf({ check: { ok: true, found: 0, total: 5 } }).kind, 'notfound')
  assert.deepEqual(verifyStateOf({ check: { ok: false, why: 'No' }, at: 1 }), { kind: 'error', why: 'No', at: 1 })
  assert.equal(verifyWait(1000, 11_000), 20_000, 'Check again once per 30s')
  assert.equal(verifyWait(1000, 40_000), 0)
})

test('Your data as sent: key facts and answers left out while hidden', () => {
  const d = yourDataOf({ uploads: [1], facts: [{ label: 'a', value: 'b' }], questions: [{ id: 'q', answer: 'yes' }] })
  assert.deepEqual(d.facts, [])
  assert.equal(d.questions[0].answer, '')
  assert.deepEqual(d.uploads, [1])
})

test('an edited draft: its formats by the draft check’s rules', () => {
  const ids = detectFormatsOnPage({ title: 'Best serums', headings: ['Best options for dry skin', 'Key statistics', 'FAQ'], mainText: '1. **Option**: who it suits.\n- **42%**: of users (source, 2025).' })
  assert.ok(ids.includes('listicle') && ids.includes('stats') && ids.includes('faq'))
  assert.deepEqual(detectFormatsOnPage({ title: 'x' }), [], 'too short to judge')
})

test('hand edits and Regenerate: the edit shows until restored or regenerated (asked first)', async () => {
  const res = { prompt: 'Best serum', contentMarkdown: '# A' }
  saveDraftEdit('Best serum', '# B')
  assert.equal(withEdit(res).contentMarkdown, '# B')
  assert.equal(withEdit(res).editedBy, 'you')
  assert.equal(regenerate('Best serum', { confirm: () => false }), false, 'declined: the edit stays')
  assert.equal(regenerate('best serum ', { confirm: () => true, ms: 5 }), true)
  assert.equal(regenStateOf('Best serum').running, true)
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(regenStateOf('Best serum').running, false)
  assert.ok(regenStateOf('Best serum').done.at)
  assert.equal(withEdit(res).contentMarkdown, '# A', 'the new draft replaces the edit')
  saveDraftEdit('Best serum', '# C'); restoreDraft('Best serum')
  assert.equal(withEdit(res).contentMarkdown, '# A')
})
