import { Monitor, Moon, Sun } from 'lucide-react'
import { setTheme, useTheme } from '../../theme/theme'

const options = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
  ['system', 'System', Monitor],
]

// Light / Dark / System for the sidebar footer, icons only (as the app, #216): sun / moon / monitor, the chosen one
// ink-filled, the name as its tooltip and label. A 32px track with an 8px radius, 28px segments with a 6px radius
// (three equal cells, the footer's width), 16px icons.
export default function ThemeToggle() {
  const theme = useTheme()
  return (
    <div className="grid h-8 w-full grid-cols-3 gap-0.5 rounded-lg bg-switch p-0.5 ring-1 ring-inset ring-switch-line" role="group" aria-label="Theme" data-tour-near>{/* data-tour-near: the walkthrough keeps its lit area clear of this */}
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={(e) => {
            // the reveal grows from the centre of the clicked button
            const r = e.currentTarget.getBoundingClientRect()
            setTheme(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
          }}
          aria-pressed={theme === id}
          aria-label={label}
          title={label}
          className={`grid h-7 min-w-0 place-items-center rounded-md outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
            theme === id ? 'bg-[var(--ink)] text-[var(--color-surface)]' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {/* key flips when this button becomes active, replaying the turn-in */}
          <Icon key={theme === id ? 'on' : 'off'} size={16} aria-hidden className={theme === id ? 'theme-icon-in' : undefined} />
        </button>
      ))}
    </div>
  )
}
