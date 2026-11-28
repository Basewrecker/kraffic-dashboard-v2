import { MenuSelect } from './MenuSelect'

// Shared select. No native <select> a client can see (as the app, #216): this is the header dropdown (ui/MenuSelect)
// with the old select's sizes. size 'sm' = h-8 (inline rows), 'row' = 34px (settings lists), 'md' = h-9 (full-width
// in a tile). options: [value, label] pairs. onChange(value, triggerElement): the element anchors confirm popovers.
// The list draws in a portal and flips above the trigger when there's no room (table footers, drawers, dialogs).
const SIZE = { sm: 'h-8 text-[13px]', row: 'h-[34px] text-[13px]', md: 'h-9 text-[14px]' }
export default function Select({ value, options, onChange, label, size = 'sm', className = 'w-44', align = 'left', search = false, disabled = false }) {
  const groups = [{ items: options.map(([v, l]) => ({ id: v, label: l })) }]
  return (
    <MenuSelect
      value={value}
      onChange={onChange}
      groups={groups}
      listLabel={label}
      align={align}
      portal
      search={search}
      disabled={disabled}
      width="w-max max-w-[320px]"
      className={`inline-flex ${className}`}
      triggerClassName={`inline-flex ${SIZE[size]} w-full items-center justify-between gap-2 rounded-md border border-line bg-raised pl-3 pr-2.5 outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--color-line-strong)] focus-visible:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]`}
    />
  )
}
