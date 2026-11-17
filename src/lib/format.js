const fmtCache = {}

export function formatMoney(amount, currency = 'NGN', { compact = false } = {}) {
  const k = `${currency}-${compact}`
  fmtCache[k] ??= new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard',
  })
  return fmtCache[k].format(Number(amount) || 0)
}

export const currencySymbol = (c) => ({ NGN: '₦', USD: '$', GBP: '£' })[c] ?? c

export function formatDate(iso, withTime = true) {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function relativeDay(iso) {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

export const maskAccount = (n) => (n ? `•••• ${n.slice(-4)}` : '')

// Parse a user-typed amount like "12,500.50" → 12500.5 (or NaN)
export function parseAmount(s) {
  if (typeof s === 'number') return s
  const clean = String(s ?? '').replace(/[,\s₦$£]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN
  return Number(clean)
}

// Supabase/Postgres errors → short human messages
export function friendlyError(err) {
  const msg = err?.message || String(err)
  if (/Invalid login credentials/i.test(msg)) return 'Incorrect email or password.'
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email address first — check your inbox.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Network error. Check your connection and try again.'
  return msg.replace(/^.*?ERROR:\s*/i, '')
}
