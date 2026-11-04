// Step 3: Your data (optional), in the focus panel, as three numbered tasks under one intro line (15px muted). Each task:
// a 28px number circle (ink once something's added), a title (17/600), one muted line on why it helps (it collapses
// once something's added), a status on the right ("Optional", then "2 files" / "2 added" / "1 answered" with a small
// tick, all muted) and its content below; 32px between tasks with a 1px rule. Rows are 48px: text 15/500, values
// 15/400, meta 13px.
//   ① Upload documents: empty, a drop zone (120px, 12px radius, 1.5px dashed --line-strong; a 24px upload icon, "Drop
//     files here" 16/600, the formats, "Browse files"). With files it collapses (240ms) into a 48px drop row ("Drop more
//     files or browse · paste text"), still a drop target. Drag-over (both): the border turns ink, the zone tints
//     (--tabs), the icon lifts 4px, "Release to upload". The files under it on the shared grid (GRID): icon · name ·
//     size · status (a thin bar while it's read, 1s → "Read · 3 facts" → a tick once its facts are all handled) · ×.
//   ② Add key facts: ONE table on the same grid: label · value · source · action. Your facts first ("Added by you",
//     inline edit, × on hover) and "Add a fact"; then a thin "Suggested from your files · Add all 14" row and the facts
//     found in the files (70% opacity; source = the file; "Add" + × on row hover, always shown on touch): 4, then
//     "Show 10 more" (inline).
//   ③ Answer what you can: the draft check's flags as questions (dashed ring → green tick), the answer inline; each
//     row's ⓘ names the flag it clears; "1 of 3" in the title.
// The step's button and Skip are in the panel header. All state is the workspace's (data), so closing the panel keeps it.
// v1 (the default; ?backend=full keeps the proposal above): the files are READ IN THE BROWSER (data/extract.js: PDF via
// pdf.js, DOCX, CSV, TXT; up to 10 MB each, 5 files) and nothing is uploaded: a row reads "Read · ~1,200 words" or
// "Couldn't read this file" (the reason on hover); a file that can't be added says why in red ("Not a PDF, DOCX, CSV or
// TXT", "Over 10 MB", "Only 5 files at a time") until it's removed. No "Suggested from your files" (nothing finds facts
// in the text; the draft reads it). Under the intro, "Sent with your draft, not stored" (once for the step, not under
// each block: the three would repeat it). Everything goes into ONE userFacts payload (data/userFacts.js), capped at
// 20k characters: over it, a line under the files says "Too long, the first 20k characters will be used" and which
// file is cut (and where) or left out. The questions are the response's own flags an answer can clear.
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, ClipboardType, FileText, Image as ImageIcon, Info, Plus, Sheet, Upload, X } from 'lucide-react'
import { ACCEPT as ACCEPT_V1, kindOf, readFile, rejectReason, roundWords, wordsLabel } from '../data/extract'
import { ANSWER_MAX, LABEL_MAX, VALUE_MAX } from '../data/userFacts'
import { textBtn } from '../../../components/firstSetup/ui'
import { UPLOAD_MS, factsFound } from '../../../data/contentOpportunities-proposed'
import { FLAG_RULES } from '../../../data/contentRecommend'
import { fileKind, fileSize, suggestionsFor, uploadState } from './flow'
import { Collapse, DashedRing, GreenTick } from './ui'

const KIND_ICON = { pdf: FileText, docx: FileText, csv: Sheet, txt: FileText, image: ImageIcon }
const nf = new Intl.NumberFormat('en-US')
const ACCEPT = '.pdf,.doc,.docx,.csv,.xls,.xlsx,image/*'
// the grid the file rows and the facts table share: icon/label · name/label · size/value · status/source · action
const GRID = 'group/row grid h-12 grid-cols-[20px_minmax(0,9fr)_minmax(0,7fr)_minmax(0,7fr)_64px] items-center gap-x-3 border-b border-[var(--div)]'
const xBtn = 'grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-500 opacity-0 outline-none transition-[opacity,color,background-color] duration-150 hover:bg-tint hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover/row:opacity-100 touch:opacity-100'
const LINK = 'rounded text-[13px] leading-[18px] font-medium text-stone-700 underline decoration-[var(--color-line-strong)] underline-offset-4 outline-none hover:text-ink hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus'
// inline text: plain until clicked (a borderless input that shows a hairline when focused)
const inline = 'h-8 w-full min-w-0 rounded-md bg-transparent px-2 text-[15px] leading-[22px] text-stone-900 outline-none placeholder:text-stone-400 transition-[background-color,box-shadow] duration-150 hover:bg-tint focus:bg-surface focus:shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
const OUTLINED = 'inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:border-[var(--color-line-strong)] hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
const SHOW = 4 // suggestions shown before "Show n more"
let nextId = 100

// v1: the browser reads the files (see above) · cap: buildUserFacts' result ({ over, cut, unused }), v1 only
// drafted: a draft exists, so the questions are its flags; before that they're the first-visit set (userFacts FIRST_VISIT)
export default function DataStep({ data, update, v1 = false, cap = null, drafted = true }) {
  const { uploads, facts, questions, pasted, dismissed = [] } = data
  const [pasting, setPasting] = useState(false)
  const [draftText, setDraftText] = useState(pasted)
  const [more, setMore] = useState(false)
  const ids = useId()
  // re-render while a file is being read (its bar fills by CSS; the "Read" line needs a render)
  const [now, setNow] = useState(() => performance.now())
  const reading = !v1 && uploads.some((u) => uploadState(u, now, UPLOAD_MS).reading)
  useEffect(() => {
    if (!reading) return undefined
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [reading])

  // v1: each file is checked (type, size, count), then read here; its row updates when the text is in
  const addFilesV1 = (list) => {
    let accepted = uploads.filter((u) => u.status !== 'rejected').length
    const rows = [...(list ?? [])].map((f) => {
      const why = rejectReason(f, accepted)
      if (!why) accepted += 1
      return { file: f, row: { id: `u${nextId++}`, name: f.name, type: kindOf(f.name) ?? fileKind(f.name), bytes: f.size, status: why ? 'rejected' : 'reading', error: why } }
    })
    if (!rows.length) return
    update((d) => ({ uploads: [...d.uploads, ...rows.map((r) => r.row)] }))
    const set = (id, patch) => update((d) => ({ uploads: d.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
    for (const { file, row } of rows) {
      if (row.status !== 'reading') continue
      readFile(file).then(({ text, words }) => set(row.id, { status: 'read', text, words }), (e) => set(row.id, { status: 'error', error: e.message }))
    }
  }
  const addFiles = (list) => {
    if (v1) { addFilesV1(list); return }
    const t = performance.now()
    const files = [...(list ?? [])].map((f) => ({ id: `u${nextId++}`, name: f.name, type: fileKind(f.name), size: fileSize(f.size), addedAt: t }))
    if (files.length) { update({ uploads: [...uploads, ...files] }); setNow(t) }
  }
  const setFact = (i, patch) => update({ facts: facts.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const setAnswer = (id, answer) => update({ questions: questions.map((q) => (q.id === id ? { ...q, answer } : q)) })
  const filledFacts = facts.filter((f) => f.label.trim() && f.value.trim())
  const answered = questions.filter((q) => q.answer.trim()).length
  const nRows = uploads.length + (pasted.trim() ? 1 : 0)
  const nFiles = v1 ? uploads.filter((u) => u.status === 'read').length + (pasted.trim() ? 1 : 0) : nRows
  const suggestions = v1 ? [] : suggestionsFor(data, factsFound, now, UPLOAD_MS)
  const pendingFrom = (u) => suggestions.filter((s) => s.key.startsWith(`${u.id}:`)).length
  const addFacts = (xs) => update({ facts: [...facts.filter((f) => f.label.trim() || f.value.trim()), ...xs.map(({ label, value }) => ({ label, value }))] })
  const shown = more ? suggestions : suggestions.slice(0, SHOW)

  return (
    <div>
      <p className="text-[15px] leading-[22px] text-stone-500">Give the draft what only you know. Everything here is optional.</p>
      {v1 && <p className="mt-1 text-[13px] leading-[18px] text-stone-500">Sent with your draft, not stored</p>}
      <ol className="mt-6 divide-y divide-[var(--div)]">
        <Task n={1} title="Upload documents" why="Studies, spec sheets or price lists the draft can quote." status={nFiles ? `${nFiles} ${nFiles === 1 ? 'file' : 'files'}` : null}>
          <DropZone slim={nRows > 0} v1={v1} onFiles={addFiles} onPaste={() => { setDraftText(pasted); setPasting(true) }} />
          <Collapse open={pasting}>
            <div className="flex flex-col gap-2 pt-3">
              <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={4} aria-label="Pasted text" placeholder="Paste notes, a product sheet or an approved answer"
                className="w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] leading-5 text-stone-900 outline-none placeholder:text-stone-400 focus:border-[var(--color-line-strong)]" />
              <span className="flex justify-end gap-4">
                <button type="button" onClick={() => { setPasting(false); setDraftText(pasted) }} className={textBtn}>Cancel</button>
                <button type="button" disabled={!draftText.trim()} onClick={() => { update({ pasted: draftText }); setPasting(false) }} className={`${textBtn} text-ink`}>Add text</button>
              </span>
            </div>
          </Collapse>
          {nRows > 0 && (
            <ul className="mt-2" aria-label="Added">
              {uploads.map((u) => {
                const Icon = KIND_ICON[u.type] ?? FileText
                if (v1) return <FileRowV1 key={u.id} u={u} Icon={Icon} onRemove={() => update((d) => ({ uploads: d.uploads.filter((x) => x.id !== u.id) }))} />
                const st = uploadState(u, now, UPLOAD_MS)
                const left = st.reading ? null : pendingFrom(u)
                return (
                  <li key={u.id} className={`${GRID} motion-safe:animate-[fade-in_160ms_ease-out]`}>
                    <Icon size={18} className="text-stone-600" aria-hidden />
                    <span className="truncate text-[15px] leading-[22px] font-medium text-stone-900">{u.name}</span>
                    <span className="text-right text-[13px] leading-[18px] tabular-nums text-stone-500">{u.size}</span>
                    {st.reading ? (
                      <span role="progressbar" aria-label={`Reading ${u.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(st.frac * 100)} className="relative h-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                        <span className="co-read absolute inset-0 rounded-full bg-ink" style={{ animationDuration: `${UPLOAD_MS}ms`, animationDelay: `-${Math.round(st.frac * UPLOAD_MS)}ms` }} />
                      </span>
                    ) : left ? (
                      <span className="text-[13px] leading-[18px] tabular-nums text-stone-500 motion-safe:animate-[fade-in_160ms_ease-out]">Read · {factsFound(u).n} facts</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-500 motion-safe:animate-[fade-in_160ms_ease-out]"><Check size={14} className="text-[var(--rep-up-fg)]" aria-hidden />{factsFound(u).n} facts handled</span>
                    )}
                    <span className="flex justify-end"><button type="button" aria-label={`Remove ${u.name}`} onClick={() => update({ uploads: uploads.filter((x) => x.id !== u.id) })} className={xBtn}><X size={14} aria-hidden /></button></span>
                  </li>
                )
              })}
              {pasted.trim() && (
                <li className={GRID}>
                  <ClipboardType size={18} className="text-stone-600" aria-hidden />
                  <button type="button" onClick={() => { setDraftText(pasted); setPasting(true) }} className="truncate text-left text-[15px] leading-[22px] font-medium text-stone-900 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Pasted text</button>
                  <span className="text-right text-[13px] leading-[18px] tabular-nums text-stone-500">{nf.format(pasted.trim().split(/\s+/).length)} words</span>
                  <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-500"><Check size={14} className="text-[var(--rep-up-fg)]" aria-hidden />Added</span>
                  <span className="flex justify-end"><button type="button" aria-label="Remove pasted text" onClick={() => { update({ pasted: '' }); setDraftText('') }} className={xBtn}><X size={14} aria-hidden /></button></span>
                </li>
              )}
            </ul>
          )}
          {v1 && cap?.over && <OverCap cap={cap} />}
        </Task>

        <Task n={2} title="Add key facts" why="Exact numbers and names the draft must get right." status={filledFacts.length ? `${filledFacts.length} added` : null}>
          {/* one table: label · value · source · action (the value column lines up on every row). v1 has no suggested
              facts, so every fact is the user's: no source column, the value takes its width */}
          <ul aria-label="Facts">
            {facts.map((f, i) => (
              <li key={i} className={GRID}>
                <input value={f.label} onChange={(e) => setFact(i, { label: e.target.value })} placeholder="Label" aria-label={`Fact ${i + 1} label`} maxLength={LABEL_MAX}
                  className={`${inline} col-span-2 -ml-2 font-medium`} autoFocus={!f.label && !f.value && i === facts.length - 1} />
                <input value={f.value} onChange={(e) => setFact(i, { value: e.target.value })} placeholder="Value" aria-label={`Fact ${i + 1} value`} maxLength={VALUE_MAX} className={`${inline} -ml-2 tabular-nums text-stone-700 ${v1 ? 'col-span-2' : ''}`} />
                {!v1 && <span className="truncate text-[13px] leading-[18px] text-stone-500">Added by you</span>}
                <span className="flex justify-end"><button type="button" aria-label={`Remove fact ${f.label || i + 1}`} onClick={() => update({ facts: facts.filter((_, j) => j !== i) })} className={xBtn}><X size={14} aria-hidden /></button></span>
              </li>
            ))}
            <li className="flex h-12 items-center border-b border-[var(--div)]">
              <button type="button" onClick={() => update({ facts: [...facts, { label: '', value: '' }] })} className={textBtn}><Plus size={14} aria-hidden />Add a fact</button>
            </li>
            {suggestions.length > 0 && (
              <>
                <li className="flex h-9 items-end gap-2 border-b border-[var(--div)] pb-2 text-[13px] leading-[18px] text-stone-500">
                  <span>Suggested from your files</span><span aria-hidden>·</span>
                  <button type="button" onClick={() => addFacts(suggestions)} className={LINK}>Add all {suggestions.length}</button>
                </li>
                {shown.map((s) => (
                  <li key={s.key} className={`${GRID} motion-safe:animate-[fade-in_200ms_ease-out]`}>
                    <span className="col-span-2 truncate text-[15px] leading-[22px] font-medium text-stone-900 opacity-70">{s.label}</span>
                    <span className="truncate text-[15px] leading-[22px] tabular-nums text-stone-700 opacity-70">{s.value}</span>
                    <span className="truncate text-[13px] leading-[18px] text-stone-500" title={s.from}>{s.from}</span>
                    <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 touch:opacity-100">
                      <button type="button" onClick={() => addFacts([s])} aria-label={`Add ${s.label}`} className={LINK}>Add</button>
                      <button type="button" aria-label={`Dismiss ${s.label}`} onClick={() => update({ dismissed: [...dismissed, s.key] })}
                        className="grid h-7 w-7 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"><X size={14} aria-hidden /></button>
                    </span>
                  </li>
                ))}
                {suggestions.length > SHOW && (
                  <li className="flex h-12 items-center">
                    <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className={textBtn}>
                      {more ? 'Show fewer' : `Show ${suggestions.length - SHOW} more`}
                      <ChevronDown size={14} aria-hidden className="transition-transform duration-200" style={{ transform: more ? 'rotate(180deg)' : 'none' }} />
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>
        </Task>

        <Task n={3} title={<>Answer what you can<span className="ml-2 text-[15px] font-normal tabular-nums text-stone-500">{answered} of {questions.length}</span></>}
          why={drafted ? 'The draft flagged these. Answers remove the flags.' : 'Drafts are often flagged for these. Answers go into the draft.'} status={answered ? `${answered} answered` : null}>
          {questions.length === 0 && <p className="text-[14px] leading-5 text-stone-500">Nothing to answer: the draft check found no missing brand info.</p>}
          <ul>
            {questions.map((q) => {
              const ok = Boolean(q.answer.trim())
              const flag = FLAG_RULES[q.flag]
              return (
                <li key={q.id} className={GRID}>
                  {ok ? <GreenTick size={16} label="Answered" /> : <DashedRing size={16} />}
                  <span className="flex min-w-0 items-center gap-1.5">
                    <label htmlFor={`${ids}-${q.id}`} className={`truncate text-[15px] leading-[22px] font-medium ${ok ? 'text-stone-900' : 'text-stone-600'}`}>{q.label}</label>
                    {flag && <FlagTip flag={flag} />}
                  </span>
                  <input id={`${ids}-${q.id}`} value={q.answer} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder={q.placeholder} maxLength={ANSWER_MAX} className={`${inline} col-span-3 -ml-2 text-stone-700`} />
                </li>
              )
            })}
          </ul>
        </Task>
      </ol>
    </div>
  )
}

// a task: number circle · title · why (collapses once something's added) · status ("Optional", or what's added + a tick)
function Task({ n, title, why, status, children }) {
  const done = Boolean(status)
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 py-8 first:pt-0 last:pb-0">
      <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full text-[14px] font-semibold tabular-nums transition-colors duration-200 ${done ? 'bg-ink text-on-ink' : 'border border-[var(--color-line-strong)] text-stone-700'}`}>{n}</span>
      <div className="min-w-0">
        <div className="flex min-h-7 items-center justify-between gap-4">
          <h3 className="text-[17px] leading-6 font-semibold text-stone-900">{title}</h3>
          <span className="flex shrink-0 items-center gap-1.5 text-[13px] leading-[18px] tabular-nums text-stone-500">
            {done && <Check size={14} className="text-[var(--rep-up-fg)]" aria-hidden />}{status ?? 'Optional'}
          </span>
        </div>
        <Collapse open={!done}><p className="text-[14px] leading-5 text-stone-500">{why}</p></Collapse>
        <div className="mt-4">{children}</div>
      </div>
    </li>
  )
}

// ① the drop zone: 120px when empty; with files, a 48px drop row (the height eases, 240ms). Real drag events (a counter
// for the zone's children); a drop with no files (a synthetic event) adds a sample file so the flow can be shown
function DropZone({ slim, onFiles, onPaste, v1 = false }) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const input = useRef(null)
  const enter = (e) => { e.preventDefault(); depth.current += 1; setOver(true) }
  const leave = () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false) }
  const drop = (e) => {
    e.preventDefault(); depth.current = 0; setOver(false)
    const files = e.dataTransfer?.files
    if (v1) onFiles(files)
    else onFiles(files?.length ? files : [{ name: 'product-spec-sheet.pdf', size: 482_000 }])
  }
  const browse = () => input.current?.click()
  return (
    <div data-dropzone onDragEnter={enter} onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true) }} onDragLeave={leave} onDrop={drop}
      className={`relative overflow-hidden rounded-[12px] border-[1.5px] border-dashed transition-[height,border-color,background-color] duration-[240ms] ease-out motion-reduce:transition-none ${over ? 'border-ink bg-[var(--tabs)]' : 'border-[var(--color-line-strong)]'}`}
      style={{ height: slim ? 48 : 120 }}>
      {slim ? (
        <div className="flex h-full items-center gap-3 px-4 motion-safe:animate-[fade-in_200ms_ease-out]">
          <Upload size={16} aria-hidden className="shrink-0 text-stone-600 transition-transform duration-200 ease-out" style={{ transform: over ? 'translateY(-2px)' : 'none' }} />
          {over ? <span className="text-[14px] leading-5 font-semibold text-stone-900">Release to upload</span> : (
            <span className="min-w-0 truncate text-[14px] leading-5 text-stone-700">
              Drop more files or <button type="button" onClick={browse} className={LINK}>browse</button>
              <span className="text-stone-500"> · </span><button type="button" onClick={onPaste} className={LINK}>paste text</button>
            </span>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Upload size={22} aria-hidden className="text-stone-600 transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ transform: over ? 'translateY(-4px)' : 'none' }} />
          <p className="mt-1 text-[16px] leading-6 font-semibold text-stone-900" aria-live="polite">{over ? 'Release to upload' : 'Drop files here'}</p>
          <p className="text-[13px] leading-[18px] text-stone-500">{v1 ? 'PDF, DOCX, CSV or TXT · up to 10 MB each, 5 files' : 'PDF, DOCX, CSV or images · up to 20 MB'}</p>
          <span className="mt-2 flex items-center gap-3" style={{ visibility: over ? 'hidden' : 'visible' }}>
            <button type="button" onClick={browse} className={OUTLINED}>Browse files</button>
            <button type="button" onClick={onPaste} className={LINK}>or paste text</button>
          </span>
        </div>
      )}
      <input ref={input} type="file" multiple accept={v1 ? ACCEPT_V1 : ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
    </div>
  )
}

// ③ ⓘ: the draft flag an answer clears
function FlagTip({ flag }) {
  return (
    <span className="group/tip relative inline-flex shrink-0">
      <button type="button" aria-label={`Clears the flag: ${flag.label}`} className="grid h-5 w-5 place-items-center rounded-full text-stone-400 outline-none hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-focus">
        <Info size={14} aria-hidden />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-max max-w-[280px] rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">
        <span className="font-semibold text-stone-900">Clears the flag: {flag.label} · {flag.score}</span><br />{flag.text}
      </span>
    </span>
  )
}

// v1: a file row: icon · name · size · status (reading: a bar that eases to 90% and waits · "Read · ~1,200 words" ·
// "Couldn't read this file", the reason on hover · a file that can't be added: why, in red) · ×
function FileRowV1({ u, Icon, onRemove }) {
  const msg = 'text-[13px] leading-[18px] motion-safe:animate-[fade-in_160ms_ease-out]'
  return (
    <li className={`${GRID} motion-safe:animate-[fade-in_160ms_ease-out]`} data-file-row={u.status}>
      <Icon size={18} className="text-stone-600" aria-hidden />
      <span className="truncate text-[15px] leading-[22px] font-medium text-stone-900" title={u.name}>{u.name}</span>
      <span className="text-right text-[13px] leading-[18px] tabular-nums text-stone-500">{fileSize(u.bytes ?? 0)}</span>
      {u.status === 'reading' ? (
        <span role="progressbar" aria-label={`Reading ${u.name}`} className="relative h-1 overflow-hidden rounded-full bg-[var(--color-line)]">
          <span className="co-read-wait absolute inset-0 rounded-full bg-ink" />
        </span>
      ) : u.status === 'read' ? (
        <span className={`${msg} truncate tabular-nums text-stone-500`}>Read · {wordsLabel(u.words)}</span>
      ) : u.status === 'error' ? (
        <span className={`${msg} truncate text-negative`} title={u.error}>Couldn’t read this file</span>
      ) : (
        <span className={`${msg} truncate text-negative`}>{u.error}</span>
      )}
      <span className="flex justify-end"><button type="button" aria-label={`Remove ${u.name}`} onClick={onRemove} className={xBtn}><X size={14} aria-hidden /></button></span>
    </li>
  )
}

// v1: over the 20k cap: what's used, which file is cut (and where) or left out
function OverCap({ cap }) {
  const { cut, unused } = cap
  const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  return (
    <p role="status" data-over-cap className="mt-3 flex items-start gap-2 text-[13px] leading-[18px] text-stone-700 motion-safe:animate-[fade-in_160ms_ease-out]">
      <Info size={14} className="mt-0.5 shrink-0 text-stone-500" aria-hidden />
      <span>
        <span className="font-medium text-stone-900">Too long, the first 20k characters will be used.</span>
        {cut && <> {cut.name} is cut after ~{nf.format(roundWords(cut.keptWords))} of {wordsLabel(cut.words).slice(1)}.</>}
        {unused.length > 0 && <> {list(unused)} {unused.length === 1 ? 'isn’t' : 'aren’t'} used.</>}
      </span>
    </p>
  )
}
