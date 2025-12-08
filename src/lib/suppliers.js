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
    complemento: fornecedorData.endereco?.complemento || null,
    bairro: fornecedorData.endereco?.bairro || null,
    cidade: fornecedorData.endereco?.cidade || null,
    uf: fornecedorData.endereco?.uf || null,
    cep: fornecedorData.endereco?.cep?.replace(/\D/g, '') || null,
    cidade_ibge: fornecedorData.endereco?.codigoIBGE || null,
    telefone: fornecedorData.endereco?.fone || null,
    // Fiscais
    ie: fornecedorData.ie || null,
    iest: fornecedorData.iest || null,
    im: fornecedorData.im || null,
    // Observação: CRT no XML refere-se ao emitente. Mantemos como informação auxiliar se houver campo compatível
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
      console.log('[Suppliers] Fornecedor encontrado:', existing.razao_social || existing.nome);
      // Atualizar campos faltantes (opcional)
      const patch = {};
      const end = fornecedorData.endereco || {};
      const clean = (s) => (s == null || String(s).trim() === '' ? null : s);
      if (!clean(existing.ie) && clean(fornecedorData.ie)) patch.ie = fornecedorData.ie;
      if (!clean(existing.iest) && clean(fornecedorData.iest)) patch.iest = fornecedorData.iest;
      if (!clean(existing.im) && clean(fornecedorData.im)) patch.im = fornecedorData.im;
      if (!clean(existing.endereco) && clean(end.logradouro)) patch.endereco = end.logradouro;
      if (!clean(existing.numero) && clean(end.numero)) patch.numero = end.numero;
      if (!clean(existing.complemento) && clean(end.complemento)) patch.complemento = end.complemento;
      if (!clean(existing.bairro) && clean(end.bairro)) patch.bairro = end.bairro;
      if (!clean(existing.cidade) && clean(end.cidade)) patch.cidade = end.cidade;
      if (!clean(existing.uf) && clean(end.uf)) patch.uf = end.uf;
      if (!clean(existing.cep) && clean(end.cep)) patch.cep = String(end.cep).replace(/\D/g, '');
      if (!clean(existing.cidade_ibge) && clean(end.codigoIBGE)) patch.cidade_ibge = end.codigoIBGE;
      if (!clean(existing.telefone) && clean(end.fone)) patch.telefone = end.fone;
      // Nome/apelido somente se vazios
      if (!clean(existing.nome) && clean(fornecedorData.razaoSocial)) patch.nome = fornecedorData.razaoSocial;
      if (!clean(existing.apelido) && (clean(fornecedorData.nomeFantasia) || clean(fornecedorData.razaoSocial))) patch.apelido = fornecedorData.nomeFantasia || fornecedorData.razaoSocial;
      if (Object.keys(patch).length > 0) {
        await supabase.from('clientes').update(patch).eq('id', existing.id);
        console.log('[Suppliers] Fornecedor atualizado com campos faltantes:', patch);
        return { ...existing, ...patch };
      }
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
