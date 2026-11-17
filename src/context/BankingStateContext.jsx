import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const BankingStateContext = createContext(null)

export function BankingStateProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [freshIds, setFreshIds] = useState(() => new Set())
  const [hideBalances, setHideBalances] = useState(() => localStorageGet('mb.hide') === '1')
  const [live, setLive] = useState(false)
  const channelRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!user) return
    setError(null)
    const [p, a, t] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('accounts').select('*').order('created_at'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    const err = p.error || a.error || t.error
    if (err) setError(err.message)
    else {
      setProfile(p.data)
      setAccounts(a.data)
      setTransactions(t.data)
    }
    setLoading(false)
  }, [user])

  // Initial load + realtime subscription (RLS ensures we only receive our own rows)
  useEffect(() => {
    if (!user) {
      setAccounts([]); setTransactions([]); setProfile(null); setLoading(true)
      return
    }
    refresh()
    const ch = supabase
      .channel(`bank-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'accounts', filter: `user_id=eq.${user.id}` },
        ({ new: row }) => setAccounts((prev) => prev.map((a) => (a.id === row.id ? row : a))))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        ({ new: row }) => {
          setTransactions((prev) => (prev.some((t) => t.id === row.id) ? prev : [row, ...prev]))
          setFreshIds((s) => new Set(s).add(row.id))
          setTimeout(() => setFreshIds((s) => { const n = new Set(s); n.delete(row.id); return n }), 4000)
        })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [user, refresh])

  // Server-validated operations. The Postgres functions lock the account row,
  // re-check the balance and reject overdrafts atomically.
  const transfer = useCallback(async ({ fromAccountId, toAccountNumber, amount, narration }) => {
    const { data, error } = await supabase.rpc('transfer_funds', {
      p_from_account: fromAccountId,
      p_to_account_number: toAccountNumber,
      p_amount: amount,
      p_narration: narration || null,
    })
    if (error) throw error
    await refresh()
    return data
  }, [refresh])

  const payBill = useCallback(async ({ fromAccountId, category, biller, customerRef, amount }) => {
    const { data, error } = await supabase.rpc('pay_bill', {
      p_from_account: fromAccountId,
      p_category: category,
      p_biller: biller,
      p_customer_ref: customerRef,
      p_amount: amount,
    })
    if (error) throw error
    await refresh()
    return data
  }, [refresh])

  const lookupAccount = useCallback(async (accountNumber) => {
    const { data, error } = await supabase.rpc('lookup_account', { p_account_number: accountNumber })
    if (error) throw error
    return data?.[0] ?? null
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data)
  }, [user])

  const toggleHide = useCallback(() => {
    setHideBalances((h) => { localStorageSet('mb.hide', h ? '0' : '1'); return !h })
  }, [])

  const value = useMemo(() => ({
    profile, accounts, transactions, loading, error, live, freshIds, hideBalances,
    refresh, transfer, payBill, lookupAccount, updateProfile, toggleHide,
  }), [profile, accounts, transactions, loading, error, live, freshIds, hideBalances,
      refresh, transfer, payBill, lookupAccount, updateProfile, toggleHide])

  return <BankingStateContext.Provider value={value}>{children}</BankingStateContext.Provider>
}

export const useBanking = () => useContext(BankingStateContext)

function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
