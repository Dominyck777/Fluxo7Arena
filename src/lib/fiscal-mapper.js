import { supabase } from '@/lib/supabase';

function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }
function to2(n) { const x = Number(n ?? 0); return Number.isFinite(x) ? x.toFixed(2) : '0.00'; }
function to4(n) { const x = Number(n ?? 0); return Number.isFinite(x) ? x.toFixed(4) : '0.0000'; }
function asText(v) { return v == null ? '' : String(v); }

function computeFormaPagamento(pagamentos) {
  if (!pagamentos?.length) return 0; // à vista por padrão
  // se houver algum pagamento parcelado/fiado no seu sistema, adapte aqui
  return 0;
}

function pickMeioPagamento(pagamentos, finalizadoras) {
  if (!pagamentos?.length) return '90'; // Sem pagamento
  const p = pagamentos[0];
  const fin = finalizadoras.find(f => f.id === p.finalizadora_id);
  return fin?.codigo_sefaz || '99';
}

function pickDestinatarioFromComanda(comanda, cliente) {
  if (cliente) {
    const cpfCnpj = onlyDigits(cliente.cpf || cliente.cnpj || cliente.cpf_cnpj || cliente.cpf_cnpj_limpo);
    return {
      nome: cliente.nome || cliente.nome_completo || cliente.razao_social || '',
      cpf_cnpj: cpfCnpj || undefined,
      ie: cliente.inscricao_estadual || undefined,
      email: cliente.email || undefined,
      telefone: onlyDigits(cliente.telefone) || undefined,
      endereco: {
        logradouro: cliente.logradouro || cliente.endereco || '',
        numero: asText(cliente.numero || ''),
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        municipio: cliente.municipio || cliente.cidade || '',
        uf: cliente.uf || '',
        cep: onlyDigits(cliente.cep),
        codigo_cidade: cliente.codigo_municipio || cliente.codigo_municipio_ibge || undefined,
        pais: cliente.pais || 'Brasil',
      },
      indicador_ie_destinatario: cliente.indicador_ie_destinatario || 9,
    };
  }
  // Sem destinatário (consumidor final não identificado)
  return null;
}

export async function generateNfcePayloadPreview({ comandaId, codigoEmpresa }) {
  if (!comandaId) throw new Error('comandaId obrigatório');
  if (!codigoEmpresa) throw new Error('codigoEmpresa obrigatório');

  // Empresa (emitente)
  const { data: empresa, error: empErr } = await supabase
    .from('empresas')
    .select('*')
    .eq('codigo_empresa', codigoEmpresa)
    .single();
  if (empErr) throw empErr;

  // Comanda
  const { data: comanda, error: cErr } = await supabase
    .from('comandas')
    .select('*')
    .eq('codigo_empresa', codigoEmpresa)
    .eq('id', comandaId)
    .single();
  if (cErr) throw cErr;

  // Cliente (se houver)
  let cliente = null;
  if (comanda.cliente_id) {
    const { data: cli } = await supabase.from('clientes').select('*').eq('id', comanda.cliente_id).single();
    cliente = cli || null;
  } else {
    // tenta pegar primeiro cliente associado (desambiguando relacionamento)
    const { data: ccList } = await supabase
      .from('comanda_clientes')
      .select('clientes:clientes!comanda_clientes_cliente_id_fkey(*)')
      .eq('comanda_id', comanda.id)
      .limit(1);
    const cc = Array.isArray(ccList) && ccList.length ? ccList[0] : null;
    if (cc?.clientes) cliente = cc.clientes;
  }

  // Itens
  const { data: itens, error: iErr } = await supabase
    .from('comanda_itens')
    .select('*')
    .eq('comanda_id', comanda.id);
  if (iErr) throw iErr;

  // Produtos dos itens
  const produtoIds = Array.from(new Set(itens.map(i => i.produto_id).filter(Boolean)));
  let produtosMap = new Map();
  if (produtoIds.length) {
    const { data: prods } = await supabase
      .from('produtos')
      .select('*')
      .in('id', produtoIds);
    (prods || []).forEach(p => produtosMap.set(p.id, p));
  }

  // Pagamentos e finalizadoras
  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('comanda_id', comanda.id);

  const finIds = Array.from(new Set((pagamentos||[]).map(p => p.finalizadora_id).filter(Boolean)));
  let finalizadoras = [];
  if (finIds.length) {
    const { data: fins } = await supabase.from('finalizadoras').select('*').in('id', finIds);
    finalizadoras = fins || [];
  }

  // Totais
  const totalSemDesc = itens.reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0);
  const totalDesc = itens.reduce((acc, it) => acc + Number(it.desconto || 0), 0);
  const total = totalSemDesc - totalDesc;

  // Destinatário (opcional)
  const dest = pickDestinatarioFromComanda(comanda, cliente);

  // Monta Dados conforme doc "EnviarNfce"
  const dados = {
    tipo_operacao: 1,
    natureza_operacao: 'Venda de mercadoria',
    forma_pagamento: computeFormaPagamento(pagamentos),
    meio_pagamento: pickMeioPagamento(pagamentos, finalizadoras),
    data_emissao: new Date(comanda.fechado_em || comanda.updated_at || Date.now()).toLocaleDateString('pt-BR'),
    data_saida_entrada: new Date(comanda.fechado_em || Date.now()).toLocaleDateString('pt-BR'),
    hora_saida_entrada: new Date(comanda.fechado_em || Date.now()).toTimeString().slice(0,8),
    finalidade_emissao: 1,

    // Totais
    valor_frete: '0',
    valor_seguro: '0',
    valor_ipi: '0',
    valor_total: to2(total),
    valor_total_sem_desconto: to2(totalSemDesc),

    // Destinatário (se existir)
    ...(dest ? {
      nome_destinatario: dest.nome,
      cnpj_destinatario: dest.cpf_cnpj,
      inscricao_estadual_destinatario: dest.ie,
      email_destinatario: dest.email,
      telefone_destinatario: dest.telefone,
      logradouro_destinatario: dest.endereco.logradouro,
      numero_destinatario: dest.endereco.numero,
      complemento_destinatario: dest.endereco.complemento,
      bairro_destinatario: dest.endereco.bairro,
      municipio_destinatario: dest.endereco.municipio,
      codigo_cidade: dest.endereco.codigo_cidade,
      uf_destinatario: dest.endereco.uf,
      pais_destinatario: dest.endereco.pais,
      cep_destinatario: dest.endereco.cep,
      indicador_ie_destinatario: dest.indicador_ie_destinatario,
    } : {}),

    Itens: itens.map((it, idx) => {
      const p = produtosMap.get(it.produto_id) || {};
      const q = Number(it.quantidade || 0);
      const unit = Number(it.preco_unitario || 0);
      const vDesc = Number(it.desconto || 0);
      const vTotal = q * unit - vDesc;
      const cfop = p.cfop_interno || p.cfop || 5102;
      const ncm = (p.ncm || '').replace(/\D/g, '').slice(0,8) || '';
      const unidade = p.unidade || p.unit || 'UN';

      // Impostos básicos (ajuste conforme seu cadastro)
      const csosn = p.csosn_interno || p.csosn || null;
      const cstIcms = p.cst_icms_interno || p.cstIcmsInterno || null;
      const pisCst = p.cst_pis_saida || p.cstPisSaida || '07';
      const cofinsCst = p.cst_cofins_saida || p.cstCofinsSaida || '07';
      const icmsOrig = p.icms_origem ?? 0;

      const itemJson = {
        numero_item: idx + 1,
        codigo_produto: p.code || p.codigo || p.id,
        descricao: p.name || p.descricao || it.descricao || 'Item',
        cfop: Number(cfop),
        unidade_comercial: unidade,
        quantidade_comercial: q,
        valor_unitario_comercial: to2(unit),
        codigo_ncm: ncm,
        valor_desconto: vDesc ? to2(vDesc) : '',
        valor_frete: '',
        valor_seguro: '',
        valor_outras_despesas: '',
        valor_total: to2(vTotal),
        valor_total_sem_desconto: to2(q * unit),

        icms_csosn: csosn ? Number(csosn) : undefined,
        icms_orig: Number(icmsOrig) || 0,
        pis_situacao_tributaria: pisCst,
        base_calculo_pis: '',
        aliquota_pis: '',
        valor_pis: '',
        cofins_situacao_tributaria: cofinsCst,
        base_calculo_cofins: '',
        aliquota_cofins: '',
        valor_cofins: '',
      };

      return itemJson;
    }),
  };

  // Checklist do que pode faltar
  const missing = [];
  if (!empresa?.inscricao_estadual) missing.push('Inscrição Estadual (empresa)');
  if (!empresa?.regime_tributario) missing.push('CRT/Regime Tributário (empresa)');
  if (!empresa?.cidade || !empresa?.uf) missing.push('Cidade/UF (empresa)');
  if (!empresa?.codigo_municipio_ibge) missing.push('Código IBGE do município (empresa)');
  if (!empresa?.nfce_serie) missing.push('NFC-e Série (empresa)');
  if (!empresa?.nfce_itoken && (empresa?.ambiente === 'producao')) missing.push('NFC-e IToken/CSC (produção)');
  if (!onlyDigits(empresa?.cnpj)) missing.push('CNPJ da empresa');

  itens.forEach((it) => {
    const p = produtosMap.get(it.produto_id) || {};
    if (!p.ncm) missing.push(`Produto ${p.name || p.id}: NCM`);
    if (!p.cfop_interno && !p.cfop) missing.push(`Produto ${p.name || p.id}: CFOP interno`);
  });

  const payload = {
    ApiKey: empresa?.transmitenota_apikey || '',
    Cnpj: onlyDigits(empresa?.cnpj),
    Dados: dados,
  };

  return { empresa, comanda, cliente, itens, pagamentos, finalizadoras, payload, missing };
}
