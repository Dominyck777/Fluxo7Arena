// Página de Finalizadoras - Versão Nova e Limpa - Updated 2025-10-01 12:06
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
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
      "bg-surface rounded-lg border-2 p-4 transition-all",
      onClick ? "cursor-pointer hover:shadow-md" : "",
      isActive ? `border-${color} bg-${color}/5` : "border-border",
      onClick && !isActive ? "hover:border-border-hover" : ""
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", `bg-${color}/10`)}>
        <Icon className={cn("w-5 h-5", `text-${color}`)} />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs font-semibold text-text-secondary">{title}</p>
        <p className="text-xs text-text-muted">{subtitle}</p>
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
      result = result.filter(f => 
        f.tipo?.toLowerCase().includes(search) ||
        f.nome?.toLowerCase().includes(search) ||
        f.codigo?.toLowerCase().includes(search)
      );
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
      <Helmet>
        <title>Finalizadoras - Fluxo7 Arena</title>
      </Helmet>

      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="flex-1 space-y-6 p-4 md:p-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight">Finalizadoras</h1>
            <p className="text-text-secondary mt-1">Gerencie os métodos de pagamento do sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowStats(!showStats)}>
              {showStats ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Finalizadora
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              subtitle="Método mais popular"
              color="warning"
              onClick={handleOpenRanking}
            />
          </div>
        )}

        {/* Filtros e Busca */}
        <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Buscar finalizadora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[200px]">
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

        {/* Tabela de Finalizadoras */}
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
            <div className="overflow-x-auto">
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
                  {filteredFinalizadoras.map((fin) => {
                    return (
                      <tr 
                        key={fin.id} 
                        className="hover:bg-surface-2/50 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(fin)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-text-primary">{fin.codigo_interno || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-text-primary">{fin.nome}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-text-secondary">
                            {fin.taxa_percentual ? `${fin.taxa_percentual}%` : '-'}
                          </span>
                        </td>
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(fin);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={fin.ativo ? "ghost" : "default"}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(fin);
                              }}
                            >
                              {fin.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Modal de Criar/Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
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
              <Select 
                value={formData.codigo_sefaz} 
                onValueChange={(value) => {
                  const sefaz = CODIGOS_SEFAZ.find(c => c.codigo === value);
                  setFormData({ 
                    ...formData, 
                    codigo_sefaz: value,
                    nome: formData.nome || sefaz?.nome || ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent 
                  className="max-h-[300px] border-2 border-border bg-surface shadow-xl"
                  position="popper"
                  sideOffset={5}
                >
                  {CODIGOS_SEFAZ.map(sefaz => (
                    <SelectItem key={sefaz.codigo} value={sefaz.codigo}>
                      {sefaz.codigo} - {sefaz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa (%)</Label>
              <Input
                id="taxa"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0.00"
                value={formData.taxa_percentual}
                onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })}
              />
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

      {/* Modal de Ranking de Finalizadoras */}
      <Dialog open={rankingModalOpen} onOpenChange={setRankingModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ranking de Finalizadoras</DialogTitle>
            <DialogDescription>
              Faturamento por forma de pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Filtro de Período */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={rankingPeriod === 'hoje' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRankingPeriod('hoje');
                    loadRanking('hoje');
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant={rankingPeriod === 'semana' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRankingPeriod('semana');
                    loadRanking('semana');
                  }}
                >
                  7 Dias
                </Button>
                <Button
                  variant={rankingPeriod === 'mes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRankingPeriod('mes');
                    loadRanking('mes');
                  }}
                >
                  30 Dias
                </Button>
                <Button
                  variant={rankingPeriod === 'customizado' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRankingPeriod('customizado')}
                >
                  Período Customizado
                </Button>
              </div>

              {rankingPeriod === 'customizado' && (
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label>Data Inicial</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !rankingDateFrom && "text-text-muted"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {rankingDateFrom ? new Date(rankingDateFrom + 'T12:00:00').toLocaleDateString('pt-BR') : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-surface border border-border" align="start">
                        <DayPicker
                          mode="single"
                          selected={rankingDateFrom ? new Date(rankingDateFrom + 'T12:00:00') : undefined}
                          defaultMonth={rankingDateFrom ? new Date(rankingDateFrom + 'T12:00:00') : new Date()}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              setRankingDateFrom(`${year}-${month}-${day}`);
                            }
                          }}
                          className="rdp-custom p-3"
                          classNames={{
                            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center text-text-primary",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-text-primary hover:bg-surface-2 rounded-md",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell: "text-text-muted rounded-md w-9 font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                            day: "h-9 w-9 p-0 font-normal text-text-primary hover:bg-warning/20 hover:text-warning rounded-md transition-colors",
                            day_selected: "bg-warning text-background hover:bg-warning/90 hover:text-background focus:bg-warning focus:text-background",
                            day_today: "bg-surface-2 text-warning font-bold border border-warning/30",
                            day_outside: "text-text-muted opacity-30",
                            day_disabled: "text-text-muted opacity-30 cursor-not-allowed",
                            day_hidden: "invisible",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex-1">
                    <Label>Data Final</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !rankingDateTo && "text-text-muted"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {rankingDateTo ? new Date(rankingDateTo + 'T12:00:00').toLocaleDateString('pt-BR') : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-surface border border-border" align="start">
                        <DayPicker
                          mode="single"
                          selected={rankingDateTo ? new Date(rankingDateTo + 'T12:00:00') : undefined}
                          defaultMonth={rankingDateTo ? new Date(rankingDateTo + 'T12:00:00') : new Date()}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              setRankingDateTo(`${year}-${month}-${day}`);
                            }
                          }}
                          className="rdp-custom p-3"
                          classNames={{
                            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center text-text-primary",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-text-primary hover:bg-surface-2 rounded-md",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell: "text-text-muted rounded-md w-9 font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                            day: "h-9 w-9 p-0 font-normal text-text-primary hover:bg-warning/20 hover:text-warning rounded-md transition-colors",
                            day_selected: "bg-warning text-background hover:bg-warning/90 hover:text-background focus:bg-warning focus:text-background",
                            day_today: "bg-surface-2 text-warning font-bold border border-warning/30",
                            day_outside: "text-text-muted opacity-30",
                            day_disabled: "text-text-muted opacity-30 cursor-not-allowed",
                            day_hidden: "invisible",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button 
                    onClick={() => loadRanking('customizado', rankingDateFrom, rankingDateTo)}
                    disabled={!rankingDateFrom || !rankingDateTo}
                  >
                    Buscar
                  </Button>
                </div>
              )}
            </div>

            {/* Lista de Finalizadoras */}
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
                  <div 
                    key={fin.id} 
                    className="bg-surface-2 rounded-lg p-4 border border-border hover:border-brand transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
                          index === 0 ? "bg-warning/20 text-warning" : 
                          index === 1 ? "bg-info/20 text-info" :
                          index === 2 ? "bg-success/20 text-success" :
                          "bg-muted/20 text-muted"
                        )}>
                          {index + 1}º
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-text-muted">{fin.codigo}</span>
                            <span className="font-semibold text-text-primary">{fin.nome}</span>
                          </div>
                          <p className="text-xs text-text-muted">{fin.transacoes} transações</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-success">
                          R$ {fin.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-text-muted">
                          Média: R$ {(fin.total / fin.transacoes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRankingModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Finalizadora */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
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
    </>
  );
}
