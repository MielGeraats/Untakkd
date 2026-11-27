import { supabase } from './supabase'
import type { Checkin, CheckinPerson, Profile } from './types'

// One select string for check-ins everywhere, so cards always have what they need.
export const CHECKIN_SELECT = `
  *,
  profile:profiles!checkins_user_id_fkey(*),
  strain:strains(*),
  people:checkin_people(id, role, user_id, name, profile:profiles!checkin_people_user_id_fkey(*)),
  likes(user_id, created_at, profile:profiles(*)),
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

export const sessionKey = (c: Pick<Checkin, 'id' | 'session_of'>) => c.session_of ?? c.id

/** Adds session_mates: the other people (that you can see) who checked in to the same session. */
export async function withSessions(list: Checkin[]): Promise<Checkin[]> {
  const keys = [...new Set(list.map(sessionKey))]
  if (!keys.length) return list
  const { data } = await supabase.from('checkins')
    .select('id, user_id, session_of, profile:profiles!checkins_user_id_fkey(*)')
    .or(`id.in.(${keys.join(',')}),session_of.in.(${keys.join(',')})`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  const bySession = new Map<number, { user_id: string; profile: Profile }[]>()
  for (const r of rows) {
    const k = sessionKey(r)
    bySession.set(k, [...(bySession.get(k) ?? []), r])
  }
  return list.map((c) => {
    const seen = new Set([c.user_id])
    const mates: Profile[] = []
    for (const r of bySession.get(sessionKey(c)) ?? []) {
      if (seen.has(r.user_id) || !r.profile) continue
      seen.add(r.user_id)
      mates.push(r.profile)
    }
    return { ...c, session_mates: mates }
  })
}
