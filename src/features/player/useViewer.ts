import { useMe } from './queries'

/**
 * Who is looking at an open (CIC Open) lesson page. These pages work without an account, so a
 * signed-in student must not be shown the guest prompts ("Save my progress" would make a second
 * account). `pending` lets pages avoid flashing the guest version before the session is known.
 */
export function useViewer() {
  const me = useMe()
  const who = me.data ?? null
  return {
    pending: me.isPending,
    me: who,
    guest: !me.isPending && who === null,
    student: who !== null && (who.role === 'student' || who.role === 'independent_student'),
  }
}
