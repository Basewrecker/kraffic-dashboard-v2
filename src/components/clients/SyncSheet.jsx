import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { PrimaryButton } from '../dashboard/overlays'
import { estimateSync } from '../../data/mock'

// the engines' names in the sync sheet and in a sync's progress
export const SYNC_ENGINE = { aio: 'Google', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
const fmt = (n) => n.toLocaleString('en-US')

// "152 prompts · about 625–2,821 paid calls": what the picked mode will run, before anything starts
export function syncSummary(m, counts) {
  if (!m.engines.length) return 'No paid calls'
  const { n, lo, hi } = estimateSync(m, counts)
  if (!n) return m.prompts === 'missed' ? 'No missed Google prompts to re-check' : 'No prompts to sync yet'
  return `${fmt(n)} ${n === 1 ? 'prompt' : 'prompts'} · about ${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`} paid calls`
}

// Sync now (replaces the app's Sync dropdown): its modes word for word, one picked; the footer states what the pick
// runs and roughly how many paid calls it makes; nothing starts until Start sync. Phones: a bottom sheet (Modal).
//   modes: syncModes.website | syncModes.brand · counts: { prompts, missed, domains, aiMode } · onStart(modeId)
export default function SyncSheet({ open, onClose, name, modes, counts, onStart }) {
  const [mode, setMode] = useState(modes[0].id)
  useEffect(() => { if (open) setMode(modes[0].id) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const m = modes.find((x) => x.id === mode) ?? modes[0]
  const runs = !m.engines.length || estimateSync(m, counts).n > 0
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Sync now"
      subtitle={`Checks ${name}’s prompts again. Scans are paid per prompt and engine.`}
      footer={(
        <>
          <span className="min-w-0 flex-1 basis-[220px] text-[13px] leading-[18px] text-stone-600 tabular-nums">{syncSummary(m, counts)}</span>
          <span className="flex items-center gap-2 max-md:w-full max-md:justify-end">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
            <PrimaryButton size="sm" disabled={!runs} onClick={() => onStart(m.id)}>Start sync</PrimaryButton>
          </span>
        </>
      )}
    >
      <div role="radiogroup" aria-label="What to sync" className="flex flex-col gap-2">
        {modes.map((x) => {
          const on = mode === x.id
          return (
            <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => setMode(x.id)}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink bg-tint' : 'border-line hover:bg-stone-50'}`}>
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? 'border-ink' : 'border-stone-400'}`} aria-hidden>{on && <span className="h-2 w-2 rounded-full bg-ink" />}</span>
              <span className="min-w-0">
                <span className="block text-[14px] leading-5 font-medium text-stone-900">{x.title}</span>
                <span className="mt-0.5 block text-[13px] leading-[18px] text-stone-600">{x.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
