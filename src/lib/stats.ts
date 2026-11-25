import { personKey, personName } from './queries'
import type { Checkin } from './types'

type Counted = { key: string; label: string; count: number }

function tally<T>(items: T[], key: (t: T) => string | null, label: (t: T) => string): Counted[] {
  const map = new Map<string, Counted>()
  for (const it of items) {
    const k = key(it)
    if (!k) continue
    const cur = map.get(k) ?? { key: k, label: label(it), count: 0 }
    cur.count++
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

const spotKey = (s: string | null) => (s?.trim() ? s.trim().toLowerCase() : null)

export type UserStats = ReturnType<typeof computeStats>

/** checkins: the user's own check-ins. rolledCount: times the user was tagged as roller (by anyone). */
export function computeStats(checkins: Checkin[], rolledCount: number) {
  const ratings = checkins.map((c) => c.rating)
  const byStrain = new Map<number, { name: string; id: number; ratings: number[] }>()
  for (const c of checkins) {
    const s = byStrain.get(c.strain_id) ?? { id: c.strain_id, name: c.strain?.name ?? '?', ratings: [] }
    s.ratings.push(c.rating)
    byStrain.set(c.strain_id, s)
  }
  const strains = [...byStrain.values()]
    .map((s) => ({ ...s, avg: s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length, count: s.ratings.length }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)

  const rollers = tally(checkins.flatMap((c) => c.people.filter((p) => p.role === 'roller')), personKey, personName)
  const buddies = tally(checkins.flatMap((c) => c.people.filter((p) => p.role === 'buddy')), personKey, personName)
  const spots = tally(checkins, (c) => spotKey(c.smoked_at), (c) => c.smoked_at!.trim())
  const shops = tally(checkins, (c) => spotKey(c.bought_at), (c) => c.bought_at!.trim())
  const methods = tally(checkins, (c) => c.method, (c) => c.method)
  const types = tally(checkins, (c) => c.strain?.type ?? null, (c) => c.strain?.type ?? '')

  const hours = checkins.map((c) => {
    const d = new Date(c.created_at)
    return { h: d.getHours(), m: d.getMinutes() }
  })

  return {
    total: checkins.length,
    uniqueStrains: byStrain.size,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    fiveStars: ratings.filter((r) => r === 5).length,
    harshest: ratings.length ? Math.min(...ratings) : null,
    strains,
    rollers,
    buddies,
    spots,
    shops,
    methods,
    typeCount: (t: string) => types.find((x) => x.key === t)?.count ?? 0,
    sessionsWithBuddies: checkins.filter((c) => c.people.some((p) => p.role === 'buddy')).length,
    rolledCount,
    at420: hours.some(({ h, m }) => (h === 4 || h === 16) && m >= 20 && m < 30),
    nightOwl: hours.some(({ h }) => h >= 2 && h < 5),
    wakeAndBake: hours.some(({ h }) => h >= 5 && h < 9),
  }
}

export type Badge = { id: string; emoji: string; name: string; desc: string; current: number; target: number; earned: boolean }

const DEFS: { id: string; emoji: string; name: string; desc: string; target: number; metric: (s: UserStats) => number }[] = [
  { id: 'first', emoji: '🌱', name: 'Eerste Kiemplantje', desc: 'Je allereerste check-in. Mama is trots.', target: 1, metric: (s) => s.total },
  { id: 'regular', emoji: '🌿', name: 'Vaste Klant', desc: '10 check-ins', target: 10, metric: (s) => s.total },
  { id: 'connoisseur', emoji: '🏅', name: 'Fijnproever', desc: '50 check-ins', target: 50, metric: (s) => s.total },
  { id: 'legend', emoji: '👑', name: 'Legende', desc: '100 check-ins. Gaat het wel met je?', target: 100, metric: (s) => s.total },
  { id: 'explorer', emoji: '🧭', name: 'Ontdekkingsreiziger', desc: '5 verschillende strains', target: 5, metric: (s) => s.uniqueStrains },
  { id: 'scholar', emoji: '📚', name: 'Wietwetenschapper', desc: '25 verschillende strains. Cum laude.', target: 25, metric: (s) => s.uniqueStrains },
  { id: 'roller', emoji: '🌀', name: 'Draaitalent', desc: '10 keer de draaier geweest', target: 10, metric: (s) => s.rolledCount },
  { id: 'master-roller', emoji: '🎖️', name: 'Draaigod', desc: '50 keer de draaier geweest', target: 50, metric: (s) => s.rolledCount },
  { id: 'social', emoji: '👯', name: 'Puff Puff Pass', desc: '10 sessies met gezelschap', target: 10, metric: (s) => s.sessionsWithBuddies },
  { id: 'nomad', emoji: '🗺️', name: 'Zwerver', desc: 'Op 5 verschillende plekken gerookt', target: 5, metric: (s) => s.spots.length },
  { id: 'shopper', emoji: '🛍️', name: 'Shopaholic', desc: 'Op 3 verschillende plekken gescoord', target: 3, metric: (s) => s.shops.length },
  { id: 'methods', emoji: '🧪', name: 'Gekke Professor', desc: '4 verschillende methodes geprobeerd', target: 4, metric: (s) => s.methods.length },
  { id: 'indica', emoji: '🛋️', name: 'Bankhanger', desc: '5 indica check-ins', target: 5, metric: (s) => s.typeCount('indica') },
  { id: 'sativa', emoji: '⚡', name: 'Stuiterbal', desc: '5 sativa check-ins', target: 5, metric: (s) => s.typeCount('sativa') },
  { id: 'hybrid', emoji: '🧬', name: 'Beste van Twee Werelden', desc: '5 hybrid check-ins', target: 5, metric: (s) => s.typeCount('hybrid') },
  { id: 'topshelf', emoji: '⭐', name: 'Bovenste Plank', desc: 'Vijf keer de volle 5 sterren gegeven', target: 5, metric: (s) => s.fiveStars },
  { id: 'critic', emoji: '🧐', name: 'Strenge Recensent', desc: 'Iets 1 ster of minder gegeven. Au.', target: 1, metric: (s) => (s.harshest !== null && s.harshest <= 1 ? 1 : 0) },
  { id: '420', emoji: '🕓', name: 'Blaze It', desc: 'Inchecken tussen 4:20 en 4:29', target: 1, metric: (s) => (s.at420 ? 1 : 0) },
  { id: 'owl', emoji: '🦉', name: 'Nachtbraker', desc: 'Inchecken tussen 2 en 5 uur ’s nachts', target: 1, metric: (s) => (s.nightOwl ? 1 : 0) },
  { id: 'wake', emoji: '☀️', name: 'Wake & Bake', desc: 'Inchecken tussen 5 en 9 uur ’s ochtends. Collegeklaar.', target: 1, metric: (s) => (s.wakeAndBake ? 1 : 0) },
]

export function computeBadges(stats: UserStats): Badge[] {
  return DEFS.map((d) => {
    const current = d.metric(stats)
    return { id: d.id, emoji: d.emoji, name: d.name, desc: d.desc, target: d.target, current: Math.min(current, d.target), earned: current >= d.target }
  })
}
