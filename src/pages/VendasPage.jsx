import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// framer-motion removido para evitar piscadas e erros de runtime
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { Plus, GripVertical, Search, CheckCircle, Clock, FileText, ShoppingBag, Trash2, DollarSign, X, Store, Lock, Unlock, Minus, Banknote, ArrowDownCircle, ArrowUpCircle, CalendarDays, Users, ChevronRight, AlertCircle, Edit, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { listMesas, ensureCaixaAberto, fecharCaixa, getOrCreateComandaForMesa, listarItensDaComanda, adicionarItem, atualizarQuantidadeItem, removerItem, listarFinalizadoras, registrarPagamento, fecharComandaEMesa, cancelarComandaEMesa, listarComandasAbertas, listarTotaisPorComanda, criarMesa, listarClientes, adicionarClientesAComanda, listarClientesDaComanda, getCaixaAberto, listarResumoSessaoCaixaAtual, criarMovimentacaoCaixa, listarMovimentacoesCaixa, listarItensDeTodasComandasAbertas, listarPagamentosPorComandaEStatus, salvarRascunhoPagamentosComanda, promoverPagamentosRascunhoParaPago, listarComandaBalcaoAberta, getOrCreateComandaBalcao } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

import { listProducts } from '@/lib/products';
import { useNavigate, useLocation } from 'react-router-dom';
import { DescontoItemDialog } from '@/components/DescontoItemDialog';
import { DescontoComandaDialog } from '@/components/DescontoComandaDialog';
import { aplicarDescontoItem, removerDescontoItem, aplicarDescontoComanda, removerDescontoComanda, adicionarObservacaoComanda } from '@/lib/store';

// Mock Data
const initialTablesData = [
  { id: 'table-1', number: 1, status: 'available', order: [], customer: null },
  { id: 'table-2', number: 2, status: 'in-use', order: [{ id: 'prod-1', name: 'Coca-cola', price: 5, quantity: 2 }, { id: 'prod-2', name: 'Porção de Fritas', price: 25, quantity: 1 }], customer: "Equipe Rocket" },
  { id: 'table-3', number: 3, status: 'available', order: [], customer: null },
  { id: 'table-4', number: 4, status: 'awaiting-payment', order: [{ id: 'prod-3', name: 'Heineken 600ml', price: 15, quantity: 4 }], customer: "Os Vingadores" },
  { id: 'table-5', number: 5, status: 'available', order: [], customer: null },
  { id: 'table-6', number: 6, status: 'in-use', order: [{ id: 'prod-4', name: 'Água com gás', price: 4, quantity: 3 }], customer: "Liga da Justiça" },
  { id: 'table-7', number: 7, status: 'available', order: [], customer: null },
  { id: 'table-8', number: 8, status: 'available', order: [], customer: null },
];

const productsData = [
  { id: 'prod-1', name: 'Coca-cola', price: 5, category: 'Bebidas' },
  { id: 'prod-2', name: 'Porção de Fritas', price: 25, category: 'Comidas' },
  { id: 'prod-3', name: 'Heineken 600ml', price: 15, category: 'Bebidas' },
  { id: 'prod-4', name: 'Água com gás', price: 4, category: 'Bebidas' },
  { id: 'prod-5', name: 'Salgadinho', price: 8, category: 'Snacks' },
];

const statusConfig = {
  available: { label: 'Livre', color: 'border-success/50 bg-success/10 text-success', icon: CheckCircle },
  'in-use': { label: 'Em Uso', color: 'border-warning/50 bg-warning/10 text-warning', icon: Clock },
  'awaiting-payment': { label: 'Pagamento', color: 'border-info/50 bg-info/10 text-info', icon: FileText },
};

// Animações removidas

function VendasPage() {
  const { toast } = useToast();
  const { userProfile, authReady } = useAuth();
  const navigate = useNavigate();

  const [tables, setTables] = useState([]);

  const [selectedTable, setSelectedTable] = useState(null);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [openComandasCount, setOpenComandasCount] = useState(0);
  const autoReopenTriedRef = useRef(false);
  const [isCounterModeOpen, setIsCounterModeOpen] = useState(false);
  const [counterOrder, setCounterOrder] = useState([]);
  const [isCashierDetailsOpen, setIsCashierDetailsOpen] = useState(false);
  // Estoque reservado global (todas as comandas abertas)
  const [reservedStock, setReservedStock] = useState(new Map());
  // Modal de Produtos
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false);
  // Refs para Produtos (atalhos)
  const productsSearchRef = useRef(null);
  const productsListRef = useRef(null);
  const productItemRefs = useRef([]);
  // Ref para busca no balcão (Counter)
  const counterSearchRef = useRef(null);
  const [productFocusIndex, setProductFocusIndex] = useState(0);
  // Sistema de foco: 'tables' ou 'panel' (comanda/produtos)
  const [focusContext, setFocusContext] = useState('tables');
  const orderPanelRef = useRef(null);
  // Aba selecionada no painel lateral (desktop)
  const [desktopTab, setDesktopTab] = useState('order');
  // Controle de hover para evitar flicker ao pré-selecionar mesa
  const hoverSelectTimeoutRef = useRef(null);
  const hoverSelectTargetRef = useRef(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashSummary, setCashSummary] = useState(null);
  // Detalhes de produto (como no Balcão)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isManageClientsOpen, setIsManageClientsOpen] = useState(false);
  // Modal de confirmação de remoção de item
  const [itemToRemove, setItemToRemove] = useState(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  // Abrir mesa
  const [isCreateTableDialog, setIsCreateTableDialog] = useState(false);
  const [isCreateMesaOpen, setIsCreateMesaOpen] = useState(false);
  const [isOpenTableDialog, setIsOpenTableDialog] = useState(false);
  const [pendingTable, setPendingTable] = useState(null);
  const [clienteNome, setClienteNome] = useState('');
  // Pagamento
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isSelectingTable, setIsSelectingTable] = useState(false);
  const [payMethods, setPayMethods] = useState([]);
  const [defaultPayId, setDefaultPayId] = useState(null);
  const [selectedPayId, setSelectedPayId] = useState(null);
  // Estados do pagamento serão locais dentro do PayDialog para evitar re-render global a cada clique
  // Abrir Caixa (AlertDialog)
  const [openCashDialogOpen, setOpenCashDialogOpen] = useState(false);
  // Preservar rascunho do valor inicial do caixa entre re-renders
  const openCashInitialRef = useRef('');
  // Evitar reentrância ao abrir o caixa
  const [openCashInProgress, setOpenCashInProgress] = useState(false);
  // Modal Mobile para Visualizar Mesa
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  // Controlar aba ativa do modal mobile para evitar reset ao re-render
  const [mobileTableTab, setMobileTableTab] = useState('order');
  // Removido productsKeyModeRef - causava bloqueio total das setas
  // Alerta compacto no mobile
  const [mobileWarnOpen, setMobileWarnOpen] = useState(false);
  const [mobileWarnMsg, setMobileWarnMsg] = useState('');
  // Flag de viewport mobile (inicializa com valor imediato)
  const [isMobileView, setIsMobileView] = useState(() => {
    try { return typeof window !== 'undefined' && window.innerWidth <= 640; } catch { return false; }
  });
  
  // Estados para Desconto
  const [selectedItemForDesconto, setSelectedItemForDesconto] = useState(null);
  const [isDescontoComandaDialogOpen, setIsDescontoComandaDialogOpen] = useState(false);
  
  // Construir mapa de quantidades atuais na comanda
  const qtyByProductId = useMemo(() => {
    const map = new Map();
    const items = selectedTable?.order || [];
    for (const it of items) map.set(it.productId, (map.get(it.productId) || 0) + Number(it.quantity || 0));
    return map;
  }, [selectedTable?.order]);

  // Helpers: alterar quantidade
  const incProduct = async (prod) => {
    try {
      await addProductToComanda(prod);
    } catch (e) {
      toast({ title: 'Falha ao adicionar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };
  const decProduct = async (prod) => {
    try {
      const items = selectedTable?.order || [];
      const it = items.find(x => String(x.productId) === String(prod.id));
      if (!it) return; // nada para diminuir
      
      const newQty = Number(it.quantity || 0) - 1;
      
      // Persistir no backend PRIMEIRO
      if (newQty > 0) {
        await atualizarQuantidadeItem({ itemId: it.id, quantidade: newQty, codigoEmpresa: userProfile?.codigo_empresa });
      } else {
        await removerItem({ itemId: it.id, codigoEmpresa: userProfile?.codigo_empresa });
      }
      
      // Recarregar itens do backend para sincronizar
      const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ 
        id: it.id, 
        productId: it.produto_id, 
        name: it.descricao || 'Item', 
        price: Number(it.preco_unitario || 0), 
        quantity: Number(it.quantidade || 1) 
      }));
      const syncedTotal = (order || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0);
      
      const updatedTable = { ...selectedTable, order, totalHint: syncedTotal };
      setSelectedTable(updatedTable);
      setTables((prevTables) => prevTables.map(t => (t.id === updatedTable.id ? updatedTable : t)));
      
      // Atualizar estoque reservado global após remover/diminuir item
      try {
        const itensGlobal = await listarItensDeTodasComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
        const reservedMap = new Map();
        for (const item of itensGlobal || []) {
          const pid = item.produto_id;
          const qty = Number(item.quantidade || 0);
          reservedMap.set(pid, (reservedMap.get(pid) || 0) + qty);
        }
        setReservedStock(reservedMap);
      } catch (err) {
        console.error('[decProduct] Erro ao atualizar estoque reservado:', err);
      }
    } catch (e) {
      toast({ title: 'Falha ao alterar quantidade', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };
  // Ref do grid desktop para calcular colunas e fazer scroll até a mesa selecionada
  const gridRef = useRef(null);
  const getGridColumns = useCallback(() => {
    try {
      const el = gridRef.current;
      if (!el) return 1;
      const style = window.getComputedStyle(el);
      const cols = style.gridTemplateColumns || '';
      if (cols) {
        const count = cols.split(' ').filter(Boolean).length;
        if (count > 0) return count;
      }
      // Fallback: calcular por largura do grid e do primeiro card
      const first = el.querySelector('[data-table-id]');
      if (first) {
        const colWidth = first.getBoundingClientRect().width;
        const gridWidth = el.getBoundingClientRect().width;
        if (colWidth > 0) return Math.max(1, Math.floor(gridWidth / colWidth));
      }
      return 1;
    } catch { return 1; }
  }, []);
  const [loadingItems, setLoadingItems] = useState(false);
  const location = useLocation();
  const firstAvailableId = useMemo(() => (tables || []).find(t => t.status === 'available')?.id || null, [tables]);
  // Evita movimentação do layout quando diálogos estão abertos (bloqueia scroll do fundo)
  const anyDialogOpen = isCreateTableDialog || isOpenTableDialog || isOrderDetailsOpen || isCashierDetailsOpen || isPayOpen || openCashDialogOpen || isCounterModeOpen || isProductDetailsOpen || isMobileModalOpen || false;

  // Selecionar/abrir mesa (usado por clique e pelo Enter)
  const handleSelectTable = async (table) => {
    try {
      if (!table) return;
      if (!isCashierOpen) {
        toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de gerenciar as mesas.', variant: 'warning' });
        return;
      }
      if (isSelectingTable) return;
      setIsSelectingTable(true);
      // Atualiza seleção atual imediatamente para feedback visual
      setSelectedTable((prev) => {
        if (!prev || prev.id !== table.id) return table;
        return prev;
      });

      // Se mesa está disponível, abrir diálogo de abrir mesa
      if (table.status === 'available' || !table.comandaId) {
        setPendingTable(table);
        setIsOpenTableDialog(true);
        return;
      }

      // Mesa com comanda: hidratar itens e clientes
      try {
        await refetchSelectedTableDetails(table);
      } catch (e) {
        // Fallback manual em caso de erro no helper
        try {
          const itens = await listarItensDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
          const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
          let customer = null;
          try {
            const vincs = await listarClientesDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
            customer = nomes.length ? nomes.join(', ') : null;
          } catch {}
          const enriched = { ...table, order, customer };
          setSelectedTable(enriched);
          setTables((prev) => prev.map((t) => (t.id === enriched.id ? enriched : t)));
        } catch {}
      }
    } finally {
      setIsSelectingTable(false);
    }
  };

  useEffect(() => {
    const update = () => {
      try { setIsMobileView(typeof window !== 'undefined' && window.innerWidth <= 640); } catch { setIsMobileView(false); }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ======= Hotkeys =======
  useEffect(() => {
    const handler = async (e) => {
      try {
        // CRÍTICO: Bloquear TODOS os atalhos se modal de produtos estiver aberto
        if (isProductsModalOpen) {
          return;
        }
        
        // Ignorar quando digitando em campos de texto
        const tag = String(e.target?.tagName || '').toLowerCase();
        const isInInput = ['input','textarea','select'].includes(tag) || e.target?.isContentEditable;
        
        // Se está em input/textarea, ignorar TODOS os atalhos de letra
        if (isInInput) {
          return;
        }
        
        // Bloquear atalhos se qualquer diálogo estiver aberto (exceto mesa selecionada)
        if (anyDialogOpen) {
          return;
        }

        // F1: Selecionar 1ª mesa disponível e abrir (OpenTableDialog)
        if (e.key === 'F1') {
          e.preventDefault();
          try {
            const avail = (tables || []).filter(t => t.status === 'available');
            if (avail.length > 0) {
              setSelectedTable(avail[0]);
              // Pre-selecionar mesa para o diálogo
              setPendingTable?.(avail[0]);
            } else if (!selectedTable && Array.isArray(tables) && tables.length > 0) {
              setSelectedTable(tables[0]);
              setPendingTable?.(tables[0]);
            }
          } catch {}
          setIsOpenTableDialog(true);
          return;
        }
        // F2: Fechar comanda (abrir PayDialog)
        if (e.key === 'F2') {
          e.preventDefault();
          if (selectedTable?.comandaId) {
            await openPayDialog();
          } else {
            toast({ title: 'Nenhuma comanda selecionada', description: 'Selecione uma mesa com comanda aberta antes de fechar.', variant: 'warning' });
          }
          return;
        }
        // B e H agora são globais (movidos para App.jsx)
        // F10: Abrir Caixa (só se caixa não estiver aberto)
        if (e.key === 'F10') {
          e.preventDefault();
          if (!isCashierOpen) {
            setOpenCashDialogOpen(true);
          } else {
            toast({ title: 'Caixa já está aberto', description: 'Use F11 para ver detalhes do caixa.', variant: 'info' });
          }
          return;
        }
        // F11: Detalhes do Caixa (evitar F12 que abre DevTools)
        if (e.key === 'F11') {
          e.preventDefault();
          setIsCashierDetailsOpen(true);
          return;
        }

        // Navegação por setas entre mesas (desktop) - SOMENTE se focusContext === 'tables'
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
          // CRÍTICO: Só processar se focusContext === 'tables' E há mesa selecionada
          if (focusContext !== 'tables') {
            return;
          }
          if (!selectedTable || !Array.isArray(tables) || tables.length === 0) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          let idx = Math.max(0, tables.findIndex(t => t.id === selectedTable?.id));
          if (idx < 0) idx = 0;
          // Detectar colunas reais do grid pela primeira linha
          let cols = getGridColumns();
          let nextIdx = idx;
          if (e.key === 'ArrowRight') nextIdx = idx + 1;
          if (e.key === 'ArrowLeft') nextIdx = idx - 1;
          if (e.key === 'ArrowDown') nextIdx = idx + cols;
          if (e.key === 'ArrowUp') nextIdx = idx - cols;
          // Wrap-around com aritmética modular
          const n = tables.length;
          nextIdx = ((nextIdx % n) + n) % n;
          const next = tables[nextIdx];
          if (next && next.id !== selectedTable?.id) {
            setSelectedTable(next);
            // rolar até a mesa selecionada no grid
            setTimeout(() => {
              try {
                const el = document.querySelector(`[data-table-id="${next.id}"]`);
                el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
              } catch {}
            }, 0);
          }
          return;
        }
        // Enter: abrir/selecionar mesa atual (desktop) - SOMENTE se focusContext === 'tables'
        if (e.key === 'Enter') {
          if (focusContext !== 'tables') {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (selectedTable && !isSelectingTable) {
            await handleSelectTable(selectedTable);
          }
          return;
        }
        // Escape: navegação reversa (Produtos -> Comanda -> Desselecionar Mesa)
        if (e.key === 'Escape') {
          e.preventDefault();
          // Se estiver na aba Produtos, volta para Comanda
          if (selectedTable && (desktopTab === 'products' || mobileTableTab === 'products')) {
            setDesktopTab('order');
            setMobileTableTab('order');
            return;
          }
          // Se estiver na aba Comanda (ou qualquer outra), desseleciona a mesa
          if (selectedTable) {
            setSelectedTable(null);
            return;
          }
          return;
        }
        // P: abrir modal de Produtos quando houver mesa selecionada
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          // Prioridade 1: se Modo Balcão estiver aberto, focar a busca do balcão
          if (isCounterModeOpen) {
            setTimeout(() => {
              try { counterSearchRef.current?.focus(); } catch {}
            }, 0);
            return;
          }
          // Prioridade 2: mesa selecionada -> abrir modal de produtos
          if (selectedTable) {
            setIsProductsModalOpen(true);
            return;
          }
          // Prioridade 3: sem mesa e balcão fechado -> abrir Modo Balcão e focar a busca
          setIsCounterModeOpen(true);
          setTimeout(() => {
            try { counterSearchRef.current?.focus(); } catch {}
          }, 50);
          return;
        }
      } catch {}
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [anyDialogOpen, selectedTable?.id, tables, getGridColumns, isProductsModalOpen]);


  // Persistir mesa selecionada por empresa
  useEffect(() => {
    try {
      if (selectedTable?.id && userProfile?.codigo_empresa) {
        localStorage.setItem(`vendas:selected:${userProfile.codigo_empresa}`, String(selectedTable.id));
      }
    } catch {}
  }, [selectedTable?.id, userProfile?.codigo_empresa]);

  // Restaurar mesa selecionada quando as mesas carregarem
  useEffect(() => {
    const restoreSelection = async () => {
      try {
        if (!selectedTable && userProfile?.codigo_empresa && Array.isArray(tables) && tables.length > 0) {
          const sid = localStorage.getItem(`vendas:selected:${userProfile.codigo_empresa}`);
          if (sid) {
            const t = tables.find(x => String(x.id) === String(sid));
            if (t) {
              // Garantir que o foco fique em 'tables'
              setFocusContext('tables');
              
              // Se a mesa tem comanda, carregar detalhes
              if (t.comandaId) {
                try {
                  await refetchSelectedTableDetails(t);
                  // Reforçar foco após carregar detalhes
                  setFocusContext('tables');
                } catch (err) {
                  console.error('[Restore Selection] Erro ao carregar detalhes:', err);
                  // Se falhar ao carregar detalhes, limpar localStorage e não restaurar
                  localStorage.removeItem(`vendas:selected:${userProfile.codigo_empresa}`);
                }
              } else {
                // Mesa sem comanda - não restaurar, limpar localStorage
                localStorage.removeItem(`vendas:selected:${userProfile.codigo_empresa}`);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Restore Selection] Erro:', err);
      }
    };
    
    restoreSelection();
  }, [tables, selectedTable, userProfile?.codigo_empresa]);

  // (moved) anyDialogOpen declarado acima
  // Animações desativadas
  // Atualiza rapidamente o status do caixa (aberto/fechado)
  const refreshCashierStatus = useCallback(async () => {
    try {
      const sess = await getCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
      setIsCashierOpen(!!(sess && (sess.id || sess?.length)));
    } catch {
      setIsCashierOpen(false);
    }
  }, [userProfile?.codigo_empresa]);
  // Removido: scroll lock manual que causava layout shift e piscadas.

  // Recarrega e mescla resumo do caixa com saldo_inicial e total de sangrias
  const reloadCashSummary = async () => {
    const codigoEmpresa = userProfile?.codigo_empresa || null;
    try {
      if (!codigoEmpresa) return;
      const [summary, sess] = await Promise.all([
        listarResumoSessaoCaixaAtual({ codigoEmpresa }).catch(() => null),
        getCaixaAberto({ codigoEmpresa }).catch(() => null),
      ]);
      
      // Se não há sessão aberta, não mostrar nada
      if (!sess?.id) {
        setCashSummary(null);
        return;
      }
      
      let totalSangria = 0;
      let movimentacoes = [];
      try {
        movimentacoes = await listarMovimentacoesCaixa({ caixaSessaoId: sess.id, codigoEmpresa });
        totalSangria = (movimentacoes || []).filter(m => (m?.tipo || '') === 'sangria').reduce((acc, m) => acc + Number(m?.valor || 0), 0);
      } catch {}
      
      // Sempre usar dados da sessão, mesmo sem vendas
      const merged = {
        saldo_inicial: sess.saldo_inicial || 0,
        totalPorFinalizadora: summary?.totalPorFinalizadora || summary?.porFinalizadora || {},
        totalEntradas: summary?.totalEntradas || summary?.entradas || 0,
        totalSangria,
        totalSaidas: totalSangria,
        sessaoId: sess.id,
        movimentacoes
      };
      React.startTransition(() => {
        setCashSummary(merged);
      });
    } catch {
      React.startTransition(() => {
        setCashSummary(null);
      });
    } finally {
    }
  };

  // Carregar resumo do caixa quando abrir o diálogo (apenas 1 vez ao abrir)
  const cashDetailsOpenedRef = useRef(false);
  useEffect(() => {
    if (isCashierDetailsOpen && !cashDetailsOpenedRef.current) {
      cashDetailsOpenedRef.current = true;
      reloadCashSummary().catch(() => {});
    } else if (!isCashierDetailsOpen) {
      cashDetailsOpenedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCashierDetailsOpen]);

  const mapStatus = (s) => {
    if (s === 'in_use') return 'in-use';
    if (s === 'awaiting_payment') return 'awaiting-payment';
    return 'available';
  };
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const lastTablesLoadTsRef = useRef(0);
  const lastTablesSizeRef = useRef(0);
  const loadReqIdRef = useRef(0);

  useEffect(() => {
    const codigoEmpresa = userProfile?.codigo_empresa || null;
    const cacheKey = codigoEmpresa ? `vendas:tables:${codigoEmpresa}` : null;
    const trace = '[Vendas:loadTables]';
    const hydrateFromCache = () => {
      try {
        if (!cacheKey) return;
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          setTables(cached);
        }
      } catch {}
    };
    
    // Carregar cache imediatamente se disponível
    if (codigoEmpresa) {
      hydrateFromCache();
    }
    
    const load = async () => {
      try {
        if (!authReady || !codigoEmpresa) return;
        const myReq = ++loadReqIdRef.current;
        const slowFallback = setTimeout(() => {
          if (!mountedRef.current) return;
          hydrateFromCache();
        }, 2000);
        // Safety timeout para não travar o loading
        const safetyTimer = setTimeout(() => {
          if (mountedRef.current && loadReqIdRef.current === myReq) {
            hydrateFromCache();
          }
        }, 10000);

        // Carregar mesas e estoque reservado global em paralelo
        const [mesas, itensReservados] = await Promise.all([
          listMesas(codigoEmpresa),
          listarItensDeTodasComandasAbertas({ codigoEmpresa }).catch(() => [])
        ]);
        
        // Processar estoque reservado
        if (mountedRef.current && loadReqIdRef.current === myReq) {
          const reservedMap = new Map();
          for (const item of itensReservados || []) {
            const pid = item.produto_id;
            const qty = Number(item.quantidade || 0);
            reservedMap.set(pid, (reservedMap.get(pid) || 0) + qty);
          }
          setReservedStock(reservedMap);
        }
        let openComandas = [];
        try { 
          openComandas = await listarComandasAbertas({ codigoEmpresa }); 
        } catch (err) {
          console.error(`[VendasPage:load] Erro ao carregar comandas abertas:`, err);
        }
        const totals = await (async () => {
          try { return await listarTotaisPorComanda((openComandas || []).map(c => c.id), codigoEmpresa); } catch { return {}; }
        })();
        // Carregar nomes de clientes por comanda para exibir no card
        const namesByComanda = await (async () => {
          try {
            const entries = await Promise.all((openComandas || []).map(async (c) => {
              try {
                const vincs = await listarClientesDaComanda({ comandaId: c.id, codigoEmpresa });
                const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
                return [c.id, nomes.length ? nomes.join(', ') : null];
              } catch { return [c.id, null]; }
            }));
            return Object.fromEntries(entries);
          } catch { return {}; }
        })();
        const byMesa = new Map();
        (openComandas || []).forEach(c => byMesa.set(c.mesa_id, c));
        const uiTablesBase = (mesas || []).map((m) => {
          const c = byMesa.get(m.id);
          let status = mapStatus(m.status);
          let comandaId = null;
          let customer = null;
          let totalHint = 0;
          let aberto_em = null;
          if (c) {
            status = (c.status === 'awaiting-payment' || c.status === 'awaiting_payment') ? 'awaiting-payment' : 'in-use';
            comandaId = c.id;
            customer = namesByComanda[c.id] || null;
            totalHint = totals[c.id] || 0;
            aberto_em = c.aberto_em || null;
          }
          return { id: m.id, number: m.numero, name: m.nome || null, status, order: [], customer, comandaId, totalHint, aberto_em };
        });
        // Preserva a ordem/cliente da mesa selecionada para não zerar durante o PayDialog
        const uiTables = uiTablesBase.map(t => {
          if (selectedTable && t.id === selectedTable.id) {
            return { ...t, order: selectedTable.order || [], customer: selectedTable.customer || t.customer };
          }
          return t;
        });
        if (!mountedRef.current || loadReqIdRef.current !== myReq) { clearTimeout(slowFallback); clearTimeout(safetyTimer); return; }
        
        // Sempre atualizar com o que veio do banco (mesmo se vazio)
        setTables(uiTables);
        
        // Se veio vazio do banco, limpar cache também
        if ((uiTables || []).length === 0) {
          try { if (cacheKey) localStorage.removeItem(cacheKey); } catch {}
        } else {
          // Salvar cache apenas se houver mesas
          try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(uiTables)); } catch {}
        }
        
        // Limpar seleção de mesas que não têm mais comanda (foram canceladas)
        const selKey = codigoEmpresa ? `vendas:selected:${codigoEmpresa}` : null;
        if (selKey) {
          try {
            const cachedSelId = localStorage.getItem(selKey);
            if (cachedSelId) {
              const mesa = uiTables.find(t => String(t.id) === String(cachedSelId));
              // Se a mesa não tem comandaId, limpar do localStorage
              if (mesa && !mesa.comandaId) {
                localStorage.removeItem(selKey);
              }
            }
          } catch {}
        }
        
        lastTablesSizeRef.current = Array.isArray(uiTables) ? uiTables.length : 0;
        lastTablesLoadTsRef.current = Date.now();
        // Restaurar seleção anterior pelo cache (se houver)
        let nextSelected = null;
        try {
          const selKey = codigoEmpresa ? `vendas:selected:${codigoEmpresa}` : null;
          const cachedSel = selKey ? localStorage.getItem(selKey) : null;
          if (cachedSel) {
            const foundByCache = uiTables.find(t => String(t.id) === String(cachedSel));
            if (foundByCache) nextSelected = foundByCache;
          }
        } catch {}
        if (!nextSelected) {
          // fallback: manter anterior se existir na lista, senão a primeira
          if (!isPayOpen) {
            setSelectedTable((prev) => {
              const found = prev ? uiTables.find(t => t.id === prev.id) : null;
              if (!found) return uiTables[0] || null;
              // mantém campos enriquecidos do estado anterior (itens, cliente, observações, descontos)
              const merged = {
                ...found,
                order: prev.order || found.order || [],
                customer: prev.customer || found.customer || null,
                observacoes: prev.observacoes ?? found.observacoes ?? null,
                desconto_tipo: prev.desconto_tipo ?? found.desconto_tipo ?? null,
                desconto_valor: prev.desconto_valor ?? found.desconto_valor ?? 0,
                desconto_motivo: prev.desconto_motivo ?? found.desconto_motivo ?? null,
              };
              return merged;
            });
          }
        } else {
          if (!isPayOpen) {
            setSelectedTable((prev) => {
              if (!prev || prev.id !== nextSelected.id) return nextSelected;
              // Se é a mesma mesa, preservar campos enriquecidos
              return {
                ...nextSelected,
                order: prev.order || nextSelected.order || [],
                customer: prev.customer || nextSelected.customer || null,
                observacoes: prev.observacoes ?? nextSelected.observacoes ?? null,
                desconto_tipo: prev.desconto_tipo ?? nextSelected.desconto_tipo ?? null,
                desconto_valor: prev.desconto_valor ?? nextSelected.desconto_valor ?? 0,
                desconto_motivo: prev.desconto_motivo ?? nextSelected.desconto_motivo ?? null,
              };
            });
          }
        }
        // (removido) hooks aninhados: refreshCashierStatus e efeitos — agora definidos no topo do componente
        try {
          const prods = await listProducts({ includeInactive: false, codigoEmpresa });
          setProducts(prods || []);
        } catch (e) { console.warn('Falha ao carregar produtos:', e?.message || e); }
        clearTimeout(slowFallback);
        clearTimeout(safetyTimer);
      } catch (e) {
        console.error('Erro ao carregar mesas:', e);
      }
    };

    // hydrate cache first (fast show)
    hydrateFromCache();
    if (authReady && codigoEmpresa) load();
    return () => {};
  }, [authReady, userProfile?.codigo_empresa, anyDialogOpen]);

  // Checar status do caixa assim que a autenticação estiver pronta (evita exigir abrir caixa após F5)
  useEffect(() => {
    if (!authReady || !userProfile?.codigo_empresa) return;
    refreshCashierStatus();
  }, [authReady, userProfile?.codigo_empresa, refreshCashierStatus]);

  // Auto-recover: se houver comandas abertas mas o caixa parece fechado, tenta reabrir silenciosamente (uma vez)
  // DESABILITADO: causava reabertura automática logo após fechar o caixa
  // useEffect(() => {
  //   const tryAuto = async () => {
  //     if (autoReopenTriedRef.current) return;
  //     if (openComandasCount > 0 && !isCashierOpen) {
  //       autoReopenTriedRef.current = true;
  //       try {
  //         await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
  //         await refreshCashierStatus();
  //       } catch {
  //         // se falhar, deixamos o banner com botão de reabrir
  //       }
  //     }
  //   };
  //   tryAuto();
  // }, [openComandasCount, isCashierOpen, refreshCashierStatus, userProfile?.codigo_empresa]);

  // Quantidade de comandas abertas (independente do caixa) – usado para auto-recover e UI
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!userProfile?.codigo_empresa) { if (mounted) setOpenComandasCount(0); return; }
        const abertas = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
        if (!mounted) return;
        setOpenComandasCount(Array.isArray(abertas) ? abertas.length : 0);
      } catch { if (mounted) setOpenComandasCount(0); }
    })();
    return () => { mounted = false; };
  }, [userProfile?.codigo_empresa, tables.length]);

  // Persistir selectedTable no cache e, quando mudar para uma comanda, hidratar itens se necessário
  useEffect(() => {
    const codigoEmpresa = userProfile?.codigo_empresa || null;
    const selKey = codigoEmpresa ? `vendas:selected:${codigoEmpresa}` : null;
    try { if (selKey && selectedTable?.id) localStorage.setItem(selKey, String(selectedTable.id)); } catch {}
    // Auto-hidratar detalhes da comanda se a seleção foi aplicada por cache/F5 e ainda não temos itens
    if (selectedTable?.comandaId && (!selectedTable.order || selectedTable.order.length === 0)) {
      refetchSelectedTableDetails(selectedTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable?.id, selectedTable?.comandaId]);

  // Recarregar detalhes da mesa selecionada quando a janela ganhar foco ou a página voltar a ficar visível
  // (DESATIVADO: causava refresh perceptível em modais ao trocar de aba do navegador)
  useEffect(() => {
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable?.comandaId, anyDialogOpen, isManageClientsOpen]);

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! ",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! ",
      variant: 'warning',
    });
  };

  const openPayDialog = async () => {
    try {
      if (!selectedTable?.comandaId) {
        toast({ title: 'Selecione uma mesa com comanda aberta', variant: 'warning' });
        return;
      }
      // garante sessão de caixa aberta
      await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
      // recarrega itens da comanda para garantir total correto e evitar lista vazia
      try {
        const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
        const order = (itens || []).map((it) => ({ 
          id: it.id, 
          productId: it.produto_id, 
          name: it.descricao || 'Item', 
          price: Number(it.preco_unitario || 0), 
          quantity: Number(it.quantidade || 1),
          // Incluir campos de desconto
          desconto_tipo: it.desconto_tipo || null,
          desconto_valor: Number(it.desconto_valor || 0),
          desconto_motivo: it.desconto_motivo || null
        }));
        const updated = { ...selectedTable, order };
        setSelectedTable(updated);
        setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } catch {}
      const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa: userProfile?.codigo_empresa });
      setPayMethods(fins || []);
      // define finalizadora padrão antes de abrir modal para evitar "pulsar"
      const def = (fins && fins[0] && fins[0].id) ? fins[0].id : null;
      setDefaultPayId(def);
      setSelectedPayId(def);
      setIsPayOpen(true);
    } catch (e) {
      toast({ title: 'Falha ao carregar finalizadoras', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(tables);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTables(items);
    toast({ title: "Layout das mesas atualizado!", description: "As posições foram salvas temporariamente.", variant: 'success' });
  };

  const calculateTotal = (order, comanda) => {
    let subtotal = 0;
    
    // Calcular subtotal com descontos por item
    for (const item of (order || [])) {
      let valor = (item.price || 0) * (item.quantity || 1);
      
      if (item.desconto_tipo === 'percentual' && item.desconto_valor > 0) {
        valor *= (1 - item.desconto_valor / 100);
      } else if (item.desconto_tipo === 'fixo' && item.desconto_valor > 0) {
        valor -= item.desconto_valor;
      }
      
      subtotal += Math.max(0, valor);
    }
    
    // Aplicar desconto da comanda
    let total = subtotal;
    if (comanda?.desconto_tipo === 'percentual' && comanda?.desconto_valor > 0) {
      total *= (1 - comanda.desconto_valor / 100);
    } else if (comanda?.desconto_tipo === 'fixo' && comanda?.desconto_valor > 0) {
      total -= comanda.desconto_valor;
    }
    
    return Math.max(0, total);
  };
  
  // Trunca nome para mostrar apenas os 2 primeiros nomes completos
  const truncateClientName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(0, 2).join(' ');
  };

  // Formata nome de clientes: "Primeiro Cliente +2" se houver mais
  const formatClientDisplay = (customerString) => {
    if (!customerString) return '';
    // Sanitizar: remover colchetes/acessórios que possam vir em nomes
    const stripBrackets = (s) => String(s).replace(/^\s*[\[]+\s*/g, '').replace(/\s*[\]]+\s*$/g, '').trim();
    const names = customerString
      .split(',')
      .map(n => stripBrackets(n))
      .filter(Boolean);
    if (names.length === 0) return '';
    if (names.length === 1) return truncateClientName(names[0]);
    return `${truncateClientName(names[0])} +${names.length - 1}`;
  };

  // Utilitário: recarrega os detalhes (itens e clientes) da 'selectedTable'
  const refetchSelectedTableDetails = async (target) => {
    try {
      if (!target?.comandaId) return;
      const itens = await listarItensDaComanda({ comandaId: target.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ 
        id: it.id, 
        productId: it.produto_id, 
        name: it.descricao || 'Item', 
        price: Number(it.preco_unitario || 0), 
        quantity: Number(it.quantidade || 1),
        // Incluir campos de desconto
        desconto_tipo: it.desconto_tipo || null,
        desconto_valor: Number(it.desconto_valor || 0),
        desconto_motivo: it.desconto_motivo || null
      }));
      let customer = target.customer || null;
      try {
        const vinculos = await listarClientesDaComanda({ comandaId: target.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
        const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
        customer = nomes.length ? nomes.join(', ') : null;
      } catch {}
      
      // Também recarregar dados da comanda (desconto da comanda e observações)
      let comandaData = target;
      try {
        const cmd = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
        const found = cmd?.find(c => c.id === target.comandaId);
        if (found) {
          comandaData = {
            ...target,
            desconto_tipo: found.desconto_tipo || null,
            desconto_valor: Number(found.desconto_valor || 0),
            desconto_motivo: found.desconto_motivo || null,
            observacoes: found.observacoes || null
          };
        }
      } catch {}
      
      const enriched = { ...comandaData, status: target.status === 'awaiting-payment' ? 'awaiting-payment' : 'in-use', order, customer };
      setSelectedTable(enriched);
      setTables((prev) => prev.map((t) => (t.id === enriched.id ? enriched : t)));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[VendasPage] Falha ao recarregar detalhes da mesa selecionada:', e);
    }
  };

  // Recarrega rapidamente o status das mesas (sem todos os detalhes). Opcionalmente exibe toast em erro.
  const refreshTablesLight = async ({ showToast = false } = {}) => {
    try {
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) {
        return;
      }
      
      const mesas = await listMesas(codigoEmpresa);
      
      let openComandas = [];
      try { 
        openComandas = await listarComandasAbertas({ codigoEmpresa }); 
      } catch (err) {
        console.error('[refreshTablesLight] Erro ao carregar comandas:', err);
      }
      // Índice auxiliar: comanda por mesa
      const byMesa = new Map((openComandas || []).map(c => [c.mesa_id, c]));
      
      // Buscar nomes dos clientes e totais das comandas abertas
      const namesByComanda = {};
      const totalsByComanda = {};
      try {
        const allComandaIds = (openComandas || []).map(c => c.id);
        
        // Buscar clientes
        const vinculos = await Promise.all(allComandaIds.map(async (id) => {
          try { return { id, vinculos: await listarClientesDaComanda({ comandaId: id, codigoEmpresa }) }; } catch { return { id, vinculos: [] }; }
        }));
        vinculos.forEach(({ id, vinculos: v }) => {
          const nomes = (v || []).map(vv => vv?.nome).filter(Boolean);
          namesByComanda[id] = nomes.length ? nomes.join(', ') : null;
        });
        
        // Buscar totais das comandas
        const totais = await Promise.all(allComandaIds.map(async (comandaId) => {
          try {
            const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
            const total = (itens || []).reduce((acc, item) => {
              // Calcular total do item: quantidade * preço unitário - desconto
              const itemTotal = (item.quantidade || 0) * (item.preco_unitario || 0) - (item.desconto || 0);
              return acc + itemTotal;
            }, 0);
            return { comandaId, total };
          } catch (err) {
            console.error(`[refreshTablesLight] Erro ao buscar itens da comanda ${comandaId}:`, err);
            return { comandaId, total: 0 };
          }
        }));
        totais.forEach(({ comandaId, total }) => {
          totalsByComanda[comandaId] = total;
        });
        
      } catch (err) {
        console.error('[refreshTablesLight] Erro ao carregar clientes/totais:', err);
      }
      
      const uiTablesBase = (mesas || []).map((m) => {
        const c = byMesa.get(m.id);
        let status = mapStatus(m.status);
        let comandaId = null;
        let customer = null;
        let totalHint = 0;
        
        if (c) {
          status = (c.status === 'awaiting-payment' || c.status === 'awaiting_payment') ? 'awaiting-payment' : 'in-use';
          comandaId = c.id;
          customer = namesByComanda[c.id] || null;
          totalHint = totalsByComanda[c.id] || 0;
        }
        return { id: m.id, number: m.numero, name: m.nome || null, status, order: [], customer, comandaId, totalHint };
      });
      const uiTables = uiTablesBase.map(t => {
        // Se a mesa selecionada foi cancelada (não tem mais comandaId), não preservar order
        if (selectedTable && t.id === selectedTable.id) {
          if (!t.comandaId) {
            // Mesa foi liberada/cancelada - limpar tudo
            return { ...t, order: [], customer: null };
          }
          return { ...t, order: selectedTable.order || [], customer: selectedTable.customer || t.customer };
        }
        return t;
      });
      
      setTables(uiTables);
      
      // Se a mesa selecionada foi cancelada, atualizar selectedTable também
      if (selectedTable) {
        const updatedSelected = uiTables.find(t => t.id === selectedTable.id);
        if (updatedSelected && !updatedSelected.comandaId) {
          setSelectedTable({ ...updatedSelected, order: [], customer: null });
        }
      }
      
    } catch (err) {
      console.error('[refreshTablesLight] Erro fatal:', err);
      if (showToast) {
        toast({ 
          title: 'Erro ao atualizar mesas', 
          description: 'Recarregue a página se o problema persistir', 
          variant: 'destructive' 
        });
      }
    }
  };

  const TableCard = ({ table, provided, isDragging }) => {
    const config = statusConfig[table.status];
    const Icon = config.icon;
    // Calcular total considerando itens otimizados (temporários) somados ao hint
    const orderArr = Array.isArray(table.order) ? table.order : [];
    const optimisticExtra = orderArr
      .filter(it => String(it.id || '').startsWith('tmp-'))
      .reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.price || 0), 0);
    const persistedTotal = orderArr
      .filter(it => !String(it.id || '').startsWith('tmp-'))
      .reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.price || 0), 0);
    const hintTotal = Number(table.totalHint || 0);
    const total = Math.max(persistedTotal, 0); // mantemos para compatibilidade
    const customerDisplay = formatClientDisplay(table.customer);
    const isFirstAvailable = table.status === 'available' && table.id === firstAvailableId;

    const displayTotal = (table.status === 'in-use' || table.status === 'awaiting-payment')
      ? ((hintTotal > 0 ? hintTotal : persistedTotal) + optimisticExtra)
      : 0;
    const badgeClass = table.status === 'available'
      ? 'text-success bg-success/10 border-success/30'
      : (table.status === 'in-use'
        ? 'text-warning bg-warning/10 border-warning/30'
        : 'text-info bg-info/10 border-info/30');
    return (
      <div
        ref={provided?.innerRef}
        data-table-id={table.id}
        {...(provided?.draggableProps || {})}
        className={cn(
          "p-4 rounded-lg border bg-surface flex flex-col relative h-44 shadow-sm min-w-[240px]",
          isDragging && 'shadow-lg',
          focusContext === 'tables' && selectedTable?.id === table.id && 'ring-2 ring-brand/60 bg-surface-2',
          isCashierOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
        )}
        onClick={() => {
          if (!isCashierOpen) {
            toast({ 
              title: 'Caixa Fechado', 
              description: 'Abra o caixa antes de gerenciar as mesas.', 
              variant: 'warning' 
            });
            return;
          }
          handleSelectTable(table);
        }}
      >
        <div {...(provided?.dragHandleProps || {})} className="absolute top-2 right-2 text-text-muted opacity-60 hover:opacity-100">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-5 h-5 text-text-secondary" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg font-semibold text-text-primary truncate">{table.name ? table.name : `Mesa ${table.number}`}</span>
            {isFirstAvailable && (
              <kbd className="ml-2 hidden md:inline px-2 py-1 text-xs font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">F1</kbd>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {(table.status === 'in-use' || table.status === 'awaiting-payment') && table.aberto_em && (
              <div className="flex items-center gap-0.5 text-xs text-text-secondary">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span className="font-medium">
                  {(() => {
                    try {
                      const opened = new Date(table.aberto_em);
                      const now = new Date();
                      const diffMs = now - opened;
                      const diffMinTotal = Math.floor(diffMs / 60000);
                      const hours = Math.floor(diffMinTotal / 60);
                      const mins = diffMinTotal % 60;

                      if (diffMinTotal < 1) return 'agora';
                      if (hours === 0) return `${mins}m`;
                      if (hours > 0 && mins === 0) return `${hours}h`;
                      return `${hours}h${mins}m`;
                    } catch {
                      return '';
                    }
                  })()}
                </span>
              </div>
            )}
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0", badgeClass)}>
              {config.label}
            </span>
          </div>
        </div>
        
        {/* Área central com ícone da mesa baseado no status */}
        <div className={cn(
          "flex-1 flex items-center justify-center"
        )}>
          {table.status === 'available' ? (
            <img 
              src="/mesalivre.png" 
              alt="Mesa livre" 
              className={cn(
                "w-16 h-16 object-contain opacity-80",
                selectedTable?.id === table.id && "opacity-100"
              )}
            />
          ) : table.status === 'in-use' ? (
            <img 
              src="/mesaocupada.png" 
              alt="Mesa ocupada" 
              className={cn(
                "w-16 h-16 object-contain opacity-80",
                selectedTable?.id === table.id && "opacity-100"
              )}
            />
          ) : (
            <div className={cn(
              "w-16 h-16 rounded-lg bg-info/20 border-2 border-info/40 flex items-center justify-center",
              selectedTable?.id === table.id && "bg-info/30 border-info/60"
            )}>
              <FileText className="w-8 h-8 text-info" />
            </div>
          )}
        </div>

        <div className="w-full mt-auto">
          {(table.status === 'in-use' || table.status === 'awaiting-payment') ? (
            <>
              <div className="flex items-center gap-1 mb-1">
                <Users className="w-3 h-3 text-text-muted flex-shrink-0" />
                <div className="text-sm sm:text-base font-medium text-text-primary truncate" title={table.customer || ''}>{formatClientDisplay(table.customer) || '—'}</div>
              </div>
              <div className="flex items-center gap-1 justify-between">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-text-muted flex-shrink-0" />
                  <div className="text-sm font-bold text-text-secondary">R$ {displayTotal.toFixed(2)}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/historico?mesa=${table.id}`);
                  }}
                  className="p-1 hover:bg-surface-2 rounded transition-colors"
                  title="Ver histórico desta mesa"
                >
                  <FileText className="w-4 h-4 text-text-secondary hover:text-text-primary" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-muted">Sem comanda</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/historico?mesa=${table.id}`);
                }}
                className="p-1 hover:bg-surface-2 rounded transition-colors"
                title="Ver histórico desta mesa"
              >
                <FileText className="w-4 h-4 text-text-secondary hover:text-text-primary" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Define PayDialog before OrderPanel to avoid reference errors
  const PayDialog = () => {
    const total = selectedTable ? calculateTotal(selectedTable.order, selectedTable) : 0;
    const [payLoading, setPayLoading] = useState(false);
    const [paymentLines, setPaymentLines] = useState([]); // {id, clientId, methodId, value}
    const [nextPayLineId, setNextPayLineId] = useState(1);
    const [payClients, setPayClients] = useState([]); // {id, nome}
    const valueRefs = useRef(new Map());
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    const parseBRL = (s) => { const d = String(s || '').replace(/\D/g, ''); return d ? Number(d) / 100 : 0; };
    const formatBRL = (n) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.max(0, Number(n) || 0));
    const taxaForLine = (ln) => {
      const fin = (payMethods || []).find(m => String(m.id) === String(ln.methodId));
      const raw = (fin && fin.taxa_percentual != null) ? Number(fin.taxa_percentual) : 0;
      return Number.isFinite(raw) ? (raw / 100) : 0;
    };
    const sumPayments = () => (paymentLines || []).reduce((acc, ln) => acc + parseBRL(ln.value), 0);

    const focusNextValue = (currentEl, currentId) => {
      try {
        if (isMobile) return; // não focar automatico no mobile para evitar teclado
        // 1) Tenta pelo array de linhas (lógico)
        const idx = (paymentLines || []).findIndex(l => l.id === currentId);
        if (idx >= 0) {
          const next = (paymentLines || [])[idx + 1] || null;
          if (next && valueRefs.current.get(next.id)) {
            const el = valueRefs.current.get(next.id);
            setTimeout(() => { try { el.focus(); el.select?.(); } catch {} }, 0);
            return;
          }
        }
        // 2) Fallback por DOM order (mais robusto quando a lista muda)
        if (currentEl && currentEl instanceof HTMLElement) {
          const list = Array.from(document.querySelectorAll('input[data-pay-value="1"]'));
          const pos = list.indexOf(currentEl);
          if (pos >= 0 && list[pos + 1]) {
            const el = list[pos + 1];
            setTimeout(() => { try { el.focus(); el.select?.(); } catch {} }, 0);
            return;
          }
        }
        // Se não existe próxima linha, cria uma e foca nela
        setPaymentLines(prev => {
          // PERMITIR selecionar o mesmo cliente múltiplas vezes
          // Não filtrar clientes já usados
          const pick = (payClients[0]?.id) || '';
          const defMethod = (payMethods && payMethods[0] && payMethods[0].id) ? payMethods[0].id : null;
          const newId = nextPayLineId;
          const nextState = [...prev, { id: newId, clientId: pick, methodId: defMethod, value: '', chargeFee: true }];
          
          // agenda foco após render
          setNextPayLineId(n => n + 1);
          if (!isMobile) {
            setTimeout(() => {
              const el = valueRefs.current.get(newId);
              if (el) try { el.focus(); el.select?.(); } catch {}
            }, 0);
          }
          return nextState;
        });
      } catch {}
    };

    useEffect(() => {
      let active = true;
      const boot = async () => {
        try {
          if (!isPayOpen || !selectedTable?.comandaId) return;

          // 1) Carregar rascunhos de pagamentos (status Pendente) do banco
          let draftLines = [];
          try {
            const pendentes = await listarPagamentosPorComandaEStatus({ comandaId: selectedTable.comandaId, status: 'Pendente', codigoEmpresa: userProfile?.codigo_empresa });
            draftLines = Array.isArray(pendentes) ? pendentes : [];
          } catch {
            draftLines = [];
          }

          // 2) Carregar clientes vinculados para resolver nomes
          let normalized = [];
          try {
            const vinc = await listarClientesDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const arr = Array.isArray(vinc) ? vinc : [];
            normalized = arr.map(r => {
              const id = r?.cliente_id ?? r?.clientes?.id ?? r?.id ?? null;
              const nome = r?.clientes?.nome ?? r?.nome ?? r?.nome_livre ?? '';
              // Incluir consumidores (nome_livre) mesmo sem cliente_id
              if (!id && nome) {
                return { id: `livre-${r?.id || Math.random()}`, nome };
              }
              return id ? { id, nome } : null;
            }).filter(Boolean);
          } catch { normalized = []; }
          if (!active) return;
          setPayClients(normalized);

          // 3) Se houver rascunhos, reconstruir linhas a partir deles
          if (Array.isArray(draftLines) && draftLines.length > 0) {
            const mapped = draftLines.map((pg, idx) => {
              const totalRecebido = Number(pg.valor || 0); // valor armazenado = total com taxa (se aplicada)
              const lineId = idx + 1;
              const lnTmp = {
                id: lineId,
                clientId: pg.cliente_id || null,
                methodId: pg.finalizadora_id || null,
                chargeFee: true,
              };
              const t = taxaForLine(lnTmp);
              const base = t > 0 ? (totalRecebido / (1 + t)) : totalRecebido;
              const shown = base * (1 + t);
              return {
                ...lnTmp,
                baseValue: base,
                value: formatBRL(shown),
              };
            });
            setPaymentLines(mapped);
            setNextPayLineId(mapped.length + 1);
            return;
          }

          // 4) Sem rascunho: comportamento padrão atual (linha base preenchida automaticamente)
          // garante método padrão mesmo se payMethods chegar após a abertura
          let defMethod = (payMethods && payMethods[0] && payMethods[0].id) ? payMethods[0].id : null;
          let primaryId = (normalized[0]?.id) || null;
          let initialValue = '';
          // auto-preencher SEMPRE com o valor total (independente de quantos clientes)
          try {
            const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const totalItens = (itens || []).reduce((acc, it) => acc + Number(it.quantidade||0) * Number(it.preco_unitario||0), 0);
            if (totalItens > 0) {
              initialValue = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalItens);
            }
          } catch {}
          const base = parseBRL(initialValue);
          const ln0 = { id: 1, clientId: primaryId, methodId: defMethod, baseValue: base, chargeFee: true };
          const t0 = taxaForLine(ln0);
          const shown = ln0.chargeFee ? (base * (1 + t0)) : base;
          setPaymentLines([{ ...ln0, value: formatBRL(shown) }]);
          setNextPayLineId(2);
        } catch (e) {
          console.error(e);
        }
      };
      boot();
      return () => { active = false; };
      // inclui payMethods para rehidratar linha base quando finalizadoras carregarem
    }, [isPayOpen, selectedTable?.comandaId, payMethods]);

    // Persistir rascunho de pagamento no banco enquanto o modal estiver aberto
    useEffect(() => {
      if (!isPayOpen) return;
      if (!selectedTable?.comandaId) return;
      if (!Array.isArray(paymentLines) || paymentLines.length === 0) return;

      const handle = setTimeout(async () => {
        try {
          const linhas = (paymentLines || []).map((ln) => {
            const v = parseBRL(ln.value);
            const fin = (payMethods || []).find(m => String(m.id) === String(ln.methodId));
            const metodoNome = fin?.tipo || fin?.nome || 'outros';
            return {
              clienteId: ln.clientId || null,
              finalizadoraId: ln.methodId || null,
              metodo: metodoNome,
              valor: v,
            };
          });
          await salvarRascunhoPagamentosComanda({ comandaId: selectedTable.comandaId, linhas, codigoEmpresa: userProfile?.codigo_empresa });
        } catch (e) {
          console.warn('[PayDialog] Falha ao salvar rascunho de pagamentos (debounced):', e);
        }
      }, 400);

      return () => {
        clearTimeout(handle);
      };
    }, [isPayOpen, selectedTable?.comandaId, paymentLines, payMethods, userProfile?.codigo_empresa]);

    useEffect(() => {
      let active = true;
      const ensureMethods = async () => {
        try {
          if (!isPayOpen) return;
          if (Array.isArray(payMethods) && payMethods.length > 0) return;
          const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa: userProfile?.codigo_empresa });
          if (!active) return;
          setPayMethods(fins || []);
        } catch {}
      };
      ensureMethods();
      return () => { active = false; };
    }, [isPayOpen]);

    // Quando finalizadoras chegarem e alguma linha estiver sem methodId, aplicar padrão e recalcular
    useEffect(() => {
      if (!isPayOpen) return;
      if (!Array.isArray(payMethods) || payMethods.length === 0) return;
      setPaymentLines(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const def = (payMethods && payMethods[0] && payMethods[0].id) ? payMethods[0].id : null;
        if (!def) return prev;
        let changed = false;
        const next = prev.map(x => {
          if (!x.methodId) {
            changed = true;
            const lnNew = { ...x, methodId: def };
            const t = taxaForLine(lnNew);
            const shown = (lnNew.chargeFee !== false) ? (Number(lnNew.baseValue || 0) * (1 + t)) : Number(lnNew.baseValue || 0);
            return { ...lnNew, value: formatBRL(shown) };
          }
          return x;
        });
        return changed ? next : prev;
      });
    }, [isPayOpen, payMethods]);

    const confirmPay = async () => {
      try {
        if (!selectedTable?.comandaId) return;
        const codigoEmpresa = userProfile?.codigo_empresa;
        if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
        if (!Array.isArray(paymentLines) || paymentLines.length === 0) {
          toast({ title: 'Informe os pagamentos', description: 'Adicione pelo menos uma forma de pagamento.', variant: 'warning' });
          return;
        }
        for (const ln of paymentLines) {
          if (!ln.methodId) { toast({ title: 'Forma de pagamento faltando', description: 'Selecione a finalizadora em todas as linhas.', variant: 'warning' }); return; }
          if (parseBRL(ln.value) <= 0) { toast({ title: 'Valor inválido', description: 'Informe valores maiores que zero.', variant: 'warning' }); return; }
        }
        const effTotal = total > 0 ? total : 0;
        // Soma exibida (linhas já incluem taxa se ativa)
        const totalSum = (paymentLines || []).reduce((acc, ln) => acc + parseBRL(ln.value), 0);
        // Fee esperado baseado na baseValue
        const feeSum = (paymentLines || []).reduce((acc, ln) => {
          const base = Number(ln.baseValue || 0);
          const t = taxaForLine(ln);
          return acc + ((ln.chargeFee !== false && t > 0) ? (base * t) : 0);
        }, 0);
        // Esperado = total de itens + taxas cobradas do cliente
        const expected = effTotal + feeSum;
        // Diferença assinada: >0 cobrando a mais, <0 cobrando a menos
        const diffSigned = totalSum - expected;
        const diffAbs = Math.abs(diffSigned);
        let refreshTotal = total;
        if (refreshTotal <= 0) {
          try {
            const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const t = (itens || []).reduce((acc, it) => acc + Number(it.quantidade||0) * Number(it.preco_unitario||0), 0);
            refreshTotal = t;
          } catch {}
        }
        setPayLoading(true);
        await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        // Garante que o rascunho atual esteja salvo antes de promover para Pago
        try {
          const linhas = (paymentLines || []).map((ln) => {
            const v = parseBRL(ln.value);
            const fin = (payMethods || []).find(m => String(m.id) === String(ln.methodId));
            const metodoNome = fin?.tipo || fin?.nome || 'outros';
            return {
              clienteId: ln.clientId || null,
              finalizadoraId: ln.methodId || null,
              metodo: metodoNome,
              valor: v,
            };
          });
          await salvarRascunhoPagamentosComanda({ comandaId: selectedTable.comandaId, linhas, codigoEmpresa });
        } catch (e) {
          console.warn('[PayDialog] Falha ao salvar rascunho antes de promover:', e);
        }
        await promoverPagamentosRascunhoParaPago({ comandaId: selectedTable.comandaId, codigoEmpresa });
        await fecharComandaEMesa({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa, diferencaPagamento: diffSigned });
        setTables((prev) => prev.map((t) => (t.id === selectedTable.id ? { ...t, status: 'available', order: [], comandaId: null, customer: null, totalHint: 0 } : t)));
        setSelectedTable((prev) => prev ? { ...prev, status: 'available', order: [], comandaId: null, customer: null, totalHint: 0 } : prev);
        try { if (userProfile?.codigo_empresa) localStorage.removeItem(`vendas:tables:${userProfile.codigo_empresa}`); } catch {}
        try {
          const mesas = await listMesas(userProfile?.codigo_empresa);
          const openComandas = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
          const namesByComanda = {};
          await Promise.all((openComandas || []).map(async (c) => {
            try {
              const vincs = await listarClientesDaComanda({ comandaId: c.id, codigoEmpresa: userProfile?.codigo_empresa });
              const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
              namesByComanda[c.id] = nomes.length ? nomes.join(', ') : null;
            } catch { namesByComanda[c.id] = null; }
          }));
          const enrichedTables = (mesas || []).map((mesa) => {
            const comanda = (openComandas || []).find((c) => c.mesa_id === mesa.id);
            return { id: mesa.id, name: mesa.nome || `Mesa ${mesa.numero}`, status: comanda ? 'in-use' : 'available', comandaId: comanda?.id || null, customer: comanda ? namesByComanda[comanda.id] : null, order: [], totalHint: 0, aberto_em: comanda?.aberto_em || null };
          });
          setTables(enrichedTables);
        } catch {}
        const diffMsg = diffAbs > 0.009 ? (diffSigned > 0
          ? ` | Diferença cobrada a mais: R$ ${diffAbs.toFixed(2)}`
          : ` | Diferença cobrada a menos: R$ ${diffAbs.toFixed(2)}`)
          : '';
        toast({ title: 'Pagamento registrado', description: `Total itens R$ ${refreshTotal.toFixed(2)} | Pagamentos R$ ${totalSum.toFixed(2)}${diffMsg}`, variant: 'success' });
        setIsPayOpen(false);
      } catch (e) {
        toast({ title: 'Falha ao registrar pagamento', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setPayLoading(false);
      }
    };

    const canConfirm = (paymentLines && paymentLines.length > 0) && !payLoading;

    // CÁLCULOS PARA EXIBIÇÃO NO RODAPÉ DO MODAL
    const uiEffTotal = total > 0 ? total : 0;
    const uiTotalSum = (paymentLines || []).reduce((acc, ln) => acc + parseBRL(ln.value), 0);
    const uiFeeSum = (paymentLines || []).reduce((acc, ln) => {
      const base = Number(ln.baseValue || 0);
      const t = taxaForLine(ln);
      return acc + ((ln.chargeFee !== false && t > 0) ? (base * t) : 0);
    }, 0);
    const uiExpected = uiEffTotal + uiFeeSum;
    const uiDiffSigned = uiTotalSum - uiExpected;
    const uiDiffAbs = Math.abs(uiDiffSigned);

    return (
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="sm:max-w-xl w-[92vw] max-h-[85vh] animate-none flex flex-col overflow-hidden" onKeyDown={(e) => e.stopPropagation()} onKeyDownCapture={(e) => e.stopPropagation()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Fechar Conta</DialogTitle>
            <DialogDescription>Divida o pagamento entre clientes e várias finalizadoras, se necessário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {/* Cálculo de descontos - Compacto */}
            {(() => {
              let subtotalItens = 0;
              let descontoItens = 0;
              let descontoComanda = 0;
              
              // Calcular subtotal e descontos por item
              for (const item of (selectedTable?.order || [])) {
                const valor = (item.price || 0) * (item.quantity || 1);
                subtotalItens += valor;
                
                if (item.desconto_tipo === 'percentual' && item.desconto_valor > 0) {
                  descontoItens += valor * (item.desconto_valor / 100);
                } else if (item.desconto_tipo === 'fixo' && item.desconto_valor > 0) {
                  descontoItens += item.desconto_valor;
                }
              }
              
              // Calcular desconto da comanda
              const subtotalComDescItens = subtotalItens - descontoItens;
              if (selectedTable?.desconto_tipo === 'percentual' && selectedTable?.desconto_valor > 0) {
                descontoComanda = subtotalComDescItens * (selectedTable.desconto_valor / 100);
              } else if (selectedTable?.desconto_tipo === 'fixo' && selectedTable?.desconto_valor > 0) {
                descontoComanda = selectedTable.desconto_valor;
              }
              
              const totalDescontos = descontoItens + descontoComanda;
              
              return (
                <>
                  <div className="flex items-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary">Subtotal</span>
                      <span className="font-semibold">R$ {subtotalItens.toFixed(2)}</span>
                    </div>
                    {totalDescontos > 0 && (
                      <div className="flex items-center gap-2 text-destructive">
                        <span>Descontos</span>
                        <span className="font-semibold">-R$ {totalDescontos.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-border pt-1 flex items-center justify-between">
                    <div className="font-semibold">Total</div>
                    <div className="font-bold text-lg">R$ {total.toFixed(2)}</div>
                  </div>
                </>
              );
            })()}
            
            <div className="flex items-center gap-8 text-xs text-text-muted pt-1">
              <div className="flex items-center gap-2">
                <span>Pagamentos</span>
                <span className="font-semibold">R$ {uiTotalSum.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Diferença</span>
                <span className={uiDiffAbs > 0.009 ? (uiDiffSigned > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600') : 'font-semibold'}>
                  {uiDiffAbs > 0.009
                    ? `${uiDiffSigned > 0 ? '+' : '-'} R$ ${uiDiffAbs.toFixed(2)}`
                    : 'R$ 0,00'}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto thin-scroll pr-1 max-h-[60vh]">
              <Label className="block">Pagamentos</Label>
              {(paymentLines || []).map((ln, idx) => {
                const resolveClientName = (cid) => {
                  if (!cid) return 'Cliente';
                  const byPay = (payClients || []).find(c => String(c.id) === String(cid));
                  if (byPay?.nome) return byPay.nome;
                  return 'Cliente';
                };
                const hasMultiClients = (payClients || []).length > 1;
                const primary = (payClients || [])[0] || null;
                // PERMITIR selecionar o mesmo cliente múltiplas vezes - não filtrar por usados
                const remaining = (payClients || []).filter(c => String(c.id) !== String(primary?.id || ''));
                return (
                  <div key={ln.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-1 flex sm:justify-start">
                      {paymentLines.length > 1 && idx > 0 && (
                        <Button type="button" variant="outline" size="sm" className="h-8 w-8" onClick={() => {
                          setPaymentLines(prev => {
                            const newLines = prev.filter(x => x.id !== ln.id);
                            if (newLines.length === 0) return [];
                            
                            // Redistribuir valores automaticamente
                            const totalValue = total > 0 ? total : 0;
                            const perLine = Math.floor((totalValue / newLines.length) * 100) / 100;
                            const remainder = totalValue - (perLine * newLines.length);
                            
                            return newLines.map((line, i) => {
                              const value = i === newLines.length - 1 ? perLine + remainder : perLine;
                              const lnTmp = { ...line };
                              const t = taxaForLine(lnTmp);
                              const charge = lnTmp.chargeFee !== false; // default true
                              const base = charge && t > 0 ? (value / (1 + t)) : value;
                              return { ...lnTmp, baseValue: base, value: formatBRL(value) };
                            });
                          });
                        }}>×</Button>
                      )}
                    </div>
                    {(idx === 0) ? (
                      <div className="sm:col-span-4">
                        <div className="h-9 px-3 rounded-md border border-border bg-surface flex items-center text-sm truncate">{resolveClientName(primary?.id || ln.clientId)}</div>
                      </div>
                    ) : hasMultiClients ? (
                      <div className="sm:col-span-4">
                        <Select value={ln.clientId || ''} onValueChange={(v) => setPaymentLines(prev => prev.map(x => x.id === ln.id ? { ...x, clientId: v } : x))}>
                          <SelectTrigger className="w-full truncate"><SelectValue placeholder="Cliente" /></SelectTrigger>
                          <SelectContent>
                            {/* Mostrar TODOS os clientes, incluindo o primary */}
                            {(payClients || []).map(c => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="sm:col-span-4">
                        <div className="h-9 px-3 rounded-md border border-border bg-surface flex items-center text-sm truncate">{resolveClientName(primary?.id || ln.clientId)}</div>
                      </div>
                    )}
                    <div className="sm:col-span-4">
                      <Select value={ln.methodId || ''} onValueChange={(v) => {
                        setPaymentLines(prev => prev.map(x => {
                          if (x.id !== ln.id) return x;
                          const newId = v;
                          const lnNew = { ...x, methodId: newId };
                          const t = taxaForLine(lnNew);
                          const shown = (lnNew.chargeFee !== false) ? (Number(lnNew.baseValue || 0) * (1 + t)) : Number(lnNew.baseValue || 0);
                          return { ...lnNew, value: formatBRL(shown) };
                        }));
                      }}>
                        <SelectTrigger className="w-full truncate"><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
                        <SelectContent>
                          {(payMethods || []).map(m => (<SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Input placeholder="0,00" inputMode="numeric" value={ln.value}
                        data-pay-value="1"
                        ref={(el) => {
                          if (el) valueRefs.current.set(ln.id, el); else valueRefs.current.delete(ln.id);
                        }}
                        onChange={(e) => {
                          const digits = (e.target.value || '').replace(/\D/g, '');
                          const entered = digits ? Number(digits) / 100 : 0;
                          setPaymentLines(prev => prev.map(x => {
                            if (x.id !== ln.id) return x;
                            const t = taxaForLine(x);
                            // Se taxa ativa, o valor digitado é o total cobrado; base = entered/(1+t)
                            // Se taxa inativa, valor digitado é a base
                            const base = (x.chargeFee !== false && t > 0) ? (entered / (1 + t)) : entered;
                            const shown = (x.chargeFee !== false) ? (base * (1 + t)) : base;
                            return { ...x, baseValue: base, value: formatBRL(shown) };
                          }));
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') { e.preventDefault(); focusNextValue(e.currentTarget, ln.id); return; }
                          const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                          if (allowed.includes(e.key)) return;
                          if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); }
                        }}
                        onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                      />
                    </div>
                    {/* Checkbox visual para cobrar taxa (preto com detalhes amarelos quando ativo) */}
                    <div className="sm:col-span-12 -mt-1 pl-1">
                      {(() => {
                        const tPct = taxaForLine(ln); // 0..1
                        const taxa = tPct * 100;
                        const active = ln.chargeFee !== false; // default: true
                        const base = ln.baseValue != null ? Number(ln.baseValue) : (() => {
                          const raw = (ln.value || '').toString();
                          const digits = raw.replace(/\D/g, '');
                          const disp = digits ? Number(digits) / 100 : 0;
                          return active && tPct > 0 ? (disp / (1 + tPct)) : disp;
                        })();
                        if (!taxa || taxa <= 0 || !Number.isFinite(base) || base <= 0) return null;
                        const fee = active ? (base * tPct) : 0;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentLines(prev => prev.map(x => {
                                if (x.id !== ln.id) return x;
                                const t = taxaForLine(x);
                                const wasActive = x.chargeFee !== false;
                                // Usa baseValue para derivar o exibido
                                const base = x.baseValue != null ? Number(x.baseValue) : parseBRL(x.value);
                                const shown = (!wasActive ? (base * (1 + t)) : base);
                                return { ...x, chargeFee: !wasActive, baseValue: base, value: formatBRL(shown) };
                              }));
                            }}
                            className={[
                              "inline-flex items-center gap-2 px-3 py-1 rounded-sm text-xs font-medium border transition-colors",
                              active ? "bg-black text-amber-400 border-amber-500" : "bg-surface text-text-secondary border-border hover:border-border-hover"
                            ].join(' ')}
                            title={active ? 'Desmarcar taxa' : 'Cobrar taxa'}
                          >
                            <span className={["inline-block h-3 w-3 rounded-sm border",
                              active ? "bg-amber-500 border-amber-400" : "bg-transparent border-border"].join(' ')} />
                            <span>Taxa R$ {fee.toFixed(2)}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              <div>
                <Button type="button" variant="secondary" size="sm" className="pointer-events-auto"
                  onPointerUp={(e) => { e.preventDefault(); e.stopPropagation();
                  setPaymentLines(prev => {
                    // PERMITIR selecionar o mesmo cliente múltiplas vezes
                    const pick = (payClients[0]?.id) || '';
                    const defMethod = (payMethods && payMethods[0] && payMethods[0].id) ? payMethods[0].id : null;
                    const newLines = [...prev, { id: nextPayLineId, clientId: pick, methodId: defMethod, value: '', chargeFee: true }];
                    
                    // Distribuir valor total automaticamente entre todas as linhas
                    const totalValue = total > 0 ? total : 0;
                    const perLine = Math.floor((totalValue / newLines.length) * 100) / 100; // Arredondar para baixo
                    const remainder = totalValue - (perLine * newLines.length); // Calcular resto
                    
                    return newLines.map((line, idx) => {
                      // Adicionar o resto na última linha para fechar exato
                      const value = idx === newLines.length - 1 ? perLine + remainder : perLine;
                      const t = taxaForLine(line);
                      const charge = line.chargeFee !== false; // default true
                      const base = charge && t > 0 ? (value / (1 + t)) : value;
                      return { ...line, baseValue: base, value: formatBRL(value) };
                    });
                  });
                  setNextPayLineId(n => n + 1);
                }}
                >Adicionar forma</Button>
              </div>
              {(() => {
                const somaExibida = sumPayments();
                const feeSum = (paymentLines || []).reduce((acc, ln) => {
                  const base = Number(ln.baseValue || 0);
                  const t = taxaForLine(ln);
                  return acc + ((ln.chargeFee !== false && t > 0) ? (base * t) : 0);
                }, 0);
                const esperado = (total > 0 ? total : 0) + feeSum;
                const restante = esperado - somaExibida;
                return (
                  <>
                    <div className="text-sm text-text-secondary flex justify-between"><span>Soma</span><span>R$ {somaExibida.toFixed(2)}</span></div>
                    <div className="text-sm font-semibold flex justify-between"><span>Restante</span><span className={Math.abs(restante) < 0.005 ? 'text-success' : 'text-warning'}>R$ {restante.toFixed(2)}</span></div>
                  </>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)} disabled={payLoading}>Cancelar</Button>
            <Button type="button" onClick={confirmPay} disabled={!((paymentLines && paymentLines.length > 0) && !payLoading)}>
              {payLoading ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const CashierDetailsDialog = React.memo(({ open, onOpenChange, cashSummary }) => {
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

    // Mostrar skeleton apenas na primeira carga de cada abertura
    const [showSkeleton, setShowSkeleton] = useState(true);
    useEffect(() => {
      if (open) {
        setShowSkeleton(true);
      } else {
        setShowSkeleton(false);
      }
    }, [open]);

    // Memoizar cálculos para evitar re-renders desnecessários
    const cashData = useMemo(() => {
      const saldoInicial = Number(cashSummary?.saldo_inicial ?? cashSummary?.saldoInicial ?? 0);
      const porFinalizadora = cashSummary?.totalPorFinalizadora || cashSummary?.porFinalizadora || {};
      const entradasInformadas = Number(cashSummary?.totalEntradas ?? cashSummary?.entradas ?? 0);
      const entradasCalc = entradasInformadas > 0
        ? entradasInformadas
        : Object.values(porFinalizadora || {}).reduce((acc, v) => acc + Number(v || 0), 0);
      const sangriaVal = Number(cashSummary?.sangria ?? cashSummary?.totalSangria ?? 0);
      const saidas = Number(cashSummary?.totalSaidas ?? cashSummary?.saidas ?? sangriaVal);
      const saldoAtual = Math.max(0, saldoInicial + entradasCalc - saidas);
      return { saldoInicial, porFinalizadora, entradasInformadas, entradasCalc, sangriaVal, saidas, saldoAtual };
    }, [cashSummary]);

    // Ao receber um cashSummary válido na abertura, escondemos skeleton de forma estável
    useEffect(() => {
      if (open && cashSummary) {
        const t = setTimeout(() => setShowSkeleton(false), 50);
        return () => clearTimeout(t);
      }
    }, [open, cashSummary]);

    const { porFinalizadora, sangriaVal } = cashData;
    const [isSangriaOpen, setIsSangriaOpen] = useState(false);
    const [sangriaValor, setSangriaValor] = useState('');
    const [sangriaObs, setSangriaObs] = useState('');
    const [sangriaLoading, setSangriaLoading] = useState(false);
    const performSangria = async () => {
      try {
        setSangriaLoading(true);
        const digits = String(sangriaValor || '').replace(/\D/g, '');
        const valor = digits ? Number(digits) / 100 : 0;
        if (valor <= 0) {
          toast({ title: 'Valor inválido', description: 'Informe um valor positivo.', variant: 'warning' });
          return;
        }
        await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        await criarMovimentacaoCaixa({ tipo: 'sangria', valor, observacao: sangriaObs, codigoEmpresa: userProfile?.codigo_empresa });
        setIsSangriaOpen(false);
        setSangriaValor('');
        setSangriaObs('');
        await reloadCashSummary();
        toast({ title: 'Sangria registrada', variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao registrar sangria', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setSangriaLoading(false);
      }
    };
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          forceMount
          className="sm:max-w-lg w-[92vw] max-h-[85vh] animate-none flex flex-col overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Detalhes do Caixa</DialogTitle>
            <DialogDescription>Resumo da sessão atual do caixa.</DialogDescription>
          </DialogHeader>
          {showSkeleton || !cashSummary ? (
            <div className="px-4 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="px-1">
              {Object.keys(porFinalizadora).length === 0 ? (
                <div className="p-3 text-sm text-text-muted border rounded-md">Nenhuma finalizadora registrada ainda.</div>
              ) : (
                <>
                  <ul className="rounded-md border border-border overflow-hidden divide-y divide-border">
                    {Object.entries(porFinalizadora).map(([nome, valor]) => (
                      <li key={nome} className="bg-surface px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-text-secondary truncate pr-3">{String(nome)}</span>
                        <span className="text-sm font-semibold tabular-nums">{fmt(valor)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-text-secondary truncate pr-3">Sangrias</span>
                    <span className="text-sm font-semibold tabular-nums text-danger">{fmt(sangriaVal)}</span>
                  </div>
                </>
              )}
              <div className="mt-3 text-xs text-text-muted leading-relaxed px-1">
                Saídas incluem sangrias e ajustes. Use "Registrar Sangria" para lançar uma retirada.
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between gap-2">
            <div className="mr-auto" />
            <Button variant="destructive" onClick={() => setIsSangriaOpen(true)}>Registrar Sangria</Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
          <Dialog open={isSangriaOpen} onOpenChange={setIsSangriaOpen}>
            <DialogContent className="sm:max-w-sm w-[92vw] max-h-[85vh] animate-none" onKeyDown={(e) => e.stopPropagation()} onKeyDownCapture={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Registrar Sangria</DialogTitle>
                <DialogDescription>Informe o valor a retirar do caixa e, opcionalmente, uma observação.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sangria-valor">Valor</Label>
                  <Input
                    id="sangria-valor"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0,00"
                    value={sangriaValor}
                    onChange={(e) => {
                      const digits = (e.target.value || '').replace(/\D/g, '');
                      const cents = digits ? Number(digits) / 100 : 0;
                      const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
                      setSangriaValor(formatted);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                      if (allowed.includes(e.key)) return;
                      if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); }
                    }}
                    onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                  />
                </div>
                <div>
                  <Label htmlFor="sangria-obs">Observação</Label>
                  <Input id="sangria-obs" placeholder="Opcional" value={sangriaObs} onChange={(e) => setSangriaObs(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSangriaOpen(false)} disabled={sangriaLoading}>Cancelar</Button>
                <Button onClick={performSangria} disabled={sangriaLoading}>{sangriaLoading ? 'Registrando...' : 'Confirmar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );
  });

  // Modal de confirmação de remoção de item
  const RemoveItemConfirmDialog = () => {
    const handleConfirm = async () => {
      if (!itemToRemove) return;
      try {
        await removerItem({ itemId: itemToRemove.id, codigoEmpresa: userProfile?.codigo_empresa });
        toast({ title: 'Item removido', description: itemToRemove.name, variant: 'warning' });
      } catch (e) {
        toast({ title: 'Falha ao remover item', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setIsRemoveConfirmOpen(false);
        setItemToRemove(null);
      }
    };

    return (
      <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{itemToRemove?.name}" da comanda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const OrderDetailsDialog = () => {
    const tbl = selectedTable;
    const items = tbl?.order || [];
    const total = tbl ? calculateTotal(items) : 0;
    console.log('[OrderDetailsDialog] tbl:', tbl, 'comandaId:', tbl?.comandaId);
    return (
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent
          className="sm:max-w-xl w-[92vw] animate-none"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Comanda da Mesa {tbl?.number ?? '—'}</DialogTitle>
            <DialogDescription>{tbl?.customer ? `Cliente: ${tbl.customer}` : 'Sem cliente vinculado'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto thin-scroll">
            {items.length === 0 ? (
              <div className="text-sm text-text-muted">Nenhum item na comanda.</div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((it) => (
                  <li key={it.id} className="py-2 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{it.name}</div>
                      <div className="text-xs text-text-muted">Qtd: {it.quantity} • Unit: R$ {Number(it.price || 0).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">R$ {(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <div className="mr-auto text-sm font-semibold">Total: R$ {total.toFixed(2)}</div>
            <Button variant="secondary" onClick={() => setIsOrderDetailsOpen(false)}>Fechar</Button>
            {tbl?.comandaId && (
              <Button variant="outline" onClick={() => window.open(`/print-comanda?comanda=${tbl.comandaId}`, '_blank')}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
            )}
            <Button onClick={async () => { setIsOrderDetailsOpen(false); await openPayDialog(); }} disabled={!tbl || (items.length === 0)}>
              <DollarSign className="mr-2 h-4 w-4" /> Fechar Conta
              <kbd className="ml-2 hidden md:inline px-2 py-1 text-xs font-bold font-mono text-white bg-amber-600 border border-amber-700 rounded shadow-sm">F2</kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const OrderDetailsPanel = ({ table }) => {
    const [localObservacoes, setLocalObservacoes] = useState('');
    const [savingObs, setSavingObs] = useState(false);
    const [showItemDiscounts, setShowItemDiscounts] = useState(false);

    const handleSaveObservacoes = async () => {
      if (!table?.comandaId || savingObs) return;
      try {
        setSavingObs(true);
        await adicionarObservacaoComanda({
          comandaId: table.comandaId,
          observacoes: localObservacoes,
          codigoEmpresa: Number(userProfile?.codigo_empresa)
        });
        toast({
          title: 'Observações salvas',
          description: 'As observações da comanda foram atualizadas.',
        });
        // Recarregar detalhes da comanda para trazer observações atualizadas do banco
        try {
          await refetchSelectedTableDetails(table);
        } catch (err) {
          console.error('Erro ao recarregar detalhes da comanda após salvar observações:', err);
        }
      } catch (err) {
        if (err?.code !== '42804') {
          console.error('Erro ao salvar observação:', err);
          toast({
            title: 'Erro ao salvar observações',
            description: 'Tente novamente mais tarde.',
            variant: 'destructive',
          });
        }
      } finally {
        setSavingObs(false);
      }
    };

    // Sincronizar observações locais com os dados da comanda
    // Sempre que a comanda (ou observações dela) mudar, refletir no estado local.
    // Isso garante que desktop e mobile vejam o mesmo texto salvo.
    useEffect(() => {
      if (!table?.comandaId) {
        setLocalObservacoes('');
        return;
      }
      setLocalObservacoes(table.observacoes || '');
    }, [table?.comandaId, table?.observacoes]);

    if (!table) return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Selecione uma mesa</p>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto thin-scroll">
        {/* Itens com Desconto (recolhível) */}
        {table.order && table.order.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Descontos por Item</Label>
              <Button
                size="xs"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => setShowItemDiscounts((prev) => !prev)}
              >
                {showItemDiscounts ? 'Esconder' : `Mostrar (${table.order.length})`}
              </Button>
            </div>
            {showItemDiscounts && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {table.order.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemForDesconto(item)}
                    className="w-full p-3 rounded border border-border bg-surface hover:bg-surface-2 transition text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-xs text-text-secondary">Qtd: {item.quantity} × R$ {(item.price || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.desconto_valor > 0 ? (
                          <span className="text-xs font-bold text-destructive">
                            -{item.desconto_tipo === 'percentual' ? item.desconto_valor + '%' : 'R$' + (item.desconto_valor || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">Sem desconto</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Observações */}
        {table.comandaId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-semibold">Observações</Label>
              {savingObs && (
                <span className="text-[11px] text-text-secondary">Salvando...</span>
              )}
            </div>
            <textarea
              className="border border-border rounded p-3 text-sm resize-none bg-background min-h-20"
              placeholder="Ex: sem cebola, urgente, etc."
              value={localObservacoes}
              onChange={(e) => {
                const newValue = e.target.value;
                setLocalObservacoes(newValue);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  await handleSaveObservacoes();
                }
              }}
            />
          </div>
        )}

        {/* Desconto da Comanda */}
        {table.comandaId && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Desconto da Comanda</Label>
            <Button
              size="sm"
              variant={table.desconto_valor > 0 ? "default" : "outline"}
              onClick={() => setIsDescontoComandaDialogOpen(true)}
              className="w-full gap-2"
            >
              {table.desconto_valor > 0 ? (
                <>
                  <span>Desconto Ativo:</span>
                  <span className="font-bold">
                    -{table.desconto_tipo === 'percentual' 
                      ? table.desconto_valor + '%' 
                      : 'R$' + table.desconto_valor.toFixed(2)}
                  </span>
                </>
              ) : (
                'Aplicar Desconto'
              )}
            </Button>
            {table.desconto_motivo && (
              <div className="text-xs text-text-secondary bg-surface p-2 rounded border border-border">
                <strong>Motivo:</strong> {table.desconto_motivo}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const OrderPanel = ({ table }) => {
    if (!table) return (
      <div 
        className="flex items-center justify-center h-full text-text-muted"
      >
        <div className="text-center">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Selecione uma mesa para ver a comanda</p>
        </div>
      </div>
    );
    
    if (loadingItems) return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <div className="h-0 w-0" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap" disabled={!isCashierOpen} onClick={() => { if (!isCashierOpen) { toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de abrir uma mesa.', variant: 'warning' }); return; } setPendingTable(table); setIsOpenTableDialog(true); }}>Abrir Mesa</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 thin-scroll">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex justify-between items-center text-sm font-semibold text-text-secondary mb-2">
            <span>Total</span>
            <span>R$ 0,00</span>
          </div>
          <Button size="lg" className="w-full" disabled={!isCashierOpen}>Fechar Conta</Button>
        </div>
      </div>
    );

    const total = calculateTotal(table.order, table);
    const customerDisplay = formatClientDisplay(table.customer);
    const reloadItems = async () => {
      if (!table?.comandaId) return;
      const itens = await listarItensDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
      const syncedTotal = (order || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0);
      // refresh customer names to avoid disappearing labels
      let customerName = table.customer || null;
      try {
        const vinculos = await listarClientesDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
        const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
        customerName = nomes.length ? nomes.join(', ') : null;
      } catch {}
      const updated = { ...table, order, customer: customerName, totalHint: syncedTotal };
      setSelectedTable(updated);
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    };

    const changeQty = async (item, delta) => {
      try {
        const current = Number(item.quantity || 1);
        const next = current + delta;
        if (next <= 0) {
          setItemToRemove(item);
          setIsRemoveConfirmOpen(true);
          // Após o modal fechar, recarregar itens
          setTimeout(async () => {
            if (!isRemoveConfirmOpen) {
              await reloadItems();
            }
          }, 100);
          return;
        }
        // Ajuste otimista do totalHint (delta unidades)
        const deltaValue = Number(item.price || 0) * Number(delta || 0);
        if (deltaValue) {
          setSelectedTable((prev) => prev ? { ...prev, totalHint: Math.max(0, Number(prev.totalHint || 0) + deltaValue) } : prev);
          setTables((prev) => prev.map(t => t.id === (selectedTable?.id) ? { ...t, totalHint: Math.max(0, Number(t.totalHint || 0) + deltaValue) } : t));
        }
        await atualizarQuantidadeItem({ itemId: item.id, quantidade: next, codigoEmpresa: userProfile?.codigo_empresa });
        await reloadItems();
        toast({ title: 'Quantidade atualizada', description: `${item.name}: ${next}`, variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao atualizar quantidade', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    };
    const removeLine = async (item) => {
      setItemToRemove(item);
      setIsRemoveConfirmOpen(true);
      // Após o modal fechar, recarregar itens
      setTimeout(async () => {
        if (!isRemoveConfirmOpen) {
          await reloadItems();
        }
      }, 100);
    };
    return (
      <>
        <div 
          className="flex flex-col h-full"
          onMouseDown={(e) => {
            // Prevent losing focus when clicking on the panel
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div className="p-3 border-b border-border flex items-center justify-center md:justify-between gap-2">
            {customerDisplay ? (
              // Mostrar nome do cliente em telas >= sm; esconder só no mobile bem pequeno para não cortar
              <div className="hidden sm:block text-sm font-medium text-text-primary leading-none truncate" title={table.customer || ''}>{customerDisplay}</div>
            ) : <div className="h-0 w-0" aria-hidden="true" />}
            <div className="flex items-center gap-2">
              {table.comandaId ? (
                <>
                  <Button
                    size="sm"
                    className="h-8 px-3 rounded-full text-[12px] font-medium leading-none whitespace-nowrap bg-black/60 text-white border border-white/10 shadow-sm hover:bg-black/80 hover:shadow transition-all flex items-center"
                    onClick={() => setIsManageClientsOpen(true)}
                  >
                    <Users size={12} className="text-white/80 mr-1.5" />
                    Clientes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 rounded-full text-[12px] font-medium leading-none whitespace-nowrap bg-black/60 text-white border border-white/10 shadow-sm hover:bg-black/80 hover:shadow transition-all"
                    onClick={() => setIsOrderDetailsOpen(true)}
                  >
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-black/40 border border-white/10 mr-1.5">
                      <FileText size={12} className="text-white/80" />
                    </span>
                    Comanda
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        className="h-7 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap bg-red-600 hover:bg-red-500 text-white border border-red-600/70 focus:outline-none focus:ring-0 focus-visible:ring-0 shadow-none"
                      >
                        Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-[420px] animate-none" onKeyDown={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar comanda?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Os itens serão descartados e a mesa voltará a ficar livre.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction 
                          disabled={false}
                          onClick={async (e) => {
                            // Fechar dialog imediatamente
                            const dialog = e.currentTarget.closest('[role="alertdialog"]');
                            if (dialog) {
                              const closeBtn = dialog.querySelector('[data-radix-collection-item]');
                              closeBtn?.click();
                            }
                            
                            try {
                              // Limpar localStorage ANTES de cancelar para evitar restauração
                              const codigoEmpresa = userProfile?.codigo_empresa;
                              if (codigoEmpresa) {
                                try {
                                  localStorage.removeItem(`vendas:selected:${codigoEmpresa}`);
                                  localStorage.removeItem(`vendas:tables:${codigoEmpresa}`);
                                } catch {}
                              }
                              
                              await cancelarComandaEMesa({ comandaId: table.comandaId, codigoEmpresa });
                              
                              setSelectedTable(null);
                              await refreshTablesLight({ showToast: false });
                              
                              toast({ title: 'Comanda cancelada', variant: 'success' });
                            } catch (err) {
                              console.error('[Cancelar Comanda] Erro:', err);
                              toast({ title: 'Falha ao cancelar comanda', description: err?.message || 'Tente novamente', variant: 'destructive' });
                              try { await refreshTablesLight({ showToast: false }); } catch (refreshErr) { console.error('[Cancelar Comanda] Erro ao recarregar após falha:', refreshErr); }
                            }
                          }}
                        >Confirmar Cancelamento</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button size="sm" className="h-7 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap" disabled={!isCashierOpen} onClick={() => { if (!isCashierOpen) { toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de abrir uma mesa.', variant: 'warning' }); return; } setPendingTable(table); setIsOpenTableDialog(true); }}>Abrir Mesa</Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 thin-scroll">
            {table.order.length === 0 ? (
              <div className="text-center text-text-muted pt-16">
                <p>Comanda vazia. Adicione produtos na aba ao lado.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {table.order.map(item => (
                  <li key={item.id} className="p-2 rounded-md border border-border/30 bg-surface">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate" title={item.name}>{item.name}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(item, -1)}><Minus size={12} /></Button>
                        <span className="w-7 text-center font-semibold text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(item, +1)}><Plus size={12} /></Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right flex-1">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-text-primary">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            {item.desconto_valor > 0 && (
                              <span className="text-xs font-semibold text-destructive">
                                -{item.desconto_tipo === 'percentual' ? item.desconto_valor + '%' : 'R$' + (item.desconto_valor || 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-danger/80 hover:text-danger h-7 w-7" onClick={() => removeLine(item)}><Trash2 size={14}/></Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-border mt-auto space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center text-sm font-semibold text-text-secondary">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            
            {/* Fechar Conta */}
            <Button size="lg" className="w-full" onClick={openPayDialog}>
              <DollarSign className="mr-2" /> Fechar Conta
              <kbd className="ml-2 hidden md:inline px-2 py-1 text-xs font-bold font-mono text-white bg-amber-600 border border-amber-700 rounded shadow-sm">F2</kbd>
            </Button>
          </div>
        </div>
        <PayDialog />
        </>
    );
  };

  const CreateMesaDialog = () => {
    const [numeroVal, setNumeroVal] = useState('');
    const [nomeVal, setNomeVal] = useState('');
    // Estado apenas em memória para máxima responsividade (sem localStorage)
    const setNumeroPersist = (value) => { setNumeroVal(value); };
    const confirmCreate = async () => {
      try {
        if (loading) return; // Prevenir múltiplas execuções
        setLoading(true);
        const raw = (numeroVal ?? '').toString().trim();
        const numero = raw ? Number(raw) : undefined;
        if (numero !== undefined && (Number.isNaN(numero) || numero <= 0)) {
          toast({ title: 'Número inválido', description: 'Informe um número positivo.', variant: 'warning' });
          return;
        }
        const mesa = await criarMesa({ numero, nome: (nomeVal || '').trim() || undefined, codigoEmpresa: userProfile?.codigo_empresa });

        const newTable = {
          id: mesa.id,
          number: mesa.numero,
          name: mesa.nome,
          status: 'available',
          order: [],
          customer: null,
          comandaId: null,
          totalHint: 0,
        };
        setTables((prev) => {
          const exists = prev.some(t => t.id === newTable.id);
          const next = exists ? prev.map(t => (t.id === newTable.id ? newTable : t)) : [...prev, newTable];
          return next.slice().sort((a, b) => Number(a.number) - Number(b.number));
        });
        React.startTransition(() => {
          setSelectedTable(newTable);
          setIsCreateMesaOpen(false);
        });
        toast({ title: 'Mesa criada', description: `Mesa ${mesa.numero} adicionada`, variant: 'success' });
        setNumeroVal('');
        setNomeVal('');
      } catch (e) {
        toast({ title: 'Falha ao criar mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    return (
      <Dialog open={isCreateMesaOpen} onOpenChange={(open) => { 
        setIsCreateMesaOpen(open); 
        if (!open) { setNumeroVal(''); setNomeVal(''); }
      }}>
        <DialogContent
          className="sm:max-w-md w-[92vw]"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Nova Mesa</DialogTitle>
            <DialogDescription>Informe o nome da mesa. Se deixar em branco, será criada com numeração automática.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="nova-mesa-nome">Nome da mesa</Label>
            <Input
              id="nova-mesa-nome"
              type="text"
              placeholder="Ex: Mesa 1, Varanda, etc."
              value={nomeVal}
              onChange={(e) => setNomeVal(e.target.value)}
              onKeyDown={(e) => { 
                e.stopPropagation(); 
                if (e.key === 'Enter' && !loading) {
                  e.preventDefault();
                  confirmCreate(); 
                }
              }}
              onKeyPress={(e) => e.stopPropagation()}
            />
            {/* Campo opcional de número explícito (avançado): oculto por padrão, deixar pronto se necessário */}
            {/* <Label htmlFor="nova-mesa-numero">Número da mesa (opcional)</Label>
            <Input id="nova-mesa-numero" type="number" min="1" placeholder="Auto"
              value={numeroVal}
              onChange={(e) => setNumeroPersist(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.preventDefault(); }}
            /> */}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateMesaOpen(false)} disabled={loading}>Cancelar</Button>
            <Button type="button" onClick={confirmCreate} disabled={loading}>{loading ? 'Criando...' : 'Criar Mesa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const addProductToComanda = async (prod) => {
    try {
      if (!isCashierOpen) {
        toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de adicionar produtos.', variant: 'warning' });
        return;
      }
      if (!selectedTable?.comandaId) {
        toast({ title: 'Selecione uma mesa', description: 'Abra a comanda clicando na mesa primeiro.', variant: 'destructive' });
        return;
      }
      
      // Validar estoque GLOBAL ANTES de adicionar
      const currentStock = Number(prod.stock ?? prod.currentStock ?? 0);
      const reserved = reservedStock.get(prod.id) || 0;
      const available = Math.max(0, currentStock - reserved);
      const currentQtyInOrder = (selectedTable?.order || []).find(it => it.productId === prod.id)?.quantity || 0;
      const newQty = currentQtyInOrder + 1;
      
      if (newQty > available) {
        toast({ 
          title: 'Estoque insuficiente', 
          description: `${prod.name} - Estoque disponível: ${available} (${currentStock} total, ${reserved} reservado em outras comandas)`, 
          variant: 'destructive' 
        });
        return;
      }
      
      const price = Number(prod.salePrice ?? prod.price ?? 0);
      
      // Persistir no backend PRIMEIRO
      const existing = (selectedTable?.order || []).find(it => it.productId === prod.id);
      let itemResult;
      if (existing) {
        await atualizarQuantidadeItem({ itemId: existing.id, quantidade: Number(existing.quantity || 1) + 1, codigoEmpresa: userProfile?.codigo_empresa });
        itemResult = { ...existing, quantity: Number(existing.quantity || 1) + 1 };
      } else {
        itemResult = await adicionarItem({ comandaId: selectedTable.comandaId, produtoId: prod.id, descricao: prod.name, quantidade: 1, precoUnitario: price, codigoEmpresa: userProfile?.codigo_empresa });
      }
      
      // Recarregar itens do backend para sincronizar
      const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ 
        id: it.id, 
        productId: it.produto_id, 
        name: it.descricao || 'Item', 
        price: Number(it.preco_unitario || 0), 
        quantity: Number(it.quantidade || 1) 
      }));
      const syncedTotal = (order || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0);
      
      const updatedTable = { ...selectedTable, order, totalHint: syncedTotal };
      setSelectedTable(updatedTable);
      setTables((prevTables) => prevTables.map(t => (t.id === updatedTable.id ? updatedTable : t)));
      
      // Atualizar estoque reservado global após adicionar item
      try {
        const itensGlobal = await listarItensDeTodasComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
        const reservedMap = new Map();
        for (const item of itensGlobal || []) {
          const pid = item.produto_id;
          const qty = Number(item.quantidade || 0);
          reservedMap.set(pid, (reservedMap.get(pid) || 0) + qty);
        }
        setReservedStock(reservedMap);
      } catch (err) {
        console.error('[addProductToComanda] Erro ao atualizar estoque reservado:', err);
      }
      
      toast({ title: 'Produto adicionado', variant: 'success' });
    } catch (e) {
      console.error('[addProductToComanda] EXCEPTION:', e);
      toast({ title: 'Falha ao adicionar produto', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  // Modal de Produtos - Isolado e com foco próprio
  const ProductsModal = () => {
    const [productSearch, setProductSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'low', 'out'
    const modalSearchRef = useRef(null);
    const lastFocusedIndexRef = useRef(0);
    const listRef = useRef(null);
    // Usar productItemRefs do componente pai (já declarado acima)
    // Ordenar e filtrar devem vir antes dos effects que dependem de 'filtered'
    const sortedProducts = (products || []).slice().sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      if (/^\d+$/.test(codeA) && /^\d+$/.test(codeB)) {
        return parseInt(codeA, 10) - parseInt(codeB, 10);
      }
      return codeA.localeCompare(codeB);
    });
    const filtered = sortedProducts.filter(p => {
      const q = productSearch.trim().toLowerCase();
      const matchesSearch = !q || (p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q);
      
      // Filtro por status
      if (statusFilter === 'all') return matchesSearch;
      
      const stock = Number(p.stock ?? p.currentStock ?? 0);
      const reserved = reservedStock.get(p.id) || 0;
      const remaining = Math.max(0, stock - reserved);
      
      if (statusFilter === 'available') return matchesSearch && remaining > 0;
      if (statusFilter === 'low') return matchesSearch && remaining > 0 && remaining <= 5;
      if (statusFilter === 'out') return matchesSearch && remaining <= 0;
      
      return matchesSearch;
    });
    
    // Garantir que item focado fique visível ao navegar por setas E manter foco real no DOM
    useEffect(() => {
      try {
        const idx = productFocusIndex !== null && productFocusIndex !== undefined ? productFocusIndex : 0;
        const el = productItemRefs.current?.[idx];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' });
        }
      } catch {}
    }, [productFocusIndex]);

    // NÃO usar useEffect para restaurar foco - focar diretamente após ação

    // NÃO resetar foco ao abrir modal - deixar o usuário controlar completamente

    // Não resetar foco ao alterar busca - deixar o usuário navegar livremente

    // Após alterações na lista/quantidades, restaurar foco no card selecionado, se existir
    // DESABILITADO: Este useEffect estava causando o produto voltar para o primeiro
    // useEffect(() => {
    //   const idx = Math.min(Math.max(0, lastFocusedIndexRef.current || 0), (filtered.length || 1) - 1);
    //   const activeEl = document.activeElement;
    //   const isInputFocused = activeEl === modalSearchRef.current;
    //   const isCardFocused = activeEl && activeEl.hasAttribute('data-product-card');
    //   // Só restaurar foco no card se o input NÃO estiver focado E se já não estiver em um card
    //   if (filtered.length > 0 && !isInputFocused && !isCardFocused) {
    //     requestAnimationFrame(() => {
    //       try { productItemRefs.current[idx]?.focus(); } catch {}
    //     });
    //   }
    // }, [selectedTable?.order, filtered.length]);

    if (!selectedTable) return null;

    return (
      <Dialog open={isProductsModalOpen} onOpenChange={(open) => {
        setIsProductsModalOpen(open);
        // Manter o contexto em 'panel' enquanto o modal estiver aberto
        setFocusContext(open ? 'panel' : 'tables');
      }}>
        <DialogContent 
          className="w-[95vw] sm:max-w-4xl max-h-[80vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 focus:outline-none focus-visible:outline-none"
          onOpenAutoFocus={(e) => {
            // Evitar que o foco vá para o botão de fechar do Dialog
            e.preventDefault();
            // NÃO focar automaticamente - deixar o usuário controlar
          }}
          onWheel={(e) => {
            // Durante rolagem, garantir que setas não virem scroll do body
            e.stopPropagation();
          }}
          onKeyDownCapture={(e) => {
            // BLOQUEAR APENAS O SCROLL - não bloquear a lógica de navegação
            if (['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Space'].includes(e.key)) {
              e.preventDefault();
            }
          }}
          onKeyDown={(e) => {
            // Processar navegação normalmente
            const target = e.target;
            const isInInput = target && (target.tagName === 'INPUT' || target.closest('input'));
            const isInCard = target && target.closest('[data-product-card]');
            if (!['ArrowDown','ArrowUp','Home','End','Enter','Delete','Escape'].includes(e.key)) return;
            // Se o foco está no input ou em um card, deixa o handler específico cuidar
            if (isInInput || isInCard) return;

            e.preventDefault();
            e.stopPropagation();

            const idx = productFocusIndex || 0;
            const n = filtered.length;
            if (e.key === 'ArrowDown') { const next = Math.min(idx + 1, n - 1); setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
            if (e.key === 'ArrowUp')   { const next = Math.max(idx - 1, 0);   setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
            if (e.key === 'Home')      { setProductFocusIndex(0); lastFocusedIndexRef.current = 0; requestAnimationFrame(() => productItemRefs.current[0]?.focus()); return; }
            if (e.key === 'End')       { const next = Math.max(0, n - 1); setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
            if (e.key === 'Escape')    { setIsProductsModalOpen(false); return; }
          }}
        >
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-brand" />
              Adicionar Produtos
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Mesa {selectedTable.number} • {formatClientDisplay(selectedTable.customer) || 'Sem cliente'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0">
            {/* Campo de busca */}
            <div className="px-6 py-4 border-b border-border bg-surface/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                <input
                  ref={modalSearchRef}
                  type="text"
                  className="w-full pl-10 pr-4 py-3 text-base rounded-lg bg-background border-2 border-border focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all outline-none"
                  placeholder="Digite o nome ou código do produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onClick={(e) => {
                    // Ao clicar no input, garantir que ele receba foco
                    e.currentTarget.focus();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    // Reforçar isolamento de handlers globais
                    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                    // Garantir contexto de foco apropriado
                    setFocusContext('panel');
                    
                    if (['ArrowDown','ArrowUp','Home','End','Escape'].includes(e.key)) {
                      e.preventDefault();
                      
                      const idx = productFocusIndex || 0;
                      const n = filtered.length;
                      
                      if (e.key === 'ArrowDown') {
                        setProductFocusIndex(Math.min(idx + 1, n - 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        setProductFocusIndex(Math.max(idx - 1, 0));
                        return;
                      }
                      if (e.key === 'Home') {
                        setProductFocusIndex(0);
                        return;
                      }
                      if (e.key === 'End') {
                        setProductFocusIndex(n - 1);
                        return;
                      }
                      if (e.key === 'Escape') {
                        setIsProductsModalOpen(false);
                        return;
                      }
                    }
                  }}
                />
              </div>
              
              {/* Filtros de Status + Atalhos */}
              <div className="flex items-center justify-between gap-4 mt-3">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === 'all' 
                      ? 'bg-brand text-black' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('available')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === 'available' 
                      ? 'bg-success text-white' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Disponível
                </button>
                <button
                  onClick={() => setStatusFilter('low')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === 'low' 
                      ? 'bg-warning text-black' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Estoque Baixo
                </button>
                <button
                  onClick={() => setStatusFilter('out')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === 'out' 
                      ? 'bg-destructive text-white' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Sem Estoque
                </button>
                
                {/* Dicas de teclado: apenas desktop */}
                <div className="hidden sm:flex items-center gap-2 ml-auto text-xs text-text-muted flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-xs font-mono">↑↓</kbd>
                    <span>Navegar</span>
                  </div>
                  <div className="w-px h-3 bg-border"></div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-xs font-mono">Esc</kbd>
                    <span>Fechar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de produtos */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-6 py-4 focus:outline-none"
              tabIndex={-1}
              onKeyDown={(e) => {
                // Impedir scroll IMEDIATAMENTE
                if (['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Space'].includes(e.key)) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                }
                e.stopPropagation();

                // Se o alvo é um input, deixa o input tratar
                const target = e.target;
                const isInInput = target && (target.tagName === 'INPUT' || target.closest('input'));
                if (!['ArrowDown','ArrowUp','Home','End','Escape'].includes(e.key)) return;
                if (isInInput) return;

                const idx = productFocusIndex || 0;
                const n = filtered.length;
                if (e.key === 'ArrowDown') { const next = Math.min(idx + 1, n - 1); setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
                if (e.key === 'ArrowUp')   { const next = Math.max(idx - 1, 0);   setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
                if (e.key === 'Home')      { setProductFocusIndex(0); lastFocusedIndexRef.current = 0; requestAnimationFrame(() => productItemRefs.current[0]?.focus()); return; }
                if (e.key === 'End')       { const next = Math.max(0, n - 1); setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
                if (e.key === 'Escape')    { setIsProductsModalOpen(false); return; }
              }}
            >
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-text-muted mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Nenhum produto encontrado</h3>
                  <p className="text-text-muted mb-4">Tente ajustar sua busca ou cadastre novos produtos</p>
                  <Button onClick={() => { setIsProductsModalOpen(false); navigate('/produtos'); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Produtos
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filtered.map((prod, idx) => {
                    const q = qtyByProductId.get(prod.id) || 0;
                    const stock = Number(prod.stock ?? prod.currentStock ?? 0);
                    const reserved = reservedStock.get(prod.id) || 0;
                    const remaining = Math.max(0, stock - reserved);
                    const isFocused = idx === productFocusIndex;
                    
                    return (
                      <div
                        key={prod.id}
                        ref={(el) => { 
                          console.log('[Card ref] Atribuindo ref para idx:', idx, 'prod:', prod.name, 'el:', !!el);
                          productItemRefs.current[idx] = el;
                          console.log('[Card ref] productItemRefs.current:', productItemRefs.current.length, 'elementos');
                        }}
                        data-product-card
                        className={cn(
                          "flex items-center gap-2 sm:gap-4 p-2.5 sm:p-3 rounded-lg border-2 transition-all outline-none focus:outline-none focus-visible:outline-none",
                          remaining === 0 && q === 0
                            ? "opacity-50 cursor-not-allowed bg-surface-2 border-border" 
                            : "cursor-pointer",
                          isFocused
                            ? "border-brand bg-brand/5 shadow-md" 
                            : remaining > 0
                            ? "border-border bg-surface hover:border-brand/50 hover:bg-surface-2"
                            : q > 0
                            ? "border-border bg-surface"
                            : "border-border"
                        )}
                        tabIndex={remaining > 0 || q > 0 ? 0 : -1}
                        onKeyDown={(e) => {
                          // Prevenir scroll IMEDIATAMENTE e ANTES de qualquer outra coisa
                          if (['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Space'].includes(e.key)) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                              e.nativeEvent.stopImmediatePropagation();
                            }
                          }
                          if (!['ArrowDown','ArrowUp','Home','End','Escape'].includes(e.key)) return;
                          e.stopPropagation();
                          const n = filtered.length;
                          if (e.key === 'ArrowDown') { const next = Math.min(idx + 1, n - 1); setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
                          if (e.key === 'ArrowUp')   { const next = Math.max(idx - 1, 0);   setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
                          if (e.key === 'Home')      { setProductFocusIndex(0); lastFocusedIndexRef.current = 0; requestAnimationFrame(() => productItemRefs.current[0]?.focus()); return; }
                          if (e.key === 'End')       { const next = Math.max(0, n - 1); setProductFocusIndex(next); lastFocusedIndexRef.current = next; requestAnimationFrame(() => productItemRefs.current[next]?.focus()); return; }
                          if (e.key === 'Escape')    { setIsProductsModalOpen(false); return; }
                        }}
                        onClick={() => {
                          if (remaining === 0 && q === 0) return;
                          // Seleciona visualmente o item e mantém foco no próprio card
                          setProductFocusIndex(idx);
                          lastFocusedIndexRef.current = idx;
                          requestAnimationFrame(() => productItemRefs.current[idx]?.focus());
                        }}
                        onMouseDown={(e) => {
                          if (remaining === 0 && q === 0) {
                            e.preventDefault();
                            return;
                          }
                          // Permitir que o card receba foco real
                          e.currentTarget.focus();
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {prod.code && (
                              <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-surface-2 border border-border rounded">
                                {prod.code}
                              </span>
                            )}
                            <h4 className="font-semibold text-sm sm:text-base text-text-primary truncate">
                              {prod.name}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs mt-0.5">
                            <span className={cn("font-bold", remaining === 0 ? "text-text-muted" : "text-brand")}>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(prod.salePrice ?? prod.price ?? 0))}
                            </span>
                            <span className="text-text-muted whitespace-nowrap">
                              Estoque: <span className={cn("font-semibold", remaining <= 5 ? "text-destructive" : "text-text-secondary")}>{remaining}</span>
                            </span>
                            {q > 0 && (
                              <span className="px-2 py-0.5 bg-brand/10 text-brand text-[11px] font-semibold rounded whitespace-nowrap">
                                {q}x na comanda
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              decProduct(prod);
                            }}
                            disabled={q === 0}
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              addProductToComanda(prod);
                            }}
                            disabled={remaining === 0}
                            className="h-8 w-8 p-0 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer com resumo */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-surface/50">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="hidden sm:block text-sm text-text-muted">
                  {filtered.length} produto{filtered.length !== 1 ? 's' : ''} • {(selectedTable.order || []).length} ite{(selectedTable.order || []).length !== 1 ? 'ns' : 'm'} na comanda
                </div>
                <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <div className="text-xs text-text-muted">Total</div>
                    <div className="text-lg sm:text-xl font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedTable.totalHint || 0)}
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsProductsModalOpen(false)}
                    className="px-4 sm:px-6 min-w-[96px] sm:min-w-[120px]"
                    size="sm"
                  >
                    Concluir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const ProductsPanel = () => {
    const [productSearch, setProductSearch] = useState('');
    const productsPanelRef = useRef(null);
    
    // Ordenar produtos por código (somente produtos reais do catálogo)
    const sortedProducts = (products || []).slice().sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      if (/^\d+$/.test(codeA) && /^\d+$/.test(codeB)) {
        return parseInt(codeA, 10) - parseInt(codeB, 10);
      }
      return codeA.localeCompare(codeB);
    });
    const filtered = sortedProducts.filter(p => {
      const q = productSearch.trim().toLowerCase();
      if (!q) return true;
      return (p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q);
    });

    return (
    <div className="flex flex-col h-full" data-products-panel="1" ref={productsPanelRef}>
       <div className="p-4 border-b border-border">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
             <input
               className="pl-8 pr-2 py-2 w-full rounded-md bg-surface text-text-primary border border-border focus-visible:ring-0 focus-visible:border-brand"
               placeholder="Buscar produto por nome ou código"
               value={productSearch}
               onChange={(e) => setProductSearch(e.target.value)}
               ref={productsSearchRef}
               onClick={(e) => {
                 e.stopPropagation();
                 // Garantir que o input mantenha o foco
                 e.currentTarget.focus();
               }}
               onFocus={(e) => {
                 e.stopPropagation();
                 setFocusContext('panel');
               }}
               onKeyDown={(e) => {
                 // BLOQUEAR propagação de TODAS as teclas para evitar atalhos globais
                 e.stopPropagation();
                 if (e.nativeEvent) {
                   e.nativeEvent.stopPropagation();
                   e.nativeEvent.stopImmediatePropagation();
                 }
                 
                 // Capturar teclas de navegação no input de busca
                 if (['ArrowDown','ArrowUp','Home','End','Enter','Delete','Escape'].includes(e.key)) {
                   e.preventDefault();
                   
                   const idx = productFocusIndex || 0;
                   const n = filtered.length;
                   
                   // Navegação vertical - mantém foco no input
                   if (e.key === 'ArrowDown') {
                     const next = Math.min(idx + 1, n - 1);
                     setProductFocusIndex(next);
                     return;
                   }
                   if (e.key === 'ArrowUp') {
                     const next = Math.max(idx - 1, 0);
                     setProductFocusIndex(next);
                     return;
                   }
                   if (e.key === 'Home') { 
                     setProductFocusIndex(0); 
                     return; 
                   }
                   if (e.key === 'End') { 
                     setProductFocusIndex(n - 1); 
                     return; 
                   }
                   
                   // Enter: adicionar produto focado
                   if (e.key === 'Enter') {
                     const prod = filtered[idx];
                     if (prod) {
                       addProductToComanda(prod);
                       // Manter foco no input após operação async
                       setTimeout(() => {
                         if (productsSearchRef.current) {
                           productsSearchRef.current.focus();
                         }
                       }, 100);
                     }
                     return;
                   }
                   // Delete: remover produto focado
                   if (e.key === 'Delete') {
                     const prod = filtered[idx];
                     if (prod) {
                       decProduct(prod);
                       // Manter foco no input após operação async
                       setTimeout(() => {
                         if (productsSearchRef.current) {
                           productsSearchRef.current.focus();
                         }
                       }, 100);
                     }
                     return;
                   }
                   // Escape: volta para aba Comanda
                   if (e.key === 'Escape') {
                     setDesktopTab('order');
                     setMobileTableTab('order');
                     return;
                   }
                 }
               }}
             />
          </div>
       </div>
       <div 
         className="flex-1 overflow-y-auto p-4 thin-scroll"
         role="listbox"
         tabIndex={0}
         ref={(el) => {
           productsListRef.current = el;
           if (el && !el._hasClickHandler) {
             el._hasClickHandler = true;
             // Capturar TODOS os cliques dentro da área de produtos
             el.addEventListener('click', (e) => {
               console.log('[PRODUCTS CONTAINER] Click captured:', e.target);
               // NÃO bloquear cliques em botões
               if (e.target.closest('button')) {
                 console.log('[PRODUCTS CONTAINER] Click is on button, allowing it through');
                 return;
               }
               // NÃO bloquear cliques no input de busca
               if (e.target.closest('input')) {
                 console.log('[PRODUCTS CONTAINER] Click is on input, allowing it through');
                 return;
               }
               e.stopPropagation();
               setFocusContext('panel');
               // Auto-selecionar primeiro produto se nenhum estiver selecionado
               if (productFocusIndex === null || productFocusIndex === undefined) {
                 setProductFocusIndex(0);
               }
               // NÃO focar em nada - deixar foco no input naturalmente
             }, true);
           }
         }}
         onFocus={(e) => {
          e.stopPropagation();
          setFocusContext('panel');
          if (productFocusIndex === null || productFocusIndex === undefined) {
            setProductFocusIndex(0);
          }
        }}
     onBlur={(e) => {
      // Se o foco permanece dentro do painel (inclui o input), não reforce foco na lista
      const relatedTarget = e.relatedTarget;
      const staysInPanel = !!(relatedTarget && relatedTarget.closest('[data-products-panel="1"]'));
      if (staysInPanel) {
        return;
      }
      // Caso o foco saia do painel, não forçar refocus aqui
     }}
     onKeyDown={(e) => {
       // Processar teclas quando lista tem foco (navegação via clique)
       if (['ArrowDown','ArrowUp','Enter','Delete','Escape'].includes(e.key)) {
         e.preventDefault();
         e.stopPropagation();
         
         const idx = productFocusIndex || 0;
         const n = filtered.length;
         
         if (e.key === 'ArrowDown') {
           const next = Math.min(idx + 1, n - 1);
           setProductFocusIndex(next);
           return;
         }
         if (e.key === 'ArrowUp') {
           const next = Math.max(idx - 1, 0);
           setProductFocusIndex(next);
           return;
         }
         if (e.key === 'Enter') {
           const prod = filtered[idx];
           if (prod) {
             addProductToComanda(prod);
             setTimeout(() => productsSearchRef.current?.focus(), 100);
           }
           return;
         }
         if (e.key === 'Delete') {
           const prod = filtered[idx];
           if (prod) {
             decProduct(prod);
             setTimeout(() => productsSearchRef.current?.focus(), 100);
           }
           return;
         }
         if (e.key === 'Escape') {
           productsSearchRef.current?.focus();
           return;
         }
       }
     }}
   >
          <ul className="space-y-2">
              {filtered.length === 0 ? (
                <li className="text-center text-text-muted py-8">
                  <div className="mb-3">Nenhum produto encontrado.</div>
                  <Button size="sm" onClick={() => navigate('/produtos')}>Cadastrar Produtos</Button>
                </li>
              ) : filtered.map((prod, idx) => {
                  const q = qtyByProductId.get(prod.id) || 0;
                  const stock = Number(prod.stock ?? prod.currentStock ?? 0);
                  const reserved = reservedStock.get(prod.id) || 0;
                  const remaining = Math.max(0, stock - reserved);
                  const handleOpenDetails = () => { setSelectedProduct(prod); setIsProductDetailsOpen(true); setMobileTableTab('products'); };
                  return (
                    <li
                      key={prod.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-md border border-border bg-surface hover:bg-surface-2 transition-colors cursor-pointer",
                        focusContext === 'panel' && idx === (productFocusIndex || 0) && "ring-2 ring-brand/60 bg-surface-2"
                      )}
                      ref={(el) => { productItemRefs.current[idx] = el; }}
                      role="option"
                      aria-selected={focusContext === 'panel' && idx === (productFocusIndex || 0)}
                      tabIndex={-1}
                    >
                      <div className="flex-1 min-w-0" onClick={handleOpenDetails}>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate" title={`${prod.code ? `[${prod.code}] ` : ''}${prod.name}`}>
                            {prod.code && <span className="text-text-muted">[{prod.code}]</span>} {prod.name}
                          </p>
                          {q > 0 && (
                            <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30 flex-shrink-0">x{q}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-xs sm:text-sm text-text-muted">R$ {(Number(prod.salePrice ?? prod.price ?? 0)).toFixed(2)}</p>
                          <span className="inline-flex items-center justify-center text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full bg-surface-2 text-text-secondary border border-border flex-shrink-0">Qtd {remaining}</span>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60"
                        onClick={(e) => { 
                          console.log('[BUTTON +] Clicked on product:', prod.name);
                          e.preventDefault(); 
                          e.stopPropagation(); 
                          console.log('[BUTTON +] Calling addProductToComanda...');
                          addProductToComanda(prod);
                          console.log('[BUTTON +] addProductToComanda called');
                        }}
                        onTouchEnd={(e) => { 
                          console.log('[BUTTON + TOUCH] Touched on product:', prod.name);
                          e.preventDefault(); 
                          e.stopPropagation(); 
                          addProductToComanda(prod);
                        }}
                        aria-label={`Adicionar ${prod.name}`}
                      >
                        <Plus size={16} />
                      </Button>
                    </li>
                  );
                })}
          </ul>
       </div>
    </div>
    );
  };

  // Estado e lógica do Modo Balcão (comanda sem mesa)
  const [counterComandaId, setCounterComandaId] = useState(null);
  const [counterItems, setCounterItems] = useState([]);
  const [counterLoading, setCounterLoading] = useState(false);
  const [counterSearch, setCounterSearch] = useState('');
  const [showCounterClientPicker, setShowCounterClientPicker] = useState(false);
  const [counterClients, setCounterClients] = useState([]);
  const [counterClientsLoading, setCounterClientsLoading] = useState(false);
  const [counterSelectedClientId, setCounterSelectedClientId] = useState(null);
  const [isCounterProductDetailsOpen, setIsCounterProductDetailsOpen] = useState(false);
  const [selectedCounterProduct, setSelectedCounterProduct] = useState(null);

  const counterQtyByProductId = useMemo(() => {
    const map = new Map();
    for (const it of counterItems || []) {
      const pid = it.productId;
      const q = Number(it.quantity || 0);
      map.set(pid, (map.get(pid) || 0) + q);
    }
    return map;
  }, [counterItems]);

  const counterReloadItems = async (comandaId) => {
    if (!comandaId) return;
    const itens = await listarItensDaComanda({ comandaId, codigoEmpresa: userProfile?.codigo_empresa });
    const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
    setCounterItems(order);
  };

  const addProductToCounter = async (prod) => {
    try {
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) {
        toast({ title: 'Empresa não definida', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      // Garante que existe uma comanda de balcão apenas quando for realmente adicionar o primeiro produto
      let cid = counterComandaId;
      if (!cid) {
        // Exigir caixa aberto antes de criar a comanda (garantido por getOrCreateComandaBalcao)
        const cmd = await getOrCreateComandaBalcao({ codigoEmpresa });
        cid = cmd?.id;
        if (!cid) {
          toast({ title: 'Falha ao iniciar venda no balcão', description: 'Não foi possível criar ou recuperar a comanda.', variant: 'destructive' });
          return;
        }
        setCounterComandaId(cid);
      }

      const price = Number(prod.salePrice ?? prod.price ?? 0);
      await adicionarItem({ comandaId: cid, produtoId: prod.id, descricao: prod.name, quantidade: 1, precoUnitario: price, codigoEmpresa });
      await counterReloadItems(cid);
      toast({ title: 'Produto adicionado (balcão)', description: prod.name, variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao adicionar produto (balcão)', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const addClientToCounter = async (clientId) => {
    if (!counterComandaId || !clientId) return;
    // fecha imediatamente (UX) e tenta associar; se falhar, reabre com alerta
    setShowCounterClientPicker(false);
    try {
      await adicionarClientesAComanda({ comandaId: counterComandaId, clienteIds: [clientId], nomesLivres: [], codigoEmpresa: userProfile?.codigo_empresa });
      setCounterSelectedClientId(clientId);
      setCounterSearch('');
      setCounterClients([]);
      toast({ title: 'Cliente associado', variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao associar cliente', description: e?.message || 'Tente novamente', variant: 'destructive' });
      setShowCounterClientPicker(true);
    }
  };

  const payCounter = async () => {
    if (!counterComandaId) return;
    try {
      const total = calculateTotal(counterItems, null);
      if (total <= 0) {
        toast({ title: 'Sem itens', description: 'Adicione itens antes de pagar.', variant: 'warning' });
        return;
      }
      setCounterLoading(true);
      // Garante caixa aberto
      await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
      // Busca finalizadoras se necessário
      let fins = payMethods;
      if (!Array.isArray(fins) || fins.length === 0) {
        try { fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa: userProfile?.codigo_empresa }); setPayMethods(fins); } catch {}
      }
      const fin = fins?.[0];
      const metodo = fin?.tipo || fin?.nome || 'outros';
      await registrarPagamento({ comandaId: counterComandaId, finalizadoraId: fin?.id, metodo, valor: total, codigoEmpresa: userProfile?.codigo_empresa });
      await fecharComandaEMesa({ comandaId: counterComandaId, codigoEmpresa: userProfile?.codigo_empresa });
      toast({ title: 'Pagamento registrado (balcão)', description: `R$ ${total.toFixed(2)}`, variant: 'success' });
      // reset ciclo
      setCounterItems([]);
      setCounterComandaId(null);
      setIsCounterModeOpen(false);
    } catch (e) {
      toast({ title: 'Falha no pagamento (balcão)', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setCounterLoading(false);
    }
  };

  const CounterModeModal = () => {
    useEffect(() => {
      let active = true;
      const boot = async () => {
        if (!isCounterModeOpen) return;
        try {
          setCounterLoading(true);
          const codigoEmpresa = userProfile?.codigo_empresa;
          if (!codigoEmpresa) {
            if (active) toast({ title: 'Empresa não definida', description: 'Faça login novamente.', variant: 'destructive' });
            return;
          }

          // No boot do balcão, apenas tenta encontrar uma comanda existente aberta, sem criar nova
          const cmd = await listarComandaBalcaoAberta({ codigoEmpresa });
          if (!active) return;

          if (cmd?.id) {
            setCounterComandaId(cmd.id);
            await counterReloadItems(cmd.id);
            // Carregar clientes associados para sincronizar com a visão do Balcão principal
            try {
              const vincs = await listarClientesDaComanda({ comandaId: cmd.id, codigoEmpresa });
              const first = Array.isArray(vincs) && vincs.length > 0 ? vincs[0] : null;
              if (first?.cliente_id) {
                setCounterSelectedClientId(first.cliente_id);
              }
            } catch {
              // silencioso
            }
          } else {
            // Nenhuma comanda aberta: inicia em estado "venda vazia" sem comandaId; será criada ao adicionar o primeiro item
            setCounterComandaId(null);
            setCounterItems([]);
          }
        } catch (e) {
          if (active) toast({ title: 'Falha ao abrir Modo Balcão', description: e?.message || 'Tente novamente', variant: 'destructive' });
        } finally {
          if (active) setCounterLoading(false);
        }
      };
      boot();
      return () => { active = false; };
    }, [isCounterModeOpen]);

    useEffect(() => {
      if (!showCounterClientPicker) return;
      let active = true;
      const load = async () => {
        try {
          setCounterClientsLoading(true);
          const rows = await listarClientes({ searchTerm: counterSearch, limit: 20, codigoEmpresa: userProfile?.codigo_empresa });
          if (active) setCounterClients(rows || []);
        } catch {
          if (active) setCounterClients([]);
        } finally {
          if (active) setCounterClientsLoading(false);
        }
      };
      const t = setTimeout(load, 250);
      return () => { active = false; clearTimeout(t); };
    }, [showCounterClientPicker, counterSearch]);

    const total = calculateTotal(counterItems, null);
    return (
      <Dialog open={isCounterModeOpen} onOpenChange={setIsCounterModeOpen}>
        <DialogContent
          className="max-w-4xl h-[90vh]"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Modo Balcão</DialogTitle>
            <DialogDescription>Venda rápida para clientes sem mesa.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 h-full overflow-hidden pt-4">
            <div className="col-span-1 flex flex-col border-r border-border pr-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Catálogo de Produtos</h3>
                <Button variant="outline" size="sm" onClick={() => setShowCounterClientPicker(true)}>
                  {counterSelectedClientId ? <><CheckCircle className="mr-1 h-4 w-4 text-success"/> Cliente</> : 'Cliente'}
                </Button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input placeholder="Buscar produto..." className="pl-9" value={counterSearch} onChange={(e) => setCounterSearch(e.target.value)} ref={counterSearchRef} />
              </div>
              <div className="flex-1 overflow-y-auto -mr-4 pr-4 thin-scroll">
                <ul className="space-y-2">
                  {(products || []).filter(p => {
                    const s = counterSearch.trim().toLowerCase();
                    if (!s) return true;
                    return (p.name || '').toLowerCase().includes(s) || (p.code || '').toLowerCase().includes(s);
                  }).sort((a, b) => {
                    const codeA = a.code || '';
                    const codeB = b.code || '';
                    if (/^\d+$/.test(codeA) && /^\d+$/.test(codeB)) {
                      return parseInt(codeA, 10) - parseInt(codeB, 10);
                    }
                    return codeA.localeCompare(codeB);
                  }).map((prod) => {
            const qty = (counterItems || []).reduce((acc, it) => acc + (it.productId === prod.id ? Number(it.quantity || 0) : 0), 0);
            const stock = Number(prod.stock ?? prod.currentStock ?? 0);
            const reserved = reservedStock.get(prod.id) || 0;
            const remaining = Math.max(0, stock - reserved);
            return (
              <li key={prod.id} className="flex items-center p-2 rounded-md hover:bg-surface-2 transition-colors" onClick={() => { setSelectedCounterProduct(prod); setIsCounterProductDetailsOpen(true); }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate" title={`${prod.code ? `[${prod.code}] ` : ''}${prod.name}`}>
                      {prod.code && <span className="text-text-muted">[{prod.code}]</span>} {prod.name}
                    </p>
                    {qty > 0 && (
                      <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30 flex-shrink-0">x{qty}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-text-muted">R$ {(Number(prod.salePrice ?? prod.price ?? 0)).toFixed(2)}</p>
                    <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded-full bg-surface-2 text-text-secondary border border-border flex-shrink-0">Qtd {remaining}</span>
                  </div>
                </div>
                <Button size="icon" className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60" onClick={(e) => { e.stopPropagation(); addProductToCounter(prod); }} aria-label={`Adicionar ${prod.name}`}>
                  <Plus size={16} />
                </Button>
              </li>
            );
          })}
                  {(!products || products.length === 0) && (
                    <li className="text-center text-text-muted py-8">
                      <div className="mb-3">Nenhum produto cadastrado. Cadastre produtos para vender no balcão.</div>
                      <Button size="sm" onClick={() => navigate('/produtos')}>Cadastrar Produtos</Button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <div className="col-span-1 flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Comanda do Balcão</h3>
              <div className="flex-1 overflow-y-auto bg-surface-2 rounded-lg p-4 thin-scroll">
                {counterItems.length === 0 ? (
                  <p className="text-center text-text-muted pt-16">Adicione produtos à comanda.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {counterItems.map((it) => (
                      <li key={it.id} className="py-2 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.name}</div>
                          <div className="text-xs text-text-muted">Qtd: {it.quantity} • Unit: R$ {Number(it.price || 0).toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold mr-2">R$ {(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}</div>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={async () => {
                            const next = Number(it.quantity||1) - 1;
                            if (next <= 0) {
                              setItemToRemove(it);
                              setIsRemoveConfirmOpen(true);
                              // Após o modal fechar, recarregar itens do balcão
                              setTimeout(async () => {
                                if (!isRemoveConfirmOpen) {
                                  await counterReloadItems(counterComandaId);
                                }
                              }, 100);
                            } else {
                              try {
                                await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa: userProfile?.codigo_empresa });
                                await counterReloadItems(counterComandaId);
                              } catch (e) { toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' }); }
                            }
                          }}><Minus size={14} /></Button>
                          <span className="w-8 text-center font-semibold">{it.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={async () => {
                            try {
                              await atualizarQuantidadeItem({ itemId: it.id, quantidade: Number(it.quantity||1) + 1, codigoEmpresa: userProfile?.codigo_empresa });
                              await counterReloadItems(counterComandaId);
                            } catch (e) { toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' }); }
                          }}><Plus size={14} /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="p-4 border-t border-border mt-auto">
                <div className="flex justify-between items-center text-xl font-bold mb-4">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
                <div className="flex gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="lg"
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white border border-red-600/70"
                      >
                        Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-[420px] animate-none" onKeyDown={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar comanda do balcão?</AlertDialogTitle>
                        <AlertDialogDescription>Os itens serão descartados e o balcão será limpo. Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          try {
                            if (!counterComandaId) { setIsCounterModeOpen(false); return; }
                            await cancelarComandaEMesa({ comandaId: counterComandaId, codigoEmpresa: userProfile?.codigo_empresa });
                            setCounterItems([]);
                            setCounterComandaId(null);
                            setIsCounterModeOpen(false);
                            toast({ title: 'Comanda cancelada (balcão)', variant: 'success' });
                          } catch (e) {
                            toast({ title: 'Falha ao cancelar', description: e?.message || 'Tente novamente', variant: 'destructive' });
                          }
                        }}>Confirmar Cancelamento</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button size="lg" className="flex-1" onClick={payCounter} disabled={counterLoading || total <= 0}>
                    <DollarSign className="mr-2" /> Finalizar Pagamento
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Seletor de cliente (inline dentro do modal) */}
          {showCounterClientPicker && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowCounterClientPicker(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setShowCounterClientPicker(false); }}>
              <div className="bg-surface rounded-lg border border-border shadow-lg w-full max-w-md p-4" role="dialog" aria-modal="true">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold">Selecionar Cliente</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowCounterClientPicker(false)}>Fechar</Button>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input placeholder="Nome, e-mail, telefone ou código" className="pl-9" value={counterSearch} onChange={(e) => setCounterSearch(e.target.value)} />
                </div>
                <div className="max-h-64 overflow-auto thin-scroll border rounded-md">
                  {counterClientsLoading ? (
                    <div className="p-3 text-sm text-text-muted">Carregando clientes...</div>
                  ) : (counterClients.length > 0 ? (
                    <ul>
                      {counterClients.map(c => (
                        <li key={c.id} className={cn('p-2 flex items-center justify-between cursor-pointer hover:bg-surface-2', counterSelectedClientId === c.id && 'bg-surface-2')} onClick={() => addClientToCounter(c.id)}>
                          <div>
                            <div className="font-medium">{(c.codigo != null ? String(c.codigo) + ' - ' : '')}{c.nome}</div>
                          </div>
                          {counterSelectedClientId === c.id && <CheckCircle size={16} className="text-success" />}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 text-sm text-text-muted">Nenhum cliente encontrado.</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  const CounterProductDetailsDialog = () => {
    const prod = selectedCounterProduct;
    const qInOrder = prod ? (counterQtyByProductId.get(prod.id) || 0) : 0;
    const price = prod ? Number(prod.salePrice ?? prod.price ?? 0) : 0;
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    return (
      <Dialog open={isCounterProductDetailsOpen} onOpenChange={(open) => { setIsCounterProductDetailsOpen(open); if (!open) setSelectedCounterProduct(null); }}>
        <DialogContent overlayClassName="z-[60]" className="sm:max-w-[420px] w-[92vw] max-h-[85vh] flex flex-col animate-none z-[61]" onKeyDown={(e) => e.stopPropagation()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()} onEscapeKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold break-words" title={prod?.name || ''}>{prod?.name || 'Produto'}</DialogTitle>
            <DialogDescription>Detalhes do produto (Balcão).</DialogDescription>
          </DialogHeader>
          {prod ? (
            <div className="space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Preço</span>
                <span className="text-sm font-semibold">{fmt(price)}</span>
              </div>
              {prod.category ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Categoria</span>
                  <span className="text-sm font-medium">{prod.category}</span>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2 text-center">
                {typeof prod.stock !== 'undefined' && (
                  <div className="bg-surface-2 rounded-md p-3 border border-border">
                    <div className="text-xs text-text-secondary">Estoque</div>
                    <div className="text-base font-semibold">{prod.stock}</div>
                  </div>
                )}
                {typeof prod.minStock !== 'undefined' && (
                  <div className="bg-surface-2 rounded-md p-3 border border-border">
                    <div className="text-xs text-text-secondary">Mínimo</div>
                    <div className="text-base font-semibold">{prod.minStock}</div>
                  </div>
                )}
                <div className="bg-surface-2 rounded-md p-3 border border-border">
                  <div className="text-xs text-text-secondary">Na Comanda</div>
                  <div className="text-base font-semibold">x{qInOrder}</div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="mr-auto inline-flex items-center gap-1" onClick={() => { if (prod) { navigate('/produtos', { state: { productId: prod.id, productName: prod.name } }); } }}>
              <FileText className="w-4 h-4" />
              <span>Info</span>
            </Button>
            <Button variant="outline" onClick={() => { setIsCounterProductDetailsOpen(false); setSelectedCounterProduct(null); }}>Fechar</Button>
            <Button onClick={async () => { if (prod) { await addProductToCounter(prod); setIsCounterProductDetailsOpen(false); setSelectedCounterProduct(null); } }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const OpenTableDialog = () => {
    const [search, setSearch] = useState('');
    const [loadingClients, setLoadingClients] = useState(false);
    const [clients, setClients] = useState([]);
    const [selectedClientIds, setSelectedClientIds] = useState([]); // multi-seleção de cadastrados
    const [consumidorCount, setConsumidorCount] = useState(0); // contador exclusivo do cliente consumidor
    const [showConsumidorControls, setShowConsumidorControls] = useState(false);
    const [otFocusIndex, setOtFocusIndex] = useState(0);
    const otItemRefs = useRef([]);
    const otListRef = useRef(null);
    const otBodyRef = useRef(null);
    const otDialogRef = useRef(null);
    const otSearchRef = useRef(null);
    // timestamp do último nav via teclado; mouse hover só atua se passar um intervalo
    const otKbNavTsRef = useRef(0);
    // (removido) duplo Enter; agora Enter confirma diretamente
    // timestamp da última digitação para diferenciar Enter de confirmação vs Enter de busca
    const otTypeTsRef = useRef(0);

    useEffect(() => {
      let active = true;
      const load = async () => {
        try {
          setLoadingClients(true);
          const rows = await listarClientes({ searchTerm: search, limit: 20 });
          if (!active) return;
          const arr = (rows || []).slice();
          // ranking: começa com termo > contém termo > outros; depois por codigo
          const term = String(search || '').trim().toLowerCase();
          const score = (c) => {
            const nome = String(c?.nome || '').toLowerCase();
            if (!term) return 2;
            if (nome.startsWith(term)) return 0;
            if (nome.includes(term)) return 1;
            return 2;
          };
          arr.sort((a, b) => {
            const sa = score(a);
            const sb = score(b);
            if (sa !== sb) return sa - sb;
            const ca = Number(a?.codigo || 0);
            const cb = Number(b?.codigo || 0);
            return ca - cb;
          });
          setClients(arr);
          // foco inicial no primeiro item ao carregar
          setOtFocusIndex(0);
        } catch {
          if (!active) return;
          setClients([]);
        } finally {
          if (active) setLoadingClients(false);
        }
      };
      load();
      return () => { active = false; };
    }, [search]);

    // resetar scroll para o topo apenas ao abrir (não na troca de seleção/clique)
    const openedOnceRef = useRef(false);
    useEffect(() => {
      try {
        if (isOpenTableDialog && !openedOnceRef.current) {
          openedOnceRef.current = true;
          if (otDialogRef.current) otDialogRef.current.scrollTop = 0;
          if (otListRef.current) otListRef.current.scrollTop = 0;
          if (otBodyRef.current) otBodyRef.current.scrollTop = 0;
        }
        if (!isOpenTableDialog) {
          openedOnceRef.current = false;
        }
      } catch {}
    }, [isOpenTableDialog]);

    // Quando o modal abrir e houver clientes, focar a lista e inicializar foco
    useEffect(() => {
      try {
        if (isOpenTableDialog && Array.isArray(clients) && clients.length > 0) {
          setOtFocusIndex(0);
          setTimeout(() => { 
            try { 
              otListRef.current?.focus(); 
              if (otBodyRef.current) otBodyRef.current.scrollTop = 0;
            } catch {} 
          }, 0);
        }
      } catch {}
    }, [isOpenTableDialog, clients.length]);

    const confirmOpen = async (overrideSelectedIds = null) => {
      try {
        if (!pendingTable) return;
        // 1) abre (ou obtém) a comanda para a mesa
        const comanda = await getOrCreateComandaForMesa({ mesaId: pendingTable.id, codigoEmpresa: userProfile?.codigo_empresa });
        // 2) associar clientes cadastrados selecionados + consumidores nome_livre
        const overrideIsArray = Array.isArray(overrideSelectedIds);
        const baseIds = overrideIsArray ? overrideSelectedIds : selectedClientIds;
        const clienteIds = Array.isArray(baseIds) ? Array.from(new Set(baseIds)) : [];
        
        // Criar array de nomes livres de forma simples
        let nomesLivres = [];
        let count = Math.max(0, Number(consumidorCount || 0));
        
        // Se não há clientes selecionados E não há consumidores, adicionar 1 consumidor comum automaticamente
        if (clienteIds.length === 0 && count === 0) {
          count = 1;
        }
        
        for (let i = 0; i < count; i++) {
          nomesLivres.push('Consumidor');
        }
        
        console.log('[confirmOpen] Chamando adicionarClientesAComanda com:', { comandaId: comanda.id, clienteIds, nomesLivres });
        
        // SEMPRE limpar clientes antigos da comanda, mesmo se não adicionar novos
        await adicionarClientesAComanda({ 
          comandaId: comanda.id, 
          clienteIds: clienteIds, 
          nomesLivres: nomesLivres, 
          codigoEmpresa: userProfile?.codigo_empresa,
          replace: true
        });
        
        // Pega nomes confirmados do backend APÓS limpar e adicionar novos
        let displayName = null;
        try {
          const vinculos = await listarClientesDaComanda({ comandaId: comanda.id, codigoEmpresa: userProfile?.codigo_empresa });
          const vinculosArray = Array.isArray(vinculos) ? vinculos : [];
          const nomes = vinculosArray.map(v => v?.nome).filter(Boolean);
          displayName = nomes.length ? nomes.join(', ') : null;
        } catch (err) {
          console.warn('[confirmOpen] Erro ao buscar vínculos:', err);
        }
        if (!displayName) {
          const clientIdsArray = Array.isArray(clienteIds) ? clienteIds : [];
          const clientsArray = Array.isArray(clients) ? clients : [];
          displayName = clientIdsArray.length
            ? clientIdsArray.map(cid => clientsArray.find(c => c.id === cid)?.nome).filter(Boolean).join(', ')
            : (nomesLivres.length > 0 ? nomesLivres.join(', ') : '');
        }
        console.log('[confirmOpen] displayName calculado:', { displayName, nomesLivres, clienteIds });
        const enriched = { ...pendingTable, comandaId: comanda.id, status: 'in-use', customer: displayName || null, order: [] };
        setSelectedTable(enriched);
        setTables(prev => prev.map(t => t.id === enriched.id ? enriched : t));
        
        // AGUARDAR um pouco antes de recarregar para garantir que a comanda foi persistida
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // FORÇAR atualização do estado da mesa no carregamento principal
        try {
          const mesas = await listMesas(userProfile?.codigo_empresa);
          const openComandas = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
          
          const namesByComanda = {};
          const totalsByComanda = {};
          
          // Buscar clientes e totais das comandas
          const comandasArray = Array.isArray(openComandas) ? openComandas : [];
          await Promise.all(comandasArray.map(async (c) => {
            try {
              const vincs = await listarClientesDaComanda({ comandaId: c.id, codigoEmpresa: userProfile?.codigo_empresa });
              const nomesArray = Array.isArray(vincs) ? vincs : [];
              const nomes = nomesArray.map(v => v?.nome).filter(Boolean);
              namesByComanda[c.id] = nomes.length ? nomes.join(', ') : null;
              console.log('[confirmOpen] Clientes da comanda', c.id, ':', { vincs, nomes, resultado: namesByComanda[c.id] });
              
              // Calcular total da comanda
              const itens = await listarItensDaComanda({ comandaId: c.id, codigoEmpresa: userProfile?.codigo_empresa });
              const itensArray = Array.isArray(itens) ? itens : [];
              const total = itensArray.reduce((acc, item) => {
                const itemTotal = (item.quantidade || 0) * (item.preco_unitario || 0) - (item.desconto || 0);
                return acc + itemTotal;
              }, 0);
              totalsByComanda[c.id] = total;
              
            } catch (err) { 
              console.warn('[confirmOpen] Erro ao buscar dados da comanda:', err);
              namesByComanda[c.id] = null;
              totalsByComanda[c.id] = 0;
            }
          }));
          
          const enrichedTables = (mesas || []).map((mesa) => {
            const comanda = (openComandas || []).find((c) => c.mesa_id === mesa.id);
            // Se a comanda é a que acabamos de abrir, manter o displayName
            const customerName = comanda 
              ? (namesByComanda[comanda.id] !== null ? namesByComanda[comanda.id] : displayName)
              : null;
            return {
              id: mesa.id,
              name: mesa.nome || `Mesa ${mesa.numero}`,
              status: comanda ? 'in-use' : 'available',
              comandaId: comanda?.id || null,
              customer: customerName,
              order: [],
              totalHint: comanda ? totalsByComanda[comanda.id] || 0 : 0,
              aberto_em: comanda?.aberto_em || null,
            };
          });
          
          setTables(enrichedTables);
        } catch (err) {
          console.error('[confirmOpen] Erro ao atualizar mesas:', err);
        }
        setIsOpenTableDialog(false);
        setPendingTable(null);
        setClienteNome('');
        setSelectedClientIds([]);
        setConsumidorCount(0);
        setShowConsumidorControls(false);
        toast({ title: 'Mesa aberta', description: displayName ? `Comanda criada para: ${displayName}` : 'Comanda criada.', variant: 'success' });
      } catch (e) {
        try {
          console.error('[confirmOpen] Falha ao abrir mesa:', e?.message || e, e?.stack);
          console.log('[confirmOpen] Contexto debug:', {
            pendingTable,
            consumidorCount,
            selectedClientIds,
            clienteIdsType: Array.isArray(selectedClientIds),
          });
        } catch {}
        toast({ title: 'Falha ao abrir mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    };

    return (
      <Dialog open={isOpenTableDialog} onOpenChange={(open) => { setIsOpenTableDialog(open); if (!open) { setPendingTable(null); setClienteNome(''); setSelectedClientIds([]); setConsumidorCount(0); setShowConsumidorControls(false); } }}>
        <DialogContent
          className="w-[95vw] max-w-md h-[560px] max-h-[75vh] flex flex-col animate-none overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onEscapeKeyDown={(e) => { e.preventDefault(); setIsOpenTableDialog(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setIsOpenTableDialog(false); } }}
          ref={otDialogRef}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold">Abrir Mesa {pendingTable ? `#${pendingTable.number}` : ''}</DialogTitle>
            <DialogDescription className="text-sm">Selecione um ou mais clientes para a mesa.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto thin-scroll min-h-0 space-y-2 py-2" ref={otBodyRef}>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Buscar cliente</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input 
                    placeholder="Nome, telefone ou código" 
                    className="pl-8 h-9 text-sm" 
                    value={search} 
                    ref={otSearchRef}
                    onChange={(e) => { otTypeTsRef.current = Date.now(); setSearch(e.target.value); }} 
                    onKeyDown={(e) => {
                      // Enter dentro do campo de busca: marcar cliente focado e limpar busca
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        try {
                          if (Array.isArray(clients) && clients.length > 0) {
                            const idx = Math.min(Math.max(otFocusIndex || 0, 0), clients.length - 1);
                            const c = clients[idx];
                            if (c?.id) {
                              setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                            }
                          }
                        } catch {}
                        // limpar busca e voltar foco para a lista
                        setSearch('');
                        setTimeout(() => { try { otListRef.current?.focus(); } catch {} }, 0);
                      } else {
                        // marcar que estamos digitando
                        otTypeTsRef.current = Date.now();
                      }
                    }}
                  />
                </div>
                <Button 
                  type="button" 
                  size="icon" 
                  title="Cadastrar cliente" 
                  className="h-9 w-9 flex-shrink-0 bg-brand text-black hover:bg-brand/90" 
                  onClick={() => { window.location.href = '/clientes'; }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-1.5 text-[12px] text-text-muted flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-surface-2">→</kbd> seleciona</span>
                <span className="inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-surface-2">←</kbd> desmarca</span>
                <span className="inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-surface-2">Enter</kbd> confirma</span>
                <span className="inline-flex items-center gap-1">Digite para buscar</span>
              </div>
            </div>
            
            <div className="min-h-[8px]">
              {selectedClientIds.length > 0 && (
                <div className="bg-success/10 border border-success/30 rounded-md p-2.5">
                  <div className="text-xs font-medium text-success mb-1">
                    {selectedClientIds.length} cliente{selectedClientIds.length > 1 ? 's' : ''} selecionado{selectedClientIds.length > 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-text-primary">
                    {clients.filter(c => selectedClientIds.includes(c.id)).map(c => c.nome).join(', ')}
                  </div>
                </div>
              )}
            </div>
            
            <div
              className="border rounded-md focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              role="listbox"
              aria-label="Clientes"
              aria-activedescendant={(clients && clients.length > 0 && clients[otFocusIndex] && clients[otFocusIndex].id) ? `ot-option-${clients[otFocusIndex].id}` : undefined}
              ref={otListRef}
              tabIndex={0}
              onKeyDown={(e) => {
                try {
                  const isPrintable = (
                    e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
                  );
                  // Digitação direta na lista: envia para o campo de busca
                  if (isPrintable || e.key === 'Backspace') {
                    e.preventDefault();
                    e.stopPropagation();
                    let next = String(search || '');
                    if (e.key === 'Backspace') {
                      next = next.slice(0, -1);
                    } else {
                      next += e.key;
                    }
                    setSearch(next);
                    otTypeTsRef.current = Date.now();
                    // Garantir que o topo (barra de busca) esteja visível na área de rolagem do corpo
                    try { if (otBodyRef.current) otBodyRef.current.scrollTop = 0; } catch {}
                    // Focar input e colocar cursor no fim
                    setTimeout(() => {
                      try {
                        if (otSearchRef.current) {
                          otSearchRef.current.focus();
                          const len = next.length;
                          otSearchRef.current.setSelectionRange?.(len, len);
                        }
                      } catch {}
                    }, 0);
                    return;
                  }
                  if (['ArrowDown','ArrowUp','Home','End','ArrowRight','ArrowLeft',' '].includes(e.key)) {
                    let idx = otFocusIndex || 0;
                    const n = clients.length;
                    if (e.key === 'ArrowDown') idx = Math.min(idx + 1, n - 1);
                    if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
                    if (e.key === 'Home') idx = 0;
                    if (e.key === 'End') idx = n - 1;
                    setOtFocusIndex(idx);
                    setTimeout(() => { try { otItemRefs.current[idx]?.scrollIntoView({ block: 'nearest' }); } catch {} }, 0);
                    // ArrowRight/Left and Space are handled below using the same idx
                    const c = clients[idx];
                    const isConsumidorKey = c?.codigo === 0;
                    if (e.key === 'ArrowRight' && c?.id) {
                      if (isConsumidorKey) {
                        // Consumidor: incrementar contador
                        setShowConsumidorControls(true);
                        setConsumidorCount(prev => prev + 1);
                      } else {
                        // Cliente normal: adicionar aos selecionados
                        setClienteNome('');
                        setSelectedClientIds(prev => prev.includes(c.id) ? prev : [...prev, c.id]);
                      }
                    }
                    if (e.key === 'ArrowLeft' && c?.id) {
                      if (isConsumidorKey) {
                        // Consumidor: decrementar contador
                        const newCount = Math.max(0, consumidorCount - 1);
                        setConsumidorCount(newCount);
                        if (newCount === 0) setShowConsumidorControls(false);
                      } else {
                        // Cliente normal: remover dos selecionados
                        setSelectedClientIds(prev => prev.filter(id => id !== c.id));
                      }
                    }
                    if (e.key === ' ') {
                      if (c?.id) {
                        setClienteNome('');
                        setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                      }
                    }
                    return;
                  }
                  if (e.key === 'Enter') {
                    // Enter: selecionar cliente focado e confirmar imediatamente
                    e.preventDefault();
                    const idx = Math.min(Math.max(otFocusIndex || 0, 0), clients.length - 1);
                    const c = clients[idx];
                    // Só considera "digitando" se houve entrada no input de busca recentemente
                    const recentlyTyped = (Date.now() - otTypeTsRef.current) < 600;
                    const typingOrSearching = recentlyTyped || document.activeElement === otSearchRef.current || (search && search.length > 0);
                    if (typingOrSearching) {
                      if (c?.id) {
                        setClienteNome('');
                        setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                      }
                      setSearch('');
                      setTimeout(() => { try { otListRef.current?.focus(); if (otBodyRef.current) otBodyRef.current.scrollTop = 0; } catch {} }, 0);
                      return;
                    }
                    // Se não está digitando: selecionar (se ainda não) e confirmar imediatamente
                    if (c?.id) {
                      const nextIds = selectedClientIds.includes(c.id)
                        ? selectedClientIds
                        : [...selectedClientIds, c.id];
                      if (!selectedClientIds.includes(c.id)) {
                        setSelectedClientIds(prev => [...prev, c.id]);
                      }
                      setTimeout(() => { try { confirmOpen(nextIds); } catch {} }, 0);
                      return;
                    }
                    setTimeout(() => { try { confirmOpen(selectedClientIds); } catch {} }, 0);
                    return;
                  }
                } catch {}
              }}
            >
              {loadingClients ? (
                <div className="p-3 text-center text-sm text-text-muted">Carregando...</div>
              ) : clients.length > 0 ? (
                <ul className="divide-y divide-border">
                  {clients.map((c, idx) => {
                    const isConsumidor = c.codigo === 0;
                    const active = selectedClientIds.includes(c.id);
                    const isFocused = idx === (otFocusIndex || 0);
                    const consumidorQty = isConsumidor ? consumidorCount : 0;
                    return (
                      <li
                        key={c.id}
                        id={`ot-option-${c.id}`}
                        ref={(el) => { otItemRefs.current[idx] = el; }}
                        role="option"
                        aria-selected={isFocused}
                        className={cn(
                          'p-2.5 flex items-center gap-2 cursor-pointer transition-colors outline-none focus:outline-none focus-visible:outline-none border border-transparent',
                          isConsumidor ? 'bg-amber-500/5 border-l-2 border-l-amber-500/40' : '',
                          active && !isConsumidor ? 'bg-success/10 hover:bg-success/15' : 'hover:bg-surface-2',
                          showConsumidorControls && isConsumidor ? 'bg-amber-500/10' : '',
                          isFocused ? 'bg-brand/10' : ''
                        )}
                        onClick={() => {
                          if (isConsumidor) {
                            // Clique mostra controles e inicia com 1
                            if (!showConsumidorControls) {
                              setShowConsumidorControls(true);
                              setConsumidorCount(1);
                            }
                          } else {
                            setClienteNome('');
                            setSelectedClientIds(prev => 
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }
                        }}
                        onDoubleClick={() => {
                          if (!isConsumidor) {
                            const nextIds = selectedClientIds.includes(c.id) ? selectedClientIds : [...selectedClientIds, c.id];
                            setSelectedClientIds(nextIds);
                            setTimeout(() => { try { confirmOpen(nextIds); } catch {} }, 0);
                          }
                        }}
                        onMouseEnter={() => { if (Date.now() - (otKbNavTsRef.current || 0) > 300) setOtFocusIndex(idx); }}
                        tabIndex={-1}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {!isConsumidor && <span className={cn('w-2 h-2 rounded-full flex-shrink-0', active ? 'bg-success' : (isFocused ? 'bg-brand' : 'bg-border'))} />}
                          <div className="font-medium text-sm truncate">
                            {c.codigo != null && c.codigo !== 0 ? `${c.codigo} - ` : ''}{c.nome}
                            {isConsumidor && <span className="ml-2 text-xs text-amber-600">Cliente Padrão</span>}
                          </div>
                        </div>
                        {isConsumidor ? (
                          showConsumidorControls ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-red-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newCount = Math.max(0, consumidorCount - 1);
                                  setConsumidorCount(newCount);
                                  if (newCount === 0) setShowConsumidorControls(false);
                                }}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <div className="w-8 h-7 flex items-center justify-center bg-surface-2 rounded text-sm font-medium">
                                {consumidorQty}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-green-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConsumidorCount(prev => prev + 1);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null
                        ) : (
                          <div className="ml-2 flex-shrink-0">
                            {active ? (
                              <CheckCircle size={18} className="text-success" />
                            ) : (
                              <div className="w-[18px] h-[18px] rounded-full border-2 border-border" />
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="p-4 text-center text-sm text-text-muted">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex-shrink-0 pt-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { 
                setIsOpenTableDialog(false); 
                setPendingTable(null); 
                setClienteNome(''); 
                setSelectedClientIds([]); 
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => confirmOpen()} 
              disabled={!pendingTable}
            >
              Confirmar Abertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Componente interno: conteúdo do modal Abrir Caixa (estado local para evitar re-render global)
  const OpenCashContent = () => {
    const [openCashInitial, setOpenCashInitial] = useState('');
    // Restaurar do ref ao montar (evita perda ao re-render/remount)
    useEffect(() => {
      if (openCashInitialRef.current) setOpenCashInitial(openCashInitialRef.current);
    }, []);
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>Abrir Caixa</AlertDialogTitle>
          <AlertDialogDescription>Insira o valor inicial (suprimento) para abrir o caixa.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="initial-value">Valor Inicial</Label>
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
            <Input
              id="initial-value"
              type="text"
              inputMode="numeric"
              pattern="[0-9.,]*"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="cash-open-initial"
              placeholder="0,00"
              className="pl-9 font-semibold"
              value={openCashInitial}
              onChange={(e) => {
                // Máscara BRL centavos-primeiro: digita 1 -> 0,01; 12 -> 0,12; 123 -> 1,23
                const digits = (e.target.value || '').replace(/\D/g, '');
                const cents = digits ? Number(digits) / 100 : 0;
                const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
                setOpenCashInitial(formatted);
                openCashInitialRef.current = formatted;
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                // Permitir apenas números, backspace, delete, setas e tab
                const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                if (allowed.includes(e.key)) return;
                if (!/^[0-9]$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
              onBeforeInput={(e) => {
                // bloqueia qualquer caractere não numérico
                const data = e.data ?? '';
                if (data && /\D/.test(data)) e.preventDefault();
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpenCashDialogOpen(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            if (openCashInProgress) return;
            setOpenCashInProgress(true);
            try {
              const cleaned = String(openCashInitial).replace(/\./g, '').replace(',', '.');
              const v = Number(cleaned) || 0;
              try { localStorage.setItem('cash:opening', String(Date.now())); } catch {}
              await ensureCaixaAberto({ saldoInicial: v, codigoEmpresa: userProfile?.codigo_empresa });
              await refreshCashierStatus();
              await refreshTablesLight({ showToast: false });
              setOpenCashDialogOpen(false);
              toast({ title: 'Caixa aberto com sucesso!', variant: 'success' });
              // Limpar rascunho após abrir
              openCashInitialRef.current = '';
              setOpenCashInitial('');
            } catch (e) {
              toast({ title: 'Falha ao abrir caixa', description: e?.message || 'Tente novamente', variant: 'destructive' });
            } finally {
              try { localStorage.removeItem('cash:opening'); } catch {}
              setOpenCashInProgress(false);
            }
          }}>Confirmar Abertura</AlertDialogAction>
        </AlertDialogFooter>
      </>
    );
  };

  const OpenCashierDialog = () => (
    <AlertDialog open={openCashDialogOpen} onOpenChange={setOpenCashDialogOpen}>
      <AlertDialogTrigger asChild>
          <Button variant="success" size="sm" disabled={isCashierOpen || openCashInProgress} onClick={() => setOpenCashDialogOpen(true)} className="px-3">
            <Unlock className="h-4 w-4" />
            <span className="ml-2 md:hidden">Abrir</span>
            <span className="ml-2 hidden md:inline">Abrir Caixa</span>
            <kbd className="ml-2 hidden md:inline px-2 py-1 text-xs font-bold font-mono text-white bg-emerald-700 border border-emerald-800 rounded shadow-sm">F10</kbd>
          </Button>
      </AlertDialogTrigger>
       <AlertDialogContent 
        className="sm:max-w-[425px] animate-none"
        onKeyDown={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => e.stopPropagation()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <OpenCashContent />
      </AlertDialogContent>
    </AlertDialog>
  );

  const CloseCashierDialog = () => {
    const [closingData, setClosingData] = useState({ loading: false, saldoInicial: 0, resumo: null });
    const [isCloseCashOpen, setIsCloseCashOpen] = useState(false);
    const [showConfirmClose, setShowConfirmClose] = useState(false);
    const [showMobileWarn, setShowMobileWarn] = useState(false);
    const [closing, setClosing] = useState(false);
    const [valorContadoDinheiro, setValorContadoDinheiro] = useState('');
    const handlePrepareClose = async () => {
      try {
        setClosingData({ loading: true, saldoInicial: 0, resumo: null });
        const sess = await getCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        const sum = await listarResumoSessaoCaixaAtual({ codigoEmpresa: userProfile?.codigo_empresa });
        setClosingData({ loading: false, saldoInicial: Number(sess?.saldo_inicial || 0), resumo: sum || { totalPorFinalizadora: {} } });
      } catch (e) {
        setClosingData({ loading: false, saldoInicial: 0, resumo: { totalPorFinalizadora: {} } });
      }
    };
    const totalPorFinalizadora = closingData?.resumo?.totalPorFinalizadora || {};
    const somaFinalizadoras = Object.values(totalPorFinalizadora).reduce((acc, v) => acc + Number(v || 0), 0);
    const totalCaixa = Number(closingData.saldoInicial || 0) + somaFinalizadoras; // sem saídas por enquanto

    return (
      <>
      <AlertDialog open={isCloseCashOpen} onOpenChange={(open) => { setIsCloseCashOpen(open); if (open) handlePrepareClose(); }}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={!isCashierOpen} onClick={() => setIsCloseCashOpen(true)} className="px-3">
            <Lock className="h-4 w-4" />
            <span className="ml-2 md:hidden">Fechar</span>
            <span className="ml-2 hidden md:inline">Fechar Caixa</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          className="sm:max-w-[425px] w-[92vw] max-h-[85vh] animate-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Caixa</AlertDialogTitle>
            <AlertDialogDescription>Confira os valores e confirme o fechamento do caixa. Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          {/* Aviso inline somente no mobile, exibido na tentativa de fechar com comandas abertas */}
          {showMobileWarn && (
            <div className="md:hidden mb-2 text-[12px] text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Existem comandas abertas. Finalize-as antes de fechar o caixa.
            </div>
          )}
          {closingData.loading ? (
            <div className="py-4 text-text-muted">Carregando resumo…</div>
          ) : (
            <div className="py-4 space-y-2">
              <div className="flex justify-between"><span className="text-text-secondary">Valor Inicial:</span> <span className="font-mono">R$ {Number(closingData.saldoInicial||0).toFixed(2)}</span></div>
              {Object.keys(totalPorFinalizadora).length === 0 ? (
                <div className="text-sm text-text-muted">Sem pagamentos nesta sessão.</div>
              ) : (
                Object.entries(totalPorFinalizadora).map(([metodo, valor]) => (
                  <div key={metodo} className="flex justify-between"><span className="text-text-secondary">{String(metodo)}:</span> <span className="font-mono">R$ {Number(valor||0).toFixed(2)}</span></div>
                ))
              )}
              <div className="flex justify-between font-bold text-lg"><span className="text-text-primary">Total em Caixa:</span> <span className="font-mono text-success">R$ {Number(totalCaixa||0).toFixed(2)}</span></div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsCloseCashOpen(false)} disabled={closing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConfirmClose(true);
            }} disabled={closing}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showConfirmClose} onOpenChange={(open) => { if (!closing) setShowConfirmClose(open); }}>
        <AlertDialogContent
          className="sm:max-w-[425px] w-[92vw] max-h-[85vh] animate-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { if (!closing) e.preventDefault(); }}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => { if (!closing) { e.preventDefault(); e.stopPropagation(); } }}
          onInteractOutside={(e) => { if (!closing) { e.preventDefault(); e.stopPropagation(); } }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Fechamento do Caixa</AlertDialogTitle>
            <AlertDialogDescription>Informe o saldo final para finalizar o fechamento.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="valor-contado-final" className="text-sm font-medium text-text-primary mb-2 block">
              Saldo Final (opcional)
            </Label>
            <input
              id="valor-contado-final"
              type="text"
              placeholder="R$ 0,00"
              value={valorContadoDinheiro}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, '');
                if (v.length > 0) {
                  v = (Number(v) / 100).toFixed(2);
                  v = v.replace('.', ',');
                  v = 'R$ ' + v;
                }
                setValorContadoDinheiro(v);
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmClose(false);
            }} disabled={closing}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                if (closing) return;
                setClosing(true);
                // Passar o saldo final calculado e o valor contado em dinheiro para a função fecharCaixa
                const saldoFinalCalculado = Number(closingData.saldoInicial || 0) + somaFinalizadoras;
                const valorFinalDinheiro = valorContadoDinheiro ? Number(valorContadoDinheiro.replace(/[^0-9,]/g, '').replace(',', '.')) : null;
                await fecharCaixa({ 
                  saldoFinal: saldoFinalCalculado, 
                  valorFinalDinheiro: valorFinalDinheiro,
                  codigoEmpresa: userProfile?.codigo_empresa 
                });
                // Considera fechado ao concluir a operação e atualiza UI imediatamente
                setIsCashierOpen(false);
                // Evita condições de corrida de portal/unmount no mobile: fecha no próximo frame e só então mostra toast
                if (typeof requestAnimationFrame === 'function') {
                  requestAnimationFrame(() => {
                    setShowConfirmClose(false);
                    setIsCloseCashOpen(false);
                    setValorContadoDinheiro('');
                    toast({ 
                      title: 'Caixa fechado!', 
                      description: `Saldo final: R$ ${saldoFinalCalculado.toFixed(2)}`,
                      duration: 4000
                    });
                  });
                } else {
                  setShowConfirmClose(false);
                  setIsCloseCashOpen(false);
                  setValorContadoDinheiro('');
                  toast({ 
                    title: 'Caixa fechado!', 
                    description: `Saldo final: R$ ${saldoFinalCalculado.toFixed(2)}`,
                    duration: 4000
                  });
                }
                // Sincroniza status em background sem bloquear a UI
                setTimeout(async () => {
                  try { await getCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa }); } catch {}
                }, 0);
              } catch (e) {
                console.error(e);
                const msg = e?.message || 'Tente novamente';
                if (isMobileView) {
                  setMobileWarnMsg(msg.includes('Existem') ? msg : `Falha ao fechar caixa: ${msg}`);
                  try { setShowConfirmClose(false); setIsCloseCashOpen(false); } catch {}
                  if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => { setMobileWarnOpen(true); });
                  } else {
                    setMobileWarnOpen(true);
                  }
                  setTimeout(() => setMobileWarnOpen(false), 2600);
                } else {
                  // Desktop toast
                  toast({ title: 'Falha ao fechar caixa', description: msg, variant: 'destructive' });
                }
              } finally { setClosing(false); }
            }}>Confirmar Fechamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  };

  const ManageClientsDialog = () => {
    const [localSearch, setLocalSearch] = useState('');
    const [localClients, setLocalClients] = useState([]);
    const [localLinked, setLocalLinked] = useState([]); // Array de {id, cliente_id, nome, tipo: 'cadastrado'|'livre'}
    const [localLoading, setLocalLoading] = useState(false);
    const [pendingChanges, setPendingChanges] = useState(new Set());
    const initialLinkedRef = useRef([]);
    const loadedRef = useRef(false);
    const isDirtyRef = useRef(false);
    const [localFocusIndex, setLocalFocusIndex] = useState(0);
    const itemRefs = useRef([]);
    const listboxRef = useRef(null);
    const kbNavTsRef = useRef(0);
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    const [editingClientId, setEditingClientId] = useState(null);
    const [editingConsumidorId, setEditingConsumidorId] = useState(null);
    const [editingConsumidorName, setEditingConsumidorName] = useState('');

    useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isManageClientsOpen || !selectedTable?.comandaId) return;
      
      // Evitar recarregar se já carregou (exceto se mudou a busca)
      if (loadedRef.current && localSearch === '') return;
      
      try {
        setLocalLoading(true);
          // Carregar clientes vinculados à comanda (retorna {id, tipo, nome, cliente_id})
          const vincs = await listarClientesDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
          if (!active) return;
          console.log('[ManageClientsDialog] Clientes da comanda:', vincs);
          // Mapear para formato interno: {id, cliente_id, nome, tipo}
          const linked = (vincs || []).map(v => ({
            id: v.id, // ID do registro em comanda_clientes
            cliente_id: v.cliente_id,
            nome: v.nome || '',
            tipo: v.tipo || (v.cliente_id ? 'cadastrado' : 'livre')
          }));
          console.log('[ManageClientsDialog] Linked mapeado:', linked);
          // Só reseta o estado local se não houver rascunho/alterações pendentes
          if (!isDirtyRef.current) {
            setLocalLinked(linked);
            initialLinkedRef.current = JSON.parse(JSON.stringify(linked));
            setPendingChanges(new Set());
          }
          // Carregar lista de clientes disponíveis
          const rows = await listarClientes({ searchTerm: localSearch, limit: 50 });
        if (!active) return;
        const sorted = (rows || []).slice().sort((a, b) => Number(a?.codigo || 0) - Number(b?.codigo || 0));
        setLocalClients(sorted);
        // definir foco inicial no primeiro item para navegação por setas
        setLocalFocusIndex(0);
        loadedRef.current = true;
        } catch (e) {
          console.error('Erro ao carregar clientes:', e);
        } finally {
          if (active) setLocalLoading(false);
        }
      };
      
      // Carregar apenas quando o modal abre pela primeira vez
      if (!isManageClientsOpen) {
        loadedRef.current = false;
        setLocalSearch('');
        return () => { active = false; };
      }
      
      load();
      return () => { active = false; };
    }, [isManageClientsOpen, selectedTable?.comandaId]);

    // Mantém um espelho se o diálogo está "sujo" (com alterações pendentes)
    useEffect(() => {
      isDirtyRef.current = pendingChanges.size > 0;
    }, [pendingChanges]);

  // Foco inicial quando o modal abre e há clientes carregados
  useEffect(() => {
    if (isManageClientsOpen && Array.isArray(localClients) && localClients.length > 0) {
      setLocalFocusIndex(0);
      // Scroll para o topo do modal ao abrir
      setTimeout(() => { 
        try { 
          const dialogContent = document.querySelector('[role="dialog"]');
          if (dialogContent) {
            const scrollableDiv = dialogContent.querySelector('.overflow-y-auto');
            if (scrollableDiv) scrollableDiv.scrollTop = 0;
          }
        } catch {} 
      }, 0);
    }
  }, [isManageClientsOpen, localClients.length]);

    const addConsumidor = () => {
      if (!selectedTable?.comandaId) return;
      (async () => {
        try {
          setLocalLoading(true);
          const { data, error } = await supabase
            .from('comanda_clientes')
            .insert({
              comanda_id: selectedTable.comandaId,
              nome_livre: 'Consumidor',
              codigo_empresa: userProfile?.codigo_empresa,
            })
            .select('id, cliente_id, nome_livre')
            .single();
          if (error) {
            throw error;
          }
          const newEntry = {
            id: data.id, // ID real do vínculo em comanda_clientes
            cliente_id: data.cliente_id,
            nome: data.nome_livre || 'Consumidor',
            tipo: 'livre'
          };
          setLocalLinked(prev => [...prev, newEntry]);
          // Abrir edição imediatamente
          setEditingConsumidorId(newEntry.id);
          setEditingConsumidorName(newEntry.nome || 'Consumidor');
        } catch (e) {
          console.error('[ManageClientsDialog] Erro ao adicionar consumidor:', e);
          toast({
            title: 'Falha ao adicionar consumidor',
            description: e?.message || 'Tente novamente',
            variant: 'destructive',
          });
        } finally {
          setLocalLoading(false);
        }
      })();
    };

    const addClientFromModal = (clientId) => {
      if (!selectedTable?.comandaId) return;
      const client = localClients.find(c => c.id === clientId);
      if (!client) return;
      (async () => {
        try {
          setLocalLoading(true);
          const { data, error } = await supabase
            .from('comanda_clientes')
            .insert({
              comanda_id: selectedTable.comandaId,
              cliente_id: clientId,
              codigo_empresa: userProfile?.codigo_empresa,
            })
            .select('id, cliente_id')
            .single();
          if (error) {
            throw error;
          }
          const newEntry = {
            id: data.id,
            cliente_id: data.cliente_id,
            nome: client.nome,
            tipo: 'cadastrado'
          };
          setLocalLinked(prev => [...prev, newEntry]);
          setIsAddClientModalOpen(false);
        } catch (e) {
          console.error('[ManageClientsDialog] Erro ao adicionar cliente:', e);
          toast({
            title: 'Falha ao adicionar cliente',
            description: e?.message || 'Tente novamente',
            variant: 'destructive',
          });
        } finally {
          setLocalLoading(false);
        }
      })();
    };

    const replaceClient = (linkedId, newClientId) => {
      if (!selectedTable?.comandaId) return;
      const client = localClients.find(c => c.id === newClientId);
      if (!client) return;
      const existing = localLinked.find(l => l.id === linkedId);
      if (!existing) return;
      (async () => {
        try {
          setLocalLoading(true);
          const { error } = await supabase
            .from('comanda_clientes')
            .update({ cliente_id: newClientId })
            .eq('id', linkedId)
            .eq('codigo_empresa', userProfile?.codigo_empresa);
          if (error) {
            throw error;
          }
          setLocalLinked(prev => prev.map(l =>
            l.id === linkedId
              ? { ...l, cliente_id: newClientId, nome: client.nome, tipo: 'cadastrado' }
              : l
          ));
          setEditingClientId(null);
          setIsAddClientModalOpen(false);
        } catch (e) {
          console.error('[ManageClientsDialog] Erro ao trocar cliente:', e);
          toast({
            title: 'Falha ao trocar cliente',
            description: e?.message || 'Tente novamente',
            variant: 'destructive',
          });
        } finally {
          setLocalLoading(false);
        }
      })();
    };

    const toggleClient = (clientId) => {
      // Mantido apenas para compatibilidade futura; atualmente não é usado na UI.
      if (!selectedTable?.comandaId) return;
      const existing = localLinked.find(l => l.cliente_id === clientId && l.tipo === 'cadastrado');
      if (existing) {
        removeLinked(existing.id);
      } else {
        addClientFromModal(clientId);
      }
    };

    const removeLinked = (linkedId) => {
      const entry = localLinked.find(l => l.id === linkedId);
      if (!entry) return;
      // Atualiza UI imediatamente
      setLocalLinked(prev => prev.filter(l => l.id !== linkedId));
      if (!selectedTable?.comandaId || String(linkedId).startsWith('temp-')) return;
      (async () => {
        try {
          setLocalLoading(true);
          const { error } = await supabase
            .from('comanda_clientes')
            .delete()
            .eq('id', linkedId)
            .eq('codigo_empresa', userProfile?.codigo_empresa);
          if (error) {
            throw error;
          }
        } catch (e) {
          console.error('[ManageClientsDialog] Erro ao remover cliente:', e);
          toast({
            title: 'Falha ao remover cliente',
            description: e?.message || 'Tente novamente',
            variant: 'destructive',
          });
          // Tentar restaurar entrada removida em caso de erro
          setLocalLinked(prev => [...prev, entry]);
        } finally {
          setLocalLoading(false);
        }
      })();
    };

    const startEditConsumidor = (linkedId) => {
      const entry = localLinked.find(l => l.id === linkedId);
      if (entry) {
        setEditingConsumidorId(linkedId);
        setEditingConsumidorName(entry.nome || 'Consumidor');
      }
    };

    const saveEditConsumidor = () => {
      if (!editingConsumidorId || !selectedTable?.comandaId) return;
      const nome = editingConsumidorName.trim() || 'Consumidor';
      (async () => {
        try {
          setLocalLoading(true);
          const { error } = await supabase
            .from('comanda_clientes')
            .update({ nome_livre: nome })
            .eq('id', editingConsumidorId)
            .eq('codigo_empresa', userProfile?.codigo_empresa);
          if (error) {
            throw error;
          }
          setLocalLinked(prev =>
            prev.map(l => (l.id === editingConsumidorId ? { ...l, nome } : l))
          );
        } catch (e) {
          console.error('[ManageClientsDialog] Erro ao salvar consumidor:', e);
          toast({
            title: 'Falha ao salvar cliente',
            description: e?.message || 'Tente novamente',
            variant: 'destructive',
          });
        } finally {
          setEditingConsumidorId(null);
          setEditingConsumidorName('');
          setLocalLoading(false);
        }
      })();
    };

    const confirmChanges = async () => {
      if (!selectedTable?.comandaId) {
        setIsManageClientsOpen(false);
        return;
      }

      // Se não houver mudanças, apenas fechar
      if (pendingChanges.size === 0) {
        setIsManageClientsOpen(false);
        return;
      }

      setLocalLoading(true);
      try {
        
        // Comparar estado atual com inicial
        const initialIds = initialLinkedRef.current.map(l => l.id);
        const currentIds = localLinked.map(l => l.id);
        
        // Remover clientes que não estão mais na lista
        const toRemove = initialLinkedRef.current.filter(l => !currentIds.includes(l.id));
        for (const entry of toRemove) {
          // Se tem ID real (não temporário), deletar do banco
          if (!String(entry.id).startsWith('temp-')) {
            const { error } = await supabase
              .from('comanda_clientes')
              .delete()
              .eq('id', entry.id)
              .eq('codigo_empresa', userProfile?.codigo_empresa);
            
            if (error) {
              console.error('[confirmChanges] Erro ao remover:', error);
              throw error;
            }
          }
        }
        
        // Adicionar/atualizar clientes
        const toAdd = localLinked.filter(l => String(l.id).startsWith('temp-'));
        const toUpdate = localLinked.filter(l => {
          if (String(l.id).startsWith('temp-')) return false;
          if (l.tipo !== 'livre') return false; // só atualiza nome_livre para consumidores
          const initial = initialLinkedRef.current.find(i => i.id === l.id);
          return initial && initial.nome !== l.nome;
        });
        
        // Inserir novos
        if (toAdd.length > 0) {
          const clienteIds = toAdd.filter(l => l.tipo === 'cadastrado').map(l => l.cliente_id);
          const nomesLivres = toAdd.filter(l => l.tipo === 'livre').map(l => l.nome);
          
          console.log('[confirmChanges] Adicionando:', { clienteIds, nomesLivres });
          
          await adicionarClientesAComanda({
            comandaId: selectedTable.comandaId,
            clienteIds,
            nomesLivres,
            codigoEmpresa: userProfile?.codigo_empresa
          });
        }
        
        // Atualizar nomes editados
        for (const entry of toUpdate) {
          const { error } = await supabase
            .from('comanda_clientes')
            .update({ nome_livre: entry.nome })
            .eq('id', entry.id)
            .eq('codigo_empresa', userProfile?.codigo_empresa);
          
          if (error) {
            console.error('[confirmChanges] Erro ao atualizar:', error);
            throw error;
          }
        }
        
        console.log('[confirmChanges] Operações concluídas, atualizando mesa');
        
        // Atualizar mesa e aguardar
        await refetchSelectedTableDetails(selectedTable);
        
        // Atualizar também a lista de mesas
        await refreshTablesLight({ showToast: false });
        
        toast({ title: 'Clientes atualizados', variant: 'success' });
      } catch (err) {
        console.error('[confirmChanges] Erro:', err);
        toast({ title: 'Falha ao atualizar clientes', description: err?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setLocalLoading(false);
      }
    };

    return (
      <Dialog open={isManageClientsOpen} onOpenChange={setIsManageClientsOpen}>
        <DialogContent 
          className="sm:max-w-[480px] w-[92vw] max-h-[85vh] h-[85vh] animate-none flex flex-col overflow-hidden" 
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} 
          onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Gerenciar Clientes da Mesa</DialogTitle>
            <DialogDescription>Gerencie os clientes vinculados a esta mesa.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 thin-scroll">
            {/* Clientes vinculados */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-text-primary">Clientes vinculados ({localLinked.length}):</div>
              {localLoading && localLinked.length === 0 ? (
                <div className="p-4 text-center text-sm text-text-muted border border-dashed rounded-md">
                  Carregando clientes da mesa...
                </div>
              ) : localLinked.length === 0 ? (
                <div className="p-4 text-center text-sm text-text-muted border border-dashed rounded-md">
                  Nenhum cliente vinculado ainda
                </div>
              ) : (
                <div className="space-y-2">
                  {localLinked.map((entry) => {
                    const isConsumidor = entry.tipo === 'livre';
                    const isEditing = editingConsumidorId === entry.id;
                    return (
                      <div key={entry.id} className={cn(
                        "flex items-center gap-2 p-2 rounded-md border",
                        isConsumidor ? "bg-amber-500/10 border-amber-500/30" : "bg-surface-2 border-border"
                      )}>
                        {isEditing ? (
                          <>
                            <Input
                              value={editingConsumidorName}
                              onChange={(e) => setEditingConsumidorName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditConsumidor();
                                if (e.key === 'Escape') { setEditingConsumidorId(null); setEditingConsumidorName(''); }
                                e.stopPropagation();
                              }}
                              className="flex-1 h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={saveEditConsumidor} className="h-8 px-2">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div 
                              className={cn("flex-1 text-sm truncate p-1 rounded",
                                isConsumidor ? "cursor-pointer hover:bg-amber-500/10" : "cursor-default")}
                              onClick={() => isConsumidor && startEditConsumidor(entry.id)}
                              title={isConsumidor ? "Clique para editar" : ""}
                            >
                              <span>{entry.nome}</span>
                              {isConsumidor && (
                                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 align-middle">
                                  Cliente Padrão
                                </span>
                              )}
                            </div>
                            {!isConsumidor && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => { setEditingClientId(entry.id); setIsAddClientModalOpen(true); }} 
                                className="h-7 px-2"
                                title="Trocar cliente"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => removeLinked(entry.id)} className="h-7 px-2 text-destructive hover:text-destructive">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Botão de ação */}
            <Button 
              onClick={() => { setEditingClientId(null); setIsAddClientModalOpen(true); }} 
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cliente
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageClientsOpen(false)} disabled={localLoading}>Cancelar</Button>
            <Button onClick={confirmChanges} disabled={localLoading}>
              {localLoading ? 'Salvando...' : `Confirmar ${pendingChanges.size > 0 ? `(${pendingChanges.size} alterações)` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
        
        {/* Modal aninhado para seleção de cliente */}
        <Dialog open={isAddClientModalOpen} onOpenChange={setIsAddClientModalOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingClientId ? 'Trocar Cliente' : 'Adicionar Cliente'}</DialogTitle>
              <DialogDescription>Selecione um cliente da lista</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Buscar cliente..."
                  className="pl-9"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 border rounded-md overflow-y-auto thin-scroll"
              role="listbox"
              aria-label="Clientes disponíveis"
              ref={listboxRef}
              tabIndex={0}
>
                {localLoading ? (
                  <div className="p-4 text-center text-text-muted">Carregando...</div>
                ) : localClients.length === 0 ? (
                  <div className="p-4 text-center text-text-muted">Nenhum cliente encontrado</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {localClients.map((client) => {
                      const isConsumidor = client.codigo === 0;
                      const isLinked = localLinked.some(l => l.cliente_id === client.id && l.tipo === 'cadastrado');
                      return (
                        <li
                          key={client.id}
                          className={cn(
                            "p-3 cursor-pointer transition-colors flex items-center justify-between",
                            isConsumidor ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-surface-2"
                          )}
                          onClick={() => {
                            if (isConsumidor) {
                              // Adicionar consumidor
                              if (editingClientId) {
                                setEditingClientId(null);
                                setIsAddClientModalOpen(false);
                              } else {
                                addConsumidor();
                                setIsAddClientModalOpen(false);
                              }
                            } else {
                              // Cliente cadastrado
                              if (editingClientId) {
                                replaceClient(editingClientId, client.id);
                              } else {
                                addClientFromModal(client.id);
                              }
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {isConsumidor ? 'Cliente Consumidor' : `${client?.codigo ? `${client.codigo} - ` : ''}${client?.nome || ''}`}
                              {isConsumidor && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30">Cliente Padrão</span>
                              )}
                            </div>
                            {!isConsumidor && client.telefone && (
                              <div className="text-xs text-text-muted">{client.telefone}</div>
                            )}
                            {isConsumidor && (
                              <div className="text-xs text-text-muted">Clique para adicionar consumidor</div>
                            )}
                          </div>
                          {isLinked && !isConsumidor && (
                            <CheckCircle className="h-5 w-5 text-success ml-2 flex-shrink-0" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddClientModalOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Dialog>
    );
  };

  // Componente: Lista de Mesas para Mobile (formato tabela)
  const TableViewMobile = () => {
    const getStatusColor = (status) => {
      if (status === 'available') return 'bg-success/10 border-success/30 text-success';
      if (status === 'in-use') return 'bg-warning/10 border-warning/30 text-warning';
      if (status === 'awaiting-payment') return 'bg-info/10 border-info/30 text-info';
      return 'bg-surface-2 border-border text-text-secondary';
    };

    const getStatusLabel = (status) => {
      if (status === 'available') return 'Livre';
      if (status === 'in-use') return 'Ocupada';
      if (status === 'awaiting-payment') return 'Aguardando';
      return 'Desconhecido';
    };

    return (
      <div className="md:hidden space-y-2">
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-text-muted mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Nenhuma mesa encontrada</h3>
            <p className="text-text-muted mb-4">Crie sua primeira mesa para começar</p>
          </div>
        ) : (
          tables.map((table) => {
            const total = calculateTotal(table.order || [], table);
            const displayTotal = table.totalHint > 0 ? table.totalHint : total;
            
            return (
              <div
                key={table.id}
                onClick={async () => {
                  // Bloquear se caixa fechado
                  if (!isCashierOpen) {
                    toast({ 
                      title: 'Caixa Fechado', 
                      description: 'Abra o caixa antes de gerenciar as mesas.', 
                      variant: 'warning' 
                    });
                    return;
                  }
                  // Reutiliza o fluxo de seleção (valida comanda ativa e hidrata itens/clientes)
                  await handleSelectTable(table);
                  // Se mesa está livre, o próprio handleSelectTable já abriu o diálogo de abrir mesa
                  // Se está ocupada, abrir modal mobile com dados já carregados
                  if (table.status !== 'available') {
                    setIsMobileModalOpen(true);
                  }
                }}
                className={cn(
                  "p-3 rounded-lg border-2 bg-surface transition-all active:scale-[0.98]",
                  getStatusColor(table.status),
                  selectedTable?.id === table.id && 'ring-2 ring-brand/60',
                  isCashierOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <h3 className="font-bold text-base truncate">
                          {table.name || `Mesa ${table.number}`}
                        </h3>
                        {table.status === 'available' && table.id === firstAvailableId && (
                          <kbd className="hidden md:inline px-2 py-1 text-xs font-bold font-mono text-gray-400 bg-transparent border border-gray-300/50 rounded flex-shrink-0">F1</kbd>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0",
                        getStatusColor(table.status)
                      )}>
                        {getStatusLabel(table.status)}
                      </span>
                    </div>
                    {(table.status === 'in-use' || table.status === 'awaiting-payment') ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                          <Users className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{formatClientDisplay(table.customer) || 'Sem cliente'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                          <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>R$ {displayTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted">Mesa disponível</div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0 ml-2" />
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // Modal Mobile para Visualizar Mesa
  const MobileTableModal = () => {
    if (!selectedTable) return null;

    return (
      <Dialog open={isMobileModalOpen} modal={!isProductDetailsOpen} onOpenChange={(open) => {
        if (!open && isProductDetailsOpen) return; // não fechar mesa se info estiver aberta
        setIsMobileModalOpen(open);
        if (!open) {
          // Garantir que qualquer modal de desconto de item seja fechado junto com o modal mobile
          setSelectedItemForDesconto(null);
        }
        // Manter focusContext em 'tables' quando modal está aberto para permitir navegação por setas
        if (open) {
          setFocusContext('tables');
        }
      }}>
        <DialogContent 
          className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 animate-none"
        >
          {/* Header com informações da mesa */}
          <div className="p-4 border-b border-border bg-surface-2">
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="text-xl font-bold">
                {selectedTable.name || `Mesa ${selectedTable.number}`}
              </DialogTitle>
              {/* Close button removed: using default DialogContent close (top-right) to prevent duplicate X */}
            </div>
            {/* Descrição para acessibilidade */}
            <DialogDescription className="sr-only">Visualização da comanda e produtos da mesa selecionada</DialogDescription>
            {(selectedTable.status === 'in-use' || selectedTable.status === 'awaiting-payment') && (
              <div className="flex items-center gap-4 text-sm text-text-secondary">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{formatClientDisplay(selectedTable.customer) || 'Sem cliente'}</span>
                </div>
                {selectedTable.order && selectedTable.order.length > 0 && (
                  <div className="flex items-center gap-1 font-semibold text-text-primary">
                    <DollarSign className="w-4 h-4" />
                    <span>R$ {(selectedTable.totalHint > 0 ? selectedTable.totalHint : calculateTotal(selectedTable.order || [])).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs Comanda/Detalhes/Produtos (mobile) */}
          <Tabs value={mobileTableTab} onValueChange={(val) => {
            setMobileTableTab(val);
            // Sempre fechar desconto de item ao trocar de aba, para não ficar "preso" por trás
            setSelectedItemForDesconto(null);
            if (val === 'products' && selectedTable) {
              setIsProductsModalOpen(true);
              setMobileTableTab('order'); // Voltar para comanda
            }
          }} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-3 m-2 rounded-lg">
              <TabsTrigger value="order" className="text-sm flex items-center justify-center gap-2">Comanda</TabsTrigger>
              <TabsTrigger value="details" className="text-sm flex items-center justify-center gap-2">Detalhes</TabsTrigger>
              <TabsTrigger value="products" className="text-sm flex items-center justify-center gap-2" onClick={() => {
                if (selectedTable) {
                  setIsProductsModalOpen(true);
                }
              }}>
                Produtos
                <kbd className="hidden md:inline px-2 py-1 text-xs font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">P</kbd>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="order" className="flex-1 overflow-hidden min-h-0 m-0" onKeyDown={(e) => {
              // Keep focus context on 'tables' when arrow keys are pressed
              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                setFocusContext('tables');
              }
            }}>
              <OrderPanel table={selectedTable} />
            </TabsContent>
            <TabsContent value="details" className="flex-1 overflow-hidden min-h-0 m-0">
              <OrderDetailsPanel table={selectedTable} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  };

  const ProductDetailsDialog = () => {
    const prod = selectedProduct;
    const qInOrder = prod ? (qtyByProductId.get(prod.id) || 0) : 0;
    const price = prod ? Number(prod.salePrice ?? prod.price ?? 0) : 0;
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    return (
      <Dialog open={isProductDetailsOpen} onOpenChange={(open) => {
        setIsProductDetailsOpen(open);
        if (!open) setSelectedProduct(null);
      }}>
        <DialogContent overlayClassName="z-[70]" className="sm:max-w-[420px] w-[92vw] max-h-[85vh] flex flex-col animate-none z-[71]" onOpenAutoFocus={(e) => { /* garantir foco no topo */ }} onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold break-words" title={prod?.name || ''}>{prod?.name || 'Produto'}</DialogTitle>
            <DialogDescription>Detalhes do produto e ações rápidas.</DialogDescription>
          </DialogHeader>
          {prod ? (
            <div className="space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Preço</span>
                <span className="text-sm font-semibold">{fmt(price)}</span>
              </div>
              {prod.category ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Categoria</span>
                  <span className="text-sm font-medium">{prod.category}</span>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2 text-center">
                {typeof prod.stock !== 'undefined' && (
                  <div className="bg-surface-2 rounded-md p-3 border border-border">
                    <div className="text-xs text-text-secondary">Estoque</div>
                    <div className="text-base font-semibold">{prod.stock}</div>
                  </div>
                )}
                {typeof prod.minStock !== 'undefined' && (
                  <div className="bg-surface-2 rounded-md p-3 border border-border">
                    <div className="text-xs text-text-secondary">Mínimo</div>
                    <div className="text-base font-semibold">{prod.minStock}</div>
                  </div>
                )}
                <div className="bg-surface-2 rounded-md p-3 border border-border">
                  <div className="text-xs text-text-secondary">Na Comanda</div>
                  <div className="text-base font-semibold">x{qInOrder}</div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="mr-auto inline-flex items-center gap-1" onClick={() => { if (prod) { navigate('/produtos', { state: { productId: prod.id, productName: prod.name } }); } }}>
              <FileText className="w-4 h-4" />
              <span>Info</span>
            </Button>
            <Button variant="outline" onClick={() => { setIsProductDetailsOpen(false); setSelectedProduct(null); }}>Fechar</Button>
            <Button onClick={async () => { if (prod) { await addProductToComanda(prod); setIsProductDetailsOpen(false); setSelectedProduct(null); } }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      <ProductDetailsDialog />
      <CounterProductDetailsDialog />
      <div className="h-full flex flex-col">
        {/* Tabs - Mobile em cima, Desktop na mesma linha */}
        <div className="md:hidden mb-2 w-full">
          <Tabs value="mesas" onValueChange={(v) => {
            if (v === 'mesas') navigate('/vendas');
            if (v === 'balcao') navigate('/balcao');
            if (v === 'historico') navigate('/historico');
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mesas" className="text-xs" title="Pressione B para alternar">Mesas</TabsTrigger>
              <TabsTrigger value="balcao" className="text-xs" title="Pressione B para alternar">Balcão</TabsTrigger>
              <TabsTrigger value="historico" className="text-xs" title="Pressione H para ir ao histórico">Histórico</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center justify-between mb-2 md:mb-6 gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-2 md:gap-3">
            <Tabs value="mesas" onValueChange={(v) => {
              if (v === 'mesas') navigate('/vendas');
              if (v === 'balcao') navigate('/balcao');
              if (v === 'historico') navigate('/historico');
            }}>
              <TabsList className="inline-flex">
                <TabsTrigger value="mesas" className="text-sm" title="Pressione B para alternar">Mesas</TabsTrigger>
                <TabsTrigger value="balcao" className="text-sm" title="Pressione B para alternar">Balcão</TabsTrigger>
                <TabsTrigger value="historico" className="text-sm" title="Pressione H para ir ao histórico">Histórico</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
            <OpenCashierDialog />
            <CloseCashierDialog />
            <Button variant="outline" size="sm" onClick={() => setIsCashierDetailsOpen(true)} className="px-3">
              <Banknote className="h-4 w-4" />
              <span className="ml-2 md:hidden">Detalhes</span>
              <span className="ml-2 hidden md:inline">Detalhes do Caixa</span>
              <kbd className="ml-2 hidden md:inline px-2 py-1 text-xs font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">F11</kbd>
            </Button>
            <div className="hidden md:block w-px h-6 bg-border mx-1"></div>
            <Button onClick={() => setIsCreateMesaOpen(true)} className="hidden md:flex" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Nova Mesa
              <kbd className="ml-2 px-2 py-1 text-xs font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">F1</kbd>
            </Button>
          </div>
        </div>
        {/* Removed persistent mobile hint about closing cashier to avoid noise */}
        {!isCashierOpen && openComandasCount > 0 && (
          <div className="md:hidden mb-3 text-[11px] text-warning flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            Há comandas abertas, mas o caixa parece fechado.
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setOpenCashDialogOpen(true)}>Reabrir sessão</Button>
          </div>
        )}
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-visible min-h-0">
            <div 
              className="lg:col-span-2 bg-surface rounded-lg border border-border p-4 md:p-6 overflow-y-auto thin-scroll min-h-0"
              tabIndex={0}
              onKeyDown={(e) => {
                // Prevenir scroll com setas quando focusContext === 'tables'
                if (focusContext === 'tables' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setFocusContext('tables');
                if (!selectedTable && tables.length > 0) {
                  setSelectedTable(tables[0]);
                }
                e.currentTarget.focus();
              }}
              onFocus={() => {
                setFocusContext('tables');
                if (!selectedTable && tables.length > 0) {
                  setSelectedTable(tables[0]);
                }
              }}
              style={{
                outline: focusContext === 'tables' ? '2px solid rgba(148, 163, 184, 0.4)' : 'none',
                outlineOffset: '-2px',
                transition: 'outline 0.15s ease'
              }}
            >
              <div className="flex items-center justify-between mb-4 gap-4">
                <h2 className="text-xl font-bold">Mapa de Mesas</h2>
                
                {/* Atalhos de Navegação - Desktop */}
                <div className="hidden md:flex items-center gap-2 text-xs text-text-muted flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">↑↓←→</kbd>
                    <span>Navegar</span>
                  </div>
                  <div className="w-px h-3 bg-border"></div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">Enter</kbd>
                    <span>Selecionar</span>
                  </div>
                </div>
                
                {/* Mobile-only '+' button to create a new mesa */}
                <Button
                  type="button"
                  className="md:hidden h-9 w-9 p-0 bg-amber-400 text-black hover:bg-amber-300 flex-shrink-0"
                  size="icon"
                  title="Nova Mesa"
                  onClick={() => setIsCreateMesaOpen(true)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              
              {/* View Mobile: Lista/Tabela */}
              <TableViewMobile />
              
              {/* View Desktop: Grid com Drag & Drop */}
              <div className="hidden md:block">
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="tables">
                        {(provided) => (
                             <div
                               {...provided.droppableProps}
                               ref={(el) => { provided.innerRef(el); gridRef.current = el; }}
                               role="grid"
                               aria-label="Lista de mesas"
                               className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]"
                             >
                                {tables.length === 0 ? (
                                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                                    <div className="text-text-muted mb-4">
                                      <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                      </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-text-primary mb-2">Nenhuma mesa encontrada</h3>
                                    <p className="text-text-muted mb-4">Crie sua primeira mesa para começar a receber pedidos</p>
                                    <Button onClick={() => setIsCreateMesaOpen(true)} className="flex items-center gap-2">
                                      <Plus size={16} />
                                      Criar Nova Mesa
                                    </Button>
                                  </div>
                                ) : (
                                  tables.map((table, index) => (
                                    <Draggable key={table.id} draggableId={table.id} index={index}>
                                        {(provided, snapshot) => <TableCard table={table} provided={provided} isDragging={snapshot.isDragging} />}
                                    </Draggable>
                                  ))
                                )}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
              </div>
            </div>

            {/* Painel Lateral - Apenas Desktop */}
            <div 
              className="hidden md:flex bg-surface rounded-lg border border-border flex-col min-h-0 transition-all overflow-hidden"
              style={{
                boxShadow: focusContext === 'panel' ? 'inset 0 0 0 2px rgba(148, 163, 184, 0.4)' : 'none'
              }}
            >
                <Tabs value={desktopTab} onValueChange={(val) => {
                  setDesktopTab(val);
                  // Abrir modal ao trocar para aba produtos
                  if (val === 'products' && selectedTable) {
                    setIsProductsModalOpen(true);
                    setDesktopTab('order'); // Voltar para comanda
                  }
                }} className="flex flex-col h-full">
                    <TabsList className="grid w-full grid-cols-3 m-2">
                        <TabsTrigger value="order" className="flex items-center justify-center gap-2 text-xs">Comanda</TabsTrigger>
                        <TabsTrigger value="details" className="flex items-center justify-center gap-2 text-xs">Detalhes</TabsTrigger>
                        <TabsTrigger value="products" onClick={() => {
                          if (selectedTable) {
                            setIsProductsModalOpen(true);
                          }
                        }} className="flex items-center justify-center gap-2 text-xs">
                          Produtos
                          <kbd className="hidden md:inline px-1 py-0.5 text-[10px] font-bold font-mono text-white bg-gray-700 border border-gray-600 rounded">P</kbd>
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="order" className="flex-1 overflow-hidden min-h-0"><OrderPanel table={selectedTable} /></TabsContent>
                    <TabsContent value="details" className="flex-1 overflow-hidden min-h-0"><OrderDetailsPanel table={selectedTable} /></TabsContent>
                </Tabs>
            </div>
        </div>

      </div>
      <MobileTableModal />
      <CounterModeModal />
      <CashierDetailsDialog open={isCashierDetailsOpen} onOpenChange={setIsCashierDetailsOpen} cashSummary={cashSummary} />
      <OrderDetailsDialog />
      <RemoveItemConfirmDialog />
      <ManageClientsDialog />
      <OpenTableDialog />
      <CreateMesaDialog />
      {/* Warning banner (always-on overlay, mobile-focused) */}
      {mobileWarnOpen && (
        <div className="fixed left-3 right-3 z-[9999]" role="alert" aria-live="assertive" style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="pointer-events-none flex items-start gap-2 rounded-md border border-amber-500 bg-amber-400 text-black px-3 py-2 shadow-lg">
            <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
            <div className="text-sm font-semibold leading-snug drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">{mobileWarnMsg || 'Atenção'}</div>
          </div>
        </div>
      )}
      
      {/* Dialog de Desconto de Item */}
      {selectedItemForDesconto && (
        <DescontoItemDialog
          item={selectedItemForDesconto}
          onApply={() => {
            // Recarregar detalhes completos da mesa selecionada
            if (selectedTable) {
              refetchSelectedTableDetails(selectedTable)
            }
          }}
          onClose={() => {
            setSelectedItemForDesconto(null)
          }}
          codigoEmpresa={userProfile?.codigo_empresa}
        />
      )}

      {/* Dialog de Desconto de Comanda */}
      {selectedTable && isDescontoComandaDialogOpen && (
        <DescontoComandaDialog
          comanda={selectedTable}
          subtotal={calculateTotal(selectedTable.order || [], selectedTable)}
          onApply={() => {
            // Recarregar detalhes completos da mesa selecionada
            if (selectedTable) {
              refetchSelectedTableDetails(selectedTable)
            }
          }}
          onClose={() => setIsDescontoComandaDialogOpen(false)}
          codigoEmpresa={userProfile?.codigo_empresa}
        />
      )}
      
      <ProductsModal />
    </>
  );
}

export default VendasPage;
