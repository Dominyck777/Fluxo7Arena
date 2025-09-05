import { supabase } from '@/lib/supabase'

// Util: tenta obter o codigo da empresa do AuthContext armazenado no localStorage
function getCachedCompanyCode() {
  try {
    const cached = localStorage.getItem('auth:userProfile')
    if (!cached) return null
    const obj = JSON.parse(cached)
    return obj?.codigo_empresa || null
  } catch {
    return null
  }
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

  if (status && Array.isArray(status) && status.length) q = q.in('status', status)
  else if (typeof status === 'string') q = q.eq('status', status)

  if (from) q = q.gte('aberto_em', new Date(from).toISOString())
  if (to) q = q.lte('aberto_em', new Date(to).toISOString())

  const s = (search || '').trim()
  if (s) {
    // pesquisa básica por id de comanda (numérico) ou status
    const isNumeric = /^\d+$/.test(s)
    if (isNumeric) {
      q = q.or(`id.eq.${s},status.ilike.%${s}%`)
    } else {
      q = q.or(`status.ilike.%${s}%`)
    }
  }

  const { data, error } = await q
  if (error) throw error
  return data || []
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
  let q = supabase.from('comandas').select('id, mesa_id, status, aberto_em').in('status', ['open','awaiting-payment'])
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return data || []
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
export async function criarMesa({ numero, codigoEmpresa } = {}) {
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
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('mesas').insert(payload).select('*').single()
  if (error) throw error
  return data
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

export async function fecharCaixa({ saldoFinal = 0, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // pegar sessão aberta
  let q = supabase.from('caixa_sessoes').select('id').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: sess, error: qErr } = await q
  if (qErr) throw qErr
  const caixaId = sess?.[0]?.id || null

  const { data, error } = await supabase
    .from('caixa_sessoes')
    .update({ status: 'closed', saldo_final: saldoFinal, fechado_em: new Date().toISOString() })
    .eq('id', caixaId)
    .select('id,status,fechado_em')
    .single()
  if (error) throw error
  return data
}

// Comandas
export async function abrirComandaParaMesa({ mesaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!mesaId) throw new Error('mesaId é obrigatório')
  // Evitar duplicar se já houver aberta
  let q = supabase.from('comandas').select('id,status').eq('mesa_id', mesaId).in('status', ['open','awaiting-payment']).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: abertas, error: errA } = await q
  if (errA) throw errA
  if (abertas && abertas.length > 0) {
    return abertas[0]
  }

  const payload = { mesa_id: mesaId, status: 'open' }
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('comandas').insert(payload).select('id,status').single()
  if (error) throw error
  return data
}

export async function listarComandaDaMesa({ mesaId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comandas')
    .select('id,status,aberto_em')
    .eq('mesa_id', mesaId)
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

// Conveniência: obter ou abrir comanda para mesa (sem tocar em clientes)
export async function getOrCreateComandaForMesa({ mesaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const atual = await listarComandaDaMesa({ mesaId, codigoEmpresa: codigo })
  if (atual) {
    return atual
  }
  return abrirComandaParaMesa({ mesaId, codigoEmpresa: codigo })
}

// Multi-clientes por comanda através de tabela de vínculo
export async function adicionarClientesAComanda({ comandaId, clienteIds = [], nomesLivres = [], codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!comandaId) throw new Error('comandaId é obrigatório')
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
  let q = supabase
    .from('comanda_clientes')
    .select('id, cliente_id, nome_livre, clientes:cliente_id(id, nome, email, telefone)')
    .eq('comanda_id', comandaId)
    .order('created_at', { ascending: true })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'comum', nome: r.clientes?.nome || r.nome_livre, cliente_id: r.cliente_id }))
}

// Itens (depende de tabela 'produtos' existir)
export async function adicionarItem({ comandaId, produtoId, descricao, quantidade, precoUnitario, desconto = 0, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const payload = { comanda_id: comandaId, produto_id: produtoId, descricao, quantidade, preco_unitario: precoUnitario, desconto }
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('comanda_itens').insert(payload).select('*').single()
  if (error) throw error
  return data
}

// Atualiza quantidade do item da comanda
export async function atualizarQuantidadeItem({ itemId, quantidade, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comanda_itens')
    .update({ quantidade })
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
export async function listarFinalizadoras({ somenteAtivas = true, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase.from('finalizadoras').select('*').order('nome', { ascending: true })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  if (somenteAtivas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function criarFinalizadora(payload, codigoEmpresa) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!codigo) throw new Error('Empresa não identificada (codigo_empresa ausente). Entre novamente ou selecione a empresa para cadastrar finalizadoras.')
  const insert = { ...payload }
  if (codigo) insert.codigo_empresa = codigo
  const { data, error } = await supabase.from('finalizadoras').insert(insert).select('*').single()
  if (error) throw error
  return data
}

export async function atualizarFinalizadora(id, payload, codigoEmpresa) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!codigo) throw new Error('Empresa não identificada (codigo_empresa ausente).')
  let q = supabase.from('finalizadoras').update(payload).eq('id', id)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data
}

export async function ativarDesativarFinalizadora(id, ativo, codigoEmpresa) {
  return atualizarFinalizadora(id, { ativo }, codigoEmpresa)
}

// Pagamentos
export async function registrarPagamento({ comandaId, finalizadoraId, metodo, valor, status = 'Pago', codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // localizar caixa aberto
  let q = supabase.from('caixa_sessoes').select('id').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: sess, error: errS } = await q
  if (errS) throw errS
  const caixaId = sess?.[0]?.id || null

  const payload = { comanda_id: comandaId, caixa_id: caixaId, valor, status, recebido_em: new Date().toISOString() }
  if (finalizadoraId) payload.finalizadora_id = finalizadoraId
  if (metodo) payload.metodo = metodo
  if (codigo) payload.codigo_empresa = codigo
  const { data, error } = await supabase.from('pagamentos').insert(payload).select('*').single()
  if (error) throw error
  return data
}

// Fecha comanda e marca mesa como disponível
export async function fecharComandaEMesa({ comandaId, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Obter mesa da comanda
  let q = supabase.from('comandas').select('id, mesa_id, status').eq('id', comandaId).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: cmd, error: errCmd } = await q
  if (errCmd) throw errCmd
  const comanda = cmd?.[0]
  if (!comanda) throw new Error('Comanda não encontrada')

  // Fechar comanda
  let qClose = supabase.from('comandas').update({ status: 'closed', fechado_em: new Date().toISOString() }).eq('id', comandaId)
  if (codigo) qClose = qClose.eq('codigo_empresa', codigo)
  const { error: errClose } = await qClose.select('id').single()
  if (errClose) throw errClose

  // Marcar mesa como disponível
  if (comanda.mesa_id) {
    let qm = supabase.from('mesas').update({ status: 'available' }).eq('id', comanda.mesa_id)
    if (codigo) qm = qm.eq('codigo_empresa', codigo)
    const { error: errMesa } = await qm.select('id').single()
    if (errMesa) throw errMesa
  }
  return true
}
