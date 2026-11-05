// Your data (Content workspace, v1): reading uploaded files IN THE BROWSER. Nothing is uploaded or stored on a server;
// the text read here goes into the draft request's userFacts (data/userFacts.js) and this browser's localStorage only.
//   TXT, CSV: File.text().
//   DOCX: a zip. A minimal central-directory reader finds word/document.xml, the browser's DecompressionStream
//     ('deflate-raw') inflates it, and the text is the <w:t> runs, a line per <w:p> paragraph (<w:tab/> → tab,
//     <w:br/> → line break). No dependency.
//   PDF: pdf.js (pdfjs-dist), loaded only when a PDF is read (dynamic import; its worker is a separate file, Vite ?url).
// Limits: PDF, DOCX, CSV or TXT (extension AND, when the browser gives one, MIME type), up to 10 MB each, 5 files.
// A file that yields no words (a scanned PDF with no text layer, an empty file) counts as unreadable, like a damaged or
// password-protected one: the row says "Couldn't read this file".

export const MAX_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 5
export const KINDS = ['pdf', 'docx', 'csv', 'txt']
export const ACCEPT = '.pdf,.docx,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain'
// the MIME types each kind may arrive with ('' and octet-stream: the browser didn't know)
const MIME = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'text/comma-separated-values'],
  txt: ['text/plain'],
}
const UNKNOWN_MIME = ['', 'application/octet-stream']

export const kindOf = (name) => {
  const ext = String(name).split('.').pop().toLowerCase()
  return KINDS.includes(ext) && String(name).includes('.') ? ext : null
}

// why a file can't be added (the row's error), or null. accepted: how many files are already in the list
export function rejectReason(file, accepted = 0) {
  const kind = kindOf(file.name)
  const mime = String(file.type ?? '').toLowerCase()
  if (!kind || !(UNKNOWN_MIME.includes(mime) || MIME[kind].includes(mime))) return 'Not a PDF, DOCX, CSV or TXT'
  if (file.size > MAX_BYTES) return 'Over 10 MB'
  if (accepted >= MAX_FILES) return `Only ${MAX_FILES} files at a time`
  return null
}

// words: runs of letters / digits ("don't", "3.5", "e-mail" are one word; CSV cells split on the commas)
export const countWords = (text) => (String(text).match(/[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu) ?? []).length

// "~1,200 words": exact under 100, then to the nearest 10, 100 or 1,000 (two significant figures, roughly)
const nf = new Intl.NumberFormat('en-US')
export function roundWords(n) {
  if (n < 100) return n
  const step = n < 1000 ? 10 : n < 10000 ? 100 : 1000
  return Math.max(step, Math.round(n / step) * step)
}
export const wordsLabel = (n) => `~${nf.format(roundWords(n))} ${n === 1 ? 'word' : 'words'}`

export class ReadError extends Error {}
const BAD = 'Damaged or unsupported file'

// → { text, words }; throws ReadError (the reason, for the row's title) when there's no readable text
export async function readFile(file) {
  const kind = kindOf(file.name)
  let text
  try {
    if (kind === 'pdf') text = await pdfText(await file.arrayBuffer())
    else if (kind === 'docx') text = await docxText(await file.arrayBuffer())
    else text = await file.text()
  } catch (e) {
    throw new ReadError(e instanceof ReadError ? e.message : e?.name === 'PasswordException' ? 'Password-protected' : BAD)
  }
  text = tidy(text)
  const words = countWords(text)
  if (!words) throw new ReadError(kind === 'pdf' ? 'No text found (a scanned PDF?)' : 'No text found')
  return { text, words }
}

// one blank line at most, no trailing spaces, no BOM
export const tidy = (s) => String(s).replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

// ---- DOCX ----------------------------------------------------------------------------------------------------------
export async function docxText(buffer) {
  const xml = await unzipEntry(buffer, 'word/document.xml')
  if (xml == null) throw new ReadError(BAD)
  return wordXmlText(xml)
}

// word/document.xml → text: <w:t> runs, a newline after each <w:p>, <w:tab/> and <w:br/>
export function wordXmlText(xml) {
  const out = []
  const re = /<w:p(?=[\s>/])[^>]*?(\/?)>|<\/w:p>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>/g
  let m
  while ((m = re.exec(xml))) {
    const tag = m[0]
    if (tag.startsWith('</w:p')) out.push('\n')
    else if (tag.startsWith('<w:p')) { if (m[1]) out.push('\n') }
    else if (tag.startsWith('<w:tab')) out.push('\t')
    else if (tag.startsWith('<w:br')) out.push('\n')
    else out.push(decodeXml(m[2]))
  }
  return out.join('')
}

const decodeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]
})

// one file out of a zip, as text (null when it isn't there). Stored (method 0) or deflated (8) entries; no zip64, no
// encryption (both throw).
export async function unzipEntry(buffer, name) {
  const bytes = new Uint8Array(buffer)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // the end-of-central-directory record: in the last 22 + 65,535 bytes (a comment may follow it)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new ReadError(BAD)
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  for (let n = 0; n < count; n += 1) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw new ReadError(BAD)
    const flags = dv.getUint16(p + 8, true)
    const method = dv.getUint16(p + 10, true)
    const size = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const entry = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (entry !== name) continue
    if (flags & 1) throw new ReadError('Password-protected')
    if (dv.getUint32(local, true) !== 0x04034b50) throw new ReadError(BAD)
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
    const data = bytes.subarray(start, start + size)
    if (method === 0) return dec.decode(data)
    if (method === 8) return dec.decode(await inflateRaw(data))
    throw new ReadError(BAD)
  }
  return null
}

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ---- PDF (pdf.js, lazy) --------------------------------------------------------------------------------------------
let pdfjs = null
async function loadPdfjs() {
  if (!pdfjs) {
    const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    lib.GlobalWorkerOptions.workerSrc = worker.default
    pdfjs = lib
  }
  return pdfjs
}

// every page's text items; a line break where pdf.js marks the end of a line, a blank line between pages
export async function pdfText(buffer) {
  const lib = await loadPdfjs()
  const doc = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise
  try {
    const pages = []
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((it) => (it.str ?? '') + (it.hasEOL ? '\n' : '')).join(''))
      page.cleanup()
    }
    return pages.join('\n\n')
  } finally {
    doc.destroy()
  }
}
