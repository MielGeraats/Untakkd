import { useState, type FormEvent } from 'react'
import { ErrorBox } from '../components/BugNote'
import { LeafIcon } from '../components/Icons'
import { supabase } from '../lib/supabase'

// Supabase answers in English; translate the ones people actually run into.
const KNOWN = new Set<string>()
function dutchError(msg: string) {
  const m = msg.toLowerCase()
  const known = (t: string) => (KNOWN.add(t), t)
  if (m.includes('expired') || m.includes('invalid')) return known('Die code klopt niet of is verlopen. Vraag een nieuwe aan.')
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) return known('Rustig aan, cowboy. Wacht even en probeer het dan opnieuw.')
  if (m.includes('email')) return known('Dat e-mailadres klopt niet helemaal. Even checken?')
  return msg // unknown = probably a real bug
}

export function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setError(dutchError(error.message))
    setCode('')
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    // on success, AuthProvider picks up the new session and the app takes over
    if (error) setError(dutchError(error.message))
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex size-28 items-center justify-center rounded-[2rem] bg-leaf-100 shadow-inner">
        <LeafIcon className="size-20 text-leaf-600" />
      </div>
      <h1 className="text-5xl font-black tracking-tight">Untakkd</h1>
      <p className="mt-3 max-w-xs text-lg text-leaf-800/75">
        Check je sessies in. Geef de strain een cijfer. Kijk wat je maten roken.
      </p>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="mt-10 w-full max-w-xs space-y-3">
          <input
            type="email"
            required
            className="input text-center"
            placeholder="jij@voorbeeld.nl"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={busy || !email.trim()} className="btn btn-primary w-full py-3.5">
            {busy ? 'Versturen…' : 'Mail me een inlogcode'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-10 w-full max-w-xs space-y-3">
          <p className="text-sm text-leaf-800/75">
            Code is onderweg naar <span className="font-bold text-leaf-900">{email.trim()}</span>. Niks gezien? Check je spam. En als je dit leest: neem een pof.
          </p>
          <input
            required
            className="input text-center text-2xl font-black tracking-[0.4em]"
            placeholder="••••••"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          <button type="submit" disabled={busy || code.length < 6} className="btn btn-primary w-full py-3.5">
            {busy ? 'Even checken…' : 'Inloggen'}
          </button>
          <div className="flex justify-center gap-2 text-sm">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setError('') }}>
              Ander e-mailadres
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => sendCode()}>
              Code opnieuw sturen
            </button>
          </div>
        </form>
      )}
      {error && <ErrorBox bug={!KNOWN.has(error)} className="mt-4 max-w-xs">{error}</ErrorBox>}

      <p className="mt-12 max-w-xs text-xs text-leaf-800/50">
        Alleen voor 18+, en alleen waar het mag. Je check-ins zijn alleen zichtbaar voor je maten.
      </p>
    </div>
  )
}
