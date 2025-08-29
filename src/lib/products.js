import { supabase } from './supabase'

// Helper to map DB -> UI
function mapDbToUi(row) {
  return {
    id: row.id,
    code: row.codigo_produto ?? '',
    name: row.nome,
    category: row.categoria ?? '',
    type: row.tipo_produto === 'uso_interno' ? 'Uso Interno' : 'Venda',
    cost: Number(row.valor_custo ?? row.preco_custo ?? 0),
    price: Number(row.valor_venda ?? row.preco_venda ?? 0),
    stock: Number(row.estoque ?? row.estoque_atual ?? 0),
    minStock: Number(row.estoque_minimo ?? 0),
    // Respeita status do banco se existir; senão, deriva pelo estoque
    status: row.status ?? (
      Number(row.estoque ?? 0) === 0
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
    unit: row.unidade ?? 'UN',

    // --- Estoque
    initialStock: Number(row.estoque_inicial ?? 0),
    currentStock: Number(row.estoque_atual ?? row.estoque ?? 0),
    weight: row.peso != null ? Number(row.peso) : null,

    // --- Preço e Lucro
    buyPrice: row.preco_compra != null ? Number(row.preco_compra) : null,
    costsPercent: row.custos_percent != null ? Number(row.custos_percent) : null,
    costPrice: row.preco_custo != null ? Number(row.preco_custo) : null,
    marginPercent: row.lucro_percent != null ? Number(row.lucro_percent) : null,
    salePrice: row.preco_venda != null ? Number(row.preco_venda) : null,
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
  }
}

// Helper to map UI -> DB
function mapUiToDb(data) {
  return {
    codigo_produto: data.code || null,
    nome: data.name,
    categoria: data.category || null,
    tipo_produto: (data.type === 'Uso Interno') ? 'uso_interno' : 'venda',
    valor_custo: data.cost != null ? Number(data.cost) : 0,
    valor_venda: data.price != null ? Number(data.price) : 0,
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
    unidade: data.unit || null,

    // --- Estoque
    estoque_inicial: data.initialStock != null ? Number(data.initialStock) : null,
    estoque_atual: data.currentStock != null ? Number(data.currentStock) : null,
    peso: data.weight != null ? Number(data.weight) : null,

    // --- Preço e Lucro
    preco_compra: data.buyPrice != null ? Number(data.buyPrice) : null,
    custos_percent: data.costsPercent != null ? Number(data.costsPercent) : null,
    preco_custo: data.costPrice != null ? Number(data.costPrice) : null,
    lucro_percent: data.marginPercent != null ? Number(data.marginPercent) : null,
    preco_venda: data.salePrice != null ? Number(data.salePrice) : null,
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
  }
}

export async function listProducts(options = {}) {
  const { includeInactive = false, search = '' } = options
  // eslint-disable-next-line no-console
  console.info('[products.api] listProducts: start')
  const { data, error } = await withTimeout((signal) => {
    let q = supabase
      .from('produtos')
      .select('*')
      .order('nome', { ascending: true })
      .abortSignal(signal)
    if (!includeInactive) {
      // Incluir linhas onde status é null (produtos antigos) e excluir onde é 'inactive'
      q = q.or('status.is.null,status.neq.inactive')
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
  console.info('[products.api] listProducts: ok', { count: mapped.length })
  return mapped
}

export async function createProduct(product) {
  const payload = mapUiToDb(product)
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
    const { data: found, error: findErr } = await withTimeout((signal) =>
      supabase
        .from('produtos')
        .select('id,status')
        .eq('codigo_produto', payload.codigo_produto)
        .eq('status', 'inactive')
        .limit(1)
        .single()
        .abortSignal(signal)
    , 15000, 'Timeout find duplicate product (15s)')
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

export async function updateProduct(id, product) {
  const payload = mapUiToDb(product)
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

// ===== Categorias =====
// Retorna lista de nomes de categorias ativas (array de string)
export async function listCategories() {
  // eslint-disable-next-line no-console
  console.info('[products.api] listCategories: start')
  const { data, error } = await withTimeout((signal) =>
    supabase
      .from('produto_categorias')
      .select('nome')
      .eq('ativa', true)
      .order('nome', { ascending: true })
      .abortSignal(signal)
  , 15000, 'Timeout listCategories (15s)')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[products.api] listCategories:error', error)
    throw error
  }
  const names = (data || []).map(r => r.nome).filter(Boolean)
  // eslint-disable-next-line no-console
  console.info('[products.api] listCategories: ok', { count: names.length })
  return names
}

// Cria uma categoria (ativa) por empresa; retorna o nome
export async function createCategory(name) {
  const nome = String(name || '').trim()
  if (!nome) throw new Error('Nome da categoria inválido')
  // eslint-disable-next-line no-console
  console.info('[products.api] createCategory:', nome)
  const { data, error } = await withTimeout((signal) =>
    supabase
      .from('produto_categorias')
      .insert({ nome })
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
export async function removeCategory(name) {
  const nome = String(name || '').trim()
  if (!nome) throw new Error('Nome da categoria inválido')
  // eslint-disable-next-line no-console
  console.info('[products.api] removeCategory:', nome)
  // 1) Bloqueia se houver produtos ATIVOS vinculados
  const { count: prodCount, error: countErr } = await withTimeout((signal) =>
    supabase
      .from('produtos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria', nome)
      .neq('status', 'inactive')
      .abortSignal(signal)
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
  const { data, error } = await withTimeout((signal) =>
    supabase
      .from('produto_categorias')
      .update({ ativa: false })
      .eq('nome', nome)
      .select('nome')
      .abortSignal(signal)
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
