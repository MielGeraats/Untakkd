import { LeafIcon } from '../components/Icons'

export function SetupNeeded() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <LeafIcon className="mb-4 size-14 text-leaf-600" />
      <h1 className="text-3xl font-black">Bijna, maatje</h1>
      <p className="mt-3 text-leaf-800/80">
        Untakkd is nog niet gekoppeld aan een database. Maak een <code className="rounded bg-leaf-100 px-1">.env.local</code> bestand
        (kopie van <code className="rounded bg-leaf-100 px-1">.env.example</code>) met je Supabase URL en publishable key, en herstart
        de dev server. Op Vercel zet je dezelfde twee variabelen onder Project → Settings → Environment Variables.
      </p>
      <p className="mt-3 text-leaf-800/80">In de README staat het hele stappenplan.</p>
    </div>
  )
}
