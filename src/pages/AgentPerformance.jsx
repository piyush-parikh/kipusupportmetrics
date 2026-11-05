import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getTeams, getAgents,
  getAllMetricDefinitions, getScorecard, getScorecardYear,
  getMyNote, upsertMyNote, getActiveGoals,
  getAgentTeamAssignments,
  getAdjustments, upsertAdjustment, deleteAdjustment,
  getAllNotesVisible, getAppUsers,
} from '../lib/api'
import { formatValue, statusLabel, statusClass, ratingClass, ratingIcon, computeRating } from '../lib/format'
import Modal from '../components/Modal'
import { rowsToAdjustments, adjustmentToRow } from '../lib/adjustmentRows'
import { useAuth } from '../lib/useAuth'
import { toMessage } from '../lib/errors'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },  { value: '02', label: 'February' },
  { value: '03', label: 'March' },    { value: '04', label: 'April' },
  { value: '05', label: 'May' },      { value: '06', label: 'June' },
  { value: '07', label: 'July' },     { value: '08', label: 'August' },
  { value: '09', label: 'September' },{ value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

function getYearOptions() {
  const cur = new Date().getFullYear()
  const years = []
  for (let y = cur + 1; y >= 2023; y--) years.push(String(y))
  return years
}

const QUARTERS = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
]

const HALVES = [
  { label: 'H1', months: [1, 2, 3, 4, 5, 6] },
  { label: 'H2', months: [7, 8, 9, 10, 11, 12] },
]

// ── Rollup helpers ────────────────────────────────────────────────────────────

function metricMonthNum(metricMonth) {
  return parseInt(metricMonth.slice(5, 7), 10)
}

function computePeriodActual(rows, unitType) {
  const withData = rows.filter((r) => r.actual_value != null)
  if (!withData.length) return null
  // Attendance rows carry day counts — weight by days worked, not by month
  const dayRows = withData.filter((r) => r.att_scheduled_days != null)
  if (dayRows.length === withData.length) {
    const sched = dayRows.reduce((s, r) => s + r.att_scheduled_days, 0)
    const avail = dayRows.reduce((s, r) => s + r.att_available_days, 0)
    return sched ? (avail / sched) * 100 : null
  }
  const sum = withData.reduce((s, r) => s + r.actual_value, 0)
  return unitType === 'count' ? sum : sum / withData.length
}

// Uses direction_good values: 'at_or_above' | 'at_or_below'
// APT-136: values display as whole numbers (APT-129), so compare on the rounded
// figures too — otherwise a raw 94.6 shows as "95% vs 95%" yet reads Off Track.
// APT-151: how a note's author is shown. Notes copied from the old table have
// no account behind them until an Admin links one, so say so plainly.
function noteAuthorLabel(note, appUsers) {
  if (note?.author_name) return note.author_name
  const match = (appUsers ?? []).find((u) => u.user_id === note?.author_user)
  if (match?.email) return match.email
  return '(not linked to an account)'
}

function deriveStatus(actual, refRow) {
  if (actual == null || !refRow) return 'no_data'
  const { goal_value, tolerance_value, direction_good } = refRow
  if (goal_value == null) return 'no_target'
  const a = Math.round(actual)
  const goal = Math.round(goal_value)
  const tol = Math.round(tolerance_value ?? 0)
  if (direction_good === 'at_or_above') return a >= goal - tol ? 'on_track' : 'off_track'
  if (direction_good === 'at_or_below') return a <= goal + tol ? 'on_track' : 'off_track'
  return 'no_target'
}

// Ensure all configured metrics show even when view returns no row for that metric
function mergeMetrics(configuredList, viewRows) {
  return configuredList.map((metric) => {
    const dataRow = viewRows.find((r) => r.metric_key === metric.metric_key)
    if (dataRow) return dataRow
    return {
      metric_key: metric.metric_key,
      metric_name: metric.metric_name,
      unit_type: metric.unit_type,
      direction_good: metric.direction_good,
      counts_toward_score: metric.counts_toward_score,
      actual_value: null,
      goal_value: null,
      tolerance_value: null,
      on_track: null,
      metric_status: 'no_data',
    }
  })
}

// Build display metric list from view rows (primary) + metricDefs (fallback for no-data rows).
// inactiveKeys: Set of metric_key strings to skip from view rows.
function buildMetricList(viewRows, fallbackDefs, inactiveKeys = new Set()) {
  const seen = new Set()
  const list = []
  viewRows.forEach((r) => {
    if (!seen.has(r.metric_key) && !inactiveKeys.has(r.metric_key)) {
      seen.add(r.metric_key)
      list.push({
        metric_key: r.metric_key,
        metric_name: r.metric_name,
        unit_type: r.unit_type,
        direction_good: r.direction_good,
        counts_toward_score: r.counts_toward_score,
        display_order: r.display_order ?? 999,
      })
    }
  })
  fallbackDefs.forEach((m) => {
    if (!seen.has(m.metric_key)) list.push({ ...m, display_order: m.display_order ?? 999 })
  })
  return list.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
}

// APT-81: Override goal/tolerance/status on scorecard rows with historically correct values
function applyHistoricalGoals(rows, histGoals) {
  if (!histGoals.length) return rows
  const goalMap = {}
  histGoals.forEach((g) => {
    const key = g.metrics_definitions?.metric_key
    if (key) goalMap[key] = { goal_value: g.goal_value, tolerance_value: g.tolerance_value }
  })
  return rows.map((row) => {
    const g = goalMap[row.metric_key]
    if (!g) return row
    const { goal_value, tolerance_value } = g
    const metric_status = row.actual_value != null
      ? deriveStatus(row.actual_value, { goal_value, tolerance_value, direction_good: row.direction_good })
      : row.metric_status
    return { ...row, goal_value, tolerance_value, metric_status }
  })
}

// APT-135: "4 months in current role" from a hire date
function formatTenure(fromDate) {
  if (!fromDate) return null
  const start = new Date(fromDate)
  if (isNaN(start)) return null
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return 'Starts soon'
  if (months < 1) return 'Less than a month in current role'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} in current role`
  const years = Math.floor(months / 12)
  const rem = months % 12
  const y = `${years} year${years === 1 ? '' : 's'}`
  return rem ? `${y} ${rem} month${rem === 1 ? '' : 's'} in current role` : `${y} in current role`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusCell({ status }) {
  if (status === 'on_track' || status === 'off_track') {
    return <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>
  }
  return <span style={{ color: '#9ca3af', fontSize: 11, fontStyle: 'italic' }}>{statusLabel(status)}</span>
}

function MetricRow({ row, onAdjust }) {
  const hasActual = row.actual_value != null
  const adj = row.adjustment
  const excluded = row.metric_status === 'excluded'
  const adjTitle = adj ? `${adj.exclude ? 'Excluded' : 'Custom goal'}${adj.reason ? `: ${adj.reason}` : ''}${adj.by ? ` — ${adj.by}` : ''}` : undefined
  return (
    <tr style={excluded ? { opacity: 0.55 } : undefined}>
      <td style={{ fontWeight: 500, minWidth: 160 }}>
        {row.metric_name}
        {adj && !excluded && (
          <span title={adjTitle} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', borderRadius: 8, padding: '1px 6px', cursor: 'help' }}>
            custom goal
          </span>
        )}
      </td>
      <td
        style={{ textAlign: 'right', fontWeight: hasActual ? 600 : 400, color: hasActual ? '#1a1a2e' : '#adb5bd' }}
        title={hasActual ? `Exact value: ${row.actual_value}` : undefined}
      >
        {hasActual ? formatValue(row.actual_value, row.unit_type) : '—'}
      </td>
      <td style={{ textAlign: 'right', color: '#6b7a8d' }}>
        {row.goal_value != null ? formatValue(row.goal_value, row.unit_type) : '—'}
      </td>
      <td style={{ textAlign: 'right', color: '#6b7a8d' }}>
        {row.tolerance_value != null ? `±${row.tolerance_value}` : '—'}
      </td>
      <td>
        {excluded
          ? <span title={adjTitle} style={{ color: '#9ca3af', fontSize: 11, fontStyle: 'italic', cursor: 'help' }}>Excluded</span>
          : <StatusCell status={row.metric_status} />}
      </td>
      {onAdjust && (
        <td style={{ textAlign: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onAdjust(row)} style={{ fontSize: 11 }}>
            {adj ? 'Edit' : 'Adjust'}
          </button>
        </td>
      )}
    </tr>
  )
}

// APT-88: Pop-up for excluding a metric or setting a custom goal for one agent+month
function AdjustModal({ row, byName, saving, onSave, onRemove, onClose }) {
  const existing = row.adjustment
  const [mode, setMode] = useState(existing?.exclude ? 'exclude' : 'goal')
  const [goal, setGoal] = useState(existing?.goal ?? row.goal_value ?? '')
  const [tolerance, setTolerance] = useState(existing?.tolerance ?? row.tolerance_value ?? '')
  const [reason, setReason] = useState(existing?.reason ?? '')
  const canSave = reason.trim() !== '' && (mode === 'exclude' || goal !== '')
  return (
    <Modal
      title={`Adjust — ${row.metric_name}`}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button className="btn btn-danger" onClick={onRemove} disabled={saving} style={{ marginRight: 'auto' }}>
              Remove Adjustment
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!canSave || saving}
            onClick={() => onSave({
              metric_key: row.metric_key,
              ...(mode === 'exclude'
                ? { exclude: true }
                : { goal: Number(goal), ...(tolerance !== '' ? { tolerance: Number(tolerance) } : {}) }),
              reason: reason.replace(/[|\n\r]+/g, ' ').trim(),
              by: byName || undefined,
            })}
          >
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
          <input type="radio" name="adj-mode" checked={mode === 'goal'} onChange={() => setMode('goal')} />
          Custom goal for this agent, this month (e.g. new hire or PIP)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="radio" name="adj-mode" checked={mode === 'exclude'} onChange={() => setMode('exclude')} />
          Exclude this metric from the score this month
        </label>
      </div>
      {mode === 'goal' && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Custom Goal</label>
            <input className="form-input" type="number" step="any" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tolerance (optional)</label>
            <input className="form-input" type="number" step="any" value={tolerance} onChange={(e) => setTolerance(e.target.value)} placeholder="Keep team tolerance" />
          </div>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Reason (required)</label>
        <textarea className="form-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'exclude' ? 'e.g. CSAT ticket not agent’s fault' : 'e.g. 90-day new hire ramp goal'} />
      </div>
      <div className="form-group">
        <label className="form-label">Adjusted by</label>
        <div style={{ fontSize: 13, color: '#4a5568' }}>{byName || '—'}</div>
      </div>
      <p style={{ fontSize: 11, color: '#6b7a8d', marginTop: 4 }}>
        This affects only this agent for {row.metric_month ? String(row.metric_month).slice(0, 7) : 'this month'}. Everyone who can see this agent sees the adjustment and the same rating.
      </p>
    </Modal>
  )
}

function RollupTable({ title, periods, configuredMetrics, yearDetail }) {
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th className="sticky-metric-head" style={{ minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }}>Metric</th>
              {periods.map((p) => (
                <th key={p.label} className="period-th" style={{ minWidth: 90, width: 90 }}>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configuredMetrics.map((metric) => {
              const metricRows = yearDetail.filter((r) => r.metric_key === metric.metric_key)
              const refRow = [...metricRows]
                .filter((r) => r.actual_value != null)
                .sort((a, b) => b.metric_month.localeCompare(a.metric_month))[0]
              return (
                <tr key={metric.metric_key}>
                  <td className="sticky-metric-cell" style={{ position: 'sticky', left: 0, background: 'inherit' }}>
                    {metric.metric_name}
                  </td>
                  {periods.map((p) => {
                    const periodRows = metricRows.filter((r) =>
                      p.months.includes(metricMonthNum(r.metric_month))
                    )
                    const actual = computePeriodActual(periodRows, metric.unit_type)
                    const status = deriveStatus(actual, refRow)
                    const isTracked = status === 'on_track' || status === 'off_track'
                    return (
                      <td key={p.label} style={{ textAlign: 'center', width: 90 }}>
                        {actual == null ? (
                          <span style={{ color: '#d1d5db' }}>—</span>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{formatValue(actual, metric.unit_type)}</div>
                            {isTracked && (
                              <span className={`badge ${statusClass(status)}`} style={{ fontSize: 9, marginTop: 2, display: 'inline-block' }}>
                                {statusLabel(status)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? v : fallback } catch { return fallback }
}
function savePref(key, val) { try { localStorage.setItem(key, val) } catch {} }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentPerformance() {
  const now = new Date()
  const yearOptions = getYearOptions()
  const savedAgentRef = useRef(loadPref('ktp_ap_agent', ''))

  const [teams, setTeams]   = useState([])
  const [agents, setAgents] = useState([])
  const [allDefs, setAllDefs] = useState([])

  // APT-61: Persistent filters
  const [teamId, setTeamId]   = useState(() => loadPref('ktp_ap_team', ''))
  const [agentId, setAgentId] = useState(() => loadPref('ktp_ap_agent', ''))
  const [year, setYear]       = useState(() => loadPref('ktp_ap_year', String(now.getFullYear())))
  const [selMonth, setSelMonth] = useState(() => loadPref('ktp_ap_month', String(now.getMonth() + 1).padStart(2, '0')))

  // APT-41: Period view tabs
  const [viewMode, setViewMode] = useState(() => loadPref('ktp_ap_view', 'monthly'))

  // APT-78/79: Show/hide inactive agents
  const [showInactive, setShowInactive] = useState(false)

  const [monthDetail, setMonthDetail] = useState([])
  const [yearDetail, setYearDetail]   = useState([])
  const [note, setNote]               = useState('')
  const [savedNote, setSavedNote]     = useState('')
  const [noteSaving, setNoteSaving]   = useState(false)
  const [noteMsg, setNoteMsg]         = useState('')
  const [noteUpdatedAt, setNoteUpdatedAt] = useState(null)
  const [notesVisible, setNotesVisible] = useState(true)
  // APT-151: an Admin can see that other people have written notes for the
  // same agent and month. A User never sees anyone else's.
  const [otherNotes, setOtherNotes] = useState([])
  const [appUsers, setAppUsers] = useState([])

  // APT-135: Team assignments for the selected agent (role/tenure come from the agent row)
  const [agentTeams, setAgentTeams] = useState([])

  // APT-88: Per-metric adjustments for the selected agent+month
  const [adjustments, setAdjustments] = useState({})
  const [adjustRow, setAdjustRow] = useState(null)
  const [adjustSaving, setAdjustSaving] = useState(false)

  // APT-151: a note belongs to whoever is signed in; there is no dropdown
  const { user, email: myEmail, isAdmin } = useAuth()
  const myUserId = user?.id ?? null

  const [loading, setLoading]         = useState(false)
  const [yearLoading, setYearLoading] = useState(false)
  const [error, setError]             = useState('')

  // APT-61: Save filter prefs
  useEffect(() => savePref('ktp_ap_team', teamId), [teamId])
  useEffect(() => savePref('ktp_ap_agent', agentId), [agentId])
  useEffect(() => savePref('ktp_ap_year', year), [year])
  useEffect(() => savePref('ktp_ap_month', selMonth), [selMonth])
  useEffect(() => savePref('ktp_ap_view', viewMode), [viewMode])

  // APT-65: Load all metric definitions (active + inactive)
  useEffect(() => {
    getTeams().then(setTeams).catch((e) => setError(toMessage(e)))
    getAllMetricDefinitions().then(setAllDefs).catch((e) => setError(toMessage(e)))
  }, [])

  // APT-65: Derive active metricDefs and inactiveKeys
  const metricDefs = useMemo(() => allDefs.filter((d) => d.active), [allDefs])
  const inactiveKeys = useMemo(() => new Set(allDefs.filter((d) => !d.active).map((d) => d.metric_key)), [allDefs])

  // APT-78/79: Visible agents in dropdown (filter inactive unless toggled)
  const visibleAgents = useMemo(
    () => showInactive ? agents : agents.filter((a) => a.active !== false),
    [agents, showInactive]
  )

  // Reload agents when team filter changes
  useEffect(() => {
    setAgentId('')
    getAgents({ groupId: teamId || undefined })
      .then((list) => {
        setAgents(list)
        if (savedAgentRef.current) {
          const match = list.find((a) => String(a.id) === savedAgentRef.current)
          if (match) setAgentId(savedAgentRef.current)
          savedAgentRef.current = ''
        }
      })
      .catch((e) => setError(toMessage(e)))
  }, [teamId])

  // Load monthly data when agent / year / month / team changes
  useEffect(() => {
    if (!agentId) return
    const monthKey = `${year}-${selMonth}`
    setLoading(true)
    setError('')
    Promise.all([
      getScorecard({ agentId: Number(agentId), month: monthKey }),
      getMyNote(Number(agentId), monthKey, myUserId),
      teamId ? getActiveGoals({ groupId: teamId, month: monthKey }) : Promise.resolve([]),
      getAdjustments(Number(agentId), monthKey),
    ])
      .then(([sc, noteRow, histGoals, adjRows]) => {
        setMonthDetail(applyHistoricalGoals(sc, histGoals))
        setNote(noteRow?.note_text ?? '')
        setSavedNote(noteRow?.note_text ?? '')
        setAdjustments(rowsToAdjustments(adjRows))
        setNoteUpdatedAt(noteRow?.updated_at ?? noteRow?.created_at ?? null)
      })
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }, [agentId, year, selMonth, teamId, myUserId])

  // APT-151: an Admin also sees who else has written for this agent and month.
  // A User gets nothing back from the database for other people's notes, so
  // this is not even requested for them.
  useEffect(() => {
    if (!isAdmin || !agentId) { setOtherNotes([]); return undefined }
    let active = true
    const monthKey = `${year}-${selMonth}-01`
    Promise.all([getAllNotesVisible(), getAppUsers()])
      .then(([notes, users]) => {
        if (!active) return
        setOtherNotes((notes ?? []).filter((n) =>
          String(n.agent_id) === String(agentId) &&
          String(n.metric_month).slice(0, 10) === monthKey &&
          n.author_user !== myUserId
        ))
        setAppUsers(users ?? [])
      })
      .catch(() => { if (active) { setOtherNotes([]); setAppUsers([]) } })
    return () => { active = false }
  }, [isAdmin, agentId, year, selMonth, myUserId])

  // APT-135: Load the selected agent's team assignments for the context strip
  useEffect(() => {
    if (!agentId) { setAgentTeams([]); return }
    getAgentTeamAssignments(Number(agentId))
      .then((rows) => setAgentTeams(rows.filter((r) => r.active !== false)))
      .catch(() => setAgentTeams([]))
  }, [agentId])

  // Load year data for rollups
  useEffect(() => {
    if (!agentId) return
    setYearLoading(true)
    getScorecardYear({ agentId: Number(agentId), year })
      .then(setYearDetail)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setYearLoading(false))
  }, [agentId, year])

  const saveNote = async () => {
    if (!agentId) return
    setNoteSaving(true)
    setNoteMsg('')
    try {
      const saved = await upsertMyNote({
        agentId: Number(agentId),
        month: `${year}-${selMonth}`,
        text: note,
        userId: myUserId,
        byName: myEmail || null,
      })
      setSavedNote(note)
      setNoteUpdatedAt(saved?.updated_at ?? saved?.created_at ?? null)
      setNoteMsg(saved ? 'Saved.' : 'Note removed.')
      setTimeout(() => setNoteMsg(''), 3000)
    } catch (e) {
      setNoteMsg('Error: ' + toMessage(e))
    } finally {
      setNoteSaving(false)
    }
  }

  // APT-151: adjustments are rows of their own now, saved one metric at a
  // time, and shared — so the page reloads them from the database afterwards
  // rather than trusting local state.
  async function reloadAdjustments() {
    const rows = await getAdjustments(Number(agentId), `${year}-${selMonth}`)
    setAdjustments(rowsToAdjustments(rows))
  }

  async function saveAdjustment(adj) {
    setAdjustSaving(true)
    try {
      await upsertAdjustment(adjustmentToRow(adj, {
        agentId: Number(agentId),
        month: `${year}-${selMonth}`,
        userId: myUserId,
        byName: myEmail || null,
      }))
      await reloadAdjustments()
      setAdjustRow(null)
    } catch (e) {
      setError('Could not save the adjustment: ' + toMessage(e))
    } finally {
      setAdjustSaving(false)
    }
  }

  async function removeAdjustment(metricKey) {
    setAdjustSaving(true)
    try {
      await deleteAdjustment({
        agentId: Number(agentId),
        month: `${year}-${selMonth}`,
        metricKey,
      })
      await reloadAdjustments()
      setAdjustRow(null)
    } catch (e) {
      setError('Could not remove the adjustment: ' + toMessage(e))
    } finally {
      setAdjustSaving(false)
    }
  }

  // APT-65: Build display metric list with inactiveKeys filter
  const allMetrics    = useMemo(() => buildMetricList(monthDetail, metricDefs, inactiveKeys), [monthDetail, metricDefs, inactiveKeys])
  const rollupMetrics = useMemo(() => buildMetricList(yearDetail,  metricDefs, inactiveKeys), [yearDetail,  metricDefs, inactiveKeys])

  // Merge produces a row for every display metric (placeholder when agent has no data for it)
  const mergedRows = mergeMetrics(allMetrics, monthDetail)

  // APT-88: Apply per-agent adjustments — excluded metrics drop from the score,
  // custom goals recalculate on/off track for this agent+month only.
  // A metric with a manager-set goal always counts toward the overall rating,
  // even if it is normally an "additional" (non-scored) metric.
  const allRows = useMemo(() => mergedRows.map((row) => {
    const adj = adjustments[row.metric_key]
    if (adj?.exclude) return { ...row, metric_status: 'excluded', adjustment: adj }
    const goal_value = adj?.goal ?? row.goal_value
    const tolerance_value = adj?.tolerance ?? row.tolerance_value
    // APT-138: derive the status for EVERY row, not just adjusted ones. The
    // database view decides on/off track from unrounded values (e.g. 54.6 vs a
    // 55 goal), which contradicts the whole numbers we display (55% vs 55%).
    const metric_status = (row.actual_value != null && goal_value != null)
      ? deriveStatus(row.actual_value, { goal_value, tolerance_value, direction_good: row.direction_good ?? 'at_or_above' })
      : row.metric_status
    const base = { ...row, goal_value, tolerance_value, metric_status }
    return adj ? { ...base, adjustment: adj, counts_toward_score: true } : base
  }), [mergedRows, adjustments])

  const selectedMonthLabel = MONTH_OPTIONS.find((m) => m.value === selMonth)?.label ?? selMonth

  // APT-135: Role / team / tenure context for the selected agent
  const selectedAgent = useMemo(
    () => agents.find((a) => String(a.id) === String(agentId)) ?? null,
    [agents, agentId]
  )
  const agentTeamNames = useMemo(() => {
    const names = agentTeams.map((t) => t.metrics_groups?.group_name).filter(Boolean)
    return [...new Set(names)]
  }, [agentTeams])
  const agentTenure = formatTenure(selectedAgent?.hire_date)

  // APT-36: Compute rating from scorecard rows (counts_toward_score metrics with data + goal only)
  const computedRating = useMemo(
    () => computeRating(allRows, `${year}-${selMonth}`),
    [allRows, year, selMonth]
  )
  const ratingLabel   = computedRating.label
  const onTrackCount  = computedRating.onTrack
  const offTrackCount = computedRating.offTrack
  const withDataCount = computedRating.total

  // APT-49: YTD computed data
  const ytdData = useMemo(() => {
    const curMonth = new Date().getMonth() + 1
    const ytdRows = yearDetail.filter((r) => {
      const m = parseInt(r.metric_month.slice(5, 7), 10)
      return m <= curMonth && r.actual_value != null
    })
    return rollupMetrics.map((metric) => {
      const rows = ytdRows.filter((r) => r.metric_key === metric.metric_key)
      if (!rows.length) return { ...metric, actual: null, status: 'no_data' }
      const actual = computePeriodActual(rows, metric.unit_type)
      const refRow = [...rows].sort((a, b) => b.metric_month.localeCompare(a.metric_month))[0]
      return { ...metric, actual, status: deriveStatus(actual, refRow) }
    })
  }, [yearDetail, rollupMetrics])

  // APT-50: Trend months
  const trendMonths = useMemo(() => {
    const months = [...new Set(yearDetail.map((r) => r.metric_month))].sort()
    return months
  }, [yearDetail])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Agent Performance</h1>
        <p className="page-subtitle">Monthly scorecard by agent</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Team</label>
          <select className="filter-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Agent</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select className="filter-select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Select Agent</option>
              {visibleAgents.map((a) => <option key={a.id} value={a.id}>{a.agent_name}</option>)}
            </select>
            {agentId && (
              <Link
                to={`/admin/agents?agent=${agentId}`}
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
                title="View agent admin profile"
              >
                Profile →
              </Link>
            )}
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label">Year</label>
          <select className="filter-select" style={{ minWidth: 90 }} value={year} onChange={(e) => setYear(e.target.value)}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Month</label>
          <select className="filter-select" value={selMonth} onChange={(e) => setSelMonth(e.target.value)}>
            {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        {/* APT-78/79: Show inactive toggle */}
        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#6b7a8d', paddingTop: 18 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
      </div>

      {!agentId && (
        <div className="empty-state">
          <h3>Select an agent to view performance</h3>
          <p>Optionally filter by team, then choose an agent.</p>
        </div>
      )}

      {agentId && loading && <div className="loading">Loading…</div>}

      {agentId && !loading && (
        <>
          {/* APT-135: Agent context — role, team, tenure */}
          <div className="ctx-card">
            <div className="ctx-item">
              <div className="ctx-label">Role</div>
              <div className={`ctx-value${selectedAgent?.role ? '' : ' ctx-empty'}`}>
                {selectedAgent?.role || 'Not set'}
              </div>
            </div>
            <div className="ctx-item">
              <div className="ctx-label">Team</div>
              <div className={`ctx-value${agentTeamNames.length ? '' : ' ctx-empty'}`}>
                {agentTeamNames.length ? agentTeamNames.join(' · ') : 'No team assigned'}
              </div>
            </div>
            <div className="ctx-item">
              <div className="ctx-label">Tenure</div>
              <div className={`ctx-value${agentTenure ? '' : ' ctx-empty'}`}>
                {agentTenure ?? 'Hire date not set'}
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="cards-row">
            <div className="stat-card">
              <div className="stat-label">Overall Rating</div>
              <div className={`stat-value ${ratingClass(ratingLabel)}`} style={{ fontSize: 18, marginTop: 4 }}>
                {ratingIcon(ratingLabel)} {ratingLabel}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">On Track</div>
              <div className="stat-value" style={{ color: '#1a6e3a' }}>{onTrackCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Off Track</div>
              <div className="stat-value" style={{ color: '#842029' }}>{offTrackCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">With Data</div>
              <div className="stat-value">{withDataCount}</div>
            </div>
          </div>

          {/* APT-41: Period view tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e6ea', marginBottom: 20 }}>
            {[
              { key: 'monthly', label: 'Monthly' },
              { key: 'quarterly', label: 'Quarterly' },
              { key: 'halfyear', label: 'Half-Year' },
              { key: 'ytd', label: 'YTD' },
              { key: 'trend', label: 'Trend' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                style={{
                  padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: viewMode === key ? 700 : 400,
                  color: viewMode === key ? '#4a90e2' : '#6b7a8d',
                  borderBottom: viewMode === key ? '2px solid #4a90e2' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Monthly view */}
          {viewMode === 'monthly' && (
            <>
              <div className="section-title">Metrics — {selectedMonthLabel} {year}</div>
              <div className="table-wrap">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>Metric</th>
                      <th style={{ width: 90, textAlign: 'right' }}>Actual</th>
                      <th style={{ width: 80, textAlign: 'right' }}>Goal</th>
                      <th style={{ width: 80, textAlign: 'right' }}>Tolerance</th>
                      <th style={{ width: 100 }}>Status</th>
                      <th style={{ width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((r) => <MetricRow key={r.metric_key} row={r} onAdjust={setAdjustRow} />)}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Quarterly view */}
          {viewMode === 'quarterly' && (
            yearLoading ? (
              <div className="loading">Loading annual data…</div>
            ) : (
              <RollupTable
                title={`Quarterly Performance — ${year}`}
                periods={QUARTERS}
                configuredMetrics={rollupMetrics}
                yearDetail={yearDetail}
              />
            )
          )}

          {/* Half-Year view */}
          {viewMode === 'halfyear' && (
            yearLoading ? (
              <div className="loading">Loading annual data…</div>
            ) : (
              <RollupTable
                title={`Half-Year Performance — ${year}`}
                periods={HALVES}
                configuredMetrics={rollupMetrics}
                yearDetail={yearDetail}
              />
            )
          )}

          {/* APT-49: YTD view */}
          {viewMode === 'ytd' && (
            <>
              <div className="section-title">Year to Date — {year}</div>
              {yearLoading ? <div className="loading">Loading…</div> : (
                <div className="table-wrap">
                  <table className="sc-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 160 }}>Metric</th>
                        <th style={{ width: 90, textAlign: 'right' }}>YTD Actual</th>
                        <th style={{ width: 80, textAlign: 'right' }}>Goal</th>
                        <th style={{ width: 100 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ytdData.map((row) => (
                        <tr key={row.metric_key}>
                          <td style={{ fontWeight: 500 }}>{row.metric_name}</td>
                          <td style={{ textAlign: 'right', fontWeight: row.actual != null ? 600 : 400, color: row.actual != null ? '#1a1a2e' : '#adb5bd' }}>
                            {row.actual != null ? formatValue(row.actual, row.unit_type) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: '#6b7a8d' }}>
                            {row.goal_value != null ? formatValue(row.goal_value, row.unit_type) : '—'}
                          </td>
                          <td><StatusCell status={row.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* APT-50: Trend view */}
          {viewMode === 'trend' && (
            <>
              <div className="section-title">Monthly Trend — {year}</div>
              {yearLoading ? <div className="loading">Loading…</div> : (
                <div className="table-wrap">
                  <table className="sc-table">
                    <thead>
                      <tr>
                        <th className="sticky-metric-head" style={{ minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }}>Metric</th>
                        {trendMonths.map((m) => (
                          <th key={m} className="period-th" style={{ minWidth: 70, width: 70, textAlign: 'center' }}>
                            {new Date(m.slice(0, 7) + '-02').toLocaleString('default', { month: 'short' })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rollupMetrics.map((metric) => (
                        <tr key={metric.metric_key}>
                          <td className="sticky-metric-cell" style={{ position: 'sticky', left: 0, background: 'inherit', fontWeight: 500 }}>
                            {metric.metric_name}
                          </td>
                          {trendMonths.map((m) => {
                            const row = yearDetail.find((r) => r.metric_key === metric.metric_key && r.metric_month === m)
                            const val = row?.actual_value
                            return (
                              <td key={m} style={{ textAlign: 'center', color: val != null ? '#1a1a2e' : '#d1d5db', fontWeight: val != null ? 600 : 400 }}>
                                {val != null ? formatValue(val, metric.unit_type) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* APT-91: Supervisor Note with hide/show toggle */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: notesVisible ? 12 : 0 }}>
              <div className="card-title" style={{ margin: 0 }}>My Note — {selectedMonthLabel} {year}</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setNotesVisible((v) => !v)}
                style={{ fontSize: 11 }}
              >
                {notesVisible ? 'Hide Notes' : 'Show Notes'}
              </button>
            </div>
            {notesVisible && (
              <>
                <div style={{ fontSize: 11, color: '#6b7a8d', marginBottom: 8 }}>
                  Your private note. Only you and Administrators can see it.
                </div>
                <textarea
                  className="form-textarea"
                  style={{ width: '100%', marginBottom: 8 }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add your note for this agent and month…"
                  rows={4}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveNote}
                    disabled={noteSaving || note === savedNote}
                  >
                    {noteSaving ? 'Saving…' : 'Save Note'}
                  </button>
                  {noteMsg && (
                    <span style={{ fontSize: 12, color: noteMsg.startsWith('Error') ? '#842029' : '#1a6e3a' }}>
                      {noteMsg}
                    </span>
                  )}
                </div>
                {noteUpdatedAt && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    Last saved: {new Date(noteUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}

                {/* APT-151: Admins can see that other people have written here too */}
                {isAdmin && otherNotes.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: '1px solid #e2e6ea', paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>
                      Other notes for this agent and month
                    </div>
                    {otherNotes.map((n) => (
                      <div key={n.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#6b7a8d' }}>{noteAuthorLabel(n, appUsers)}</div>
                        <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{n.note_text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* APT-88: Adjustment pop-up */}
      {adjustRow && (
        <AdjustModal
          row={allRows.find((r) => r.metric_key === adjustRow.metric_key) ?? adjustRow}
          byName={myEmail}
          saving={adjustSaving}
          onClose={() => setAdjustRow(null)}
          onSave={saveAdjustment}
          onRemove={() => removeAdjustment(adjustRow.metric_key)}
        />
      )}
    </div>
  )
}
