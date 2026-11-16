// A small, safe Markdown parser for content-recommend's contentMarkdown, and its serializers. Pure; no DOM.
// SAFETY (the draft is model output with text scraped from third-party pages):
//   - The tree holds text only. It's rendered as React text nodes (never dangerouslySetInnerHTML), so raw HTML in the
//     Markdown (<script>, <img onerror>, <a href="javascript:…">) is shown as literal text, never as HTML.
//   - A link becomes a link only when its URL, trimmed, parses with the http: or https: scheme. Anything else
//     (javascript:, JAVASCRIPT:, " javascript:", data:, vbscript:, mailto:, relative) renders as its plain text.
//     Links open in a new tab with rel="noopener noreferrer".
//   - toHtml (Copy as HTML) builds HTML from the same tree, escaping every text node and attribute; it never reuses
//     the raw string. toMarkdown (Copy content) re-serializes the tree and escapes < and > in text.
// Grammar (what the draft lib writes): # / ## / ### headings, > blockquote lines, - or * bullets, 1. numbered items
// (blank lines between items allowed), paragraphs; inline **bold**, *italic*, `code`, [text](url) and bare https URLs.
// Pipe tables aren't parsed (the lib bans them): they stay paragraph text.

// block: { type: 'h1'|'h2'|'h3'|'p'|'quote', inline } | { type: 'ul'|'ol', items: [inline] }
// inline: [{ t: 'text', v } | { t: 'strong'|'em', c: inline } | { t: 'code', v } | { t: 'link', href, c: inline }]
export function parseMarkdown(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let para = []
  const flush = () => { if (para.length) { blocks.push({ type: 'p', inline: parseInline(para.join(' ')) }); para = [] } }
  const last = () => blocks[blocks.length - 1]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      flush()
      continue
    }
    let m
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); blocks.push({ type: `h${m[1].length}`, inline: parseInline(m[2].trim()) }); continue }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); blocks.push({ type: 'quote', inline: parseInline(m[1]) }); continue }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flush()
      if (last()?.type === 'ul' && last().open) last().items.push(parseInline(m[1]))
      else blocks.push({ type: 'ul', items: [parseInline(m[1])], open: true })
      continue
    }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      flush()
      // numbered items may be separated by blank lines (the lib writes "1. …\n\n2. …"): keep one list
      if (last()?.type === 'ol') last().items.push(parseInline(m[1]))
      else blocks.push({ type: 'ol', items: [parseInline(m[1])] })
      continue
    }
    // a plain line: closes an open bullet list; continues a paragraph
    if (last()?.type === 'ul') last().open = false
    para.push(line)
  }
  flush()
  return blocks.map(({ open, ...b }) => b) // eslint-disable-line no-unused-vars
}

// http(s) only, after trimming; anything else isn't a link
export function safeHref(url) {
  const u = String(url ?? '').trim()
  if (!/^https?:\/\//i.test(u)) return null
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

const URL_RE = /https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g
export function parseInline(text) {
  const out = []
  const s = String(text ?? '')
  let i = 0
  let buf = ''
  const push = (node) => { if (buf) { out.push(...bareUrls(buf)); buf = '' } out.push(node) }
  while (i < s.length) {
    const rest = s.slice(i)
    let m
    if ((m = rest.match(/^\*\*(.+?)\*\*/))) { push({ t: 'strong', c: parseInline(m[1]) }); i += m[0].length; continue }
    if ((m = rest.match(/^`([^`]+)`/))) { push({ t: 'code', v: m[1] }); i += m[0].length; continue }
    if ((m = rest.match(/^\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/))) { // the URL may hold one level of (…)
      const href = safeHref(m[2])
      if (href) push({ t: 'link', href, c: parseInline(m[1]) })
      else { buf += m[1] } // not http(s): its text only
      i += m[0].length
      continue
    }
    if ((m = rest.match(/^\*([^*\s][^*]*?)\*/)) || (m = rest.match(/^_([^_\s][^_]*?)_(?![A-Za-z0-9])/))) {
      if (/[A-Za-z0-9]$/.test(buf) && rest[0] === '_') { buf += rest[0]; i += 1; continue } // snake_case stays text
      push({ t: 'em', c: parseInline(m[1]) }); i += m[0].length; continue
    }
    buf += s[i]
    i += 1
  }
  if (buf) out.push(...bareUrls(buf))
  return out
}
// bare https URLs in text become links (the Sources bullets are "note — https://…")
function bareUrls(text) {
  const out = []
  let at = 0
  for (const m of text.matchAll(URL_RE)) {
    const href = safeHref(m[0])
    if (!href) continue
    if (m.index > at) out.push({ t: 'text', v: text.slice(at, m.index) })
    out.push({ t: 'link', href, c: [{ t: 'text', v: m[0] }], bare: true })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ t: 'text', v: text.slice(at) })
  return out
}

// the inline's plain text (for matching, search, alt text)
export const plainOf = (inline) => inline.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : plainOf(n.c))).join('')

// ---- serializers --------------------------------------------------------------------------------------------------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c])
const inlineHtml = (inline) => inline.map((n) => {
  if (n.t === 'text') return escapeHtml(n.v)
  if (n.t === 'code') return `<code>${escapeHtml(n.v)}</code>`
  if (n.t === 'strong') return `<strong>${inlineHtml(n.c)}</strong>`
  if (n.t === 'em') return `<em>${inlineHtml(n.c)}</em>`
  if (n.t === 'link') { const href = safeHref(n.href); return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inlineHtml(n.c)}</a>` : inlineHtml(n.c) }
  return ''
}).join('')
export function toHtml(blocks) {
  return blocks.map((b) => {
    if (b.type === 'ul' || b.type === 'ol') return `<${b.type}>\n${b.items.map((it) => `  <li>${inlineHtml(it)}</li>`).join('\n')}\n</${b.type}>`
    if (b.type === 'quote') return `<blockquote><p>${inlineHtml(b.inline)}</p></blockquote>`
    return `<${b.type}>${inlineHtml(b.inline)}</${b.type}>`
  }).join('\n')
}

const mdText = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inlineMd = (inline) => inline.map((n) => {
  if (n.t === 'text') return mdText(n.v)
  if (n.t === 'code') return `\`${n.v.replace(/`/g, '')}\``
  if (n.t === 'strong') return `**${inlineMd(n.c)}**`
  if (n.t === 'em') return `*${inlineMd(n.c)}*`
  if (n.t === 'link') return n.bare ? n.href : `[${inlineMd(n.c)}](${n.href})`
  return ''
}).join('')
export function toMarkdown(blocks) {
  return `${blocks.map((b) => {
    if (b.type === 'ul') return b.items.map((it) => `- ${inlineMd(it)}`).join('\n')
    if (b.type === 'ol') return b.items.map((it, i) => `${i + 1}. ${inlineMd(it)}`).join('\n')
    if (b.type === 'quote') return `> ${inlineMd(b.inline)}`
    const hashes = { h1: '#', h2: '##', h3: '###' }[b.type]
    return hashes ? `${hashes} ${inlineMd(b.inline)}` : inlineMd(b.inline)
  }).join('\n\n')}\n`
}
// plain text (for the clipboard's text/plain beside the HTML)
export function toPlain(blocks) {
  return blocks.map((b) => (b.items ? b.items.map((it, i) => `${b.type === 'ol' ? `${i + 1}.` : '•'} ${plainOf(it)}`).join('\n') : plainOf(b.inline))).join('\n\n')
}
