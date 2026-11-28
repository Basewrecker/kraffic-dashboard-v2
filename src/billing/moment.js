import { useSyncExternalStore } from 'react'

// The upgrade flow's one continuous object (owner, 2026-11-28): the plan card the client picks morphs into the review
// dialog; after paying, the full-screen moment (confirming, then the confirmation) shrinks back into that card.
// A tiny shared store, so the Plans page, the review dialog, the return page and the App-level overlay can hand the
// object over without a router:
//   pick    { planId, rect, nameRect, numRect }   the card that was clicked (Plans → review)
//   moment  { phase, then, plan, from }           the full-screen moment: phase 'processing' | 'paid' | 'leaving' | 'landing'
//   landed  planId                                the card the moment landed back into (its arrival bounce)
let state = { pick: null, moment: null, landed: null }
const subs = new Set()
export const getMoment = () => state
export function setMoment(patch) { state = { ...state, ...patch }; subs.forEach((f) => f()) }
export const useMoment = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
