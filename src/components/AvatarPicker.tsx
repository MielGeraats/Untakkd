import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { squareImage } from '../lib/image'
import { supabase } from '../lib/supabase'
import { Avatar } from './Avatar'
import { CameraIcon } from './Icons'

// Our own uploads live in the "photos" bucket; anything else (old Google pictures) isn't ours to delete.
const MARKER = '/storage/v1/object/public/photos/'
const storagePath = (url: string | null) => (url?.includes(MARKER) ? decodeURIComponent(url.split(MARKER)[1].split('?')[0]) : null)

/** Profile picture: upload (cropped to a square) or remove. Saves straight away. */
export function AvatarPicker() {
  const { profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!profile) return null

  async function save(avatar_url: string | null) {
    const old = storagePath(profile!.avatar_url)
    const { error } = await supabase.from('profiles').update({ avatar_url }).eq('id', profile!.id)
    if (error) throw error
    if (old) await supabase.storage.from('photos').remove([old])
    await refreshProfile()
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const blob = await squareImage(file)
      const path = `${profile!.id}/avatar-${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      await save(supabase.storage.from('photos').getPublicUrl(path).data.publicUrl)
    } catch (e) {
      setError(e && typeof e === 'object' && 'message' in e ? `Uploaden mislukt: ${(e as { message: string }).message}` : 'Uploaden mislukt')
    }
    setBusy(false)
  }

  async function remove() {
    setBusy(true)
    setError('')
    try { await save(null) } catch { setError('Weghalen mislukt') }
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-4">
      <label className="relative cursor-pointer" aria-label="Profielfoto kiezen">
        <Avatar profile={profile} size="lg" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-leaf-600 p-1.5 text-white shadow ring-2 ring-white">
          <CameraIcon className="size-4" />
        </span>
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-extrabold text-leaf-900">{busy ? 'Even geduld…' : 'Profielfoto'}</p>
        <p className="text-leaf-800/60">Tik op de foto om een nieuwe te kiezen. Kies je beste kant 📸</p>
        {profile.avatar_url && !busy && (
          <button type="button" onClick={remove} className="mt-1 text-xs font-bold text-leaf-800/50 hover:text-red-600">Foto weghalen</button>
        )}
        {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
      </div>
    </div>
  )
}
