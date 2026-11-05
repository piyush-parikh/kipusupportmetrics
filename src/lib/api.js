import { supabase } from './supabase'
import { planGoalChange } from './goalPlan'

// Convert YYYY-MM → YYYY-MM-01 for date columns in Postgres
function toDateParam(month) {
  if (!month) return undefined
  return month.length === 7 ? `${month}-01` : month
}

// ── Access (app_users) ────────────────────────────────────────────────────────

// APT-149: the signed-in person's role, 'admin' or 'user'. A person can read
// only their own row, so this returns null when they have not been given
// access yet — which the app shows as a "No access" screen rather than an
// error. Throws on a real failure so the caller can offer a Retry.
export async function getMyRole(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('app_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role ?? null
}

// ── Teams (metrics_groups where group_type='team') ────────────────────────────

export async function getTeams() {
  const { data, error } = await supabase
    .from('metrics_groups')
    .select('id, group_key, group_name, active, display_order')
    .eq('group_type', 'team')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return data
}

// APT-145: selects every column rather than a fixed list, so optional columns
// (e.g. has_goals) come through when they exist and are simply absent when they
// do not — asking for a column that does not exist would error.
export async function getAllTeams() {
  const { data, error } = await supabase
    .from('metrics_groups')
    .select('*')
    .eq('group_type', 'team')
    .order('display_order')
  if (error) throw error
  return data
}

export async function upsertTeam(row) {
  const { data, error } = await supabase
    .from('metrics_groups')
    .upsert({ ...row, group_type: 'team' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Agents (metrics_agents) ───────────────────────────────────────────────────

// Active agents, optionally filtered by team via assignments
export async function getAgents({ groupId, activeOnly = true } = {}) {
  if (groupId) {
    const { data: assignments, error: ae } = await supabase
      .from('metrics_agent_group_assignments')
      .select('agent_id')
      .eq('group_id', Number(groupId))
      .eq('active', true)
    if (ae) throw ae
    if (!assignments?.length) return []
    const ids = assignments.map((a) => a.agent_id)
    let q = supabase
      .from('metrics_agents')
      .select('id, agent_name, active, role, hire_date, go_live_date, employment_end_date, notes')
      .in('id', ids)
      .order('agent_name')
    if (activeOnly) q = q.eq('active', true)
    const { data, error } = await q
    if (error) throw error
    return data
  }
  let query = supabase
    .from('metrics_agents')
    .select('id, agent_name, active, role, hire_date, go_live_date, employment_end_date, notes')
    .order('agent_name')
  if (activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAllAgents() {
  const { data, error } = await supabase
    .from('metrics_agents')
    .select('*')
    .order('agent_name')
  if (error) throw error
  return data
}

export async function autoDeactivateExpiredAgents() {
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('metrics_agents')
    .update({ active: false })
    .lte('employment_end_date', today)
    .eq('active', true)
    .not('employment_end_date', 'is', null)
  if (error) throw error
}

export async function upsertAgent(row) {
  const { data, error } = await supabase
    .from('metrics_agents')
    .upsert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Team Assignments (metrics_agent_group_assignments) ────────────────────────

export async function getAllTeamAssignments() {
  const { data, error } = await supabase
    .from('metrics_agent_group_assignments')
    .select('*, metrics_groups(group_name), metrics_agents(agent_name)')
    .order('effective_start_month', { ascending: false })
  if (error) throw error
  return data
}

export async function upsertTeamAssignment(row) {
  const payload = { ...row }
  delete payload.metrics_groups
  delete payload.metrics_agents
  const { data, error } = await supabase
    .from('metrics_agent_group_assignments')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAgentTeamAssignments(agentId) {
  const { data, error } = await supabase
    .from('metrics_agent_group_assignments')
    .select('*, metrics_groups(group_name)')
    .eq('agent_id', agentId)
    .order('effective_start_month', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteTeamAssignment(id) {
  const { error } = await supabase
    .from('metrics_agent_group_assignments')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Metric Definitions (metrics_definitions) ──────────────────────────────────

export async function getMetricDefinitions() {
  const { data, error } = await supabase
    .from('metrics_definitions')
    .select('*')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return data
}

export async function getAllMetricDefinitions() {
  const { data, error } = await supabase
    .from('metrics_definitions')
    .select('*')
    .order('display_order')
  if (error) throw error
  return data
}

export async function upsertMetricDefinition(row) {
  const { data, error } = await supabase
    .from('metrics_definitions')
    .upsert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Group Goals (metrics_group_goals) ─────────────────────────────────────────

export async function getAllGroupGoals() {
  const { data, error } = await supabase
    .from('metrics_group_goals')
    .select('*, metrics_groups(group_name), metrics_definitions(metric_name, unit_type)')
    .order('group_id')
  if (error) throw error
  return data
}

export async function upsertGroupGoal(row) {
  const payload = { ...row }
  delete payload.metrics_groups
  delete payload.metrics_definitions
  const { data, error } = await supabase
    .from('metrics_group_goals')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGroupGoal(id) {
  const { error } = await supabase
    .from('metrics_group_goals')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── APT-145: goals as a team × metric grid ────────────────────────────────────

export async function endGroupGoal(id, endDate) {
  const { error } = await supabase
    .from('metrics_group_goals')
    .update({ effective_end_month: endDate })
    .eq('id', id)
  if (error) throw error
}

// Sets one metric's goal for any number of teams at once.
//
// Reports read whichever goal was in force for the month being shown, so a
// change must never overwrite the old figure — it ends the running goal the day
// before the new one starts. That keeps past months reporting against the goal
// that actually applied at the time, and is what stops a team ending up with
// two goals for the same metric covering the same dates.
//
// `existing` is every goal row already loaded by the page.
export async function applyGoalToTeams({ metricId, goalValue, toleranceValue, startDate, teamIds, existing }) {
  const metric = Number(metricId)
  const value = goalValue === '' || goalValue === null ? null : Number(goalValue)
  const tolerance = toleranceValue === '' || toleranceValue === null ? null : Number(toleranceValue)

  for (const teamId of teamIds.map(Number)) {
    const mine = existing.filter(
      (g) => Number(g.metric_id) === metric && Number(g.group_id) === teamId,
    )
    const { correct, toEnd, insertEnd } = planGoalChange(mine, startDate)

    if (correct) {
      await upsertGroupGoal({ ...correct, goal_value: value, tolerance_value: tolerance })
      continue
    }

    for (const { id, endDate } of toEnd) await endGroupGoal(id, endDate)

    await upsertGroupGoal({
      group_id: teamId,
      metric_id: metric,
      goal_value: value,
      tolerance_value: tolerance,
      effective_start_month: startDate,
      effective_end_month: insertEnd,
      active: true,
    })
  }
}

// Gives a new team the same goals another team is running today, so a team can
// be set up in one step instead of a goal at a time.
export async function copyGoalsToTeam({ fromTeamId, toTeamId, startDate }) {
  const { data, error } = await supabase
    .from('metrics_group_goals')
    .select('metric_id, goal_value, tolerance_value, effective_start_month, effective_end_month, active')
    .eq('group_id', Number(fromTeamId))
    .eq('active', true)
  if (error) throw error

  const live = (data ?? []).filter((g) =>
    (!g.effective_start_month || g.effective_start_month <= startDate) &&
    (!g.effective_end_month || g.effective_end_month >= startDate)
  )
  if (!live.length) return 0

  const { error: insertError } = await supabase
    .from('metrics_group_goals')
    .insert(live.map((g) => ({
      group_id: Number(toTeamId),
      metric_id: g.metric_id,
      goal_value: g.goal_value,
      tolerance_value: g.tolerance_value,
      effective_start_month: startDate,
      effective_end_month: null,
      active: true,
    })))
  if (insertError) throw insertError
  return live.length
}

// ── Dashboard views ───────────────────────────────────────────────────────────

// The scorecard view does not reflect day-level records saved from Attendance
// Entry, so the attendance metric is patched below with live numbers from
// metrics_vw_attendance_monthly — the same source the Attendance Summary uses.

// APT-136: judge against the whole numbers shown on screen (see APT-129)
function attendanceStatus(actual, row) {
  if (row.goal_value == null) return 'no_target'
  const a = Math.round(actual)
  const goal = Math.round(row.goal_value)
  const tol = Math.round(row.tolerance_value ?? 0)
  if (row.direction_good === 'at_or_below') return a <= goal + tol ? 'on_track' : 'off_track'
  return a >= goal - tol ? 'on_track' : 'off_track'
}

async function overlayAttendance(rows, { month, year, agentId, agentIds, groupId } = {}) {
  try {
    const { data: defs, error: de } = await supabase
      .from('metrics_definitions')
      .select('*')
      .eq('active', true)
    if (de) throw de
    const attDef = (defs ?? []).find((d) => /attendance/i.test(`${d.metric_key} ${d.metric_name}`))
    if (!attDef) return rows

    const att = await getAttendanceRollup({ month, year })

    const live = new Map()
    for (const a of att) {
      if (a.attendance_pct == null) continue
      live.set(`${a.agent_id}:${String(a.metric_month).slice(0, 7)}`, a)
    }
    if (!live.size) return rows

    const patched = rows.map((r) => {
      if (r.metric_key !== attDef.metric_key) return r
      const key = `${r.agent_id}:${String(r.metric_month).slice(0, 7)}`
      const a = live.get(key)
      if (!a) return r
      live.delete(key)
      const actual = Number(a.attendance_pct)
      return {
        ...r,
        actual_value: actual,
        metric_status: attendanceStatus(actual, r),
        // Day counts let rollups weight by days instead of averaging month %s
        att_scheduled_days: a.scheduled_days,
        att_available_days: a.available_days,
      }
    })

    // Attendance saved for agent/months the scorecard has no row for yet
    const wanted = agentId ? new Set([Number(agentId)])
      : agentIds?.length ? new Set(agentIds.map(Number))
      : null
    for (const [key, a] of live) {
      if (wanted && !wanted.has(Number(a.agent_id))) continue
      if (!wanted && groupId && String(a.external_group_id) !== String(groupId)) continue
      patched.push({
        agent_id: a.agent_id,
        agent_name: a.agent_name ?? null,
        group_id: a.external_group_id ?? null,
        metric_month: `${key.split(':')[1]}-01`,
        metric_key: attDef.metric_key,
        metric_name: attDef.metric_name,
        unit_type: attDef.unit_type,
        direction_good: attDef.direction_good,
        counts_toward_score: attDef.counts_toward_score,
        display_order: attDef.display_order,
        actual_value: Number(a.attendance_pct),
        goal_value: null,
        tolerance_value: null,
        metric_status: 'no_target',
        att_scheduled_days: a.scheduled_days,
        att_available_days: a.available_days,
      })
    }
    return patched
  } catch {
    return rows // the overlay must never break the scorecard pages
  }
}

// One row per agent/month/metric — primary scorecard source
export async function getScorecard({ agentId, month, groupId, agentIds } = {}) {
  let query = supabase.from('metrics_vw_ab_scorecard').select('*')
  if (agentId)          query = query.eq('agent_id', Number(agentId))
  if (month)            query = query.eq('metric_month', toDateParam(month))
  if (groupId)          query = query.eq('group_id', Number(groupId))
  if (agentIds?.length) query = query.in('agent_id', agentIds)
  const { data, error } = await query
  if (error) throw error
  return overlayAttendance(data, { month, agentId, agentIds, groupId })
}

// Year-range scorecard for rollups
export async function getScorecardYear({ agentId, groupId, year, agentIds } = {}) {
  let query = supabase.from('metrics_vw_ab_scorecard').select('*')
    .gte('metric_month', `${year}-01-01`)
    .lte('metric_month', `${year}-12-31`)
  if (agentId)          query = query.eq('agent_id', Number(agentId))
  if (groupId)          query = query.eq('group_id', Number(groupId))
  if (agentIds?.length) query = query.in('agent_id', agentIds)
  const { data, error } = await query
  if (error) throw error
  return overlayAttendance(data, { year, agentId, agentIds, groupId })
}

// One row per agent/month — summary ratings
export async function getSummary({ agentId, month, groupId } = {}) {
  let query = supabase.from('metrics_vw_ab_summary').select('*')
  if (agentId) query = query.eq('agent_id', Number(agentId))
  if (month)   query = query.eq('metric_month', toDateParam(month))
  if (groupId) query = query.eq('group_id', Number(groupId))
  const { data, error } = await query
  if (error) throw error
  return data
}

// Trend view
export async function getTrends({ agentId, groupId, year } = {}) {
  let query = supabase.from('metrics_vw_ab_trends').select('*')
  if (agentId) query = query.eq('agent_id', Number(agentId))
  if (groupId) query = query.eq('group_id', Number(groupId))
  if (year) {
    query = query
      .gte('metric_month', `${year}-01-01`)
      .lte('metric_month', `${year}-12-31`)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Historical Goals (metrics_group_goals filtered by date range) ─────────────

// Returns goals that were active during the given month (YYYY-MM or YYYY-MM-01).
// Used by the frontend to show the historically correct goal when viewing a past month.
export async function getActiveGoals({ groupId, month }) {
  if (!month || !groupId) return []
  // Use the full month window so a goal starting mid-month is still matched
  const [year, mon] = month.split('-').map(Number)
  const firstDay = `${String(year)}-${String(mon).padStart(2, '0')}-01`
  const lastDayDate = new Date(year, mon, 0) // day 0 of next month = last day of this month
  const lastDay = `${lastDayDate.getFullYear()}-${String(lastDayDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('metrics_group_goals')
    .select('metric_id, goal_value, tolerance_value, metrics_definitions(metric_key)')
    .eq('group_id', Number(groupId))
    .eq('active', true)
    .lte('effective_start_month', lastDay)
    .or(`effective_end_month.is.null,effective_end_month.gte.${firstDay}`)
  if (error) throw error
  return data
}

// ── Notes, old table (metrics_agent_monthly_notes) ───────────────────────────
// legacy, old table, not used since APT-151 — kept only so the change is easy
// to review. Notes now live in metrics_agent_notes, one row per author, and
// adjustments in metrics_agent_month_adjustments. Nothing calls these three.

export async function getAgentMonthNote({ agentId, noteMonth }) {
  const { data, error } = await supabase
    .from('metrics_agent_monthly_notes')
    .select('*')
    .eq('agent_id', agentId)
    .eq('metric_month', toDateParam(noteMonth))
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertAgentMonthNote({ agentId, noteMonth, noteText, createdBy }) {
  const row = { agent_id: agentId, metric_month: toDateParam(noteMonth), note_text: noteText }
  if (createdBy) row.created_by = createdBy
  const { data, error } = await supabase
    .from('metrics_agent_monthly_notes')
    .upsert(row, { onConflict: 'agent_id,metric_month' })
    .select()
    .single()
  if (error) {
    // If created_by column doesn't exist in DB yet, retry without it so the note still saves
    if (error.message?.includes('created_by') && row.created_by !== undefined) {
      delete row.created_by
      const { data: d2, error: e2 } = await supabase
        .from('metrics_agent_monthly_notes')
        .upsert(row, { onConflict: 'agent_id,metric_month' })
        .select()
        .single()
      if (e2) throw e2
      return d2
    }
    throw error
  }
  return data
}

export async function getAllNotes({ agentId, month } = {}) {
  let query = supabase
    .from('metrics_agent_monthly_notes')
    .select('*, metrics_agents(agent_name)')
    .order('metric_month', { ascending: false })
    .order('agent_id')
  if (agentId) query = query.eq('agent_id', agentId)
  if (month)   query = query.eq('metric_month', toDateParam(month))
  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Notes, per author (metrics_agent_notes) ──────────────────────────────────
//
// APT-151: a note belongs to the person who wrote it. The database decides who
// may see what — a User reads and writes only their own rows, an Admin all of
// them — so these functions never filter by author themselves, except where a
// particular person's row is wanted.

// My own note for this agent and month, or null if I have not written one
export async function getMyNote(agentId, month, userId) {
  if (!agentId || !month || !userId) return null
  const { data, error } = await supabase
    .from('metrics_agent_notes')
    .select('*')
    .eq('agent_id', Number(agentId))
    .eq('metric_month', toDateParam(month))
    .eq('author_user', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Writes my own note. Emptying the box removes the row rather than storing a
// blank one, so "no note" and "an empty note" cannot drift apart.
export async function upsertMyNote({ agentId, month, text, userId, byName }) {
  const monthDate = toDateParam(month)
  if (!String(text ?? '').trim()) {
    const { error } = await supabase
      .from('metrics_agent_notes')
      .delete()
      .eq('agent_id', Number(agentId))
      .eq('metric_month', monthDate)
      .eq('author_user', userId)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase
    .from('metrics_agent_notes')
    .upsert({
      agent_id: Number(agentId),
      metric_month: monthDate,
      note_text: text,
      author_user: userId,
      author_name: byName ?? null,
    }, { onConflict: 'agent_id,metric_month,author_user' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Every note this person is allowed to see: their own, or all of them for an
// Admin. The database applies that rule, not this query.
export async function getAllNotesVisible() {
  const { data, error } = await supabase
    .from('metrics_agent_notes')
    .select('*, metrics_agents(agent_name)')
    .order('metric_month', { ascending: false })
    .order('agent_id')
  if (error) throw error
  return data
}

export async function updateNoteById(id, text) {
  const { data, error } = await supabase
    .from('metrics_agent_notes')
    .update({ note_text: text })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Used by anyone for their own note, and by an Admin to add one on behalf of
// someone else. The database refuses an author other than yourself unless you
// are an Admin.
export async function insertNoteForAuthor({ agentId, month, text, authorUserId, authorName }) {
  const { data, error } = await supabase
    .from('metrics_agent_notes')
    .insert({
      agent_id: Number(agentId),
      metric_month: toDateParam(month),
      note_text: text,
      author_user: authorUserId ?? null,
      author_name: authorName ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNoteById(id) {
  const { error } = await supabase
    .from('metrics_agent_notes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Accounts and their roles — an Admin sees every row, a User only their own.
// Used to show a note's author as an email address.
export async function getAppUsers() {
  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, email, role')
  if (error) throw error
  return data
}

// ── Metric adjustments (metrics_agent_month_adjustments) ─────────────────────
//
// APT-151: shared, not private. Everyone with a role sees and may change them,
// because an adjustment changes the rating everyone reads.

export async function getAdjustments(agentId, month) {
  if (!agentId || !month) return []
  const { data, error } = await supabase
    .from('metrics_agent_month_adjustments')
    .select('*')
    .eq('agent_id', Number(agentId))
    .eq('metric_month', toDateParam(month))
  if (error) throw error
  return data ?? []
}

export async function getAllAdjustments({ agentId, month } = {}) {
  let query = supabase
    .from('metrics_agent_month_adjustments')
    .select('*, metrics_agents(agent_name)')
    .order('metric_month', { ascending: false })
    .order('agent_id')
    .order('metric_key')
  if (agentId) query = query.eq('agent_id', Number(agentId))
  if (month)   query = query.eq('metric_month', toDateParam(month))
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function upsertAdjustment(row) {
  const { data, error } = await supabase
    .from('metrics_agent_month_adjustments')
    .upsert(row, { onConflict: 'agent_id,metric_month,metric_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAdjustment({ agentId, month, metricKey }) {
  const { error } = await supabase
    .from('metrics_agent_month_adjustments')
    .delete()
    .eq('agent_id', Number(agentId))
    .eq('metric_month', toDateParam(month))
    .eq('metric_key', metricKey)
  if (error) throw error
}

// ── Attendance (references old tables — may fail if schema changed) ───────────
// These functions reference tables/views from the old schema that may not exist:
//   metrics_cfg_attendance_codes  → getAttendanceCodes()
//   metrics_vw_attendance_monthly → getAttendanceMonthly()
//   metrics_vw_attendance_daily   → getAttendanceDaily()
//   metrics_fact_attendance_daily → upsertAttendance(), deleteAttendance()

export async function getAttendanceCodes() {
  const { data, error } = await supabase
    .from('metrics_cfg_attendance_codes')
    .select('id, code, code_name, category, counts_as_available, counts_as_scheduled, active, display_order')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return data
}

// APT-139: every code including inactive ones, for the admin screen
export async function getAllAttendanceCodes() {
  const { data, error } = await supabase
    .from('metrics_cfg_attendance_codes')
    .select('*')
    .order('display_order')
  if (error) throw error
  return data
}

export async function upsertAttendanceCode(row) {
  const { data, error } = await supabase
    .from('metrics_cfg_attendance_codes')
    .upsert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAttendanceMonthly({ month, externalGroupId } = {}) {
  let query = supabase.from('metrics_vw_attendance_monthly').select('*')
  if (month)           query = query.eq('metric_month', toDateParam(month))
  if (externalGroupId) query = query.eq('external_group_id', Number(externalGroupId))
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAttendanceDaily({ month, agentId, externalGroupId } = {}) {
  let query = supabase.from('metrics_vw_attendance_daily').select('*')
  if (month)           query = query.eq('attendance_month', toDateParam(month))
  if (agentId)         query = query.eq('agent_id', agentId)
  if (externalGroupId) query = query.eq('external_group_id', Number(externalGroupId))
  const { data, error } = await query
  if (error) throw error
  return data
}

// Day-level rows straight from the fact table. The daily view joins on team
// assignments and can drop agents without an active one, so reads that must
// round-trip with saves (Attendance Entry grid + export) use this instead.
export async function getAttendanceFacts({ month } = {}) {
  let query = supabase.from('metrics_fact_attendance_daily').select('*')
  if (month) {
    const first = toDateParam(month)
    const [y, m] = first.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    query = query
      .gte('attendance_date', first)
      .lte('attendance_date', `${first.slice(0, 8)}${String(lastDay).padStart(2, '0')}`)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

// Monthly attendance rollup computed from the fact table + codes, so results
// never depend on team-assignment date windows (unlike the monthly view).
export async function getAttendanceRollup({ month, year } = {}) {
  // A full year of attendance for all agents exceeds PostgREST's 1000-row
  // default, so page through every matching fact row explicitly.
  let start, end
  if (month) {
    const first = toDateParam(month)
    const [y, m] = first.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    start = first
    end = `${first.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
  } else if (year) {
    start = `${year}-01-01`
    end = `${year}-12-31`
  }
  const facts = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('metrics_fact_attendance_daily').select('*')
    if (start) q = q.gte('attendance_date', start).lte('attendance_date', end)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    facts.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  const { data: codesData, error: codesErr } = await supabase.from('metrics_cfg_attendance_codes').select('*')
  if (codesErr) throw codesErr
  const codeById = {}
  codesData.forEach((c) => { codeById[c.id] = c })
  const byKey = {}
  facts.forEach((r) => {
    const code = codeById[r.attendance_code_id]
    if (!code) return
    const monthKey = String(r.attendance_date).slice(0, 7)
    const k = `${r.agent_id}:${monthKey}`
    const b = byKey[k] ??= { agent_id: r.agent_id, metric_month: `${monthKey}-01`, scheduled_days: 0, available_days: 0 }
    if (code.counts_as_scheduled) b.scheduled_days++
    if (code.counts_as_available) b.available_days++
  })
  return Object.values(byKey).map((b) => ({
    ...b,
    attendance_pct: b.scheduled_days ? (b.available_days / b.scheduled_days) * 100 : null,
  }))
}

export async function upsertAttendance(rows) {
  const { data, error } = await supabase
    .from('metrics_fact_attendance_daily')
    .upsert(rows, { onConflict: 'attendance_date,agent_id' })
    .select()
  if (error) throw error
  return data
}

export async function deleteAttendance({ attendanceDate, agentId }) {
  const { error } = await supabase
    .from('metrics_fact_attendance_daily')
    .delete()
    .eq('attendance_date', attendanceDate)
    .eq('agent_id', agentId)
  if (error) throw error
}
