import React from 'react';
import { X, FileText, User, Calendar, Package, DollarSign, Truck, CreditCard, Sparkles, Edit, RefreshCw, Download, Trash2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { parseNFeXML } from '@/lib/xmlParser';

export default function PurchaseDetailsModal({ purchase, items, onClose, onEdit, onReprocess, onDownloadXML, onInactivate }) {
  if (!purchase) return null;

  const totalProdutos = items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
  
  // Verificar se o produto é novo (importado nos últimos 7 dias)
  const isProductNew = (produto) => {
    if (!produto?.data_importacao) return false;
    const daysSinceImport = differenceInDays(new Date(), new Date(produto.data_importacao));
    return daysSinceImport <= 7;
  };

  const showDanfe = false;

  const handleOpenDanfe = () => {
    if (typeof window === 'undefined') return;

    const danfeWindow = window.open('', '_blank');
    if (!danfeWindow) return;

    const emissionDate = purchase.data_emissao
      ? format(new Date(purchase.data_emissao), 'dd/MM/yyyy', { locale: ptBR })
      : 'Não informada';

    // Valores padrão baseados na compra (fallback caso o XML não esteja disponível ou falhe)
    let operationTypeCode = purchase.tipo_operacao === 'Saída' || purchase.tipo_operacao === '1 - Saída' ? '1 - SAÍDA' : '0 - ENTRADA';
    let naturezaOperacao = purchase.natureza_operacao || '';

    // Emitente (fornecedor / XML emit)
    let emitRazaoSocial = purchase.fornecedor?.nome || '';
    let emitCnpj = purchase.fornecedor?.cnpj || '';
    let emitIe = '';
    let emitEnderecoLinha1 = '';
    let emitEnderecoLinha2 = '';

    // Destinatário (empresa do usuário / XML dest)
    let destRazaoSocial = 'Destinatário não identificado';
    let destCnpjCpf = '';
    let destIe = '';
    let destEndereco = '';
    let destBairro = '';
    let destMunicipio = '';
    let destUf = '';
    let destCep = '';

    // Protocolo de autorização
    let protocoloNumero = '';
    let protocoloDataHora = '';

    const escapeHtml = (value) => {
      const str = String(value ?? '');
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    // Enriquecer dados usando o XML completo (quando disponível)
    if (purchase.xml_completo) {
      try {
        const parsed = parseNFeXML(purchase.xml_completo);
        if (parsed?.success && parsed.data) {
          const { fornecedor, nfe } = parsed.data;

          if (nfe) {
            if (nfe.dataEmissao) {
              // dataEmissao vem em ISO, usar para sobrescrever emissão da DANFE
              try {
                const d = new Date(nfe.dataEmissao);
                if (!Number.isNaN(d.getTime())) {
                  emissionDate = format(d, 'dd/MM/yyyy', { locale: ptBR });
                }
              } catch {
                // mantém emissionDate calculada pela purchase
              }
            }
            if (nfe.tipo) {
              operationTypeCode = nfe.tipo === 'Saída' ? '1 - SAÍDA' : '0 - ENTRADA';
            }
            if (nfe.naturezaOperacao) {
              naturezaOperacao = nfe.naturezaOperacao;
            }
          }

          if (fornecedor) {
            emitRazaoSocial = fornecedor.razaoSocial || emitRazaoSocial;
            emitCnpj = fornecedor.cnpj || emitCnpj;
            if (fornecedor.endereco) {
              const { logradouro, numero, bairro, cidade, uf, cep } = fornecedor.endereco;
              emitEnderecoLinha1 = [logradouro, numero].filter(Boolean).join(', ');
              emitEnderecoLinha2 = [bairro, cidade, uf].filter(Boolean).join(' - ');
              if (cep) {
                emitEnderecoLinha2 = emitEnderecoLinha2
                  ? `${emitEnderecoLinha2} CEP ${cep}`
                  : `CEP ${cep}`;
              }
            }
          }
        }

        // DOMParser para dados que o parser atual não expõe (destinatário, IE, protocolo)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(purchase.xml_completo, 'text/xml');

        const emit = xmlDoc.querySelector('emit');
        if (emit) {
          const ieEl = emit.querySelector('IE');
          if (ieEl) emitIe = ieEl.textContent.trim();
        }

        const dest = xmlDoc.querySelector('dest');
        if (dest) {
          const xNome = dest.querySelector('xNome');
          const cnpjEl = dest.querySelector('CNPJ');
          const cpfEl = dest.querySelector('CPF');
          const ieDest = dest.querySelector('IE');
          const enderDest = dest.querySelector('enderDest');

          if (xNome) destRazaoSocial = xNome.textContent.trim();
          if (cnpjEl) destCnpjCpf = cnpjEl.textContent.trim();
          else if (cpfEl) destCnpjCpf = cpfEl.textContent.trim();
          if (ieDest) destIe = ieDest.textContent.trim();

          if (enderDest) {
            const xLgr = enderDest.querySelector('xLgr');
            const nro = enderDest.querySelector('nro');
            const xBairro = enderDest.querySelector('xBairro');
            const xMun = enderDest.querySelector('xMun');
            const uf = enderDest.querySelector('UF');
            const cep = enderDest.querySelector('CEP');

            destEndereco = [xLgr?.textContent.trim(), nro?.textContent.trim()]
              .filter(Boolean)
              .join(', ');
            destBairro = xBairro?.textContent.trim() || '';
            destMunicipio = xMun?.textContent.trim() || '';
            destUf = uf?.textContent.trim() || '';
            destCep = cep?.textContent.trim() || '';
          }
        }

        const infProt = xmlDoc.querySelector('protNFe infProt');
        if (infProt) {
          const nProt = infProt.querySelector('nProt');
          const dhRecbto = infProt.querySelector('dhRecbto');
          if (nProt) protocoloNumero = nProt.textContent.trim();
          if (dhRecbto) {
            try {
              const dProt = new Date(dhRecbto.textContent.trim());
              if (!Number.isNaN(dProt.getTime())) {
                protocoloDataHora = format(dProt, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR });
              }
            } catch {
              protocoloDataHora = dhRecbto.textContent.trim();
            }
          }
        }
      } catch (error) {
        console.error('[DANFE] Erro ao interpretar XML completo da compra:', error);
      }
    }

    // Totais por imposto a partir dos itens (quando disponíveis)
    let baseICMS = 0;
    let valorICMS = 0;
    let baseICMSST = 0;
    let valorICMSST = 0;
    let valorIPI = 0;
    let valorPIS = 0;
    let valorCOFINS = 0;
    let valorFrete = 0;
    let valorSeguro = 0;
    let valorDesconto = 0;
    let valorOutrasDespesas = 0;

    items.forEach((item) => {
      const vTotal = Number(item.valor_total || 0);
      const icmsValor = Number(item.icms_valor || 0);
      const icmsAliquota = Number(item.icms_aliquota || 0);
      const ipiValor = Number(item.ipi_valor || 0);
      const pisValor = Number(item.pis_valor || 0);
      const cofinsValor = Number(item.cofins_valor || 0);

      // Como não temos base separada na tabela, usamos valor_total como aproximação da base
      if (icmsValor > 0 || icmsAliquota > 0) {
        baseICMS += vTotal;
        valorICMS += icmsValor;
      }

      valorIPI += ipiValor;
      valorPIS += pisValor;
      valorCOFINS += cofinsValor;

      valorFrete += Number(item.valor_frete || item.valorFrete || 0);
      valorSeguro += Number(item.valor_seguro || item.valorSeguro || 0);
      valorDesconto += Number(item.valor_desconto || item.valorDesconto || 0);
      valorOutrasDespesas += Number(item.valor_outras_despesas || item.valorOutrasDespesas || 0);
    });

    const rows = items
      .map((item) => {
        const codigo = item.produto?.codigo_produto || item.codigo_produto_xml || '';
        const descricao = item.produto?.nome || item.nome_produto_xml || '';
        const ncm = item.ncm_xml || '';
        const cfop = item.cfop_xml || '';
        const unidade = item.unidade_xml || '';
        const quantidade = Number(item.quantidade || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        });
        const valorUnitario = Number(item.valor_unitario || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const valorTotal = Number(item.valor_total || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const baseCalcICMS = Number(item.valor_total || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const valorICMSItem = Number(item.icms_valor || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const valorIPIItem = Number(item.ipi_valor || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const aliqICMS = item.icms_aliquota != null ? Number(item.icms_aliquota).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) : '';
        const aliqIPI = item.ipi_aliquota != null ? Number(item.ipi_aliquota).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) : '';

        return `
        <tr>
          <td class="td-left">${escapeHtml(codigo)}</td>
          <td class="td-left">${escapeHtml(descricao)}</td>
          <td class="td-left">${escapeHtml(ncm)}</td>
          <td class="td-left">${escapeHtml(cfop)}</td>
          <td class="td-left">${escapeHtml(unidade)}</td>
          <td class="td-right">${escapeHtml(quantidade)}</td>
          <td class="td-right">${escapeHtml(valorUnitario)}</td>
          <td class="td-right">${escapeHtml(valorTotal)}</td>
          <td class="td-right">${escapeHtml(baseCalcICMS)}</td>
          <td class="td-right">${escapeHtml(valorICMSItem)}</td>
          <td class="td-right">${escapeHtml(valorIPIItem)}</td>
          <td class="td-right">${escapeHtml(aliqICMS)}</td>
          <td class="td-right">${escapeHtml(aliqIPI)}</td>
        </tr>
      `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>DANFE - NF-e ${escapeHtml(purchase.numero_nfe || '')}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 16px; background: #ffffff; color: #000000; }
    .container { max-width: 980px; margin: 0 auto; border: 1px solid #000000; padding: 10px; font-size: 11px; }
    .row { display: flex; flex-wrap: nowrap; }
    .col { flex: 1; min-width: 0; }
    .header-main { border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
    .title { font-size: 13px; font-weight: 700; }
    .subtitle { font-size: 10px; }
    .receipt-box { border: 1px solid #000; padding: 4px; margin-bottom: 4px; font-size: 9px; }
    .section { border: 1px solid #000000; margin-bottom: 4px; }
    .section-title { border-bottom: 1px solid #000000; padding: 2px 4px; font-size: 9px; font-weight: 600; }
    .section-body { padding: 4px; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 3px; }
    th { border-bottom: 1px solid #000000; font-size: 9px; text-align: left; }
    .td-right { text-align: right; }
    .td-left { text-align: left; }
    .totals { border: 1px solid #000000; margin-top: 4px; font-size: 9px; }
    .totals-row { display: flex; justify-content: space-between; padding: 2px 6px; }
    .totals-row + .totals-row { border-top: 1px solid #000000; }
    .access-key { font-family: monospace; font-size: 10px; word-break: break-all; }
    .label { font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-main row" style="margin-bottom:4px;">
      <div class="col" style="font-size:9px;">
        <div class="receipt-box">
          <div>RECEBEMOS DE ${escapeHtml(emitRazaoSocial)} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO.</div>
          <div>EMISSÃO: ${escapeHtml(emissionDate)} - VALOR TOTAL: R$ ${Number(purchase.valor_total || 0).toFixed(2)}</div>
          <div>DESTINATÁRIO: ${escapeHtml(destRazaoSocial)}</div>
          <div style="margin-top:8px;">DATA DE RECEBIMENTO ______________________ IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
        </div>
      </div>
    </div>

    <div class="row" style="margin-bottom:4px;">
      <div class="col" style="border:1px solid #000;padding:4px;font-size:9px;">
        <div class="title">DANFE</div>
        <div class="subtitle">Documento Auxiliar da Nota Fiscal Eletrônica</div>
        <div style="margin-top:4px;">${operationTypeCode}</div>
        <div style="margin-top:4px;">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora</div>
      </div>
      <div class="col" style="border-top:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;">
        <div><span class="label">NF-e Nº.</span> ${escapeHtml(purchase.numero_nfe || '')}</div>
        <div><span class="label">Série</span> ${escapeHtml(purchase.serie_nfe || '')}</div>
        ${purchase.chave_nfe ? `<div style="margin-top:4px;"><span class="label">CHAVE DE ACESSO</span><br/><span class="access-key">${escapeHtml(purchase.chave_nfe)}</span></div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">IDENTIFICAÇÃO DO EMITENTE</div>
      <div class="section-body">
        <div><span class="label">NOME / RAZÃO SOCIAL</span> ${escapeHtml(emitRazaoSocial || 'Fornecedor não identificado')}</div>
        ${emitCnpj ? `<div><span class="label">CNPJ</span> ${escapeHtml(emitCnpj)}</div>` : ''}
        ${emitIe ? `<div><span class="label">INSCRIÇÃO ESTADUAL</span> ${escapeHtml(emitIe)}</div>` : ''}
        ${(emitEnderecoLinha1 || emitEnderecoLinha2) ? `<div><span class="label">ENDEREÇO</span> ${escapeHtml([emitEnderecoLinha1, emitEnderecoLinha2].filter(Boolean).join(' - '))}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">DESTINATÁRIO / REMETENTE</div>
      <div class="section-body">
        <div><span class="label">NOME / RAZÃO SOCIAL</span> ${escapeHtml(destRazaoSocial)}</div>
        ${destCnpjCpf ? `<div><span class="label">CNPJ / CPF</span> ${escapeHtml(destCnpjCpf)}</div>` : ''}
        ${destIe ? `<div><span class="label">INSCRIÇÃO ESTADUAL</span> ${escapeHtml(destIe)}</div>` : ''}
        <div><span class="label">DATA DA EMISSÃO</span> ${escapeHtml(emissionDate)}</div>
        ${(destEndereco || destBairro || destMunicipio || destUf || destCep) ? `<div><span class="label">ENDEREÇO</span> ${escapeHtml(destEndereco)}</div>` : ''}
        ${(destBairro || destMunicipio || destUf || destCep) ? `<div><span class="label">BAIRRO / MUNICÍPIO / UF / CEP</span> ${escapeHtml([destBairro, destMunicipio, destUf, destCep].filter(Boolean).join(' - '))}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">CÁLCULO DO IMPOSTO</div>
      <div class="section-body">
        <div class="row">
          <div class="col">
            <div><span class="label">BASE DE CÁLCULO DO ICMS</span> ${baseICMS.toFixed(2)}</div>
            <div><span class="label">VALOR DO ICMS</span> ${valorICMS.toFixed(2)}</div>
            <div><span class="label">BASE DE CÁLC. ICMS S.T.</span> ${baseICMSST.toFixed(2)}</div>
            <div><span class="label">VALOR DO ICMS SUBST.</span> ${valorICMSST.toFixed(2)}</div>
          </div>
          <div class="col">
            <div><span class="label">VALOR IMP. IMPORTAÇÃO</span> 0,00</div>
            <div><span class="label">VALOR DO PIS</span> ${valorPIS.toFixed(2)}</div>
            <div><span class="label">VALOR DA COFINS</span> ${valorCOFINS.toFixed(2)}</div>
          </div>
          <div class="col">
            <div><span class="label">VALOR TOTAL DOS PRODUTOS</span> ${Number(totalProdutos || 0).toFixed(2)}</div>
            <div><span class="label">VALOR DO FRETE</span> ${valorFrete.toFixed(2)}</div>
            <div><span class="label">VALOR DO SEGURO</span> ${valorSeguro.toFixed(2)}</div>
            <div><span class="label">DESCONTO</span> ${valorDesconto.toFixed(2)}</div>
            <div><span class="label">OUTRAS DESPESAS</span> ${valorOutrasDespesas.toFixed(2)}</div>
            <div><span class="label">VALOR TOTAL DO IPI</span> ${valorIPI.toFixed(2)}</div>
            <div><span class="label">VALOR TOTAL DA NOTA</span> ${Number(purchase.valor_total || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
      <div class="section-body">
        <div><span class="label">NOME / RAZÃO SOCIAL</span> ________________________________</div>
        <div><span class="label">FRETE POR CONTA</span> 0 - Por conta do Remetente</div>
        <div><span class="label">QUANTIDADE</span> 1 <span class="label">ESPÉCIE</span> Volumes</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DADOS ADICIONAIS</div>
      <div class="section-body">
        <div><span class="label">INFORMAÇÕES COMPLEMENTARES</span></div>
        <div>${escapeHtml(purchase.observacoes || '')}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
      <div class="section-body">
        <table>
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
              <th>NCM/SH</th>
              <th>CFOP</th>
              <th>UN.</th>
              <th class="td-right">QUANT.</th>
              <th class="td-right">VALOR UNIT.</th>
              <th class="td-right">VALOR TOTAL</th>
              <th class="td-right">B. CÁLC. ICMS</th>
              <th class="td-right">VALOR ICMS</th>
              <th class="td-right">VALOR IPI</th>
              <th class="td-right">ALÍQ. ICMS</th>
              <th class="td-right">ALÍQ. IPI</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>

  </div>
</body>
</html>`;

    danfeWindow.document.open();
    danfeWindow.document.write(html);
    danfeWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col">
        {/* Header Simples */}
        <div className="relative bg-surface border-b border-border p-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-text-muted" />
          </button>
          
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand/10 rounded-lg">
                <FileText className="h-5 w-5 text-brand" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-0.5">
                  NF-e {purchase.numero_nfe}
                  {purchase.serie_nfe && ` / Série ${purchase.serie_nfe}`}
                </h2>
                <p className="text-text-muted text-xs">
                  {purchase.natureza_operacao || 'Nota Fiscal Eletrônica'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-text-muted text-xs mb-0.5">Valor Total</p>
              <p className="text-2xl font-bold text-success">
                R$ {Number(purchase.valor_total || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <>
              {/* Informações Gerais */}
              <div className="bg-surface-2 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3">
                  {/* Fornecedor em linha ampla */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-brand" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-muted mb-0.5">Fornecedor</p>
                      <p className="font-semibold text-base text-text-primary leading-snug break-words">
                        {purchase.fornecedor?.nome || 'Não identificado'}
                      </p>
                      {purchase.fornecedor?.cnpj && (
                        <p className="text-xs text-text-muted mt-0.5">
                          CNPJ: {purchase.fornecedor.cnpj}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Demais informações em grid compacto */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-3.5 w-3.5 text-info" />
                        <span className="text-xs font-medium text-text-muted">Emissão</span>
                      </div>
                      <p className="font-semibold text-text-primary">
                        {purchase.data_emissao
                          ? format(new Date(purchase.data_emissao), "dd/MM/yyyy", { locale: ptBR })
                          : 'Não informada'}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className="h-3.5 w-3.5 text-warning" />
                        <span className="text-xs font-medium text-text-muted">Operação</span>
                      </div>
                      <p className="font-semibold text-text-primary">
                        {purchase.tipo_operacao || 'Entrada'}
                      </p>
                    </div>

                    {purchase.forma_pagamento && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="h-3.5 w-3.5 text-success" />
                          <span className="text-xs font-medium text-text-muted">Pagamento</span>
                        </div>
                        <p className="font-semibold text-text-primary">
                          {purchase.forma_pagamento}
                        </p>
                      </div>
                    )}

                    {/* Resumo financeiro da NF-e no cabeçalho */}
                    <div>
                      <p className="text-xs font-medium text-text-muted mb-1">Valor dos Produtos</p>
                      <p className="font-semibold text-text-primary">
                        R$ {totalProdutos.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-text-muted mb-1">Valor Total NF-e</p>
                      <p className="font-semibold text-brand">
                        R$ {Number(purchase.valor_total || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Produtos */}
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-brand" />
                  Produtos da NF-e
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium ml-2">
                    {items.length}
                  </span>
                </h3>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-surface-2 rounded-lg border border-border hover:border-brand/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Info do Produto */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              {item.produto?.nome ? (
                                <>
                                  <p className="font-medium text-base text-text-primary mb-0.5">
                                    Produto atual: {item.produto.nome}
                                  </p>
                                  {item.nome_produto_xml && (
                                    <p className="text-xs text-text-muted mb-1">
                                      XML original: <span className="font-medium text-text-primary">{item.nome_produto_xml}</span>
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="font-medium text-sm text-text-primary mb-1">
                                  {item.nome_produto_xml}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted mb-1.5">
                                {(item.produto?.codigo_produto || item.codigo_produto_xml) && (
                                  <span>
                                    <span className="font-medium">Cód:</span> {item.produto?.codigo_produto || item.codigo_produto_xml}
                                  </span>
                                )}
                                {item.ean_xml && item.ean_xml !== 'SEM GTIN' && (
                                  <span>
                                    <span className="font-medium">EAN:</span> {item.ean_xml}
                                  </span>
                                )}
                                {item.ncm_xml && (
                                  <span>
                                    <span className="font-medium">NCM:</span> {item.ncm_xml}
                                  </span>
                                )}
                                {item.unidade_xml && (
                                  <span>
                                    <span className="font-medium">Un:</span> {item.unidade_xml}
                                  </span>
                                )}

                                {/* Status do produto na mesma linha dos códigos */}
                                {item.produto && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">
                                    ✓ Cadastrado
                                  </span>
                                )}
                                {item.produto && isProductNew(item.produto) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand/20 text-brand font-medium">
                                    <Sparkles className="h-3 w-3" />
                                    Novo
                                  </span>
                                )}
                                {item.vinculado_manualmente && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
                                    🔗 Vinculado
                                  </span>
                                )}
                                {!item.produto && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-text-muted/20 text-text-muted font-medium">
                                    ⊘ Não importado
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Valores */}
                        <div className="flex-shrink-0 text-right">
                          <div className="mb-1.5">
                            <span className="text-xs text-text-muted mr-1">Qtd:</span>
                            <span className="font-bold text-base text-warning">{item.quantidade}</span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-text-muted">
                              Unit: <span className="font-semibold text-success">R$ {Number(item.valor_unitario || 0).toFixed(2)}</span>
                            </p>
                            <p className="text-sm font-bold text-text-primary">
                              Total: R$ {Number(item.valor_total || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chave de Acesso */}
              {purchase.chave_nfe && (
                <div className="p-3 bg-surface-2 rounded-lg border border-border">
                  <p className="text-xs font-medium text-text-muted mb-1.5 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Chave de Acesso NF-e:
                  </p>
                  <p className="font-mono text-xs text-text-primary break-all leading-relaxed select-all">
                    {purchase.chave_nfe}
                  </p>
                </div>
              )}
            </>
          
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-2 border-t border-border flex justify-between">
          <div className="flex gap-2">
            {purchase.ativo && (
              <>
                <Button
                  onClick={() => onEdit?.(purchase)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  onClick={() => onReprocess?.(purchase)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={!purchase.xml_completo}
                >
                  <RefreshCw className="h-4 w-4" />
                  Reprocessar
                </Button>
                {purchase.xml_completo && (
                  <>
                    <Button
                      onClick={() => onDownloadXML?.(purchase)}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      XML
                    </Button>
                    <Button
                      onClick={handleOpenDanfe}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      DANFE
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => onInactivate?.(purchase)}
                  size="sm"
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Inativar
                </Button>
              </>
            )}
          </div>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
