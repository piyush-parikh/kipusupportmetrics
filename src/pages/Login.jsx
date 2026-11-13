import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { safeRedirectPath } from '../lib/authHelpers'

// APT-149: email + password only. Accounts are created by an administrator —
// there is no sign-up, no password-reset email and no magic link.
export default function Login() {
  const { status, role, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const target = safeRedirectPath(location.state?.from ?? searchParams.get('next'))

  // Already signed in and allowed in — no reason to show this page
  if (status === 'ready' && role) return <Navigate to={target} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const result = await signIn(email, password)
    if (!result.ok) {
      setError(result.message)
      setSubmitting(false)
      return
    }
    // Leave the button disabled: the guard takes over from here
    setPassword('')
    navigate(target, { replace: true })
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          Kipu Tracker
          <span>Support Performance</span>
        </div>
        <h1 className="login-title">Sign in</h1>

        {error && <div className="error-msg" role="alert">{error}</div>}

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn btn-primary login-submit" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-foot">
          Forgot your password? Ask an administrator to reset it.
        </p>
      </form>
    </div>
  )
}
