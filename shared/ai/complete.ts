import { MODEL, providerOf, type HintEnv } from '../hint/handler'

// One JSON answer from whichever AI provider the deployment is configured with. Which provider and model
// are used is decided by the Cloudflare environment (AI_GATEWAY_URL, AI_GATEWAY_KEY, AI_MODEL, or
// GEMINI_API_KEY), through the same providerOf() the hint endpoint uses. Callers never pick a model.

export type AiEnv = HintEnv
export const aiConfigured = (env: AiEnv) => providerOf(env) !== null

/** The JSON object in a reply, even when a model wraps it in prose or a ```json fence. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Asks for a JSON object. Null for any problem (not configured, timeout, HTTP error, no JSON). */
export async function completeJson(
  env: AiEnv,
  f: typeof fetch,
  system: string,
  prompt: string,
  { timeoutMs = 40_000, maxTokens = 8000 }: { timeoutMs?: number; maxTokens?: number } = {},
): Promise<unknown> {
  const p = providerOf(env)
  if (!p) return null
  try {
    if (p.kind === 'gateway') {
      const res = await f(`${p.url}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: maxTokens }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
      const content = data.choices?.[0]?.message?.content
      return typeof content === 'string' ? extractJson(content) : null
    }
    const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': p.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const text = (data.candidates?.[0]?.content?.parts ?? []).filter((x) => !x.thought && typeof x.text === 'string').map((x) => x.text).join('')
    return extractJson(text)
  } catch {
    return null
  }
}
