import { useEffect, useState, type ReactNode } from 'react'
import type { Role } from '@shared/roles'
import { appRoleFromDatabase } from '@/lib/authRole'
import { getSupabase } from '@/lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Account access could not be verified.'
}

async function loadRole(userId: string): Promise<Role> {
  const { data, error } = await getSupabase().from('profiles').select('role').eq('id', userId).maybeSingle()
  if (error) throw error
  const role = appRoleFromDatabase(data?.role)
  if (!role) throw new Error('Your account does not have an approved role.')
  return role
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let revision = 0
    let unsubscribe: (() => void) | undefined

    const updateSession = async (session: { user: { id: string } } | null) => {
      const currentRevision = ++revision
      if (!session) {
        if (active) setState({ status: 'signedOut' })
        return
      }

      if (active) setState({ status: 'loading' })
      try {
        const role = await loadRole(session.user.id)
        if (active && currentRevision === revision) {
          setState({ status: 'signedIn', userId: session.user.id, role })
        }
      } catch (error) {
        if (active && currentRevision === revision) setState({ status: 'error', message: messageOf(error) })
      }
    }

    try {
      const client = getSupabase()
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        void Promise.resolve().then(() => updateSession(session))
      })
      unsubscribe = () => data.subscription.unsubscribe()
      void client.auth
        .getSession()
        .then(({ data: sessionData, error }) => {
          if (error) throw error
          return updateSession(sessionData.session)
        })
        .catch((error: unknown) => {
          if (active) setState({ status: 'error', message: messageOf(error) })
        })
    } catch (error) {
      const failure: AuthState = { status: 'error', message: messageOf(error) }
      queueMicrotask(() => {
        if (active) setState(failure)
      })
    }

    return () => {
      active = false
      revision += 1
      unsubscribe?.()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
