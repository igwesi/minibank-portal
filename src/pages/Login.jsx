import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, MailCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/AppShell'
import { friendlyError } from '../lib/format'

// Public demo login (sandbox data only — not real banking credentials)
const DEMO = { email: 'demo@minibank.app', password: 'MiniBank#2026' }

export default function Login() {
  const { user, signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | reset
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' })
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (user) return <Navigate to="/" replace />
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice('')
    if (mode === 'signup') {
      if (form.fullName.trim().length < 3) return setError('Enter your full name')
      if (form.phone && !/^0[789][01]\d{8}$/.test(form.phone)) return setError('Enter a valid 11-digit Nigerian phone number')
      if (form.password.length < 8 || !/\d/.test(form.password) || !/[A-Za-z]/.test(form.password)) return setError('Password must be 8+ characters with letters and numbers')
    }
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(form.email.trim(), form.password)
      else if (mode === 'signup') {
        const { needsConfirmation } = await signUp({ email: form.email.trim(), password: form.password, fullName: form.fullName.trim(), phone: form.phone || null })
        if (needsConfirmation) { setNotice(`We sent a confirmation link to ${form.email}. Click it, then sign in.`); setMode('signin') }
      } else {
        await resetPassword(form.email.trim())
        setNotice('If that email has an account, a reset link is on its way.')
        setMode('signin')
      }
    } catch (err) { setError(friendlyError(err)) } finally { setBusy(false) }
  }

  const useDemo = async () => {
    setForm((f) => ({ ...f, ...DEMO })); setError(''); setBusy(true)
    try { await signIn(DEMO.email, DEMO.password) } catch (err) { setError(friendlyError(err)) } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col">
        <Logo light />
        <div className="relative z-10 my-auto max-w-md">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">Banking that moves at the speed of you.</h1>
          <p className="mt-5 text-lg text-white/65">Naira and dollar accounts, instant transfers, airtime and bills — in one secure place.</p>
          <ul className="mt-10 space-y-3 text-sm text-white/75">
            {['Instant transfers between MiniBank accounts', 'Airtime, data, electricity & cable TV', 'Real-time balances and searchable statements'].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid size-5 place-items-center rounded-full bg-brand-500/20 text-brand-300">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-xs text-white/40"><Lock className="size-3.5" /> Demo environment — no real money is moved.</p>
        <div aria-hidden className="absolute -bottom-40 -right-40 size-[520px] rounded-full border-[70px] border-white/[0.03]" />
        <div aria-hidden className="absolute -right-10 top-24 size-72 rounded-full bg-brand-500/10 blur-3xl" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Open an account' : 'Reset password'}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {mode === 'signin' ? 'Sign in to your MiniBank account.' : mode === 'signup' ? 'Takes less than a minute. Comes with demo funds.' : 'We’ll email you a secure reset link.'}
          </p>

          {notice && <p className="mt-6 flex gap-2 rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-800"><MailCheck className="mt-0.5 size-4 shrink-0" />{notice}</p>}

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="label" htmlFor="name">Full name</label>
                  <input id="name" className="input" autoComplete="name" required value={form.fullName} onChange={set('fullName')} placeholder="Adaeze Nwosu" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Phone <span className="font-normal text-stone-400">(optional)</span></label>
                  <input id="phone" className="input" inputMode="tel" autoComplete="tel" maxLength={11} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} placeholder="08012345678" />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
            </div>
            {mode !== 'reset' && (
              <div>
                <div className="flex justify-between">
                  <label className="label" htmlFor="pw">Password</label>
                  {mode === 'signin' && <button type="button" onClick={() => { setMode('reset'); setError('') }} className="text-xs font-semibold text-brand-700 hover:underline">Forgot?</button>}
                </div>
                <div className="relative">
                  <input id="pw" type={showPw ? 'text' : 'password'} className="input pr-11" required minLength={mode === 'signup' ? 8 : 1}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">{error}</p>}

            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          {mode === 'signin' && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
              <button onClick={useDemo} disabled={busy} className="btn-outline w-full py-3"><Sparkles className="size-4 text-brand-600" />Explore with demo account</button>
            </>
          )}

          <p className="mt-8 text-center text-sm text-stone-500">
            {mode === 'signin' ? <>New to MiniBank? <button onClick={() => { setMode('signup'); setError(''); setNotice('') }} className="font-semibold text-brand-700 hover:underline">Open an account</button></>
              : <>Already have an account? <button onClick={() => { setMode('signin'); setError('') }} className="font-semibold text-brand-700 hover:underline">Sign in</button></>}
          </p>
        </div>
      </div>
    </div>
  )
}
