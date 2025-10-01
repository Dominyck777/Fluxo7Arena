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
  { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { value: 'pix', label: 'PIX', icon: '📱' },
  { value: 'credito', label: 'Crédito', icon: '💳' },
  { value: 'debito', label: 'Débito', icon: '💳' },
  { value: 'voucher', label: 'Voucher', icon: '🎫' },
  { value: 'outros', label: 'Outros', icon: '📄' }
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
  
  // Ref para controle
  const mountedRef = useRef(true);

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

  // ===== Helpers e derivados de UI (filtros/ordenação e edição inline) =====
  const tiposDisponiveis = useMemo(() => {
    try {
      const set = new Set((finalizadoras || []).map(f => (f?.tipo || 'outros')));
      const arr = Array.from(set);
      // fallback padrão para ordenar e exibir mesmo sem dados
      const base = ['dinheiro','credito','debito','pix','voucher','outros'];
      const merged = Array.from(new Set([...arr, ...base]));
      return merged.sort();
    } catch {
      return ['dinheiro','credito','debito','pix','voucher','outros'];
    }
  }, [finalizadoras]);

  // Estatísticas
  const stats = useMemo(() => {
    const ativas = finalizadoras.filter(f => f.ativo).length;
    const comTaxa = finalizadoras.filter(f => f.taxa_percentual && f.taxa_percentual > 0).length;
    const tiposUnicos = new Set(finalizadoras.map(f => f.tipo || 'outros')).size;
    return {
      ativas,
      comTaxa,
      tiposUnicos
    };
  }, [finalizadoras]);

  const filteredSorted = useMemo(() => {
    let rows = Array.isArray(finalizadoras) ? [...finalizadoras] : [];
    const s = (searchTerm || '').trim().toLowerCase();
    if (s) rows = rows.filter(r => (r?.nome || '').toLowerCase().includes(s));
    if (filterTipo !== 'all') rows = rows.filter(r => (r?.tipo || 'outros') === filterTipo);
    if (filterStatus !== 'all') rows = rows.filter(r => (filterStatus === 'active') ? !!r?.ativo : !r?.ativo);
    
    // Filtro por card de estatística
    if (activeFilter === 'ativas') rows = rows.filter(r => !!r?.ativo);
    if (activeFilter === 'com_taxa') rows = rows.filter(r => r?.taxa_percentual && r.taxa_percentual > 0);
    
    rows.sort((a,b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      const av = (sort.by === 'tipo' ? (a?.tipo || '') : (a?.nome || '')).toLowerCase();
      const bv = (sort.by === 'tipo' ? (b?.tipo || '') : (b?.nome || '')).toLowerCase();
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });
    return rows;
  }, [finalizadoras, searchTerm, filterTipo, filterStatus, sort, activeFilter]);

  // Paginação
  const totalItems = filteredSorted.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, currentPage, pageSize]);

  // Reset para a primeira página quando os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTipo, filterStatus, pageSize]);

  const toggleSort = (by) => {
    setSort(prev => prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' });
  };

  const handleStatCardClick = (filter) => {
    setActiveFilter(prev => prev === filter ? 'all' : filter);
  };

  const saveTaxaInline = async (fin) => {
    try {
      const raw = taxaDrafts[fin.id] ?? '';
      const parsed = raw === '' ? null : Number(String(raw).replace(',', '.'));
      if (parsed != null && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
        toast({ title: 'Taxa inválida', description: 'Informe um percentual entre 0 e 100.', variant: 'warning' });
        return;
      }
      setSavingTaxaId(fin.id);
      await atualizarFinalizadora(fin.id, { ...fin, taxa_percentual: parsed }, userProfile?.codigo_empresa);
      await loadFinalizadoras();
      toast({ title: 'Taxa atualizada', variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao atualizar taxa', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setSavingTaxaId(null);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    try { console.log('[Finalizadoras] mount'); } catch {}
    // Cache hydration immediately (even if authReady is false)
    try {
      const cachedCodigo = (() => {
        try {
          const raw = localStorage.getItem('auth:userProfile');
          return raw ? (JSON.parse(raw)?.codigo_empresa || null) : null;
        } catch { return null; }
      })();
      const codigoToUse = userProfile?.codigo_empresa || cachedCodigo;
      if (codigoToUse) {
        const cacheKey = `finalizadoras:list:${codigoToUse}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          setFinalizadoras(cached);
          lastDataSizeRef.current = cached.length;
        }
      }
    } catch {}
    if (authReady && userProfile?.codigo_empresa) {
      loadFinalizadoras();
    }
    const onVis = () => {
      try { console.log('[Finalizadoras] visibilitychange', { visibility: document.visibilityState, lastLoadTs: lastLoadTsRef.current, lastDataSize: lastDataSizeRef.current }); } catch {}
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - (lastLoadTsRef.current || 0);
        if (elapsed > 30000 || lastDataSizeRef.current === 0) {
          loadFinalizadoras();
        }
      }
    };
    const onFocus = () => {
      try { console.log('[Finalizadoras] window:focus'); } catch {}
      const elapsed = Date.now() - (lastLoadTsRef.current || 0);
      if (elapsed > 30000 || lastDataSizeRef.current === 0) {
        loadFinalizadoras();
      }
    };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      try { console.log('[Finalizadoras] unmount'); } catch {}
      mountedRef.current = false;
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [authReady, userProfile?.codigo_empresa]);

  const submitCreate = async () => {
    const trace = '[Finalizadoras:create]';
    alert('🔵 FUNÇÃO INICIOU!\n\nNome: ' + formFin.nome + '\nTipo: ' + formFin.tipo + '\nEmpresa: ' + userProfile?.codigo_empresa);
    console.log('🔵 [INICIO] submitCreate chamado');
    console.log('🔵 Estado atual:', { 
      savingCreate, 
      formFin, 
      userProfile: userProfile?.codigo_empresa,
      authReady 
    });
    
    try {
      alert('🟢 STEP 1 - Validando nome: ' + formFin.nome);
      console.log('🟢 [STEP 1] Iniciando try block');
      try { console.group(trace); } catch {}
      try { console.log('payloadDraft', { ...formFin }); } catch {}
      
      console.log('🟢 [STEP 2] Validando nome:', formFin.nome);
      if (!formFin.nome?.trim()) {
        alert('⚠️ ERRO - Nome vazio!');
        console.warn('⚠️ Nome vazio - abortando');
        toast({ title: 'Nome é obrigatório', variant: 'warning' });
        return;
      }
      
      alert('🟢 STEP 2 - Nome OK, setando savingCreate = true');
      console.log('🟢 [STEP 3] Setando savingCreate = true');
      setSavingCreate(true);
      
      const payload = {
        nome: formFin.nome.trim(),
        tipo: formFin.tipo,
        ativo: !!formFin.ativo,
        taxa_percentual: formFin.taxa_percentual === '' ? null : Number(formFin.taxa_percentual),
      };
      console.log('🟢 [STEP 4] Payload preparado:', payload);
      console.log('🟢 [STEP 5] Código empresa:', userProfile?.codigo_empresa);
      
      alert('🟢 STEP 3 - Chamando criarFinalizadora...');
      console.log('🟢 [STEP 6] Chamando criarFinalizadora...');
      const result = await criarFinalizadora(payload, userProfile?.codigo_empresa);
      alert('✅ SUCESSO - Finalizadora criada! Resultado: ' + JSON.stringify(result));
      console.log('🟢 [STEP 7] criarFinalizadora retornou:', result);
      
      console.log('🟢 [STEP 8] Limpando formulário');
      setFormFin({ nome: '', tipo: 'outros', ativo: true, taxa_percentual: '' });
      
      console.log('🟢 [STEP 9] Fechando modal');
      setIsCreateOpen(false);
      
      console.log('🟢 [STEP 10] Recarregando lista');
      await loadFinalizadoras();
      
      console.log('🟢 [STEP 11] Mostrando toast de sucesso');
      toast({ title: 'Finalizadora criada', variant: 'success' });
      
      console.log('✅ [SUCESSO] Processo completo');
    } catch (e) {
      alert('🔴 ERRO CAPTURADO!\n\nMensagem: ' + (e?.message || 'Erro desconhecido') + '\n\nStack: ' + (e?.stack || 'N/A'));
      console.error('🔴 [ERRO] Exceção capturada:', e);
      console.error('🔴 [ERRO] Stack:', e?.stack);
      console.error('🔴 [ERRO] Message:', e?.message);
      try { console.error(trace + ' error', e); } catch {}
      toast({ title: 'Falha ao criar finalizadora', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { 
      console.log('🟡 [FINALLY] Executando finally block');
      console.log('🟡 [FINALLY] Setando savingCreate = false');
      setSavingCreate(false);
      try { console.groupEnd(); } catch {} 
      console.log('🔵 [FIM] submitCreate finalizado');
    }
  };

  const toggleAtivo = async (fin) => {
    const trace = '[Finalizadoras:toggleAtivo]';
    try {
      try { console.group(trace); } catch {}
      try { console.log('args', { id: fin?.id, fromAtivo: fin?.ativo }); } catch {}
      setTogglingId(fin.id);
      await ativarDesativarFinalizadora(fin.id, !fin.ativo, userProfile?.codigo_empresa);
      try { console.log('success -> reload'); } catch {}
      await loadFinalizadoras();
      toast({ title: `${!fin.ativo ? 'Ativada' : 'Desativada'}`, description: fin.nome, variant: 'success' });
    } catch (e) {
      try { console.error(trace + ' error', e); } catch {}
      toast({ title: 'Falha ao alterar status', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { setTogglingId(null); try { console.groupEnd(); } catch {} }
  };

  const openEdit = (fin) => {
    setEditingFin(fin);
    setFormFin({
      nome: fin.nome || '',
      tipo: fin.tipo || 'outros',
      ativo: !!fin.ativo,
      taxa_percentual: typeof fin.taxa_percentual === 'number' ? String(fin.taxa_percentual) : '',
    });
    setIsEditOpen(true);
  };

  const submitEdit = async () => {
    const trace = '[Finalizadoras:edit]';
    try {
      try { console.group(trace); } catch {}
      if (!editingFin) { try { console.warn('no editingFin'); } catch {}; return; }
      if (!formFin.nome?.trim()) {
        toast({ title: 'Nome é obrigatório', variant: 'warning' });
        return;
      }
      const payload = {
        nome: formFin.nome.trim(),
        tipo: formFin.tipo,
        ativo: !!formFin.ativo,
        taxa_percentual: formFin.taxa_percentual === '' ? null : Number(formFin.taxa_percentual),
      };
      try { console.log('update:calling', { id: editingFin.id }); } catch {}
      await atualizarFinalizadora(editingFin.id, payload, userProfile?.codigo_empresa);
      setIsEditOpen(false);
      setEditingFin(null);
      try { console.log('update:success -> reload'); } catch {}
      await loadFinalizadoras();
      toast({ title: 'Finalizadora atualizada', variant: 'success' });
    } catch (e) {
      try { console.error(trace + ' error', e); } catch {}
      toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { try { console.groupEnd(); } catch {} }
  };

  return (
    <>
      <Helmet>
        <title>Finalizadoras - Fluxo7 Arena</title>
      </Helmet>

      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="flex-1 space-y-4 p-4 md:p-6">
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tighter">Gestão de Finalizadoras</h1>
            <p className="text-text-secondary">Controle completo sobre os métodos de pagamento do sistema.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowStats(!showStats)} title={showStats ? 'Ocultar estatísticas' : 'Mostrar estatísticas'}>
              {showStats ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button onClick={() => {
              alert('🟢 BOTÃO NOVA FINALIZADORA CLICADO!');
              setIsCreateOpen(true);
            }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Finalizadora
            </Button>
          </div>
        </motion.div>

        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <StatCard 
              icon={CreditCard} 
              title="Finalizadoras Ativas" 
              value={stats.ativas} 
              subtitle="Métodos de pagamento disponíveis" 
              color="text-brand" 
              onClick={() => handleStatCardClick('ativas')} 
              isActive={activeFilter === 'ativas'} 
            />
            <StatCard 
              icon={DollarSign} 
              title="Com Taxa" 
              value={stats.comTaxa} 
              subtitle="Finalizadoras com taxa configurada" 
              color="text-warning" 
              onClick={() => handleStatCardClick('com_taxa')} 
              isActive={activeFilter === 'com_taxa'} 
            />
            <StatCard 
              icon={TrendingUp} 
              title="Tipos Cadastrados" 
              value={stats.tiposUnicos} 
              subtitle="Variedade de métodos disponíveis" 
              color="text-success" 
            />
          </div>
        )}

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar finalizadora..."
                className="w-full bg-background pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                >
                  <option value="all">Todos os tipos</option>
                  {tiposDisponiveis.map(t => (
                    <option key={t} value={t}>
                      {t[0]?.toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Todos status</option>
                  <option value="active">Ativas</option>
                  <option value="inactive">Inativas</option>
                </select>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadFinalizadoras} 
                disabled={loadingFins}
                className="h-9 gap-1"
              >
                <RefreshCw className={`h-4 w-4 ${loadingFins ? 'animate-spin' : ''}`} />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Atualizar
                </span>
              </Button>
            </div>
          </div>

          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%] cursor-pointer hover:bg-accent/50" onClick={() => toggleSort('nome')}>
                    <div className="flex items-center gap-2">
                      Nome
                      {sort.by === 'nome' && (
                        <span className="text-muted-foreground">
                          {sort.dir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-[20%] cursor-pointer hover:bg-accent/50" onClick={() => toggleSort('tipo')}>
                    <div className="flex items-center gap-2">
                      Tipo
                      {sort.by === 'tipo' && (
                        <span className="text-muted-foreground">
                          {sort.dir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-[20%]">Taxa (%)</TableHead>
                  <TableHead className="w-[10%] text-center">Status</TableHead>
                  <TableHead className="w-[10%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingFins ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Carregando...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhuma finalizadora encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((fin) => (
                    <TableRow key={fin.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">{fin.nome}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-secondary text-secondary-foreground">
                          {fin.tipo || 'outros'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            className="h-8 w-24"
                            value={taxaDrafts[fin.id] ?? (fin.taxa_percentual ?? '')}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Permite apenas números, vírgula e ponto
                              if (value === '' || /^\d*[,.]?\d{0,2}$/.test(value)) {
                                setTaxaDrafts(prev => ({
                                  ...prev,
                                  [fin.id]: value
                                }));
                              }
                            }}
                            onBlur={() => saveTaxaInline(fin)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveTaxaInline(fin);
                              }
                            }}
                            disabled={savingTaxaId === fin.id}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                          {savingTaxaId === fin.id && (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <div className="flex items-center space-x-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${fin.ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-sm">{fin.ativo ? 'Ativo' : 'Inativo'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(fin)}
                            disabled={togglingId === fin.id}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {!loadingFins && totalItems > 0 && (
              <div className="flex items-center justify-between border-t px-6 py-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalItems)}-{Math.min(currentPage * pageSize, totalItems)} de {totalItems}
                </div>
                <div className="flex items-center space-x-2">
                  <select 
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {[10, 20, 50, 100].map(size => (
                      <option key={size} value={size}>
                        {size} por página
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-9 w-9 p-0"
                    >
                      <span className="sr-only">Página anterior</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center justify-center text-sm font-medium w-9">
                      {currentPage}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-9 w-9 p-0"
                    >
                      <span className="sr-only">Próxima página</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal de Criação */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        console.log('🟣 [DIALOG] onOpenChange chamado:', open);
        alert('🟣 DIALOG MUDOU!\n\nNovo estado: ' + (open ? 'ABERTO' : 'FECHADO'));
        setIsCreateOpen(open);
      }}>
        <DialogContent 
          className="sm:max-w-[500px]"
          onPointerDownOutside={(e) => {
            console.log('⚠️ [DIALOG] Click fora detectado');
            alert('⚠️ CLICK FORA DO MODAL DETECTADO!');
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Nova Finalizadora</DialogTitle>
            <DialogDescription>
              Adicione um novo método de pagamento ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formFin.nome}
                onChange={(e) => setFormFin({ ...formFin, nome: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                value={formFin.tipo}
                onChange={(e) => setFormFin({ ...formFin, tipo: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
                <option value="pix">PIX</option>
                <option value="voucher">Voucher</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa (%)</Label>
              <Input
                id="taxa"
                type="number"
                step="0.01"
                value={formFin.taxa_percentual}
                onChange={(e) => setFormFin({ ...formFin, taxa_percentual: e.target.value })}
                placeholder="0.00"
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="ativo"
                checked={formFin.ativo}
                onCheckedChange={(checked) => setFormFin({ ...formFin, ativo: checked })}
              />
              <Label htmlFor="ativo" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Ativo
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsCreateOpen(false)} 
              disabled={savingCreate}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                alert('🔴 BOTÃO CLICADO!\n\nEstado savingCreate: ' + savingCreate + '\nIniciando submitCreate...');
                console.log('🔴 [CLICK] Botão Salvar clicado!');
                console.log('🔴 [CLICK] savingCreate:', savingCreate);
                submitCreate();
              }} 
              disabled={savingCreate}
            >
              {savingCreate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Salvar Finalizadora
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) setEditingFin(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Editar Finalizadora</DialogTitle>
            <DialogDescription>
              Atualize as informações desta finalizadora
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={formFin.nome}
                onChange={(e) => setFormFin({ ...formFin, nome: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-tipo">Tipo</Label>
              <select
                id="edit-tipo"
                value={formFin.tipo}
                onChange={(e) => setFormFin({ ...formFin, tipo: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
                <option value="pix">PIX</option>
                <option value="voucher">Voucher</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-taxa">Taxa (%)</Label>
              <Input
                id="edit-taxa"
                type="number"
                step="0.01"
                value={formFin.taxa_percentual}
                onChange={(e) => setFormFin({ ...formFin, taxa_percentual: e.target.value })}
                placeholder="0.00"
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="edit-ativo"
                checked={formFin.ativo}
                onCheckedChange={(checked) => setFormFin({ ...formFin, ativo: checked })}
              />
              <Label htmlFor="edit-ativo" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Ativo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditOpen(false);
                setEditingFin(null);
              }}
              disabled={loadingFins}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button 
              onClick={submitEdit}
              disabled={loadingFins}
            >
              {loadingFins ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
