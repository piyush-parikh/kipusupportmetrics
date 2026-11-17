import { useState, useEffect, useMemo } from 'react'
import {
  getAllMetricDefinitions, upsertMetricDefinition,
  getAllTeams, getMetricExclusions, saveMetricExclusions,
} from '../../lib/api'
import {
  buildExclusionIndex, excludedTeamIdsForMetric,
} from '../../lib/metricApplicability'
import Modal from '../../components/Modal'
import { useAuth } from '../../lib/useAuth'
import { toMessage } from '../../lib/errors'

// APT-149: onEdit is absent for a non-admin, which also drops the Edit column
// APT-155: teamSummary says which teams the metric applies to
function MetricSection({ title, rows, onEdit, teamSummary }) {
  if (!rows.length) return null
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>Key</th>
              <th>Unit</th>
              <th>Direction</th>
              <th>Teams</th>
              <th>Counts to Score</th>
              <th>Order</th>
              <th>Active</th>
              {onEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const teams = teamSummary(r)
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.metric_name}</td>
                  <td style={{ fontSize: 12, color: '#6b7a8d', fontFamily: 'monospace' }}>{r.metric_key}</td>
                  <td>{r.unit_type}</td>
                  <td>{r.direction_good === 'at_or_above' ? '↑ At or Above' : r.direction_good === 'at_or_below' ? '↓ At or Below' : r.direction_good}</td>
                  <td title={teams.title} style={{ color: teams.partial ? '#8a5a00' : '#6b7a8d', fontWeight: teams.partial ? 600 : 400, cursor: 'help' }}>
                    {teams.text}
                  </td>
                  <td>{r.counts_toward_score ? 'Yes' : 'No'}</td>
                  <td>{r.display_order}</td>
                  <td><span style={{ color: r.active ? '#1a6e3a' : '#842029', fontWeight: 600, fontSize: 12 }}>{r.active ? 'Yes' : 'No'}</span></td>
                  {onEdit && <td><button className="btn btn-sm btn-secondary" onClick={() => onEdit(r)}>Edit</button></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function AdminMetrics() {
  const { isAdmin } = useAuth()
  const [rows, setRows]       = useState([])
  const [teams, setTeams]     = useState([])
  const [exclusionRows, setExclusionRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  // APT-155: the ticked teams live outside `editing`, because `editing` is sent
  // to the database as the metric's own record and must hold only its columns.
  const [teamIds, setTeamIds] = useState([])
  const [saving, setSaving]   = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getAllMetricDefinitions(), getAllTeams(), getMetricExclusions()])
      .then(([defs, teamRows, exclusions]) => {
        setRows(defs)
        setTeams(teamRows)
        setExclusionRows(exclusions)
      })
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Every active team, in the order the Goals page shows them
  const teamCols = useMemo(() => teams.filter((t) => t.active), [teams])
  const exclusionIndex = useMemo(() => buildExclusionIndex(exclusionRows), [exclusionRows])

  const excludedNames = (metricId) => {
    const ids = excludedTeamIdsForMetric(metricId, exclusionIndex)
    return teamCols
      .filter((t) => ids.some((id) => String(id) === String(t.id)))
      .map((t) => t.group_name)
  }

  const teamSummary = (metric) => {
    const names = excludedNames(metric.id)
    if (!teamCols.length || !names.length) {
      return { text: 'All teams', title: 'Applies to every team', partial: false }
    }
    return {
      text: `${teamCols.length - names.length} of ${teamCols.length} teams`,
      title: `Does not apply to: ${names.join(', ')}`,
      partial: true,
    }
  }

  const openAdd = () => {
    setEditing({
      metric_key: '', metric_name: '', unit_type: 'count',
      direction_good: 'at_or_above', counts_toward_score: true,
      active: true, display_order: 0,
    })
    setTeamIds(teamCols.map((t) => t.id))
  }

  const openEdit = (metric) => {
    const names = excludedTeamIdsForMetric(metric.id, exclusionIndex)
    setEditing({ ...metric })
    setTeamIds(
      teamCols
        .filter((t) => !names.some((id) => String(id) === String(t.id)))
        .map((t) => t.id),
    )
  }

  const closeModal = () => { setEditing(null); setTeamIds([]) }

  const allTeamsTicked = teamCols.length > 0 && teamIds.length === teamCols.length
  const uncheckedTeamIds = teamCols
    .filter((t) => !teamIds.some((id) => String(id) === String(t.id)))
    .map((t) => t.id)

  const save = async () => {
    setSaving(true)
    setError('')
    let savedId = editing.id
    try {
      const saved = await upsertMetricDefinition(editing)
      savedId = saved?.id ?? editing.id
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
      return
    }
    try {
      await saveMetricExclusions(savedId, uncheckedTeamIds)
    } catch (e) {
      // The metric itself is safely stored, so the pop-up stays open and Save
      // can simply be pressed again — saving the same metric twice is harmless.
      setEditing((cur) => (cur ? { ...cur, id: savedId } : cur))
      setError(
        `The metric was saved, but the team selection could not be saved: ${toMessage(e).replace(/\.$/, '')}. Try Save again.`,
      )
      setSaving(false)
      return
    }
    setSaving(false)
    closeModal()
    load()
  }

  const scoredMetrics    = rows.filter((r) => r.active && r.counts_toward_score)
  const additionalMetrics = rows.filter((r) => r.active && !r.counts_toward_score)
  const inactiveMetrics  = rows.filter((r) => !r.active)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Metrics</h1>
        <p className="page-subtitle">Configure which metrics are tracked and scored</p>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {!isAdmin && <div className="view-only-note">View only. Ask an administrator to make changes.</div>}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Metric</button>
        </div>
      )}
      {loading ? <div className="loading">Loading...</div> : (
        <>
          <MetricSection title="Scored Metrics" rows={scoredMetrics} onEdit={isAdmin ? openEdit : null} teamSummary={teamSummary} />
          <MetricSection title="Additional Metrics" rows={additionalMetrics} onEdit={isAdmin ? openEdit : null} teamSummary={teamSummary} />
          <MetricSection title="Inactive Metrics" rows={inactiveMetrics} onEdit={isAdmin ? openEdit : null} teamSummary={teamSummary} />
        </>
      )}
      {editing && isAdmin && (
        <Modal
          title={editing.id ? 'Edit Metric' : 'Add Metric'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Metric Name</label>
              <input className="form-input" value={editing.metric_name} onChange={(e) => setEditing({ ...editing, metric_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Key</label>
              <input className="form-input" value={editing.metric_key} onChange={(e) => setEditing({ ...editing, metric_key: e.target.value })} placeholder="snake_case_key" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unit Type</label>
              <select className="form-select" value={editing.unit_type} onChange={(e) => setEditing({ ...editing, unit_type: e.target.value })}>
                <option value="count">Count</option>
                <option value="percent">Percent</option>
                <option value="days">Days</option>
                <option value="hours">Hours</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Direction Good</label>
              <select className="form-select" value={editing.direction_good} onChange={(e) => setEditing({ ...editing, direction_good: e.target.value })}>
                <option value="at_or_above">↑ At or Above goal</option>
                <option value="at_or_below">↓ At or Below goal</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Display Order</label>
            <input className="form-input" type="number" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!editing.counts_toward_score} onChange={(e) => setEditing({ ...editing, counts_toward_score: e.target.checked })} />
              Counts Toward Score
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Active
            </label>
          </div>

          {/* APT-155: which teams this metric applies to — same shape as Add Goal */}
          <div className="form-group" style={{ marginBottom: 2 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
              Teams
              <button
                className="btn btn-sm btn-secondary"
                style={{ marginLeft: 'auto', fontWeight: 400 }}
                onClick={() => setTeamIds(allTeamsTicked ? [] : teamCols.map((t) => t.id))}
              >
                {allTeamsTicked ? 'Uncheck all' : 'Check all'}
              </button>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0 18px' }}>
            {teamCols.map((t) => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 0', borderBottom: '1px solid #f0f2f5' }}>
                <input
                  type="checkbox"
                  checked={teamIds.some((id) => String(id) === String(t.id))}
                  onChange={(e) => setTeamIds(
                    e.target.checked
                      ? [...teamIds, t.id]
                      : teamIds.filter((id) => String(id) !== String(t.id)),
                  )}
                />
                <span style={{ flex: 1 }}>{t.group_name}</span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#6b7a8d', marginTop: 10, marginBottom: 0 }}>
            {allTeamsTicked
              ? 'All teams are checked. Uncheck any team this metric doesn’t apply to.'
              : `${teamIds.length} of ${teamCols.length} teams selected. Unchecked teams will not see this metric and it will not count toward their rating.`}
          </p>
          {!editing.active && (
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, marginBottom: 0 }}>
              This metric is turned off for all teams (Active is unticked).
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
