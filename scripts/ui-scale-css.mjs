// Copied from the app (app_kraffic.ai develop, scripts/ui-scale-css.mjs) on 2026-11-15, so the mock draws at the same
// sizes as the app. Mock differences, each marked `mock:`: the attribute rules' scope is `html` (the app's is
// html.k-dash), the page column is `max-w-[1280px]` here (the app's `.max-w-page`), and it runs as a Vite plugin
// (vite.config.js) on the stylesheet Tailwind has just built, not on a file.
// The dashboard's one UI scale (owner, 2026-11-09): on laptop-sized windows (1024–1600px wide) everything is drawn at
// 0.8 of its size, as the dashboard looked at 80% browser zoom; wider windows stay at 1.0 and narrower ones keep the
// mobile / tablet layout at 1.0. No CSS zoom or transform (they break tooltips, popovers and chart hit areas): every
// length follows the CSS variable --ui-scale instead.
//
//   node scripts/ui-scale-css.mjs <file.css> …    rewrites each precompiled stylesheet in place (run last in the build:
//                                                  npm run mock-css; and after rebuilding redesign-shell.css)
//
// What it changes, in every declaration (custom properties included, so Tailwind's --tw-translate-x etc. follow):
//   a px or rem length          → calc(<length> * var(--ui-scale, 1)); 1px and smaller (borders, hairlines) stay as they are
//   font-size with a length     → max(11px, <scaled>): no text under 11px, at any scale, monitors included
// Never touched: @media / @container / @supports conditions (breakpoints stay in real pixels), --ui-scale itself, and a
// value already scaled (the script can run twice).
// It also appends rules for sizes the components set as SVG / image attributes (lucide icons' size={14}, engine marks,
// chart ticks' fontSize={12}): CSS beats a presentation attribute, so those follow the scale without editing the copied
// components. --ui-scale is defined in components/mock-overview/mock.src.css.
import fs from 'node:fs';
import postcss from 'postcss';

export const MIN_FONT_PX = 11;
const LENGTH = /(-?(?:\d+\.?\d*|\.\d+))(px|rem)\b/g;
const SCALED = 'var(--ui-scale';

export function scaleLengths(value) {
  if (value.includes(SCALED)) return value;
  return value.replace(LENGTH, (m, n, unit) => {
    const px = unit === 'rem' ? parseFloat(n) * 16 : parseFloat(n);
    if (Math.abs(px) <= 1) return m; // borders and hairlines keep their real pixel
    return `calc(${m} * var(--ui-scale, 1))`;
  });
}

export function scaleDecl(prop, value) {
  if (prop === '--ui-scale' || value.includes(SCALED)) return value;
  const scaled = scaleLengths(value);
  if (prop === 'font-size' && scaled !== value) return `max(${MIN_FONT_PX}px, ${scaled})`;
  if (prop === 'font-size' && /^-?[\d.]+(px|rem)$/.test(value.trim())) {
    // a 1px-or-smaller font size (never used) still gets the minimum
    return `max(${MIN_FONT_PX}px, ${value})`;
  }
  return scaled;
}

// sizes the components give as attributes (icons: lucide's size={n}, engine marks, logos; chart ticks' fontSize)
// 8–320px: icons, logos, rings, donuts and pies; only an svg with a viewBox (it scales cleanly; one without would crop)
// and never a Recharts surface (sized by its container, which the CSS already scales)
const ATTR_SIZES = Array.from({ length: 313 }, (_, i) => i + 8);
const SVG = 'svg[viewBox]:not(.recharts-surface)';
const TICK_FONTS = [9, 10, 11, 12, 13, 14, 15, 16];
export function attributeRules(scope = 'html') { // mock: no k-dash class
  const out = ['/* ui-scale: sizes set as SVG / image attributes (scripts/ui-scale-css.mjs) */'];
  for (const n of ATTR_SIZES) {
    out.push(`${scope} :is(${SVG}, img)[width="${n}"] { width: calc(${n}px * var(--ui-scale, 1)); }`);
    out.push(`${scope} :is(${SVG}, img)[height="${n}"] { height: calc(${n}px * var(--ui-scale, 1)); }`);
  }
  for (const n of TICK_FONTS) {
    out.push(`${scope} svg [font-size="${n}"] { font-size: max(${MIN_FONT_PX}px, calc(${n}px * var(--ui-scale, 1))); }`);
  }
  return out.join('\n');
}
const MARK = '/* ui-scale: sizes set as SVG / image attributes';

// A container query's width can't follow a CSS variable, but the container (the sidebar…) shrinks with the scale, and
// so does what's in it: on laptop widths each @container condition holding px gets a copy with its thresholds × 0.8,
// and the original applies only outside laptop widths.
export const LAPTOP_MEDIA = '(min-width: 1024px) and (max-width: 1600px)';
const LAPTOP_SCALE = 0.8;
function scaleContainerQueries(root) {
  root.walkAtRules('container', (at) => {
    if (!/\d(px|rem)\b/.test(at.params)) return;
    if (at.parent?.type === 'atrule' && at.parent.name === 'media') return; // already split (a second run)
    const laptop = at.clone({
      params: at.params.replace(LENGTH, (m, n, unit) => {
        const px = (unit === 'rem' ? parseFloat(n) * 16 : parseFloat(n)) * LAPTOP_SCALE;
        return `${Math.round(px * 100) / 100}px`;
      }),
    });
    const other = postcss.atRule({ name: 'media', params: `not all and ${LAPTOP_MEDIA}` });
    const onLaptop = postcss.atRule({ name: 'media', params: LAPTOP_MEDIA });
    at.replaceWith(other, onLaptop);
    other.append(at);
    onLaptop.append(laptop);
  });
}

function skipScale(decl) {
  // Page column width stays 1280px real (gap after the sidebar). Scaling it with --ui-scale (0.8 on
  // laptops → 1024) collapsed that gap / made gutters look wrong.
  if (decl.prop === 'max-width' && /\.max-w-page|max-w-\\\[(1280|1440)px\\\]/.test(String(decl.parent?.selector || ''))) return true; // mock: its page column's class (1440px real since the 2026-11-27 app sync)
  if (decl.prop.startsWith('--real-')) return true; // a length that must stay in real pixels (the page gutters: clamp(24px, 3vw, 48px))
  if (decl.parent?.type === 'atrule' && /^(media|container|supports)$/i.test(decl.parent.name)) return true;
  return false;
}

export function convert(css) {
  const root = postcss.parse(css);
  scaleContainerQueries(root);
  root.walkDecls((decl) => {
    if (skipScale(decl)) return;
    const next = scaleDecl(decl.prop, decl.value);
    if (next !== decl.value) decl.value = next;
  });
  let out = root.toString();
  // the attribute block always comes last: replaced, never doubled (a second run, or a newer list of sizes)
  if (out.includes(MARK)) out = out.slice(0, out.indexOf(MARK));
  return `${out.trimEnd()}\n\n${attributeRules()}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const file of process.argv.slice(2)) fs.writeFileSync(file, convert(fs.readFileSync(file, 'utf8')));
}
