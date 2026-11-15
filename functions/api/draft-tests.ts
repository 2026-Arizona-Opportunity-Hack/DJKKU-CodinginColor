import { handleDraftTests } from '../../shared/authoring/draftTests'
import type { Env } from '../_lib/env'

// POST /api/draft-tests: an AI draft of a paired pre-test and post-test from a module's material, for
// an author to review. Authors and admins only. The logic is in shared/authoring/draftTests.ts.
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleDraftTests(request, env)
