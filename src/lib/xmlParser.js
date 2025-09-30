// Parser de XML de NF-e para importação de produtos

/**
 * Faz parse de um arquivo XML de NF-e e extrai os produtos
 * @param {string} xmlText - Conteúdo do arquivo XML
 * @returns {Object} { produtos: Array, fornecedor: Object, nfe: Object }
 */
export function parseNFeXML(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Verificar se há erros no parse
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML inválido: ' + parserError.textContent);
    }

    // Extrair informações da NF-e
    const nfeInfo = extractNFeInfo(xmlDoc);
    
    // Extrair informações do fornecedor/emitente
    const fornecedor = extractFornecedor(xmlDoc);
    
    // Extrair produtos
    const produtos = extractProdutos(xmlDoc);
    
    // Calcular total da nota
    const totalNota = produtos.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
    
    return {
      produtos,
      fornecedor,
      nfe: { ...nfeInfo, totalNota },
      success: true
    };
  } catch (error) {
    console.error('[XMLParser] Erro ao fazer parse do XML:', error);
    return {
      produtos: [],
      fornecedor: null,
      nfe: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Extrai informações básicas da NF-e/NFC-e
 */
function extractNFeInfo(xmlDoc) {
  const ide = xmlDoc.querySelector('ide');
  if (!ide) return null;
  
  // Extrair chave de acesso (funciona para NF-e e NFC-e)
  let chaveAcesso = '';
  
  // Método 1: Tag <chNFe> (mais confiável)
  const chNFeTag = xmlDoc.querySelector('chNFe');
  if (chNFeTag) {
    chaveAcesso = chNFeTag.textContent.trim();
  }
  
  // Método 2: Atributo Id da tag infNFe (fallback)
  if (!chaveAcesso) {
    const infNFe = xmlDoc.querySelector('infNFe');
    if (infNFe) {
      const id = infNFe.getAttribute('Id');
      if (id) {
        // Remove o prefixo "NFe" se existir
        chaveAcesso = id.replace('NFe', '');
      }
    }
  }
  
  return {
    numero: getTextContent(ide, 'nNF'),
    serie: getTextContent(ide, 'serie'),
    dataEmissao: getTextContent(ide, 'dhEmi'),
    chaveAcesso: chaveAcesso,
    tipo: getTextContent(ide, 'tpNF') === '0' ? 'Entrada' : 'Saída',
    naturezaOperacao: getTextContent(ide, 'natOp')
  };
}

/**
 * Extrai informações do fornecedor/emitente
 */
function extractFornecedor(xmlDoc) {
  const emit = xmlDoc.querySelector('emit');
  if (!emit) return null;
  
  return {
    cnpj: getTextContent(emit, 'CNPJ'),
    razaoSocial: getTextContent(emit, 'xNome'),
    nomeFantasia: getTextContent(emit, 'xFant'),
    endereco: {
      logradouro: getTextContent(emit, 'xLgr'),
      numero: getTextContent(emit, 'nro'),
      bairro: getTextContent(emit, 'xBairro'),
      cidade: getTextContent(emit, 'xMun'),
      uf: getTextContent(emit, 'UF'),
      cep: getTextContent(emit, 'CEP')
    }
  };
}

/**
 * Extrai todos os produtos do XML e agrupa duplicados
 */
function extractProdutos(xmlDoc) {
  const detElements = xmlDoc.querySelectorAll('det');
  const produtosMap = new Map(); // Usar Map para agrupar por chave única
  
  detElements.forEach((det, index) => {
    const prod = det.querySelector('prod');
    const imposto = det.querySelector('imposto');
    
    if (!prod) return;
    
    const codigo = getTextContent(prod, 'cProd');
    const ean = getTextContent(prod, 'cEAN');
    const nome = getTextContent(prod, 'xProd');
    const quantidade = parseFloat(getTextContent(prod, 'qCom') || '0');
    
    // Criar chave única: prioriza EAN, depois código, depois nome
    const chave = ean && ean !== 'SEM GTIN' ? `ean:${ean}` : 
                  codigo ? `cod:${codigo}` : 
                  `nome:${nome.toLowerCase().trim()}`;
    
    if (produtosMap.has(chave)) {
      // Produto duplicado: somar quantidade
      const existing = produtosMap.get(chave);
      existing.quantidade += quantidade;
      existing.valorTotal += parseFloat(getTextContent(prod, 'vProd') || '0');
    } else {
      // Produto novo: adicionar ao mapa
      const produto = {
        // Identificação
        codigo: codigo,
        ean: ean,
        nome: nome,
        ncm: getTextContent(prod, 'NCM'),
        cest: getTextContent(prod, 'CEST'),
        cfop: getTextContent(prod, 'CFOP'),
        
        // Unidade e quantidade
        unidade: getTextContent(prod, 'uCom'),
        quantidade: quantidade,
        
        // Valores
        valorUnitario: parseFloat(getTextContent(prod, 'vUnCom') || '0'),
        valorTotal: parseFloat(getTextContent(prod, 'vProd') || '0'),
        desconto: parseFloat(getTextContent(prod, 'vDesc') || '0'),
        
        // Impostos
        impostos: extractImpostos(imposto),
        
        // Informações adicionais
        descricao: nome,
        origem: index + 1 // Número do item na nota
      };
      
      produtosMap.set(chave, produto);
    }
  });
  
  // Converter Map para Array
  return Array.from(produtosMap.values());
}

/**
 * Extrai informações de impostos
 */
function extractImpostos(impostoElement) {
  if (!impostoElement) return {};
  
  const impostos = {};
  
  // ICMS
  const icms = impostoElement.querySelector('ICMS');
  if (icms) {
    const icmsType = icms.children[0]; // ICMS00, ICMS10, etc
    if (icmsType) {
      impostos.icms = {
        cst: getTextContent(icmsType, 'CST'),
        csosn: getTextContent(icmsType, 'CSOSN'),
        aliquota: parseFloat(getTextContent(icmsType, 'pICMS') || '0'),
        valor: parseFloat(getTextContent(icmsType, 'vICMS') || '0')
      };
    }
  }
  
  // PIS
  const pis = impostoElement.querySelector('PIS');
  if (pis) {
    const pisType = pis.children[0];
    if (pisType) {
      impostos.pis = {
        cst: getTextContent(pisType, 'CST'),
        aliquota: parseFloat(getTextContent(pisType, 'pPIS') || '0'),
        valor: parseFloat(getTextContent(pisType, 'vPIS') || '0')
      };
    }
  }
  
  // COFINS
  const cofins = impostoElement.querySelector('COFINS');
  if (cofins) {
    const cofinsType = cofins.children[0];
    if (cofinsType) {
      impostos.cofins = {
        cst: getTextContent(cofinsType, 'CST'),
        aliquota: parseFloat(getTextContent(cofinsType, 'pCOFINS') || '0'),
        valor: parseFloat(getTextContent(cofinsType, 'vCOFINS') || '0')
      };
    }
  }
  
  // IPI
  const ipi = impostoElement.querySelector('IPI');
  if (ipi) {
    const ipiTrib = ipi.querySelector('IPITrib');
    if (ipiTrib) {
      impostos.ipi = {
        cst: getTextContent(ipiTrib, 'CST'),
        aliquota: parseFloat(getTextContent(ipiTrib, 'pIPI') || '0'),
        valor: parseFloat(getTextContent(ipiTrib, 'vIPI') || '0')
      };
    }
  }
  
  return impostos;
}

/**
 * Helper para extrair texto de um elemento XML
 */
function getTextContent(parent, tagName) {
  if (!parent) return '';
  const element = parent.querySelector(tagName);
  return element ? element.textContent.trim() : '';
}

/**
 * Valida se um produto já existe no sistema
 * @param {Object} produtoXML - Produto extraído do XML
 * @param {Array} produtosExistentes - Lista de produtos já cadastrados
 * @returns {Object|null} Produto existente ou null
 */
export function findExistingProduct(produtoXML, produtosExistentes) {
  // Busca por EAN (mais confiável)
  if (produtoXML.ean && produtoXML.ean !== 'SEM GTIN') {
    const byEan = produtosExistentes.find(p => p.barcode === produtoXML.ean);
    if (byEan) return byEan;
  }
  
  // Busca por código
  if (produtoXML.codigo) {
    const byCode = produtosExistentes.find(p => p.code === produtoXML.codigo);
    if (byCode) return byCode;
  }
  
  // Busca por nome EXATO (case insensitive)
  const nomeXML = produtoXML.nome?.toLowerCase().trim() || '';
  if (nomeXML) {
    const byExactName = produtosExistentes.find(p => {
      const nomeProd = p.name?.toLowerCase().trim() || '';
      return nomeProd === nomeXML;
    });
    if (byExactName) return byExactName;
  }
  
  // Busca por nome similar (85% de similaridade - mais rigoroso)
  const byName = produtosExistentes.find(p => {
    const similarity = calculateSimilarity(
      p.name?.toLowerCase() || '',
      produtoXML.nome?.toLowerCase() || ''
    );
    return similarity > 0.85;
  });
  
  return byName || null;
}

/**
 * Calcula similaridade entre duas strings (algoritmo simples)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calcula distância de Levenshtein entre duas strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Converte produto do XML para formato do sistema
 */
export function convertXMLProductToSystemFormat(produtoXML, codigoEmpresa) {
  return {
    code: produtoXML.codigo || '',
    name: produtoXML.nome || '',
    barcode: produtoXML.ean && produtoXML.ean !== 'SEM GTIN' ? produtoXML.ean : '',
    ncm: produtoXML.ncm || '',
    cest: produtoXML.cest || '',
    unit: produtoXML.unidade || 'UN',
    costPrice: produtoXML.valorUnitario || 0,
    salePrice: produtoXML.valorUnitario * 1.3 || 0, // Margem padrão de 30%
    stock: 0, // Será atualizado depois
    minStock: 0,
    status: 'active',
    active: true,
    type: 'Venda',
    category: 'Importado',
    
    // Dados fiscais
    cfopInterno: produtoXML.cfop || '',
    cstIcmsInterno: produtoXML.impostos?.icms?.cst || '',
    csosnInterno: produtoXML.impostos?.icms?.csosn || '',
    aliqIcmsInterno: produtoXML.impostos?.icms?.aliquota || 0,
    
    cstPisEntrada: produtoXML.impostos?.pis?.cst || '',
    aliqPisPercent: produtoXML.impostos?.pis?.aliquota || 0,
    aliqCofinsPercent: produtoXML.impostos?.cofins?.aliquota || 0,
    
    cstIpi: produtoXML.impostos?.ipi?.cst || '',
    aliqIpiPercent: produtoXML.impostos?.ipi?.aliquota || 0,
    
    codigo_empresa: codigoEmpresa
  };
}
