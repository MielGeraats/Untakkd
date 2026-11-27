import { CHECKIN_SELECT, normalizeCheckin, sessionKey, withSessions } from './queries'
import { supabase } from './supabase'
import type { Checkin, Profile } from './types'

export type NotificationKind = 'tag' | 'like' | 'comment' | 'join' | 'request' | 'friends' | 'accepted'

export type Notification = {
  key: string
  kind: NotificationKind
  at: string
  actor: Profile
  /** the check-in it's about (for likes/comments/joins: your check-in; for tags: theirs) */
  checkinId?: number
  strainName?: string
  /** tags only: the full check-in, so you can hit "Zelfde rotation" */
  checkin?: Checkin
  roller?: boolean
  comment?: string
}

const LIMIT = 40
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

/** Everything that happened to you: tags, 🔥, comments, rotation joins and friend stuff. Newest first. */
export async function fetchNotifications(me: string): Promise<Notification[]> {
  const { data: mine } = await supabase.from('checkins').select('id, session_of, strain:strains(name)')
    .eq('user_id', me).order('created_at', { ascending: false }).limit(200)
  const myCheckins = (mine ?? []) as Row[]
  const ids = myCheckins.map((c) => c.id)
  const strainOf = new Map<number, string>(myCheckins.map((c) => [c.id, c.strain?.name]))
  const sessionOwner = new Map<number, number>(myCheckins.map((c) => [sessionKey(c), c.id]))
  const keys = [...sessionOwner.keys()]
  const none = { data: [] as Row[] }

  const [tags, likes, comments, joins, friendships] = await Promise.all([
    supabase.from('checkin_people').select('checkin_id, role, created_at, checkin:checkins!inner(user_id)')
      .eq('user_id', me).neq('checkin.user_id', me).order('created_at', { ascending: false }).limit(LIMIT),
    ids.length ? supabase.from('likes').select('checkin_id, created_at, user_id, profile:profiles(*)')
      .in('checkin_id', ids).neq('user_id', me).order('created_at', { ascending: false }).limit(LIMIT) : none,
    ids.length ? supabase.from('comments').select('id, checkin_id, created_at, body, user_id, profile:profiles!comments_user_id_fkey(*)')
      .in('checkin_id', ids).neq('user_id', me).order('created_at', { ascending: false }).limit(LIMIT) : none,
    keys.length ? supabase.from('checkins').select('id, session_of, created_at, user_id, profile:profiles!checkins_user_id_fkey(*)')
      .in('session_of', keys).neq('user_id', me).order('created_at', { ascending: false }).limit(LIMIT) : none,
    supabase.from('friendships').select('id, status, created_at, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .order('created_at', { ascending: false }).limit(LIMIT),
  ])

  // Tags: load the full check-ins so "Zelfde rotation" works.
  const tagRows = (tags.data ?? []) as Row[]
  const tagIds = [...new Set(tagRows.map((t) => t.checkin_id))]
  const { data: tagged } = tagIds.length ? await supabase.from('checkins').select(CHECKIN_SELECT).in('id', tagIds) : none
  const taggedById = new Map((await withSessions((tagged ?? []).map(normalizeCheckin))).map((c) => [c.id, c]))

  const out: Notification[] = []
  const seenTag = new Set<number>()
  for (const t of tagRows) {
    const c = taggedById.get(t.checkin_id)
    if (!c || seenTag.has(c.id)) continue
    seenTag.add(c.id)
    out.push({ key: `tag-${c.id}`, kind: 'tag', at: t.created_at, actor: c.profile, checkinId: c.id, strainName: c.strain.name,
      checkin: c, roller: tagRows.some((x) => x.checkin_id === c.id && x.role === 'roller') })
  }
  for (const l of (likes.data ?? []) as Row[]) {
    if (l.profile) out.push({ key: `like-${l.checkin_id}-${l.user_id}`, kind: 'like', at: l.created_at, actor: l.profile, checkinId: l.checkin_id, strainName: strainOf.get(l.checkin_id) })
  }
  for (const c of (comments.data ?? []) as Row[]) {
    if (c.profile) out.push({ key: `comment-${c.id}`, kind: 'comment', at: c.created_at, actor: c.profile, checkinId: c.checkin_id, strainName: strainOf.get(c.checkin_id), comment: c.body })
  }
  for (const j of (joins.data ?? []) as Row[]) {
    const yours = sessionOwner.get(j.session_of)
    if (j.profile) out.push({ key: `join-${j.id}`, kind: 'join', at: j.created_at, actor: j.profile, checkinId: j.id, strainName: yours ? strainOf.get(yours) : undefined })
  }
  for (const f of (friendships.data ?? []) as Row[]) {
    const incoming = f.addressee_id === me
    const actor = incoming ? f.requester : f.addressee
    if (!actor) continue
    // accepted requests you sent show as "accepted"; ones you received as "you're now friends"
    const kind: NotificationKind = f.status === 'pending' ? (incoming ? 'request' : 'friends') : incoming ? 'friends' : 'accepted'
    if (f.status === 'pending' && !incoming) continue // your own outgoing request isn't news
    out.push({ key: `friend-${f.id}`, kind, at: f.created_at, actor })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80)
}

/** How many notifications arrived since `since` (for the red counter on the bell). */
export async function countNew(me: string, since: string): Promise<number> {
  const head = { count: 'exact' as const, head: true }
  const [tags, likes, comments, requests, mine] = await Promise.all([
    supabase.from('checkin_people').select('id, checkin:checkins!inner(user_id)', head)
      .eq('user_id', me).neq('checkin.user_id', me).gt('created_at', since),
    supabase.from('likes').select('user_id, checkin:checkins!inner(user_id)', head)
      .eq('checkin.user_id', me).neq('user_id', me).gt('created_at', since),
    supabase.from('comments').select('id, checkin:checkins!inner(user_id)', head)
      .eq('checkin.user_id', me).neq('user_id', me).gt('created_at', since),
    supabase.from('friendships').select('id', head).eq('addressee_id', me).gt('created_at', since),
    supabase.from('checkins').select('id, session_of').eq('user_id', me).order('created_at', { ascending: false }).limit(50),
  ])
  const keys = [...new Set(((mine.data ?? []) as Row[]).map(sessionKey))]
  const joins = keys.length
    ? (await supabase.from('checkins').select('id', head).in('session_of', keys).neq('user_id', me).gt('created_at', since)).count ?? 0
    : 0
  return (tags.count ?? 0) + (likes.count ?? 0) + (comments.count ?? 0) + (requests.count ?? 0) + joins
}
