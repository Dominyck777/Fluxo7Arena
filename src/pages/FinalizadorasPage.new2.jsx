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

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const TIPOS_FINALIZADORA = [
  { value: 'dinheiro', label: 'Dinheiro', icon: '💵', color: 'success' },
  { value: 'pix', label: 'PIX', icon: '📱', color: 'brand' },
  { value: 'credito', label: 'Crédito', icon: '💳', color: 'info' },
  { value: 'debito', label: 'Débito', icon: '💳', color: 'warning' },
  { value: 'voucher', label: 'Voucher', icon: '🎫', color: 'purple' },
  { value: 'outros', label: 'Outros', icon: '📄', color: 'muted' }
];

const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick, isActive }) => (
  <motion.div 
    variants={itemVariants}
    onClick={onClick}
    className={cn(
      "bg-surface rounded-lg border-2 p-6 cursor-pointer transition-all hover:shadow-lg",
      isActive ? `border-${color} bg-${color}/5` : "border-border hover:border-border-hover"
    )}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-lg", `bg-${color}/10`)}>
        <Icon className={cn("w-6 h-6", `text-${color}`)} />
      </div>
      <div className="text-right">
        <p className="text-3xl font-bold text-text-primary">{value}</p>
      </div>
    </div>
    <div>
      <p className="text-sm font-semibold text-text-secondary mb-1">{title}</p>
      <p className="text-xs text-text-muted">{subtitle}</p>
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
    tipo: 'pix',
    taxa_percentual: '',
    ativo: true
  });
  
  // Carregar finalizadoras
  const loadFinalizadoras = async () => {
    try {
      setLoading(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) return;
      
      const data = await listarFinalizadoras({ somenteAtivas: false, codigoEmpresa });
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
    
    // Encontrar a mais usada (simulado - você pode adicionar lógica real depois)
    const tipoMaisUsado = finalizadoras.length > 0 
      ? finalizadoras.reduce((acc, f) => {
          acc[f.tipo] = (acc[f.tipo] || 0) + 1;
          return acc;
        }, {})
      : {};
    
    const maisUsada = Object.entries(tipoMaisUsado).sort((a, b) => b[1] - a[1])[0];
    const maisUsadaLabel = maisUsada ? TIPOS_FINALIZADORA.find(t => t.value === maisUsada[0])?.label || maisUsada[0] : '-';
    
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
        f.nome?.toLowerCase().includes(search)
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
    
    return result;
  }, [finalizadoras, searchTerm, filterTipo, filterStatus, activeStatFilter]);

  // Abrir modal para criar
  const handleCreate = () => {
    setEditingFin(null);
    setFormData({ tipo: 'pix', taxa_percentual: '', ativo: true });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleEdit = (fin) => {
    setEditingFin(fin);
    setFormData({
      tipo: fin.tipo || 'outros',
      taxa_percentual: fin.taxa_percentual != null ? String(fin.taxa_percentual) : '',
      ativo: fin.ativo !== false
    });
    setIsModalOpen(true);
  };

  // Salvar (criar ou editar)
  const handleSave = async () => {
    try {
      if (!formData.tipo) {
        toast({ title: 'Tipo é obrigatório', variant: 'warning' });
        return;
      }

      setSaving(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      
      const payload = {
        nome: TIPOS_FINALIZADORA.find(t => t.value === formData.tipo)?.label || formData.tipo,
        tipo: formData.tipo,
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
              onClick={() => setActiveStatFilter(null)}
              isActive={activeStatFilter === null}
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
            
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TIPOS_FINALIZADORA.map(tipo => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.icon} {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

        {/* Lista de Finalizadoras */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredFinalizadoras.map((fin) => {
                const tipoInfo = TIPOS_FINALIZADORA.find(t => t.value === fin.tipo) || TIPOS_FINALIZADORA[5];
                return (
                  <div
                    key={fin.id}
                    className={cn(
                      "bg-surface-2 rounded-lg border-2 p-4 transition-all hover:shadow-md",
                      fin.ativo ? "border-border" : "border-border opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{tipoInfo.icon}</span>
                        <div>
                          <h3 className="font-semibold text-text-primary">{tipoInfo.label}</h3>
                          <p className="text-xs text-text-muted">
                            {fin.taxa_percentual ? `Taxa: ${fin.taxa_percentual}%` : 'Sem taxa'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        fin.ativo ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                      )}>
                        {fin.ativo ? 'Ativa' : 'Inativa'}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(fin)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant={fin.ativo ? "destructive" : "default"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleToggleStatus(fin)}
                      >
                        {fin.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
              <Label htmlFor="tipo">Tipo de Pagamento</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_FINALIZADORA.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.icon} {tipo.label}
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
    </>
  );
}
