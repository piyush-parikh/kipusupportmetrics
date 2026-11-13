import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

// APT-149: everything except /login goes through here.
// The screens below deliberately render without the sidebar — someone who is
// not signed in, or has no access, should not see the menu.
export default function RequireAuth({ children }) {
  const { status, role, email, roleError, signOut, refreshRole } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <div className="loading">Loading…</div>
  }

  if (status === 'signedOut') {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" state={{ from }} replace />
  }

  if (status === 'roleError') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1 className="login-title">Could not load your access</h1>
          <p className="login-note">
            We could not check what you are allowed to see. This is usually a connection problem.
          </p>
          {roleError && <div className="error-msg" role="alert">{roleError}</div>}
          <div className="login-actions">
            <button className="btn btn-primary" onClick={refreshRole}>Retry</button>
            <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1 className="login-title">No access</h1>
          <p className="login-note">
            Signed in as <strong>{email}</strong>.
          </p>
          <p className="login-note">
            Your account has no access yet. Please contact an administrator.
          </p>
          <div className="login-actions">
            <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  return children
}
