import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMe } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from './Avatar'
import { BellIcon, HomeIcon, LeafIcon, PlusIcon, UserIcon, UsersIcon } from './Icons'

export function Layout() {
  const me = useMe()
  const { pathname } = useLocation()
  const [requests, setRequests] = useState(0)
  const [tags, setTags] = useState(0)

  useEffect(() => {
    supabase.from('friendships').select('id', { count: 'exact', head: true })
      .eq('addressee_id', me.id).eq('status', 'pending')
      .then(({ count }) => setRequests(count ?? 0))
  }, [me.id, pathname])

  // New tags in other people's check-ins since you last opened Meldingen.
  useEffect(() => {
    supabase.from('checkin_people').select('id, checkin:checkins!inner(user_id)', { count: 'exact', head: true })
      .eq('user_id', me.id).neq('checkin.user_id', me.id).gt('created_at', me.notifications_seen_at ?? new Date().toISOString())
      .then(({ count }) => setTags(count ?? 0))
  }, [me.id, me.notifications_seen_at, pathname])

  useEffect(() => window.scrollTo(0, 0), [pathname])

  const tab = ({ isActive }: { isActive: boolean }) =>
    `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-extrabold transition ${isActive ? 'text-leaf-700' : 'text-leaf-800/45'}`

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-leaf-100/80 bg-leaf-50/80 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <LeafIcon className="size-7 text-leaf-600" />
            <span className="text-xl font-black tracking-tight">Untakkd</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/meldingen" aria-label={tags ? `Meldingen (${tags} nieuw)` : 'Meldingen'}
              className="relative rounded-full p-2 text-leaf-700 hover:bg-leaf-100">
              <BellIcon className="size-6" />
              {tags > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-black text-white">
                  {tags > 9 ? '9+' : tags}
                </span>
              )}
            </Link>
            <Link to="/settings" aria-label="Instellingen"><Avatar profile={me} size="sm" /></Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-32 pt-5">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-leaf-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-end px-2">
          <NavLink to="/" end className={tab}><HomeIcon className="size-6" />Feed</NavLink>
          <NavLink to="/strains" className={tab}><LeafIcon className="size-6" />Strains</NavLink>
          <div className="flex flex-1 justify-center">
            <NavLink to="/checkin/new" aria-label="Nieuwe check-in"
              className="-mt-6 mb-1.5 flex size-14 items-center justify-center rounded-full bg-leaf-600 text-white shadow-lg shadow-leaf-600/30 ring-4 ring-leaf-50 transition active:scale-95">
              <PlusIcon className="size-7" />
            </NavLink>
          </div>
          <NavLink to="/friends" className={tab}>
            <UsersIcon className="size-6" />Maten
            {requests > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-1 flex size-4 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white">{requests}</span>
            )}
          </NavLink>
          <NavLink to={`/u/${me.username}`} className={tab}><UserIcon className="size-6" />Profiel</NavLink>
        </div>
      </nav>
    </div>
  )
}
