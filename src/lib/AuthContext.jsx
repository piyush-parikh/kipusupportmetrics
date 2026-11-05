import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getMyRole } from './api'
import { describeAuthError } from './authHelpers'
import { describeError, setSessionExpiredHandler } from './errors'
import { AuthCtx } from './useAuth'

// APT-149: who is signed in, and what they are allowed to do.
//
// status walks through:
//   'loading'   — still working out the session, or still fetching the role.
//                 Nothing is rendered yet, so "No access" never flashes up
//                 while the role is still on its way.
//   'signedOut' — no session; the guard sends them to /login.
//   'roleError' — the role request itself failed (network or server). Offer a
//                 Retry, because that is not the same as having no access.
//   'ready'     — role is settled. role === null means no access granted yet.

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [bootstrapped, setBootstrapped] = useState(false)   // first getSession has answered
  const [roleNonce, setRoleNonce] = useState(0)             // bumped by refreshRole()

  // One record of the last answered role request. Keeping the user id and the
  // nonce alongside it lets "still loading" be derived rather than stored, so
  // nothing has to be set synchronously inside an effect.
  const [roleState, setRoleState] = useState({ userId: null, role: null, error: '', nonce: 0 })

  useEffect(() => {
    let active = true

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data?.session ?? null)
        setBootstrapped(true)
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setBootstrapped(true)
      })

    // supabase-js warns against awaiting other Supabase calls inside this
    // callback — it can deadlock. Only the session is recorded here; the role
    // is fetched by the effect below, which keys off the user id.
    // Each effect run owns its own subscription and clears it on cleanup, so
    // StrictMode's double mount in development leaves no duplicate listener.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession ?? null)
      setBootstrapped(true)
    })

    return () => {
      active = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!bootstrapped || !userId) return undefined
    let active = true
    getMyRole(userId)
      .then((r) => {
        if (active) setRoleState({ userId, role: r ?? null, error: '', nonce: roleNonce })
      })
      .catch((e) => {
        if (active) setRoleState({ userId, role: null, error: describeError(e).message, nonce: roleNonce })
      })
    return () => { active = false }
  }, [userId, bootstrapped, roleNonce])

  // The stored answer counts only if it is for this user and this attempt
  const settled = roleState.userId === userId && roleState.nonce === roleNonce
  const role = userId && settled ? roleState.role : null
  const roleError = userId && settled ? roleState.error : ''
  const roleLoading = !!userId && !settled

  const status = !bootstrapped ? 'loading'
    : !session ? 'signedOut'
    : roleLoading ? 'loading'
    : roleError ? 'roleError'
    : 'ready'

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email ?? '').trim(),
      password,
    })
    if (error) return { ok: false, message: describeAuthError(error) }
    return { ok: true }
  }, [])

  // onAuthStateChange fires SIGNED_OUT here and in any other open tab, which
  // clears the session everywhere; roleState falls away with the user id.
  const signOut = useCallback(() => supabase.auth.signOut().catch(() => {}), [])

  const refreshRole = useCallback(() => setRoleNonce((n) => n + 1), [])

  // Any page that hits an expired sign-in signs out through this, and the
  // guard then sends the person to /login.
  useEffect(() => {
    setSessionExpiredHandler(signOut)
    return () => setSessionExpiredHandler(null)
  }, [signOut])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    email: session?.user?.email ?? '',
    role,
    isAdmin: role === 'admin',
    status,
    roleError,
    signIn,
    signOut,
    refreshRole,
  }), [session, role, status, roleError, signIn, signOut, refreshRole])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
