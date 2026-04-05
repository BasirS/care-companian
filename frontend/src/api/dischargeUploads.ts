export interface DischargeUpload {
  upload_id: number
  file_name: string
  pdf_text: string | null
  has_pdf: boolean
  medications_added: number
  appointments_scheduled: number
  instructions_saved: number
  uploaded_at: string
}

export async function getDischargeUploads(userId: number): Promise<{ uploads: DischargeUpload[] }> {
  const res = await fetch(`/discharge-uploads/${userId}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function uploadDischargePdf(userId: number, file: File): Promise<{
  upload_id: number; file_name: string;
  medications_added: number; appointments_scheduled: number; instructions_saved: number
}> {
  const form = new FormData()
  form.append('user_id', String(userId))
  form.append('file', file)
  const res = await fetch('/upload-discharge', { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function deleteDischargeUpload(uploadId: number): Promise<void> {
  const res = await fetch(`/discharge-uploads/${uploadId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
}
