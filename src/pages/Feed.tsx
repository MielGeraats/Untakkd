import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckinCard } from '../components/CheckinCard'
import { InstallHint } from '../components/InstallHint'
import { Empty, Spinner } from '../components/Spinner'
import { useMe } from '../lib/auth'
import { CHECKIN_SELECT, normalizeCheckin, withSessions } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { Checkin } from '../lib/types'

const PAGE = 15

export function Feed() {
  const me = useMe()
  const [items, setItems] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  // Row-level security already limits this to you, your friends, and check-ins you're tagged in.
  const load = useCallback(async (offset: number) => {
    const { data, error } = await supabase.from('checkins').select(CHECKIN_SELECT)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1)
    if (error) setError(error.message)
    const rows = await withSessions((data ?? []).map(normalizeCheckin))
    setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]))
    setMore(rows.length === PAGE)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(0)
  }, [load])

  return (
    <div>
      <InstallHint />
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Recente activiteit</h1>
          <p className="text-sm text-leaf-800/60">Heeey {me.display_name?.split(' ')[0] || me.username}, alles goed? Kijk wat je maten roken 👀</p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty emoji="🌱" title="Stil hier, zeg… 🦗">
          <p>Voeg wat maten toe of doe je eerste check-in. Als je dit leest: neem een pof.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/friends" className="btn btn-soft btn-sm">Maten zoeken</Link>
            <Link to="/checkin/new" className="btn btn-primary btn-sm">Inchecken</Link>
          </div>
        </Empty>
      ) : (
        <div className="space-y-4">
          {items.map((c) => <CheckinCard key={c.id} c={c} />)}
          {more && (
            <button className="btn btn-soft w-full" onClick={() => load(items.length)}>Meer laden</button>
          )}
        </div>
      )}
    </div>
  )
}
