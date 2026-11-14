import { handleLearningGain } from '../../../shared/api/handler'
import { apiDeps, notConfigured } from '../../_lib/apiDeps'
import type { Env } from '../../_lib/env'

// GET /api/v1/learning-gain: read API, needs a key with the `assessments` scope.
// The logic is in shared/api/handler.ts so it can be tested without Cloudflare.
export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  const deps = apiDeps(env)
  return deps ? handleLearningGain(request, deps) : notConfigured()
}
