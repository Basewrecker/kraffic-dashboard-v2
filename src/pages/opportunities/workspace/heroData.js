// Opportunities → Content workspace: how AI answers name brands for the prompt (pure, so node --test can run it).
//   rankGrid: per engine, the brands in the order the stored answer lists them (data/answers.js getAnswer, the Answer
//     drawer's data: position = index + 1, as the app's lib/mock-adapter.ts reads serp_data.response_snapshots); a
//     brand the scan says is named there (the row's brandsMentioned, and yours where the row says you're named) but
//     that isn't in the stored list has no position ("unranked")
//   namedSummary: one brand's place in those answers, for "Who you're up against" ("1st on 2 engines")
// The hero band that drew the full grid was removed by the owner (2026-11-04).

export const answerEngine = (e) => (e === 'google' ? 'aio' : e) // data/answers.js platform ids

// rows = engines; each: named (the row's verdict), listed brands with their position, the unranked ones, the date
export function rankGrid(row, { engines, own, ownName, getAnswer, domainOf = () => null, nameOf = (d) => d }) {
  return engines.map((engine) => {
    const answer = getAnswer(`m${row.id}`, answerEngine(engine))
    const listed = (answer?.brands ?? []).map((b, i) => {
      const domain = b.domain ?? domainOf(b.name)
      return { name: b.name, domain, position: i + 1, you: domain === own }
    })
    const named = !(row.platforms ?? []).includes(engine)
    const has = (d) => listed.some((l) => l.domain && l.domain === d)
    const unranked = (row.brandsMentioned ?? [])
      .filter((b) => b.domain !== own && b.platforms.includes(engine) && !has(b.domain))
      .map((b) => ({ name: nameOf(b.domain), domain: b.domain, position: null, you: false }))
    if (named && !has(own)) unranked.unshift({ name: ownName, domain: own, position: null, you: true })
    return { engine, named, listed, unranked, date: answer?.date ?? null, answer }
  })
}

// "Who you're up against": how AI names a brand for the prompt, in one phrase: "1st on 2 engines", else its best
// position ("2nd on ChatGPT"), else "Not named"
const ORD = ['1st', '2nd', '3rd']
export function namedSummary(grid, domain, engineName = (e) => e) {
  const at = grid.map((r) => ({ engine: r.engine, b: r.listed.find((x) => x.domain === domain) })).filter((x) => x.b)
  if (!at.length) return 'Not named'
  const firsts = at.filter((x) => x.b.position === 1).length
  if (firsts) return `1st on ${firsts} ${firsts === 1 ? 'engine' : 'engines'}`
  const best = at.reduce((a, x) => (x.b.position < a.b.position ? x : a))
  return `${ORD[best.b.position - 1] ?? `${best.b.position}th`} on ${engineName(best.engine)}`
}
