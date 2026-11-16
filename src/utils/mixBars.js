// Sentiment's Mix columns (pages/insights/SentimentPage.jsx Over time), shared: one stacked column's segments, bottom
// up in `order`, each segment's top and height on the y scale, a 2px page-colour gap under every segment but the
// lowest one shown, the top segment's corners rounded (3px, never more than its height). A value of 0 (or a hidden
// segment) is still returned, 0 tall, so a column can animate between states.
//   valueOf(key) → the segment's value in the scale's units (0 = not shown)
export function stackSegments(order, valueOf, y, { gap = 2, radius = 3 } = {}) {
  const shown = order.filter((k) => valueOf(k))
  const top = shown.at(-1)
  let acc = 0
  return order.map((key) => {
    const on = shown.includes(key)
    const from = acc
    if (on) acc += valueOf(key)
    const yTop = y(on ? acc : from)
    const yBot = y(from) - (on && key !== shown[0] ? gap : 0)
    const h = Math.max(0, yBot - yTop)
    return { key, on, yTop, h, r: key === top ? Math.min(radius, h) : 0 }
  })
}
