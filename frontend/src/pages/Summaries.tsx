import { useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getSummaries, createSummary, updateSummary, deleteSummary } from '../api/summaries'
import { getDischargeUploads, uploadDischargePdf, deleteDischargeUpload, type DischargeUpload } from '../api/dischargeUploads'
import { getAppointments } from '../api/appointments'

interface Summary {
  summary_id: number
  title: string
  ai_summary: string
  user_notes: string | null
  visit_date: string | null
  created_at: string
  source_upload_id: number | null
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: '0 0 14px' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: 'var(--navy)', margin: '20px 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--navy)', margin: '14px 0 6px' }}>{children}</h3>,
        p: ({ children }) => <p style={{ margin: '0 0 10px', lineHeight: 1.75, color: 'var(--text-mid)' }}>{children}</p>,
        strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--navy)' }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
        ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0 12px' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '4px 0 12px' }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 6, lineHeight: 1.65, color: 'var(--text-mid)' }}>{children}</li>,
        hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── Left panel — PDF list ─────────────────────────────────────────────────────

function LeftPanel({
  uploads, uploading, selectedId, onSelect, onUpload, summaries,
}: {
  uploads: DischargeUpload[]
  uploading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  onUpload: (file: File) => void
  summaries: Summary[]
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            My Visit Summaries
          </span>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%', background: uploading ? 'var(--border)' : 'var(--navy)',
            color: uploading ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 8,
            padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {uploading ? '⏳ Uploading…' : '⬆️ Upload Discharge PDF'}
        </button>
      </div>

      {/* PDF list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {uploads.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px', textAlign: 'center', lineHeight: 1.6 }}>
            No discharge papers uploaded yet.<br />Upload a PDF to get started.
          </p>
        ) : (
          uploads.map(u => {
            const summary = summaries.find(s => s.source_upload_id === u.upload_id)
            const isSelected = selectedId === u.upload_id
            return (
              <button key={u.upload_id} onClick={() => onSelect(u.upload_id)}
                style={{
                  width: '100%', textAlign: 'left', background: isSelected ? 'var(--blue-light)' : 'transparent',
                  border: 'none', borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                  padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.file_name.replace('.pdf', '')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {new Date(u.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 600 }}>
                    Discharge
                  </span>
                  {summary && (
                    <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 600 }}>
                      Reviewed
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Middle panel — summary detail ─────────────────────────────────────────────

function MiddlePanel({
  upload, summary, generating, onGenerate, onDeleteSummary, onUpdateNotes, onDeleteUpload,
}: {
  upload: DischargeUpload | null
  summary: Summary | null
  generating: boolean
  onGenerate: () => void
  onDeleteSummary: (id: number) => void
  onUpdateNotes: (id: number, val: string) => void
  onDeleteUpload: (id: number) => void
}) {
  const [tab, setTab] = useState<'summary' | 'pdf'>('summary')
  const [notes, setNotes] = useState('')
  const [notesInit, setNotesInit] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)

  // Sync notes when summary changes
  if (summary && !notesInit) {
    setNotes(summary.user_notes || '')
    setNotesInit(true)
  }
  if (!summary && notesInit) setNotesInit(false)

  function handleNotesChange(val: string) {
    setNotes(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!summary) return
      setSaving(true)
      await onUpdateNotes(summary.summary_id, val)
      setSaving(false)
    }, 1200)
  }

  if (!upload && !summary) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)', padding: 40 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>📋</div>
        <p style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.7 }}>Select a discharge document on the left<br />to view its AI summary.</p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Document header */}
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
            {upload ? upload.file_name.replace('.pdf', '') : summary!.title}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {upload ? (
              <>
                <span>📅 Uploaded {new Date(upload.uploaded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                {upload.medications_added > 0 && <span>💊 {upload.medications_added} meds</span>}
                {upload.appointments_scheduled > 0 && <span>📅 {upload.appointments_scheduled} appts</span>}
                {upload.instructions_saved > 0 && <span>📋 {upload.instructions_saved} instructions</span>}
              </>
            ) : (
              <span>📅 Created {new Date(summary!.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            )}
          </div>
        </div>
        {upload && (
          <button onClick={() => onDeleteUpload(upload.upload_id)}
            style={{ background: 'none', border: '1px solid var(--danger-border)', borderRadius: 7, padding: '5px 12px', fontSize: 11, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
            Delete PDF
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        {(upload
          ? [['summary', '✨ AI Summary'], ['pdf', '📄 Original Document']] as const
          : [['summary', '✨ AI Summary']] as const
        ).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as 'summary' | 'pdf')} style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
            padding: '10px 16px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
            fontFamily: 'var(--font-body)', transition: 'all 0.15s', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: tab === 'pdf' ? 'hidden' : 'auto', padding: tab === 'pdf' ? '12px 16px' : '20px 24px', display: 'flex', flexDirection: 'column' }}>
        {tab === 'pdf' && upload ? (
          upload.has_pdf ? (
            <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <iframe
                src={`/discharge-uploads/${upload.upload_id}/pdf`}
                title={upload.file_name}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>
          ) : (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', fontSize: 12, lineHeight: 1.8, color: 'var(--text-mid)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', flex: 1, overflowY: 'auto' }}>
              {upload.pdf_text || 'No text extracted.'}
            </div>
          )
        ) : summary ? (
          <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
              <MarkdownContent content={summary.ai_summary} />
            </div>
            {/* Notes */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>📝 My Notes</span>
                {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving…</span>}
              </div>
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add your own notes, doctor's comments, or reminders…"
                rows={4}
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>Notes auto-save as you type.</p>
            </div>
            <button onClick={() => onDeleteSummary(summary.summary_id)}
              style={{ marginTop: 16, background: 'none', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '7px 16px', fontSize: 12, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Delete Summary
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>✨</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>No summary yet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
              Generate an AI summary based on this discharge document,<br />combined with your symptom logs, medications, and appointments.
            </p>
            <button onClick={onGenerate} disabled={generating} style={{
              background: generating ? 'var(--border)' : 'var(--navy)', color: generating ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
            }}>
              {generating ? '⏳ Generating…' : '✨ Generate AI Summary'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({ userId, selectedUpload, summaries, generating, onGenerate, onSelectSummary, onDeleteSummary, selectedSummaryId, selectedUploadId }: {
  userId: number
  selectedUpload: DischargeUpload | null
  summaries: Summary[]
  generating: boolean
  onGenerate: () => void
  onSelectSummary: (summary: Summary) => void
  onDeleteSummary: (id: number) => void
  selectedSummaryId: number | null
  selectedUploadId: number | null
}) {
  const { data: apptData } = useApi(() => getAppointments(userId), [userId])
  const next = apptData?.next_appointment ?? null

  return (
    <div style={{ width: 210, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
      {/* Next visit */}
      <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Next Visit</p>
        {next ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
              {new Date(next.appointment_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{next.reason}</p>
            <p style={{ fontSize: 11, color: 'var(--text-light)' }}>
              🕐 {new Date(next.appointment_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            {next.location && <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>📍 {next.location}</p>}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No upcoming appointments.</p>
        )}
      </div>

      {/* Generate summary */}
      {selectedUpload && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>AI Summary</p>
          <button onClick={onGenerate} disabled={generating} style={{
            width: '100%', background: generating ? 'var(--border)' : 'var(--navy)',
            color: generating ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 8,
            padding: '9px 0', fontSize: 12, fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
          }}>
            {generating ? '⏳ Generating…' : '✨ Regenerate'}
          </button>
          <p style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 6, lineHeight: 1.5 }}>
            Uses this PDF + your current symptom logs, medications &amp; appointments.
          </p>
        </div>
      )}

      {/* Summary history */}
      {summaries.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>All Summaries</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summaries.map(s => {
              const isActive = s.summary_id === selectedSummaryId || (selectedSummaryId === null && s.source_upload_id !== null && s.source_upload_id === selectedUploadId)
              const dt = new Date(s.created_at)
              const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
              const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <div
                  key={s.summary_id}
                  style={{
                    background: isActive ? 'var(--blue-light)' : 'var(--surface-2)',
                    border: `1px solid ${isActive ? 'var(--blue-mid)' : 'var(--border-light)'}`,
                    borderRadius: 8, overflow: 'hidden', transition: 'all 0.15s',
                  }}
                >
                  <button
                    onClick={() => onSelectSummary(s)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      padding: '8px 10px', cursor: 'pointer', fontFamily: 'var(--font-body)',
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 1 }}>{dateStr}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-light)', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</p>
                  </button>
                  <div style={{ padding: '0 10px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteSummary(s.summary_id) }}
                      title="Delete summary"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Summaries() {
  const { user } = useAuth()
  const userId = user!.userId

  const { data: uploadsData, loading: uploadsLoading, refetch: refetchUploads } = useApi(() => getDischargeUploads(userId), [userId])
  const { data: summariesData, refetch: refetchSummaries } = useApi(() => getSummaries(userId), [userId])

  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null)
  const [selectedSummaryId, setSelectedSummaryId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [generating, setGenerating] = useState(false)

  const uploads: DischargeUpload[] = uploadsData?.uploads ?? []
  const summaries: Summary[] = summariesData?.summaries ?? []

  const selectedUpload = uploads.find(u => u.upload_id === selectedUploadId) ?? null
  // Summary is either the directly-selected one, or the one linked to the selected PDF
  const selectedSummary = selectedSummaryId
    ? (summaries.find(s => s.summary_id === selectedSummaryId) ?? null)
    : (summaries.find(s => s.source_upload_id === selectedUploadId) ?? null)

  function handleSelectUpload(uploadId: number) {
    setSelectedUploadId(uploadId)
    setSelectedSummaryId(null) // let middle panel derive from upload
  }

  function handleSelectSummary(summary: Summary) {
    setSelectedSummaryId(summary.summary_id)
    // Also highlight the linked PDF in the left panel if there is one
    if (summary.source_upload_id !== null) {
      setSelectedUploadId(summary.source_upload_id)
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const result = await uploadDischargePdf(userId, file)
      refetchUploads()
      setSelectedUploadId(result.upload_id)
      setSelectedSummaryId(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerate() {
    if (!selectedUploadId) return
    setGenerating(true)
    try {
      const upload = uploads.find(u => u.upload_id === selectedUploadId)
      await createSummary({
        user_id: userId,
        title: upload?.file_name.replace('.pdf', '') || 'Visit Summary',
        upload_id: selectedUploadId,
      })
      setSelectedSummaryId(null) // reset so it re-derives from uploadId
      refetchSummaries()
    } finally {
      setGenerating(false)
    }
  }

  async function handleDeleteSummary(summaryId: number) {
    await deleteSummary(summaryId)
    if (selectedSummaryId === summaryId) setSelectedSummaryId(null)
    refetchSummaries()
  }

  async function handleUpdateNotes(summaryId: number, val: string) {
    await updateSummary(summaryId, { user_notes: val })
  }

  const handleDeleteUpload = useCallback(async (uploadId: number) => {
    await deleteDischargeUpload(uploadId)
    if (selectedUploadId === uploadId) { setSelectedUploadId(null); setSelectedSummaryId(null) }
    refetchUploads()
    refetchSummaries()
  }, [selectedUploadId, refetchUploads, refetchSummaries])

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', animation: 'fadeUp 0.35s ease forwards' }}>
      {uploadError && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: 'var(--danger)', zIndex: 10 }}>
          ❌ {uploadError}
          <button onClick={() => setUploadError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', marginLeft: 10 }}>✕</button>
        </div>
      )}

      {uploadsLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <LeftPanel
            uploads={uploads}
            uploading={uploading}
            selectedId={selectedUploadId}
            onSelect={handleSelectUpload}
            onUpload={handleUpload}
            summaries={summaries}
          />
          <MiddlePanel
            upload={selectedUpload}
            summary={selectedSummary}
            generating={generating}
            onGenerate={handleGenerate}
            onDeleteSummary={handleDeleteSummary}
            onUpdateNotes={handleUpdateNotes}
            onDeleteUpload={handleDeleteUpload}
          />
          <RightPanel
            userId={userId}
            selectedUpload={selectedUpload}
            summaries={summaries}
            generating={generating}
            onGenerate={handleGenerate}
            onSelectSummary={handleSelectSummary}
            onDeleteSummary={handleDeleteSummary}
            selectedSummaryId={selectedSummaryId}
            selectedUploadId={selectedUploadId}
          />
        </>
      )}
    </div>
  )
}
