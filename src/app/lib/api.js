// Mock stand-in for the app's lib/api.ts (synced 2026-11-15): the app's one way to call its server. Here it is a small
// fake server, in this browser tab only, for the calls the copied pages make. Nothing leaves the page.
//   GET  /website-facts            the sample facts and pages (src/data/websiteFacts.js)
//   POST /website-facts            confirm · reject · add · refresh (a read takes 2.4s and returns the same data)
//   GET  /content/cms              no CMS known (Fact Check's "Fix this one" then opens the live page)
import { account } from '../../data/mock.js'
import { sampleFacts, samplePages } from '../../data/websiteFacts.js'

const wait = (ms, value) => new Promise((done) => setTimeout(() => done(value), ms))
const facts = sampleFacts(account.domain, account.name)
const pages = samplePages(account.domain)
let added = 0
const body = () => ({ domainUrl: `https://${account.domain}`, brandName: account.name, facts: facts.map((f) => ({ ...f })), pages, pagesRead: pages.filter((p) => p.ok).length, pagesTried: pages.length })

export const viewedUserId = () => null
export async function apiClient(path, options = {}) {
  const route = String(path).split('?')[0]
  if (route === '/content/cms') return wait(120, { error: 'not available in the mock' })
  if (route !== '/website-facts') throw Object.assign(new Error(`The mock has no route ${route}`), { statusCode: 404 })
  if ((options.method ?? 'GET') === 'GET') return wait(150, body())
  const p = JSON.parse(options.body ?? '{}')
  if (p.action === 'refresh') return wait(2400, body())
  if (p.action === 'confirm' || p.action === 'reject') {
    const f = facts.find((x) => String(x.id) === String(p.factId))
    if (f) f.status = p.action === 'confirm' ? 'CONFIRMED' : 'REJECTED'
    return wait(180, { ok: true })
  }
  if (p.action === 'add') {
    const fact = { id: `added-${(added += 1)}`, category: p.category, field: p.field, value: p.value, status: 'ADDED_BY_YOU', source: 'YOU', notes: null, evidence: [] }
    facts.push(fact)
    return wait(220, { fact })
  }
  throw Object.assign(new Error(`The mock doesn't know the action ${p.action}`), { statusCode: 400 })
}
// the sample data as the GET returns it, for a first draw with no loading flash (the app loads before it draws the page)
export const sampleFactCheck = body
