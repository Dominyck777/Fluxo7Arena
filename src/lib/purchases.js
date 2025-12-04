// Funções para gerenciar compras (NF-es de entrada)
import { supabase } from './supabase';

/**
 * Verifica se uma NF-e já foi importada (busca ativas e inativas)
 * @param {string} chaveNFe - Chave de acesso da NF-e
 * @param {number} codigoEmpresa - Código da empresa
 * @returns {Object|null} Compra existente ou null
 */
export async function findPurchaseByNFeKey(chaveNFe, codigoEmpresa) {
  if (!chaveNFe || !codigoEmpresa) return null;
  
  try {
    // Busca primeiro por ativa, depois por inativa
    const { data, error } = await supabase
      .from('compras')
      .select('*')
      .eq('codigo_empresa', codigoEmpresa)
      .eq('chave_nfe', chaveNFe)
      .order('ativo', { ascending: false }) // Ativas primeiro
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao buscar compra:', error);
    throw error;
  }
}

/**
 * Cria registro de compra (NF-e)
 * @param {Object} purchaseData - Dados da compra
 * @returns {Object} Compra criada
 */
export async function createPurchase(purchaseData) {
  const payload = {
    codigo_empresa: purchaseData.codigoEmpresa,
    fornecedor_id: purchaseData.fornecedorId,
    chave_nfe: purchaseData.chaveNfe,
    numero_nfe: purchaseData.numeroNfe,
    serie_nfe: purchaseData.serieNfe,
    data_emissao: purchaseData.dataEmissao,
    tipo_operacao: purchaseData.tipoOperacao,
    natureza_operacao: purchaseData.naturezaOperacao,
    valor_produtos: purchaseData.valorProdutos,
    valor_total: purchaseData.valorTotal,
    forma_pagamento: purchaseData.formaPagamento || null,
    status: 'processada',
    observacoes: purchaseData.observacoes || null,
    xml_completo: purchaseData.xmlCompleto || null,
  };
  
  try {
    const { data, error } = await supabase
      .from('compras')
      .insert(payload)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[Purchases] Compra criada:', data.numero_nfe, 'ID:', data.id);
    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao criar compra:', error);
    throw error;
  }
}

/**
 * Cria itens da compra
 * @param {string} compraId - ID da compra
 * @param {Array} items - Lista de itens
 * @returns {Array} Itens criados
 */
export async function createPurchaseItems(compraId, items) {
  if (!compraId || !items || items.length === 0) {
    throw new Error('ID da compra e itens são obrigatórios');
  }
  
  const payload = items.map(item => ({
    compra_id: compraId,
    produto_id: item.produtoId || null,
    codigo_produto_xml: item.codigoProdutoXML || null,
    nome_produto_xml: item.nomeProdutoXML,
    ean_xml: item.eanXML || null,
    ncm_xml: item.ncmXML || null,
    cfop_xml: item.cfopXML || null,
    unidade_xml: item.unidadeXML || null,
    quantidade: item.quantidade,
    valor_unitario: item.valorUnitario,
    valor_total: item.valorTotal,
    valor_desconto: item.valorDesconto || 0,
    valor_frete: item.valorFrete || 0,
    valor_seguro: item.valorSeguro || 0,
    valor_outras_despesas: item.valorOutrasDespesas || 0,
    icms_aliquota: item.icmsAliquota || null,
    icms_valor: item.icmsValor || null,
    ipi_aliquota: item.ipiAliquota || null,
    ipi_valor: item.ipiValor || null,
    pis_aliquota: item.pisAliquota || null,
    pis_valor: item.pisValor || null,
    cofins_aliquota: item.cofinsAliquota || null,
    cofins_valor: item.cofinsValor || null,
    vinculado_manualmente: item.vinculadoManualmente || false,
    observacoes: item.observacoes || null,
    selecionado_na_importacao: item.selecionadoNaImportacao || false
  }));
  
  try {
    const { data, error } = await supabase
      .from('compras_itens')
      .insert(payload)
      .select();
    
    if (error) throw error;
    
    console.log('[Purchases] Itens criados:', data.length);
    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao criar itens:', error);
    throw error;
  }
}

/**
 * Lista compras da empresa
 * @param {number} codigoEmpresa - Código da empresa
 * @param {Object} filters - Filtros opcionais
 * @returns {Object} Lista de compras e contagem
 */
export async function listPurchases(codigoEmpresa, filters = {}) {
	if (!codigoEmpresa) return { data: [], count: 0 };
	
	try {
		const page = filters.page && filters.page > 0 ? filters.page : 1;
		const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 100;
		const from = (page - 1) * pageSize;
		const to = from + pageSize - 1;

		let query = supabase
			.from('compras')
			.select('*,fornecedor:clientes!compras_fornecedor_id_fkey(id,nome,cnpj)', { count: 'exact' })
			.eq('codigo_empresa', codigoEmpresa);
		
		// Filtro de ativo/inativo
		if (filters.apenasInativas) {
			query = query.eq('ativo', false);
		} else if (filters.incluirInativas) {
			// Mostra todas (ativas e inativas)
		} else {
			query = query.eq('ativo', true);
		}
		
		if (filters.status) {
			query = query.eq('status', filters.status);
		}
		
		if (filters.fornecedorId) {
			query = query.eq('fornecedor_id', filters.fornecedorId);
		}
		
		if (filters.dataInicio) {
			query = query.gte('data_emissao', filters.dataInicio);
		}
		
		if (filters.dataFim) {
			query = query.lte('data_emissao', filters.dataFim);
		}
		
		query = query
			.order('data_emissao', { ascending: false })
			.range(from, to);
		
		const { data, error, count } = await query;
		
		// Logs de diagnóstico para produção (ComprasPage)
		try {
			console.log('[Purchases:list] filtros =', {
				codigoEmpresa,
				filters,
				page,
				pageSize,
				from,
				to,
			});
			console.log('[Purchases:list] resultado bruto =', {
				count,
				primeiroId: data?.[0]?.id,
				primeiroFornecedorId: data?.[0]?.fornecedor_id,
				primeiroFornecedorObj: data?.[0]?.fornecedor,
			});
		} catch {}
		
		if (error) throw error;
		return { data: data || [], count: count ?? 0 };
	} catch (error) {
		console.error('[Purchases] Erro ao listar compras:', error);
		return { data: [], count: 0 };
	}
}

/**
 * Busca itens de uma compra
 * @param {string} purchaseId - ID da compra
 * @returns {Array} Lista de itens
 */
export async function getPurchaseItems(purchaseId) {
  try {
    // Tabela produtos usa: nome, codigo_produto, codigo_barras (todos em português)
    const { data, error } = await supabase
      .from('compras_itens')
      .select(`
        *,
        produto:produto_id(id, nome, codigo_produto, codigo_barras, data_importacao)
      `)
      .eq('compra_id', purchaseId)
      .order('criado_em', { ascending: true });

    if (error) {
      console.error('[Purchases] Erro ao buscar itens:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao buscar itens:', error);
    throw error;
  }
}

/**
 * Inativa uma compra (soft delete)
 * @param {string} purchaseId - ID da compra
 * @param {string} motivo - Motivo da inativação
 * @param {string} userId - ID do usuário que está inativando
 * @returns {Object} Compra atualizada
 */
export async function deactivatePurchase(purchaseId, motivo, userId) {
  if (!purchaseId || !motivo) {
    throw new Error('ID da compra e motivo são obrigatórios');
  }
  
  try {
    const { data, error } = await supabase
      .from('compras')
      .update({
        ativo: false,
        motivo_inativacao: motivo,
        inativado_em: new Date().toISOString(),
        inativado_por: userId
      })
      .eq('id', purchaseId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[Purchases] Compra inativada:', purchaseId);
    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao inativar compra:', error);
    throw error;
  }
}

/**
 * Reativa uma compra
 * @param {string} purchaseId - ID da compra
 * @returns {Object} Compra atualizada
 */
export async function reactivatePurchase(purchaseId) {
  if (!purchaseId) {
    throw new Error('ID da compra é obrigatório');
  }
  
  try {
    const { data, error } = await supabase
      .from('compras')
      .update({
        ativo: true,
        motivo_inativacao: null,
        inativado_em: null,
        inativado_por: null
      })
      .eq('id', purchaseId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[Purchases] Compra reativada:', purchaseId);
    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao reativar compra:', error);
    throw error;
  }
}

// Deletar itens de uma compra (para reprocessamento)
export async function deletePurchaseItems(purchaseId) {
  try {
    console.log('[Purchases] Deletando itens da compra:', purchaseId);
    
    const { error } = await supabase
      .from('compras_itens')
      .delete()
      .eq('compra_id', purchaseId);

    if (error) {
      console.error('[Purchases] Erro ao deletar itens:', error);
      throw error;
    }

    console.log('[Purchases] Itens deletados com sucesso');
    return true;
  } catch (error) {
    console.error('[Purchases] Erro ao deletar itens:', error);
    throw error;
  }
}

// Reprocessar XML de uma compra existente
export async function reprocessPurchaseXML(purchaseId, newItems) {
  try {
    console.log('[Purchases] Reprocessando XML da compra:', purchaseId);
    
    // 1. Deletar itens existentes
    await deletePurchaseItems(purchaseId);
    
    // 2. Criar novos itens
    await createPurchaseItems(purchaseId, newItems);
    
    console.log('[Purchases] XML reprocessado com sucesso');
    return true;
  } catch (error) {
    console.error('[Purchases] Erro ao reprocessar XML:', error);
    throw error;
  }
}

// Atualizar dados de uma compra
export async function updatePurchase(purchaseId, updateData) {
  try {
    console.log('[Purchases] Atualizando compra:', purchaseId, updateData);
    
    const { data, error } = await supabase
      .from('compras')
      .update({
        fornecedor_id: updateData.fornecedorId,
        numero_nfe: updateData.numeroNfe,
        serie_nfe: updateData.serieNfe,
        data_emissao: updateData.dataEmissao,
        tipo_operacao: updateData.tipoOperacao,
        natureza_operacao: updateData.naturezaOperacao,
        valor_produtos: updateData.valorProdutos,
        valor_total: updateData.valorTotal,
        forma_pagamento: updateData.formaPagamento,
        observacoes: updateData.observacoes,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', purchaseId)
      .select()
      .single();

    if (error) {
      console.error('[Purchases] Erro ao atualizar compra:', error);
      throw error;
    }

    console.log('[Purchases] Compra atualizada:', data);
    return data;
  } catch (error) {
    console.error('[Purchases] Erro ao atualizar compra:', error);
    throw error;
  }
}
