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
    .order('codigo_interno', { ascending: true, nullsFirst: false })
    .order('nome', { ascending: true })
  if (codigo) q = q.eq('codigo_empresa', codigo)
  if (somenteAtivas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  const rows = data || []
  // Garantir ordenação por código (numérico) mesmo se a coluna for texto
  rows.sort((a, b) => {
    const ca = parseInt(a?.codigo_interno) || 0;
    const cb = parseInt(b?.codigo_interno) || 0;
    if (ca !== cb) return ca - cb;
    const na = (a?.nome || '').toLowerCase();
    const nb = (b?.nome || '').toLowerCase();
    return na.localeCompare(nb);
  });
  return rows
}

export async function criarFinalizadora(payload, codigoEmpresa) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const row = {
    codigo_interno: payload?.codigo_interno || null,
    codigo_sefaz: payload?.codigo_sefaz || null,
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

// Resumo consolidado de uma sessão específica de caixa (evita mistura entre sessões no mesmo dia)
// Retorna: { from, to, totalPorFinalizadora, totalEntradas, totalVendasBrutas, totalDescontos, totalVendasLiquidas,
//            saldoInicial, saldoFinal, movimentos: { suprimentos, sangrias, ajustes, troco, totalMovimentos } }
export async function listarResumoDaSessao({ caixaSessaoId, codigoEmpresa } = {}) {
  if (!caixaSessaoId) throw new Error('caixaSessaoId é obrigatório')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Buscar janela da sessão e saldos
  let q = supabase
    .from('caixa_sessoes')
    .select('id, aberto_em, fechado_em, saldo_inicial, saldo_final')
    .eq('id', caixaSessaoId)
    .limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: sessRows, error: sErr } = await q
  if (sErr) throw sErr
  const sess = Array.isArray(sessRows) ? sessRows[0] : sessRows
  if (!sess) throw new Error('Sessão não encontrada')
  const from = sess.aberto_em
  const to = sess.fechado_em || new Date().toISOString()
  // Resumo por período, limitado ao intervalo da sessão
  const base = await listarResumoPeriodo({ from, to, codigoEmpresa: codigo })
  // Movimentações dessa sessão
  let suprimentos = 0, sangrias = 0, ajustes = 0, troco = 0
  try {
    let qm = supabase
      .from('caixa_movimentacoes')
      .select('tipo, valor')
      .eq('caixa_sessao_id', caixaSessaoId)
    if (codigo) qm = qm.eq('codigo_empresa', codigo)
    const { data: movs } = await qm
    for (const m of (movs || [])) {
      const v = Number(m?.valor || 0)
      const t = String(m?.tipo || '').toLowerCase()
      if (t === 'suprimento') suprimentos += v
      else if (t === 'sangria') sangrias += v
      else if (t === 'ajuste') ajustes += v
      else if (t === 'troco') troco += v
    }
  } catch {}
  const totalMovimentos = suprimentos + ajustes - sangrias - troco
  return {
    ...base,
    saldoInicial: Number(sess.saldo_inicial || 0),
    saldoFinal: sess.saldo_final != null ? Number(sess.saldo_final) : null,
    movimentos: { suprimentos, sangrias, ajustes, troco, totalMovimentos },
  }
}

export async function atualizarFinalizadora(id, payload, codigoEmpresa) {
  if (!id) throw new Error('ID inválido')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  const row = {
    codigo_interno: payload?.codigo_interno || null,
    codigo_sefaz: payload?.codigo_sefaz || null,
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

// Busca finalizadoras em lote e retorna mapa { comanda_id: 'Pix +2' ou 'Dinheiro' }
export async function listarFinalizadorasPorComandas(comandaIds = [], codigoEmpresa) {
  if (!Array.isArray(comandaIds) || comandaIds.length === 0) return {};
  const codigo = codigoEmpresa || getCachedCompanyCode();
  let q = supabase
    .from('pagamentos')
    .select('comanda_id, metodo, status, finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
    .in('comanda_id', comandaIds);
  if (codigo) q = q.eq('codigo_empresa', codigo);
  const { data, error } = await q;
  if (error) throw error;
  
  const map = {};
  for (const pg of (data || [])) {
    const ok = (pg.status || 'Pago') !== 'Cancelado' && (pg.status || 'Pago') !== 'Estornado';
    if (!ok) continue;
    const id = pg.comanda_id;
    // Priorizar nome da finalizadora, fallback para metodo
    const nome = pg?.finalizadoras?.nome || pg.metodo || 'Outros';
    if (!map[id]) map[id] = [];
    map[id].push(nome);
  }
  
  // Formatar: primeira finalizadora + contador se houver mais
  const out = {};
  for (const [k, nomes] of Object.entries(map)) {
    if (nomes.length === 0) {
      out[k] = '—';
    } else if (nomes.length === 1) {
      out[k] = nomes[0];
    } else {
      // Mostrar primeira + contador
      out[k] = `${nomes[0]} +${nomes.length - 1}`;
    }
  }
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
  console.log('[getOrCreateComandaBalcao] Iniciando com codigo_empresa:', codigo)
  
  // Bloqueio: exigir caixa aberto
  await assertCaixaAberto({ codigoEmpresa: codigo })
  
  const atual = await listarComandaBalcaoAberta({ codigoEmpresa: codigo })
  if (atual) {
    console.log('[getOrCreateComandaBalcao] Comanda existente encontrada:', atual)
    return atual
  }
  
  // IMPORTANTE: Apenas campos básicos - tudo mais é gerado automaticamente
  // codigo_empresa: DEFAULT get_my_company_code()
  // tipo e is_balcao: colunas geradas
  const payload = { 
    status: 'open', 
    mesa_id: null, 
    aberto_em: new Date().toISOString()
  }
  
  console.log('[getOrCreateComandaBalcao] Criando nova comanda (codigo_empresa via DEFAULT):', payload)
  const { data, error } = await supabase.from('comandas').insert(payload).select('id,status,aberto_em,tipo,codigo_empresa').single()
  
  if (error) {
    console.error('[getOrCreateComandaBalcao] ERRO ao criar comanda:', error)
    throw error
  }
  
  console.log('[getOrCreateComandaBalcao] Comanda criada com sucesso:', data)
  console.log('[getOrCreateComandaBalcao] Codigo da comanda criada:', data?.codigo_empresa, 'vs esperado:', codigo)
  
  // Aguardar um momento para o RLS processar (consistência eventual)
  await new Promise(r => setTimeout(r, 100))
  
  return data
}

// Cria SEMPRE uma nova comanda de balcão (sem mesa)
export async function criarComandaBalcao({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  // Bloqueio: exigir caixa aberto
  await assertCaixaAberto({ codigoEmpresa: codigo })
  
  // Apenas campos básicos - resto é gerado
  const payload = {
    status: 'open',
    mesa_id: null,
    aberto_em: new Date().toISOString()
  }
  
  console.log('[criarComandaBalcao] Criando comanda (codigo_empresa via DEFAULT):', payload)
  const { data, error } = await supabase.from('comandas').insert(payload).select('id,status,aberto_em,tipo,codigo_empresa').single()
  if (error) {
    console.error('[criarComandaBalcao] Erro ao criar:', error)
    throw error
  }
  console.log('[criarComandaBalcao] Comanda criada:', data)
  
  // Aguardar processamento do RLS
  await new Promise(r => setTimeout(r, 100))
  
  return data
}

// Histórico / Relatórios
export async function listarComandas({ status, from, to, search = '', limit = 50, offset = 0, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('comandas')
    .select('id, mesa_id, status, aberto_em, fechado_em, diferenca_pagamento')
    .order('fechado_em', { ascending: false, nullsFirst: false })
    .order('aberto_em', { ascending: false })
    .range(offset, offset + limit - 1)

  if (codigo) q = q.eq('codigo_empresa', codigo)

  if (status && Array.isArray(status) && status.length) {
    q = q.in('status', status)
  } else if (typeof status === 'string') {
    if (status === 'closed') {
      // Considera como fechadas tanto as com status 'closed' quanto as que possuem fechado_em preenchido
      // PostgREST OR syntax
      q = q.or('status.eq.closed,fechado_em.not.is.null').neq('status','cancelled')
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
  const trace = '[listarResumoPeriodo]'
  const codigo = codigoEmpresa || getCachedCompanyCode()
  
  console.log(`${trace} Iniciando consulta`)
  console.log(`${trace} Período: ${from || 'SEM from'} até ${to || 'SEM to'}`)
  console.log(`${trace} codigo_empresa: ${codigo}`)
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

  // 3) Pagamentos por finalizadora no período
  const porFinalizadora = {}
  let totalEntradas = 0
  
  // 3.1) Pagamentos de COMANDAS (tabela pagamentos)
  try {
    let qp = supabase
      .from('pagamentos')
      .select('metodo, valor, recebido_em, status, finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
    if (codigo) qp = qp.eq('codigo_empresa', codigo)
    if (from) qp = qp.gte('recebido_em', new Date(from).toISOString())
    if (to) qp = qp.lte('recebido_em', new Date(to).toISOString())
    
    console.log(`${trace} Consultando pagamentos de comandas...`)
    const { data, error } = await qp
    if (error) {
      console.error(`${trace} ❌ Erro ao buscar pagamentos:`, error)
      throw error
    }
    
    console.log(`${trace} Total de pagamentos de comandas encontrados: ${(data || []).length}`)
    
    for (const pg of (data || [])) {
      const ok = (pg.status || 'Pago') !== 'Cancelado' && (pg.status || 'Pago') !== 'Estornado'
      if (!ok) continue
      // Priorizar nome da finalizadora, fallback para metodo
      const key = pg.finalizadoras?.nome || pg.metodo || 'outros'
      const v = Number(pg.valor || 0)
      porFinalizadora[key] = (porFinalizadora[key] || 0) + v
      totalEntradas += v
    }
    
    console.log(`${trace} ✅ Resumo comandas por finalizadora:`, porFinalizadora)
  } catch (e) {
    console.error(`${trace} ❌ Exception ao processar pagamentos de comandas:`, e)
  }
  
  // 3.2) Pagamentos de AGENDAMENTOS (tabela agendamento_participantes)
  try {
    // Buscar agendamentos no período
    let qa = supabase
      .from('agendamentos')
      .select('id, inicio')
    if (codigo) qa = qa.eq('codigo_empresa', codigo)
    if (from) qa = qa.gte('inicio', new Date(from).toISOString())
    if (to) qa = qa.lte('inicio', new Date(to).toISOString())
    
    console.log(`${trace} Consultando agendamentos no período...`)
    const { data: agendamentos, error: agErr } = await qa
    if (agErr) {
      console.error(`${trace} ❌ Erro ao buscar agendamentos:`, agErr)
      throw agErr
    }
    
    console.log(`${trace} Total de agendamentos encontrados: ${(agendamentos || []).length}`)
    
    if (agendamentos && agendamentos.length > 0) {
      const agendamentoIds = agendamentos.map(a => a.id)
      
      // Buscar participantes pagos desses agendamentos
      let qp = supabase
        .from('agendamento_participantes')
        .select('valor_cota, status_pagamento, finalizadora_id, aplicar_taxa, finalizadoras!agp_finalizadora_id_fkey(nome, taxa_percentual)')
        .in('agendamento_id', agendamentoIds)
        .eq('status_pagamento', 'Pago')
      if (codigo) qp = qp.eq('codigo_empresa', codigo)
      
      console.log(`${trace} Consultando participantes pagos...`)
      const { data: participantes, error: partErr } = await qp
      if (partErr) {
        console.error(`${trace} ❌ Erro ao buscar participantes:`, partErr)
        throw partErr
      }
      
      console.log(`${trace} Total de participantes pagos encontrados: ${(participantes || []).length}`)
      
      for (const part of (participantes || [])) {
        const key = part.finalizadoras?.nome || 'Outros'
        let v = Number(part.valor_cota || 0)
        
        // Se taxa foi aplicada, remover a taxa do valor para obter o valor real recebido
        if (part.aplicar_taxa === true) {
          const taxa = Number(part.finalizadoras?.taxa_percentual || 0)
          if (taxa > 0) {
            // Valor original = valor_cota / (1 + taxa/100)
            v = v / (1 + taxa / 100)
            console.log(`${trace} 💰 Participante com taxa: valor_cota=${part.valor_cota}, taxa=${taxa}%, valor_real=${v.toFixed(2)}`)
          }
        }
        
        porFinalizadora[key] = (porFinalizadora[key] || 0) + v
        totalEntradas += v
      }
      
      console.log(`${trace} ✅ Resumo agendamentos por finalizadora:`, porFinalizadora)
    }
  } catch (e) {
    console.error(`${trace} ❌ Exception ao processar pagamentos de agendamentos:`, e)
  }
  
  console.log(`${trace} ✅ RESUMO FINAL por finalizadora:`, porFinalizadora)
  console.log(`${trace} Total de entradas: R$ ${totalEntradas.toFixed(2)}`)

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
  // Carregar pagamentos com JOIN para pegar nome e codigo_sefaz da finalizadora
  let q = supabase
    .from('pagamentos')
    .select('*, finalizadoras!pagamentos_finalizadora_id_fkey(id, nome, codigo_sefaz, codigo_interno)')
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
    .eq('status', 'active')  // ✅ Filtro: apenas clientes ativos
    .eq('flag_cliente', true)  // ✅ Filtro: apenas registros com flag_cliente = true
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
  const trace = '[listarComandasAbertas]'
  const codigo = codigoEmpresa || getCachedCompanyCode()

  const runOnce = async () => {
    // Timeout de 30s para conexões lentas
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('listarComandasAbertas timeout após 30s')), 30000)
    )

    // CONSULTA MAIS AMPLA: buscar todas as comandas sem fechado_em, independente do status
    let query = supabase
      .from('comandas')
      .select('id, mesa_id, status, aberto_em, fechado_em')
      .is('fechado_em', null)
      .neq('status', 'cancelled')
      .order('aberto_em', { ascending: false })
      .limit(500)
    if (codigo) query = query.eq('codigo_empresa', codigo)
    const { data, error } = await Promise.race([query, timeoutPromise])
    if (error) throw error
    return data || []
  }

  try {
    try {
      return await runOnce()
    } catch (e) {
      if (String(e?.message || '').includes('timeout')) {
        console.warn(`${trace} timeout na primeira tentativa, retornando array vazio`)
        return []
      }
      throw e
    }
  } catch (e) {
    console.error(`${trace} ❌ EXCEPTION:`, e?.message || e)
    // Retorna array vazio em vez de propagar erro
    return []
  }
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
  const trace = '[listMesas]'
  const codigo = codigoEmpresa || getCachedCompanyCode()
  
  const runOnce = async () => {
    // Timeout de 30s para conexões lentas
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('listMesas timeout após 30s')), 30000)
    )
    let query = supabase.from('mesas').select('id, numero, nome, status').order('numero', { ascending: true }).limit(200)
    if (codigo) query = query.eq('codigo_empresa', codigo)
    const { data, error } = await Promise.race([query, timeoutPromise])
    if (error) throw error
    return data || []
  }

  try {
    try {
      return await runOnce()
    } catch (e) {
      if (String(e?.message || '').includes('timeout')) {
        console.warn(`${trace} timeout na primeira tentativa, retornando array vazio`)
        return []
      }
      throw e
    }
  } catch (e) {
    console.error(`${trace} ❌ EXCEPTION:`, e?.message || e)
    // Retorna array vazio em vez de propagar erro
    return []
  }
}

// Lista pagamentos por comanda filtrando por status (ex.: 'Pendente')
export async function listarPagamentosPorComandaEStatus({ comandaId, status, codigoEmpresa } = {}) {
  if (!comandaId) throw new Error('comandaId é obrigatório')
  let q = supabase
    .from('pagamentos')
    .select('*')
    .eq('comanda_id', comandaId)
  if (status) q = q.eq('status', status)
  // garantir ordem estável das linhas de rascunho
  q = q.order('created_at', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// Salva o rascunho de pagamentos de uma comanda: apaga Pendente atuais e recria a partir das linhas
export async function salvarRascunhoPagamentosComanda({ comandaId, linhas, codigoEmpresa } = {}) {
  if (!comandaId) throw new Error('comandaId é obrigatório')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!Array.isArray(linhas)) return
  // Remove rascunhos atuais (status Pendente)
  await supabase.from('pagamentos').delete().eq('comanda_id', comandaId).eq('status', 'Pendente')
  // Recria cada linha como pagamento Pendente
  for (const ln of linhas) {
    const v = Number(ln?.valor || 0)
    if (v <= 0) continue
    const metodo = ln?.metodo || ln?.metodoNome || 'outros'
    await registrarPagamento({
      comandaId,
      finalizadoraId: ln?.finalizadoraId || ln?.methodId || null,
      metodo,
      valor: v,
      status: 'Pendente',
      codigoEmpresa: codigo,
      clienteId: ln?.clienteId || ln?.clientId || null,
    })
  }
}

// Promove todos pagamentos Pendente de uma comanda para Pago
export async function promoverPagamentosRascunhoParaPago({ comandaId, codigoEmpresa } = {}) {
  if (!comandaId) throw new Error('comandaId é obrigatório')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let q = supabase
    .from('pagamentos')
    .update({ status: 'Pago', recebido_em: new Date().toISOString() })
    .eq('comanda_id', comandaId)
    .eq('status', 'Pendente')
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { error } = await q
  if (error) throw error
  return true
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
  let q = supabase.from('caixa_sessoes').select('id,status,aberto_em,saldo_inicial').eq('status', 'open').order('aberto_em', { ascending: false }).limit(1)
  if (codigo) q = q.eq('codigo_empresa', codigo)
  const { data: abertas, error: errOpen } = await q
  if (errOpen) throw errOpen
  if (abertas && abertas.length > 0) {
    const sess = abertas[0]
    // Se a sessão aberta é de um dia anterior (stale), fechamos automaticamente e abrimos uma nova
    try {
      const aberto = new Date(sess.aberto_em)
      const now = new Date()
      const isAnotherDay = aberto.toDateString() !== now.toDateString()
      if (isAnotherDay) {
        // Guard: não fechar automaticamente se houver comandas abertas
        try {
          const abertasCmd = await listarComandasAbertas({ codigoEmpresa: codigo })
          if (Array.isArray(abertasCmd) && abertasCmd.length > 0) {
            console.warn('[ensureCaixaAberto] Sessão de dia anterior detectada, mas há comandas abertas. Não fechar automaticamente.')
            return sess
          }
        } catch {}
        const fechadoAgora = now.toISOString()
        // Recalcular entradas e movimentos da sessão antiga
        let entradas = 0; let movTotal = 0
        try {
          const tmp = await listarResumoPeriodo({ from: sess.aberto_em, to: fechadoAgora, codigoEmpresa: codigo })
          entradas = Number(tmp?.totalEntradas || 0)
        } catch {}
        try {
          let qmov = supabase.from('caixa_movimentacoes').select('tipo,valor').eq('caixa_sessao_id', sess.id)
          if (codigo) qmov = qmov.eq('codigo_empresa', codigo)
          const { data: mv } = await qmov
          for (const m of (mv || [])) {
            const v = Number(m?.valor || 0)
            const t = String(m?.tipo || '').toLowerCase()
            if (t === 'suprimento' || t === 'ajuste') movTotal += v
            else if (t === 'sangria' || t === 'troco') movTotal -= v
          }
        } catch {}
        const saldoFinalSess = Number(sess?.saldo_inicial || 0) + entradas + movTotal
        let up = supabase.from('caixa_sessoes')
          .update({ status: 'closed', saldo_final: saldoFinalSess, fechado_em: fechadoAgora })
          .eq('id', sess.id)
          .eq('status', 'open')
        if (codigo) up = up.eq('codigo_empresa', codigo)
        await up
        // Snapshot mínimo da sessão antiga
        try {
          const resumo = await listarResumoDaSessao({ caixaSessaoId: sess.id, codigoEmpresa: codigo }).catch(async () => (
            await listarResumoPeriodo({ from: sess.aberto_em, to: fechadoAgora, codigoEmpresa: codigo })
          ))
          const payload = {
            codigo_empresa: codigo || getCachedCompanyCode(),
            caixa_sessao_id: sess.id,
            periodo_de: (resumo?.from) || sess.aberto_em,
            periodo_ate: (resumo?.to) || fechadoAgora,
            total_bruto: Number(resumo?.totalVendasBrutas || 0),
            total_descontos: Number(resumo?.totalDescontos || 0),
            total_liquido: Number(resumo?.totalVendasLiquidas || 0),
            total_entradas: Number(resumo?.totalEntradas || 0),
            por_finalizadora: resumo?.totalPorFinalizadora || {}
          }
          const pf = payload.por_finalizadora
          await supabase.from('caixa_resumos').insert({ ...payload, por_finalizadora: (pf && typeof pf !== 'string') ? JSON.stringify(pf) : pf })
        } catch {}
        // Segue para abrir nova sessão abaixo
      } else {
        // Mesma data: NÃO fechar automaticamente. Apenas garantir saldo_inicial e retornar.
        try {
          if ((sess?.saldo_inicial == null) && (saldoInicial != null)) {
            let uq = supabase.from('caixa_sessoes').update({ saldo_inicial: Number(saldoInicial) || 0 }).eq('id', sess.id)
            if (codigo) uq = uq.eq('codigo_empresa', codigo)
            await uq
            return { ...sess, saldo_inicial: Number(saldoInicial) || 0 }
          }
        } catch {}
        return sess
      }
    } catch {}
    return sess
  }

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
// (removida definição duplicada de listarFechamentosCaixa aqui; ver versão consolidada mais abaixo)

export async function fecharCaixa({ saldoFinal = null, valorFinalDinheiro = null, codigoEmpresa } = {}) {
  console.log('[fecharCaixa] Iniciando fechamento:', { valorFinalDinheiro, saldoFinal, codigoEmpresa });
  const codigo = codigoEmpresa || getCachedCompanyCode()
  
  // LIMPEZA PREVENTIVA: Corrigir comandas com status inconsistente (cancelled mas sem fechado_em)
  try {
    console.log('[fecharCaixa] 🧹 Limpeza preventiva: corrigindo comandas inconsistentes...');
    const { data: inconsistentes } = await supabase
      .from('comandas')
      .select('id, status, fechado_em')
      .eq('codigo_empresa', codigo)
      .is('fechado_em', null)
      .neq('status', 'open')
      .neq('status', 'awaiting-payment');
    
    if (inconsistentes && inconsistentes.length > 0) {
      console.log(`[fecharCaixa] 🔧 Encontradas ${inconsistentes.length} comandas inconsistentes, corrigindo...`);
      const nowIso = new Date().toISOString();
      for (const cmd of inconsistentes) {
        try {
          await supabase
            .from('comandas')
            .update({ fechado_em: nowIso })
            .eq('id', cmd.id)
            .eq('codigo_empresa', codigo);
          console.log(`[fecharCaixa] ✅ Comanda ${cmd.id} (status: ${cmd.status}) corrigida`);
        } catch {}
      }
    } else {
      console.log('[fecharCaixa] ✅ Nenhuma comanda inconsistente encontrada');
    }
  } catch (e) {
    console.warn('[fecharCaixa] ⚠️ Erro na limpeza preventiva:', e?.message);
  }
  
  // Bloqueio: não permitir fechamento com comandas abertas (inclui balcão e mesas)
  try {
    let abertas = await listarComandasAbertas({ codigoEmpresa: codigo })
    abertas = abertas || []
    
    console.log(`[fecharCaixa] 📊 Comandas abertas encontradas: ${abertas.length}`, abertas.map(a => ({ id: a.id, status: a.status, mesa: a.mesa_id })))

    // BLOQUEIO IMEDIATO: Se há comandas abertas, não permitir fechamento
    if (abertas && abertas.length > 0) {
      const ids = abertas.map(a => `${a.id}${a.mesa_id ? `@mesa:${a.mesa_id}` : '@balcao'}`).join(', ')
      throw new Error(`Existem ${abertas.length} comanda(s) aberta(s). Feche todas as comandas antes de encerrar o caixa.`)
    }

    // 2) Recarregar a lista e bloquear somente se ainda restarem abertas com itens
    // Retry mais robusto para consistência eventual (aumentado)
    let attempts = 0
    while (attempts < 12) {
      abertas = await listarComandasAbertas({ codigoEmpresa: codigo })
      if (!abertas || abertas.length === 0) break
      await new Promise(r => setTimeout(r, 250))
      attempts++
    }
    if (abertas && abertas.length > 0) {
      // Verificação refinada: considerar apenas comandas realmente ativas
      const idsAll = abertas.map(a => a.id)
      let itensBy = new Map();
      let paysBy = new Map();
      try {
        // Itens por comanda
        if (idsAll.length > 0) {
          let qi = supabase
            .from('comanda_itens')
            .select('comanda_id, quantidade')
            .in('comanda_id', idsAll)
          if (codigo) qi = qi.eq('codigo_empresa', codigo)
          const { data: itensRows } = await qi
          itensBy = new Map();
          for (const r of (itensRows || [])) {
            const k = r.comanda_id; const q = Number(r.quantidade || 0);
            itensBy.set(k, (itensBy.get(k) || 0) + q);
          }
        }
      } catch {}
      try {
        // Pagamentos válidos (não cancelados/estornados)
        if (idsAll.length > 0) {
          let qp = supabase
            .from('pagamentos')
            .select('comanda_id, status')
            .in('comanda_id', idsAll)
          if (codigo) qp = qp.eq('codigo_empresa', codigo)
          const { data: payRows } = await qp
          paysBy = new Map();
          for (const p of (payRows || [])) {
            const st = String(p?.status || 'Pago');
            if (st === 'Cancelado' || st === 'Estornado') continue;
            const k = p.comanda_id;
            paysBy.set(k, (paysBy.get(k) || 0) + 1);
          }
        }
      } catch {}

      // Auto-fechar as que não têm itens nem pagamentos
      for (const c of abertas) {
        const hasItens = (Number(itensBy.get(c.id) || 0) > 0)
        const hasPays = (Number(paysBy.get(c.id) || 0) > 0)
        if (!hasItens && !hasPays) {
          try { await fecharComandaEMesa({ comandaId: c.id, codigoEmpresa: codigo }); } catch {}
        }
      }

      // Recarregar e filtrar genuinamente abertas
      let still = await listarComandasAbertas({ codigoEmpresa: codigo })
      still = still || []
      if (still.length > 0) {
        // Checar novamente itens/pagamentos e ignorar fantasmas sem itens/pagamentos (recém-criadas)
        const idsAll2 = still.map(a => a.id)
        let itensBy2 = new Map();
        let paysBy2 = new Map();
        try {
          if (idsAll2.length > 0) {
            let qi2 = supabase.from('comanda_itens').select('comanda_id, quantidade').in('comanda_id', idsAll2)
            if (codigo) qi2 = qi2.eq('codigo_empresa', codigo)
            const { data: it2 } = await qi2; itensBy2 = new Map();
            for (const r of (it2 || [])) { const k=r.comanda_id; const q=Number(r.quantidade||0); itensBy2.set(k, (itensBy2.get(k)||0)+q); }
          }
        } catch {}
        try {
          if (idsAll2.length > 0) {
            let qp2 = supabase.from('pagamentos').select('comanda_id, status').in('comanda_id', idsAll2)
            if (codigo) qp2 = qp2.eq('codigo_empresa', codigo)
            const { data: p2 } = await qp2; paysBy2 = new Map();
            for (const p of (p2 || [])) { const st=String(p?.status||'Pago'); if (st==='Cancelado'||st==='Estornado') continue; const k=p.comanda_id; paysBy2.set(k,(paysBy2.get(k)||0)+1); }
          }
        } catch {}
        const active = still.filter(c => (Number(itensBy2.get(c.id)||0) > 0) || (Number(paysBy2.get(c.id)||0) > 0))
        if (active.length > 0) {
          const ids = active.map(a => `${a.id}${a.mesa_id ? `@mesa:${a.mesa_id}` : '@balcao'}`).join(', ')
          throw new Error(`Existem ${active.length} comandas abertas. IDs: ${ids}. Feche todas antes de encerrar o caixa.`)
        }
        // Somente fantasmas sem itens/pagamentos restantes — prosseguir com o fechamento
      }
    }
  } catch (chkErr) {
    // Qualquer incerteza deve BLOQUEAR o fechamento para segurança
    if (chkErr && /Existem \d+ comandas/.test(chkErr.message || '')) throw chkErr
    const err = new Error('Falha ao validar comandas abertas. Tente novamente e verifique sua conexão.')
    err.code = 'CASH_CLOSE_VALIDATION_FAILED'
    throw err
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
  let totalMovimentos = 0 // suprimentos/sangrias/ajustes da sessão
  try {
    const resumoTmp = await listarResumoPeriodo({ from: abertoEm, to: fechadoEmIso, codigoEmpresa: codigo })
    totalEntradas = Number(resumoTmp?.totalEntradas || 0)
  } catch {}
  // Somar movimentações de caixa da sessão atual (suprimento adiciona, sangria subtrai, ajuste adiciona)
  try {
    let qmov = supabase
      .from('caixa_movimentacoes')
      .select('tipo, valor')
      .eq('caixa_sessao_id', caixaId)
    if (codigo) qmov = qmov.eq('codigo_empresa', codigo)
    const { data: movRows } = await qmov
    for (const m of (movRows || [])) {
      const v = Number(m?.valor || 0)
      const t = String(m?.tipo || '').toLowerCase()
      if (t === 'suprimento' || t === 'ajuste') totalMovimentos += v
      else if (t === 'sangria') totalMovimentos -= v
      else if (t === 'troco') totalMovimentos -= v // regra: troco sai do caixa
    }
  } catch {}
  const efetivoSaldoFinal = (saldoFinal !== null && saldoFinal !== undefined)
    ? Number(saldoFinal)
    : (saldoInicialSessao + totalEntradas + totalMovimentos)

  // Double-check imediatamente antes de fechar: aplicar verificação refinada e ignorar 'fantasmas'
  try {
    let abertasFinal = await listarComandasAbertas({ codigoEmpresa: codigo })
    abertasFinal = abertasFinal || []
    if (abertasFinal.length > 0) {
      const idsAllF = abertasFinal.map(a => a.id)
      let itensF = new Map();
      let paysF = new Map();
      try {
        if (idsAllF.length > 0) {
          let qiF = supabase.from('comanda_itens').select('comanda_id, quantidade').in('comanda_id', idsAllF)
          if (codigo) qiF = qiF.eq('codigo_empresa', codigo)
          const { data: itF } = await qiF
          itensF = new Map();
          for (const r of (itF || [])) { const k=r.comanda_id; const q=Number(r.quantidade||0); itensF.set(k, (itensF.get(k)||0)+q); }
        }
      } catch {}
      try {
        if (idsAllF.length > 0) {
          let qpF = supabase.from('pagamentos').select('comanda_id, status').in('comanda_id', idsAllF)
          if (codigo) qpF = qpF.eq('codigo_empresa', codigo)
          const { data: pF } = await qpF
          paysF = new Map();
          for (const p of (pF || [])) { const st=String(p?.status||'Pago'); if (st==='Cancelado'||st==='Estornado') continue; const k=p.comanda_id; paysF.set(k,(paysF.get(k)||0)+1); }
        }
      } catch {}
      // Auto-fechar fantasmas
      for (const c of abertasFinal) {
        const hasItens = (Number(itensF.get(c.id)||0) > 0)
        const hasPays = (Number(paysF.get(c.id)||0) > 0)
        if (!hasItens && !hasPays) {
          try { await fecharComandaEMesa({ comandaId: c.id, codigoEmpresa: codigo }); } catch {}
        }
      }
      // Recarregar e filtrar ativas
      let rest = await listarComandasAbertas({ codigoEmpresa: codigo })
      rest = rest || []
      if (rest.length > 0) {
        const ids = rest.map(a => `${a.id}${a.mesa_id ? `@mesa:${a.mesa_id}` : '@balcao'}`).join(', ')
        throw new Error(`Existem ${rest.length} comandas abertas. IDs: ${ids}. Feche todas antes de encerrar o caixa.`)
      }
    }
  } catch (e) {
    // Se falhar a verificação, bloquear por segurança
    if (!(e && e.message)) {
      const err = new Error('Falha ao validar comandas abertas no momento do fechamento. Tente novamente.')
      err.code = 'CASH_CLOSE_FINAL_CHECK_FAILED'
      throw err
    }
    throw e
  }

  // Fechar sessão agora com saldo_final definido (idempotente: apenas se ainda estiver 'open')
  let up = supabase
    .from('caixa_sessoes')
    .update({ status: 'closed', saldo_final: efetivoSaldoFinal, fechado_em: fechadoEmIso })
    .eq('id', caixaId)
    .eq('status', 'open')
  if (codigo) up = up.eq('codigo_empresa', codigo)
  const { data: closedData, error: closeErr } = await up.select('id,status,fechado_em,saldo_final').single()
  if (closeErr) {
    // Se nenhuma linha foi atualizada por já estar fechada, buscar e retornar a sessão
    const msg = String(closeErr.message || '')
    if (msg.toLowerCase().includes('row') || msg.toLowerCase().includes('single')) {
      // Buscar sessão existente
      let qSess = supabase.from('caixa_sessoes').select('id,status,fechado_em,saldo_final').eq('id', caixaId).limit(1)
      if (codigo) qSess = qSess.eq('codigo_empresa', codigo)
      const { data: already } = await qSess
      if (already && already[0]) {
        return already[0]
      }
    }
    throw closeErr
  }

  // Criar snapshot do fechamento em caixa_resumos
  try {
    // Criar snapshot apenas se a sessão acabou de ser fechada neste chamado
    if (abertoEm && fechadoEmIso && closedData?.status === 'closed') {
      // Usar o resumo específico da sessão para incluir movimentos e saldos
      let sessResumo;
      try {
        sessResumo = await listarResumoDaSessao({ caixaSessaoId: caixaId, codigoEmpresa: codigo })
      } catch {
        // Fallback para período simples se função de sessão falhar
        sessResumo = await listarResumoPeriodo({ from: abertoEm, to: fechadoEmIso, codigoEmpresa: codigo })
      }

      // Payload mínimo, compatível com schemas enxutos (sem colunas extras)
      const payload = {
        codigo_empresa: codigo || getCachedCompanyCode(),
        caixa_sessao_id: caixaId,
        periodo_de: (sessResumo?.from) || abertoEm,
        periodo_ate: (sessResumo?.to) || fechadoEmIso,
        total_bruto: Number(sessResumo?.totalVendasBrutas || 0),
        total_descontos: Number(sessResumo?.totalDescontos || 0),
        total_liquido: Number(sessResumo?.totalVendasLiquidas || 0),
        total_entradas: Number(sessResumo?.totalEntradas || 0),
        por_finalizadora: sessResumo?.totalPorFinalizadora || {}
      }
      // Tentar persistir valor_final_dinheiro e diferenca_dinheiro se o schema suportar
      const contado = (valorFinalDinheiro != null) ? Number(valorFinalDinheiro) : null;
      const diferenca = (contado != null) ? (contado - Number(efetivoSaldoFinal || 0)) : null;
      console.log('[fecharCaixa] Valores para snapshot:', { contado, diferenca, efetivoSaldoFinal, valorFinalDinheiroOriginal: valorFinalDinheiro });

      // Tenta inserir com tolerância a colunas ausentes (movimentos/saldo_inicial/saldo_final)
      const tryInsert = async (payload) => {
        // Monta payload coerente (por_finalizadora pode ser objeto)
        const coerced = { ...payload };
        const pf = coerced.por_finalizadora;
        if (pf && typeof pf !== 'string') coerced.por_finalizadora = JSON.stringify(pf);

        // Feature flags de suporte a colunas opcionais (cache local)
        let supportValor = true, supportDif = true;
        try {
          const f1 = localStorage.getItem('schema:caixa_resumos:valor_final_dinheiro');
          const f2 = localStorage.getItem('schema:caixa_resumos:diferenca_dinheiro');
          if (f1 === 'no') supportValor = false;
          if (f2 === 'no') supportDif = false;
        } catch {}
        // Probe: se flags indicam que não existe, testar novamente (após migração pode existir)
        if (!supportValor || !supportDif) {
          try {
            let qProbe = supabase
              .from('caixa_resumos')
              .select('valor_final_dinheiro, diferenca_dinheiro')
              .limit(1);
            const { error: eProbe } = await qProbe;
            if (!eProbe) {
              supportValor = true; supportDif = true;
              try {
                localStorage.setItem('schema:caixa_resumos:valor_final_dinheiro', 'yes');
                localStorage.setItem('schema:caixa_resumos:diferenca_dinheiro', 'yes');
              } catch {}
            }
          } catch {}
        }

        // Se não suportar, já envia direto sem as colunas
        if (!supportValor && !supportDif) {
          return await supabase.from('caixa_resumos').insert(coerced);
        }

        // 1ª tentativa: incluir apenas colunas suportadas pelo flag
        let attempt = { ...coerced };
        if (supportValor && contado != null) attempt.valor_final_dinheiro = contado;
        if (supportDif && diferenca != null) attempt.diferenca_dinheiro = diferenca;
        console.log('[fecharCaixa] Tentando inserir snapshot com:', { supportValor, supportDif, contado, diferenca, hasValorFinalDinheiro: 'valor_final_dinheiro' in attempt });
        const ins1 = await supabase.from('caixa_resumos').insert(attempt);
        if (!ins1.error) return ins1;

        // Erro: se for coluna ausente (42703/PGRST204), desabilitar flags e refazer sem colunas
        const msg = `${ins1.error?.message || ''} ${ins1.error?.details || ''}`.toLowerCase();
        const code = ins1.error?.code;
        const isNoColumn = code === '42703' || code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
        if (isNoColumn) {
          try {
            if (attempt.valor_final_dinheiro !== undefined) localStorage.setItem('schema:caixa_resumos:valor_final_dinheiro', 'no');
            if (attempt.diferenca_dinheiro !== undefined) localStorage.setItem('schema:caixa_resumos:diferenca_dinheiro', 'no');
          } catch {}
          return await supabase.from('caixa_resumos').insert(coerced);
        }

        // Qualquer outro erro: propagar
        return ins1;
      };
      const ins = await tryInsert(payload);
      if (ins.error) {
        console.error('[fecharCaixa] Erro ao inserir snapshot:', ins.error);
        throw ins.error;
      }
      console.log('[fecharCaixa] ✅ Snapshot inserido com sucesso');
      // Verificar se foi realmente salvo
      try {
        const { data: check } = await supabase.from('caixa_resumos').select('valor_final_dinheiro, diferenca_dinheiro').eq('caixa_sessao_id', caixaId).order('criado_em', { ascending: false }).limit(1).single();
        console.log('[fecharCaixa] Verificação pós-insert:', check);
      } catch (e) {
        console.warn('[fecharCaixa] Falha ao verificar snapshot:', e?.message);
      }
    }
  } catch (snapErr) {
    console.warn('[fecharCaixa] Falha ao gravar snapshot de fechamento:', snapErr)
  }

  // Retorna a sessão fechada (linha atualizada)
  try {
    // Saneamento: garantir que não restou nenhuma sessão 'open' por inconsistência
    let qLeft = supabase.from('caixa_sessoes').select('id,aberto_em,saldo_inicial').eq('status','open')
    if (codigo) qLeft = qLeft.eq('codigo_empresa', codigo)
    const { data: leftOpen } = await qLeft
    if (Array.isArray(leftOpen) && leftOpen.length > 0) {
      for (const sess of leftOpen) {
        try {
          const aberto = sess?.aberto_em;
          const saldoIni = Number(sess?.saldo_inicial || 0);
          const fechadoAgora = new Date().toISOString();
          // Recalcular entradas do período desta sessão remanescente
          let entradas = 0; let movTotal = 0;
          try {
            const tmp = await listarResumoPeriodo({ from: aberto, to: fechadoAgora, codigoEmpresa: codigo })
            entradas = Number(tmp?.totalEntradas || 0)
          } catch {}
          try {
            let qmov = supabase.from('caixa_movimentacoes').select('tipo,valor').eq('caixa_sessao_id', sess.id)
            if (codigo) qmov = qmov.eq('codigo_empresa', codigo)
            const { data: mv } = await qmov
            for (const m of (mv || [])) {
              const v = Number(m?.valor || 0)
              const t = String(m?.tipo || '').toLowerCase()
              if (t === 'suprimento' || t === 'ajuste') movTotal += v
              else if (t === 'sangria' || t === 'troco') movTotal -= v
            }
          } catch {}
          const saldoFinalSess = saldoIni + entradas + movTotal;
          await supabase.from('caixa_sessoes')
            .update({ status: 'closed', saldo_final: saldoFinalSess, fechado_em: fechadoAgora })
            .eq('id', sess.id)
            .eq('status', 'open')
            .eq(codigo ? 'codigo_empresa' : 'id', codigo ? codigo : sess.id)
          // Criar snapshot mínimo
          try {
            const resumo = await listarResumoDaSessao({ caixaSessaoId: sess.id, codigoEmpresa: codigo }).catch(async () => (
              await listarResumoPeriodo({ from: aberto, to: fechadoAgora, codigoEmpresa: codigo })
            ))
            const payload2 = {
              codigo_empresa: codigo || getCachedCompanyCode(),
              caixa_sessao_id: sess.id,
              periodo_de: (resumo?.from) || aberto,
              periodo_ate: (resumo?.to) || fechadoAgora,
              total_bruto: Number(resumo?.totalVendasBrutas || 0),
              total_descontos: Number(resumo?.totalDescontos || 0),
              total_liquido: Number(resumo?.totalVendasLiquidas || 0),
              total_entradas: Number(resumo?.totalEntradas || 0),
              por_finalizadora: resumo?.totalPorFinalizadora || {}
            }
            const pf = payload2.por_finalizadora
            await supabase.from('caixa_resumos').insert({ ...payload2, por_finalizadora: (pf && typeof pf !== 'string') ? JSON.stringify(pf) : pf })
          } catch {}
        } catch (e) {
          try { console.warn('[fecharCaixa] Saneamento: falhou ao fechar sessão remanescente', sess?.id, e?.message || e) } catch {}
        }
      }
    }
  } catch {}
  return closedData
}

// Lista histórico de fechamentos de caixa (sessões fechadas) com dados opcionais do snapshot
export async function listarFechamentosCaixa({ from, to, limit = 50, codigoEmpresa } = {}) {
  console.log('[listarFechamentosCaixa] Iniciando busca de fechamentos', { from, to, limit });
  const codigo = codigoEmpresa || getCachedCompanyCode();
  // 1) Buscar sessões fechadas
  let q = supabase
    .from('caixa_sessoes')
    .select('id, aberto_em, fechado_em, saldo_inicial, saldo_final, status')
    .eq('status', 'closed')
    .order('fechado_em', { ascending: false })
    .limit(limit);
  if (codigo) q = q.eq('codigo_empresa', codigo);
  // Filtro de período
  if (from) q = q.gte('fechado_em', `${from}T00:00:00`);
  if (to) q = q.lte('fechado_em', `${to}T23:59:59`);
  const { data: sessoes, error } = await q;
  if (error) throw error;
  const rows = Array.isArray(sessoes) ? sessoes : [];
  console.log('[listarFechamentosCaixa] Sessões fechadas encontradas:', rows.length);
  if (rows.length === 0) return [];

  // 2) Enriquecer com snapshot (valor_final_dinheiro, diferenca_dinheiro) se existir
  const ids = rows.map(r => r.id);
  let snaps = [];
  try {
    // montar select com flags
    let supportValor = true, supportDif = true;
    try {
      const f1 = localStorage.getItem('schema:caixa_resumos:valor_final_dinheiro');
      const f2 = localStorage.getItem('schema:caixa_resumos:diferenca_dinheiro');
      if (f1 === 'no') supportValor = false;
      if (f2 === 'no') supportDif = false;
    } catch {}
    // Probe: se flags indicam que não existe, tentar revalidar
    if (!supportValor || !supportDif) {
      try {
        let qProbe = supabase
          .from('caixa_resumos')
          .select('valor_final_dinheiro, diferenca_dinheiro')
          .limit(1);
        const { error: eProbe } = await qProbe;
        if (!eProbe) {
          supportValor = true; supportDif = true;
          try {
            localStorage.setItem('schema:caixa_resumos:valor_final_dinheiro', 'yes');
            localStorage.setItem('schema:caixa_resumos:diferenca_dinheiro', 'yes');
          } catch {}
        }
      } catch {}
    }
    const baseCols = ['caixa_sessao_id'];
    if (supportValor) baseCols.push('valor_final_dinheiro');
    if (supportDif) baseCols.push('diferenca_dinheiro');
    const select1 = baseCols.join(', ');
    let qs = supabase
      .from('caixa_resumos')
      .select(select1)
      .in('caixa_sessao_id', ids)
      .order('criado_em', { ascending: false });
    if (codigo) qs = qs.eq('codigo_empresa', codigo);
    let { data, error: snapErr } = await qs;
    if (snapErr) {
      const code = snapErr?.code; const msg = `${snapErr?.message||''} ${snapErr?.details||''}`.toLowerCase();
      const isNoColumn = code === '42703' || code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
      if (isNoColumn) {
        try {
          if (supportValor) localStorage.setItem('schema:caixa_resumos:valor_final_dinheiro', 'no');
          if (supportDif) localStorage.setItem('schema:caixa_resumos:diferenca_dinheiro', 'no');
        } catch {}
        // Retry sem colunas opcionais
        let q2 = supabase
          .from('caixa_resumos')
          .select('caixa_sessao_id')
          .in('caixa_sessao_id', ids)
          .order('criado_em', { ascending: false });
        if (codigo) q2 = q2.eq('codigo_empresa', codigo);
        const { data: d2 } = await q2;
        snaps = d2 || [];
      } else {
        throw snapErr;
      }
    } else {
      snaps = data || [];
    }
  } catch (e) { 
    console.warn('[listarFechamentosCaixa] Erro ao buscar snapshots:', e?.message);
    snaps = []; 
  }
  console.log('[listarFechamentosCaixa] Snapshots encontrados:', snaps.length, snaps);
  const bySess = new Map(snaps.map(s => [s.caixa_sessao_id, s]));
  const result = rows.map(r => {
    const snap = bySess.get(r.id);
    const enriched = {
      ...r,
      valor_final_dinheiro: snap?.valor_final_dinheiro ?? null,
      diferenca_dinheiro: snap?.diferenca_dinheiro ?? null,
    };
    if (snap) {
      console.log(`[listarFechamentosCaixa] Sessão ${r.id} enriquecida com snapshot:`, { valor_final_dinheiro: snap.valor_final_dinheiro, diferenca_dinheiro: snap.diferenca_dinheiro });
    }
    return enriched;
  });
  console.log('[listarFechamentosCaixa] Resultado final:', result.length, 'sessões com dados enriquecidos');
  return result;
}

// Lê o snapshot do fechamento (se existir) para uma sessão específica
export async function getCaixaResumo({ caixaSessaoId, codigoEmpresa } = {}) {
  if (!caixaSessaoId) throw new Error('caixaSessaoId é obrigatório')
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let snap = null
  try {
    // Select com detecção de colunas opcionais
    let supportValor = true, supportDif = true;
    try {
      const f1 = localStorage.getItem('schema:caixa_resumos:valor_final_dinheiro');
      const f2 = localStorage.getItem('schema:caixa_resumos:diferenca_dinheiro');
      if (f1 === 'no') supportValor = false;
      if (f2 === 'no') supportDif = false;
    } catch {}
    // Probe: se flags indicam que não existe, tentar revalidar (migração recente)
    if (!supportValor || !supportDif) {
      try {
        let qProbe = supabase
          .from('caixa_resumos')
          .select('valor_final_dinheiro, diferenca_dinheiro')
          .limit(1);
        const { error: eProbe } = await qProbe;
        if (!eProbe) {
          supportValor = true; supportDif = true;
          try {
            localStorage.setItem('schema:caixa_resumos:valor_final_dinheiro', 'yes');
            localStorage.setItem('schema:caixa_resumos:diferenca_dinheiro', 'yes');
          } catch {}
        }
      } catch {}
    }
    const cols = [
      'caixa_sessao_id', 'periodo_de', 'periodo_ate', 'total_bruto', 'total_descontos', 'total_liquido', 'total_entradas', 'por_finalizadora'
    ];
    if (supportValor) cols.push('valor_final_dinheiro');
    if (supportDif) cols.push('diferenca_dinheiro');
    const sel = cols.join(', ');
    let q = supabase
      .from('caixa_resumos')
      .select(sel)
      .eq('caixa_sessao_id', caixaSessaoId)
      .order('criado_em', { ascending: false })
      .limit(1)
    if (codigo) q = q.eq('codigo_empresa', codigo)
    let { data, error } = await q
    if (error) {
      const code = error?.code; const msg = `${error?.message||''} ${error?.details||''}`.toLowerCase();
      const isNoColumn = code === '42703' || code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
      if (isNoColumn) {
        try {
          if (supportValor) localStorage.setItem('schema:caixa_resumos:valor_final_dinheiro', 'no');
          if (supportDif) localStorage.setItem('schema:caixa_resumos:diferenca_dinheiro', 'no');
        } catch {}
        // Retry sem as colunas opcionais
        let q2 = supabase
          .from('caixa_resumos')
          .select('caixa_sessao_id, periodo_de, periodo_ate, total_bruto, total_descontos, total_liquido, total_entradas, por_finalizadora')
          .eq('caixa_sessao_id', caixaSessaoId)
          .order('criado_em', { ascending: false })
          .limit(1)
        if (codigo) q2 = q2.eq('codigo_empresa', codigo)
        const { data: d2 } = await q2
        snap = d2?.[0] || null
      } else {
        throw error
      }
    } else {
      snap = data?.[0] || null
    }
  } catch (e) {
    // Se falhar (ex.: rede), continua com fallback dinâmico
    try { console.warn('[getCaixaResumo] Snapshot select falhou, usando fallback dinâmico:', e?.message || e) } catch {}
  }

  // Se não existir snapshot, ou se estiver incompleto, computa on-the-fly a partir da sessão
  if (!snap || typeof snap.saldo_inicial === 'undefined' || typeof snap.saldo_final === 'undefined') {
    const sessResumo = await listarResumoDaSessao({ caixaSessaoId, codigoEmpresa: codigo })
    // Obter saldos diretamente da sessão
    let sessRow = null
    try {
      let qs = supabase.from('caixa_sessoes').select('saldo_inicial, saldo_final').eq('id', caixaSessaoId).limit(1)
      if (codigo) qs = qs.eq('codigo_empresa', codigo)
      const { data: s } = await qs
      sessRow = s?.[0] || null
    } catch {}
    snap = {
      codigo_empresa: codigo,
      caixa_sessao_id: caixaSessaoId,
      periodo_de: sessResumo?.from || null,
      periodo_ate: sessResumo?.to || null,
      total_bruto: Number(sessResumo?.totalVendasBrutas || 0),
      total_descontos: Number(sessResumo?.totalDescontos || 0),
      total_liquido: Number(sessResumo?.totalVendasLiquidas || 0),
      total_entradas: Number(sessResumo?.totalEntradas || 0),
      por_finalizadora: sessResumo?.totalPorFinalizadora || {},
      saldo_inicial: Number(sessRow?.saldo_inicial ?? sessResumo?.saldoInicial ?? 0),
      saldo_final: (sessRow?.saldo_final != null) ? Number(sessRow.saldo_final) : null,
      // movimentos pode não existir como coluna no snapshot, mas usamos o agregado on-the-fly quando necessário
      movimentos: sessResumo?.movimentos || { suprimentos: 0, sangrias: 0, ajustes: 0, troco: 0, totalMovimentos: 0 }
    }
  } else {
    // Normalizar estrutura do snapshot: por_finalizadora pode vir string
    if (typeof snap.por_finalizadora === 'string') {
      try { snap.por_finalizadora = JSON.parse(snap.por_finalizadora) } catch { snap.por_finalizadora = {} }
    }
  }
  return snap
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
  
  try {
    // Apenas campos básicos - resto é gerado
    const payload = { 
      status: 'open', 
      aberto_em: new Date().toISOString()
    }
    
    if (mesaId) {
      payload.mesa_id = mesaId
    }
    
    console.log(`[abrirComandaParaMesa] Payload (codigo_empresa via DEFAULT):`, payload)
    
    const { data, error } = await supabase
      .from('comandas')
      .insert(payload)
      .select('*')
      .single()
    
    if (error) {
      console.error(`[abrirComandaParaMesa] ERRO ao criar comanda:`, error)
      throw error
    }
    
    console.log(`[abrirComandaParaMesa] ✅ Comanda criada:`, data)
    
    // Aguardar processamento do RLS
    await new Promise(r => setTimeout(r, 100))
    
    return data
    
  } catch (err) {
    console.error(`[abrirComandaParaMesa] ERRO:`, err)
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

// Busca TODOS os itens de TODAS as comandas abertas (para controle de estoque global)
export async function listarItensDeTodasComandasAbertas({ codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  
  // 1. Buscar todas as comandas abertas (fechado_em IS NULL significa aberta)
  let qComandas = supabase
    .from('comandas')
    .select('id')
    .is('fechado_em', null)
  if (codigo) qComandas = qComandas.eq('codigo_empresa', codigo)
  
  const { data: comandas, error: errComandas } = await qComandas
  if (errComandas) throw errComandas
  
  console.log('[listarItensDeTodasComandasAbertas] Comandas abertas:', comandas?.length || 0, 'IDs:', comandas?.map(c => c.id))
  
  if (!comandas || comandas.length === 0) {
    console.log('[listarItensDeTodasComandasAbertas] Nenhuma comanda aberta encontrada')
    return [] // Nenhuma comanda aberta
  }
  
  const comandaIds = comandas.map(c => c.id)
  
  // 2. Buscar todos os itens dessas comandas
  let qItens = supabase
    .from('comanda_itens')
    .select('produto_id, quantidade')
    .in('comanda_id', comandaIds)
  if (codigo) qItens = qItens.eq('codigo_empresa', codigo)
  
  const { data: itens, error: errItens } = await qItens
  if (errItens) throw errItens
  
  console.log('[listarItensDeTodasComandasAbertas] Itens encontrados:', itens?.length || 0)
  if (itens && itens.length > 0) {
    console.log('[listarItensDeTodasComandasAbertas] Detalhes dos itens:', itens)
  }
  
  return itens || []
}

// Conveniência: SEMPRE criar nova comanda para mesa (nunca reutilizar)
const _mesaLocks = new Map();

export async function getOrCreateComandaForMesa({ mesaId, codigoEmpresa } = {}) {
  const lockKey = `${mesaId}:${codigoEmpresa || getCachedCompanyCode()}`;
  
  // Prevenir chamadas concorrentes (causa de travamento)
  if (_mesaLocks.has(lockKey)) {
    console.log(`[getOrCreateComandaForMesa] ⏳ Operação já em andamento para mesa ${mesaId}, aguardando...`);
    return _mesaLocks.get(lockKey);
  }
  
  const codigo = codigoEmpresa || getCachedCompanyCode();
  
  // Criar promise e adicionar ao lock
  const promise = (async () => {
    try {
      // Bloqueio: exigir caixa aberto
      await assertCaixaAberto({ codigoEmpresa: codigo });
      
      console.log(`[getOrCreateComandaForMesa] 🔄 Criando nova comanda para mesa ${mesaId}`);
      
      // Buscar comanda existente e FECHAR automaticamente se estiver vazia
      const atual = await listarComandaDaMesa({ mesaId, codigoEmpresa: codigo });
      
      if (atual) {
        console.log(`[getOrCreateComandaForMesa] ⚠️ Comanda existente ${atual.id} encontrada, verificando se está vazia...`);
        
        // Verificar se tem itens ou pagamentos
        let temItens = false;
        let temPagamentos = false;
        
        try {
          const itens = await listarItensDaComanda({ comandaId: atual.id, codigoEmpresa: codigo });
          temItens = (itens || []).length > 0;
        } catch {}
        
        try {
          const { data: pays } = await supabase
            .from('pagamentos')
            .select('id, status')
            .eq('comanda_id', atual.id)
            .eq('codigo_empresa', codigo);
          const paysValidos = (pays || []).filter(p => {
            const st = String(p?.status || 'Pago');
            return st !== 'Cancelado' && st !== 'Estornado';
          });
          temPagamentos = paysValidos.length > 0;
        } catch {}
        
        // Se estiver vazia (sem itens e sem pagamentos), fechar automaticamente
        if (!temItens && !temPagamentos) {
          console.log(`[getOrCreateComandaForMesa] 🗑️ Comanda ${atual.id} está vazia, fechando automaticamente...`);
          try {
            await fecharComandaEMesa({ comandaId: atual.id, codigoEmpresa: codigo });
            console.log(`[getOrCreateComandaForMesa] ✅ Comanda ${atual.id} fechada com sucesso`);
          } catch (e) {
            console.warn(`[getOrCreateComandaForMesa] ⚠️ Erro ao fechar comanda ${atual.id}:`, e?.message);
          }
        } else {
          console.log(`[getOrCreateComandaForMesa] ⚠️ Comanda ${atual.id} tem dados (itens: ${temItens}, pagamentos: ${temPagamentos}), não será fechada automaticamente`);
        }
      }
      
      // SEMPRE criar nova comanda zerada
      console.log(`[getOrCreateComandaForMesa] ✨ Criando comanda zerada para mesa ${mesaId}`);
      const novaComanda = await abrirComandaParaMesa({ mesaId, codigoEmpresa: codigo });
      console.log(`[getOrCreateComandaForMesa] ✅ Comanda ${novaComanda.id} criada com sucesso`);
      return novaComanda;
    } finally {
      // Remover lock após conclusão
      _mesaLocks.delete(lockKey);
      console.log(`[getOrCreateComandaForMesa] 🔓 Lock liberado para mesa ${mesaId}`);
    }
  })();
  
  _mesaLocks.set(lockKey, promise);
  return promise;
}

// Multi-clientes por comanda através de tabela de vínculo
export async function adicionarClientesAComanda({ comandaId, clienteIds = [], nomesLivres = [], codigoEmpresa, replace = false } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!comandaId) throw new Error('comandaId é obrigatório')
  
  // Coerção defensiva: garantir arrays simples de valores
  let idsArr = []
  let livresArr = []
  
  try {
    idsArr = Array.isArray(clienteIds) ? clienteIds : (clienteIds ? [clienteIds] : [])
  } catch (e) {
    console.warn('[adicionarClientesAComanda] Erro ao processar clienteIds:', e)
    idsArr = []
  }
  
  try {
    livresArr = Array.isArray(nomesLivres) ? nomesLivres : (nomesLivres ? [nomesLivres] : [])
  } catch (e) {
    console.warn('[adicionarClientesAComanda] Erro ao processar nomesLivres:', e)
    livresArr = []
  }
  
  // Se vieram objetos por engano, extrair chaves comuns
  const cleanIds = idsArr.map(v => (v && typeof v === 'object' ? (v.id || v.cliente_id || v.value) : v)).filter(Boolean)
  const cleanLivres = livresArr.map(v => (v && typeof v === 'object' ? (v.nome || v.name || v.label) : v)).map(s => String(s || '').trim()).filter(Boolean)

  console.log(`[adicionarClientesAComanda] Adicionando clientes à comanda ${comandaId}:`, { clienteIds: cleanIds, nomesLivres: cleanLivres, codigo, replace })
  
  if (replace) {
    // LIMPAR todos os vínculos e inserir exatamente os informados
    const { error: deleteError } = await supabase
      .from('comanda_clientes')
      .delete()
      .eq('comanda_id', comandaId)
    if (deleteError) {
      console.warn('[adicionarClientesAComanda] Erro ao limpar clientes existentes:', deleteError)
    }
  }
  
  const rows = []
  
  // Iterar sobre cleanIds de forma segura (evitar duplicar quando replace=false)
  if (Array.isArray(cleanIds)) {
    // Se não vamos substituir, buscar existentes para pular duplicatas
    let existentes = []
    if (!replace) {
      try {
        const { data } = await supabase
          .from('comanda_clientes')
          .select('cliente_id, nome_livre')
          .eq('comanda_id', comandaId)
        existentes = Array.isArray(data) ? data : []
      } catch {}
    }
    const existSet = new Set((existentes || []).map(x => x.cliente_id).filter(Boolean))
    for (let i = 0; i < cleanIds.length; i++) {
      const id = cleanIds[i]
      if (!id) continue
      if (!replace && existSet.has(id)) continue
      rows.push({ comanda_id: comandaId, cliente_id: id })
    }
  }
  
  // Iterar sobre cleanLivres de forma segura
  if (Array.isArray(cleanLivres)) {
    // Quando replace=false, não há como checar duplicidade de nome_livre de forma inequívoca
    // então apenas insere nomes válidos; cabe ao chamador evitar duplicidade se necessário.
    for (let i = 0; i < cleanLivres.length; i++) {
      const nome = cleanLivres[i]
      const n = (nome || '').trim()
      if (n) rows.push({ comanda_id: comandaId, nome_livre: n })
    }
  }
  
  if (rows.length === 0) {
    console.log(`[adicionarClientesAComanda] Nenhum cliente para adicionar`)
    return true
  }
  
  let payload = []
  if (Array.isArray(rows)) {
    payload = rows.map(r => (codigo ? { ...r, codigo_empresa: codigo } : r))
  }
  console.log(`[adicionarClientesAComanda] Payload para inserção:`, payload)
  
  const { error } = await supabase.from('comanda_clientes').insert(payload)
  if (error) {
    console.error(`[adicionarClientesAComanda] ERRO ao inserir clientes:`, error)
    throw error
  }
  
  console.log(`[adicionarClientesAComanda] Clientes adicionados com sucesso`)
  return true
}

export async function listarClientesDaComanda({ comandaId, codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  if (!comandaId) throw new Error('comandaId é obrigatório')
  // Tentativa 1: relação qualificada pelo nome padrão gerado (comanda_clientes_cliente_id_fkey)
  try {
    const { data, error } = await supabase
      .from('comanda_clientes')
      .select('id, cliente_id, nome_livre, clientes:clientes!comanda_clientes_cliente_id_fkey(id, codigo, nome, email, telefone)')
      .eq('comanda_id', comandaId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'livre', nome: r.clientes?.nome || r.nome_livre, cliente_id: r.cliente_id }))
  } catch (e1) {
    // Se for ambiguidade (PGRST201) ou relação não encontrada, tenta relacionamento alternativo
    try {
      const { data, error } = await supabase
        .from('comanda_clientes')
        .select('id, cliente_id, nome_livre, clientes:clientes!fk_comanda_clientes_cliente(id, nome, email, telefone)')
        .eq('comanda_id', comandaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'livre', nome: r.clientes?.nome || r.nome_livre, cliente_id: r.cliente_id }))
    } catch (e2) {
      // Último fallback: retornar sem embed (evita quebrar UI)
      const { data, error } = await supabase
        .from('comanda_clientes')
        .select('id, cliente_id, nome_livre')
        .eq('comanda_id', comandaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []).map(r => ({ id: r.id, tipo: r.cliente_id ? 'cadastrado' : 'livre', nome: r.nome_livre || '', cliente_id: r.cliente_id }))
    }
  }
}

// Itens (depende de tabela 'produtos' existir)
export async function adicionarItem({ comandaId, produtoId, descricao, quantidade, precoUnitario, desconto = 0, codigoEmpresa }) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  console.log(`[adicionarItem] Adicionando item à comanda ${comandaId}:`, { produtoId, descricao, quantidade, precoUnitario, codigo })
  
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
  const { data, error } = await q.select('id')
  // Ignora erro se item já foi deletado (0 rows)
  if (error && error.code !== 'PGRST116') throw error
  return Array.isArray(data) && data.length > 0
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
    recebido_em: new Date().toISOString(),
    codigo_empresa: codigo // Sempre inclui o código da empresa
  }
  // cliente_id é opcional e só será persistido se a coluna existir no schema
  if (clienteId) {
    payload.cliente_id = clienteId
  }
  
  console.log('[registrarPagamento] Iniciando registro de pagamento:', {
    comandaId,
    finalizadoraId,
    metodo: metodoNormalizado,
    valor: payload.valor,
    status: payload.status,
    codigoEmpresa: codigo,
    payload: payload
  })
  
  try {
    // Tenta inserir o pagamento diretamente primeiro
    const { data, error } = await supabase
      .from('pagamentos')
      .insert(payload)
      .select()
      .single()
    
    if (error) {
      // Downgrade de log para evitar ruído quando coluna não existe
      console.warn('[registrarPagamento] Primeira tentativa falhou:', { code: error.code, message: error.message })
      const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
      const isUndefinedColumn = (error?.code === '42703') || (msg.includes('column') && msg.includes('cliente_id'))
      if (isUndefinedColumn) {
        // Retry sem cliente_id
        const { cliente_id, ...withoutCliente } = payload
        try { localStorage.setItem('schema:pagamentos:cliente_id', 'no') } catch {}
        const { data: d2, error: e2 } = await supabase
          .from('pagamentos')
          .insert(withoutCliente)
          .select()
          .single()
        if (e2) throw e2
        console.log('[registrarPagamento] Pagamento registrado sem cliente_id:', d2)
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
          console.log('[registrarPagamento] Pagamento registrado com sucesso (abordagem alternativa):', data)
          return data
        } catch (fallbackError) {
          console.error('[registrarPagamento] Falha na abordagem alternativa:', fallbackError)
          throw new Error(`Falha ao processar pagamento: ${fallbackError.message}`)
        }
      }
      throw error
    }
    console.log('[registrarPagamento] Pagamento registrado com sucesso:', data)
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
export async function fecharComandaEMesa({ comandaId, codigoEmpresa, diferencaPagamento }) {
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

    // Monta payload base de fechamento
    const updatePayload = {
      status: 'closed',
      fechado_em: nowIso,
    }
    // Se informado, envia diferença de pagamento para ser persistida na comanda
    if (typeof diferencaPagamento === 'number' && Number.isFinite(diferencaPagamento)) {
      updatePayload.diferenca_pagamento = diferencaPagamento
    }

    console.log(`${trace} Fechando comanda com status closed + fechado_em${updatePayload.diferenca_pagamento != null ? ' + diferenca_pagamento' : ''}...`)
    let { error } = await supabase
      .from('comandas')
      .update(updatePayload)
      .eq('id', comandaId)
      .eq('codigo_empresa', codigo)

    // Compatibilidade: se coluna diferenca_pagamento ainda não existir, tenta novamente sem ela
    if (error && error.code === '42703') {
      console.warn(`${trace} Coluna diferenca_pagamento ausente no schema, tentando novamente sem ela...`)
      const fallbackPayload = { status: 'closed', fechado_em: nowIso }
      ;({ error } = await supabase
        .from('comandas')
        .update(fallbackPayload)
        .eq('id', comandaId)
        .eq('codigo_empresa', codigo))
    }

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
    
    // Marca status como cancelled e define fechado_em agora
    // Importante: definir fechado_em evita que consultas baseadas em 'fechado_em IS NULL' considerem a comanda aberta
    const nowIso = new Date().toISOString()
    const { data: updateResult, error: upErr } = await supabase
      .from('comandas')
      .update({ status: 'cancelled', fechado_em: nowIso })
      .eq('id', comandaId)
      .eq('codigo_empresa', codigo)
      .select()
    
    if (upErr) {
      console.error(`${trace} Erro ao atualizar comanda:`, upErr)
      throw upErr
    }
    
    if (!updateResult || updateResult.length === 0) {
      console.error(`${trace} ⚠️ UPDATE não afetou nenhuma linha! Comanda ${comandaId} não foi encontrada ou RLS bloqueou`)
      throw new Error('Comanda não encontrada ou sem permissão para cancelar')
    }
    
    console.log(`${trace} ✅ Comanda atualizada:`, updateResult[0])
    
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

// =====================
// Utilitários de Diagnóstico e Correção (Comandas Abertas)
// =====================

// Retorna lista detalhada das comandas ainda abertas com contagem de itens e pagamentos válidos
export async function diagnosticarComandasAbertas({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let abertas = await listarComandasAbertas({ codigoEmpresa: codigo })
  abertas = abertas || []
  if (abertas.length === 0) return []
  const ids = abertas.map(a => a.id)
  let itensBy = new Map();
  let paysBy = new Map();
  try {
    if (ids.length > 0) {
      let qi = supabase.from('comanda_itens').select('comanda_id, quantidade').in('comanda_id', ids)
      if (codigo) qi = qi.eq('codigo_empresa', codigo)
      const { data } = await qi
      itensBy = new Map()
      for (const r of (data || [])) {
        const k=r.comanda_id; const q=Number(r.quantidade||0)
        itensBy.set(k, (itensBy.get(k)||0) + q)
      }
    }
  } catch {}
  try {
    if (ids.length > 0) {
      let qp = supabase.from('pagamentos').select('comanda_id, status').in('comanda_id', ids)
      if (codigo) qp = qp.eq('codigo_empresa', codigo)
      const { data } = await qp
      paysBy = new Map()
      for (const p of (data || [])) {
        const st=String(p?.status||'Pago')
        if (st==='Cancelado'||st==='Estornado') continue
        const k = p.comanda_id
        paysBy.set(k, (paysBy.get(k)||0) + 1)
      }
    }
  } catch {}
  return abertas.map(a => ({
    id: a.id,
    mesa_id: a.mesa_id || null,
    status: a.status,
    itens: Number(itensBy.get(a.id)||0),
    pagamentos_validos: Number(paysBy.get(a.id)||0)
  }))
}

// Corrige "comandas fantasma": abertas, sem itens, sem pagamentos válidos
export async function corrigirComandasFantasmas({ codigoEmpresa } = {}) {
  const codigo = codigoEmpresa || getCachedCompanyCode()
  let abertas = await listarComandasAbertas({ codigoEmpresa: codigo })
  abertas = abertas || []
  if (abertas.length === 0) return { fechadas: 0 }
  const diag = await diagnosticarComandasAbertas({ codigoEmpresa: codigo })
  const fantasmas = (diag || []).filter(d => d.itens <= 0 && d.pagamentos_validos <= 0)
  let fechadas = 0
  for (const f of fantasmas) {
    try {
      await fecharComandaEMesa({ comandaId: f.id, codigoEmpresa: codigo })
      fechadas++
    } catch {}
  }
  return { fechadas }
}
