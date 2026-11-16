// Small real files for the Your data tests, made in the test (nothing binary committed): a TXT, a DOCX (a real zip:
// [Content_Types].xml, _rels/.rels, word/document.xml; stored or deflated) and a one-page PDF with a text layer
// (Helvetica, one line per entry, a correct xref table). No dependencies: node:zlib for the deflate, a CRC-32 table.
import { deflateRawSync } from 'node:zlib'

export const words = (n, seed = 'clinic') => Array.from({ length: n }, (_, i) => `${seed}${i % 97}`).join(' ')
export const makeTxt = (text) => Buffer.from(text, 'utf8')

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

// a zip of { name: string } entries; deflate: method 8 (as Word writes them), else stored (method 0)
export function makeZip(entries, { deflate = true } = {}) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text, 'utf8')
    const data = deflate ? deflateRawSync(raw) : raw
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(deflate ? 8 : 0, 8)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(deflate ? 8 : 0, 10)
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBuf, data)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// paragraphs: [string] (a tab inside a paragraph becomes <w:tab/>)
export function makeDocx(paragraphs, opts) {
  const body = paragraphs.map((p) => `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>${p.split('\t').map((t, i) => `${i ? '<w:r><w:tab/></w:r>' : ''}<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('')}</w:p>`).join('')
  return makeZip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`,
  }, opts)
}

// a one-page PDF; lines: [string], drawn top-down
export function makePdf(lines) {
  const pdfEsc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const content = `BT /F1 11 Tf 14 TL 72 740 Td ${lines.map((l) => `(${pdfEsc(l)}) Tj T*`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const at = []
  objs.forEach((o, i) => { at.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
