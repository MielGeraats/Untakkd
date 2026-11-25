import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckinCard } from '../components/CheckinCard'
import { Empty, Spinner } from '../components/Spinner'
import { Stars } from '../components/Stars'
import { StrainTypePill } from '../components/StrainTypePill'
import { CHECKIN_SELECT, normalizeCheckin } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { Checkin, Strain } from '../lib/types'

export function StrainDetail() {
  const id = Number(useParams().id)
  const [strain, setStrain] = useState<Strain | null | undefined>(undefined)
  const [stats, setStats] = useState({ count: 0, avg: 0 })
  const [checkins, setCheckins] = useState<Checkin[]>([])

  useEffect(() => {
    supabase.from('strains').select('*').eq('id', id).maybeSingle().then(({ data }) => setStrain(data))
    supabase.rpc('strain_stats').then(({ data }) => {
      const s = (data ?? []).find((x: { strain_id: number }) => x.strain_id === id)
      setStats({ count: Number(s?.checkin_count ?? 0), avg: Number(s?.avg_rating ?? 0) })
    })
    supabase.from('checkins').select(CHECKIN_SELECT).eq('strain_id', id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setCheckins((data ?? []).map(normalizeCheckin)))
  }, [id])

  if (strain === undefined) return <Spinner />
  if (strain === null) return <Empty emoji="🤷" title="Strain niet gevonden. Weggerookt?" />

  return (
    <div className="space-y-4">
      <section className="card p-5 text-center">
        <div className="mb-2 flex justify-center"><StrainTypePill type={strain.type} /></div>
        <h1 className="text-3xl font-black">{strain.name}</h1>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Stars value={stats.avg} size={24} />
          <span className="text-xl font-black text-leaf-700">{stats.count ? stats.avg.toFixed(2) : '–'}</span>
        </div>
        <p className="mt-1 text-sm font-bold text-leaf-800/50">
          {stats.count} check-in{stats.count === 1 ? '' : 's'} van iedereen op Untakkd
        </p>
        <Link to="/checkin/new" state={{ strain }} className="btn btn-primary btn-sm mt-4">🌿 Deze strain inchecken</Link>
      </section>

      <h2 className="font-black">Van jou & je maten</h2>
      {checkins.length === 0
        ? <Empty emoji="🌱" title="Nog niemand uit je crew heeft deze geprobeerd. Wie durft?" />
        : checkins.map((c) => <CheckinCard key={c.id} c={c} />)}
    </div>
  )
}
