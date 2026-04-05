export async function getProfile(userId: number) {
  const res = await fetch(`/profile/${userId}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function updateProfile(userId: number, fields: Record<string, string | null>) {
  const res = await fetch(`/profile/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function clearUserHistory(userId: number) {
  const res = await fetch(`/users/${userId}/history`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

// ── Emergency Contacts ──────────────────────────────────────────────────────

export interface EmergencyContact {
  contact_id: number; name: string; relationship: string | null;
  phone: string | null; email: string | null;
}

export async function getEmergencyContacts(userId: number): Promise<EmergencyContact[]> {
  const res = await fetch(`/users/${userId}/emergency-contacts`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function addEmergencyContact(userId: number, data: Omit<EmergencyContact, 'contact_id'>): Promise<EmergencyContact> {
  const res = await fetch(`/users/${userId}/emergency-contacts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function updateEmergencyContact(contactId: number, data: Partial<Omit<EmergencyContact, 'contact_id'>>) {
  const res = await fetch(`/emergency-contacts/${contactId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function deleteEmergencyContact(contactId: number) {
  const res = await fetch(`/emergency-contacts/${contactId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

// ── Care Team ───────────────────────────────────────────────────────────────

export interface CareTeamMember {
  member_id: number; name: string; role: string | null;
  specialty: string | null; phone: string | null; hospital: string | null;
}

export async function getCareTeam(userId: number): Promise<CareTeamMember[]> {
  const res = await fetch(`/users/${userId}/care-team`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function addCareTeamMember(userId: number, data: Omit<CareTeamMember, 'member_id'>): Promise<CareTeamMember> {
  const res = await fetch(`/users/${userId}/care-team`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function updateCareTeamMember(memberId: number, data: Partial<Omit<CareTeamMember, 'member_id'>>) {
  const res = await fetch(`/care-team/${memberId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function deleteCareTeamMember(memberId: number) {
  const res = await fetch(`/care-team/${memberId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}
