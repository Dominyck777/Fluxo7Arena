import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { CalendarDays, FileText, Search, Loader2, Copy, Download } from 'lucide-react';
import { listarComandas, listarItensDaComanda, listarTotaisPorComanda, listarPagamentos, listMesas, listarClientesDaComanda, listarFechamentosCaixa, listarResumoPeriodo, getCaixaResumo, listarMovimentacoesCaixa, listarClientesPorComandas, listarFinalizadorasPorComandas } from '@/lib/store';
import { gerarXMLNFe, downloadXML } from '@/lib/nfe';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import XMLSalesImportModal from '@/components/XMLSalesImportModal';

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

// Componente local para campo de data com ícone clicável que abre o datepicker nativo
function DateInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  
  // Fechar ao clicar fora
  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Util: parse/format
  const parseISODate = (s) => {
    try {
      const [y,m,d] = String(s || '').split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    } catch { return null; }
  };

  const statusCaixaPt = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'open') return 'Aberto';
    if (v === 'closed') return 'Fechado';
    return '—';
  };
  const formatYMD = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  const formatBR = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  };

  const selected = parseISODate(value);
  const display = selected ? formatBR(selected) : '';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-warning/10 focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir calendário"
      >
        <CalendarDays className="h-4 w-4 text-warning" />
      </button>
      <Input
        type="text"
        readOnly
        onClick={() => setOpen((v) => !v)}
        className="pl-9 pr-3 w-full bg-surface text-text-primary border border-warning/40 focus-visible:ring-warning focus-visible:border-warning"
        value={display}
      />
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-black text-white border border-warning/40 rounded-md shadow-xl p-2">
          <Calendar
            mode="single"
            selected={selected || undefined}
            onSelect={(d) => { if (d) { onChange(formatYMD(d)); setOpen(false); } }}
            showOutsideDays
            className=""
            classNames={{
              caption_label: 'text-sm font-medium text-white',
              head_cell: 'text-xs text-warning/80 w-9',
              day: 'h-9 w-9 p-0 font-normal text-white hover:bg-warning/10 rounded-md',
              day_selected: 'bg-warning text-black hover:bg-warning focus:bg-warning',
              day_today: 'border border-warning text-white',
              day_outside: 'text-white/30',
              nav_button: 'h-7 w-7 p-0 text-white hover:bg-warning/10 rounded-md',
              table: 'w-full',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function HistoricoComandasPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState('closed');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [tipo, setTipo] = useState('all'); // all | comanda | balcao
  const [tab, setTab] = useState('comandas'); // comandas | fechamentos

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState({ loading: false, itens: [], pagamentos: [] });
  const [detailMeta, setDetailMeta] = useState(null); // { mesaLabel, clientesStr, aberto_em, fechado_em, tipo }
  const [cashDetail, setCashDetail] = useState({ open: false, loading: false, resumo: null, periodo: { from: null, to: null }, movs: [] });
  
  // XML Import
  const [isXmlImportOpen, setIsXmlImportOpen] = useState(false);
  
  // Mostrar todas (sem filtro de data)
  const [showAll, setShowAll] = useState(false);
  
  // Exportar CSV
  const exportarCSV = async () => {
    try {
      toast({ title: 'Gerando CSV...', description: 'Aguarde enquanto preparamos o arquivo', variant: 'default' });
      
      // Buscar todas as comandas do período
      const todasComandas = await listarComandas({ 
        status, 
        from: from || undefined, 
        to: to || undefined, 
        search: debouncedSearch || '', 
        limit: 10000, 
        offset: 0 
      });
      
      if (!todasComandas || todasComandas.length === 0) {
        toast({ title: 'Nenhum dado para exportar', variant: 'warning' });
        return;
      }
      
      // Buscar totais
      const ids = todasComandas.map(r => r.id);
      const totals = await listarTotaisPorComanda(ids, userProfile?.codigo_empresa);
      const mesas = await listMesas(userProfile?.codigo_empresa);
      const mapMesaNumero = new Map(mesas.map(m => [m.id, m.numero]));
      const namesByComanda = await listarClientesPorComandas(ids);
      const finsByComanda = await listarFinalizadorasPorComandas(ids);
      
      // Montar dados para CSV
      const csvData = todasComandas.map(cmd => {
        const mesaLabel = cmd.mesa_id ? `Mesa ${mapMesaNumero.get(cmd.mesa_id) || '?'}` : 'Balcão';
        const clientes = (namesByComanda[cmd.id] || []).join(', ') || 'Sem cliente';
        const fins = finsByComanda[cmd.id];
        const finalizadoras = Array.isArray(fins) ? fins.join(', ') : (fins || 'Não informado');
        const statusLabel = cmd.fechado_em ? 'Fechada' : 'Aberta';
        
        return {
          'Tipo': cmd.tipo === 'balcao' ? 'Balcão' : 'Mesa',
          'Mesa/Local': mesaLabel,
          'Cliente(s)': clientes,
          'Status': statusLabel,
          'Abertura': new Date(cmd.aberto_em).toLocaleString('pt-BR'),
          'Fechamento': cmd.fechado_em ? new Date(cmd.fechado_em).toLocaleString('pt-BR') : '-',
          'Total (R$)': Number(totals[cmd.id] || 0).toFixed(2),
          'Forma(s) Pagamento': finalizadoras,
          'Observações': cmd.observacao || '-'
        };
      });
      
      // Converter para CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(';'),
        ...csvData.map(row => headers.map(h => {
          const value = row[h] || '';
          // Escapar aspas e adicionar aspas se contém vírgula ou ponto-e-vírgula
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(';'))
      ].join('\n');
      
      // Download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `historico_comandas_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: 'CSV exportado!', description: `${csvData.length} comandas exportadas`, variant: 'success' });
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast({ title: 'Erro ao exportar', description: error.message, variant: 'destructive' });
    }
  };

  // Paginação de comandas
  const PAGE_LIMIT = 100;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Resilient loading helpers
  const mountedRef = useRef(false);
  const lastLoadTsRef = useRef(0);
  const detailReqIdRef = useRef(0);
  const detailOpenRef = useRef(false);
  const getEmpresaCodigoFromCache = () => {
    try {
      const raw = localStorage.getItem('auth:userProfile');
      return raw ? (JSON.parse(raw)?.codigo_empresa || null) : null;
    } catch { return null; }
  };
  const cacheKey = useMemo(() => {
    const emp = getEmpresaCodigoFromCache() || 'na';
    const k = `hist:comandas:${emp}:${from}:${to}:${status}:${tipo}:${(debouncedSearch||'').trim()}`;
    return k;
  }, [from, to, status, tipo, debouncedSearch]);

  const load = async ({ append = false, skipCacheWrite = false } = {}) => {
    try {
      setLoading(true);
      // Short-circuit de pré-requisito: precisa de codigoEmpresa
      const emp = getEmpresaCodigoFromCache();
      if (!emp) {
        setLoading(false);
        return;
      }
      // Timeout de segurança
      const safetyTimer = setTimeout(() => setLoading(false), 10000);
      if (tab === 'comandas') {
        // Busca base de comandas (sem depender do id no filtro de busca)
        const list = await listarComandas({ status, from, to, search: debouncedSearch || '', limit: PAGE_LIMIT, offset });
        // Carrega totais em lote
        const ids = (list || []).map(r => r.id);
        let totals = {};
        if (ids.length > 0) {
          try { totals = await listarTotaisPorComanda(ids, emp); } catch { totals = {}; }
        }
        // Mapa de mesas { id: numero }
        let mesas = [];
        try { mesas = await listMesas(emp); } catch { mesas = []; }
        const mapMesaNumero = new Map((mesas || []).map(m => [m.id, m.numero]));
        // Nomes de clientes e finalizadoras em lote (evita N+1)
        let namesByComanda = {};
        let finsByComanda = {};
        try { namesByComanda = await listarClientesPorComandas(ids); } catch { namesByComanda = {}; }
        try { finsByComanda = await listarFinalizadorasPorComandas(ids); } catch { finsByComanda = {}; }
        const withTotals = (list || []).map(r => ({
          ...r,
          // status derivado: se existe fechado_em, considerar 'closed' para exibição/filtragem
          statusDerived: r.fechado_em ? 'closed' : (r.status || 'open'),
          total: Number(totals[r.id] || 0),
          mesaNumero: mapMesaNumero.get(r.mesa_id),
          clientesStr: namesByComanda[r.id] || '',
          finalizadorasStr: finsByComanda[r.id] || ''
        }));
        setHasMore((list || []).length === PAGE_LIMIT);
        if (append) {
          setRows(prev => [...prev, ...withTotals]);
        } else {
          setRows(withTotals);
        }
        // Cache persist
        if (!skipCacheWrite) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), rows: withTotals })); } catch {}
        }
      } else {
        // Fechamentos de caixa
        const sess = await listarFechamentosCaixa({ from, to, limit: 100, offset: 0, codigoEmpresa: emp });
        setRows(sess || []);
      }
      clearTimeout(safetyTimer);
    } catch (e) {
      toast({ title: 'Falha ao carregar histórico', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
      lastLoadTsRef.current = Date.now();
    }
  };

  // Hydrate from cache immediately on filters change to avoid empty UI
  useEffect(() => {
    mountedRef.current = true;
    if (tab === 'comandas') {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const obj = JSON.parse(raw);
          // Usa cache apenas se for recente (até 2 minutos)
          if (obj && Array.isArray(obj.rows) && (Date.now() - Number(obj.ts || 0) < 120000)) {
            setRows(obj.rows);
          }
        }
      } catch {}
    }
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tab]);

  // Recarrega lista ao trocar filtros/abas, resetando paginação
  useEffect(() => {
    if (tab === 'comandas') {
      setOffset(0);
      setHasMore(false);
    }
    load({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearch, from, to, tab]);

  // Retry backoff se vier vazio (corridas de auth/latência)
  useEffect(() => {
    if (!loading && tab === 'comandas' && rows.length === 0) {
      const t = setTimeout(() => { if (mountedRef.current) load({ append: false, skipCacheWrite: false }); }, 1500);
      return () => clearTimeout(t);
    }
  }, [rows.length, loading, tab]);

  // Reload ao voltar foco/visível se passou muito tempo (30s)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - (lastLoadTsRef.current || 0) > 30000) load({ append: false });
      }
    };
    const onFocus = () => {
      if (Date.now() - (lastLoadTsRef.current || 0) > 30000) load({ append: false });
    };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tab]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail({ loading: true, itens: [], pagamentos: [] });
    const emp = getEmpresaCodigoFromCache();
    detailOpenRef.current = true;
    // token/reqId para evitar sobrescrita por respostas antigas
    const myReq = ++detailReqIdRef.current;
    // Timeout de segurança para nunca travar em loading
    const safetyTimer = setTimeout(() => {
      if (detailReqIdRef.current === myReq && detailOpenRef.current) setDetail((prev) => ({ ...prev, loading: false }));
    }, 10000);
    // Pré-requisito faltando: encerra loading e informa
    if (!emp) {
      clearTimeout(safetyTimer);
      if (detailReqIdRef.current === myReq && detailOpenRef.current) {
        setDetail({ loading: false, itens: [], pagamentos: [] });
      }
      return;
    }
    // Monta metadados a partir da linha da lista (mesa, clientes, horários)
    try {
      const row = (rows || []).find(r => r.id === id) || null;
      if (row) {
        const mesaLabel = (row.mesa_id == null) ? 'Balcão' : (row.mesaNumero != null ? `Mesa ${row.mesaNumero}` : 'Comanda');
        setDetailMeta({
          mesaLabel,
          clientesStr: row.clientesStr || '',
          aberto_em: row.aberto_em || null,
          fechado_em: row.fechado_em || null,
          tipo: (row.mesa_id == null) ? 'balcao' : 'comanda',
        });
      } else {
        setDetailMeta(null);
      }
    } catch { setDetailMeta(null); }
    try {
      const fetchOnce = async () => {
        const [itens, pagamentos] = await Promise.all([
          listarItensDaComanda({ comandaId: id, codigoEmpresa: emp }),
          listarPagamentos({ comandaId: id, codigoEmpresa: emp })
        ]);
        // Carregar clientes vinculados para resolver nomes por id
        let clientesVinc = [];
        try { clientesVinc = await listarClientesDaComanda({ comandaId: id, codigoEmpresa: emp }); } catch {}
        const nomeById = new Map((clientesVinc || []).map(r => {
          const cid = r?.cliente_id ?? r?.clientes?.id ?? null;
          const nome = r?.clientes?.nome ?? r?.nome ?? r?.nome_livre ?? '';
          return cid ? [String(cid), nome] : null;
        }).filter(Boolean));
        
        // Para pagamentos sem cliente_id (antigos), distribuir clientes vinculados
        const clientesDisponiveis = Array.from(nomeById.values());
        
        const pgEnriched = (pagamentos || []).map((p, idx) => {
          let clienteNome = '';
          if (p?.cliente_id) {
            // Tem cliente_id específico no pagamento (vendas novas)
            clienteNome = nomeById.get(String(p.cliente_id)) || '';
          } else if (clientesDisponiveis.length > 0) {
            // Pagamento antigo sem cliente_id: distribuir clientes de forma round-robin
            clienteNome = clientesDisponiveis[idx % clientesDisponiveis.length];
          }
          return {
            ...p,
            cliente_nome: clienteNome,
            finalizadora_nome: p?.finalizadoras?.nome || p?.metodo || '—'
          };
        });
        return { itens: itens || [], pagamentos: pgEnriched };
      };
      let result = await fetchOnce();
      // Retry único se vier tudo vazio (ex.: latência/consistência eventual)
      if ((result.itens.length === 0) && (result.pagamentos.length === 0)) {
        await new Promise(r => setTimeout(r, 700));
        result = await fetchOnce();
      }
      // Aplicar apenas se ainda for a mesma requisição e id
      if (detailReqIdRef.current === myReq && detailOpenRef.current) {
        setDetail({ loading: false, itens: result.itens, pagamentos: result.pagamentos });
      }
    } catch (e) {
      if (detailReqIdRef.current === myReq && detailOpenRef.current) {
        setDetail({ loading: false, itens: [], pagamentos: [] });
      }
      toast({ title: 'Falha ao carregar detalhes', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      clearTimeout(safetyTimer);
      if (detailReqIdRef.current === myReq && detailOpenRef.current) {
        setDetail((prev) => ({ ...prev, loading: false }));
      }
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
    // 1.5) Aplica filtro por Status no client-side também (além do backend)
    const byStatus = byTipo.filter(r => {
      const s = (r.fechado_em ? 'closed' : (r.status || 'open'));
      if (status === 'closed') return s === 'closed';
      if (status === 'open') return s === 'open';
      if (status === 'awaiting-payment') return s === 'awaiting-payment';
      return true;
    });
    // 2) Se não houver termo, retorna somente por Tipo
    if (!term) return byStatus;
    // 3) Aplica busca textual adicional
    return byStatus.filter(r => {
      const mesaTxt = (r.mesaNumero != null ? String(r.mesaNumero) : '').toLowerCase();
      const statusTxt = (r.statusDerived || r.status || '').toLowerCase();
      const clientesTxt = (r.clientesStr || '').toLowerCase();
      const tipoTxt = (r.mesa_id == null) ? 'balcao' : 'comanda';
      return mesaTxt.includes(term) || statusTxt.includes(term) || clientesTxt.includes(term) || tipoTxt.includes(term);
    });
  }, [rows, debouncedSearch, tipo, status]);

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

  // Status de sessão de caixa em português (usado na aba Fechamentos)
  const statusCaixaPt = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'open') return 'Aberto';
    if (v === 'closed') return 'Fechado';
    return '—';
  };

  const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0));

  const statusBadgeClass = (s) => {
    if (s === 'open') return 'text-info bg-info/10 border-info/30';
    if (s === 'awaiting-payment') return 'text-warning bg-warning/10 border-warning/30';
    if (s === 'closed') return 'text-success bg-success/10 border-success/30';
    return 'text-text-secondary bg-transparent border-border/50';
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="min-h-screen flex flex-col">
      <Helmet>
        <title>Histórico - Fluxo7 Arena</title>
        <meta name="description" content="Histórico de vendas, comandas e fechamentos de caixa." />
      </Helmet>

      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <Tabs value="historico" onValueChange={(v) => {
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
        {/* Abas internas do Histórico movidas para a barra superior (lado direito) */}
        <div className="flex items-center gap-3">
          {tab === 'comandas' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsXmlImportOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Importar XML
              </Button>
              <Button variant="outline" size="sm" onClick={exportarCSV}>
                <Download className="mr-1 h-3 w-3" />
                Exportar
              </Button>
              <button
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
                onClick={() => {
                  if (showAll) {
                    // Voltar ao normal (hoje)
                    const hoje = new Date().toISOString().slice(0, 10);
                    setFrom(hoje);
                    setTo(hoje);
                    setShowAll(false);
                  } else {
                    // Mostrar todas
                    setFrom('');
                    setTo('');
                    setShowAll(true);
                  }
                  setOffset(0);
                }}
                title={showAll ? 'Voltar ao filtro de hoje' : 'Mostrar todas as comandas'}
              >
                {showAll ? '◀' : '●'}
              </button>
              <div className="text-xs sm:text-sm text-text-secondary whitespace-nowrap">Total: <span className="font-semibold text-text-primary">R$ {totals.sum.toFixed(2)}</span></div>
            </>
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 text-sm">
              <TabsTrigger value="comandas" className="text-sm">Comandas</TabsTrigger>
              <TabsTrigger value="fechamentos" className="text-sm">Fechamentos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </motion.div>

      {/* Paginação - Comandas */}
      {tab === 'comandas' && (
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-text-secondary">Carregadas {rows.length} {rows.length === 1 ? 'comanda' : 'comandas'}</div>
          {hasMore && (
            <Button size="sm" variant="outline" disabled={loading} onClick={async () => {
              const next = offset + PAGE_LIMIT;
              setOffset(next);
              await load({ append: true });
            }}>Carregar mais</Button>
          )}
        </div>
      )}

      {/* Abas internas foram movidas para o topo; aqui removidas para ganhar espaço */}
      
      {tab === 'comandas' && (
      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <Label className="mb-1 block">Período Inicial</Label>
            <DateInput value={from} onChange={setFrom} />
          </div>
          <div>
            <Label className="mb-1 block">Período Final</Label>
            <DateInput value={to} onChange={setTo} />
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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Selecionar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closed">Fechadas</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="awaiting-payment">Pagamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Selecionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="comanda">Comandas</SelectItem>
                <SelectItem value="balcao">Balcão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>
      )}

      {tab === 'comandas' && (
      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-0 overflow-hidden">
        <div className="overflow-x-auto pr-2 sm:pr-3">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-text-secondary">
              <tr>
                <th className="text-left px-4 py-3 whitespace-nowrap">Mesa</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Tipo</th>
                <th className="text-left px-4 py-3">Clientes</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Finalizadora</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Abertura</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Fechamento</th>
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">Nenhuma comanda encontrada no período.</td></tr>
              )}
              {filtered.map(r => (
                <tr
                  key={r.id}
                  className="border-t border-border/70 hover:bg-warning/10 cursor-pointer transition-all duration-150 hover:translate-x-[1px]"
                  onClick={() => openDetail(r.id)}
                >
                  <td className="px-4 py-2 whitespace-nowrap">{r.mesa_id == null ? 'Balcão' : (r.mesaNumero != null ? `Mesa ${r.mesaNumero}` : '—')}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.mesa_id == null ? 'Balcão' : 'Comanda'}</td>
                  <td className="px-4 py-2 break-words" title={r.clientesStr || ''}>{r.clientesStr || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={cn("inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border", statusBadgeClass(r.statusDerived || r.status))}>
                      {statusPt(r.statusDerived || r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 break-words" title={r.finalizadorasStr || ''}>{r.finalizadorasStr || '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.aberto_em)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.fechado_em)}</td>
                  <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{fmtMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      )}

      {tab === 'fechamentos' && (
      <>
      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="mb-1 block">Período Inicial</Label>
            <DateInput value={from} onChange={setFrom} />
          </div>
          <div>
            <Label className="mb-1 block">Período Final</Label>
            <DateInput value={to} onChange={setTo} />
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4 overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto pr-2 sm:pr-3">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-text-secondary">
              <tr>
                <th className="text-left px-4 py-3">Abertura</th>
                <th className="text-left px-4 py-3">Fechamento</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Saldo Inicial</th>
                <th className="text-right px-4 py-3">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {loading && (!rows || rows.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted"><Loader2 className="inline mr-2 h-4 w-4 animate-spin"/>Carregando fechamentos…</td></tr>
              )}
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">Nenhum fechamento encontrado no período.</td></tr>
              )}
              {(rows || []).map(r => (
                <tr key={r.id} className="border-t border-border/70 hover:bg-success/10 cursor-pointer transition-all duration-150 hover:translate-x-[1px]" onClick={async () => {
                  // Abrir detalhes do fechamento preferindo snapshot e incluindo movimentações
                  try {
                    setCashDetail({ open: true, loading: true, resumo: null, periodo: { from: r.aberto_em, to: r.fechado_em }, movs: [] });
                    const loadResumo = async () => {
                      const [snap, movs] = await Promise.all([
                        getCaixaResumo({ caixaSessaoId: r.id }).catch(() => null),
                        listarMovimentacoesCaixa({ caixaSessaoId: r.id }).catch(() => [])
                      ]);
                      return { snap, movs };
                    };
                    let { snap, movs } = await loadResumo();
                    if (!snap) {
                      // Retry leve se snapshot ainda não disponível
                      await new Promise(rs => setTimeout(rs, 700));
                      ({ snap, movs } = await loadResumo());
                    }
                    if (snap) {
                      // Adaptar snapshot ao formato usado no componente
                      const resumo = {
                        totalVendasBrutas: Number(snap.total_bruto || 0),
                        totalDescontos: Number(snap.total_descontos || 0),
                        totalVendasLiquidas: Number(snap.total_liquido || 0),
                        totalEntradas: Number(snap.total_entradas || 0),
                        totalPorFinalizadora: snap.por_finalizadora || {}
                      }
                      setCashDetail({ open: true, loading: false, resumo, periodo: { from: snap.periodo_de || r.aberto_em, to: snap.periodo_ate || r.fechado_em }, movs: movs || [] });
                    } else {
                      const res = await listarResumoPeriodo({ from: r.aberto_em, to: r.fechado_em || new Date().toISOString() });
                      setCashDetail({ open: true, loading: false, resumo: res || null, periodo: { from: r.aberto_em, to: r.fechado_em }, movs: movs || [] });
                    }
                  } catch (e) {
                    setCashDetail({ open: true, loading: false, resumo: null, periodo: { from: r.aberto_em, to: r.fechado_em }, movs: [] });
                  }
                }}>
                  <td className="px-4 py-2">{fmtDate(r.aberto_em)}</td>
                  <td className="px-4 py-2">{fmtDate(r.fechado_em)}</td>
                  <td className="px-4 py-2">{statusCaixaPt(r.status)}</td>
                  <td className="px-4 py-2 text-right">{r?.saldo_inicial != null ? fmtMoney(r.saldo_inicial) : '—'}</td>
                  <td className="px-4 py-2 text-right">{r?.saldo_final != null ? fmtMoney(r.saldo_final) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      </>
      )}

      {tab === 'comandas' && (
      <Dialog open={!!detailId} onOpenChange={(v) => { if (!v) { detailOpenRef.current = false; setDetailId(null); setDetail({ loading: false, itens: [], pagamentos: [] }); setDetailMeta(null); } else { detailOpenRef.current = true; } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>
                {detailMeta ? (
                  <span>
                    {detailMeta.mesaLabel}
                    {detailMeta.clientesStr ? <span className="text-text-secondary"> • {detailMeta.clientesStr}</span> : null}
                  </span>
                ) : (
                  <>Comanda #{detailId || '—'}</>
                )}
              </span>
              {detailMeta && (
                <div className="flex gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusBadgeClass(detailMeta.status))}>
                    {detailMeta.status === 'closed' ? 'Fechada' : detailMeta.status === 'open' ? 'Aberta' : 'Cancelada'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-info/10 text-info border-info/30">
                    {detailMeta.tipo === 'balcao' ? 'Balcão' : detailMeta.tipo === 'comanda' ? 'Mesa' : 'Importada'}
                  </span>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              {detailMeta ? (
                <>
                  <div>
                    {detailMeta.aberto_em ? <>Abertura: {fmtDate(detailMeta.aberto_em)}</> : '—'}
                    {detailMeta.fechado_em && (
                      <>
                        {" "}•{" "}
                        Fechamento: {fmtDate(detailMeta.fechado_em)}
                        {(() => {
                          const inicio = new Date(detailMeta.aberto_em);
                          const fim = new Date(detailMeta.fechado_em);
                          const diffMs = fim - inicio;
                          const diffMins = Math.floor(diffMs / 60000);
                          const hours = Math.floor(diffMins / 60);
                          const mins = diffMins % 60;
                          return diffMins > 0 ? <span className="text-text-muted"> ({hours > 0 ? `${hours}h ` : ''}{mins}min)</span> : null;
                        })()}
                      </>
                    )}
                  </div>
                  {detailMeta.observacao && (
                    <div className="text-xs text-text-muted">
                      {detailMeta.observacao.includes('Importado de XML') ? (
                        <span className="text-warning">📄 {detailMeta.observacao.split('\n')[0]}</span>
                      ) : (
                        <span>Obs: {detailMeta.observacao}</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>Itens e pagamentos registrados.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {detail.loading ? (
            <div className="p-6 text-center text-text-muted"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando...</div>
          ) : (
            <div className="space-y-4 overflow-y-auto flex-1 px-1">
              {/* Resumo Financeiro */}
              {(() => {
                const subtotalItens = detail.itens.reduce((acc, it) => acc + (Number(it.quantidade||0) * Number(it.preco_unitario||0)), 0);
                const totalDescontos = detail.itens.reduce((acc, it) => acc + Number(it.desconto||0), 0);
                const totalItens = subtotalItens - totalDescontos;
                const totalPagamentos = detail.pagamentos.reduce((acc, pg) => acc + Number(pg.valor||0), 0);
                const diferenca = totalPagamentos - totalItens;
                
                return (
                  <div className="bg-surface-2 rounded-lg p-4 border border-border">
                    <h3 className="font-semibold mb-3">Resumo Financeiro</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Subtotal dos itens:</span>
                        <span className="font-mono">R$ {subtotalItens.toFixed(2)}</span>
                      </div>
                      {totalDescontos > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>Descontos:</span>
                          <span className="font-mono">- R$ {totalDescontos.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t border-border">
                        <span>Total da comanda:</span>
                        <span className="font-mono text-lg">R$ {totalItens.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-success">
                        <span>Total pago:</span>
                        <span className="font-mono">R$ {totalPagamentos.toFixed(2)}</span>
                      </div>
                      {Math.abs(diferenca) > 0.01 && (
                        <div className={cn("flex justify-between", diferenca > 0 ? "text-warning" : "text-danger")}>
                          <span>{diferenca > 0 ? 'Troco/Excedente:' : 'Faltando:'}</span>
                          <span className="font-mono">R$ {Math.abs(diferenca).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* Itens e Pagamentos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-3">
                  <div className="font-semibold mb-2">Itens ({detail.itens.length})</div>
                  {detail.itens.length === 0 ? (
                    <div className="text-sm text-text-muted">Sem itens.</div>
                  ) : (
                    <ul className="text-sm space-y-2 max-h-64 overflow-auto thin-scroll">
                      {detail.itens.map(it => {
                        const subtotal = Number(it.quantidade||0) * Number(it.preco_unitario||0);
                        const desconto = Number(it.desconto||0);
                        const total = subtotal - desconto;
                        return (
                          <li key={it.id} className="border-b border-border/50 pb-2 last:border-0">
                            <div className="flex justify-between items-start gap-2">
                              <span className="flex-1 min-w-0">
                                <div className="font-medium truncate">{it.descricao}</div>
                                <div className="text-xs text-text-muted">
                                  {it.quantidade} x R$ {Number(it.preco_unitario||0).toFixed(2)}
                                  {desconto > 0 && <span className="text-warning"> (desc: R$ {desconto.toFixed(2)})</span>}
                                </div>
                              </span>
                              <span className="font-mono font-semibold whitespace-nowrap">R$ {total.toFixed(2)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="border rounded-md p-3">
                  <div className="font-semibold mb-2">Pagamentos ({detail.pagamentos.length})</div>
                  {detail.pagamentos.length === 0 ? (
                    <div className="text-sm text-text-muted">Sem registros.</div>
                  ) : (
                    <ul className="text-sm space-y-2 max-h-64 overflow-auto thin-scroll">
                      {detail.pagamentos.map(pg => (
                        <li key={pg.id} className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                          <span className="pr-2 break-words flex-1">
                            {pg.cliente_nome ? <div className="font-medium">{pg.cliente_nome}</div> : <div className="text-text-muted">Sem cliente</div>}
                            <div className="text-xs text-text-secondary">{pg.finalizadora_nome || 'Outros'}</div>
                          </span>
                          <span className="font-mono font-semibold whitespace-nowrap">R$ {Number(pg.valor||0).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="secondary" onClick={() => { setDetailId(null); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {tab === 'fechamentos' && (
      <Dialog open={cashDetail.open} onOpenChange={(v) => { if (!v) setCashDetail({ open: false, loading: false, resumo: null, periodo: { from: null, to: null } }); }}>
        <DialogContent className="max-w-2xl" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Fechamento do Período</DialogTitle>
            <DialogDescription>
              {cashDetail.periodo.from ? fmtDate(cashDetail.periodo.from) : '—'}
              {" "}até{" "}
              {cashDetail.periodo.to ? fmtDate(cashDetail.periodo.to) : '—'}
            </DialogDescription>
          </DialogHeader>
          {cashDetail.loading ? (
            <div className="p-4 text-text-muted"><Loader2 className="inline mr-2 h-4 w-4 animate-spin"/>Carregando resumo…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-surface-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Vendas Brutas (itens)</p>
                  <p className="text-xl font-bold">{fmtMoney(cashDetail.resumo?.totalVendasBrutas || 0)}</p>
                </div>
                <div className="bg-surface-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Descontos</p>
                  <p className="text-xl font-bold">{fmtMoney(cashDetail.resumo?.totalDescontos || 0)}</p>
                </div>
                <div className="bg-surface-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Entradas (pagamentos)</p>
                  <p className="text-xl font-bold">{fmtMoney(cashDetail.resumo?.totalEntradas || 0)}</p>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">Por Finalizadora</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cashDetail.resumo?.totalPorFinalizadora && Object.keys(cashDetail.resumo.totalPorFinalizadora).length > 0 ? (
                    Object.entries(cashDetail.resumo.totalPorFinalizadora).map(([metodo, valor]) => (
                      <div key={metodo} className="flex items-center justify-between bg-surface-2 rounded-md p-2 border border-border">
                        <span className="text-sm text-text-secondary">{String(metodo)}</span>
                        <span className="text-sm font-semibold">{fmtMoney(valor)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-text-muted">Sem pagamentos registrados no período.</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-text-muted">Observação: Sangrias, suprimentos e troco ainda não foram implementados.</div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="secondary" onClick={() => setCashDetail({ open: false, loading: false, resumo: null, periodo: { from: null, to: null } })}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
      
      <XMLSalesImportModal
        open={isXmlImportOpen}
        onOpenChange={setIsXmlImportOpen}
        codigoEmpresa={userProfile?.codigo_empresa}
        onSuccess={async (dataEmissao) => {
          setIsXmlImportOpen(false);
          // Ajustar filtro de data para incluir a data da nota
          if (dataEmissao) {
            setFrom(dataEmissao);
            setTo(dataEmissao);
          }
          // Aguardar um pouco para garantir que o banco processou
          await new Promise(resolve => setTimeout(resolve, 500));
          // Resetar offset e recarregar do zero
          setOffset(0);
          await load({ append: false });
        }}
      />
    </motion.div>
  );
}
