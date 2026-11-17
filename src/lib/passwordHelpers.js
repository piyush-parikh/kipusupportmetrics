// APT-156: the rules for choosing a new password, and the wording shown when
// the change is refused. Pure — no React, no Supabase — so the rules can be
// tested on their own (see passwordHelpers.test.js).
//
// A password value is never logged, stored, put in a URL or repeated back in
// any message produced here.

// The shortest password the app accepts.
export const MIN_PASSWORD_LENGTH = 10

// Spaces are perfectly good password characters, so nothing is trimmed — but a
// value made only of spaces is treated as if it were empty.
function isBlank(value) {
  return typeof value !== 'string' || value.trim() === ''
}

const ONLY_DIGITS = /^\d+$/u
const ONLY_LETTERS = /^\p{L}+$/u

/**
 * Checks a password change before anything is sent to the server.
 *
 * @param fields { current, next, confirm } exactly as typed
 * @param options { email } the signed-in person's email, used for one rule
 * @returns { ok, errors } errors is keyed by field name: current, next, confirm
 */
export function validatePasswordChange({ current, next, confirm } = {}, { email } = {}) {
  const errors = {}

  if (isBlank(current)) {
    errors.current = 'Enter your current password.'
  }

  const value = typeof next === 'string' ? next : ''
  if (isBlank(value) || value.length < MIN_PASSWORD_LENGTH) {
    errors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  } else if (typeof current === 'string' && value === current) {
    errors.next = 'Choose a password that is different from the current one.'
  } else {
    // The part of the email before the @ — only worth checking when it is long
    // enough to be a real word, so that short names do not block everything.
    const localPart = String(email ?? '').split('@')[0] ?? ''
    if (localPart.length >= 4 && value.toLowerCase().includes(localPart.toLowerCase())) {
      errors.next = "Don't use your email name in the password."
    } else if (ONLY_DIGITS.test(value) || ONLY_LETTERS.test(value)) {
      errors.next = 'Mix letters and numbers.'
    }
  }

  if ((typeof confirm === 'string' ? confirm : '') !== value) {
    errors.confirm = "The two new passwords don't match."
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/**
 * Turns a failure from the password update into something worth reading.
 * Never repeats the password back.
 */
export function describePasswordUpdateError(error) {
  if (!error) return 'Could not change the password. Please try again.'
  const message = String(error.message ?? '')
  const lower = message.toLowerCase()
  const status = error.status ?? error.statusCode

  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (
    lower.includes('auth session missing') ||
    lower.includes('session missing') ||
    lower.includes('session not found') ||
    lower.includes('jwt expired') ||
    lower.includes('token is expired')
  ) {
    return 'Your sign-in has expired. Please sign in again.'
  }
  if (lower.includes('same password') || lower.includes('should be different')) {
    return 'Choose a password that is different from the current one.'
  }
  if (
    lower.includes('weak password') ||
    lower.includes('password is too weak') ||
    lower.includes('too short') ||
    lower.includes('at least') ||
    lower.includes('minimum length') ||
    lower.includes('pwned') ||
    lower.includes('password should be')
  ) {
    return 'That password is not accepted. Use a longer one with letters and numbers.'
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
  return 'Could not change the password. Please try again.'
}

/**
 * True when a query failed because the must_change_password column is not
 * there. Lets the app fall back to reading the role alone, so an environment
 * where the column has not been added yet still works.
 */
export function isMissingColumnError(error) {
  if (!error) return false
  if (String(error.code ?? '') === '42703') return true
  const lower = String(error.message ?? '').toLowerCase()
  if (!lower.includes('must_change_password')) return false
  return lower.includes('does not exist') || lower.includes('column')
}
