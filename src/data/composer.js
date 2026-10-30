// the Reports composer's sizes: the text grows a line at a time up to 8 lines, then scrolls inside itself
export const LINE = 24
export const MAX_LINES = 8

// the text area's height from its content: one line while empty (a long placeholder never makes it taller)
export const textHeight = (value, scrollHeight) => {
  const max = LINE * MAX_LINES
  if (!value) return { height: LINE, scroll: false }
  return { height: Math.min(max, Math.max(LINE, scrollHeight)), scroll: scrollHeight > max }
}

// the thread page fills the visible viewport below its top: [scroll area] + [box]. The page's own padding under it is
// cancelled, so the document is exactly the viewport's height and the window never scrolls (only the scroll area does)
export const pageFit = (viewH, top, pagePad = 0) => ({ height: Math.max(0, Math.round(viewH - top)), marginBottom: -pagePad })
