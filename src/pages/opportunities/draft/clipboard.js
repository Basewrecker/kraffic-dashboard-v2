// Clipboard and download for the draft's actions. The payloads come from draft/recommend.js copyPayloads (built from
// the parsed tree, escaped); nothing here touches the raw Markdown except Export .md, which saves it as a text file.
export async function writeClipboard(plain, html) {
  if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })])
  } else {
    await navigator.clipboard.writeText(plain)
  }
}
export function download(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
