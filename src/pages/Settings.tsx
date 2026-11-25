import { ProfileForm } from '../components/ProfileForm'
import { supabase } from '../lib/supabase'

export function Settings() {
  return (
    <div>
      <h1 className="page-title">Instellingen</h1>
      <div className="card p-5"><ProfileForm submitLabel="Opslaan" /></div>
      <div className="card mt-4 space-y-3 p-5 text-sm text-leaf-800/70">
        <p className="font-bold text-leaf-900">Zet de app op je telefoon</p>
        <p><b>iPhone:</b> open deze site in Safari → Deel → <i>Zet op beginscherm</i>.</p>
        <p><b>Android:</b> Chrome-menu ⋮ → <i>App installeren</i> / <i>Toevoegen aan startscherm</i>.</p>
      </div>
      <button className="btn btn-danger mt-4 w-full" onClick={() => supabase.auth.signOut()}>Uitloggen (doei 👋)</button>
    </div>
  )
}
