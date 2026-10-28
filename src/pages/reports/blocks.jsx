import { useLayoutEffect, useRef, useState } from 'react'

// The report's fixed block library, written as an analyst memo: type, spacing and hairlines only (no cards, icons,
// pills or badges). Red only for what's going against the brand. `print`: the A4 view (smaller type, tighter spacing).
export const t2 = 'text-stone-600'
export const t3 = 'text-stone-500'
const AUDIENCE = { team: 'For the team', ceo: 'For the CEO', client: 'For the client' }
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')
const TONE = {
  you: 'var(--ink)',
  'you-soft': 'color-mix(in srgb, var(--ink) 55%, transparent)',
  'you-faint': 'color-mix(in srgb, var(--ink) 20%, transparent)',
  against: 'var(--negative)',
  'against-soft': 'color-mix(in srgb, var(--negative) 45%, transparent)',
  none: 'color-mix(in srgb, var(--ink) 7%, transparent)',
}
const isAgainst = (tone) => tone?.startsWith('against')

function H2({ children, sub, print }) {
  return (
    <div className={print ? 'mb-1.5' : 'mb-3'}>
      <h2 className={`${print ? 'text-[12px] leading-4' : 'text-[16px] leading-6'} font-semibold text-stone-900`}>{children}</h2>
      {sub && <p className={`${print ? 'text-[10px] leading-3' : 'text-[13px] leading-[18px]'} ${t3}`}>{sub}</p>}
    </div>
  )
}

function Headline({ data: d, title, print }) {
  return (
    <header>
      <p className={`${print ? 'text-[10px] leading-4' : 'text-[13px] leading-[18px]'} ${t3} tabular-nums`}>
        {d.brand} · {d.period} · {d.engines} · {AUDIENCE[d.audience]}
      </p>
      <p className={`mt-1 ${print ? 'text-[11px]' : 'text-[14px]'} ${t2}`}>{title}</p>
      <h1 className={`mt-3 ${print ? 'text-[19px] leading-[26px]' : 'text-[30px] leading-[38px] max-md:text-[23px] max-md:leading-[30px]'} max-w-[30ch] font-semibold tracking-[-0.02em] text-stone-900 [text-wrap:balance]`}>{d.text}</h1>
    </header>
  )
}

function Lede({ data: d, print }) {
  return <p className={`${print ? 'text-[12px] leading-[18px]' : 'text-[17px] leading-[28px] max-md:text-[16px] max-md:leading-[26px]'} max-w-[64ch] text-stone-800 tabular-nums [text-wrap:pretty]`}>{d.text}</p>
}

// ---- hero: every prompt as one square, grouped (who AI names / what moved)
function Grid({ d, print }) {
  const s = print ? 7 : 11
  const gap = print ? 2 : 3
  return (
    <div>
      <H2 print={print}>{d.title}</H2>
      <div className={`flex flex-wrap items-start ${print ? 'gap-x-5 gap-y-3' : 'gap-x-9 gap-y-6'}`}>
        {d.groups.filter((g) => g.n > 0).map((g) => (
          <figure key={g.label} className="m-0">
            <figcaption className={`mb-1.5 flex items-baseline gap-2 ${print ? 'text-[10px]' : 'text-[13px] leading-[18px]'}`}>
              <span className={isAgainst(g.tone) ? 'text-negative' : 'text-stone-700'}>{g.label}</span>
              <span className={`font-semibold tabular-nums ${isAgainst(g.tone) ? 'text-negative' : 'text-stone-900'}`}>{g.n}</span>
            </figcaption>
            <div role="img" aria-label={`${g.label}: ${g.n} prompts`} className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(10, g.n)}, ${s}px)`, gap }}>
              {Array.from({ length: g.n }, (_, i) => <span key={i} style={{ width: s, height: s, borderRadius: print ? 1 : 2, background: TONE[g.tone] }} />)}
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}

// ---- hero: share of voice, start → now, one line per brand (a competitor gaining on you is red)
function Slope({ d, print }) {
  const box = useRef(null)
  const [w, setW] = useState(640)
  useLayoutEffect(() => {
    if (!box.current) return
    setW(box.current.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const narrow = w < 520
  const H = print ? 150 : 232
  const top = Math.ceil(Math.max(...d.rows.flatMap((r) => [r.from, r.now])) / 10) * 10
  const pad = { t: 10, b: 10 }
  const x1 = 40
  const x2 = narrow ? w - 150 : Math.min(w - 230, 380)
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b)
  // labels never overlap: nudge apart, keeping order
  const place = (key) => {
    const rows = [...d.rows].sort((a, b) => b[key] - a[key]).map((r) => ({ r, y: y(r[key]) }))
    const min = print ? 10 : 15
    for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < min) rows[i].y = rows[i - 1].y + min
    return Object.fromEntries(rows.map((x) => [x.r.key, x.y]))
  }
  const L = place('from')
  const R = place('now')
  const color = (r) => (r.you ? 'var(--ink)' : r.now > r.from ? 'var(--negative)' : 'var(--color-stone-400)')
  const fs = print ? 9 : 12
  const lastY = Math.max(...Object.values(R), ...Object.values(L))
  return (
    <div>
      <H2 print={print} sub={d.sub}>{d.title}</H2>
      <div ref={box}>
        <svg width={w} height={Math.max(H, lastY + 8)} role="img" aria-label={`${d.title}, ${d.sub}`} className="block max-w-full overflow-visible">
          <line x1={x1} x2={x1} y1={0} y2={H} stroke="var(--div)" />
          <line x1={x2} x2={x2} y1={0} y2={H} stroke="var(--div)" />
          {[...d.rows].sort((a) => (a.you ? 1 : -1)).map((r) => (
            <g key={r.key}>
              <line x1={x1} x2={x2} y1={y(r.from)} y2={y(r.now)} stroke={color(r)} strokeWidth={r.you ? 2.5 : 1.25} strokeLinecap="round" />
              <circle cx={x1} cy={y(r.from)} r={r.you ? 3 : 2} fill={color(r)} />
              <circle cx={x2} cy={y(r.now)} r={r.you ? 3.5 : 2.25} fill={color(r)} />
              <text x={x1 - 8} y={L[r.key] + 4} textAnchor="end" fontSize={fs} fill={r.you ? 'var(--color-stone-900)' : 'var(--color-stone-500)'} fontWeight={r.you ? 600 : 400} className="tabular-nums">
                {r.from}%
              </text>
              <text x={x2 + 8} y={R[r.key] + 4} fontSize={fs} fill={r.you ? 'var(--color-stone-900)' : r.now > r.from ? 'var(--negative)' : 'var(--color-stone-600)'} fontWeight={r.you ? 600 : 400} className="tabular-nums">
                {r.now}%  <tspan fill={r.you ? 'var(--color-stone-900)' : 'var(--color-stone-600)'}>{r.name}</tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
function Hero({ data: d, print }) {
  return d.kind === 'slope' ? <Slope d={d} print={print} /> : <Grid d={d} print={print} />
}

// ---- where: grouped by theme; the top 3 themes, each with its top 3 prompts and "+N more"
function Themes({ themes, against, print }) {
  const shown = themes.slice(0, 3)
  const rest = themes.slice(3)
  return (
    <ul className="divide-y divide-[var(--div)] border-y border-[var(--div)]">
      {shown.map((th) => (
        <li key={th.theme} className={print ? 'py-1' : 'py-2.5'}>
          <div className={`flex items-baseline justify-between gap-3 ${print ? 'text-[11px]' : 'text-[14px] leading-5'}`}>
            <span className="font-medium text-stone-900">{th.theme}</span>
            <span className={`shrink-0 tabular-nums ${against ? 'font-medium text-negative' : 'text-stone-700'}`}>{th.n} {th.n === 1 ? 'prompt' : 'prompts'}</span>
          </div>
          <p className={`mt-0.5 ${print ? 'text-[10px] leading-[14px]' : 'text-[13px] leading-5'} ${t2}`}>
            {th.prompts.slice(0, 3).map((p, i) => <span key={p}>{i > 0 && <span className={t3}> · </span>}{p}</span>)}
            {th.n > Math.min(3, th.prompts.length) && <span className={t3}> · +{th.n - Math.min(3, th.prompts.length)} more</span>}
          </p>
        </li>
      ))}
      {rest.length > 0 && <li className={`${print ? 'py-1 text-[10px]' : 'py-2 text-[13px]'} ${t3}`}>+{rest.length} more {rest.length === 1 ? 'theme' : 'themes'}, {rest.reduce((a, x) => a + x.n, 0)} prompts</li>}
    </ul>
  )
}
function Where({ data: d, print }) {
  const groups = d.groups.filter((g) => g.themes?.length)
  return (
    <div>
      <H2 print={print} sub={d.sub}>{d.title}</H2>
      <div className={`grid ${groups.length > 1 ? (print ? 'grid-cols-2 gap-5' : 'gap-8 md:grid-cols-2') : ''}`}>
        {groups.map((g) => (
          <div key={g.label ?? 'all'}>
            {g.label && <p className={`mb-1 ${print ? 'text-[10px]' : 'text-[13px] leading-[18px]'} font-medium ${g.against ? 'text-negative' : 'text-stone-700'}`}>{g.label}</p>}
            <Themes themes={g.themes} against={g.against} print={print} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- by engine: what moved where (or, in a competitor memo, where they win)
function Engines({ data: d, print }) {
  const cell = print ? 'py-1' : 'py-2'
  const rival = d.rows[0]?.against != null
  return (
    <div>
      <H2 print={print}>{d.title}</H2>
      <table className={`w-full border-y border-[var(--div)] ${print ? 'text-[11px]' : 'text-[14px]'} tabular-nums`}>
        <thead>
          <tr className={`${t3} ${print ? 'text-[10px]' : 'text-[12px]'} text-left`}>
            <th className={`${cell} font-medium`}>Engine</th>
            {rival ? <th className={`${cell} text-right font-medium`}>Prompts they win</th> : <><th className={`${cell} text-right font-medium`}>Won</th><th className={`${cell} text-right font-medium`}>Lost</th><th className={`${cell} text-right font-medium`}>In the answer now</th></>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
          {d.rows.map((e) => (
            <tr key={e.name}>
              <td className={`${cell} text-stone-900`}>{e.name}</td>
              {rival
                ? <td className={`${cell} text-right font-medium text-negative`}>{e.against}</td>
                : <><td className={`${cell} text-right text-stone-900`}>{e.won}</td><td className={`${cell} text-right ${e.lost ? 'font-medium text-negative' : t3}`}>{e.lost}</td><td className={`${cell} text-right ${t2}`}>{e.now}%</td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Why({ data: d, print }) {
  return (
    <div>
      <H2 print={print}>{d.title}</H2>
      <div className={`flex flex-col ${print ? 'gap-1.5' : 'gap-4'}`}>
        {d.items.map((x) => (
          <div key={x.title} className="max-w-[68ch]">
            <p className={`${print ? 'text-[11px] leading-4' : 'text-[15px] leading-[22px]'} font-semibold text-stone-900`}>{x.title}</p>
            <p className={`mt-0.5 ${print ? 'text-[10px] leading-[14px]' : 'text-[14px] leading-[22px]'} ${t2}`}>{x.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Changed({ data: d, print }) {
  const cell = print ? 'py-1' : 'py-2'
  return (
    <div>
      <H2 print={print}>What changed</H2>
      <table className={`w-full border-y border-[var(--div)] ${print ? 'text-[11px]' : 'text-[14px]'} tabular-nums`}>
        <thead>
          <tr className={`${t3} ${print ? 'text-[10px]' : 'text-[12px]'} text-left`}>
            <th className={`${cell} font-medium`}>Measure</th><th className={`${cell} text-right font-medium`}>{d.since}</th>
            <th className={`${cell} text-right font-medium`}>Now</th><th className={`${cell} text-right font-medium`}>Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
          {d.rows.map((r) => {
            const ch = r.delta ?? r.now - r.before
            return (
              <tr key={r.label}>
                <td className={`${cell} pr-3 text-stone-900`}>{r.label}</td>
                <td className={`${cell} text-right ${t2}`}>{r.before}</td>
                <td className={`${cell} text-right font-semibold text-stone-900`}>{r.now}</td>
                <td className={`${cell} text-right ${ch < 0 ? 'font-medium text-negative' : t2}`}>{signed(ch)}{r.delta != null ? ' pts' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- what to do: specific, numbered, each tied to the prompts it would win back
function Next({ data: d, print }) {
  return (
    <div>
      <H2 print={print}>{d.title}</H2>
      <ol className={`flex flex-col ${print ? 'gap-1.5' : 'gap-4'}`}>
        {d.items.map((a, i) => (
          <li key={a.text} className={`grid ${print ? 'grid-cols-[14px_1fr] gap-x-1.5' : 'grid-cols-[24px_1fr] gap-x-2'}`}>
            <span className={`${print ? 'text-[11px] leading-4' : 'text-[15px] leading-[22px]'} font-semibold text-stone-900 tabular-nums`}>{i + 1}.</span>
            <span className="min-w-0 max-w-[68ch]">
              <span className={`block ${print ? 'text-[11px] leading-4' : 'text-[15px] leading-[22px]'} font-semibold text-stone-900`}>{a.text}</span>
              <span className={`mt-0.5 block ${print ? 'text-[10px] leading-[14px]' : 'text-[14px] leading-[22px]'} ${t2}`}>
                {d.decide ? 'Would win back' : 'Wins back'} up to <span className="font-medium text-stone-900 tabular-nums">{a.wins.n} prompts</span>: {a.wins.prompts.slice(0, 3).join(' · ')}{a.wins.n > Math.min(3, a.wins.prompts.length) ? <span className={t3}> · +{a.wins.n - Math.min(3, a.wins.prompts.length)} more</span> : null}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Sources({ data: d, print }) {
  return (
    <footer className={`border-t border-[var(--div)] ${print ? 'pt-1.5 text-[9px] leading-[13px]' : 'pt-4 text-[12px] leading-[18px]'} ${t3}`}>
      <p className="max-w-[80ch]">Sources: Kraffic AI visibility data (tracked prompts, AI answers and their citations) from {d.syncs} syncs, {d.from} – {d.to}, 2026. Engines counted: {d.engines.join(', ') || 'none'}.</p>
      {d.left.length > 0 && <p className="mt-1 max-w-[80ch]">Not in this report: {d.left.join(' ')}</p>}
    </footer>
  )
}

const RENDER = { headline: Headline, lede: Lede, hero: Hero, where: Where, engines: Engines, why: Why, changed: Changed, next: Next, sources: Sources }
export function Block({ block, title, print = false }) {
  const C = RENDER[block.type]
  return C ? <C data={block.data} title={title} print={print} /> : null
}

// "Explain this": how a block was worked out, in a sentence or two
export function explainFor(block) {
  const d = block.data
  switch (block.type) {
    case 'headline': return d.verdict
      ? 'Winning: first in share of voice, gaining, and not behind any compared brand on more shared prompts than it leads. Mostly winning: one of those isn’t true. Losing: another brand has the most share.'
      : 'The answer to the question in one sentence, written from the blocks below.'
    case 'lede': return 'The numbers that matter most, each from the latest sync compared with the first sync of the period.'
    case 'hero': return d.kind === 'slope'
      ? 'Share of voice: of all brand mentions in AI answers to your tracked prompts, the share each brand got, at the start of the period and now. A competitor in red gained share.'
      : 'One square per tracked prompt, so every group adds up to the whole set. A prompt counts as “in the answer” when any engine that ran names the brand.'
    case 'where': return 'The prompts behind the picture, grouped by what they ask. The top 3 groups, each with its top 3 prompts.'
    case 'engines': return 'The same prompts split by the engine that answered. Engines that didn’t run are left out, not estimated.'
    case 'why': return 'What the answers cite. Each reason comes from the pages AI linked to for these prompts in the latest sync.'
    case 'changed': return 'The start of the period against the latest sync, for the measures the rest of the report draws on.'
    case 'next': return 'Each action is matched to the prompts where the missing page or answer is the reason you aren’t named, most prompts first.'
    case 'sources': return 'Everything above comes from these syncs. Anything without data is listed here instead of being estimated.'
    default: return ''
  }
}
