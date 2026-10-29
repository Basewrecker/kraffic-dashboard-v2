import { Monitor, Moon, Sun } from 'lucide-react'
import { setTheme, useTheme } from '../../theme/theme'

const options = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
  ['system', 'System', Monitor],
]

// Segmented Light / Dark / System control for the sidebar footer: exactly the footer's width (three equal cells);
// below 216px of its own width (a sidebar under 240px) it drops the labels and shows icons only.
export default function ThemeToggle() {
  const theme = useTheme()
  return (
    <div className="@container w-full" role="group" aria-label="Theme">
    <div className="grid h-10 w-full grid-cols-3 gap-1 rounded-lg bg-switch p-1 ring-1 ring-inset ring-switch-line">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={(e) => {
            // the reveal grows from the centre of the clicked button
            const r = e.currentTarget.getBoundingClientRect()
            setTheme(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
          }}
          aria-pressed={theme === id}
          aria-label={label}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
            theme === id ? 'bg-[var(--ink)] text-[var(--color-surface)]' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {/* key flips when this button becomes active, replaying the turn-in */}
          <Icon key={theme === id ? 'on' : 'off'} size={14} aria-hidden className={theme === id ? 'theme-icon-in' : undefined} />
          <span className="truncate @max-[215px]:hidden">{label}</span>
        </button>
      ))}
    </div>
    </div>
  )
}
