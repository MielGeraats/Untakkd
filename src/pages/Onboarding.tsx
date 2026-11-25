import { Avatar } from '../components/Avatar'
import { ProfileForm } from '../components/ProfileForm'
import { useAuth } from '../lib/auth'

export function Onboarding() {
  const { profile } = useAuth()
  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <Avatar profile={profile} size="lg" />
        <h1 className="mt-4 text-3xl font-black">Heeey maatje, welkom bij Untakkd 🌿</h1>
        <p className="mt-2 text-leaf-800/70">Kies een gebruikersnaam, dan kunnen je maten je vinden.</p>
      </div>
      <div className="card p-5"><ProfileForm submitLabel="Hup, aan de slag" /></div>
    </div>
  )
}
