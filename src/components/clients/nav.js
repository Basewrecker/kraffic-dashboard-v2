import { Users } from 'lucide-react'

// Agency home: the sidebar (and the phone drawer) shows the agency's own pages, not a brand's
export const clientsGroups = [
  { label: 'Agency', items: [
    { label: 'Clients', icon: Users, href: '/clients' },
  ] },
]
