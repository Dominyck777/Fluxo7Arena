import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { CalendarDays, FileText, Search, ArrowLeft, Loader2 } from 'lucide-react';
import { listarComandas, listarItensDaComanda, listarTotaisPorComanda, listarPagamentos, listMesas, listarClientesDaComanda } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export default function HistoricoComandasPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState('closed');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [tipo, setTipo] = useState('all'); // all | comanda | balcao

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState({ loading: false, itens: [], pagamentos: [] });

  const load = async () => {
    try {
      setLoading(true);
      // Busca base de comandas (sem depender do id no filtro de busca)
      const list = await listarComandas({ status, from, to, search: '', limit: 100, offset: 0 });
      // Carrega totais em lote
      const ids = (list || []).map(r => r.id);
      let totals = {};
      try { totals = await listarTotaisPorComanda(ids); } catch { totals = {}; }
      // Mapa de mesas { id: numero }
      let mesas = [];
      try { mesas = await listMesas(); } catch { mesas = []; }
      const mapMesaNumero = new Map((mesas || []).map(m => [m.id, m.numero]));
      // Nomes de clientes (consulta individual por comanda, agregando em string)
      const namesByComanda = {};
      try {
        await Promise.all((ids || []).map(async (id) => {
          try {
            const vincs = await listarClientesDaComanda({ comandaId: id });
            const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
            namesByComanda[id] = nomes.join(', ');
          } catch { namesByComanda[id] = ''; }
        }));
      } catch {}
      // Finalizadoras (rótulos) a partir dos pagamentos
      const finsByComanda = {};
      try {
        await Promise.all((ids || []).map(async (id) => {
          try {
            const pgs = await listarPagamentos({ comandaId: id });
            const labels = Array.from(new Set((pgs || []).map(pg => pg?.metodo).filter(Boolean)));
            finsByComanda[id] = labels.join(', ');
          } catch { finsByComanda[id] = ''; }
        }));
      } catch {}
      const withTotals = (list || []).map(r => ({
        ...r,
        total: Number(totals[r.id] || 0),
        mesaNumero: mapMesaNumero.get(r.mesa_id),
        clientesStr: namesByComanda[r.id] || '',
        finalizadorasStr: finsByComanda[r.id] || ''
      }));
      setRows(withTotals);
    } catch (e) {
      toast({ title: 'Falha ao carregar histórico', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, debouncedSearch, from, to]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail({ loading: true, itens: [], pagamentos: [] });
    try {
      const [itens, pagamentos] = await Promise.all([
        listarItensDaComanda({ comandaId: id }),
        listarPagamentos({ comandaId: id })
      ]);
      setDetail({ loading: false, itens: itens || [], pagamentos: pagamentos || [] });
    } catch (e) {
      setDetail({ loading: false, itens: [], pagamentos: [] });
      toast({ title: 'Falha ao carregar detalhes', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const totals = useMemo(() => {
    const sum = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
    return { sum };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = (debouncedSearch || '').trim().toLowerCase();
    // 1) Sempre aplica filtro por Tipo
    const byTipo = rows.filter(r => {
      const isBalcao = (r.mesa_id == null);
      if (tipo === 'balcao' && !isBalcao) return false;
      if (tipo === 'comanda' && isBalcao) return false;
      return true;
    });
    // 2) Se não houver termo, retorna somente por Tipo
    if (!term) return byTipo;
    // 3) Aplica busca textual adicional
    return byTipo.filter(r => {
      const mesaTxt = (r.mesaNumero != null ? String(r.mesaNumero) : '').toLowerCase();
      const statusTxt = (r.status || '').toLowerCase();
      const clientesTxt = (r.clientesStr || '').toLowerCase();
      const tipoTxt = (r.mesa_id == null) ? 'balcao' : 'comanda';
      return mesaTxt.includes(term) || statusTxt.includes(term) || clientesTxt.includes(term) || tipoTxt.includes(term);
    });
  }, [rows, debouncedSearch, tipo]);

  const statusPt = (s) => {
    if (s === 'open') return 'Aberta';
    if (s === 'awaiting-payment') return 'Pagamento';
    if (s === 'closed') return 'Fechada';
    return s || '—';
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0));

  const statusBadgeClass = (s) => {
    if (s === 'open') return 'text-info bg-info/10 border-info/30';
    if (s === 'awaiting-payment') return 'text-warning bg-warning/10 border-warning/30';
    if (s === 'closed') return 'text-success bg-success/10 border-success/30';
    return 'text-text-secondary bg-transparent border-border/50';
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="h-full flex flex-col">
      <Helmet>
        <title>Histórico de Comandas - Fluxo7 Arena</title>
        <meta name="description" content="Histórico de comandas e vendas." />
      </Helmet>

      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { try { navigate(-1); } catch { navigate('/vendas'); } }} className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-surface-2 transition-colors" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tighter">Histórico de Comandas</h1>
            <p className="text-text-secondary">Consulte por período, status, mesa e cliente.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-text-secondary">Total do período: <span className="font-semibold text-text-primary">R$ {totals.sum.toFixed(2)}</span></div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="mb-1 block">Período Inicial</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
              <Input type="date" className="pl-9" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Período Final</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
              <Input type="date" className="pl-9" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block">Busca</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input placeholder="Mesa, status (fechada/aberta) ou cliente" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Status</Label>
            <Tabs value={status} onValueChange={setStatus} className="w-full">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="closed">Fechadas</TabsTrigger>
                <TabsTrigger value="open">Abertas</TabsTrigger>
                <TabsTrigger value="awaiting-payment">Pagamento</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <Label className="mb-1 block">Tipo</Label>
            <Tabs value={tipo} onValueChange={setTipo} className="w-full">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="comanda">Comandas</TabsTrigger>
                <TabsTrigger value="balcao">Balcão</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-text-secondary">
              <tr>
                <th className="text-left px-4 py-3">Mesa</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Clientes</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Finalizadora</th>
                <th className="text-left px-4 py-3">Abertura</th>
                <th className="text-left px-4 py-3">Fechamento</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-text-muted">Nenhuma comanda encontrada no período.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border/70 hover:bg-warning/10">
                  <td className="px-4 py-2">{r.mesa_id == null ? 'Balcão' : (r.mesaNumero != null ? `Mesa ${r.mesaNumero}` : '—')}</td>
                  <td className="px-4 py-2">{r.mesa_id == null ? 'Balcão' : 'Comanda'}</td>
                  <td className="px-4 py-2 truncate max-w-[260px]">{r.clientesStr || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={cn("inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border", statusBadgeClass(r.status))}>
                      {statusPt(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 truncate max-w-[220px]">{r.finalizadorasStr || '—'}</td>
                  <td className="px-4 py-2">{fmtDate(r.aberto_em)}</td>
                  <td className="px-4 py-2">{fmtDate(r.fechado_em)}</td>
                  <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{fmtMoney(r.total)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openDetail(r.id)}>
                      <FileText className="mr-2 h-4 w-4" /> Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Dialog open={!!detailId} onOpenChange={(v) => { if (!v) { setDetailId(null); setDetail({ loading: false, itens: [], pagamentos: [] }); } }}>
        <DialogContent className="max-w-3xl" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Detalhes da Comanda #{detailId || '—'}</DialogTitle>
            <DialogDescription>Itens e pagamentos registrados.</DialogDescription>
          </DialogHeader>
          {detail.loading ? (
            <div className="p-6 text-center text-text-muted"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <div className="font-semibold mb-2">Itens</div>
                {detail.itens.length === 0 ? (
                  <div className="text-sm text-text-muted">Sem itens.</div>
                ) : (
                  <ul className="text-sm space-y-2 max-h-64 overflow-auto thin-scroll">
                    {detail.itens.map(it => (
                      <li key={it.id} className="flex justify-between">
                        <span className="truncate pr-2">{it.descricao} <span className="text-text-muted">x {it.quantidade}</span></span>
                        <span className="font-mono">R$ {(Number(it.quantidade||0)*Number(it.preco_unitario||0)).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border rounded-md p-3">
                <div className="font-semibold mb-2">Pagamentos</div>
                {detail.pagamentos.length === 0 ? (
                  <div className="text-sm text-text-muted">Sem registros.</div>
                ) : (
                  <ul className="text-sm space-y-2 max-h-64 overflow-auto thin-scroll">
                    {detail.pagamentos.map(pg => (
                      <li key={pg.id} className="flex justify-between">
                        <span className="truncate pr-2">{pg.metodo || '—'} <span className="text-text-muted">{pg.status || ''}</span></span>
                        <span className="font-mono">R$ {Number(pg.valor||0).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setDetailId(null); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
