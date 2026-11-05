import { useState, useEffect } from 'react'
import { getAllAttendanceCodes, upsertAttendanceCode } from '../../lib/api'
import Modal from '../../components/Modal'
import { toMessage } from '../../lib/errors'

// Plain-English explanation of what the two counting switches do together
function countingSummary(row) {
  if (row.counts_as_available && row.counts_as_scheduled) return 'Counts as a day worked — raises attendance %'
  if (!row.counts_as_available && row.counts_as_scheduled) return 'Counts as a missed working day — lowers attendance %'
  if (!row.counts_as_scheduled) return 'Not counted either way — ignored in attendance %'
  return '—'
}

export default function AdminAttendanceCodes() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  const load = () => {
    setLoading(true)
    getAllAttendanceCodes()
      .then(setRows)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing.code?.trim() || !editing.code_name?.trim()) {
      setError('Code and Description are both required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...editing,
        code: editing.code.trim().toUpperCase(),
        code_name: editing.code_name.trim(),
        display_order: Number(editing.display_order) || 0,
      }
      if (payload.id == null) delete payload.id
      await upsertAttendanceCode(payload)
      setEditing(null)
      load()
    } catch (e) {
      setError(
        'Could not save this code: ' + e.message +
        ' — if this keeps happening the database may not allow changes to attendance codes yet.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Attendance Codes</h1>
        <p className="page-subtitle">The codes supervisors can choose in Attendance Entry</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className="btn btn-primary"
            onClick={() => setEditing({
              code: '', code_name: '', category: '',
              counts_as_scheduled: true, counts_as_available: false,
              active: true, display_order: (rows.length + 1) * 10,
            })}
          >
            + Add Code
          </button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>How it affects attendance %</th>
                <th>Order</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.code}</td>
                  <td>{r.code_name}</td>
                  <td style={{ fontSize: 12, color: '#6b7a8d' }}>{countingSummary(r)}</td>
                  <td>{r.display_order}</td>
                  <td>
                    <span style={{ color: r.active ? '#1a6e3a' : '#842029', fontWeight: 600, fontSize: 12 }}>
                      {r.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing({ ...r })}>Edit</button></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#6b7a8d' }}>No attendance codes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing.id ? `Edit Code — ${editing.code}` : 'Add Attendance Code'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input
                className="form-input"
                value={editing.code ?? ''}
                maxLength={6}
                placeholder="e.g. LOA"
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                value={editing.code_name ?? ''}
                placeholder="e.g. Leave of Absence"
                onChange={(e) => setEditing({ ...editing, code_name: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">How should this count toward attendance %?</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!editing.counts_as_scheduled}
                onChange={(e) => setEditing({ ...editing, counts_as_scheduled: e.target.checked })}
              />
              Count this day in the attendance calculation
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: editing.counts_as_scheduled ? 'pointer' : 'not-allowed', opacity: editing.counts_as_scheduled ? 1 : 0.5 }}>
              <input
                type="checkbox"
                disabled={!editing.counts_as_scheduled}
                checked={!!editing.counts_as_available}
                onChange={(e) => setEditing({ ...editing, counts_as_available: e.target.checked })}
              />
              Treat it as a day the agent was available
            </label>
            <p style={{ fontSize: 12, color: '#6b7a8d', marginTop: 8 }}>
              <strong>{countingSummary(editing)}</strong><br />
              Untick the first box for days the agent was never expected to work (like Holiday) — those are left out of
              the percentage entirely.
            </p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input
                className="form-input"
                type="number"
                value={editing.display_order ?? 0}
                onChange={(e) => setEditing({ ...editing, display_order: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category (optional)</label>
              <input
                className="form-input"
                value={editing.category ?? ''}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={!!editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />
            Active — show this code in Attendance Entry
          </label>
        </Modal>
      )}
    </div>
  )
}
