import type { Env } from '../_lib/env'

// Cloudflare Pages Function, served at /api/health. A deploy smoke test: if this
// returns JSON, the static site and the Functions runtime are both live.
// New endpoints follow the same pattern: functions/api/<name>.ts exporting onRequest<Method>.
export const onRequestGet: PagesFunction<Env> = () =>
  Response.json({ ok: true, service: 'djkku-coding-in-color' })
