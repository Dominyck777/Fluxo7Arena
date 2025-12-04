/**
 * 🚀 Supabase Fetch Wrapper
 * 
 * Wrapper que usa fetch direto ao invés do @supabase/supabase-js
 * para contornar bugs de minificação no Netlify/Vercel
 */

const SUPABASE_URL_ENV = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY_ENV = import.meta.env.VITE_SUPABASE_ANON_KEY

function getActiveSupabaseUrl() {
  try { if (typeof window !== 'undefined' && window.__SUPABASE_URL) return window.__SUPABASE_URL } catch {}
  return SUPABASE_URL_ENV
}

function getActiveAnonKey() {
  try { if (typeof window !== 'undefined' && window.__SUPABASE_KEY) return window.__SUPABASE_KEY } catch {}
  return SUPABASE_ANON_KEY_ENV
}

// Descobre o ref do projeto a partir do SUPABASE_URL (ex: https://<ref>.supabase.co)
function getProjectRef() {
  try {
    const u = new URL(getActiveSupabaseUrl())
    const host = u.host || ''
    const parts = host.split('.')
    // Geralmente o primeiro subdomínio é o ref do projeto
    return parts[0] || ''
  } catch {
    return ''
  }
}

// Constrói a chave do localStorage usada pelo supabase-js v2
function getAuthStorageKey() {
  const ref = getProjectRef()
  return ref ? `sb-${ref}-auth-token` : 'sb-auth-token'
}

// Obtém o access_token do usuário autenticado com timeout
async function getAccessToken() {
  // 0) Custom JWT from localStorage (DEV custom auth)
  try {
    const custom = localStorage.getItem('custom-auth-token')
    if (custom && custom.trim()) {
      return custom.trim()
    }
  } catch {}
  // 1) Tenta via auth.getSession() com timeout de 1s
  try {
    // eslint-disable-next-line no-undef
    if (typeof supabaseWrapper !== 'undefined' && supabaseWrapper?.auth?.getSession) {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getSession timeout')), 1000)
      )
      const sessionPromise = supabaseWrapper.auth.getSession()
      const { data } = await Promise.race([sessionPromise, timeoutPromise])
      const token = data?.session?.access_token
      if (token) {
        console.debug('[Supabase Wrapper] Token obtido via getSession')
        return token
      }
    }
  } catch (e) {
    console.debug('[Supabase Wrapper] getSession falhou ou timeout:', e.message)
  }

  // 2) Fallback: lê do localStorage usando a chave baseada no ref do projeto
  try {
    const key = getAuthStorageKey()
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) {
        console.debug('[Supabase Wrapper] Token obtido via localStorage')
        return parsed.access_token
      }
      if (parsed?.currentSession?.access_token) {
        console.debug('[Supabase Wrapper] Token obtido via localStorage (currentSession)')
        return parsed.currentSession.access_token
      }
    }
  } catch (e) {
    console.warn('[Supabase Wrapper] Erro ao ler localStorage:', e)
  }
  console.warn('[Supabase Wrapper] ⚠️ Nenhum token encontrado - usando anon key')
  return null
}

// Helper para construir query string
const buildQueryString = (params) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // Se value for array, adicionar múltiplas vezes (para gte+lte na mesma coluna)
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)))
      } else {
        searchParams.append(key, String(value))
      }
    }
  })
  return searchParams.toString()
}

// Helper para fazer request
const supabaseFetch = async (endpoint, options = {}) => {
  const { method = 'GET', body, headers: customHeaders = {}, params = {}, signal, timeoutMs = 20000 } = options
  
  const queryString = buildQueryString(params)
  const base = getActiveSupabaseUrl()
  const url = `${base}/rest/v1/${endpoint}${queryString ? `?${queryString}` : ''}`
  const anonKey = getActiveAnonKey()
  
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...customHeaders,
  }
  
  // Adicionar auth token do usuário (sobrescreve anon key se disponível)
  try {
    const token = await getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  } catch (e) {
    console.warn('[Supabase Wrapper] Erro ao obter token de sessão:', e)
  }
  
  const config = {
    method,
    headers,
  }
  
  if (body) {
    config.body = JSON.stringify(body)
  }
  
  if (signal) {
    config.signal = signal
  }
  
  // Timeout com AbortController para evitar requests travados na produção
  const controller = new AbortController()
  const timer = setTimeout(() => {
    console.warn(`[Supabase Wrapper] ⚠️ Timeout (${timeoutMs}ms) para ${endpoint}`);
    try { controller.abort('timeout') } catch {}
  }, Math.max(5000, timeoutMs))
  // respeita o signal externo se fornecido
  const finalSignal = (() => {
    if (!signal) return controller.signal
    try {
      // Se houver signal externo, quando ele abortar, aborta também o controller local
      signal.addEventListener('abort', () => {
        try { controller.abort('upstream-abort') } catch {}
      })
    } catch {}
    return controller.signal
  })()
  config.signal = finalSignal

  const startedAt = Date.now()
  let response
  try {
    response = await fetch(url, config)
  } finally {
    clearTimeout(timer)
  }
  
  if (!response.ok) {
    let errorText = ''
    try { errorText = await response.text() } catch {}
    const elapsed = Date.now() - startedAt
    throw new Error(`[Supabase Wrapper] HTTP ${response.status} (${elapsed}ms) - ${errorText || 'unknown error'}`)
  }
  
  const elapsed = Date.now() - startedAt
  let data
  try {
    data = await response.json()
  } catch (e) {
    console.error(`[Supabase Wrapper] Erro ao parsear JSON de ${endpoint}:`, e)
    throw new Error(`[Supabase Wrapper] JSON parse error: ${e.message}`)
  }
  
  if (elapsed > 3000) {
    console.warn(`[Supabase Wrapper] ⚠️ fetch ${endpoint} LENTO (${elapsed}ms)`)
  } else {
    console.debug(`[Supabase Wrapper] fetch ${endpoint} OK (${elapsed}ms)`)
  }
  
  return { data, error: null }
}

// Query Builder (API similar ao Supabase)
class SupabaseQueryBuilder {
  constructor(table) {
    this.table = table
    this.params = {} // Armazena filtros simples
    this.multiFilters = {} // Armazena array de filtros por coluna (para gte+lte, etc)
    this.selectColumns = '*'
    this.signal = null
  }
  
  select(columns = '*') {
    this.selectColumns = columns
    this.params.select = columns
    return this
  }
  
  eq(column, value) {
    this._addFilter(column, `eq.${value}`)
    return this
  }
  
  neq(column, value) {
    this.params[column] = `neq.${value}`
    return this
  }
  
  gt(column, value) {
    this.params[column] = `gt.${value}`
    return this
  }
  
  // Greater than or equal
  gte(column, value) {
    this._addFilter(column, `gte.${value}`)
    return this
  }
  
  // Less than
  lt(column, value) {
    this.params[column] = `lt.${value}`
    return this
  }
  
  lte(column, value) {
    this._addFilter(column, `lte.${value}`)
    return this
  }
  
  like(column, pattern) {
    this.params[column] = `like.${pattern}`
    return this
  }
  
  ilike(column, pattern) {
    this.params[column] = `ilike.${pattern}`
    return this
  }
  
  is(column, value) {
    this.params[column] = `is.${value}`
    return this
  }
  
  in(column, values) {
    this.params[column] = `in.(${values.join(',')})`
    return this
  }
  
  not(column, operator, value) {
    this.params[column] = `not.${operator}.${value}`
    return this
  }
  
  or(filters) {
    this.params.or = `(${filters})`
    return this
  }
  
  contains(column, value) {
    this.params[column] = `cs.{${value}}`
    return this
  }
  
  containedBy(column, value) {
    this.params[column] = `cd.{${value}}`
    return this
  }
  
  filter(column, operator, value) {
    this._addFilter(column, `${operator}.${value}`)
    return this
  }
  
  order(column, options = {}) {
    const direction = options.ascending === false ? 'desc' : 'asc'
    this.params.order = `${column}.${direction}`
    return this
  }
  
  limit(count) {
    this.params.limit = count
    return this
  }
  
  range(from, to) {
    this.params.offset = from
    this.params.limit = to - from + 1
    return this
  }
  
  single() {
    this.params.limit = 1
    this.isSingle = true
    return this
  }
  
  maybeSingle() {
    this.params.limit = 1
    this.isMaybeSingle = true
    return this
  }
  
  abortSignal(signal) {
    this.signal = signal
    return this
  }
  
  _addFilter(column, filterValue) {
    if (!this.multiFilters[column]) {
      this.multiFilters[column] = []
    }
    this.multiFilters[column].push(filterValue)
  }
  
  async then(resolve, reject) {
    try {
      // Mesclar multiFilters em params para enviar ao fetch
      const finalParams = { ...this.params }
      
      // Para cada coluna com múltiplos filtros, passar como array
      // buildQueryString vai adicionar múltiplas vezes na query string
      Object.entries(this.multiFilters).forEach(([column, filters]) => {
        if (filters.length === 1) {
          finalParams[column] = filters[0]
        } else if (filters.length > 1) {
          // Múltiplos filtros: passar como array para buildQueryString
          finalParams[column] = filters
        }
      })
      
      const result = await supabaseFetch(this.table, {
        method: 'GET',
        params: finalParams,
        signal: this.signal
      })
      if (this.isSingle && result.data) {
        result.data = result.data[0] || null
      }
      if (this.isMaybeSingle && result.data) {
        // maybeSingle retorna null se não encontrar, não lança erro
        result.data = result.data[0] || null
      }
      resolve(result)
    } catch (error) {
      reject(error)
    }
  }
}

// Query Builder com INSERT/UPDATE/DELETE
class SupabaseModifyBuilder extends SupabaseQueryBuilder {
  insert(data) {
    this.method = 'POST'
    this.body = Array.isArray(data) ? data : [data]
    return this
  }
  
  update(data) {
    this.method = 'PATCH'
    this.body = data
    return this
  }
  
  // Upsert (PostgREST): usa POST com Prefer: resolution=...
  // options: { onConflict?: string, ignoreDuplicates?: boolean, returning?: 'minimal' | 'representation' }
  upsert(data, options = {}) {
    this.method = 'POST'
    this.body = Array.isArray(data) ? data : [data]
    // Headers específicos para upsert
    const preferResolution = options.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates'
    const preferReturning = options.returning === 'minimal' ? 'return=minimal' : 'return=representation'
    this.headers = {
      ...(this.headers || {}),
      Prefer: `${preferResolution},${preferReturning}`,
    }
    if (options.onConflict) {
      this.params.on_conflict = options.onConflict
    }
    return this
  }
  
  delete() {
    this.method = 'DELETE'
    return this
  }
  
  async then(resolve, reject) {
    try {
      // Mesclar multiFilters em params (importante para UPDATE/DELETE com WHERE)
      const finalParams = { ...this.params }
      
      Object.entries(this.multiFilters).forEach(([column, filters]) => {
        if (filters.length === 1) {
          finalParams[column] = filters[0]
        } else if (filters.length > 1) {
          // Múltiplos filtros: passar como array para buildQueryString
          finalParams[column] = filters
        }
      })
      
      const result = await supabaseFetch(this.table, { 
        method: this.method || 'GET',
        body: this.body,
        params: finalParams,
        signal: this.signal,
        headers: this.headers || {}
      })
      if (this.isSingle && result.data) {
        result.data = result.data[0] || null
      }
      if (this.isMaybeSingle && result.data) {
        // maybeSingle retorna null se não encontrar, não lança erro
        result.data = result.data[0] || null
      }
      resolve(result)
    } catch (error) {
      reject(error)
    }
  }
}

// Client principal
export const supabaseWrapper = {
  from(table) {
    return new SupabaseModifyBuilder(table)
  },
  
  // Auth methods - delegados para o client original em supabase.js
  auth: null, // Será preenchido pelo client original
  
  // Para compatibilidade
  supabaseUrl: getActiveSupabaseUrl(),
  supabaseKey: getActiveAnonKey(),
}

// Teste automático (silenciado)
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  supabaseWrapper.from('empresas').select('id').limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('[Supabase Wrapper] ❌ ERRO:', error)
      }
    })
    .catch(err => {
      console.error('[Supabase Wrapper] ❌ EXCEPTION:', err)
    })
}
