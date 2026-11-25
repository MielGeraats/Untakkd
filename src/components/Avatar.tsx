import type { Profile } from '../lib/types'

const SIZES = { xs: 'size-6 text-[10px]', sm: 'size-9 text-sm', md: 'size-11 text-base', lg: 'size-20 text-2xl' }

export function Avatar({ profile, size = 'md' }: { profile: Pick<Profile, 'avatar_url' | 'display_name' | 'username'> | null; size?: keyof typeof SIZES }) {
  const name = profile?.display_name || profile?.username || '?'
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return profile?.avatar_url ? (
    <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer"
      className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white`} />
  ) : (
    <span className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-leaf-200 font-black text-leaf-800 ring-2 ring-white`}>
      {initials}
    </span>
  )
}
