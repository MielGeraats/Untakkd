import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useEffect, useState } from 'react'
import { Spinner } from './components/Spinner'
import { useAuth } from './lib/auth'
import { isConfigured, supabase } from './lib/supabase'
import { CheckinDetail } from './pages/CheckinDetail'
import { Feed } from './pages/Feed'
import { Friends } from './pages/Friends'
import { Login } from './pages/Login'
import { NewCheckin } from './pages/NewCheckin'
import { Onboarding } from './pages/Onboarding'
import { ProfilePage } from './pages/Profile'
import { Settings } from './pages/Settings'
import { SetupNeeded } from './pages/SetupNeeded'
import { StrainDetail } from './pages/StrainDetail'
import { Strains } from './pages/Strains'

export default function App() {
  const { session, profile, loading, profileError, refreshProfile } = useAuth()
  const [slow, setSlow] = useState(false)
  const [tries, setTries] = useState(0)

  // If the profile hasn't shown up after a while, offer a way out instead of spinning forever.
  useEffect(() => {
    setSlow(false)
    if (!session || profile) return
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [session, profile, tries])

  if (!isConfigured) return <SetupNeeded />
  if (loading) return <Spinner label="Even eentje draaien…" />
  if (!session) return <Login />
  if (!profile) {
    if (!profileError && !slow) return <Spinner label="Je profiel wordt opgehaald…" />
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <div className="mb-3 text-5xl">😵‍💫</div>
        <h1 className="text-2xl font-black">Oeps, je profiel laadt niet</h1>
        <p className="mt-2 text-sm text-leaf-800/70">Probeer het opnieuw, of log uit en weer in.</p>
        {profileError && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs text-red-700">{profileError}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => { setTries((n) => n + 1); refreshProfile() }}>Opnieuw proberen</button>
          <button className="btn btn-soft btn-sm" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
        </div>
      </div>
    )
  }
  if (!profile.username) return <Onboarding />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="checkin/new" element={<NewCheckin key="new" />} />
        <Route path="checkin/:id" element={<CheckinDetail />} />
        <Route path="checkin/:id/edit" element={<NewCheckin key="edit" />} />
        <Route path="u/:username" element={<ProfilePage />} />
        <Route path="friends" element={<Friends />} />
        <Route path="strains" element={<Strains />} />
        <Route path="strains/:id" element={<StrainDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
