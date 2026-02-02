import { supabase } from './supabase'

function normalizeUnit(value) {
  const t = String(value ?? '').trim().toUpperCase()
  if (!t) return ''
  const map = {
    UND: 'UN',
    UNID: 'UN',
    UNIDADE: 'UN',
    'UN.': 'UN',
    PCS: 'PC',
    'PÇ': 'PC',
    'PÇS': 'PC',
    LT: 'L',
  }
  return map[t] || t
}

function normalizeProductCode(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits
}

// Helper to map DB -> UI
function mapDbToUi(row) {
  return {
    id: row.id,
    code: normalizeProductCode(row.codigo_produto ?? ''),
    name: row.nome,
    category: row.categoria ?? '',
    type: row.tipo_produto === 'uso_interno' ? 'Uso Interno' : 'Venda',
    cost: Number(row.valor_custo ?? row.preco_custo ?? 0),
    price: Number(row.valor_venda ?? row.preco_venda ?? 0),
    stock: Number(row.estoque ?? row.estoque_atual ?? 0),
    minStock: Number(row.estoque_minimo ?? 0),
    // Respeita status do banco se existir; senão, deriva pelo estoque e active flag
    status: row.status ?? (
      (row.ativo === false)
        ? 'inactive'
        : (Number(row.estoque ?? 0) === 0)
          ? 'inactive'
          : (Number(row.estoque ?? 0) > 0 && Number(row.estoque ?? 0) <= Number(row.estoque_minimo ?? 0))
            ? 'low_stock'
            : 'active'
    ),
    validade: row.validade ? new Date(row.validade) : null,

    // --- Novos campos (identificadores e básicos)
    barcode: row.codigo_barras ?? '',
    barcodeBox: row.codigo_barras_caixa ?? '',
    reference: row.referencia ?? '',
    brand: row.marca ?? '',
    group: row.grupo ?? '',
    unit: normalizeUnit(row.unidade ?? 'UN') || 'UN',

    // --- Estoque
    initialStock: Number(row.estoque_inicial ?? 0),
    currentStock: Number(row.estoque_atual ?? row.estoque ?? 0),
    weight: row.peso != null ? Number(row.peso) : null,

    // --- Preço e Lucro
    buyPrice: row.preco_compra != null ? Number(row.preco_compra) : null,
    costsPercent: row.custos_percent != null ? Number(row.custos_percent) : null,
    // Fallback: algumas bases usam valor_custo/valor_venda em vez de preco_custo/preco_venda
    costPrice: (row.preco_custo != null)
      ? Number(row.preco_custo)
      : (row.valor_custo != null ? Number(row.valor_custo) : null),
    marginPercent: row.lucro_percent != null ? Number(row.lucro_percent) : null,
    salePrice: (row.preco_venda != null)
      ? Number(row.preco_venda)
      : (row.valor_venda != null ? Number(row.valor_venda) : null),
    wholesaleQty: row.qtd_atacado != null ? Number(row.qtd_atacado) : null,
    wholesalePrice: row.preco_atacado != null ? Number(row.preco_atacado) : null,
    commissionPercent: row.comissao_percent != null ? Number(row.comissao_percent) : null,
    discountPercent: row.desconto_percent != null ? Number(row.desconto_percent) : null,

    // --- Impostos (Interno/Externo)
    cfopInterno: row.cfop_interno ?? '',
    cstIcmsInterno: row.cst_icms_interno ?? '',
    csosnInterno: row.csosn_interno ?? '',
    aliqIcmsInterno: row.aliquota_icms_interno != null ? Number(row.aliquota_icms_interno) : null,
    cfopExterno: row.cfop_externo ?? '',
    cstIcmsExterno: row.cst_icms_externo ?? '',
    csosnExterno: row.csosn_externo ?? '',
    aliqIcmsExterno: row.aliquota_icms_externo != null ? Number(row.aliquota_icms_externo) : null,

    // --- PIS/COFINS
    cstPisEntrada: row.cst_pis_entrada ?? '',
    cstPisSaida: row.cst_pis_saida ?? '',
    aliqPisPercent: row.aliquota_pis_percent != null ? Number(row.aliquota_pis_percent) : null,
    aliqCofinsPercent: row.aliquota_cofins_percent != null ? Number(row.aliquota_cofins_percent) : null,

    // --- IPI
    cstIpi: row.cst_ipi ?? '',
    aliqIpiPercent: row.aliquota_ipi_percent != null ? Number(row.aliquota_ipi_percent) : null,

    // --- FCP/MVA/Base Reduzida
    fcpPercent: row.fcp_percent != null ? Number(row.fcp_percent) : null,
    mvaPercent: row.mva_percent != null ? Number(row.mva_percent) : null,
    baseReduzidaPercent: row.base_reduzida_percent != null ? Number(row.base_reduzida_percent) : null,

    // --- Outras informações
    ncm: row.ncm ?? '',
    ncmDescription: row.descricao_ncm ?? '',
    cest: row.cest ?? '',

    // --- Parâmetros
    active: row.ativo ?? true,
    allowSale: row.permite_venda ?? true,
    payCommission: row.paga_comissao ?? false,
    variablePrice: row.preco_variavel ?? false,
    composition: row.composicao ?? false,
    service: row.servico ?? false,
    hasGrid: row.grade ?? false,
    usePriceTable: row.usar_tabela_preco ?? false,
    fuel: row.combustivel ?? false,
    useImei: row.usa_imei ?? false,
    stockByGrid: row.controle_estoque_por_grade ?? false,
    showInApp: row.mostrar_no_app ?? false,
    
    // --- Importação
    dataImportacao: row.data_importacao ? new Date(row.data_importacao) : null,
    importadoViaXml: row.importado_via_xml ?? false,
  }
}

// ===== Relatórios de vendas por período =====
// Retorna agregação de vendidos por produto no intervalo [from, to]
// Params: { from: Date|string, to: Date|string, codigoEmpresa }
export async function getSoldProductsByPeriod({ from, to, codigoEmpresa, limit = 1000 } = {}) {
  if (!from || !to) throw new Error('Período inválido');
  const fromIso = (from instanceof Date ? from : new Date(from)).toISOString();
  const toIso = (to instanceof Date ? to : new Date(to)).toISOString();
  // 1) Busca itens no período
  const { data: rows, error } = await withTimeout((signal) => {
    let q = supabase
      .from('comanda_itens')
      .select('produto_id, quantidade, created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .limit(limit)
      .abortSignal(signal);
    if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa);
    return q;
  }, 20000, 'Timeout getSoldProductsByPeriod (20s)');
  if (error) throw error;
  // 2) Agrega
  const agg = new Map();
  for (const r of rows || []) {
    const pid = r.produto_id;
    const qty = Number(r.quantidade || 0);
    agg.set(pid, (agg.get(pid) || 0) + qty);
  }
  const entries = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return [];
  const ids = entries.map(([id]) => id);
  // 3) Buscar nomes
  const { data: prods, error: perr } = await withTimeout((signal) => {
    let qp = supabase
      .from('produtos')
      .select('id, nome')
      .in('id', ids)
      .abortSignal(signal);
    if (codigoEmpresa) qp = qp.eq('codigo_empresa', codigoEmpresa);
    return qp;
  }, 15000, 'Timeout getSoldProductsByPeriod:produtos (15s)');
  if (perr) throw perr;
  const nameById = new Map((prods || []).map(p => [p.id, p.nome]));
  return entries.map(([id, total]) => ({ id, name: nameById.get(id) || String(id), total }));
}

// ===== Ajustes de estoque =====
// Incrementa o estoque de um produto (delta pode ser negativo ou positivo)
export async function adjustProductStock({ productId, delta, codigoEmpresa }) {
  const inc = Number(delta);
  if (!productId || !Number.isFinite(inc) || inc === 0) {
    throw new Error('Parâmetros inválidos para ajuste de estoque');
  }
  // Passo 1: obter estoque atual (com filtro de empresa quando presente)
  const { data: cur, error: gerr } = await withTimeout((signal) => {
    let q = supabase
      .from('produtos')
      .select('id, estoque, estoque_atual')
      .eq('id', productId)
      .single()
      .abortSignal(signal);
    if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa);
    return q;
  }, 10000, 'Timeout get current stock (10s)');
  if (gerr) {
    // Caso típico: PGRST116 quando .single() e 0 linhas por RLS/empresa inválida
    throw gerr;
  }
  const current = Number(cur?.estoque ?? cur?.estoque_atual ?? 0);
  const next = current + inc;
  // Passo 2: atualizar estoque
  const { error: uerr } = await withTimeout((signal) => {
    let q = supabase
      .from('produtos')
      .update({ estoque: next, estoque_atual: next })
      .eq('id', productId)
      .abortSignal(signal);
    if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa);
    return q;
  }, 10000, 'Timeout update stock (10s)');
  if (uerr) throw uerr;
  return { id: productId, stock: next };
}

// ===== Relatórios rápidos de produtos =====
// Retorna os produtos mais vendidos no dia corrente (00:00 até agora), ordenados por quantidade descendente
export async function getMostSoldProductsToday({ limit = 5, codigoEmpresa } = {}) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const startIso = start.toISOString()
  // Consulta em comanda_itens somando quantidades do dia, filtrando por empresa, agrupando por produto
  // Dependências de schema: comanda_itens(comanda_id, produto_id, quantidade, created_at, codigo_empresa)
  // e produtos(id, nome)
  // Nota: usamos duas queries para simplicidade e compatibilidade com PostgREST
  // 1) Buscar agregados
  const { data: rows, error } = await withTimeout((signal) => {
    let q = supabase
      .from('comanda_itens')
      .select('produto_id, quantidade, created_at')
      .gte('created_at', startIso)
      .abortSignal(signal)
    if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa)
    return q
  }, 15000, 'Timeout getMostSoldProductsToday (15s)')
  if (error) throw error
  const agg = new Map()
  for (const r of rows || []) {
    const pid = r.produto_id
    const qty = Number(r.quantidade || 0)
    agg.set(pid, (agg.get(pid) || 0) + qty)
  }
  // 2) Ordenar e buscar nomes
  const sorted = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit)
  if (sorted.length === 0) return []
  const ids = sorted.map(([id]) => id)
  const { data: prods, error: perr } = await withTimeout((signal) => {
    let qp = supabase
      .from('produtos')
      .select('id, nome')
      .in('id', ids)
      .abortSignal(signal)
    if (codigoEmpresa) qp = qp.eq('codigo_empresa', codigoEmpresa)
    return qp
  }, 15000, 'Timeout getMostSoldProductsToday:produtos (15s)')
  if (perr) throw perr
  const nameById = new Map((prods || []).map(p => [p.id, p.nome]))
  return sorted.map(([id, total]) => ({ id, name: nameById.get(id) || String(id), total }))
}

// Retorna o menor código numérico livre (4 dígitos) para produtos de uma empresa
export async function getNextProductCode({ codigoEmpresa } = {}) {
  if (!codigoEmpresa) throw new Error('codigoEmpresa é obrigatório')

  // Busca todos os códigos numéricos da empresa
  const { data, error } = await withTimeout((signal) => {
    let q = supabase
      .from('produtos')
      .select('codigo_produto')
      .eq('codigo_empresa', codigoEmpresa)
      .order('codigo_produto', { ascending: true })
      .abortSignal(signal)
    return q
  }, 15000, 'Timeout getNextProductCode (15s)')

  if (error) throw error

  const numericSet = new Set()
  for (const row of data || []) {
    const raw = (row.codigo_produto || '').trim()
    if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10)
      if (Number.isFinite(n) && n > 0) numericSet.add(n)
    }
  }

  // Encontra o menor inteiro positivo que ainda não existe
  let candidate = 1
  const maxLoops = (numericSet.size || 0) + 1000
  let loops = 0
  while (numericSet.has(candidate) && loops < maxLoops) {
    candidate += 1
    loops += 1
  }

  if (!Number.isFinite(candidate) || candidate <= 0) {
    candidate = 1
  }

  return String(candidate).padStart(4, '0')
}

// Helper to map UI -> DB
function mapUiToDb(data) {
  const normalizedCode = normalizeProductCode(data?.code)
  const normalizedUnit = normalizeUnit(data?.unit)
  return {
    codigo_produto: (normalizedCode && String(normalizedCode).trim() !== '') ? String(normalizedCode).trim() : null,
    nome: data.name,
    categoria: data.category || null,
    tipo_produto: (data.type === 'Uso Interno') ? 'uso_interno' : 'venda',
    // Preço/custo: manter compatibilidade com colunas antigas (valor_*) e novas (preco_*)
    valor_custo: (data.cost != null ? Number(data.cost) : (data.costPrice != null ? Number(data.costPrice) : 0)),
    valor_venda: (data.price != null ? Number(data.price) : (data.salePrice != null ? Number(data.salePrice) : 0)),
    estoque: data.stock != null ? Number(data.stock) : 0,
    estoque_minimo: data.minStock != null ? Number(data.minStock) : 0,
    status: data.status || null,
    validade: data.validade ? new Date(data.validade).toISOString().slice(0, 10) : null, // yyyy-mm-dd

    // --- Novos campos (identificadores e básicos)
    codigo_barras: data.barcode || null,
    codigo_barras_caixa: data.barcodeBox || null,
    referencia: data.reference || null,
    marca: data.brand || null,
    grupo: data.group || null,
    unidade: normalizedUnit || null,

    // --- Estoque
    estoque_inicial: data.initialStock != null ? Number(data.initialStock) : null,
    estoque_atual: data.currentStock != null ? Number(data.currentStock) : null,
    peso: data.weight != null ? Number(data.weight) : null,

    // --- Preço e Lucro
    preco_compra: data.buyPrice != null ? Number(data.buyPrice) : null,
    custos_percent: data.costsPercent != null ? Number(data.costsPercent) : null,
    preco_custo: (data.costPrice != null ? Number(data.costPrice) : (data.cost != null ? Number(data.cost) : null)),
    lucro_percent: data.marginPercent != null ? Number(data.marginPercent) : null,
    preco_venda: (data.salePrice != null ? Number(data.salePrice) : (data.price != null ? Number(data.price) : null)),
    qtd_atacado: data.wholesaleQty != null ? Number(data.wholesaleQty) : null,
    preco_atacado: data.wholesalePrice != null ? Number(data.wholesalePrice) : null,
    comissao_percent: data.commissionPercent != null ? Number(data.commissionPercent) : null,
    desconto_percent: data.discountPercent != null ? Number(data.discountPercent) : null,

    // --- Impostos
    cfop_interno: data.cfopInterno || null,
    cst_icms_interno: data.cstIcmsInterno || null,
    csosn_interno: data.csosnInterno || null,
    aliquota_icms_interno: data.aliqIcmsInterno != null ? Number(data.aliqIcmsInterno) : null,
    cfop_externo: data.cfopExterno || null,
    cst_icms_externo: data.cstIcmsExterno || null,
    csosn_externo: data.csosnExterno || null,
    aliquota_icms_externo: data.aliqIcmsExterno != null ? Number(data.aliqIcmsExterno) : null,

    cst_pis_entrada: data.cstPisEntrada || null,
    cst_pis_saida: data.cstPisSaida || null,
    aliquota_pis_percent: data.aliqPisPercent != null ? Number(data.aliqPisPercent) : null,
    aliquota_cofins_percent: data.aliqCofinsPercent != null ? Number(data.aliqCofinsPercent) : null,

    cst_ipi: data.cstIpi || null,
    aliquota_ipi_percent: data.aliqIpiPercent != null ? Number(data.aliqIpiPercent) : null,

    fcp_percent: data.fcpPercent != null ? Number(data.fcpPercent) : null,
    mva_percent: data.mvaPercent != null ? Number(data.mvaPercent) : null,
    base_reduzida_percent: data.baseReduzidaPercent != null ? Number(data.baseReduzidaPercent) : null,

    // --- Outras informações
    ncm: data.ncm || null,
    descricao_ncm: data.ncmDescription || null,
    cest: data.cest || null,

    // --- Parâmetros
    ativo: data.active != null ? !!data.active : true,
    permite_venda: data.allowSale != null ? !!data.allowSale : true,
    paga_comissao: data.payCommission != null ? !!data.payCommission : false,
    preco_variavel: data.variablePrice != null ? !!data.variablePrice : false,
    composicao: data.composition != null ? !!data.composition : false,
    servico: data.service != null ? !!data.service : false,
    grade: data.hasGrid != null ? !!data.hasGrid : false,
    usar_tabela_preco: data.usePriceTable != null ? !!data.usePriceTable : false,
    combustivel: data.fuel != null ? !!data.fuel : false,
    usa_imei: data.useImei != null ? !!data.useImei : false,
    controle_estoque_por_grade: data.stockByGrid != null ? !!data.stockByGrid : false,
    mostrar_no_app: data.showInApp != null ? !!data.showInApp : false,

    // --- Origem XML (novos campos)
    importado_via_xml: data.importedViaXML === true ? true : false,
    data_importacao: data.dataImportacao ? (data.dataImportacao instanceof Date ? data.dataImportacao.toISOString() : new Date(data.dataImportacao).toISOString()) : null,
    xml_chave: data.xmlChave || null,
    xml_numero: data.xmlNumero || null,
    xml_serie: data.xmlSerie || null,
    xml_emissao: data.xmlEmissao ? new Date(data.xmlEmissao).toISOString() : null,
  }
}

export async function listProducts(options = {}) {
  const { includeInactive = false, search = '', codigoEmpresa } = options
  // eslint-disable-next-line no-console
  console.log('[products.api] ====== listProducts INICIO ======')
  console.log('[products.api] Parametros:', { includeInactive, search, codigoEmpresa })
  const { data, error } = await withTimeout((signal) => {
    let q = supabase
      .from('produtos')
      .select('*')
      .eq('codigo_empresa', codigoEmpresa)
      .order('nome', { ascending: true })
      .abortSignal(signal)
    // Filtrar por status (se includeInactive = false, exclui inativos)
    if (!includeInactive) {
      // status != 'inactive' AND (ativo IS NULL OR ativo = true)
      q = q.neq('status', 'inactive')
      q = q.or('ativo.is.null,ativo.eq.true')
      console.log('[products.api] Filtro aplicado: status != inactive AND (ativo IS NULL OR ativo = true)')
    }
    if (search && search.trim().length > 0) {
      const term = search.trim()
      // Busca por nome OU código (case-insensitive)
      q = q.or(`nome.ilike.%${term}%,codigo_produto.ilike.%${term}%`)
    }
    return q
  }
  , 15000, 'Timeout listProducts (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] listProducts:error', error)
    throw error
  }
  const mapped = (data || []).map(mapDbToUi)
  // eslint-disable-next-line no-console
  console.log('[products.api] listProducts RETORNOU:', mapped.length, 'produtos');
  console.log('[products.api] includeInactive:', includeInactive);
  console.log('[products.api] Produtos:', mapped.map(p => ({ id: p.id, name: p.name, code: p.code })));
  // Log produtos sem código
  const semCodigo = mapped.filter(p => !p.code || p.code.trim() === '');
  console.log('[products.api] Produtos SEM código:', semCodigo.length);
  if (semCodigo.length > 0) {
    semCodigo.forEach(p => {
      console.log('  -', p.name, '| active:', p.active, '| status:', p.status, '| code:', p.code || 'NULL');
    });
  }
  return mapped
}

// Versão paginada da listagem de produtos, para telas com muitas linhas (ex.: ProdutosPage)
// Retorna { data, count } já mapeados para o formato de UI
export async function listProductsPaged(options = {}) {
  const { includeInactive = false, search = '', codigoEmpresa, page = 1, pageSize = 100 } = options
  if (!codigoEmpresa) return { data: [], count: 0 }

  const safePage = page > 0 ? page : 1
  const safePageSize = pageSize > 0 ? pageSize : 100
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  // eslint-disable-next-line no-console
  console.log('[products.api] ====== listProductsPaged INICIO ======', { includeInactive, search, codigoEmpresa, page: safePage, pageSize: safePageSize })

  try {
    const { data, error, count } = await withTimeout((signal) => {
      let q = supabase
        .from('produtos')
        .select('*', { count: 'exact' })
        .eq('codigo_empresa', codigoEmpresa)
        .order('nome', { ascending: true })
        .range(from, to)
        .abortSignal(signal)

      // Filtrar por status (se includeInactive = false, exclui inativos)
      if (!includeInactive) {
        // status != 'inactive' AND (ativo IS NULL OR ativo = true)
        q = q.neq('status', 'inactive')
        q = q.or('ativo.is.null,ativo.eq.true')
      }

      if (search && search.trim().length > 0) {
        const term = search.trim()
        // Busca por nome OU código (case-insensitive)
        q = q.or(`nome.ilike.%${term}%,codigo_produto.ilike.%${term}%`)
      }

      return q
    }, 20000, 'Timeout listProductsPaged (20s)')

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[products.api] listProductsPaged:error', error)
      throw error
    }

    const mapped = (data || []).map(mapDbToUi)
    // eslint-disable-next-line no-console
    console.log('[products.api] listProductsPaged RETORNOU:', mapped.length, 'produtos de', count || 0)
    return { data: mapped, count: count || 0 }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[products.api] listProductsPaged:exception', err)
    return { data: [], count: 0 }
  }
}

export async function createProduct(product, options = {}) {
  const { codigoEmpresa } = options
  const payload = mapUiToDb(product)
  if (codigoEmpresa) payload.codigo_empresa = codigoEmpresa
  // eslint-disable-next-line no-console
  console.info('[products.api] createProduct: payload', payload)
  const tryInsert = async () => {
    return withTimeout((signal) =>
      supabase
        .from('produtos')
        .insert(payload)
        .select('*')
        .single()
        .abortSignal(signal)
    , 15000, 'Timeout createProduct (15s)')
  }
  const isDuplicateCodeError = (err) => {
    if (!err) return false
    if (err.code && String(err.code) === '23505') return true // unique_violation
    const raw = [err.message, err.details, err.hint].filter(Boolean).join(' ').toLowerCase()
    return raw.includes('duplicate key') || raw.includes('unique constraint') || raw.includes('ux_produtos_empresa_codigo_produto') || raw.includes('codigo_produto')
  }
  let data, error
  ({ data, error } = await tryInsert())
  if (error && isDuplicateCodeError(error) && payload.codigo_produto) {
    // Tenta localizar um produto inativo com o mesmo código e liberar o código
    // eslint-disable-next-line no-console
    console.warn('[products.api] createProduct: duplicate code, trying to free code from inactive product')
    const { data: foundArr, error: findErr } = await withTimeout((signal) =>
      supabase
        .from('produtos')
        .select('id,status')
        .eq('codigo_produto', payload.codigo_produto)
        .eq('status', 'inactive')
        .limit(1)
        .abortSignal(signal)
    , 15000, 'Timeout find duplicate product (15s)')
    const found = Array.isArray(foundArr) && foundArr.length > 0 ? foundArr[0] : null
    if (!findErr && found && found.status === 'inactive') {
      // Libera o código do produto inativo
      const { error: clearErr } = await withTimeout((signal) =>
        supabase
          .from('produtos')
          .update({ codigo_produto: null })
          .eq('id', found.id)
          .abortSignal(signal)
      , 15000, 'Timeout clear duplicate code (15s)')
      if (!clearErr) {
        // Tenta inserir novamente
        ({ data, error } = await tryInsert())
      }
    } else {
      // Nenhum inativo com o mesmo código: tentar inserir sem código para evitar conflito
      // Muitos bancos permitem múltiplos NULLs em unique; além disso, pode haver trigger de auto-código
      const originalCode = payload.codigo_produto
      payload.codigo_produto = null
      // eslint-disable-next-line no-console
      console.warn('[products.api] createProduct: no inactive found for duplicate code, retrying with codigo_produto = null (original:', originalCode, ')')
      ;({ data, error } = await tryInsert())
    }
  }
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] createProduct:error', error)
    throw error
  }
  const mapped = mapDbToUi(data)
  // eslint-disable-next-line no-console
  console.info('[products.api] createProduct: ok', mapped)
  return mapped
}

export async function updateProduct(id, product, options = {}) {
  // Não tocar em codigo_empresa em updates para evitar violações RLS
  const payload = mapUiToDb(product)
  
  // Quando o produto é editado manualmente, remove a flag de "novo"
  // (limpa data_importacao para que o badge não apareça mais)
  payload.data_importacao = null;
  
  // eslint-disable-next-line no-console
  console.info('[products.api] updateProduct: id', id, 'payload', payload)
  const { data, error } = await withTimeout((signal) =>
    supabase
      .from('produtos')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
      .abortSignal(signal)
  , 15000, 'Timeout updateProduct (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] updateProduct:error', error)
    throw error
  }
  const mapped = mapDbToUi(data)
  // eslint-disable-next-line no-console
  console.info('[products.api] updateProduct: ok', mapped)
  return mapped
}

// Utility: timeout wrapper with AbortController for Supabase queries
// builder: (signal: AbortSignal) => Promise<{ data, error }>
async function withTimeout(builder, ms, timeoutMessage) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(timeoutMessage)), ms)
  try {
    // Builder must attach the signal via .abortSignal(signal)
    const result = await builder(controller.signal)
    return result
  } catch (err) {
    // Normaliza erro de timeout
    if (err?.name === 'AbortError') {
      throw new Error(timeoutMessage)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function deleteProduct(id) {
  // Soft delete: marcar como inativo
  // eslint-disable-next-line no-console
  console.info('[products.api] deleteProduct (soft): id', id)
  const { error } = await withTimeout((signal) =>
    supabase
      .from('produtos')
      .update({ status: 'inactive', codigo_produto: null })
      .eq('id', id)
      .abortSignal(signal)
  , 15000, 'Timeout deleteProduct (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] deleteProduct:error', error)
    throw error
  }
  // eslint-disable-next-line no-console
  console.info('[products.api] deleteProduct: ok (inativado)')
  return true
}

// ===== Ações em massa =====
// Atualiza o status/ativo de vários produtos (ex.: ativar/inativar em massa)
export async function bulkUpdateProductStatus({ ids, status }) {
  const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (!targetIds.length) throw new Error('Nenhum produto selecionado para atualização em massa')
  if (!['active', 'inactive', 'low_stock'].includes(status)) throw new Error('Status inválido para atualização em massa')

  const activeFlag = status === 'inactive' ? false : true

  // eslint-disable-next-line no-console
  console.info('[products.api] bulkUpdateProductStatus:start', { count: targetIds.length, status })

  const { error } = await withTimeout((signal) =>
    supabase
      .from('produtos')
      .update({ status, ativo: activeFlag })
      .in('id', targetIds)
      .abortSignal(signal)
  , 20000, 'Timeout bulkUpdateProductStatus (20s)')

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] bulkUpdateProductStatus:error', error)
    throw error
  }

  // eslint-disable-next-line no-console
  console.info('[products.api] bulkUpdateProductStatus:ok', { count: targetIds.length, status })
  return true
}

// Remove a flag de "Novo" de vários produtos (limpa data_importacao)
export async function bulkClearNewFlag({ ids }) {
  const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (!targetIds.length) throw new Error('Nenhum produto selecionado para limpar flag de novo')

  // eslint-disable-next-line no-console
  console.info('[products.api] bulkClearNewFlag:start', { count: targetIds.length })

  const { error } = await withTimeout((signal) =>
    supabase
      .from('produtos')
      .update({ data_importacao: null })
      .in('id', targetIds)
      .abortSignal(signal)
  , 20000, 'Timeout bulkClearNewFlag (20s)')

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] bulkClearNewFlag:error', error)
    throw error
  }

  // eslint-disable-next-line no-console
  console.info('[products.api] bulkClearNewFlag:ok', { count: targetIds.length })
  return true
}

// ===== Categorias =====
// Retorna lista de nomes de categorias ativas (array de string)
export async function listCategories(options = {}) {
  const { codigoEmpresa } = options
  // eslint-disable-next-line no-console
  console.info('[products.api] listCategories: start')
  const { data, error } = await withTimeout((signal) => {
    let q = supabase
      .from('produto_categorias')
      .select('nome')
      .eq('ativa', true)
      .order('nome', { ascending: true })
      .abortSignal(signal)
    if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa)
    return q
  }
  , 15000, 'Timeout listCategories (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] listCategories:error', error)
    throw error
  }
  // Dedup case-insensitive para evitar keys duplicadas no Select
  const names = []
  const seen = new Set()
  for (const r of (data || [])) {
    const n = (r?.nome || '').trim()
    if (!n) continue
    const key = n.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(n)
  }
  // eslint-disable-next-line no-console
  console.info('[products.api] listCategories: ok', { count: names.length })
  return names
}

// Cria uma categoria (ativa) por empresa; retorna o nome
export async function createCategory(name, options = {}) {
  const { codigoEmpresa } = options
  const nome = String(name || '').trim()
  if (!nome) throw new Error('Nome da categoria inválido')
  // eslint-disable-next-line no-console
  console.info('[products.api] createCategory:', nome)
  const payload = { nome }
  if (codigoEmpresa) payload.codigo_empresa = codigoEmpresa
  const { data, error } = await withTimeout((signal) =>
    supabase
      .from('produto_categorias')
      .insert(payload)
      .select('nome')
      .single()
      .abortSignal(signal)
  , 15000, 'Timeout createCategory (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] createCategory:error', error)
    throw error
  }
  return data?.nome || nome
}

// Remove (desativa) uma categoria pelo nome (case-insensitive)
export async function removeCategory(name, options = {}) {
  const { codigoEmpresa } = options
  const nome = String(name || '').trim()
  if (!nome) throw new Error('Nome da categoria inválido')
  // eslint-disable-next-line no-console
  console.info('[products.api] removeCategory:', nome)
  // 1) Bloqueia se houver produtos ATIVOS vinculados
  const { count: prodCount, error: countErr } = await withTimeout((signal) =>
    {
      let q = supabase
        .from('produtos')
        .select('id', { count: 'exact', head: true })
        .eq('categoria', nome)
        .neq('status', 'inactive')
        .abortSignal(signal)
      if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa)
      return q
    }
  , 15000, 'Timeout removeCategory:count (15s)')
  if (countErr) {
    // eslint-disable-next-line no-console
    console.error('[products.api] removeCategory:count:error', countErr)
    throw countErr
  }
  if ((prodCount ?? 0) > 0) {
    const err = new Error('Categoria possui produtos ativos vinculados')
    // eslint-disable-next-line no-console
    console.warn('[products.api] removeCategory: blocked by active products', { nome, prodCount })
    throw err
  }

  // 2) Desativa categoria
  const { data, error } = await withTimeout((signal) => {
    let q = supabase
      .from('produto_categorias')
      .update({ ativa: false })
      .eq('nome', nome)
      .select('nome')
      .abortSignal(signal)
    if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa)
    return q
  }
  , 15000, 'Timeout removeCategory (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] removeCategory:error', error)
    throw error
  }
  const affected = Array.isArray(data) ? data.length : 0
  if (affected === 0) {
    const err = new Error('Categoria não encontrada para desativar')
    // eslint-disable-next-line no-console
    console.warn('[products.api] removeCategory: no rows affected', { nome })
    throw err
  }
  return true
}
