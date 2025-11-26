import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Plus, RefreshCw, Copy, Link2, Trash2, ChevronDown, ChevronRight, Minus } from 'lucide-react';
import { parseNFeXML, findExistingProduct, convertXMLProductToSystemFormat } from '@/lib/xmlParser';
import { createProduct, adjustProductStock, listProducts, updateProduct } from '@/lib/products';
import { findOrCreateSupplier } from '@/lib/suppliers';
import { findPurchaseByNFeKey, createPurchase, createPurchaseItems } from '@/lib/purchases';
import { cn } from '@/lib/utils';
import ProductSelectionModal from './ProductSelectionModal';
import ImportConfirmationModal from './ImportConfirmationModal';

export default function XMLImportModal({ open, onOpenChange, products, codigoEmpresa, onSuccess }) {
  const { toast } = useToast();
  const [step, setStep] = useState('upload'); // upload | preview | processing | done
  const [xmlFile, setXmlFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [productsPreview, setProductsPreview] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({ created: 0, updated: 0, errors: 0, details: [] });
  const [editedProducts, setEditedProducts] = useState({}); // { index: { name, qty, margin, linkedProductId, updatePrice } }
  const [expandedProducts, setExpandedProducts] = useState({});
  const [productSelectionModal, setProductSelectionModal] = useState({ isOpen: false, productIndex: null, currentProduct: null });
  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false });

  const getNFeModelLabel = () => {
    const modelo = parsedData?.nfe?.modelo;
    if (modelo === '55') return 'NF-e';
    if (modelo === '65') return 'NFC-e';
    return 'NF-e / NFC-e';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[XMLImport] Nenhum arquivo selecionado');
      return;
    }

    console.log('[XMLImport] Arquivo selecionado:', file.name);

    if (!file.name.endsWith('.xml')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione um arquivo XML válido.', variant: 'destructive' });
      return;
    }

    setXmlFile(file);
    
    try {
      console.log('[XMLImport] Lendo conteúdo do arquivo...');
      const xmlContent = await file.text();
      console.log('[XMLImport] Arquivo lido, parseando XML...');
      const parsed = parseNFeXML(xmlContent);
      console.log('[XMLImport] XML parseado:', parsed);
      
      if (!parsed.success) {
        toast({ title: 'Erro ao ler XML', description: parsed.error || 'XML inválido', variant: 'destructive' });
        return;
      }

      if (!parsed.data?.produtos || parsed.data.produtos.length === 0) {
        toast({ title: 'Nenhum produto encontrado', description: 'O XML não contém produtos.', variant: 'warning' });
        return;
      }

      setParsedData(parsed.data);
      
      // Buscar TODOS os produtos do banco para validação precisa (incluindo inativos)
      let allProducts = products;
      try {
        // listProducts aceita 'search' (não 'searchTerm') e não usa 'limit'
        const fullList = await listProducts({ 
          search: '', 
          codigoEmpresa,
          includeInactive: true  // IMPORTANTE: incluir inativos para evitar duplicação
        });
        allProducts = fullList || products;
        console.log('[XMLImport] Produtos carregados para validação:', allProducts.length);
        console.log('[XMLImport] Nomes dos produtos:', allProducts.map(p => p.name));
      } catch (err) {
        console.warn('[XMLImport] Não foi possível carregar lista completa, usando cache:', err);
      }
      
      // Validar produtos: novos vs existentes
      const preview = parsed.data.produtos.map((prodXML, idx) => {
        const existing = findExistingProduct(prodXML, allProducts);

        // Achatar impostos do parser em campos planos usados pelo fluxo de importação
        const xmlWithTaxes = { ...prodXML };
        if (prodXML.impostos) {
          const { icms, pis, cofins, ipi } = prodXML.impostos;
          if (icms) {
            xmlWithTaxes.icmsAliquota = icms.aliquota ?? xmlWithTaxes.icmsAliquota;
            xmlWithTaxes.icmsValor = icms.valor ?? xmlWithTaxes.icmsValor;
          }
          if (ipi) {
            xmlWithTaxes.ipiAliquota = ipi.aliquota ?? xmlWithTaxes.ipiAliquota;
            xmlWithTaxes.ipiValor = ipi.valor ?? xmlWithTaxes.ipiValor;
          }
          if (pis) {
            xmlWithTaxes.pisAliquota = pis.aliquota ?? xmlWithTaxes.pisAliquota;
            xmlWithTaxes.pisValor = pis.valor ?? xmlWithTaxes.pisValor;
          }
          if (cofins) {
            xmlWithTaxes.cofinsAliquota = cofins.aliquota ?? xmlWithTaxes.cofinsAliquota;
            xmlWithTaxes.cofinsValor = cofins.valor ?? xmlWithTaxes.cofinsValor;
          }
        }

        return {
          xml: xmlWithTaxes,
          existing: existing,
          isNew: !existing,
          willCreate: !existing,
          willUpdate: !!existing,
          selected: true, // Por padrão, todos selecionados
          index: idx
        };
      });
      
      setProductsPreview(preview);
      
      // Pre-populate editedProducts with XML prices to ensure they're recognized immediately
      const initialEditedProducts = {};
      preview.forEach((item, idx) => {
        if (item.xml.precoVenda) {
          initialEditedProducts[idx] = {
            salePrice: Number(item.xml.precoVenda)
          };
        }
      });
      console.log('[XMLImport] Pré-populando editedProducts:', initialEditedProducts);
      setEditedProducts(initialEditedProducts);
      
      console.log('[XMLImport] Preview preparado, mudando para step preview. Total produtos:', preview.length);
      setStep('preview');
      
    } catch (error) {
      console.error('[XMLImport] Erro ao processar arquivo:', error);
      toast({ title: 'Erro ao processar XML', description: error.message, variant: 'destructive' });
    }
  };

  // Abrir modal de confirmação
  const handleShowConfirmation = () => {
    setConfirmationModal({ isOpen: true });
  };

  // Confirmar importação
  const handleConfirmImport = async () => {
    setConfirmationModal({ isOpen: false });
    
    // Obter o conteúdo XML do arquivo
    let xmlContent = '';
    if (xmlFile) {
      try {
        xmlContent = await xmlFile.text();
      } catch (error) {
        console.error('[XMLImport] Erro ao ler XML:', error);
        toast({ title: 'Erro ao ler XML', description: 'Não foi possível ler o arquivo XML.', variant: 'destructive' });
        return;
      }
    }
    
    setStep('processing');
    setProcessing(true);
    
    const results = { created: 0, updated: 0, errors: 0, skipped: 0, details: [], supplierId: null };
    
    // Filtrar apenas produtos selecionados
    const selectedProducts = productsPreview.filter(item => item.selected);
    
    if (selectedProducts.length === 0) {
      toast({ title: 'Nenhum produto selecionado', description: 'Selecione ao menos um produto para importar.', variant: 'warning' });
      setProcessing(false);
      setStep('preview');
      return;
    }
    
    // Buscar ou criar fornecedor automaticamente
    let supplier = null;
    if (parsedData?.fornecedor) {
      try {
        supplier = await findOrCreateSupplier(parsedData.fornecedor, codigoEmpresa);
        results.supplierId = supplier.id;
        console.log('[XMLImport] Fornecedor processado:', supplier.razao_social, 'ID:', supplier.id);
      } catch (error) {
        console.error('[XMLImport] Erro ao processar fornecedor:', error);
        toast({ 
          title: 'Aviso', 
          description: 'Não foi possível criar/vincular o fornecedor, mas os produtos serão importados.', 
          variant: 'warning' 
        });
      }
    }
    
    console.log('[XMLImport] Processando apenas produtos selecionados:', selectedProducts.length);
    
    for (const item of selectedProducts) {
      // Aplicar edições se houver
      const edited = editedProducts[item.index] || {};
      const finalName = edited.name || item.xml.nome;
      const finalQty = edited.qty !== undefined ? edited.qty : Number(item.xml.quantidade);
      const finalMargin = edited.margin; // NULL se não definido
      const finalSalePrice = edited.salePrice; // Preço editado manualmente
      const linkedProductId = edited.linkedProductId;
      try {
        // Se vinculado manualmente, apenas atualiza estoque do produto existente
        if (linkedProductId && linkedProductId !== 'force-new') {
          if (finalQty > 0) {
            await adjustProductStock({
              productId: linkedProductId,
              delta: finalQty,
              codigoEmpresa
            });
          }
          results.updated++;
          results.details.push({ produto: finalName, acao: `Vinculado - Estoque atualizado (+${finalQty})`, status: 'success' });
          continue;
        }
        
        // Se é novo OU forçou criar novo (ignorando existente)
        if (item.isNew || linkedProductId === 'force-new') {
          // Criar produto novo com dados editados
          const productData = convertXMLProductToSystemFormat(item.xml, codigoEmpresa);
          
          // Aplicar nome editado
          if (edited.name) {
            productData.name = edited.name;
          }
          // Usar preço editado manualmente OU calcular pela margem
          if (finalSalePrice != null) {
            // Preço editado manualmente tem prioridade
            productData.salePrice = finalSalePrice;
            productData.price = finalSalePrice;
          } else if (finalMargin != null && finalMargin > 0) {
            // Calcular preço de venda baseado na margem (sempre markup)
            const custoUnitario = productData.costPrice || 0;
            if (custoUnitario > 0) {
              const precoVenda = custoUnitario * (1 + finalMargin / 100);
              productData.salePrice = precoVenda;
              productData.price = precoVenda;
            }
          } else if (productData.salePrice != null && productData.price == null) {
            productData.price = productData.salePrice;
          }
          // Se nem preço nem margem definidos, deixa NULL
          
          // Definir estoque com quantidade editada
          productData.stock = finalQty;
          productData.initialStock = finalQty;
          productData.currentStock = finalQty;
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
            results.details.push({ produto: finalName, acao: 'Criado', status: 'success' });
          } catch (createError) {
            // Se erro de duplicação, tentar encontrar o produto existente e atualizar estoque
            if (createError.message?.includes('duplicate') || createError.message?.includes('unique constraint')) {
              console.warn('[XMLImport] Produto já existe, tentando atualizar estoque:', item.xml.nome);
              
              // Buscar produto existente novamente (pode ter sido criado entre a validação e agora)
              const existingProducts = await listProducts({ 
                search: item.xml.nome, 
                codigoEmpresa,
                includeInactive: true
              });
              
              const found = existingProducts.find(p => {
                const nomeMatch = (p.name || '').toLowerCase().trim() === (item.xml.nome || '').toLowerCase().trim();
                const unidadeMatch = (p.unit || '').toUpperCase().trim() === (item.xml.unidade || '').toUpperCase().trim();
                const eanMatch = (p.barcode || '') === (item.xml.ean || '');
                const codeMatch = (p.code || '') === (item.xml.codigo || '');

                const result = (nomeMatch && unidadeMatch) || (eanMatch && unidadeMatch) || (codeMatch && unidadeMatch);
                if (!result && (eanMatch || codeMatch) && !unidadeMatch) {
                  console.log('[XMLImport] Encontrado mesmo EAN/Código porém unidade diferente. NÃO unir:', {
                    nomeSistema: p.name, unidadeSistema: p.unit, nomeXML: item.xml.nome, unidadeXML: item.xml.unidade, ean: item.xml.ean, codigo: item.xml.codigo
                  });
                }
                return result;
              });
              
              if (found && Number(item.xml.quantidade) > 0) {
                await adjustProductStock({
                  productId: found.id,
                  delta: Number(item.xml.quantidade) || 0,
                  codigoEmpresa
                });
                results.updated++;
                results.details.push({ produto: item.xml.nome, acao: 'Já existe - Estoque atualizado', status: 'success' });
              } else if (!found) {
                // Com a nova constraint (nome+unidade), pode ter dado 409 por outro motivo. Tentar criar novamente.
                try {
                  console.log('[XMLImport] Duplicate report mas não encontrou por nome+unidade/EAN+unidade/código+unidade. Tentando criar novo produto.');
                  const productDataRetry = convertXMLProductToSystemFormat(item.xml, codigoEmpresa);
                  if (productDataRetry.salePrice != null && productDataRetry.price == null) {
                    productDataRetry.price = productDataRetry.salePrice;
                  }
                  const qtyXmlRetry = Number(item.xml.quantidade) || 0;
                  productDataRetry.stock = qtyXmlRetry;
                  productDataRetry.initialStock = qtyXmlRetry;
                  productDataRetry.currentStock = qtyXmlRetry;
                  await createProduct(productDataRetry, { codigoEmpresa });
                  results.created++;
                  results.details.push({ produto: item.xml.nome, acao: 'Criado após checagem', status: 'success' });
                } catch (e2) {
                  console.warn('[XMLImport] Falhou ao criar após duplicate:', e2);
                  results.skipped++;
                  results.details.push({ produto: item.xml.nome, acao: 'Falha ao criar após duplicate', status: 'warning' });
                }
              } else {
                results.skipped++;
                results.details.push({ produto: item.xml.nome, acao: 'Sem quantidade para ajustar', status: 'warning' });
              }
            } else {
              throw createError;
            }
          }
        } else {
          // Atualizar estoque do produto existente (SOMA, não substitui)
          const qty = Number(item.xml.quantidade) || 0;
          if (qty > 0) {
            await adjustProductStock({
              productId: item.existing.id,
              delta: qty, // SOMA ao estoque atual
              codigoEmpresa
            });
          }
          
          // Atualizar preço SOMENTE se checkbox individual estiver marcado
          const shouldUpdatePrice = edited.updatePrice === true;
          if (shouldUpdatePrice) {
            const xmlCusto = Number(item.xml.valorUnitario) || 0;
            if (xmlCusto > 0) {
              try {
                const updateData = { costPrice: xmlCusto };
                
                // Usar preço editado manualmente OU calcular pela margem (sempre markup)
                if (finalSalePrice != null) {
                  updateData.salePrice = finalSalePrice;
                  updateData.price = finalSalePrice;
                } else if (finalMargin != null && finalMargin > 0) {
                  const precoVenda = xmlCusto * (1 + finalMargin / 100);
                  updateData.salePrice = precoVenda;
                  updateData.price = precoVenda;
                }
                
                await updateProduct(item.existing.id, updateData);
              } catch (e) {
                console.warn('[XMLImport] Falha ao atualizar preço do produto existente', e);
              }
            }
          }
          
          results.updated++;
          results.details.push({ 
            produto: item.xml.nome, 
            acao: qty > 0 ? `Estoque +${qty} (somado)` : 'Verificado', 
            status: 'success' 
          });
        }
      } catch (error) {
        console.error('[XMLImport] Erro ao processar produto:', item.xml.nome, error);
        results.errors++;
        results.details.push({ produto: item.xml.nome, acao: 'Erro', status: 'error', error: error.message });
      }
    }
    
    // Registrar a compra (NF-e) no banco
    if (parsedData?.nfe?.chaveAcesso && supplier) {
      try {
        // Verificar se a NF-e já foi importada
        const existingPurchase = await findPurchaseByNFeKey(parsedData.nfe.chaveAcesso, codigoEmpresa);
        
        let purchase = existingPurchase;
        
        if (!existingPurchase || !existingPurchase.ativo) {
          // Criar registro da compra (primeira vez ou reativar inativa)
          const purchaseData = {
            codigoEmpresa,
            fornecedorId: supplier.id,
            chaveNfe: parsedData.nfe.chaveAcesso,
            numeroNfe: parsedData.nfe.numero,
            serieNfe: parsedData.nfe.serie,
            dataEmissao: parsedData.nfe.dataEmissao,
            tipoOperacao: parsedData.nfe.tipo || 'Entrada',
            naturezaOperacao: parsedData.nfe.naturezaOperacao,
            valorProdutos: parsedData.nfe.totalNota || 0,
            valorTotal: parsedData.nfe.totalNota || 0,
            xmlCompleto: xmlContent, // Salvar XML original
            formaPagamento: parsedData.pagamentos && parsedData.pagamentos.length > 0 
              ? parsedData.pagamentos.map(p => p.nome).join(', ')
              : null,
          };
          
          purchase = await createPurchase(purchaseData);
          console.log('[XMLImport] Nova compra registrada:', purchase.numero_nfe);
        } else {
          console.log('[XMLImport] NF-e já existe, adicionando novos itens:', existingPurchase.numero_nfe);
          results.purchaseAlreadyExists = true;
        }
        
        // Criar itens da compra (APENAS produtos selecionados)
        const purchaseItems = selectedProducts.map(item => {
          const edited = editedProducts[item.index] || {};
          const linkedProductId = edited.linkedProductId;
          
          // Determinar o ID do produto:
          // 1. Se vinculou manualmente a outro produto
          // 2. Se é produto existente (atualização de estoque)
          // 3. Se criou novo, não temos o ID ainda (será null)
          let productId = null;
          if (linkedProductId && linkedProductId !== 'force-new') {
            productId = linkedProductId;
          } else if (item.existing && !linkedProductId) {
            productId = item.existing.id;
          }
          
          return {
            produtoId: productId,
            codigoProdutoXML: item.xml.codigo,
            nomeProdutoXML: item.xml.nome,
            eanXML: item.xml.ean,
            ncmXML: item.xml.ncm,
            cfopXML: item.xml.cfop,
            unidadeXML: item.xml.unidade,
            quantidade: edited.qty !== undefined ? edited.qty : Number(item.xml.quantidade),
            valorUnitario: Number(item.xml.valorUnitario) || 0,
            valorTotal: Number(item.xml.valorTotal) || 0,
            valorDesconto: item.xml.valorDesconto || 0,
            valorFrete: item.xml.valorFrete || 0,
            valorSeguro: item.xml.valorSeguro || 0,
            valorOutrasDespesas: item.xml.valorOutrasDespesas || 0,
            icmsAliquota: item.xml.icmsAliquota,
            icmsValor: item.xml.icmsValor,
            ipiAliquota: item.xml.ipiAliquota,
            ipiValor: item.xml.ipiValor,
            pisAliquota: item.xml.pisAliquota,
            pisValor: item.xml.pisValor,
            cofinsAliquota: item.xml.cofinsAliquota,
            cofinsValor: item.xml.cofinsValor,
            vinculadoManualmente: !!edited.linkedProductId,
            observacoes: edited.observacoes || null,
            selecionadoNaImportacao: item.selected // Flag que indica se foi selecionado
          };
        });
        
        await createPurchaseItems(purchase.id, purchaseItems);
        console.log('[XMLImport] Itens adicionados à compra:', purchaseItems.length);
        
        results.purchaseId = purchase.id;
      } catch (error) {
        console.error('[XMLImport] Erro ao registrar compra:', error);
        // Não bloqueia a importação, apenas loga o erro
      }
    }
    
    setResults(results);
    setProcessing(false);
    setStep('done');
    
    // Notificar sucesso
    if (results.purchaseAlreadyExists) {
      toast({ 
        title: 'NF-e já importada!', 
        description: `Esta NF-e já existe no sistema. ${results.created} produto(s) criado(s), ${results.updated} atualizado(s).`,
        variant: 'warning' 
      });
    } else if (results.errors === 0) {
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
    console.log('[XMLImport] Fechando modal');
    setStep('upload');
    setXmlFile(null);
    setParsedData(null);
    setProductsPreview([]);
    setEditedProducts({});
    setExpandedProducts({});
    setResults({ created: 0, updated: 0, errors: 0, details: [] });
    onOpenChange(false);
  };

  // Log quando o modal abre
  React.useEffect(() => {
    if (open) {
      console.log('[XMLImport] Modal aberto. Step atual:', step);
    }
  }, [open, step]);

  const handleReset = () => {
    setStep('upload');
    setXmlFile(null);
    setParsedData(null);
    setProductsPreview([]);
    setEditedProducts({});
    setExpandedProducts({});
  };

  const handleToggleSelect = (index) => {
    setProductsPreview(prev => prev.map((item, idx) => 
      idx === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleToggleSelectAll = () => {
    const allSelected = productsPreview.every(item => item.selected);
    setProductsPreview(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleEditProduct = (index, field, value) => {
    setEditedProducts(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  const handleLinkProduct = (index, productId) => {
    console.log('[XMLImportModal] handleLinkProduct chamado:', { index, productId });
    console.log('[XMLImportModal] Estado editedProducts completo antes:', editedProducts);
    console.log('[XMLImportModal] Estado editedProducts[index] antes:', editedProducts[index]);
    setEditedProducts(prev => {
      console.log('[XMLImportModal] Estado prev no setEditedProducts:', prev);
      const newState = {
        ...prev,
        [index]: {
          ...prev[index],
          linkedProductId: productId
        }
      };
      console.log('[XMLImportModal] Novo estado editedProducts:', newState);
      return newState;
    });
  };

  const calculateSalePrice = (costPrice, margin) => {
    if (!costPrice || !margin) return 0;
    // Sempre usar markup (multiplicação) para qualquer margem
    return costPrice * (1 + margin / 100);
  };

  const getEditedValue = (index, field, defaultValue) => {
    return editedProducts[index]?.[field] ?? defaultValue;
  };

  const toggleExpand = (index) => {
    setExpandedProducts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <span>Importar XML de Compra</span>
            {parsedData?.nfe && (
              <span className="inline-flex items-center rounded-full bg-surface-2 border border-border px-2 py-0.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                {getNFeModelLabel()}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione o arquivo XML da nota fiscal de entrada'}
            {step === 'preview' && 'Revise os produtos que serão importados'}
            {step === 'processing' && 'Processando produtos...'}
            {step === 'done' && 'Importação finalizada'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-2 py-1">
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
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {parsedData?.nfe && (
                <div className="bg-surface-2 rounded-lg p-4 border border-border">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">
                        Informações da {getNFeModelLabel()}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-text-muted">Número:</span> <span className="font-mono">{parsedData.nfe.numero}</span></div>
                        <div><span className="text-text-muted">Série:</span> <span className="font-mono">{parsedData.nfe.serie}</span></div>
                        <div><span className="text-text-muted">Tipo:</span> <span>{parsedData.nfe.tipo}</span></div>
                        <div><span className="text-text-muted">Fornecedor:</span> <span>{parsedData.fornecedor?.razaoSocial}</span></div>
                      </div>
                    </div>
                    
                    {/* Resumo Financeiro */}
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="bg-brand/10 rounded-lg p-3 border border-brand/20">
                        <p className="text-xs text-text-muted mb-1">Valor Total NF-e</p>
                        <p className="text-xl font-bold text-brand">
                          R$ {Number(parsedData.nfe.totalNota || 0).toFixed(2)}
                        </p>
                      </div>
                      
                      {parsedData.pagamentos && parsedData.pagamentos.length > 0 && (
                        <div className="bg-success/10 rounded-lg p-2.5 border border-success/20">
                          <p className="text-xs text-text-muted mb-1">Forma de Pagamento</p>
                          <p className="text-sm font-semibold text-success">
                            {parsedData.pagamentos.map(p => p.nome).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {parsedData.nfe.chaveAcesso && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-text-muted text-xs">Chave de Acesso:</span>
                      <p className="font-mono text-xs break-all">{parsedData.nfe.chaveAcesso}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Controles de seleção */}
              <div className="flex items-center justify-between gap-4 px-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleToggleSelectAll}
                >
                  {productsPreview.every(p => p.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
                
                <span className="text-sm text-text-muted">
                  {productsPreview.filter(p => p.selected).length} de {productsPreview.length} selecionados
                </span>
              </div>

              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3 text-base">Produtos Encontrados</h3>
                <div className="space-y-2">
                  {productsPreview.map((item, idx) => {
                    const linkedProductId = getEditedValue(idx, 'linkedProductId', null);
                    const editedName = getEditedValue(idx, 'name', item.xml.nome);
                    const editedQty = getEditedValue(idx, 'quantity', item.xml.quantidade);
                    const editedMargin = getEditedValue(idx, 'margin', item.xml.margem);
                    const editedSalePrice = getEditedValue(idx, 'salePrice', null);
                    const costPrice = item.xml.valorUnitario || 0;
                    
                    
                    // Calcular preço de venda (prioridade: editado manualmente > produto existente > calculado por margem > preço XML)
                    let salePrice = editedSalePrice;
                    if (salePrice == null && !item.isNew && item.existing) {
                      // Se produto existe, usar o preço de venda do sistema
                      salePrice = Number(item.existing.preco_venda || item.existing.salePrice || item.existing.price || 0);
                    }
                    if (salePrice == null && editedMargin != null) {
                      salePrice = calculateSalePrice(costPrice, editedMargin);
                    }
                    if (salePrice == null && item.xml.precoVenda) {
                      // Usar o preço de venda do XML como fallback
                      salePrice = Number(item.xml.precoVenda);
                    }
                    
                    // Calcular margem atual baseado no preço (para exibição)
                    // Usar markup: Margem = ((Preço - Custo) / Custo) × 100
                    let displayMargin = null;
                    
                    // Se há margem editada, usar ela
                    if (editedMargin != null) {
                      displayMargin = editedMargin;
                    }
                    // Senão, calcular baseado no preço final
                    else if (salePrice != null && costPrice > 0 && salePrice > 0) {
                      const calculatedMargin = ((salePrice - costPrice) / costPrice) * 100;
                      displayMargin = Math.max(-999, Math.min(9999, calculatedMargin));
                    }
                    
                    const isExpanded = expandedProducts[idx];
                    
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "rounded-lg border transition-all",
                          item.selected ? (
                            item.isNew ? "bg-success/10 border-success/30" : "bg-info/10 border-info/30"
                          ) : "bg-surface opacity-60 border-border"
                        )}
                      >
                        {/* Cabeçalho compacto - sempre visível */}
                        <div className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Checkbox amarela */}
                            <input 
                              type="checkbox" 
                              checked={item.selected} 
                              onChange={() => handleToggleSelect(idx)}
                              className="w-4 h-4 rounded border-border accent-warning cursor-pointer"
                            />
                            
                            {/* Botão expand/collapse */}
                            <button
                              onClick={() => toggleExpand(idx)}
                              className="p-0.5 hover:bg-surface-2 rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-text-muted" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-text-muted" />
                              )}
                            </button>
                            
                            {/* Ícone de status */}
                            <div>
                              {item.isNew ? (
                                <Plus className="w-5 h-5 text-success" />
                              ) : (
                                <RefreshCw className="w-5 h-5 text-info" />
                              )}
                            </div>
                          </div>

                          {/* Informações principais */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">
                                  {editedName}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                                  {item.xml.codigo && (
                                    <span className="flex-shrink-0">#{item.xml.codigo}</span>
                                  )}
                                  <span>Qtd: {editedQty}</span>
                                </div>
                              </div>

                              {/* Badge de status */}
                              <div className="flex-shrink-0 ml-2">
                                {item.isNew ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">Novo</span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-info/20 text-info font-medium">Cadastrado</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-1 text-[11px] text-text-muted">
                              <span>
                                R$ {Number(costPrice).toFixed(2)}
                                {salePrice ? ` → R$ ${salePrice.toFixed(2)}` : ''}
                              </span>
                              {displayMargin != null && (
                                <span className={"ml-2 " + (displayMargin > 0 ? 'text-success' : displayMargin < 0 ? 'text-destructive' : 'text-text-muted')}>
                                  {displayMargin.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Detalhes expansíveis */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50">
                            {/* Nome editável */}
                            <div className="mt-3">
                              <label className="text-sm font-medium text-text-primary mb-1 block">Nome do Produto</label>
                              <input 
                                type="text"
                                value={editedName}
                                onChange={(e) => handleEditProduct(idx, 'name', e.target.value)}
                                disabled={!item.selected}
                                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-md focus:border-brand focus:ring-1 focus:ring-brand outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            </div>
                            
                            {/* Quantidade, Margem e Preços - grid 2 colunas no mobile, 4 no desktop */}
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                              <div>
                                <label className="text-xs text-text-muted mb-1 block">Quantidade</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditProduct(idx, 'qty', Math.max(0, editedQty - 1))}
                                    disabled={!item.selected || editedQty <= 0}
                                    className="w-9 h-9 rounded-md border border-border bg-surface hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <input 
                                    type="text"
                                    value={editedQty}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      handleEditProduct(idx, 'qty', val === '' ? 0 : Number(val));
                                    }}
                                    disabled={!item.selected}
                                    className="w-14 text-center px-2 py-2 text-sm bg-surface border border-border rounded-md focus:border-brand focus:ring-1 focus:ring-brand outline-none disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleEditProduct(idx, 'qty', editedQty + 1)}
                                    disabled={!item.selected}
                                    className="w-9 h-9 rounded-md bg-warning hover:bg-warning/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-black font-bold shadow-sm"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-text-muted mb-1 block">Margem %</label>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    value={(() => {
                                      const margin = getEditedValue(idx, 'margin', null);
                                      if (margin != null) {
                                        return String(margin);
                                      }
                                      // Se não há margem editada, calcular baseada no preço existente
                                      if (!item.isNew && item.existing && costPrice > 0) {
                                        const existingSalePrice = Number(item.existing.preco_venda || item.existing.salePrice || item.existing.price || 0);
                                        if (existingSalePrice > 0) {
                                          const calculatedMargin = ((existingSalePrice - costPrice) / costPrice) * 100;
                                          return calculatedMargin.toFixed(1);
                                        }
                                      }
                                      return '';
                                    })()}
                                    onChange={(e) => {
                                      const rawValue = e.target.value;
                                      
                                      // Limpar campos quando vazio
                                      if (rawValue === '') {
                                        handleEditProduct(idx, 'margin', null);
                                        // Não limpar salePrice, manter o preço existente do produto
                                        return;
                                      }
                                      
                                      // Permitir apenas números, vírgula, ponto e sinal negativo
                                      const cleanValue = rawValue.replace(/[^0-9.,\-]/g, '').replace(',', '.');
                                      
                                      // Se está digitando, não validar ainda
                                      if (cleanValue === '.' || cleanValue === '-' || cleanValue === '-.') {
                                        return;
                                      }
                                      
                                      const marginVal = parseFloat(cleanValue);
                                      if (!isNaN(marginVal)) {
                                        handleEditProduct(idx, 'margin', marginVal);
                                        // Calcular preço baseado na margem
                                        if (costPrice > 0) {
                                          const newSalePrice = calculateSalePrice(costPrice, marginVal);
                                          handleEditProduct(idx, 'salePrice', newSalePrice);
                                        }
                                      }
                                    }}
                                    disabled={!item.selected}
                                    placeholder="0"
                                    className="w-24 pl-3 pr-6 py-2 text-sm bg-surface border border-border rounded-md focus:border-brand focus:ring-1 focus:ring-brand outline-none disabled:opacity-50 text-right"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-sm text-text-muted pointer-events-none">%</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-text-muted mb-1 block">Custo</label>
                                <div className="px-3 py-2 bg-surface/50 rounded-md border border-border">
                                  <span className="text-sm font-semibold">R$ {costPrice.toFixed(2)}</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-text-muted mb-1 block">Preço Venda</label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text-muted pointer-events-none">R$</span>
                                  <input 
                                    type="text"
                                    value={(() => {
                                      const price = getEditedValue(idx, 'salePrice', salePrice);
                                      if (price == null) return '';
                                      return Number(price).toFixed(2).replace('.', ',');
                                    })()}
                                    onChange={(e) => {
                                      // Pega apenas números
                                      const digits = e.target.value.replace(/\D/g, '');
                                      
                                      if (digits === '') {
                                        handleEditProduct(idx, 'salePrice', null);
                                        return;
                                      }
                                      
                                      // Converte centavos para reais (ex: 900 -> 9.00)
                                      const numVal = Number(digits) / 100;
                                      handleEditProduct(idx, 'salePrice', numVal);
                                      
                                      // Calcular margem reversa quando edita preço (usando markup)
                                      if (numVal > 0 && costPrice > 0) {
                                        const margin = ((numVal - costPrice) / costPrice) * 100;
                                        handleEditProduct(idx, 'margin', Math.round(margin * 100) / 100);
                                      }
                                    }}
                                    disabled={!item.selected}
                                    placeholder="0,00"
                                    className="w-28 pl-7 pr-3 py-2 text-sm bg-surface border border-border rounded-md focus:border-brand focus:ring-1 focus:ring-brand outline-none disabled:opacity-50 text-right font-semibold text-success"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Vinculação manual */}
                            <div>
                              <label className="text-sm font-medium text-text-primary mb-1 block">
                                {item.isNew ? 'Vincular a Produto Existente (Opcional)' : 'Ação para este Produto'}
                              </label>
                              <div className="flex gap-2">
                                <Select
                                  value={linkedProductId === 'force-new' ? 'force-new' : (linkedProductId || (item.isNew ? 'new' : item.existing?.id || 'new'))}
                                  onValueChange={(value) => {
                                    if (value === 'new' || value === item.existing?.id) {
                                      handleLinkProduct(idx, null);
                                    } else if (value === 'search') {
                                      setProductSelectionModal({
                                        isOpen: true,
                                        productIndex: idx,
                                        currentProduct: item
                                      });
                                    } else {
                                      handleLinkProduct(idx, value);
                                    }
                                  }}
                                  disabled={!item.selected}
                                >
                                  <SelectTrigger className="flex-1 hover:bg-white/5 transition-colors text-xs sm:text-sm">
                                    <SelectValue placeholder={item.isNew ? "Criar novo" : "Atualizar existente"}>
                                      {linkedProductId && linkedProductId !== 'force-new' && linkedProductId !== 'new' ? (
                                        (() => {
                                          const linkedProduct = products?.find(p => p.id === linkedProductId);
                                          return linkedProduct ? `Vinculado: ${linkedProduct.name}` : (item.isNew ? "Criar novo" : "Atualizar existente");
                                        })()
                                      ) : linkedProductId === 'force-new' ? (
                                        "Criar novo (ignorar)"
                                      ) : (
                                        item.isNew ? "Criar novo" : "Atualizar existente"
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px] overflow-y-auto text-xs sm:text-sm">
                                    {item.isNew ? (
                                      <SelectItem value="new">Criar novo produto</SelectItem>
                                    ) : (
                                      <SelectItem value={item.existing?.id || 'new'}>
                                        Atualizar: {item.existing?.name} (Estoque: {item.existing?.stock || 0})
                                      </SelectItem>
                                    )}
                                    {!item.isNew && (
                                      <SelectItem value="force-new">
                                        Criar novo (ignorar existente)
                                      </SelectItem>
                                    )}
                                    <SelectItem value="search">
                                      Buscar produto para vincular
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            {/* Checkbox para atualizar preço (apenas produtos existentes) */}
                            {!item.isNew && (
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={getEditedValue(idx, 'updatePrice', false)}
                                  onChange={(e) => handleEditProduct(idx, 'updatePrice', e.target.checked)}
                                  disabled={!item.selected}
                                  className="w-4 h-4 rounded border-border bg-surface text-brand focus:ring-2 focus:ring-brand/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="text-text-secondary">Atualizar preço de custo e venda deste produto</span>
                              </label>
                            )}
                            
                            {/* Metadados */}
                            <div className="flex flex-wrap gap-2 text-xs">
                              {item.xml.codigo && (
                                <span className="px-2 py-1 bg-surface rounded border border-border">
                                  Código: {item.xml.codigo}
                                </span>
                              )}
                              {item.xml.ean && item.xml.ean !== 'SEM GTIN' && (
                                <span className="px-2 py-1 bg-surface rounded border border-border">
                                  EAN: {item.xml.ean}
                                </span>
                              )}
                              <span className="px-2 py-1 bg-surface rounded border border-border">
                                Unidade: {item.xml.unidade}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  <span>{productsPreview.filter(p => p.isNew && p.selected).length} novos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info"></div>
                  <span>{productsPreview.filter(p => !p.isNew && p.selected).length} existentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning"></div>
                  <span>{productsPreview.filter(p => editedProducts[p.index]?.linkedProductId).length} vinculados</span>
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
              <Button 
                onClick={handleShowConfirmation}
                disabled={productsPreview.filter(p => p.selected).length === 0}
              >
                Confirmar Importação ({productsPreview.filter(p => p.selected).length} de {productsPreview.length} produtos)
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Modal de seleção de produto */}
      <ProductSelectionModal
        isOpen={productSelectionModal.isOpen}
        onClose={() => setProductSelectionModal({ isOpen: false, productIndex: null, currentProduct: null })}
        onSelect={(selectedProduct) => {
          console.log('[XMLImportModal] onSelect chamado com produto:', selectedProduct);
          console.log('[XMLImportModal] Index do produto:', productSelectionModal.productIndex);
          handleLinkProduct(productSelectionModal.productIndex, selectedProduct.id);
          setProductSelectionModal({ isOpen: false, productIndex: null, currentProduct: null });
        }}
        currentProduct={productSelectionModal.currentProduct}
      />

      {/* Modal de confirmação de importação */}
      <ImportConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ isOpen: false })}
        onConfirm={handleConfirmImport}
        products={productsPreview.map((product, idx) => ({ ...product, originalIndex: idx }))}
        editedProducts={editedProducts}
        allProducts={products}
        isReprocess={false}
      />
    </Dialog>
  );
}
