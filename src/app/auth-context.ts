import { createContext } from 'react'
import type { Role } from '@shared/roles'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; role: Role }
  | { status: 'error'; message: string }

export const AuthContext = createContext<AuthState>({ status: 'loading' })
