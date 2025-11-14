// Funções para gerenciar fornecedores (clientes com flag_fornecedor)
import { supabase } from './supabase';

/**
 * Busca fornecedor pelo CNPJ
 * @param {string} cnpj - CNPJ do fornecedor
 * @param {number} codigoEmpresa - Código da empresa
 * @returns {Object|null} Fornecedor encontrado ou null
 */
export async function findSupplierByCNPJ(cnpj, codigoEmpresa) {
  if (!cnpj || !codigoEmpresa) return null;
  
  // Remover formatação do CNPJ
  const cnpjClean = cnpj.replace(/\D/g, '');
  
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('codigo_empresa', codigoEmpresa)
      .eq('cnpj', cnpjClean)
      .eq('flag_fornecedor', true)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Suppliers] Erro ao buscar fornecedor:', error);
    throw error;
  }
}

/**
 * Cria um novo fornecedor a partir dos dados do XML
 * @param {Object} fornecedorData - Dados do fornecedor extraídos do XML
 * @param {number} codigoEmpresa - Código da empresa
 * @returns {Object} Fornecedor criado
 */
export async function createSupplierFromXML(fornecedorData, codigoEmpresa) {
  if (!fornecedorData || !codigoEmpresa) {
    throw new Error('Dados do fornecedor e código da empresa são obrigatórios');
  }
  
  const cnpjClean = fornecedorData.cnpj?.replace(/\D/g, '') || '';
  
  if (!cnpjClean) {
    throw new Error('CNPJ do fornecedor não encontrado no XML');
  }
  
  // Montar payload do fornecedor
  const payload = {
    codigo_empresa: codigoEmpresa,
    tipo_pessoa: 'PJ',
    cnpj: cnpjClean,
    nome: fornecedorData.razaoSocial || 'Fornecedor Importado',
    apelido: fornecedorData.nomeFantasia || fornecedorData.razaoSocial,
    flag_fornecedor: true,
    flag_cliente: false,
    status: 'active',
    // Endereço
    endereco: fornecedorData.endereco?.logradouro || null,
    numero: fornecedorData.endereco?.numero || null,
    bairro: fornecedorData.endereco?.bairro || null,
    cidade: fornecedorData.endereco?.cidade || null,
    uf: fornecedorData.endereco?.uf || null,
    cep: fornecedorData.endereco?.cep?.replace(/\D/g, '') || null,
  };
  
  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert(payload)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[Suppliers] Fornecedor criado:', data);
    return data;
  } catch (error) {
    console.error('[Suppliers] Erro ao criar fornecedor:', error);
    throw error;
  }
}

/**
 * Busca ou cria fornecedor automaticamente
 * @param {Object} fornecedorData - Dados do fornecedor do XML
 * @param {number} codigoEmpresa - Código da empresa
 * @returns {Object} Fornecedor encontrado ou criado
 */
export async function findOrCreateSupplier(fornecedorData, codigoEmpresa) {
  if (!fornecedorData?.cnpj) {
    throw new Error('CNPJ do fornecedor não encontrado no XML');
  }
  
  try {
    // Tentar buscar fornecedor existente
    const existing = await findSupplierByCNPJ(fornecedorData.cnpj, codigoEmpresa);
    
    if (existing) {
      console.log('[Suppliers] Fornecedor encontrado:', existing.razao_social);
      return existing;
    }
    
    // Se não existe, criar novo
    console.log('[Suppliers] Criando novo fornecedor:', fornecedorData.razaoSocial);
    const newSupplier = await createSupplierFromXML(fornecedorData, codigoEmpresa);
    return newSupplier;
  } catch (error) {
    console.error('[Suppliers] Erro ao buscar/criar fornecedor:', error);
    throw error;
  }
}

/**
 * Lista todos os fornecedores da empresa
 * @param {number} codigoEmpresa - Código da empresa
 * @returns {Array} Lista de fornecedores
 */
export async function listSuppliers(codigoEmpresa) {
  if (!codigoEmpresa) return [];
  
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('codigo_empresa', codigoEmpresa)
      .eq('flag_fornecedor', true)
      .order('nome', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Suppliers] Erro ao listar fornecedores:', error);
    return [];
  }
}
