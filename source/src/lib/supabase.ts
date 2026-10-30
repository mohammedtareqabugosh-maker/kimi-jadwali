import { createClient } from '@supabase/supabase-js'

// The values below are the project's public URL and publishable browser key.
// Environment variables can override them for preview or local development.
const url = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://chcapjgjvvwpljgdffpg.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_9dzltRprFtyXPyg0Iul3aQ_4SU1VTG9'

export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null
