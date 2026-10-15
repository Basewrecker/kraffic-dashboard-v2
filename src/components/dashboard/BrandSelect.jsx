import { useEffect, useState } from 'react'
import SiteLogo from '../ui/SiteLogo'
import { MenuSelect } from './PageHeader'
import { TRACKED_BRANDS, getBrandView } from '../../data/brandViews'
import { useBrandView } from '../../hooks/useBrandView'

// A card-local brand toggle (Citations and Mentions, Prompt coverage): starts on, and follows, the page's
// "Viewing as" but never changes it. Returns [domain, select element].
export function useCardBrand({ triggerClassName, className } = {}) {
  const { focal } = useBrandView()
  const [domain, setDomain] = useState(focal.domain)
  useEffect(() => setDomain(focal.domain), [focal.domain])
  const groups = [{
    items: TRACKED_BRANDS.map((b) => ({
      id: b.domain,
      label: b.you ? `${b.name} (You)` : b.name,
      short: b.name,
      icon: <SiteLogo domain={b.domain} name={b.name} className="h-4 w-4 rounded" imgPad="p-0" initialClass="text-[9px]" plate />,
      meta: `${getBrandView(b.domain).kpis.score}%`,
    })),
  }]
  return [domain, <MenuSelect key="brand" value={domain} onChange={setDomain} groups={groups} listLabel="Brand" showIcon triggerClassName={triggerClassName} className={className} />]
}
