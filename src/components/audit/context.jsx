import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// The audit on screen (data/audit buildAudit) + the checks marked fixed. Marked-fixed lives in this browser
// (GAP: the API has no resolved state on checklist checks); the plan's checkbox and the drawer's "Mark as fixed" share it.
const Ctx = createContext(null)
const keyOf = (a) => `kraffic:audit:fixed:${a.domain}:${a.key}`
const read = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) ?? '[]')) } catch { return new Set() } }

export function AuditProvider({ audit, children }) {
  const [fixed, setFixed] = useState(() => read(keyOf(audit)))
  useEffect(() => setFixed(read(keyOf(audit))), [audit])
  const toggleFixed = useCallback((id) => {
    setFixed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem(keyOf(audit), JSON.stringify([...next])) } catch { /* private mode: this visit only */ }
      return next
    })
  }, [audit])
  return <Ctx.Provider value={{ a: audit, fixed, toggleFixed }}>{children}</Ctx.Provider>
}
export const useAudit = () => useContext(Ctx)
