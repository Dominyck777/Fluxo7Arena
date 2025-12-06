import React from 'react';
import { AlertTriangle, Package, TrendingUp, TrendingDown, Plus, RefreshCw, DollarSign, Hash, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ImportConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  products, 
  editedProducts,
  isReprocess = false,
  allProducts = [] // Lista completa de produtos para busca
}) {
  if (!isOpen || !products) return null;

  const selectedProducts = products.filter(p => p.selected);
  
  // Calcular resumo das mudanças
  const summary = selectedProducts.reduce((acc, product, idx) => {
    // Buscar o índice correto no editedProducts usando o índice original do produto
    const originalIndex = product.originalIndex !== undefined ? product.originalIndex : idx;
    const edited = editedProducts[originalIndex] || {};
    const linkedProductId = edited.linkedProductId;
    const updatePrice = edited.updatePrice;
    const newQuantity = Number(edited.quantity || edited.qty || product.xml?.quantidade || 0);
    // Para produtos vinculados, usar preço editado ou calcular baseado na margem do XML
    let newPrice = 0;
    if (edited.salePrice != null) {
      newPrice = Number(edited.salePrice);
    } else if (edited.margin != null && product.xml?.valorUnitario) {
      // Calcular preço baseado na margem editada
      const costPrice = Number(product.xml.valorUnitario);
      newPrice = costPrice * (1 + (edited.margin / 100));
    } else if (product.xml?.precoVenda) {
      newPrice = Number(product.xml.precoVenda);
    }

    if (product.isNew && !linkedProductId) {
      // Produto novo será criado
      acc.newProducts.push({
        name: edited.name || product.xml?.nome,
        quantity: newQuantity,
        price: newPrice,
        total: newQuantity * (product.xml?.valorUnitario || 0),
        xmlName: product.xml?.nome
      });
    } else if (linkedProductId || product.existing) {
      // Produto existente será atualizado
      const existingProduct = linkedProductId 
        ? allProducts.find(p => p.id === linkedProductId) || product.existing
        : product.existing;
      const currentStock = Number(existingProduct?.stock || 0);
      const currentPrice = Number(existingProduct?.preco_venda || existingProduct?.salePrice || existingProduct?.price || 0);
      const stockChange = isReprocess ? 0 : newQuantity;
      const newStock = isReprocess ? currentStock : currentStock + newQuantity;
      
      acc.updatedProducts.push({
        name: existingProduct?.name || edited.name || product.xml?.nome,
        currentStock,
        newStock,
        stockChange,
        currentPrice,
        newPrice: updatePrice ? newPrice : currentPrice,
        priceChange: updatePrice ? (newPrice - currentPrice) : 0,
        willUpdatePrice: updatePrice,
        total: newQuantity * (product.xml?.valorUnitario || 0),
        xmlName: product.xml?.nome,
        isLinked: !!linkedProductId,
        linkedProductId,
        linkedProductName: linkedProductId ? existingProduct?.name : null
      });
    } else if (linkedProductId) {
      // Produto vinculado manualmente
      acc.linkedProducts.push({
        xmlName: product.xml?.nome,
        linkedName: edited.name || product.xml?.nome,
        quantity: newQuantity,
        total: newQuantity * (product.xml?.valorUnitario || 0),
        linkedProductId
      });
    }

    acc.totalValue += newQuantity * (product.xml?.valorUnitario || 0);
    acc.totalItems += newQuantity;
    
    return acc;
  }, {
    newProducts: [],
    updatedProducts: [],
    linkedProducts: [],
    totalValue: 0,
    totalItems: 0
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Confirmar {isReprocess ? 'Reprocessamento' : 'Importação'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Resumo Geral */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-text-primary mb-2">
                <Package className="h-4 w-4 text-warning" />
                <span className="font-medium">Total de Produtos</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{selectedProducts.length}</p>
            </div>
            
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-text-primary mb-2">
                <Hash className="h-4 w-4 text-warning" />
                <span className="font-medium">Total de Itens</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{summary.totalItems}</p>
            </div>
            
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-text-primary mb-2">
                <DollarSign className="h-4 w-4 text-warning" />
                <span className="font-medium">Valor Total</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                R$ {summary.totalValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Produtos Novos */}
          {!isReprocess && summary.newProducts.length > 0 && (
            <div className="bg-surface rounded-lg border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <Plus className="h-4 w-4 text-success" />
                  Produtos que serão criados ({summary.newProducts.length})
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {summary.newProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border">
                    <div>
                      <p className="font-medium text-text-primary">{product.name}</p>
                      <p className="text-sm text-text-muted">
                        Quantidade: {product.quantity} • Preço unit.: R$ {(product.total / product.quantity).toFixed(2)} • Total: R$ {product.total.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-warning">R$ {product.total.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Produtos Atualizados */}
          {!isReprocess && summary.updatedProducts.length > 0 && (
            <div className="bg-surface rounded-lg border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-info" />
                  Produtos que serão atualizados ({summary.updatedProducts.length})
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {summary.updatedProducts.map((product, idx) => (
                  <div key={idx} className="p-3 bg-surface-2 rounded-lg border border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {product.isLinked ? (
                          <div className="flex items-center gap-2 mb-1">
                            <Link2 className="h-4 w-4 text-warning" />
                            <p className="font-medium text-text-primary">
                              {product.xmlName} → {product.linkedProductName || product.name}
                            </p>
                          </div>
                        ) : (
                          <p className="font-medium text-text-primary">{product.name}</p>
                        )}
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {/* Estoque */}
                          {isReprocess ? (
                            <div className="flex items-center gap-2">
                              <span className="text-text-muted">Estoque:</span>
                              <span className="font-medium text-text-primary">{product.currentStock}</span>
                              <span className="text-text-muted">(sem alteração no reprocesso)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-text-muted">Estoque:</span>
                              <span className="font-medium text-text-primary">{product.currentStock}</span>
                              <TrendingUp className="h-3 w-3 text-success" />
                              <span className="font-medium text-success">{product.newStock}</span>
                              <span className="text-success">(+{product.stockChange})</span>
                            </div>
                          )}

                          {/* Preço */}
                          {product.willUpdatePrice && product.priceChange !== 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-text-muted">Preço:</span>
                              <span className="font-medium text-text-primary">R$ {product.currentPrice.toFixed(2)}</span>
                              {product.priceChange > 0 ? (
                                <TrendingUp className="h-3 w-3 text-success" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-destructive" />
                              )}
                              <span className={`font-medium ${product.priceChange > 0 ? 'text-success' : 'text-destructive'}`}>
                                R$ {product.newPrice.toFixed(2)}
                              </span>
                              <span className={product.priceChange > 0 ? 'text-success' : 'text-destructive'}>
                                ({product.priceChange > 0 ? '+' : ''}R$ {product.priceChange.toFixed(2)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {isReprocess ? (
                          <p className="text-xs text-text-muted">Total NF-e (custo): R$ {product.total.toFixed(2)}</p>
                        ) : (
                          <p className="text-xs text-text-muted">Unit.: R$ {(product.total / product.stockChange).toFixed(2)}</p>
                        )}
                        <p className="font-medium text-warning">R$ {product.total.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isReprocess && (
            <div className="bg-surface rounded-lg border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-info" />
                  Itens da NF-e que serão reprocessados ({selectedProducts.length})
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {selectedProducts.map((product, idx) => {
                  const originalIndex = product.originalIndex !== undefined ? product.originalIndex : idx;
                  const edited = editedProducts[originalIndex] || {};
                  const quantity = Number(edited.quantity || edited.qty || product.xml?.quantidade || 0);
                  const unitCost = Number(product.xml?.valorUnitario || 0);
                  const total = quantity * unitCost;
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border">
                      <div>
                        <p className="font-medium text-text-primary">{product.xml?.nome}</p>
                        <p className="text-sm text-text-muted">
                          Quantidade: {quantity} • Valor unit.: R$ {unitCost.toFixed(2)} • Total: R$ {total.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-warning">R$ {total.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aviso importante */}
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-warning mb-2">
                  {isReprocess ? 'Atenção - Reprocessamento' : 'Atenção - Importação'}
                </h4>
                <ul className="text-sm text-text-muted space-y-1">
                  {isReprocess ? (
                    <>
                      <li>• Os itens atuais da compra serão substituídos pelos selecionados</li>
                      <li>• As quantidades de estoque serão ajustadas conforme as mudanças</li>
                      <li>• Esta ação não pode ser desfeita automaticamente</li>
                    </>
                  ) : (
                    <>
                      <li>• Os produtos selecionados serão criados ou atualizados no sistema</li>
                      <li>• As quantidades serão adicionadas ao estoque atual</li>
                      <li>• Uma nova compra será registrada no histórico</li>
                    </>
                  )}
                  <li>• Verifique cuidadosamente as informações antes de confirmar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-text-muted">
            {selectedProducts.length} produto{selectedProducts.length !== 1 ? 's' : ''} selecionado{selectedProducts.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onConfirm} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Confirmar {isReprocess ? 'Reprocessamento' : 'Importação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
