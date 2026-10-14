import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import Select from '../../components/ui/Select'
import { inkBtn, lineBtn, t2 } from '../../components/tool/ToolPage'
import { sendSalesInquiry, workspaceUser } from '../../data/mock'
import { brand } from '../../store/workspace'
import { planById } from './billing'

// "Talk to us about Enterprise" (?talk=<planId>; a bottom sheet on phones).
// Posts to production's generic contact endpoint (POST /auth/contact) via sendSalesInquiry. GAP: that endpoint only logs
// the message (no email is sent, no sales address is configured).
const SIZES = [['1-10', '1–10'], ['11-50', '11–50'], ['51-200', '51–200'], ['200+', '200+']]
const ITEMS = { enterprise: { id: 'enterprise' } }

export default function TalkDrawer() {
  const drawer = useDrawer('talk', (v) => ITEMS[v] ?? null)
  const [form, setForm] = useState(null)
  const [state, setState] = useState('idle') // idle | sending | sent
  useEffect(() => {
    if (drawer.open) { setForm({ name: workspaceUser.name, email: workspaceUser.email ?? '', company: brand.client, size: '11-50', need: '' }); setState('idle') }
  }, [drawer.open])
  if (!drawer.item || !form) return null
  const plan = planById(drawer.item.id)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && form.company.trim() && form.need.trim()
  const send = async () => { setState('sending'); await sendSalesInquiry({ plan: plan.slug, ...form }); setState('sent') }
  const field = 'mt-1 h-10 w-full rounded-lg border border-line bg-raised px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400'
  if (state === 'sent') {
    return (
      <DrawerShell drawer={drawer} title={`Talk to us about ${plan.name}`} meta={<span>Message sent</span>}
        footer={<><span /><button type="button" onClick={drawer.close} className={inkBtn}>Done</button></>}>
        <div className="mt-12 flex flex-col items-center text-center" role="status">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-on-ink" aria-hidden><Check size={22} /></span>
          <p className="mt-4 text-[15px] leading-[22px] text-stone-900">Thanks — we’ll reply within one business day.</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>We’ll write to {form.email}.</p>
        </div>
      </DrawerShell>
    )
  }
  return (
    <DrawerShell drawer={drawer} title={`Talk to us about ${plan.name}`} meta={<span>Tell us what you need and we’ll put a plan together</span>}
      footer={<><button type="button" onClick={drawer.close} className={lineBtn}>Cancel</button><button type="button" onClick={send} disabled={!valid || state === 'sending'} className={inkBtn}>{state === 'sending' ? 'Sending…' : 'Send'}</button></>}>
      <form className="mt-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) send() }}>
        <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>Name</span><input value={form.name} onChange={set('name')} autoComplete="name" className={field} /></label>
        <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>Work email</span><input type="email" value={form.email} onChange={set('email')} autoComplete="email" className={field} /></label>
        <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>Company</span><input value={form.company} onChange={set('company')} autoComplete="organization" className={field} /></label>
        <div><span className={`text-[13px] leading-[18px] ${t2}`}>Team size</span><Select label="Team size" size="md" className="mt-1 w-full" value={form.size} onChange={set('size')} options={SIZES} /></div>
        <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>What do you need?</span>
          <textarea rows={4} value={form.need} onChange={set('need')} placeholder="e.g. 40 brands across 6 markets, SSO, and a monthly report for our board."
            className="mt-1 w-full resize-y rounded-lg border border-line bg-raised px-3 py-2 text-[14px] leading-5 text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400" />
        </label>
      </form>
    </DrawerShell>
  )
}
