import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Segmented from '../dashboard/Segmented'
import { PrimaryButton } from '../dashboard/overlays'
import { fieldCls } from '../firstSetup/ui'
import { clientActions } from '../../data/mock'

const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const Spinner = (props) => <Loader2 {...props} className="animate-spin motion-reduce:animate-none" />
const cancelBtn = 'inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] leading-[18px] font-medium text-stone-900">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1.5 block text-[12px] leading-4 text-negative">{error}</span>
        : hint && <span className={`mt-1.5 block text-[12px] leading-4 ${t3}`}>{hint}</span>}
    </label>
  )
}

// Add client: a new client (name optional + email; they get an email to set their own password, then First-time
// setup opens for them), or an existing user who isn't in an agency yet (they join the list). The app's New Client
// and Add existing user, in one window.
export function AddClientModal({ open, onClose, toast, onAssigned }) {
  const [kind, setKind] = useState('new')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(null)
  useEffect(() => { if (open) { setKind('new'); setName(''); setEmail(''); setTouched(false); setSaving(false); setFailed(null) } }, [open])
  const error = touched && email.trim() && !isEmail(email) ? 'Enter a valid email address' : null

  const submit = (e) => {
    e?.preventDefault()
    setTouched(true)
    if (!isEmail(email) || saving) return
    setSaving(true); setFailed(null)
    if (kind === 'new') {
      clientActions.onCreateClient({ name: name.trim(), email: email.trim() }).then(
        (c) => window.location.assign(`/first-setup?mock=new&client=${encodeURIComponent(c.name)}`),
        () => { setSaving(false); setFailed('Couldn’t add the client. Try again.') },
      )
    } else {
      const until = new Date(); until.setDate(until.getDate() + 30)
      clientActions.onAssignClient(email.trim()).then(
        () => {
          onAssigned({ id: `client-${Date.now()}`, name: email.trim(), email: email.trim(), domain: '', brands: 0, setup: 'prompts', score: null, scoreDelta: null, lastSync: null, prompts: 0, missed: 0, active: true, plan: 'demo', until: iso(until), aiMode: false, domainMatch: true })
          toast('Client assigned to your agency')
          onClose()
        },
        () => { setSaving(false); setFailed('Couldn’t assign the user. Try again.') },
      )
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" title="Add client"
      subtitle={kind === 'new' ? 'Creates their account, then opens First-time setup for their brand.' : 'Someone who already has a Kraffic account and isn’t in an agency.'}
      footer={<>
        {failed ? <span role="alert" className="text-[13px] leading-[18px] text-negative">{failed}</span> : <span />}
        <span className="flex items-center gap-2">
          <button type="button" onClick={onClose} className={cancelBtn}>Cancel</button>
          <PrimaryButton size="sm" type="submit" form="add-client" disabled={!isEmail(email) || saving} icon={saving ? Spinner : undefined}>
            {saving ? 'Adding…' : kind === 'new' ? 'Add and set up' : 'Add to my agency'}
          </PrimaryButton>
        </span>
      </>}>
      <form id="add-client" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Segmented label="Who" size="sm" value={kind} onChange={setKind} full options={[{ value: 'new', label: 'New client' }, { value: 'existing', label: 'Existing user' }]} />
        {kind === 'new' && (
          <Field label={<>Name <span className={`font-normal ${t3}`}>(optional)</span></>}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name or company" className={fieldCls} />
          </Field>
        )}
        <Field label="Email" error={error} hint={kind === 'new' ? 'They’ll get an email to set their own password. No password is sent.' : null}>
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="Their sign-in email" aria-invalid={Boolean(error)} className={fieldCls} />
        </Field>
      </form>
    </Modal>
  )
}

// Edit client: name, sign-in email, a new password (optional), Demo or Paid and the access end date (Paid needs one)
export function EditClientModal({ open, client, onClose, onSaved }) {
  const [v, setV] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (open) { setV({ name: client.name, email: client.email, password: '', plan: client.plan, until: client.until ?? '' }); setSaving(false); setFailed(false) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return null
  const set = (patch) => setV((x) => ({ ...x, ...patch }))
  const dateError = v.plan === 'paid' && !v.until ? 'Paid clients need an access end date' : null
  const emailError = v.email.trim() && !isEmail(v.email) ? 'Enter a valid email address' : null
  const valid = isEmail(v.email) && !dateError

  const submit = (e) => {
    e?.preventDefault()
    if (!valid || saving) return
    setSaving(true); setFailed(false)
    const patch = { name: v.name.trim() || v.email.trim(), email: v.email.trim(), plan: v.plan, until: v.until }
    clientActions.onUpdateClient(client.id, patch).then(() => onSaved(patch), () => { setSaving(false); setFailed(true) })
  }

  return (
    <Modal open={open} onClose={onClose} size="md" title="Edit client" subtitle={client.name}
      footer={<>
        {failed ? <span role="alert" className="text-[13px] leading-[18px] text-negative">Couldn’t save. Try again.</span> : <span />}
        <span className="flex items-center gap-2">
          <button type="button" onClick={onClose} className={cancelBtn}>Cancel</button>
          <PrimaryButton size="sm" type="submit" form="edit-client" disabled={!valid || saving} icon={saving ? Spinner : undefined}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
        </span>
      </>}>
      <form id="edit-client" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name"><input value={v.name} onChange={(e) => set({ name: e.target.value })} className={fieldCls} /></Field>
        <Field label="Sign-in email" error={emailError}><input type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={Boolean(emailError)} className={fieldCls} /></Field>
        <Field label={<>New password <span className={`font-normal ${t3}`}>(optional)</span></>}>
          <input type="password" autoComplete="new-password" value={v.password} onChange={(e) => set({ password: e.target.value })} placeholder="Leave blank to keep the current one" className={fieldCls} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] leading-[18px] font-medium text-stone-900">Account</span>
          <Segmented label="Account" size="sm" value={v.plan} onChange={(plan) => set({ plan })} options={[{ value: 'demo', label: 'Demo' }, { value: 'paid', label: 'Paid' }]} />
          <span className={`text-[12px] leading-4 ${t3}`}>{v.plan === 'demo' ? 'A trial with the demo banner. Pick a later date to extend it.' : 'No demo banner.'}</span>
        </div>
        <Field label="Access until" error={dateError}>
          <input type="date" value={v.until} onChange={(e) => set({ until: e.target.value })} aria-invalid={Boolean(dateError)} className={`${fieldCls} ${t2}`} />
        </Field>
      </form>
    </Modal>
  )
}
