import { useState } from 'react'
import DrawerShell, { Dot, SectionTitle } from '../audit/DrawerShell'
import ProgressBar from '../dashboard/ProgressBar'
import { PrimaryButton } from '../dashboard/overlays'
import ConfirmPopover from '../prompts/ConfirmPopover'
import SiteLogo from '../ui/SiteLogo'
import Switch from '../ui/Switch'
import { chart } from '../../theme/chart'
import { clientActions, syncModes } from '../../data/mock'
import { SYNC_ENGINE } from './SyncSheet'
import { EditClientModal } from './ClientModals'
import { Spinner, SyncButton, textBtn, viewAs } from './shared'

const t2 = 'text-stone-600'
const fmtDate = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const modeTitle = (id) => syncModes.website.find((m) => m.id === id)?.title ?? 'Sync'

// A client's drawer (?client=): View as and Sync now; the sync on its way with each engine's progress; the account the
// app keeps (sign-in email, Demo / Paid and its access date, Active); the two scan switches the old list had (Google AI
// Mode, Domain name match); Edit / Deactivate / Delete. Phones: a bottom sheet.
export default function ClientDrawer({ drawer, sync, toast, onSync, onRetry, onPatch, onDelete }) {
  const c = drawer.item
  const [confirm, setConfirm] = useState(null) // { kind: 'active' | 'delete', anchor }
  const [editing, setEditing] = useState(false)
  if (!c) return null

  // the switches save at once; a failed save puts the switch back and says so
  const toggle = (field, on, said) => {
    onPatch(c.id, { [field]: on })
    clientActions.onUpdateClient(c.id, { [field]: on }).then(() => toast(said), () => { onPatch(c.id, { [field]: !on }); toast('Couldn’t save. Try again.') })
  }
  const setActive = () => {
    const on = !c.active
    setConfirm(null)
    onPatch(c.id, { active: on })
    clientActions.onUpdateClient(c.id, { active: on }).then(() => toast(on ? 'Client activated' : 'Client deactivated'), () => onPatch(c.id, { active: !on }))
  }
  const remove = () => {
    setConfirm(null)
    clientActions.onDeleteClient(c.id).then(() => { onDelete(c); toast(`${c.name} deleted`) })
  }

  return (
    <>
      <DrawerShell
        drawer={drawer}
        title={c.name}
        meta={<>
          <SiteLogo domain={c.domain} name={c.name} className="h-5 w-5 rounded" imgPad="p-0" initialClass="text-[10px]" bordered={false} />
          <span>{c.domain}</span>
          {c.brands > 1 && <><Dot /><span>{c.brands} brands</span></>}
          <Dot /><span>{c.active ? 'Active' : 'Inactive'}</span>
        </>}
        footer={<>
          <button type="button" onClick={() => setEditing(true)} className={textBtn}>Edit client</button>
          <span className="flex items-center gap-5">
            <button type="button" onClick={(e) => setConfirm({ kind: 'active', anchor: e.currentTarget })} className={textBtn}>{c.active ? 'Deactivate' : 'Activate'}</button>
            <button type="button" onClick={(e) => setConfirm({ kind: 'delete', anchor: e.currentTarget })} className={textBtn}>Delete</button>
          </span>
        </>}
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PrimaryButton size="sm" onClick={() => viewAs(c)}>View as</PrimaryButton>
          <SyncButton c={c} sync={sync} label="Sync now" onClick={() => onSync(c)} />
        </div>

        {sync && <SyncStatus sync={sync} onRetry={() => onRetry(c)} />}

        <SectionTitle>Account</SectionTitle>
        <dl className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)] text-[13px] leading-[18px]">
          <Fact label="Sign-in email">{c.email}</Fact>
          <Fact label="Account">{c.plan === 'paid' ? 'Paid' : 'Demo'} · access until {fmtDate(c.until)}</Fact>
          <Fact label="Prompts">{c.prompts ? `${c.prompts} tracked · ${c.missed} missed on Google` : 'None yet'}</Fact>
        </dl>

        <SectionTitle>Scans</SectionTitle>
        <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          <SwitchRow title="Google AI Mode" text="When a prompt is missed on Google, also check AI Mode. One more paid call per missed prompt."
            checked={c.aiMode} onChange={(on) => toggle('aiMode', on, on ? 'Google AI Mode on' : 'Google AI Mode off')} />
          <SwitchRow title="Domain name match" text="Count answers that name the brand, not only answers that link to the site."
            checked={c.domainMatch} onChange={(on) => toggle('domainMatch', on, on ? 'Domain name match on' : 'Domain name match off (links only)')} />
        </ul>
      </DrawerShell>

      {confirm?.kind === 'active' && (
        <ConfirmPopover anchor={confirm.anchor} onCancel={() => setConfirm(null)} onConfirm={setActive}
          title={c.active ? `Deactivate ${c.name}?` : `Activate ${c.name}?`}
          body={c.active ? 'They won’t be able to sign in. Their data stays.' : 'They’ll be able to sign in again.'}
          confirmLabel={c.active ? 'Deactivate' : 'Activate'} />
      )}
      {confirm?.kind === 'delete' && (
        <ConfirmPopover anchor={confirm.anchor} onCancel={() => setConfirm(null)} onConfirm={remove}
          title={`Delete ${c.name}?`} body="Their account and data are deleted. This can’t be undone." confirmLabel="Delete" />
      )}
      <EditClientModal open={editing} client={c} onClose={() => setEditing(false)}
        onSaved={(patch) => { onPatch(c.id, patch); setEditing(false); toast('Client updated') }} />
    </>
  )
}

function Fact({ label, children }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 py-2">
      <dt className={t2}>{label}</dt>
      <dd className="min-w-0 truncate text-right text-stone-900 tabular-nums">{children}</dd>
    </div>
  )
}

function SwitchRow({ title, text, checked, onChange }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-[14px] leading-5 font-medium text-stone-900">{title}</span>
        <span className={`block text-[13px] leading-[18px] ${t2}`}>{text}</span>
      </span>
      <Switch checked={checked} onChange={onChange} aria-label={title} size="sm" />
    </li>
  )
}

// the sync on its way: starting · each engine's progress · still running in the background · finished · didn't start
function SyncStatus({ sync, onRetry }) {
  const line = {
    starting: 'Starting the sync…',
    running: `${modeTitle(sync.mode)} · running`,
    background: 'Still running in the background. Results appear as each engine finishes.',
    done: `${modeTitle(sync.mode)} · finished just now`,
  }[sync.status]
  return (
    <>
      <SectionTitle>Sync</SectionTitle>
      <div role="status" aria-live="polite" className="mt-2">
        {sync.status === 'error' ? (
          <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px]">
            <span className="text-negative">The sync didn’t start.</span>
            <button type="button" onClick={onRetry} className="rounded font-medium text-stone-900 underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
          </p>
        ) : (
          <p className={`flex items-center gap-1.5 text-[13px] leading-[18px] ${t2}`}>{sync.status !== 'done' && <Spinner size={13} />}{line}</p>
        )}
        {sync.progress && (
          <ul className="mt-3 flex flex-col gap-2.5">
            {Object.entries(sync.progress).map(([e, p]) => (
              <li key={e} className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-3 text-[13px] leading-[18px]">
                <span className="text-stone-900">{SYNC_ENGINE[e] ?? e}</span>
                <ProgressBar value={p.done} max={p.total} height="6px" color={chart.you} />
                <span className={`text-right tabular-nums ${t2}`}>{p.done}/{p.total}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
