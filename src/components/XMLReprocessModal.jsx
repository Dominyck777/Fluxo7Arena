import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Plus, RefreshCw, Copy, Link2, Trash2, ChevronDown, ChevronRight, Minus } from 'lucide-react';
import { parseNFeXML, findExistingProduct, convertXMLProductToSystemFormat } from '@/lib/xmlParser';
import { createProduct, adjustProductStock, updateProduct, deleteProduct, listProducts } from '@/lib/products';
import { reprocessPurchaseXML, getPurchaseItems } from '@/lib/purchases';
import { cn } from '@/lib/utils';
import ProductSelectionModal from './ProductSelectionModal';
import ImportConfirmationModal from './ImportConfirmationModal';

export default function XMLReprocessModal({ open, onOpenChange, purchase, products, codigoEmpresa, onSuccess, autoFile }) {
  const { toast } = useToast();
  const [step, setStep] = useState('upload'); // upload | preview | processing | done
  const [xmlFile, setXmlFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [productsPreview, setProductsPreview] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({ created: 0, updated: 0, errors: 0, details: [] });
  const [editedProducts, setEditedProducts] = useState({}); // { index: { name, qty, margin, linkedProductId, updatePrice } }
  const [expandedProducts, setExpandedProducts] = useState({});
  const [persistedSelections, setPersistedSelections] = useState({});
  const [productSelectionModal, setProductSelectionModal] = useState({ isOpen: false, productIndex: null, currentProduct: null });
  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false });

  const getNFeModelLabel = () => {
    const modelo = parsedData?.nfe?.modelo || purchase?.modelo_nfe;
    if (modelo === '55') return 'NF-e';
    if (modelo === '65') return 'NFC-e';
    return 'NF-e / NFC-e';
  };

  const getEditedValue = (index, field, defaultValue) => {
    return editedProducts[index]?.[field] ?? defaultValue;
  };

  const calculateSalePrice = (costPrice, margin) => {
    if (!costPrice || !margin) return 0;
    return costPrice * (1 + margin / 100);
  };

  const toggleExpand = (index) => {
    setExpandedProducts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleEditProduct = (index, field, value) => {
    console.log('[XMLReprocessModal] handleEditProduct chamado:', { index, field, value });
    setEditedProducts(prev => {
      const newState = {
        ...prev,
        [index]: {
          ...prev[index],
          [field]: value
        }
      };
      console.log('[XMLReprocessModal] Novo estado editedProducts:', newState);
      return newState;
    });
  };

  const handleToggleSelect = (index) => {
    setProductsPreview(prev => prev.map((item, idx) => {
      if (idx === index) {
        const newSelected = !item.selected;
        setPersistedSelections(prevPersisted => ({
          ...prevPersisted,
          [index]: newSelected
        }));
        return { ...item, selected: newSelected };
      }
      return item;
    }));
  };

  const handleLinkProduct = (index, productId) => {
    console.log('[XMLReprocessModal] handleLinkProduct chamado:', { index, productId });
    console.log('[XMLReprocessModal] Estado editedProducts antes:', editedProducts[index]);
    handleEditProduct(index, 'linkedProductId', productId);
    console.log('[XMLReprocessModal] Estado editedProducts depois:', { ...editedProducts, [index]: { ...editedProducts[index], linkedProductId: productId } });
  };

  // Processar arquivo automático quando fornecido
  useEffect(() => {
    if (autoFile && open) {
      processAutoFile(autoFile);
    }
  }, [autoFile, open]);

  const processAutoFile = async (file) => {
    const isAutoFile = true;
    setXmlFile(file);
    
    try {
      console.log('[XMLReprocess] Processando arquivo automático...');
      console.log('[XMLReprocess] Purchase data:', purchase);
      const text = await file.text();
      console.log('[XMLReprocess] XML content length:', text.length);
      const parsed = parseNFeXML(text);
      
      if (!parsed.success) {
        toast({ title: 'Erro ao ler XML', description: parsed.error || 'XML inválido', variant: 'destructive' });
        return;
      }

      // Verificar se é o mesmo XML da compra
      console.log('[XMLReprocess] Dados parseados:', parsed.data);
      console.log('[XMLReprocess] Produtos encontrados:', parsed.data?.produtos?.length || 0);
      console.log('[XMLReprocess] Comparando chaves:', {
        xmlChave: parsed.data?.nfe?.chaveAcesso,
        purchaseChave: purchase?.chave_nfe,
        match: parsed.data?.nfe?.chaveAcesso === purchase?.chave_nfe
      });
      
      // Pular validação de chave para reprocessamento automático (XML já é da mesma compra)
      if (!isAutoFile && parsed.data?.nfe?.chaveAcesso !== purchase?.chave_nfe) {
        toast({ 
          title: 'XML incompatível', 
          description: `XML: ${parsed.data?.nfe?.chaveAcesso} ≠ NF-e: ${purchase?.chave_nfe}`, 
          variant: 'destructive' 
        });
        return;
      }

      setParsedData(parsed.data);
      
      // Buscar itens que foram realmente importados na compra original
      const purchaseItems = await getPurchaseItems(purchase.id);
      console.log('[XMLReprocess] Itens da compra original:', purchaseItems.length);
      
      // Preparar preview dos produtos baseado apenas nos itens importados
      const preview = parsed.data?.produtos?.map((produto, index) => {
        const existing = findExistingProduct(produto, products);
        const isNew = !existing;
        
        // Verificar se este produto foi realmente importado na compra original
        // IMPORTANTE: Usar busca mais restritiva para evitar matches incorretos
        const originalItem = purchaseItems.find(item => {
          // Priorizar código do produto se disponível
          if (produto.codigo && item.codigo_produto_xml) {
            return item.codigo_produto_xml === produto.codigo;
          }
          // Senão, usar nome exato
          return item.nome_produto_xml === produto.nome;
        });
        
        const wasImported = !!originalItem;
        const wasSelectedInOriginalImport = originalItem?.selecionado_na_importacao || false;
        
        console.log(`[XMLReprocess] Produto ${index + 1}: ${produto.nome}`);
        console.log(`  - Código XML: ${produto.codigo}`);
        console.log(`  - originalItem encontrado:`, originalItem ? `${originalItem.nome_produto_xml} (código: ${originalItem.codigo_produto_xml})` : 'NÃO ENCONTRADO');
        console.log(`  - wasImported: ${wasImported}`);
        console.log(`  - wasSelectedInOriginalImport: ${wasSelectedInOriginalImport}`);
        
        return {
          index,
          xml: produto,
          existing,
          isNew,
          wasImported,
          selected: persistedSelections[index] !== undefined 
            ? persistedSelections[index] 
            : wasImported // Se foi importado originalmente, marcar como selecionado
        };
      }) || [];
      
      console.log('[XMLReprocess] Preview preparado:', preview.length, 'produtos');
      console.log('[XMLReprocess] Produtos marcados:', preview.filter(p => p.selected).length);
      console.log('[XMLReprocess] Produtos importados originalmente:', preview.filter(p => p.wasImported).length);
      console.log('[XMLReprocess] Items da compra original detalhado:');
      purchaseItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.nome_produto_xml} (código: ${item.codigo_produto_xml}) - selecionado_na_importacao: ${item.selecionado_na_importacao}`);
      });
      setProductsPreview(preview);

      const initialEditedProducts = {};
      preview.forEach((item, idx) => {
        if (item.xml.precoVenda) {
          initialEditedProducts[idx] = {
            salePrice: Number(item.xml.precoVenda)
          };
        }
      });
      console.log('[XMLReprocess] Pré-populando editedProducts:', initialEditedProducts);
      setEditedProducts(initialEditedProducts);

      setStep('preview');
      
    } catch (error) {
      console.error('[XMLReprocess] Erro ao processar arquivo automático:', error);
      toast({ title: 'Erro', description: 'Erro ao processar o XML salvo.', variant: 'destructive' });
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[XMLReprocess] Nenhum arquivo selecionado');
      return;
    }

    console.log('[XMLReprocess] Arquivo selecionado:', file.name);

    if (!file.name.endsWith('.xml')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione um arquivo XML válido.', variant: 'destructive' });
      return;
    }

    setXmlFile(file);
    
    try {
      console.log('[XMLReprocess] Lendo conteúdo do arquivo...');
      const text = await file.text();
      console.log('[XMLReprocess] Arquivo lido, parseando XML...');
      const parsed = parseNFeXML(text);
      console.log('[XMLReprocess] XML parseado:', parsed);
      
      if (!parsed.success) {
        toast({ title: 'Erro ao ler XML', description: parsed.error || 'XML inválido', variant: 'destructive' });
        return;
      }

      if (!parsed.data?.produtos || parsed.data.produtos.length === 0) {
        toast({ title: 'Nenhum produto encontrado', description: 'O XML não contém produtos.', variant: 'warning' });
        return;
      }

      // Verificar se é o mesmo XML da compra
      if (parsed.data?.nfe?.chaveAcesso !== purchase?.chave_nfe) {
        toast({ 
          title: 'XML incompatível', 
          description: 'Este XML não corresponde à NF-e selecionada. Verifique a chave de acesso.', 
          variant: 'destructive' 
        });
        return;
      }

      setParsedData(parsed.data);
      
      // Buscar TODOS os produtos do banco para validação precisa (incluindo inativos)
      let allProducts = products;
      try {
        const fullList = await listProducts({ 
          search: '', 
          codigoEmpresa,
          includeInactive: true  // IMPORTANTE: incluir inativos para evitar duplicação
        });
        allProducts = fullList || products;
        console.log('[XMLReprocess] Produtos carregados para validação:', allProducts.length);
      } catch (err) {
        console.warn('[XMLReprocess] Não foi possível carregar lista completa, usando cache:', err);
      }
      
      // Validar produtos: novos vs existentes
      const preview = parsed.data.produtos.map((prodXML, idx) => {
        const existing = findExistingProduct(prodXML, allProducts);
        return {
          xml: prodXML,
          existing: existing,
          isNew: !existing,
          willCreate: !existing,
          willUpdate: !!existing,
          selected: true, // Por padrão, todos selecionados
          index: idx
        };
      });
      
      setProductsPreview(preview);

      const initialEditedProducts = {};
      preview.forEach((item, idx) => {
        if (item.xml.precoVenda) {
          initialEditedProducts[idx] = {
            salePrice: Number(item.xml.precoVenda)
          };
        }
      });
      console.log('[XMLReprocess] Pré-populando editedProducts:', initialEditedProducts);
      setEditedProducts(initialEditedProducts);

      console.log('[XMLReprocess] Preview preparado, mudando para step preview. Total produtos:', preview.length);
      setStep('preview');
      
    } catch (error) {
      console.error('[XMLReprocess] Erro ao processar arquivo:', error);
      toast({ title: 'Erro', description: 'Erro ao processar o arquivo XML.', variant: 'destructive' });
    }
  };

  const loadProducts = async () => {
    try {
      const { codigoEmpresa } = useAuthStore.getState();
      console.log('[XMLReprocess] Carregando produtos para empresa:', codigoEmpresa);
      const result = await listProducts({ includeInactive: true, codigoEmpresa });
      console.log('[XMLReprocess] Produtos carregados:', result?.length || 0);
      setProducts(result || []);
    } catch (error) {
      console.error('[XMLReprocess] Erro ao carregar produtos:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar produtos', variant: 'destructive' });
    }
  };

  // Abrir modal de confirmação
  const handleShowConfirmation = () => {
    setConfirmationModal({ isOpen: true });
  };

  const handleConfirmReprocess = async () => {
    setConfirmationModal({ isOpen: false });
    if (!parsedData || !purchase) {
      toast({ title: 'Erro', description: 'Dados insuficientes para reprocessamento.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setStep('processing');
    
    const results = { created: 0, updated: 0, removed: 0, errors: 0, details: [] };
    const selectedProducts = productsPreview.filter(item => item.selected);
    const unselectedProducts = productsPreview.filter(item => !item.selected);
    
    console.log('[XMLReprocess] Iniciando reprocessamento para compra:', purchase.id);
    console.log('[XMLReprocess] Produtos selecionados:', selectedProducts.length);
    console.log('[XMLReprocess] Produtos desmarcados:', unselectedProducts.length);

    try {

      // ETAPA 2: Processar produtos desmarcados (reverter/remover)
      for (const item of unselectedProducts) {
        const edited = editedProducts[item.index] || {};
        const name = edited.name || item.xml.nome;
        const originalQty = Number(item.xml.quantidade);

        try {
          if (item.isNew) {
            // Produto novo desmarcado - remover do sistema se foi criado
            const targetProduct = item.existing;
            if (targetProduct) {
              await deleteProduct(targetProduct.id);
              results.removed++;
              results.details.push({
                produto: name,
                acao: 'Produto removido (era novo e foi desmarcado)',
                status: 'success'
              });
            }
          } else {
            // Produto existente desmarcado - reverter estoque
            const targetProduct = item.existing;
            if (targetProduct && originalQty > 0) {
              await adjustProductStock({
                productId: targetProduct.id,
                delta: -originalQty, // Subtrair o que foi adicionado
                codigoEmpresa: purchase.codigo_empresa
              });
              results.updated++;
              results.details.push({
                produto: name,
                acao: `Estoque revertido -${originalQty}`,
                status: 'success'
              });
            }
          }
        } catch (error) {
          console.error(`[XMLReprocess] Erro ao processar produto desmarcado: ${name}`, error);
          results.errors++;
          results.details.push({
            produto: name,
            acao: `Erro ao reverter: ${error.message}`,
            status: 'error'
          });
        }
      }

      // ETAPA 3: Processar produtos selecionados (criar/atualizar)
      for (const item of selectedProducts) {
        const edited = editedProducts[item.index] || {};
        const finalName = edited.name || item.xml.nome;
        const finalQty = edited.qty !== undefined ? edited.qty : Number(item.xml.quantidade);
        const finalMargin = edited.margin;
        const finalSalePrice = edited.salePrice;
        const linkedProductId = edited.linkedProductId;

        try {
          if (item.isNew && (!linkedProductId || linkedProductId === 'new')) {
            // Produto novo - criar (similar à importação)
            const productData = convertXMLProductToSystemFormat(item.xml, purchase.codigo_empresa);

            // Aplicar nome editado
            if (finalName) {
              productData.name = finalName;
            }

            // Usar preço editado manualmente OU calcular pela margem
            if (finalSalePrice != null) {
              productData.salePrice = finalSalePrice;
              productData.price = finalSalePrice;
            } else if (finalMargin != null && finalMargin > 0) {
              const custoUnitario = productData.costPrice || 0;
              if (custoUnitario > 0) {
                const precoVenda = custoUnitario * (1 + finalMargin / 100);
                productData.salePrice = precoVenda;
                productData.price = precoVenda;
              }
            } else if (productData.salePrice != null && productData.price == null) {
              productData.price = productData.salePrice;
            }

            const newProduct = await createProduct(productData, { codigoEmpresa: purchase.codigo_empresa });

            // Ajustar estoque se necessário (mantém comportamento atual)
            if (finalQty > 0) {
              await adjustProductStock({
                productId: newProduct.id,
                delta: finalQty,
                codigoEmpresa: purchase.codigo_empresa
              });
            }

            results.created++;
            results.details.push({ 
              produto: finalName, 
              acao: finalQty > 0 ? `Criado com estoque ${finalQty}` : 'Criado', 
              status: 'success' 
            });
          } else {
            // Produto existente - NÃO ajustar estoque no reprocessamento
            // O estoque já foi ajustado na importação original
            const targetProduct = linkedProductId && linkedProductId !== 'force-new' && linkedProductId !== 'new'
              ? products.find(p => p.id === linkedProductId)
              : item.existing;

            // Atualizar preço se solicitado (mesma lógica do importar)
            if (edited.updatePrice && targetProduct) {
              const xmlCusto = Number(item.xml.valorUnitario) || 0;
              const updateData = {};

              if (xmlCusto > 0) {
                updateData.costPrice = xmlCusto;
              }

              if (finalSalePrice != null) {
                updateData.salePrice = finalSalePrice;
                updateData.price = finalSalePrice;
              } else if (finalMargin != null && finalMargin > 0 && xmlCusto > 0) {
                const precoVenda = xmlCusto * (1 + finalMargin / 100);
                updateData.salePrice = precoVenda;
                updateData.price = precoVenda;
              }

              await updateProduct(targetProduct.id, updateData);
            }

            results.updated++;
            results.details.push({ 
              produto: finalName, 
              acao: edited.updatePrice ? 'Preço atualizado' : 'Mantido sem alterações', 
              status: 'success' 
            });
          }
        } catch (error) {
          console.error(`[XMLReprocess] Erro ao processar produto: ${finalName}`, error);
          results.errors++;
          results.details.push({ 
            produto: finalName, 
            acao: `Erro: ${error.message}`, 
            status: 'error' 
          });
        }
      }
    } catch (error) {
      console.error('[XMLReprocess] Erro geral no reprocessamento:', error);
      results.errors++;
      results.details.push({
        produto: 'Sistema',
        acao: `Erro geral: ${error.message}`,
        status: 'error',
        error: error.message
      });
    }
    
    // Reprocessar itens da compra
    try {
      const purchaseItems = selectedProducts.map(item => {
        const edited = editedProducts[item.index] || {};
        const linkedProductId = edited.linkedProductId;
        
        // Determinar o ID do produto
        let productId = null;
        if (linkedProductId && linkedProductId !== 'force-new') {
          productId = linkedProductId;
        } else if (!item.isNew && linkedProductId !== 'force-new') {
          productId = item.existing?.id || null;
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
          vinculadoManualmente: !!linkedProductId && linkedProductId !== 'force-new',
        };
      });
      
      await reprocessPurchaseXML(purchase.id, purchaseItems);
      console.log('[XMLReprocess] Itens reprocessados:', purchaseItems.length);
      
    } catch (error) {
      console.error('[XMLReprocess] Erro ao reprocessar itens da compra:', error);
      results.errors++;
      results.details.push({ 
        produto: 'Itens da NF-e', 
        acao: 'Erro ao reprocessar', 
        status: 'error', 
        error: error.message 
      });
    }
    
    setResults(results);
    setProcessing(false);
    setStep('done');
    
    // Notificar sucesso
    if (results.errors === 0) {
      toast({ 
        title: 'Reprocessamento concluído!', 
        description: `${results.created} produto(s) criado(s), ${results.updated} atualizado(s).`,
        variant: 'success' 
      });
    } else {
      toast({ 
        title: 'Reprocessamento com erros', 
        description: `${results.errors} erro(s) encontrado(s). Verifique os detalhes.`,
        variant: 'destructive' 
      });
    }
    
    // Chamar callback de sucesso
    if (onSuccess) {
      onSuccess();
    }
  };

  // Limpar estados quando modal fecha
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setXmlFile(null);
      setParsedData(null);
      setProductsPreview([]);
      setEditedProducts({});
      setExpandedProducts({});
      setResults({ created: 0, updated: 0, errors: 0, details: [] });
      setProcessing(false);
      setPersistedSelections({});
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const toggleProductSelection = (index) => {
    setProductsPreview(prev => prev.map(item => 
      item.index === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const toggleExpanded = (index) => {
    setExpandedProducts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const updateEditedProduct = (index, field, value) => {
    setEditedProducts(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  const selectedCount = productsPreview.filter(item => item.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <span>Reprocessar XML</span>
            <span className="inline-flex items-center rounded-full bg-surface-2 border border-border px-2 py-0.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
              {getNFeModelLabel()}
            </span>
            <span className="text-sm text-text-muted">{purchase?.numero_nfe}</span>
          </DialogTitle>
          <DialogDescription>
            Reimporte o XML para atualizar os produtos e itens desta NF-e. 
            Os itens atuais serão substituídos pelos novos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-text-muted mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecione o arquivo XML</h3>
                <p className="text-text-muted mb-4">
                  Faça upload do XML da NF-e {purchase?.numero_nfe} para reprocessar os produtos
                </p>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="xml-reprocess-upload"
                />
                <label htmlFor="xml-reprocess-upload">
                  <Button asChild>
                    <span>Selecionar XML</span>
                  </Button>
                </label>
              </div>
            </div>
          )}

          {step === 'preview' && parsedData && (
            <div className="space-y-6">
              {/* Informações da NF-e */}
              <div className="bg-surface-2 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Informações da NF-e</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">Número:</span> {parsedData.nfe.numero}
                  </div>
                  <div>
                    <span className="text-text-muted">Série:</span> {parsedData.nfe.serie}
                  </div>
                  <div>
                    <span className="text-text-muted">Modelo:</span> {getNFeModelLabel()}
                  </div>
                  <div>
                    <span className="text-text-muted">Fornecedor:</span> {parsedData.fornecedor?.nome}
                  </div>
                  <div>
                    <span className="text-text-muted">Total:</span> R$ {Number(parsedData.nfe.totalNota || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Lista de produtos */}
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base">Produtos Encontrados</h3>
                  <span className="text-sm text-text-muted">
                    {productsPreview.filter(p => p.selected).length} de {productsPreview.length} selecionados
                  </span>
                </div>
                
                <div className="space-y-2">
                  {productsPreview.map((item, idx) => {
                    const editedName = getEditedValue(idx, 'name', item.xml.nome);
                    const editedQty = getEditedValue(idx, 'qty', Number(item.xml.quantidade));
                    const linkedProductId = getEditedValue(idx, 'linkedProductId', null);
                    const costPrice = item.xml.valorUnitario || 0;
                    const editedMargin = getEditedValue(idx, 'margin', null);
                    const editedSalePrice = getEditedValue(idx, 'salePrice', null);

                    // Calcular preço de venda (prioridade: editado manualmente > produto existente > calculado por margem > preço XML)
                    let salePrice = editedSalePrice;
                    if (salePrice == null && !item.isNew && item.existing) {
                      salePrice = Number(item.existing.preco_venda || item.existing.salePrice || item.existing.price || 0);
                    }
                    if (salePrice == null && editedMargin != null) {
                      salePrice = calculateSalePrice(costPrice, editedMargin);
                    }
                    if (salePrice == null && item.xml.precoVenda) {
                      salePrice = Number(item.xml.precoVenda);
                    }

                    // Calcular margem exibida
                    let displayMargin = null;
                    if (editedMargin != null) {
                      displayMargin = editedMargin;
                    } else if (salePrice != null && costPrice > 0 && salePrice > 0) {
                      const calculatedMargin = ((salePrice - costPrice) / costPrice) * 100;
                      displayMargin = Math.max(-999, Math.min(9999, calculatedMargin));
                    }

                    const isExpanded = expandedProducts[idx];
                    
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "rounded-lg border transition-all",
                          item.selected ? "bg-info/10 border-info/30" : "bg-surface opacity-60 border-border"
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
                              {linkedProductId ? (
                                <Link2 className="w-5 h-5 text-warning" />
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
                                  {linkedProductId && linkedProductId !== 'force-new' && linkedProductId !== 'new' ? (
                                    (() => {
                                      const linkedProduct = products.find(p => p.id === linkedProductId);
                                      return linkedProduct ? linkedProduct.name : editedName;
                                    })()
                                  ) : editedName}
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
                                {linkedProductId ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">Vinculado</span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-info/20 text-info font-medium">Cadastrado</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-1 text-[11px] text-text-muted">
                              <span>
                                R$ {costPrice.toFixed(2)}
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
                                      return margin != null ? String(margin) : '';
                                    })()}
                                    onChange={(e) => {
                                      const rawValue = e.target.value;
                                      
                                      // Permitir campo vazio
                                      if (rawValue === '') {
                                        handleEditProduct(idx, 'margin', null);
                                        handleEditProduct(idx, 'salePrice', null);
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
                                        // Calcular preço baseado na margem, igual ao XMLImportModal
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
                            
                            {/* Checkbox Atualizar Preço */}
                            <div className="flex items-center space-x-2 mt-3">
                              <input
                                type="checkbox"
                                id={`update-price-${idx}`}
                                checked={getEditedValue(idx, 'updatePrice', false)}
                                onChange={(e) => handleEditProduct(idx, 'updatePrice', e.target.checked)}
                                disabled={!item.selected}
                                className="w-4 h-4 text-brand bg-surface border-border rounded focus:ring-brand focus:ring-2 disabled:opacity-50"
                              />
                              <label 
                                htmlFor={`update-price-${idx}`} 
                                className="text-sm text-text-primary select-none cursor-pointer"
                              >
                                Atualizar preço do produto no sistema
                              </label>
                            </div>
                            
                            {/* Vinculação manual */}
                            <div>
                              <label className="text-sm font-medium text-text-primary mb-1 block">
                                Vincular a Produto Existente (Opcional)
                              </label>
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
                                <SelectTrigger className="w-full hover:bg-white/5 transition-colors">
                                  <SelectValue placeholder={item.isNew ? "🆕 Criar como novo produto" : "♻️ Atualizar produto existente"} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] overflow-y-auto">
                                  {item.isNew ? (
                                    <SelectItem value="new">🆕 Criar como novo produto</SelectItem>
                                  ) : (
                                    <SelectItem value={item.existing?.id || 'new'}>
                                      ♻️ Atualizar: {item.existing?.name} (Estoque atual: {item.existing?.stock || 0})
                                    </SelectItem>
                                  )}
                                  {!item.isNew && (
                                    <SelectItem value="force-new">
                                      🆕 Criar como novo produto (ignorar existente)
                                    </SelectItem>
                                  )}
                                  <SelectItem value="search">
                                    🔍 Buscar produto para vincular...
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-brand mb-4" />
              <h3 className="text-lg font-semibold mb-2">Reprocessando XML...</h3>
              <p className="text-text-muted">Atualizando produtos e itens da NF-e</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6">
              <div className="text-center py-6">
                {results.errors === 0 ? (
                  <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
                )}
                <h3 className="text-lg font-semibold mb-2">
                  {results.errors === 0 ? 'Reprocessamento Concluído!' : 'Reprocessamento com Erros'}
                </h3>
                <div className="text-text-muted">
                  {results.created} produto(s) criado(s), {results.updated} atualizado(s)
                  {results.errors > 0 && `, ${results.errors} erro(s)`}
                </div>
              </div>

              {results.details.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Detalhes do Reprocessamento</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.details.map((detail, index) => (
                      <div key={index} className={cn(
                        "flex items-center gap-3 p-2 rounded",
                        detail.status === 'success' ? 'bg-green-50 text-green-800' :
                        detail.status === 'error' ? 'bg-red-50 text-red-800' :
                        'bg-gray-50 text-gray-800'
                      )}>
                        {detail.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{detail.produto}</div>
                          <div className="text-xs">{detail.acao}</div>
                          {detail.error && (
                            <div className="text-xs mt-1 opacity-75">{detail.error}</div>
                          )}
                        </div>
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
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button 
                onClick={handleShowConfirmation}
                disabled={selectedCount === 0}
              >
                Reprocessar ({selectedCount} produtos)
              </Button>
            </>
          )}
          
          {step === 'done' && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Modal de seleção de produto */}
      <ProductSelectionModal
        isOpen={productSelectionModal.isOpen}
        onClose={() => setProductSelectionModal({ isOpen: false, productIndex: null, currentProduct: null })}
        onSelect={(selectedProduct) => {
          console.log('[XMLReprocessModal] onSelect chamado com produto:', selectedProduct);
          console.log('[XMLReprocessModal] Index do produto:', productSelectionModal.productIndex);
          handleLinkProduct(productSelectionModal.productIndex, selectedProduct.id);
          setProductSelectionModal({ isOpen: false, productIndex: null, currentProduct: null });
        }}
        currentProduct={productSelectionModal.currentProduct}
      />

      {/* Modal de confirmação de reprocessamento */}
      <ImportConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ isOpen: false })}
        onConfirm={handleConfirmReprocess}
        products={productsPreview.map((product, idx) => ({ ...product, originalIndex: idx }))}
        editedProducts={editedProducts}
        allProducts={products}
        isReprocess={true}
      />
    </Dialog>
  );
}
