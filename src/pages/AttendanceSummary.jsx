import { useState, useEffect, useCallback } from 'react'
import { getTeams, getAgents, getAllAgents, getAttendanceRollup } from '../lib/api'
import { currentMonth, recentMonths } from '../lib/format'
import { toMessage } from '../lib/errors'

export default function AttendanceSummary() {
  const months = recentMonths(18)
  const [teams, setTeams]   = useState([])
  const [teamId, setTeamId] = useState('')
  const [month, setMonth]   = useState(currentMonth())

  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    getTeams().then(setTeams).catch((e) => setError(toMessage(e)))
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rollup, allAgents, members] = await Promise.all([
        getAttendanceRollup({ month }),
        getAllAgents(),
        teamId ? getAgents({ groupId: teamId, activeOnly: false }) : Promise.resolve(null),
      ])
      const nameById = {}
      allAgents.forEach((a) => { nameById[a.id] = a.agent_name })
      const memberIds = members ? new Set(members.map((m) => m.id)) : null
      const list = rollup
        .filter((r) => !memberIds || memberIds.has(r.agent_id))
        .map((r) => ({ ...r, agent_name: nameById[r.agent_id] ?? String(r.agent_id) }))
        .sort((a, b) => a.agent_name.localeCompare(b.agent_name))
      setRows(list)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setLoading(false)
    }
  }, [month, teamId])

  useEffect(() => { loadData() }, [loadData])

  const displayRows = rows

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Attendance Summary</h1>
        <p className="page-subtitle">Monthly attendance by agent</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Month</label>
          <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Team</label>
          <select className="filter-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.group_name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {!loading && displayRows.length === 0 && (
        <div className="empty-state">
          <h3>No attendance data</h3>
          <p>No attendance records exist for the selected month and filters. Use Attendance Entry to add records.</p>
        </div>
      )}

      {!loading && displayRows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Scheduled Days</th>
                <th>Available Days</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => {
                const pct = r.attendance_pct
                const pctColor = pct == null ? '#6b7a8d' : pct >= 90 ? '#1a6e3a' : pct >= 80 ? '#664d00' : '#842029'
                return (
                  <tr key={r.agent_id}>
                    <td style={{ fontWeight: 500 }}>{r.agent_name}</td>
                    <td>{r.scheduled_days ?? '—'}</td>
                    <td>{r.available_days ?? '—'}</td>
                    <td style={{ color: pctColor, fontWeight: 600 }}>
                      {pct != null ? `${Math.round(pct)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
