import { useState, useEffect } from 'react'
import { getAllMetricDefinitions, upsertMetricDefinition } from '../../lib/api'
import Modal from '../../components/Modal'
import { useAuth } from '../../lib/useAuth'
import { toMessage } from '../../lib/errors'

// APT-149: onEdit is absent for a non-admin, which also drops the Edit column
function MetricSection({ title, rows, onEdit }) {
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
              <th>Counts to Score</th>
              <th>Order</th>
              <th>Active</th>
              {onEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.metric_name}</td>
                <td style={{ fontSize: 12, color: '#6b7a8d', fontFamily: 'monospace' }}>{r.metric_key}</td>
                <td>{r.unit_type}</td>
                <td>{r.direction_good === 'at_or_above' ? '↑ At or Above' : r.direction_good === 'at_or_below' ? '↓ At or Below' : r.direction_good}</td>
                <td>{r.counts_toward_score ? 'Yes' : 'No'}</td>
                <td>{r.display_order}</td>
                <td><span style={{ color: r.active ? '#1a6e3a' : '#842029', fontWeight: 600, fontSize: 12 }}>{r.active ? 'Yes' : 'No'}</span></td>
                {onEdit && <td><button className="btn btn-sm btn-secondary" onClick={() => onEdit({ ...r })}>Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function AdminMetrics() {
  const { isAdmin } = useAuth()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  const load = () => {
    setLoading(true)
    getAllMetricDefinitions()
      .then(setRows)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await upsertMetricDefinition(editing)
      setEditing(null)
      load()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
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
          <button className="btn btn-primary" onClick={() => setEditing({
            metric_key: '', metric_name: '', unit_type: 'count',
            direction_good: 'at_or_above', counts_toward_score: true,
            active: true, display_order: 0,
          })}>+ Add Metric</button>
        </div>
      )}
      {loading ? <div className="loading">Loading...</div> : (
        <>
          <MetricSection title="Scored Metrics" rows={scoredMetrics} onEdit={isAdmin ? setEditing : null} />
          <MetricSection title="Additional Metrics" rows={additionalMetrics} onEdit={isAdmin ? setEditing : null} />
          <MetricSection title="Inactive Metrics" rows={inactiveMetrics} onEdit={isAdmin ? setEditing : null} />
        </>
      )}
      {editing && isAdmin && (
        <Modal
          title={editing.id ? 'Edit Metric' : 'Add Metric'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!editing.counts_toward_score} onChange={(e) => setEditing({ ...editing, counts_toward_score: e.target.checked })} />
              Counts Toward Score
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Active
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
