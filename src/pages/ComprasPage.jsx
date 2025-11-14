import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, Package, Calendar as CalendarIcon, DollarSign, User, Eye, Download, Filter, TrendingUp, BarChart3, X, Trash2, Edit, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listPurchases, getPurchaseItems, deactivatePurchase, updatePurchase } from '@/lib/purchases';
import { listProducts } from '@/lib/products';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PurchaseDetailsModal from '@/components/PurchaseDetailsModal';
import XMLReprocessModal from '@/components/XMLReprocessModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

export default function ComprasPage() {
  const { userProfile } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [modalItems, setModalItems] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  
  // Novos filtros
  const [dateFrom, setDateFrom] = useState(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState(() => endOfMonth(new Date()));
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [showStats, setShowStats] = useState(true);
  const [showAllSuppliersModal, setShowAllSuppliersModal] = useState(false);
  const [inactiveFilter, setInactiveFilter] = useState('active'); // 'active', 'all', 'inactive'
  const [deactivateModal, setDeactivateModal] = useState({ show: false, purchase: null });
  const [deactivateReason, setDeactivateReason] = useState('');
  const [editModal, setEditModal] = useState({ show: false, purchase: null });
  const [editFormData, setEditFormData] = useState({});
  const [reprocessModal, setReprocessModal] = useState({ show: false, purchase: null });
  const [products, setProducts] = useState([]);

  // Função para formatar moeda brasileira
  const formatCurrencyBR = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const number = digits ? Number(digits) / 100 : 0;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Converter moeda para número
  // Função para baixar XML
  const downloadXML = (purchase) => {
    if (!purchase.xml_completo) {
      alert('XML não disponível para esta NF-e');
      return;
    }

    const blob = new Blob([purchase.xml_completo], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${purchase.chave_nfe}.xml`; // Usar chave NF-e padrão
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Função para reprocessamento automático
  const handleAutoReprocess = async (purchase) => {
    if (!purchase.xml_completo) {
      alert('XML não disponível para reprocessamento automático');
      return;
    }

    if (!confirm('Deseja reprocessar esta NF-e? Isso substituirá todos os itens atuais pelos dados do XML original.')) {
      return;
    }

    try {
      console.log('[ComprasPage] Iniciando reprocessamento para purchase:', purchase);
      console.log('[ComprasPage] Chave NF-e:', purchase.chave_nfe);
      console.log('[ComprasPage] XML disponível:', !!purchase.xml_completo);
      
      // Usar o XMLReprocessModal mas com dados automáticos
      const xmlBlob = new Blob([purchase.xml_completo], { type: 'text/xml' });
      const xmlFile = new File([xmlBlob], `${purchase.chave_nfe}.xml`, { type: 'text/xml' });
      
      // Simular seleção de arquivo no modal
      setReprocessModal({ show: true, purchase, autoFile: xmlFile });
    } catch (error) {
      console.error('Erro no reprocessamento automático:', error);
      alert('Erro ao iniciar reprocessamento automático');
    }
  };

  const currencyToNumber = (value) => {
    if (!value) return 0;
    const normalized = String(value).replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  useEffect(() => {
    if (userProfile?.codigo_empresa) {
      loadPurchases();
      loadProducts();
    }
  }, [userProfile, inactiveFilter]);

  const loadProducts = async () => {
    try {
      const data = await listProducts({ codigoEmpresa: userProfile.codigo_empresa });
      setProducts(data || []);
    } catch (error) {
      console.error('[Compras] Erro ao carregar produtos:', error);
    }
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const filters = {
        incluirInativas: inactiveFilter === 'all' || inactiveFilter === 'inactive',
        apenasInativas: inactiveFilter === 'inactive'
      };
      const data = await listPurchases(userProfile.codigo_empresa, filters);
      setPurchases(data || []);
    } catch (error) {
      console.error('[Compras] Erro ao carregar compras:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async (purchase) => {
    setSelectedPurchase(purchase);
    setLoadingModal(true);
    try {
      const items = await getPurchaseItems(purchase.id);
      setModalItems(items || []);
    } catch (error) {
      console.error('[Compras] Erro ao carregar itens:', error);
      setModalItems([]);
    } finally {
      setLoadingModal(false);
    }
  };

  const closeModal = () => {
    setSelectedPurchase(null);
    setModalItems([]);
  };

  // Abrir modal de edição
  const openEditModal = (purchase) => {
    setEditModal({ show: true, purchase });
    setEditFormData({
      numeroNfe: purchase.numero_nfe || '',
      serieNfe: purchase.serie_nfe || '',
      dataEmissao: purchase.data_emissao ? purchase.data_emissao.split('T')[0] : '',
      tipoOperacao: purchase.tipo_operacao || '',
      naturezaOperacao: purchase.natureza_operacao || '',
      valorProdutos: formatCurrencyBR((purchase.valor_produtos || 0) * 100),
      valorTotal: formatCurrencyBR((purchase.valor_total || 0) * 100),
      formaPagamento: purchase.forma_pagamento || '',
      observacoes: purchase.observacoes || ''
    });
  };

  // Salvar edição
  const handleSaveEdit = async () => {
    try {
      await updatePurchase(editModal.purchase.id, {
        ...editFormData,
        valorProdutos: currencyToNumber(editFormData.valorProdutos),
        valorTotal: currencyToNumber(editFormData.valorTotal),
        fornecedorId: editModal.purchase.fornecedor_id
      });
      
      // Recarregar lista
      await loadPurchases();
      
      // Fechar modal
      setEditModal({ show: false, purchase: null });
      setEditFormData({});
      
      console.log('Compra editada com sucesso!');
    } catch (error) {
      console.error('Erro ao editar compra:', error);
    }
  };

  // Lista de fornecedores únicos
  const suppliers = useMemo(() => {
    const uniqueSuppliers = new Map();
    purchases.forEach(p => {
      if (p.fornecedor?.id) {
        uniqueSuppliers.set(p.fornecedor.id, p.fornecedor);
      }
    });
    return Array.from(uniqueSuppliers.values());
  }, [purchases]);

  // Filtros aplicados
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Filtro de busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSearch = 
          p.numero_nfe?.toLowerCase().includes(term) ||
          p.fornecedor?.nome?.toLowerCase().includes(term) ||
          p.chave_nfe?.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      // Filtro de fornecedor
      if (supplierFilter !== 'all' && p.fornecedor?.id !== supplierFilter) {
        return false;
      }

      // Filtro de período por data
      if (p.data_emissao) {
        const emissionDate = new Date(p.data_emissao);
        if (dateFrom && emissionDate < dateFrom) return false;
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (emissionDate > endOfDay) return false;
        }
      }

      return true;
    });
  }, [purchases, searchTerm, supplierFilter, dateFrom, dateTo]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredPurchases.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);
    const count = filteredPurchases.length;
    const avgTicket = count > 0 ? total / count : 0;
    
    // Agrupar por fornecedor
    const bySupplier = {};
    filteredPurchases.forEach(p => {
      const supplierId = p.fornecedor?.id || 'unknown';
      const supplierName = p.fornecedor?.nome || 'Não identificado';
      if (!bySupplier[supplierId]) {
        bySupplier[supplierId] = { name: supplierName, total: 0, count: 0 };
      }
      bySupplier[supplierId].total += Number(p.valor_total || 0);
      bySupplier[supplierId].count += 1;
    });
    
    const topSuppliers = Object.values(bySupplier)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { total, count, avgTicket, topSuppliers };
  }, [filteredPurchases]);

  // Exportar para CSV
  const exportToCSV = () => {
    const headers = ['NF-e', 'Serie', 'Data Emissao', 'Fornecedor', 'CNPJ', 'Tipo', 'Valor Total', 'Valor Produtos', 'Forma Pagamento'];
    const rows = filteredPurchases.map(p => [
      p.numero_nfe || '',
      p.serie_nfe || '',
      p.data_emissao ? format(new Date(p.data_emissao), 'dd/MM/yyyy') : '',
      (p.fornecedor?.nome || '').replace(/,/g, ' '),
      p.fornecedor?.cnpj || '',
      p.tipo_operacao || '',
      Number(p.valor_total || 0).toFixed(2),
      Number(p.valor_produtos || 0).toFixed(2),
      (p.forma_pagamento || '').replace(/,/g, ' ')
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `compras_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header com Filtros de Data */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Compras (NF-e)</h1>
            <p className="text-text-muted">Histórico de notas fiscais de entrada importadas</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-muted block">Período Inicial</label>
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : <span>Selecionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="end">
                  <CalendarPicker
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-muted block">Período Final</label>
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : <span>Selecionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="end">
                  <CalendarPicker
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(null); setDateTo(null); }}
                className="mt-5"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      {showStats && filteredPurchases.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <FileText className="h-4 w-4" />
                <span>Total de NF-es</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{stats.count}</p>
            </div>
            
            <div className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Valor Total</span>
              </div>
              <p className="text-2xl font-bold text-success">R$ {stats.total.toFixed(2)}</p>
            </div>
            
            <div className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <User className="h-4 w-4" />
                <span>Fornecedores</span>
              </div>
              <p className="text-2xl font-bold text-info">{suppliers.length}</p>
            </div>
          </div>

          {/* Top 5 Fornecedores - Grid 3 Colunas */}
          {stats.topSuppliers.length > 0 && (
            <div className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Top 5 Fornecedores
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAllSuppliersModal(true)}
                  className="text-xs"
                >
                  Ver Todos
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.topSuppliers.map((supplier, idx) => {
                  const percentage = (supplier.total / stats.total) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-primary font-medium truncate flex-1" title={supplier.name}>{supplier.name}</span>
                        <span className="text-text-muted text-xs ml-2 flex-shrink-0">
                          R$ {supplier.total.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-surface-2 rounded-full h-1.5">
                        <div
                          className="bg-brand rounded-full h-1.5 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Buscar por NF-e, fornecedor ou chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[220px]">
              <User className="h-4 w-4 mr-2 flex-shrink-0" />
              <div className="truncate">
                <SelectValue placeholder="Fornecedor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {suppliers.map(supplier => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  <div className="truncate max-w-[180px]" title={supplier.nome}>
                    {supplier.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filteredPurchases.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {showStats ? 'Ocultar' : 'Mostrar'}
            </Button>

            <Select value={inactiveFilter} onValueChange={setInactiveFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Apenas ativas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="inactive">Apenas inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>

      {/* Lista de Compras */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          <p className="mt-4 text-text-muted">Carregando compras...</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <Package className="h-12 w-12 mx-auto text-text-muted mb-4" />
          <p className="text-text-muted">
            {searchTerm ? 'Nenhuma compra encontrada' : 'Nenhuma NF-e importada ainda'}
          </p>
          <p className="text-sm text-text-muted mt-2">
            Importe XMLs de NF-e na página de Produtos
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredPurchases.map((purchase) => (
            <div
              key={purchase.id}
              className={`rounded-lg border overflow-hidden transition-all hover:shadow-lg ${
                purchase.ativo === false 
                  ? 'bg-gray-900/60 border-red-500 shadow-red-500/20' 
                  : 'bg-surface border-border hover:border-brand/50'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">

                    {/* Informações Principais */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-brand" />
                        <h3 className={`font-semibold ${
                          purchase.ativo === false ? 'text-red-600' : 'text-text-primary'
                        }`}>
                          NF-e {purchase.numero_nfe} / Série {purchase.serie_nfe}
                          {purchase.ativo === false && (
                            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                              INATIVA
                            </span>
                          )}
                        </h3>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-4 w-4 flex-shrink-0 text-brand" />
                          <span className="font-medium text-text-primary text-base truncate" title={purchase.fornecedor?.nome || 'Fornecedor não identificado'}>
                            {purchase.fornecedor?.nome || 'Fornecedor não identificado'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-text-muted">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                              {purchase.data_emissao
                                ? format(new Date(purchase.data_emissao), "dd/MM/yyyy", { locale: ptBR })
                                : 'Data não informada'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Package className="h-4 w-4" />
                            <span>{purchase.tipo_operacao || 'Entrada'}</span>
                          </div>
                          {purchase.chave_nfe && (
                            <div className="text-xs">
                              <span className="font-medium">Chave:</span> {purchase.chave_nfe.substring(0, 16)}...
                            </div>
                          )}
                        </div>

                        {purchase.natureza_operacao && (
                          <p className="text-xs text-text-muted truncate" title={purchase.natureza_operacao}>
                            {purchase.natureza_operacao}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Valores e Botão */}
                    <div className="text-right flex flex-col items-end gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-success font-semibold text-lg">
                          <DollarSign className="h-5 w-5" />
                          <span>R$ {Number(purchase.valor_total || 0).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                          Produtos: R$ {Number(purchase.valor_produtos || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openModal(purchase)}
                          size="sm"
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Detalhes
                        </Button>
                        {purchase.ativo && (
                          <Button
                            onClick={() => openEditModal(purchase)}
                            size="sm"
                            variant="outline"
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Inativação */}
      <Dialog open={deactivateModal.show} onOpenChange={(open) => setDeactivateModal({ show: open, purchase: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar NF-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Tem certeza que deseja inativar a NF-e <strong>{deactivateModal.purchase?.numero_nfe}</strong>?
            </p>
            <div>
              <label className="block text-sm font-medium mb-2">Motivo da inativação:</label>
              <Input
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Ex: NF-e duplicada, erro na importação..."
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeactivateModal({ show: false, purchase: null });
                  setDeactivateReason('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!deactivateReason.trim()) {
                    alert('Por favor, informe o motivo da inativação');
                    return;
                  }
                  try {
                    await deactivatePurchase(
                      deactivateModal.purchase.id,
                      deactivateReason.trim(),
                      userProfile.id
                    );
                    setDeactivateModal({ show: false, purchase: null });
                    setDeactivateReason('');
                    loadPurchases();
                  } catch (error) {
                    console.error('Erro ao inativar compra:', error);
                    alert('Erro ao inativar NF-e. Tente novamente.');
                  }
                }}
                disabled={!deactivateReason.trim()}
              >
                Inativar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      {selectedPurchase && (
        <PurchaseDetailsModal
          purchase={selectedPurchase}
          items={loadingModal ? [] : modalItems}
          onClose={closeModal}
          onEdit={openEditModal}
          onReprocess={handleAutoReprocess}
          onDownloadXML={downloadXML}
          onInactivate={(purchase) => setDeactivateModal({ show: true, purchase })}
        />
      )}

      {/* Modal Todos os Fornecedores */}
      <Dialog open={showAllSuppliersModal} onOpenChange={setShowAllSuppliersModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Todos os Fornecedores</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-3 bg-surface-2 border-y border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Valor Total Geral</span>
              <span className="text-2xl font-bold text-success">R$ {stats.total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3 pr-2">
              {Object.entries(
                filteredPurchases.reduce((acc, p) => {
                  const id = p.fornecedor?.id || 'unknown';
                  const name = p.fornecedor?.nome || 'Não identificado';
                  if (!acc[id]) acc[id] = { name, total: 0, count: 0 };
                  acc[id].total += Number(p.valor_total || 0);
                  acc[id].count += 1;
                  return acc;
                }, {})
              )
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([id, supplier], idx) => {
                  const percentage = (supplier.total / stats.total) * 100;
                  return (
                    <div key={id} className="p-3 bg-surface-2 rounded-lg border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-text-primary">{supplier.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">R$ {supplier.total.toFixed(2)}</p>
                          <p className="text-xs text-text-muted">{supplier.count} NF-es</p>
                        </div>
                      </div>
                      <div className="w-full bg-surface rounded-full h-2">
                        <div
                          className="bg-brand rounded-full h-2 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={editModal.show} onOpenChange={(open) => setEditModal({ show: open, purchase: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar NF-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Número NF-e</label>
                <Input
                  value={editFormData.numeroNfe || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, numeroNfe: e.target.value }))}
                  placeholder="Número da NF-e"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Série</label>
                <Input
                  value={editFormData.serieNfe || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, serieNfe: e.target.value }))}
                  placeholder="Série"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Data de Emissão</label>
              <Input
                type="date"
                value={editFormData.dataEmissao || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, dataEmissao: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo de Operação</label>
                <Select
                  value={editFormData.tipoOperacao || ''}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, tipoOperacao: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrada">0 - Entrada</SelectItem>
                    <SelectItem value="Saída">1 - Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Natureza da Operação</label>
                <Select
                  value={editFormData.naturezaOperacao || ''}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, naturezaOperacao: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a natureza" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Compra para comercialização">Compra para comercialização</SelectItem>
                    <SelectItem value="Compra para industrialização">Compra para industrialização</SelectItem>
                    <SelectItem value="Compra para uso ou consumo">Compra para uso ou consumo</SelectItem>
                    <SelectItem value="Compra de ativo imobilizado">Compra de ativo imobilizado</SelectItem>
                    <SelectItem value="Compra de material para uso ou consumo">Compra de material para uso ou consumo</SelectItem>
                    <SelectItem value="Devolução de venda de produção do estabelecimento">Devolução de venda de produção do estabelecimento</SelectItem>
                    <SelectItem value="Devolução de venda de mercadoria adquirida ou recebida de terceiros">Devolução de venda de mercadoria adquirida ou recebida de terceiros</SelectItem>
                    <SelectItem value="Remessa de mercadoria por conta e ordem de terceiros">Remessa de mercadoria por conta e ordem de terceiros</SelectItem>
                    <SelectItem value="Retorno de mercadoria remetida por conta e ordem de terceiros">Retorno de mercadoria remetida por conta e ordem de terceiros</SelectItem>
                    <SelectItem value="Remessa para industrialização por encomenda">Remessa para industrialização por encomenda</SelectItem>
                    <SelectItem value="Retorno de mercadoria remetida para industrialização por encomenda">Retorno de mercadoria remetida para industrialização por encomenda</SelectItem>
                    <SelectItem value="Transferência de produção do estabelecimento">Transferência de produção do estabelecimento</SelectItem>
                    <SelectItem value="Transferência de mercadoria adquirida ou recebida de terceiros">Transferência de mercadoria adquirida ou recebida de terceiros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Valor dos Produtos</label>
                <Input
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={`R$ ${editFormData.valorProdutos || '0,00'}`}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, valorProdutos: formatCurrencyBR(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor Total</label>
                <Input
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={`R$ ${editFormData.valorTotal || '0,00'}`}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, valorTotal: formatCurrencyBR(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select
                value={editFormData.formaPagamento || ''}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, formaPagamento: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="01 - Dinheiro">01 - Dinheiro</SelectItem>
                  <SelectItem value="02 - Cheque">02 - Cheque</SelectItem>
                  <SelectItem value="03 - Cartão de Crédito">03 - Cartão de Crédito</SelectItem>
                  <SelectItem value="04 - Cartão de Débito">04 - Cartão de Débito</SelectItem>
                  <SelectItem value="05 - Cartão da Loja (Private Label)">05 - Cartão da Loja (Private Label)</SelectItem>
                  <SelectItem value="10 - Vale Alimentação">10 - Vale Alimentação</SelectItem>
                  <SelectItem value="11 - Vale Refeição">11 - Vale Refeição</SelectItem>
                  <SelectItem value="12 - Vale Presente">12 - Vale Presente</SelectItem>
                  <SelectItem value="13 - Vale Combustível">13 - Vale Combustível</SelectItem>
                  <SelectItem value="14 - Duplicata Mercantil">14 - Duplicata Mercantil</SelectItem>
                  <SelectItem value="15 - Boleto Bancário">15 - Boleto Bancário</SelectItem>
                  <SelectItem value="16 - Depósito Bancário">16 - Depósito Bancário</SelectItem>
                  <SelectItem value="17 - PIX Dinâmico (QR-Code)">17 - PIX Dinâmico (QR-Code)</SelectItem>
                  <SelectItem value="18 - Transferência Bancária / Carteira Digital">18 - Transferência Bancária / Carteira Digital</SelectItem>
                  <SelectItem value="19 - Programa de Fidelidade / Cashback">19 - Programa de Fidelidade / Cashback</SelectItem>
                  <SelectItem value="20 - PIX Estático">20 - PIX Estático</SelectItem>
                  <SelectItem value="21 - Crédito em Loja">21 - Crédito em Loja</SelectItem>
                  <SelectItem value="22 - Pagamento Eletrônico não Informado">22 - Pagamento Eletrônico não Informado</SelectItem>
                  <SelectItem value="90 - Sem Pagamento">90 - Sem Pagamento</SelectItem>
                  <SelectItem value="99 - Outros">99 - Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Observações</label>
              <Input
                value={editFormData.observacoes || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditModal({ show: false, purchase: null })}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Reprocessamento */}
      <XMLReprocessModal
        open={reprocessModal.show}
        onOpenChange={(open) => setReprocessModal({ show: open, purchase: null })}
        purchase={reprocessModal.purchase}
        products={products}
        codigoEmpresa={userProfile?.codigo_empresa}
        autoFile={reprocessModal.autoFile}
        onSuccess={() => {
          loadPurchases();
          setReprocessModal({ show: false, purchase: null });
        }}
      />
    </div>
  );
}
