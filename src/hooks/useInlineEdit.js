import { useEffect, useRef } from 'react'

// Shared behaviour for inline editors (marketplace rows, the prompt-table edit, the add-prompt row).
//   Esc        → cancel (stops propagation so a surrounding modal / page handler doesn't also act)
//   Enter      → save when dirty + valid; nothing changed → just close
//   click/tap outside `ref` (capture phase) → clean: cancel · dirty + valid: save · dirty + invalid: onDiscard
// `ignore`: refs whose clicks are not "outside" (e.g. the button that toggles the editor itself).
// One editor at a time falls out of this: pressing another row's Edit is an outside click for this one.
// Clicks inside a floating popover ([data-popover]: menus, confirm popovers in portals) never count as outside.
export function useInlineEdit({ ref, active = true, isDirty, isValid = true, onSave, onCancel, onDiscard, ignore = [] }) {
  const latest = useRef(null)
  latest.current = { isDirty, isValid, onSave, onCancel, onDiscard, ignore }

  useEffect(() => {
    if (!active) return
    const onDown = (e) => {
      const { isDirty, isValid, onSave, onCancel, onDiscard, ignore } = latest.current
      if (ref.current?.contains(e.target) || e.target.closest?.('[data-popover]') || ignore.some((r) => r.current?.contains(e.target))) return
      if (!isDirty) onCancel()
      else if (isValid) onSave()
      else (onDiscard ?? onCancel)()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [active, ref])

  const onKeyDown = (e) => {
    const { isDirty, isValid, onSave, onCancel } = latest.current
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.target.closest('button, select')) {
      e.preventDefault()
      if (!isDirty) onCancel()
      else if (isValid) onSave()
    }
  }
  return { onKeyDown }
}
