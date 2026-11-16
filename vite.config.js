import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { convert } from './scripts/ui-scale-css.mjs'

// The app's UI scale (0.8 on laptop-sized windows; scripts/ui-scale-css.mjs, copied from the app): every length in the
// stylesheet Tailwind has just built follows --ui-scale. After Tailwind (same `pre` group, later in the list), before
// Vite's own CSS handling.
const uiScale = () => ({
  name: 'ui-scale',
  enforce: 'pre',
  transform(code, id) {
    if (!/src\/index\.css(\?|$)/.test(id) || id.includes('?raw')) return null
    return { code: convert(code), map: null }
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), uiScale()],
  // `@/…`: the app's own modules that its copied pages import (src/app: copies of the app's pure helpers, and stand-ins
  // with fake data for the ones that talk to its server)
  resolve: { alias: { '@': fileURLToPath(new URL('./src/app', import.meta.url)) } },
})
