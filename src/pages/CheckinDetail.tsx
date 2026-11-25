import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { CheckinCard } from '../components/CheckinCard'
import { ChevronLeft } from '../components/Icons'
import { Empty, Spinner } from '../components/Spinner'
import { useMe } from '../lib/auth'
import { CHECKIN_SELECT, normalizeCheckin } from '../lib/queries'
import type { Badge } from '../lib/stats'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import type { Checkin, Comment } from '../lib/types'

export function CheckinDetail() {
  const { id } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const unlocked = ((useLocation().state as { unlocked?: Badge[] } | null)?.unlocked ?? [])
  const [checkin, setCheckin] = useState<Checkin | null | undefined>(undefined)
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const loadComments = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*, profile:profiles!comments_user_id_fkey(*)')
      .eq('checkin_id', Number(id)).order('created_at')
    setComments((data ?? []) as Comment[])
  }, [id])

  useEffect(() => {
    supabase.from('checkins').select(CHECKIN_SELECT).eq('id', Number(id)).maybeSingle()
      .then(({ data }) => setCheckin(data ? normalizeCheckin(data) : null))
    loadComments()
  }, [id, loadComments])

  async function addComment(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    const { error } = await supabase.from('comments').insert({ checkin_id: Number(id), body: body.trim() })
    setBusy(false)
    if (!error) {
      setBody('')
      loadComments()
    }
  }

  async function deleteComment(cid: number) {
    await supabase.from('comments').delete().eq('id', cid)
    loadComments()
  }

  async function deleteCheckin() {
    if (!checkin || !confirm('Deze check-in echt verwijderen?')) return
    if (checkin.photo_path) await supabase.storage.from('photos').remove([checkin.photo_path])
    await supabase.from('checkins').delete().eq('id', checkin.id)
    navigate('/', { replace: true })
  }

  if (checkin === undefined) return <Spinner />
  if (checkin === null) return <Empty emoji="🌫️" title="Deze check-in is in rook opgegaan">Hij is verwijderd, of je bent geen maten met degene die hem plaatste.</Empty>

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm -ml-3"><ChevronLeft className="size-5" /> Terug</button>

      {unlocked.length > 0 && (
        <div className="card border-leaf-300 bg-gradient-to-br from-leaf-100 to-white p-4">
          <p className="mb-2 font-black">🎉 Nieuwe badge{unlocked.length > 1 ? 's' : ''} binnen! Proost!</p>
          <div className="flex flex-wrap gap-3">
            {unlocked.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm">
                <span className="text-2xl">{b.emoji}</span>
                <div><p className="text-sm font-black leading-tight">{b.name}</p><p className="text-xs text-leaf-800/60">{b.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CheckinCard c={checkin} commentCount={comments.length} linkToDetail={false} />

      <section className="card p-4">
        <h2 className="mb-3 font-black">Reacties</h2>
        {comments.length === 0 && <p className="mb-3 text-sm text-leaf-800/50">Nog geen reacties. Zeg eens iets liefs 💚</p>}
        <ul className="space-y-3">
          {comments.map((cm) => (
            <li key={cm.id} className="flex gap-2.5">
              <Link to={`/u/${cm.profile.username}`}><Avatar profile={cm.profile} size="sm" /></Link>
              <div className="min-w-0 flex-1 rounded-2xl bg-leaf-50 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <Link to={`/u/${cm.profile.username}`} className="text-sm font-extrabold">{cm.profile.display_name || cm.profile.username}</Link>
                  <span className="text-xs text-leaf-800/45">{timeAgo(cm.created_at)}</span>
                  {(cm.user_id === me.id || checkin.user_id === me.id) && (
                    <button onClick={() => deleteComment(cm.id)} className="ml-auto text-xs font-bold text-leaf-800/40 hover:text-red-600">Verwijder</button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{cm.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={addComment} className="mt-4 flex gap-2">
          <input className="input py-2.5" placeholder="Zeg er wat van…" maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !body.trim()}>Plaats</button>
        </form>
      </section>

      {checkin.user_id === me.id && (
        <div className="flex gap-2">
          <Link to={`/checkin/${checkin.id}/edit`} className="btn btn-soft btn-sm flex-1">✏️ Bewerken / mensen taggen</Link>
          <button onClick={deleteCheckin} className="btn btn-danger btn-sm flex-1">Verwijderen</button>
        </div>
      )}
    </div>
  )
}
