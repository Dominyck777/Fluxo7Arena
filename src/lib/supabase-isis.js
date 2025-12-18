import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL_ISIS
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY_ISIS

if (!url || !anon) {
  // Log mínimo para facilitar debug sem expor valores
  try { console.error('[Supabase ISIS] Variáveis ausentes: VITE_SUPABASE_URL_ISIS / VITE_SUPABASE_ANON_KEY_ISIS') } catch {}
}

export const supabaseIsis = createClient(url, anon, {
  auth: {
    persistSession: false,
    // Evita compartilhar storage com o cliente principal e suprime o warning
    storageKey: 'isis-auth',
    storage: undefined,
    detectSessionInUrl: false,
    autoRefreshToken: false,
  },
  global: { 
    headers: { 'X-Client-Info': 'fluxo7-isis-web' } 
  },
})
