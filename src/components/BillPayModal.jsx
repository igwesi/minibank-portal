import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Smartphone, Wifi, Zap, Tv } from 'lucide-react'
import Modal from './Modal'
import { useBanking } from '../context/BankingStateContext'
import { formatMoney, friendlyError, parseAmount } from '../lib/format'

export const BILL_TYPES = {
  airtime: { label: 'Airtime', icon: Smartphone, billers: ['MTN', 'Airtel', 'Glo', '9mobile'], refLabel: 'Phone number', refHint: '08031234567', quick: [100, 200, 500, 1000, 2000] },
  data: { label: 'Data', icon: Wifi, billers: ['MTN', 'Airtel', 'Glo', '9mobile'], refLabel: 'Phone number', refHint: '08031234567', quick: [500, 1000, 2000, 3500, 5000] },
  electricity: { label: 'Electricity', icon: Zap, billers: ['Ikeja Electric (IKEDC)', 'Eko Electric (EKEDC)', 'Abuja Electric (AEDC)', 'Port Harcourt Electric (PHED)', 'Ibadan Electric (IBEDC)'], refLabel: 'Meter number', refHint: '45071234567', quick: [2000, 5000, 10000, 20000] },
  cable: { label: 'Cable TV', icon: Tv, billers: ['DStv', 'GOtv', 'StarTimes', 'Showmax'], refLabel: 'Smartcard / IUC number', refHint: '7023456781', quick: [4850, 9800, 15700, 24500] },
}
const PHONE_RE = /^0[789][01]\d{8}$/

export default function BillPayModal({ open, onClose, initialType = 'airtime' }) {
  const { accounts, payBill, profile } = useBanking()
  const ngnAccounts = accounts.filter((a) => a.currency === 'NGN')
  const [type, setType] = useState(initialType)
  const [fromId, setFromId] = useState('')
  const [biller, setBiller] = useState('')
  const [ref, setRef] = useState('')
  const [amountText, setAmountText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    if (open) {
      setType(initialType); setAmountText(''); setError(''); setReceipt(null)
      setFromId(ngnAccounts[0]?.id ?? '')
    }
  }, [open, initialType]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cfg = BILL_TYPES[type]
    setBiller(cfg.billers[0])
    setRef((type === 'airtime' || type === 'data') ? (profile?.phone ?? '') : '')
  }, [type, profile?.phone])

  const cfg = BILL_TYPES[type]
  const source = accounts.find((a) => a.id === fromId)
  const amount = parseAmount(amountText)
  const isPhone = type === 'airtime' || type === 'data'

  const validation = useMemo(() => {
    if (!source) return 'You need a Naira account to pay bills'
    if (!ref) return `Enter ${cfg.refLabel.toLowerCase()}`
    if (isPhone && !PHONE_RE.test(ref)) return 'Enter a valid 11-digit Nigerian phone number'
    if (!isPhone && ref.length < 6) return `Enter a valid ${cfg.refLabel.toLowerCase()}`
    if (!amountText) return 'Enter an amount'
    if (Number.isNaN(amount) || amount <= 0) return 'Enter a valid amount'
    if (type === 'airtime' && amount < 50) return 'Minimum airtime is ₦50'
    if (amount > Number(source.balance)) return `Insufficient funds — available ${formatMoney(source.balance)}`
    return null
  }, [source, ref, isPhone, cfg, amountText, amount, type])

  const submit = async (e) => {
    e.preventDefault()
    if (validation) return
    setBusy(true); setError('')
    try {
      const res = await payBill({ fromAccountId: source.id, category: type, biller, customerRef: ref, amount })
      setReceipt({ ...res, amount })
    } catch (err) { setError(friendlyError(err)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} busy={busy} title={receipt ? 'Payment successful' : 'Pay bills'} subtitle={receipt ? undefined : 'Airtime, data, electricity and cable TV'}>
      {receipt ? (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-16 text-brand-600" strokeWidth={1.5} />
          <div>
            <p className="text-3xl font-extrabold tracking-tight">{formatMoney(receipt.amount)}</p>
            <p className="mt-1 text-sm text-stone-600">{cfg.label} · {biller} · <span className="font-mono">{ref}</span></p>
          </div>
          <dl className="space-y-2 rounded-2xl bg-stone-50 p-4 text-left text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Reference</dt><dd className="font-mono text-xs">{receipt.reference}</dd></div>
            {type === 'electricity' && <div className="flex justify-between"><dt className="text-stone-500">Token (demo)</dt><dd className="font-mono text-xs">{receipt.reference.slice(-12).replace(/(.{4})/g, '$1 ')}</dd></div>}
            <div className="flex justify-between"><dt className="text-stone-500">New balance</dt><dd className="font-medium">{formatMoney(receipt.balance)}</dd></div>
          </dl>
          <button className="btn-primary w-full py-3" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="grid grid-cols-4 gap-2" role="tablist">
            {Object.entries(BILL_TYPES).map(([k, v]) => (
              <button type="button" key={k} role="tab" aria-selected={type === k} onClick={() => setType(k)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-xs font-semibold transition ${type === k ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                <v.icon className="size-5" />{v.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="biller">Provider</label>
              <select id="biller" className="input" value={biller} onChange={(e) => setBiller(e.target.value)}>
                {cfg.billers.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="bfrom">Pay from</label>
              <select id="bfrom" className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {ngnAccounts.map((a) => <option key={a.id} value={a.id}>{a.nickname} — {formatMoney(a.balance, 'NGN', { compact: true })}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="ref">{cfg.refLabel}</label>
            <input id="ref" className="input font-mono tracking-wide" inputMode="numeric" placeholder={cfg.refHint} maxLength={isPhone ? 11 : 13}
              value={ref} onChange={(e) => setRef(e.target.value.replace(/\D/g, ''))} />
          </div>

          <div>
            <label className="label" htmlFor="bamt">Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-stone-400">₦</span>
              <input id="bamt" className="input pl-8 text-lg font-semibold" inputMode="decimal" placeholder="0.00"
                value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {cfg.quick.map((q) => (
                <button type="button" key={q} onClick={() => setAmountText(String(q))}
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:border-brand-600 hover:text-brand-700">
                  {formatMoney(q, 'NGN', { compact: true })}
                </button>
              ))}
            </div>
          </div>

          {(error || (validation && amountText)) && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{error || validation}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={!!validation || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Processing…' : `Pay ${amount > 0 ? formatMoney(amount) : ''}`}
          </button>
        </form>
      )}
    </Modal>
  )
}
