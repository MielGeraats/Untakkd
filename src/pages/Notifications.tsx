import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { BugNote } from '../components/BugNote'
import { Empty, Spinner } from '../components/Spinner'
import { useAuth, useMe } from '../lib/auth'
import { fetchNotifications, type Notification } from '../lib/notifications'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'

// "Zelfde rotation" makes sense for half a day or so.
const JOIN_WINDOW = 12 * 3600_000

const ICON: Record<Notification['kind'], string> = {
  tag: '🏷️', like: '🔥', comment: '💬', join: '🔄', request: '👋', friends: '🤝', accepted: '🤝',
}

export function Notifications() {
  const me = useMe()
  const { refreshProfile } = useAuth()
  const [seenAt] = useState(() => me.notifications_seen_at ?? new Date().toISOString()) // before we mark them read
  const [items, setItems] = useState<Notification[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stale = false
    fetchNotifications(me.id)
      .then(async (list) => {
        if (stale) return
        setItems(list)
        // mark everything as read
        await supabase.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', me.id)
        refreshProfile()
      })
      .catch((e) => !stale && setError(e?.message ?? 'Meldingen laden lukt niet'))
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id])

  if (error) return <Empty emoji="🛠️" title="Meldingen laden lukt niet">{error}<BugNote className="mt-2" /></Empty>
  if (!items) return <Spinner />

  const fresh = items.filter((n) => n.at > seenAt).length

  return (
    <div className="space-y-2">
      <h1 className="page-title mb-1">Meldingen</h1>
      <p className="mb-3 text-sm text-leaf-800/60">{fresh ? `${fresh} nieuw sinds je laatst keek 👀` : 'Je bent helemaal bij. Neem een pof.'}</p>

      {items.length === 0 ? (
        <Empty emoji="🔕" title="Nog geen meldingen">Als iemand je tagt, je post aansteekt of reageert, zie je dat hier.</Empty>
      ) : items.map((n) => <Row key={n.key} n={n} isNew={n.at > seenAt} meId={me.id} />)}
    </div>
  )
}

function Row({ n, isNew, meId }: { n: Notification; isNew: boolean; meId: string }) {
  const who = <b>{n.actor.display_name || n.actor.username}</b>
  const strain = n.strainName ? <b className="text-leaf-700">{n.strainName}</b> : 'je check-in'
  const text: Record<Notification['kind'], ReactNode> = {
    tag: <>{who} heeft je getagd{n.roller ? ' als draaier 🌀' : ''} bij {strain}{n.checkin?.smoked_at && <> in <b>{n.checkin.smoked_at}</b></>}</>,
    like: <>{who} heeft je {strain} aangestoken</>,
    comment: <>{who} reageerde op je {strain}: <span className="italic">“{n.comment}”</span></>,
    join: <>{who} zat in dezelfde rotation bij je {strain}</>,
    request: <>{who} wil je maatje worden</>,
    friends: <>{who} en jij zijn nu maten</>,
    accepted: <>{who} heeft je verzoek geaccepteerd</>,
  }
  const href = n.checkinId ? `/checkin/${n.checkinId}` : n.kind === 'request' ? '/friends' : `/u/${n.actor.username}`
  const c = n.checkin
  const joined = c?.session_mates?.some((p) => p.id === meId)
  const canJoin = n.kind === 'tag' && c && !joined && Date.now() - new Date(c.created_at).getTime() < JOIN_WINDOW

  return (
    <div className={`card p-3 ${isNew ? 'border-orange-300 bg-orange-50/70' : ''}`}>
      <div className="flex gap-3">
        <Link to={`/u/${n.actor.username}`} className="relative shrink-0">
          <Avatar profile={n.actor} />
          <span className="absolute -bottom-1 -right-1 text-sm">{ICON[n.kind]}</span>
        </Link>
        <Link to={href} className="min-w-0 flex-1 text-sm leading-snug">
          <span className="line-clamp-3">{text[n.kind]}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-leaf-800/50">
            {isNew && <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-black text-white">NIEUW</span>}
            {timeAgo(n.at)}
          </span>
        </Link>
      </div>
      {(canJoin || (n.kind === 'tag' && joined)) && (
        <div className="mt-2 flex gap-2 pl-14">
          {canJoin && <Link to="/checkin/new" state={{ join: c }} className="btn btn-primary btn-sm flex-1">🔄 Zelfde rotation</Link>}
          {joined && <span className="btn btn-sm pointer-events-none flex-1 text-leaf-700/70">🔄 Jij zat erbij</span>}
        </div>
      )}
    </div>
  )
}
