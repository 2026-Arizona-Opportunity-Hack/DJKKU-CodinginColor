import { handleSourceSearch } from '../../../shared/sources/handler'
import { sourcesCache } from '../../_lib/cache'
import type { Env } from '../../_lib/env'

// POST /api/sources/search: authors look for videos and readings on a topic. The logic is in
// shared/sources/handler.ts so it can be tested without Cloudflare.
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleSourceSearch(request, env, { cache: sourcesCache() })
