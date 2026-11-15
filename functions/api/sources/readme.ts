import { handleReadme } from '../../../shared/sources/handler'
import { sourcesCache } from '../../_lib/cache'
import type { Env } from '../../_lib/env'

// POST /api/sources/readme: an openly licensed GitHub README, ready to add to a lesson as a reading.
// The logic is in shared/sources/handler.ts so it can be tested without Cloudflare.
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleReadme(request, env, { cache: sourcesCache() })
