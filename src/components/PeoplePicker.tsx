import { useState } from 'react'
import type { Profile } from '../lib/types'
import { Avatar } from './Avatar'
import { XIcon } from './Icons'

export type PersonPick = { user?: Profile; name?: string }

const pickKey = (p: PersonPick) => (p.user ? `u:${p.user.id}` : `n:${p.name?.toLowerCase()}`)
const pickLabel = (p: PersonPick, meId?: string) =>
  p.user ? (p.user.id === meId ? 'Ik' : p.user.display_name || p.user.username || '?') : p.name!

type Props = {
  friends: Profile[]
  me?: Profile // offer "Ik" as an option
  value: PersonPick[]
  onChange: (v: PersonPick[]) => void
  max?: number
  placeholder?: string
}

/** Tag app friends, or type any name for people who aren't on Untakkd. */
export function PeoplePicker({ friends, me, value, onChange, max = 20, placeholder }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const taken = new Set(value.map(pickKey))
  const term = q.trim().toLowerCase()
  const candidates = [...(me ? [me] : []), ...friends].filter((f) => !taken.has(`u:${f.id}`))
  const suggestions = candidates.filter((f) =>
    !term || [f.display_name, f.username, f.id === me?.id ? 'ik' : ''].some((s) => s?.toLowerCase().includes(term)),
  ).slice(0, 6)

  const add = (p: PersonPick) => {
    if (!taken.has(pickKey(p))) onChange([...value, p].slice(0, max))
    setQ('')
  }
  const addTyped = () => {
    if (!q.trim()) return
    if (suggestions.length === 1 && term) add({ user: suggestions[0] })
    else add({ name: q.trim().slice(0, 40) })
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((p) => (
            <span key={pickKey(p)} className="chip border-leaf-300 bg-leaf-100 text-leaf-900">
              {p.user ? <Avatar profile={p.user} size="xs" /> : <span aria-hidden>✍️</span>}
              {pickLabel(p, me?.id)}
              <button type="button" aria-label="Weghalen" onClick={() => onChange(value.filter((x) => pickKey(x) !== pickKey(p)))}>
                <XIcon className="size-4" />
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length < max && (
        <div className="relative">
          <input className="input" value={q} placeholder={placeholder}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped() } }} />
          {open && (suggestions.length > 0 || q.trim()) && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-leaf-100 bg-white shadow-lg">
              {suggestions.map((f) => (
                <button key={f.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add({ user: f })}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left font-bold hover:bg-leaf-50">
                  <Avatar profile={f} size="xs" /> {f.id === me?.id ? 'Ik' : f.display_name || f.username}
                  {f.username && f.id !== me?.id && <span className="text-xs font-semibold text-leaf-800/50">@{f.username}</span>}
                </button>
              ))}
              {q.trim() && (
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add({ name: q.trim().slice(0, 40) })}
                  className="w-full px-4 py-2 text-left font-bold text-leaf-700 hover:bg-leaf-50">
                  ✍️ “{q.trim()}” toevoegen (zit niet op Untakkd)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
