// Página de Finalizadoras - Versão Nova e Limpa - Updated 2025-10-01 12:06
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, CreditCard, DollarSign, TrendingUp, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listarFinalizadoras, criarFinalizadora, atualizarFinalizadora, ativarDesativarFinalizadora } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DayPicker } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import 'react-day-picker/dist/style.css';

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

// Códigos oficiais SEFAZ para NF-e/NFC-e (Informe Técnico 2024.002)
const CODIGOS_SEFAZ = [
  { codigo: '01', nome: 'Dinheiro' },
  { codigo: '02', nome: 'Cheque' },
  { codigo: '03', nome: 'Cartão de Crédito' },
  { codigo: '04', nome: 'Cartão de Débito' },
  { codigo: '05', nome: 'Cartão da Loja (Private Label)' },
  { codigo: '10', nome: 'Vale Alimentação' },
  { codigo: '11', nome: 'Vale Refeição' },
  { codigo: '12', nome: 'Vale Presente' },
  { codigo: '13', nome: 'Vale Combustível' },
  { codigo: '14', nome: 'Duplicata Mercantil' },
  { codigo: '15', nome: 'Boleto Bancário' },
  { codigo: '16', nome: 'Depósito Bancário' },
  { codigo: '17', nome: 'PIX Dinâmico (QR-Code)' },
  { codigo: '18', nome: 'Transferência Bancária / Carteira Digital' },
  { codigo: '19', nome: 'Programa de Fidelidade / Cashback' },
  { codigo: '20', nome: 'PIX Estático' },
  { codigo: '21', nome: 'Crédito em Loja' },
  { codigo: '22', nome: 'Pagamento Eletrônico não Informado' },
  { codigo: '90', nome: 'Sem Pagamento' },
  { codigo: '99', nome: 'Outros' }
];

const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick, isActive }) => (
  <motion.div 
    variants={itemVariants}
    onClick={onClick}
    className={cn(
      "bg-surface rounded-lg border md:border-2 p-3 md:p-4 transition-all text-center h-[90px] md:h-auto",
      onClick ? "cursor-pointer hover:shadow-md" : "",
      isActive ? `border-${color} bg-${color}/5` : "border-border",
      onClick && !isActive ? "hover:border-border-hover" : ""
    )}
  >
    <div className="flex flex-col items-center justify-center gap-1 md:flex-row md:items-center md:gap-3 h-full">
      <div className={cn("p-1.5 md:p-2 rounded-lg", `bg-${color}/10`)}>
        <Icon className={cn("w-4 h-4 md:w-5 md:h-5", `text-${color}`)} />
      </div>
      <div className="flex-1 md:text-left">
        <p className="text-base md:text-2xl font-bold text-text-primary leading-none">{value}</p>
        <p className="text-[10px] md:text-xs font-semibold text-text-secondary md:mt-0.5">{title}</p>
        <p className="hidden md:block text-xs text-text-muted">{subtitle}</p>
      </div>
    </div>
  </motion.div>
);

export default function FinalizadorasPage() {
  const { toast } = useToast();
  const { userProfile, authReady } = useAuth();
  
  // Estados principais
  const [finalizadoras, setFinalizadoras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showStats, setShowStats] = useState(true);
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  
  // Estados para modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFin, setEditingFin] = useState(null);
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    codigo_interno: '',
    codigo_sefaz: '',
    nome: '',
    taxa_percentual: '',
    ativo: true
  });

  // Modal de seleção de Forma de Pagamento (SEFAZ)
  const [isSefazModalOpen, setIsSefazModalOpen] = useState(false);
  const [sefazSearch, setSefazSearch] = useState('');
  
  // Modal de detalhes
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedFinForDetails, setSelectedFinForDetails] = useState(null);
  const [detailsStats, setDetailsStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('mes'); // hoje, semana, mes, customizado
  
  // Modal de ranking
  const [rankingModalOpen, setRankingModalOpen] = useState(false);
  const [rankingData, setRankingData] = useState([]);
  const [rankingPeriod, setRankingPeriod] = useState('customizado');
  const [rankingDateFrom, setRankingDateFrom] = useState('');
  const [rankingDateTo, setRankingDateTo] = useState('');
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      try { setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 640); } catch {}
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  
  // Carregar finalizadoras
  const loadFinalizadoras = async () => {
    try {
      setLoading(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) return;
      
      const data = await listarFinalizadoras({ somenteAtivas: false, codigoEmpresa });
      console.log('📊 Finalizadoras carregadas:', data);
      console.log('📊 Primeira finalizadora:', data?.[0]);
      setFinalizadoras(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({ title: 'Erro ao carregar', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = finalizadoras.length;
    const ativas = finalizadoras.filter(f => f.ativo).length;
    
    // Encontrar a mais usada (por nome)
    const nomesMaisUsados = finalizadoras.length > 0 
      ? finalizadoras.reduce((acc, f) => {
          const nome = f.nome || 'Sem nome';
          acc[nome] = (acc[nome] || 0) + 1;
          return acc;
        }, {})
      : {};
    
    const maisUsada = Object.entries(nomesMaisUsados).sort((a, b) => b[1] - a[1])[0];
    const maisUsadaLabel = maisUsada ? maisUsada[0] : '-';
    
    return { total, ativas, maisUsada: maisUsadaLabel };
  }, [finalizadoras]);

  // Filtros
  const filteredFinalizadoras = useMemo(() => {
    let result = [...finalizadoras];
    
    // Busca por texto
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(f => {
        const tipo = String(f.tipo || '').toLowerCase();
        const nome = String(f.nome || '').toLowerCase();
        const codInt = String(f.codigo_interno || '').toLowerCase();
        // Permite busca por código interno (mesmo se usuário digitar sem zero à esquerda)
        const numericSearch = search.replace(/\D/g, '');
        const codIntNumeric = String(f.codigo_interno || '').replace(/\D/g, '');
        return (
          tipo.includes(search) ||
          nome.includes(search) ||
          codInt.includes(search) ||
          (!!numericSearch && codIntNumeric === numericSearch)
        );
      });
    }
    
    // Filtro por tipo
    if (filterTipo !== 'all') {
      result = result.filter(f => f.tipo === filterTipo);
    }
    
    // Filtro por status
    if (filterStatus !== 'all') {
      result = result.filter(f => filterStatus === 'active' ? f.ativo : !f.ativo);
    }
    
    // Filtro por card de estatística
    if (activeStatFilter === 'ativas') {
      result = result.filter(f => f.ativo);
    }
    
    // Ordenar por código interno (ordem crescente)
    result.sort((a, b) => {
      const codA = parseInt(a.codigo_interno) || 0;
      const codB = parseInt(b.codigo_interno) || 0;
      return codA - codB;
    });
    
    return result;
  }, [finalizadoras, searchTerm, filterTipo, filterStatus, activeStatFilter]);

  // Abrir modal para criar
  const handleCreate = () => {
    setEditingFin(null);
    // Gerar próximo código interno automaticamente
    const maxCodigo = finalizadoras.reduce((max, fin) => {
      const cod = parseInt(fin.codigo_interno) || 0;
      return cod > max ? cod : max;
    }, 0);
    const proximoCodigo = String(maxCodigo + 1).padStart(2, '0');
    
    setFormData({ 
      codigo_interno: proximoCodigo, 
      codigo_sefaz: '', 
      nome: '', 
      taxa_percentual: '', 
      ativo: true 
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleEdit = (fin) => {
    setEditingFin(fin);
    setFormData({
      codigo_interno: fin.codigo_interno || '',
      codigo_sefaz: fin.codigo_sefaz || '',
      nome: fin.nome || '',
      taxa_percentual: fin.taxa_percentual != null ? String(fin.taxa_percentual) : '',
      ativo: fin.ativo !== false
    });
    setIsModalOpen(true);
  };
  
  // Carregar estatísticas da finalizadora
  const loadFinalizadoraStats = async (finalizadoraId, periodo = 'mes') => {
    try {
      setLoadingStats(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) return;

      // Calcular datas do período
      const now = new Date();
      let from, to = now.toISOString();
      
      switch (periodo) {
        case 'hoje':
          from = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          break;
        case 'semana':
          from = new Date(now.setDate(now.getDate() - 7)).toISOString();
          break;
        case 'mes':
          from = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
          break;
        default:
          from = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      }

      // Buscar pagamentos da finalizadora
      const { data: pagamentos, error } = await supabase
        .from('pagamentos')
        .select('valor, recebido_em, status')
        .eq('finalizadora_id', finalizadoraId)
        .eq('codigo_empresa', codigoEmpresa)
        .gte('recebido_em', from)
        .lte('recebido_em', to)
        .neq('status', 'Cancelado')
        .neq('status', 'Estornado');

      if (error) throw error;

      // Calcular estatísticas
      const transacoes = pagamentos?.length || 0;
      const faturamento = pagamentos?.reduce((sum, p) => sum + (Number(p.valor) || 0), 0) || 0;
      const ticketMedio = transacoes > 0 ? faturamento / transacoes : 0;
      const ultimaUtilizacao = pagamentos?.[pagamentos.length - 1]?.recebido_em || null;

      setDetailsStats({
        transacoes,
        faturamento,
        ticketMedio,
        ultimaUtilizacao
      });
    } catch (e) {
      console.error('Erro ao carregar estatísticas:', e);
      toast({ title: 'Erro ao carregar estatísticas', description: e?.message, variant: 'destructive' });
    } finally {
      setLoadingStats(false);
    }
  };

  // Carregar ranking de finalizadoras
  const loadRanking = async (periodo = 'customizado', dateFrom = null, dateTo = null) => {
    try {
      setLoadingRanking(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) return;

      // Calcular datas do período
      let from, to;
      
      if (periodo === 'customizado' && dateFrom && dateTo) {
        from = new Date(dateFrom).toISOString();
        to = new Date(dateTo + 'T23:59:59').toISOString();
      } else {
        const now = new Date();
        to = now.toISOString();
        
        switch (periodo) {
          case 'hoje':
            from = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            break;
          case 'semana':
            from = new Date(now.setDate(now.getDate() - 7)).toISOString();
            break;
          case 'mes':
            from = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
            break;
          default:
            from = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        }
      }

      // Buscar todos os pagamentos do período
      const { data: pagamentos, error } = await supabase
        .from('pagamentos')
        .select('finalizadora_id, valor, finalizadoras!pagamentos_finalizadora_id_fkey(id, codigo_interno, nome)')
        .eq('codigo_empresa', codigoEmpresa)
        .gte('recebido_em', from)
        .lte('recebido_em', to)
        .neq('status', 'Cancelado')
        .neq('status', 'Estornado');

      if (error) throw error;

      // Agrupar por finalizadora
      const grouped = {};
      pagamentos?.forEach(p => {
        const finId = p.finalizadora_id;
        if (!finId) return;
        
        if (!grouped[finId]) {
          grouped[finId] = {
            id: finId,
            codigo: p.finalizadoras?.codigo_interno || '-',
            nome: p.finalizadoras?.nome || 'Sem nome',
            total: 0,
            transacoes: 0
          };
        }
        grouped[finId].total += Number(p.valor) || 0;
        grouped[finId].transacoes += 1;
      });

      // Converter para array e ordenar por valor (maior para menor)
      const ranking = Object.values(grouped).sort((a, b) => b.total - a.total);
      setRankingData(ranking);
    } catch (e) {
      console.error('Erro ao carregar ranking:', e);
      toast({ title: 'Erro ao carregar ranking', description: e?.message, variant: 'destructive' });
    } finally {
      setLoadingRanking(false);
    }
  };

  // Abrir modal de ranking
  const handleOpenRanking = () => {
    setRankingModalOpen(true);
    setRankingPeriod('customizado');
    // Definir datas padrão (último mês)
    const hoje = new Date();
    const umMesAtras = new Date();
    umMesAtras.setMonth(umMesAtras.getMonth() - 1);
    setRankingDateFrom(umMesAtras.toISOString().split('T')[0]);
    setRankingDateTo(hoje.toISOString().split('T')[0]);
    loadRanking('customizado', umMesAtras.toISOString().split('T')[0], hoje.toISOString().split('T')[0]);
  };

  // Abrir modal de detalhes
  const handleViewDetails = (fin) => {
    setSelectedFinForDetails(fin);
    setDetailsModalOpen(true);
    setPeriodFilter('mes');
    loadFinalizadoraStats(fin.id, 'mes');
  };

  // Salvar (criar ou editar)
  const handleSave = async () => {
    try {
      if (!formData.nome?.trim()) {
        toast({ title: 'Nome é obrigatório', variant: 'warning' });
        return;
      }
      
      if (!formData.codigo_sefaz) {
        toast({ title: 'Código SEFAZ é obrigatório', variant: 'warning' });
        return;
      }

      // Validar unicidade do código interno
      if (formData.codigo_interno?.trim()) {
        const codigoJaExiste = finalizadoras.some(f => 
          f.codigo_interno === formData.codigo_interno.trim() && 
          (!editingFin || f.id !== editingFin.id)
        );
        if (codigoJaExiste) {
          toast({ title: 'Código já existe', description: 'Este código interno já está em uso por outra finalizadora', variant: 'warning' });
          return;
        }
      }

      setSaving(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      
      const payload = {
        codigo_interno: formData.codigo_interno?.trim() || null,
        codigo_sefaz: formData.codigo_sefaz,
        nome: formData.nome.trim(),
        tipo: 'outros', // Mantém compatibilidade com banco
        taxa_percentual: formData.taxa_percentual === '' ? null : Number(formData.taxa_percentual),
        ativo: formData.ativo
      };

      if (editingFin) {
        await atualizarFinalizadora(editingFin.id, payload, codigoEmpresa);
        toast({ title: 'Finalizadora atualizada!', variant: 'success' });
      } else {
        await criarFinalizadora(payload, codigoEmpresa);
        toast({ title: 'Finalizadora criada!', variant: 'success' });
      }

      setIsModalOpen(false);
      await loadFinalizadoras();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Toggle ativo/inativo
  const handleToggleStatus = async (fin) => {
    try {
      await ativarDesativarFinalizadora(fin.id, !fin.ativo, userProfile?.codigo_empresa);
      toast({ title: fin.ativo ? 'Desativada' : 'Ativada', variant: 'success' });
      await loadFinalizadoras();
    } catch (e) {
      toast({ title: 'Erro ao alterar status', description: e?.message, variant: 'destructive' });
    }
  };

  // Carregar ao montar
  useEffect(() => {
    if (authReady && userProfile?.codigo_empresa) {
      loadFinalizadoras();
    }
  }, [authReady, userProfile?.codigo_empresa]);

  return (
    <>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="flex-1 space-y-6 p-4 md:p-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight leading-tight">Finalizadoras</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setShowStats(!showStats)} className="h-9 w-9">
              {showStats ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button onClick={handleCreate} className="gap-2 h-9 px-3 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              <span className="md:hidden">Nova</span>
              <span className="hidden md:inline">Nova Finalizadora</span>
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        {showStats && (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-3 md:gap-6">
            <StatCard
              icon={CreditCard}
              title="Total"
              value={stats.total}
              subtitle="Finalizadoras cadastradas"
              color="brand"
            />
            <StatCard
              icon={DollarSign}
              title="Ativas"
              value={stats.ativas}
              subtitle="Disponíveis para uso"
              color="success"
              onClick={() => setActiveStatFilter(activeStatFilter === 'ativas' ? null : 'ativas')}
              isActive={activeStatFilter === 'ativas'}
            />
            <StatCard
              icon={TrendingUp}
              title="Mais Usada"
              value={stats.maisUsada}
              subtitle="MÈtodo mais popular"
              color="warning"
              onClick={handleOpenRanking}
            />
          </div>
        )}

        {/* Filtros e Busca */}
        <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 basis-0 flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Buscar finalizadora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[110px] md:w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Lista Responsiva de Finalizadoras */}
        <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent"></div>
              <p className="mt-4 text-text-muted">Carregando...</p>
            </div>
          ) : filteredFinalizadoras.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma finalizadora encontrada</p>
            </div>
          ) : (
            <>
              {/* Mobile: Cards (sem scroll horizontal) */}
              <div className="md:hidden divide-y divide-border">
                {filteredFinalizadoras.map((fin) => (
                  <div key={fin.id} className="p-3 flex flex-col gap-2 hover:bg-surface-2/50 cursor-pointer" onClick={() => handleViewDetails(fin)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-border font-mono text-xs text-text-secondary">{fin.codigo_interno || '-'}</span>
                        <span className="font-semibold text-sm text-text-primary truncate" title={fin.nome}>{fin.nome}</span>
                      </div>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
                        fin.ativo ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", fin.ativo ? "bg-success" : "bg-muted")} />
                        {fin.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <div className="flex items-center gap-3">
                        <span>Taxa: {fin.taxa_percentual ? `${fin.taxa_percentual}%` : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleEdit(fin)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant={fin.ativo ? 'ghost' : 'default'} size="sm" className="h-7 px-2" onClick={() => handleToggleStatus(fin)}>
                          {fin.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-2 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-text-secondary">Código</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-text-secondary">Descrição</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-text-secondary">Taxa (%)</th>
                      <th className="text-center px-6 py-4 text-sm font-semibold text-text-secondary">Status</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-text-secondary">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFinalizadoras.map((fin) => (
                      <tr key={fin.id} className="hover:bg-surface-2/50 transition-colors cursor-pointer" onClick={() => handleViewDetails(fin)}>
                        <td className="px-6 py-4"><span className="font-mono text-sm text-text-primary">{fin.codigo_interno || '-'}</span></td>
                        <td className="px-6 py-4"><span className="font-semibold text-text-primary">{fin.nome}</span></td>
                        <td className="px-6 py-4"><span className="text-text-secondary">{fin.taxa_percentual ? `${fin.taxa_percentual}%` : '-'}</span></td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
                            fin.ativo ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                          )}>
                            <span className={cn("w-2 h-2 rounded-full", fin.ativo ? "bg-success" : "bg-muted")} />
                            {fin.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(fin)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant={fin.ativo ? 'ghost' : 'default'} size="sm" onClick={() => handleToggleStatus(fin)}>
                              {fin.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Modal de Criar/Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] w-[92vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFin ? 'Editar Finalizadora' : 'Nova Finalizadora'}</DialogTitle>
            <DialogDescription>
              {editingFin ? 'Atualize as informações da finalizadora' : 'Adicione um novo método de pagamento'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_interno">Código Finalizadora</Label>
              <Input
                id="codigo_interno"
                type="text"
                placeholder="Ex: 01, 02, 03..."
                value={formData.codigo_interno}
                onChange={(e) => setFormData({ ...formData, codigo_interno: e.target.value })}
              />
              <p className="text-xs text-text-muted">Gerado automaticamente, mas pode ser editado</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Descrição *</Label>
              <Input
                id="nome"
                placeholder="Ex: PIX, Dinheiro, Cartão de Crédito..."
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo_sefaz">Forma de Pagamento NF-e/NFC-e *</Label>
              <Button
                type="button"
                variant="outline"
                className="justify-between w-full"
                onClick={() => setIsSefazModalOpen(true)}
              >
                {formData.codigo_sefaz
                  ? `${formData.codigo_sefaz} - ${(CODIGOS_SEFAZ.find(c => c.codigo === formData.codigo_sefaz)?.nome) || ''}`
                  : 'Selecione a forma de pagamento'}
              </Button>
              <p className="text-xs text-text-muted">A lista abrirá em um modal com rolagem.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa</Label>
              <div className="relative">
                <Input
                  id="taxa"
                  inputMode="decimal"
                  placeholder="0,00"
                  className="pr-10"
                  value={formData.taxa_percentual}
                  onChange={(e) => {
                    const v = String(e.target.value).replace(/[^0-9.,]/g, '').replace(/,/g, '.');
                    if (v === '') { setFormData({ ...formData, taxa_percentual: '' }); return; }
                    const n = Number(v);
                    if (Number.isFinite(n)) {
                      const clamped = Math.max(0, Math.min(100, n));
                      setFormData({ ...formData, taxa_percentual: String(clamped) });
                    }
                  }}
                  onBlur={() => {
                    const v = String(formData.taxa_percentual || '').replace(/,/g, '.');
                    if (v === '') return;
                    const n = Number(v);
                    if (Number.isFinite(n)) {
                      const clamped = Math.max(0, Math.min(100, n));
                      setFormData((prev) => ({ ...prev, taxa_percentual: clamped.toFixed(2) }));
                    }
                  }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
              </div>
              <p className="text-xs text-text-muted">Deixe vazio se não houver taxa</p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="ativo" className="text-sm font-normal cursor-pointer">
                Finalizadora ativa
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Seleção SEFAZ */}
      <Dialog open={isSefazModalOpen} onOpenChange={setIsSefazModalOpen}>
        <DialogContent className="sm:max-w-[520px] w-[92vw]">
          <DialogHeader>
            <DialogTitle>Selecionar Forma de Pagamento (SEFAZ)</DialogTitle>
            <DialogDescription>Busque por código ou nome</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Ex.: 03, crédito, pix..."
              value={sefazSearch}
              onChange={(e) => setSefazSearch(e.target.value)}
            />
            <div className="max-h-[420px] overflow-auto fx-scroll rounded-md border border-border">
              <ul className="divide-y divide-border">
                {CODIGOS_SEFAZ
                  .filter((c) => {
                    const q = (sefazSearch || '').toLowerCase();
                    if (!q) return true;
                    return c.codigo.includes(q) || String(c.nome).toLowerCase().includes(q);
                  })
                  .map((c) => (
                    <li key={c.codigo}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 hover:bg-surface-2 ${formData.codigo_sefaz === c.codigo ? 'bg-surface-2' : ''}`}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            codigo_sefaz: c.codigo,
                          }));
                          setIsSefazModalOpen(false);
                        }}
                      >
                        <span className="font-mono mr-2 text-text-secondary">{c.codigo}</span>
                        <span>{c.nome}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Finalizadora */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] w-[92vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Finalizadora</DialogTitle>
            <DialogDescription>
              Estatísticas e informações completas
            </DialogDescription>
          </DialogHeader>

          {selectedFinForDetails && (
            <div className="space-y-6 py-4">
              {/* Informações Básicas */}
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <h3 className="font-semibold text-text-primary mb-3">Informações</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Código Finalizadora</p>
                    <p className="font-mono text-sm text-text-primary">{selectedFinForDetails.codigo_interno || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Forma de Pagamento NF-e/NFC-e</p>
                    <p className="font-mono text-sm text-text-primary">{selectedFinForDetails.codigo_sefaz || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Descrição</p>
                    <p className="font-medium text-text-primary">{selectedFinForDetails.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Taxa</p>
                    <p className="font-medium text-text-primary">
                      {selectedFinForDetails.taxa_percentual ? `${selectedFinForDetails.taxa_percentual}%` : 'Sem taxa'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-text-muted mb-1">Status</p>
                    <span className={cn(
                      "inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium",
                      selectedFinForDetails.ativo ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                    )}>
                      <span className={cn("w-2 h-2 rounded-full", selectedFinForDetails.ativo ? "bg-success" : "bg-muted")} />
                      {selectedFinForDetails.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filtro de Período */}
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <h3 className="font-semibold text-text-primary mb-3">Período de Análise</h3>
                <div className="flex gap-2">
                  <Button
                    variant={periodFilter === 'hoje' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setPeriodFilter('hoje');
                      loadFinalizadoraStats(selectedFinForDetails.id, 'hoje');
                    }}
                  >
                    Hoje
                  </Button>
                  <Button
                    variant={periodFilter === 'semana' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setPeriodFilter('semana');
                      loadFinalizadoraStats(selectedFinForDetails.id, 'semana');
                    }}
                  >
                    7 Dias
                  </Button>
                  <Button
                    variant={periodFilter === 'mes' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setPeriodFilter('mes');
                      loadFinalizadoraStats(selectedFinForDetails.id, 'mes');
                    }}
                  >
                    30 Dias
                  </Button>
                </div>
              </div>

              {/* Estatísticas de Uso */}
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <h3 className="font-semibold text-text-primary mb-3">Estatísticas de Uso</h3>
                {loadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                  </div>
                ) : detailsStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Total de Transações</span>
                      <span className="font-semibold text-text-primary">{detailsStats.transacoes}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Faturamento Total</span>
                      <span className="font-semibold text-success">
                        R$ {detailsStats.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Ticket Médio</span>
                      <span className="font-semibold text-text-primary">
                        R$ {detailsStats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Última Utilização</span>
                      <span className="font-medium text-text-muted">
                        {detailsStats.ultimaUtilizacao 
                          ? new Date(detailsStats.ultimaUtilizacao).toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Nunca utilizada'
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-muted">
                    <p className="text-sm">Nenhum dado disponível</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setDetailsModalOpen(false);
              handleEdit(selectedFinForDetails);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Ranking de Finalizadoras */}
      <Dialog open={rankingModalOpen} onOpenChange={setRankingModalOpen}>
        <DialogContent className="sm:max-w-[700px] w-[92vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ranking de Finalizadoras</DialogTitle>
            <DialogDescription>Faturamento por forma de pagamento</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant={rankingPeriod === 'hoje' ? 'default' : 'outline'} size="sm" className="flex-1 min-w-[70px]" onClick={() => { setRankingPeriod('hoje'); loadRanking('hoje'); }}>Hoje</Button>
                <Button variant={rankingPeriod === 'semana' ? 'default' : 'outline'} size="sm" className="flex-1 min-w-[70px]" onClick={() => { setRankingPeriod('semana'); loadRanking('semana'); }}>7 Dias</Button>
                <Button variant={rankingPeriod === 'mes' ? 'default' : 'outline'} size="sm" className="flex-1 min-w-[70px]" onClick={() => { setRankingPeriod('mes'); loadRanking('mes'); }}>30 Dias</Button>
                <Button variant={rankingPeriod === 'customizado' ? 'default' : 'outline'} size="sm" className="flex-1 min-w-[70px]" onClick={() => setRankingPeriod('customizado')}>Período</Button>
              </div>

              {rankingPeriod === 'customizado' && (
                isMobile ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Data Inicial</Label>
                        <input type="date" className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text-primary" value={rankingDateFrom} onChange={(e) => setRankingDateFrom(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Data Final</Label>
                        <input type="date" className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text-primary" value={rankingDateTo} onChange={(e) => setRankingDateTo(e.target.value)} />
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => loadRanking('customizado', rankingDateFrom, rankingDateTo)} disabled={!rankingDateFrom || !rankingDateTo || loadingRanking}>{loadingRanking ? 'Buscando...' : 'Buscar'}</Button>
                  </div>
                ) : (
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label>Data Inicial</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !rankingDateFrom && "text-text-muted")}> 
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {rankingDateFrom ? new Date(rankingDateFrom + 'T12:00:00').toLocaleDateString('pt-BR') : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-surface border border-border" align="start">
                          <DayPicker mode="single" selected={rankingDateFrom ? new Date(rankingDateFrom + 'T12:00:00') : undefined} onSelect={(date) => { if (date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); setRankingDateFrom(`${y}-${m}-${d}`); } }} className="p-3" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex-1">
                      <Label>Data Final</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !rankingDateTo && "text-text-muted")}> 
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {rankingDateTo ? new Date(rankingDateTo + 'T12:00:00').toLocaleDateString('pt-BR') : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-surface border border-border" align="start">
                          <DayPicker mode="single" selected={rankingDateTo ? new Date(rankingDateTo + 'T12:00:00') : undefined} onSelect={(date) => { if (date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); setRankingDateTo(`${y}-${m}-${d}`); } }} className="p-3" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button onClick={() => loadRanking('customizado', rankingDateFrom, rankingDateTo)} disabled={!rankingDateFrom || !rankingDateTo || loadingRanking}>Buscar</Button>
                  </div>
                )
              )}
            </div>

            {loadingRanking ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
              </div>
            ) : rankingData.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <p>Nenhuma transação no período selecionado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankingData.map((fin, index) => (
                  <div key={fin.id} className="bg-surface-2 rounded-lg p-3 md:p-4 border border-border">
                    <div className="flex items-start md:items-center justify-between gap-3">
                      <div className="flex items-start md:items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className={cn("flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full font-bold text-xs md:text-sm flex-shrink-0", index === 0 ? "bg-warning/20 text-warning" : index === 1 ? "bg-info/20 text-info" : index === 2 ? "bg-success/20 text-success" : "bg-muted/20 text-muted")}>{index + 1}º</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="font-mono text-[10px] md:text-xs text-text-muted">{fin.codigo}</span>
                            <span className="font-semibold text-sm md:text-base text-text-primary truncate">{fin.nome}</span>
                          </div>
                          <p className="text-[10px] md:text-xs text-text-muted">{fin.transacoes} transações</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base md:text-lg font-bold text-success whitespace-nowrap">R$ {fin.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] md:text-xs text-text-muted whitespace-nowrap">Média: R$ {(fin.total / fin.transacoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRankingModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
