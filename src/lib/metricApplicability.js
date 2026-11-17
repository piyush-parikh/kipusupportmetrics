// APT-155: which metrics apply to which teams.
//
// A metric can be marked "not applicable" to chosen teams. Each such choice is
// one stored pair of (team, metric). A pair that is present means: this metric
// does NOT apply to that team — its agents never see it and it never counts
// toward their rating, for every month.
//
// The rules live here, free of React and database code, so they can be tested
// on their own and reused by every screen.
//
// Ids arrive as numbers from the database and as strings from form controls, so
// every comparison is made on the string form.

/** Normalises an id for comparison; null/undefined/'' become null. */
function key(id) {
  if (id === null || id === undefined || id === '') return null
  return String(id)
}

/**
 * Turns stored pairs into something that can answer "is metric M excluded for
 * team G" quickly.
 *
 * @param rows [{ group_id, metric_id }]
 * @returns an index to pass to the other functions in this module
 */
export function buildExclusionIndex(rows) {
  const byMetric = new Map()
  for (const row of rows ?? []) {
    const metricId = key(row?.metric_id)
    const groupId = key(row?.group_id)
    if (metricId === null || groupId === null) continue
    if (!byMetric.has(metricId)) byMetric.set(metricId, new Set())
    byMetric.get(metricId).add(groupId)
  }
  return { byMetric }
}

/** An index with nothing excluded — the state of the system before any choice. */
export const EMPTY_EXCLUSIONS = buildExclusionIndex([])

function excludedSet(metricId, index) {
  const metric = key(metricId)
  if (metric === null) return null
  return index?.byMetric?.get(metric) ?? null
}

/**
 * Should this metric be shown for the team(s) in view?
 *
 * No team known (empty or missing list) means show it — the screen cannot tell
 * which team's rules to apply, so nothing is hidden. With teams in view the
 * metric is shown when at least one of them still has it, which is what makes
 * an agent on two teams keep a metric that only one of the two has turned off.
 */
export function isMetricApplicable(metricId, teamIds, index) {
  const teams = (teamIds ?? []).map(key).filter((t) => t !== null)
  if (!teams.length) return true
  const excluded = excludedSet(metricId, index)
  if (!excluded || !excluded.size) return true
  return teams.some((t) => !excluded.has(t))
}

/**
 * Keeps the metrics that apply to the team(s) in view, in their original order.
 * A metric with no id (for example one built from a scorecard row rather than
 * from its definition) is always kept: those rows already come filtered.
 */
export function filterMetricsForTeams(metrics, teamIds, index) {
  return (metrics ?? []).filter((m) => m && isMetricApplicable(m.id, teamIds, index))
}

/** The teams this metric has been turned off for. */
export function excludedTeamIdsForMetric(metricId, index) {
  const excluded = excludedSet(metricId, index)
  return excluded ? [...excluded] : []
}

/**
 * Works out the smallest set of changes between what is stored for one metric
 * and what the person has just chosen, so saving neither re-inserts rows that
 * are already there nor removes rows it should keep.
 *
 * @returns { toInsert, toDelete } — team ids, as strings
 */
export function diffExclusions(currentExcludedTeamIds, wantedExcludedTeamIds) {
  const current = new Set((currentExcludedTeamIds ?? []).map(key).filter((t) => t !== null))
  const wanted = new Set((wantedExcludedTeamIds ?? []).map(key).filter((t) => t !== null))
  const toInsert = [...wanted].filter((t) => !current.has(t))
  const toDelete = [...current].filter((t) => !wanted.has(t))
  return { toInsert, toDelete }
}
