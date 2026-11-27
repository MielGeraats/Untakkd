import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ErrorBox } from '../components/BugNote'
import { CameraIcon, XIcon } from '../components/Icons'
import { PeoplePicker, type PersonPick } from '../components/PeoplePicker'
import { PlaceInput, type PlaceOption } from '../components/PlaceInput'
import { StarInput } from '../components/Stars'
import { Spinner } from '../components/Spinner'
import { StrainPicker } from '../components/StrainPicker'
import { useMe } from '../lib/auth'
import { METHODS } from '../lib/constants'
import { splitFriendships, useFriendships } from '../lib/friends'
import { resizeImage } from '../lib/image'
import { CHECKIN_SELECT, normalizeCheckin, personKey, sessionKey } from '../lib/queries'
import { getRolledCount } from '../lib/rolls'
import { computeBadges, computeStats } from '../lib/stats'
import { photoUrl, supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import type { Checkin, CheckinPerson, Method, Profile, RollStyle, Strain } from '../lib/types'

/** Your own places first (most recent first), then your friends' places (most used first). */
function placeOptions(rows: { user_id: string; place: string | null }[], me: string): PlaceOption[] {
  const mine = new Map<string, string>()
  const theirs = new Map<string, { label: string; n: number }>()
  for (const r of rows) {
    const label = r.place?.trim()
    if (!label) continue
    const k = label.toLowerCase()
    if (r.user_id === me) { if (!mine.has(k)) mine.set(k, label) }
    else theirs.set(k, { label: theirs.get(k)?.label ?? label, n: (theirs.get(k)?.n ?? 0) + 1 })
  }
  return [
    ...[...mine.values()].map((label) => ({ label, mine: true })),
    ...[...theirs.entries()].filter(([k]) => !mine.has(k)).sort((a, b) => b[1].n - a[1].n).map(([, v]) => ({ label: v.label, mine: false })),
  ]
}

const pickKey = (p: PersonPick) => (p.user ? `u:${p.user.id}` : `n:${(p.name ?? '').trim().toLowerCase()}`)
const toPick = (p: CheckinPerson): PersonPick =>
  p.user_id ? { user: p.profile ?? ({ id: p.user_id, username: null, display_name: '?' } as Profile) } : { name: p.name ?? '' }

export function NewCheckin() {
  const me = useMe()
  const navigate = useNavigate()
  const editId = Number(useParams().id) || null
  const { rows, loading: friendsLoading } = useFriendships()
  const friends = useMemo(() => splitFriendships(rows, me.id).friends, [rows, me.id])

  const navState = useLocation().state as { strain?: Strain; join?: Checkin } | null
  const initialStrain = navState?.strain ?? null
  const [strain, setStrain] = useState<Strain | null>(initialStrain)
  const [method, setMethod] = useState<Method>('joint')
  const [rating, setRating] = useState(0)
  const [boughtAt, setBoughtAt] = useState('')
  const [smokedAt, setSmokedAt] = useState('')
  const [roller, setRoller] = useState<PersonPick[]>([])
  const [rollStyle, setRollStyle] = useState<RollStyle>('normaal')
  const [buddies, setBuddies] = useState<PersonPick[]>([])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [keptPhoto, setKeptPhoto] = useState<string | null>(null) // existing photo when editing
  const [original, setOriginal] = useState<{ people: CheckinPerson[]; photo: string | null } | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId))
  const [join, setJoin] = useState<Checkin | null>(null)
  const [recent, setRecent] = useState<Checkin[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bugError, setBugError] = useState(false) // false for "pick a strain first"-type hints
  const [past, setPast] = useState<{ shops: PlaceOption[]; spots: PlaceOption[] }>({ shops: [], spots: [] })

  // Suggest places you used before, plus places your friends use (row-level security limits this to check-ins you can see).
  useEffect(() => {
    supabase.from('checkins').select('user_id, bought_at, smoked_at')
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        const rows = data ?? []
        setPast({
          shops: placeOptions(rows.map((d) => ({ user_id: d.user_id, place: d.bought_at })), me.id),
          spots: placeOptions(rows.map((d) => ({ user_id: d.user_id, place: d.smoked_at })), me.id),
        })
      })
  }, [me.id])

  // Editing: load the check-in and fill in the form.
  useEffect(() => {
    if (!editId) return
    supabase.from('checkins').select(CHECKIN_SELECT).eq('id', editId).maybeSingle().then(({ data }) => {
      const c = data ? normalizeCheckin(data) : null
      if (!c || c.user_id !== me.id) return navigate(`/checkin/${editId}`, { replace: true })
      setStrain(c.strain)
      setMethod(c.method)
      setRating(c.rating)
      setBoughtAt(c.bought_at ?? '')
      setSmokedAt(c.smoked_at ?? '')
      setNotes(c.notes ?? '')
      setRoller(c.people.filter((p) => p.role === 'roller').map(toPick))
      setRollStyle(c.roll_style ?? 'normaal')
      setBuddies(c.people.filter((p) => p.role === 'buddy').map(toPick))
      setKeptPhoto(c.photo_path)
      setOriginal({ people: c.people, photo: c.photo_path })
      setLoadingEdit(false)
    })
  }, [editId, me.id, navigate])

  // Friends' check-ins from the last 3 hours, one per session, to join.
  useEffect(() => {
    if (editId) return
    const since = new Date(Date.now() - 3 * 3600_000).toISOString()
    supabase.from('checkins').select(CHECKIN_SELECT).neq('user_id', me.id).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        const seen = new Set<number>()
        setRecent((data ?? []).map(normalizeCheckin).filter((c) => !seen.has(sessionKey(c)) && seen.add(sessionKey(c))).slice(0, 4))
      })
  }, [editId, me.id])

  // Joining copies the session's details. People you're not friends with become plain names,
  // because you can only tag your own friends.
  const joinSession = useCallback((c: Checkin) => {
    const friendIds = new Set(friends.map((f) => f.id))
    const asPick = (uid: string | null, profile: Profile | null, name: string | null): PersonPick | null => {
      if (uid === me.id) return { user: me }
      if (uid && profile && friendIds.has(uid)) return { user: profile }
      const label = profile ? profile.display_name || profile.username : name
      return label ? { name: label.slice(0, 40) } : null
    }
    const picks = (xs: (PersonPick | null)[]) => xs.filter((x): x is PersonPick => x !== null)
    setJoin(c)
    setStrain(c.strain)
    setMethod(c.method)
    setSmokedAt(c.smoked_at ?? '')
    setBoughtAt(c.bought_at ?? '')
    setRoller(picks(c.people.filter((p) => p.role === 'roller').map((p) => asPick(p.user_id, p.profile, p.name))))
    setRollStyle(c.roll_style ?? 'normaal')
    setBuddies(picks([
      asPick(c.user_id, c.profile, null),
      ...c.people.filter((p) => p.role === 'buddy' && p.user_id !== me.id).map((p) => asPick(p.user_id, p.profile, p.name)),
    ]))
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [friends, me])

  // Came here via "Ik zat erbij" on someone's check-in.
  useEffect(() => {
    if (navState?.join && !friendsLoading && !join) joinSession(navState.join)
  }, [navState, friendsLoading, join, joinSession])

  const newPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => { if (newPreview) URL.revokeObjectURL(newPreview) }, [newPreview])
  const preview = newPreview ?? (keptPhoto ? photoUrl(keptPhoto) : null)

  // Nobody rolled a voorie (pre-roll), a vape or an edible.
  const rolls = !['edible', 'gummy', 'vape', 'voorie'].includes(method)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBugError(false)
    if (!strain) return setError('Kies eerst even een strain, maatje.')
    if (!rating) return setError('Geef ’m wel een cijfer (tik op de sterren).')
    setBusy(true)
    setError('')
    try {
      let photo_path: string | null = keptPhoto
      if (photo) {
        const blob = await resizeImage(photo)
        photo_path = `${me.id}/${crypto.randomUUID()}.jpg`
        const { error } = await supabase.storage.from('photos').upload(photo_path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
      }

      if (editId && original) {
        const { error } = await supabase.from('checkins').update({
          strain_id: strain.id, method, rating,
          bought_at: boughtAt.trim() || null, smoked_at: smokedAt.trim() || null,
          notes: notes.trim() || null, photo_path,
          roll_style: rolls && roller.length ? rollStyle : null,
        }).eq('id', editId)
        if (error) throw error

        // Only add new tags and remove dropped ones; untouched tags stay as they are.
        const wanted = [...(rolls ? roller.map((p) => ({ role: 'roller' as const, p })) : []), ...buddies.map((p) => ({ role: 'buddy' as const, p }))]
        const wantedKeys = new Set(wanted.map((w) => `${w.role}|${pickKey(w.p)}`))
        const haveKeys = new Set(original.people.map((x) => `${x.role}|${personKey(x)}`))
        const toAdd = wanted.filter((w) => !haveKeys.has(`${w.role}|${pickKey(w.p)}`))
          .map((w) => ({ checkin_id: editId, role: w.role, user_id: w.p.user?.id ?? null, name: w.p.user ? null : w.p.name }))
        const toRemove = original.people.filter((x) => !wantedKeys.has(`${x.role}|${personKey(x)}`)).map((x) => x.id)
        if (toAdd.length) {
          const { error } = await supabase.from('checkin_people').insert(toAdd)
          if (error) throw error
        }
        if (toRemove.length) {
          const { error } = await supabase.from('checkin_people').delete().in('id', toRemove)
          if (error) throw error
        }
        if (original.photo && original.photo !== photo_path) await supabase.storage.from('photos').remove([original.photo])
        return navigate(`/checkin/${editId}`, { replace: true })
      }

      const [rolledBefore, isoBefore] = await Promise.all([getRolledCount(me.id), getRolledCount(me.id, true)])

      const { data: created, error } = await supabase.from('checkins').insert({
        strain_id: strain.id, method, rating,
        bought_at: boughtAt.trim() || null, smoked_at: smokedAt.trim() || null,
        notes: notes.trim() || null, photo_path,
        roll_style: rolls && roller.length ? rollStyle : null,
        session_of: join ? sessionKey(join) : null,
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
      const [{ data: mine }, rolledAfter, isoAfter] = await Promise.all([
        supabase.from('checkins').select(CHECKIN_SELECT).eq('user_id', me.id),
        getRolledCount(me.id),
        getRolledCount(me.id, true),
      ])
      const all = (mine ?? []).map(normalizeCheckin)
      const before = computeBadges(computeStats(all.filter((c) => c.id !== created.id), rolledBefore, undefined, isoBefore))
      const after = computeBadges(computeStats(all, rolledAfter, undefined, isoAfter))
      // New badges and level-ups.
      const unlocked = after.filter((b) => b.level > (before.find((x) => x.id === b.id)?.level ?? 0))

      navigate(`/checkin/${created.id}`, { replace: true, state: { unlocked } })
    } catch (err) {
      // Supabase errors are plain objects with a message, not Error instances, so check for both.
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
      setBugError(true)
      setError(msg ? `Er ging iets mis: ${msg}` : 'Er ging iets mis. Neem een pof en probeer het opnieuw.')
      setBusy(false)
    }
  }

  if (loadingEdit) return <Spinner />

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="page-title">{editId ? 'Check-in bewerken' : 'Nieuwe check-in'}</h1>

      {join ? (
        <section className="card flex items-center gap-3 border-leaf-300 bg-leaf-50 p-4">
          <span className="text-2xl">🤝</span>
          <p className="flex-1 text-sm">
            Zelfde rotation als <b>{join.profile.display_name || join.profile.username}</b>. Alles staat al klaar, geef alleen nog je eigen cijfer.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setJoin(null)}>Toch niet</button>
        </section>
      ) : !editId && recent.length > 0 && (
        <section>
          <label className="label">🤝 Zat je bij een maat?</label>
          <div className="space-y-2">
            {recent.map((c) => (
              <div key={c.id} className="card flex items-center gap-3 p-3">
                <Avatar profile={c.profile} size="sm" />
                <p className="min-w-0 flex-1 text-sm leading-snug">
                  <b>{c.profile.display_name || c.profile.username}</b> · {c.strain.name}
                  <span className="block text-xs text-leaf-800/50">{timeAgo(c.created_at)}{c.smoked_at ? ` · ${c.smoked_at}` : ''}</span>
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => joinSession(c)}>Zelfde rotation 🔄</button>
              </div>
            ))}
          </div>
        </section>
      )}

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
          <PlaceInput id="smoked" placeholder="Vondelpark, het balkon, de kroeg…"
            value={smokedAt} onChange={setSmokedAt} options={past.spots} />
        </div>
        <div>
          <label className="label" htmlFor="bought">🛒 Waar heb je het gescoord?</label>
          <PlaceInput id="bought" placeholder="Coffeeshop, een maat…"
            value={boughtAt} onChange={setBoughtAt} options={past.shops} />
        </div>
      </section>

      {rolls && (
        <section>
          <label className="label">🌀 Wie heeft gedraaid?</label>
          <PeoplePicker friends={friends} me={me} value={roller} onChange={setRoller} max={1}
            placeholder="Ik, een maat, of typ een naam" />
          {roller.length > 0 && (
            <div className="mt-3 rounded-2xl bg-leaf-50 p-3">
              <p className="mb-2 text-sm font-extrabold text-leaf-800">Hoe is ’ie gedraaid?</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['normaal', '🌀 Normaal', 'Gewoon, zoals altijd'],
                  ['inside_out', '🔄 Inside out', 'Iso: vloei binnenstebuiten'],
                ] as const).map(([k, title, sub]) => (
                  <button key={k} type="button" onClick={() => setRollStyle(k)} aria-pressed={rollStyle === k}
                    className={`rounded-2xl border-2 px-3 py-2 text-left transition ${rollStyle === k ? 'border-leaf-600 bg-white' : 'border-transparent bg-white/60'}`}>
                    <span className="block font-black">{title}</span>
                    <span className="block text-xs text-leaf-800/60">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
            <button type="button" onClick={() => { setPhoto(null); setKeptPhoto(null) }} aria-label="Foto weghalen"
              className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow"><XIcon className="size-5" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-leaf-300 bg-white/60 py-6 font-bold text-leaf-700 hover:bg-white">
            <CameraIcon className="size-6" /> Foto toevoegen
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </section>

      {error && <ErrorBox bug={bugError}>{error}</ErrorBox>}

      <button className="btn btn-primary w-full py-4 text-lg" disabled={busy}>
        {editId ? (busy ? 'Opslaan…' : 'Wijzigingen opslaan ✏️') : busy ? 'Inchecken…' : 'Inchecken 🌿'}
      </button>
    </form>
  )
}
