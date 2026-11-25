import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { CheckinCard } from '../components/CheckinCard'
import { FriendButton } from '../components/FriendButton'
import { Empty, Spinner } from '../components/Spinner'
import { Stars } from '../components/Stars'
import { useMe } from '../lib/auth'
import { methodInfo } from '../lib/constants'
import { relationTo, splitFriendships, useFriendships } from '../lib/friends'
import { CHECKIN_SELECT, normalizeCheckin } from '../lib/queries'
import { computeBadges, computeStats } from '../lib/stats'
import { supabase } from '../lib/supabase'
import type { Checkin, Profile } from '../lib/types'

type Tab = 'activity' | 'stats' | 'badges'
const TAB_LABELS: Record<Tab, string> = { activity: 'Activiteit', stats: 'Stats', badges: 'Badges' }

export function ProfilePage() {
  const { username } = useParams()
  const me = useMe()
  const { rows, reload } = useFriendships()
  const [user, setUser] = useState<Profile | null | undefined>(undefined)
  const [checkins, setCheckins] = useState<Checkin[] | null>(null)
  const [rolled, setRolled] = useState(0)
  const [tab, setTab] = useState<Tab>('activity')

  useEffect(() => {
    setUser(undefined)
    setCheckins(null)
    setTab('activity')
    supabase.from('profiles').select('*').eq('username', username ?? '').maybeSingle().then(({ data }) => setUser(data))
  }, [username])

  const relation = user ? relationTo(rows, me.id, user.id) : { kind: 'none' as const }
  const canSee = relation.kind === 'self' || relation.kind === 'friends'

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('checkins').select(CHECKIN_SELECT).eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('checkin_people').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'roller'),
    ]).then(([a, b]) => {
      setCheckins((a.data ?? []).map(normalizeCheckin))
      setRolled(b.count ?? 0)
    })
  }, [user, canSee])

  const myFriends = useMemo(() => splitFriendships(rows, me.id).friends.length, [rows, me.id])
  const friendCount = user?.id === me.id ? myFriends : null

  const stats = useMemo(() => (checkins ? computeStats(checkins, rolled) : null), [checkins, rolled])
  const badges = useMemo(() => (stats ? computeBadges(stats) : []), [stats])

  if (user === undefined) return <Spinner />
  if (user === null) return <Empty emoji="🤷" title="Hier woont niemand">Er is geen gebruiker die @{username} heet.</Empty>

  const earned = badges.filter((b) => b.earned)

  return (
    <div>
      <section className="card mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar profile={user} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight">{user.display_name || user.username}</h1>
            <p className="text-sm font-bold text-leaf-800/50">@{user.username}</p>
            <div className="mt-2">
              {relation.kind === 'self'
                ? <Link to="/settings" className="btn btn-soft btn-sm">Profiel bewerken</Link>
                : <FriendButton relation={relation} userId={user.id} onChange={reload} />}
            </div>
          </div>
        </div>
        {user.bio && <p className="mt-4 text-leaf-900/80">{user.bio}</p>}

        {canSee && stats && (
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              [stats.total, 'Check-ins'],
              [stats.uniqueStrains, 'Strains'],
              [stats.avgRating ? stats.avgRating.toFixed(1) : '–', 'Gem. cijfer'],
              [earned.length, 'Badges'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-leaf-50 py-2.5">
                <p className="text-xl font-black text-leaf-700">{v}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-leaf-800/50">{l}</p>
              </div>
            ))}
          </div>
        )}
        {friendCount !== null && (
          <Link to="/friends" className="mt-3 block text-center text-sm font-bold text-leaf-700">{friendCount} {friendCount === 1 ? 'maat' : 'maten'} →</Link>
        )}
      </section>

      {!canSee ? (
        <Empty emoji="🔒" title="Alleen voor maten">Word maten met {user.display_name || user.username} om check-ins, stats en badges te zien.</Empty>
      ) : !checkins || !stats ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex rounded-full bg-leaf-100 p-1">
            {(['activity', 'stats', 'badges'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-2 text-sm font-extrabold transition ${tab === t ? 'bg-white text-leaf-800 shadow-sm' : 'text-leaf-800/50'}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === 'activity' && (
            checkins.length === 0
              ? <Empty emoji="🌱" title="Nog geen check-ins" />
              : <div className="space-y-4">{checkins.map((c) => <CheckinCard key={c.id} c={c} />)}</div>
          )}

          {tab === 'stats' && <StatsView stats={stats} />}

          {tab === 'badges' && (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((b) => (
                <div key={b.id} className={`card p-4 ${b.earned ? '' : 'opacity-55'}`}>
                  <div className={`text-3xl ${b.earned ? '' : 'grayscale'}`}>{b.emoji}</div>
                  <p className="mt-1 font-black leading-tight">{b.name}</p>
                  <p className="text-xs text-leaf-800/60">{b.desc}</p>
                  {!b.earned && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-leaf-100">
                      <div className="h-full rounded-full bg-leaf-500" style={{ width: `${(b.current / b.target) * 100}%` }} />
                    </div>
                  )}
                  {!b.earned && b.target > 1 && <p className="mt-1 text-[11px] font-bold text-leaf-800/50">{b.current} / {b.target}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatsView({ stats }: { stats: ReturnType<typeof computeStats> }) {
  if (!stats.total) return <Empty emoji="📊" title="Nog geen stats">Check eerst een paar keer in. Huiswerk!</Empty>
  const top = (list: { label: string; count: number }[], fmt = (s: string) => s) =>
    list.length ? `${fmt(list[0].label)} (${list[0].count}×)` : '—'
  const maxMethod = Math.max(...stats.methods.map((m) => m.count))
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="mb-3 font-black">Best beoordeelde strains</h3>
        <ol className="space-y-2">
          {stats.strains.slice(0, 5).map((s, i) => (
            <li key={s.id} className="flex items-center gap-3">
              <span className="w-5 text-center font-black text-leaf-500">{i + 1}</span>
              <Link to={`/strains/${s.id}`} className="min-w-0 flex-1 truncate font-bold hover:underline">{s.name}</Link>
              <Stars value={s.avg} size={14} />
              <span className="w-8 text-right text-sm font-black text-leaf-700">{s.avg.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ['📍', 'Favoriete plek', top(stats.spots)],
          ['🛒', 'Vaste shop', top(stats.shops)],
          ['🌀', 'Meestal gedraaid door', top(stats.rollers)],
          ['👥', 'Blowmaatje', top(stats.buddies)],
        ].map(([emoji, label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-leaf-800/50">{emoji} {label}</p>
            <p className="mt-1 font-black leading-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-black">Zo rook jij</h3>
        <div className="space-y-2">
          {stats.methods.map((m) => {
            const info = methodInfo(m.key as Checkin['method'])
            return (
              <div key={m.key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 font-bold">{info.emoji} {info.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-leaf-100">
                  <div className="h-full rounded-full bg-leaf-500" style={{ width: `${(m.count / maxMethod) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-black text-leaf-700">{m.count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card p-4 text-sm">
        <p>🌀 <b>{stats.rolledCount}</b> keer de draaier geweest</p>
        <p>⭐ <b>{stats.fiveStars}</b> keer de volle 5 sterren uitgedeeld</p>
      </div>
    </div>
  )
}
