import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Plus, RefreshCw, Copy } from 'lucide-react';
import { parseNFeXML, findExistingProduct, convertXMLProductToSystemFormat } from '@/lib/xmlParser';
import { createProduct, adjustProductStock, listProducts, updateProduct } from '@/lib/products';
import { cn } from '@/lib/utils';

export default function XMLImportModal({ open, onOpenChange, products, codigoEmpresa, onSuccess }) {
  const { toast } = useToast();
  const [step, setStep] = useState('upload'); // upload | preview | processing | done
  const [xmlFile, setXmlFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [productsPreview, setProductsPreview] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({ created: 0, updated: 0, errors: 0, details: [] });

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

      setParsedData(parsed);
      
      // Buscar TODOS os produtos do banco para validação precisa
      let allProducts = products;
      try {
        // listProducts aceita 'search' (não 'searchTerm') e não usa 'limit'
        const fullList = await listProducts({ 
          search: '', 
          codigoEmpresa 
        });
        allProducts = fullList || products;
      } catch (err) {
        console.warn('[XMLImport] Não foi possível carregar lista completa, usando cache:', err);
      }
      
      // Validar produtos: novos vs existentes
      const preview = parsed.produtos.map(prodXML => {
        const existing = findExistingProduct(prodXML, allProducts);
        return {
          xml: prodXML,
          existing: existing,
          isNew: !existing,
          willCreate: !existing,
          willUpdate: !!existing
        };
      });
      
      setProductsPreview(preview);
      setStep('preview');
      
    } catch (error) {
      console.error('[XMLImport] Erro ao processar arquivo:', error);
      toast({ title: 'Erro ao processar XML', description: error.message, variant: 'destructive' });
    }
  };

  const handleConfirmImport = async () => {
    setStep('processing');
    setProcessing(true);
    
    const results = { created: 0, updated: 0, errors: 0, skipped: 0, details: [] };
    
    for (const item of productsPreview) {
      try {
        if (item.isNew) {
          // Criar produto novo
          const productData = convertXMLProductToSystemFormat(item.xml, codigoEmpresa);
          // Garantir que o valor_venda (price) também seja preenchido, além de preco_venda (salePrice)
          if (productData.salePrice != null && productData.price == null) {
            productData.price = productData.salePrice;
          }
          // Definir estoque inicial diretamente no insert para refletir imediatamente
          const qtyXml = Number(item.xml.quantidade) || 0;
          productData.stock = qtyXml;
          productData.initialStock = qtyXml;
          productData.currentStock = qtyXml;
          // Garantir marcação/metadata de XML e categoria
          productData.importedViaXML = true;
          productData.category = 'Importados';
          if (parsedData?.nfe) {
            productData.xmlChave = parsedData.nfe.chaveAcesso || null;
            productData.xmlNumero = parsedData.nfe.numero || null;
            productData.xmlSerie = parsedData.nfe.serie || null;
            productData.xmlEmissao = parsedData.nfe.dataEmissao || null;
          }
          
          try {
            // Importante: garantir codigo_empresa no insert (RLS) e refletir preço/estoque imediato
            await createProduct(productData, { codigoEmpresa });
            results.created++;
            results.details.push({ produto: item.xml.nome, acao: 'Criado', status: 'success' });
          } catch (createError) {
            // Se erro de duplicação, tentar encontrar o produto existente e atualizar estoque
            if (createError.message?.includes('duplicate') || createError.message?.includes('unique constraint')) {
              console.warn('[XMLImport] Produto já existe, tentando atualizar estoque:', item.xml.nome);
              
              // Buscar produto existente novamente (pode ter sido criado entre a validação e agora)
              const existingProducts = await listProducts({ 
                search: item.xml.nome, 
                codigoEmpresa 
              });
              
              const found = existingProducts.find(p => 
                p.name?.toLowerCase() === item.xml.nome?.toLowerCase() ||
                p.barcode === item.xml.ean ||
                p.code === item.xml.codigo
              );
              
              if (found && Number(item.xml.quantidade) > 0) {
                await adjustProductStock({
                  productId: found.id,
                  delta: Number(item.xml.quantidade) || 0,
                  codigoEmpresa
                });
                results.updated++;
                results.details.push({ produto: item.xml.nome, acao: 'Já existe - Estoque atualizado', status: 'success' });
              } else {
                results.skipped++;
                results.details.push({ produto: item.xml.nome, acao: 'Já existe - Ignorado', status: 'warning' });
              }
            } else {
              throw createError;
            }
          }
        } else {
          // Atualizar estoque do produto existente e garantir preço se estiver zerado
          const qty = Number(item.xml.quantidade) || 0;
          if (qty > 0) {
            await adjustProductStock({
              productId: item.existing.id,
              delta: qty,
              codigoEmpresa
            });
          }
          // Se o produto existente está com preço 0 e o XML traz valor unitário, ajustar preço de venda
          const xmlUnit = Number(item.xml.valorUnitario) || 0;
          const currentPrice = Number(item.existing.price ?? item.existing.salePrice ?? 0);
          if (xmlUnit > 0 && currentPrice === 0) {
            try {
              await updateProduct(item.existing.id, { salePrice: xmlUnit, price: xmlUnit });
            } catch (e) {
              console.warn('[XMLImport] Falha ao ajustar preço do produto existente', e);
            }
          }
          results.updated++;
          results.details.push({ produto: item.xml.nome, acao: qty > 0 ? 'Estoque atualizado' : 'Verificado', status: 'success' });
        }
      } catch (error) {
        console.error('[XMLImport] Erro ao processar produto:', item.xml.nome, error);
        results.errors++;
        results.details.push({ produto: item.xml.nome, acao: 'Erro', status: 'error', error: error.message });
      }
    }
    
    setResults(results);
    setProcessing(false);
    setStep('done');
    
    // Notificar sucesso
    if (results.errors === 0) {
      toast({ 
        title: 'Importação concluída!', 
        description: `${results.created} produto(s) criado(s), ${results.updated} atualizado(s).`,
        variant: 'success' 
      });
    } else {
      toast({ 
        title: 'Importação concluída com erros', 
        description: `${results.created} criado(s), ${results.updated} atualizado(s), ${results.errors} erro(s).`,
        variant: 'warning' 
      });
    }
    
    // Chamar callback de sucesso
    if (onSuccess) onSuccess();
  };

  const handleClose = () => {
    setStep('upload');
    setXmlFile(null);
    setParsedData(null);
    setProductsPreview([]);
    setResults({ created: 0, updated: 0, errors: 0, details: [] });
    onOpenChange(false);
  };

  const handleReset = () => {
    setStep('upload');
    setXmlFile(null);
    setParsedData(null);
    setProductsPreview([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Importar XML de Compra (NF-e)</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione o arquivo XML da nota fiscal de entrada'}
            {step === 'preview' && 'Revise os produtos que serão importados'}
            {step === 'processing' && 'Processando produtos...'}
            {step === 'done' && 'Importação finalizada'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-full max-w-md">
                <label 
                  htmlFor="xml-upload" 
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer bg-surface hover:bg-surface-2 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-12 h-12 mb-4 text-text-muted" />
                    <p className="mb-2 text-sm text-text-primary font-semibold">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-text-muted">Arquivo XML de NF-e (Nota Fiscal Eletrônica)</p>
                  </div>
                  <input 
                    id="xml-upload" 
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
                  <h3 className="font-semibold mb-2">Informações da NF-e</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-text-muted">Número:</span> <span className="font-mono">{parsedData.nfe.numero}</span></div>
                    <div><span className="text-text-muted">Série:</span> <span className="font-mono">{parsedData.nfe.serie}</span></div>
                    <div><span className="text-text-muted">Tipo:</span> <span>{parsedData.nfe.tipo}</span></div>
                    <div><span className="text-text-muted">Fornecedor:</span> <span>{parsedData.fornecedor?.razaoSocial}</span></div>
                  </div>
                  {parsedData.nfe.chaveAcesso && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-text-muted text-xs">Chave de Acesso:</span>
                      <p className="font-mono text-xs break-all">{parsedData.nfe.chaveAcesso}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-surface-2 rounded-lg p-4 border border-border flex flex-col max-h-[500px]">
                <h3 className="font-semibold mb-3">Produtos Encontrados ({productsPreview.length})</h3>
                <div className="space-y-2 overflow-y-auto flex-1">
                  {productsPreview.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3",
                        item.isNew ? "bg-success/10 border-success/30" : "bg-info/10 border-info/30"
                      )}
                    >
                      {item.isNew ? (
                        <Plus className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{item.xml.nome}</p>
                            <p className="text-xs text-text-muted">
                              {item.xml.codigo && `Código: ${item.xml.codigo} • `}
                              {item.xml.ean && item.xml.ean !== 'SEM GTIN' && `EAN: ${item.xml.ean} • `}
                              Qtd: {item.xml.quantidade} {item.xml.unidade}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold">
                              R$ {item.xml.valorUnitario.toFixed(2)}
                            </p>
                            <p className="text-xs text-text-muted">
                              {item.isNew ? 'Novo produto' : 'Atualizar estoque'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  <span>{productsPreview.filter(p => p.isNew).length} produto(s) novo(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info"></div>
                  <span>{productsPreview.filter(p => !p.isNew).length} produto(s) existente(s)</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-warning mb-4" />
              <p className="text-lg font-semibold">Processando produtos...</p>
              <p className="text-sm text-text-muted">Aguarde enquanto importamos os produtos</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="bg-surface-2 rounded-lg p-6 border border-border text-center">
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Importação Concluída!</h3>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-2xl font-bold text-success">{results.created}</p>
                    <p className="text-sm text-text-muted">Criados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-info">{results.updated}</p>
                    <p className="text-sm text-text-muted">Atualizados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-danger">{results.errors}</p>
                    <p className="text-sm text-text-muted">Erros</p>
                  </div>
                </div>
              </div>

              {results.details.length > 0 && (
                <div className="bg-surface-2 rounded-lg p-4 border border-border">
                  <h3 className="font-semibold mb-3">Detalhes</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {detail.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{detail.produto}</span>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          detail.status === 'success' ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                        )}>
                          {detail.acao}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                Confirmar Importação ({productsPreview.length} produtos)
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
