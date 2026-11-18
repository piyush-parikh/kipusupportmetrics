import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getMyRole, markPasswordChanged } from './api'
import { describeAuthError } from './authHelpers'
import { describePasswordUpdateError } from './passwordHelpers'
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
  const [roleState, setRoleState] = useState({
    userId: null, role: null, mustChangePassword: false, error: '', nonce: 0,
  })

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
        if (!active) return
        setRoleState({
          userId,
          role: r?.role ?? null,
          mustChangePassword: r?.mustChangePassword === true,
          error: '',
          nonce: roleNonce,
        })
      })
      .catch((e) => {
        if (!active) return
        setRoleState({
          userId,
          role: null,
          mustChangePassword: false,
          error: describeError(e).message,
          nonce: roleNonce,
        })
      })
    return () => { active = false }
  }, [userId, bootstrapped, roleNonce])

  // The stored answer counts only if it is for this user and this attempt
  const settled = roleState.userId === userId && roleState.nonce === roleNonce
  const role = userId && settled ? roleState.role : null
  const roleError = userId && settled ? roleState.error : ''
  // APT-156: false while the role is still on its way, and for anyone with no
  // access at all — so the forced screen can never flash up for them.
  const mustChangePassword = !!(userId && settled && role && roleState.mustChangePassword)
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

  // APT-156: someone changes their own password here. No email is involved and
  // no administrator is needed.
  //
  // Neither password is stored, logged or put anywhere outside this function —
  // they arrive from the form's own state and are handed straight to Supabase.
  //
  // Step 1 proves they know the password they have now (the update itself does
  // not ask) and, as a side effect, leaves the session freshly signed in,
  // which is the state the update expects. That sign-in raises a SIGNED_IN
  // event; the listener above records the session and nothing else, and since
  // the user id has not changed the role is not fetched again, so no loading
  // screen appears and no redirect is triggered.
  const changePassword = useCallback(async (current, next) => {
    const signedInEmail = session?.user?.email ?? ''
    if (!signedInEmail) {
      return { ok: false, message: 'Your sign-in has expired. Please sign in again.' }
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: signedInEmail,
      password: current,
    })
    if (reauthError) {
      // Deliberately says nothing beyond this, whatever the real reason was
      return { ok: false, field: 'current', message: 'Your current password is incorrect.' }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      return { ok: false, message: describePasswordUpdateError(updateError) }
    }

    // The password is changed by this point, so a failure to record it must
    // not be reported as a failure to change it.
    try {
      await markPasswordChanged()
    } catch {
      return {
        ok: true,
        warning: 'Your password was changed, but we could not record it. You may be asked again.',
      }
    }

    // The flag is now clear in the database. Patching the answer already in
    // hand keeps the page as it is; asking for the role afresh would put the
    // whole app behind its loading screen and wipe the confirmation off the
    // screen mid-sentence. It is read from the database again on the next
    // sign-in or page load as usual.
    setRoleState((prev) => (
      prev.userId === userId ? { ...prev, mustChangePassword: false } : prev
    ))
    return { ok: true }
  }, [session, userId])

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
    mustChangePassword,
    signIn,
    signOut,
    refreshRole,
    changePassword,
  }), [
    session, role, status, roleError, mustChangePassword,
    signIn, signOut, refreshRole, changePassword,
  ])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
