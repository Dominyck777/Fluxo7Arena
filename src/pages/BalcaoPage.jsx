import React, { useEffect, useMemo, useState } from 'react';

import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Search, ArrowLeft, Store, FileText, DollarSign, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateComandaBalcao, listarComandaBalcaoAberta, criarComandaBalcao, listarItensDaComanda, adicionarItem, listarFinalizadoras, registrarPagamento, fecharComandaEMesa, listarClientes, adicionarClientesAComanda, atualizarQuantidadeItem, removerItem, listarClientesDaComanda } from '@/lib/store';

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

  // Chaves de cache por empresa
  const companyCode = userProfile?.codigo_empresa || 'anon';
  const LS_KEY = {
    comandaId: `balcao:comandaId:${companyCode}`,
    items: `balcao:items:${companyCode}`,
    customerName: `balcao:customer:${companyCode}`,
  };

  // Utilitário: recarregar itens e cliente para a comanda atual com retry leve
  const refetchItemsAndCustomer = async (targetComandaId, attempts = 3) => {
    if (!targetComandaId) return;
    const codigoEmpresa = userProfile?.codigo_empresa;
    for (let i = 0; i < attempts; i++) {
      try {
        const itens = await listarItensDaComanda({ comandaId: targetComandaId, codigoEmpresa });
        setItems((itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) })));
        try {
          const vincs = await listarClientesDaComanda({ comandaId: targetComandaId, codigoEmpresa });
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
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
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
        if (cachedId) setComandaId(Number.isNaN(+cachedId) ? cachedId : Number(cachedId));
        if (Array.isArray(cachedItems) && cachedItems.length > 0) setItems(cachedItems);
        if (cachedCustomer) setCustomerName(cachedCustomer);
      } catch { /* ignore cache errors */ }

      // Novo: apenas obter comanda aberta existente (não cria automaticamente)
      const c = await listarComandaBalcaoAberta({ codigoEmpresa });
      if (c?.id) {
        setComandaId(c.id);
        await refetchItemsAndCustomer(c.id);
      } else {
        setComandaId(null);
        setItems([]);
        setCustomerName('');
        setClientChosen(false);
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
      if (!comandaId) return;
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
      await fecharComandaEMesa({ comandaId, codigoEmpresa });
      // Não abre nova comanda automaticamente
      setComandaId(null);
      setItems([]);
      setSelectedClientIds([]);
      setCustomerName('');
      setClientChosen(false);
      toast({ title: 'Venda cancelada', description: 'Uma nova comanda foi aberta.', variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao cancelar venda', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userProfile?.codigo_empresa]);

  // Persistir em cache quando comandaId/itens/cliente mudarem
  useEffect(() => {
    try {
      if (comandaId) localStorage.setItem(LS_KEY.comandaId, String(comandaId));
      localStorage.setItem(LS_KEY.items, JSON.stringify(items || []));
      localStorage.setItem(LS_KEY.customerName, customerName || '');
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId, items, customerName]);

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

  const addProduct = async (prod) => {
    try {
      if (!clientChosen) { setIsClientWizardOpen(true); toast({ title: 'Selecione o cliente', description: 'Escolha Cliente cadastrado ou Consumidor antes de vender.', variant: 'warning' }); return; }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', description: 'Faça login novamente.', variant: 'destructive' }); return; }
      // Criar comanda se não existir ainda (somente no primeiro item)
      let cid = comandaId;
      if (!cid) {
        const c = await getOrCreateComandaBalcao({ codigoEmpresa });
        cid = c.id;
        setComandaId(c.id);
      }
      const price = Number(prod.salePrice ?? prod.price ?? 0);
      await adicionarItem({ comandaId: cid, produtoId: prod.id, descricao: prod.name, quantidade: 1, precoUnitario: price, codigoEmpresa });
      const itens = await listarItensDaComanda({ comandaId: cid, codigoEmpresa });
      setItems((itens || []).map((it) => ({ id: it.id, name: it.descricao || 'Item', price: Number(it.preco_unitario || 0), quantity: Number(it.quantidade || 1) })));
      toast({ title: 'Produto adicionado', description: prod.name, variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao adicionar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const openPay = async () => {
    try {
      setPayLoading(true);
      if (!clientChosen) { setIsClientWizardOpen(true); toast({ title: 'Selecione o cliente', description: 'Escolha Cliente cadastrado ou Consumidor antes de pagar.', variant: 'warning' }); setPayLoading(false); return; }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
      const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa });
      setPayMethods(fins || []);
      setSelectedPayId(fins?.[0]?.id || null);
      setIsPayOpen(true);
    } catch (e) {
      toast({ title: 'Falha ao preparar pagamento', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { setPayLoading(false); }
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

      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/historico')}><FileText className="mr-2 h-4 w-4"/>Histórico</Button>
        </div>
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tighter">Modo Balcão</h1>
          <p className="text-text-secondary">Venda rápida sem mesa.</p>
        </div>
        <div>
          <Button variant="outline" onClick={() => navigate('/vendas')}><Store className="mr-2 h-4 w-4"/>Modo Mesas</Button>
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
              <Button size="sm" variant="outline" onClick={() => setIsClientWizardOpen(true)}>+ Cliente</Button>
              <Button size="sm" variant="outline" onClick={cancelSale}>Cancelar Venda</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 thin-scroll">
            {items.length === 0 ? (
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
                          toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
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
                          toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
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
              <Button type="button" variant={clientMode === 'cadastrado' ? 'default' : 'outline'} onClick={() => setClientMode('cadastrado')}>Cliente cadastrado</Button>
              <Button type="button" variant={clientMode === 'consumidor' ? 'default' : 'outline'} onClick={() => setClientMode('consumidor')}>Consumidor</Button>
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
                          await adicionarClientesAComanda({ comandaId, clienteIds: [c.id], nomesLivres: [], codigoEmpresa: userProfile?.codigo_empresa });
                          setSelectedClientIds([]);
                          setClientSearch('');
                          setClients([]);
                          try {
                            const vincs = await listarClientesDaComanda({ comandaId, codigoEmpresa: userProfile?.codigo_empresa });
                            const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
                            const nomeFinal = nomes.length ? nomes.join(', ') : '';
                            setCustomerName(nomeFinal);
                            setClientChosen(Boolean(nomeFinal));
                            setIsClientWizardOpen(false);
                          } catch {
                            setCustomerName('');
                            setClientChosen(false);
                          }
                          toast({ title: 'Cliente associado', variant: 'success' });
                        } catch (e) {
                          toast({ title: 'Falha ao associar cliente', description: e?.message || 'Tente novamente', variant: 'destructive' });
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
              if (clientMode === 'consumidor') {
                // Apenas marcar como escolhido
                setCustomerName('');
                setClientChosen(true);
                setIsClientWizardOpen(false);
              } else {
                if (!customerName) { toast({ title: 'Selecione um cliente da lista', variant: 'warning' }); return; }
                setIsClientWizardOpen(false);
              }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
