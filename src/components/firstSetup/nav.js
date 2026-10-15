import { ListChecks, MessageSquareText, TrendingUp } from 'lucide-react'

// Setup mode: until the first scan, the sidebar (and the phone drawer) shows only these
export const setupGroups = [
  { label: 'Setup', items: [
    { label: 'First-time setup', icon: ListChecks, href: '/first-setup' },
    { label: 'Prompt Hub', icon: MessageSquareText, href: '/tracker' },
    { label: 'Trends', icon: TrendingUp, href: '/trends' },
  ] },
]
