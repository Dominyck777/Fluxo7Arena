import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Wallet, CreditCard, CalendarRange, Banknote, ArrowDownCircle, ArrowUpCircle, FileText, Download, Search, Filter, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
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
  listarPagamentos 
} from '@/lib/store';
import { supabase } from '@/lib/supabase';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Estados da Visão Geral
  const [summary, setSummary] = useState(null);
  const [topProdutos, setTopProdutos] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [evolucaoDiaria, setEvolucaoDiaria] = useState([]);
  
  // Estados do Caixa
  const [isOpen, setIsOpen] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [movs, setMovs] = useState([]);
  const [history, setHistory] = useState([]);
  const [movModal, setMovModal] = useState({ open: false, tipo: 'suprimento', valor: '', observacao: '', loading: false });
  
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
      const from = startDate || undefined;
      const to = endDate || undefined;
      const codigo = userProfile?.codigo_empresa;
      
      // Resumo do período
      const sum = await listarResumoPeriodo({ from, to }).catch(() => null);
      setSummary(sum || { totalPorFinalizadora: {}, totalEntradas: 0, totalVendasBrutas: 0, totalDescontos: 0, totalVendasLiquidas: 0 });
      
      // Top 5 Produtos
      if (codigo) {
        let q = supabase
          .from('comanda_itens')
          .select('produto_id, quantidade, preco_unitario, produtos!comanda_itens_produto_id_fkey(nome)')
          .eq('codigo_empresa', codigo);
        
        if (from) q = q.gte('criado_em', new Date(from).toISOString());
        if (to) q = q.lte('criado_em', new Date(to).toISOString());
        
        const { data: itens } = await q;
        
        // Agrupar por produto
        const prodMap = {};
        (itens || []).forEach(item => {
          const nome = item.produtos?.nome || 'Produto sem nome';
          const valor = Number(item.quantidade || 0) * Number(item.preco_unitario || 0);
          prodMap[nome] = (prodMap[nome] || 0) + valor;
        });
        
        const topProds = Object.entries(prodMap)
          .map(([nome, valor]) => ({ nome, valor }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 5);
        
        setTopProdutos(topProds);
      }
      
      // Top 5 Clientes (simplificado - pode melhorar depois)
      setTopClientes([]);
      
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
      const from = startDate || undefined;
      const to = endDate || undefined;
      
      let q = supabase
        .from('pagamentos')
        .select('*, finalizadoras!pagamentos_finalizadora_id_fkey(nome), clientes!pagamentos_cliente_id_fkey(nome)')
        .eq('codigo_empresa', codigo)
        .order('recebido_em', { ascending: false });
      
      if (from) q = q.gte('recebido_em', new Date(from).toISOString());
      if (to) q = q.lte('recebido_em', new Date(to).toISOString());
      
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
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <label className="text-xs text-text-secondary mb-1">Início</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-text-secondary mb-1">Fim</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setPreset('7')}>7 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('30')}>30 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('ytd')}>Ano</Button>
              <Button variant="ghost" size="sm" onClick={() => setPreset('clear')}>Limpar</Button>
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
                    <ReBarChart data={finalizadoraChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#aaa" />
                      <YAxis stroke="#aaa" tickFormatter={(v) => fmtBRL(v)} />
                      <Tooltip formatter={(v) => fmtBRL(v)} labelFormatter={(l) => `Finalizadora: ${l}`} />
                      <Legend />
                      <Bar dataKey="valor" name="Valor" fill="#22c55e" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            {/* Top 5 Produtos e Clientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={itemVariants} className="fx-card p-4">
                <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                  <Package className="w-4 h-4 text-brand" />
                  <span>Top 5 Produtos</span>
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

              <motion.div variants={itemVariants} className="fx-card p-4">
                <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                  <Users className="w-4 h-4 text-brand" />
                  <span>Top 5 Clientes</span>
                </div>
                <div className="text-sm text-text-muted">Em desenvolvimento...</div>
              </motion.div>
            </div>
          </TabsContent>

          {/* ABA 2: CAIXA */}
          <TabsContent value="caixa" className="space-y-6 mt-6">
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Sessão do Caixa</h2>
                <div className="flex gap-2">
                  {!isOpen ? (
                    <Button onClick={async () => {
                      try {
                        setLoading(true);
                        await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
                        await loadCaixa();
                        toast({ title: 'Caixa aberto', description: 'Sessão iniciada com sucesso.' });
                      } catch (e) {
                        toast({ title: 'Falha ao abrir caixa', description: e?.message, variant: 'destructive' });
                      } finally { setLoading(false); }
                    }} size="sm" disabled={loading}>
                      <Wallet className="h-4 w-4 mr-2" /> Abrir Caixa
                    </Button>
                  ) : (
                    <Button onClick={async () => {
                      try {
                        await fecharCaixa({ codigoEmpresa: userProfile?.codigo_empresa });
                        await loadCaixa();
                        toast({ title: 'Caixa fechado', description: 'Sessão encerrada com sucesso.' });
                      } catch (e) {
                        toast({ title: 'Falha ao fechar caixa', description: e?.message, variant: 'destructive' });
                      }
                    }} variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" /> Fechar Caixa
                    </Button>
                  )}
                </div>
              </div>

              {isOpen && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-xs text-text-secondary">Vendas Brutas</p>
                      <p className="text-2xl font-bold tabular-nums">{fmtBRL(sessionSummary?.totalVendasBrutas)}</p>
                    </div>
                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-xs text-text-secondary">Descontos</p>
                      <p className="text-2xl font-bold text-warning tabular-nums">{fmtBRL(sessionSummary?.totalDescontos)}</p>
                    </div>
                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-xs text-text-secondary">Entradas</p>
                      <p className="text-2xl font-bold text-success tabular-nums">
                        {(() => {
                          const supr = movs.filter(m => m.tipo === 'suprimento').reduce((a, b) => a + Number(b.valor || 0), 0);
                          return fmtBRL(Number(sessionSummary?.totalEntradas || 0) + supr);
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Por Finalizadora</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {sessionSummary && sessionSummary.totalPorFinalizadora && Object.keys(sessionSummary.totalPorFinalizadora).length > 0 ? (
                        Object.entries(sessionSummary.totalPorFinalizadora).map(([metodo, valor]) => (
                          <div key={metodo} className="bg-surface-2 rounded-md p-2 border border-border flex items-center justify-between">
                            <span className="text-sm text-text-secondary truncate">{String(metodo)}</span>
                            <span className="text-sm font-semibold">{fmtBRL(valor)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-text-muted">Sem pagamentos na sessão.</div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => setMovModal({ open: true, tipo: 'suprimento', valor: '', observacao: '', loading: false })} variant="outline" size="sm">
                      <ArrowUpCircle className="h-4 w-4 mr-2 text-success" /> Suprimento
                    </Button>
                    <Button onClick={() => setMovModal({ open: true, tipo: 'sangria', valor: '', observacao: '', loading: false })} variant="outline" size="sm">
                      <ArrowDownCircle className="h-4 w-4 mr-2 text-danger" /> Sangria
                    </Button>
                  </div>
                </>
              )}
            </motion.div>

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
                        <TableRow key={h.id}>
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
                <div className="text-center py-8 text-text-muted">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum recebimento encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Finalizadora</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPagamentos.map((pag) => (
                        <TableRow key={pag.id}>
                          <TableCell>{pag.recebido_em ? new Date(pag.recebido_em).toLocaleString('pt-BR') : '—'}</TableCell>
                          <TableCell>{pag.clientes?.nome || '—'}</TableCell>
                          <TableCell>{pag.finalizadoras?.nome || pag.metodo || '—'}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtBRL(pag.valor)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              pag.status === 'Pago' ? 'bg-success/10 text-success' :
                              pag.status === 'Cancelado' ? 'bg-danger/10 text-danger' :
                              'bg-warning/10 text-warning'
                            }`}>
                              {pag.status || 'Pago'}
                            </span>
                          </TableCell>
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
      </motion.div>
    </>
  );
}
