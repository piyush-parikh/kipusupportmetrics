import { useState, useEffect, useMemo } from 'react'
import {
  getTeams, getAgents,
  getAllMetricDefinitions, getScorecard, getScorecardYear, getSummary, getActiveGoals,
} from '../lib/api'
import { formatValue, statusClass, statusLabel, ratingClass, recentMonths, computeRating } from '../lib/format'
import { toMessage } from '../lib/errors'

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? v : fallback } catch { return fallback }
}
function savePref(key, val) { try { localStorage.setItem(key, String(val)) } catch {} }

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

// APT-136: compare on the same whole numbers shown on screen (see APT-129)
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

// Returns { metricKey: { actual, status, unitType } } for one agent over a period
function computeAgentPeriodMetrics(agentId, periodMonths, yearDetail, metrics) {
  const agentRows = yearDetail.filter((r) => r.agent_id === agentId)
  const result = {}
  metrics.forEach((metric) => {
    const metricRows = agentRows.filter(
      (r) => r.metric_key === metric.metric_key && periodMonths.includes(metricMonthNum(r.metric_month))
    )
    const dataRows = metricRows.filter((r) => r.actual_value != null)
    if (!dataRows.length) {
      result[metric.metric_key] = { actual: null, status: 'no_data', unitType: metric.unit_type }
      return
    }
    const refRow = [...dataRows].sort((a, b) => b.metric_month.localeCompare(a.metric_month))[0]
    const actual = computePeriodActual(dataRows, metric.unit_type)
    result[metric.metric_key] = { actual, status: deriveStatus(actual, refRow), unitType: metric.unit_type }
  })
  return result
}

// View rows are the primary source; inactive definition keys are excluded.
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
  const goalMap = {}
  histGoals.forEach((g) => {
    const key = g.metrics_definitions?.metric_key
    if (key) goalMap[key] = { goal_value: g.goal_value, tolerance_value: g.tolerance_value }
  })
  // APT-138: derive the status for every row, not only those with a historical
  // goal — the database view judges on/off track from unrounded values, which
  // contradicts the whole numbers shown (e.g. 55% vs a 55% goal reading Off Track).
  return rows.map((row) => {
    const g = goalMap[row.metric_key]
    const goal_value = g ? g.goal_value : row.goal_value
    const tolerance_value = g ? g.tolerance_value : row.tolerance_value
    const metric_status = (row.actual_value != null && goal_value != null)
      ? deriveStatus(row.actual_value, { goal_value, tolerance_value, direction_good: row.direction_good ?? 'at_or_above' })
      : row.metric_status
    return { ...row, goal_value, tolerance_value, metric_status }
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCell({ row }) {
  if (!row || row.actual_value == null) {
    return <td style={{ textAlign: 'center', color: '#d1d5db' }}>—</td>
  }
  const isTracked = row.metric_status === 'on_track' || row.metric_status === 'off_track'
  return (
    <td style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 12 }}>{formatValue(row.actual_value, row.unit_type)}</div>
      {row.goal_value != null && (
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>Goal: {formatValue(row.goal_value, row.unit_type)}</div>
      )}
      {row.tolerance_value != null && (
        <div style={{ fontSize: 9, color: '#b0b8c4', marginTop: 1 }}>Tol: ±{formatValue(row.tolerance_value, row.unit_type)}</div>
      )}
      {isTracked && (
        <span className={`badge ${statusClass(row.metric_status)}`} style={{ fontSize: 9, marginTop: 2, display: 'inline-block' }}>
          {statusLabel(row.metric_status)}
        </span>
      )}
    </td>
  )
}

function PeriodMetricCell({ cell }) {
  if (!cell || cell.actual == null) {
    return <td style={{ textAlign: 'center', color: '#d1d5db' }}>—</td>
  }
  const isTracked = cell.status === 'on_track' || cell.status === 'off_track'
  return (
    <td style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 12 }}>{formatValue(cell.actual, cell.unitType)}</div>
      {isTracked && (
        <span className={`badge ${statusClass(cell.status)}`} style={{ fontSize: 9, marginTop: 2, display: 'inline-block' }}>
          {statusLabel(cell.status)}
        </span>
      )}
    </td>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDashboard() {
  const monthOptions = recentMonths(24)
  const yearOptions = getYearOptions()

  const [teams, setTeams]   = useState([])
  const [agents, setAgents] = useState([])
  const [allDefs, setAllDefs] = useState([])

  const [teamId, setTeamId]         = useState(() => loadPref('ktp_td_team', ''))
  const [search, setSearch]         = useState('')
  const [month, setMonth]           = useState(() => loadPref('ktp_td_month', monthOptions[0]?.value ?? ''))
  const [rollupYear, setRollupYear] = useState(() => loadPref('ktp_td_year', String(new Date().getFullYear())))
  const [showInactive, setShowInactive] = useState(false)
  const [selectedQ, setSelectedQ]   = useState('all')

  const [monthDetail, setMonthDetail] = useState([])
  const [summaries, setSummaries]     = useState([])
  const [yearDetail, setYearDetail]   = useState([])

  const [loading, setLoading]         = useState(false)
  const [yearLoading, setYearLoading] = useState(false)
  const [error, setError]             = useState('')

  // APT-61: Save filter prefs
  useEffect(() => savePref('ktp_td_team', teamId), [teamId])
  useEffect(() => savePref('ktp_td_month', month), [month])
  useEffect(() => savePref('ktp_td_year', rollupYear), [rollupYear])

  // APT-65: Load all defs (active + inactive); default to first team only if no saved pref
  useEffect(() => {
    Promise.all([getTeams(), getAllMetricDefinitions()])
      .then(([t, m]) => {
        setTeams(t)
        setAllDefs(m)
        const saved = loadPref('ktp_td_team', '')
        if (!saved && t.length > 0) setTeamId(String(t[0].id))
      })
      .catch((e) => setError(toMessage(e)))
  }, [])

  // Load all agents with active assignments to this team, including those whose
  // metrics_agents.active may be false (activeOnly: false)
  useEffect(() => {
    if (!teamId) { setAgents([]); return }
    getAgents({ groupId: teamId, activeOnly: false })
      .then(setAgents)
      .catch((e) => setError(toMessage(e)))
  }, [teamId])

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents])

  // Load monthly scorecard + summaries when agentIds / month changes
  useEffect(() => {
    if (!agentIds.length || !month) { setMonthDetail([]); setSummaries([]); return }
    setLoading(true)
    setError('')
    Promise.all([
      getScorecard({ agentIds, month }),
      getSummary({ groupId: teamId ? Number(teamId) : undefined, month }),
      teamId ? getActiveGoals({ groupId: teamId, month }) : Promise.resolve([]),
    ])
      .then(([det, sumRows, histGoals]) => {
        setMonthDetail(applyHistoricalGoals(det, histGoals))
        setSummaries(sumRows)
      })
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }, [agentIds, month, teamId])

  // Load year data for rollups
  useEffect(() => {
    if (!agentIds.length || !rollupYear) { setYearDetail([]); return }
    setYearLoading(true)
    getScorecardYear({ year: rollupYear, agentIds })
      .then(setYearDetail)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setYearLoading(false))
  }, [agentIds, rollupYear])

  // ── Derived data ─────────────────────────────────────────────────────────────

  // APT-65: Derive active metricDefs and inactiveKeys
  const metricDefs = useMemo(() => allDefs.filter((d) => d.active), [allDefs])
  const inactiveKeys = useMemo(() => new Set(allDefs.filter((d) => !d.active).map((d) => d.metric_key)), [allDefs])

  // Build display metric lists with inactiveKeys filter
  const allMetrics    = useMemo(() => buildMetricList(monthDetail, metricDefs, inactiveKeys), [monthDetail, metricDefs, inactiveKeys])
  const rollupMetrics = useMemo(() => buildMetricList(yearDetail,  metricDefs, inactiveKeys), [yearDetail,  metricDefs, inactiveKeys])

  // agentId → metricKey → scorecard row
  const detailByAgent = useMemo(() => {
    const map = {}
    monthDetail.forEach((r) => {
      if (!map[r.agent_id]) map[r.agent_id] = {}
      map[r.agent_id][r.metric_key] = r
    })
    return map
  }, [monthDetail])

  // APT-78/79: Search + inactive filter
  const displayAgents = useMemo(
    () => agents
      .filter((a) => showInactive || a.active !== false)
      .filter((a) => !search || a.agent_name.toLowerCase().includes(search.toLowerCase())),
    [agents, search, showInactive]
  )

  // Only show agents who have at least one actual value in the selected month
  const activeMonthAgents = useMemo(
    () => displayAgents.filter((a) => monthDetail.some((r) => r.agent_id === a.id && r.actual_value != null)),
    [displayAgents, monthDetail]
  )

  // Only show agents who have at least one actual value anywhere in the rollup year
  const activeYearAgents = useMemo(
    () => displayAgents.filter((a) => yearDetail.some((r) => r.agent_id === a.id && r.actual_value != null)),
    [displayAgents, yearDetail]
  )

  // Pre-compute period rollups for all agents using rollupMetrics (view-derived)
  const quarterlyData = useMemo(() => {
    const result = {}
    agents.forEach((agent) => {
      result[agent.id] = {}
      QUARTERS.forEach((q) => {
        result[agent.id][q.label] = computeAgentPeriodMetrics(agent.id, q.months, yearDetail, rollupMetrics)
      })
    })
    return result
  }, [agents, yearDetail, rollupMetrics])

  const halfData = useMemo(() => {
    const result = {}
    agents.forEach((agent) => {
      result[agent.id] = {}
      HALVES.forEach((h) => {
        result[agent.id][h.label] = computeAgentPeriodMetrics(agent.id, h.months, yearDetail, rollupMetrics)
      })
    })
    return result
  }, [agents, yearDetail, rollupMetrics])

  const selectedTeam = teams.find((t) => String(t.id) === teamId)

  // APT-36: Compute per-agent ratings from scorecard rows (not from DB summary view)
  const agentRatings = useMemo(() => {
    const map = {}
    activeMonthAgents.forEach((agent) => {
      const rows = Object.values(detailByAgent[agent.id] ?? {})
      map[agent.id] = computeRating(rows, month)
    })
    return map
  }, [activeMonthAgents, detailByAgent, month])

  const ratingDist = useMemo(() => {
    return Object.values(agentRatings).reduce((acc, r) => {
      acc[r.label] = (acc[r.label] ?? 0) + 1
      return acc
    }, {})
  }, [agentRatings])

  const avgOnTrack = useMemo(() => {
    const vals = Object.values(agentRatings)
    if (!vals.length) return '—'
    return String(Math.round(vals.reduce((s, r) => s + r.onTrack, 0) / vals.length))
  }, [agentRatings])

  const monthLabel = monthOptions.find((m) => m.value === month)?.label ?? month

  // APT-66: Team leaderboard — APT-36: ratings now computed from scorecard rows
  const leaderboard = useMemo(() => {
    return activeMonthAgents
      .map((agent) => {
        const r = agentRatings[agent.id] ?? { label: 'Incomplete', onTrack: 0, offTrack: 0 }
        return { id: agent.id, name: agent.agent_name, rating: r.label, onTrack: r.onTrack, offTrack: r.offTrack }
      })
      .sort((a, b) => b.onTrack - a.onTrack)
  }, [activeMonthAgents, agentRatings])

  // APT-70: Filtered quarters
  const filteredQuarters = selectedQ === 'all' ? QUARTERS : QUARTERS.filter((q) => q.label === selectedQ)

  // Shared sticky-column style
  const stickyCol = { position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap', minWidth: 160 }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Team Dashboard</h1>
        <p className="page-subtitle">Group performance by month</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Month</label>
          <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Team</label>
          <select className="filter-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Select Team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Search Agent</label>
          <input
            className="filter-select"
            style={{ minWidth: 160 }}
            placeholder="Filter by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* APT-78/79: Show inactive toggle */}
        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#6b7a8d', paddingTop: 18 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
      </div>

      {!teamId && (
        <div className="empty-state">
          <h3>Select a team to view performance</h3>
        </div>
      )}

      {teamId && loading && <div className="loading">Loading...</div>}

      {teamId && !loading && (
        <>
          {/* Summary cards */}
          <div className="cards-row">
            <div className="stat-card">
              <div className="stat-label">Team</div>
              <div className="stat-value" style={{ fontSize: 16, marginTop: 4, color: '#1a1a2e' }}>
                {selectedTeam?.group_name ?? '—'}
              </div>
              <div className="stat-sub">{monthLabel}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Agents</div>
              <div className="stat-value">{activeMonthAgents.length}</div>
              <div className="stat-sub">with data this month</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg On Track</div>
              <div className="stat-value" style={{ color: '#1a6e3a' }}>{avgOnTrack}</div>
              <div className="stat-sub">scored metrics / agent</div>
            </div>
            {Object.entries(ratingDist).map(([label, count]) => (
              <div key={label} className="stat-card">
                <div className="stat-label">Rating</div>
                <div className={`stat-value ${ratingClass(label)}`} style={{ fontSize: 16, marginTop: 4 }}>
                  {label}
                </div>
                <div className="stat-sub">{count} agent{count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          {/* APT-66: Agent Leaderboard */}
          {leaderboard.length > 0 && (
            <>
              <div className="section-title">Agent Leaderboard — {monthLabel}</div>
              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <table className="sc-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center' }}>#</th>
                      <th>Agent</th>
                      <th style={{ width: 140 }}>Rating</th>
                      <th style={{ width: 80, textAlign: 'center' }}>On Track</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Off Track</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => (
                      <tr key={row.id}>
                        <td style={{ textAlign: 'center', color: '#6b7a8d', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{row.name}</td>
                        <td><span className={ratingClass(row.rating)} style={{ fontSize: 12 }}>{row.rating}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#1a6e3a' }}>{row.onTrack}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#842029' }}>{row.offTrack}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Monthly table — rows: metrics, columns: agents */}
          <div className="section-title">Monthly Performance — {monthLabel}</div>

          {activeMonthAgents.length === 0 ? (
            <div className="empty-state">
              <h3>No data this month</h3>
              <p>No agents have recorded data for {monthLabel}.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="sc-table">
                <thead>
                  <tr>
                    <th className="sticky-metric-head" style={{ ...stickyCol, background: '#f8f9fb', zIndex: 2 }}>Metric</th>
                    {activeMonthAgents.map((a) => (
                      <th key={a.id} style={{ width: 90, minWidth: 80, textAlign: 'center' }}>{a.agent_name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allMetrics.map((metric) => (
                    <tr key={metric.metric_key}>
                      <td className="sticky-metric-cell" style={{ ...stickyCol, background: 'inherit' }}>
                        {metric.metric_name}
                      </td>
                      {activeMonthAgents.map((agent) => (
                        <MetricCell key={agent.id} row={detailByAgent[agent.id]?.[metric.metric_key]} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rollup section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 8px' }}>
            <div className="section-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
              Rollup Year
            </div>
            <select
              className="filter-select"
              style={{ height: 30, fontSize: 13, minWidth: 90 }}
              value={rollupYear}
              onChange={(e) => setRollupYear(e.target.value)}
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {/* APT-70: Quarter filter */}
            <select
              className="filter-select"
              style={{ height: 30, fontSize: 13, minWidth: 80 }}
              value={selectedQ}
              onChange={(e) => setSelectedQ(e.target.value)}
            >
              <option value="all">All Quarters</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
            {yearLoading && <span style={{ fontSize: 12, color: '#6b7a8d' }}>Loading…</span>}
          </div>

          {!yearLoading && activeYearAgents.length > 0 && (
            <>
              {/* Quarterly table — rows: metrics, columns: Q × agents */}
              <div className="section-title">Quarterly Team Summary — {rollupYear}</div>
              <div className="table-wrap">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="sticky-metric-head" style={{ ...stickyCol, background: '#f8f9fb', verticalAlign: 'bottom', zIndex: 3 }}>Metric</th>
                      {filteredQuarters.map((q) => (
                        <th key={q.label} colSpan={activeYearAgents.length} className="period-th">
                          {q.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {filteredQuarters.map((q) =>
                        activeYearAgents.map((a) => (
                          <th key={`${q.label}-${a.id}`} style={{ width: 75, minWidth: 70, textAlign: 'center', fontSize: 10 }}>
                            {a.agent_name}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rollupMetrics.map((metric) => (
                      <tr key={metric.metric_key}>
                        <td className="sticky-metric-cell" style={{ ...stickyCol, background: 'inherit' }}>
                          {metric.metric_name}
                        </td>
                        {filteredQuarters.map((q) =>
                          activeYearAgents.map((agent) => (
                            <PeriodMetricCell
                              key={`${q.label}-${agent.id}`}
                              cell={quarterlyData[agent.id]?.[q.label]?.[metric.metric_key]}
                            />
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Half-year table — rows: metrics, columns: H × agents */}
              <div className="section-title">Half-Year Team Summary — {rollupYear}</div>
              <div className="table-wrap">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="sticky-metric-head" style={{ ...stickyCol, background: '#f8f9fb', verticalAlign: 'bottom', zIndex: 3 }}>Metric</th>
                      {HALVES.map((h) => (
                        <th key={h.label} colSpan={activeYearAgents.length} className="period-th">
                          {h.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {HALVES.map((h) =>
                        activeYearAgents.map((a) => (
                          <th key={`${h.label}-${a.id}`} style={{ width: 75, minWidth: 70, textAlign: 'center', fontSize: 10 }}>
                            {a.agent_name}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rollupMetrics.map((metric) => (
                      <tr key={metric.metric_key}>
                        <td className="sticky-metric-cell" style={{ ...stickyCol, background: 'inherit' }}>
                          {metric.metric_name}
                        </td>
                        {HALVES.map((h) =>
                          activeYearAgents.map((agent) => (
                            <PeriodMetricCell
                              key={`${h.label}-${agent.id}`}
                              cell={halfData[agent.id]?.[h.label]?.[metric.metric_key]}
                            />
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
