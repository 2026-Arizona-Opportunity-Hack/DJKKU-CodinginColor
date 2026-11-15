import { handleHint } from '../../shared/hint/handler'
import type { Env } from '../_lib/env'

// POST /api/hint: one hint for a student who got an answer wrong. The logic is in
// shared/hint/handler.ts so it can be tested without Cloudflare.
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleHint(request, env)
