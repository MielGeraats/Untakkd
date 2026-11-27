import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { ErrorBox } from './BugNote'
import { AvatarPicker } from './AvatarPicker'
import { supabase } from '../lib/supabase'

const suggestUsername = (name: string | null) =>
  (name ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9_]/g, '').slice(0, 20)

export function ProfileForm({ submitLabel, onDone }: { submitLabel: string; onDone?: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [username, setUsername] = useState(profile?.username ?? suggestUsername(profile?.display_name ?? null))
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [taken, setTaken] = useState(false) // username taken = your problem, not a bug

  const validUsername = /^[a-z0-9_]{3,20}$/.test(username)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile || !validUsername) return
    setBusy(true)
    setError('')
    const { error } = await supabase.from('profiles')
      .update({ username, display_name: displayName.trim() || null, bio: bio.trim() || null })
      .eq('id', profile.id)
    setBusy(false)
    setTaken(error?.code === '23505')
    if (error) return setError(error.code === '23505' ? 'Die naam is al bezet, iemand was je voor. Probeer een andere.' : error.message)
    setSaved(true)
    await refreshProfile()
    onDone?.()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <AvatarPicker />
      <div>
        <label className="label" htmlFor="username">Gebruikersnaam</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-leaf-500">@</span>
          <input id="username" className="input pl-9" value={username} autoCapitalize="none" autoCorrect="off"
            onChange={(e) => { setUsername(e.target.value.toLowerCase()); setSaved(false) }} />
        </div>
        <p className={`mt-1 text-xs ${validUsername || !username ? 'text-leaf-800/50' : 'text-red-600'}`}>
          3–20 tekens: kleine letters, cijfers en _. Hiermee vinden je maten je.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="display">Naam</label>
        <input id="display" className="input" maxLength={40} value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false) }} />
      </div>
      <div>
        <label className="label" htmlFor="bio">Bio <span className="font-semibold text-leaf-800/40">(optioneel)</span></label>
        <textarea id="bio" className="input min-h-20" maxLength={160} value={bio} placeholder="Overdag sativa, ’s avonds indica 🌙"
          onChange={(e) => { setBio(e.target.value); setSaved(false) }} />
      </div>
      {error && <ErrorBox bug={!taken}>{error}</ErrorBox>}
      <button className="btn btn-primary w-full py-3" disabled={busy || !validUsername}>
        {busy ? 'Opslaan…' : saved ? 'Opgeslagen ✓' : submitLabel}
      </button>
    </form>
  )
}
