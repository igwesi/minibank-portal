import { useMemo, useState } from 'react'
import { Eye, EyeOff, Send, Smartphone, Wifi, Zap, Tv, RefreshCw, AlertTriangle } from 'lucide-react'
import { useBanking } from '../context/BankingStateContext'
import BalanceCard from '../components/BalanceCard'
import TransferModal from '../components/TransferModal'
import BillPayModal from '../components/BillPayModal'
import TransactionTable from '../components/TransactionTable'
import { formatMoney } from '../lib/format'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { profile, accounts, transactions, loading, error, hideBalances, toggleHide, refresh, freshIds } = useBanking()
  const [transferOpen, setTransferOpen] = useState(false)
  const [bill, setBill] = useState(null)

  const flows = useMemo(() => {
    const since = Date.now() - 30 * 864e5
    const f = {}
    for (const t of transactions) {
      if (new Date(t.created_at).getTime() < since) continue
      f[t.account_id] ??= { in: 0, out: 0 }
      f[t.account_id][t.direction === 'credit' ? 'in' : 'out'] += Number(t.amount)
    }
    return f
  }, [transactions])

  const ngnSpend = useMemo(() => {
    const ngnIds = new Set(accounts.filter((a) => a.currency === 'NGN').map((a) => a.id))
    const since = Date.now() - 30 * 864e5
    const by = {}
    transactions.forEach((t) => {
      if (t.direction !== 'debit' || !ngnIds.has(t.account_id) || new Date(t.created_at).getTime() < since) return
      by[t.category] = (by[t.category] ?? 0) + Number(t.amount)
    })
    const total = Object.values(by).reduce((a, b) => a + b, 0)
    return { total, rows: Object.entries(by).sort((a, b) => b[1] - a[1]) }
  }, [accounts, transactions])

  if (loading) return <DashboardSkeleton />

  const actions = [
    { label: 'Send money', icon: Send, onClick: () => setTransferOpen(true), primary: true },
    { label: 'Airtime', icon: Smartphone, onClick: () => setBill('airtime') },
    { label: 'Data', icon: Wifi, onClick: () => setBill('data') },
    { label: 'Electricity', icon: Zap, onClick: () => setBill('electricity') },
    { label: 'Cable TV', icon: Tv, onClick: () => setBill('cable') },
  ]

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">{greeting()},</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{profile?.full_name?.split(' ')[0] || 'there'} 👋</h1>
        </div>
        <div className="flex gap-1">
          <button onClick={refresh} className="btn-ghost p-2.5" title="Refresh" aria-label="Refresh"><RefreshCw className="size-[18px]" /></button>
          <button onClick={toggleHide} className="btn-ghost p-2.5" aria-label={hideBalances ? 'Show balances' : 'Hide balances'} title={hideBalances ? 'Show balances' : 'Hide balances'}>
            {hideBalances ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="size-4" />{error}</p>
      )}

      {/* Account summary cards — horizontal swipe on mobile, grid on desktop */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {accounts.map((a) => (
          <div key={a.id} className="w-[86%] shrink-0 snap-center sm:w-auto">
            <BalanceCard account={a} hidden={hideBalances} inflow={flows[a.id]?.in} outflow={flows[a.id]?.out} />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {actions.map((a) => (
          <button key={a.label} onClick={a.onClick}
            className={`group flex flex-col items-center gap-2 rounded-2xl border p-2.5 text-center text-[11px] font-semibold transition sm:flex-row sm:gap-3 sm:p-4 sm:text-left sm:text-sm ${a.primary ? 'border-brand-800 bg-brand-800 text-white hover:bg-brand-900' : 'border-stone-200 bg-white text-stone-700 hover:border-brand-600'}`}>
            <span className={`grid size-10 place-items-center rounded-xl ${a.primary ? 'bg-white/10' : 'bg-brand-50 text-brand-700'}`}><a.icon className="size-5" /></span>
            <span className="leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <TransactionTable transactions={transactions} accounts={accounts} hidden={hideBalances} freshIds={freshIds} />

        <aside className="card h-fit p-5">
          <h2 className="text-base font-bold">Naira spending</h2>
          <p className="text-xs text-stone-500">Last 30 days</p>
          <p className="mt-3 text-2xl font-extrabold tracking-tight">{hideBalances ? '••••' : formatMoney(ngnSpend.total)}</p>
          <ul className="mt-4 space-y-3">
            {ngnSpend.rows.length === 0 && <li className="text-sm text-stone-500">No spending yet.</li>}
            {ngnSpend.rows.map(([cat, amt]) => (
              <li key={cat}>
                <div className="mb-1 flex justify-between text-sm"><span className="capitalize text-stone-600">{cat === 'cable' ? 'Cable TV' : cat}</span><span className="font-semibold">{hideBalances ? '•••' : formatMoney(amt, 'NGN', { compact: true })}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(amt / ngnSpend.total) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
      <BillPayModal open={!!bill} initialType={bill ?? 'airtime'} onClose={() => setBill(null)} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-12 w-56 rounded-xl bg-stone-200" />
      <div className="grid gap-4 sm:grid-cols-2"><div className="h-52 rounded-3xl bg-stone-200" /><div className="hidden h-52 rounded-3xl bg-stone-200 sm:block" /></div>
      <div className="h-20 rounded-2xl bg-stone-200" />
      <div className="h-96 rounded-2xl bg-stone-200" />
    </div>
  )
}
