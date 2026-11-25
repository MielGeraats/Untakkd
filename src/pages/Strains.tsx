import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SearchIcon } from '../components/Icons'
import { Empty, Spinner } from '../components/Spinner'
import { Stars } from '../components/Stars'
import { StrainTypePill } from '../components/StrainTypePill'
import { supabase } from '../lib/supabase'
import type { Strain } from '../lib/types'

type Row = Strain & { count: number; avg: number }
type Sort = 'top' | 'popular' | 'az'

export function Strains() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('top')

  useEffect(() => {
    Promise.all([supabase.from('strains').select('*'), supabase.rpc('strain_stats')]).then(([s, st]) => {
      const stats = new Map<number, { checkin_count: number; avg_rating: number }>(
        (st.data ?? []).map((x: { strain_id: number; checkin_count: number; avg_rating: number }) => [x.strain_id, x]),
      )
      setRows((s.data ?? []).map((x) => ({ ...x, count: Number(stats.get(x.id)?.checkin_count ?? 0), avg: Number(stats.get(x.id)?.avg_rating ?? 0) })))
    })
  }, [])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const filtered = (rows ?? []).filter((r) => r.name.toLowerCase().includes(term))
    const cmp: Record<Sort, (a: Row, b: Row) => number> = {
      top: (a, b) => b.avg - a.avg || b.count - a.count,
      popular: (a, b) => b.count - a.count || b.avg - a.avg,
      az: (a, b) => a.name.localeCompare(b.name),
    }
    return filtered.sort(cmp[sort])
  }, [rows, q, sort])

  return (
    <div>
      <h1 className="page-title">Strains</h1>
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-leaf-500" />
        <input className="input pl-11" placeholder="Zoek strains" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-4 flex gap-2">
        {([['top', 'Hoogste cijfer'], ['popular', 'Meest gerookt'], ['az', 'A–Z']] as [Sort, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`chip ${sort === k ? 'chip-on' : 'chip-off'}`}>{l}</button>
        ))}
      </div>

      {!rows ? <Spinner /> : list.length === 0 ? (
        <Empty emoji="🌿" title={rows.length ? 'Niks gevonden' : 'Nog geen strains'}>
          {rows.length ? 'Probeer een andere naam.' : 'Strains komen erbij zodra iemand incheckt.'}
        </Empty>
      ) : (
        <ul className="card divide-y divide-leaf-50 px-4">
          {list.map((s) => (
            <li key={s.id}>
              <Link to={`/strains/${s.id}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-extrabold">{s.name}</span><StrainTypePill type={s.type} /></div>
                  <p className="text-xs font-bold text-leaf-800/50">{s.count} check-in{s.count === 1 ? '' : 's'}</p>
                </div>
                {s.count > 0 && <><Stars value={s.avg} size={14} /><span className="w-8 text-right text-sm font-black text-leaf-700">{s.avg.toFixed(1)}</span></>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
