// `@/…` → src/app/… for the unit tests (node --test), the same alias vite.config.js gives the pages.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = new URL('../src/app/', import.meta.url)
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = new URL(specifier.slice(2), ROOT)
    for (const ext of ['', '.js', '.jsx', '.mjs', '/index.js']) {
      const url = new URL(base.href + ext)
      if (existsSync(fileURLToPath(url)) && !url.href.endsWith('/')) return next(url.href, context)
    }
  }
  return next(specifier, context)
}
