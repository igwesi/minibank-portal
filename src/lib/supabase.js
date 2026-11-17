import { createClient } from '@supabase/supabase-js'

// Only the public URL and *publishable* key live in the browser.
// They are safe to expose: every table is protected by Row-Level Security,
// and balances can only change through server-side Postgres functions.
// Never put a service_role / secret key in VITE_* variables.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
