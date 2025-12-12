import { createClient } from '@supabase/supabase-js'
import { supabaseWrapper } from './supabase-fetch-wrapper'
import { ACTIVE_TARGET as MANUAL_TARGET } from './deployTarget'

// Load targets dynamically using Vite glob so optional files don't break build
let ACTIVE_TARGET = undefined
let TARGETS = undefined
try {
  const mods = import.meta.glob('./backendTargets*.js', { eager: true })
  const def = mods['./backendTargets.js'] || null
  const local = mods['./backendTargets.local.js'] || null
  if (def?.TARGETS) TARGETS = def.TARGETS
  if (def?.ACTIVE_TARGET) ACTIVE_TARGET = def.ACTIVE_TARGET
  // Local overrides take precedence
  if (local?.TARGETS) TARGETS = local.TARGETS
  if (local?.ACTIVE_TARGET) ACTIVE_TARGET = local.ACTIVE_TARGET
} catch {}

// 1) Static targets (local override > repo default)
let __selectedTarget = (TARGETS && ACTIVE_TARGET && TARGETS[ACTIVE_TARGET]) ? TARGETS[ACTIVE_TARGET] : null

// 2) Manual deploy switch (repo) if no static target provided
let __activeLabel = ACTIVE_TARGET
if (!__selectedTarget && MANUAL_TARGET) {
  __activeLabel = MANUAL_TARGET
}

// 3) Resolve URL/KEY: static target → env per-target → generic env
let supabaseUrl = (__selectedTarget && __selectedTarget.supabaseUrl && __selectedTarget.supabaseUrl.trim()) ? __selectedTarget.supabaseUrl : ''
let supabaseAnonKey = (__selectedTarget && __selectedTarget.supabaseAnonKey && __selectedTarget.supabaseAnonKey.trim()) ? __selectedTarget.supabaseAnonKey : ''

if (!supabaseUrl || !supabaseAnonKey) {
  const label = (__activeLabel || 'dev').toLowerCase()
  const envUrl = label === 'main' ? import.meta.env.VITE_SUPABASE_URL_MAIN : import.meta.env.VITE_SUPABASE_URL_DEV
  const envKey = label === 'main' ? import.meta.env.VITE_SUPABASE_ANON_KEY_MAIN : import.meta.env.VITE_SUPABASE_ANON_KEY_DEV
  supabaseUrl = (supabaseUrl && supabaseUrl.trim()) ? supabaseUrl : envUrl
  supabaseAnonKey = (supabaseAnonKey && supabaseAnonKey.trim()) ? supabaseAnonKey : envKey
}

if (!supabaseUrl || !supabaseAnonKey) {
  // 4) Final fallback: generic env
  supabaseUrl = supabaseUrl || import.meta.env.VITE_SUPABASE_URL
  supabaseAnonKey = supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY
}

try {
  try {
    const label = (__activeLabel || 'dev')
    // Minimal log to confirm active target (branch) before auth/login
    console.log(`[Target] Branch ativa: ${label}`)
    try { if (typeof window !== 'undefined') { window.__ACTIVE_TARGET = label } } catch {}
    const usingStatic = !!__selectedTarget && !!(__selectedTarget.supabaseUrl||'').trim() && !!(__selectedTarget.supabaseAnonKey||'').trim()
    const usedPerTargetEnv = !usingStatic && (!!import.meta.env.VITE_SUPABASE_URL_DEV || !!import.meta.env.VITE_SUPABASE_URL_MAIN)
    const mode = usingStatic ? 'static config' : (usedPerTargetEnv ? 'per-target env' : 'generic env')
    // Optional succinct info (keep minimal)
    console.info(`[Supabase] Backend target mode: ${mode}`)
  } catch {}
} catch {}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] ❌ ERRO CRÍTICO: Variáveis de ambiente ausentes!')
  throw new Error('Supabase: Variáveis de ambiente não configuradas!')
}

// Exportar os valores resolvidos do alvo ativo (dev/main)
export const SUPABASE_URL_CURRENT = supabaseUrl
export const SUPABASE_ANON_KEY_CURRENT = supabaseAnonKey

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
      // Garantir apikey e Authorization nas chamadas iniciais (antes de sessão)
      'apikey': supabaseAnonKey,

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

// 🔧 Sempre exportar objeto híbrido: queries via wrapper (usa custom token), demais via client original
export const supabase = {
  // Queries usando wrapper (fetch direto)
  from: (table) => supabaseWrapper.from(table),

  // Auth usando client original (auth funciona)
  auth: originalClient.auth,

  // Storage usando client original
  storage: originalClient.storage,

  // Functions usando client original (Edge Functions)
  functions: originalClient.functions,

  // RPC (PostgREST) usando client original
  rpc: (...args) => originalClient.rpc(...args),

  // Realtime usando client original (precisa de todas as funcionalidades)
  realtime: originalClient.realtime,
  channel: (...args) => originalClient.channel(...args),
  removeChannel: (...args) => originalClient.removeChannel(...args),
  removeAllChannels: () => originalClient.removeAllChannels(),
  getChannels: () => originalClient.getChannels(),

  // Metadata
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
}

// Expor para depuração
if (typeof window !== 'undefined') {
  window.__supabase = supabase
  window.__supabase_original = originalClient
  window.__supabase_wrapper = supabaseWrapper
  // Expor URL/chave ativas para o wrapper e outros módulos
  try { window.__SUPABASE_URL = supabaseUrl } catch {}
  try { window.__SUPABASE_KEY = supabaseAnonKey } catch {}
}

try {
  if (typeof window !== 'undefined') {
    const applyRealtimeAuth = () => {
      try {
        const c = localStorage.getItem('custom-auth-token')
        if (c && c.trim()) { supabase.realtime.setAuth(c.trim()); return }
        let ref = ''
        try { const u = new URL(supabaseUrl); const h = u.host || ''; ref = (h.split('.')[0] || '') } catch {}
        const k = ref ? `sb-${ref}-auth-token` : 'sb-auth-token'
        const raw = localStorage.getItem(k)
        if (raw) {
          const p = JSON.parse(raw)
          const t = p?.access_token || p?.currentSession?.access_token
          if (t) { supabase.realtime.setAuth(t) }
        }
      } catch {}
    }
    applyRealtimeAuth()
    try {
      window.addEventListener('storage', (e) => {
        try {
          const key = e?.key || ''
          if (key === 'custom-auth-token' || key.startsWith('sb-')) { applyRealtimeAuth() }
        } catch {}
      })
    } catch {}
  }
} catch {}
