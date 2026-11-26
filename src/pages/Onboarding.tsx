import { ProfileForm } from '../components/ProfileForm'

export function Onboarding() {
  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="text-5xl">🌿</div>
        <h1 className="mt-3 text-3xl font-black">Heeey maatje, welkom bij Untakkd 🌿</h1>
        <p className="mt-2 text-leaf-800/70">Kies een gebruikersnaam, dan kunnen je maten je vinden.</p>
      </div>
      <div className="card p-5"><ProfileForm submitLabel="Hup, aan de slag" /></div>
    </div>
  )
}
