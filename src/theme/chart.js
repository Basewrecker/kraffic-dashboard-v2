// Graphite data-viz palette: ink for Dermasuri, grey steps for competitors. No hues.
// Token names match index.css (light :root + dark override). Components use the var() refs in `chart`,
// so every chart re-colors instantly when the theme flips; readChartColor() resolves the current value
// via getComputedStyle for anything that can't take a CSS variable (canvas, exports).
export const tokens = {
  you: '--data-you', // = --ink
  c1: '--data-c1', // largest competitor
  c2: '--data-c2',
  c3: '--data-c3', // smallest competitor
  track: '--data-track',
  // Visibility history LINE chart only (vibrant); every other chart keeps the greys above
  lineYou: '--line-you',
  line1: '--line-1',
  line2: '--line-2',
  line3: '--line-3',
  line4: '--line-4', // Dermasuri when a competitor is the focal brand
}

export const chart = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, `var(${v})`]))

export function readChartColor(key, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(tokens[key]).trim()
}
