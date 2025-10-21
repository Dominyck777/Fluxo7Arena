import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// framer-motion removido para evitar piscadas e erros de runtime
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { Plus, GripVertical, Search, CheckCircle, Clock, FileText, ShoppingBag, Trash2, DollarSign, X, Store, Lock, Unlock, Minus, Banknote, ArrowDownCircle, ArrowUpCircle, CalendarDays, Users, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { listMesas, ensureCaixaAberto, fecharCaixa, getOrCreateComandaForMesa, listarItensDaComanda, adicionarItem, atualizarQuantidadeItem, removerItem, listarFinalizadoras, registrarPagamento, fecharComandaEMesa, cancelarComandaEMesa, listarComandasAbertas, listarTotaisPorComanda, criarMesa, listarClientes, adicionarClientesAComanda, listarClientesDaComanda, getCaixaAberto, listarResumoSessaoCaixaAtual, criarMovimentacaoCaixa, listarMovimentacoesCaixa } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

import { listProducts } from '@/lib/products';
import { useNavigate } from 'react-router-dom';

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
  const [cashLoading, setCashLoading] = useState(false);
  const [cashSummary, setCashSummary] = useState(null);
  // Detalhes de produto (como no Balcão)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isManageClientsOpen, setIsManageClientsOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  // Abrir mesa
  const [isOpenTableDialog, setIsOpenTableDialog] = useState(false);
  // Criar mesa (modal)
  const [isCreateMesaOpen, setIsCreateMesaOpen] = useState(false);
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
  // Alerta compacto no mobile
  const [mobileWarnOpen, setMobileWarnOpen] = useState(false);
  const [mobileWarnMsg, setMobileWarnMsg] = useState('');
  // Flag de viewport mobile (inicializa com valor imediato)
  const [isMobileView, setIsMobileView] = useState(() => {
    try { return typeof window !== 'undefined' && window.innerWidth <= 640; } catch { return false; }
  });
  const [loadingItems, setLoadingItems] = useState(false);
  useEffect(() => {
    const update = () => {
      try { setIsMobileView(typeof window !== 'undefined' && window.innerWidth <= 640); } catch { setIsMobileView(false); }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Evita movimentação do layout quando diálogos estão abertos (bloqueia scroll do fundo)
  const anyDialogOpen = isCreateMesaOpen || isOpenTableDialog || isOrderDetailsOpen || isCashierDetailsOpen || isPayOpen || openCashDialogOpen || isCounterModeOpen || isProductDetailsOpen || isMobileModalOpen || false;
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

        let mesas = await listMesas(codigoEmpresa);
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
          let totalHint = 0;
          let customer = null;
          if (c) {
            status = (c.status === 'awaiting-payment' || c.status === 'awaiting_payment') ? 'awaiting-payment' : 'in-use';
            comandaId = c.id;
            totalHint = Number(totals[c.id] || 0);
            customer = namesByComanda[c.id] || null;
          }
          return { id: m.id, number: m.numero, name: m.nome || null, status, order: [], customer, comandaId, totalHint };
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
              // mantém 'order' atual do prev se encontrado
              const merged = found && prev ? { ...found, order: prev.order || found.order, customer: prev.customer || found.customer } : found;
              return merged || (uiTables[0] || null);
            });
          }
        } else {
          if (!isPayOpen) setSelectedTable(nextSelected);
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
  useEffect(() => {
    const tryAuto = async () => {
      if (autoReopenTriedRef.current) return;
      if (openComandasCount > 0 && !isCashierOpen) {
        autoReopenTriedRef.current = true;
        try {
          await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
          await refreshCashierStatus();
        } catch {
          // se falhar, deixamos o banner com botão de reabrir
        }
      }
    };
    tryAuto();
  }, [openComandasCount, isCashierOpen, refreshCashierStatus, userProfile?.codigo_empresa]);

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
  // MAS NÃO quando o modal de clientes estiver aberto
  useEffect(() => {
    const onFocus = () => { 
      if (!anyDialogOpen && !isManageClientsOpen && selectedTable?.comandaId) {
        refetchSelectedTableDetails(selectedTable); 
      }
    };
    const onVisibility = () => { 
      if (!anyDialogOpen && !isManageClientsOpen && document.visibilityState === 'visible' && selectedTable?.comandaId) {
        refetchSelectedTableDetails(selectedTable); 
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
        const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
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

  const calculateTotal = (order) => (order || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
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

  const qtyByProductId = useMemo(() => {
    const map = new Map();
    const order = selectedTable?.order || [];
    for (const it of order) {
      const pid = it.productId;
      if (!pid) continue;
      map.set(pid, (map.get(pid) || 0) + Number(it.quantity || 0));
    }
    return map;
  }, [selectedTable?.order]);

  // Utilitário: recarrega os detalhes (itens e clientes) da 'selectedTable'
  const refetchSelectedTableDetails = async (target) => {
    try {
      if (!target?.comandaId) return;
      const itens = await listarItensDaComanda({ comandaId: target.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
      let customer = target.customer || null;
      try {
        const vinculos = await listarClientesDaComanda({ comandaId: target.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
        const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
        customer = nomes.length ? nomes.join(', ') : null;
      } catch {}
      const enriched = { ...target, status: target.status === 'awaiting-payment' ? 'awaiting-payment' : 'in-use', order, customer };
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
        if (selectedTable && t.id === selectedTable.id) {
          return { ...t, order: selectedTable.order || [], customer: selectedTable.customer || t.customer };
        }
        return t;
      });
      
      setTables(uiTables);
      
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

  const handleSelectTable = async (table) => {
    if (isSelectingTable) return;
    setIsSelectingTable(true);
    setLoadingItems(true);
    try {
      const previous = selectedTable;
      if (table.comandaId) {
        // VERIFICAR se a comanda ainda está ativa antes de carregar dados
        try {
          const { data: comandaAtual, error } = await supabase
            .from('comandas')
            .select('id, status, fechado_em')
            .eq('id', table.comandaId)
            .eq('codigo_empresa', userProfile?.codigo_empresa)
            .single();
            
          if (error || !comandaAtual || comandaAtual.fechado_em || comandaAtual.status === 'closed') {
            setLoadingItems(false);
            React.startTransition(() => {
              setPendingTable(table);
              setIsOpenTableDialog(true);
            });
            return;
          }
          
          // Só carregar dados se comanda estiver realmente ativa
          const itens = await listarItensDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
          const order = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
          
          let customer = null;
          try {
            const vinculos = await listarClientesDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
            customer = nomes.length ? nomes.join(', ') : null;
          } catch (err) {
            console.error(`[handleSelectTable] Erro ao carregar clientes:`, err);
          }
          
          const enriched = { ...table, status: 'in-use', order, customer };
          React.startTransition(() => {
            setSelectedTable(enriched);
            setTables((prev) => prev.map((t) => (t.id === table.id ? enriched : t)));
            setLoadingItems(false);
          });
          
        } catch (err) {
          console.error(`[handleSelectTable] Erro ao verificar comanda:`, err);
          setLoadingItems(false);
          React.startTransition(() => {
            setPendingTable(table);
            setIsOpenTableDialog(true);
          });
        }
      } else {
        // não abrir automaticamente; solicitar abertura
        setLoadingItems(false);
        React.startTransition(() => {
          setPendingTable(table);
          setIsOpenTableDialog(true);
        });
      }
    } catch (e) {
      setLoadingItems(false);
      toast({ title: 'Falha ao carregar comanda da mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      // restaura seleção anterior em caso de erro
      setSelectedTable((prev) => prev || previous || null);
    } finally {
      setIsSelectingTable(false);
    }
  };

  const TableCard = ({ table, provided, isDragging }) => {
    const config = statusConfig[table.status];
    const Icon = config.icon;
    const total = calculateTotal(table.order);
    const customerDisplay = formatClientDisplay(table.customer);

    const displayTotal = (table.status === 'in-use' || table.status === 'awaiting-payment')
      ? (total > 0 ? total : Number(table.totalHint || 0))
      : 0;
    const badgeClass = table.status === 'available'
      ? 'text-success bg-success/10 border-success/30'
      : (table.status === 'in-use'
        ? 'text-warning bg-warning/10 border-warning/30'
        : 'text-info bg-info/10 border-info/30');
    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        className={cn(
          "p-4 rounded-lg border bg-surface flex flex-col transition-colors duration-150 relative h-44 shadow-sm min-w-[240px]",
          isDragging && 'shadow-lg',
          selectedTable?.id === table.id && 'ring-2 ring-brand/60 bg-surface-2',
          isCashierOpen ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-60'
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
        <div {...provided.dragHandleProps} className="absolute top-2 right-2 text-text-muted opacity-60 hover:opacity-100">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-5 h-5 text-text-secondary" />
          <span className="text-lg font-semibold text-text-primary truncate flex-1">{table.name ? table.name : `Mesa ${table.number}`}</span>
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", badgeClass)}>
            {config.label}
          </span>
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
                "w-16 h-16 object-contain opacity-80 transition-all duration-200",
                selectedTable?.id === table.id && "opacity-100 scale-110"
              )}
            />
          ) : table.status === 'in-use' ? (
            <img 
              src="/mesaocupada.png" 
              alt="Mesa ocupada" 
              className={cn(
                "w-16 h-16 object-contain opacity-80 transition-all duration-200",
                selectedTable?.id === table.id && "opacity-100 scale-110"
              )}
            />
          ) : (
            <div className={cn(
              "w-16 h-16 rounded-lg bg-info/20 border-2 border-info/40 flex items-center justify-center transition-all duration-200",
              selectedTable?.id === table.id && "bg-info/30 border-info/60 scale-110"
            )}>
              <FileText className="w-8 h-8 text-info" />
            </div>
          )}
        </div>
        {(table.status === 'in-use' || table.status === 'awaiting-payment') ? (
          <div className="w-full mt-auto">
            <div className="flex items-center gap-1 mb-1">
              <Users className="w-3 h-3 text-text-muted flex-shrink-0" />
              <div className="text-sm sm:text-base font-medium text-text-primary truncate" title={table.customer || ''}>{formatClientDisplay(table.customer) || '—'}</div>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-text-muted flex-shrink-0" />
              <div className="text-sm font-bold text-text-secondary">R$ {displayTotal.toFixed(2)}</div>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="text-xs text-text-muted text-center">Sem comanda</div>
          </div>
        )}
      </div>
    );
  };

  // Define PayDialog before OrderPanel to avoid reference errors
  const PayDialog = () => {
    const total = selectedTable ? calculateTotal(selectedTable.order) : 0;
    const [payLoading, setPayLoading] = useState(false);
    const [paymentLines, setPaymentLines] = useState([]); // {id, clientId, methodId, value}
    const [nextPayLineId, setNextPayLineId] = useState(1);
    const [payClients, setPayClients] = useState([]); // {id, nome}
    const valueRefs = useRef(new Map());
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    const parseBRL = (s) => { const d = String(s || '').replace(/\D/g, ''); return d ? Number(d) / 100 : 0; };
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
          const nextState = [...prev, { id: newId, clientId: pick, methodId: defMethod, value: '' }];
          
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
          let normalized = [];
          try {
            const vinc = await listarClientesDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const arr = Array.isArray(vinc) ? vinc : [];
            normalized = arr.map(r => {
              const id = r?.cliente_id ?? r?.clientes?.id ?? null;
              const nome = r?.clientes?.nome ?? r?.nome ?? r?.nome_livre ?? '';
              return id ? { id, nome } : null;
            }).filter(Boolean);
          } catch { normalized = []; }
          if (!active) return;
          setPayClients(normalized);
          // criar linha base
          let defMethod = (payMethods && payMethods[0] && payMethods[0].id) ? payMethods[0].id : null;
          let primaryId = (normalized[0]?.id) || null;
          let initialValue = '';
          // auto-preencher SEMPRE com o valor total (independente de quantos clientes)
          try {
            const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const total = (itens || []).reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0);
            if (total > 0) {
              initialValue = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);
            }
          } catch {}
          setPaymentLines([{ id: 1, clientId: primaryId, methodId: defMethod, value: initialValue }]);
          setNextPayLineId(2);
        } catch {}
      };
      boot();
      return () => { active = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPayOpen, selectedTable?.comandaId]);

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
        const totalSum = sumPayments();
        const diff = Math.abs(totalSum - effTotal);
        
        // Se a diferença for apenas centavos (até 0.05), ajustar automaticamente na última linha
        if (diff > 0.009 && diff <= 0.05) {
          const adjustment = effTotal - totalSum;
          setPaymentLines(prev => {
            const lastIdx = prev.length - 1;
            return prev.map((line, idx) => {
              if (idx === lastIdx) {
                const currentValue = parseBRL(line.value);
                const newValue = currentValue + adjustment;
                const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(newValue);
                return { ...line, value: formatted };
              }
              return line;
            });
          });
          // Não retornar - continuar com o pagamento após ajuste
        } else if (diff > 0.05) {
          // Diferença maior que 5 centavos - mostrar erro
          const remaining = effTotal - totalSum;
          if (remaining > 0) {
            toast({ title: 'Valor insuficiente', description: `Faltam R$ ${remaining.toFixed(2)} para fechar o total.`, variant: 'warning' });
          } else {
            toast({ title: 'Valor excedente', description: `Excedeu em R$ ${Math.abs(remaining).toFixed(2)}. Ajuste os valores.`, variant: 'warning' });
          }
          return;
        }
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
        for (const ln of paymentLines) {
          const v = parseBRL(ln.value);
          const fin = payMethods.find(m => String(m.id) === String(ln.methodId));
          const metodo = fin?.nome || fin?.tipo || 'outros';
          await registrarPagamento({ comandaId: selectedTable.comandaId, finalizadoraId: ln.methodId, metodo, valor: v, status: 'Pago', codigoEmpresa, clienteId: ln.clientId || null });
        }
        await fecharComandaEMesa({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
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
            return { id: mesa.id, name: mesa.nome || `Mesa ${mesa.numero}`, status: comanda ? 'in-use' : 'available', comandaId: comanda?.id || null, customer: comanda ? namesByComanda[comanda.id] : null, order: [], totalHint: 0 };
          });
          setTables(enrichedTables);
        } catch {}
        toast({ title: 'Pagamento registrado', description: `Total R$ ${refreshTotal.toFixed(2)}`, variant: 'success' });
        setIsPayOpen(false);
      } catch (e) {
        toast({ title: 'Falha ao registrar pagamento', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setPayLoading(false);
      }
    };

    const canConfirm = (paymentLines && paymentLines.length > 0) && !payLoading;

    return (
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="sm:max-w-xl w-[92vw] max-h-[85vh] animate-none flex flex-col overflow-hidden" onKeyDown={(e) => e.stopPropagation()} onKeyDownCapture={(e) => e.stopPropagation()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Fechar Conta</DialogTitle>
            <DialogDescription>Divida o pagamento entre clientes e várias finalizadoras, se necessário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Total</div>
              <div className="text-lg font-bold">R$ {total.toFixed(2)}</div>
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
                              const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
                              return { ...line, value: formatted };
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
                      <Select value={ln.methodId || ''} onValueChange={(v) => setPaymentLines(prev => prev.map(x => x.id === ln.id ? { ...x, methodId: v } : x))}>
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
                          const cents = digits ? Number(digits) / 100 : 0;
                          const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
                          setPaymentLines(prev => prev.map(x => x.id === ln.id ? { ...x, value: formatted } : x));
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
                  </div>
                );
              })}
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  setPaymentLines(prev => {
                    // PERMITIR selecionar o mesmo cliente múltiplas vezes
                    const pick = (payClients[0]?.id) || '';
                    const defMethod = (payMethods && payMethods[0] && payMethods[0].id) ? payMethods[0].id : null;
                    const newLines = [...prev, { id: nextPayLineId, clientId: pick, methodId: defMethod, value: '' }];
                    
                    // Distribuir valor total automaticamente entre todas as linhas
                    const totalValue = total > 0 ? total : 0;
                    const perLine = Math.floor((totalValue / newLines.length) * 100) / 100; // Arredondar para baixo
                    const remainder = totalValue - (perLine * newLines.length); // Calcular resto
                    
                    return newLines.map((line, idx) => {
                      // Adicionar o resto na última linha para fechar exato
                      const value = idx === newLines.length - 1 ? perLine + remainder : perLine;
                      const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
                      return { ...line, value: formatted };
                    });
                  });
                  setNextPayLineId(n => n + 1);
                }}>Adicionar forma</Button>
              </div>
              <div className="text-sm text-text-secondary flex justify-between"><span>Soma</span><span>R$ {sumPayments().toFixed(2)}</span></div>
              <div className="text-sm font-semibold flex justify-between"><span>Restante</span><span className={Math.abs(total - sumPayments()) < 0.005 ? 'text-success' : 'text-warning'}>R$ {(total - sumPayments()).toFixed(2)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)} disabled={payLoading}>Cancelar</Button>
            <Button type="button" onClick={confirmPay} disabled={!((paymentLines && paymentLines.length > 0) && !payLoading)}>{payLoading ? 'Processando...' : 'Confirmar Pagamento'}</Button>
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
          {/* Conteúdo resumido abaixo do header para evitar erros de marcação */}
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

  const OrderDetailsDialog = () => {
    const tbl = selectedTable;
    const items = tbl?.order || [];
    const total = tbl ? calculateTotal(items) : 0;
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
                    <div className="font-semibold">R$ {(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <div className="mr-auto text-sm font-semibold">Total: R$ {total.toFixed(2)}</div>
            <Button variant="secondary" onClick={() => setIsOrderDetailsOpen(false)}>Fechar</Button>
            <Button onClick={async () => { setIsOrderDetailsOpen(false); await openPayDialog(); }} disabled={!tbl || (items.length === 0)}>
              <DollarSign className="mr-2 h-4 w-4" /> Fechar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const OrderPanel = ({ table }) => {
    if (!table) return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Selecione uma mesa para ver a comanda</p>
        </div>
      </div>
    );
    
    if (loadingItems) return (
      <div className="flex flex-col h-full p-4 space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="mt-auto space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );

    const total = calculateTotal(table.order);
    const customerDisplay = formatClientDisplay(table.customer);
    const reloadItems = async () => {
      if (!table?.comandaId) return;
      const itens = await listarItensDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
      // refresh customer names to avoid disappearing labels
      let customerName = table.customer || null;
      try {
        const vinculos = await listarClientesDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
        const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
        customerName = nomes.length ? nomes.join(', ') : null;
      } catch {}
      const updated = { ...table, order, customer: customerName };
      setSelectedTable(updated);
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    };

    const changeQty = async (item, delta) => {
      try {
        const current = Number(item.quantity || 1);
        const next = current + delta;
        if (next <= 0) {
          await removerItem({ itemId: item.id, codigoEmpresa: userProfile?.codigo_empresa });
          await reloadItems();
          toast({ title: 'Item removido', description: item.name, variant: 'warning' });
          return;
        }
        await atualizarQuantidadeItem({ itemId: item.id, quantidade: next, codigoEmpresa: userProfile?.codigo_empresa });
        await reloadItems();
        toast({ title: 'Quantidade atualizada', description: `${item.name}: ${next}`, variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao atualizar quantidade', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    };

    const removeLine = async (item) => {
      try {
        await removerItem({ itemId: item.id, codigoEmpresa: userProfile?.codigo_empresa });
        await reloadItems();
        toast({ title: 'Item removido', description: item.name, variant: 'warning' });
      } catch (e) {
        toast({ title: 'Falha ao remover item', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    };
    return (
      <>
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            {customerDisplay ? (
              <div className="text-sm font-medium text-text-primary leading-none truncate" title={table.customer || ''}>{customerDisplay}</div>
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
                        <AlertDialogAction onClick={async () => {
                          try {
                            await cancelarComandaEMesa({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
                            setSelectedTable(null);
                            await refreshTablesLight({ showToast: true });
                            toast({ title: 'Comanda cancelada', variant: 'success' });
                          } catch (e) {
                            console.error('[Cancelar Comanda] Erro:', e);
                            toast({ title: 'Falha ao cancelar comanda', description: e?.message || 'Tente novamente', variant: 'destructive' });
                            try { await refreshTablesLight({ showToast: true }); } catch (refreshErr) { console.error('[Cancelar Comanda] Erro ao recarregar após falha:', refreshErr); }
                          }
                        }}>Confirmar Cancelamento</AlertDialogAction>
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
                        <span className="font-bold text-text-primary whitespace-nowrap">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded-full bg-surface text-text-secondary border border-border">x{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="text-danger/80 hover:text-danger h-7 w-7" onClick={() => removeLine(item)}><Trash2 size={14}/></Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-border mt-auto">
            <div className="flex justify-between items-center text-sm font-semibold text-text-secondary mb-2">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <Button size="lg" className="w-full" onClick={openPayDialog}><DollarSign className="mr-2" /> Fechar Conta</Button>
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
          className="sm:max-w-md w-[92vw] sm:w-[400px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
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
              placeholder="Ex.: Mesa 1, Pátio 1, VIP..."
              value={nomeVal}
              onChange={(e) => { setNomeVal(e.target.value); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.preventDefault(); }}
              onKeyUp={(e) => e.stopPropagation()}
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
      const price = Number(prod.salePrice ?? prod.price ?? 0);
      // Consolidar: se já existe item deste produto, incrementa quantidade
      let itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const same = (itens || []).find(it => it.produto_id === prod.id);
      if (same) {
        await atualizarQuantidadeItem({ itemId: same.id, quantidade: Number(same.quantidade || 0) + 1, codigoEmpresa: userProfile?.codigo_empresa });
      } else {
        await adicionarItem({
          comandaId: selectedTable.comandaId,
          produtoId: prod.id,
          descricao: prod.name,
          quantidade: 1,
          precoUnitario: price,
          codigoEmpresa: userProfile?.codigo_empresa,
        });
      }
      // Reload items
      itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, productId: it.produto_id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
      const updated = { ...selectedTable, order };
      setSelectedTable(updated);
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast({ title: 'Produto adicionado', description: prod.name, variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao adicionar produto', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const ProductsPanel = () => {
    const [productSearch, setProductSearch] = useState('');
    // Ordenar produtos por código (somente produtos reais do catálogo)
    const sortedProducts = (products || []).slice().sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      // Se ambos são números, comparar numericamente
      if (/^\d+$/.test(codeA) && /^\d+$/.test(codeB)) {
        return parseInt(codeA, 10) - parseInt(codeB, 10);
      }
      // Caso contrário, comparar alfabeticamente
      return codeA.localeCompare(codeB);
    });
    const filtered = sortedProducts.filter(p => {
      const q = productSearch.trim().toLowerCase();
      if (!q) return true;
      return (p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q);
    });
  
    return (
    <div className="flex flex-col h-full">
       <div className="p-4 border-b border-border">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
             <Input placeholder="Buscar produto..." className="pl-9" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </div>
       </div>
       <div className="flex-1 overflow-y-auto p-4 thin-scroll">
          <ul className="space-y-2">
              {filtered.length === 0 ? (
                <li className="text-center text-text-muted py-8">
                  <div className="mb-3">Nenhum produto encontrado.</div>
                  <Button size="sm" onClick={() => navigate('/produtos')}>Cadastrar Produtos</Button>
                </li>
              ) : filtered.map(prod => {
                  const q = qtyByProductId.get(prod.id) || 0;
                  const stock = Number(prod.stock ?? prod.currentStock ?? 0);
                  const remaining = Math.max(0, stock - q);
                  const handleOpenDetails = () => { setSelectedProduct(prod); setIsProductDetailsOpen(true); setMobileTableTab('products'); };
                  return (
                    <li
                      key={prod.id}
                      className="flex items-center gap-3 p-3 rounded-md border border-border bg-surface hover:bg-surface-2 transition-colors"
                      onClick={handleOpenDetails}
                    >
                      <div className="flex-1 min-w-0">
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
                      <Button size="icon" className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addProductToComanda(prod); }} aria-label={`Adicionar ${prod.name}`}>
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
    if (!counterComandaId) return;
    const price = Number(prod.salePrice ?? prod.price ?? 0);
    await adicionarItem({ comandaId: counterComandaId, produtoId: prod.id, descricao: prod.name, quantidade: 1, precoUnitario: price, codigoEmpresa: userProfile?.codigo_empresa });
    await counterReloadItems(counterComandaId);
    toast({ title: 'Produto adicionado', description: prod.name, variant: 'success' });
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
      const total = calculateTotal(counterItems);
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
          const cmd = await getOrCreateComandaBalcao({ codigoEmpresa: userProfile?.codigo_empresa });
          if (!active) return;
          setCounterComandaId(cmd.id);
          await counterReloadItems(cmd.id);
        } catch (e) {
          if (active) toast({ title: 'Falha ao abrir comanda de balcão', description: e?.message || 'Tente novamente', variant: 'destructive' });
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

    const total = calculateTotal(counterItems);
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
                <Input placeholder="Buscar produto..." className="pl-9" value={counterSearch} onChange={(e) => setCounterSearch(e.target.value)} />
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
            const remaining = Math.max(0, stock - qty);
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
                            try {
                              if (next <= 0) {
                                await removerItem({ itemId: it.id, codigoEmpresa: userProfile?.codigo_empresa });
                              } else {
                                await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa: userProfile?.codigo_empresa });
                              }
                              await counterReloadItems(counterComandaId);
                            } catch (e) { toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' }); }
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

    useEffect(() => {
      let active = true;
      const load = async () => {
        try {
          setLoadingClients(true);
          const rows = await listarClientes({ searchTerm: search, limit: 20 });
          if (!active) return;
          const sorted = (rows || []).slice().sort((a, b) => Number(a?.codigo || 0) - Number(b?.codigo || 0));
          setClients(sorted);
        } catch {
          if (!active) return;
          setClients([]);
        } finally {
          if (active) setLoadingClients(false);
        }
      };
      const t = setTimeout(load, 200);
      return () => { active = false; clearTimeout(t); };
    }, [search]);

    const confirmOpen = async () => {
      try {
        if (!pendingTable) return;
        // 1) abre (ou obtém) a comanda para a mesa
        const comanda = await getOrCreateComandaForMesa({ mesaId: pendingTable.id, codigoEmpresa: userProfile?.codigo_empresa });
        // 2) associar clientes cadastrados selecionados (sem cliente comum)
        const clienteIds = Array.from(new Set(selectedClientIds || []));
        const nomesLivres = [];
        
        // SEMPRE limpar clientes antigos da comanda, mesmo se não adicionar novos
        await adicionarClientesAComanda({ comandaId: comanda.id, clienteIds, nomesLivres, codigoEmpresa: userProfile?.codigo_empresa });
        
        // Pega nomes confirmados do backend APÓS limpar e adicionar novos
        let displayName = null;
        try {
          const vinculos = await listarClientesDaComanda({ comandaId: comanda.id, codigoEmpresa: userProfile?.codigo_empresa });
          const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
          displayName = nomes.length ? nomes.join(', ') : null;
        } catch {}
        if (!displayName) {
          displayName = clienteIds.length
            ? clienteIds.map(cid => clients.find(c => c.id === cid)?.nome).filter(Boolean).join(', ')
            : (nomesLivres[0] || '');
        }
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
          await Promise.all((openComandas || []).map(async (c) => {
            try {
              const vincs = await listarClientesDaComanda({ comandaId: c.id, codigoEmpresa: userProfile?.codigo_empresa });
              const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
              namesByComanda[c.id] = nomes.length ? nomes.join(', ') : null;
              
              // Calcular total da comanda
              const itens = await listarItensDaComanda({ comandaId: c.id, codigoEmpresa: userProfile?.codigo_empresa });
              const total = (itens || []).reduce((acc, item) => {
                const itemTotal = (item.quantidade || 0) * (item.preco_unitario || 0) - (item.desconto || 0);
                return acc + itemTotal;
              }, 0);
              totalsByComanda[c.id] = total;
              
            } catch { 
              namesByComanda[c.id] = null;
              totalsByComanda[c.id] = 0;
            }
          }));
          
          const enrichedTables = (mesas || []).map((mesa) => {
            const comanda = (openComandas || []).find((c) => c.mesa_id === mesa.id);
            return {
              id: mesa.id,
              name: mesa.nome || `Mesa ${mesa.numero}`,
              status: comanda ? 'in-use' : 'available',
              comandaId: comanda?.id || null,
              customer: comanda ? namesByComanda[comanda.id] : null,
              order: [],
              totalHint: comanda ? totalsByComanda[comanda.id] || 0 : 0,
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
        toast({ title: 'Mesa aberta', description: displayName ? `Comanda criada para: ${displayName}` : 'Comanda criada.', variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao abrir mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    };

    return (
      <Dialog open={isOpenTableDialog} onOpenChange={(open) => { setIsOpenTableDialog(open); if (!open) { setPendingTable(null); setClienteNome(''); setSelectedClientIds([]); } }}>
        <DialogContent
          className="w-[95vw] max-w-md max-h-[75vh] flex flex-col animate-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold">Abrir Mesa {pendingTable ? `#${pendingTable.number}` : ''}</DialogTitle>
            <DialogDescription className="text-sm">Selecione um ou mais clientes para a mesa.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Buscar cliente</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input 
                    placeholder="Nome, telefone ou código" 
                    className="pl-8 h-9 text-sm" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
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
            </div>
            
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
            
            <div className="border rounded-md max-h-56 overflow-auto thin-scroll">
              {loadingClients ? (
                <div className="p-3 text-center text-sm text-text-muted">Carregando...</div>
              ) : clients.length > 0 ? (
                <ul className="divide-y divide-border">
                  {clients.map(c => {
                    const active = selectedClientIds.includes(c.id);
                    return (
                      <li 
                        key={c.id} 
                        className={cn(
                          'p-2.5 flex items-center justify-between cursor-pointer transition-colors',
                          active ? 'bg-success/5 hover:bg-success/10' : 'hover:bg-surface-2'
                        )} 
                        onClick={() => {
                          setClienteNome('');
                          setSelectedClientIds(prev => 
                            prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          );
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {c.codigo != null ? `${c.codigo} - ` : ''}{c.nome}
                          </div>
                          {c.telefone && (
                            <div className="text-xs text-text-muted mt-0.5">{c.telefone}</div>
                          )}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {active ? (
                            <CheckCircle size={18} className="text-success" />
                          ) : (
                            <div className="w-[18px] h-[18px] rounded-full border-2 border-border" />
                          )}
                        </div>
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
              onClick={confirmOpen} 
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
    const [showMobileWarn, setShowMobileWarn] = useState(false);
    const [closing, setClosing] = useState(false);
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
            <AlertDialogAction onClick={async () => {
              try {
                if (closing) return;
                setClosing(true);
                // Pré-checagem: bloquear se houver comandas abertas
                try {
                  const abertas = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
                  if (Array.isArray(abertas) && abertas.length > 0) {
                    if (isMobileView) {
                      // Fechar diálogo e exibir banner (mobile) no próximo frame para não ficar atrás do overlay
                      setMobileWarnMsg(`Existem ${abertas.length} comandas abertas. Feche todas antes de encerrar o caixa.`);
                      try { setIsCloseCashOpen(false); } catch {}
                      if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => { setMobileWarnOpen(true); });
                      } else {
                        setMobileWarnOpen(true);
                      }
                      setTimeout(() => setMobileWarnOpen(false), 2600);
                    } else {
                      // Desktop: toast padrão e manter diálogo
                      toast({
                        title: 'Fechamento bloqueado',
                        description: `Existem ${abertas.length} comandas abertas. Feche todas antes de encerrar o caixa.`,
                        variant: 'warning',
                        duration: 2500,
                      });
                    }
                    return;
                  }
                } catch {}
                await fecharCaixa({ codigoEmpresa: userProfile?.codigo_empresa });
                // Considera fechado ao concluir a operação e atualiza UI imediatamente
                setIsCashierOpen(false);
                // Evita condições de corrida de portal/unmount no mobile: fecha no próximo frame e só então mostra toast
                if (typeof requestAnimationFrame === 'function') {
                  requestAnimationFrame(() => {
                    setIsCloseCashOpen(false);
                    toast({ title: 'Caixa fechado!', description: 'O relatório de fechamento foi gerado.' });
                  });
                } else {
                  setIsCloseCashOpen(false);
                  toast({ title: 'Caixa fechado!', description: 'O relatório de fechamento foi gerado.' });
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
                  try { setIsCloseCashOpen(false); } catch {}
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
    )
  };

  const ManageClientsDialog = () => {
    const [localSearch, setLocalSearch] = useState('');
    const [localClients, setLocalClients] = useState([]);
    const [localLinked, setLocalLinked] = useState([]);
    const [localLoading, setLocalLoading] = useState(false);
    const [pendingChanges, setPendingChanges] = useState(new Set());
    const initialLinkedRef = useRef([]);
    const loadedRef = useRef(false);

    useEffect(() => {
      let active = true;
      const load = async () => {
        if (!isManageClientsOpen || !selectedTable?.comandaId) return;
        try {
          setLocalLoading(true);
          // Carregar clientes vinculados à comanda
          const vincs = await listarClientesDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
          const clientIds = (vincs || []).map(v => v?.cliente_id ?? v?.clientes?.id).filter(Boolean);
          if (!active) return;
          setLocalLinked(clientIds);
          initialLinkedRef.current = clientIds;
          setPendingChanges(new Set());
          // Carregar lista de clientes disponíveis
          const rows = await listarClientes({ searchTerm: localSearch, limit: 50 });
          if (!active) return;
          const sorted = (rows || []).slice().sort((a, b) => Number(a?.codigo || 0) - Number(b?.codigo || 0));
          setLocalClients(sorted);
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
        return () => { active = false; };
      }
      
      // Debounce apenas para busca
      if (localSearch) {
        const timer = setTimeout(() => {
          load();
        }, 300);
        return () => { 
          active = false; 
          clearTimeout(timer);
        };
      } else if (!loadedRef.current) {
        load();
      }
      
      return () => { active = false; };
    }, [isManageClientsOpen, localSearch]);

    const toggleClient = (clientId) => {
      if (!selectedTable?.comandaId) return;
      
      // Atualizar UI imediatamente
      const isCurrentlyLinked = localLinked.includes(clientId);
      
      setLocalLinked(prev => {
        if (isCurrentlyLinked) {
          return prev.filter(id => id !== clientId);
        } else {
          return [...prev, clientId];
        }
      });
      
      // Marcar como mudança pendente
      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.add(clientId);
        return newSet;
      });
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

      try {
        setLocalLoading(true);
        
        // Determinar quais clientes adicionar e remover
        const toAdd = localLinked.filter(id => !initialLinkedRef.current.includes(id));
        const toRemove = initialLinkedRef.current.filter(id => !localLinked.includes(id));
        
        // Remover clientes
        for (const clientId of toRemove) {
          const { error } = await supabase
            .from('comanda_clientes')
            .delete()
            .eq('comanda_id', selectedTable.comandaId)
            .eq('cliente_id', clientId)
            .eq('codigo_empresa', userProfile?.codigo_empresa);
          
          if (error) {
            console.error('[confirmChanges] Erro ao remover:', error);
            throw error;
          }
        }
        
        // Adicionar clientes
        if (toAdd.length > 0) {
          console.log('[confirmChanges] Adicionando clientes:', toAdd);
          await adicionarClientesAComanda({
            comandaId: selectedTable.comandaId,
            clienteIds: toAdd,
            nomesLivres: [],
            codigoEmpresa: userProfile?.codigo_empresa
          });
        }
        
        console.log('[confirmChanges] Operações concluídas, atualizando mesa');
        
        // Atualizar mesa e aguardar
        await refetchSelectedTableDetails(selectedTable);
        
        // Atualizar também a lista de mesas
        await refreshTablesLight({ showToast: false });
        
        toast({ title: 'Clientes atualizados', variant: 'success' });
        setIsManageClientsOpen(false);
      } catch (e) {
        console.error('[confirmChanges] Erro:', e);
        toast({ title: 'Falha ao atualizar clientes', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setLocalLoading(false);
      }
    };

    return (
      <Dialog open={isManageClientsOpen} onOpenChange={setIsManageClientsOpen}>
        <DialogContent 
          className="sm:max-w-[480px] w-[92vw] animate-none" 
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()} 
          onKeyDownCapture={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} 
          onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Gerenciar Clientes da Mesa</DialogTitle>
            <DialogDescription>Clique nos clientes para adicionar ou remover. Pode ter múltiplos clientes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
              />
            </div>
            {localLinked.length > 0 && (
              <div className="bg-success/10 border border-success/30 rounded-md p-3">
                <div className="text-xs font-medium text-success mb-1">Clientes vinculados ({localLinked.length}):</div>
                <div className="text-sm text-text-primary">
                  {localClients
                    .filter(c => localLinked.includes(c.id))
                    .map(c => (c?.codigo ? `${c.codigo} - ${c?.nome || ''}` : (c?.nome || '')))
                    .join(', ') || 'Carregando...'}
                </div>
              </div>
            )}
            <div className="border rounded-md max-h-[400px] overflow-y-auto thin-scroll">
              {localLoading ? (
                <div className="p-4 text-center text-text-muted">Carregando...</div>
              ) : localClients.length === 0 ? (
                <div className="p-4 text-center text-text-muted">Nenhum cliente encontrado</div>
              ) : (
                <ul className="divide-y divide-border">
                  {localClients.map(client => {
                    const isLinked = localLinked.includes(client.id);
                    return (
                      <li
                        key={client.id}
                        className={cn(
                          "p-3 cursor-pointer transition-colors flex items-center justify-between",
                          isLinked ? "bg-success/5 hover:bg-success/10" : "hover:bg-surface-2"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleClient(client.id);
                        }}
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{`${client?.codigo ? `${client.codigo} - ` : ''}${client?.nome || ''}`}</div>
                          {client.telefone && (
                            <div className="text-xs text-text-muted">{client.telefone}</div>
                          )}
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          {isLinked ? (
                            <CheckCircle className="h-5 w-5 text-success" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-border" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageClientsOpen(false)} disabled={localLoading}>Cancelar</Button>
            <Button onClick={confirmChanges} disabled={localLoading}>
              {localLoading ? 'Salvando...' : `Confirmar ${pendingChanges.size > 0 ? `(${pendingChanges.size} alterações)` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
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
            const total = calculateTotal(table.order || []);
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
                      <h3 className="font-bold text-base truncate">
                        {table.name || `Mesa ${table.number}`}
                      </h3>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
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
      }}>
        <DialogContent 
          className="sm:max-w-2xl w-[90vw] max-h-[85vh] flex flex-col p-0 gap-0 animate-none"
          onKeyDown={(e) => e.stopPropagation()}
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

          {/* Tabs Comanda/Produtos */}
          <Tabs value={mobileTableTab} onValueChange={setMobileTableTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-2 m-2 rounded-lg">
              <TabsTrigger value="order" className="text-sm">Comanda</TabsTrigger>
              <TabsTrigger value="products" className="text-sm">Produtos</TabsTrigger>
            </TabsList>
            <TabsContent value="order" className="flex-1 overflow-hidden min-h-0 m-0">
              <OrderPanel table={selectedTable} />
            </TabsContent>
            <TabsContent value="products" className="flex-1 overflow-hidden min-h-0 m-0">
              <ProductsPanel />
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
        <div className="flex items-center justify-between mb-2 md:mb-6 gap-2 md:gap-4 flex-wrap">
          <div className="w-full md:w-auto flex items-center gap-2 md:gap-3">
            <Tabs value="mesas" className="w-full md:w-auto flex-1" onValueChange={(v) => {
              if (v === 'mesas') navigate('/vendas');
              if (v === 'balcao') navigate('/balcao');
              if (v === 'historico') navigate('/historico');
            }}>
              <TabsList className="!grid w-full grid-cols-3">
                <TabsTrigger value="mesas" className="text-xs sm:text-sm">Mesas</TabsTrigger>
                <TabsTrigger value="balcao" className="text-xs sm:text-sm">Balcão</TabsTrigger>
                <TabsTrigger value="historico" className="text-xs sm:text-sm">Histórico</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="w-full md:w-auto flex items-center gap-1.5 md:gap-3 md:ml-auto justify-end mt-1 md:mt-0">
            <OpenCashierDialog />
            <CloseCashierDialog />
            <Button variant="outline" size="sm" onClick={() => setIsCashierDetailsOpen(true)} className="px-3">
              <Banknote className="h-4 w-4" />
              <span className="ml-2 md:hidden">Detalhes</span>
              <span className="ml-2 hidden md:inline">Detalhes do Caixa</span>
            </Button>
            <div className="hidden md:block w-px h-6 bg-border mx-1"></div>
            <Button onClick={() => setIsCreateMesaOpen(true)} className="hidden md:flex" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Nova Mesa
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
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
            <div className="lg:col-span-2 bg-surface rounded-lg border border-border p-4 md:p-6 overflow-y-auto thin-scroll min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Mapa de Mesas</h2>
                {/* Mobile-only '+' button to create a new mesa */}
                <Button
                  type="button"
                  className="md:hidden h-9 w-9 p-0 bg-amber-400 text-black hover:bg-amber-300"
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
                             <div {...provided.droppableProps} ref={provided.innerRef} className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
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
            <div className="hidden md:flex bg-surface rounded-lg border border-border flex-col min-h-0">
                <Tabs defaultValue="order" className="flex flex-col h-full">
                    <TabsList className="grid w-full grid-cols-2 m-2">
                        <TabsTrigger value="order">Comanda</TabsTrigger>
                        <TabsTrigger value="products">Produtos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="order" className="flex-1 overflow-hidden min-h-0"><OrderPanel table={selectedTable} /></TabsContent>
                    <TabsContent value="products" className="flex-1 overflow-hidden min-h-0"><ProductsPanel/></TabsContent>
                </Tabs>
            </div>
        </div>

      </div>
      <MobileTableModal />
      <CounterModeModal />
      <CashierDetailsDialog open={isCashierDetailsOpen} onOpenChange={setIsCashierDetailsOpen} cashSummary={cashSummary} />
      <OrderDetailsDialog />
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
    </>
  );
}

export default VendasPage;
