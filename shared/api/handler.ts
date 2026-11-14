import { z } from 'zod'
import { toCsv } from '../authoring/csv'
import { buildCompletion, buildLearningGain } from './aggregate'
import { extractBearerToken } from './apiKey'
import type { ApiDataSource } from './source'
import type { ApiErrorCode, ApiResponse, ApiScope } from './types'

// The read API's request handling, kept free of Cloudflare specifics so it runs the
// same in tests and in functions/api/v1/*. Order matters: check the key first so a
// caller without one learns nothing, then the parameters, then touch the data.

export interface ApiDeps {
  data: ApiDataSource
  now?: () => Date
}

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: Record<string, string> = {},
): Response {
  return Response.json({ error: { code, message } }, { status, headers: { ...SECURITY_HEADERS, ...extra } })
}

/** Returns an error Response to send, or null when the key may read `needed`. */
async function authorize(
  request: Request,
  deps: ApiDeps,
  needed: ApiScope,
): Promise<Response | null> {
  const token = extractBearerToken(request.headers.get('authorization'))
  const unauthorized = () =>
    errorResponse(401, 'unauthorized', 'A valid API key is required.', {
      'WWW-Authenticate': 'Bearer',
    })
  if (!token) return unauthorized()

  let info
  try {
    info = await deps.data.validateKey(token)
  } catch {
    return unavailable()
  }
  // Unknown and revoked look the same on purpose.
  if (!info) return unauthorized()
  if (!info.scope.includes(needed)) {
    return errorResponse(403, 'forbidden', `This key is not allowed to read ${needed} data.`)
  }
  return null
}

function unavailable(): Response {
  return errorResponse(503, 'unavailable', 'The data is temporarily unavailable. Try again later.')
}

const QuerySchema = z
  .object({
    group_by: z.enum(['class', 'cohort']).default('class'),
    cohort: z.string().trim().min(1).max(120).optional(),
    format: z.enum(['json', 'csv']).default('json'),
  })
  .strict()

type Query = z.infer<typeof QuerySchema>

function parseQuery(request: Request): { query: Query } | { error: Response } {
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (parsed.success) return { query: parsed.data }
  const issue = parsed.error.issues[0]
  const message =
    issue.code === 'unrecognized_keys'
      ? `Unknown parameter: ${issue.keys.join(', ')}.`
      : `${issue.path.join('.') || 'query'}: ${issue.message}`
  return { error: errorResponse(400, 'invalid_parameter', message) }
}

function respond<Row>(
  rows: Row[],
  format: Query['format'],
  name: string,
  csv: { header: string[]; cells: (row: Row) => (string | number | null)[] },
  asOf: string,
): Response {
  if (format === 'csv') {
    return new Response(toCsv(csv.header, rows.map(csv.cells)), {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}.csv"`,
        'X-As-Of': asOf,
      },
    })
  }
  const body: ApiResponse<Row> = { as_of: asOf, api_version: 'v1', rows }
  return Response.json(body, { headers: SECURITY_HEADERS })
}

/** GET /api/v1/completion. Needs the `progress` scope. */
export async function handleCompletion(request: Request, deps: ApiDeps): Promise<Response> {
  const denied = await authorize(request, deps, 'progress')
  if (denied) return denied
  const parsed = parseQuery(request)
  if ('error' in parsed) return parsed.error
  const { group_by, cohort, format } = parsed.query

  let source
  try {
    source = await deps.data.classProgress()
  } catch {
    return unavailable()
  }
  const rows = buildCompletion(source, group_by, cohort)
  return respond(
    rows,
    format,
    'completion',
    {
      header: ['cohort', 'class', 'students', 'avg_completion_pct'],
      cells: (r) => [r.cohort, r.class, r.students, r.avg_completion_pct],
    },
    (deps.now?.() ?? new Date()).toISOString(),
  )
}

/** GET /api/v1/learning-gain. Needs the `assessments` scope. */
export async function handleLearningGain(request: Request, deps: ApiDeps): Promise<Response> {
  const denied = await authorize(request, deps, 'assessments')
  if (denied) return denied
  const parsed = parseQuery(request)
  if ('error' in parsed) return parsed.error
  const { group_by, cohort, format } = parsed.query

  let source
  try {
    source = await deps.data.classGain()
  } catch {
    return unavailable()
  }
  const rows = buildLearningGain(source, group_by, cohort)
  return respond(
    rows,
    format,
    'learning-gain',
    {
      header: [
        'cohort',
        'class',
        'module',
        'concept',
        'complete_count',
        'incomplete_count',
        'pre_pct',
        'post_pct',
        'gain_points',
        'normalized_gain',
      ],
      cells: (r) => [
        r.cohort,
        r.class,
        r.module,
        r.concept,
        r.complete_count,
        r.incomplete_count,
        r.pre_pct,
        r.post_pct,
        r.gain_points,
        r.normalized_gain,
      ],
    },
    (deps.now?.() ?? new Date()).toISOString(),
  )
}
