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
export type GameTotals = { games: number; poffen: number; bouncers: number; palindromen: number; jillas: number }
const NO_GAMES: GameTotals = { games: 0, poffen: 0, bouncers: 0, palindromen: 0, jillas: 0 }

/** game: De Baapring career totals (optional; badges for the game stay at 0 without it). */
export function computeStats(checkins: Checkin[], rolledCount: number, game: GameTotals = NO_GAMES) {
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

  const methodCount = (m: string) => methods.find((x) => x.key === m)?.count ?? 0
  const when = checkins.map((c) => new Date(c.created_at))

  return {
    game,
    methodCount,
    photos: checkins.filter((c) => c.photo_path).length,
    withNotes: checkins.filter((c) => c.notes).length,
    rotations: checkins.filter((c) => c.session_of).length,
    parties: checkins.filter((c) => c.people.filter((p) => p.role === 'buddy').length >= 4).length,
    loyalty: Math.max(0, ...[...byStrain.values()].map((x) => x.ratings.length)),
    harshCount: ratings.filter((r) => r <= 1).length,
    weekend: when.filter((d) => d.getDay() === 0 || d.getDay() === 6).length,
    mondayMornings: when.filter((d) => d.getDay() === 1 && d.getHours() >= 6 && d.getHours() < 12).length,
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
    at420: hours.filter(({ h, m }) => (h === 4 || h === 16) && m >= 20 && m < 30).length,
    nightOwl: hours.filter(({ h }) => h >= 2 && h < 5).length,
    wakeAndBake: hours.filter(({ h }) => h >= 5 && h < 9).length,
  }
}

export type Badge = {
  id: string
  emoji: string
  name: string // title for the level you're at (or level 1 when not earned yet)
  desc: string
  level: number // 0 = not earned yet
  maxLevel: number
  current: number // your raw score
  from: number // threshold of your current level (0 when not earned)
  next: number | null // threshold of the next level, null when maxed out
  earned: boolean
  special?: boolean
}

type Def = {
  id: string
  emoji: string
  /** One title per level; a badge with fewer titles than levels reuses the last one. */
  titles: string[]
  /** Description; {n} becomes the target for the next level (or the last one when maxed). */
  desc: string
  levels: number[]
  metric: (s: UserStats) => number
}

// Each badge keeps going after you earn it: hit the next number and you level up (like Untappd).
const DEFS: Def[] = [
  { id: 'first', emoji: '🌱', titles: ['Eerste Kiemplantje'], desc: 'Je allereerste check-in. Mama is trots.', levels: [1], metric: (s) => s.total },
  { id: 'checkins', emoji: '🌿', titles: ['Vaste Klant', 'Stamgast', 'Fijnproever', 'Legende', 'Gaat het wel met je?', 'Mythe', 'Rookgod'],
    desc: '{n} check-ins', levels: [10, 25, 50, 100, 250, 500, 1000], metric: (s) => s.total },
  { id: 'strains', emoji: '🧭', titles: ['Ontdekkingsreiziger', 'Wietwetenschapper', 'Strain-professor', 'Cum Laude', 'Wandelende Wiet-encyclopedie'],
    desc: '{n} verschillende strains', levels: [5, 10, 25, 50, 100], metric: (s) => s.uniqueStrains },
  { id: 'roller', emoji: '🌀', titles: ['Draaitalent', 'Draaimeester', 'Draaigod', 'Draaikolk', 'Menselijke Draaimachine', 'Heeft geen vingerafdrukken meer'],
    desc: '{n} keer de draaier geweest', levels: [5, 10, 25, 50, 100, 250], metric: (s) => s.rolledCount },
  { id: 'social', emoji: '👯', titles: ['Puff Puff Pass', 'Gezelligheidsdier', 'Sociale Vlinder', 'Burgemeester van de Kring'],
    desc: '{n} sessies met gezelschap', levels: [5, 10, 25, 50, 100], metric: (s) => s.sessionsWithBuddies },
  { id: 'rotation', emoji: '🔄', titles: ['Zit in de Rotation', 'Rotatiekampioen', 'Draaideur', 'Kringkoning'],
    desc: '{n} keer Zelfde rotation', levels: [3, 10, 25, 50], metric: (s) => s.rotations },
  { id: 'party', emoji: '🎉', titles: ['Feestbeest', 'Huisfeest-veteraan', 'Festivalganger', 'Woodstock'],
    desc: '{n} sessies met 4+ maten', levels: [1, 5, 10, 25], metric: (s) => s.parties },
  { id: 'nomad', emoji: '🗺️', titles: ['Zwerver', 'Rugzaktoerist', 'Wereldreiziger', 'Heeft geen vaste woonplaats'],
    desc: 'Op {n} verschillende plekken gerookt', levels: [3, 5, 10, 25, 50], metric: (s) => s.spots.length },
  { id: 'shopper', emoji: '🛍️', titles: ['Shopaholic', 'Vaste Klant bij Iedereen', 'Coffeeshop-recensent', 'Michelin-inspecteur'],
    desc: 'Op {n} verschillende plekken gescoord', levels: [3, 5, 10, 20], metric: (s) => s.shops.length },
  { id: 'methods', emoji: '🧪', titles: ['Gekke Professor', 'Laborant', 'Heisenberg'],
    desc: '{n} verschillende methodes geprobeerd', levels: [3, 5, 8], metric: (s) => s.methods.length },
  { id: 'loyal', emoji: '💞', titles: ['Trouwe Partner', 'Verloofd', 'Getrouwd', 'Gouden Bruiloft'],
    desc: '{n}× dezelfde strain', levels: [5, 10, 25, 50], metric: (s) => s.loyalty },
  { id: 'indica', emoji: '🛋️', titles: ['Bankhanger', 'Eén met de Bank', 'Couch Potato', 'Is de bank geworden'],
    desc: '{n} indica check-ins', levels: [5, 10, 25, 50, 100], metric: (s) => s.typeCount('indica') },
  { id: 'sativa', emoji: '⚡', titles: ['Stuiterbal', 'Duracellkonijn', 'Op Zolder aan het Opruimen', 'Kernreactor'],
    desc: '{n} sativa check-ins', levels: [5, 10, 25, 50, 100], metric: (s) => s.typeCount('sativa') },
  { id: 'hybrid', emoji: '🧬', titles: ['Beste van Twee Werelden', 'Diplomaat', 'Zwitserland'],
    desc: '{n} hybrid check-ins', levels: [5, 10, 25, 50, 100], metric: (s) => s.typeCount('hybrid') },
  { id: 'voorie', emoji: '🎁', titles: ['Wouter Niet-Draaijer', 'Waarom Zelf Draaien?', 'Twee Linkerhanden'],
    desc: '{n} voories', levels: [5, 10, 25, 50], metric: (s) => s.methodCount('voorie') },
  { id: 'edible', emoji: '🍪', titles: ['Koekiemonster', 'Bakker', 'Space Chef', 'Waar is mijn lichaam?'],
    desc: '{n} spacecakes', levels: [3, 10, 25, 50], metric: (s) => s.methodCount('edible') },
  { id: 'gummy', emoji: '🍬', titles: ['Snoepkont', 'Gummybeer', 'Haribo-sponsor', 'Kinderen in de snoepwinkel'],
    desc: '{n} gummies', levels: [3, 10, 25, 50], metric: (s) => s.methodCount('gummy') },
  { id: 'topshelf', emoji: '⭐', titles: ['Bovenste Plank', 'Makkelijk Te Pleasen', 'Deelt Sterren uit als Snoep'],
    desc: '{n}× de volle 5 sterren gegeven', levels: [5, 10, 25, 50], metric: (s) => s.fiveStars },
  { id: 'critic', emoji: '🧐', titles: ['Strenge Recensent', 'Gordon Ramsay', 'Niks Is Goed Genoeg'],
    desc: '{n}× 1 ster of minder gegeven. Au.', levels: [1, 3, 10], metric: (s) => s.harshCount },
  { id: 'photo', emoji: '📸', titles: ['Paparazzi', 'Influencer', 'Wiet-fotograaf van het Jaar'],
    desc: '{n} check-ins met foto', levels: [5, 10, 25, 50, 100], metric: (s) => s.photos },
  { id: 'notes', emoji: '✍️', titles: ['Dagboekschrijver', 'Recensent', 'Dichter des Vaderlands'],
    desc: '{n} check-ins met notities', levels: [5, 10, 25, 50], metric: (s) => s.withNotes },
  { id: '420', emoji: '🕓', titles: ['Blaze It', 'Klokkenluider', 'Leeft op 4:20-tijd', 'Nice.'],
    desc: '{n}× inchecken tussen 4:20 en 4:29', levels: [1, 4, 20, 69], metric: (s) => s.at420 },
  { id: 'owl', emoji: '🦉', titles: ['Nachtbraker', 'Vampier', 'Wat Is Slaap?'],
    desc: '{n}× inchecken tussen 2 en 5 uur ’s nachts', levels: [1, 5, 10, 25], metric: (s) => s.nightOwl },
  { id: 'wake', emoji: '☀️', titles: ['Wake & Bake', 'Vroege Vogel', 'Ontbijtkampioen'],
    desc: '{n}× inchecken tussen 5 en 9 uur ’s ochtends. Collegeklaar.', levels: [1, 5, 10, 25], metric: (s) => s.wakeAndBake },
  { id: 'weekend', emoji: '🍻', titles: ['Weekendstrijder', 'Zaterdagkoning', 'Leeft voor het Weekend'],
    desc: '{n} check-ins in het weekend', levels: [10, 25, 50, 100], metric: (s) => s.weekend },
  // De Baapring
  { id: 'ring-games', emoji: '💍', titles: ['Ringdrager', 'Ringmeester', 'Heer van de Ring', 'Sauron'],
    desc: '{n} potjes De Baapring', levels: [1, 5, 10, 25, 50], metric: (s) => s.game.games },
  { id: 'ring-palindromen', emoji: '🪞', titles: ['Palindroom-prins', 'Spiegelkoning', 'Kajak-kampioen', 'Legende van de Lepel'],
    desc: '{n} palindromen in De Baapring', levels: [1, 5, 10, 25], metric: (s) => s.game.palindromen },
  { id: 'ring-bouncers', emoji: '🔁', titles: ['Bouncer-baas', 'Boemerang', 'Jojo', 'Trampolinekoning'],
    desc: '{n} bouncers in De Baapring', levels: [5, 25, 50, 100], metric: (s) => s.game.bouncers },
  { id: 'ring-poffen', emoji: '💨', titles: ['Poffer', 'Pofmachine', 'Longen van Staal', 'Stoomlocomotief'],
    desc: '{n} poffen in De Baapring', levels: [25, 100, 250, 500], metric: (s) => s.game.poffen },
  { id: 'ring-jilla', emoji: '👮', titles: ['Jilla-magneet', 'Vaste Klant bij de Jilla', 'Jilla-veteraan', 'Woont in de Jilla'],
    desc: '{n} keer Jilla. Trots op?', levels: [5, 25, 50, 100], metric: (s) => s.game.jillas },
  { id: 'monday', emoji: '😩', titles: ['Breek de Week', 'Haat Maandagen', 'Garfield'],
    desc: '{n}× op maandagochtend ingecheckt', levels: [1, 5, 10], metric: (s) => s.mondayMornings },
]

export function computeBadges(stats: UserStats): Badge[] {
  return DEFS.map((d) => {
    const current = d.metric(stats)
    const level = d.levels.filter((t) => current >= t).length
    const next = d.levels[level] ?? null
    const title = d.titles[Math.min(Math.max(level, 1), d.titles.length) - 1]
    return {
      id: d.id, emoji: d.emoji, name: title,
      desc: d.desc.replace('{n}', String(next ?? d.levels[d.levels.length - 1])),
      level, maxLevel: d.levels.length, current,
      from: level ? d.levels[level - 1] : 0, next, earned: level > 0,
    }
  })
}

// Hand-out badges, stored on the profile (profiles.special_badges). Only the database admin can give them.
const SPECIAL: Record<string, Pick<Badge, 'emoji' | 'name' | 'desc'>> = {
  maker: { emoji: '👑', name: 'De Grote Baas', desc: 'Heeft deze app gebouwd in plaats van te studeren. Bugs? Zijn features.' },
  ringbaap1: { emoji: '💍', name: 'The One Ringbaap to Rule Them All', desc: 'Was erbij toen de allereerste Ringbaap op Untakkd werd ingecheckt. My precious.' },
  og: { emoji: '🦖', name: 'OG Alpha-blower', desc: 'Een van de eerste 5. Was erbij toen Untakkd nog aan elkaar hing van plakband en vloeitjes.' },
}

export function specialBadges(ids: string[] | null | undefined): Badge[] {
  return (ids ?? []).filter((id) => SPECIAL[id]).map((id) => ({
    id: `special-${id}`, ...SPECIAL[id], level: 1, maxLevel: 1, current: 1, from: 1, next: null, earned: true, special: true,
  }))
}
