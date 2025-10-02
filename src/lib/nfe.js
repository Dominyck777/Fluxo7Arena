import { supabase } from '@/lib/supabase';

/**
 * Gera XML de NF-e/NFC-e a partir de uma comanda
 * @param {string} comandaId - ID da comanda
 * @param {string} codigoEmpresa - Código da empresa
 * @param {string} modelo - Modelo da nota: '55' (NF-e) ou '65' (NFC-e)
 * @returns {Promise<string>} XML gerado
 */
export async function gerarXMLNFe({ comandaId, codigoEmpresa, modelo = '65' }) {
  if (!comandaId) throw new Error('ID da comanda é obrigatório');
  if (!codigoEmpresa) throw new Error('Código da empresa é obrigatório');

  // 1. Buscar dados da comanda
  const { data: comanda, error: comandaError } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', comandaId)
    .eq('codigo_empresa', codigoEmpresa)
    .single();

  if (comandaError) throw new Error(`Erro ao buscar comanda: ${comandaError.message}`);
  if (!comanda) throw new Error('Comanda não encontrada');

  // 2. Buscar itens da venda
  const { data: itens, error: itensError } = await supabase
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

  if (itensError) throw new Error(`Erro ao buscar itens: ${itensError.message}`);

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
    cliente = clienteData;
  }

  // 6. Gerar XML
  return gerarXML({
    comanda,
    itens: itens || [],
    pagamentos: pagamentos || [],
    empresa,
    cliente,
    modelo
  });
}

/**
 * Gera o XML formatado
 */
function gerarXML({ comanda, itens, pagamentos, empresa, cliente, modelo = '65' }) {
  const now = new Date();
  const dhEmi = now.toISOString();
  const nNF = comanda.numero || '1';
  const modeloNota = modelo === '55' ? '55' : '65'; // 55 = NF-e, 65 = NFC-e
  const tipoNota = modeloNota === '55' ? 'NF-e' : 'NFC-e';
  
  // Totalizadores
  const vProd = itens.reduce((sum, item) => sum + (Number(item.preco_total) || 0), 0);
  const vDesc = Number(comanda.desconto) || 0;
  const vNF = vProd - vDesc;

  // Cliente (consumidor final se não informado)
  const dest = cliente ? `
    <dest>
      <${cliente.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}>${cliente.cpf_cnpj || ''}</${cliente.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}>
      <xNome>${escaparXML(cliente.nome || cliente.razao_social || '')}</xNome>
      <enderDest>
        <xLgr>${escaparXML(cliente.logradouro || '')}</xLgr>
        <nro>${escaparXML(cliente.numero || 'S/N')}</nro>
        <xBairro>${escaparXML(cliente.bairro || '')}</xBairro>
        <cMun>${cliente.codigo_municipio || ''}</cMun>
        <xMun>${escaparXML(cliente.municipio || '')}</xMun>
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
        <cUF>${empresa.codigo_uf || '35'}</cUF>
        <cNF>${nNF.padStart(8, '0')}</cNF>
        <natOp>VENDA</natOp>
        <mod>${modeloNota}</mod>
        <serie>1</serie>
        <nNF>${nNF}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${empresa.codigo_municipio || ''}</cMunFG>
        <tpImp>4</tpImp>
        <tpEmis>1</tpEmis>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
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
          <cMun>${empresa.codigo_municipio || ''}</cMun>
          <xMun>${escaparXML(empresa.municipio || '')}</xMun>
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
