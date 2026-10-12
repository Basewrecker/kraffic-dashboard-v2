// Jump to a dashboard section: optional sort for a PromptTable, smooth scroll clear of any sticky
// header (+16px), then a brief ink ring on the target card once the scroll lands.
export const SECTION_EVENT = 'section:show'
const FLASH_MS = 1200

export function goToSection(id, { sort } = {}) {
  const el = document.getElementById(id)
  if (!el) return
  // PromptTable listens for its own id and applies the sort (resetting to page 1) before we scroll
  if (sort) window.dispatchEvent(new CustomEvent(SECTION_EVENT, { detail: { id, sort } }))

  const header = document.querySelector('[data-sticky-header]')
  el.style.scrollMarginTop = `${(header?.offsetHeight ?? 0) + 16}px`
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  // flash after the scroll settles (scrollend where supported, else a timeout)
  let done = false
  const flash = () => {
    if (done) return
    done = true
    el.classList.remove('section-flash')
    void el.offsetWidth // restart the animation if it's already running
    el.classList.add('section-flash')
    setTimeout(() => el.classList.remove('section-flash'), FLASH_MS)
  }
  if ('onscrollend' in window) window.addEventListener('scrollend', flash, { once: true })
  setTimeout(flash, 900) // fallback, and covers "already in place" (no scroll → no scrollend)
}
