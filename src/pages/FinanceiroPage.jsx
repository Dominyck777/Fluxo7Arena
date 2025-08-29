import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart as ReBarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Cell } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, CalendarRange } from 'lucide-react';

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

  // Mock data
  const receitaDespesas = [
    { mes: 'Jan', receita: 42000, despesa: 22000 },
    { mes: 'Fev', receita: 36000, despesa: 20000 },
    { mes: 'Mar', receita: 54000, despesa: 28000 },
    { mes: 'Abr', receita: 48000, despesa: 31000 },
    { mes: 'Mai', receita: 60000, despesa: 33000 },
    { mes: 'Jun', receita: 52000, despesa: 30000 },
  ];

  const receitaPorModalidade = [
    { name: 'Society', valor: 28000 },
    { name: 'Beach Tennis', valor: 18000 },
    { name: 'Futevôlei', valor: 12000 },
    { name: 'Quadra Coberta', valor: 8000 },
  ];

  const transacoes = [
    { id: 'T-101', data: '2025-08-01', cliente: 'Maria Oliveira', origem: 'Reserva', metodo: 'PIX', bruto: 200, taxas: 2.2, liquido: 197.8 },
    { id: 'T-102', data: '2025-08-01', cliente: 'Lucas Almeida', origem: 'Bar/Loja', metodo: 'Cartão', bruto: 58, taxas: 2.0, liquido: 56.0 },
    { id: 'T-103', data: '2025-08-02', cliente: 'Equipe Alpha', origem: 'Plano', metodo: 'Cartão', bruto: 600, taxas: 15.0, liquido: 585.0 },
    { id: 'T-104', data: '2025-08-02', cliente: 'João Pedro', origem: 'Reserva', metodo: 'Dinheiro', bruto: 160, taxas: 0, liquido: 160 },
  ];

  const totalReceita = receitaDespesas.reduce((a, b) => a + b.receita, 0);
  const totalDespesa = receitaDespesas.reduce((a, b) => a + b.despesa, 0);
  const lucro = totalReceita - totalDespesa;
  const margem = totalReceita ? ((lucro / totalReceita) * 100).toFixed(1) + '%' : '0%';

  const handleExport = () => {
    toast({ title: 'Exportação iniciada', description: 'Gerando CSV das transações…' });
    // Mock export. Futuro: gerar CSV real a partir de `transacoes`.
  };

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

  const filteredTransacoes = useMemo(() => {
    if (!startDate && !endDate) return transacoes;
    const s = startDate ? new Date(startDate) : null;
    const e = endDate ? new Date(endDate) : null;
    return transacoes.filter((t) => {
      const d = new Date(t.data);
      if (s && d < s) return false;
      if (e && d > e) return false;
      return true;
    });
  }, [startDate, endDate, transacoes]);

  // Filtra o gráfico mensal com base no range (usa o mês de cada ponto)
  const monthMap = { Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5, Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11 };
  const filteredReceitaDespesas = useMemo(() => {
    if (!startDate && !endDate) return receitaDespesas;
    const s = startDate ? new Date(startDate) : null;
    const e = endDate ? new Date(endDate) : null;
    // Assume ano corrente nos mocks; caso contrário manterá comportamento aproximado
    const year = new Date().getFullYear();
    return receitaDespesas.filter((p) => {
      const m = monthMap[p.mes] ?? 0;
      const pointDate = new Date(year, m, 15);
      if (s && pointDate < s) return false;
      if (e && pointDate > e) return false;
      return true;
    });
  }, [startDate, endDate, receitaDespesas]);

  return (
    <>
      <Helmet>
        <title>Financeiro - Fluxo7 Arena</title>
        <meta name="description" content="Análises financeiras e transações." />
      </Helmet>

      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-8">
        {/* Filtro de Período */}
        <motion.div variants={itemVariants} className="fx-card">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-text-muted mb-1">Início</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-text-muted mb-1">Fim</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreset('7')}>Últimos 7 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('30')}>Últimos 30 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('ytd')}>Este ano</Button>
              <Button size="sm" onClick={() => setPreset('clear')}>Limpar</Button>
            </div>
          </div>
        </motion.div>
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard icon={Wallet} label="Receita (6m)" value={`R$ ${(totalReceita).toLocaleString('pt-BR')}`} delta="8%" positive />
          <KpiCard icon={CreditCard} label="Despesas (6m)" value={`R$ ${(totalDespesa).toLocaleString('pt-BR')}`} delta="3%" positive={false} />
          <KpiCard icon={DollarSign} label="Lucro (6m)" value={`R$ ${(lucro).toLocaleString('pt-BR')}`} />
          <KpiCard icon={TrendingUp} label="Margem" value={margem} />
        </div>

        {/* Gráfico Receita x Despesa */}
        <motion.div variants={itemVariants} className="fx-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2"><CalendarRange className="w-5 h-5 text-brand"/> Receita x Despesa (6 meses)</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Mês</Button>
              <Button variant="outline" size="sm">Trimestre</Button>
              <Button size="sm">Ano</Button>
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredReceitaDespesas} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${(v/1000)}k`} />
                <Tooltip cursor={{ stroke: 'var(--brand)', strokeWidth: 1 }} contentStyle={{ background: 'rgba(10,10,10,.8)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(4px)' }} />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="var(--success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesa" stroke="var(--danger)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Barras por modalidade */}
        <motion.div variants={itemVariants} className="fx-card">
          <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center"><TrendingDown className="mr-2 h-5 w-5 text-brand" /> Receita por Modalidade</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={receitaPorModalidade} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v/1000}k`} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'rgba(10,10,10,.8)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(4px)' }} />
                <Bar dataKey="valor" name="Receita" fill="var(--brand)" radius={[4, 4, 0, 0]}>
                  {receitaPorModalidade.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--brand)' : 'hsl(var(--surface))'} />
                  ))}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Tabela de transações */}
        <motion.div variants={itemVariants} className="fx-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">Transações Recentes</h2>
            <Button variant="outline" size="sm" onClick={handleExport}>Exportar CSV</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Bruto (R$)</TableHead>
                <TableHead className="text-right">Taxas (R$)</TableHead>
                <TableHead className="text-right">Líquido (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransacoes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{new Date(t.data).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{t.cliente}</TableCell>
                  <TableCell>{t.origem}</TableCell>
                  <TableCell>{t.metodo}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.taxas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      </motion.div>
    </>
  );
}
