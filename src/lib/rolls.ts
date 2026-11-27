import { supabase } from './supabase'

const SESSION_GAP = 3 * 3600_000

type Tag = { poster: string; strain: number; at: number }

/**
 * Same rule as the rolled_count database function: roller tags for the same strain less than
 * 3 hours apart are one session, and a session counts as the most check-ins any one person
 * posted in it (so a joint checked in by two people counts once, two joints count twice).
 */
export function countRolls(tags: Tag[]): number {
  let total = 0
  const byStrain = new Map<number, Tag[]>()
  for (const t of tags) byStrain.set(t.strain, [...(byStrain.get(t.strain) ?? []), t])
  for (const list of byStrain.values()) {
    list.sort((a, b) => a.at - b.at)
    let session = new Map<string, number>()
    let last = -Infinity
    const close = () => { total += Math.max(0, ...session.values()) }
    for (const t of list) {
      if (t.at - last > SESSION_GAP) { close(); session = new Map() }
      session.set(t.poster, (session.get(t.poster) ?? 0) + 1)
      last = t.at
    }
    close()
  }
  return total
}

/**
 * How often someone rolled (or, with insideOut, rolled inside out). Asks the database first (it sees every check-in); if that function
 * is missing or fails, counts from the check-ins you can see yourself instead of showing 0.
 */
export async function getRolledCount(uid: string, insideOut = false): Promise<number> {
  const fn = insideOut ? 'rolled_iso_count' : 'rolled_count'
  const { data, error } = await supabase.rpc(fn, { uid })
  if (!error && typeof data === 'number') return data
  if (error) console.warn(`${fn} failed, counting in the app instead:`, error.message)

  let q = supabase.from('checkin_people')
    .select('checkin:checkins!inner(user_id, strain_id, created_at)')
    .eq('user_id', uid).eq('role', 'roller')
  if (insideOut) q = q.eq('checkin.roll_style', 'inside_out')
  const { data: rows } = await q
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags = ((rows ?? []) as any[]).map((r) => {
    const c = Array.isArray(r.checkin) ? r.checkin[0] : r.checkin
    return { poster: c.user_id as string, strain: c.strain_id as number, at: new Date(c.created_at).getTime() }
  })
  return countRolls(tags)
}
