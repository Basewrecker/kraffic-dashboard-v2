import { useState } from 'react'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import { inkBtn, lineBtn, t2 } from '../../components/tool/ToolPage'
import { update, useBilling } from './billing'

// Billing details form (?details=edit; a bottom sheet on phones). GAP: production stores only Agency.billingEmail.
const ITEM = { id: 'edit' }
const FIELDS = [['company', 'Company name'], ['email', 'Billing email'], ['address', 'Address'], ['taxId', 'Tax ID (optional)']]

export default function DetailsDrawer({ onSaved }) {
  const drawer = useDrawer('details', (v) => (v === 'edit' ? ITEM : null))
  const b = useBilling()
  if (!drawer.item) return null
  return <Form key={b.__v} drawer={drawer} details={b.details} onSaved={onSaved} />
}

function Form({ drawer, details, onSaved }) {
  const [v, setV] = useState(details)
  const save = () => { update({ details: { ...v, taxId: v.taxId || null } }); drawer.close(); onSaved() }
  return (
    <DrawerShell drawer={drawer} title="Billing details" meta={<span>Shown on every invoice</span>}
      footer={<><span /><span className="flex gap-2"><button type="button" onClick={drawer.close} className={lineBtn}>Cancel</button><button type="button" onClick={save} disabled={!v.company?.trim() || !v.email?.trim()} className={inkBtn}>Save</button></span></>}>
      <form className="mt-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save() }}>
        {FIELDS.map(([k, label]) => (
          <label key={k} className="block">
            <span className={`text-[13px] leading-[18px] ${t2}`}>{label}</span>
            {k === 'address'
              ? <textarea rows={2} value={v[k] ?? ''} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} className="mt-1 w-full resize-y rounded-lg border border-line bg-raised px-3 py-2 text-[14px] leading-5 text-stone-900 outline-none focus:border-stone-400" />
              : <input type={k === 'email' ? 'email' : 'text'} value={v[k] ?? ''} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-line bg-raised px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400" />}
          </label>
        ))}
      </form>
    </DrawerShell>
  )
}
