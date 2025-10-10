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
    // ✅ Forçar fetch nativo do navegador
    fetch: typeof window !== 'undefined' ? window.fetch.bind(window) : undefined,
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
  
  // 🔍 Teste automático em produção com TIMEOUT
  if (import.meta.env.PROD) {
    console.log('[Supabase Test] Executando teste automático...')
    
    // Teste com timeout de 10s
    const testPromise = supabase.from('empresas').select('id').limit(1)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT: 10 segundos')), 10000)
    )
    
    Promise.race([testPromise, timeoutPromise])
      .then(({ data, error }) => {
        if (error) {
          console.error('[Supabase Test] ❌ ERRO:', error)
        } else {
          console.log('[Supabase Test] ✅ SUCESSO:', data)
        }
      })
      .catch(err => {
        console.error('[Supabase Test] ❌ TIMEOUT/EXCEPTION:', err.message)
        
        // Teste direto com fetch para comparar
        console.log('[Supabase Test] Tentando fetch direto...')
        fetch(`${supabaseUrl}/rest/v1/empresas?select=id&limit=1`, {
          headers: {
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json',
          }
        })
        .then(r => {
          console.log('[Supabase Test] Fetch status:', r.status)
          return r.json()
        })
        .then(d => console.log('[Supabase Test] Fetch data:', d))
        .catch(e => console.error('[Supabase Test] Fetch error:', e))
      })
  }
}