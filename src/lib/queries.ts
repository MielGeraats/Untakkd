import type { Checkin, CheckinPerson } from './types'

// One select string for check-ins everywhere, so cards always have what they need.
export const CHECKIN_SELECT = `
  *,
  profile:profiles!checkins_user_id_fkey(*),
  strain:strains(*),
  people:checkin_people(id, role, user_id, name, profile:profiles!checkin_people_user_id_fkey(*)),
  likes(user_id),
  comments(count)
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCheckin(row: any): Checkin {
  return { ...row, rating: Number(row.rating), people: row.people ?? [], likes: row.likes ?? [], comments: row.comments ?? [] }
}

export const personName = (p: Pick<CheckinPerson, 'name' | 'profile'>) =>
  p.profile ? p.profile.display_name || p.profile.username || 'Iemand' : p.name || 'Iemand'

export const personKey = (p: Pick<CheckinPerson, 'user_id' | 'name'>) =>
  p.user_id ? `u:${p.user_id}` : `n:${(p.name ?? '').trim().toLowerCase()}`

/** Strip characters that would break a PostgREST filter string. */
export const cleanSearch = (q: string) => q.replace(/[,()%_\\*]/g, ' ').trim()
