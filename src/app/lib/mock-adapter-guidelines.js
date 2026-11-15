// Mock stand-in for the app's lib/mock-adapter-guidelines.ts (synced 2026-11-15): the brand guidelines kept in this
// browser (src/data/brandGuidelines.js). In the app they are saved on its server, so it has a loading state and a
// failed-save state; here they are always loaded and never fail.
export * from '../../data/brandGuidelines.js'
export const guidelinesStateOf = () => ({ loaded: true, error: null })
export const useBrandGuidelines = () => ({ loaded: true, error: null })
