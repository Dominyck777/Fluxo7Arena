import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ShoppingCart, Copy } from 'lucide-react';
import { parseNFeXML, findExistingProduct } from '@/lib/xmlParser';
import { listProducts } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function XMLSalesImportModal({ open, onOpenChange, codigoEmpresa, onSuccess }) {
  const { toast } = useToast();
  const [step, setStep] = useState('upload'); // upload | preview | processing | done
  const [xmlFile, setXmlFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState({ success: false, comandaId: null, error: null });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione um arquivo XML válido.', variant: 'destructive' });
      return;
    }

    setXmlFile(file);
    
    try {
      const text = await file.text();
      const parsed = parseNFeXML(text);
      
      if (!parsed.success) {
        toast({ title: 'Erro ao ler XML', description: parsed.error || 'XML inválido', variant: 'destructive' });
        return;
      }

      if (!parsed.produtos || parsed.produtos.length === 0) {
        toast({ title: 'Nenhum produto encontrado', description: 'O XML não contém produtos.', variant: 'warning' });
        return;
      }

      // Verificar se é NF-e de saída
      if (parsed.nfe?.tipo !== 'Saída') {
        toast({ 
          title: 'Tipo de nota incorreto', 
          description: 'Este XML é de entrada. Use a importação em Produtos para notas de entrada.', 
          variant: 'warning' 
        });
        return;
      }

      setParsedData(parsed);
      setStep('preview');
      
    } catch (error) {
      console.error('[XMLSalesImport] Erro ao processar arquivo:', error);
      toast({ title: 'Erro ao processar XML', description: error.message, variant: 'destructive' });
    }
  };

  const handleConfirmImport = async () => {
    setStep('processing');
    setProcessing(true);
    
    try {
      // Buscar todos os produtos do sistema
      const allProducts = await listProducts({ 
        searchTerm: '', 
        limit: 10000, 
        codigoEmpresa 
      });
      
      // 1. Criar comanda fechada
      const dataEmissao = parsedData.nfe?.dataEmissao ? new Date(parsedData.nfe.dataEmissao) : new Date();
      const chaveNFe = parsedData.nfe?.chaveAcesso || '';
      const { data: comanda, error: comandaError } = await supabase
        .from('comandas')
        .insert({
          codigo_empresa: codigoEmpresa,
          mesa_id: null, // Venda externa sem mesa
          status: 'closed',
          aberto_em: dataEmissao.toISOString(),
          fechado_em: dataEmissao.toISOString(),
          observacao: `Importado de XML - NF-e ${parsedData.nfe?.numero || ''}${chaveNFe ? `\nChave: ${chaveNFe}` : ''}`,
          origem: 'xml',
          xml_chave: chaveNFe || null
        })
        .select()
        .single();
      
      if (comandaError) throw comandaError;
      
      // 2. Adicionar itens da nota
      const itensParaInserir = [];
      const produtosNaoEncontrados = [];
      
      for (const produtoXML of parsedData.produtos) {
        // Buscar produto existente
        const produtoExistente = findExistingProduct(produtoXML, allProducts);
        
        if (produtoExistente) {
          itensParaInserir.push({
            comanda_id: comanda.id,
            produto_id: produtoExistente.id,
            descricao: produtoXML.nome,
            quantidade: produtoXML.quantidade,
            preco_unitario: produtoXML.valorUnitario,
            desconto: produtoXML.desconto || 0,
            codigo_empresa: codigoEmpresa
          });
          
          // Subtrair estoque
          const novoEstoque = Math.max(0, (produtoExistente.stock || produtoExistente.estoque || 0) - produtoXML.quantidade);
          await supabase
            .from('produtos')
            .update({ estoque: novoEstoque })
            .eq('id', produtoExistente.id)
            .eq('codigo_empresa', codigoEmpresa);
        } else {
          produtosNaoEncontrados.push(produtoXML.nome);
        }
      }
      
      if (itensParaInserir.length > 0) {
        const { error: itensError } = await supabase
          .from('comanda_itens')
          .insert(itensParaInserir);
        
        if (itensError) throw itensError;
      }
      
      // 3. Registrar pagamentos do XML
      const pagamentosXML = parsedData.pagamentos || [];
      
      if (pagamentosXML.length > 0) {
        // Buscar finalizadoras para mapear código SEFAZ
        const { data: finalizadoras } = await supabase
          .from('finalizadoras')
          .select('id, codigo_sefaz, nome')
          .eq('codigo_empresa', codigoEmpresa)
          .eq('ativo', true);
        
        const finalizadorasPorCodigo = new Map(
          (finalizadoras || []).map(f => [f.codigo_sefaz, f])
        );
        
        const pagamentosParaInserir = pagamentosXML.map(pag => {
          const finalizadora = finalizadorasPorCodigo.get(pag.codigoSefaz);
          
          return {
            comanda_id: comanda.id,
            finalizadora_id: finalizadora?.id || null,
            metodo: pag.descricao.toLowerCase(),
            valor: pag.valor,
            status: 'Pago',
            recebido_em: dataEmissao.toISOString(),
            codigo_empresa: codigoEmpresa,
            origem: 'xml',
            xml_chave: chaveNFe || null
          };
        });
        
        const { error: pagamentoError } = await supabase
          .from('pagamentos')
          .insert(pagamentosParaInserir);
        
        if (pagamentoError) throw pagamentoError;
      } else {
        // Fallback: registrar como "outros" se XML não tiver pagamentos
        const totalVenda = parsedData.produtos.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
        
        const { error: pagamentoError } = await supabase
          .from('pagamentos')
          .insert({
            comanda_id: comanda.id,
            finalizadora_id: null,
            metodo: 'outros',
            valor: totalVenda,
            status: 'Pago',
            recebido_em: dataEmissao.toISOString(),
            codigo_empresa: codigoEmpresa,
            origem: 'xml',
            xml_chave: chaveNFe || null
          });
        
        if (pagamentoError) throw pagamentoError;
      }
      
      // Resultado
      console.log('[XMLSalesImport] Venda importada com sucesso. Comanda ID:', comanda.id);
      
      if (produtosNaoEncontrados.length > 0) {
        toast({ 
          title: 'Venda importada com avisos', 
          description: `${itensParaInserir.length} produto(s) registrado(s), ${produtosNaoEncontrados.length} não encontrado(s).`,
          variant: 'warning',
          duration: 5000
        });
      } else {
        toast({ 
          title: 'Venda importada com sucesso!', 
          description: `${itensParaInserir.length} produto(s) registrado(s). Total: R$ ${totalVenda.toFixed(2)}`,
          variant: 'success' 
        });
      }
      
      setResult({ 
        success: true, 
        comandaId: comanda.id, 
        error: null,
        produtosNaoEncontrados,
        totalItens: itensParaInserir.length,
        totalVenda,
        dataEmissao: dataEmissao.toISOString().slice(0, 10) // Data para ajustar filtro
      });
      setStep('done');
      
      // Chamar callback de sucesso
      if (onSuccess) onSuccess(dataEmissao.toISOString().slice(0, 10));
      
    } catch (error) {
      console.error('[XMLSalesImport] Erro ao importar:', error);
      setResult({ success: false, comandaId: null, error: error.message });
      setStep('done');
      toast({ title: 'Erro ao importar XML', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setXmlFile(null);
    setParsedData(null);
    setResult({ success: false, comandaId: null, error: null });
    onOpenChange(false);
  };

  const handleReset = () => {
    setStep('upload');
    setXmlFile(null);
    setParsedData(null);
  };

  const totalVenda = parsedData?.produtos?.reduce((acc, p) => acc + (p.valorTotal || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Importar XML de Venda (NF-e)</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione o arquivo XML da nota fiscal de saída'}
            {step === 'preview' && 'Revise os dados da venda que será importada'}
            {step === 'processing' && 'Processando venda...'}
            {step === 'done' && 'Importação finalizada'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-full max-w-md">
                <label 
                  htmlFor="xml-sales-upload" 
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer bg-surface hover:bg-surface-2 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-12 h-12 mb-4 text-text-muted" />
                    <p className="mb-2 text-sm text-text-primary font-semibold">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-text-muted">XML de NF-e de Saída (Venda)</p>
                  </div>
                  <input 
                    id="xml-sales-upload" 
                    type="file" 
                    accept=".xml" 
                    className="hidden" 
                    onChange={handleFileSelect}
                  />
                </label>
                {xmlFile && (
                  <div className="mt-4 p-3 bg-surface-2 rounded-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-success" />
                    <span className="text-sm text-text-primary">{xmlFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {parsedData?.nfe && (
                <div className="bg-surface-2 rounded-lg p-4 border border-border">
                  <h3 className="font-semibold mb-3">Informações da NF-e</h3>
                  
                  {/* Fornecedor */}
                  {parsedData.fornecedor && (
                    <div className="mb-3 pb-3 border-b border-border">
                      <div className="text-sm font-semibold text-text-primary mb-1">
                        {parsedData.fornecedor.razaoSocial || parsedData.fornecedor.nomeFantasia || 'Fornecedor'}
                      </div>
                      <div className="text-xs text-text-muted">
                        {parsedData.fornecedor.cnpj && `CNPJ: ${parsedData.fornecedor.cnpj}`}
                        {parsedData.fornecedor.endereco?.cidade && parsedData.fornecedor.endereco?.uf && 
                          ` • ${parsedData.fornecedor.endereco.cidade}/${parsedData.fornecedor.endereco.uf}`
                        }
                      </div>
                    </div>
                  )}
                  
                  {/* Dados da Nota */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div><span className="text-text-muted">Número:</span> <span className="font-mono">{parsedData.nfe.numero}</span></div>
                    <div><span className="text-text-muted">Série:</span> <span className="font-mono">{parsedData.nfe.serie}</span></div>
                    <div><span className="text-text-muted">Tipo:</span> <span className="text-warning font-semibold">{parsedData.nfe.tipo}</span></div>
                    <div><span className="text-text-muted">Data:</span> <span>{new Date(parsedData.nfe.dataEmissao).toLocaleDateString('pt-BR')}</span></div>
                  </div>
                  
                  {/* Natureza e Total */}
                  {parsedData.nfe.naturezaOperacao && (
                    <div className="mb-2 text-sm">
                      <span className="text-text-muted">Natureza:</span> <span className="font-medium">{parsedData.nfe.naturezaOperacao}</span>
                    </div>
                  )}
                  
                  {parsedData.nfe.totalNota !== undefined && (
                    <div className="mb-3 text-sm">
                      <span className="text-text-muted">Total da Nota:</span> <span className="font-mono font-semibold text-lg text-success">R$ {parsedData.nfe.totalNota.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Chave de Acesso */}
                  {parsedData.nfe.chaveAcesso && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-text-muted text-xs">Chave de Acesso:</span>
                      <p className="font-mono text-xs break-all">{parsedData.nfe.chaveAcesso}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">Produtos da Venda ({parsedData.produtos.length})</h3>
                <div className="space-y-2">
                  {parsedData.produtos.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-lg border border-border bg-surface flex items-start gap-3"
                    >
                      <ShoppingCart className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{item.nome}</p>
                            <p className="text-xs text-text-muted">
                              {item.codigo && `Código: ${item.codigo} • `}
                              Qtd: {item.quantidade} {item.unidade}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold">
                              R$ {item.valorTotal.toFixed(2)}
                            </p>
                            <p className="text-xs text-text-muted">
                              Unit: R$ {item.valorUnitario.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formas de Pagamento do XML */}
              {parsedData.pagamentos && parsedData.pagamentos.length > 0 && (
                <div className="bg-surface-2 rounded-lg p-4 border border-border">
                  <h3 className="font-semibold mb-3">Formas de Pagamento ({parsedData.pagamentos.length})</h3>
                  <div className="space-y-2">
                    {parsedData.pagamentos.map((pag, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-sm">{pag.descricao}</p>
                          <p className="text-xs text-text-muted">Código SEFAZ: {pag.codigoSefaz}</p>
                        </div>
                        <p className="text-sm font-semibold">R$ {pag.valor.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Atenção: Venda Externa</p>
                    <p className="text-xs text-text-muted">
                      Esta venda será registrada no histórico como uma venda externa (importada de XML).
                      O estoque dos produtos será subtraído automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total da Venda:</span>
                <span className="text-success">R$ {totalVenda.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-warning mb-4" />
              <p className="text-lg font-semibold">Processando venda...</p>
              <p className="text-sm text-text-muted">Criando comanda e atualizando estoque</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="bg-surface-2 rounded-lg p-6 border border-border text-center">
                {result.success ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Venda Importada com Sucesso!</h3>
                    <p className="text-sm text-text-muted mb-4">A venda foi registrada no histórico</p>
                    {result.produtosNaoEncontrados && result.produtosNaoEncontrados.length > 0 && (
                      <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-left">
                        <p className="text-sm font-semibold mb-2">⚠️ Produtos não encontrados:</p>
                        <ul className="text-xs text-text-muted space-y-1">
                          {result.produtosNaoEncontrados.map((nome, idx) => (
                            <li key={idx}>• {nome}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Erro na Importação</h3>
                    <p className="text-sm text-text-muted">{result.error || 'Ocorreu um erro ao importar a venda'}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleReset}>Voltar</Button>
              <Button onClick={handleConfirmImport}>
                Confirmar Importação
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
