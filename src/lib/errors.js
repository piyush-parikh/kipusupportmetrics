// APT-149: turns a Supabase/PostgREST failure into something a supervisor can
// act on, instead of a raw database message. Pure — see errors.test.js.
//
// Returns { message, sessionExpired }. sessionExpired tells the caller the
// sign-in has lapsed, so it can sign out and let the guard send the person
// back to the login page.

export function describeError(e) {
  if (!e) return { message: 'Something went wrong. Please try again.', sessionExpired: false }

  const message = String(e.message ?? '')
  const lower = message.toLowerCase()
  const status = e.status ?? e.statusCode
  const code = e.code

  // The sign-in has lapsed — the caller should sign out rather than show this
  if (lower.includes('jwt expired') || lower.includes('invalid jwt') || code === 'PGRST301') {
    return { message: 'Your sign-in has expired. Please sign in again.', sessionExpired: true }
  }

  // Blocked by the database's own rules, or by not being signed in far enough
  if (
    status === 401 || status === 403 ||
    code === '42501' ||
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('row level security')
  ) {
    return { message: 'You do not have permission to do this.', sessionExpired: false }
  }

  return { message: message || 'Something went wrong. Please try again.', sessionExpired: false }
}
