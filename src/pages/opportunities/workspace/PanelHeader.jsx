// Opportunities → Content, focus mode: the panel's one header (it replaces the payoff bar inside the panel; sticky at
// the top of the panel's scroller, surface background, a 1px line under it). The same for steps 3–5:
//   row 1: the progress pills + "3 of 5" · the prompt (15/600, the dialog's label) · the target page (muted,
//     middle-truncated) · Exit (✕ + an Esc hint) on the right. (Back to list is on the page; Exit returns there.)
//   row 2: the step's headline (20/600) + its muted sub-line on the left; the step's text link (Skip, Back to step 4)
//     and its primary button on the right. The headline and sub-line crossfade on a step change (180ms).
// The page's engines block isn't repeated here: the page header names the engines.
import { X } from 'lucide-react'
import { CrossFade } from '../../../components/ui/motion'
import { MidText } from '../parts'
import { ActionButton, Pills } from './PayoffBar'
import { STEPS, stepPos } from './flow'

const LINK = 'rounded text-[13px] leading-[18px] font-medium text-stone-600 underline-offset-4 outline-none whitespace-nowrap hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus'

export default function PanelHeader({ current, open, values, onPick, prompt, path, titleId, headingId, headline, line, action, secondary = null, onClose = null, onExit, steps = STEPS.map((s, i) => ({ ...s, i })) }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface px-6 pb-4 pt-4 max-md:px-4">
      <div className="flex h-8 items-center gap-4">
        <Pills current={current} open={open} values={values} onPick={onPick} steps={steps} />
        <h2 id={titleId} className="min-w-0 max-w-[45%] shrink truncate text-[15px] leading-[22px] font-semibold text-stone-900">{prompt}</h2>
        <MidText text={path} className="min-w-0 flex-1 text-[13px] leading-[18px] text-stone-500" />
        {/* focus goes to the dialog itself on open (no ring on Exit); Tab reaches Exit next */}
        <button type="button" onClick={onExit}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          <X size={14} aria-hidden />Exit<kbd className="ml-1 rounded border border-line px-1 font-sans text-[11px] leading-4 font-normal text-stone-500">Esc</kbd>
        </button>
      </div>
      <div className="mt-3 flex items-center gap-6">
        <div aria-live="polite" className="min-w-0 flex-1">
          <CrossFade k={`${open}|${headline}`} ms={180}>
            <div className="min-w-0">
              <h3 id={headingId} className="text-[20px] leading-7 font-semibold text-stone-900 text-pretty">
                <span className="sr-only">Step {stepPos(steps, open).n} of {steps.length}: </span>{headline}
              </h3>
              {line && <p className="w-0 min-w-full truncate text-[13px] leading-[18px] text-stone-500 tabular-nums">{line}</p>}
            </div>
          </CrossFade>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {onClose && <button type="button" onClick={onClose} className={LINK}>Back to step {current + 1}</button>}
          {secondary && <button type="button" onClick={secondary.onClick} className={LINK}>{secondary.label}</button>}
          {action && <ActionButton action={action} />}
        </div>
      </div>
    </header>
  )
}
