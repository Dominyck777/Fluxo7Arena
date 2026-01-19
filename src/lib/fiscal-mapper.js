import { supabase } from '@/lib/supabase';

function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }

// Helpers for manual forms
function parseDecBR(v){
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // remove mascara BR (1.234,56)
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',','.');
  else if (s.includes(',')) s = s.replace(',','.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function buildItensFromManual(form){
  const itens = Array.isArray(form?.itens) ? form.itens : [];
  return itens.map((it, idx) => {
    const q = parseDecBR(it.quantidade);
    const unit = parseDecBR(it.preco_unitario);
    const vDescPercent = parseDecBR(it.desconto_percent);
    const vDescValor = parseDecBR(it.desconto_valor);
    const acres = parseDecBR(it.acrescimos_valor);
    const frete = parseDecBR(it.frete_valor);
    const seguro = parseDecBR(it.seguro_valor);
    const bruto = q * unit;
    const vDesc = vDescPercent ? (bruto * vDescPercent / 100) : vDescValor;
    const vTotal = Math.max(0, bruto - vDesc + acres + frete + seguro);

    const imp = it.impostos || {};
    const ic = imp.icms || {};
    const pis = imp.pis || {};
    const cof = imp.cofins || {};
    const ipi = imp.ipi || {};

    const data = {
      numero_item: idx + 1,
      codigo_produto: it.codigo || (idx+1),
      descricao: it.descricao || `Item ${idx+1}`,
      cfop: Number(it.cfop || 5102),
      unidade_comercial: it.unidade || 'UN',
      quantidade_comercial: q,
      valor_unitario_comercial: to2(unit),
      codigo_ncm: onlyDigits(it.ncm).slice(0,8) || '',
      // CEST: enviado em operações com ST quando informado no formulário/produto
      cest: it.cest ? String(it.cest) : undefined,
      valor_desconto: vDesc ? to2(vDesc) : '',
      valor_frete: frete ? to2(frete) : '',
      valor_seguro: seguro ? to2(seguro) : '',
      valor_outras_despesas: acres ? to2(acres) : '',
      valor_total: to2(vTotal),
      valor_total_sem_desconto: to2(bruto),
      icms_orig: Number(imp.origem || 0),
    };
    if (ic.csosn) {
      data.icms_csosn = Number(ic.csosn);
    }
    if (ic.cst) {
      data.icms_cst = Number(ic.cst);
      const bc = vTotal;
      const aliqNum = parseDecBR(ic.aliquota || 0);
      if (bc > 0 && aliqNum >= 0) {
        data.icms_mod_base_calculo = 3; // valor da operação
        data.icms_base_calculo = to2(bc);
        data.icms_aliquota = to4(aliqNum / 100);
        data.icms_valor = to2(bc * aliqNum / 100);
      }
    }
    if (pis.cst) data.pis_situacao_tributaria = pis.cst;
    if (cof.cst) data.cofins_situacao_tributaria = cof.cst;
    if (pis.aliquota){
      const aliq = parseDecBR(pis.aliquota);
      data.base_calculo_pis = to2(vTotal);
      data.aliquota_pis = to4(aliq/100);
      data.valor_pis = to2(vTotal * aliq/100);
    }
    if (cof.aliquota){
      const aliq = parseDecBR(cof.aliquota);
      data.base_calculo_cofins = to2(vTotal);
      data.aliquota_cofins = to4(aliq/100);
      data.valor_cofins = to2(vTotal * aliq/100);
    }
    if (ipi.cst) {
      data.ipi_situacao_tributaria = ipi.cst;
      const aliqIpi = parseDecBR(ipi.aliquota);
      if (aliqIpi > 0) {
        data.base_calculo_ipi = to2(vTotal);
        data.aliquota_ipi = to4(aliqIpi / 100);
        data.valor_ipi = to2(vTotal * aliqIpi / 100);
      }
    }
    return data;
  });
}

export function generateNfcePayloadFromManual({ form, finalizadoras = [] }){
  const itens = buildItensFromManual(form);
  const soma = itens.reduce((s,i)=> s + Number(i.valor_total || 0), 0);
  const vFrete = parseDecBR(form?.totais?.frete);
  const vOutras = parseDecBR(form?.totais?.outras_despesas);
  const vDescGeral = parseDecBR(form?.totais?.desconto_geral);
  const valor_total = soma - vDescGeral + vFrete + vOutras;

  // Pagamentos
  const pagamentos = Array.isArray(form?.pagamentos) ? form.pagamentos : [];
  const totalPago = pagamentos.reduce((s,p)=> s + parseDecBR(p.valor), 0);
  const valor_troco = Math.max(0, totalPago - valor_total);

  // Meio de pagamento: usar primeira finalizadora (ou 90 sem pagamento)
  const meio_pagamento = (()=>{
    if (!pagamentos.length) return '90';
    const p = pagamentos[0];
    const fin = finalizadoras.find(f => String(f.id) === String(p.finalizadora_id));
    return fin?.codigo_sefaz || '99';
  })();

  return {
    tipo_operacao: form?.tipo_nota === 'entrada' ? 0 : 1,
    natureza_operacao: form?.natOp || 'Venda de mercadoria',
    forma_pagamento: 0,
    meio_pagamento,
    data_emissao: form?.data_emissao ? new Date(form.data_emissao+'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    data_saida_entrada: form?.data_saida ? new Date(form.data_saida+'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    hora_saida_entrada: new Date().toTimeString().slice(0,8),
    finalidade_emissao: Number(form?.finNFe || 1),
    modalidade_frete: form?.transporte?.tipo_frete || '9',

    valor_frete: vFrete ? to2(vFrete) : '0',
    valor_seguro: '0',
    valor_ipi: '0',
    valor_total: to2(valor_total),
    valor_total_sem_desconto: to2(soma),
    valor_troco: valor_troco ? to2(valor_troco) : '',

    // Destinatário (opcional na NFC-e)
    ...(form?.cpf_cnpj ? {
      nome_destinatario: form?.nome || '',
      cnpj_destinatario: onlyDigits(form?.cpf_cnpj),
      inscricao_estadual_destinatario: form?.ie_isento ? 'ISENTO' : (form?.inscricao_estadual || ''),
      email_destinatario: form?.email || '',
      telefone_destinatario: onlyDigits(form?.telefone || ''),
      logradouro_destinatario: form?.logradouro || '',
      numero_destinatario: form?.numero || '',
      complemento_destinatario: '',
      bairro_destinatario: form?.bairro || '',
      municipio_destinatario: form?.cidade || '',
      codigo_cidade: form?.codigo_municipio_ibge || '',
      uf_destinatario: form?.uf || '',
      pais_destinatario: 1058,
      cep_destinatario: onlyDigits(form?.cep || ''),
      indicador_ie_destinatario: Number(form?.indIEDest || 9),
    } : {}),

    Itens: [ itens ],
  };
}

export function generateNfePayloadFromManual({ form }){
  const itens = buildItensFromManual(form);
  const soma = itens.reduce((s,i)=> s + Number(i.valor_total || 0), 0);
  const vFrete = parseDecBR(form?.totais?.frete);
  const vOutras = parseDecBR(form?.totais?.outras_despesas);
  const vDescGeral = parseDecBR(form?.totais?.desconto_geral);
  const valor_total = soma - vDescGeral + vFrete + vOutras;

  return {
    tipo_operacao: form?.tipo_nota === 'entrada' ? 0 : 1,
    natureza_operacao: form?.natOp || 'Venda de mercadoria',
    forma_pagamento: 0,
    meio_pagamento: '01',
    data_emissao: form?.data_emissao ? new Date(form.data_emissao+'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    data_saida_entrada: form?.data_saida ? new Date(form.data_saida+'T00:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    hora_saida_entrada: new Date().toTimeString().slice(0,8),
    finalidade_emissao: Number(form?.finNFe || 1),
    modalidade_frete: Number(form?.transporte?.tipo_frete ?? 9),

    valor_frete: to2(vFrete || 0),
    valor_seguro: to2(0),
    valor_ipi: to2(0),
    valor_total: to2(valor_total),
    valor_total_sem_desconto: to2(soma),

    // Totais ICMS em nível de documento (exemplo do provedor)
    icms_base_calculo: '0',
    icms_valor_total: '0',
    icms_base_calculo_st: '0',
    icms_valor_total_st: '0',
    icms_modalidade_base_calculo: 0,
    icms_valor: '0',

    informacoes_adicionais_contribuinte: (form?.adicionais?.obs_gerais || ''),
    nome_transportadora: form?.transporte?.transportadora || '',
    cnpj_transportadora: '',
    endereco_transportadora: '',
    municipio_transportadora: '',
    uf_transportadora: '',
    inscricao_estadual_transportadora: '',

    // Destinatário obrigatório na NF-e
    nome_destinatario: form?.nome || '',
    cnpj_destinatario: onlyDigits(form?.cpf_cnpj || ''),
    inscricao_estadual_destinatario: form?.ie_isento ? 'ISENTO' : (form?.inscricao_estadual || ''),
    email_destinatario: form?.email || '',
    telefone_destinatario: onlyDigits(form?.telefone || ''),
    logradouro_destinatario: form?.logradouro || '',
    numero_destinatario: form?.numero || '',
    complemento_destinatario: '',
    bairro_destinatario: form?.bairro || '',
    municipio_destinatario: form?.cidade || '',
    uf_destinatario: form?.uf || '',
    pais_destinatario: 'Brasil',
    cep_destinatario: onlyDigits(form?.cep || ''),
    indicador_ie_destinatario: Number(form?.indIEDest ?? 1),

    // Itens em array simples; o front decide se precisa envelopar em [[...]]
    Itens: itens,
  };
}

function to2(n) { const x = Number(n ?? 0); return Number.isFinite(x) ? x.toFixed(2) : '0.00'; }
function to4(n) { const x = Number(n ?? 0); return Number.isFinite(x) ? x.toFixed(4) : '0.0000'; }
function asText(v) { return v == null ? '' : String(v); }

// Distribui o desconto geral entre os itens proporcionalmente ao valor_total de cada item
function distributeGlobalDiscount(itens, descontoGeral){
  const d = Number(descontoGeral || 0);
  if (!Array.isArray(itens) || itens.length === 0 || d <= 0) return itens;
  const totals = itens.map(i => Number(i.valor_total || 0));
  const base = totals.reduce((s,v)=> s + (Number.isFinite(v) ? v : 0), 0);
  if (!(base > 0)) return itens;
  const rawShares = totals.map(v => (d * (v / base)));
  const rounded = rawShares.map(x => Number(to2(x)));
  let sumRounded = rounded.reduce((s,v)=> s + v, 0);
  let diff = Number(to2(d - sumRounded));
  if (Math.abs(diff) >= 0.01) {
    // Ajusta diferença no último item
    const lastIdx = itens.length - 1;
    rounded[lastIdx] = Number(to2(rounded[lastIdx] + diff));
    sumRounded = rounded.reduce((s,v)=> s + v, 0);
    diff = Number(to2(d - sumRounded));
  }
  return itens.map((it, idx) => {
    const addDesc = rounded[idx] || 0;
    const prevDesc = Number(it.valor_desconto || 0) || 0;
    const prevTotal = Number(it.valor_total || 0) || 0;
    const nextDesc = Math.max(0, prevDesc + addDesc);
    const nextTotal = Math.max(0, prevTotal - addDesc);
    return {
      ...it,
      valor_desconto: nextDesc ? to2(nextDesc) : '',
      valor_total: to2(nextTotal),
    };
  });
}

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

  // Totais baseados apenas em descontos de item
  const totalSemDesc = itens.reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0);
  const totalDescItens = itens.reduce((acc, it) => acc + Number(it.desconto || 0), 0);

  // Desconto de comanda (se existir) calculado sobre a base já com desconto de item
  const baseComanda = Math.max(0, totalSemDesc - totalDescItens);
  let descontoComanda = 0;
  if (comanda?.desconto_tipo === 'percentual' && Number(comanda?.desconto_valor || 0) > 0) {
    descontoComanda = baseComanda * (Number(comanda.desconto_valor) / 100);
  } else if (comanda?.desconto_tipo === 'fixo' && Number(comanda?.desconto_valor || 0) > 0) {
    descontoComanda = Number(comanda.desconto_valor);
  }

  const totalAposDescontos = Math.max(0, baseComanda - descontoComanda);

  // Destinatário (opcional). Para NFC-e, só enviaremos destinatário se houver CPF/CNPJ,
  // para evitar gerar <dest> inválido no XML (consumidor não identificado não deve ter dest).
  const dest = pickDestinatarioFromComanda(comanda, cliente);
  const hasDestDoc = !!(dest && dest.cpf_cnpj);

  // Monta Dados conforme doc "EnviarNfce"
  // Monta itens fiscais e, em seguida, aplica desconto global de comanda (se houver)
  let itensFiscais = itens.map((it, idx) => {
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
  });

  if (descontoComanda > 0.0005) {
    itensFiscais = distributeGlobalDiscount(itensFiscais, descontoComanda);
  }

  const totalFiscal = itensFiscais.reduce((acc, it) => acc + Number(it.valor_total || 0), 0);

  const dados = {
    tipo_operacao: 1,
    natureza_operacao: 'Venda de mercadoria',
    forma_pagamento: computeFormaPagamento(pagamentos),
    meio_pagamento: pickMeioPagamento(pagamentos, finalizadoras),
    data_emissao: new Date(comanda.fechado_em || comanda.updated_at || Date.now()).toLocaleDateString('pt-BR'),
    data_saida_entrada: new Date(comanda.fechado_em || Date.now()).toLocaleDateString('pt-BR'),
    hora_saida_entrada: new Date(comanda.fechado_em || Date.now()).toTimeString().slice(0,8),
    finalidade_emissao: 1,
    modalidade_frete: '9',

    // Totais
    valor_frete: '0',
    valor_seguro: '0',
    valor_ipi: '0',
    valor_total: to2(totalFiscal),
    valor_total_sem_desconto: to2(totalSemDesc),

    // Destinatário (apenas se houver CPF/CNPJ)
    ...(hasDestDoc ? {
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

    Itens: itensFiscais.map(it => [it]),
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
    const ncmDigits = onlyDigits(p.ncm || '').slice(0,8);
    if (!ncmDigits || /^0+$/.test(ncmDigits)) missing.push(`Produto ${p.name || p.id}: NCM válido`);
    if (!p.cfop_interno && !p.cfop) missing.push(`Produto ${p.name || p.id}: CFOP interno`);
    const csosn = p.csosn_interno || p.csosn;
    if (!csosn) missing.push(`Produto ${p.name || p.id}: CSOSN (icms_csosn)`);
  });

  const payload = {
    ApiKey: empresa?.transmitenota_apikey || '',
    Cnpj: onlyDigits(empresa?.cnpj),
    Dados: dados,
  };

  return { empresa, comanda, cliente, itens, pagamentos, finalizadoras, payload, missing };
}
