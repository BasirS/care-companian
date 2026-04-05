import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getAppointments, addAppointment, updateAppointment, deleteAppointment } from '../api/appointments'

interface Appointment {
  id: number; appointment_time: string; reason: string;
  location: string | null; appointment_type: string;
  status: string; source: string;
}

const TYPE_COLORS: Record<string, string> = {
  'follow-up': '#3b82f6', 'therapy': '#8b5cf6',
  'surgery': '#ef4444', 'consultation': '#059669', 'other': '#6b7280',
}

function toDateKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function CalendarView({ appointments }: { appointments: Appointment[] }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Appointment | null>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthLabel = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  const apptMap: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    const key = toDateKey(appt.appointment_time)
    if (!apptMap[key]) apptMap[key] = []
    apptMap[key].push(appt)
  }

  const todayKey = toDateKey(today.toISOString())

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); setSelected(null) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); setSelected(null) }

  function dayKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={prevMonth} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
          width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-heading)', color: 'var(--navy)' }}>
          {monthLabel}
        </span>
        <button onClick={nextMonth} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
          width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.4px',
          }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '90px', gap: 3 }}>
        {cells.map((day, i) => {
          if (day === null) return (
            <div key={`empty-${i}`} style={{ borderRadius: 8, background: 'var(--surface-2)', opacity: 0.25 }} />
          )

          const key = dayKey(day)
          const dayAppts = apptMap[key] || []
          const isToday = key === todayKey

          return (
            <div key={key} style={{
              overflow: 'hidden',
              background: isToday ? 'rgba(30,58,95,0.05)' : 'var(--surface)',
              border: isToday ? '2px solid var(--navy)' : '1px solid var(--border)',
              borderRadius: 8, padding: '6px 5px',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {/* Day number */}
              <span style={{
                fontSize: 11, fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--navy)' : 'var(--text-muted)',
                lineHeight: 1, alignSelf: 'flex-end', paddingRight: 2,
              }}>
                {day}
              </span>

              {/* Compact appointment chips */}
              {dayAppts.map(appt => {
                const color = TYPE_COLORS[appt.appointment_type] || '#6b7280'
                const isCompleted = appt.status === 'completed'
                const isActive = selected?.id === appt.id
                return (
                  <button
                    key={appt.id}
                    onClick={() => setSelected(isActive ? null : appt)}
                    title={appt.reason}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: isActive ? color : `${color}18`,
                      border: `1px solid ${color}40`,
                      borderRadius: 4, padding: '2px 5px',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      opacity: isCompleted ? 0.6 : 1,
                      minWidth: 0, overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? '#fff' : color, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: isActive ? '#fff' : color,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.4, minWidth: 0,
                    }}>
                      {appt.reason}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Modal for selected appointment */}
      {selected && (() => {
        const color = TYPE_COLORS[selected.appointment_type] || '#6b7280'
        const dt = new Date(selected.appointment_time)
        return (
          <div
            onClick={() => setSelected(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(10,25,47,0.45)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', borderRadius: 16,
                boxShadow: '0 8px 40px rgba(10,37,64,0.22)',
                padding: '28px 28px 24px',
                width: 420, maxWidth: 'calc(100vw - 40px)',
                border: `2px solid ${color}30`,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
                    {selected.reason}
                  </span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                    fontSize: 16, color: 'var(--text-muted)', lineHeight: 1,
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                  {selected.appointment_type}
                </span>
                {selected.status === 'completed' && (
                  <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                    ✓ Completed
                  </span>
                )}
                {selected.source === 'discharge' && (
                  <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                    From Discharge
                  </span>
                )}
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>
                    {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🕐</span>
                  <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>
                    {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {selected.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📍</span>
                    <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>{selected.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApptCard({ appt, onComplete, onDelete, onSaveEdit }: {
  appt: Appointment; onComplete: () => void; onDelete: () => void;
  onRefetch: () => void;
  onSaveEdit: (fields: Partial<Appointment>) => void;
}) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    reason: appt.reason,
    appointment_time: appt.appointment_time.slice(0, 16),
    location: appt.location || '',
    appointment_type: appt.appointment_type,
  })

  const dt = new Date(appt.appointment_time)
  const color = TYPE_COLORS[appt.appointment_type] || '#6b7280'
  const isCompleted = appt.status === 'completed'

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '7px 11px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Reason</label>
            <input style={inputStyle} value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Date & Time</label>
            <input style={inputStyle} type="datetime-local" value={editForm.appointment_time} onChange={e => setEditForm(f => ({ ...f, appointment_time: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Location</label>
            <input style={inputStyle} value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Type</label>
            <select style={inputStyle} value={editForm.appointment_type} onChange={e => setEditForm(f => ({ ...f, appointment_type: e.target.value }))}>
              <option value="follow-up">Follow-up</option>
              <option value="consultation">Consultation</option>
              <option value="therapy">Therapy</option>
              <option value="surgery">Surgery</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onSaveEdit(editForm); setEditing(false) }} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)', opacity: isCompleted ? 0.75 : 1,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{appt.reason}</span>
            <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{appt.appointment_type}</span>
            {appt.source === 'discharge' && (
              <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>From Discharge</span>
            )}
            {isCompleted && (
              <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>✓ Completed</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>📅 {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>🕐 {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            {appt.location && <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>📍 {appt.location}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isCompleted && (
            <button onClick={onComplete} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.color = '#15803d' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >Mark Complete</button>
          )}
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Edit</button>
          <button onClick={onDelete} style={{ background: 'none', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

export default function Appointments() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getAppointments(userId), [userId])

  const [tab, setTab] = useState<'upcoming' | 'completed' | 'calendar'>('calendar')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    appointment_time: '', reason: '', location: '', appointment_type: 'follow-up',
  })
  const [addLoading, setAddLoading] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 10,
    padding: '9px 13px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.appointment_time || !addForm.reason) return
    setAddLoading(true)
    await addAppointment({ user_id: userId, ...addForm })
    setAddForm({ appointment_time: '', reason: '', location: '', appointment_type: 'follow-up' })
    setShowAdd(false)
    setAddLoading(false)
    refetch()
  }

  async function handleComplete(id: number) {
    await updateAppointment(id, { status: 'completed' })
    refetch()
  }

  async function handleDelete(id: number) {
    await deleteAppointment(id)
    refetch()
  }

  const handleSaveEdit = useCallback(async (id: number, fields: Partial<Appointment>) => {
    await updateAppointment(id, fields as Record<string, string>)
    refetch()
  }, [refetch])

  const upcoming: Appointment[] = data?.upcoming ?? []
  const completed: Appointment[] = data?.completed ?? []
  const allAppointments = [...upcoming, ...completed]
  const list = tab === 'upcoming' ? upcoming : completed

  return (
    <div style={{ maxWidth: tab === 'calendar' ? 960 : 800, animation: 'fadeUp 0.35s ease forwards' }}>
      {/* Next appointment banner */}
      {data?.next_appointment && (
        <div style={{
          background: 'linear-gradient(120deg, #1e3a5f 0%, #2c5282 100%)',
          borderRadius: 16, padding: '20px 24px', marginBottom: 20, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 16px rgba(10,37,64,0.2)',
        }}>
          <div>
            <p style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Next Appointment</p>
            <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
              {data.next_appointment.reason}
            </p>
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              📅 {new Date(data.next_appointment.appointment_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}🕐 {new Date(data.next_appointment.appointment_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {data.next_appointment.location && ` · 📍 ${data.next_appointment.location}`}
            </p>
          </div>
          <div style={{ fontSize: 48, opacity: 0.2 }}>📅</div>
        </div>
      )}

      {/* Header with tabs + add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          <button onClick={() => setTab('calendar')} style={{
            padding: '7px 18px', borderRadius: 7, border: 'none',
            background: tab === 'calendar' ? 'var(--navy)' : 'transparent',
            color: tab === 'calendar' ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: tab === 'calendar' ? 600 : 400,
            cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>
            Calendar View
          </button>
          <button onClick={() => setTab('upcoming')} style={{
            padding: '7px 18px', borderRadius: 7, border: 'none',
            background: tab === 'upcoming' ? 'var(--navy)' : 'transparent',
            color: tab === 'upcoming' ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: tab === 'upcoming' ? 600 : 400,
            cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>
            Upcoming ({upcoming.length})
          </button>
          <button onClick={() => setTab('completed')} style={{
            padding: '7px 18px', borderRadius: 7, border: 'none',
            background: tab === 'completed' ? 'var(--navy)' : 'transparent',
            color: tab === 'completed' ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: tab === 'completed' ? 600 : 400,
            cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>
            Completed ({completed.length})
          </button>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: showAdd ? 'var(--surface-2)' : 'var(--navy)',
          color: showAdd ? 'var(--text-muted)' : '#fff',
          border: 'none', borderRadius: 10, padding: '9px 18px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          {showAdd ? 'Cancel' : '+ New Appointment'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '20px', marginBottom: 16, boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Reason *</label>
              <input style={inputStyle} placeholder="e.g. Cardiology follow-up"
                value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date & Time *</label>
              <input style={inputStyle} type="datetime-local"
                value={addForm.appointment_time} onChange={e => setAddForm(f => ({ ...f, appointment_time: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Location</label>
              <input style={inputStyle} placeholder="e.g. Boston Medical Center"
                value={addForm.location} onChange={e => setAddForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Type</label>
              <select style={inputStyle} value={addForm.appointment_type} onChange={e => setAddForm(f => ({ ...f, appointment_type: e.target.value }))}>
                <option value="follow-up">Follow-up</option>
                <option value="consultation">Consultation</option>
                <option value="therapy">Therapy</option>
                <option value="surgery">Surgery</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={addLoading} style={{
            background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>{addLoading ? 'Saving…' : 'Schedule Appointment'}</button>
        </form>
      )}

      {/* Calendar view */}
      {tab === 'calendar' && !loading && (
        <CalendarView appointments={allAppointments} />
      )}

      {/* Appointments list */}
      {tab !== 'calendar' && (
        loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading appointments…</p>
        ) : list.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '40px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {tab === 'upcoming' ? 'No upcoming appointments. Schedule one above.' : 'No completed appointments yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map(appt => (
              <ApptCard key={appt.id} appt={appt}
                onComplete={() => handleComplete(appt.id)}
                onDelete={() => handleDelete(appt.id)}
                onSaveEdit={(fields) => handleSaveEdit(appt.id, fields)}
                onRefetch={refetch} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
