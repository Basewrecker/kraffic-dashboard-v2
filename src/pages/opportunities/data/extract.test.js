// Your data v1: reading files in the browser (extract.js). PDF needs pdf.js and a browser: tests/your-data.browser.test.mjs.
// Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BYTES, countWords, docxText, kindOf, readFile, rejectReason, roundWords, unzipEntry, wordXmlText, wordsLabel } from './extract.js'
import { makeDocx, makeTxt, makeZip, words } from '../../../../tests/makeFiles.mjs'

// a File-like (Node 18 has Blob, not File)
const file = (name, buf, type = '') => Object.assign(new Blob([buf], { type }), { name })
const deflateRaw = (() => { try { new DecompressionStream('deflate-raw'); return true } catch { return false } })()

test('limits: PDF, DOCX, CSV or TXT by extension AND MIME, up to 10 MB, 5 files', () => {
  assert.equal(rejectReason({ name: 'a.pdf', type: 'application/pdf', size: 1 }), null)
  assert.equal(rejectReason({ name: 'a.DOCX', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1 }), null)
  assert.equal(rejectReason({ name: 'a.csv', type: 'application/vnd.ms-excel', size: 1 }), null) // Windows' CSV type
  assert.equal(rejectReason({ name: 'a.txt', type: '', size: 1 }), null) // the browser didn't know
  assert.equal(rejectReason({ name: 'a.png', type: 'image/png', size: 1 }), 'Not a PDF, DOCX, CSV or TXT')
  assert.equal(rejectReason({ name: 'a.doc', type: 'application/msword', size: 1 }), 'Not a PDF, DOCX, CSV or TXT')
  assert.equal(rejectReason({ name: 'a.pdf', type: 'image/png', size: 1 }), 'Not a PDF, DOCX, CSV or TXT') // renamed image
  assert.equal(rejectReason({ name: 'pdf', type: '', size: 1 }), 'Not a PDF, DOCX, CSV or TXT')
  assert.equal(rejectReason({ name: 'a.txt', type: 'text/plain', size: MAX_BYTES }), null)
  assert.equal(rejectReason({ name: 'a.txt', type: 'text/plain', size: MAX_BYTES + 1 }), 'Over 10 MB')
  assert.equal(rejectReason({ name: 'a.txt', type: 'text/plain', size: 1 }, 4), null)
  assert.equal(rejectReason({ name: 'a.txt', type: 'text/plain', size: 1 }, 5), 'Only 5 files at a time')
  assert.deepEqual(['a.pdf', 'b.Csv', 'c.txt', 'd.docx', 'e.xlsx'].map(kindOf), ['pdf', 'csv', 'txt', 'docx', null])
})

test('word count and "~1,200 words"', () => {
  assert.equal(countWords('Hello, world.  Two\nlines'), 4)
  assert.equal(countWords("don't 3.5 e-mail café"), 4)
  assert.equal(countWords('label,value\nNiacinamide,10%\npH,5.5'), 6) // CSV cells split on commas
  assert.equal(countWords(''), 0)
  assert.deepEqual([1, 7, 12, 99, 238, 1234, 12345, 999].map(roundWords), [1, 7, 12, 99, 240, 1200, 12000, 1000])
  assert.equal(wordsLabel(1234), '~1,200 words')
  assert.equal(wordsLabel(1), '~1 word')
  assert.equal(wordsLabel(5), '~5 words')
})

test('TXT and CSV: read as text, tidied (BOM, CRLF, blank runs)', async () => {
  const t = await readFile(file('notes.txt', makeTxt('﻿First line  \r\n\r\n\r\n\r\nSecond line'), 'text/plain'))
  assert.deepEqual(t, { text: 'First line\n\nSecond line', words: 4 })
  const c = await readFile(file('ingredients.csv', makeTxt('Ingredient,Percent\r\nAzelaic acid,15%\r\n'), 'text/csv'))
  assert.equal(c.text, 'Ingredient,Percent\nAzelaic acid,15%')
  assert.equal(c.words, 5)
})

test('an empty or text-less file can\'t be read', async () => {
  await assert.rejects(readFile(file('empty.txt', makeTxt('  \n '), 'text/plain')), { message: 'No text found' })
})

test('DOCX: <w:t> runs, a line per paragraph, tabs and breaks, entities decoded', async () => {
  assert.equal(wordXmlText('<w:body><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>Clinic</w:t></w:r><w:r><w:t xml:space="preserve"> hours</w:t></w:r></w:p><w:p/><w:p w:rsidR="00A1"><w:r><w:t>Mon</w:t><w:tab/><w:t>9&amp;6 &lt;ok&gt; &#8211; &#x2014;</w:t><w:br/><w:t>Sat</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>'),
    'Clinic hours\n\nMon\t9&6 <ok> – —\nSat\ncell\n')
  // a real (stored) docx zip
  const t = await readFile(file('clinic.docx', makeDocx(['Our clinic is at 14 King Street, Manchester.', 'Open\tMonday to Saturday'], { deflate: false })))
  assert.equal(t.text, 'Our clinic is at 14 King Street, Manchester.\nOpen\tMonday to Saturday')
  assert.equal(t.words, 12)
})

test('DOCX deflated (as Word writes it): the browser\'s DecompressionStream', { skip: !deflateRaw && 'this Node has no deflate-raw (the browser test covers it)' }, async () => {
  const t = await docxText(makeDocx(['Deflated text reads too.']).buffer)
  assert.equal(t.trim(), 'Deflated text reads too.')
})

test('zip reader: finds the entry, null when it isn\'t there; a non-zip or damaged file fails', async () => {
  const z = makeZip({ 'a.txt': 'alpha', 'word/document.xml': '<w:p><w:r><w:t>x</w:t></w:r></w:p>' }, { deflate: false })
  assert.equal(await unzipEntry(z, 'a.txt'), 'alpha')
  assert.equal(await unzipEntry(z, 'missing.xml'), null)
  await assert.rejects(readFile(file('notes.docx', makeTxt(words(50)))), { message: 'Damaged or unsupported file' })
  await assert.rejects(readFile(file('other.docx', makeZip({ 'a.txt': 'not word' }, { deflate: false }))), { message: 'Damaged or unsupported file' })
  const broken = Buffer.from(z)
  broken.writeUInt32LE(0, broken.length - 22 + 16) // central directory offset → 0 (a local header, not a central one)
  await assert.rejects(readFile(file('broken.docx', broken)), { message: 'Damaged or unsupported file' })
})
