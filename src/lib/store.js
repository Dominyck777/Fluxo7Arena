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

export async function fecharCaixa({ saldoFinal = 0, codigoEmpresa } = {}) {
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
  // pegar sessão aberta (precisamos do id e aberto_em)
  let q = supabase.from('caixa_sessoes').select('id,aberto_em').eq('status','open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: sess, error: qErr } = await q
  if (qErr) throw qErr
  const caixaId = sess?.[0]?.id || null
  const abertoEm = sess?.[0]?.aberto_em || null
  if (!caixaId) throw new Error('Nenhuma sessão de caixa aberta encontrada.')

  // Fechar sessão agora e capturar timestamp de fechamento
  const fechadoEmIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('caixa_sessoes')
    .update({ status: 'closed', saldo_final: saldoFinal, fechado_em: fechadoEmIso })
    .eq('id', caixaId)
    .select('id,status,fechado_em')
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
  const trace = '[store.finalizadoras]'
  try { console.group(trace); } catch {}
  try { console.time?.(trace); } catch {}
  try { console.log('start', { codigoEmpresa: codigo || null, somenteAtivas }); } catch {}
  
  // Debug: verificar se há finalizadoras sem filtros primeiro
  try {
    const { data: allFins, error: allError } = await supabase
      .from('finalizadoras')
      .select('*')
      .limit(5)
    console.log('[DEBUG] Finalizadoras sem filtros:', { count: allFins?.length || 0, error: allError, data: allFins })
  } catch (debugErr) {
    console.error('[DEBUG] Erro ao buscar finalizadoras sem filtros:', debugErr)
  }
  
  const buildQuery = () => {
    try {
      let q = supabase.from('finalizadoras').select('*').order('nome', { ascending: true })
      if (codigo) q = q.eq('codigo_empresa', codigo)
      if (somenteAtivas) q = q.eq('ativo', true)
      return q
    } catch (err) {
      console.error('[listarFinalizadoras] Error building query:', err)
      throw err
    }
  }

  const executeWithTimeout = async (ms = 6000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => { 
      try { controller.abort(); } catch {} 
    }, ms)
    
    try {
      const query = buildQuery()
      console.log('[listarFinalizadoras] Executing query:', { 
        table: 'finalizadoras',
        filters: {
          codigo_empresa: codigo,
          ativo: somenteAtivas ? true : undefined
        }
      })
      
      const { data, error, status, statusText } = await query.abortSignal(controller.signal)
      
      if (error) {
        console.error('[listarFinalizadoras] Query error:', { 
          error,
          status,
          statusText,
          message: error.message
        })
        throw error
      }
      
      console.log('[listarFinalizadoras] Query successful, items found:', Array.isArray(data) ? data.length : 0)
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.error('[listarFinalizadoras] Error in executeWithTimeout:', err)
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    let data = await executeWithTimeout(6000)
    try { console.log('ok', { size: Array.isArray(data) ? data.length : (data ? 1 : 0) }); } catch {}
    return data
  } catch (err) {
    try { console.warn(trace + ' first attempt failed, retrying once...', err?.message || String(err)); } catch {}
    // Retry once quickly
    try {
      const data = await executeWithTimeout(6000)
      try { console.log('ok(after-retry)', { size: Array.isArray(data) ? data.length : (data ? 1 : 0) }); } catch {}
      return data
    } catch (err2) {
      try { console.error(trace + ' error', err2); } catch {}
      throw err2
    }
  } finally {
    try { console.timeEnd?.(trace); } catch {}
    try { console.groupEnd?.(); } catch {}
  }
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
// Helper: detect enum cast error (e.g., invalid input value for enum ...)
function isEnumError(err) {
  if (!err) return false;
  const code = err.code ? String(err.code) : '';
  const msg = [err.message, err.details, err.hint].filter(Boolean).join(' ').toLowerCase();
  return code === '22P02' || msg.includes('invalid input value for enum');
}

export async function registrarPagamento({ comandaId, finalizadoraId, metodo, valor, status = 'Pago', codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!codigo) throw new Error('Empresa não identificada (codigo_empresa ausente).')
  
  // Garante que o status seja válido ou usa 'Pago' como padrão
  const statusValido = (status && ['Pendente', 'Pago', 'Estornado', 'Cancelado'].includes(status)) 
    ? status 
    : 'Pago'
  
  const payload = {
    comanda_id: comandaId,
    finalizadora_id: finalizadoraId,
    metodo: (metodo && typeof metodo === 'string' && metodo.trim()) ? metodo.trim() : 'outros',
    valor: Math.max(0, Number(valor) || 0),
    status: statusValido,
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
    
    if (error) throw error
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
    
    // Se falhar, tenta uma abordagem mais simples sem o status
    if (error.code === '22P02' || error.message?.includes('invalid input value for enum')) {
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
