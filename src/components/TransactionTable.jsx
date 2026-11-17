import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Download, Search, Smartphone, Wifi, Zap, Tv, Landmark, X, SlidersHorizontal } from 'lucide-react'
import { formatMoney, formatDate, relativeDay } from '../lib/format'

const CAT = {
  transfer: { label: 'Transfer', icon: null },
  airtime: { label: 'Airtime', icon: Smartphone },
  data: { label: 'Data', icon: Wifi },
  electricity: { label: 'Electricity', icon: Zap },
  cable: { label: 'Cable TV', icon: Tv },
  deposit: { label: 'Deposit', icon: Landmark },
}
const RANGES = { all: 'All time', 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' }
const PAGE = 15

export default function TransactionTable({ transactions, accounts, hidden, freshIds }) {
  const [q, setQ] = useState('')
  const [account, setAccount] = useState('all')
  const [direction, setDirection] = useState('all')
  const [category, setCategory] = useState('all')
  const [range, setRange] = useState('all')
  const [limit, setLimit] = useState(PAGE)
  const [showFilters, setShowFilters] = useState(false)

  const accById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const since = range === 'all' ? 0 : Date.now() - Number(range) * 864e5
    return transactions.filter((t) =>
      (account === 'all' || t.account_id === account) &&
      (direction === 'all' || t.direction === direction) &&
      (category === 'all' || t.category === category) &&
      new Date(t.created_at).getTime() >= since &&
      (!needle || [t.counterparty, t.narration, t.reference, CAT[t.category]?.label, String(t.amount)]
        .some((f) => f && String(f).toLowerCase().includes(needle))))
  }, [transactions, q, account, direction, category, range])

  const activeFilters = [account, direction, category, range].filter((v) => v !== 'all').length
  const reset = () => { setQ(''); setAccount('all'); setDirection('all'); setCategory('all'); setRange('all') }
  const shown = filtered.slice(0, limit)

  const exportCsv = () => {
    const rows = [['Date', 'Account', 'Type', 'Category', 'Counterparty', 'Narration', 'Amount', 'Currency', 'Balance after', 'Reference']]
    filtered.forEach((t) => {
      const a = accById[t.account_id]
      rows.push([new Date(t.created_at).toISOString(), a?.account_number, t.direction, t.category, t.counterparty, t.narration, t.amount, a?.currency, t.balance_after, t.reference])
    })
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `minibank-statement-${new Date().toISOString().slice(0, 10)}.csv` })
    link.click(); URL.revokeObjectURL(url)
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="ledger-h">
      <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="ledger-h" className="text-base font-bold">Transactions</h2>
            <p className="text-xs text-stone-500">{filtered.length} of {transactions.length} {activeFilters || q ? 'matching' : 'total'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFilters((s) => !s)} className={`btn-outline px-3 py-2 lg:hidden ${activeFilters ? 'border-brand-600 text-brand-700' : ''}`}>
              <SlidersHorizontal className="size-4" />{activeFilters > 0 && <span className="text-xs">{activeFilters}</span>}
            </button>
            <button onClick={exportCsv} className="btn-outline px-3 py-2" disabled={!filtered.length} title="Download CSV statement">
              <Download className="size-4" /><span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input type="search" className="input pl-10" placeholder="Search name, narration, reference or amount…" value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} aria-label="Search transactions" />
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-2 lg:grid lg:grid-cols-4`}>
          <Select label="Account" value={account} onChange={setAccount}
            options={[['all', 'All accounts'], ...accounts.map((a) => [a.id, `${a.currency} ··${a.account_number.slice(-4)}`])]} />
          <Select label="Type" value={direction} onChange={setDirection} options={[['all', 'Money in & out'], ['credit', 'Money in'], ['debit', 'Money out']]} />
          <Select label="Category" value={category} onChange={setCategory} options={[['all', 'All categories'], ...Object.entries(CAT).map(([k, v]) => [k, v.label])]} />
          <Select label="Date" value={range} onChange={setRange} options={Object.entries(RANGES)} />
        </div>
        {(activeFilters > 0 || q) && (
          <button onClick={reset} className="flex w-fit items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><X className="size-3" />Clear filters</button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Search className="mx-auto size-8 text-stone-300" />
          <p className="mt-3 font-semibold">No transactions found</p>
          <p className="text-sm text-stone-500">Try a different search or clear your filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3">Details</th>
                  <th className="hidden px-3 py-3 2xl:table-cell">Category</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shown.map((t) => {
                  const a = accById[t.account_id]
                  return (
                    <tr key={t.id} className={`hover:bg-stone-50/70 ${freshIds?.has(t.id) ? 'animate-flash' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <TxIcon t={t} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{t.counterparty?.split(' · ')[0] ?? '—'}</p>
                            <p className="truncate text-xs text-stone-500">{t.narration || <span className="font-mono">{t.reference}</span>}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-3.5 2xl:table-cell"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{CAT[t.category]?.label}</span></td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-stone-500" title={formatDate(t.created_at)}>{shortDate(t.created_at)}</td>
                      <td className={`whitespace-nowrap px-3 py-3.5 text-right font-semibold ${t.direction === 'credit' ? 'text-brand-700' : ''}`}>
                        {hidden ? '•••' : `${t.direction === 'credit' ? '+' : '−'}${formatMoney(t.amount, a?.currency)}`}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-stone-500">{hidden ? '•••' : formatMoney(t.balance_after, a?.currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list grouped by day */}
          <ul className="md:hidden">
            {shown.map((t, i) => {
              const a = accById[t.account_id]
              const day = relativeDay(t.created_at)
              const showHeader = i === 0 || relativeDay(shown[i - 1].created_at) !== day
              return (
                <li key={t.id}>
                  {showHeader && <p className="bg-stone-50 px-4 py-1.5 text-xs font-semibold text-stone-500">{day}</p>}
                  <div className={`flex items-center gap-3 px-4 py-3 ${freshIds?.has(t.id) ? 'animate-flash' : ''}`}>
                    <TxIcon t={t} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.counterparty?.split(' · ')[0] ?? '—'}</p>
                      <p className="truncate text-xs text-stone-500">{CAT[t.category]?.label}{t.narration ? ` · ${t.narration}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${t.direction === 'credit' ? 'text-brand-700' : ''}`}>
                        {hidden ? '•••' : `${t.direction === 'credit' ? '+' : '−'}${formatMoney(t.amount, a?.currency)}`}
                      </p>
                      <p className="text-[11px] text-stone-400">{new Date(t.created_at).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {filtered.length > limit && (
            <div className="border-t border-stone-100 p-3 text-center">
              <button className="btn-ghost text-brand-700" onClick={() => setLimit((l) => l + PAGE)}>Show more ({filtered.length - limit} remaining)</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function shortDate(iso) {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleString('en-NG', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit' })
}

function TxIcon({ t }) {
  const Icon = CAT[t.category]?.icon ?? (t.direction === 'credit' ? ArrowDownLeft : ArrowUpRight)
  const credit = t.direction === 'credit'
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${credit ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-600'}`}>
      <Icon className="size-[18px]" />
    </span>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <select aria-label={label} className="input py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}
