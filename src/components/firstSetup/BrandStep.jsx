import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Segmented from '../dashboard/Segmented'
import { PrimaryButton } from '../dashboard/overlays'
import SiteLogo from '../ui/SiteLogo'
import { brandName } from '../../utils/brand'
import { isValidDomain, normalizeDomain } from '../../utils/domain'
import { setupActions } from '../../data/mock'
import { fieldCls, stepCard, stepFooter, t2, t3, textBtn } from './ui'

const Spinner = (props) => <Loader2 {...props} className="animate-spin motion-reduce:animate-none" />

// Step 1 — the brand: tracked by its website, or by its name alone. Adding saves through setupActions.onCreateBrand
// (Brand Setup's add); a reopened step saves through onUpdateBrand.
export default function BrandStep({ brand, editing, onSave, onCancel }) {
  const [kind, setKind] = useState(brand && !brand.domain ? 'name' : 'website')
  const [site, setSite] = useState(brand?.domain ?? '')
  const [display, setDisplay] = useState(brand?.domain && brand.name === brandName(brand.domain) ? '' : brand?.name ?? '')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const domain = normalizeDomain(site)
  const siteOk = isValidDomain(domain)
  const name = kind === 'website' ? display.trim() || (siteOk ? brandName(domain) : '') : display.trim()
  const valid = kind === 'website' ? siteOk : Boolean(name)
  const siteError = kind === 'website' && touched && site.trim() && !siteOk ? 'Enter a website like yourbrand.com' : null

  const submit = (e) => {
    e?.preventDefault()
    setTouched(true)
    if (!valid || saving) return
    const next = { name, domain: kind === 'website' ? domain : null }
    setSaving(true); setFailed(false)
    const call = brand ? setupActions.onUpdateBrand(brand.id, next) : setupActions.onCreateBrand({ ...next, aliases: [], competitors: [] })
    call.then((saved) => onSave({ ...next, id: saved?.id ?? brand?.id }), () => { setSaving(false); setFailed(true) })
  }

  return (
    <form noValidate onSubmit={submit} className={stepCard}>
      <div className="flex flex-col gap-4 px-5 py-4 max-md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-[13px] leading-[18px] ${t2}`}>{kind === 'website' ? 'Kraffic tracks the brand by its website.' : 'Kraffic looks for the brand’s name in AI answers.'}</p>
          <Segmented label="Track by" size="sm" value={kind} onChange={setKind} options={[{ value: 'website', label: 'Website' }, { value: 'name', label: 'Name only' }]} />
        </div>
        {kind === 'website' && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] leading-[18px] font-medium text-stone-900">Website</span>
            <span className={`flex h-9 items-center overflow-hidden rounded-md border bg-raised transition-[border-color,box-shadow] duration-150 ease-out focus-within:ring-[3px] focus-within:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)] ${siteError ? 'border-negative' : 'border-line focus-within:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]'}`}>
              <span className={`flex h-full shrink-0 items-center border-r border-line px-2.5 text-[13px] ${t3} select-none`}>https://</span>
              <input autoFocus inputMode="url" autoComplete="off" spellCheck={false} placeholder="yourbrand.com" value={site} aria-invalid={Boolean(siteError)}
                onChange={(e) => setSite(e.target.value)} onBlur={() => { setTouched(true); if (siteOk) setSite(domain) }}
                className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[14px] text-stone-900 outline-none placeholder:text-stone-500" />
              {siteOk && <span className="pr-2.5"><SiteLogo domain={domain} name={brandName(domain)} className="h-4 w-4 rounded-sm" imgPad="p-0" initialClass="text-[9px]" bordered={false} /></span>}
            </span>
            {siteError && <span role="alert" className="mt-1.5 block text-[12px] leading-4 text-negative">{siteError}</span>}
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[13px] leading-[18px] font-medium text-stone-900">{kind === 'website' ? <>Display name <span className={`font-normal ${t3}`}>(optional)</span></> : 'Brand name'}</span>
          <input autoFocus={kind === 'name'} value={display} onChange={(e) => setDisplay(e.target.value)} placeholder={kind === 'website' && siteOk ? brandName(domain) : 'Your brand'} className={fieldCls} />
        </label>
      </div>
      <div className={stepFooter}>
        {failed ? <span role="alert" className="text-[13px] leading-[18px] text-negative">Couldn’t save the brand. Try again.</span>
          : <span className={`text-[13px] leading-[18px] ${t3}`}>{kind === 'website' ? 'Answers that cite your pages count too.' : 'You can add a website later in Brand Setup.'}</span>}
        <span className="flex items-center gap-3">
          {editing && <button type="button" onClick={onCancel} className={textBtn}>Cancel</button>}
          <PrimaryButton size="sm" type="submit" disabled={!valid || saving} icon={saving ? Spinner : undefined} aria-busy={saving || undefined}>
            {saving ? 'Saving…' : brand ? 'Save' : 'Add brand'}
          </PrimaryButton>
        </span>
      </div>
    </form>
  )
}
