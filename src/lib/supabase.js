import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 🔍 DEBUG: Verificar variáveis de ambiente
console.log('[Supabase Init] URL:', supabaseUrl ? '✅ OK' : '❌ FALTANDO')
console.log('[Supabase Init] Key:', supabaseAnonKey ? '✅ OK' : '❌ FALTANDO')
console.log('[Supabase Init] Env Mode:', import.meta.env.MODE)
console.log('[Supabase Init] All Env:', Object.keys(import.meta.env))

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] ❌ ERRO CRÍTICO: Variáveis de ambiente ausentes!')
  console.error('[Supabase] VITE_SUPABASE_URL:', supabaseUrl)
  console.error('[Supabase] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'presente' : 'ausente')
  // Lançar erro para facilitar debug
  throw new Error('Supabase: Variáveis de ambiente não configuradas!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': 'fluxo7arena-web',
    },
  },
  db: {
    schema: 'public',
  },
  // ✅ Timeout e retry para produção
  realtime: {
    timeout: 30000,
  },
})

// 🔍 DEBUG: Verificar client criado
console.log('[Supabase Init] Client criado:', !!supabase)
console.log('[Supabase Init] Client from:', typeof supabase.from)
console.log('[Supabase Init] Client URL:', supabase?.supabaseUrl)

// Expor para depuração no navegador (somente client-side)
if (typeof window !== 'undefined') {
  window.__supabase = supabase;
  console.log('[Supabase Init] ✅ Exposto em window.__supabase')
  
  // 🔍 Teste automático em produção
  if (import.meta.env.PROD) {
    console.log('[Supabase Test] Executando teste automático...')
    supabase.from('empresas').select('id').limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Supabase Test] ❌ ERRO:', error)
        } else {
          console.log('[Supabase Test] ✅ SUCESSO:', data)
        }
      })
      .catch(err => {
        console.error('[Supabase Test] ❌ EXCEPTION:', err)
      })
  }
}