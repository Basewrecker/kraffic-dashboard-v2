import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdown, parseInline, plainOf, safeHref, toHtml, toMarkdown } from './markdown.js'

const HOSTILE = [
  '# Title',
  '',
  '<script>alert(1)</script>',
  '',
  '<img src=x onerror=alert(1)>',
  '',
  '- [click](javascript:alert(1)) and [x](JAVASCRIPT:alert(1)) and [y]( javascript:alert(1))',
  '- <a href="javascript:alert(1)">z</a> or [d](data:text/html,<script>alert(1)</script>) or [v](vbscript:x) or [rel](/guides/x)',
  '- a [safe link](https://healthline.com/guides/safe) and a bare one https://byrdie.com/a.',
].join('\n')

const links = (blocks) => {
  const out = []
  const walk = (inl) => inl.forEach((n) => { if (n.t === 'link') out.push(n); if (n.c) walk(n.c) })
  blocks.forEach((b) => (b.items ? b.items.forEach(walk) : walk(b.inline)))
  return out
}

test('safeHref: only http(s), after trimming; everything else is not a link', () => {
  assert.equal(safeHref('https://a.com/x'), 'https://a.com/x')
  assert.equal(safeHref('  http://a.com '), 'http://a.com/')
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'mailto:a@b.c', '/guides/x', '//evil.com', 'https//x']) assert.equal(safeHref(bad), null, bad)
})

test('hostile Markdown: no script/img/on* in the HTML, non-http(s) links are text, https links keep their rel', () => {
  const blocks = parseMarkdown(HOSTILE)
  const html = toHtml(blocks)
  assert.ok(!/<script/i.test(html), 'no <script')
  assert.ok(!/<img/i.test(html), 'no <img')
  assert.ok(!/<[^>]+\son\w+=/i.test(html), 'no on* attribute inside any tag')
  assert.ok(!/href="(?!https?:)/i.test(html), 'every href is http(s)')
  assert.ok(!/javascript:/i.test(html.match(/href="[^"]*"/g)?.join(' ') ?? ''), 'no javascript: href')
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'raw HTML is escaped text')
  const ls = links(blocks)
  assert.deepEqual(ls.map((l) => l.href), ['https://healthline.com/guides/safe', 'https://byrdie.com/a'])
  assert.ok(html.includes('<a href="https://healthline.com/guides/safe" target="_blank" rel="noopener noreferrer">safe link</a>'))
  // the bad links' text survives as text
  assert.ok(plainOf(blocks[3].items[0]).startsWith('click and x and y'))
  // Copy content (Markdown): raw HTML can't come back as HTML either
  const md = toMarkdown(blocks)
  assert.ok(!/<script|<img|<a /i.test(md))
  assert.ok(!/\]\((?!https?:)/i.test(md), 'no non-http(s) link in the Markdown')
})

test('parseMarkdown: the draft lib\'s structure', () => {
  const blocks = parseMarkdown('# Q?\n\n> **Draft for client review** — verify.\n\n## Steps\n\n1. **One** — a.\n\n2. **Two** — b.\n\n## FAQ\n\n### Why?\n\nBecause\nit works.\n\n- a\n- b\nafter')
  assert.deepEqual(blocks.map((b) => b.type), ['h1', 'quote', 'h2', 'ol', 'h2', 'h3', 'p', 'ul', 'p'])
  assert.equal(blocks[3].items.length, 2)
  assert.equal(plainOf(blocks[6].inline), 'Because it works.')
  assert.deepEqual(parseInline('**bold** and *em* and `code`').map((n) => n.t), ['strong', 'text', 'em', 'text', 'code'])
  assert.deepEqual(parseInline('snake_case_word').map((n) => n.t), ['text'])
})
