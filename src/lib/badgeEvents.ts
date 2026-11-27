import { canSeeBaapring, fetchCareers, type Career } from './baapring'
import { CHECKIN_SELECT, normalizeCheckin } from './queries'
import { getRolledCount } from './rolls'
import { computeBadges, computeStats, specialBadges, type Badge } from './stats'
import { supabase } from './supabase'
import type { Profile } from './types'

/** All your badges right now (check-ins, rolling, De Baapring and the unique ones). */
export async function myBadges(me: Profile): Promise<Badge[]> {
  const [{ data }, rolled, iso, careers] = await Promise.all([
    supabase.from('checkins').select(CHECKIN_SELECT).eq('user_id', me.id).order('created_at', { ascending: false }).limit(500),
    getRolledCount(me.id),
    getRolledCount(me.id, true),
    canSeeBaapring(me) ? fetchCareers([me.id]).catch(() => new Map<string, Career>()) : Promise.resolve(new Map<string, Career>()),
  ])
  const stats = computeStats((data ?? []).map(normalizeCheckin), rolled, careers.get(me.id), iso)
  const list = computeBadges(stats).filter((b) => canSeeBaapring(me) || !b.id.startsWith('ring-'))
  return [...specialBadges(me.special_badges), ...list]
}

/**
 * Saves badges you earned (or levelled up) since last time, so they show up in Meldingen.
 * The very first time, everything you already had is saved silently (no flood of old badges),
 * except the ones in `fresh` (just earned with this check-in).
 * Returns the badges that are new.
 */
export async function recordBadges(badges: Badge[], fresh: Set<string> = new Set()): Promise<Badge[]> {
  const { data: rows, error } = await supabase.from('badge_events').select('badge_id, level')
  if (error) return [] // table not there yet: nothing to record
  const have = new Map<string, number>()
  for (const r of rows ?? []) have.set(r.badge_id, Math.max(have.get(r.badge_id) ?? 0, r.level))
  const firstTime = (rows ?? []).length === 0

  const newOnes = badges.filter((b) => b.earned && b.level > (have.get(b.id) ?? 0))
  if (!newOnes.length) return []
  const silent = (b: Badge) => firstTime && !fresh.has(b.id)
  await supabase.from('badge_events').upsert(
    newOnes.map((b) => ({ badge_id: b.id, level: b.level, name: b.name, emoji: b.emoji, silent: silent(b) })),
    { onConflict: 'user_id,badge_id,level', ignoreDuplicates: true },
  )
  return newOnes.filter((b) => !silent(b))
}
