const url = import.meta.env.VITE_SUPABASE_URL_ISIS
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY_ISIS

if (!url || !anon) {
  // Log mínimo para facilitar debug sem expor valores
  try { console.error('[Supabase ISIS] Variáveis ausentes: VITE_SUPABASE_URL_ISIS / VITE_SUPABASE_ANON_KEY_ISIS') } catch {}
}

const buildHeaders = () => ({
  'apikey': anon,
  'Authorization': `Bearer ${anon}`,
  'Content-Type': 'application/json',
  'X-Client-Info': 'fluxo7-isis-web',
})

const fetchJson = async (path, { method = 'GET', body, headers: extraHeaders } = {}) => {
  const fullUrl = `${url}${path}`
  const res = await fetch(fullUrl, {
    method,
    headers: { ...buildHeaders(), ...(extraHeaders || {}) },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text().catch(() => '')
  const json = text ? (JSON.parse(text) || null) : null

  if (!res.ok) {
    return {
      data: null,
      error: {
        status: res.status,
        message: json?.message || text || `HTTP ${res.status}`,
        details: json?.details ?? null,
        hint: json?.hint ?? null,
        code: json?.code ?? null,
      },
    }
  }

  return { data: json, error: null }
}

class IsisQueryBuilder {
  constructor(table) {
    this.table = table
    this._select = '*'
    this._filters = []
    this._order = null
  }

  select(fields) {
    this._select = fields || '*'
    return this
  }

  eq(column, value) {
    this._filters.push([column, 'eq', value])
    return this
  }

  is(column, value) {
    this._filters.push([column, 'is', value])
    return this
  }

  order(column, { ascending } = {}) {
    this._order = { column, ascending: ascending !== false }
    return this
  }

  async insert(row) {
    return fetchJson(`/rest/v1/${this.table}`, {
      method: 'POST',
      body: row,
    })
  }

  // PostgREST upsert (merge duplicates) using primary key conflict resolution
  async upsert(row, { onConflict } = {}) {
    const params = new URLSearchParams()
    if (onConflict) params.set('on_conflict', onConflict)
    const q = params.toString()
    return fetchJson(`/rest/v1/${this.table}${q ? `?${q}` : ''}`, {
      method: 'POST',
      body: row,
      headers: {
        // Merge when PK already exists
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
    })
  }

  async update(fields) {
    const params = new URLSearchParams()
    params.set('select', this._select)

    for (const [col, op, val] of this._filters) {
      if (op === 'is' && val === null) {
        params.set(col, 'is.null')
      } else {
        params.set(col, `${op}.${val}`)
      }
    }

    if (this._order?.column) {
      params.set('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`)
    }

    return fetchJson(`/rest/v1/${this.table}?${params.toString()}`, {
      method: 'PATCH',
      body: fields,
      headers: {
        'Prefer': 'return=minimal',
      },
    })
  }

  async then(resolve, reject) {
    const params = new URLSearchParams()
    params.set('select', this._select)

    for (const [col, op, val] of this._filters) {
      if (op === 'is' && val === null) {
        params.set(col, 'is.null')
      } else {
        params.set(col, `${op}.${val}`)
      }
    }

    if (this._order?.column) {
      params.set('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`)
    }

    const result = await fetchJson(`/rest/v1/${this.table}?${params.toString()}`, { method: 'GET' })
    return Promise.resolve(result).then(resolve, reject)
  }
}

export const supabaseIsis = {
  from(table) {
    return new IsisQueryBuilder(table)
  },
}
