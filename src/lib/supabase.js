import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Ajuda a diagnosticar ambientes no Vercel com ENV faltando
  // eslint-disable-next-line no-console
  console.warn('[Supabase] Variáveis de ambiente ausentes: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

// Expor para depuração no navegador (somente client-side)
if (typeof window !== 'undefined') {
  // não quebra se já existir
  window.__supabase = supabase;
}