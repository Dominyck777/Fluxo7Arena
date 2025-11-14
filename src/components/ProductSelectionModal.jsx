import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { listProducts } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';

export default function ProductSelectionModal({ isOpen, onClose, onSelect, currentProduct }) {
  const { userProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (isOpen && userProfile?.codigo_empresa) {
      loadProducts();
    }
  }, [isOpen, userProfile?.codigo_empresa]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.log('[ProductSelectionModal] Carregando produtos para empresa:', userProfile.codigo_empresa);
      const data = await listProducts({
        codigoEmpresa: userProfile.codigo_empresa,
        includeInactive: false,
        search: ''
      });
      console.log('[ProductSelectionModal] Produtos carregados:', data?.length || 0);
      console.log('[ProductSelectionModal] Primeiro produto:', data?.[0]);
      console.log('[ProductSelectionModal] Estrutura do produto:', Object.keys(data?.[0] || {}));
      setProducts(data || []);
    } catch (error) {
      console.error('[ProductSelectionModal] Erro ao carregar produtos:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar produtos baseado na busca
  const filteredProducts = useMemo(() => {
    console.log('[ProductSelectionModal] Filtrando produtos. Total:', products.length, 'Busca:', searchTerm);
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = products.filter(product => 
      (product.name || product.nome)?.toLowerCase().includes(term) ||
      (product.code || product.codigo_produto)?.toLowerCase().includes(term) ||
      (product.barcode || product.codigo_barras)?.toLowerCase().includes(term)
    );
    console.log('[ProductSelectionModal] Produtos filtrados:', filtered.length);
    return filtered;
  }, [products, searchTerm]);

  const handleSelect = () => {
    if (selectedProduct) {
      console.log('[ProductSelectionModal] Produto selecionado para vinculação:', selectedProduct);
      console.log('[ProductSelectionModal] ID do produto:', selectedProduct.id);
      console.log('[ProductSelectionModal] Nome do produto:', selectedProduct.name);
      onSelect(selectedProduct);
      handleClose();
    } else {
      console.log('[ProductSelectionModal] ERRO: Nenhum produto selecionado');
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedProduct(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-black text-white border border-neutral-700">
        <DialogHeader className="bg-neutral-900 -mx-6 -mt-6 mb-4 px-6 py-4 border-b border-neutral-600">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Package className="h-5 w-5 text-yellow-500" />
            Selecionar Produto para Vinculação
          </DialogTitle>
          <DialogDescription className="text-neutral-300">
            Busque e selecione um produto cadastrado para vincular ao item do XML
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Barra de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Buscar por nome, código do produto ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-600 text-white placeholder-neutral-400 focus:border-yellow-500"
              autoFocus
            />
          </div>
        </div>

        {/* Lista de produtos */}
        <div className="flex-1 overflow-hidden flex flex-col px-6">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-4"></div>
                <p className="text-neutral-400">Carregando produtos...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Package className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                <p className="text-neutral-400">
                  {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                </p>
                {searchTerm && (
                  <p className="text-sm text-neutral-500 mt-2">
                    Tente buscar por nome, código ou código de barras
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              <ul className="space-y-2">
                {filteredProducts.map((product) => {
                  const code = product.code || product.codigo_produto;
                  const name = product.name || product.nome || 'Produto sem nome';
                  const stock = product.stock || product.estoque || 0;
                  const price = Number(product.salePrice || product.preco_venda || 0);
                  const isSelected = selectedProduct?.id === product.id;
                  
                  return (
                    <li 
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'border-yellow-500 bg-yellow-500/10'
                          : 'border-neutral-600 bg-black hover:border-yellow-400 hover:bg-neutral-900'
                      }`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-white truncate" title={`${code ? `[${code}] ` : ''}${name}`}>
                            {code && <span className="text-neutral-400">[{code}]</span>} {name}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-neutral-300">R$ {price.toFixed(2)}</p>
                          <span className="text-xs font-medium text-neutral-400 whitespace-nowrap">
                            Estoque: {stock}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Rodapé com estatísticas e botões */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-600 px-6 pb-6">
          <div className="text-sm text-neutral-400">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} 
            {searchTerm && ` encontrado${filteredProducts.length !== 1 ? 's' : ''}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="border-neutral-600 text-neutral-300 hover:bg-neutral-700">
              Cancelar
            </Button>
            <Button 
              onClick={handleSelect} 
              disabled={!selectedProduct}
              className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-black"
            >
              <Check className="h-4 w-4" />
              Vincular Produto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
