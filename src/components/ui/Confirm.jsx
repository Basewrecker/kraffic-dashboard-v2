import Modal from './Modal'

// A confirm dialog for a destructive action (Team: remove a member). Moved here unchanged from the old Trends "runs"
// pages when those were replaced (app sync, Trends).
//   ask: { title, body, confirmLabel, onConfirm } or null
export function Confirm({ ask, onClose }) {
  return (
    <Modal open={Boolean(ask)} onClose={onClose} title={ask?.title ?? ''} subtitle={ask?.body}
      footer={(
        <div className="flex w-full justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">Cancel</button>
          <button type="button" onClick={() => { ask.onConfirm(); onClose() }}
            className="inline-flex h-9 items-center rounded-lg bg-negative px-3.5 text-small font-medium text-on-ink outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
            {ask?.confirmLabel ?? 'Delete'}
          </button>
        </div>
      )}>
      <span />
    </Modal>
  )
}

export default Confirm
