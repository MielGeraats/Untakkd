import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { BaapringLogo } from '../components/BaapringLogo'
import { ErrorBox } from '../components/BugNote'
import { ChevronLeft } from '../components/Icons'
import { Empty, Spinner } from '../components/Spinner'
import { useMe } from '../lib/auth'
import { fetchCustomCategories, type CustomCategory } from '../lib/baapring'
import { supabase } from '../lib/supabase'

/** Your crew's own categories: everyone sees their own and their friends' questions. */
export function BaapringVragen() {
  const me = useMe()
  const admin = Boolean(me.special_badges?.includes('maker')) // the database checks this too
  const [list, setList] = useState<CustomCategory[] | null>(null)
  const [one, setOne] = useState('')
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = () => fetchCustomCategories().then(setList).catch((e) => { setError(e.message); setList([]) })
  useEffect(() => { load() }, [])

  async function add(texts: string[]) {
    const existing = new Set((list ?? []).map((c) => c.text.trim().toLowerCase()))
    const fresh = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length >= 2 && t.length <= 120))]
      .filter((t) => !existing.has(t.toLowerCase()))
    if (!fresh.length) return setDone('Niks nieuws om toe te voegen (al bekend of leeg).')
    setBusy(true)
    setError('')
    const { error } = await supabase.from('baapring_categories').insert(fresh.map((text) => ({ text })))
    setBusy(false)
    if (error) return setError(error.message)
    setDone(`${fresh.length} ${fresh.length === 1 ? 'vraag' : 'vragen'} toegevoegd 🎉`)
    setOne('')
    setBulk('')
    load()
  }

  async function remove(id: number) {
    await supabase.from('baapring_categories').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <Link to="/baapring" className="btn btn-ghost btn-sm -ml-3"><ChevronLeft className="size-5" /> Terug</Link>
      <section className="card p-5 text-center">
        <BaapringLogo size="sm" />
        <h1 className="mt-2 text-xl font-black">✍️ Eigen vragen</h1>
        <p className="text-sm text-leaf-800/60">Vragen die jij of je maten toevoegen, komen in jullie potjes.</p>
        {admin && <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">👑 Admin-modus: je ziet de vragen van iedereen en kunt alles verwijderen.</p>}
      </section>

      <section className="card space-y-3 p-4">
        <form onSubmit={(e) => { e.preventDefault(); add([one]) }} className="flex gap-2">
          <input className="input py-2.5" placeholder="Bijv. Iets wat Larry altijd zegt" maxLength={120} value={one} onChange={(e) => { setOne(e.target.value); setDone('') }} />
          <button className="btn btn-primary" disabled={busy || one.trim().length < 2}>＋</button>
        </form>
        <button type="button" onClick={() => setShowBulk((b) => !b)} className="text-sm font-bold text-leaf-700 underline">
          {showBulk ? 'Plakvak verbergen' : '📋 Veel vragen tegelijk plakken'}
        </button>
        {showBulk && (
          <div className="space-y-2">
            <textarea className="input min-h-40 text-sm" placeholder={'Eén vraag per regel\nIets wat je in de kroeg vergeet\nEen bijnaam van een huisgenoot'}
              value={bulk} onChange={(e) => { setBulk(e.target.value); setDone('') }} />
            <button type="button" className="btn btn-soft w-full" disabled={busy || !bulk.trim()} onClick={() => add(bulk.split('\n'))}>
              Alles toevoegen ({bulk.split('\n').filter((l) => l.trim()).length})
            </button>
          </div>
        )}
        {done && <p className="text-sm font-bold text-leaf-700">{done}</p>}
        {error && <ErrorBox>{error}</ErrorBox>}
      </section>

      {!list ? <Spinner /> : list.length === 0 ? (
        <Empty emoji="🗒️" title="Nog geen eigen vragen">Voeg er een paar toe, dan komen ze in jullie volgende potje.</Empty>
      ) : (
        <section className="card px-4 py-2">
          <p className="py-2 text-xs font-bold uppercase tracking-wide text-leaf-800/50">{list.length} vragen {admin ? 'van iedereen' : 'van jullie crew'}</p>
          <ul className="divide-y divide-leaf-50">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2 text-sm">
                <Avatar profile={c.profile} size="xs" />
                <span className="min-w-0 flex-1">
                  {c.text}
                  {admin && c.created_by !== me.id && <span className="block text-[11px] text-leaf-800/45">door {c.profile?.display_name || c.profile?.username || '?'}</span>}
                </span>
                {(c.created_by === me.id || admin) && (
                  <button type="button" onClick={() => (c.created_by === me.id || confirm(`Vraag van ${c.profile?.display_name || c.profile?.username} verwijderen?`)) && remove(c.id)}
                    className="text-xs font-bold text-leaf-800/40 hover:text-red-600">Weg</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
