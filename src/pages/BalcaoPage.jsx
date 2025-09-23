import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Search, DollarSign, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateComandaBalcao, listarComandaBalcaoAberta, criarComandaBalcao, listarItensDaComanda, adicionarItem, listarFinalizadoras, registrarPagamento, fecharComandaEMesa, listarClientes, adicionarClientesAComanda, atualizarQuantidadeItem, removerItem, listarClientesDaComanda, verificarEstoqueComanda } from '@/lib/store';

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function BalcaoPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [comandaId, setComandaId] = useState(null);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [addingProductId, setAddingProductId] = useState(null);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Pagamento
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payMethods, setPayMethods] = useState([]);
  const [selectedPayId, setSelectedPayId] = useState(null);
  const [payLoading, setPayLoading] = useState(false);

  // Cliente
  const [clientMode, setClientMode] = useState('consumidor'); // 'cadastrado' | 'consumidor'
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [linking, setLinking] = useState(false);
  const [showClientBox, setShowClientBox] = useState(false); // desativado no novo fluxo
  const [isClientWizardOpen, setIsClientWizardOpen] = useState(false);
  const [clientChosen, setClientChosen] = useState(false);
  
  // Refs para robustez contra respostas antigas (stale)
  const itemsReqIdRef = useRef(0); // identifica a última requisição válida de itens
  const itemsRef = useRef([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Chaves de cache por empresa
  const companyCode = userProfile?.codigo_empresa || 'anon';
  const LS_KEY = {
    comandaId: `balcao:comandaId:${companyCode}`,
    items: `balcao:items:${companyCode}`,
    customerName: `balcao:customer:${companyCode}`,
    clientChosen: `balcao:clientChosen:${companyCode}`,
    pendingClientIds: `balcao:pendingClientIds:${companyCode}`,
  };

  // Utilitário: recarregar itens e cliente para a comanda atual com retry leve
  const refetchItemsAndCustomer = async (targetComandaId, attempts = 3) => {
    if (!targetComandaId) return;
    const codigoEmpresa = userProfile?.codigo_empresa;
    const reqId = ++itemsReqIdRef.current;
    for (let i = 0; i < attempts; i++) {
      try {
        const itens = await listarItensDaComanda({ comandaId: targetComandaId, codigoEmpresa });
        // Ignora respostas antigas
        if (reqId !== itemsReqIdRef.current) return;
        const normalized = (itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) }));
        // Evita sobrescrever com vazio se já temos itens na UI (consistência eventual)
        if (normalized.length === 0 && (itemsRef.current || []).length > 0) {
          // mantém o estado atual e continua para tentar carregar clientes
        } else {
          setItems(normalized);
        }
        try {
          const vincs = await listarClientesDaComanda({ comandaId: targetComandaId, codigoEmpresa });
          if (reqId !== itemsReqIdRef.current) return;
          const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
          const nomeFinal = nomes.length ? nomes.join(', ') : '';
          setCustomerName(nomeFinal);
          setClientChosen(Boolean(nomeFinal));
        } catch {
          setCustomerName('');
          setClientChosen(false);
        }
        break;
      } catch (err) {
        if (i === attempts - 1) {
          toast({ title: 'Falha ao atualizar itens', description: err?.message || 'Tente novamente', variant: 'destructive' });
        } else {
          // Backoff com jitter leve
          const base = 350 * (i + 1);
          const jitter = Math.floor(Math.random() * 120);
          await new Promise(r => setTimeout(r, base + jitter));
        }
      }
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      // Garantir codigo da empresa
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) {
        throw new Error('Código da empresa não disponível. Faça login novamente.');
      }

      // 1) Hidratar de cache, se existir (para exibirmos imediatamente)
      try {
        const cachedId = localStorage.getItem(LS_KEY.comandaId);
        const cachedItems = JSON.parse(localStorage.getItem(LS_KEY.items) || '[]');
        const cachedCustomer = localStorage.getItem(LS_KEY.customerName) || '';
        const cachedChosen = localStorage.getItem(LS_KEY.clientChosen);
        const cachedPendingIds = JSON.parse(localStorage.getItem(LS_KEY.pendingClientIds) || '[]');
        if (cachedId) setComandaId(Number.isNaN(+cachedId) ? cachedId : Number(cachedId));
        if (Array.isArray(cachedItems) && cachedItems.length > 0) setItems(cachedItems);
        if (cachedCustomer) setCustomerName(cachedCustomer);
        if (cachedChosen === 'true') setClientChosen(true);
        if (Array.isArray(cachedPendingIds) && cachedPendingIds.length > 0) setSelectedClientIds(cachedPendingIds);
      } catch { /* ignore cache errors */ }

      // 2) Obter comanda aberta existente (não cria automaticamente)
      // Se não encontrar, mas existir comandaId em cache, ainda tentamos refetch para evitar sumiço temporário
      const cachedIdStr = localStorage.getItem(LS_KEY.comandaId);
      const cachedId = cachedIdStr ? (Number.isNaN(+cachedIdStr) ? cachedIdStr : Number(cachedIdStr)) : null;
      const c = await listarComandaBalcaoAberta({ codigoEmpresa }).catch(() => null);
      if (c?.id) {
        setComandaId(c.id);
        await refetchItemsAndCustomer(c.id);
      } else if (cachedId) {
        // Tenta reaproveitar a comanda do cache (mitiga atrasos de RLS)
        setComandaId(cachedId);
        await refetchItemsAndCustomer(cachedId, 3);
      } else {
        setComandaId(null);
        setItems([]);
        // Hidratar possível seleção pendente (sem comanda)
        try {
          const cachedCustomer = localStorage.getItem(LS_KEY.customerName) || '';
          const cachedChosen = localStorage.getItem(LS_KEY.clientChosen) === 'true';
          const cachedPendingIds = JSON.parse(localStorage.getItem(LS_KEY.pendingClientIds) || '[]');
          setCustomerName(cachedCustomer || '');
          setClientChosen(Boolean(cachedChosen));
          setSelectedClientIds(Array.isArray(cachedPendingIds) ? cachedPendingIds : []);
        } catch {
          setCustomerName('');
          setClientChosen(false);
          setSelectedClientIds([]);
        }
        // Limpar cache se não há comanda aberta
        try {
          localStorage.removeItem(LS_KEY.comandaId);
          localStorage.removeItem(LS_KEY.items);
          // não apagar customerName/clientChosen/pendingClientIds aqui para preservar escolha pré-comanda
        } catch {}
      }
      // Carregar produtos (com busca inicial se houver)
      try {
        const prods = await listProducts({ includeInactive: false, search: productSearch?.trim() || undefined });
        setProducts(prods || []);
      } catch { setProducts([]); }
    } catch (e) {
      toast({ title: 'Falha ao carregar Modo Balcão', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Cancelar venda atual (fecha comanda sem registrar pagamentos) e abre nova
  const cancelSale = async () => {
    try {
      setCancelLoading(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (comandaId && codigoEmpresa) {
        try { await fecharComandaEMesa({ comandaId, codigoEmpresa }); } catch { /* ignora e segue limpando UI */ }
      }
    } finally {
      // Limpa UI e cache independentemente do resultado do backend
      setComandaId(null);
      setItems([]);
      setSelectedClientIds([]);
      setCustomerName('');
      setClientChosen(false);
      setPendingProduct(null);
      try {
        localStorage.removeItem(LS_KEY.comandaId);
        localStorage.removeItem(LS_KEY.items);
        localStorage.removeItem(LS_KEY.customerName);
      } catch {}
      setCancelLoading(false);
      toast({ title: 'Venda cancelada', variant: 'success' });
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userProfile?.codigo_empresa]);

  // Persistir em cache quando comandaId/itens/cliente mudarem
  useEffect(() => {
    try {
      if (comandaId) localStorage.setItem(LS_KEY.comandaId, String(comandaId));
      localStorage.setItem(LS_KEY.items, JSON.stringify(items || []));
      localStorage.setItem(LS_KEY.customerName, customerName || '');
      localStorage.setItem(LS_KEY.clientChosen, clientChosen ? 'true' : 'false');
      if (!comandaId) {
        // Antes da comanda, guardamos possíveis clientes pendentes
        localStorage.setItem(LS_KEY.pendingClientIds, JSON.stringify(selectedClientIds || []));
      } else {
        // Com comanda aberta, removemos pendências
        localStorage.removeItem(LS_KEY.pendingClientIds);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId, items, customerName, clientChosen, selectedClientIds]);

  // Recarregar itens quando janela ganha foco ou página volta a ficar visível
  useEffect(() => {
    const onFocus = () => { if (comandaId) refetchItemsAndCustomer(comandaId, 2); };
    const onVisibility = () => { if (document.visibilityState === 'visible' && comandaId) refetchItemsAndCustomer(comandaId, 2); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId]);

  // Busca de produtos com debounce
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const prods = await listProducts({ includeInactive: false, search: productSearch?.trim() || undefined });
        if (!active) return;
        // Fallback: se backend não filtrar por search, filtramos localmente
        if (productSearch?.trim()) {
          const term = productSearch.trim().toLowerCase();
          setProducts((prods || []).filter(p => (p.name || '').toLowerCase().includes(term)));
        } else {
          setProducts(prods || []);
        }
      } catch {
        if (active) setProducts([]);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [productSearch]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (clientMode !== 'cadastrado') { setClients([]); return; }
      try {
        const rows = await listarClientes({ searchTerm: clientSearch, limit: 20, codigoEmpresa: userProfile?.codigo_empresa });
        if (!active) return;
        setClients(rows || []);
      } catch { if (active) setClients([]); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [clientMode, clientSearch]);

  const total = useMemo(() => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0), [items]);

  const addProduct = async (prod, opts = {}) => {
    try {
      if (!clientChosen && !opts.skipClientCheck) {
        setPendingProduct(prod);
        setIsClientWizardOpen(true);
        toast({ title: 'Selecione o cliente', description: 'Escolha Cliente cadastrado ou Consumidor antes de vender.', variant: 'warning' });
        return;
      }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', description: 'Faça login novamente.', variant: 'destructive' }); return; }
      if (addingProductId) return;

      // Pré-validação no cliente para UX imediata (servidor também valida)
      const stock = Number(prod.stock ?? prod.currentStock ?? 0);
      const minStock = Number(prod.minStock ?? 0);
      if (stock <= 0) {
        toast({ title: 'Sem estoque', description: `Produto "${prod.name}" está com estoque zerado.`, variant: 'destructive' });
        return;
      }

      // Só aqui marcamos como "adicionando" para não travar em early-returns
      setAddingProductId(prod.id);

      // Criar comanda se não existir ainda (somente no primeiro item)
      let cid = comandaId;
      const createdNow = !cid;
      if (!cid) {
        try {
          const c = await getOrCreateComandaBalcao({ codigoEmpresa });
          cid = c.id;
          setComandaId(c.id);
        } catch (err) {
          if (err?.code === 'NO_OPEN_CASH_SESSION') {
            toast({ title: 'Abra o caixa para vender', description: 'Você precisa abrir o caixa antes de iniciar uma comanda no Balcão.', variant: 'warning' });
            return;
          }
          throw err;
        }
      }
      const price = Number(prod.salePrice ?? prod.price ?? 0);
      await adicionarItem({ comandaId: cid, produtoId: prod.id, descricao: prod.name, quantidade: 1, precoUnitario: price, codigoEmpresa });
      // Se havia clientes selecionados em memória e a comanda acabou de ser criada, associar agora
      try {
        const ids = Array.from(new Set(selectedClientIds || []));
        if (createdNow && ids.length > 0) {
          await adicionarClientesAComanda({ comandaId: cid, clienteIds: ids, nomesLivres: [], codigoEmpresa });
          // atualizar nome exibido
          const vincs = await listarClientesDaComanda({ comandaId: cid, codigoEmpresa });
          const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
          setCustomerName(nomes.length ? nomes.join(', ') : '');
          setClientChosen(true);
          // Limpar pendências de cliente após associar
          try {
            localStorage.removeItem(LS_KEY.pendingClientIds);
            localStorage.setItem(LS_KEY.customerName, (nomes.length ? nomes.join(', ') : ''));
            localStorage.setItem(LS_KEY.clientChosen, 'true');
          } catch {}
        }
      } catch {}
      const itens = await listarItensDaComanda({ comandaId: cid, codigoEmpresa });
      setItems((itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) })));
      // Avisos de estoque baixo/último
      if (stock - 1 <= 0) {
        toast({ title: 'Última unidade vendida', description: `"${prod.name}" esgotou após esta venda.`, variant: 'warning' });
      } else if (stock - 1 <= minStock) {
        toast({ title: 'Estoque baixo', description: `"${prod.name}" atingiu nível de estoque baixo.`, variant: 'warning' });
      } else {
        toast({ title: 'Produto adicionado', description: prod.name, variant: 'success' });
      }
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (e?.code === 'OUT_OF_STOCK' || msg.includes('sem estoque')) {
        toast({ title: 'Sem estoque', description: 'Este produto está sem estoque.', variant: 'destructive' });
      } else if (e?.code === 'INSUFFICIENT_STOCK' || msg.includes('insuficiente')) {
        toast({ title: 'Estoque insuficiente', description: e?.message || 'Quantidade maior que o disponível.', variant: 'warning' });
      } else {
        toast({ title: 'Falha ao adicionar', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    } finally {
      setAddingProductId(null);
    }
  };

  const openPay = async () => {
    try {
      setPayLoading(true);
      if (!clientChosen) { setIsClientWizardOpen(true); toast({ title: 'Selecione o cliente', description: 'Escolha Cliente cadastrado ou Consumidor antes de pagar.', variant: 'warning' }); setPayLoading(false); return; }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
      if (!comandaId) {
        try {
          const c = await getOrCreateComandaBalcao({ codigoEmpresa });
          if (!c?.id) { toast({ title: 'Comanda não encontrada', description: 'Abra uma comanda antes de pagar.', variant: 'destructive' }); setPayLoading(false); return; }
          setComandaId(c.id);
        } catch (err) {
          if (err?.code === 'NO_OPEN_CASH_SESSION') {
            toast({ title: 'Abra o caixa para pagar', description: 'É necessário abrir o caixa antes de iniciar/confirmar uma venda.', variant: 'warning' });
            setPayLoading(false);
            return;
          }
          throw err;
        }
      }
      // Validação forte de estoque antes do pagamento
      try {
        await verificarEstoqueComanda({ comandaId: comandaId, codigoEmpresa });
      } catch (err) {
        const msg = Array.isArray(err?.items) && err.items.length
          ? err.items.map(v => `${v.name} (solicitado ${v.solicitado}, estoque ${v.estoque})`).join('; ')
          : (err?.message || 'Estoque insuficiente na comanda');
        toast({ title: 'Estoque insuficiente', description: msg, variant: 'destructive', duration: 7000 });
        setPayLoading(false);
        return;
      }
      const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa });
      setPayMethods(fins || []);
      setIsPayOpen(true);
    } catch (e) {
      toast({ title: 'Falha ao iniciar pagamento', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setPayLoading(false);
    }
  };

  const confirmPay = async () => {
    try {
      if (!comandaId) { toast({ title: 'Nenhuma comanda aberta', description: 'Adicione itens para abrir uma comanda.', variant: 'warning' }); return; }
      if (!selectedPayId) { toast({ title: 'Selecione uma finalizadora', variant: 'warning' }); return; }
      setPayLoading(true);
      // Vincula automaticamente os clientes selecionados antes de pagar
      try {
        const ids = clientMode === 'cadastrado' ? Array.from(new Set(selectedClientIds || [])) : [];
        if (ids.length > 0) {
          await adicionarClientesAComanda({ comandaId, clienteIds: ids, nomesLivres: [], codigoEmpresa: userProfile?.codigo_empresa });
        }
      } catch (e) {
        // não bloqueia o pagamento se a associação falhar, mas informa
        toast({ title: 'Aviso', description: 'Cliente não pôde ser associado. Prosseguindo com pagamento.', variant: 'warning' });
      }
      const fin = payMethods.find(m => m.id === selectedPayId);
      const metodo = fin?.tipo || null; // enum esperado pelo banco
      await registrarPagamento({ comandaId, finalizadoraId: selectedPayId, metodo, valor: total, codigoEmpresa: userProfile?.codigo_empresa });
      await fecharComandaEMesa({ comandaId, codigoEmpresa: userProfile?.codigo_empresa });
      // Não abre nova comanda automaticamente; deixa para quando adicionar o próximo item
      setComandaId(null);
      setItems([]);
      setSelectedClientIds([]);
      setCustomerName('');
      setClientChosen(false);
      // Limpar cache para não reidratar cliente antigo ao voltar
      try {
        localStorage.removeItem(LS_KEY.comandaId);
        localStorage.removeItem(LS_KEY.items);
        localStorage.removeItem(LS_KEY.customerName);
      } catch {}
      toast({ title: 'Pagamento concluído', description: `Total R$ ${total.toFixed(2)}`, variant: 'success' });
      setIsPayOpen(false);
    } catch (e) {
      toast({ title: 'Falha ao concluir', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { setPayLoading(false); }
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="h-full flex flex-col">
      <Helmet>
        <title>Modo Balcão - Fluxo7 Arena</title>
        <meta name="description" content="Venda rápida no balcão." />
      </Helmet>

      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Tabs value="balcao" onValueChange={(v) => {
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
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-hidden">
        <div className="flex flex-col border rounded-lg border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input placeholder="Buscar produto..." className="pl-9" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 thin-scroll">
            <ul className="space-y-2">
              {(products || []).map(prod => (
                <li key={prod.id} className="flex items-center p-2 rounded-md hover:bg-surface-2 transition-colors">
                  <div className="flex-1">
                    <p className="font-semibold">{prod.name}</p>
                    <p className="text-sm text-text-muted">R$ {(Number(prod.salePrice ?? prod.price ?? 0)).toFixed(2)}</p>
                  </div>
                  <Button size="sm" onClick={() => addProduct(prod)}><DollarSign className="mr-2 h-4 w-4"/>Adicionar</Button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col border rounded-lg border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-sm text-text-secondary">Comanda</div>
              <div className="text-lg font-bold">Balcão{customerName ? ` • ${customerName}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              {clientChosen ? (
                <Button size="sm" variant="outline" onClick={() => setIsClientWizardOpen(true)}>+ Cliente</Button>
              ) : (
                <Button size="sm" onClick={() => setIsClientWizardOpen(true)}>+ Nova venda</Button>
              )}
              <Button size="sm" variant="outline" onClick={cancelSale} disabled={cancelLoading}>{cancelLoading ? 'Cancelando...' : 'Cancelar Venda'}</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 thin-scroll">
            {(!clientChosen) ? (
              <div className="text-center pt-12">
                <div className="text-sm text-text-secondary mb-3">Para começar, inicie uma nova venda e selecione o cliente.</div>
                <Button onClick={() => setIsClientWizardOpen(true)}>Iniciar nova venda</Button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center text-text-muted pt-16">Comanda vazia. Adicione produtos ao lado.</div>
            ) : (
              <ul className="space-y-2 pr-1">
                {items.map(it => (
                  <li key={it.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{it.name}</div>
                      <div className="text-xs text-text-muted">Unit: R$ {Number(it.price).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={async () => {
                        const codigoEmpresa = userProfile?.codigo_empresa;
                        if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
                        const next = Number(it.quantity || 1) - 1;
                        // Otimista: atualiza UI primeiro
                        setItems(prev => {
                          const arr = prev.map(n => n.id === it.id ? { ...n, quantity: Math.max(next, 0) } : n).filter(n => n.quantity > 0);
                          return arr;
                        });
                        try {
                          if (next <= 0) {
                            await removerItem({ itemId: it.id, codigoEmpresa });
                          } else {
                            await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa });
                          }
                        } catch (err) {
                          // Recarrega estado real se falhar
                          try {
                            const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
                            setItems((itens || []).map((n) => ({ id: n.id, name: n.descricao || 'Item', price: Number(n.preco_unitario || 0), quantity: Number(n.quantidade || 1) })));
                          } catch {}
                          const msg = String(err?.message || '').toLowerCase();
                          if (err?.code === 'INSUFFICIENT_STOCK' || msg.includes('insuficiente')) {
                            toast({ title: 'Estoque insuficiente', description: err?.message || 'Quantidade maior que o disponível.', variant: 'warning' });
                          } else {
                            toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
                          }
                        }
                      }}>-</Button>
                      <span className="w-8 text-center font-semibold">{it.quantity}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={async () => {
                        const codigoEmpresa = userProfile?.codigo_empresa;
                        if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
                        const next = Number(it.quantity || 1) + 1;
                        // Otimista: atualiza UI primeiro
                        setItems(prev => prev.map(n => n.id === it.id ? { ...n, quantity: next } : n));
                        try {
                          await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa });
                        } catch (err) {
                          // Recarrega estado real se falhar
                          try {
                            const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
                            setItems((itens || []).map((n) => ({ id: n.id, name: n.descricao || 'Item', price: Number(n.preco_unitario || 0), quantity: Number(n.quantidade || 1) })));
                          } catch {}
                          const msg = String(err?.message || '').toLowerCase();
                          if (err?.code === 'INSUFFICIENT_STOCK' || msg.includes('insuficiente')) {
                            toast({ title: 'Estoque insuficiente', description: err?.message || 'Quantidade maior que o disponível.', variant: 'warning' });
                          } else {
                            toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
                          }
                        }
                      }}>+</Button>
                    </div>
                    <div className="font-semibold w-24 text-right">R$ {(Number(it.quantity)*Number(it.price)).toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-border">
            <div className="flex justify-between items-center text-lg font-bold mb-3">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <Button size="lg" className="w-full" onClick={openPay} disabled={total <= 0}>Finalizar Pagamento</Button>
          </div>
        </div>
      </motion.div>

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-md" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Fechar Conta</DialogTitle>
            <DialogDescription>Selecione a finalizadora e confirme o pagamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <div>
              <Label className="mb-2 block">Finalizadora</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {payMethods.map(m => (
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

      {/* Wizard de Cliente: obrigatório antes de vender */}
      <Dialog open={isClientWizardOpen} onOpenChange={(open) => setIsClientWizardOpen(open)}>
        <DialogContent className="max-w-lg" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Identificar Cliente</DialogTitle>
            <DialogDescription>Selecione o tipo de cliente para esta venda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setClientMode('cadastrado')}>Cliente cadastrado</Button>
              <Button type="button" variant="outline" onClick={() => setClientMode('consumidor')}>Consumidor</Button>
            </div>
            {clientMode === 'cadastrado' ? (
              <div>
                <Label className="mb-1 block">Buscar cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input placeholder="Nome, e-mail, telefone ou código" className="pl-9" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                </div>
                <div className="mt-2 max-h-48 overflow-auto border rounded-md thin-scroll">
                  <ul>
                    {(clients || []).map(c => (
                      <li key={c.id} className="p-2 flex items-center justify-between cursor-pointer hover:bg-surface-2" onClick={async () => {
                        try {
                          setLinking(true);
                          const codigoEmpresa = userProfile?.codigo_empresa;
                          if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
                          if (comandaId) {
                            await adicionarClientesAComanda({ comandaId, clienteIds: [c.id], nomesLivres: [], codigoEmpresa });
                            const vincs = await listarClientesDaComanda({ comandaId, codigoEmpresa });
                            const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
                            setCustomerName(nomes.length ? nomes.join(', ') : '');
                            setClientChosen(true);
                          } else {
                            // Sem comanda ainda: guarda seleção para associar no primeiro item
                            setSelectedClientIds(prev => {
                              const arr = Array.from(new Set([...(prev||[]), c.id]));
                              try { localStorage.setItem(LS_KEY.pendingClientIds, JSON.stringify(arr)); } catch {}
                              return arr;
                            });
                            setCustomerName(c.nome || '');
                            setClientChosen(true);
                            try {
                              localStorage.setItem(LS_KEY.customerName, c.nome || '');
                              localStorage.setItem(LS_KEY.clientChosen, 'true');
                            } catch {}
                          }
                          setClientSearch('');
                          setClients([]);
                          // Fecha wizard primeiro para evitar competição de foco/modal
                          setIsClientWizardOpen(false);
                          toast({ title: 'Cliente selecionado', variant: 'success' });
                          // Se havia um produto pendente, adiciona automaticamente após selecionar cliente
                          if (pendingProduct) {
                            const p = pendingProduct; setPendingProduct(null);
                            await addProduct(p, { skipClientCheck: true });
                          }
                        } catch (e) {
                          toast({ title: 'Falha ao selecionar cliente', description: e?.message || 'Tente novamente', variant: 'destructive' });
                        } finally {
                          setLinking(false);
                        }
                      }}>
                        <div>
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-text-muted">{c.email || '—'} {c.telefone ? `• ${c.telefone}` : ''}</div>
                        </div>
                        <CheckCircle size={16} className="text-success opacity-0 group-hover:opacity-100" />
                      </li>
                    ))}
                    {(!clients || clients.length === 0) && (
                      <li className="p-2 text-sm text-text-muted">Nenhum cliente encontrado.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary">
                Consumidor final (sem cadastro). Você pode prosseguir com a venda.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsClientWizardOpen(false); }}>Fechar</Button>
            <Button onClick={async () => {
              try {
                if (clientMode === 'consumidor') {
                  // Apenas marcar; criaremos a comanda no primeiro item adicionado
                  setCustomerName('');
                  setClientChosen(true);
                  setIsClientWizardOpen(false);
                  try {
                    localStorage.setItem(LS_KEY.customerName, '');
                    localStorage.setItem(LS_KEY.clientChosen, 'true');
                    localStorage.setItem(LS_KEY.pendingClientIds, JSON.stringify([]));
                  } catch {}
                } else {
                  if (!customerName && (!selectedClientIds || selectedClientIds.length === 0)) { toast({ title: 'Selecione um cliente da lista', variant: 'warning' }); return; }
                  // Cliente já selecionado (podendo não ter comanda ainda); apenas fechar
                  setIsClientWizardOpen(false);
                }
                // Consumir produto pendente, se houver
                if (pendingProduct) {
                  const p = pendingProduct; setPendingProduct(null);
                  await addProduct(p, { skipClientCheck: true });
                }
              } catch (e) {
                toast({ title: 'Falha ao iniciar venda', description: e?.message || 'Tente novamente', variant: 'destructive' });
              }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
