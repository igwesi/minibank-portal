import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { formatMoney } from '../lib/format'

const styles = {
  NGN: 'from-brand-800 via-brand-900 to-brand-950 text-white',
  USD: 'from-stone-800 via-stone-900 to-black text-white',
  GBP: 'from-indigo-800 via-indigo-900 to-indigo-950 text-white',
}

export default function BalanceCard({ account, hidden, inflow = 0, outflow = 0 }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(account.account_number); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <article className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 shadow-lg shadow-brand-950/10 sm:p-6 ${styles[account.currency] ?? styles.NGN}`}>
      {/* decorative rings */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border-[28px] border-white/[0.04]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-10 size-44 rounded-full border-[20px] border-white/[0.04]" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{account.nickname ?? account.account_type}</p>
          <p className="mt-0.5 text-xs uppercase tracking-widest text-white/45">{account.account_type} · {account.currency}</p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-brand-300">{account.currency === 'NGN' ? '₦' : account.currency === 'USD' ? '$' : '£'}</span>
      </div>

      <p className="relative mt-6 text-xs font-medium uppercase tracking-wider text-white/55">Available balance</p>
      <p className="relative mt-1 text-[2rem] font-extrabold leading-none tracking-tight sm:text-4xl" aria-live="polite">
        {hidden ? '••••••' : formatMoney(account.balance, account.currency)}
      </p>

      <div className="relative mt-6 flex items-end justify-between gap-3">
        <button onClick={copy} className="group flex items-center gap-2 rounded-lg font-mono text-sm text-white/80 transition hover:text-white" title="Copy account number">
          {account.account_number.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
          {copied ? <Check className="size-3.5 text-brand-300" /> : <Copy className="size-3.5 opacity-60 group-hover:opacity-100" />}
        </button>
        <div className="text-right text-[11px] leading-tight text-white/55">
          <div><span className="text-brand-300">↓</span> {hidden ? '•••' : formatMoney(inflow, account.currency, { compact: true })} in</div>
          <div><span className="text-rose-300">↑</span> {hidden ? '•••' : formatMoney(outflow, account.currency, { compact: true })} out</div>
        </div>
      </div>
    </article>
  )
}
