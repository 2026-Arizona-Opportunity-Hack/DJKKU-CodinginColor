import { handleCompletion } from '../../../shared/api/handler'
import { apiDeps, notConfigured } from '../../_lib/apiDeps'
import type { Env } from '../../_lib/env'

// GET /api/v1/completion: read API, needs a key with the `progress` scope.
// The logic is in shared/api/handler.ts so it can be tested without Cloudflare.
export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  const deps = apiDeps(env)
  return deps ? handleCompletion(request, deps) : notConfigured()
}
