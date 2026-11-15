// The three student sign-in calls (see docs/contracts/database-api.md). Each one has a
// timeout, an x-request-id header for the logs, and errors turned into plain words.
import { z } from 'zod'
import { log } from '@/lib/log'
import { newRequestId } from '@/lib/requestId'
import { SessionError, toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'

const TIMEOUT_MS = 15_000

const Seats = z.array(z.object({ member_id: z.string(), label: z.string() }))
export type Seat = z.infer<typeof Seats>[number]
const Claimed = z.object({ class_id: z.string(), class_name: z.string(), display_name: z.string() })

async function rpc<S extends z.ZodTypeAny>(fn: string, args: Record<string, unknown>, schema: S): Promise<z.infer<S>> {
  const requestId = newRequestId()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw toSessionError(undefined)
  let result
  try {
    result = await getSupabase().rpc(fn, args).setHeader('x-request-id', requestId).abortSignal(AbortSignal.timeout(TIMEOUT_MS))
  } catch (cause) {
    throw toSessionError(cause)
  }
  if (result.error) {
    log.debug('rpc.fail', { method: 'rpc', path: fn, status: result.status, requestId })
    throw toSessionError(result.error)
  }
  const parsed = schema.safeParse(result.data)
  if (!parsed.success) throw new SessionError('The server sent something unexpected. Try again.', 'other', parsed.error)
  return parsed.data
}

/** The student's personal code from their card. The database ignores case, spaces and dashes. */
export const claimLoginCode = (code: string) => rpc('claim_login_code', { p_code: code }, Claimed)

/** Unclaimed names ("First L.") for a class join code. Works for a guest session. */
export const listJoinRoster = (joinCode: string) => rpc('list_join_roster', { p_join_code: joinCode }, Seats)

export const claimRosterSeat = (joinCode: string, memberId: string) =>
  rpc('claim_roster_seat', { p_join_code: joinCode, p_member_id: memberId }, Claimed)
