// the Reports composer's sizes: the text grows a line at a time up to 8 lines, then scrolls inside itself;
// in a thread the box is fixed 16px above the viewport's bottom, over a 48px fade, and the thread keeps 32px clear above it
export const LINE = 24
export const MAX_LINES = 8
export const BOTTOM_GAP = 16
export const FADE = 48
export const CLEAR = 32
export const DOWN_GAP = 12

// the text area's height from its content: one line while empty (a long placeholder never makes it taller)
export const textHeight = (value, scrollHeight) => {
  const max = LINE * MAX_LINES
  if (!value) return { height: LINE, scroll: false }
  return { height: Math.min(max, Math.max(LINE, scrollHeight)), scroll: scrollHeight > max }
}

// the thread's bottom padding (less what the page already adds below it) and the ↓ button's offset from the bottom
export const dockSpace = (composerH, pagePad = 0) => ({
  pad: Math.max(0, BOTTOM_GAP + composerH + CLEAR - pagePad),
  down: BOTTOM_GAP + composerH + DOWN_GAP,
})
