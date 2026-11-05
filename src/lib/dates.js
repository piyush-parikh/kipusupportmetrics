// APT-153: one way to turn a month into the value a date column accepts.
//
// The pages carry the month around as 'YYYY-MM', but metric_month is a real
// date and Postgres rejects '2026-11' outright. Rather than remembering to
// convert at each call site — which is exactly what went wrong when saving an
// adjustment — every month that reaches the notes or adjustments tables goes
// through here.
//
// Strict on purpose: a bad month is a programming mistake, and failing loudly
// in development beats writing the wrong month and finding out months later.

export function monthToDate(m) {
  if (typeof m !== 'string' || m.trim() === '') {
    throw new Error(`Expected a month like 2026-11, got ${JSON.stringify(m)}`)
  }
  const match = m.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) {
    throw new Error(`Expected a month like 2026-11 or 2026-11-01, got ${JSON.stringify(m)}`)
  }
  const [, year, month] = match
  const monthNumber = Number(month)
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Month must be between 01 and 12, got ${JSON.stringify(m)}`)
  }
  return `${year}-${month}-01`
}

// 'YYYY-MM' from either form, for comparing a stored date against the month a
// page is showing. Tolerant where monthToDate is strict: this one is used
// while rendering, where throwing would blank the screen over one odd row.
export function toMonthKey(v) {
  if (v === null || v === undefined) return ''
  return String(v).slice(0, 7)
}
