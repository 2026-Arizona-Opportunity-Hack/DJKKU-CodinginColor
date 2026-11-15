import { handleTranscript } from '../../shared/transcript/handler'
import type { Env } from '../_lib/env'

// GET /api/transcript?videoId=...: the real transcript of a lesson video (YouTube captions via
// Supadata), cached in the database. The logic is in shared/transcript/handler.ts so it can be
// tested without Cloudflare.
export const onRequestGet: PagesFunction<Env> = ({ request, env }) => handleTranscript(request, env)
