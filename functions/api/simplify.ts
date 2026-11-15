import { handleSimplify } from '../../shared/simplify/handler'
import { sourcesCache } from '../_lib/cache'
import type { Env } from '../_lib/env'

// POST /api/simplify: "Explain it for my grade" for a reading or video. The logic is in
// shared/simplify/handler.ts. Rewrites are the same for every student of a grade, so they are cached.
const cache = sourcesCache(7 * 24 * 60 * 60)
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleSimplify(request, env, { cache })
