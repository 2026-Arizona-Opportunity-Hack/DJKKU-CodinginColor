import type { Env } from '../_lib/env'

// Cloudflare Pages does not apply public/_headers to Functions, so every /api response gets its
// security headers here (SECURITY_QA_CHECKLIST S-50). Handlers that set their own Cache-Control keep it.
const HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

export const onRequest: PagesFunction<Env> = async ({ next }) => {
  const res = await next()
  // Static files under /api (the API docs page) get their headers from public/_headers instead.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) return res
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(HEADERS)) out.headers.set(k, v)
  if (!out.headers.has('Cache-Control')) out.headers.set('Cache-Control', 'no-store')
  out.headers.delete('Access-Control-Allow-Origin')
  return out
}
