export async function getSymptoms(userId: number) {
  const now = new Date()
  const localDate = now.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const utcOffsetMinutes = -now.getTimezoneOffset() // e.g. EST = -300
  const res = await fetch(`/symptoms/${userId}?local_date=${localDate}&utc_offset_minutes=${utcOffsetMinutes}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function logSymptom(userId: number, payload: { symptom: string; severity: number; condition_type?: string }) {
  const res = await fetch(`/symptoms/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}
