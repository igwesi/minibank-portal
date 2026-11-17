import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, UserCheck } from 'lucide-react'
import Modal from './Modal'
import { useBanking } from '../context/BankingStateContext'
import { formatMoney, friendlyError, parseAmount, currencySymbol } from '../lib/format'

const QUICK = { NGN: [1000, 5000, 10000, 50000], USD: [10, 25, 50, 100], GBP: [10, 25, 50, 100] }

export default function TransferModal({ open, onClose, defaultAccountId }) {
  const { accounts, transfer, lookupAccount } = useBanking()
  const [step, setStep] = useState('form') // form | confirm | done
  const [fromId, setFromId] = useState('')
  const [toNumber, setToNumber] = useState('')
  const [recipient, setRecipient] = useState(null) // {account_name, currency} | 'notfound' | null
  const [looking, setLooking] = useState(false)
  const [amountText, setAmountText] = useState('')
  const [narration, setNarration] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    if (open) {
      setStep('form'); setToNumber(''); setRecipient(null); setAmountText(''); setNarration(''); setError(''); setReceipt(null)
      setFromId(defaultAccountId || accounts[0]?.id || '')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const source = accounts.find((a) => a.id === fromId)
  const amount = parseAmount(amountText)
  const isOwnAccount = accounts.some((a) => a.account_number === toNumber)

  // Name enquiry once 10 digits are entered
  useEffect(() => {
    setRecipient(null)
    if (!/^\d{10}$/.test(toNumber)) return
    let cancelled = false
    setLooking(true)
    lookupAccount(toNumber)
      .then((r) => !cancelled && setRecipient(r ?? 'notfound'))
      .catch(() => !cancelled && setRecipient('notfound'))
      .finally(() => !cancelled && setLooking(false))
    return () => { cancelled = true }
  }, [toNumber, lookupAccount])

  // Client-side validation (the server re-validates everything atomically)
  const validation = useMemo(() => {
    if (!source) return 'Select an account to debit'
    if (!/^\d{10}$/.test(toNumber)) return 'Enter a 10-digit account number'
    if (toNumber === source.account_number) return 'You cannot send to the same account'
    if (looking) return 'Verifying recipient…'
    if (recipient === 'notfound') return 'Recipient account not found'
    if (recipient && recipient.currency !== source.currency) return `Recipient holds a ${recipient.currency} account — choose a ${recipient.currency} source`
    if (!amountText) return 'Enter an amount'
    if (Number.isNaN(amount) || amount <= 0) return 'Enter a valid amount (max 2 decimals)'
    if (amount > Number(source.balance)) return `Insufficient funds — available ${formatMoney(source.balance, source.currency)}`
    return null
  }, [source, toNumber, looking, recipient, amountText, amount])

  const overdraft = source && amount > Number(source.balance)

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const res = await transfer({ fromAccountId: source.id, toAccountNumber: toNumber, amount, narration })
      setReceipt({ ...res, amount, currency: source.currency, to: toNumber })
      setStep('done')
    } catch (e) {
      setError(friendlyError(e)); setStep('form')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} busy={busy}
      title={step === 'done' ? 'Transfer successful' : step === 'confirm' ? 'Confirm transfer' : 'Send money'}
      subtitle={step === 'form' ? 'Instant transfer to any MiniBank account' : undefined}>

      {step === 'form' && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!validation) setStep('confirm') }} noValidate>
          <div>
            <label className="label" htmlFor="from">From</label>
            <select id="from" className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nickname} ({a.account_number.slice(-4)}) — {formatMoney(a.balance, a.currency)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="to">Recipient account number</label>
            <input id="to" className="input font-mono tracking-wider" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="0123456789"
              value={toNumber} onChange={(e) => setToNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            <div className="mt-1.5 min-h-5 text-sm">
              {looking && <span className="flex items-center gap-1.5 text-stone-500"><Loader2 className="size-3.5 animate-spin" /> Verifying…</span>}
              {recipient && recipient !== 'notfound' && (
                <span className="flex items-center gap-1.5 font-semibold text-brand-700"><UserCheck className="size-4" />{recipient.account_name}{isOwnAccount && ' (your account)'} · {recipient.currency}</span>
              )}
              {recipient === 'notfound' && <span className="text-rose-600">No MiniBank account with this number</span>}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="label" htmlFor="amt">Amount</label>
              {source && <span className="text-xs text-stone-500">Available: <b className="text-stone-700">{formatMoney(source.balance, source.currency)}</b></span>}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-stone-400">{currencySymbol(source?.currency)}</span>
              <input id="amt" className={`input pl-8 text-lg font-semibold ${overdraft ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15' : ''}`}
                inputMode="decimal" placeholder="0.00" value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))} aria-invalid={overdraft} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(QUICK[source?.currency] ?? QUICK.NGN).map((q) => (
                <button type="button" key={q} onClick={() => setAmountText(String(q))}
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:border-brand-600 hover:text-brand-700">
                  {formatMoney(q, source?.currency, { compact: true })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="narr">Narration <span className="font-normal text-stone-400">(optional)</span></label>
            <input id="narr" className="input" maxLength={60} placeholder="e.g. Rent, lunch, school fees" value={narration} onChange={(e) => setNarration(e.target.value)} />
          </div>

          {(error || (validation && amountText && toNumber.length === 10)) && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{error || validation}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={!!validation}>
            Continue <ArrowRight className="size-4" />
          </button>
        </form>
      )}

      {step === 'confirm' && source && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-stone-50 p-5 text-center">
            <p className="text-sm text-stone-500">You're sending</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatMoney(amount, source.currency)}</p>
            <p className="mt-2 text-sm text-stone-600">to <b>{recipient?.account_name}</b></p>
            <p className="font-mono text-xs text-stone-500">{toNumber}</p>
          </div>
          <dl className="space-y-2 text-sm">
            <Row k="From" v={`${source.nickname} · ${source.account_number}`} />
            <Row k="Fee" v={formatMoney(0, source.currency)} />
            {narration && <Row k="Narration" v={narration} />}
            <Row k="Balance after" v={formatMoney(Number(source.balance) - amount, source.currency)} />
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-outline py-3" onClick={() => setStep('form')} disabled={busy}>Back</button>
            <button className="btn-primary py-3" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} {busy ? 'Sending…' : 'Send now'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && receipt && (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-16 text-brand-600" strokeWidth={1.5} />
          <div>
            <p className="text-3xl font-extrabold tracking-tight">{formatMoney(receipt.amount, receipt.currency)}</p>
            <p className="mt-1 text-sm text-stone-600">sent to <b>{receipt.recipient}</b></p>
          </div>
          <dl className="space-y-2 rounded-2xl bg-stone-50 p-4 text-left text-sm">
            <Row k="Reference" v={<span className="font-mono text-xs">{receipt.reference}</span>} />
            <Row k="New balance" v={formatMoney(receipt.balance, receipt.currency)} />
          </dl>
          <button className="btn-primary w-full py-3" onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  )
}

function Row({ k, v }) {
  return <div className="flex justify-between gap-4"><dt className="text-stone-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
}
