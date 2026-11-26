import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../lib/auth'
import { methodInfo } from '../lib/constants'
import { placeUrl } from '../lib/places'
import { personName } from '../lib/queries'
import { photoUrl, supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import type { Checkin, CheckinPerson } from '../lib/types'
import { Avatar } from './Avatar'
import { ChatIcon, FlameIcon } from './Icons'
import { Stars } from './Stars'
import { StrainTypePill } from './StrainTypePill'

function PersonLink({ p }: { p: CheckinPerson }) {
  return p.profile?.username ? (
    <Link to={`/u/${p.profile.username}`} className="font-bold text-leaf-700 hover:underline">{personName(p)}</Link>
  ) : (
    <span className="font-bold">{personName(p)}</span>
  )
}

function PeopleList({ people }: { people: CheckinPerson[] }) {
  return (
    <>
      {people.map((p, i) => (
        <span key={p.id}>
          {i > 0 && (i === people.length - 1 ? ' & ' : ', ')}
          <PersonLink p={p} />
        </span>
      ))}
    </>
  )
}

export function CheckinCard({ c, commentCount, linkToDetail = true }: { c: Checkin; commentCount?: number; linkToDetail?: boolean }) {
  const me = useMe()
  const [likes, setLikes] = useState(() => c.likes.map((l) => l.user_id))
  const liked = likes.includes(me.id)
  const method = methodInfo(c.method)
  const rollers = c.people.filter((p) => p.role === 'roller')
  const buddies = c.people.filter((p) => p.role === 'buddy')
  const comments = commentCount ?? c.comments[0]?.count ?? 0
  // Offer "Zelfde rotation" on friends' recent check-ins (last 6 hours) that you haven't joined yet.
  const joined = c.user_id !== me.id && Boolean(c.session_mates?.some((p) => p.id === me.id))
  const canJoin = linkToDetail && c.user_id !== me.id && !joined && Date.now() - new Date(c.created_at).getTime() < 6 * 3600_000

  async function toggleLike() {
    if (liked) {
      setLikes((l) => l.filter((x) => x !== me.id))
      const { error } = await supabase.from('likes').delete().match({ checkin_id: c.id, user_id: me.id })
      if (error) setLikes((l) => [...l, me.id])
    } else {
      setLikes((l) => [...l, me.id])
      const { error } = await supabase.from('likes').insert({ checkin_id: c.id })
      if (error) setLikes((l) => l.filter((x) => x !== me.id))
    }
  }

  const details: [string, string, ReactNode][] = []
  const placeLink = (kind: 'spot' | 'shop', name: string) => (
    <Link to={placeUrl(kind, name)} className="font-bold text-leaf-700 hover:underline">{name}</Link>
  )
  if (c.smoked_at) details.push(['📍', 'Gerookt bij', placeLink('spot', c.smoked_at)])
  if (c.bought_at) details.push(['🛒', 'Gescoord bij', placeLink('shop', c.bought_at)])
  if (rollers.length) details.push(['🌀', 'Gedraaid door', <PeopleList people={rollers} />])
  if (buddies.length) details.push(['👥', 'Met', <PeopleList people={buddies} />])
  if (c.session_mates?.length) {
    details.push(['🤝', 'Samen met', c.session_mates.map((p, i) => (
      <span key={p.id}>
        {i > 0 && (i === c.session_mates!.length - 1 ? ' & ' : ', ')}
        <Link to={`/u/${p.username}`} className="font-bold text-leaf-700 hover:underline">{p.display_name || p.username}</Link>
      </span>
    ))])
  }

  return (
    <article className="card overflow-hidden">
      <div className="p-4">
        <header className="flex gap-3">
          <Link to={`/u/${c.profile.username}`}><Avatar profile={c.profile} /></Link>
          <div className="min-w-0 flex-1">
            <p className="leading-snug">
              <Link to={`/u/${c.profile.username}`} className="font-extrabold hover:underline">
                {c.profile.display_name || c.profile.username}
              </Link>{' '}
              <span className="text-leaf-800/70">{c.method === 'edible' ? 'smult van' : c.method === 'gummy' ? 'kauwt op' : 'rookt'}</span>{' '}
              <Link to={`/strains/${c.strain.id}`} className="font-extrabold text-leaf-700 hover:underline">{c.strain.name}</Link>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-leaf-800/60">
              <span>{method.emoji} {method.label}</span>
              <StrainTypePill type={c.strain.type} />
              <span aria-hidden>·</span>
              <Link to={`/checkin/${c.id}`} className="hover:underline">{timeAgo(c.created_at)}</Link>
            </div>
          </div>
        </header>

        <div className="mt-3 flex items-center gap-2">
          <Stars value={c.rating} size={20} />
          <span className="font-black text-leaf-700">{c.rating.toFixed(1)}</span>
        </div>

        {details.length > 0 && (
          <dl className="mt-3 space-y-1 text-sm">
            {details.map(([emoji, label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0"><span aria-hidden>{emoji}</span><span className="sr-only">{label}</span></dt>
                <dd className="min-w-0"><span className="text-leaf-800/60">{label} </span>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {c.notes && <p className="mt-3 rounded-2xl bg-leaf-50 px-3 py-2 text-sm italic text-leaf-900/80">“{c.notes}”</p>}
      </div>

      {c.photo_path && (
        <img src={photoUrl(c.photo_path)} alt={`Foto van ${c.strain.name}`} loading="lazy"
          className="max-h-[28rem] w-full bg-leaf-100 object-cover" />
      )}

      <footer className="flex items-center gap-1 border-t border-leaf-100 px-2 py-1.5">
        <button onClick={toggleLike} aria-pressed={liked}
          className={`btn btn-sm ${liked ? 'text-orange-500' : 'text-leaf-700/70'} hover:bg-leaf-50`}>
          <FlameIcon filled={liked} className="size-5" />
          <span>{liked ? 'Aangestoken' : 'Aansteken'}{likes.length > 0 && ` · ${likes.length}`}</span>
        </button>
        {linkToDetail ? (
          <Link to={`/checkin/${c.id}`} className="btn btn-sm text-leaf-700/70 hover:bg-leaf-50">
            <ChatIcon className="size-5" /> {comments > 0 ? comments : 'Reageer'}
          </Link>
        ) : (
          <span className="btn btn-sm pointer-events-none text-leaf-700/70"><ChatIcon className="size-5" /> {comments}</span>
        )}
        {canJoin && (
          <Link to="/checkin/new" state={{ join: c }} className="btn btn-sm ml-auto text-leaf-700 hover:bg-leaf-50">
            🔄 Zelfde rotation
          </Link>
        )}
        {joined && <span className="ml-auto pr-3 text-xs font-bold text-leaf-700/70">🔄 Jij zat erbij</span>}
      </footer>
    </article>
  )
}
