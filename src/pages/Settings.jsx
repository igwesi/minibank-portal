import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, LogOut, ShieldCheck, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBanking } from '../context/BankingStateContext'
import { supabase } from '../lib/supabase'
import { formatDate, friendlyError } from '../lib/format'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { profile, accounts, updateProfile } = useBanking()
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pw, setPw] = useState('')
  const [pwMsg, setPwMsg] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => { if (profile) setForm({ full_name: profile.full_name ?? '', phone: profile.phone ?? '' }) }, [profile])

  const save = async (e) => {
    e.preventDefault(); setMsg(null)
    if (form.full_name.trim().length < 3) return setMsg({ err: true, text: 'Enter your full name' })
    if (form.phone && !/^0[789][01]\d{8}$/.test(form.phone)) return setMsg({ err: true, text: 'Enter a valid 11-digit Nigerian phone number' })
    setSaving(true)
    try { await updateProfile({ full_name: form.full_name.trim(), phone: form.phone || null }); setMsg({ text: 'Profile updated' }) }
    catch (err) { setMsg({ err: true, text: friendlyError(err) }) } finally { setSaving(false) }
  }

  const changePw = async (e) => {
    e.preventDefault(); setPwMsg(null)
    if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) return setPwMsg({ err: true, text: 'Use 8+ characters with letters and numbers' })
    if (user?.email === 'demo@minibank.app') return setPwMsg({ err: true, text: 'The shared demo account password can’t be changed.' })
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setPwMsg({ err: true, text: friendlyError(error) }); else { setPw(''); setPwMsg({ text: 'Password changed' }) }
  }

  const copy = async (n) => { try { await navigator.clipboard.writeText(n); setCopied(n); setTimeout(() => setCopied(null), 1500) } catch { /* ignore */ } }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-stone-500">Manage your profile, accounts and security.</p>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-bold">Profile</h2>
        <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fn">Full name</label>
            <input id="fn" className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="ph">Phone</label>
            <input id="ph" className="input" inputMode="tel" maxLength={11} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="em">Email</label>
            <input id="em" className="input" value={user?.email ?? ''} disabled />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Save changes</button>
            {msg && <span className={`text-sm ${msg.err ? 'text-rose-600' : 'text-brand-700'}`}>{msg.text}</span>}
          </div>
        </form>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-bold">Accounts</h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{a.nickname}</p>
                <p className="text-xs capitalize text-stone-500">{a.account_type} · {a.currency} · opened {formatDate(a.created_at, false)}</p>
              </div>
              <button onClick={() => copy(a.account_number)} className="btn-outline px-3 py-1.5 font-mono text-sm">
                {a.account_number}{copied === a.account_number ? <Check className="size-3.5 text-brand-600" /> : <Copy className="size-3.5 text-stone-400" />}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><KeyRound className="size-4" />Change password</h2>
        <form onSubmit={changePw} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input type="password" className="input sm:max-w-xs" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn-outline">Update password</button>
        </form>
        {pwMsg && <p className={`mt-2 text-sm ${pwMsg.err ? 'text-rose-600' : 'text-brand-700'}`}>{pwMsg.text}</p>}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-brand-600" />How your data is protected</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-stone-600">
          <li>Row-Level Security: you can only ever read your own accounts and transactions.</li>
          <li>Balances can’t be edited from the browser — transfers and bill payments run in server-side database functions that lock the account and reject overdrafts.</li>
          <li>Passwords are hashed by Supabase Auth; no secrets are stored in the app’s code.</li>
        </ul>
      </section>

      <button onClick={signOut} className="btn-outline text-rose-600"><LogOut className="size-4" />Sign out</button>
    </div>
  )
}
