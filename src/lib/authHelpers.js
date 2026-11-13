// APT-149: pure helpers for sign-in. No React, no Supabase — so they can be
// reasoned about and tested on their own (see authHelpers.test.js).

// Where to send someone after they sign in.
// Only a plain in-app path is allowed: anything that could leave the site
// (//evil.com, https://…, a backslash) falls back to the home page, and so
// does /login itself, which would otherwise bounce.
export function safeRedirectPath(p) {
  if (typeof p !== 'string') return '/'
  if (!p.startsWith('/')) return '/'
  if (p.startsWith('//')) return '/'
  if (p.includes('\\')) return '/'
  const path = p.split(/[?#]/)[0]
  if (path === '/login') return '/'
  return p
}

// Turns a Supabase auth failure into something worth reading. Deliberately
// never says whether an email address exists.
export function describeAuthError(error) {
  if (!error) return 'Sign in failed. Please try again.'
  const message = String(error.message ?? '')
  const lower = message.toLowerCase()
  const status = error.status ?? error.statusCode

  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'Your account is not activated yet. Please contact an administrator.'
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Email or password is incorrect.'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('network request failed') ||
    error.name === 'TypeError'
  ) {
    return 'Could not reach the server. Check your internet connection and try again.'
  }
  return 'Sign in failed. Please try again.'
}
