import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Empty, Spinner } from '../components/Spinner'
import { useAuth, useMe } from '../lib/auth'
import { CHECKIN_SELECT, normalizeCheckin, withSessions } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import type { Checkin } from '../lib/types'

type Item = { checkin: Checkin; roles: Set<'roller' | 'buddy'>; taggedAt: string }

// "Zelfde rotation" makes sense for half a day or so.
const JOIN_WINDOW = 12 * 3600_000

export function Notifications() {
  const me = useMe()
  const { refreshProfile } = useAuth()
  const [seenAt] = useState(() => me.notifications_seen_at ?? new Date().toISOString()) // before we mark them read
  const [items, setItems] = useState<Item[] | null>(null)
  const [requests, setRequests] = useState(0)

  useEffect(() => {
    let stale = false
    ;(async () => {
      const [{ data: tags }, { count }] = await Promise.all([
        supabase.from('checkin_people').select('checkin_id, role, created_at, checkin:checkins!inner(user_id)')
          .eq('user_id', me.id).neq('checkin.user_id', me.id)
          .order('created_at', { ascending: false }).limit(40),
        supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('addressee_id', me.id).eq('status', 'pending'),
      ])
      const byCheckin = new Map<number, { roles: Set<'roller' | 'buddy'>; taggedAt: string }>()
      for (const t of tags ?? []) {
        const cur = byCheckin.get(t.checkin_id) ?? { roles: new Set(), taggedAt: t.created_at }
        cur.roles.add(t.role)
        if (t.created_at > cur.taggedAt) cur.taggedAt = t.created_at
        byCheckin.set(t.checkin_id, cur)
      }
      const ids = [...byCheckin.keys()]
      const { data } = ids.length ? await supabase.from('checkins').select(CHECKIN_SELECT).in('id', ids) : { data: [] }
      const checkins = await withSessions((data ?? []).map(normalizeCheckin))
      const list = checkins
        .map((c) => ({ checkin: c, ...byCheckin.get(c.id)! }))
        .sort((a, b) => b.taggedAt.localeCompare(a.taggedAt))
      if (stale) return
      setItems(list)
      setRequests(count ?? 0)
      // mark everything as read
      await supabase.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', me.id)
      refreshProfile()
    })()
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id])

  if (!items) return <Spinner />

  return (
    <div className="space-y-3">
      <h1 className="page-title">Meldingen</h1>

      {requests > 0 && (
        <Link to="/friends" className="card flex items-center gap-3 border-orange-200 p-4 hover:bg-white">
          <span className="text-2xl">👋</span>
          <span className="flex-1 font-bold">
            {requests === 1 ? 'Iemand wil' : `${requests} mensen willen`} je maatje worden
          </span>
          <span className="text-sm font-black text-orange-500">Bekijken →</span>
        </Link>
      )}

      {items.length === 0 ? (
        <Empty emoji="🔕" title="Nog niemand heeft je getagd">Als een maat je tagt in een check-in, zie je dat hier meteen.</Empty>
      ) : items.map(({ checkin: c, roles, taggedAt }) => {
        const isNew = taggedAt > seenAt
        const joined = c.session_mates?.some((p) => p.id === me.id)
        const canJoin = !joined && Date.now() - new Date(c.created_at).getTime() < JOIN_WINDOW
        const as = roles.has('roller') && roles.has('buddy') ? 'als draaier én maatje' : roles.has('roller') ? 'als draaier 🌀' : ''
        return (
          <div key={c.id} className={`card p-4 ${isNew ? 'border-leaf-400 bg-leaf-50' : ''}`}>
            <div className="flex gap-3">
              <Link to={`/u/${c.profile.username}`} className="relative shrink-0">
                <Avatar profile={c.profile} />
                {isNew && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-orange-500 ring-2 ring-white" />}
              </Link>
              <Link to={`/checkin/${c.id}`} className="min-w-0 flex-1 text-sm leading-snug">
                <b>{c.profile.display_name || c.profile.username}</b> heeft je getagd {as} bij <b className="text-leaf-700">{c.strain.name}</b>
                {c.smoked_at && <> in <b>{c.smoked_at}</b></>}
                <span className="block text-xs font-bold text-leaf-800/50">{timeAgo(taggedAt)}</span>
              </Link>
            </div>
            <div className="mt-3 flex gap-2">
              {canJoin && (
                <Link to="/checkin/new" state={{ join: c }} className="btn btn-primary btn-sm flex-1">🔄 Zelfde rotation</Link>
              )}
              {joined && <span className="btn btn-sm pointer-events-none flex-1 text-leaf-700/70">🔄 Jij zat erbij</span>}
              <Link to={`/checkin/${c.id}`} className="btn btn-soft btn-sm flex-1">Bekijken</Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
