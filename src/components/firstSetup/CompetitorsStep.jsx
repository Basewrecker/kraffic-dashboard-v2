import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PrimaryButton } from '../dashboard/overlays'
import { InputRow, Logo, Row, SaveFailed, Suggested, useEditing } from '../setup/SetupPage'
import { isValidDomain, normalizeDomain } from '../../utils/domain'
import { setupActions } from '../../data/mock'
import { stepCard, stepFooter, t2, t3, textBtn } from './ui'

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

// Step 2 — competitors (required): Brand Setup's rows, its inline add (name + domain) and its Suggested chips, on
// setupActions. Continue waits for at least one. Each row has "Edit" (its name and website inline, saved through
// setupActions.onUpdateCompetitor) and a remove ×, always shown; an edit or remove shows at once, and a failed save
// takes it back with an inline "Couldn't save · <name>" and Retry under the list.
export default function CompetitorsStep({ brand, list, suggested, update, toast, onContinue }) {
  const ed = useEditing(toast)
  const [failed, setFailed] = useState(null) // { what, retry }: the inline save error
  const adding = ed.editing === 'new' || (!list.length && ed.editing == null)
  const setList = (fn) => update((s) => ({ competitors: fn(s.competitors) }))
  const setSuggested = (fn) => update((s) => ({ suggested: fn(s.suggested) }))
  // Retry runs once (a second click on the same toast sends nothing)
  const once = (fn) => { let used = false; return () => { if (!used) { used = true; fn() } } }
  const fail = (name, retry) => toast(`Couldn’t save ${name}`, { duration: 6000, action: { label: 'Retry', onClick: once(retry) } })

  const failInline = (what, retry) => setFailed({ what, retry: once(() => { setFailed(null); retry() }) })
  // self: the competitor being edited (its own name and domain don't count as "already added")
  const validate = ({ name, domain }, self = null) => {
    const d = normalizeDomain(domain)
    if (!isValidDomain(d)) return 'Enter a domain like competitor.com'
    if (brand?.domain && d === brand.domain) return 'That’s your own site'
    if (list.some((c) => c.id !== self?.id && (c.domain === d || c.name.toLowerCase() === name.trim().toLowerCase()))) return 'Already added'
    return null
  }
  const add = ({ name, domain }) => {
    const temp = { id: `new-${Date.now()}`, name: name.trim(), domain: normalizeDomain(domain) }
    setList((cs) => [...cs, temp])
    setupActions.onAddCompetitor(brand?.id, temp).then(
      (saved) => setList((cs) => cs.map((x) => (x.id === temp.id ? { ...temp, ...saved } : x))),
      () => { setList((cs) => cs.filter((x) => x.id !== temp.id)); fail(temp.name, () => add({ name, domain })) },
    )
  }
  const remove = (c) => {
    const i = list.findIndex((x) => x.id === c.id)
    const back = () => setList((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs.slice(0, i), c, ...cs.slice(i)]))
    setFailed(null)
    if (ed.editing === c.id) ed.close()
    setList((cs) => cs.filter((x) => x.id !== c.id))
    setupActions.onRemoveCompetitor(brand?.id, c).then(
      () => toast(`${c.name} removed`, { duration: 5000, action: { label: 'Undo', onClick: () => { back(); setupActions.onRestoreCompetitor(brand?.id, c) } } }),
      () => { back(); failInline(c.name, () => remove(c)) },
    )
  }
  // Edit saves the name and website together; the row shows the change at once
  const edit = (c, { name, domain }) => {
    const next = { ...c, name: name.trim(), domain: normalizeDomain(domain) }
    if (next.name === c.name && next.domain === c.domain) return
    setFailed(null)
    setList((cs) => cs.map((x) => (x.id === c.id ? next : x)))
    setupActions.onUpdateCompetitor(brand?.id, c, next).then(
      (saved) => setList((cs) => cs.map((x) => (x.id === c.id ? { ...next, ...saved } : x))),
      () => { setList((cs) => cs.map((x) => (x.id === c.id ? c : x))); failInline(next.name, () => edit(c, { name, domain })) },
    )
  }
  const accept = (sg) => {
    setSuggested((ss) => ss.filter((x) => x.id !== sg.id))
    setList((cs) => [...cs, { id: sg.id, name: sg.name, domain: sg.domain }])
    setupActions.onAcceptSuggestion(brand?.id, sg).catch(() => {
      setList((cs) => cs.filter((x) => x.id !== sg.id)); setSuggested((ss) => [...ss, sg]); fail(sg.name, () => accept(sg))
    })
  }
  const dismiss = (sg) => {
    setSuggested((ss) => ss.filter((x) => x.id !== sg.id))
    setupActions.onDismissSuggestion(brand?.id, sg).catch(() => setSuggested((ss) => [...ss, sg]))
  }

  return (
    <>
      <p className={`text-[13px] leading-[18px] ${t2}`}>Add at least one. AI answers compare you with these brands.</p>
      <section aria-label="Competitors" className={stepCard}>
        <ul className="divide-y divide-[var(--div)]">
          {adding && (
            <InputRow logo={<Logo name="+" />} initial={ed.draft ?? { name: '', domain: '' }} validate={validate} submitLabel="Add"
              fields={[{ name: 'name', label: 'Competitor name', placeholder: 'Brand name' }, { name: 'domain', label: 'Competitor domain', placeholder: 'competitor.com' }]}
              onSubmit={(v) => { add(v); ed.close() }} onClose={ed.close} onDiscard={ed.discard('new')} />
          )}
          {list.map((c) => (ed.editing === c.id ? (
            <InputRow key={c.id} logo={<Logo domain={c.domain} name={c.name} />} initial={ed.draft ?? { name: c.name, domain: c.domain }} validate={(v) => validate(v, c)} submitLabel="Save"
              fields={[{ name: 'name', label: 'Competitor name', placeholder: 'Brand name' }, { name: 'domain', label: 'Competitor domain', placeholder: 'competitor.com' }]}
              onSubmit={(v) => { edit(c, v); ed.close() }} onClose={ed.close} onDiscard={ed.discard(c.id)} />
          ) : (
            <Row key={c.id} logo={<Logo domain={c.domain} name={c.name} />} name={c.name} meta={c.domain} alwaysActions onEdit={() => ed.open(c.id)} onRemove={() => remove(c)} />
          )))}
          {!adding && (
            <li>
              <button type="button" onClick={() => ed.open('new')} className={`${textBtn} h-12 w-full px-5 max-md:px-4`}><Plus size={14} aria-hidden />Add competitor</button>
            </li>
          )}
        </ul>
        <SaveFailed failed={failed} />
        <Suggested items={suggested.map((x) => ({ key: x.id, label: x.name, value: x, reason: x.reason }))} label="Suggested" onPick={(it) => accept(it.value)} onDismiss={(it) => dismiss(it.value)} />
        <div className={stepFooter}>
          <span className={`text-[13px] leading-[18px] tabular-nums ${list.length ? t2 : t3}`}>{list.length ? plural(list.length, 'competitor') : 'No competitors yet'}</span>
          <PrimaryButton size="sm" disabled={!list.length} onClick={onContinue}>Continue</PrimaryButton>
        </div>
      </section>
    </>
  )
}
