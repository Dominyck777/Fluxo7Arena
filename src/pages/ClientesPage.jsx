import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Users, UserX, UserCheck, Gift, Edit, Trash2, MoreHorizontal, History, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ClientFormModal from '@/components/clients/ClientFormModal';


// Dados carregados de Supabase (public.clientes)

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const StatCard = ({ icon, title, value, color, onClick, isActive }) => {
    const Icon = icon;
    return (
        <motion.div 
            variants={itemVariants} 
            className={cn(
                "bg-surface rounded-lg border p-4 flex items-center gap-4 cursor-pointer transition-all duration-200",
                isActive ? "border-brand ring-2 ring-brand/50" : "border-border hover:border-brand/50",
            )}
            onClick={onClick}
        >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}/20`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-text-secondary text-sm font-medium">{title}</p>
                <p className="text-2xl font-bold text-text-primary">{value}</p>
            </div>
        </motion.div>
    );
};

function ClientDetailsModal({ open, onOpenChange, client, onEdit, codigoEmpresa }) {
  const { toast } = useToast();

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! ",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! ",
    });
  };

  const DetailRow = ({ label, value }) => (
    <div className="grid grid-cols-12 items-start gap-3 py-2 border-b border-border/50">
      <div className="col-span-5 sm:col-span-4">
        <span className="block text-[11px] uppercase tracking-wide text-text-muted font-semibold">{label}</span>
      </div>
      <div className="col-span-7 sm:col-span-8">
        <span className="block text-sm font-medium text-text-primary break-words">{value}</span>
      </div>
    </div>
  );

  // Histórico recente (comandas, itens e pagamentos)
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  // Histórico de agendamentos
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookings, setBookings] = useState([]);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));

  // Lista unificada (comandas + agendamentos) ordenada por data/hora desc
  const unifiedRecent = useMemo(() => {
    try {
      const a = (history || []).map(h => ({
        kind: 'comanda',
        ts: new Date(h.aberto_em || h.created_at || 0).getTime(),
        data: h,
      }));
      const b = (bookings || []).map(bk => ({
        kind: 'agendamento',
        ts: new Date(bk.inicio || 0).getTime(),
        data: bk,
      }));
      return [...a, ...b]
        .sort((x, y) => (y.ts - x.ts))
        .slice(0, 10);
    } catch { return []; }
  }, [history, bookings]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!open || !client?.id) return;
      setHistoryLoading(true);
      setBookingsLoading(true);
      try {
        // 1) Buscar últimos vínculos do cliente com comandas
        let qV = supabase
          .from('comanda_clientes')
          .select('comanda_id, created_at')
          .eq('cliente_id', client.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (codigoEmpresa) qV = qV.eq('codigo_empresa', codigoEmpresa);
        const { data: vincs, error: vincErr } = await qV;
        if (vincs && vincs.length === 0) {
          // ainda tentaremos pegar comandas diretas por cliente_id
        }
        if (vincErr) throw vincErr;
        const vincComandaIds = Array.from(new Set((vincs || []).map(v => v.comanda_id).filter(Boolean)));

        // 1b) Complementar: comandas vinculadas diretamente ao cliente (comandas.cliente_id)
        let qDirect = supabase
          .from('comandas')
          .select('id, status, aberto_em, fechado_em')
          .eq('cliente_id', client.id)
          .order('aberto_em', { ascending: false })
          .limit(10);
        if (codigoEmpresa) qDirect = qDirect.eq('codigo_empresa', codigoEmpresa);
        const { data: directComandas, error: dirErr } = await qDirect;
        if (dirErr) throw dirErr;
        const directIds = Array.from(new Set((directComandas || []).map(c => c.id)));

        const comandaIds = Array.from(new Set([ ...vincComandaIds, ...directIds ]));
        if (comandaIds.length === 0) {
          setHistory([]);
          setHistoryLoading(false);
          // não retorna ainda; bookings serão carregados por loadBookings
        }

        // 2) Detalhes das comandas (join mesa para exibir nome/numero)
        let qCom = supabase
          .from('comandas')
          .select('id,status,aberto_em,fechado_em, mesa:mesas!comandas_mesa_id_fkey ( nome, numero )')
          .in('id', comandaIds);
        if (codigoEmpresa) qCom = qCom.eq('codigo_empresa', codigoEmpresa);
        const { data: comandas, error: comErr } = await qCom;
        if (comErr) throw comErr;
        const byComanda = new Map((comandas || []).map(c => [c.id, c]));

        // 3) Itens das comandas (somatório)
        let qItens = supabase
          .from('comanda_itens')
          .select('comanda_id, quantidade, preco_unitario, desconto')
          .in('comanda_id', comandaIds);
        if (codigoEmpresa) qItens = qItens.eq('codigo_empresa', codigoEmpresa);
        const { data: itens, error: itErr } = await qItens;
        if (itErr) throw itErr;
        const totalPorComanda = {};
        for (const it of (itens || [])) {
          const bruto = Number(it.quantidade || 0) * Number(it.preco_unitario || 0);
          const desc = Number(it.desconto || 0);
          totalPorComanda[it.comanda_id] = (totalPorComanda[it.comanda_id] || 0) + Math.max(0, bruto - desc);
        }

        // 4) Pagamentos por comanda (somatório válidos)
        let qP = supabase
          .from('pagamentos')
          .select('comanda_id, valor, status, recebido_em, metodo')
          .in('comanda_id', comandaIds);
        if (codigoEmpresa) qP = qP.eq('codigo_empresa', codigoEmpresa);
        const { data: pays, error: payErr } = await qP;
        if (payErr) throw payErr;
        const pagoPorComanda = {};
        for (const pg of (pays || [])) {
          const ok = (pg.status || 'Pago') !== 'Cancelado' && (pg.status || 'Pago') !== 'Estornado';
          if (!ok) continue;
          pagoPorComanda[pg.comanda_id] = (pagoPorComanda[pg.comanda_id] || 0) + Number(pg.valor || 0);
        }

        // 5) Montar histórico em ordem cronológica dos vínculos (created_at desc)
        // Construir histórico a partir de vínculos e das comandas diretas (evitando duplicatas)
        const makeRow = (cid, createdAtFallback = null) => {
          const c = byComanda.get(cid) || {};
          const total = Number(totalPorComanda[cid] || 0);
          const pago = Number(pagoPorComanda[cid] || 0);
          const saldo = Math.max(0, total - pago);
          const mesaNome = c.mesa?.[0]?.nome || c.mesa?.nome || null;
          const mesaNumero = c.mesa?.[0]?.numero || c.mesa?.numero || null;
          const mesa_title = mesaNome || (mesaNumero != null ? `Mesa ${mesaNumero}` : 'Comanda');
          return {
            comanda_id: cid,
            created_at: createdAtFallback,
            aberto_em: c.aberto_em || null,
            fechado_em: c.fechado_em || null,
            status: c.status || 'open',
            total,
            pago,
            saldo,
            mesa_title,
          };
        };

        const rowsFromVinc = (vincs || []).map(v => makeRow(v.comanda_id, v.created_at));
        const rowsFromDirect = (directComandas || [])
          .filter(dc => !(vincComandaIds || []).includes(dc.id))
          .map(dc => makeRow(dc.id, dc.aberto_em));

        // Unir, ordenar por data (aberto_em ou created_at) decrescente
        const mergedRows = [...rowsFromVinc, ...rowsFromDirect].sort((a, b) => {
          const ta = new Date(a.aberto_em || a.created_at || 0).getTime();
          const tb = new Date(b.aberto_em || b.created_at || 0).getTime();
          return tb - ta;
        }).slice(0, 10);

        setHistory(mergedRows);
      } catch (err) {
        toast({ title: 'Falha ao carregar histórico do cliente', description: err?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setHistoryLoading(false);
      }
    };
    const loadBookings = async () => {
      if (!open || !client?.id) return;
      setBookingsLoading(true);
      try {
        // Buscar últimos agendamentos do cliente
        let q = supabase
          .from('agendamentos')
          .select(`
            id, inicio, fim, status, modalidade,
            quadra:quadra_id ( nome )
          `)
          .eq('cliente_id', client.id)
          .order('inicio', { ascending: false })
          .limit(10);
        if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa);
        const { data, error } = await q;
        if (error) throw error;
        const baseRows = (data || []).map(r => ({
          id: r.id,
          inicio: r.inicio,
          fim: r.fim,
          status: r.status,
          modalidade: r.modalidade,
          quadra_nome: (r.quadra?.[0]?.nome || r.quadra?.nome || null),
        }));

        // Complementar: agendamentos onde o cliente é participante (via view v_agendamento_participantes)
        let qp = supabase
          .from('v_agendamento_participantes')
          .select('agendamento_id')
          .eq('cliente_id', client.id)
          .limit(30);
        // (nem sempre a view expõe codigo_empresa; confiar em RLS)
        const { data: partRows, error: partErr } = await qp;
        if (partErr) throw partErr;
        const participantIds = Array.from(new Set((partRows || []).map(p => p.agendamento_id).filter(Boolean)));
        const alreadyIds = new Set((baseRows || []).map(r => r.id));
        const missingIds = participantIds.filter(id => !alreadyIds.has(id));

        let addRows = [];
        if (missingIds.length > 0) {
          let q2 = supabase
            .from('agendamentos')
            .select(`
              id, inicio, fim, status, modalidade,
              quadra:quadra_id ( nome )
            `)
            .in('id', missingIds);
          if (codigoEmpresa) q2 = q2.eq('codigo_empresa', codigoEmpresa);
          const { data: extra, error: extraErr } = await q2;
          if (extraErr) throw extraErr;
          addRows = (extra || []).map(r => ({
            id: r.id,
            inicio: r.inicio,
            fim: r.fim,
            status: r.status,
            modalidade: r.modalidade,
            quadra_nome: (r.quadra?.[0]?.nome || r.quadra?.nome || null),
          }));
        }

        const merged = [...baseRows, ...addRows].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)).slice(0, 10);
        setBookings(merged);
      } catch (e) {
        // não derrubar o modal por erro nos agendamentos
        console.warn('[ClientDetailsModal] Falha ao carregar agendamentos do cliente:', e);
      } finally {
        setBookingsLoading(false);
      }
    };
    loadHistory();
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Cliente</DialogTitle>
          <DialogDescription>Informações cadastrais e histórico recente deste cliente.</DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-8">
            <div className="overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold tracking-tight text-text-primary truncate">{client.nome}</h2>
                  <div className="mt-2 flex items-center flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-2 border border-border text-text-secondary">
                      Código: <span className="text-text-primary font-mono">{client.codigo}</span>
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30' : 'bg-rose-500/10 text-rose-400 border-rose-400/30'}`}>
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <span className="mt-2 block text-sm text-text-secondary truncate">{client.email || '—'}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-8">
                <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">Informações Cadastrais</h4>
                    <div className="bg-surface-2 p-4 rounded-lg space-y-1">
                        <DetailRow label="Código" value={client.codigo} />
                        <DetailRow label="CPF/CNPJ" value={client.cpf || client.cnpj || '—'} />
                        <DetailRow label="Telefone" value={client.telefone || '—'} />
                        <DetailRow label="Aniversário" value={client.aniversario ? new Date(client.aniversario).toLocaleDateString('pt-BR') : '—'} />
                        <DetailRow label="Email" value={client.email || '—'} />
                        <DetailRow label="Status" value={client.status === 'active' ? 'Ativo' : 'Inativo'} />
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-text-primary">
                  <History className="w-5 h-5 text-text-secondary"/>
                  <h4 className="font-semibold">Histórico Recente</h4>
                </div>
                <div className="bg-surface-2 p-4 rounded-lg">
                  {(historyLoading || bookingsLoading) ? (
                    <div className="text-center py-8 text-sm text-text-muted">Carregando histórico...</div>
                  ) : (unifiedRecent && unifiedRecent.length > 0) ? (
                    <div className="space-y-3">
                      {unifiedRecent.map((item, idx) => (
                        <div key={`${item.kind}-${idx}`} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border/60 bg-background">
                          <div className="min-w-0">
                            {item.kind === 'comanda' ? (
                              <>
                                <div className="text-sm font-semibold text-text-primary truncate">{item.data.mesa_title || 'Comanda'}</div>
                                <div className="text-xs text-text-secondary truncate">
                                  {(() => { const h = item.data; return h.aberto_em ? new Date(h.aberto_em).toLocaleString('pt-BR') : new Date(h.created_at).toLocaleString('pt-BR'); })()}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-sm font-semibold text-text-primary truncate">{item.data.modalidade || 'Agendamento'}</div>
                                <div className="text-xs text-text-secondary truncate">
                                  {new Date(item.data.inicio).toLocaleString('pt-BR')} — {item.data.quadra_nome || 'Quadra'}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {item.kind === 'comanda' ? (
                              <>
                                <span className={cn(
                                  "px-2 py-1 text-[11px] font-semibold rounded-full border",
                                  item.data.status === 'closed' || item.data.fechado_em ? "bg-success/10 text-success border-success/30" :
                                  (item.data.status === 'awaiting-payment' ? "bg-info/10 text-info border-info/30" : "bg-warning/10 text-warning border-warning/30")
                                )}>
                                  {item.data.status === 'closed' || item.data.fechado_em ? 'Fechada' : (item.data.status === 'awaiting-payment' ? 'Pagamento' : 'Em uso')}
                                </span>
                              </>
                            ) : (
                              <span className={cn(
                                "px-2 py-1 text-[11px] font-semibold rounded-full border",
                                item.data.status === 'finished' ? "bg-success/10 text-success border-success/30" :
                                item.data.status === 'canceled' ? "bg-danger/10 text-danger border-danger/30" :
                                item.data.status === 'in_progress' ? "bg-warning/10 text-warning border-warning/30" :
                                item.data.status === 'confirmed' ? "bg-info/10 text-info border-info/30" :
                                item.data.status === 'absent' ? "bg-rose-500/10 text-rose-400 border-rose-400/30" :
                                "bg-muted/10 text-text-secondary border-border/30"
                              )}>
                                {(() => {
                                  switch (item.data.status) {
                                    case 'finished': return 'Finalizado';
                                    case 'canceled': return 'Cancelado';
                                    case 'in_progress': return 'Em andamento';
                                    case 'confirmed': return 'Confirmado';
                                    case 'absent': return 'Ausente';
                                    case 'scheduled': default: return 'Agendado';
                                  }
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-text-muted">Sem registros recentes para este cliente.</div>
                  )}
                </div>
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Fechar</Button>
          </DialogClose>
          <Button onClick={() => onEdit(client)}>
            <Edit className="mr-2 h-4 w-4" /> Editar Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ClientesPage() {
    const { toast } = useToast();
    const { userProfile, authReady } = useAuth();
    const [clients, setClients] = useState(() => {
      try {
        const cachedProfile = localStorage.getItem('auth:userProfile');
        const codigo = cachedProfile ? (JSON.parse(cachedProfile)?.codigo_empresa || null) : null;
        const key = codigo ? `clientes:list:${codigo}` : 'clientes:list';
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(cached) ? cached : [];
      } catch {
        return [];
      }
    });
    const [loading, setLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [editingClient, setEditingClient] = useState(null);
    const [filters, setFilters] = useState({ searchTerm: '', status: 'all' });
    // Retry control para contornar atrasos de token/RLS no Vercel
    const clientsRetryRef = useRef(false);
    const lastLoadTsRef = useRef(0);
    const lastSizeRef = useRef(0);

    const loadClients = async () => {
      try {
        // Loading forte só quando não há cache
        const hasCache = clients && clients.length > 0;
        if (!hasCache) setLoading(true);
        if (!userProfile?.codigo_empresa) return; // aguarda empresa
        const cacheKey = `clientes:list:${userProfile.codigo_empresa}`;
        let query = supabase
          .from('clientes')
          .select('*')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .order('codigo', { ascending: true });

        if (filters.searchTerm.trim() !== '') {
          const s = filters.searchTerm.trim();
          const isNumeric = /^\d+$/.test(s);
          if (isNumeric) {
            // inclui busca por codigo exato quando termo é numérico
            query = query.or(`codigo.eq.${s},nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`);
          } else {
            query = query.or(`nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`);
          }
        }
        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        const slowFallback = setTimeout(() => {
          try {
            if (!hasCache) {
              const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
              if (Array.isArray(cached) && cached.length > 0) {
                console.warn('[Clientes] slow fallback: using cached snapshot');
                setClients(cached);
                lastSizeRef.current = cached.length;
              }
            }
          } catch {}
        }, 2000);

        const { data, error } = await query;
        if (error) {
          // Primeiro erro: não derruba lista atual; tenta 1x novamente
          if (!clientsRetryRef.current) {
            clientsRetryRef.current = true;
            setTimeout(loadClients, 900);
            return;
          }
          throw error;
        }
        const rows = data || [];
        // Resposta vazia pode acontecer por atraso de token/RLS em produção.
        // Se houver cache local, não sobrescrever imediatamente; tentar 1x novamente.
        if (rows.length === 0 && hasCache && !clientsRetryRef.current) {
          clientsRetryRef.current = true;
          setTimeout(loadClients, 700);
          return;
        }
        clientsRetryRef.current = false;
        setClients(rows);
        try { localStorage.setItem(cacheKey, JSON.stringify(rows)); } catch {}
        lastSizeRef.current = rows.length;
        lastLoadTsRef.current = Date.now();
      } catch (err) {
        toast({ title: 'Erro ao carregar clientes', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
        try { clearTimeout(slowFallback); } catch {}
      }
    };

    // Hidratar do cache para evitar sumiço ao trocar de aba e depois atualizar em background
    useEffect(() => {
      try {
        const cachedProfile = localStorage.getItem('auth:userProfile');
        const codigo = userProfile?.codigo_empresa || (cachedProfile ? (JSON.parse(cachedProfile)?.codigo_empresa || null) : null);
        if (codigo) {
          const key = `clientes:list:${codigo}`;
          const cached = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(cached) && cached.length && clients.length === 0) {
            setClients(cached);
            lastSizeRef.current = cached.length;
          }
        }
      } catch {}
      // só dispara quando auth e perfil/empresa prontos
      if (authReady && userProfile?.codigo_empresa) {
        const t0 = setTimeout(loadClients, 50);
        return () => clearTimeout(t0);
      }
      return () => {};
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, userProfile?.codigo_empresa]);

    useEffect(() => {
      if (authReady && userProfile?.codigo_empresa) {
        const t = setTimeout(loadClients, 200);
        return () => clearTimeout(t);
      }
      return () => {};
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.searchTerm, filters.status, authReady, userProfile?.codigo_empresa]);

    // Recarregar ao focar/ficar visível se estiver estagnado
    useEffect(() => {
      const onFocus = () => {
        const elapsed = Date.now() - (lastLoadTsRef.current || 0);
        if (elapsed > 30000 || lastSizeRef.current === 0) {
          if (authReady && userProfile?.codigo_empresa) loadClients();
        }
      };
      const onVis = () => {
        if (document.visibilityState === 'visible') {
          const elapsed = Date.now() - (lastLoadTsRef.current || 0);
          if (elapsed > 30000 || lastSizeRef.current === 0) {
            if (authReady && userProfile?.codigo_empresa) loadClients();
          }
        }
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVis);
      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVis);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, userProfile?.codigo_empresa]);

    const stats = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        return {
            total: clients.length,
            birthdays: clients.filter(c => c.aniversario && new Date(c.aniversario).getMonth() === currentMonth).length,
        };
    }, [clients]);

    const filteredClients = useMemo(() => {
      const today = new Date();
      const currentMonth = today.getMonth();

      return clients.filter(client => {
          const searchTermMatch = filters.searchTerm.toLowerCase() === '' || 
              (client.nome || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
              (client.cpf || '').includes(filters.searchTerm) ||
              (client.telefone || '').includes(filters.searchTerm);
          const statusMatch = filters.status === 'all' || client.status === filters.status;
          return searchTermMatch && statusMatch;
      });
    }, [clients, filters]);
    
    const handleViewDetails = (client) => {
      setSelectedClient(client);
      setIsDetailsOpen(true);
    };

    const handleAddNew = () => {
      setEditingClient(null);
      setIsFormOpen(true);
    };
    
    const handleEdit = (client) => {
        setIsDetailsOpen(false);
        setEditingClient(client);
        setIsFormOpen(true);
    }
    
    const handleEditFromMenu = (client) => {
        setEditingClient(client);
        setIsFormOpen(true);
    }

    const handleInactivate = async (client) => {
      try {
        const { error } = await supabase.from('clientes').update({ status: 'inactive' }).eq('id', client.id);
        if (error) throw error;
        toast({ title: 'Cliente inativado', description: `${client.nome} foi marcado como inativo.` });
        loadClients();
      } catch (err) {
        toast({ title: 'Erro ao inativar cliente', description: err.message, variant: 'destructive' });
      }
    };
    
    const handleClearFilters = () => {
      setFilters({ searchTerm: '', status: 'all' });
    }
    
    const hasActiveFilters = filters.searchTerm !== '' || filters.status !== 'all';

    return (
      <>
        <Helmet>
          <title>Clientes - Fluxo7 Arena</title>
          <meta name="description" content="Gerenciamento completo de clientes (CRM)." />
        </Helmet>
        <div className="h-full flex flex-col">
            <motion.div variants={pageVariants} initial="hidden" animate="visible">
                <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tighter">Controle de Clientes</h1>
                        <p className="text-text-secondary">controle financeiro dos seus clientes.</p>
                    </div>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <StatCard icon={Users} title="Total de Clientes" value={stats.total} color="text-brand" />
                    <StatCard icon={Gift} title="Aniversariantes do Mês" value={stats.birthdays} color="text-info" />
                </div>

                <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: 0.2}}>
                    <div className="bg-surface rounded-lg border border-border">
                        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4">
                           <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                                <Input 
                                  placeholder="Buscar por nome, CPF ou telefone..." 
                                  className="pl-9" 
                                  value={filters.searchTerm}
                                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-4">
                               <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({...prev, status: value}))}>
                                 <SelectTrigger className="w-[180px]">
                                   <SelectValue placeholder="Status" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="all">Todos os Status</SelectItem>
                                   <SelectItem value="active">Ativos</SelectItem>
                                   <SelectItem value="inactive">Inativos</SelectItem>
                                 </SelectContent>
                               </Select>
                               {hasActiveFilters && (
                                  <Button variant="ghost" onClick={handleClearFilters}>
                                      <XCircle className="mr-2 h-4 w-4"/>
                                      Limpar Filtros
                                  </Button>
                               )}
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Carregando...</TableCell>
                                  </TableRow>
                                ) : filteredClients.length > 0 ? (
                                    filteredClients.map(client => (
                                        <TableRow key={client.id} className="cursor-pointer" onClick={() => handleViewDetails(client)}>
                                            <TableCell className="font-mono text-xs text-text-secondary">{client.codigo}</TableCell>
                                            <TableCell className="font-medium">{client.nome}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{client.email || '—'}</span>
                                                    <span className="text-xs text-text-muted">{client.telefone || '—'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-1 text-xs font-semibold rounded-full",
                                                    client.status === 'active' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                                                )}>
                                                    {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleViewDetails(client); }}>Ver Detalhes</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleEditFromMenu(client); }}>Editar</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-danger" onClick={(e) => { e.stopPropagation(); handleInactivate(client); }}>Inativar Cliente</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            Nenhum cliente encontrado com os filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </motion.div>
            </motion.div>
        </div>
        <ClientFormModal 
            open={isFormOpen} 
            onOpenChange={setIsFormOpen}
            client={editingClient}
            onSaved={loadClients}
        />
        <ClientDetailsModal
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          client={selectedClient}
          onEdit={handleEdit}
          codigoEmpresa={userProfile?.codigo_empresa}
        />
      </>
    );
}

export default ClientesPage;