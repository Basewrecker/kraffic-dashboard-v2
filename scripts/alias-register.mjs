// node --import ./scripts/alias-register.mjs --test src/   (package.json "test")
import { register } from 'node:module'
register('./alias-hooks.mjs', import.meta.url)
