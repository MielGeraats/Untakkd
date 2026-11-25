import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CameraIcon, XIcon } from '../components/Icons'
import { PeoplePicker, type PersonPick } from '../components/PeoplePicker'
import { StarInput } from '../components/Stars'
import { StrainPicker } from '../components/StrainPicker'
import { useMe } from '../lib/auth'
import { METHODS } from '../lib/constants'
import { splitFriendships, useFriendships } from '../lib/friends'
import { resizeImage } from '../lib/image'
import { CHECKIN_SELECT, normalizeCheckin } from '../lib/queries'
import { computeBadges, computeStats } from '../lib/stats'
import { supabase } from '../lib/supabase'
import type { Method, Strain } from '../lib/types'

const uniq = (xs: (string | null)[]) => {
  const seen = new Map<string, string>()
  for (const x of xs) if (x?.trim() && !seen.has(x.trim().toLowerCase())) seen.set(x.trim().toLowerCase(), x.trim())
  return [...seen.values()]
}

export function NewCheckin() {
  const me = useMe()
  const navigate = useNavigate()
  const { rows } = useFriendships()
  const friends = useMemo(() => splitFriendships(rows, me.id).friends, [rows, me.id])

  const initialStrain = (useLocation().state as { strain?: Strain } | null)?.strain ?? null
  const [strain, setStrain] = useState<Strain | null>(initialStrain)
  const [method, setMethod] = useState<Method>('joint')
  const [rating, setRating] = useState(0)
  const [boughtAt, setBoughtAt] = useState('')
  const [smokedAt, setSmokedAt] = useState('')
  const [roller, setRoller] = useState<PersonPick[]>([])
  const [buddies, setBuddies] = useState<PersonPick[]>([])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [past, setPast] = useState<{ shops: string[]; spots: string[] }>({ shops: [], spots: [] })

  // Suggest places you've used before.
  useEffect(() => {
    supabase.from('checkins').select('bought_at, smoked_at').eq('user_id', me.id)
      .order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => setPast({ shops: uniq((data ?? []).map((d) => d.bought_at)), spots: uniq((data ?? []).map((d) => d.smoked_at)) }))
  }, [me.id])

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const rolls = method !== 'edible' && method !== 'vape'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!strain) return setError('Kies eerst even een strain, maatje.')
    if (!rating) return setError('Geef ’m wel een cijfer (tik op de sterren).')
    setBusy(true)
    setError('')
    try {
      let photo_path: string | null = null
      if (photo) {
        const blob = await resizeImage(photo)
        photo_path = `${me.id}/${crypto.randomUUID()}.jpg`
        const { error } = await supabase.storage.from('photos').upload(photo_path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
      }

      const { data: created, error } = await supabase.from('checkins').insert({
        strain_id: strain.id, method, rating,
        bought_at: boughtAt.trim() || null, smoked_at: smokedAt.trim() || null,
        notes: notes.trim() || null, photo_path,
      }).select('id').single()
      if (error) throw error

      const toRow = (role: 'roller' | 'buddy') => (p: PersonPick) =>
        ({ checkin_id: created.id, role, user_id: p.user?.id ?? null, name: p.user ? null : p.name })
      const people = [...(rolls ? roller.map(toRow('roller')) : []), ...buddies.map(toRow('buddy'))]
      if (people.length) {
        const { error } = await supabase.from('checkin_people').insert(people)
        if (error) throw error
      }

      // Work out which badges this check-in unlocked.
      const [{ data: mine }, { count }] = await Promise.all([
        supabase.from('checkins').select(CHECKIN_SELECT).eq('user_id', me.id),
        supabase.from('checkin_people').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('role', 'roller'),
      ])
      const all = (mine ?? []).map(normalizeCheckin)
      const selfRolled = rolls && roller.some((p) => p.user?.id === me.id) ? 1 : 0
      const before = computeBadges(computeStats(all.filter((c) => c.id !== created.id), (count ?? 0) - selfRolled))
      const after = computeBadges(computeStats(all, count ?? 0))
      const unlocked = after.filter((b) => b.earned && !before.find((x) => x.id === b.id)?.earned)

      navigate(`/checkin/${created.id}`, { replace: true, state: { unlocked } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Neem een pof en probeer het opnieuw.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="page-title">Nieuwe check-in</h1>

      <section>
        <label className="label">Wat rook je?</label>
        <StrainPicker value={strain} onChange={setStrain} />
      </section>

      <section>
        <label className="label">Hoe?</label>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button key={m.id} type="button" onClick={() => setMethod(m.id)}
              className={`chip ${method === m.id ? 'chip-on' : 'chip-off'}`}>
              <span aria-hidden>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <label className="label">Jouw cijfer</label>
        <StarInput value={rating} onChange={setRating} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="smoked">📍 Waar zit je?</label>
          <input id="smoked" className="input" list="spots" maxLength={80} placeholder="Vondelpark, het balkon, de kroeg…"
            value={smokedAt} onChange={(e) => setSmokedAt(e.target.value)} />
          <datalist id="spots">{past.spots.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor="bought">🛒 Waar heb je het gescoord?</label>
          <input id="bought" className="input" list="shops" maxLength={80} placeholder="Coffeeshop, een maat…"
            value={boughtAt} onChange={(e) => setBoughtAt(e.target.value)} />
          <datalist id="shops">{past.shops.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
      </section>

      {rolls && (
        <section>
          <label className="label">🌀 Wie heeft gedraaid?</label>
          <PeoplePicker friends={friends} me={me} value={roller} onChange={setRoller} max={1}
            placeholder="Ik, een maat, of typ een naam" />
        </section>
      )}

      <section>
        <label className="label">👥 Met wie zit je?</label>
        <PeoplePicker friends={friends} value={buddies} onChange={setBuddies}
          placeholder="Tag maten of typ namen" />
        <p className="mt-1 text-xs text-leaf-800/50">Getagde maten zien deze check-in ook.</p>
      </section>

      <section>
        <label className="label" htmlFor="notes">Notities <span className="font-semibold text-leaf-800/40">(optioneel)</span></label>
        <textarea id="notes" className="input min-h-24" maxLength={500} placeholder="Smaak, vibe, hoe gaar ben je…"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      <section>
        {preview ? (
          <div className="relative overflow-hidden rounded-3xl">
            <img src={preview} alt="Gekozen foto" className="max-h-80 w-full object-cover" />
            <button type="button" onClick={() => setPhoto(null)} aria-label="Foto weghalen"
              className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow"><XIcon className="size-5" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-leaf-300 bg-white/60 py-6 font-bold text-leaf-700 hover:bg-white">
            <CameraIcon className="size-6" /> Foto toevoegen
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </section>

      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      <button className="btn btn-primary w-full py-4 text-lg" disabled={busy}>
        {busy ? 'Inchecken…' : 'Inchecken 🌿'}
      </button>
    </form>
  )
}
