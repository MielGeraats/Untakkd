import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { FriendButton } from '../components/FriendButton'
import { SearchIcon } from '../components/Icons'
import { Spinner } from '../components/Spinner'
import { useMe } from '../lib/auth'
import { relationTo, splitFriendships, useFriendships } from '../lib/friends'
import { cleanSearch } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function Friends() {
  const me = useMe()
  const { rows, loading, reload } = useFriendships()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [copied, setCopied] = useState(false)
  const { friends, incoming, outgoing } = splitFriendships(rows, me.id)

  useEffect(() => {
    const term = cleanSearch(q)
    if (term.length < 2) return setResults([])
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('*')
        .or(`username.ilike.*${term}*,display_name.ilike.*${term}*`)
        .not('username', 'is', null).neq('id', me.id).limit(10)
      setResults(data ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [q, me.id])

  async function invite() {
    const url = `${window.location.origin}/u/${me.username}`
    const text = `Heeey maatje, voeg me toe op Untakkd 🌿`
    if (navigator.share) {
      try { await navigator.share({ title: 'Untakkd', text, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const Row = ({ p, action }: { p: Profile; action?: ReactNode }) => (
    <li className="flex items-center gap-3 py-2">
      <Link to={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar profile={p} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-extrabold">{p.display_name || p.username}</span>
          <span className="block truncate text-xs font-bold text-leaf-800/50">@{p.username}</span>
        </span>
      </Link>
      {action}
    </li>
  )

  return (
    <div className="space-y-4">
      <h1 className="page-title mb-0">Maten</h1>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-leaf-500" />
        <input className="input pl-11" placeholder="Zoek op naam of @gebruikersnaam" value={q} autoCapitalize="none"
          onChange={(e) => setQ(e.target.value)} />
      </div>

      {q.trim().length >= 2 && (
        <section className="card px-4 py-2">
          {results.length === 0 ? <p className="py-3 text-sm text-leaf-800/50">Niemand gevonden. Typfoutje? Gebeurt de beste.</p> : (
            <ul className="divide-y divide-leaf-50">
              {results.map((p) => (
                <Row key={p.id} p={p} action={<FriendButton relation={relationTo(rows, me.id, p.id)} userId={p.id} onChange={reload} />} />
              ))}
            </ul>
          )}
        </section>
      )}

      <button onClick={invite} className="card flex w-full items-center gap-3 p-4 text-left hover:bg-white">
        <span className="text-2xl">💌</span>
        <span className="flex-1">
          <span className="block font-black">Nodig je maten uit</span>
          <span className="block text-sm text-leaf-800/60">{copied ? 'Link gekopieerd!' : 'Deel een link naar je profiel'}</span>
        </span>
      </button>

      {loading ? <Spinner /> : (
        <>
          {incoming.length > 0 && (
            <section className="card border-orange-200 px-4 py-3">
              <h2 className="font-black">Vriendschapsverzoeken <span className="text-orange-500">({incoming.length})</span></h2>
              <ul>{incoming.map(({ row, profile }) => (
                <Row key={row.id} p={profile} action={<FriendButton relation={{ kind: 'incoming', row }} userId={profile.id} onChange={reload} />} />
              ))}</ul>
            </section>
          )}

          <section className="card px-4 py-3">
            <h2 className="font-black">Je maten <span className="text-leaf-500">({friends.length})</span></h2>
            {friends.length === 0
              ? <p className="py-3 text-sm text-leaf-800/50">Nog geen maten. Zoek hierboven of stuur een uitnodiging, alleen blowen is ook maar niks.</p>
              : <ul className="divide-y divide-leaf-50">{friends.map((p) => <Row key={p.id} p={p} />)}</ul>}
          </section>

          {outgoing.length > 0 && (
            <section className="card px-4 py-3">
              <h2 className="font-black text-leaf-800/70">Verstuurde verzoeken</h2>
              <ul>{outgoing.map(({ row, profile }) => (
                <Row key={row.id} p={profile} action={<FriendButton relation={{ kind: 'outgoing', row }} userId={profile.id} onChange={reload} />} />
              ))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
