/**
 * The one place where server error codes become words a student can act on.
 * RPC errors arrive as PostgrestError; lane A raises them with the code in `message`
 * (or `hint`). Pages Functions answer with an HTTP status.
 */
import { newRequestId, shortRef } from '@/lib/requestId'

export const ERROR_CODES = [
  'locked',
  'invalid_response',
  'already_taken',
  'invalid_name',
  'already_in_class',
  'wrong_account',
  'rate_limited',
  'unavailable',
  'unauthenticated',
  'not_found',
  'offline',
  'bad_response',
  'unknown',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

const MESSAGES: Record<ErrorCode, string> = {
  locked: "This isn't open yet. Finish the earlier steps first.",
  invalid_response: "That answer couldn't be read. Check it and try again.",
  already_taken: "You've already taken this test.",
  invalid_name: 'Use 1 to 40 letters, with no email address or link.',
  already_in_class: 'This device is already in a class. Sign in with your login code instead.',
  wrong_account: 'This device is already signed in to a different account. Sign out first, then try again.',
  rate_limited: 'Too many tries right now. Wait a minute and try again.',
  unavailable: "That service isn't available right now. Try again in a minute.",
  unauthenticated: 'You are signed out. Sign in to continue.',
  not_found: "We couldn't find that. It may have been moved.",
  offline: "You're offline; your answer wasn't sent. Reconnect and try again.",
  bad_response: 'The server sent something unexpected. Try again, and tell your instructor if it keeps happening.',
  unknown: 'Something went wrong. Try again.',
}

export function friendlyMessage(code: ErrorCode): string {
  return MESSAGES[code]
}

/** A failed call, with what the UI needs (code, request id) and what the logs need (cause). */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly requestId: string
  readonly status: number | undefined

  constructor(code: ErrorCode, opts: { requestId?: string; status?: number; cause?: unknown } = {}) {
    super(code, { cause: opts.cause })
    this.name = 'ApiError'
    this.code = code
    this.requestId = opts.requestId ?? newRequestId()
    this.status = opts.status
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

function isKnownCode(s: unknown): s is ErrorCode {
  return typeof s === 'string' && (ERROR_CODES as readonly string[]).includes(s)
}

/** Plain-language messages the database raises (SQLSTATE P0001), matched to our codes. */
const DB_MESSAGES: [RegExp, ErrorCode][] = [
  [/already belongs to a class/i, 'already_in_class'],
  [/display name|no email/i, 'invalid_name'],
  [/cannot (self-register|claim)/i, 'wrong_account'],
]

type PostgrestLike = { message?: string; hint?: string | null; code?: string; details?: string | null }

/** Map a PostgrestError (or anything thrown by fetch) to an ApiError. */
export function fromRpcError(err: PostgrestLike | unknown, requestId: string): ApiError {
  if (!isOnline()) return new ApiError('offline', { requestId, cause: err })
  if (err && typeof err === 'object') {
    const e = err as PostgrestLike
    const fromServer = [e.message, e.hint].find(isKnownCode)
    if (fromServer) return new ApiError(fromServer, { requestId, cause: err })
    // PostgREST: PGRST301/JWT problems, 42501 = insufficient privilege.
    const known = typeof e.message === 'string' ? DB_MESSAGES.find(([re]) => re.test(e.message!)) : undefined
    if (known) return new ApiError(known[1], { requestId, cause: err })
    if (e.code === 'PGRST301' || e.code === '42501') return new ApiError('unauthenticated', { requestId, cause: err })
    if (e.code === 'PGRST202') return new ApiError('unavailable', { requestId, cause: err })
    if (typeof e.message === 'string' && /fetch|network/i.test(e.message)) {
      return new ApiError('offline', { requestId, cause: err })
    }
  }
  return new ApiError('unknown', { requestId, cause: err })
}

/** Map an HTTP status from a Pages Function to an ApiError. */
export function fromHttpStatus(status: number, requestId: string, cause?: unknown): ApiError {
  const code: ErrorCode =
    status === 400
      ? 'invalid_name'
      : status === 401 || status === 403
        ? 'unauthenticated'
        : status === 404
          ? 'not_found'
          : status === 429
            ? 'rate_limited'
            : status >= 500
              ? 'unavailable'
              : 'unknown'
  return new ApiError(code, { requestId, status, cause })
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/** What the UI shows for any thrown error: a message and, when we have one, a short ref. */
export function describeError(e: unknown): { code: ErrorCode; message: string; reference?: string } {
  if (isApiError(e)) return { code: e.code, message: friendlyMessage(e.code), reference: shortRef(e.requestId) }
  return { code: 'unknown', message: friendlyMessage('unknown') }
}
