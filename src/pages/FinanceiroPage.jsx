import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Wallet, CreditCard, CalendarRange, Banknote, ArrowDownCircle, ArrowUpCircle, FileText, Download, Search, Filter, DollarSign, ShoppingCart, Users, Package, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { 
  listarResumoPeriodo, 
  listarFechamentosCaixa, 
  ensureCaixaAberto, 
  fecharCaixa, 
  getCaixaAberto, 
  listarResumoSessaoCaixaAtual, 
  criarMovimentacaoCaixa, 
  listarMovimentacoesCaixa,
  listarPagamentos,
  getCaixaResumo
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: 'beforeChildren', staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function KpiCard({ icon: Icon, label, value, delta, positive = true, color = 'brand' }) {
  return (
    <motion.div variants={itemVariants} className="fx-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider">
          <Icon className={`w-4 h-4 text-${color}`} />
          <span>{label}</span>
        </div>
        {delta != null && (
          <div className={`text-xs font-bold ${positive ? 'text-success' : 'text-danger'}`}>
            {positive ? '+' : ''}{delta}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-text-primary tabular-nums">{value}</div>
    </motion.div>
  );
}

export default function FinanceiroPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tab ativa (pode vir da URL)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'visao-geral');
  
  // Estados gerais
  const [loading, setLoading] = useState(false);
  // Inicializar com o mês atual completo
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  
  // Estados da Visão Geral
  const [summary, setSummary] = useState(null);
  const [topProdutos, setTopProdutos] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [allProdutos, setAllProdutos] = useState([]);
  const [allClientes, setAllClientes] = useState([]);
  const [evolucaoDiaria, setEvolucaoDiaria] = useState([]);
  // Modais de listas completas
  const [openProdutosModal, setOpenProdutosModal] = useState(false);
  const [openClientesModal, setOpenClientesModal] = useState(false);
  // Detalhes do cliente selecionado (no modal)
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedClientePagamentos, setSelectedClientePagamentos] = useState([]);
  const [loadingClienteDetalhes, setLoadingClienteDetalhes] = useState(false);
  
  // Estados do Caixa
  const [isOpen, setIsOpen] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [movs, setMovs] = useState([]);
  const [history, setHistory] = useState([]);
  const [movModal, setMovModal] = useState({ open: false, tipo: 'suprimento', valor: '', observacao: '', loading: false });
  // Modal de detalhes de fechamento específico
  const [caixaModalOpen, setCaixaModalOpen] = useState(false);
  const [caixaModalLoading, setCaixaModalLoading] = useState(false);
  const [caixaModalData, setCaixaModalData] = useState(null); // { resumo, movimentacoes, sessao }
  
  // Estados de Recebimentos
  const [pagamentos, setPagamentos] = useState([]);
  const [searchPagamento, setSearchPagamento] = useState('');
  const [filterFinalizadora, setFilterFinalizadora] = useState('all');
  
  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

  const setPreset = (type) => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let start;
    if (type === '7') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = d.toISOString().slice(0, 10);
    } else if (type === '30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      start = d.toISOString().slice(0, 10);
    } else if (type === 'mes') {
      // Mês atual completo
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else if (type === 'ytd') {
      const y = new Date(now.getFullYear(), 0, 1);
      start = y.toISOString().slice(0, 10);
    } else if (type === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }
    setStartDate(start);
    setEndDate(end);
  };

  // Carregar dados da Visão Geral
  const loadVisaoGeral = async () => {
    try {
      setLoading(true);
      const fromISO = mkStart(startDate) || undefined;
      const toISO = mkEnd(endDate) || undefined;
      const codigo = userProfile?.codigo_empresa;
      console.debug('[Financeiro][VisaoGeral] Carregando com período:', { fromISO, toISO, codigo });
      
      // Resumo do período
      const sum = await listarResumoPeriodo({ from: fromISO, to: toISO }).catch(() => null);
      setSummary(sum || { totalPorFinalizadora: {}, totalEntradas: 0, totalVendasBrutas: 0, totalDescontos: 0, totalVendasLiquidas: 0 });
      console.debug('[Financeiro][VisaoGeral] Resumo calculado:', sum);
      
      // Produtos (map completo + top 5)
      if (codigo) {
        // 1) Buscar comandas fechadas no período
        let qc = supabase
          .from('comandas')
          .select('id')
          .eq('status', 'closed');
        if (codigo) qc = qc.eq('codigo_empresa', codigo);
        if (fromISO) qc = qc.gte('fechado_em', fromISO);
        if (toISO) qc = qc.lte('fechado_em', toISO);
        const { data: cmds, error: errCmds } = await qc;
        if (errCmds) throw errCmds;
        const comandaIds = (cmds || []).map(c => c.id);
        console.debug('[Financeiro][VisaoGeral] Comandas fechadas:', comandaIds.length);
        let itens = [];
        if (comandaIds.length > 0) {
          // 2) Trazer itens dessas comandas
          let qi = supabase
            .from('comanda_itens')
            .select('produto_id, quantidade, preco_unitario, produtos!comanda_itens_produto_id_fkey(nome)')
            .in('comanda_id', comandaIds);
          if (codigo) qi = qi.eq('codigo_empresa', codigo);
          const { data: itensData } = await qi;
          itens = itensData || [];
        }
        
        // Agrupar por produto
        const prodMap = {};
        (itens || []).forEach(item => {
          const nome = item.produtos?.nome || 'Produto sem nome';
          const valor = Number(item.quantidade || 0) * Number(item.preco_unitario || 0);
          prodMap[nome] = (prodMap[nome] || 0) + valor;
        });
        
        const produtosArr = Object.entries(prodMap)
          .map(([nome, valor]) => ({ nome, valor }))
          .sort((a, b) => b.valor - a.valor);
        setAllProdutos(produtosArr);
        setTopProdutos(produtosArr.slice(0, 5));
        console.debug('[Financeiro][VisaoGeral] Produtos agregados:', { total: produtosArr.length, top5: produtosArr.slice(0,5) });
      }
      
      // Clientes (map completo + top 5) — via comanda_clientes
      if (codigo) {
        try {
          // 1) Pagamentos do período (por comanda)
          let qPag = supabase
            .from('pagamentos')
            .select('comanda_id, valor, status')
            .eq('codigo_empresa', codigo)
            .neq('status', 'Cancelado')
            .neq('status', 'Estornado');
          if (fromISO) qPag = qPag.gte('recebido_em', fromISO);
          if (toISO) qPag = qPag.lte('recebido_em', toISO);
          const { data: pgs } = await qPag;
          console.debug('[Financeiro][VisaoGeral] Pagamentos carregados:', (pgs||[]).length);

          const comandaIds = Array.from(new Set((pgs || []).map(p => p.comanda_id).filter(Boolean)));
          let vinculos = [];
          if (comandaIds.length > 0) {
            // 2) Buscar clientes vinculados a essas comandas
            let qc = supabase
              .from('comanda_clientes')
              .select('comanda_id, cliente_id, nome_livre')
              .in('comanda_id', comandaIds)
              .eq('codigo_empresa', codigo);
            const { data: vinc } = await qc;
            vinculos = vinc || [];
          }
          console.debug('[Financeiro][VisaoGeral] Vinculos comanda_clientes:', vinculos.length);
          // 3) Mapear id->nome (buscando nomes de clientes quando houver cliente_id)
          const ids = Array.from(new Set(vinculos.map(v => v.cliente_id).filter(Boolean)));
          const clientesById = {};
          if (ids.length > 0) {
            const { data: cliRows } = await supabase
              .from('clientes')
              .select('id, nome')
              .in('id', ids)
              .eq('codigo_empresa', codigo);
            (cliRows || []).forEach(r => { clientesById[r.id] = r.nome; });
          }
          const nomesPorComanda = {};
          vinculos.forEach(v => {
            const nome = v.nome_livre || clientesById[v.cliente_id] || `Cliente ${v.cliente_id || '—'}`;
            if (!nomesPorComanda[v.comanda_id]) nomesPorComanda[v.comanda_id] = new Set();
            if (nome) nomesPorComanda[v.comanda_id].add(nome);
          });
          // 4) Agregar: atribuir o valor do pagamento para cada nome vinculado à comanda
          const clienteMap = {};
          (pgs || []).forEach(pg => {
            const nomes = Array.from(nomesPorComanda[pg.comanda_id] || []);
            const valor = Number(pg.valor || 0);
            if (nomes.length === 0) {
              const key = 'Sem cliente';
              if (!clienteMap[key]) clienteMap[key] = { id: null, nome: key, valor: 0 };
              clienteMap[key].valor += valor;
            } else {
              nomes.forEach(nome => {
                if (!clienteMap[nome]) clienteMap[nome] = { id: null, nome, valor: 0 };
                clienteMap[nome].valor += valor;
              });
            }
          });

          // 5) Somar agendamentos (participantes pagos no período) via view v_agendamento_participantes
          try {
            const nomeByClienteId = new Map(Object.values(clientesById).map((n, i) => [Object.keys(clientesById)[i], n]));
            // Passo A: trazer participantes (sem filtro de data, pois a view não expõe pago_em)
            let qa = supabase
              .from('v_agendamento_participantes')
              .select('agendamento_id, cliente_id, valor_cota, status_pagamento, status_pagamento_text');
            if (codigo) qa = qa.eq('codigo_empresa', codigo);
            let { data: parts } = await qa;
            parts = parts || [];
            // Passo B: filtrar por período usando a data de início do agendamento
            const agIds = Array.from(new Set(parts.map(p => p.agendamento_id).filter(Boolean)));
            let agInRange = new Set();
            if (agIds.length > 0) {
              let qag = supabase
                .from('agendamentos')
                .select('id, inicio')
                .in('id', agIds);
              if (codigo) qag = qag.eq('codigo_empresa', codigo);
              const { data: agRows } = await qag;
              const fromMs = fromISO ? new Date(fromISO).getTime() : null;
              const toMs = toISO ? new Date(toISO).getTime() : null;
              (agRows || []).forEach(a => {
                const t = a?.inicio ? new Date(a.inicio).getTime() : null;
                const ok = t != null && (fromMs == null || t >= fromMs) && (toMs == null || t <= toMs);
                if (ok) agInRange.add(a.id);
              });
            }
            const partsInRange = parts.filter(p => agInRange.has(p.agendamento_id));
            console.debug('[Financeiro][Agendamentos] participantes no período (by agendamento.inicio):', partsInRange.length);
            // Completar nomes ausentes consultando clientes quando necessário
            const idsFromParts = Array.from(new Set((partsInRange||[]).map(p => p.cliente_id).filter(Boolean).map(String)));
            const missingIds = idsFromParts.filter(id => !nomeByClienteId.has(id));
            if (missingIds.length > 0) {
              const { data: cliExtra } = await supabase
                .from('clientes')
                .select('id,nome')
                .in('id', missingIds);
              (cliExtra || []).forEach(c => nomeByClienteId.set(String(c.id), c.nome));
            }
            (partsInRange || []).forEach(p => {
              const ok = String(p.status_pagamento || p.status_pagamento_text || 'pago').toLowerCase();
              if (['cancelado','estornado'].includes(ok)) return;
              const id = p.cliente_id;
              const nome = id ? (nomeByClienteId.get(String(id)) || `Cliente ${id}`) : null;
              if (!nome) return; // sem cliente vinculado, ignorar por ora
              const v = Number(p.valor_cota || 0);
              if (!clienteMap[nome]) clienteMap[nome] = { id: id || null, nome, valor: 0 };
              clienteMap[nome].valor += v;
            });
          } catch {}

          const clientesArr = Object.values(clienteMap).sort((a, b) => b.valor - a.valor);
          setAllClientes(clientesArr);
          setTopClientes(clientesArr.slice(0, 5));
          console.debug('[Financeiro][VisaoGeral] Clientes agregados:', { total: clientesArr.length, top5: clientesArr.slice(0,5) });
        } catch (err) {
          console.error('Erro ao carregar top clientes:', err);
          setTopClientes([]);
          setAllClientes([]);
        }
      }
      
    } catch (e) {
      toast({ title: 'Falha ao carregar visão geral', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados do Caixa
  const loadCaixa = async () => {
    try {
      const codigo = userProfile?.codigo_empresa;
      const sess = await getCaixaAberto({ codigoEmpresa: codigo });
      setIsOpen(!!sess);
      
      if (sess) {
        const [sum, movsList] = await Promise.all([
          listarResumoSessaoCaixaAtual({ codigoEmpresa: codigo }),
          listarMovimentacoesCaixa({ caixaSessaoId: sess.id, codigoEmpresa: codigo })
        ]);
        setSessionSummary(sum || null);
        setMovs(movsList || []);
      } else {
        setSessionSummary(null);
        setMovs([]);
      }
      
      // Histórico
      const hist = await listarFechamentosCaixa({ limit: 50, codigoEmpresa: codigo });
      setHistory(hist || []);
    } catch (e) {
      toast({ title: 'Falha ao carregar caixa', description: e?.message, variant: 'destructive' });
    }
  };

  // Carregar Recebimentos
  const loadRecebimentos = async () => {
    try {
      setLoading(true);
      const codigo = userProfile?.codigo_empresa;
      const fromISO = mkStart(startDate) || undefined;
      const toISO = mkEnd(endDate) || undefined;
      
      let q = supabase
        .from('pagamentos')
        .select('*, finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
        .eq('codigo_empresa', codigo)
        .order('recebido_em', { ascending: false });
      
      if (fromISO) q = q.gte('recebido_em', fromISO);
      if (toISO) q = q.lte('recebido_em', toISO);
      
      const { data, error } = await q;
      if (error) throw error;
      
      setPagamentos(data || []);
    } catch (e) {
      toast({ title: 'Falha ao carregar recebimentos', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Atualizar tab na URL
  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab]);

  // Helpers para início/fim do dia (limites inclusivos)
  const mkStart = (d) => {
    if (!d) return null;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day, 0, 0, 0, 0).toISOString();
    }
    return new Date(d).toISOString();
  };
  const mkEnd = (d) => {
    if (!d) return null;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day, 23, 59, 59, 999).toISOString();
    }
    return new Date(d).toISOString();
  };

  // Carregar dados quando mudar de aba ou período
  useEffect(() => {
    if (!userProfile?.codigo_empresa) return;
    
    if (activeTab === 'visao-geral') {
      loadVisaoGeral();
    } else if (activeTab === 'caixa') {
      loadCaixa();
    } else if (activeTab === 'recebimentos') {
      loadRecebimentos();
    }
  }, [activeTab, startDate, endDate, userProfile?.codigo_empresa]);

  // Dados do gráfico por finalizadora
  const finalizadoraChart = useMemo(() => {
    const src = summary?.totalPorFinalizadora || {};
    const arr = Object.entries(src).map(([name, valor]) => ({ name, valor: Number(valor || 0) }));
    arr.sort((a, b) => b.valor - a.valor);
    return arr;
  }, [summary]);

  // Filtrar pagamentos
  const filteredPagamentos = useMemo(() => {
    let result = pagamentos;
    
    if (searchPagamento) {
      const term = searchPagamento.toLowerCase();
      result = result.filter(p => 
        (p.clientes?.nome || '').toLowerCase().includes(term) ||
        (p.finalizadoras?.nome || '').toLowerCase().includes(term) ||
        String(p.valor || '').includes(term)
      );
    }
    
    if (filterFinalizadora !== 'all') {
      result = result.filter(p => p.finalizadora_id === filterFinalizadora);
    }
    
    return result;
  }, [pagamentos, searchPagamento, filterFinalizadora]);

  return (
    <>
      <Helmet>
        <title>Financeiro - Fluxo7 Arena</title>
        <meta name="description" content="Gestão financeira completa: visão geral, caixa, recebimentos e relatórios." />
      </Helmet>
      
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Header com filtros de período */}
        <motion.div variants={itemVariants} className="fx-card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Financeiro</h1>
              <p className="text-sm text-text-secondary">Gestão completa das finanças da empresa</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col justify-center">
                <label className="text-xs text-text-secondary mb-1">Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-[160px] pl-3 pr-3 flex items-center gap-2 justify-start text-left font-medium bg-black border-warning/40 text-white hover:bg-black/80 hover:border-warning">
                      <CalendarIcon className="h-5 w-5 text-warning flex-shrink-0" />
                      <span className="font-mono tracking-wide text-sm leading-none">{startDate ? format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-black border-warning/40" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate ? new Date(startDate + 'T00:00:00') : undefined}
                      onSelect={(date) => date && setStartDate(format(date, 'yyyy-MM-dd'))}
                      initialFocus
                      classNames={{
                        caption_label: 'text-sm font-medium text-white',
                        head_cell: 'text-xs text-warning/80 w-9',
                        day: 'h-9 w-9 p-0 font-normal text-white hover:bg-warning/10 rounded-md',
                        day_selected: 'bg-warning text-black hover:bg-warning focus:bg-warning',
                        day_today: 'border border-warning text-white',
                        day_outside: 'text-white/30',
                        nav_button: 'h-7 w-7 p-0 text-white hover:bg-warning/10 rounded-md border-warning/40',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col justify-center">
                <label className="text-xs text-text-secondary mb-1">Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-[160px] pl-3 pr-3 flex items-center gap-2 justify-start text-left font-medium bg-black border-warning/40 text-white hover:bg-black/80 hover:border-warning">
                      <CalendarIcon className="h-5 w-5 text-warning flex-shrink-0" />
                      <span className="font-mono tracking-wide text-sm leading-none">{endDate ? format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-black border-warning/40" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate ? new Date(endDate + 'T00:00:00') : undefined}
                      onSelect={(date) => date && setEndDate(format(date, 'yyyy-MM-dd'))}
                      initialFocus
                      classNames={{
                        caption_label: 'text-sm font-medium text-white',
                        head_cell: 'text-xs text-warning/80 w-9',
                        day: 'h-9 w-9 p-0 font-normal text-white hover:bg-warning/10 rounded-md',
                        day_selected: 'bg-warning text-black hover:bg-warning focus:bg-warning',
                        day_today: 'border border-warning text-white',
                        day_outside: 'text-white/30',
                        nav_button: 'h-7 w-7 p-0 text-white hover:bg-warning/10 rounded-md border-warning/40',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {/* Presets removidos a pedido do usuário - ficam apenas os dois calendários */}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="caixa">Caixa</TabsTrigger>
            <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          {/* ABA 1: VISÃO GERAL */}
          <TabsContent value="visao-geral" className="space-y-6 mt-6">
            {/* KPIs */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={TrendingUp} label="Vendas Brutas" value={fmtBRL(summary?.totalVendasBrutas)} color="success" />
              <KpiCard icon={CreditCard} label="Descontos" value={fmtBRL(summary?.totalDescontos)} positive={false} color="warning" />
              <KpiCard icon={TrendingUp} label="Vendas Líquidas" value={fmtBRL(summary?.totalVendasLiquidas)} color="brand" />
              <KpiCard icon={Wallet} label="Entradas" value={fmtBRL(summary?.totalEntradas)} color="success" />
            </motion.div>

            {/* Gráfico por Finalizadora */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  <CreditCard className="w-4 h-4 text-brand" />
                  <span>Entradas por Finalizadora</span>
                </div>
              </div>
              {finalizadoraChart.length === 0 ? (
                <div className="text-sm text-text-muted">Sem pagamentos no período.</div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={finalizadoraChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#aaa" />
                      <YAxis stroke="#aaa" tickFormatter={(v) => fmtBRL(v)} width={80} />
                      <Tooltip 
                        formatter={(v) => fmtBRL(v)} 
                        labelFormatter={(l) => `Finalizadora: ${l}`}
                        contentStyle={{
                          background: 'rgba(10, 10, 10, 0.95)',
                          border: '1px solid #fbbf24',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#fff'
                        }}
                        cursor={{ fill: 'rgba(251, 191, 36, 0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="valor" name="Valor" fill="#fbbf24" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            {/* Top 5 Produtos e Clientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={itemVariants} className="fx-card p-4 border-0 ring-0 outline-none focus-visible:outline-none shadow-none cursor-pointer" onClick={() => setOpenProdutosModal(true)}>
                <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                  <Package className="w-4 h-4 text-brand" />
                  <span>Produtos (por faturamento)</span>
                  {allProdutos.length > 5 && (
                    <Button variant="outline" size="xs" className="ml-auto h-7 px-2" onClick={() => setOpenProdutosModal(true)}>Ver todos</Button>
                  )}
                </div>
                {topProdutos.length === 0 ? (
                  <div className="text-sm text-text-muted">Sem dados no período.</div>
                ) : (
                  <div className="space-y-2">
                    {topProdutos.map((prod, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm text-text-primary">{idx + 1}. {prod.nome}</span>
                        <span className="text-sm font-bold text-success">{fmtBRL(prod.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="fx-card p-4 border-0 ring-0 outline-none focus-visible:outline-none shadow-none cursor-pointer" onClick={() => setOpenClientesModal(true)}>
                <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                  <Users className="w-4 h-4 text-brand" />
                  <span>Clientes (por valor pago)</span>
                  {allClientes.length > 5 && (
                    <Button variant="outline" size="xs" className="ml-auto h-7 px-2" onClick={() => setOpenClientesModal(true)}>Ver todos</Button>
                  )}
                </div>
                {topClientes.length === 0 ? (
                  <div className="text-sm text-text-muted">Sem dados no período.</div>
                ) : (
                  <div className="space-y-2">
                    {topClientes.map((cliente, idx) => (
                      <button key={idx} className="w-full flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-surface-2 rounded-sm px-2 text-left"
                        onClick={() => { setSelectedCliente(cliente); setOpenClientesModal(true); }}>
                        <span className="text-sm text-text-primary">{idx + 1}. {cliente.nome}</span>
                        <span className="text-sm font-bold text-success">{fmtBRL(cliente.valor)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </TabsContent>

          {/* ABA 2: CAIXA */}
          <TabsContent value="caixa" className="space-y-6 mt-6">
            {/* Histórico de Fechamentos */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <h3 className="text-base font-bold mb-3">Fechamentos Anteriores</h3>
              {history.length === 0 ? (
                <div className="text-sm text-text-secondary">Nenhum fechamento encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aberto em</TableHead>
                        <TableHead>Fechado em</TableHead>
                        <TableHead className="text-right">Saldo Inicial</TableHead>
                        <TableHead className="text-right">Saldo Final</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id} className="cursor-pointer hover:bg-surface-2" onClick={async () => {
                          setCaixaModalOpen(true);
                          setCaixaModalLoading(true);
                          setCaixaModalData(null);
                          try {
                            const codigo = userProfile?.codigo_empresa;
                            const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                            console.log('[Caixa][Fechamento][Open]', { sessaoId: h.id, from: h.aberto_em, to: h.fechado_em, codigo });
                            // Tentar snapshot pronto
                            let resumoSnap = await getCaixaResumo({ caixaSessaoId: h.id, codigoEmpresa: codigo });
                            // Normalizador para alinhar snapshot ao formato da UI
                            const normalizeResumo = (r) => {
                              if (!r) return null;
                              // Snapshot (caixa_resumos) usa chaves diferentes
                              if (r.total_bruto != null || r.por_finalizadora != null) {
                                let porFin = r.por_finalizadora;
                                if (porFin && typeof porFin === 'string') {
                                  try { porFin = JSON.parse(porFin); } catch { porFin = {}; }
                                }
                                return {
                                  from: r.periodo_de || null,
                                  to: r.periodo_ate || null,
                                  totalPorFinalizadora: porFin || {},
                                  totalEntradas: Number(r.total_entradas || 0),
                                  totalVendasBrutas: Number(r.total_bruto || 0),
                                  totalDescontos: Number(r.total_descontos || 0),
                                  totalVendasLiquidas: Number(r.total_liquido || 0),
                                };
                              }
                              // Já no formato de período
                              return r;
                            };
                            let resumo = normalizeResumo(resumoSnap);
                            if (!resumo) {
                              console.log('[Caixa][Fechamento] Snapshot ausente, calculando resumo por período...');
                              // Calcular dinâmico via período do fechamento
                              resumo = await listarResumoPeriodo({ from: h.aberto_em, to: h.fechado_em || new Date().toISOString(), codigoEmpresa: codigo });
                            }
                            // Fallback: se não houver totalPorFinalizadora, calcular diretamente dos pagamentos
                            const needFallbackPF = !resumo || !resumo.totalPorFinalizadora || Object.keys(resumo.totalPorFinalizadora).length === 0;
                            if (needFallbackPF) {
                              try {
                                const fromIso = h.aberto_em;
                                const toIso = h.fechado_em || new Date().toISOString();
                                let qp = supabase
                                  .from('pagamentos')
                                  .select('metodo, valor, status, recebido_em, finalizadoras:finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
                                  .gte('recebido_em', fromIso)
                                  .lte('recebido_em', toIso);
                                if (codigo) qp = qp.eq('codigo_empresa', codigo);
                                const { data: pays } = await qp;
                                const map = {};
                                let totalEntradas = 0;
                                for (const pg of (pays || [])) {
                                  const ok = (pg.status || 'Pago') !== 'Cancelado' && (pg.status || 'Pago') !== 'Estornado';
                                  if (!ok) continue;
                                  const key = (pg.finalizadoras?.nome) || pg.metodo || 'Outros';
                                  const v = Number(pg.valor || 0);
                                  map[key] = (map[key] || 0) + v;
                                  totalEntradas += v;
                                }
                                resumo = {
                                  ...(resumo || {}),
                                  totalPorFinalizadora: map,
                                  totalEntradas: Number(resumo?.totalEntradas || 0) || totalEntradas,
                                };
                                console.log('[Caixa][Fechamento][FallbackPF]', { methods: Object.keys(map).length });
                              } catch {}
                            }
                            // Movimentações da sessão
                            const movimentacoes = await listarMovimentacoesCaixa({ caixaSessaoId: h.id, codigoEmpresa: codigo });
                            // Recebimentos no período do fechamento
                            const fromIso = h.aberto_em;
                            const toIso = h.fechado_em || new Date().toISOString();
                            let qpDet = supabase
                              .from('pagamentos')
                              .select('id, valor, status, metodo, recebido_em, finalizadoras:finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
                              .gte('recebido_em', fromIso)
                              .lte('recebido_em', toIso)
                              .order('recebido_em', { ascending: false });
                            if (codigo) qpDet = qpDet.eq('codigo_empresa', codigo);
                            const { data: pagamentosDet } = await qpDet;
                            console.log('[Caixa][Fechamento][Pays]', { count: (pagamentosDet||[]).length });
                            setCaixaModalData({ resumo, movimentacoes, pagamentos: (pagamentosDet||[]), sessao: h });
                            const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                            const movCount = Array.isArray(movimentacoes) ? movimentacoes.length : 0;
                            const finCount = resumo && resumo.totalPorFinalizadora ? Object.keys(resumo.totalPorFinalizadora).length : 0;
                            console.log('[Caixa][Fechamento][Loaded]', { sessaoId: h.id, finCount, movCount, ms: Math.round(t1 - t0) });
                          } catch (e) {
                            console.error('[Caixa][Fechamento][Error]', { sessaoId: h.id, message: e?.message, code: e?.code });
                            toast({ title: 'Falha ao carregar fechamento', description: e?.message || 'Tente novamente', variant: 'destructive' });
                          } finally {
                            setCaixaModalLoading(false);
                          }
                        }}>
                          <TableCell>{h.aberto_em ? new Date(h.aberto_em).toLocaleString('pt-BR') : '—'}</TableCell>
                          <TableCell>{h.fechado_em ? new Date(h.fechado_em).toLocaleString('pt-BR') : '—'}</TableCell>
                          <TableCell className="text-right">{fmtBRL(h.saldo_inicial)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(h.saldo_final)}</TableCell>
                          <TableCell>{String(h.status || '').toLowerCase() === 'open' ? 'Aberto' : 'Fechado'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ABA 3: RECEBIMENTOS */}
          <TabsContent value="recebimentos" className="space-y-6 mt-6">
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Todos os Recebimentos</h2>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input
                      placeholder="Buscar..."
                      value={searchPagamento}
                      onChange={(e) => setSearchPagamento(e.target.value)}
                      className="pl-10 w-[200px]"
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" /> Exportar
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent"></div>
                  <p className="mt-4 text-text-muted">Carregando...</p>
                </div>
              ) : filteredPagamentos.length === 0 ? (
                <div className="text-sm text-text-muted">Sem registros no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Finalizadora</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPagamentos.map((pg) => (
                        <TableRow key={pg.id}>
                          <TableCell>{pg.recebido_em ? new Date(pg.recebido_em).toLocaleString('pt-BR') : '—'}</TableCell>
                          <TableCell>{pg.finalizadoras?.nome || pg.metodo || '—'}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtBRL(pg.valor)}</TableCell>
                          <TableCell>{pg.status || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ABA 4: RELATÓRIOS */}
          <TabsContent value="relatorios" className="space-y-6 mt-6">
            <motion.div variants={itemVariants} className="fx-card p-4">
              <h2 className="text-lg font-bold mb-4">Relatórios Financeiros</h2>
              <div className="text-center py-12 text-text-muted">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">Em Desenvolvimento</p>
                <p className="text-sm">Os relatórios detalhados estarão disponíveis em breve.</p>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Modal: Todos os Produtos */}
        <Dialog open={openProdutosModal} onOpenChange={setOpenProdutosModal}>
          <DialogContent className="max-w-2xl bg-surface text-text-primary border-0">
            <DialogHeader>
              <DialogTitle>Todos os Produtos</DialogTitle>
              <DialogDescription>Ordenados por faturamento no período selecionado</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProdutos.map((p, i) => (
                    <TableRow key={`${p.nome}-${i}`}>
                      <TableCell>{i + 1}. {p.nome}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(p.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Detalhes do Fechamento do Caixa */}
        <Dialog open={caixaModalOpen} onOpenChange={setCaixaModalOpen}>
          <DialogContent className="sm:max-w-[900px] w-full max-h-[85vh] overflow-y-auto bg-surface text-text-primary border-0">
            <DialogHeader>
              <DialogTitle>Fechamento do Caixa</DialogTitle>
              <DialogDescription>
                {caixaModalData?.sessao?.aberto_em ? `${new Date(caixaModalData.sessao.aberto_em).toLocaleString('pt-BR')}` : '—'}
                {caixaModalData?.sessao?.fechado_em ? ` → ${new Date(caixaModalData.sessao.fechado_em).toLocaleString('pt-BR')}` : ''}
              </DialogDescription>
            </DialogHeader>
            {caixaModalLoading ? (
              <div className="text-sm text-text-muted">Carregando...</div>
            ) : !caixaModalData ? (
              <div className="text-sm text-text-muted">Sem dados.</div>
            ) : (
              <div className="space-y-6">
                {/* KPIs de Saldo da Sessão */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Saldo Inicial</p>
                    <p className="text-2xl font-bold tabular-nums">{fmtBRL(caixaModalData.sessao?.saldo_inicial)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Entradas</p>
                    <p className="text-2xl font-bold text-success tabular-nums">{
                      (() => {
                        const si = Number(caixaModalData.sessao?.saldo_inicial || 0);
                        const sf = Number(caixaModalData.sessao?.saldo_final || 0);
                        const ent = sf - si;
                        return fmtBRL(ent);
                      })()
                    }</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Saldo Final</p>
                    <p className="text-2xl font-bold tabular-nums">{fmtBRL(caixaModalData.sessao?.saldo_final)}</p>
                  </div>
                </div>

                {/* KPIs de Vendas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Bruto</p>
                    <p className="text-2xl font-bold tabular-nums">{fmtBRL(caixaModalData.resumo?.totalVendasBrutas)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Descontos</p>
                    <p className="text-2xl font-bold text-warning tabular-nums">{fmtBRL(caixaModalData.resumo?.totalDescontos)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Líquido</p>
                    <p className="text-2xl font-bold tabular-nums">{fmtBRL(caixaModalData.resumo?.totalVendasLiquidas)}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Entradas por Finalizadora</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {caixaModalData.resumo?.totalPorFinalizadora && Object.keys(caixaModalData.resumo.totalPorFinalizadora).length > 0 ? (
                      Object.entries(caixaModalData.resumo.totalPorFinalizadora).map(([metodo, valor]) => (
                        <div key={metodo} className="bg-surface-2 rounded-md p-2 border border-border flex items-center justify-between">
                          <span className="text-sm text-text-secondary truncate">{String(metodo)}</span>
                          <span className="text-sm font-semibold">{fmtBRL(valor)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-text-muted">Sem pagamentos.</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Movimentações</h4>
                  {(!caixaModalData.movimentacoes || caixaModalData.movimentacoes.length === 0) ? (
                    <div className="text-sm text-text-muted">Sem movimentações nesta sessão.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Obs</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {caixaModalData.movimentacoes.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>{m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : '—'}</TableCell>
                              <TableCell className="capitalize">{m.tipo || '—'}</TableCell>
                              <TableCell className="truncate max-w-[280px]" title={m.observacao || ''}>{m.observacao || '—'}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtBRL(m.valor)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Recebimentos</h4>
                  {(!caixaModalData.pagamentos || caixaModalData.pagamentos.length === 0) ? (
                    <div className="text-sm text-text-muted">Sem recebimentos no período deste caixa.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Finalizadora</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {caixaModalData.pagamentos.map((pg) => (
                            <TableRow key={pg.id}>
                              <TableCell>{pg.recebido_em ? new Date(pg.recebido_em).toLocaleString('pt-BR') : '—'}</TableCell>
                              <TableCell>{pg.finalizadoras?.nome || pg.metodo || '—'}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtBRL(pg.valor)}</TableCell>
                              <TableCell>{pg.status || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal: Clientes (lista + detalhes) */}
        <Dialog open={openClientesModal} onOpenChange={(v) => { setOpenClientesModal(v); if (!v) { setSelectedCliente(null); setSelectedClientePagamentos([]); } }}>
          <DialogContent className="max-w-3xl bg-surface text-text-primary border-0">
            <DialogHeader>
              <DialogTitle>Clientes</DialogTitle>
              <DialogDescription>Ordenados por valor pago no período selecionado</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="max-h-[60vh] overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allClientes.map((c, idx) => (
                      <TableRow key={`${c.nome}-${idx}`} className={`cursor-pointer ${selectedCliente?.nome === c.nome ? 'bg-brand/10' : ''}`} onClick={async () => {
                        setSelectedCliente(c);
                        setLoadingClienteDetalhes(true);
                        try {
                          const fromISO = mkStart(startDate);
                          const toISO = mkEnd(endDate);
                          const nomeAlvo = (c.nome || '').trim();
                          const codigo = userProfile?.codigo_empresa;
                          // 1) Buscar possíveis clientes cujo nome case-insensitive contenha o alvo
                          let qCli = supabase
                            .from('clientes')
                            .select('id, nome')
                            .eq('codigo_empresa', codigo)
                            .ilike('nome', `%${nomeAlvo}%`);
                          const { data: cliMatch } = await qCli;
                          const idMatches = new Set((cliMatch || []).map(r => r.id));
                          // 2a) Vínculos por nome_livre ilike
                          let qV1 = supabase
                            .from('comanda_clientes')
                            .select('comanda_id')
                            .eq('codigo_empresa', codigo)
                            .ilike('nome_livre', `%${nomeAlvo}%`);
                          const { data: vincNome } = await qV1;
                          // 2b) Vínculos por cliente_id
                          let comIdsSet = new Set((vincNome || []).map(v => v.comanda_id));
                          if (idMatches.size > 0) {
                            let qV2 = supabase
                              .from('comanda_clientes')
                              .select('comanda_id, cliente_id')
                              .eq('codigo_empresa', codigo)
                              .in('cliente_id', Array.from(idMatches));
                            const { data: vincCli } = await qV2;
                            (vincCli || []).forEach(v => comIdsSet.add(v.comanda_id));
                          }
                          const comIds = Array.from(comIdsSet);
                          let qp = supabase
                            .from('pagamentos')
                            .select('id, valor, recebido_em, metodo, finalizadoras!pagamentos_finalizadora_id_fkey(nome), comanda_id, status')
                            .in('comanda_id', comIds)
                            .neq('status','Cancelado')
                            .neq('status','Estornado')
                            .order('recebido_em', { ascending: false })
                            .limit(50);
                          if (fromISO) qp = qp.gte('recebido_em', fromISO);
                          if (toISO) qp = qp.lte('recebido_em', toISO);
                          const { data } = await qp;
                          const rows = data || [];
                          // Mapear origem dos pagamentos
                          const comIdsInPg = Array.from(new Set(rows.map(r => r.comanda_id).filter(Boolean)));
                          const origemByComanda = {};
                          if (comIdsInPg.length > 0) {
                            // Carregar comandas (tipo, mesa)
                            let qCom = supabase
                              .from('comandas')
                              .select('id, tipo, mesa_id')
                              .in('id', comIdsInPg);
                            const { data: comRows } = await qCom;
                            const mesaIds = Array.from(new Set((comRows || []).map(c => c.mesa_id).filter(Boolean)));
                            const mesaNumById = {};
                            if (mesaIds.length > 0) {
                              let qMesas = supabase
                                .from('mesas')
                                .select('id, numero, nome')
                                .in('id', mesaIds);
                              const { data: mesaRows } = await qMesas;
                              (mesaRows || []).forEach(m => { mesaNumById[m.id] = (m.nome || `Mesa ${m.numero || ''}`).trim(); });
                            }
                            (comRows || []).forEach(c => {
                              let origem = '—';
                              const t = String(c?.tipo || '').toLowerCase();
                              if (t === 'balcao' || t === 'balcão') origem = 'Balcão';
                              else if (t === 'mesa' || c.mesa_id) origem = mesaNumById[c.mesa_id] || 'Mesa';
                              else if (t === 'agendamento') origem = 'Agendamento';
                              origemByComanda[c.id] = origem;
                            });
                          }
                          let enriched = rows.map(r => ({ ...r, origem: r.comanda_id ? (origemByComanda[r.comanda_id] || '—') : '—' }));

                          // Incluir pagamentos de agendamento (participantes pagos) via v_agendamento_participantes
                          try {
                            const codigo = userProfile?.codigo_empresa;
                            // Construir idMatches por nome do cliente (já fizemos acima ao clicar)
                            let paCli = [];
                            if (idMatches && idMatches.size > 0) {
                              let qa2 = supabase
                                .from('v_agendamento_participantes')
                                .select('id, agendamento_id, cliente_id, valor_cota, status_pagamento, status_pagamento_text')
                                .in('cliente_id', Array.from(idMatches));
                              if (codigo) qa2 = qa2.eq('codigo_empresa', codigo);
                              const { data: pa2 } = await qa2; paCli = pa2 || [];
                              if (paCli.length === 0 && codigo) {
                                let qa2b = supabase
                                  .from('v_agendamento_participantes')
                                  .select('id, agendamento_id, cliente_id, valor_cota, status_pagamento, status_pagamento_text')
                                  .in('cliente_id', Array.from(idMatches));
                                const { data: pa2b } = await qa2b; paCli = pa2b || [];
                              }
                            }
                            // Filtrar por período usando agendamentos.inicio
                            let merged = [...paCli];
                            const agIds = Array.from(new Set(merged.map(p => p.agendamento_id).filter(Boolean)));
                            let agInRange = new Set();
                            const agInicioById = {};
                            if (agIds.length > 0) {
                              let qag = supabase
                                .from('agendamentos')
                                .select('id, inicio')
                                .in('id', agIds);
                              if (codigo) qag = qag.eq('codigo_empresa', codigo);
                              const { data: agRows } = await qag;
                              const fromMs = fromISO ? new Date(fromISO).getTime() : null;
                              const toMs = toISO ? new Date(toISO).getTime() : null;
                              (agRows || []).forEach(a => {
                                const t = a?.inicio ? new Date(a.inicio).getTime() : null;
                                const ok = t != null && (fromMs == null || t >= fromMs) && (toMs == null || t <= toMs);
                                if (ok) agInRange.add(a.id);
                                if (a?.id) agInicioById[a.id] = a.inicio || null;
                              });
                            }
                            merged = merged.filter(p => agInRange.has(p.agendamento_id));
                            const seen = new Set();
                            console.debug('[Financeiro][Agendamentos][Detalhe] encontrados:', merged.length);
                            merged.forEach(p => {
                              const key = `${p.id}`;
                              if (seen.has(key)) return; seen.add(key);
                              const ok = String(p.status_pagamento || p.status_pagamento_text || 'pago').toLowerCase();
                              if (['cancelado','estornado'].includes(ok)) return;
                              const metodoNome = p.finalizadora_nome || p.metodo || p.metodo_pagamento || p.forma_pagamento || 'Agendamento';
                              enriched.push({
                                id: `ag-${p.id}`,
                                recebido_em: agInicioById[p.agendamento_id] || null,
                                finalizadoras: metodoNome ? { nome: metodoNome } : null,
                                metodo: metodoNome,
                                origem: 'Agendamento',
                                valor: p.valor_cota,
                              });
                            });
                          } catch {}

                          setSelectedClientePagamentos(enriched);
                        } finally {
                          setLoadingClienteDetalhes(false);
                        }
                      }}>
                        <TableCell>{c.nome}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(c.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="max-h-[60vh] overflow-y-auto overflow-x-auto pr-1">
                {!selectedCliente ? (
                  <div className="text-sm text-text-muted p-4">Selecione um cliente para ver detalhes</div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Detalhes de {selectedCliente.nome}</h4>
                    {loadingClienteDetalhes ? (
                      <div className="text-sm text-text-muted">Carregando...</div>
                    ) : selectedClientePagamentos.length === 0 ? (
                      <div className="text-sm text-text-muted">Sem pagamentos no período.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Finalizadora</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedClientePagamentos.map((pg) => (
                            <TableRow key={pg.id}>
                              <TableCell>{pg.recebido_em ? new Date(pg.recebido_em).toLocaleString('pt-BR') : '—'}</TableCell>
                              <TableCell>{pg.finalizadoras?.nome || pg.metodo || '—'}</TableCell>
                              <TableCell>{pg.origem || '—'}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtBRL(pg.valor)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  );
}
