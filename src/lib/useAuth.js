import { createContext, useCallback, useContext } from 'react'
import { describeError } from './errors'

// APT-149: the context object and its hooks live here, apart from the provider
// component in AuthContext.jsx, so each file exports only one kind of thing
// (React Fast Refresh needs component files to export components only).

export const AuthCtx = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>. Wrap the app in it first.')
  return ctx
}

// Turns an API failure into the message to show, and signs out when the
// sign-in has lapsed so the guard can send the person back to /login.
export function useApiError() {
  const { signOut } = useAuth()
  return useCallback((e) => {
    const { message, sessionExpired } = describeError(e)
    if (sessionExpired) signOut()
    return message
  }, [signOut])
}
