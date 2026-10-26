// Prompt categories: the built-in ones plus custom ones the user creates (persisted per brand).
// A tiny external store so the toolbar filter, the add row and inline edit all see the same list at once.
import { useSyncExternalStore } from 'react'
import { account, promptCategories } from '../data/mock'

export const UNCATEGORIZED = 'Uncategorized' // where a deleted category's prompts go
const KEY = `kraffic:categories:${account.domain}`

function load() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY))
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && !promptCategories.includes(x)) : []
  } catch { return [] }
}
let custom = load()
const listeners = new Set()
function set(next) {
  custom = next
  try { window.localStorage.setItem(KEY, JSON.stringify(custom)) } catch { /* storage unavailable: kept for this session */ }
  listeners.forEach((l) => l())
}
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export const allCategories = () => [...promptCategories, ...custom]
export const isCustom = (name) => custom.includes(name)

// 1–40 characters, trimmed, no case-insensitive duplicate (except the one being renamed)
export function categoryError(raw, except = null) {
  const v = raw.trim().replace(/\s+/g, ' ')
  if (v.length < 1 || v.length > 40) return 'Use 1–40 characters'
  const dup = [...allCategories(), UNCATEGORIZED].find((c) => c !== except && c.toLowerCase() === v.toLowerCase())
  return dup ? `${dup} already exists` : null
}
export const tidyCategory = (raw) => raw.trim().replace(/\s+/g, ' ')
export function createCategory(name) { set([...custom, tidyCategory(name)]) }
export function renameCategory(from, to) { set(custom.map((c) => (c === from ? tidyCategory(to) : c))) }
export function deleteCategory(name) { set(custom.filter((c) => c !== name)) }

export function useCategories() {
  const c = useSyncExternalStore(subscribe, () => custom, () => custom)
  return { all: [...promptCategories, ...c], custom: c }
}
