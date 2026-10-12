// Setup → "Products & topics": how a product/topic maps onto tracked prompts. Used for the chip counts and
// for /prompts?topic=<name>, so both always agree. (The list itself lives in mock.js → productsTopics.)
import { trackedPrompts } from './mock.js'

// a topic matches a prompt on its distinctive words: "Ceramide moisturizer" → "ceramide", "Under-eye cream" → "under eye".
// Product nouns only count when they're the whole topic ("Sunscreen").
const GENERIC = new Set(['serum', 'serums', 'cream', 'creams', 'moisturizer', 'moisturizers', 'lotion', 'balm', 'wash', 'gel', 'oil'])
const words = (topic) => {
  const all = topic.toLowerCase().replace(/[-/]/g, ' ').split(/\s+/).filter(Boolean)
  const key = all.filter((w) => !GENERIC.has(w))
  return (key.length ? key : all).map((w) => w.replace(/s$/, ''))
}
export function matchesTopic(topic, text) {
  const q = text.toLowerCase().replace(/-/g, ' ')
  return words(topic).every((w) => q.includes(w))
}
export const topicPromptCount = (topic) => trackedPrompts.filter((p) => matchesTopic(topic, p.prompt)).length
// something typed in: a product if it names a product kind, else a topic
export const guessTopicType = (name) => (name.toLowerCase().split(/[\s-]+/).some((w) => GENERIC.has(w)) ? 'product' : 'topic')
