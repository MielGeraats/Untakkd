import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { BugNote, ErrorBox } from '../components/BugNote'
import { CheckinCard } from '../components/CheckinCard'
import { FriendButton } from '../components/FriendButton'
import { ChevronLeft } from '../components/Icons'
import { Empty, Spinner } from '../components/Spinner'
import { Stars } from '../components/Stars'
import { useMe } from '../lib/auth'
import { methodInfo } from '../lib/constants'
import { canSeeBaapring, fetchCareers, type Career } from '../lib/baapring'
import { placeUrl } from '../lib/places'
import { getRolledCount } from '../lib/rolls'
import { relationTo, splitFriendships, useFriendships } from '../lib/friends'
import { CHECKIN_SELECT, normalizeCheckin, withSessions } from '../lib/queries'
import { computeBadges, computeStats, specialBadges, type Badge } from '../lib/stats'
import { supabase } from '../lib/supabase'
import type { Checkin, Profile } from '../lib/types'

type Tab = 'activity' | 'stats' | 'badges' | 'friends'
const TAB_LABELS: Record<Tab, string> = { activity: 'Activiteit', stats: 'Stats', badges: 'Badges', friends: 'Maten' }

export function ProfilePage() {
  const { username } = useParams()
  const me = useMe()
  const { rows, reload } = useFriendships()
  const [user, setUser] = useState<Profile | null | undefined>(undefined)
  const [checkins, setCheckins] = useState<Checkin[] | null>(null) // full check-ins, friends only
  const [statsData, setStatsData] = useState<Checkin[] | null>(null) // public, just what the stats need
  const [rolled, setRolled] = useState(0)
  const [career, setCareer] = useState<Career | null>(null)
  const [tab, setTab] = useState<Tab>('activity')

  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    let stale = false
    setUser(undefined)
    setCheckins(null)
    setStatsData(null)
    setStatsError('')
    setTab('activity')
    supabase.from('profiles').select('*').eq('username', username ?? '').maybeSingle().then(({ data }) => { if (!stale) setUser(data) })
    return () => { stale = true }
  }, [username])

  const relation = user ? relationTo(rows, me.id, user.id) : { kind: 'none' as const }
  const canSee = relation.kind === 'self' || relation.kind === 'friends'

  // Stats and badges are public.
  // (`stale` drops answers that arrive after you've already switched to another profile.)
  useEffect(() => {
    if (!user) return
    let stale = false
    Promise.all([
      supabase.rpc('profile_stats_data', { uid: user.id }),
      getRolledCount(user.id),
      canSeeBaapring(me) ? fetchCareers([user.id]).catch(() => new Map<string, Career>()) : Promise.resolve(new Map<string, Career>()), // De Baapring
    ]).then(([a, b, c]) => {
      if (stale) return
      if (a.error) setStatsError(a.error.message)
      setStatsData(((a.data ?? []) as unknown[]).map(normalizeCheckin))
      setRolled(b)
      setCareer(c.get(user.id) ?? null)
    })
    return () => { stale = true }
  }, [user])

  // The check-ins themselves are for friends only.
  useEffect(() => {
    if (!user || !canSee) return
    let stale = false
    supabase.from('checkins').select(CHECKIN_SELECT).eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)
      .then(async ({ data }) => {
        const list = await withSessions((data ?? []).map(normalizeCheckin))
        if (!stale) setCheckins(list)
      })
    return () => { stale = true }
  }, [user, canSee])

  const myFriends = useMemo(() => splitFriendships(rows, me.id).friends.length, [rows, me.id])
  const friendCount = user?.id === me.id ? myFriends : null

  // When you can see the full check-ins (your own profile or a friend's), count from those, so the
  // stats always match the Activiteit tab. Everyone else gets the public stats.
  const source = canSee && checkins ? checkins : statsData
  const stats = useMemo(() => (source ? computeStats(source, rolled, career ?? undefined) : null), [source, rolled, career])
  const special = useMemo(() => specialBadges(user?.special_badges), [user])
  const badges = useMemo(() => {
    const list = (stats ? computeBadges(stats) : []).filter((b) => canSeeBaapring(me) || !b.id.startsWith('ring-'))
    // earned first (highest level first), then the ones you're closest to
    const progress = (b: Badge) => (b.next ? (b.current - b.from) / (b.next - b.from) : 1)
    const sorted = [...list].sort((a, b) => Number(b.earned) - Number(a.earned) || b.level - a.level || progress(b) - progress(a))
    return [...special, ...sorted]
  }, [stats, special, me])

  if (user === undefined) return <Spinner />
  if (user === null) return <Empty emoji="🤷" title="Hier woont niemand">Er is geen gebruiker die @{username} heet.</Empty>

  const earned = badges.filter((b) => b.earned)
  const tabs: Tab[] = canSee ? ['activity', 'stats', 'badges', 'friends'] : ['stats', 'badges']
  const shownTab = tabs.includes(tab) ? tab : tabs[0]

  return (
    <div>
      <section className="card mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar profile={user} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight">{user.display_name || user.username}</h1>
            <p className="text-sm font-bold text-leaf-800/50">
              @{user.username}
              {special.map((b) => <span key={b.id} title={b.name} className="ml-1.5">{b.emoji}</span>)}
            </p>
            <div className="mt-2">
              {relation.kind === 'self'
                ? <Link to="/settings" className="btn btn-soft btn-sm">Profiel bewerken</Link>
                : <FriendButton relation={relation} userId={user.id} onChange={reload} />}
            </div>
          </div>
        </div>
        {user.bio && <p className="mt-4 text-leaf-900/80">{user.bio}</p>}

        {stats && (
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

      {!stats || (canSee && !checkins) ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex rounded-full bg-leaf-100 p-1">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-2 text-sm font-extrabold transition ${shownTab === t ? 'bg-white text-leaf-800 shadow-sm' : 'text-leaf-800/50'}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {!canSee && (
            <p className="mb-4 text-center text-sm text-leaf-800/60">🔒 Check-ins en maten zie je pas als jullie maten zijn.</p>
          )}
          {!canSee && statsError && (
            <ErrorBox className="mb-4 text-xs">Stats laden lukt niet: {statsError}</ErrorBox>
          )}

          {shownTab === 'activity' && checkins && (
            checkins.length === 0
              ? <Empty emoji="🌱" title="Nog geen check-ins" />
              : <div className="space-y-4">{checkins.map((c) => <CheckinCard key={c.id} c={c} />)}</div>
          )}

          {shownTab === 'stats' && <>{career && <RingCard c={career} />}<StatsView stats={stats} /></>}

          {shownTab === 'friends' && <FriendsOf user={user} isMe={relation.kind === 'self'} />}

          {shownTab === 'badges' && (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((b) => <BadgeCard key={b.id} b={b} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

type StatRow = { key: string; label: ReactNode; value: ReactNode; share?: number }

/** One stat: shows your number one, tap the arrow to see the full ranking. */
function ExpandStat({ emoji, title, rows, empty = 'Nog niks' }: { emoji: string; title: string; rows: StatRow[]; empty?: string }) {
  const [open, setOpen] = useState(false)
  const more = rows.length > 1
  return (
    <div className="card p-4">
      <button type="button" disabled={!more} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left disabled:cursor-default" aria-expanded={open}>
        <p className="flex-1 text-xs font-bold uppercase tracking-wide text-leaf-800/50">{emoji} {title}</p>
        {more && (
          <span className="flex items-center gap-1 text-xs font-bold text-leaf-700">
            {open ? 'Minder' : `Alle ${rows.length}`}
            <ChevronLeft className={`size-4 transition ${open ? 'rotate-90' : '-rotate-90'}`} />
          </span>
        )}
      </button>
      {rows.length === 0 ? (
        <p className="mt-1 font-black text-leaf-800/40">{empty}</p>
      ) : !open ? (
        <div className="mt-1 flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-lg font-black leading-tight">{rows[0].label}</p>
          <span className="shrink-0 text-sm font-black text-leaf-700">{rows[0].value}</span>
        </div>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className="text-sm">
              <div className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center font-black text-leaf-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{r.label}</span>
                <span className="shrink-0 font-black text-leaf-700">{r.value}</span>
              </div>
              {r.share !== undefined && (
                <div className="ml-8 mt-1 h-1.5 overflow-hidden rounded-full bg-leaf-100">
                  <div className="h-full rounded-full bg-leaf-500" style={{ width: `${r.share * 100}%` }} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function StatsView({ stats }: { stats: ReturnType<typeof computeStats> }) {
  if (!stats.total) return <Empty emoji="📊" title="Nog geen stats">Check eerst een paar keer in. Huiswerk!</Empty>

  const counted = (list: { key: string; label: string; count: number }[], link?: (label: string) => string): StatRow[] => {
    const max = Math.max(1, ...list.map((x) => x.count))
    return list.map((x) => ({
      key: x.key,
      label: link ? <Link to={link(x.label)} className="hover:underline">{x.label}</Link> : x.label,
      value: `${x.count}×`,
      share: x.count / max,
    }))
  }
  const strainLink = (s: { id: number; name: string }) => <Link to={`/strains/${s.id}`} className="hover:underline">{s.name}</Link>
  const bestRated: StatRow[] = stats.strains.map((s) => ({
    key: String(s.id), label: strainLink(s),
    value: <span className="inline-flex items-center gap-1.5"><Stars value={s.avg} size={12} />{s.avg.toFixed(1)}</span>,
  }))
  const maxStrain = Math.max(1, ...stats.strains.map((s) => s.count))
  const mostSmoked: StatRow[] = [...stats.strains].sort((a, b) => b.count - a.count || b.avg - a.avg)
    .map((s) => ({ key: String(s.id), label: strainLink(s), value: `${s.count}×`, share: s.count / maxStrain }))
  const maxMethod = Math.max(1, ...stats.methods.map((m) => m.count))
  const methods: StatRow[] = stats.methods.map((m) => {
    const info = methodInfo(m.key as Checkin['method'])
    return { key: m.key, label: `${info.emoji} ${info.label}`, value: `${m.count}×`, share: m.count / maxMethod }
  })

  return (
    <div className="space-y-3">
      <ExpandStat emoji="⭐" title="Best beoordeelde strain" rows={bestRated} />
      <ExpandStat emoji="🔥" title="Meest gerookte strain" rows={mostSmoked} />
      <ExpandStat emoji="🚬" title="Zo rook jij" rows={methods} />
      <ExpandStat emoji="📍" title="Favoriete plek" rows={counted(stats.spots, (l) => placeUrl('spot', l))} empty="Nog geen plekken" />
      <ExpandStat emoji="🛒" title="Vaste shop" rows={counted(stats.shops, (l) => placeUrl('shop', l))} empty="Nog geen shops" />
      <ExpandStat emoji="🌀" title="Meestal gedraaid door" rows={counted(stats.rollers)} empty="Nog niemand getagd" />
      <ExpandStat emoji="👥" title="Blowmaatje" rows={counted(stats.buddies)} empty="Nog niemand getagd" />

      <div className="card p-4 text-sm">
        <p>🌀 <b>{stats.rolledCount}</b> keer de draaier geweest</p>
        <p>⭐ <b>{stats.fiveStars}</b> keer de volle 5 sterren uitgedeeld</p>
      </div>
    </div>
  )
}

function FriendsOf({ user, isMe }: { user: Profile; isMe: boolean }) {
  const me = useMe()
  const { rows, reload } = useFriendships()
  const [list, setList] = useState<Profile[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setList(null)
    supabase.rpc('friends_of', { uid: user.id }).then(({ data, error }) => {
      if (error) setError(error.message)
      setList((data ?? []) as Profile[])
    })
  }, [user.id])

  if (error) return <Empty emoji="🛠️" title="Maten laden lukt niet">{error}<BugNote className="mt-2" /></Empty>
  if (!list) return <Spinner />
  const name = user.display_name?.split(' ')[0] || user.username
  if (list.length === 0) {
    return <Empty emoji="🦗" title={isMe ? 'Je hebt nog geen maten' : `${name} heeft nog geen maten`}>Eenzaam blowen is ook maar niks.</Empty>
  }

  const newOnes = list.filter((p) => relationTo(rows, me.id, p.id).kind === 'none').length
  return (
    <section className="card px-4 py-2">
      {!isMe && newOnes > 0 && (
        <p className="py-2 text-sm text-leaf-800/60">
          {newOnes} {newOnes === 1 ? 'maat' : 'maten'} van {name} ken je nog niet op Untakkd. Hup, toevoegen!
        </p>
      )}
      <ul className="divide-y divide-leaf-50">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <Link to={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar profile={p} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-extrabold">{p.id === me.id ? 'Jij 😎' : p.display_name || p.username}</span>
                <span className="block truncate text-xs font-bold text-leaf-800/50">@{p.username}</span>
              </span>
            </Link>
            <FriendButton relation={relationTo(rows, me.id, p.id)} userId={p.id} onChange={reload} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BadgeCard({ b }: { b: Badge }) {
  const pct = b.next ? ((b.current - b.from) / (b.next - b.from)) * 100 : 100
  const maxed = b.earned && !b.next
  return (
    <div className={`card relative p-4 ${b.special ? 'border-amber-300 bg-gradient-to-br from-amber-100 to-white' : b.earned ? '' : 'opacity-55'}`}>
      {b.earned && b.maxLevel > 1 && (
        <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-black ${maxed ? 'bg-amber-400 text-white' : 'bg-leaf-600 text-white'}`}>
          {maxed ? 'MAX 👑' : `LVL ${b.level}`}
        </span>
      )}
      {b.special && <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-white">UNIEK</span>}
      <div className={`text-3xl ${b.earned ? '' : 'grayscale'}`}>{b.emoji}</div>
      <p className="mt-1 font-black leading-tight">{b.name}</p>
      <p className="text-xs text-leaf-800/60">{b.desc}</p>
      {!b.special && !maxed && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-leaf-100">
            <div className="h-full rounded-full bg-leaf-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-bold text-leaf-800/50">
            {b.current} / {b.next} {b.earned ? `→ Lvl ${b.level + 1}` : ''}
          </p>
        </>
      )}
    </div>
  )
}

/** De Baapring career on the profile. */
function RingCard({ c }: { c: Career }) {
  return (
    <Link to="/baapring" className="card mb-3 block border-amber-300 bg-gradient-to-br from-amber-50 to-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-black">💍 De Baapring</p>
        <p className="text-sm font-black text-amber-600">ELO {Math.round(c.elo)}</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-center">
        {[[c.games, 'potjes'], [c.poffen, 'poffen'], [c.bouncers, 'bouncers'], [c.palindromen, 'palindr.'], [c.jillas, 'jilla']].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-white/70 py-1.5">
            <p className="font-black text-leaf-700">{v}</p>
            <p className="text-[10px] font-bold uppercase text-leaf-800/50">{l}</p>
          </div>
        ))}
      </div>
    </Link>
  )
}
