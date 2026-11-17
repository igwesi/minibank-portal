import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Settings, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBanking } from '../context/BankingStateContext'

export function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#ffffff1a' : '#064e3b'} />
        <path d="M9 22V10l7 7 7-7v12" fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>MiniBank</span>
    </span>
  )
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppShell() {
  const { signOut } = useAuth()
  const { profile, live } = useBanking()
  const initials = (profile?.full_name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex">
        <div className="px-2"><Logo /></div>
        <nav className="mt-10 space-y-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-600 hover:bg-stone-100'}`}>
              <n.icon className="size-[18px]" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
            <ShieldCheck className="size-4 text-brand-600" /> Secured by RLS · TLS
          </div>
          <div className="flex items-center gap-3 px-2">
            <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile?.full_name}</p>
              <p className="flex items-center gap-1.5 text-xs text-stone-500"><span className={`size-1.5 rounded-full ${live ? 'bg-brand-500' : 'bg-stone-300'}`} />{live ? 'Live' : 'Connecting…'}</p>
            </div>
            <button onClick={signOut} className="btn-ghost p-2" title="Sign out" aria-label="Sign out"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/70 bg-stone-50/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{initials}</span>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand-800' : 'text-stone-500'}`}>
            <n.icon className="size-5" />{n.label}
          </NavLink>
        ))}
        <button onClick={signOut} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-stone-500"><LogOut className="size-5" />Sign out</button>
      </nav>
    </div>
  )
}
