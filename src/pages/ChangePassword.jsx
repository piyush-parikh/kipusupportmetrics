import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { validatePasswordChange, MIN_PASSWORD_LENGTH } from '../lib/passwordHelpers'

// APT-156: people set their own password here. Two situations, one screen:
//
//   forced  — they still have the starting password an administrator gave them.
//             The page stands on its own, with no menu around it, and the only
//             ways out are changing the password or signing out.
//   normal  — they chose to change it, from the link in the sidebar.
//
// The three values live only in this component's own state. They are never
// logged, never stored, never put in a web address, and never repeated back in
// a message. They go from here to the sign-in service and nowhere else.
export default function ChangePassword() {
  const { email, mustChangePassword, changePassword, signOut } = useAuth()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Whichever mode the page opened in is the mode it keeps, so a success does
  // not re-dress the page underneath the person reading the confirmation.
  const [forced] = useState(mustChangePassword)

  // Nothing typed here outlives the page
  useEffect(() => () => { setCurrent(''); setNext(''); setConfirm('') }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    setError('')
    setNotice('')

    const check = validatePasswordChange({ current, next, confirm }, { email })
    if (!check.ok) {
      setFieldErrors(check.errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)

    const result = await changePassword(current, next)

    if (!result.ok) {
      if (result.field) setFieldErrors({ [result.field]: result.message })
      else setError(result.message)
      setSubmitting(false)
      return
    }

    setCurrent('')
    setNext('')
    setConfirm('')
    setShow(false)
    setSubmitting(false)
    setNotice(result.warning ? `Your password was changed. ${result.warning}` : 'Your password was changed.')

    // Someone who was made to come here is sent on to the app once they have
    // read the confirmation. If the change could not be recorded they stay
    // put, because they would only be sent straight back here.
    if (forced && !result.warning) {
      window.setTimeout(() => navigate('/', { replace: true }), 1000)
    }
  }

  const inputType = show ? 'text' : 'password'

  const form = (
    <form onSubmit={onSubmit} noValidate>
      {error && <div className="error-msg" role="alert">{error}</div>}
      {notice && <div className="success-msg" role="status">{notice}</div>}

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label" htmlFor="cp-current">Current password</label>
        <input
          id="cp-current"
          className="form-input"
          type={inputType}
          autoComplete="current-password"
          autoFocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={fieldErrors.current ? 'true' : undefined}
          aria-describedby={fieldErrors.current ? 'cp-current-error' : undefined}
        />
        {fieldErrors.current && (
          <p id="cp-current-error" className="field-error" role="alert">{fieldErrors.current}</p>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label" htmlFor="cp-next">New password</label>
        <input
          id="cp-next"
          className="form-input"
          type={inputType}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={fieldErrors.next ? 'true' : undefined}
          aria-describedby={fieldErrors.next ? 'cp-next-error cp-next-hint' : 'cp-next-hint'}
        />
        <p id="cp-next-hint" className="field-hint">
          At least {MIN_PASSWORD_LENGTH} characters. Mix letters and numbers.
        </p>
        {fieldErrors.next && (
          <p id="cp-next-error" className="field-error" role="alert">{fieldErrors.next}</p>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label" htmlFor="cp-confirm">Confirm new password</label>
        <input
          id="cp-confirm"
          className="form-input"
          type={inputType}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={fieldErrors.confirm ? 'true' : undefined}
          aria-describedby={fieldErrors.confirm ? 'cp-confirm-error' : undefined}
        />
        {fieldErrors.confirm && (
          <p id="cp-confirm-error" className="field-error" role="alert">{fieldErrors.confirm}</p>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show passwords
      </label>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Changing…' : 'Change password'}
        </button>
        {forced
          ? <button className="btn btn-secondary" type="button" onClick={signOut}>Sign out</button>
          : <Link className="btn btn-secondary" to="/">Back</Link>}
      </div>
    </form>
  )

  if (forced) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ maxWidth: 420 }}>
          <div className="login-brand">
            Kipu Tracker
            <span>Support Performance</span>
          </div>
          <h1 className="login-title">Change password</h1>
          <p className="login-note">
            Welcome. For your security, please set your own password before you continue.
          </p>
          {email && <p className="login-note">Signed in as <strong>{email}</strong>.</p>}
          {form}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Change password</h1>
        <p className="page-subtitle">Choose a new password for your account.</p>
      </div>
      <div className="card" style={{ maxWidth: 420 }}>
        {form}
      </div>
    </div>
  )
}
