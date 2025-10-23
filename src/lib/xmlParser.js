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
    
    // Extrair pagamentos
    const pagamentos = extractPagamentos(xmlDoc);
    
    // Calcular total da nota
    const totalNota = produtos.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
    
    return {
      produtos,
      fornecedor,
      pagamentos,
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
 * Extrai formas de pagamento do XML (tag <pag>)
 */
function extractPagamentos(xmlDoc) {
  const pagElements = xmlDoc.querySelectorAll('pag');
  const pagamentos = [];
  
  pagElements.forEach((pag) => {
    const tPag = getTextContent(pag, 'tPag'); // Código SEFAZ
    const vPag = parseFloat(getTextContent(pag, 'vPag') || '0');
    
    if (tPag && vPag > 0) {
      pagamentos.push({
        codigoSefaz: tPag,
        valor: vPag,
        descricao: mapCodigoSefazToNome(tPag)
      });
    }
  });
  
  return pagamentos;
}

/**
 * Mapeia código SEFAZ para nome da forma de pagamento
 */
function mapCodigoSefazToNome(codigo) {
  const mapa = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Cartão da Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '14': 'Duplicata Mercantil',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'PIX Dinâmico',
    '18': 'Transferência Bancária',
    '19': 'Programa de Fidelidade',
    '20': 'PIX Estático',
    '21': 'Crédito em Loja',
    '22': 'Pagamento Eletrônico',
    '90': 'Sem Pagamento',
    '99': 'Outros'
  };
  
  return mapa[codigo] || 'Outros';
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
  // Normaliza unidade do XML
  const unidadeXML = produtoXML.unidade?.toUpperCase().trim() || '';

  // Busca por EAN (somente se UNIDADE também bater)
  if (produtoXML.ean && produtoXML.ean !== 'SEM GTIN') {
    const byEan = produtosExistentes.find(p => {
      const unidadeProd = p.unit?.toUpperCase().trim() || '';
      return p.barcode === produtoXML.ean && unidadeProd === unidadeXML;
    });
    if (byEan) return byEan;
    const eanOnly = produtosExistentes.find(p => p.barcode === produtoXML.ean);
    if (eanOnly) {
      console.log('[xmlParser] EAN igual mas unidade diferente (não considerar o mesmo produto):', {
        ean: produtoXML.ean,
        unidadeXML,
        unidadeSistema: (eanOnly.unit || '').toUpperCase()
      });
    }
  }
  
  // Busca por código (somente se UNIDADE também bater)
  if (produtoXML.codigo) {
    const byCode = produtosExistentes.find(p => {
      const unidadeProd = p.unit?.toUpperCase().trim() || '';
      return p.code === produtoXML.codigo && unidadeProd === unidadeXML;
    });
    if (byCode) return byCode;
    const codeOnly = produtosExistentes.find(p => p.code === produtoXML.codigo);
    if (codeOnly) {
      console.log('[xmlParser] Código igual mas unidade diferente (não considerar o mesmo produto):', {
        codigo: produtoXML.codigo,
        unidadeXML,
        unidadeSistema: (codeOnly.unit || '').toUpperCase()
      });
    }
  }
  
  // Busca APENAS por nome EXATO + UNIDADE (case insensitive)
  // Removida a busca por similaridade para evitar falsos positivos
  const nomeXML = produtoXML.nome?.toLowerCase().trim() || '';
  // unidadeXML já calculada acima
  
  if (nomeXML) {
    const byExactName = produtosExistentes.find(p => {
      const nomeProd = p.name?.toLowerCase().trim() || '';
      const unidadeProd = p.unit?.toUpperCase().trim() || '';
      
      // Nome deve ser EXATO E unidade deve ser IGUAL
      const nomeMatch = nomeProd === nomeXML;
      const unidadeMatch = unidadeProd === unidadeXML;
      const isMatch = nomeMatch && unidadeMatch;
      
      if (nomeMatch && !unidadeMatch) {
        console.log('[xmlParser] Nome igual mas UNIDADE diferente - NÃO é o mesmo produto:');
        console.log('  Nome XML:', nomeXML, '| Unidade XML:', unidadeXML);
        console.log('  Nome Sistema:', nomeProd, '| Unidade Sistema:', unidadeProd);
      }
      
      if (isMatch) {
        console.log('[xmlParser] MATCH ENCONTRADO (nome + unidade):');
        console.log('  XML:', nomeXML, '| Unidade:', unidadeXML);
        console.log('  Sistema:', nomeProd, '| Unidade:', unidadeProd);
        console.log('  Produto:', p);
      }
      return isMatch;
    });
    if (byExactName) {
      console.log('[xmlParser] Produto existente encontrado por nome + unidade:', byExactName.name, byExactName.unit);
      return byExactName;
    }
  }
  
  console.log('[xmlParser] Nenhum produto encontrado para:', nomeXML, '| Unidade:', unidadeXML);
  // Não buscar por similaridade - apenas nome exato + unidade
  return null;
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
    category: 'Importados',
    
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
    
    codigo_empresa: codigoEmpresa,

    // Flags/metadados de origem XML (serão mapeados para colunas do BD em products.mapUiToDb)
    importedViaXML: true,
    xmlChave: produtoXML?.xmlChave || null,
    xmlNumero: produtoXML?.xmlNumero || null,
    xmlSerie: produtoXML?.xmlSerie || null,
    xmlEmissao: produtoXML?.xmlEmissao || null
  };
}
