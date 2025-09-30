import { supabase } from '@/lib/supabase'

// Util: tenta obter o codigo da empresa do AuthContext armazenado no localStorage
function getCachedCompanyCode() {
  try {
    // 1) auth:userProfile
    const cached = localStorage.getItem('auth:userProfile')
    if (cached) {
      const obj = JSON.parse(cached)
      if (obj?.codigo_empresa) return obj.codigo_empresa
    }

    // 2) auth:company
    const comp = localStorage.getItem('auth:company')
    if (comp) {
      const cobj = JSON.parse(comp)
      if (cobj?.codigo_empresa) return cobj.codigo_empresa
      if (cobj?.codigo) return cobj.codigo // fallback caso a chave seja 'codigo'
    }
    // 3) global fallback (se o app expuser)
    if (typeof window !== 'undefined' && window.__authProfile && window.__authProfile.codigo_empresa) {
      return window.__authProfile.codigo_empresa
    }
    return null
  } catch {
    return null
  }
}

// ================= FINALIZADORAS (métodos de pagamento) =================
// Tabela esperada: 'finalizadoras' com colunas:
// id (uuid), codigo_empresa (int/varchar), nome (text), tipo (text), ativo (bool), taxa_percentual (numeric)
// tipos comuns: dinheiro, credito, debito, pix, voucher, outros

export async function listarFinalizadoras({ somenteAtivas = true, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('finalizadoras')
    .select('*')
    .order('nome', { ascending: true })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  if (somenteAtivas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function criarFinalizadora(payload, codigoEmpresa) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const row = {
    nome: (payload?.nome || '').trim(),
    tipo: payload?.tipo || 'outros',
    ativo: payload?.ativo ?? true,
    taxa_percentual: payload?.taxa_percentual == null ? null : Number(payload.taxa_percentual),
  }
  if (!row.nome) throw new Error('Nome é obrigatório')
  if (codigo) row.codigo_empresa = codigo
  const { data, error } = await supabase.from('finalizadoras').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function atualizarFinalizadora(id, payload, codigoEmpresa) {
  if (!id) throw new Error('ID inválido')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const row = {
    nome: (payload?.nome || '').trim(),
    tipo: payload?.tipo || 'outros',
    ativo: payload?.ativo ?? true,
    taxa_percentual: payload?.taxa_percentual == null ? null : Number(payload.taxa_percentual),
  }
  if (!row.nome) throw new Error('Nome é obrigatório')
  let q = supabase.from('finalizadoras').update(row).eq('id', id)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data
}

export async function ativarDesativarFinalizadora(id, ativo, codigoEmpresa) {
  if (!id) throw new Error('ID inválido')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase.from('finalizadoras').update({ ativo: !!ativo }).eq('id', id)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data
}

// Garante que há sessão de caixa aberta para a empresa atual
// Lança erro com code = 'NO_OPEN_CASH_SESSION' se não houver
export async function assertCaixaAberto({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase.from('caixa_sessoes').select('id').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  const open = Array.isArray(data) && data.length > 0
  if (!open) {
    const err = new Error('É necessário abrir o caixa antes de criar comandas.')
    err.code = 'NO_OPEN_CASH_SESSION'
    throw err
  }
  return true
}

// Busca clientes vinculados para várias comandas em lote e retorna mapa { comanda_id: 'Nome1, Nome2' }
export async function listarClientesPorComandas(comandaIds = [], codigoEmpresa) {
  if (!Array.isArray(comandaIds) || comandaIds.length === 0) return {};
  const codigo = codigoEmpresa || getCachedCompanyCode();
  // Tenta com relacionamento pelo nome padrão; se falhar, tenta chave alternativa; se falhar, sem embed
  const trySelect = async (rel) => {
    let q = supabase
      .from('comanda_clientes')
      .select(`comanda_id, cliente_id, nome_livre, clientes:clientes${rel}(id, nome)`) // rel ex: !comanda_clientes_cliente_id_fkey
      .in('comanda_id', comandaIds);
    if (codigo) q = q.eq('codigo_empresa', codigo);
    return q;
  };
  let rows = [];
  try {
    const { data, error } = await trySelect('!comanda_clientes_cliente_id_fkey');
    if (error) throw error; rows = data || [];
  } catch {
    try {
      const { data, error } = await trySelect('!fk_comanda_clientes_cliente');
      if (error) throw error; rows = data || [];
    } catch {
      let q = supabase
        .from('comanda_clientes')
        .select('comanda_id, cliente_id, nome_livre')
        .in('comanda_id', comandaIds);
      if (codigo) q = q.eq('codigo_empresa', codigo);
      const { data } = await q; rows = data || [];
    }
  }
  const map = {};
  for (const r of rows) {
    const id = r.comanda_id;
    const nome = (r.clientes?.nome) || r.nome_livre || '';
    if (!map[id]) map[id] = [];
    if (nome) map[id].push(nome);
  }
  for (const k of Object.keys(map)) map[k] = Array.from(new Set(map[k])).join(', ');
  return map;
}

// Busca finalizadoras em lote e retorna mapa { comanda_id: 'Pix, Dinheiro' }
export async function listarFinalizadorasPorComandas(comandaIds = [], codigoEmpresa) {
  if (!Array.isArray(comandaIds) || comandaIds.length === 0) return {};
  const codigo = codigoEmpresa || getCachedCompanyCode();
  let q = supabase
    .from('pagamentos')
    .select('comanda_id, metodo, status')
    .in('comanda_id', comandaIds);
  if (codigo) q = q.eq('codigo_empresa', codigo);
  const { data, error } = await q;
  if (error) throw error;
  const map = {};
  for (const pg of (data || [])) {
    const ok = (pg.status || 'Pago') !== 'Cancelado' && (pg.status || 'Pago') !== 'Estornado';
    if (!ok) continue;
    const id = pg.comanda_id;
    const m = pg.metodo || '';
    if (!map[id]) map[id] = new Set();
    if (m) map[id].add(m);
  }
  const out = {};
  for (const [k, set] of Object.entries(map)) out[k] = Array.from(set).join(', ');
  return out;
}

// Verifica se a soma das quantidades por produto na comanda não excede o estoque disponível
// Retorna true se OK; lança erro com detalhes se algum produto ultrapassar
export async function verificarEstoqueComanda({ comandaId, codigoEmpresa } = {}) {
  if (!comandaId) throw new Error('comandaId é obrigatório')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // 1) Carregar itens da comanda
  let qi = supabase
    .from('comanda_itens')
    .select('produto_id, quantidade')
    .eq('comanda_id', comandaId)
  if (codigo) qi = qi.eq('codigo_empresa', codigo)
  const { data: itens, error: ierr } = await qi
  if (ierr) throw ierr
  const sumByProduct = new Map()
  for (const it of (itens || [])) {
    const pid = it.produto_id
    const q = Number(it.quantidade || 0)
    sumByProduct.set(pid, (sumByProduct.get(pid) || 0) + q)
  }
  if (sumByProduct.size === 0) return true
  const ids = Array.from(sumByProduct.keys())
  // 2) Buscar estoques dos produtos
  let qp = supabase.from('produtos').select('id, nome, estoque')
  qp = qp.in('id', ids)
  if (codigo) qp = qp.eq('codigo_empresa', codigo)
  const { data: prods, error: perr } = await qp
  if (perr) throw perr
  const estoqueById = new Map((prods || []).map(p => [p.id, { nome: p.nome, estoque: Number(p.estoque || 0) }]))
  const violacoes = []
  for (const [pid, total] of sumByProduct.entries()) {
    const info = estoqueById.get(pid) || { nome: `Produto ${pid}`, estoque: 0 }
    if (total > info.estoque) {
      violacoes.push({ id: pid, name: info.nome, solicitado: total, estoque: info.estoque })
    }
  }
  if (violacoes.length > 0) {
    const lista = violacoes.map(v => `${v.name}: solicitado ${v.solicitado}, estoque ${v.estoque}`).join('; ')
    const err = new Error(`Estoque insuficiente para finalizar: ${lista}`)
    err.code = 'INSUFFICIENT_STOCK_COMANDA'
    err.items = violacoes
    throw err
  }
  return true
}

// Detecta erro de NOT NULL em coluna status
function isNotNullStatusError(err) {
  if (!err) return false;
  const code = err.code ? String(err.code) : '';
  const msg = [err.message, err.details, err.hint].filter(Boolean).join(' ').toLowerCase();
  return code === '23502' || (msg.includes('null value in column') && msg.includes('status'));
}
// Balcão (comanda sem mesa)
export async function listarComandaBalcaoAberta({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comandas')
    .select('id,status,aberto_em')
    .is('mesa_id', null)
    .in('status', ['open','awaiting-payment'])
    .order('aberto_em', { ascending: false })
    .limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data?.[0] || null
}

export async function getOrCreateComandaBalcao({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Bloqueio: exigir caixa aberto
  await assertCaixaAberto({ codigoEmpresa: codigo })
  const atual = await listarComandaBalcaoAberta({ codigoEmpresa: codigo })
  if (atual) return atual
  const payload = { status: 'open', mesa_id: null, aberto_em: new Date().toISOString() }
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('comandas').insert(payload).select('id,status,aberto_em').single()
  if (error) throw error
  return data
}

// Cria SEMPRE uma nova comanda de balcão (sem mesa)
export async function criarComandaBalcao({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Bloqueio: exigir caixa aberto
  await assertCaixaAberto({ codigoEmpresa: codigo })
  const payload = { status: 'open', mesa_id: null, aberto_em: new Date().toISOString() }
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('comandas').insert(payload).select('id,status,aberto_em').single()
  if (error) throw error
  return data
}

// Histórico / Relatórios
export async function listarComandas({ status, from, to, search = '', limit = 50, offset = 0, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comandas')
    .select('id, mesa_id, status, aberto_em, fechado_em')
    .order('aberto_em', { ascending: false })
    .range(offset, offset + limit - 1)

  if (codigo) q = q.eq('codigo_empresa', codigo)

  if (status && Array.isArray(status) && status.length) {
    q = q.in('status', status)
  } else if (typeof status === 'string') {
    if (status === 'closed') {
      // Considera como fechadas tanto as com status 'closed' quanto as que possuem fechado_em preenchido
      // PostgREST OR syntax
      q = q.or('status.eq.closed,fechado_em.not.is.null')
    } else {
      q = q.eq('status', status)
    }
  }

  const mkStart = (d) => {
    if (!d) return null
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y,m,day] = d.split('-').map(Number)
      return new Date(y, m - 1, day, 0, 0, 0, 0)
    }
    return new Date(d)
  }
  const mkEnd = (d) => {
    if (!d) return null
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y,m,day] = d.split('-').map(Number)
      return new Date(y, m - 1, day, 23, 59, 59, 999)
    }
    return new Date(d)
  }
  const fromDt = mkStart(from)
  const toDt = mkEnd(to)
  if (fromDt) q = q.gte('aberto_em', fromDt.toISOString())
  if (toDt) q = q.lte('aberto_em', toDt.toISOString())

  const s = (search || '').trim()
  if (s) {
    // pesquisa por id (numérico ou uuid) ou por status
    const isNumeric = /^\d+$/.test(s)
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)
    if (isNumeric || isUUID) {
      // tenta por id e também por status como fallback
      q = q.or(`id.eq.${s},status.ilike.%${s}%`)
    } else {
      q = q.or(`status.ilike.%${s}%`)
    }
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// ============ RESUMOS FINANCEIROS (RELATÓRIOS) ============

// Retorna resumo financeiro do período [from, to]
// - total por finalizadora (pagamentos)
// - total de vendas brutas, descontos, vendas líquidas (comandas fechadas no período)
export async function listarResumoPeriodo({ from, to, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // 1) Comandas fechadas no período
  let comandasFechadas = []
  try {
    let q = supabase
      .from('comandas')
      .select('id, fechado_em')
      .eq('status', 'closed')
    if (codigo) q = q.eq('codigo_empresa', codigo)
    if (from) q = q.gte('fechado_em', new Date(from).toISOString())
    if (to) q = q.lte('fechado_em', new Date(to).toISOString())
    const { data, error } = await q
    if (error) throw error
    comandasFechadas = data || []
  } catch { comandasFechadas = [] }

  const comandaIds = (comandasFechadas || []).map(c => c.id)

  // 2) Somar itens (vendas brutas e descontos)
  let totalVendasBrutas = 0
  let totalDescontos = 0
  if (comandaIds.length > 0) {
    try {
      let q = supabase
        .from('comanda_itens')
        .select('comanda_id, quantidade, preco_unitario, desconto')
        .in('comanda_id', comandaIds)
      if (codigo) q = q.eq('codigo_empresa', codigo)
      const { data, error } = await q
      if (error) throw error
      for (const it of (data || [])) {
        const bruto = Number(it.quantidade || 0) * Number(it.preco_unitario || 0)
        const desc = Number(it.desconto || 0)
        totalVendasBrutas += bruto
        totalDescontos += desc
      }
    } catch {}
  }
  const totalVendasLiquidas = Math.max(0, totalVendasBrutas - totalDescontos)

  // 3) Pagamentos por finalizadora no período (pela data de recebimento)
  const porFinalizadora = {}
  let totalEntradas = 0
  try {
    let qp = supabase
      .from('pagamentos')
      .select('metodo, valor, recebido_em, status')
    if (codigo) qp = qp.eq('codigo_empresa', codigo)
    if (from) qp = qp.gte('recebido_em', new Date(from).toISOString())
    if (to) qp = qp.lte('recebido_em', new Date(to).toISOString())
    const { data, error } = await qp
    if (error) throw error
    for (const pg of (data || [])) {
      const ok = (pg.status || 'Pago') !== 'Cancelado' && (pg.status || 'Pago') !== 'Estornado'
      if (!ok) continue
      const key = pg.metodo || 'outros'
      const v = Number(pg.valor || 0)
      porFinalizadora[key] = (porFinalizadora[key] || 0) + v
      totalEntradas += v
    }
  } catch {}

  return {
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to).toISOString() : null,
    totalPorFinalizadora: porFinalizadora,
    totalEntradas,
    totalVendasBrutas,
    totalDescontos,
    totalVendasLiquidas,
  }
}

// Usa a sessão de caixa aberta para calcular resumo do período da sessão (aberto_em -> agora)
export async function listarResumoSessaoCaixaAtual({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let abertoEm = null
  try {
    let q = supabase.from('caixa_sessoes').select('aberto_em').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
    if (codigo) q = q.eq('codigo_empresa', codigo)
    const { data, error } = await q
    if (error) throw error
    abertoEm = data?.[0]?.aberto_em || null
  } catch {}
  if (!abertoEm) return null
  const now = new Date().toISOString()
  return listarResumoPeriodo({ from: abertoEm, to: now, codigoEmpresa: codigo })
}

export async function listarPagamentos({ comandaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('pagamentos')
    .select('*')
    .order('recebido_em', { ascending: true })
  if (comandaId) q = q.eq('comanda_id', comandaId)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// Clientes
export async function listarClientes({ searchTerm = '', limit = 20, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true })
    .limit(limit)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const s = (searchTerm || '').trim()
  if (s) {
    const isNumeric = /^\d+$/.test(s)
    if (isNumeric) {
      q = q.or(`codigo.eq.${s},nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`)
    } else {
      q = q.or(`nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`)
    }
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// Lista comandas abertas (open/awaiting-payment)
export async function listarComandasAbertas({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  
  // CONSULTA MAIS AMPLA: buscar todas as comandas sem fechado_em, independente do status
  let q = supabase
    .from('comandas')
    .select('id, mesa_id, status, aberto_em, fechado_em')
    .is('fechado_em', null)
    .order('aberto_em', { ascending: false })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  
  // Debug: log para verificar comandas encontradas
  console.log(`[listarComandasAbertas] Consulta ampla encontrou ${(data || []).length} comandas:`, data)
  
  // Filtrar apenas as que realmente estão abertas
  const abertas = (data || []).filter(c => 
    c.status === 'open' || c.status === 'awaiting-payment'
  )
  
  console.log(`[listarComandasAbertas] Após filtro: ${abertas.length} comandas abertas:`, abertas)
  
  return abertas
}

// Carrega itens de várias comandas e retorna um mapa { comanda_id: total }
export async function listarTotaisPorComanda(comandaIds = [], codigoEmpresa) {
  if (!comandaIds || comandaIds.length === 0) return {}
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase.from('comanda_itens').select('comanda_id, quantidade, preco_unitario').in('comanda_id', comandaIds)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  const totals = {}
  for (const it of data || []) {
    const k = it.comanda_id
    const val = Number(it.quantidade || 0) * Number(it.preco_unitario || 0)
    totals[k] = (totals[k] || 0) + val
  }
  return totals
}

// Mesas
export async function listMesas(codigoEmpresa) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let query = supabase.from('mesas').select('*').order('numero', { ascending: true })
  if (codigo) query = query.eq('codigo_empresa', codigo)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// Cria uma nova mesa com o próximo número disponível (ou número específico)
export async function criarMesa({ numero, nome, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let nextNumero = numero
  if (!nextNumero) {
    // buscar maior numero existente
    let q = supabase.from('mesas').select('numero').order('numero', { ascending: false }).limit(1)
    if (codigo) q = q.eq('codigo_empresa', codigo)
    const { data: maxRow, error: errMax } = await q
    if (errMax) throw errMax
    nextNumero = (maxRow?.[0]?.numero || 0) + 1
  }
  const payload = { numero: nextNumero, status: 'available' }
  if (nome && typeof nome === 'string' && nome.trim()) payload.nome = nome.trim()
  if (codigo) payload.codigo_empresa = codigo
  try {
    const { data, error } = await supabase.from('mesas').insert(payload).select('*').single()
    if (error) throw error
    return data
  } catch (e) {
    const msg = String(e?.message || e || '')
    // Se coluna nome não existir no banco, tenta novamente sem o campo
    if (/column\s+\"?nome\"?\s+of\s+relation/i.test(msg) || /column\s+\"?nome\"?\s+does not exist/i.test(msg)) {
      const fallback = { numero: nextNumero, status: 'available' }
      if (codigo) fallback.codigo_empresa = codigo
      const { data, error } = await supabase.from('mesas').insert(fallback).select('*').single()
      if (error) throw error
      return data
    }
    throw e
  }
}

// Obtém ou cria uma mesa especial para o Modo Balcão (numero = 0)
export async function getOrCreateMesaBalcao({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase.from('mesas').select('*').eq('numero', 0).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: found, error: errFind } = await q
  if (errFind) throw errFind
  if (found && found.length > 0) return found[0]
  // criar se não existir
  return criarMesa({ numero: 0, codigoEmpresa: codigo })
}

// Caixa
export async function ensureCaixaAberto({ saldoInicial = 0, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // 1) Verificar se já existe sessão aberta
  let q = supabase.from('caixa_sessoes').select('id,status,aberto_em').eq('status', 'open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: abertas, error: errOpen } = await q
  if (errOpen) throw errOpen
  if (abertas && abertas.length > 0) return abertas[0]

  // 2) Abrir nova
  const payload = { status: 'open', saldo_inicial: saldoInicial }
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('caixa_sessoes').insert(payload).select('id,status,aberto_em').single()
  if (error) throw error
  return data
}

// Verifica se há caixa aberto (sem criar)
export async function getCaixaAberto({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase.from('caixa_sessoes').select('id,status,aberto_em,saldo_inicial').eq('status', 'open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data?.[0] || null
}

// Lista fechamentos de caixa (histórico)
export async function listarFechamentosCaixa({ from, to, limit = 50, offset = 0, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('caixa_sessoes')
    .select('id, status, aberto_em, fechado_em, saldo_inicial, saldo_final')
    .order('aberto_em', { ascending: false })
    .range(offset, offset + limit - 1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const mkStart = (d) => {
    if (!d) return null
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y,m,day] = d.split('-').map(Number)
      return new Date(y, m - 1, day, 0, 0, 0, 0)
    }
    return new Date(d)
  }
  const mkEnd = (d) => {
    if (!d) return null
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y,m,day] = d.split('-').map(Number)
      return new Date(y, m - 1, day, 23, 59, 59, 999)
    }
    return new Date(d)
  }
  const fromDt = mkStart(from)
  const toDt = mkEnd(to)
  if (fromDt) q = q.gte('aberto_em', fromDt.toISOString())
  if (toDt) q = q.lte('aberto_em', toDt.toISOString())
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function fecharCaixa({ saldoFinal = null, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Bloqueio: não permitir fechamento com comandas abertas (inclui balcão e mesas)
  try {
    let abertas = await listarComandasAbertas({ codigoEmpresa: codigo })
    abertas = abertas || []

    // 1) Auto-fechar comandas de balcão vazias (mesa_id null e sem itens)
    const possiveisBalcao = abertas.filter(c => !c.mesa_id)
    for (const c of possiveisBalcao) {
      try {
        const itens = await listarItensDaComanda({ comandaId: c.id, codigoEmpresa: codigo })
        const qtd = (itens || []).length
        if (qtd === 0) {
          // auto-fecha comanda balcão vazia
          await fecharComandaEMesa({ comandaId: c.id, codigoEmpresa: codigo })
        }
      } catch (e) {
        // se falhar aqui, não bloqueia o fluxo; será tratado no próximo passo
      }
    }

    // 2) Recarregar a lista e bloquear somente se ainda restarem abertas com itens
    abertas = await listarComandasAbertas({ codigoEmpresa: codigo })
    if (abertas && abertas.length > 0) {
      // Verificar se são todas balcão vazias (fallback super seguro): se alguma tiver item, bloqueia
      let restantesComItens = 0
      for (const c of abertas) {
        try {
          const itens = await listarItensDaComanda({ comandaId: c.id, codigoEmpresa: codigo })
          if ((itens || []).length > 0) restantesComItens++
        } catch {
          // assumimos que possui itens para evitar fechar indevido
          restantesComItens++
        }
      }
      if (restantesComItens > 0) {
        throw new Error(`Existem ${restantesComItens} comandas com itens em aberto. Finalize-as antes de fechar o caixa.`)
      }
    }
  } catch (chkErr) {
    // Se a verificação de abertas falhar por erro de rede, segue para evitar bloqueios falsos
    // Porém, se for nosso erro de regra (mensagem acima), propaga
    if (chkErr && /Existem \d+ comandas/.test(chkErr.message || '')) throw chkErr
  }
  // pegar sessão aberta (precisamos do id, aberto_em e saldo_inicial)
  let q = supabase.from('caixa_sessoes').select('id,aberto_em,saldo_inicial').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: sess, error: qErr } = await q
  if (qErr) throw qErr
  const caixaId = sess?.[0]?.id || null
  const abertoEm = sess?.[0]?.aberto_em || null
  const saldoInicialSessao = Number(sess?.[0]?.saldo_inicial || 0)
  if (!caixaId) throw new Error('Nenhuma sessão de caixa aberta encontrada.')

  // Calcular resumo do período para estimar saldo final quando não informado
  const fechadoEmIso = new Date().toISOString()
  let totalEntradas = 0
  try {
    const resumoTmp = await listarResumoPeriodo({ from: abertoEm, to: fechadoEmIso, codigoEmpresa: codigo })
    totalEntradas = Number(resumoTmp?.totalEntradas || 0)
  } catch {}
  const efetivoSaldoFinal = (saldoFinal !== null && saldoFinal !== undefined) ? Number(saldoFinal) : (saldoInicialSessao + totalEntradas)

  // Fechar sessão agora com saldo_final definido
  const { data, error } = await supabase
    .from('caixa_sessoes')
    .update({ status: 'closed', saldo_final: efetivoSaldoFinal, fechado_em: fechadoEmIso })
    .eq('id', caixaId)
    .select('id,status,fechado_em,saldo_final')
    .single()
  if (error) throw error

  // Criar snapshot do fechamento em caixa_resumos
  try {
    if (abertoEm && fechadoEmIso) {
      const resumo = await listarResumoPeriodo({ from: abertoEm, to: fechadoEmIso, codigoEmpresa: codigo })
      const payload = {
        codigo_empresa: codigo || getCachedCompanyCode(),
        caixa_sessao_id: caixaId,
        periodo_de: resumo.from || abertoEm,
        periodo_ate: resumo.to || fechadoEmIso,
        total_bruto: Number(resumo.totalVendasBrutas || 0),
        total_descontos: Number(resumo.totalDescontos || 0),
        total_liquido: Number(resumo.totalVendasLiquidas || 0),
        total_entradas: Number(resumo.totalEntradas || 0),
        por_finalizadora: resumo.totalPorFinalizadora || {}
      }
      await supabase.from('caixa_resumos').insert(payload)
    }
  } catch (snapErr) {
    console.warn('[fecharCaixa] Falha ao gravar snapshot de fechamento:', snapErr)
  }
  return data
}

// Lê o snapshot do fechamento (se existir) para uma sessão específica
export async function getCaixaResumo({ caixaSessaoId, codigoEmpresa } = {}) {
  if (!caixaSessaoId) throw new Error('caixaSessaoId é obrigatório')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('caixa_resumos')
    .select('*')
    .eq('caixa_sessao_id', caixaSessaoId)
    .order('criado_em', { ascending: false })
    .limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data?.[0] || null
}

// Cria movimentação de caixa (sangria/suprimento/troco/ajuste)
export async function criarMovimentacaoCaixa({ tipo, valor, observacao = '', caixaSessaoId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!tipo || !['sangria','suprimento','troco','ajuste'].includes(tipo)) throw new Error('Tipo inválido de movimentação')
  let sessId = caixaSessaoId
  if (!sessId) {
    // pega sessão aberta
    let q = supabase.from('caixa_sessoes').select('id').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
    if (codigo) q = q.eq('codigo_empresa', codigo)
    const { data: s, error } = await q
    if (error) throw error
    sessId = s?.[0]?.id || null
  }
  if (!sessId) throw new Error('Sessão de caixa não encontrada para registrar movimentação')
  const payload = {
    codigo_empresa: codigo,
    caixa_sessao_id: sessId,
    tipo,
    valor: Math.max(0, Number(valor) || 0),
    observacao: (observacao || '').trim() || null
  }
  const { data, error } = await supabase.from('caixa_movimentacoes').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function listarMovimentacoesCaixa({ caixaSessaoId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!caixaSessaoId) throw new Error('caixaSessaoId é obrigatório')
  let q = supabase
    .from('caixa_movimentacoes')
    .select('*')
    .eq('caixa_sessao_id', caixaSessaoId)
    .order('criado_em', { ascending: true })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// Comandas
export async function abrirComandaParaMesa({ mesaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Bloqueio: exigir caixa aberto
  await assertCaixaAberto({ codigoEmpresa: codigo })
  
  console.log(`[abrirComandaParaMesa] Iniciando para mesaId: ${mesaId}, codigo_empresa: ${codigo}`)
  
  // PRIMEIRO: Testar se conseguimos inserir algo simples na tabela comandas
  console.log(`[abrirComandaParaMesa] TESTE: Verificando se conseguimos inserir na tabela comandas...`)
  
  try {
    // Teste básico de inserção - payload mínimo
    const testePayload = { 
      status: 'open', 
      aberto_em: new Date().toISOString()
    }
    
    // Se temos código da empresa, adicionar
    if (codigo) {
      testePayload.codigo_empresa = codigo
    }
    
    // Se temos mesa, adicionar
    if (mesaId) {
      testePayload.mesa_id = mesaId
    }
    
    console.log(`[abrirComandaParaMesa] TESTE: Payload para inserção:`, testePayload)
    
    const { data, error } = await supabase
      .from('comandas')
      .insert(testePayload)
      .select('*')
      .single()
    
    if (error) {
      console.error(`[abrirComandaParaMesa] ERRO CRÍTICO na inserção:`, {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payload: testePayload
      })
      
      // Vamos tentar descobrir o que está acontecendo
      console.log(`[abrirComandaParaMesa] Tentando consultar estrutura da tabela...`)
      const { data: estrutura, error: erroEstrutura } = await supabase
        .from('comandas')
        .select('*')
        .limit(1)
      
      console.log(`[abrirComandaParaMesa] Resultado consulta estrutura:`, { estrutura, erroEstrutura })
      
      throw error
    }
    
    console.log(`[abrirComandaParaMesa] ✅ SUCESSO! Comanda criada:`, data)
    return data
    
  } catch (err) {
    console.error(`[abrirComandaParaMesa] ERRO GERAL:`, err)
    throw err
  }
}

export async function listarComandaDaMesa({ mesaId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comandas')
    .select('id,status,aberto_em,fechado_em')
    .eq('mesa_id', mesaId)
    .is('fechado_em', null)
    .in('status', ['open','awaiting-payment'])
    .order('aberto_em', { ascending: false })
    .limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data?.[0] || null
}

// Busca itens da comanda
export async function listarItensDaComanda({ comandaId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comanda_itens')
    .select('*')
    .eq('comanda_id', comandaId)
    .order('created_at', { ascending: true })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// Conveniência: SEMPRE criar nova comanda para mesa (nunca reutilizar)
export async function getOrCreateComandaForMesa({ mesaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Bloqueio: exigir caixa aberto
  await assertCaixaAberto({ codigoEmpresa: codigo })
  
  console.log(`[getOrCreateComandaForMesa] SEMPRE criando nova comanda para mesa ${mesaId}`)
  
  // Buscar comanda existente para fechar se necessário
  const atual = await listarComandaDaMesa({ mesaId, codigoEmpresa: codigo })
  
  if (atual) {
    console.log(`[getOrCreateComandaForMesa] Fechando comanda existente ${atual.id} para criar nova`)
    
    try {
      // Fechar comanda antiga automaticamente
      await supabase
        .from('comandas')
        .update({ 
          status: 'closed', 
          fechado_em: new Date().toISOString()
        })
        .eq('id', atual.id)
        .eq('codigo_empresa', codigo)
        
      // Limpar também os vínculos de clientes da comanda antiga
      await supabase
        .from('comanda_clientes')
        .delete()
        .eq('comanda_id', atual.id)
        .eq('codigo_empresa', codigo)
        
    } catch (error) {
      console.error('Erro ao fechar comanda antiga:', error)
    }
  }
  
  // SEMPRE criar nova comanda zerada
  console.log(`[getOrCreateComandaForMesa] Criando nova comanda zerada para mesa ${mesaId}`)
  return abrirComandaParaMesa({ mesaId, codigoEmpresa: codigo })
}

// Multi-clientes por comanda através de tabela de vínculo
export async function adicionarClientesAComanda({ comandaId, clienteIds = [], nomesLivres = [], codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!comandaId) throw new Error('comandaId é obrigatório')
  
  // DESABILITADO: Não fechar comandas antigas automaticamente
  // Isso estava causando o fechamento de comandas ativas
  console.log(`[adicionarClientesAComanda] Fechamento automático de comandas antigas DESABILITADO para evitar perda de dados`)
  
  // SEGUNDO: Limpar clientes existentes da comanda atual para evitar duplicatas
  let deleteQuery = supabase.from('comanda_clientes').delete().eq('comanda_id', comandaId)
  if (codigo) deleteQuery = deleteQuery.eq('codigo_empresa', codigo)
  const { error: deleteError } = await deleteQuery
  if (deleteError) throw deleteError
  
  const rows = []
  for (const id of (clienteIds || [])) rows.push({ comanda_id: comandaId, cliente_id: id })
  for (const nome of (nomesLivres || [])) {
    const n = (nome || '').trim()
    if (n) rows.push({ comanda_id: comandaId, nome_livre: n })
  }
  if (rows.length === 0) return true
  const payload = rows.map(r => (codigo ? { ...r, codigo_empresa: codigo } : r))
  const { error } = await supabase.from('comanda_clientes').insert(payload)
  if (error) throw error
  return true
}

export async function listarClientesDaComanda({ comandaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!comandaId) throw new Error('comandaId é obrigatório')
  // Tentativa 1: relação qualificada pelo nome padrão gerado (comanda_clientes_cliente_id_fkey)
  try {
    const { data, error } = await supabase
      .from('comanda_clientes')
      .select('id, cliente_id, nome_livre, clientes:clientes!comanda_clientes_cliente_id_fkey(id, nome, email, telefone)')
      .eq('comanda_id', comandaId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'comum', nome: r.clientes?.nome || r.nome_livre, cliente_id: r.cliente_id }))
  } catch (e1) {
    // Se for ambiguidade (PGRST201) ou relação não encontrada, tenta relacionamento alternativo
    try {
      const { data, error } = await supabase
        .from('comanda_clientes')
        .select('id, cliente_id, nome_livre, clientes:clientes!fk_comanda_clientes_cliente(id, nome, email, telefone)')
        .eq('comanda_id', comandaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'comum', nome: r.clientes?.nome || r.nome_livre, cliente_id: r.cliente_id }))
    } catch (e2) {
      // Último fallback: retornar sem embed (evita quebrar UI)
      const { data, error } = await supabase
        .from('comanda_clientes')
        .select('id, cliente_id, nome_livre')
        .eq('comanda_id', comandaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'comum', nome: r.nome_livre || '', cliente_id: r.cliente_id }))
    }
  }
}

// Itens (depende de tabela 'produtos' existir)
export async function adicionarItem({ comandaId, produtoId, descricao, quantidade, precoUnitario, desconto = 0, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // 1) Backstop: impedir venda com estoque zerado e avisos para estoque baixo
  try {
    let qp = supabase
      .from('produtos')
      .select('id, estoque, estoque_minimo, nome')
      .eq('id', produtoId)
      .limit(1)
    if (codigo) qp = qp.eq('codigo_empresa', codigo)
    const { data: prod, error: perr } = await qp
    if (perr) throw perr
    const p = Array.isArray(prod) ? prod[0] : prod
    if (p) {
      const est = Number(p.estoque ?? 0)
      const estMin = Number(p.estoque_minimo ?? 0)
      const qty = Number(quantidade ?? 1)
      if (est <= 0) {
        const err = new Error(`Produto sem estoque: ${p.nome || ''}`.trim())
        err.code = 'OUT_OF_STOCK'
        throw err
      }
      // Soma atual na comanda deste produto para evitar ultrapassar estoque
      let qs = supabase
        .from('comanda_itens')
        .select('quantidade')
        .eq('comanda_id', comandaId)
        .eq('produto_id', produtoId)
      if (codigo) qs = qs.eq('codigo_empresa', codigo)
      const { data: sumRows, error: serr } = await qs
      if (serr) throw serr
      const atual = Array.isArray(sumRows) && sumRows.length ? sumRows.reduce((acc, r) => acc + Number(r?.quantidade || 0), 0) : 0
      const futuro = atual + qty
      if (futuro > est) {
        const err = new Error(`Estoque insuficiente. Em comanda: ${atual}, solicitado: +${qty}, disponível: ${est}`)
        err.code = 'INSUFFICIENT_STOCK'
        throw err
      }
      // Aviso de estoque baixo (não bloqueia)
      if (est <= estMin && est > 0) {
        try { console.warn(`[adicionarItem] Aviso: estoque baixo para produto '${p.nome}' (estoque=${est}, minimo=${estMin})`) } catch {}
      }
    }
  } catch (stockErr) {
    // Propaga erros de estoque para a UI tratar com mensagem clara
    throw stockErr
  }

  // 2) Inserir item normalmente
  const payload = { comanda_id: comandaId, produto_id: produtoId, descricao, quantidade, preco_unitario: precoUnitario, desconto }
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('comanda_itens').insert(payload).select('*').single()
  if (error) throw error
  return data
}

// Atualiza quantidade do item da comanda
export async function atualizarQuantidadeItem({ itemId, quantidade, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // 1) Buscar item atual para validar delta e estoque
  let qi = supabase
    .from('comanda_itens')
    .select('id, quantidade, produto_id, comanda_id')
    .eq('id', itemId)
    .limit(1)
  if (codigo) qi = qi.eq('codigo_empresa', codigo)
  const { data: currRows, error: ierr } = await qi
  if (ierr) throw ierr
  const curr = Array.isArray(currRows) ? currRows[0] : currRows
  const newQty = Number(quantidade || 0)
  if (!curr) throw new Error('Item não encontrado')
  const oldQty = Number(curr.quantidade || 0)
  const delta = newQty - oldQty
  if (delta > 0) {
    // Verifica estoque disponível do produto
    let qp = supabase.from('produtos').select('id, estoque, nome, estoque_minimo').eq('id', curr.produto_id).limit(1)
    if (codigo) qp = qp.eq('codigo_empresa', codigo)
    const { data: prodRows, error: perr } = await qp
    if (perr) throw perr
    const p = Array.isArray(prodRows) ? prodRows[0] : prodRows
    if (p) {
      const est = Number(p.estoque ?? 0)
      // Soma de outros itens desta comanda para o mesmo produto
      let qs = supabase
        .from('comanda_itens')
        .select('quantidade')
        .eq('comanda_id', curr.comanda_id)
        .eq('produto_id', curr.produto_id)
        .neq('id', curr.id)
      if (codigo) qs = qs.eq('codigo_empresa', codigo)
      const { data: sumRows, error: serr } = await qs
      if (serr) throw serr
      const outros = Array.isArray(sumRows) && sumRows.length ? sumRows.reduce((acc, r) => acc + Number(r?.quantidade || 0), 0) : 0
      const futuro = outros + newQty
      if (futuro > est) {
        const err = new Error(`Estoque insuficiente. Em comanda (outros itens): ${outros}, novo para este item: ${newQty}, disponível: ${est}`)
        err.code = 'INSUFFICIENT_STOCK'
        throw err
      }
      const estMin = Number(p.estoque_minimo ?? 0)
      const restante = est - (outros + newQty)
      if (restante <= estMin && restante >= 0) {
        try { console.warn(`[atualizarQuantidadeItem] Aviso: produto '${p.nome}' atingiu nível de estoque baixo (restante=${restante}, minimo=${estMin})`) } catch {}
      }
    }
  }

  // 2) Atualizar quantidade
  let q = supabase
    .from('comanda_itens')
    .update({ quantidade: newQty })
    .eq('id', itemId)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data
}

// Remove item da comanda
export async function removerItem({ itemId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comanda_itens')
    .delete()
    .eq('id', itemId)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q.select('id').single()
  if (error) throw error
  return !!data
}

// Pagamentos
// Finalizadoras (métodos de pagamento cadastráveis)
/* duplicate removed: listarFinalizadoras (see earlier definition) */

/* duplicate removed: criarFinalizadora (see earlier definition) */

/* duplicate removed: atualizarFinalizadora (see earlier definition) */

/* duplicate removed: ativarDesativarFinalizadora (see earlier definition) */

// Pagamentos
// Helper: detect enum cast error (e.g., invalid input value for enum ...)
function isEnumError(err) {
  if (!err) return false;
  const code = err.code ? String(err.code) : '';
  const msg = [err.message, err.details, err.hint].filter(Boolean).join(' ').toLowerCase();
  return code === '22P02' || msg.includes('invalid input value for enum');
}

export async function registrarPagamento({ comandaId, finalizadoraId, metodo, valor, status = 'Pago', codigoEmpresa, clienteId = null }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!codigo) throw new Error('Empresa não identificada (codigo_empresa ausente).')
  
  // Garante que o status seja válido ou usa 'Pago' como padrão
  const statusValido = (status && ['Pendente', 'Pago', 'Estornado', 'Cancelado'].includes(status)) 
    ? status 
    : 'Pago'
  // Normaliza o método para o enum aceito pelo banco
  const allowed = ['dinheiro', 'credito', 'debito', 'pix', 'voucher', 'outros']
  const norm = (v) => {
    if (!v) return 'outros'
    const s = String(v).toLowerCase().trim()
    // alguns aliases comuns
    const map = {
      'cartao credito': 'credito',
      'cartão credito': 'credito',
      'cartao debito': 'debito',
      'cartão debito': 'debito',
      'cartão de credito': 'credito',
      'cartão de débito': 'debito',
      'cartao de credito': 'credito',
      'cartao de debito': 'debito',
    }
    const m = map[s] || s
    return allowed.includes(m) ? m : 'outros'
  }
  const metodoNormalizado = norm(metodo)
  
  const payload = {
    comanda_id: comandaId,
    finalizadora_id: finalizadoraId || null,
    metodo: metodoNormalizado,
    valor: Math.max(0, Number(valor) || 0),
    status: statusValido,
    cliente_id: clienteId || null,
    recebido_em: new Date().toISOString(),
    codigo_empresa: codigo // Sempre inclui o código da empresa
  }
  
  console.log('[registrarPagamento] Iniciando registro de pagamento:', {
    comandaId,
    finalizadoraId,
    valor: payload.valor,
    status: payload.status,
    codigoEmpresa: codigo
  })
  
  try {
    // Tenta inserir o pagamento diretamente primeiro
    const { data, error } = await supabase
      .from('pagamentos')
      .insert(payload)
      .select()
      .single()
    
    if (error) {
      const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
      const isUndefinedColumn = (error?.code === '42703') || msg.includes("column") && msg.includes("cliente_id")
      if (isUndefinedColumn) {
        // Retry sem cliente_id
        const { cliente_id, ...withoutCliente } = payload
        const { data: d2, error: e2 } = await supabase
          .from('pagamentos')
          .insert(withoutCliente)
          .select()
          .single()
        if (e2) throw e2
        return d2
      }
      // Se for erro de enum, tenta segunda abordagem simples sem casts complexos
      if (isEnumError(error)) {
        console.log('[registrarPagamento] Tentando abordagem alternativa sem status...')
        try {
          const simplePayload = { ...payload }
          delete simplePayload.status // Remove o status para evitar problemas com o enum
          
          const { data, error: simpleError } = await supabase
            .from('pagamentos')
            .insert(simplePayload)
            .select()
            .single()
          
          if (simpleError) throw simpleError
          console.log('[registrarPagamento] Pagamento registrado com sucesso (abordagem alternativa)')
          return data
        } catch (fallbackError) {
          console.error('[registrarPagamento] Falha na abordagem alternativa:', fallbackError)
          throw new Error(`Falha ao processar pagamento: ${fallbackError.message}`)
        }
      }
      throw error
    }
    return data
  } catch (error) {
    console.error('[registrarPagamento] Erro ao registrar pagamento:', {
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      },
      comandaId,
      finalizadoraId,
      valor: payload.valor,
      status: payload.status,
      codigoEmpresa: codigo
    })
    throw error
  }
}

// Fecha comanda e marca mesa como disponível
export async function fecharComandaEMesa({ comandaId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const trace = '[fecharComandaEMesa]'
  
  try { console.group(trace); } catch {}
  try { console.time?.(trace); } catch {}
  
  try {
    console.log(`${trace} Iniciando fechamento da comanda ${comandaId}`)
    
    // 1. Primeiro, obter dados atuais da comanda
    console.log(`${trace} Obtendo dados da comanda...`)
    const { data: comanda, error: errComanda } = await supabase
      .from('comandas')
      .select('id, mesa_id, status, fechado_em')
      .eq('id', comandaId)
      .single()
    
    if (errComanda || !comanda) {
      console.error(`${trace} Erro ao buscar comanda:`, errComanda?.message || 'Comanda não encontrada')
      throw errComanda || new Error('Comanda não encontrada')
    }
    
    // 2. Se já estiver fechada, apenas retorna sucesso
    if (comanda.fechado_em) {
      console.log(`${trace} Comanda ${comandaId} já está fechada em ${comanda.fechado_em}`)
      return true
    }
    
    const nowIso = new Date().toISOString()
    
    // 3. Estratégia para fechar a comanda
    console.log(`${trace} Atualizando comanda...`)
    
    // Fechar comanda corretamente: status closed + fechado_em + codigo_empresa
    console.log(`${trace} Fechando comanda com status closed + fechado_em...`)
    const { error } = await supabase
      .from('comandas')
      .update({ 
        status: 'closed', 
        fechado_em: nowIso 
      })
      .eq('id', comandaId)
      .eq('codigo_empresa', codigo)
    
    if (error) {
      console.error(`${trace} Erro ao fechar comanda:`, error)
      throw error
    }
    
    console.log(`${trace} Comanda ${comandaId} fechada com sucesso`)
    
    // 4. Se tiver mesa associada, marca como disponível
    if (comanda.mesa_id) {
      console.log(`${trace} Atualizando status da mesa ${comanda.mesa_id} para disponível...`)
      
      try {
        const { error: errMesa } = await supabase
          .from('mesas')
          .update({ 
            status: 'available'
          })
          .eq('id', comanda.mesa_id)
          .select('id')
          .single()
        
        if (errMesa) {
          console.error(`${trace} Erro ao atualizar status da mesa:`, errMesa)
          // Não interrompe o fluxo se falhar a atualização da mesa
        } else {
          console.log(`${trace} Mesa ${comanda.mesa_id} marcada como disponível`)
        }
      } catch (err) {
        console.error(`${trace} Exceção ao atualizar mesa:`, err)
        // Continua mesmo com erro na mesa
      }
    } else {
      console.log(`${trace} Nenhuma mesa associada para liberar`)
    }
    
    console.log(`${trace} Fechamento da comanda ${comandaId} concluído com sucesso`)
    return true
    
  } catch (error) {
    console.error(`${trace} Erro fatal ao fechar comanda:`, error)
    throw error
  } finally {
    try { console.timeEnd?.(trace); } catch {}
    try { console.groupEnd(); } catch {}
  }
}

// Cancela comanda e libera mesa SEM enviar para histórico (não define fechado_em)
export async function cancelarComandaEMesa({ comandaId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const trace = '[cancelarComandaEMesa]'
  try { console.group(trace); } catch {}
  try { console.time?.(trace); } catch {}
  try {
    if (!comandaId) throw new Error('comandaId obrigatório')
    if (!codigo) throw new Error('codigo_empresa obrigatório')
    console.log(`${trace} Cancelando comanda ${comandaId}`)
    
    // Obter dados da comanda para liberar mesa
    const { data: comanda } = await supabase
      .from('comandas')
      .select('id, mesa_id')
      .eq('id', comandaId)
      .single()
    
    // Limpa itens e vínculos de clientes
    try { await supabase.from('comanda_itens').delete().eq('comanda_id', comandaId).eq('codigo_empresa', codigo) } catch {}
    try { await supabase.from('comanda_clientes').delete().eq('comanda_id', comandaId).eq('codigo_empresa', codigo) } catch {}
    
    // Marca status como canceled sem fechado_em
    // Nota: Se houver constraint de status, usar 'cancelled' ou outro valor aceito
    const { error: upErr } = await supabase
      .from('comandas')
      .update({ status: 'cancelled', fechado_em: null })
      .eq('id', comandaId)
      .eq('codigo_empresa', codigo)
    if (upErr) throw upErr
    
    // Se tiver mesa associada, marca como disponível
    if (comanda?.mesa_id) {
      console.log(`${trace} Liberando mesa ${comanda.mesa_id}`)
      try {
        await supabase
          .from('mesas')
          .update({ status: 'available' })
          .eq('id', comanda.mesa_id)
      } catch (err) {
        console.error(`${trace} Erro ao liberar mesa:`, err)
      }
    }
    
    console.log(`${trace} Comanda ${comandaId} cancelada com sucesso`)
    return true
  } catch (e) {
    console.error(`${trace} Falha:`, e)
    throw e
  } finally {
    try { console.timeEnd?.(trace); } catch {}
    try { console.groupEnd?.(trace); } catch {}
  }
}
