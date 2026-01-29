import { supabase } from '@/lib/supabase';

/**
 * Gera XML de NF-e/NFC-e a partir de uma comanda
 * @param {string} comandaId - ID da comanda
 * @param {string} codigoEmpresa - Código da empresa
 * @param {string} modelo - Modelo da nota: '55' (NF-e) ou '65' (NFC-e)
 * @returns {Promise<string>} XML gerado
 */
export async function gerarXMLNFe({ comandaId, codigoEmpresa, modelo = '65', overrides = {} }) {
  if (!comandaId) throw new Error('ID da comanda é obrigatório');
  if (!codigoEmpresa) throw new Error('Código da empresa é obrigatório');

  // 1. Buscar dados da comanda
  let comanda = null;
  let comandaError = null;
  try {
    const r = await supabase
      .from('comandas')
      .select('*')
      .eq('id', comandaId)
      .eq('codigo_empresa', codigoEmpresa)
      .single();
    comanda = r?.data || null;
    comandaError = r?.error || null;
  } catch (e) {
    comandaError = e;
  }
  if (comandaError || !comanda) {
    const r2 = await supabase
      .from('vendas')
      .select('*')
      .eq('id', comandaId)
      .eq('codigo_empresa', codigoEmpresa)
      .single();
    if (r2?.error) throw new Error(`Erro ao buscar comanda: ${r2.error.message}`);
    comanda = r2?.data || null;
  }

  if (!comanda) throw new Error('Comanda não encontrada');

  // 2. Buscar itens da venda
  let itens = [];
  let itensError = null;
  try {
    const { data: itensCmd, error: cmdErr } = await supabase
      .from('comanda_itens')
      .select('*')
      .eq('comanda_id', comandaId)
      .eq('codigo_empresa', codigoEmpresa);
    if (cmdErr) throw cmdErr;
    const baseItens = itensCmd || [];
    const produtoIds = Array.from(new Set(baseItens.map(i => i.produto_id).filter(Boolean)));
    let produtosMap = new Map();
    if (produtoIds.length) {
      const { data: prods } = await supabase
        .from('produtos')
        .select('id, nome, codigo_produto, ncm, cest, cfop_interno, cfop_externo, cst_icms_interno, cst_icms_externo, csosn_interno, csosn_externo, aliquota_icms_interno, aliquota_icms_externo, cst_pis_entrada, cst_pis_saida, aliquota_pis_percent, aliquota_cofins_percent, cst_ipi, aliquota_ipi_percent')
        .in('id', produtoIds)
        .eq('codigo_empresa', codigoEmpresa);
      (prods || []).forEach(p => produtosMap.set(p.id, p));
    }
    itens = baseItens.map((it) => {
      const p = produtosMap.get(it.produto_id) || {};
      const prod = {
        id: p.id || it.produto_id,
        nome: p.nome || it.descricao || 'Produto',
        codigo: p.codigo_produto || p.codigo || it.produto_id,
        ncm: p.ncm || '',
        cest: p.cest || '',
        cfopInterno: p.cfop_interno || p.cfopInterno,
        cfopExterno: p.cfop_externo || p.cfopExterno,
        cstIcmsInterno: p.cst_icms_interno || p.cstIcmsInterno,
        cstIcmsExterno: p.cst_icms_externo || p.cstIcmsExterno,
        csosnInterno: p.csosn_interno || p.csosnInterno,
        csosnExterno: p.csosn_externo || p.csosnExterno,
        aliqIcmsInterno: p.aliquota_icms_interno ?? p.aliqIcmsInterno,
        aliqIcmsExterno: p.aliquota_icms_externo ?? p.aliqIcmsExterno,
        cstPisEntrada: p.cst_pis_entrada || p.cstPisEntrada,
        cstPisSaida: p.cst_pis_saida || p.cstPisSaida,
        aliqPisPercent: p.aliquota_pis_percent ?? p.aliqPisPercent,
        aliqCofinsPercent: p.aliquota_cofins_percent ?? p.aliqCofinsPercent,
        cstIpi: p.cst_ipi || p.cstIpi,
        aliqIpiPercent: p.aliquota_ipi_percent ?? p.aliqIpiPercent,
      };
      const quantidade = Number(it.quantidade ?? 1) || 1;
      const preco_unitario = Number(it.preco_unitario ?? it.preco ?? 0) || 0;
      const desconto = Number(it.desconto ?? 0) || 0;
      const preco_total = Number(it.preco_total ?? (preco_unitario * quantidade - desconto));
      return { ...it, quantidade, preco_unitario, desconto, preco_total, produtos: prod };
    });
  } catch (e) {
    itensError = e;
  }
  if (itensError) {
    const { data: itensVenda, error: itensVendaError } = await supabase
      .from('itens_venda')
      .select(`
        *,
        produtos!itens_venda_produto_id_fkey (
          id,
          nome,
          codigo,
          ncm,
          cest,
          cfopInterno,
          cfopExterno,
          cstIcmsInterno,
          cstIcmsExterno,
          csosnInterno,
          csosnExterno,
          aliqIcmsInterno,
          aliqIcmsExterno,
          cstPisEntrada,
          cstPisSaida,
          aliqPisPercent,
          aliqCofinsPercent,
          cstIpi,
          aliqIpiPercent
        )
      `)
      .eq('comanda_id', comandaId)
      .eq('codigo_empresa', codigoEmpresa);
    if (itensVendaError) throw new Error(`Erro ao buscar itens: ${itensVendaError.message}`);
    itens = itensVenda || [];
  }

  // 3. Buscar pagamentos com finalizadoras
  const { data: pagamentos, error: pagamentosError } = await supabase
    .from('pagamentos')
    .select(`
      *,
      finalizadoras!pagamentos_finalizadora_id_fkey (
        id,
        codigo_sefaz,
        nome
      )
    `)
    .eq('comanda_id', comandaId)
    .eq('codigo_empresa', codigoEmpresa)
    .neq('status', 'Cancelado')
    .neq('status', 'Estornado');

  if (pagamentosError) throw new Error(`Erro ao buscar pagamentos: ${pagamentosError.message}`);

  // 4. Buscar dados da empresa
  const { data: empresa, error: empresaError } = await supabase
    .from('empresas')
    .select('*')
    .eq('codigo_empresa', codigoEmpresa)
    .single();

  if (empresaError) throw new Error(`Erro ao buscar empresa: ${empresaError.message}`);

  // 5. Buscar cliente (se houver)
  let cliente = null;
  if (comanda.cliente_id) {
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', comanda.cliente_id)
      .eq('codigo_empresa', codigoEmpresa)
      .single();
    if (clienteData) {
      const doc = (clienteData.cpf_cnpj || clienteData.cnpj || clienteData.cpf || '').toString();
      const tipoPessoa = clienteData.tipo_pessoa || (String(doc).replace(/\D/g, '').length === 14 ? 'PJ' : 'PF');
      cliente = {
        ...clienteData,
        tipo_pessoa: tipoPessoa,
        cpf_cnpj: doc,
        nome: clienteData.nome || clienteData.razao_social || clienteData.apelido || clienteData.nome_fantasia || '',
        logradouro: clienteData.logradouro || clienteData.endereco || clienteData.endereco_logradouro || '',
        numero: clienteData.numero || '0',
        bairro: clienteData.bairro || '',
        municipio: clienteData.municipio || clienteData.cidade || '',
        cidade: clienteData.cidade || clienteData.municipio || '',
        uf: clienteData.uf || '',
        cep: clienteData.cep || '',
        codigo_municipio_ibge: clienteData.codigo_municipio_ibge || clienteData.cidade_ibge || clienteData.codigo_municipio || '',
      };
    }
  }
  // 6. Gerar XML
  return gerarXML({
    comanda,
    itens: itens || [],
    pagamentos: pagamentos || [],
    empresa,
    cliente,
    modelo,
    overrides,
  });
}

export async function gerarXMLNFeFromData({ codigoEmpresa, empresa, cliente, itens, pagamentos, modelo = '55', overrides = {} }) {
  let emp = empresa;
  if (!emp) {
    if (!codigoEmpresa) throw new Error('codigoEmpresa obrigatório quando empresa não for fornecida');
    const { data: empData, error: empErr } = await supabase
      .from('empresas')
      .select('*')
      .eq('codigo_empresa', codigoEmpresa)
      .single();
    if (empErr) throw new Error(`Erro ao buscar empresa: ${empErr.message}`);
    emp = empData;
  }
  const comandaFake = { numero: overrides?.nNF || '1', desconto: 0 };
  const itensNorm = Array.isArray(itens) ? itens.map((it) => ({
    preco_unitario: Number(it.preco_unitario) || 0,
    quantidade: Number(it.quantidade) || 1,
    preco_total: Number(it.preco_total != null ? it.preco_total : (Number(it.preco_unitario)||0) * (Number(it.quantidade)||1)),
    produtos: it.produtos || {
      id: it.produto_id || it.id,
      nome: it.nome || it.descricao || 'Produto',
      codigo: it.codigo || String(it.produto_id || it.id || ''),
      ncm: it.ncm || '',
      cest: it.cest || '',
      cfopInterno: it.cfop || it.cfopInterno,
      cstIcmsInterno: it.cstIcmsInterno,
      csosnInterno: it.csosnInterno,
      aliqIcmsInterno: it.aliqIcmsInterno,
      cstPisSaida: it.cstPisSaida,
      aliqPisPercent: it.aliqPisPercent,
      aliqCofinsPercent: it.aliqCofinsPercent,
    },
  })) : [];
  const pags = Array.isArray(pagamentos) && pagamentos.length ? pagamentos : [{ finalizadoras: { codigo_sefaz: '99' }, valor: itensNorm.reduce((s, x) => s + (Number(x.preco_total)||0), 0) }];
  return gerarXML({ comanda: comandaFake, itens: itensNorm, pagamentos: pags, empresa: emp, cliente, modelo, overrides });
}

/**
 * Gera o XML formatado
 */
function gerarXML({ comanda, itens, pagamentos, empresa, cliente, modelo = '65', overrides = {} }) {
  const now = new Date();
  const dhEmi = now.toISOString();
  const nNF = String(overrides.nNF || comanda.numero || '1');
  const modeloNota = modelo === '55' ? '55' : '65'; // 55 = NF-e, 65 = NFC-e
  const tipoNota = modeloNota === '55' ? 'NF-e' : 'NFC-e';
  
  // Totalizadores
  const vProd = itens.reduce((sum, item) => sum + (Number(item.preco_total) || 0), 0);
  const vDesc = (() => {
    const direct = Number(comanda?.desconto || 0);
    if (direct) return direct;
    const tipo = String(comanda?.desconto_tipo || '').toLowerCase();
    const val = Number(comanda?.desconto_valor || 0);
    if (tipo === 'percentual' && val > 0) return (vProd * (val / 100));
    if (tipo === 'fixo' && val > 0) return val;
    return 0;
  })();
  const vNF = vProd - vDesc;

  // Overrides/derivações para IDE
  const natOp = String(overrides.natOp || 'VENDA');
  const serie = String(overrides.serie || '1');
  const tpAmb = String(overrides.tpAmb || ((empresa.ambiente === 'producao') ? '1' : '2'));
  const tpNF = String(overrides.tpNF || '1'); // 1=Saída (padrão), 0=Entrada
  const indFinal = String(overrides.indFinal || '1');
  const indPres = String(overrides.indPres || '1');
  const idDestDefault = (cliente && cliente.uf && empresa.uf && cliente.uf !== empresa.uf) ? '2' : '1';
  const idDest = String(overrides.idDest || idDestDefault);

  const ufMap = { AC:'12', AL:'27', AM:'13', AP:'16', BA:'29', CE:'23', DF:'53', ES:'32', GO:'52', MA:'21', MG:'31', MS:'50', MT:'51', PA:'15', PB:'25', PE:'26', PI:'22', PR:'41', RJ:'33', RN:'24', RO:'11', RR:'14', RS:'43', SC:'42', SE:'28', SP:'35', TO:'17' };
  const cUF = String(ufMap[(empresa.uf||'').toUpperCase()] || empresa.codigo_uf || '35');
  const cMunFG = String(empresa.codigo_municipio_ibge || empresa.codigo_municipio || '');

  // Cliente (consumidor final se não informado)
  const dest = cliente ? `
    <dest>
      <${cliente.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}>${cliente.cpf_cnpj || ''}</${cliente.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}>
      <xNome>${escaparXML(cliente.nome || cliente.razao_social || '')}</xNome>
      <enderDest>
        <xLgr>${escaparXML(cliente.logradouro || '')}</xLgr>
        <nro>${escaparXML(cliente.numero || 'S/N')}</nro>
        <xBairro>${escaparXML(cliente.bairro || '')}</xBairro>
        <cMun>${cliente.codigo_municipio || cliente.codigo_municipio_ibge || ''}</cMun>
        <xMun>${escaparXML(cliente.municipio || cliente.cidade || '')}</xMun>
        <UF>${cliente.uf || ''}</UF>
        <CEP>${(cliente.cep || '').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>9</indIEDest>
      ${cliente.email ? `<email>${escaparXML(cliente.email)}</email>` : ''}
    </dest>` : `
    <dest>
      <indIEDest>9</indIEDest>
    </dest>`;

  // Itens
  const detXML = itens.map((item, idx) => {
    const produto = item.produtos || {};
    const vUnCom = Number(item.preco_unitario) || 0;
    const qCom = Number(item.quantidade) || 1;
    const vProdItem = Number(item.preco_total) || (vUnCom * qCom);

    return `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${escaparXML(produto.codigo || item.produto_id)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${escaparXML(produto.nome || 'Produto')}</xProd>
        <NCM>${produto.ncm || '00000000'}</NCM>
        ${produto.cest ? `<CEST>${produto.cest}</CEST>` : ''}
        <CFOP>${produto.cfopInterno || '5102'}</CFOP>
        <uCom>UN</uCom>
        <qCom>${qCom.toFixed(4)}</qCom>
        <vUnCom>${vUnCom.toFixed(10)}</vUnCom>
        <vProd>${vProdItem.toFixed(2)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>${qCom.toFixed(4)}</qTrib>
        <vUnTrib>${vUnCom.toFixed(10)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          ${produto.csosnInterno ? `
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>${produto.csosnInterno}</CSOSN>
          </ICMSSN102>` : `
          <ICMS00>
            <orig>0</orig>
            <CST>${produto.cstIcmsInterno || '00'}</CST>
            <modBC>3</modBC>
            <vBC>${vProdItem.toFixed(2)}</vBC>
            <pICMS>${produto.aliqIcmsInterno || '0.00'}</pICMS>
            <vICMS>${((vProdItem * (Number(produto.aliqIcmsInterno) || 0)) / 100).toFixed(2)}</vICMS>
          </ICMS00>`}
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>${produto.cstPisSaida || '01'}</CST>
            <vBC>${vProdItem.toFixed(2)}</vBC>
            <pPIS>${produto.aliqPisPercent || '0.00'}</pPIS>
            <vPIS>${((vProdItem * (Number(produto.aliqPisPercent) || 0)) / 100).toFixed(2)}</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>${produto.cstPisSaida || '01'}</CST>
            <vBC>${vProdItem.toFixed(2)}</vBC>
            <pCOFINS>${produto.aliqCofinsPercent || '0.00'}</pCOFINS>
            <vCOFINS>${((vProdItem * (Number(produto.aliqCofinsPercent) || 0)) / 100).toFixed(2)}</vCOFINS>
          </COFINSAliq>
        </COFINS>
      </imposto>
    </det>`;
  }).join('');

  // Pagamentos
  const pagXML = pagamentos.map(pag => {
    const codigoSefaz = pag.finalizadoras?.codigo_sefaz || '99'; // 99 = Outros
    const vPag = Number(pag.valor) || 0;

    return `
    <pag>
      <detPag>
        <tPag>${codigoSefaz}</tPag>
        <vPag>${vPag.toFixed(2)}</vPag>
      </detPag>
    </pag>`;
  }).join('');

  // XML completo
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe${empresa.cnpj || ''}${nNF.padStart(9, '0')}">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${nNF.padStart(8, '0')}</cNF>
        <natOp>${natOp}</natOp>
        <mod>${modeloNota}</mod>
        <serie>${serie}</serie>
        <nNF>${nNF}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>${tpNF}</tpNF>
        <idDest>${idDest}</idDest>
        <cMunFG>${cMunFG}</cMunFG>
        <tpImp>4</tpImp>
        <tpEmis>1</tpEmis>
        <tpAmb>${tpAmb}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>${indFinal}</indFinal>
        <indPres>${indPres}</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0.0</verProc>
      </ide>
      <emit>
        <CNPJ>${empresa.cnpj || ''}</CNPJ>
        <xNome>${escaparXML(empresa.razao_social || empresa.nome_fantasia || '')}</xNome>
        <xFant>${escaparXML(empresa.nome_fantasia || '')}</xFant>
        <enderEmit>
          <xLgr>${escaparXML(empresa.logradouro || '')}</xLgr>
          <nro>${escaparXML(empresa.numero || 'S/N')}</nro>
          <xBairro>${escaparXML(empresa.bairro || '')}</xBairro>
          <cMun>${empresa.codigo_municipio_ibge || empresa.codigo_municipio || ''}</cMun>
          <xMun>${escaparXML(empresa.municipio || empresa.cidade || '')}</xMun>
          <UF>${empresa.uf || ''}</UF>
          <CEP>${(empresa.cep || '').replace(/\D/g, '')}</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
          <fone>${(empresa.telefone || '').replace(/\D/g, '')}</fone>
        </enderEmit>
        <IE>${empresa.inscricao_estadual || ''}</IE>
        <CRT>${empresa.regime_tributario || '1'}</CRT>
      </emit>
      ${dest}
      ${detXML}
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${vProd.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>${vDesc.toFixed(2)}</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${vNF.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      ${pagXML}
      <infAdic>
        <infCpl>Comanda: ${comanda.id} | Modelo: ${tipoNota}</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;

  return xml;
}

/**
 * Escapa caracteres especiais para XML
 */
function escaparXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Faz download do XML gerado
 */
export function downloadXML(xml, nomeArquivo = 'nfe.xml') {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
