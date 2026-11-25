import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'

export type Friendship = {
  id: number
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  requester: Profile
  addressee: Profile
}

export type Relation =
  | { kind: 'self' }
  | { kind: 'none' }
  | { kind: 'friends' | 'incoming' | 'outgoing'; row: Friendship }

export async function fetchFriendships(): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Friendship[]
}

export function splitFriendships(rows: Friendship[], me: string) {
  const other = (r: Friendship) => (r.requester_id === me ? r.addressee : r.requester)
  return {
    friends: rows.filter((r) => r.status === 'accepted').map(other)
      .sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? '')),
    incoming: rows.filter((r) => r.status === 'pending' && r.addressee_id === me).map((row) => ({ row, profile: row.requester })),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requester_id === me).map((row) => ({ row, profile: row.addressee })),
  }
}

export function relationTo(rows: Friendship[], me: string, other: string): Relation {
  if (me === other) return { kind: 'self' }
  const row = rows.find((r) => (r.requester_id === other && r.addressee_id === me) || (r.addressee_id === other && r.requester_id === me))
  if (!row) return { kind: 'none' }
  if (row.status === 'accepted') return { kind: 'friends', row }
  return { kind: row.addressee_id === me ? 'incoming' : 'outgoing', row }
}

export const sendRequest = (addressee_id: string) => supabase.from('friendships').insert({ addressee_id })
export const acceptRequest = (id: number) => supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
export const removeFriendship = (id: number) => supabase.from('friendships').delete().eq('id', id)

export function useFriendships() {
  const [rows, setRows] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try {
      setRows(await fetchFriendships())
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { rows, loading, reload }
}
