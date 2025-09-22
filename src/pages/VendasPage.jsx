import React, { useState, useEffect, useMemo, useRef } from 'react';

import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { Plus, GripVertical, Search, CheckCircle, Clock, FileText, ShoppingBag, Trash2, DollarSign, X, Store, Lock, Unlock, Minus, Banknote, ArrowDownCircle, ArrowUpCircle, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { listMesas, ensureCaixaAberto, fecharCaixa, getOrCreateComandaForMesa, listarItensDaComanda, adicionarItem, atualizarQuantidadeItem, removerItem, listarFinalizadoras, registrarPagamento, fecharComandaEMesa, listarComandasAbertas, listarTotaisPorComanda, criarMesa, listarClientes, adicionarClientesAComanda, listarClientesDaComanda, getCaixaAberto, listarResumoSessaoCaixaAtual } from '@/lib/store';
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

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

function VendasPage() {
  const { toast } = useToast();
  const { userProfile, authReady } = useAuth();
  const navigate = useNavigate();

  const [tables, setTables] = useState([]);

  const [selectedTable, setSelectedTable] = useState(null);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isCounterModeOpen, setIsCounterModeOpen] = useState(false);
  const [counterOrder, setCounterOrder] = useState([]);
  const [isCashierDetailsOpen, setIsCashierDetailsOpen] = useState(false);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashSummary, setCashSummary] = useState(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
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
  const [selectedPayId, setSelectedPayId] = useState(null);
  const [payLoading, setPayLoading] = useState(false);

  // Evita movimentação do layout quando diálogos estão abertos (bloqueia scroll do fundo)
  useEffect(() => {
    const anyOpen = isCreateMesaOpen || isOpenTableDialog || isOrderDetailsOpen || isCashierDetailsOpen || isPayOpen;
    const original = document.body.style.overflow;
    if (anyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original || '';
    }
    return () => {
      document.body.style.overflow = original || '';
    };
  }, [isCreateMesaOpen, isOpenTableDialog, isOrderDetailsOpen, isCashierDetailsOpen, isPayOpen]);

  // Carregar resumo do caixa quando abrir o diálogo
  useEffect(() => {
    const codigoEmpresa = userProfile?.codigo_empresa || null;
    const loadSummary = async () => {
      try {
        if (!isCashierDetailsOpen) return;
        if (!codigoEmpresa) return;
        setCashLoading(true);
        const summary = await listarResumoSessaoCaixaAtual({ codigoEmpresa }).catch(() => null);
        setCashSummary(summary);
      } catch {
        setCashSummary(null);
      } finally {
        setCashLoading(false);
      }
    };
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCashierDetailsOpen, userProfile?.codigo_empresa]);

  const mapStatus = (s) => {
    if (s === 'in_use') return 'in-use';
    if (s === 'awaiting_payment') return 'awaiting-payment';
    return 'available';
  };
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const lastTablesLoadTsRef = useRef(0);
  const lastTablesSizeRef = useRef(0);

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
        try { console.group(trace); } catch {}
        try { console.log('start', { codigoEmpresa }); } catch {}
        const slowFallback = setTimeout(() => {
          if (!mountedRef.current) return;
          try { console.warn(trace + ' still waiting... (showing cached tables if any)'); } catch {}
          hydrateFromCache();
        }, 2000);
        const mesas = await listMesas(codigoEmpresa);
        let openComandas = [];
        try { 
          openComandas = await listarComandasAbertas({ codigoEmpresa }); 
          console.log(`[VendasPage:load] Comandas abertas carregadas:`, openComandas);
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
        const uiTables = (mesas || []).map((m) => {
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
        if (!mountedRef.current) return;
        // Usar dados frescos do banco sem mesclar com estado anterior
        setTables(uiTables);
        try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(uiTables)); } catch {}
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
          setSelectedTable((prev) => {
            const found = prev ? uiTables.find(t => t.id === prev.id) : null;
            return found || (uiTables[0] || null);
          });
        } else {
          setSelectedTable(nextSelected);
        }
        // Detectar sessão de caixa já aberta (não cria se não existir)
        try {
          const sessao = await getCaixaAberto({ codigoEmpresa });
          setIsCashierOpen(!!sessao);
        } catch { setIsCashierOpen(false); }
        try {
          const prods = await listProducts({ includeInactive: false });
          setProducts(prods);
        } catch (e) { console.warn('Falha ao carregar produtos:', e?.message || e); }
        try { console.log('ok', { tables: uiTables.length, openComandas: (openComandas || []).length }); } catch {}
        try { console.groupEnd(); } catch {}
      } catch (e) {
        console.error('Erro ao carregar mesas:', e);
      }
    };

    // hydrate cache first (fast show)
    hydrateFromCache();
    if (authReady && codigoEmpresa) load();
    return () => {};
  }, [authReady, userProfile?.codigo_empresa]);

  // Recarregar lista de mesas ao focar/ficar visível quando estagnado
  useEffect(() => {
    const codigoEmpresa = userProfile?.codigo_empresa || null;
    const reloadIfStale = () => {
      if (!authReady || !codigoEmpresa) return;
      const elapsed = Date.now() - (lastTablesLoadTsRef.current || 0);
      if (elapsed > 30000 || lastTablesSizeRef.current === 0) {
        // Rehydrate cache immediately to avoid empty perception
        try {
          const cacheKey = `vendas:tables:${codigoEmpresa}`;
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          if (Array.isArray(cached) && cached.length > 0) setTables(cached);
        } catch {}
        // Trigger fresh load
        // replicate inner load from effect by calling list functions inline to avoid closure issues
        (async () => {
          try {
            const mesas = await listMesas(codigoEmpresa);
            let openComandas = [];
            try { openComandas = await listarComandasAbertas({ codigoEmpresa }); } catch {}
            const totals = await (async () => { try { return await listarTotaisPorComanda((openComandas || []).map(c => c.id), codigoEmpresa); } catch { return {}; } })();
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
            const uiTables = (mesas || []).map((m) => {
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
            setTables(uiTables);
            try { localStorage.setItem(`vendas:tables:${codigoEmpresa}`, JSON.stringify(uiTables)); } catch {}
            lastTablesSizeRef.current = Array.isArray(uiTables) ? uiTables.length : 0;
            lastTablesLoadTsRef.current = Date.now();
          } catch {}
        })();
      }
    };
    const onFocus = () => reloadIfStale();
    const onVis = () => { if (document.visibilityState === 'visible') reloadIfStale(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userProfile?.codigo_empresa]);

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
  useEffect(() => {
    const onFocus = () => { if (selectedTable?.comandaId) refetchSelectedTableDetails(selectedTable); };
    const onVisibility = () => { if (document.visibilityState === 'visible' && selectedTable?.comandaId) refetchSelectedTableDetails(selectedTable); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable?.comandaId]);

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! ",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! ",
    });
  };

  const openPayDialog = async () => {
    try {
      if (!selectedTable?.comandaId) {
        toast({ title: 'Selecione uma mesa com comanda aberta', variant: 'warning' });
        return;
      }
      setPayLoading(true);
      // garante sessão de caixa aberta
      await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
      const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa: userProfile?.codigo_empresa });
      setPayMethods(fins);
      setSelectedPayId(fins?.[0]?.id || null);
      setIsPayOpen(true);
    } catch (e) {
      toast({ title: 'Falha ao carregar finalizadoras', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setPayLoading(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(tables);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTables(items);
    toast({ title: "Layout das mesas atualizado!", description: "As posições foram salvas temporariamente." });
  };

  const calculateTotal = (order) => order.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Utilitário: recarrega os detalhes (itens e clientes) da 'selectedTable'
  const refetchSelectedTableDetails = async (target) => {
    try {
      if (!target?.comandaId) return;
      const itens = await listarItensDaComanda({ comandaId: target.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
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

  // Recarrega rapidamente o status das mesas (sem todos os detalhes), para refletir fechamento/liberação
  const refreshTablesLight = async () => {
    try {
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) {
        console.warn('[refreshTablesLight] Código da empresa não disponível');
        return;
      }
      
      console.log('[refreshTablesLight] Iniciando atualização das mesas...');
      
      const mesas = await listMesas(codigoEmpresa);
      console.log('[refreshTablesLight] Mesas carregadas:', mesas?.length || 0);
      
      let openComandas = [];
      try { 
        openComandas = await listarComandasAbertas({ codigoEmpresa }); 
        console.log('[refreshTablesLight] Comandas abertas:', openComandas?.length || 0);
      } catch (err) {
        console.error('[refreshTablesLight] Erro ao carregar comandas:', err);
      }
      
      const byMesa = new Map();
      (openComandas || []).forEach(c => byMesa.set(c.mesa_id, c));
      
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
            console.log(`[refreshTablesLight] Comanda ${comandaId}: ${itens?.length || 0} itens, total: R$ ${total.toFixed(2)}`);
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
      
      const uiTables = (mesas || []).map((m) => {
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
      
      setTables(uiTables);
      console.log('[refreshTablesLight] Mesas atualizadas com sucesso:', uiTables.length);
      
    } catch (err) {
      console.error('[refreshTablesLight] Erro fatal:', err);
      toast({ 
        title: 'Erro ao atualizar mesas', 
        description: 'Recarregue a página se o problema persistir', 
        variant: 'destructive' 
      });
    }
  };

  const handleSelectTable = async (table) => {
    if (isSelectingTable) return;
    setIsSelectingTable(true);
    try {
      const previous = selectedTable;
      setLoading(true);
      if (table.comandaId) {
        // VERIFICAR se a comanda ainda está ativa antes de carregar dados
        console.log(`[handleSelectTable] Verificando status da comanda ${table.comandaId}`);
        
        try {
          const { data: comandaAtual, error } = await supabase
            .from('comandas')
            .select('id, status, fechado_em')
            .eq('id', table.comandaId)
            .eq('codigo_empresa', userProfile?.codigo_empresa)
            .single();
            
          if (error || !comandaAtual) {
            console.log(`[handleSelectTable] Comanda ${table.comandaId} não encontrada, criando nova`);
            setPendingTable(table);
            setIsOpenTableDialog(true);
            return;
          }
          
          if (comandaAtual.fechado_em || comandaAtual.status === 'closed') {
            console.log(`[handleSelectTable] Comanda ${table.comandaId} está fechada, criando nova`);
            setPendingTable(table);
            setIsOpenTableDialog(true);
            return;
          }
          
          // Só carregar dados se comanda estiver realmente ativa
          console.log(`[handleSelectTable] Comanda ${table.comandaId} ativa, carregando dados`);
          const itens = await listarItensDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
          const order = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
          
          let customer = null;
          try {
            const vinculos = await listarClientesDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
            const nomes = (vinculos || []).map(v => v?.nome).filter(Boolean);
            customer = nomes.length ? nomes.join(', ') : null;
            console.log(`[handleSelectTable] Clientes da comanda ativa ${table.comandaId}:`, nomes);
          } catch (err) {
            console.error(`[handleSelectTable] Erro ao carregar clientes:`, err);
          }
          
          const enriched = { ...table, status: 'in-use', order, customer };
          setSelectedTable(enriched);
          setTables((prev) => prev.map((t) => (t.id === table.id ? enriched : t)));
          
        } catch (err) {
          console.error(`[handleSelectTable] Erro ao verificar comanda:`, err);
          setPendingTable(table);
          setIsOpenTableDialog(true);
        }
      } else {
        // não abrir automaticamente; solicitar abertura
        setPendingTable(table);
        setIsOpenTableDialog(true);
      }
    } catch (e) {
      toast({ title: 'Falha ao carregar comanda da mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      // restaura seleção anterior em caso de erro
      setSelectedTable((prev) => prev || previous || null);
    } finally {
      setLoading(false);
      setIsSelectingTable(false);
    }
  };

  const TableCard = ({ table, provided, isDragging }) => {
    const config = statusConfig[table.status];
    const Icon = config.icon;
    const total = calculateTotal(table.order);

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
          "p-4 rounded-lg border bg-surface flex flex-col cursor-pointer transition-colors duration-150 relative h-44 shadow-sm min-w-[240px]",
          isDragging && 'shadow-md',
          selectedTable?.id === table.id && 'ring-2 ring-brand/60 bg-surface-2'
        )}
        onClick={() => handleSelectTable(table)}
      >
        <div {...provided.dragHandleProps} className="absolute top-2 right-2 text-text-muted opacity-60 hover:opacity-100">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-5 h-5 text-text-secondary" />
          <span className="text-lg font-semibold text-text-primary truncate">{table.name ? table.name : `Mesa ${table.number}`}</span>
        </div>
        <div className="mb-2">
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", badgeClass)}>
            {config.label}
          </span>
        </div>
        {(table.status === 'in-use' || table.status === 'awaiting-payment') ? (
          <div className="w-full mt-auto">
            <div className="text-sm sm:text-base font-medium text-text-primary truncate" title={table.customer || ''}>{table.customer || '—'}</div>
            <div className="text-sm font-bold text-text-secondary">R$ {displayTotal.toFixed(2)}</div>
          </div>
        ) : (
          <div className="w-full mt-auto">
            <div className="text-xs text-text-muted">Sem comanda</div>
          </div>
        )}
      </div>
    )
  };

  // Define PayDialog before OrderPanel to avoid reference errors
  const PayDialog = () => {
    const total = selectedTable ? calculateTotal(selectedTable.order) : 0;
    const confirmPay = async () => {
      try {
        if (!selectedTable?.comandaId) return;
        if (!selectedPayId) {
          toast({ title: 'Selecione uma finalizadora', variant: 'warning' });
          return;
        }
        setPayLoading(true);
        // registra pagamento do total
        const fin = payMethods.find((m) => m.id === selectedPayId);
        const metodo = fin?.tipo || fin?.nome || 'outros';
        await registrarPagamento({ comandaId: selectedTable.comandaId, finalizadoraId: selectedPayId, metodo, valor: total, codigoEmpresa: userProfile?.codigo_empresa });
        // fecha comanda e libera mesa
        await fecharComandaEMesa({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
        // atualizar UI: mesa disponível, limpa comanda
        setTables((prev) => prev.map((t) => (t.id === selectedTable.id ? { ...t, status: 'available', order: [], comandaId: null, customer: null, totalHint: 0 } : t)));
        setSelectedTable((prev) => prev ? { ...prev, status: 'available', order: [], comandaId: null, customer: null, totalHint: 0 } : prev);
        
        // FORÇAR RECARREGAMENTO COMPLETO das mesas para evitar bugs
        console.log('[VendasPage] Forçando recarregamento completo após finalizar comanda');
        try { 
          if (userProfile?.codigo_empresa) {
            localStorage.removeItem(`vendas:tables:${userProfile.codigo_empresa}`);
          }
        } catch {}
        
        // Recarregar mesas do servidor
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
            return {
              id: mesa.id,
              name: mesa.nome || `Mesa ${mesa.numero}`,
              status: comanda ? 'in-use' : 'available',
              comandaId: comanda?.id || null,
              customer: comanda ? namesByComanda[comanda.id] : null,
              order: [],
              totalHint: 0,
            };
          });
          
          setTables(enrichedTables);
          console.log('[VendasPage] Mesas recarregadas com sucesso:', enrichedTables.length);
        } catch (err) {
          console.error('[VendasPage] Erro ao recarregar mesas:', err);
        }
        toast({ title: 'Pagamento registrado', description: `Total R$ ${total.toFixed(2)}`, variant: 'success' });
        setIsPayOpen(false);
      } catch (e) {
        toast({ title: 'Falha ao registrar pagamento', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setPayLoading(false);
      }
    };
    return (
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Fechar Conta</DialogTitle>
            <DialogDescription>Selecione a finalizadora e confirme o pagamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <div>
              <Label className="mb-2 block">Finalizadora</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {payMethods.map((m) => (
                  <Button key={m.id} type="button" variant={selectedPayId === m.id ? 'default' : 'outline'} onClick={() => setSelectedPayId(m.id)} className="justify-start">
                    {m.nome}
                  </Button>
                ))}
                {(!payMethods || payMethods.length === 0) && (
                  <div className="text-sm text-text-muted">Nenhuma finalizadora ativa. Cadastre em Cadastros &gt; Finalizadoras.</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={payLoading}>Cancelar</Button>
            <Button onClick={confirmPay} disabled={payLoading || !selectedPayId || total <= 0}>{payLoading ? 'Processando...' : 'Confirmar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const CashierDetailsDialog = () => {
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    const saldoInicial = cashSummary?.saldo_inicial ?? 0;
    const entradas = cashSummary?.totalEntradas ?? cashSummary?.entradas ?? 0;
    const saidas = cashSummary?.totalSaidas ?? cashSummary?.saidas ?? 0;
    return (
      <Dialog open={isCashierDetailsOpen} onOpenChange={setIsCashierDetailsOpen}>
        <DialogContent className="max-w-md" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Detalhes do Caixa</DialogTitle>
            <DialogDescription>
              {cashLoading ? 'Carregando resumo...' : (cashSummary ? 'Resumo da sessão atual do caixa.' : 'Nenhuma sessão de caixa aberta.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <p className="text-xs text-text-secondary">Saldo Inicial</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(saldoInicial)}</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <p className="text-xs text-text-secondary">Entradas</p>
              <p className="text-2xl font-bold text-success tabular-nums">{fmt(entradas)}</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <p className="text-xs text-text-secondary">Saídas</p>
              <p className="text-2xl font-bold text-danger tabular-nums">{fmt(saidas)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsCashierDetailsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const OrderDetailsDialog = () => {
    const tbl = selectedTable;
    const items = tbl?.order || [];
    const total = tbl ? calculateTotal(items) : 0;
    return (
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent className="max-w-xl" onKeyDown={(e) => e.stopPropagation()} onKeyDownCapture={(e) => e.stopPropagation()}>
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
            <Button onClick={() => { setIsOrderDetailsOpen(false); setIsPayOpen(true); }} disabled={!tbl || (items.length === 0)}>
              <DollarSign className="mr-2 h-4 w-4" /> Fechar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const OrderPanel = ({ table }) => {
    if (!table) return (
      <div className="flex flex-col items-center justify-center h-full text-center text-text-muted">
        <ShoppingBag size={48} className="mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Nenhuma mesa selecionada</h3>
        <p>Clique em uma mesa para ver os detalhes da comanda.</p>
      </div>
    );

    const total = calculateTotal(table.order);
    const reloadItems = async () => {
      if (!table?.comandaId) return;
      const itens = await listarItensDaComanda({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
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
        toast({ title: 'Quantidade atualizada', description: `${item.name}: ${next}`, variant: 'info' });
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
            <div className="text-sm font-medium text-text-primary leading-none truncate">{table.customer || '—'}</div>
            <div className="flex items-center gap-2">
              {table.comandaId ? (
                <>
                  <Button size="sm" variant="secondary" className="h-7 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap" onClick={() => setIsOrderDetailsOpen(true)}>
                    <FileText size={12} className="mr-1.5" /> Comanda
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap" onClick={async () => {
                    try {
                      console.log('[Liberar Mesa] Iniciando liberação da mesa:', table.number);
                      
                      // Fechar comanda e mesa
                      await fecharComandaEMesa({ comandaId: table.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
                      console.log('[Liberar Mesa] Comanda fechada com sucesso');
                      
                      // Atualizar estado local imediatamente
                      setSelectedTable(null);
                      
                      // Recarregar mesas
                      await refreshTablesLight();
                      console.log('[Liberar Mesa] Mesas atualizadas');
                      
                      toast({ title: 'Mesa liberada', variant: 'success' });
                    } catch (e) {
                      console.error('[Liberar Mesa] Erro:', e);
                      toast({ 
                        title: 'Falha ao liberar mesa', 
                        description: e?.message || 'Tente novamente', 
                        variant: 'destructive' 
                      });
                      
                      // Em caso de erro, tentar recarregar as mesas para sincronizar
                      try {
                        await refreshTablesLight();
                      } catch (refreshErr) {
                        console.error('[Liberar Mesa] Erro ao recarregar após falha:', refreshErr);
                      }
                    }
                  }}>
                    <X size={12} className="mr-1.5" /> Liberar
                  </Button>
                </>
              ) : (
                <Button size="sm" className="h-7 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap" onClick={() => { setPendingTable(table); setIsOpenTableDialog(true); }}>Abrir Mesa</Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 thin-scroll">
            {table.order.length === 0 ? (
              <div className="text-center text-text-muted pt-16">
                <p>Comanda vazia. Adicione produtos na aba ao lado.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {table.order.map(item => (
                  <li key={item.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                      <p className="text-xs text-text-muted">{item.quantity} x R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeQty(item, -1)}><Minus size={14} /></Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeQty(item, +1)}><Plus size={14} /></Button>
                    </div>
                    <p className="font-bold text-text-primary w-24 text-right">R$ {(item.price * item.quantity).toFixed(2)}</p>
                    <Button variant="ghost" size="icon" className="ml-1 text-danger/80 hover:text-danger h-8 w-8" onClick={() => removeLine(item)}><Trash2 size={16}/></Button>
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
        setSelectedTable(newTable);
        toast({ title: 'Mesa criada', description: `Mesa ${mesa.numero} adicionada`, variant: 'success' });
        setIsCreateMesaOpen(false);
        setNumeroVal('');
        setNomeVal('');
      } catch (e) {
        toast({ title: 'Falha ao criar mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    return (
      <Dialog open={isCreateMesaOpen} onOpenChange={(open) => { setIsCreateMesaOpen(open); if (!open) { setNumeroVal(''); setNomeVal(''); } }}>
        <DialogContent className="max-w-md w-[400px]" onKeyDown={(e) => e.stopPropagation()} onKeyDownCapture={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Nova Mesa</DialogTitle>
            <DialogDescription>Crie uma nova mesa informando, opcionalmente, o número desejado. Em branco cria a próxima sequência.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="nova-mesa-numero">Número da mesa (opcional)</Label>
            <Input
              id="nova-mesa-numero"
              type="text"
              inputMode="numeric"
              placeholder="Ex.: 12"
              value={numeroVal}
              onChange={(e) => setNumeroVal(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.preventDefault(); }}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              autoFocus
            />
            <Label htmlFor="nova-mesa-nome">Nome da mesa (opcional)</Label>
            <Input
              id="nova-mesa-nome"
              type="text"
              placeholder="Ex.: Pátio 1"
              value={nomeVal}
              onChange={(e) => setNomeVal(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.preventDefault(); }}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
            />
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
      if (!selectedTable?.comandaId) {
        toast({ title: 'Selecione uma mesa', description: 'Abra a comanda clicando na mesa primeiro.', variant: 'destructive' });
        return;
      }
      const price = Number(prod.salePrice ?? prod.price ?? 0);
      await adicionarItem({
        comandaId: selectedTable.comandaId,
        produtoId: prod.id,
        descricao: prod.name,
        quantidade: 1,
        precoUnitario: price,
        codigoEmpresa: userProfile?.codigo_empresa,
      });
      // Reload items
      const itens = await listarItensDaComanda({ comandaId: selectedTable.comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      const order = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
      const updated = { ...selectedTable, order };
      setSelectedTable(updated);
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast({ title: 'Produto adicionado', description: prod.name, variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao adicionar produto', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const ProductsPanel = () => (
    <div className="flex flex-col h-full">
       <div className="p-4 border-b border-border">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input placeholder="Buscar produto..." className="pl-9" />
           </div>
       </div>
       <div className="flex-1 overflow-y-auto p-4 thin-scroll">
          <ul className="space-y-2">
              {(products.length ? products : productsData).map(prod => (
                  <li key={prod.id} className="flex items-center p-2 rounded-md hover:bg-surface-2 transition-colors">
                      <div className="flex-1">
                          <p className="font-semibold">{prod.name}</p>
                          <p className="text-sm text-text-muted">R$ {(Number(prod.salePrice ?? prod.price ?? 0)).toFixed(2)}</p>
                      </div>
                      <Button size="sm" onClick={() => addProductToComanda(prod)}><Plus size={16} className="mr-1"/> Adicionar</Button>
                  </li>
              ))}
          </ul>
       </div>
    </div>
  );

  // Estado e lógica do Modo Balcão (comanda sem mesa)
  const [counterComandaId, setCounterComandaId] = useState(null);
  const [counterItems, setCounterItems] = useState([]);
  const [counterLoading, setCounterLoading] = useState(false);
  const [counterSearch, setCounterSearch] = useState('');
  const [showCounterClientPicker, setShowCounterClientPicker] = useState(false);
  const [counterClients, setCounterClients] = useState([]);
  const [counterClientsLoading, setCounterClientsLoading] = useState(false);
  const [counterSelectedClientId, setCounterSelectedClientId] = useState(null);

  const counterReloadItems = async (comandaId) => {
    if (!comandaId) return;
    const itens = await listarItensDaComanda({ comandaId, codigoEmpresa: userProfile?.codigo_empresa });
    const order = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
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
        <DialogContent className="max-w-4xl h-[90vh]">
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
                  {(products.length ? products : productsData).filter(p => {
                    const s = counterSearch.trim().toLowerCase();
                    if (!s) return true;
                    return (p.name?.toLowerCase()?.includes(s) || String(p.code||'').toLowerCase().includes(s));
                  }).map(prod => (
                    <li key={prod.id} className="flex items-center p-3 rounded-md bg-surface-2">
                      <div className="flex-1">
                        <p className="font-semibold">{prod.name}</p>
                        <p className="text-sm text-text-muted">R$ {(Number(prod.salePrice ?? prod.price ?? 0)).toFixed(2)}</p>
                      </div>
                      <Button size="sm" onClick={() => addProductToCounter(prod)} disabled={!counterComandaId || counterLoading}>
                        <Plus size={16} className="mr-1"/> Adicionar
                      </Button>
                    </li>
                  ))}
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
                <Button size="lg" className="w-full" onClick={payCounter} disabled={counterLoading || total <= 0}>
                  <DollarSign className="mr-2" /> Finalizar Pagamento
                </Button>
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
                            <div className="font-medium">{c.nome}</div>
                            <div className="text-xs text-text-muted">{c.email || '—'} {c.telefone ? `• ${c.telefone}` : ''}</div>
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

  const OpenTableDialog = () => {
    const [search, setSearch] = useState('');
    const [loadingClients, setLoadingClients] = useState(false);
    const [clients, setClients] = useState([]);
    const [mode, setMode] = useState('registered'); // 'registered' | 'common'
    const [selectedClientIds, setSelectedClientIds] = useState([]); // multi-seleção de cadastrados
    const [commonName, setCommonName] = useState(''); // nome do cliente comum

    useEffect(() => {
      let active = true;
      const load = async () => {
        try {
          setLoadingClients(true);
          const rows = await listarClientes({ searchTerm: search, limit: 20 });
          if (!active) return;
          setClients(rows);
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
        // 2) associa somente 1 cliente cadastrado OU 1 nome comum
        const clienteIds = mode === 'registered' ? Array.from(new Set(selectedClientIds || [])) : [];
        const nomesLivres = mode === 'common' && commonName?.trim() ? [commonName.trim()] : [];
        
        // SEMPRE limpar clientes antigos da comanda, mesmo se não adicionar novos
        await adicionarClientesAComanda({ comandaId: comanda.id, clienteIds, nomesLivres, codigoEmpresa: userProfile?.codigo_empresa });
        
        // Pega nomes confirmados do backend APÓS limpar e adicionar novos
        let displayName = null;
        try {
          const vincs = await listarClientesDaComanda({ comandaId: comanda.id, codigoEmpresa: userProfile?.codigo_empresa });
          const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
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
          
          console.log(`[confirmOpen] Após aguardar: ${openComandas.length} comandas abertas encontradas`);
          
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
          console.log('[confirmOpen] Estado das mesas atualizado após abertura');
        } catch (err) {
          console.error('[confirmOpen] Erro ao atualizar mesas:', err);
        }
        setIsOpenTableDialog(false);
        setPendingTable(null);
        setClienteNome('');
        setSelectedClientIds([]);
        setCommonName('');
        setMode('registered');
        toast({ title: 'Mesa aberta', description: displayName ? `Comanda criada para: ${displayName}` : 'Comanda criada.', variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao abrir mesa', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    };

    return (
      <Dialog open={isOpenTableDialog} onOpenChange={(open) => { setIsOpenTableDialog(open); if (!open) { setPendingTable(null); setClienteNome(''); setSelectedClientIds([]); setCommonName(''); setMode('registered'); } }}>
        <DialogContent className="max-w-xl w-[720px] max-h-[80vh] overflow-y-auto" onKeyDown={(e) => e.stopPropagation()} onKeyDownCapture={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Abrir Mesa {pendingTable ? `#${pendingTable.number}` : ''}</DialogTitle>
            <DialogDescription>Escolha uma das opções: cliente cadastrado OU cliente comum.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" variant={mode === 'registered' ? 'default' : 'outline'} onClick={() => { setMode('registered'); setCommonName(''); }}>Cliente cadastrado</Button>
              <Button type="button" variant={mode === 'common' ? 'default' : 'outline'} onClick={() => { setMode('common'); setSelectedClientIds([]); }}>Cliente comum</Button>
            </div>
            {mode === 'registered' && (
            <div>
              <Label className="mb-2 block">Buscar cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input placeholder="Nome, e-mail, telefone ou código" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="mt-2 max-h-44 overflow-auto border rounded-md thin-scroll">
                {loadingClients ? (
                  <div className="p-3 text-sm text-text-muted">Carregando clientes...</div>
                ) : (clients.length > 0 ? (
                  <ul>
                    {clients.map(c => {
                      const active = selectedClientIds.includes(c.id);
                      return (
                        <li key={c.id} className={cn('p-2 flex items-center justify-between cursor-pointer hover:bg-surface-2', active && 'bg-surface-2')} onClick={() => {
                          setClienteNome('');
                          setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                        }}>
                          <div>
                            <div className="font-medium">{c.nome}</div>
                            <div className="text-xs text-text-muted">{c.email || '—'} {c.telefone ? `• ${c.telefone}` : ''}</div>
                          </div>
                          {active && <CheckCircle size={16} className="text-success" />}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="p-3 text-sm text-text-muted">Nenhum cliente encontrado.</div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center">
                <span className="text-xs text-text-muted">Selecione um ou mais clientes cadastrados.</span>
                <Button type="button" variant="outline" size="sm" onClick={() => { window.location.href = '/clientes'; }}>Cadastrar cliente</Button>
              </div>
            </div>
            )}
            {mode === 'common' && (
            <div className="grid grid-cols-1 gap-2">
              <Label className="mb-1 block">Nome do cliente comum</Label>
              <Input placeholder="Ex.: João" value={commonName} onChange={(e) => setCommonName(e.target.value)} />
              <div className="text-xs text-text-muted">Você pode usar apenas um nome simples.</div>
            </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsOpenTableDialog(false); setPendingTable(null); setClienteNome(''); setSelectedClientIds([]); setCommonName(''); setMode('registered'); }}>Cancelar</Button>
            <Button onClick={confirmOpen} disabled={!pendingTable}>Confirmar Abertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const [openCashInitial, setOpenCashInitial] = useState('');
  const [openCashDialogOpen, setOpenCashDialogOpen] = useState(false);
  const OpenCashierDialog = () => (
    <AlertDialog open={openCashDialogOpen} onOpenChange={setOpenCashDialogOpen}>
      <AlertDialogTrigger asChild>
          <Button variant="success" disabled={isCashierOpen} onClick={() => setOpenCashDialogOpen(true)}>
              <Unlock className="mr-2 h-4 w-4"/> Abrir Caixa
          </Button>
      </AlertDialogTrigger>
      <AlertDialogContent 
        onKeyDown={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => e.stopPropagation()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Abrir Caixa</AlertDialogTitle>
          <AlertDialogDescription>Insira o valor inicial (suprimento) para abrir o caixa.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="initial-value">Valor Inicial</Label>
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
            <Input id="initial-value" type="number" placeholder="0,00" className="pl-9 font-semibold" value={openCashInitial} onChange={(e) => setOpenCashInitial(e.target.value)} />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpenCashDialogOpen(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            try {
              const v = Number(String(openCashInitial).replace(',', '.')) || 0;
              await ensureCaixaAberto({ saldoInicial: v });
              setIsCashierOpen(true);
              setOpenCashDialogOpen(false);
              setOpenCashInitial('');
              toast({ title: 'Caixa aberto com sucesso!', variant: 'success' });
            } catch (e) {
              toast({ title: 'Falha ao abrir caixa', description: e?.message || 'Tente novamente', variant: 'destructive' });
            }
          }}>Confirmar Abertura</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const CloseCashierDialog = () => {
    const [closingData, setClosingData] = useState({ loading: false, saldoInicial: 0, resumo: null });
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
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={!isCashierOpen} onClick={handlePrepareClose}>
            <Lock className="mr-2 h-4 w-4"/> Fechar Caixa
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Caixa</AlertDialogTitle>
            <AlertDialogDescription>Confira os valores e confirme o fechamento do caixa. Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                // Pré-checagem: bloquear se houver comandas abertas
                try {
                  const abertas = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
                  if (abertas && abertas.length > 0) {
                    toast({ title: 'Fechamento bloqueado', description: `Existem ${abertas.length} comandas abertas (inclui balcão). Finalize-as antes de fechar o caixa.`, variant: 'warning' });
                    return;
                  }
                } catch {}
                await fecharCaixa({ saldoFinal: 0, codigoEmpresa: userProfile?.codigo_empresa });
                setIsCashierOpen(false);
                toast({ title: 'Caixa fechado!', description: 'O relatório de fechamento foi gerado.' });
              } catch (e) {
                console.error(e);
                toast({ title: 'Falha ao fechar caixa', description: e?.message || 'Tente novamente', variant: 'destructive' });
              }
            }}>Confirmar Fechamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  };

  return (
    <>
      <Helmet>
        <title>Loja - Fluxo7 Arena</title>
        <meta name="description" content="Loja (PDV): controle de mesas, produtos e vendas." />
      </Helmet>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="h-full flex flex-col">
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Tabs value="mesas" onValueChange={(v) => {
              if (v === 'mesas') navigate('/vendas');
              if (v === 'balcao') navigate('/balcao');
              if (v === 'historico') navigate('/historico');
            }}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="mesas">Mesas</TabsTrigger>
                <TabsTrigger value="balcao">Balcão</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <OpenCashierDialog />
            <CloseCashierDialog />
            <Button variant="outline" onClick={() => setIsCashierDetailsOpen(true)}>
              <Banknote className="mr-2 h-4 w-4" /> Detalhes do Caixa
            </Button>
            <div className="w-px h-6 bg-border mx-1"></div>
            <Button onClick={() => setIsCreateMesaOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova Mesa</Button>
          </div>
        </motion.div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
            <motion.div variants={itemVariants} className="lg:col-span-2 bg-surface rounded-lg border border-border p-6 overflow-y-auto thin-scroll min-h-0">
              <h2 className="text-xl font-bold mb-4">Mapa de Mesas</h2>
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
            </motion.div>

            <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border flex flex-col min-h-0">
                <Tabs defaultValue="order" className="flex flex-col h-full">
                    <TabsList className="grid w-full grid-cols-2 m-2">
                        <TabsTrigger value="order">Comanda</TabsTrigger>
                        <TabsTrigger value="products">Produtos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="order" className="flex-1 overflow-hidden min-h-0"><OrderPanel table={selectedTable} /></TabsContent>
                    <TabsContent value="products" className="flex-1 overflow-hidden min-h-0"><ProductsPanel/></TabsContent>
                </Tabs>
            </motion.div>
        </div>
      </motion.div>
      <CounterModeModal />
      <CashierDetailsDialog />
      <OrderDetailsDialog />
      <OpenTableDialog />
      <CreateMesaDialog />
    </>
  );
}

export default VendasPage;