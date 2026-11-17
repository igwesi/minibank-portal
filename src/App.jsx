import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BankingStateProvider } from './context/BankingStateContext'
import { isConfigured } from './lib/supabase'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-dvh place-items-center"><div className="size-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="grid h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-bold">MiniBank isn’t configured</h1>
          <p className="mt-2 text-sm text-stone-600">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env</code> (or your hosting provider’s environment variables) and rebuild.</p>
        </div>
      </div>
    )
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><BankingStateProvider><AppShell /></BankingStateProvider></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
