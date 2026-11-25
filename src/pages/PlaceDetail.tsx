import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { CheckinCard } from '../components/CheckinCard'
import { Empty, Spinner } from '../components/Spinner'
import { Stars } from '../components/Stars'
import { methodInfo } from '../lib/constants'
import { PLACE_KINDS, placeUrl, type PlaceKind } from '../lib/places'
import { CHECKIN_SELECT, normalizeCheckin, withSessions } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { Checkin, Profile } from '../lib/types'

// "ilike" without wildcards = case-insensitive exact match; escape the wildcard characters.
const exact = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m)

export function PlaceDetail({ kind }: { kind: PlaceKind }) {
  const name = (useParams().name ?? '').trim()
  const info = PLACE_KINDS[kind]
  const other: PlaceKind = kind === 'spot' ? 'shop' : 'spot'
  const [checkins, setCheckins] = useState<Checkin[] | null>(null)

  useEffect(() => {
    let stale = false
    setCheckins(null)
    // Row-level security limits this to your own, your friends' and tagged check-ins.
    supabase.from('checkins').select(CHECKIN_SELECT).ilike(info.column, exact(name))
      .order('created_at', { ascending: false }).limit(300)
      .then(async ({ data }) => {
        const list = await withSessions((data ?? []).map(normalizeCheckin))
        if (!stale) setCheckins(list)
      })
    return () => { stale = true }
  }, [info.column, name])

  const s = useMemo(() => {
    if (!checkins?.length) return null
    const tally = <T,>(key: (c: Checkin) => string | null, pick: (c: Checkin) => T) => {
      const m = new Map<string, { item: T; n: number; ratings: number[] }>()
      for (const c of checkins) {
        const k = key(c)
        if (!k) continue
        const cur = m.get(k) ?? { item: pick(c), n: 0, ratings: [] }
        cur.n++
        cur.ratings.push(c.rating)
        m.set(k, cur)
      }
      return [...m.values()].map((x) => ({ ...x, avg: x.ratings.reduce((a, b) => a + b, 0) / x.ratings.length }))
    }
    const strains = tally((c) => String(c.strain_id), (c) => c.strain)
    const regulars = tally((c) => c.user_id, (c) => c.profile as Profile).sort((a, b) => b.n - a.n)
    const methods = tally((c) => c.method, (c) => c.method).sort((a, b) => b.n - a.n)
    const others = tally((c) => c[PLACE_KINDS[other].column]?.trim().toLowerCase() || null, (c) => c[PLACE_KINDS[other].column]!.trim())
      .sort((a, b) => b.n - a.n)
    return {
      count: checkins.length,
      avg: checkins.reduce((a, c) => a + c.rating, 0) / checkins.length,
      people: regulars.length,
      mostSmoked: [...strains].sort((a, b) => b.n - a.n || b.avg - a.avg).slice(0, 5),
      bestRated: [...strains].sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 5),
      regulars: regulars.slice(0, 5),
      method: methods[0],
      other: others[0],
    }
  }, [checkins, other])

  if (!checkins) return <Spinner />
  if (!s) return <Empty emoji="🤷" title={`Niks gevonden voor “${name}”`}>Jij en je maten hebben hier nog niet ingecheckt.</Empty>

  return (
    <div className="space-y-4">
      <section className="card p-5 text-center">
        <p className="text-xs font-extrabold uppercase tracking-wide text-leaf-800/50">{info.emoji} {info.label}</p>
        <h1 className="mt-1 text-3xl font-black">{name}</h1>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Stars value={s.avg} size={24} />
          <span className="text-xl font-black text-leaf-700">{s.avg.toFixed(2)}</span>
        </div>
        <p className="mt-1 text-sm font-bold text-leaf-800/50">
          {s.count} check-in{s.count === 1 ? '' : 's'} door {s.people} {s.people === 1 ? 'persoon' : 'mensen'} uit je crew
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-leaf-800/50">{methodInfo(s.method.item).emoji} Favoriete methode</p>
          <p className="mt-1 font-black leading-tight">{methodInfo(s.method.item).label} ({s.method.n}×)</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-leaf-800/50">
            {PLACE_KINDS[other].emoji} {kind === 'spot' ? 'Meestal gescoord bij' : 'Meestal gerookt bij'}
          </p>
          <p className="mt-1 font-black leading-tight">
            {s.other ? <Link to={placeUrl(other, s.other.item)} className="hover:underline">{s.other.item} ({s.other.n}×)</Link> : '—'}
          </p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-black">🏆 Vaste gasten</h2>
        <ol className="space-y-2">
          {s.regulars.map((r, i) => (
            <li key={r.item.id} className="flex items-center gap-3">
              <span className="w-5 text-center font-black text-leaf-500">{i + 1}</span>
              <Link to={`/u/${r.item.username}`} className="flex min-w-0 flex-1 items-center gap-2 font-bold hover:underline">
                <Avatar profile={r.item} size="xs" /> <span className="truncate">{r.item.display_name || r.item.username}</span>
              </Link>
              <span className="text-sm font-black text-leaf-700">{r.n}×</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([['🔥 Meest gerookt hier', s.mostSmoked], ['⭐ Best beoordeeld hier', s.bestRated]] as const).map(([title, list]) => (
          <div key={title} className="card p-4">
            <h2 className="mb-3 font-black">{title}</h2>
            <ol className="space-y-2">
              {list.map((x) => (
                <li key={x.item.id} className="flex items-center gap-2">
                  <Link to={`/strains/${x.item.id}`} className="min-w-0 flex-1 truncate font-bold hover:underline">{x.item.name}</Link>
                  <span className="text-xs font-bold text-leaf-800/50">{x.n}×</span>
                  <span className="w-8 text-right text-sm font-black text-leaf-700">{x.avg.toFixed(1)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <h2 className="font-black">Check-ins hier</h2>
      {checkins.map((c) => <CheckinCard key={c.id} c={c} />)}
    </div>
  )
}
