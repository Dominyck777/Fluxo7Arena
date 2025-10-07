import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, Wallet, CreditCard, CalendarRange } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listarResumoPeriodo, listarFechamentosCaixa } from '@/lib/store';

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

function KpiCard({ icon: Icon, label, value, delta, positive = true }) {
  return (
    <motion.div variants={itemVariants} className="fx-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider">
          <Icon className="w-4 h-4 text-brand" />
          <span>{label}</span>
        </div>
        {delta != null && (
          <div className={`text-xs font-bold ${positive ? 'text-success' : 'text-danger'}`}>{positive ? '+' : ''}{delta}</div>
        )}
      </div>
      <div className="text-3xl font-bold text-text-primary tabular-nums">{value}</div>
    </motion.div>
  );
}

export default function FinanceiroPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();

  // Estado
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null); // { totalPorFinalizadora, totalEntradas, totalVendasBrutas, totalDescontos, totalVendasLiquidas }
  const [closings, setClosings] = useState([]); // sessões de caixa (fechamentos)

  // Filtro por período
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Carregar dados do período
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const from = startDate || undefined;
        const to = endDate || undefined;
        const [sum, sess] = await Promise.all([
          listarResumoPeriodo({ from, to }).catch(() => null),
          listarFechamentosCaixa({ from, to, limit: 100 }).catch(() => []),
        ]);
        setSummary(sum || { totalPorFinalizadora: {}, totalEntradas: 0, totalVendasBrutas: 0, totalDescontos: 0, totalVendasLiquidas: 0 });
        setClosings(Array.isArray(sess) ? sess : []);
      } catch (e) {
        toast({ title: 'Falha ao carregar financeiro', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    // Apenas quando empresa estiver disponível, para evitar chamadas cedo demais
    if (userProfile?.codigo_empresa) load();
  }, [startDate, endDate, userProfile?.codigo_empresa, toast]);

  // Dados do gráfico por finalizadora
  const finalizadoraChart = useMemo(() => {
    const src = summary?.totalPorFinalizadora || {};
    const arr = Object.entries(src).map(([name, valor]) => ({ name, valor: Number(valor || 0) }));
    // Ordena desc
    arr.sort((a, b) => b.valor - a.valor);
    return arr;
  }, [summary]);

  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

  return (
    <>
      <Helmet>
        <title>Financeiro - Fluxo7 Arena</title>
        <meta name="description" content="Análises financeiras e transações." />
      </Helmet>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Filtros de período */}
        <motion.div variants={itemVariants} className="fx-card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Início</label>
              <input
                className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Fim</label>
              <input
                className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreset('7')}>Últimos 7 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('30')}>Últimos 30 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('ytd')}>Ano atual</Button>
              <Button variant="ghost" size="sm" onClick={() => setPreset('clear')}>Limpar</Button>
            </div>
          </div>
          <div className="text-xs text-text-secondary sm:ml-auto whitespace-nowrap">
            {loading ? 'Carregando…' : (summary ? 'Atualizado' : 'Sem dados')}
          </div>
        </motion.div>

        {/* KPIs */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={TrendingUp} label="Vendas Brutas" value={fmtBRL(summary?.totalVendasBrutas)} />
          <KpiCard icon={CreditCard} label="Descontos" value={fmtBRL(summary?.totalDescontos)} positive={false} />
          <KpiCard icon={TrendingUp} label="Vendas Líquidas" value={fmtBRL(summary?.totalVendasLiquidas)} />
          <KpiCard icon={Wallet} label="Entradas (Pagamentos)" value={fmtBRL(summary?.totalEntradas)} />
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

        {/* Fechamentos de Caixa */}
        <motion.div variants={itemVariants} className="fx-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <CalendarRange className="w-4 h-4 text-brand" />
              <span>Fechamentos de Caixa no Período</span>
            </div>
          </div>
          {closings.length === 0 ? (
            <div className="text-sm text-text-muted">Nenhum fechamento encontrado no período.</div>
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
                  {closings.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.aberto_em ? new Date(c.aberto_em).toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell>{c.fechado_em ? new Date(c.fechado_em).toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-right">{fmtBRL(c.saldo_inicial)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(c.saldo_final)}</TableCell>
                      <TableCell>{String(c.status || '').toLowerCase() === 'open' ? 'Aberto' : 'Fechado'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
