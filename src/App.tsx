import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/Spinner'
import { useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
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
  const { session, profile, loading } = useAuth()

  if (!isConfigured) return <SetupNeeded />
  if (loading) return <Spinner label="Even eentje draaien…" />
  if (!session) return <Login />
  if (!profile) return <Spinner label="Je profiel wordt opgehaald…" />
  if (!profile.username) return <Onboarding />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="checkin/new" element={<NewCheckin />} />
        <Route path="checkin/:id" element={<CheckinDetail />} />
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
