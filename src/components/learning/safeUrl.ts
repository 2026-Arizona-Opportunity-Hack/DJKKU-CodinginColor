import { defaultUrlTransform } from 'react-markdown'

/** Only http, https and mailto links survive in lesson content; everything else is dropped. */
export function safeUrl(url: string): string {
  const cleaned = defaultUrlTransform(url)
  return /^(https?:|mailto:)/i.test(cleaned) ? cleaned : ''
}
