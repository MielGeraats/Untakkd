import { useState } from 'react'
import { acceptRequest, removeFriendship, sendRequest, type Relation } from '../lib/friends'

export function FriendButton({ relation, userId, onChange }: { relation: Relation; userId: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => PromiseLike<unknown>) => {
    setBusy(true)
    await fn()
    await onChange()
    setBusy(false)
  }
  switch (relation.kind) {
    case 'self':
      return null
    case 'none':
      return <button disabled={busy} className="btn btn-primary btn-sm" onClick={() => run(() => sendRequest(userId))}>＋ Maatje worden</button>
    case 'outgoing':
      return <button disabled={busy} className="btn btn-soft btn-sm" onClick={() => run(() => removeFriendship(relation.row.id))}>Verzoek gestuurd · terug</button>
    case 'incoming':
      return (
        <span className="flex gap-2">
          <button disabled={busy} className="btn btn-primary btn-sm" onClick={() => run(() => acceptRequest(relation.row.id))}>Accepteren</button>
          <button disabled={busy} className="btn btn-ghost btn-sm" onClick={() => run(() => removeFriendship(relation.row.id))}>Nee bedankt</button>
        </span>
      )
    case 'friends':
      return (
        <button disabled={busy} className="btn btn-soft btn-sm"
          onClick={() => confirm('Deze maat echt dumpen? 💔') && run(() => removeFriendship(relation.row.id))}>Maten ✓</button>
      )
  }
}
