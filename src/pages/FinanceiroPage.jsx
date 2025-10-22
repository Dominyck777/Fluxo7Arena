import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Sector } from 'recharts';
import { TrendingUp, Wallet, CreditCard, CalendarRange, Banknote, ArrowDownCircle, ArrowUpCircle, FileText, Download, Search, Filter, DollarSign, ShoppingCart, Users, Package, Calendar as CalendarIcon, FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <motion.div variants={itemVariants} className="fx-card border-0 ring-0 outline-none shadow-none">
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
  const [receitaComandas, setReceitaComandas] = useState(0);
  const [receitaAgendamentos, setReceitaAgendamentos] = useState(0);
  const [topProdutos, setTopProdutos] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [allProdutos, setAllProdutos] = useState([]);
  const [allClientes, setAllClientes] = useState([]);
  const [evolucaoDiaria, setEvolucaoDiaria] = useState([]);
  const [receitaXml, setReceitaXml] = useState(0);
  const [produtosXmlCount, setProdutosXmlCount] = useState(0);
  // Modais de listas completas
  const [openProdutosModal, setOpenProdutosModal] = useState(false);
  const [openClientesModal, setOpenClientesModal] = useState(false);
  // Detalhes do cliente selecionado (no modal)
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedClientePagamentos, setSelectedClientePagamentos] = useState([]);
  const [loadingClienteDetalhes, setLoadingClienteDetalhes] = useState(false);
  const [clienteDetalhesModalOpen, setClienteDetalhesModalOpen] = useState(false);
  
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
  const [pagamentos, setPagamentos] = useState([]); // agora unificado (comandas + agendamentos)
  const [searchPagamento, setSearchPagamento] = useState('');
  const [filterFinalizadora, setFilterFinalizadora] = useState('all');
  const [filterFonte, setFilterFonte] = useState('all'); // all | manual | xml

  // Estados da aba Agendamentos
  const [agAgendamentos, setAgAgendamentos] = useState([]);
  const [agSearch, setAgSearch] = useState('');
  const [agStatus, setAgStatus] = useState('all'); // all, Pago, Pendente, Cancelado
  const [agFinalizadora, setAgFinalizadora] = useState('all');
  // Modal de detalhes de recebimento
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [recSelecionado, setRecSelecionado] = useState(null);
  const [recItens, setRecItens] = useState([]);
  const [recItensLoading, setRecItensLoading] = useState(false);
  const [recPagamentos, setRecPagamentos] = useState([]);
  const [recClienteNome, setRecClienteNome] = useState('');
  
  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
  const fmt2 = (n) => (Number(n || 0)).toFixed(2);

  // Função para exportar tabela como PDF (download direto)
  const exportToPDF = async (title, headers, data, filename) => {
    try {
      // Importar dinamicamente o autoTable
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      
      // Criar documento PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Adicionar título
      doc.setFontSize(20);
      doc.setTextColor(245, 158, 11); // Brand color
      doc.text(title, 14, 20);
      
      // Linha decorativa
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.5);
      doc.line(14, 23, pageWidth - 14, 23);
      
      // Informações do período
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Período: ${startDate || 'N/A'} até ${endDate || 'N/A'}`, 14, 30);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 35);
      
      // Adicionar tabela usando autoTable (agora está disponível no prototype)
      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          head: [headers],
          body: data,
          startY: 42,
          theme: 'striped',
          headStyles: {
            fillColor: [245, 158, 11], // Brand color
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11,
          },
          bodyStyles: {
            fontSize: 10,
            textColor: [50, 50, 50],
          },
          alternateRowStyles: {
            fillColor: [249, 249, 249],
          },
          margin: { top: 42, left: 14, right: 14 },
        });
        
        // Rodapé
        const finalY = doc.lastAutoTable.finalY || 50;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          'Relatório gerado por Fluxo7Arena - Sistema de Gestão de Quadras Esportivas',
          pageWidth / 2,
          finalY + 15,
          { align: 'center' }
        );
      } else {
        // Fallback: criar tabela manualmente se autoTable não funcionar
        let y = 45;
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        // Cabeçalho
        headers.forEach((header, i) => {
          const x = 14 + (i * 60);
          doc.text(header, x, y);
        });
        
        y += 7;
        
        // Dados
        doc.setFontSize(10);
        data.forEach((row) => {
          row.forEach((cell, i) => {
            const x = 14 + (i * 60);
            doc.text(String(cell), x, y);
          });
          y += 6;
        });
      }
      
      // Salvar PDF
      doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({ 
        title: 'PDF baixado com sucesso!', 
        description: 'O arquivo foi salvo na sua pasta de downloads',
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({ title: 'Erro ao gerar PDF', description: error.message, variant: 'destructive' });
    }
  };

  // Exportar Fechamentos de Caixa: PDF
  const exportClosingsToPDF = async () => {
    try {
      const headers = ['Abertura', 'Fechamento', 'Saldo Inicial', 'Saldo Final', 'Valor Final (Dinheiro)', 'Diferença', 'Status'];
      const rows = (history || []).map(h => [
        h?.aberto_em ? new Date(h.aberto_em).toLocaleString('pt-BR') : '-',
        h?.fechado_em ? new Date(h.fechado_em).toLocaleString('pt-BR') : '-',
        fmtBRL(h?.saldo_inicial || 0),
        h?.saldo_final != null ? fmtBRL(h.saldo_final) : fmtBRL(0),
        (h?.valor_final_dinheiro != null) ? fmtBRL(h.valor_final_dinheiro) : '—',
        (h?.diferenca_dinheiro != null) ? fmtBRL(h.diferenca_dinheiro) : '—',
        String(h?.status || '').toUpperCase()
      ]);
      await exportToPDF('Fechamentos de Caixa', headers, rows, 'fechamentos_caixa');
    } catch (e) {
      toast({ title: 'Erro ao exportar PDF', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  // Exportar Fechamentos de Caixa: CSV
  const exportClosingsToCSV = () => {
    try {
      const sep = ';';
      const headers = ['Abertura', 'Fechamento', 'Saldo Inicial', 'Saldo Final', 'Valor Final (Dinheiro)', 'Diferença', 'Status'];
      const lines = [headers.join(sep)];
      (history || []).forEach(h => {
        const abertura = h?.aberto_em ? new Date(h.aberto_em).toLocaleString('pt-BR') : '-';
        const fechamento = h?.fechado_em ? new Date(h.fechado_em).toLocaleString('pt-BR') : '-';
        const sIni = (Number(h?.saldo_inicial || 0)).toFixed(2).replace('.', ',');
        const sFin = (h?.saldo_final != null ? Number(h.saldo_final) : 0).toFixed(2).replace('.', ',');
        const vFinal = (h?.valor_final_dinheiro != null ? Number(h.valor_final_dinheiro) : null);
        const dif = (h?.diferenca_dinheiro != null ? Number(h.diferenca_dinheiro) : null);
        const status = String(h?.status || '').toUpperCase();
        lines.push([
          abertura,
          fechamento,
          sIni,
          sFin,
          vFinal != null ? vFinal.toFixed(2).replace('.', ',') : '',
          dif != null ? dif.toFixed(2).replace('.', ',') : '',
          status
        ].join(sep));
      });
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fechamentos_caixa_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV baixado com sucesso!' });
    } catch (e) {
      toast({ title: 'Erro ao exportar CSV', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

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

  // Label fixa da % (sempre branca e visível)
  const renderPercentLabel = ({ cx, cy, midAngle, outerRadius, percent }) => {
    const RAD = Math.PI / 180;
    const r = (outerRadius || 0) + 12;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text x={x} y={y} fill="#fff" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ pointerEvents: 'none', fontSize: 15, fontWeight: 700 }}>
        {`${Math.round((percent || 0) * 100)}%`}
      </text>
    );
  };

  // Estilo com transição suave para as fatias
  const getCellStyle = (idx) => {
    const isDim = selectedSlice != null && selectedSlice !== idx;
    return {
      transition: 'opacity 320ms ease-in-out, filter 320ms ease-in-out',
      opacity: isDim ? 0.25 : 1,
      filter: isDim ? 'grayscale(15%)' : 'none',
      cursor: 'pointer',
    };
  };

  // Carregar itens da comanda quando abrir o modal de recebimento
  useEffect(() => {
    const run = async () => {
      if (!recModalOpen || !recSelecionado || recSelecionado.origem !== 'Comanda' || !recSelecionado.comanda_id) {
        setRecItens([]);
        setRecPagamentos([]);
        return;
      }
      try {
        setRecItensLoading(true);
        const codigo = userProfile?.codigo_empresa;
        let q = supabase
          .from('comanda_itens')
          .select('descricao, quantidade, preco_unitario')
          .eq('comanda_id', recSelecionado.comanda_id);
        if (codigo) q = q.eq('codigo_empresa', codigo);
        const { data } = await q;
        setRecItens(data || []);

        // Carregar todos os pagamentos dessa comanda
        let qp = supabase
          .from('pagamentos')
          .select('id, valor, metodo, status, finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
          .eq('comanda_id', recSelecionado.comanda_id);
        if (codigo) qp = qp.eq('codigo_empresa', codigo);
        const { data: pays } = await qp;
        setRecPagamentos(pays || []);
      } catch (e) {
        console.warn('[Financeiro][RecebimentoModal] Falha ao carregar itens da comanda:', e?.message);
        setRecItens([]);
        setRecPagamentos([]);
      } finally {
        setRecItensLoading(false);
      }
    };
    run();
  }, [recModalOpen, recSelecionado, userProfile?.codigo_empresa]);

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

      // KPIs por origem
      try {
        // Comandas: soma de pagamentos no período
        let qc = supabase
          .from('pagamentos')
          .select('valor, status')
          .eq('codigo_empresa', codigo);
        if (fromISO) qc = qc.gte('recebido_em', fromISO);
        if (toISO) qc = qc.lte('recebido_em', toISO);
        const { data: payRows } = await qc;
        const totalComandas = (payRows || []).reduce((acc, r) => {
          const st = (r.status || 'Pago');
          if (st === 'Cancelado' || st === 'Estornado') return acc;
          return acc + Number(r.valor || 0);
        }, 0);
        setReceitaComandas(totalComandas);

        // Agendamentos: buscar agendamentos no período e somar participantes pagos
        let qa = supabase
          .from('agendamentos')
          .select('id')
          .eq('codigo_empresa', codigo);
        if (fromISO) qa = qa.gte('inicio', fromISO);
        if (toISO) qa = qa.lte('inicio', toISO);
        const { data: agendamentos } = await qa;
        
        let totalAg = 0;
        if (agendamentos && agendamentos.length > 0) {
          const agendamentoIds = agendamentos.map(a => a.id);
          const { data: participantes } = await supabase
            .from('agendamento_participantes')
            .select('valor_cota, aplicar_taxa, finalizadoras!agp_finalizadora_id_fkey(taxa_percentual)')
            .eq('codigo_empresa', codigo)
            .in('agendamento_id', agendamentoIds)
            .eq('status_pagamento', 'Pago');
          
          totalAg = (participantes || []).reduce((acc, p) => {
            let valor = Number(p.valor_cota || 0);
            
            // Se taxa foi aplicada, remover a taxa do valor
            if (p.aplicar_taxa === true) {
              const taxa = Number(p.finalizadoras?.taxa_percentual || 0);
              if (taxa > 0) {
                valor = valor / (1 + taxa / 100);
              }
            }
            
            return acc + valor;
          }, 0);
        }
        setReceitaAgendamentos(totalAg);
        console.debug('[Financeiro][VisaoGeral] Receitas por origem:', { totalComandas, totalAg });
      } catch (e) {
        console.warn('[Financeiro][VisaoGeral] Falha ao calcular KPIs por origem:', e?.message);
        setReceitaComandas(0); setReceitaAgendamentos(0);
      }

      // KPI: Recebimentos via XML e Produtos Importados (categoria/flag)
      try {
        // Recebimentos via XML
        let qx = supabase
          .from('pagamentos')
          .select('valor, status, origem')
          .eq('codigo_empresa', codigo)
          .eq('origem', 'xml');
        if (fromISO) qx = qx.gte('recebido_em', fromISO);
        if (toISO) qx = qx.lte('recebido_em', toISO);
        const { data: xmlPays } = await qx;
        const totalXml = (xmlPays || []).reduce((acc, r) =>
          (['Cancelado','Estornado'].includes(r.status)) ? acc : acc + Number(r.valor || 0), 0);
        setReceitaXml(totalXml);

        // Produtos importados no período (flag ou categoria)
        const { count: cntXml } = await supabase
          .from('produtos')
          .select('id', { count: 'exact', head: true })
          .eq('codigo_empresa', codigo)
          .or('importado_via_xml.is.true,categoria.ilike.Importados')
          .gte('criado_em', fromISO)
          .lte('criado_em', toISO);
        setProdutosXmlCount(cntXml || 0);
      } catch (e) {
        console.warn('[Financeiro][VisaoGeral] Falha KPIs XML:', e?.message);
        setReceitaXml(0); setProdutosXmlCount(0);
      }
      
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
        
        // Agrupar por produto (quantidade vendida + valor total)
        const prodMap = {};
        (itens || []).forEach(item => {
          const nome = item.produtos?.nome || 'Produto sem nome';
          const quantidade = Number(item.quantidade || 0);
          const valor = quantidade * Number(item.preco_unitario || 0);
          if (!prodMap[nome]) {
            prodMap[nome] = { quantidade: 0, valor: 0 };
          }
          prodMap[nome].quantidade += quantidade;
          prodMap[nome].valor += valor;
        });
        
        const produtosArr = Object.entries(prodMap)
          .map(([nome, data]) => ({ nome, quantidade: data.quantidade, valor: data.valor }))
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

      // Evolução Diária
      if (codigo && fromISO && toISO) {
        try {
          // 1) Pagamentos de comandas agrupados por data
          let qPag = supabase
            .from('pagamentos')
            .select('recebido_em, valor, status')
            .eq('codigo_empresa', codigo)
            .gte('recebido_em', fromISO)
            .lte('recebido_em', toISO)
            .order('recebido_em', { ascending: true });
          const { data: pagamentos } = await qPag;

          // 2) Agendamentos pagos agrupados por data de início
          let qAg = supabase
            .from('v_agendamentos_detalhado')
            .select('inicio, valor_pago, status_pagamento')
            .eq('codigo_empresa', codigo)
            .eq('status_pagamento', 'Pago')
            .gte('inicio', fromISO)
            .lte('inicio', toISO)
            .order('inicio', { ascending: true });
          const { data: agendamentos } = await qAg;

          // Agrupar por data
          const receitaPorDia = {};

          // Processar pagamentos
          (pagamentos || []).forEach(p => {
            if (['Cancelado', 'Estornado'].includes(p.status)) return;
            const data = new Date(p.recebido_em).toLocaleDateString('pt-BR');
            receitaPorDia[data] = (receitaPorDia[data] || 0) + Number(p.valor || 0);
          });

          // Processar agendamentos
          (agendamentos || []).forEach(a => {
            const data = new Date(a.inicio).toLocaleDateString('pt-BR');
            receitaPorDia[data] = (receitaPorDia[data] || 0) + Number(a.valor_pago || 0);
          });

          // Criar array ordenado
          const evolucao = Object.entries(receitaPorDia)
            .map(([data, valor]) => ({ data, valor }))
            .sort((a, b) => {
              const [dA, mA, yA] = a.data.split('/').map(Number);
              const [dB, mB, yB] = b.data.split('/').map(Number);
              return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
            });

          setEvolucaoDiaria(evolucao);
          console.debug('[Financeiro][VisaoGeral] Evolução diária:', evolucao.length, 'dias');
        } catch (e) {
          console.warn('[Financeiro][VisaoGeral] Falha ao calcular evolução diária:', e?.message);
          setEvolucaoDiaria([]);
        }
      } else {
        setEvolucaoDiaria([]);
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
      console.log('[FinanceiroPage][loadCaixa] Histórico recebido de listarFechamentosCaixa:', hist?.length, 'sessões');
      if (hist && hist.length > 0) {
        console.log('[FinanceiroPage][loadCaixa] Primeira sessão do histórico:', hist[0]);
        const comValor = hist.filter(h => h.valor_final_dinheiro != null);
        console.log('[FinanceiroPage][loadCaixa] Sessões com valor_final_dinheiro:', comValor.length, '/', hist.length);
      }
      setHistory(hist || []);
    } catch (e) {
      toast({ title: 'Falha ao carregar caixa', description: e?.message, variant: 'destructive' });
    }
  };

  // Carregar Recebimentos (unificado: Comandas + Agendamentos)
  const loadRecebimentos = async () => {
    try {
      setLoading(true);
      const codigo = userProfile?.codigo_empresa;
      const fromISO = mkStart(startDate) || undefined;
      const toISO = mkEnd(endDate) || undefined;
      
      // 1) Pagamentos de comandas
      let q1 = supabase
        .from('pagamentos')
        .select('id, comanda_id, valor, status, metodo, recebido_em, origem, xml_chave, finalizadoras!pagamentos_finalizadora_id_fkey(nome)')
        .eq('codigo_empresa', codigo)
        .order('recebido_em', { ascending: false });
      if (fromISO) q1 = q1.gte('recebido_em', fromISO);
      if (toISO) q1 = q1.lte('recebido_em', toISO);
      const { data: paysComanda } = await q1;

      // Buscar meta das comandas envolvidas (cliente e tipo)
      let clienteByComanda = new Map();
      let tipoByComanda = new Map();
      try {
        const comandaIds = Array.from(new Set((paysComanda || []).map(p => p.comanda_id).filter(Boolean)));
        if (comandaIds.length > 0) {
          const { data: cmdRows } = await supabase
            .from('comandas')
            .select('id, cliente_id, tipo')
            .in('id', comandaIds)
            .eq('codigo_empresa', codigo);
          const clienteIds = Array.from(new Set((cmdRows || []).map(c => c.cliente_id).filter(Boolean)));
          let nomeByCliente = new Map();
          if (clienteIds.length > 0) {
            const { data: cliRows } = await supabase
              .from('clientes')
              .select('id, nome')
              .in('id', clienteIds)
              .eq('codigo_empresa', codigo);
            nomeByCliente = new Map((cliRows || []).map(c => [c.id, c.nome]));
          }
          for (const c of cmdRows || []) {
            if (!c) continue;
            const nome = nomeByCliente.get(c.cliente_id) || null;
            clienteByComanda.set(c.id, nome);
            tipoByComanda.set(c.id, c.tipo || null);
          }

          // Fallback: se não há cliente_id, tentar tabela de associação comanda_clientes
          const semCliente = (cmdRows || []).filter(c => !c?.cliente_id).map(c => c.id);
          if (semCliente.length > 0) {
            try {
              const { data: links } = await supabase
                .from('comanda_clientes')
                .select('comanda_id, cliente_id')
                .in('comanda_id', semCliente)
                .eq('codigo_empresa', codigo);
              const extraIds = Array.from(new Set((links || []).map(l => l.cliente_id).filter(Boolean)));
              if (extraIds.length > 0) {
                const { data: extraClientes } = await supabase
                  .from('clientes')
                  .select('id, nome')
                  .in('id', extraIds)
                  .eq('codigo_empresa', codigo);
                const byId = new Map((extraClientes || []).map(c => [c.id, c.nome]));
                for (const l of links || []) {
                  const nome = byId.get(l.cliente_id) || null;
                  if (nome && !clienteByComanda.get(l.comanda_id)) clienteByComanda.set(l.comanda_id, nome);
                }
              }
            } catch (e) {
              console.debug('[Financeiro][Recebimentos] comanda_clientes indisponível (ok)');
            }
          }
        }
      } catch (e) {
        console.warn('[Financeiro][Recebimentos] Falha ao buscar clientes de comandas:', e?.message);
      }

      // 2) Pagamentos de agendamentos (via view detalhada) com status pago, usando inicio como data
      let q2 = supabase
        .from('v_agendamentos_detalhado')
        .select('agendamento_id, agendamento_codigo, inicio, quadra_nome, participante_nome, valor_cota, status_pagamento, finalizadora_nome')
        .eq('codigo_empresa', codigo)
        .eq('status_pagamento', 'Pago')
        .order('inicio', { ascending: false });
      if (fromISO) q2 = q2.gte('inicio', fromISO);
      if (toISO) q2 = q2.lte('inicio', toISO);
      const { data: paysAg } = await q2;

      // 3) Unificar
      const normComandas = (paysComanda || []).map(p => ({
        id: p.id,
        origem: (tipoByComanda.get(p.comanda_id || '') === 'balcao') ? 'Balcão' : 'Comanda',
        comanda_id: p.comanda_id || null,
        recebido_em: p.recebido_em,
        finalizadoras: p.finalizadoras,
        metodo: p.metodo,
        valor: p.valor,
        status: p.status,
        descricao: clienteByComanda.get(p.comanda_id || '') || null,
        fonte: (p.origem || 'manual'),
        xml_chave: p.xml_chave || null,
      }));
      const normAg = (paysAg || []).map((r, idx) => ({
        id: `ag-${r.agendamento_id}-${idx}`,
        origem: 'Agendamento',
        recebido_em: r.inicio,
        finalizadoras: r.finalizadora_nome ? { nome: r.finalizadora_nome } : null,
        metodo: r.finalizadora_nome || null,
        valor: r.valor_cota,
        status: r.status_pagamento,
        descricao: `#${r.agendamento_codigo} - ${r.participante_nome} (${r.quadra_nome || '—'})`,
        agendamento_codigo: r.agendamento_codigo,
        quadra_nome: r.quadra_nome,
        participante_nome: r.participante_nome,
        fonte: null,
      }));
      setPagamentos([...
        normComandas,
        ...normAg,
      ]);
    } catch (e) {
      toast({ title: 'Falha ao carregar recebimentos', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Carregar Agendamentos (aba específica)
  const loadAgendamentos = async () => {
    try {
      setLoading(true);
      const codigo = userProfile?.codigo_empresa;
      const fromISO = mkStart(startDate) || undefined;
      const toISO = mkEnd(endDate) || undefined;
      let q = supabase
        .from('v_agendamentos_detalhado')
        .select('agendamento_codigo, inicio, quadra_nome, participante_nome, valor_cota, finalizadora_nome, status_pagamento')
        .eq('codigo_empresa', codigo)
        .order('inicio', { ascending: false });
      if (fromISO) q = q.gte('inicio', fromISO);
      if (toISO) q = q.lte('inicio', toISO);
      const { data } = await q;
      setAgAgendamentos(data || []);
    } catch (e) {
      toast({ title: 'Falha ao carregar agendamentos', description: e?.message, variant: 'destructive' });
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
    
    if (activeTab === 'visao-geral' || activeTab === 'relatorios') {
      loadVisaoGeral();
    } else if (activeTab === 'caixa') {
      loadCaixa();
    } else if (activeTab === 'recebimentos') {
      loadRecebimentos();
    } else if (activeTab === 'agendamentos') {
      loadAgendamentos();
    }
  }, [activeTab, startDate, endDate, userProfile?.codigo_empresa]);

  // Dados do gráfico por finalizadora
  const finalizadoraChart = useMemo(() => {
    const src = summary?.totalPorFinalizadora || {};
    const arr = Object.entries(src).map(([name, valor]) => ({ name, valor: Number(valor || 0) }));
    arr.sort((a, b) => b.valor - a.valor);
    return arr;
  }, [summary]);

  // Interação do gráfico de pizza
  const [activeSlice, setActiveSlice] = useState(null); // 0 = Comandas, 1 = Agendamentos
  const [selectedSlice, setSelectedSlice] = useState(null); // clique fixa destaque e escurece o restante
  const pieAngles = { start: 90, end: -270 };
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const getSliceAngles = (idx) => {
    const v0 = Number(receitaComandas || 0);
    const v1 = Number(receitaAgendamentos || 0);
    const total = Math.max(0.0001, v0 + v1);
    const sweep0 = 360 * (v0 / total);
    // Pie varre de start -> end no sentido horário (end menor). Fatia 0 começa em start.
    if (idx === 0) {
      return { a: pieAngles.start, b: pieAngles.start - sweep0 };
    }
    return { a: pieAngles.start - sweep0, b: pieAngles.end };
  };

  // Animação suave entre seleções usando um Sector sobreposto
  const [anim, setAnim] = useState({ from: null, to: null, t: 1 });
  const effectiveIndex = selectedSlice != null ? selectedSlice : activeSlice;
  useEffect(() => {
    if (effectiveIndex == null) return; // nada a animar sem foco
    const to = getSliceAngles(effectiveIndex);
    setAnim((prev) => ({ from: prev.to || to, to, t: 0 }));
    let raf; const start = performance.now(); const dur = 380;
    const loop = (now) => {
      const lin = Math.min(1, (now - start) / dur);
      const eased = easeInOutCubic(lin);
      setAnim((p) => ({ ...p, t: eased }));
      if (lin < 1) { raf = requestAnimationFrame(loop); }
    };
    raf = requestAnimationFrame(loop);
    return () => raf && cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIndex, receitaComandas, receitaAgendamentos]);

  // Animação suave de tamanho (raio) entre seleções
  const baseR = 86, activeR = 94, dimR = 80;
  const [sizeAnim, setSizeAnim] = useState({ from: [baseR, baseR], to: [baseR, baseR], t: 1 });
  useEffect(() => {
    const target = (effectiveIndex === 0)
      ? [activeR, dimR]
      : (effectiveIndex === 1)
        ? [dimR, activeR]
        : [baseR, baseR];
    setSizeAnim((prev) => ({ from: prev.to || target, to: target, t: 0 }));
    let raf; const start = performance.now(); const dur = 380;
    const loop = (now) => {
      const lin = Math.min(1, (now - start) / dur);
      const eased = easeInOutCubic(lin);
      setSizeAnim((p) => ({ ...p, t: eased }));
      if (lin < 1) { raf = requestAnimationFrame(loop); }
    };
    raf = requestAnimationFrame(loop);
    return () => raf && cancelAnimationFrame(raf);
  }, [effectiveIndex]);

  // Desenho do overlay animado (interpolação linear entre ângulos)
  const renderOverlay = ({ cx, cy, outerRadius }) => {
    if (!anim.from || !anim.to) return null;
    const startAngle = lerp(anim.from.a, anim.to.a, anim.t);
    const endAngle = lerp(anim.from.b, anim.to.b, anim.t);
    const color = effectiveIndex === 0 ? '#22C55E' : '#F59E0B';
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={0}
        outerRadius={(outerRadius || 0) + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={color}
        fillOpacity={0.18}
        stroke="transparent"
      />
    );
  };

  // Filtrar pagamentos
  const filteredPagamentos = useMemo(() => {
    let result = pagamentos;
    if (searchPagamento) {
      const term = searchPagamento.toLowerCase();
      result = result.filter(p =>
        (p.descricao || '').toLowerCase().includes(term) ||
        (p.finalizadoras?.nome || '').toLowerCase().includes(term) ||
        String(p.valor || '').includes(term) ||
        (p.origem || '').toLowerCase().includes(term)
      );
    }
    if (filterFinalizadora !== 'all') {
      result = result.filter(p => (p.finalizadoras?.nome || p.metodo) === filterFinalizadora);
    }
    if (filterFonte !== 'all') {
      result = result.filter(p => (p.fonte || 'manual') === filterFonte);
    }
    return result;
  }, [pagamentos, searchPagamento, filterFinalizadora, filterFonte]);

  const filteredAg = useMemo(() => {
    let arr = agAgendamentos || [];
    if (agStatus !== 'all') arr = arr.filter(r => (r.status_pagamento || '').toLowerCase() === agStatus.toLowerCase());
    if (agFinalizadora !== 'all') arr = arr.filter(r => (r.finalizadora_nome || '') === agFinalizadora);
    if (agSearch) {
      const term = agSearch.toLowerCase();
      arr = arr.filter(r =>
        String(r.agendamento_codigo || '').toLowerCase().includes(term) ||
        (r.participante_nome || '').toLowerCase().includes(term) ||
        (r.quadra_nome || '').toLowerCase().includes(term)
      );
    }
    return arr;
  }, [agAgendamentos, agStatus, agFinalizadora, agSearch]);

  return (
    <>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Header com filtros de período */}
        <motion.div variants={itemVariants} className="fx-card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Financeiro</h1>
              <p className="text-sm text-text-secondary">Gestão completa das finanças da empresa</p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex flex-col justify-center flex-1 sm:flex-initial">
                <label className="text-xs text-text-secondary mb-1">Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full sm:w-[160px] pl-3 pr-3 flex items-center gap-2 justify-start text-left font-medium bg-black border-warning/40 text-white hover:bg-black/80 hover:border-warning">
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
              <div className="flex flex-col justify-center flex-1 sm:flex-initial">
                <label className="text-xs text-text-secondary mb-1">Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full sm:w-[160px] pl-3 pr-3 flex items-center gap-2 justify-start text-left font-medium bg-black border-warning/40 text-white hover:bg-black/80 hover:border-warning">
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

        {/* Tabs - Select no mobile, Tabs no desktop */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Select para Mobile */}
          <div className="md:hidden mb-4">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full h-11 bg-black border-warning/40 text-white">
                <SelectValue placeholder="Selecione uma aba" />
              </SelectTrigger>
              <SelectContent className="bg-black text-white border-warning/40">
                <SelectItem value="visao-geral">Visão Geral</SelectItem>
                <SelectItem value="caixa">Caixa</SelectItem>
                <SelectItem value="recebimentos">Recebimentos</SelectItem>
                <SelectItem value="agendamentos">Agendamentos</SelectItem>
                <SelectItem value="relatorios">Relatórios</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Tabs para Desktop */}
          <TabsList className="hidden md:grid w-full grid-cols-5">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="caixa">Caixa</TabsTrigger>
            <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          {/* ABA 1: VISÃO GERAL */}
          <TabsContent value="visao-geral" className="space-y-6 mt-6">
            {/* KPIs por Origem */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <KpiCard icon={Wallet} label="Total Geral" value={fmtBRL(Number(receitaComandas || 0) + Number(receitaAgendamentos || 0))} color="brand" />
              <KpiCard icon={ShoppingCart} label="Comandas" value={fmtBRL(receitaComandas)} color="success" />
              <KpiCard icon={CalendarIcon} label="Agendamentos" value={fmtBRL(receitaAgendamentos)} color="success" />
              <KpiCard icon={CreditCard} label="XML (Recebimentos)" value={fmtBRL(receitaXml)} color="success" />
            </motion.div>

            {/* Indicadores XML adicionais removidos a pedido do usuário */}

            {/* Pizza: Proporção Comandas vs Agendamentos */}
            <motion.div variants={itemVariants} className="fx-card p-4 border-0 ring-0 outline-none shadow-none">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  <CreditCard className="w-4 h-4 text-brand" />
                  <span>Proporção de Receita</span>
                </div>
              </div>
              {Number(receitaComandas || 0) + Number(receitaAgendamentos || 0) === 0 ? (
                <div className="text-sm text-text-muted">Sem receitas no período.</div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Gráfico - altura adaptativa */}
                  <div className="w-full md:flex-1 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(function(){
                            const r0 = lerp(sizeAnim.from?.[0] ?? baseR, sizeAnim.to?.[0] ?? baseR, sizeAnim.t);
                            const r1 = lerp(sizeAnim.from?.[1] ?? baseR, sizeAnim.to?.[1] ?? baseR, sizeAnim.t);
                            return [
                              { name: 'Comandas', value: Number(receitaComandas || 0), fill: '#22C55E', outerRadius: r0 },
                              { name: 'Agendamentos', value: Number(receitaAgendamentos || 0), fill: '#F59E0B', outerRadius: r1 },
                            ];
                          })()}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          stroke="transparent"
                          label={false}
                          labelLine={false}
                          isAnimationActive
                          animationBegin={50}
                          animationDuration={500}
                          startAngle={pieAngles.start}
                          endAngle={pieAngles.end}
                          activeIndex={effectiveIndex}
                          activeShape={undefined}
                          onMouseEnter={(_, index) => setActiveSlice(index)}
                          onMouseLeave={() => setActiveSlice(null)}
                          onClick={(_, index) => {
                            setSelectedSlice(prev => prev === index ? null : index);
                            setActiveSlice(index);
                          }}
                        >
                          <Cell 
                            key="c" 
                            fill="#22C55E" 
                            style={getCellStyle(0)}
                          />
                          <Cell 
                            key="a" 
                            fill="#F59E0B" 
                            style={getCellStyle(1)}
                          />
                        </Pie>
                        {/* Overlay animado suave */}
                        {renderOverlay({ cx: '50%', cy: '50%', outerRadius: 92 })}
                        {/* Camada de labels por cima do overlay (não some no hover) */}
                        <Pie
                          data={(function(){
                            const r0 = lerp(sizeAnim.from?.[0] ?? baseR, sizeAnim.to?.[0] ?? baseR, sizeAnim.t);
                            const r1 = lerp(sizeAnim.from?.[1] ?? baseR, sizeAnim.to?.[1] ?? baseR, sizeAnim.t);
                            return [
                              { name: 'Comandas', value: Number(receitaComandas || 0), fill: 'transparent', outerRadius: r0 },
                              { name: 'Agendamentos', value: Number(receitaAgendamentos || 0), fill: 'transparent', outerRadius: r1 },
                            ];
                          })()}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          stroke="transparent"
                          label={renderPercentLabel}
                          labelLine={false}
                          isAnimationActive={false}
                          startAngle={pieAngles.start}
                          endAngle={pieAngles.end}
                        />
                        <Tooltip 
                          formatter={(v) => fmtBRL(v)}
                          contentStyle={{
                            background: 'rgba(10, 10, 10, 0.95)',
                            border: '1px solid #fbbf24',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: '#fff'
                          }}
                          labelStyle={{ color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          cursor={{ fill: 'rgba(251, 191, 36, 0.06)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legenda - embaixo no mobile, lado no desktop */}
                  <div className="w-full md:w-64 space-y-3 md:pr-2">
                    {[
                      { name: 'Comandas', value: Number(receitaComandas || 0), color: '#22C55E' },
                      { name: 'Agendamentos', value: Number(receitaAgendamentos || 0), color: '#F59E0B' },
                    ].map((it, idx) => (
                      <div
                        key={it.name}
                        className={`flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 ${activeSlice === idx ? 'bg-white/5' : 'hover:bg-white/5'} cursor-pointer ${selectedSlice != null && selectedSlice !== idx ? 'opacity-60' : ''}`}
                        onMouseEnter={() => setActiveSlice(idx)}
                        onMouseLeave={() => setActiveSlice(null)}
                        onClick={() => setSelectedSlice(prev => prev === idx ? null : idx)}
                        role="button"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: it.color }} />
                          <span className="text-sm text-text-secondary">{it.name}</span>
                        </div>
                        <div className={`text-sm font-semibold ${selectedSlice != null && selectedSlice !== idx ? 'opacity-70' : ''}`}>{fmtBRL(it.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                
              )}
            </motion.div>

            {/* Gráfico por Finalizadora */}
            <motion.div variants={itemVariants} className="fx-card p-4 border-0 ring-0 outline-none shadow-none">
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
                  <span>Produtos mais vendidos</span>
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">{fmtBRL(prod.valor)}</span>
                          <span className="text-sm font-bold text-brand">x{prod.quantidade}</span>
                        </div>
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

          {/* ABA 4: AGENDAMENTOS */}
          <TabsContent value="agendamentos" className="space-y-6 mt-6">
            <motion.div variants={itemVariants} className="fx-card p-4 border-0 ring-0 outline-none shadow-none">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Agendamentos (Pagamentos por Participante)</h2>
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input placeholder="Buscar (#código, participante, quadra)" value={agSearch} onChange={(e)=>setAgSearch(e.target.value)} className="pl-10 w-full md:w-[260px] bg-black border-warning/40 text-white placeholder:text-white/60" />
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <Select value={agStatus} onValueChange={setAgStatus}>
                      <SelectTrigger className="w-full md:w-[170px] h-9 bg-black border-warning/40 text-white">
                        <SelectValue placeholder="Todos os Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-black text-white border-warning/40">
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="Pago">Pago</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={agFinalizadora} onValueChange={setAgFinalizadora}>
                      <SelectTrigger className="w-full md:w-[220px] h-9 bg-black border-warning/40 text-white">
                        <SelectValue placeholder="Todas as Finalizadoras" />
                      </SelectTrigger>
                      <SelectContent className="bg-black text-white border-warning/40">
                        <SelectItem value="all">Todas as Finalizadoras</SelectItem>
                        {[...new Set((agAgendamentos||[]).map(r=>r.finalizadora_nome).filter(Boolean))].map(fn => (
                          <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    try {
                      const rows = filteredAg || [];
                      const headers = ['Data/Hora','Código','Quadra','Participante','Finalizadora','Valor','Status'];
                      const csvRows = [headers.join(';')];
                      for (const r of rows) {
                        const line = [
                          r.inicio ? new Date(r.inicio).toLocaleString('pt-BR') : '',
                          r.agendamento_codigo ?? '',
                          (r.quadra_nome ?? '').replaceAll('"','""'),
                          (r.participante_nome ?? '').replaceAll('"','""'),
                          (r.finalizadora_nome ?? '').replaceAll('"','""'),
                          String(fmt2(r.valor_cota)).replace('.', ','),
                          r.status_pagamento ?? ''
                        ].map(v => `"${String(v)}"`).join(';');
                        csvRows.push(line);
                      }
                      const csvString = '\ufeff' + csvRows.join('\n');
                      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const de = startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : '';
                      const ate = endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : '';
                      a.download = `agendamentos_${de}_a_${ate}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      toast({ title: 'Falha ao exportar CSV', description: e?.message, variant: 'destructive' });
                    }
                  }}>
                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent"></div>
                  <p className="mt-4 text-text-muted">Carregando...</p>
                </div>
              ) : filteredAg.length === 0 ? (
                <div className="text-sm text-text-muted">Sem registros no período.</div>
              ) : (
                <>
                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Quadra</TableHead>
                          <TableHead>Participante</TableHead>
                          <TableHead>Finalizadora</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAg.map((r, i) => (
                          <TableRow key={`${r.agendamento_codigo}-${i}`}>
                            <TableCell>{r.inicio ? new Date(r.inicio).toLocaleString('pt-BR') : '—'}</TableCell>
                            <TableCell>#{r.agendamento_codigo || '—'}</TableCell>
                            <TableCell>{r.quadra_nome || '—'}</TableCell>
                            <TableCell>{r.participante_nome || '—'}</TableCell>
                            <TableCell>{r.finalizadora_nome || '—'}</TableCell>
                            <TableCell className="text-right font-semibold">{fmtBRL(r.valor_cota)}</TableCell>
                            <TableCell>{r.status_pagamento || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {filteredAg.map((r, i) => (
                      <div key={`${r.agendamento_codigo}-${i}`} className="bg-surface-2 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-text-primary">
                            #{r.agendamento_codigo || '—'}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            r.status_pagamento === 'Pago' ? 'bg-success/20 text-success' : 
                            r.status_pagamento === 'Cancelado' ? 'bg-danger/20 text-danger' : 
                            'bg-warning/20 text-warning'
                          }`}>
                            {r.status_pagamento || 'Pendente'}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Data/Hora:</span>
                            <span className="text-text-primary">
                              {r.inicio ? new Date(r.inicio).toLocaleString('pt-BR', { 
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Quadra:</span>
                            <span className="text-text-primary font-medium">
                              {r.quadra_nome || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Participante:</span>
                            <span className="text-text-primary">
                              {r.participante_nome || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Finalizadora:</span>
                            <span className="text-text-primary">
                              {r.finalizadora_nome || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-border/50">
                            <span className="text-text-secondary">Valor da Cota:</span>
                            <span className="font-bold text-lg text-success">{fmtBRL(r.valor_cota)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* ABA 2: CAIXA */}
          <TabsContent value="caixa" className="space-y-6 mt-6">
            {/* Histórico de Fechamentos */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-base font-bold">Fechamentos Anteriores</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportClosingsToCSV}>
                    <Download className="h-4 w-4 mr-2" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportClosingsToPDF}>
                    <FileDown className="h-4 w-4 mr-2" /> PDF
                  </Button>
                </div>
              </div>
              {history.length === 0 ? (
                <div className="text-sm text-text-secondary">Nenhum fechamento encontrado.</div>
              ) : (
                <>
                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aberto em</TableHead>
                          <TableHead>Fechado em</TableHead>
                          <TableHead className="text-right">Saldo Inicial</TableHead>
                          <TableHead className="text-right">Saldo Final (contado)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          console.log('[FinanceiroPage][Render] Renderizando histórico, total de sessões:', history.length);
                          const comValor = history.filter(h => h.valor_final_dinheiro != null);
                          console.log('[FinanceiroPage][Render] Sessões com valor_final_dinheiro no render:', comValor.length);
                          if (history.length > 0) {
                            console.log('[FinanceiroPage][Render] Primeira sessão no array history:', history[0]);
                          }
                          return null;
                        })()}
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
                            // Enriquecer sessão com saldos do snapshot (se presentes)
                            const sessaoOut = {
                              ...h,
                              saldo_inicial: (resumoSnap && typeof resumoSnap.saldo_inicial !== 'undefined') ? Number(resumoSnap.saldo_inicial) : h.saldo_inicial,
                              saldo_final: (resumoSnap && typeof resumoSnap.saldo_final !== 'undefined') ? Number(resumoSnap.saldo_final) : h.saldo_final,
                            };
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
                            const movimentosAgg = resumoSnap && resumoSnap.movimentos ? resumoSnap.movimentos : null;
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
                            const valorFinalContado = (resumoSnap && typeof resumoSnap.valor_final_dinheiro !== 'undefined') ? Number(resumoSnap.valor_final_dinheiro) : null;
                            setCaixaModalData({ resumo, movimentacoes, movimentosAgg, pagamentos: (pagamentosDet||[]), sessao: sessaoOut, valorFinalContado });
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
                          <TableCell className="text-right">{h.valor_final_dinheiro != null ? fmtBRL(h.valor_final_dinheiro) : '—'}</TableCell>
                          <TableCell>{String(h.status || '').toLowerCase() === 'open' ? 'Aberto' : 'Fechado'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {history.map((h) => (
                      <div key={h.id} className="bg-surface-2 rounded-lg p-4 cursor-pointer hover:bg-surface-2/80 transition-colors" onClick={async () => {
                        setCaixaModalOpen(true);
                        setCaixaModalLoading(true);
                        setCaixaModalData(null);
                        try {
                          const codigo = userProfile?.codigo_empresa;
                          let resumoSnap = await getCaixaResumo({ caixaSessaoId: h.id, codigoEmpresa: codigo });
                          const normalizeResumo = (r) => {
                            if (!r) return null;
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
                            return r;
                          };
                          let resumo = normalizeResumo(resumoSnap);
                          if (!resumo) {
                            resumo = await listarResumoPeriodo({ from: h.aberto_em, to: h.fechado_em || new Date().toISOString(), codigoEmpresa: codigo });
                          }
                          const sessaoOut = {
                            ...h,
                            saldo_inicial: (resumoSnap && typeof resumoSnap.saldo_inicial !== 'undefined') ? Number(resumoSnap.saldo_inicial) : h.saldo_inicial,
                            saldo_final: (resumoSnap && typeof resumoSnap.saldo_final !== 'undefined') ? Number(resumoSnap.saldo_final) : h.saldo_final,
                          };
                          const movimentacoes = await listarMovimentacoesCaixa({ caixaSessaoId: h.id, codigoEmpresa: codigo });
                          const movimentosAgg = resumoSnap && resumoSnap.movimentos ? resumoSnap.movimentos : null;
                          const valorFinalContado = (resumoSnap && typeof resumoSnap.valor_final_dinheiro !== 'undefined') ? Number(resumoSnap.valor_final_dinheiro) : null;
                          setCaixaModalData({ resumo, movimentacoes, movimentosAgg, sessao: sessaoOut, pagamentos: [], valorFinalContado });
                        } catch (e) {
                          console.error('[Caixa][Fechamento][Error]', e);
                          toast({ title: 'Erro ao carregar detalhes', description: e?.message, variant: 'destructive' });
                        } finally {
                          setCaixaModalLoading(false);
                        }
                      }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-text-primary">
                            Sessão #{h.id}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            h.status === 'fechado' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                          }`}>
                            {String(h.status || '').toLowerCase() === 'open' ? 'Aberto' : 'Fechado'}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Aberto em:</span>
                            <span className="text-text-primary">
                              {h.aberto_em ? new Date(h.aberto_em).toLocaleString('pt-BR', { 
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Fechado em:</span>
                            <span className="text-text-primary">
                              {h.fechado_em ? new Date(h.fechado_em).toLocaleString('pt-BR', { 
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Saldo Inicial:</span>
                            <span className="font-semibold text-info">{fmtBRL(h.saldo_inicial)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Saldo Final (contado):</span>
                            <span className="font-semibold text-success">{h.valor_final_dinheiro != null ? fmtBRL(h.valor_final_dinheiro) : '—'}</span>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-text-muted text-center">
                          Toque para ver detalhes
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* ABA 3: RECEBIMENTOS */}
          <TabsContent value="recebimentos" className="space-y-6 mt-6">
            <motion.div variants={itemVariants} className="fx-card p-4 border-0 ring-0 outline-none shadow-none">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Todos os Recebimentos</h2>
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input
                      placeholder="Buscar..."
                      value={searchPagamento}
                      onChange={(e) => setSearchPagamento(e.target.value)}
                      className="pl-10 w-full md:w-[200px]"
                    />
                  </div>
                  <Select value={filterFonte} onValueChange={setFilterFonte}>
                    <SelectTrigger className="w-full md:w-[160px] h-9 bg-black border-warning/40 text-white">
                      <SelectValue placeholder="Todas as Fontes" />
                    </SelectTrigger>
                    <SelectContent className="bg-black text-white border-warning/40">
                      <SelectItem value="all">Todas as Fontes</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => {
                    try {
                      const rows = filteredPagamentos || [];
                      const headers = ['Data/Hora','Origem','Fonte','Descrição','Finalizadora','Valor','Status'];
                      const csvRows = [headers.join(';')];
                      for (const r of rows) {
                        const line = [
                          r.recebido_em ? new Date(r.recebido_em).toLocaleString('pt-BR') : '',
                          r.origem ?? '',
                          r.fonte ?? '',
                          (r.descricao ?? '').replaceAll('"','""'),
                          (r.finalizadoras?.nome || r.metodo || '').replaceAll('"','""'),
                          String(fmt2(r.valor)).replace('.', ','),
                          r.status ?? ''
                        ].map(v => `"${String(v)}"`).join(';');
                        csvRows.push(line);
                      }
                      const csvString = '\ufeff' + csvRows.join('\n');
                      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const de = startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : '';
                      const ate = endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : '';
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `recebimentos_${de}_a_${ate}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      toast({ title: 'Falha ao exportar CSV', description: e?.message, variant: 'destructive' });
                    }
                  }}>
                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
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
                <>
                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Fonte</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Finalizadora</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPagamentos.map((pg) => (
                          <TableRow key={pg.id} className="cursor-pointer hover:bg-surface-2" onClick={() => { setRecSelecionado(pg); setRecModalOpen(true); }}>
                            <TableCell>{pg.recebido_em ? new Date(pg.recebido_em).toLocaleString('pt-BR') : '—'}</TableCell>
                            <TableCell>{pg.origem || '—'}</TableCell>
                            <TableCell>{pg.fonte ? pg.fonte.toUpperCase() : '—'}</TableCell>
                            <TableCell className="truncate max-w-[260px]" title={pg.descricao || ''}>{pg.descricao || '—'}</TableCell>
                            <TableCell>{pg.finalizadoras?.nome || pg.metodo || '—'}</TableCell>
                            <TableCell className="text-right font-semibold">{fmtBRL(pg.valor)}</TableCell>
                            <TableCell>{pg.status || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {filteredPagamentos.map((pg) => (
                      <div key={pg.id} className="bg-surface-2 rounded-lg p-4 cursor-pointer hover:bg-surface-2/80 transition-colors" onClick={() => { setRecSelecionado(pg); setRecModalOpen(true); }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-text-primary">
                            {pg.origem || 'Recebimento'}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            pg.status === 'Pago' ? 'bg-success/20 text-success' : 
                            pg.status === 'Cancelado' ? 'bg-danger/20 text-danger' : 
                            'bg-warning/20 text-warning'
                          }`}>
                            {pg.status || 'Pendente'}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Data/Hora:</span>
                            <span className="text-text-primary">
                              {pg.recebido_em ? new Date(pg.recebido_em).toLocaleString('pt-BR', { 
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Fonte:</span>
                            <span className="text-text-primary font-medium">
                              {pg.fonte ? pg.fonte.toUpperCase() : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Finalizadora:</span>
                            <span className="text-text-primary">
                              {pg.finalizadoras?.nome || pg.metodo || '—'}
                            </span>
                          </div>
                          {pg.descricao && (
                            <div className="flex flex-col gap-1">
                              <span className="text-text-secondary">Descrição:</span>
                              <span className="text-text-primary text-xs bg-surface/50 p-2 rounded">
                                {pg.descricao}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-border/50">
                            <span className="text-text-secondary">Valor:</span>
                            <span className="font-bold text-lg text-success">{fmtBRL(pg.valor)}</span>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-text-muted text-center">
                          Toque para ver detalhes
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* ABA 4: RELATÓRIOS */}
          <TabsContent value="relatorios" className="space-y-6 mt-6">
            {/* Relatório 1: Faturamento Consolidado */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-success" />
                    Faturamento Consolidado
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">Resumo geral das receitas no período</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-success/10 border-success/40 text-success hover:bg-success/20"
                    onClick={() => {
                      const rows = [
                        ['Métrica', 'Valor'],
                        ['Receita de Comandas', fmtBRL(receitaComandas)],
                        ['Receita de Agendamentos', fmtBRL(receitaAgendamentos)],
                        ['Receita Total', fmtBRL(Number(receitaComandas || 0) + Number(receitaAgendamentos || 0))],
                        ['Período', `${startDate || 'N/A'} até ${endDate || 'N/A'}`],
                      ];
                      const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `faturamento_consolidado_${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: 'Relatório exportado', description: 'CSV salvo com sucesso' });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-success/10 border-success/40 text-success hover:bg-success/20"
                    onClick={() => {
                      const data = [
                        ['Receita de Comandas', fmtBRL(receitaComandas)],
                        ['Receita de Agendamentos', fmtBRL(receitaAgendamentos)],
                        ['Receita Total', fmtBRL(Number(receitaComandas || 0) + Number(receitaAgendamentos || 0))],
                      ];
                      exportToPDF('Faturamento Consolidado', ['Métrica', 'Valor'], data, 'faturamento_consolidado');
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
                  <div className="text-xs text-text-secondary mb-1">Receita Comandas</div>
                  <div className="text-2xl font-bold text-success">{fmtBRL(receitaComandas)}</div>
                  <div className="text-xs text-text-muted mt-1">Vendas no período</div>
                </div>
                <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                  <div className="text-xs text-text-secondary mb-1">Receita Agendamentos</div>
                  <div className="text-2xl font-bold text-purple-400">{fmtBRL(receitaAgendamentos)}</div>
                  <div className="text-xs text-text-muted mt-1">Reservas pagas</div>
                </div>
                <div className="p-4 bg-brand/5 border border-brand/20 rounded-lg">
                  <div className="text-xs text-text-secondary mb-1">Receita Total</div>
                  <div className="text-2xl font-bold text-brand">{fmtBRL(Number(receitaComandas || 0) + Number(receitaAgendamentos || 0))}</div>
                  <div className="text-xs text-text-muted mt-1">Período selecionado</div>
                </div>
              </div>
            </motion.div>

            {/* Relatório 2: Pagamentos por Método */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-info" />
                    Pagamentos por Método
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">Distribuição por finalizadora</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-info/10 border-info/40 text-info hover:bg-info/20"
                    onClick={() => {
                      const porFin = summary?.totalPorFinalizadora || {};
                      const metodos = Object.entries(porFin)
                        .map(([metodo, valor]) => [metodo, fmtBRL(valor)])
                        .sort((a, b) => {
                          const vA = Number(String(a[1]).replace(/[^\d,]/g, '').replace(',', '.'));
                          const vB = Number(String(b[1]).replace(/[^\d,]/g, '').replace(',', '.'));
                          return vB - vA;
                        });
                      const total = Object.values(porFin).reduce((a, b) => a + b, 0);
                      const rows = [
                        ['Método de Pagamento', 'Valor', '% do Total'],
                        ...metodos.map(([m, v]) => {
                          const val = Object.entries(porFin).find(([k]) => k === m)?.[1] || 0;
                          const pct = ((val / total) * 100).toFixed(1) + '%';
                          return [m, v, pct];
                        }),
                        ['TOTAL', fmtBRL(total), '100%'],
                      ];
                      const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `pagamentos_por_metodo_${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: 'Relatório exportado', description: 'CSV salvo com sucesso' });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-info/10 border-info/40 text-info hover:bg-info/20"
                    onClick={() => {
                      const porFin = summary?.totalPorFinalizadora || {};
                      const total = Object.values(porFin).reduce((a, b) => a + b, 0);
                      const data = Object.entries(porFin)
                        .sort(([, a], [, b]) => b - a)
                        .map(([metodo, valor]) => [
                          metodo,
                          fmtBRL(valor),
                          ((valor / total) * 100).toFixed(1) + '%'
                        ]);
                      data.push(['TOTAL', fmtBRL(total), '100%']);
                      exportToPDF('Pagamentos por Método', ['Método', 'Valor', '% do Total'], data, 'pagamentos_por_metodo');
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>

              {Object.keys(summary?.totalPorFinalizadora || {}).length === 0 ? (
                <div className="text-sm text-text-muted text-center py-8">Sem pagamentos no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método de Pagamento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(summary?.totalPorFinalizadora || {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([metodo, valor]) => {
                          const total = Object.values(summary?.totalPorFinalizadora || {}).reduce((a, b) => a + b, 0);
                          const pct = ((valor / total) * 100).toFixed(1);
                          return (
                            <TableRow key={metodo}>
                              <TableCell className="font-medium">{metodo}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtBRL(valor)}</TableCell>
                              <TableCell className="text-right text-text-secondary">{pct}%</TableCell>
                            </TableRow>
                          );
                        })}
                      <TableRow className="bg-surface-2 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{fmtBRL(Object.values(summary?.totalPorFinalizadora || {}).reduce((a, b) => a + b, 0))}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </motion.div>

            {/* Relatório 3: Produtos Vendidos */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" />
                    Produtos Mais Vendidos
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">Top produtos por faturamento</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-purple-500/10 border-purple-500/40 text-purple-400 hover:bg-purple-500/20"
                    onClick={() => {
                      const rows = [
                        ['Posição', 'Produto', 'Faturamento'],
                        ...allProdutos.slice(0, 50).map((p, i) => [i + 1, p.nome, fmtBRL(p.valor)]),
                      ];
                      const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `produtos_vendidos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: 'Relatório exportado', description: 'CSV salvo com sucesso' });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-purple-500/10 border-purple-500/40 text-purple-400 hover:bg-purple-500/20"
                    onClick={() => {
                      const data = allProdutos.slice(0, 50).map((p, i) => [i + 1, p.nome, fmtBRL(p.valor)]);
                      exportToPDF('Produtos Mais Vendidos', ['#', 'Produto', 'Faturamento'], data, 'produtos_vendidos');
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>

              {allProdutos.length === 0 ? (
                <div className="text-sm text-text-muted text-center py-8">Sem produtos vendidos no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allProdutos.slice(0, 20).map((p, i) => (
                        <TableRow key={`${p.nome}-${i}`}>
                          <TableCell className="text-text-secondary font-mono">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtBRL(p.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {allProdutos.length > 20 && (
                    <div className="text-center mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-brand hover:text-brand/80"
                        onClick={() => setOpenProdutosModal(true)}
                      >
                        Ver todos os {allProdutos.length} produtos
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Relatório 4: Clientes Top */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-warning" />
                    Clientes que Mais Consomem
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">Ranking por faturamento total</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-warning/10 border-warning/40 text-warning hover:bg-warning/20"
                    onClick={() => {
                      const rows = [
                        ['Posição', 'Cliente', 'Faturamento'],
                        ...allClientes.slice(0, 50).map((c, i) => [i + 1, c.nome, fmtBRL(c.valor)]),
                      ];
                      const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `clientes_top_${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: 'Relatório exportado', description: 'CSV salvo com sucesso' });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-warning/10 border-warning/40 text-warning hover:bg-warning/20"
                    onClick={() => {
                      const data = allClientes.slice(0, 50).map((c, i) => [i + 1, c.nome, fmtBRL(c.valor)]);
                      exportToPDF('Clientes que Mais Consomem', ['#', 'Cliente', 'Total Gasto'], data, 'clientes_top');
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>

              {allClientes.length === 0 ? (
                <div className="text-sm text-text-muted text-center py-8">Sem dados de clientes no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Total Gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allClientes.slice(0, 20).map((c, i) => (
                        <TableRow key={`${c.nome}-${i}`}>
                          <TableCell className="text-text-secondary font-mono">{i + 1}</TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtBRL(c.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {allClientes.length > 20 && (
                    <div className="text-center mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-brand hover:text-brand/80"
                        onClick={() => setOpenClientesModal(true)}
                      >
                        Ver todos os {allClientes.length} clientes
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Relatório 5: Evolução Diária */}
            <motion.div variants={itemVariants} className="fx-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    Evolução Diária de Receitas
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">Faturamento dia a dia no período</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-success/10 border-success/40 text-success hover:bg-success/20"
                    onClick={() => {
                      const rows = [
                        ['Data', 'Receita'],
                        ...evolucaoDiaria.map(d => [d.data, fmtBRL(d.valor)]),
                      ];
                      const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `evolucao_diaria_${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: 'Relatório exportado', description: 'CSV salvo com sucesso' });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-success/10 border-success/40 text-success hover:bg-success/20"
                    onClick={() => {
                      const data = evolucaoDiaria.map(d => [d.data, fmtBRL(d.valor)]);
                      exportToPDF('Evolução Diária de Receitas', ['Data', 'Receita'], data, 'evolucao_diaria');
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>

              {evolucaoDiaria.length === 0 ? (
                <div className="text-sm text-text-muted text-center py-8">Sem dados de evolução no período.</div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucaoDiaria} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis 
                        dataKey="data" 
                        stroke="#888" 
                        tick={{ fill: '#888', fontSize: 11 }}
                        tickFormatter={(v) => {
                          const parts = v.split('/');
                          return `${parts[0]}/${parts[1]}`;
                        }}
                      />
                      <YAxis 
                        stroke="#888" 
                        tick={{ fill: '#888', fontSize: 11 }}
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#22C55E' }}
                        formatter={(value) => [fmtBRL(value), 'Receita']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="valor" 
                        stroke="#22C55E" 
                        strokeWidth={2}
                        dot={{ fill: '#22C55E', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

          </TabsContent>
        </Tabs>

        {/* Modais auxiliares */}
        {/* Modal: Detalhes do Recebimento */}
        <Dialog open={recModalOpen} onOpenChange={setRecModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Detalhes do Recebimento</DialogTitle>
              <DialogDescription>
                {recSelecionado?.origem === 'Comanda' ? 'Operação de comanda' : recSelecionado?.origem === 'Agendamento' ? 'Operação de agendamento' : 'Operação'}
              </DialogDescription>
            </DialogHeader>
            {recSelecionado && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-text-muted">Data/Hora</div>
                    <div className="font-medium">{recSelecionado.recebido_em ? new Date(recSelecionado.recebido_em).toLocaleString('pt-BR') : '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Valor</div>
                    <div className="font-semibold">{fmtBRL(recSelecionado.valor)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Origem</div>
                    <div>{recSelecionado.origem || '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Fonte</div>
                    <div>{recSelecionado.fonte ? recSelecionado.fonte.toUpperCase() : '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Finalizadora</div>
                    <div>{recSelecionado.finalizadoras?.nome || recSelecionado.metodo || '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Status</div>
                    <div>{recSelecionado.status || '—'}</div>
                  </div>
                </div>

                {/* Bloco específico por origem */}
                {recSelecionado.origem === 'Comanda' && (
                  <div className="mt-2 p-3 rounded border border-border">
                    <div className="font-semibold mb-2">Comanda</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-text-muted">Cliente</div>
                        <div>{recSelecionado.descricao || '—'}</div>
                      </div>
                    </div>

                    {/* Itens da comanda */}
                    <div className="mt-3">
                      <div className="text-text-muted mb-1">Produtos</div>
                      {recItensLoading ? (
                        <div className="text-xs text-text-muted">Carregando itens...</div>
                      ) : recItens.length === 0 ? (
                        <div className="text-xs text-text-muted">Sem itens encontrados.</div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {recItens.map((it, idx) => (
                            <div key={idx} className="text-xs flex justify-between gap-3">
                              <div className="truncate">
                                <span className="font-mono">{fmt2(it.quantidade)}</span>
                                <span> x </span>
                                <span className="font-medium">{it.descricao}</span>
                              </div>
                              <div className="whitespace-nowrap">
                                {fmtBRL(Number(it.preco_unitario || 0) * Number(it.quantidade || 0))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pagamentos da comanda */}
                    <div className="mt-4">
                      <div className="text-text-muted mb-1">Pagamentos</div>
                      {recPagamentos.length === 0 ? (
                        <div className="text-xs text-text-muted">Sem pagamentos adicionais.</div>
                      ) : (
                        <div className="space-y-1">
                          {recPagamentos.map((p, idx) => (
                            <div key={p.id || idx} className="text-xs flex justify-between gap-3">
                              <div className="truncate">
                                <span className="font-medium">{p.finalizadoras?.nome || p.metodo || '—'}</span>
                              </div>
                              <div className="whitespace-nowrap">{fmtBRL(p.valor)}</div>
                            </div>
                          ))}
                          <div className="text-xs flex justify-between gap-3 pt-2 border-t border-border">
                            <div className="font-semibold">Total</div>
                            <div className="font-semibold">{fmtBRL(recPagamentos.reduce((a, b) => a + Number(b.valor || 0), 0))}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {recSelecionado.origem === 'Agendamento' && (
                  <div className="mt-2 p-3 rounded border border-border">
                    <div className="font-semibold mb-2">Agendamento</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-text-muted">Código</div>
                        <div className="font-mono">#{recSelecionado.agendamento_codigo}</div>
                      </div>
                      <div>
                        <div className="text-text-muted">Participante</div>
                        <div>{recSelecionado.participante_nome}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-text-muted">Quadra</div>
                        <div>{recSelecionado.quadra_nome || '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal: Todos os Produtos */}
        <Dialog open={openProdutosModal} onOpenChange={setOpenProdutosModal}>
          <DialogContent className="max-w-2xl bg-surface text-text-primary border-0">
            <DialogHeader>
              <DialogTitle>Todos os Produtos</DialogTitle>
              <DialogDescription>Ordenados por valor de vendas</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProdutos.map((p, i) => (
                    <TableRow key={`${p.nome}-${i}`}>
                      <TableCell>{i + 1}. {p.nome}</TableCell>
                      <TableCell className="text-center">x{p.quantidade}</TableCell>
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
                    <p className="text-xs text-text-secondary">Total do Dia</p>
                    <p className="text-2xl font-bold text-success tabular-nums">{
                      (() => {
                        const entradas = Number(caixaModalData.resumo?.totalEntradas || 0);
                        const mov = Array.isArray(caixaModalData.movimentacoes) ? caixaModalData.movimentacoes : [];
                        let supr = 0, sang = 0, troco = 0, aj = 0;
                        for (const m of mov) {
                          const t = String(m?.tipo||'').toLowerCase();
                          const v = Number(m?.valor||0);
                          if (t==='suprimento') supr += v; else if (t==='sangria') sang += v; else if (t==='troco') troco += v; else if (t==='ajuste') aj += v;
                        }
                        const totalDia = entradas + supr + aj - sang - troco;
                        return fmtBRL(totalDia);
                      })()
                    }</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs text-text-secondary">Saldo Final (contado)</p>
                    <p className="text-2xl font-bold tabular-nums">{
                      (() => {
                        const contado = (caixaModalData && typeof caixaModalData.valorFinalContado === 'number') ? caixaModalData.valorFinalContado : null;
                        return (contado != null) ? fmtBRL(contado) : '—';
                      })()
                    }</p>
                  </div>
                </div>

                {/* KPIs de Vendas (sem 'Bruto', conforme solicitação) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Modal: Clientes (lista) */}
        <Dialog open={openClientesModal} onOpenChange={(v) => { setOpenClientesModal(v); if (!v) { setSelectedCliente(null); setSelectedClientePagamentos([]); } }}>
          <DialogContent className="max-w-2xl bg-surface text-text-primary border-0">
            <DialogHeader>
              <DialogTitle>Clientes</DialogTitle>
              <DialogDescription>Ordenados por valor pago no período selecionado</DialogDescription>
            </DialogHeader>
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
                    <TableRow key={`${c.nome}-${idx}`} className="cursor-pointer hover:bg-brand/10" onClick={async () => {
                      // Sempre abrir modal de detalhes
                      setClienteDetalhesModalOpen(true);
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
          </DialogContent>
        </Dialog>

        {/* Modal: Detalhes do Cliente */}
        <Dialog open={clienteDetalhesModalOpen} onOpenChange={setClienteDetalhesModalOpen}>
          <DialogContent className="max-w-5xl w-[95vw] md:w-[90vw] max-h-[85vh] bg-surface text-text-primary border-0 overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-lg md:text-xl">Detalhes do Cliente</DialogTitle>
              <DialogDescription className="text-sm md:text-base">
                {selectedCliente?.nome}
              </DialogDescription>
            </DialogHeader>
            {!selectedCliente ? (
              <div className="text-sm text-text-muted py-8 text-center">Nenhum cliente selecionado</div>
            ) : (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-3 md:p-4 bg-surface-2 rounded-lg flex-shrink-0">
                  <span className="text-sm md:text-base text-text-secondary">Total Pago no Período</span>
                  <span className="text-lg md:text-2xl font-bold text-success">{fmtBRL(selectedCliente.valor)}</span>
                </div>
                {loadingClienteDetalhes ? (
                  <div className="text-sm text-text-muted text-center py-8">Carregando detalhes...</div>
                ) : selectedClientePagamentos.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-8">Sem pagamentos no período selecionado.</div>
                ) : (
                  <div className="flex-1 overflow-auto border border-border rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-surface z-10">
                        <TableRow>
                          <TableHead className="text-xs md:text-sm w-[70px] md:w-auto">Data</TableHead>
                          <TableHead className="text-xs md:text-sm w-[80px] md:w-auto">Finaliz.</TableHead>
                          <TableHead className="text-xs md:text-sm w-[60px] md:w-auto">Origem</TableHead>
                          <TableHead className="text-right text-xs md:text-sm w-[70px] md:w-auto">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClientePagamentos.map((pg) => (
                          <TableRow key={pg.id}>
                            <TableCell className="text-xs md:text-sm w-[70px] md:w-auto">
                              <div className="text-[10px] md:text-xs leading-tight">
                                {pg.recebido_em ? new Date(pg.recebido_em).toLocaleString('pt-BR', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                }) : '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm w-[80px] md:w-auto">
                              <div className="truncate max-w-[80px] md:max-w-[200px] text-[10px] md:text-xs" title={pg.finalizadoras?.nome || pg.metodo || '—'}>
                                {pg.finalizadoras?.nome || pg.metodo || '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm w-[60px] md:w-auto">
                              <div className="truncate max-w-[60px] md:max-w-[150px] text-[10px] md:text-xs" title={pg.origem || '—'}>
                                {pg.origem || '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs md:text-sm w-[70px] md:w-auto">
                              <div className="text-[10px] md:text-xs whitespace-nowrap">
                                {fmtBRL(pg.valor)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  );
}
