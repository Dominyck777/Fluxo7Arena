import { createClient } from '@supabase/supabase-js'
import { supabaseWrapper } from './supabase-fetch-wrapper'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[Supabase Init] URL:', supabaseUrl ? '✅ OK' : '❌ FALTANDO')
console.log('[Supabase Init] Key:', supabaseAnonKey ? '✅ OK' : '❌ FALTANDO')
console.log('[Supabase Init] Env Mode:', import.meta.env.MODE)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] ❌ ERRO CRÍTICO: Variáveis de ambiente ausentes!')
  throw new Error('Supabase: Variáveis de ambiente não configuradas!')
}

// Client original (para dev e auth)
const originalClient = createClient(supabaseUrl, supabaseAnonKey, {
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
})

// Disponibiliza o auth original dentro do wrapper para que ele consiga acessar a sessão atual
try {
  if (typeof window !== 'undefined') {
    // supabaseWrapper é importado acima e exportado de supabase-fetch-wrapper.js
    // Aqui garantimos que o wrapper possa consultar o token via getSession()
    // sem depender de uma chave fixa no localStorage
    // eslint-disable-next-line no-undef
    if (supabaseWrapper) {
      supabaseWrapper.auth = originalClient.auth
    }
  }
} catch {}

// 🔧 WORKAROUND: Em produção, usar wrapper com fetch direto
// O @supabase/supabase-js quebra com minificação do Vite no Netlify/Vercel
export const supabase = import.meta.env.PROD ? {
  // Queries usando wrapper (fetch direto)
  from: (table) => supabaseWrapper.from(table),
  
  // Auth usando client original (auth funciona)
  auth: originalClient.auth,
  
  // Storage usando client original
  storage: originalClient.storage,
  
  // Functions usando client original (Edge Functions)
  functions: originalClient.functions,
  
  // Realtime usando client original (precisa de todas as funcionalidades)
  realtime: originalClient.realtime,
  channel: (...args) => originalClient.channel(...args),
  removeChannel: (...args) => originalClient.removeChannel(...args),
  removeAllChannels: () => originalClient.removeAllChannels(),
  getChannels: () => originalClient.getChannels(),
  
  // Metadata
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
} : originalClient

console.log('[Supabase Init] Modo:', import.meta.env.PROD ? '🔧 WRAPPER (produção)' : '✅ CLIENT ORIGINAL (dev)')
console.log('[Supabase Init] Client criado:', !!supabase)

// Expor para depuração
if (typeof window !== 'undefined') {
  window.__supabase = supabase
  window.__supabase_original = originalClient
  window.__supabase_wrapper = supabaseWrapper
  console.log('[Supabase Init] ✅ Exposto em window.__supabase')
}