// APT-151: metric adjustments moved out of the note text and into their own
// shared table. These are the only two shapes in play:
//
//   table row  — one row per agent + month + metric, as stored
//   page shape — { [metric_key]: { metric_key, exclude?, goal?, tolerance?,
//                 reason?, by? } }, exactly what AgentPerformance already used
//                 when adjustments lived inside the note text
//
// The page shape must not change: the rating code reads it as-is. Kept free of
// React and database code so it can be tested on its own.

function numberOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function textOrNull(v) {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

// Table rows → the object the page keys by metric_key.
// Properties are omitted rather than set to undefined, so a legacy row with no
// adjusted_by produces no `by` key at all — the same as the old parser did.
export function rowsToAdjustments(rows) {
  const out = {}
  for (const row of rows ?? []) {
    if (!row || !row.metric_key) continue
    const adj = { metric_key: row.metric_key }
    if (row.exclude === true) adj.exclude = true
    const goal = numberOrNull(row.goal)
    if (goal !== null) adj.goal = goal
    const tolerance = numberOrNull(row.tolerance)
    if (tolerance !== null) adj.tolerance = tolerance
    const reason = textOrNull(row.reason)
    if (reason !== null) adj.reason = reason
    const by = textOrNull(row.adjusted_by)
    if (by !== null) adj.by = by
    out[row.metric_key] = adj
  }
  return out
}

// One page adjustment → one table row ready to upsert.
// exclude and a custom goal stay mutually exclusive on write, as they were in
// the old format, so an excluded metric never carries a stale goal.
export function adjustmentToRow(adj, { agentId, month, userId, byName } = {}) {
  const exclude = !!adj?.exclude
  return {
    agent_id: Number(agentId),
    metric_month: month,
    metric_key: adj?.metric_key,
    exclude,
    goal: exclude ? null : numberOrNull(adj?.goal),
    tolerance: exclude ? null : numberOrNull(adj?.tolerance),
    reason: textOrNull(adj?.reason),
    adjusted_by: textOrNull(byName),
    adjusted_by_user: userId ?? null,
  }
}

// Same wording as describeAdjustment in adjustments.js, but reading a table row
// rather than a parsed note line.
export function describeAdjustmentRow(row) {
  if (row?.exclude === true) return 'Excluded from score'
  const goal = numberOrNull(row?.goal)
  const tolerance = numberOrNull(row?.tolerance)
  const tol = tolerance !== null ? ` (±${tolerance})` : ''
  return `Custom goal: ${goal === null ? '—' : goal}${tol}`
}
