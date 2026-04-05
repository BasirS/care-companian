import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import {
  getProfile, updateProfile, clearUserHistory,
  getEmergencyContacts, addEmergencyContact, updateEmergencyContact, deleteEmergencyContact,
  getCareTeam, addCareTeamMember, updateCareTeamMember, deleteCareTeamMember,
  type EmergencyContact, type CareTeamMember,
} from '../api/profile'

const CONDITIONS: Record<string, string> = {
  cardiac_surgery: 'Cardiac Surgery', joint_replacement: 'Joint Replacement',
  abdominal_surgery: 'Abdominal Surgery', pneumonia: 'Pneumonia',
  heart_failure: 'Heart Failure', stroke: 'Stroke', general_surgery: 'General Surgery', other: 'Other',
}

const BLOOD_TYPES = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null
  // timeStr is "HH:MM" stored as user's local preferred time
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr || '00'
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${minute} ${period}`
}

const CARE_ROLES = ['Primary Care Physician', 'Cardiologist', 'Surgeon', 'Neurologist', 'Oncologist',
  'Orthopedist', 'Pulmonologist', 'Nurse Practitioner', 'Registered Nurse', 'Physical Therapist',
  'Occupational Therapist', 'Social Worker', 'Pharmacist', 'Other']

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '22px 24px', marginBottom: 16,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, editing, input }: { label: string; value: string | null; editing: boolean; input?: React.ReactNode }) {
  if (!editing && !value) return null
  return (
    <div style={{ display: 'flex', alignItems: editing ? 'flex-start' : 'center', gap: 12, marginBottom: editing ? 14 : 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 160, textTransform: 'uppercase', letterSpacing: '0.3px', paddingTop: editing ? 8 : 0 }}>{label}</span>
      {editing && input ? input : <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{value || '—'}</span>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 12, padding: '14px 16px', marginBottom: 10,
}

const smallInputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: 'var(--text)',
  fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
}

const iconBtn = (color = 'var(--text-muted)'): React.CSSProperties => ({
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
  color, padding: '2px 6px', fontFamily: 'var(--font-body)', borderRadius: 6,
})

export default function Profile() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getProfile(userId), [userId])
  const { data: contacts = [], refetch: refetchContacts } = useApi(() => getEmergencyContacts(userId), [userId])
  const { data: careTeam = [], refetch: refetchCareTeam } = useApi(() => getCareTeam(userId), [userId])

  // Profile edit
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Clear history
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearDone, setClearDone] = useState(false)

  // Emergency contacts
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '' })
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null)

  // Care team
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberForm, setMemberForm] = useState({ name: '', role: '', specialty: '', phone: '', hospital: '' })
  const [editingMember, setEditingMember] = useState<CareTeamMember | null>(null)

  function startEdit() {
    if (!data) return
    setForm({
      name: data.name || '',
      phone: data.phone || '',
      date_of_birth: data.date_of_birth || '',
      gender: data.gender || '',
      location: data.location || '',
      primary_condition: data.primary_condition || '',
      insurance_id: data.insurance_id || '',
      medical_history: data.medical_history || '',
      blood_type: data.blood_type || '',
      allergies: data.allergies || '',
      patient_id_number: data.patient_id_number || '',
      preferred_time: data.preferred_time || '',
      other_condition: '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = { ...form }
    if (form.primary_condition === 'other' && form.other_condition?.trim()) {
      payload.primary_condition = form.other_condition.trim()
    }
    await updateProfile(userId, payload)
    setSaving(false)
    setEditing(false)
    refetch()
  }

  async function handleClearHistory() {
    setClearing(true)
    try {
      await clearUserHistory(userId)
      setClearDone(true)
      setTimeout(() => { setShowClearConfirm(false); setClearDone(false) }, 1800)
    } finally {
      setClearing(false)
    }
  }

  // Emergency contact handlers
  async function handleAddContact() {
    if (!contactForm.name.trim()) return
    await addEmergencyContact(userId, contactForm)
    setContactForm({ name: '', relationship: '', phone: '', email: '' })
    setShowAddContact(false)
    refetchContacts()
  }

  async function handleSaveContact() {
    if (!editingContact) return
    await updateEmergencyContact(editingContact.contact_id, {
      name: editingContact.name,
      relationship: editingContact.relationship,
      phone: editingContact.phone,
      email: editingContact.email,
    })
    setEditingContact(null)
    refetchContacts()
  }

  async function handleDeleteContact(contactId: number) {
    await deleteEmergencyContact(contactId)
    refetchContacts()
  }

  // Care team handlers
  async function handleAddMember() {
    if (!memberForm.name.trim()) return
    await addCareTeamMember(userId, memberForm)
    setMemberForm({ name: '', role: '', specialty: '', phone: '', hospital: '' })
    setShowAddMember(false)
    refetchCareTeam()
  }

  async function handleSaveMember() {
    if (!editingMember) return
    await updateCareTeamMember(editingMember.member_id, {
      name: editingMember.name,
      role: editingMember.role,
      specialty: editingMember.specialty,
      phone: editingMember.phone,
      hospital: editingMember.hospital,
    })
    setEditingMember(null)
    refetchCareTeam()
  }

  async function handleDeleteMember(memberId: number) {
    await deleteCareTeamMember(memberId)
    refetchCareTeam()
  }

  function handleExport() {
    if (!data) return
    const lines = [
      'CareCompanion — Patient Profile Export',
      '========================================',
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Patient ID: ${data.patient_id_number || 'N/A'}`,
      `Member Since: ${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}`,
      '',
      'PERSONAL INFORMATION',
      `Phone: ${data.phone || 'N/A'}`,
      `Date of Birth: ${data.date_of_birth || 'N/A'}`,
      `Gender: ${data.gender || 'N/A'}`,
      `Location: ${data.location || 'N/A'}`,
      '',
      'MEDICAL INFORMATION',
      `Primary Condition: ${CONDITIONS[data.primary_condition] || data.primary_condition || 'N/A'}`,
      `Blood Type: ${data.blood_type || 'N/A'}`,
      `Allergies: ${data.allergies || 'N/A'}`,
      `Insurance ID: ${data.insurance_id || 'N/A'}`,
      `Medical History: ${data.medical_history || 'N/A'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'carecompanion-profile.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 9,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  function inp(key: string, type = 'text', placeholder = '') {
    return (
      <input type={type} style={inputStyle} placeholder={placeholder}
        value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }} />
    )
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading profile…</p>
  if (!data) return <p style={{ color: 'var(--danger)', fontSize: 14 }}>Could not load profile.</p>

  return (
    <div style={{ width: '100%', animation: 'fadeUp 0.35s ease forwards' }}>
      {/* Profile header card */}
      <div style={{
        background: 'linear-gradient(120deg, var(--navy) 0%, var(--navy-mid) 100%)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 22,
        color: '#fff', boxShadow: '0 4px 20px rgba(10,37,64,0.2)',
      }}>
        <img src={user!.picture} alt={user!.name} style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{data.name}</h2>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>{data.email}</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>🪪 {data.patient_id_number || 'Patient ID pending'}</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>📅 Member since {data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</span>
            {data.primary_condition && (
              <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '2px 10px' }}>
                🏥 {CONDITIONS[data.primary_condition] || data.primary_condition}
              </span>
            )}
            {data.blood_type && (
              <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '2px 10px' }}>
                🩸 {data.blood_type}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleExport} style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 500,
            color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>Export</button>
          <button onClick={editing ? handleSave : startEdit} disabled={saving} style={{
            background: editing ? '#fff' : 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 600,
            color: editing ? 'var(--navy)' : '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            {saving ? 'Saving…' : editing ? '✓ Save' : '✏️ Edit'}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 9, padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>Cancel</button>
          )}
        </div>
      </div>

      {/* Personal Info */}
      <Section title="Personal Information">
        <Row label="Full Name" value={data.name} editing={editing} input={inp('name')} />
        <Row label="Email" value={data.email} editing={false} />
        <Row label="Phone" value={data.phone} editing={editing} input={inp('phone', 'tel', '+1 (555) 000-0000')} />
        <Row label="Date of Birth" value={data.date_of_birth} editing={editing} input={inp('date_of_birth', 'date')} />
        <Row label="Gender" value={data.gender} editing={editing} input={
          <select style={inputStyle} value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        } />
        <Row label="Location" value={data.location} editing={editing} input={inp('location', 'text', 'City, State')} />
      </Section>

      {/* Medical Info */}
      <Section title="Medical & Insurance Information">
        <Row label="Patient ID" value={data.patient_id_number} editing={editing} input={inp('patient_id_number')} />
        <Row label="Insurance ID" value={data.insurance_id} editing={editing} input={inp('insurance_id', 'text', 'e.g. BCBS-123456')} />
        <Row label="Blood Type" value={data.blood_type} editing={editing} input={
          <select style={inputStyle} value={form.blood_type || ''} onChange={e => setForm(f => ({ ...f, blood_type: e.target.value }))}>
            <option value="">Select…</option>
            {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
          </select>
        } />
        <Row label="Primary Condition" value={CONDITIONS[data.primary_condition] || data.primary_condition} editing={editing} input={
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select style={inputStyle} value={form.primary_condition || ''} onChange={e => setForm(f => ({ ...f, primary_condition: e.target.value }))}>
              <option value="">Select…</option>
              {Object.entries(CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {form.primary_condition === 'other' && (
              <input style={inputStyle} placeholder="Please specify your condition…"
                value={form.other_condition || ''}
                onChange={e => setForm(f => ({ ...f, other_condition: e.target.value }))} />
            )}
          </div>
        } />

        {/* Allergies */}
        <div style={{ marginBottom: editing ? 14 : 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Allergies</span>
          {editing ? (
            <input style={{ ...inputStyle, flex: 'unset', width: '100%', boxSizing: 'border-box' }}
              placeholder="e.g. Penicillin, Sulfa drugs, Latex…"
              value={form.allergies || ''}
              onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} />
          ) : (
            <p style={{ fontSize: 14, color: data.allergies ? 'var(--text)' : 'var(--text-light)' }}>
              {data.allergies || 'No allergies recorded.'}
            </p>
          )}
        </div>

        {/* Medical History */}
        <div style={{ marginBottom: editing ? 14 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Medical History & Conditions</span>
          {editing ? (
            <textarea
              value={form.medical_history || ''}
              onChange={e => setForm(f => ({ ...f, medical_history: e.target.value }))}
              placeholder="e.g. Hypertension, Type 2 Diabetes, previous surgeries…"
              rows={3}
              style={{
                width: '100%', background: 'var(--surface-2)',
                border: '1.5px solid var(--border)', borderRadius: 9,
                padding: '9px 12px', fontSize: 13, color: 'var(--text)',
                fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          ) : (
            <p style={{ fontSize: 14, color: data.medical_history ? 'var(--text)' : 'var(--text-light)' }}>
              {data.medical_history || 'No medical history recorded.'}
            </p>
          )}
        </div>
      </Section>

      {/* Emergency Contacts */}
      <Section title="Emergency Contacts" action={
        <button onClick={() => { setShowAddContact(true); setContactForm({ name: '', relationship: '', phone: '', email: '' }) }} style={{
          background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>+ Add</button>
      }>
        {(contacts as EmergencyContact[]).length === 0 && !showAddContact && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No emergency contacts added yet.</p>
        )}

        {(contacts as EmergencyContact[]).map(c => (
          editingContact?.contact_id === c.contact_id ? (
            <div key={c.contact_id} style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Name *</label>
                  <input style={smallInputStyle} value={editingContact.name} onChange={e => setEditingContact(ec => ec ? { ...ec, name: e.target.value } : ec)} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Relationship</label>
                  <input style={smallInputStyle} placeholder="e.g. Spouse, Parent" value={editingContact.relationship || ''} onChange={e => setEditingContact(ec => ec ? { ...ec, relationship: e.target.value } : ec)} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Phone</label>
                  <input style={smallInputStyle} type="tel" value={editingContact.phone || ''} onChange={e => setEditingContact(ec => ec ? { ...ec, phone: e.target.value } : ec)} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Email</label>
                  <input style={smallInputStyle} type="email" value={editingContact.email || ''} onChange={e => setEditingContact(ec => ec ? { ...ec, email: e.target.value } : ec)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveContact} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
                <button onClick={() => setEditingContact(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={c.contact_id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{c.name}</span>
                    {c.relationship && <span style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 9px', color: 'var(--text-muted)' }}>{c.relationship}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {c.phone && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>📞 {c.phone}</span>}
                    {c.email && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>✉️ {c.email}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditingContact(c)} style={iconBtn()}>Edit</button>
                  <button onClick={() => handleDeleteContact(c.contact_id)} style={iconBtn('#dc2626')}>Delete</button>
                </div>
              </div>
            </div>
          )
        ))}

        {showAddContact && (
          <div style={{ ...cardStyle, border: '1.5px solid var(--accent)', marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Name *</label>
                <input style={smallInputStyle} placeholder="Full name" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Relationship</label>
                <input style={smallInputStyle} placeholder="e.g. Spouse, Parent" value={contactForm.relationship} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Phone</label>
                <input style={smallInputStyle} type="tel" placeholder="+1 (555) 000-0000" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Email</label>
                <input style={smallInputStyle} type="email" placeholder="email@example.com" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddContact} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Add Contact</button>
              <button onClick={() => setShowAddContact(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* Care Team */}
      <Section title="My Care Team" action={
        <button onClick={() => { setShowAddMember(true); setMemberForm({ name: '', role: '', specialty: '', phone: '', hospital: '' }) }} style={{
          background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>+ Add</button>
      }>
        {(careTeam as CareTeamMember[]).length === 0 && !showAddMember && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No care team members added yet.</p>
        )}

        {(careTeam as CareTeamMember[]).map(m => (
          editingMember?.member_id === m.member_id ? (
            <div key={m.member_id} style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Name *</label>
                  <input style={smallInputStyle} value={editingMember.name} onChange={e => setEditingMember(em => em ? { ...em, name: e.target.value } : em)} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Role</label>
                  <select style={smallInputStyle} value={editingMember.role || ''} onChange={e => setEditingMember(em => em ? { ...em, role: e.target.value } : em)}>
                    <option value="">Select…</option>
                    {CARE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Specialty</label>
                  <input style={smallInputStyle} placeholder="e.g. Cardiology" value={editingMember.specialty || ''} onChange={e => setEditingMember(em => em ? { ...em, specialty: e.target.value } : em)} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Phone</label>
                  <input style={smallInputStyle} type="tel" value={editingMember.phone || ''} onChange={e => setEditingMember(em => em ? { ...em, phone: e.target.value } : em)} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Hospital / Practice</label>
                  <input style={smallInputStyle} placeholder="e.g. Boston Medical Center" value={editingMember.hospital || ''} onChange={e => setEditingMember(em => em ? { ...em, hospital: e.target.value } : em)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveMember} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
                <button onClick={() => setEditingMember(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={m.member_id} style={{ ...cardStyle, borderLeft: '3px solid var(--navy)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{m.name}</span>
                    {m.role && <span style={{ fontSize: 11, background: 'rgba(30,58,95,0.08)', color: 'var(--navy)', borderRadius: 20, padding: '1px 9px' }}>{m.role}</span>}
                    {m.specialty && m.specialty !== m.role && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.specialty}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {m.hospital && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>🏥 {m.hospital}</span>}
                    {m.phone && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>📞 {m.phone}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditingMember(m)} style={iconBtn()}>Edit</button>
                  <button onClick={() => handleDeleteMember(m.member_id)} style={iconBtn('#dc2626')}>Delete</button>
                </div>
              </div>
            </div>
          )
        ))}

        {showAddMember && (
          <div style={{ ...cardStyle, border: '1.5px solid var(--accent)', marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Name *</label>
                <input style={smallInputStyle} placeholder="Dr. Jane Smith" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Role</label>
                <select style={smallInputStyle} value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="">Select…</option>
                  {CARE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Specialty</label>
                <input style={smallInputStyle} placeholder="e.g. Cardiology" value={memberForm.specialty} onChange={e => setMemberForm(f => ({ ...f, specialty: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Phone</label>
                <input style={smallInputStyle} type="tel" placeholder="+1 (555) 000-0000" value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Hospital / Practice</label>
                <input style={smallInputStyle} placeholder="e.g. Boston Medical Center" value={memberForm.hospital} onChange={e => setMemberForm(f => ({ ...f, hospital: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddMember} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Add Member</button>
              <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* Notification Preferences */}
      <Section title="Notification Preferences">
        <Row label="Reminder Method" value={data.reminder_preference ? data.reminder_preference.toUpperCase() : null} editing={false} />
        <Row
          label="Preferred Time"
          value={formatTime(data.preferred_time)}
          editing={editing}
          input={
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                type="time"
                style={inputStyle}
                value={form.preferred_time || ''}
                onChange={e => setForm(f => ({ ...f, preferred_time: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {form.preferred_time ? `Displays as: ${formatTime(form.preferred_time)}` : 'Select a time'}
              </span>
            </div>
          }
        />
      </Section>

      {/* Danger zone */}
      <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowClearConfirm(true)}
          style={{
            width: '100%', padding: '13px 20px',
            background: 'transparent', border: '1.5px solid #fca5a5',
            borderRadius: 12, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: '#dc2626',
            fontFamily: 'var(--font-body)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          Clear All CareCompanion History
        </button>
      </div>

      {/* Clear history confirmation modal */}
      {showClearConfirm && (
        <div onClick={() => !clearing && setShowClearConfirm(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10,25,47,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 16,
            boxShadow: '0 8px 40px rgba(10,37,64,0.22)',
            padding: '32px 28px 24px', width: 420, maxWidth: 'calc(100vw - 40px)',
            border: '1.5px solid #fca5a5',
          }}>
            {clearDone ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#15803d' }}>History cleared successfully.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>⚠️</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>Clear all history?</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
                      This will permanently delete all your <strong>medications</strong>, <strong>appointments</strong>, <strong>symptoms</strong>, <strong>uploaded PDFs</strong>, <strong>visit summaries</strong>, and all <strong>memory the assistant has built from your conversations</strong>. Your account, profile, emergency contacts, and care team will be kept.
                    </p>
                    <p style={{ fontSize: 12, color: '#dc2626', marginTop: 10, fontWeight: 600 }}>This cannot be undone.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowClearConfirm(false)} disabled={clearing} style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 9, padding: '9px 18px', fontSize: 13,
                    color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}>Cancel</button>
                  <button onClick={handleClearHistory} disabled={clearing} style={{
                    background: '#dc2626', border: 'none', borderRadius: 9, padding: '9px 20px',
                    fontSize: 13, fontWeight: 600, color: '#fff',
                    cursor: clearing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: clearing ? 0.7 : 1,
                  }}>
                    {clearing ? 'Clearing…' : 'Yes, clear everything'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
