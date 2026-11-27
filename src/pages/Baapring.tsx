import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { BaapringLogo } from '../components/BaapringLogo'
import { ErrorBox } from '../components/BugNote'
import { XIcon } from '../components/Icons'
import { useMe } from '../lib/auth'
import {
  BONUSES, BONUS_CHANCE, BUILT_IN, EMPTY_SCORE, MAASTRICHT, elo, fetchCareers, fetchCustomCategories, randomLetter,
  type Bonus, type Career, type CustomCategory, type Score,
} from '../lib/baapring'
import { splitFriendships, useFriendships } from '../lib/friends'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

// ---------------------------------------------------------------------------
// Game state (kept in localStorage so a locked phone or reload doesn't end the game)
// ---------------------------------------------------------------------------

type Settings = { seconds: number; maastricht: boolean; bonuses: boolean; custom: 'mix' | 'only' | 'off' }
type Seat = { key: string; userId?: string; name: string; profile?: Profile; inJilla: boolean; score: Score }
type Phase = 'letter' | 'turn' | 'jilla' | 'done'
type Game = {
  seats: Seat[]
  turn: number
  dir: 1 | -1
  phase: Phase
  letter: string
  category: string
  bonus: Bonus | null
  pool: string[]
  allCategories: string[]
  settings: Settings
  turnId: number // changes every turn, restarts the timer
}

const STORAGE = 'untakkd:baapring'
const DEFAULT_SETTINGS: Settings = { seconds: 30, maastricht: false, bonuses: true, custom: 'mix' }

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Next category from the shuffled pool (no repeats until everything has been asked). */
function draw(g: Game): Pick<Game, 'category' | 'pool' | 'bonus'> {
  const pool = g.pool.length ? g.pool : shuffle(g.allCategories)
  const bonus = g.settings.bonuses && Math.random() < BONUS_CHANCE ? BONUSES[Math.floor(Math.random() * BONUSES.length)] : null
  return { category: pool[0], pool: pool.slice(1), bonus }
}

/** Move to the next player. People in Jilla sit out one turn (and are free again after). */
function advance(g: Game): Game {
  const n = g.seats.length
  const seats = g.seats.map((s) => ({ ...s }))
  let dir = g.dir
  if (g.bonus?.effect === 'reverse') dir = (dir * -1) as 1 | -1
  let skips = g.bonus?.effect === 'skip' ? 1 : 0
  let i = g.turn
  for (let guard = 0; guard < n * 3; guard++) {
    i = (i + dir + n) % n
    if (seats[i].inJilla) { seats[i].inJilla = false; continue }
    if (skips > 0) { skips--; continue }
    break
  }
  const next = { ...g, seats, dir, turn: i, phase: 'turn' as Phase, turnId: g.turnId + 1 }
  return { ...next, ...draw(next) }
}

const addTo = (s: Seat, d: Partial<Score>): Seat => ({
  ...s,
  score: {
    poffen: s.score.poffen + (d.poffen ?? 0), beurten: s.score.beurten + (d.beurten ?? 0), bouncers: s.score.bouncers + (d.bouncers ?? 0),
    palindromen: s.score.palindromen + (d.palindromen ?? 0), jillas: s.score.jillas + (d.jillas ?? 0),
  },
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function Baapring() {
  const [game, setGame] = useState<Game | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE) ?? 'null') } catch { return null }
  })
  useEffect(() => {
    if (game) localStorage.setItem(STORAGE, JSON.stringify(game))
    else localStorage.removeItem(STORAGE)
  }, [game])

  return game ? <Play game={game} setGame={setGame} /> : <Lobby onStart={setGame} />
}

// ---------------------------------------------------------------------------
// Lobby: rules, players, settings, leaderboard
// ---------------------------------------------------------------------------

function Lobby({ onStart }: { onStart: (g: Game) => void }) {
  const me = useMe()
  const { rows, loading } = useFriendships()
  const friends = useMemo(() => splitFriendships(rows, me.id).friends, [rows, me.id])
  const [seats, setSeats] = useState<Seat[]>(() => [{ key: `u:${me.id}`, userId: me.id, name: me.display_name || me.username || 'Ik', profile: me, inJilla: false, score: EMPTY_SCORE }])
  const [guest, setGuest] = useState('')
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(`${STORAGE}:settings`) ?? '{}') } } catch { return DEFAULT_SETTINGS }
  })
  const [customAll, setCustomAll] = useState<CustomCategory[]>([])
  // only your own and your friends' questions (the admin can see everyone's, but shouldn't get them in-game)
  const custom = useMemo(() => {
    const ok = new Set([me.id, ...friends.map((f) => f.id)])
    return customAll.filter((c) => ok.has(c.created_by)).map((c) => c.text)
  }, [customAll, friends, me.id])
  const [rules, setRules] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { localStorage.setItem(`${STORAGE}:settings`, JSON.stringify(settings)) }, [settings])
  useEffect(() => { fetchCustomCategories().then(setCustomAll).catch(() => setCustomAll([])) }, [])

  const taken = new Set(seats.map((s) => s.key))
  const addFriend = (p: Profile) => setSeats((s) => [...s, { key: `u:${p.id}`, userId: p.id, name: p.display_name || p.username || '?', profile: p, inJilla: false, score: EMPTY_SCORE }])
  const addGuest = () => {
    const name = guest.trim().slice(0, 40)
    if (!name || taken.has(`g:${name.toLowerCase()}`)) return
    setSeats((s) => [...s, { key: `g:${name.toLowerCase()}`, name, inJilla: false, score: EMPTY_SCORE }])
    setGuest('')
  }
  const move = (i: number, d: -1 | 1) => setSeats((s) => {
    const a = [...s]
    const j = i + d
    if (j < 0 || j >= a.length) return s
    ;[a[i], a[j]] = [a[j], a[i]]
    return a
  })

  function start() {
    if (seats.length < 2) return setError('Je hebt minstens 2 spelers nodig. Alleen blowen is ook maar niks.')
    const base = [...BUILT_IN, ...(settings.maastricht ? MAASTRICHT : [])]
    const all = settings.custom === 'only' && custom.length ? custom : settings.custom === 'off' ? base : [...base, ...custom]
    const g: Game = {
      seats: seats.map((s) => ({ ...s, inJilla: false, score: EMPTY_SCORE })), turn: 0, dir: 1, phase: 'letter',
      letter: randomLetter(), category: '', bonus: null, pool: shuffle(all), allCategories: all, settings, turnId: 0,
    }
    onStart({ ...g, ...draw(g), bonus: null })
  }

  return (
    <div className="space-y-4">
      <section className="card p-5 text-center">
        <BaapringLogo />
        <p className="mt-2 text-sm text-leaf-800/60">Het woordspel van de kring. Pof, antwoord, pass de baap.</p>
        <button type="button" onClick={() => setRules((r) => !r)} className="mt-2 text-xs font-bold text-leaf-700 underline">
          {rules ? 'Regels verbergen' : 'Hoe werkt het?'}
        </button>
        {rules && (
          <div className="mt-3 space-y-1.5 rounded-2xl bg-leaf-50 p-4 text-left text-sm text-leaf-900/80">
            <p>🔤 De eerste speler krijgt een <b>beginletter</b>. Daarna begint elk antwoord met de <b>laatste letter</b> van het vorige antwoord.</p>
            <p>🗂️ Je antwoord moet passen bij de <b>categorie</b> en binnen de tijd. Elk woord mag maar één keer per spel.</p>
            <p>💨 Aan de beurt? <b>Neem een pof en houd ’m in</b> tot je een antwoord weet. Dat is je pof voor deze beurt.</p>
            <p>✅ Goed: uitblazen en door naar de volgende.</p>
            <p>🔁 <b>Bouncer</b> (begint en eindigt met dezelfde letter): neem er <b>1 extra pof</b> bij. 🪞 <b>Palindroom</b> (pop, raar): <b>2 extra poffen</b>.</p>
            <p>❌ Fout of te laat = <b>Jilla</b>: géén extra pof, maar je slaat je volgende beurt over.</p>
            <p>⚡ Soms komt er een <b>bonuskaart</b>. De groep beslist of een antwoord goed is.</p>
            <p>🌀 Wie aan het eind de <b>minste punten</b> heeft, <b>draait de volgende</b>.</p>
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-black">👥 Spelers <span className="text-sm font-bold text-leaf-800/50">(in zitvolgorde)</span></h2>
        <ol className="space-y-1.5">
          {seats.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 rounded-2xl bg-leaf-50 px-2 py-1.5">
              <span className="w-5 text-center text-sm font-black text-leaf-500">{i + 1}</span>
              {s.profile ? <Avatar profile={s.profile} size="sm" /> : <span className="flex size-9 items-center justify-center rounded-full bg-white text-lg">✍️</span>}
              <span className="min-w-0 flex-1 truncate font-bold">{s.name}{s.userId === me.id && ' (jij)'}</span>
              <button type="button" aria-label="Omhoog" onClick={() => move(i, -1)} className="btn btn-ghost btn-sm px-2" disabled={i === 0}>↑</button>
              <button type="button" aria-label="Omlaag" onClick={() => move(i, 1)} className="btn btn-ghost btn-sm px-2" disabled={i === seats.length - 1}>↓</button>
              <button type="button" aria-label="Weghalen" onClick={() => setSeats((x) => x.filter((y) => y.key !== s.key))} className="btn btn-ghost btn-sm px-2">
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ol>

        {!loading && friends.some((f) => !taken.has(`u:${f.id}`)) && (
          <div className="mt-3">
            <p className="label">Maten toevoegen</p>
            <div className="flex flex-wrap gap-2">
              {friends.filter((f) => !taken.has(`u:${f.id}`)).map((f) => (
                <button key={f.id} type="button" onClick={() => addFriend(f)} className="chip chip-off">
                  <Avatar profile={f} size="xs" /> {f.display_name || f.username}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input className="input py-2.5" placeholder="Gast zonder account…" maxLength={40} value={guest}
            onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest() } }} />
          <button type="button" className="btn btn-soft" onClick={addGuest} disabled={!guest.trim()}>＋</button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-black">⚙️ Instellingen</h2>
        <div>
          <p className="label">⏱️ Tijd per beurt: {settings.seconds} seconden</p>
          <input type="range" min={10} max={60} step={5} value={settings.seconds} className="w-full accent-leaf-600"
            onChange={(e) => setSettings({ ...settings, seconds: Number(e.target.value) })} />
        </div>
        <Toggle on={settings.bonuses} onChange={(v) => setSettings({ ...settings, bonuses: v })} label="⚡ Bonuskaarten" />
        <Toggle on={settings.maastricht} onChange={(v) => setSettings({ ...settings, maastricht: v })} label="🏰 Maastricht-modus (Maas-vragen erbij)" />
        <div>
          <p className="label">✍️ Eigen vragen van jullie crew ({custom.length})</p>
          <div className="flex flex-wrap gap-2">
            {([['mix', 'Erbij mixen'], ['only', 'Alleen eigen'], ['off', 'Uit']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSettings({ ...settings, custom: k })}
                className={`chip ${settings.custom === k ? 'chip-on' : 'chip-off'}`}>{l}</button>
            ))}
          </div>
          <Link to="/baapring/vragen" className="mt-2 inline-block text-sm font-bold text-leaf-700 underline">Eigen vragen beheren →</Link>
        </div>
      </section>

      {error && <ErrorBox bug={false}>{error}</ErrorBox>}
      <button type="button" onClick={start} className="btn btn-primary w-full py-4 text-lg">💍 Start De Baapring</button>

      <Leaderboard ids={[me.id, ...friends.map((f) => f.id)]} profiles={[me, ...friends]} />
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 text-left">
      <span className="flex-1 text-sm font-bold text-leaf-900">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-leaf-600' : 'bg-leaf-200'}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}

function Leaderboard({ ids, profiles }: { ids: string[]; profiles: Profile[] }) {
  const [careers, setCareers] = useState<Map<string, Career> | null>(null)
  const [error, setError] = useState('')
  const key = ids.join(',')
  useEffect(() => {
    fetchCareers(key.split(',').filter(Boolean)).then(setCareers).catch((e) => setError(e.message))
  }, [key])

  if (error) return <ErrorBox>Ranglijst laden lukt niet: {error}</ErrorBox>
  if (!careers) return null
  const ranked = profiles.filter((p) => careers.has(p.id)).map((p) => ({ p, c: careers.get(p.id)! })).sort((a, b) => b.c.elo - a.c.elo)
  if (!ranked.length) return <p className="text-center text-sm text-leaf-800/50">Nog geen potjes gespeeld. Wie wordt de eerste Ringmeester? 👑</p>

  return (
    <section className="card p-4">
      <h2 className="mb-3 font-black">🏆 Ranglijst van je crew</h2>
      <ol className="space-y-2">
        {ranked.map(({ p, c }, i) => (
          <li key={p.id} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-center font-black text-leaf-500">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
            <Link to={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-2 font-bold hover:underline">
              <Avatar profile={p} size="xs" /> <span className="truncate">{p.display_name || p.username}</span>
            </Link>
            <span className="text-xs font-bold text-leaf-800/50">{c.games} potjes · {c.jillas} jilla</span>
            <span className="w-12 text-right font-black text-leaf-700">{Math.round(c.elo)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-leaf-800/45">ELO: 100 + poffen ×4,2 + bouncers ×4,1 + palindromen ×9,9 − jilla’s ×20,4</p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

function Play({ game, setGame }: { game: Game; setGame: (g: Game | null) => void }) {
  const [history, setHistory] = useState<Game[]>([])
  const apply = useCallback((next: Game) => {
    setHistory((h) => [...h.slice(-30), game])
    setGame(next)
  }, [game, setGame])
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setGame(prev)
  }

  const g = game
  const seat = g.seats[g.turn]
  const updateSeat = (fn: (s: Seat) => Seat) => g.seats.map((s, i) => (i === g.turn ? fn(s) : s))

  const score = (kind: 'goed' | 'bouncer' | 'palindroom') => {
    const d = kind === 'goed' ? { poffen: 1 } : kind === 'bouncer' ? { poffen: 2, bouncers: 1 } : { poffen: 3, palindromen: 1 }
    apply(advance({ ...g, seats: updateSeat((s) => addTo(s, { ...d, beurten: 1 })) }))
  }
  const jilla = () => apply({ ...g, phase: 'jilla', seats: updateSeat((s) => ({ ...addTo(s, { poffen: 1, jillas: 1, beurten: 1 }), inJilla: true })) })
  const wasOnTime = () => apply(advance({ ...g, seats: updateSeat((s) => ({ ...addTo(s, { jillas: -1 }), inJilla: false })) }))
  const newQuestion = () => apply({ ...g, ...draw(g), bonus: g.bonus, turnId: g.turnId + 1 })

  if (g.phase === 'done') return <Finish game={g} onClose={() => setGame(null)} onBack={undo} />

  const seconds = Math.round(g.settings.seconds * (g.bonus?.effect === 'half' ? 0.5 : g.bonus?.effect === 'double' ? 2 : 1))
  const nextUp = g.seats.length > 1 ? peekNext(g) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1"><BaapringLogo size="sm" /></div>
      </div>

      <section className={`card p-5 text-center ${g.phase === 'jilla' ? 'border-red-300 bg-red-50' : ''}`}>
        <div className="flex flex-col items-center">
          {seat.profile ? <Avatar profile={seat.profile} size="lg" /> : <span className="flex size-20 items-center justify-center rounded-full bg-leaf-100 text-3xl">✍️</span>}
          <p className="mt-2 text-sm font-bold text-leaf-800/50">{g.phase === 'jilla' ? 'Helaas pindakaas' : 'Aan de beurt'}</p>
          <h1 className="text-2xl font-black">{seat.name}</h1>
          {g.phase !== 'jilla' && <p className="mt-1 text-sm font-bold text-leaf-700">💨 Pof erin en vasthouden!</p>}
        </div>

        {g.phase === 'letter' && (
          <div className="mt-4">
            <p className="text-sm font-bold text-leaf-800/60">Beginletter</p>
            <p className="text-7xl font-black text-leaf-600">{g.letter}</p>
            <button type="button" onClick={() => apply({ ...g, phase: 'turn', turnId: g.turnId + 1 })} className="btn btn-primary mt-4 w-full py-4 text-lg">
              🔥 Start
            </button>
          </div>
        )}

        {g.phase === 'jilla' && (
          <div className="mt-4">
            <p className="text-6xl font-black tracking-tight text-red-600">JILLA!</p>
            <p className="mt-1 text-sm text-red-700/80">Geen extra pof voor jou. Je slaat je volgende beurt over 👮</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={wasOnTime} className="btn btn-soft flex-1">😇 Was toch op tijd</button>
              <button type="button" onClick={() => apply(advance(g))} className="btn btn-primary flex-1">Volgende ▶</button>
            </div>
          </div>
        )}

        {g.phase === 'turn' && (
          <div className="mt-4">
            <p className="rounded-3xl bg-leaf-50 px-4 py-5 text-2xl font-black leading-tight text-leaf-900">{g.category}</p>
            {g.bonus && (
              <div className="mt-3 rounded-3xl border-2 border-amber-300 bg-amber-50 p-3 text-left">
                <p className="text-xs font-black uppercase tracking-wide text-amber-600">⚡ Bonuskaart</p>
                <p className="font-black">{g.bonus.emoji} {g.bonus.name}</p>
                <p className="text-sm text-leaf-900/80">{g.bonus.text}</p>
              </div>
            )}
            <Timer key={g.turnId} seconds={seconds} onTimeout={jilla} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => score('goed')} className="btn btn-primary col-span-2 py-4 text-lg">✅ Goed</button>
              <button type="button" onClick={() => score('bouncer')} className="btn btn-soft py-3">🔁 Bouncer <span className="opacity-60">+1 extra</span></button>
              <button type="button" onClick={() => score('palindroom')} className="btn btn-soft py-3">🪞 Palindroom <span className="opacity-60">+2 extra</span></button>
              <button type="button" onClick={jilla} className="btn btn-danger col-span-2 py-3">❌ Fout → Jilla</button>
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-2">
        <button type="button" onClick={undo} disabled={!history.length} className="btn btn-ghost btn-sm flex-1">↩️ Oeps, terug</button>
        {g.phase === 'turn' && <button type="button" onClick={newQuestion} className="btn btn-ghost btn-sm flex-1">🔀 Andere vraag</button>}
        <button type="button" onClick={() => apply({ ...g, phase: 'done' })} className="btn btn-ghost btn-sm flex-1">🏁 Afronden</button>
      </div>

      {nextUp && g.phase !== 'letter' && <p className="text-center text-sm text-leaf-800/60">Hierna: <b>{nextUp}</b>{g.dir === -1 && ' (andersom 🔄)'}</p>}

      <Scoreboard seats={g.seats} current={g.turn} />
    </div>
  )
}

function peekNext(g: Game) {
  const after = advance(g)
  return after.seats[after.turn]?.name
}

function Timer({ seconds, onTimeout }: { seconds: number; onTimeout: () => void }) {
  const [left, setLeft] = useState(seconds)
  const [paused, setPaused] = useState(false)
  const fired = useRef(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100)
    return () => clearInterval(t)
  }, [paused])
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true
      navigator.vibrate?.(300)
      onTimeout()
    }
  }, [left, onTimeout])

  const pct = Math.min(100, (left / seconds) * 100)
  const urgent = left <= 5
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-leaf-100">
          <div className={`h-full rounded-full transition-[width] duration-100 ${urgent ? 'bg-red-500' : 'bg-leaf-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`w-12 text-right text-xl font-black tabular-nums ${urgent ? 'text-red-600' : 'text-leaf-700'}`}>{Math.ceil(left)}s</span>
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" onClick={() => setLeft((l) => l + 3)} className="btn btn-ghost btn-sm">+3s</button>
        <button type="button" onClick={() => setPaused((p) => !p)} className="btn btn-ghost btn-sm">{paused ? '▶️ Verder' : '⏸️ Pauze'}</button>
      </div>
    </div>
  )
}

function Scoreboard({ seats, current }: { seats: Seat[]; current?: number }) {
  return (
    <section className="card p-4">
      <h2 className="mb-2 font-black">📊 Stand</h2>
      <ul className="space-y-1.5">
        {seats.map((s, i) => (
          <li key={s.key} className={`flex items-center gap-2 rounded-2xl px-2 py-1 text-sm ${i === current ? 'bg-leaf-100' : ''}`}>
            {s.profile ? <Avatar profile={s.profile} size="xs" /> : <span className="w-6 text-center">✍️</span>}
            <span className="min-w-0 flex-1 truncate font-bold">{s.name}{s.inJilla && ' 👮'}</span>
            <span className="text-xs text-leaf-800/50">{s.score.bouncers}🔁 {s.score.palindromen}🪞 {s.score.jillas}❌</span>
            <span className="w-14 text-right font-black text-leaf-700">{s.score.poffen} pof</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// End of game: podium + save to everyone's stats
// ---------------------------------------------------------------------------

function Finish({ game, onClose, onBack }: { game: Game; onClose: () => void; onBack: () => void }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  const ranked = [...game.seats].sort((a, b) => elo(b.score) - elo(a.score))
  const played = game.seats.some((s) => s.score.beurten > 0)

  async function save() {
    setState('saving')
    setError('')
    try {
      const { data: g, error } = await supabase.from('baapring_games').insert({ maastricht: game.settings.maastricht }).select('id').single()
      if (error) throw error
      const rows = game.seats.map((s, i) => ({
        game_id: g.id, user_id: s.userId ?? null, guest_name: s.userId ? null : s.name, position: i, ...s.score,
      }))
      const { error: e2 } = await supabase.from('baapring_results').insert(rows)
      if (e2) throw e2
      setState('saved')
    } catch (e) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Opslaan mislukt')
      setState('idle')
    }
  }

  return (
    <div className="space-y-4">
      <section className="card p-5 text-center">
        <BaapringLogo size="sm" />
        <p className="mt-3 text-sm font-bold text-leaf-800/50">Ringmeester van dit potje</p>
        <div className="mt-2 flex flex-col items-center">
          {ranked[0].profile ? <Avatar profile={ranked[0].profile} size="lg" /> : <span className="text-5xl">✍️</span>}
          <h1 className="mt-2 text-3xl font-black">👑 {ranked[0].name}</h1>
          <p className="text-sm text-leaf-800/60">{ranked[0].score.poffen} poffen · {ranked[0].score.jillas} keer Jilla</p>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-black">Eindstand</h2>
        <ol className="space-y-1.5">
          {ranked.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-center font-black text-leaf-500">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{s.name}</span>
              <span className="text-xs text-leaf-800/50">{s.score.poffen} pof · {s.score.bouncers}🔁 {s.score.palindromen}🪞 {s.score.jillas}❌</span>
              <span className="w-10 text-right font-black text-leaf-700">{Math.round(elo(s.score))}</span>
            </li>
          ))}
        </ol>
        {ranked.length > 1 && (
          <p className="mt-3 text-center text-sm text-leaf-800/60">
            🧯 Jilla-koning: <b>{[...game.seats].sort((a, b) => b.score.jillas - a.score.jillas)[0].name}</b>
          </p>
        )}
      </section>

      {ranked.length > 1 && (() => {
        // lowest score rolls the next one (everyone tied for last rolls together)
        const low = Math.min(...ranked.map((s) => elo(s.score)))
        const losers = ranked.filter((s) => elo(s.score) === low)
        return (
          <section className="card border-violet-300 bg-gradient-to-br from-violet-50 to-white p-5 text-center">
            <p className="text-4xl">🌀</p>
            <p className="mt-1 text-lg font-black leading-tight">
              {losers.map((s) => s.name).join(' & ')} {losers.length === 1 ? 'heeft' : 'hebben'} de minste punten…
            </p>
            <p className="text-leaf-800/70">{losers.length === 1 ? 'Jij draait' : 'Jullie draaien'} de volgende. Hup, vloeitjes pakken!</p>
          </section>
        )
      })()}

      <a href="https://www.airconsole.com" target="_blank" rel="noreferrer"
        className="card relative block overflow-hidden border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 text-center">
        <p className="text-lg font-black">🎮 Potje AirConsole dan maar?</p>
        <p className="text-sm text-leaf-800/60">Tik hier en race verder</p>
        <div className="relative mt-3 h-8" aria-hidden>
          <span className="drive absolute text-2xl">🏎️</span>
          <span className="drive absolute text-2xl [animation-delay:-1.3s] [animation-duration:3.2s]">🚗</span>
          <span className="drive absolute text-2xl [animation-delay:-2.4s] [animation-duration:2.6s]">🚙</span>
        </div>
      </a>

      {error && <ErrorBox>Opslaan mislukt: {error}</ErrorBox>}
      {state === 'saved' ? (
        <>
          <p className="text-center font-bold text-leaf-700">✓ Opgeslagen in ieders stats. Proost!</p>
          <button type="button" onClick={onClose} className="btn btn-primary w-full py-3">Nieuw potje</button>
        </>
      ) : (
        <>
          <button type="button" onClick={save} disabled={state === 'saving' || !played} className="btn btn-primary w-full py-3">
            {state === 'saving' ? 'Opslaan…' : '💾 Opslaan in ieders stats'}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="btn btn-ghost btn-sm flex-1">↩️ Toch verder spelen</button>
            <button type="button" onClick={() => confirm('Potje weggooien zonder op te slaan?') && onClose()} className="btn btn-ghost btn-sm flex-1">🗑️ Niet opslaan</button>
          </div>
        </>
      )}
    </div>
  )
}
