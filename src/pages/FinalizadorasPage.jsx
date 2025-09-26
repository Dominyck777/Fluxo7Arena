import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit, Filter, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listarFinalizadoras, criarFinalizadora, atualizarFinalizadora, ativarDesativarFinalizadora } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { when: 'beforeChildren', staggerChildren: 0.06, delayChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function SectionCard({ children, className = '' }) {
  return (
    <motion.div variants={itemVariants} className={`fx-card ${className}`}>
      {children}
    </motion.div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-text-muted">{label}</span>
      <input {...props} className={`bg-surface-2 border border-border rounded-md px-3 py-2 text-sm ${props.className || ''}`} />
    </label>
  );
}

export default function FinalizadorasPage() {
  const { toast } = useToast();
  const { userProfile, authReady } = useAuth();
  
  // Estados principais
  const [finalizadoras, setFinalizadoras] = useState([]);
  const [loadingFins, setLoadingFins] = useState(false);
  
  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort] = useState({ by: 'nome', dir: 'asc' });
  
  // Estados de paginação
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados para modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFin, setEditingFin] = useState(null);
  
  // Estado do formulário
  const [formFin, setFormFin] = useState({
    nome: '',
    tipo: 'outros',
    taxa_percentual: '',
    ativo: true
  });
  
  // Estados para edição inline
  const [taxaDrafts, setTaxaDrafts] = useState({});
  const [savingTaxaId, setSavingTaxaId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  
  // Refs para controle
  const mountedRef = useRef(true);
  const lastLoadTsRef = useRef(0);
  const loadsCountRef = useRef(0);
  const lastDataSizeRef = useRef(0);
  const retryOnceRef = useRef(false);
  const secondRetryRef = useRef(false);

  const loadFinalizadoras = async () => {
    const trace = `[Finalizadoras:load ${++loadsCountRef.current}]`;
    const t0 = Date.now();
    lastLoadTsRef.current = t0;
    try {
      try { console.group(trace); } catch {}
      try { console.log('start', { t0, loadingFinsBefore: loadingFins }); } catch {}
      if (!mountedRef.current) { try { console.warn(trace + ' skip: unmounted'); } catch {}; return; }
      setLoadingFins(true);
      const codigoEmpresa = userProfile?.codigo_empresa || null;
      // Slow-load fallback: if after 5s we still have 0 items, try to hydrate from cache
      const slowFallback = setTimeout(() => {
        if (!mountedRef.current) return;
        if (lastDataSizeRef.current === 0 && codigoEmpresa) {
          try {
            const cacheKey = `finalizadoras:list:${codigoEmpresa}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            if (Array.isArray(cached) && cached.length > 0) {
              console.warn('[Finalizadoras] slow fallback: using cached snapshot');
              setFinalizadoras(cached);
              lastDataSizeRef.current = cached.length;
            }
          } catch {}
        }
      }, 2000);
      const data = await listarFinalizadoras({ somenteAtivas: false, codigoEmpresa });
      if (!mountedRef.current) { try { console.warn(trace + ' skip apply: unmounted after fetch'); } catch {}; return; }
      const size = Array.isArray(data) ? data.length : (data ? 1 : 0);
      try { console.log('loaded', { size, sample: Array.isArray(data) ? data.slice(0, 3) : data }); } catch {}
      setFinalizadoras((prev) => {
        const next = Array.isArray(data) ? data : [];
        lastDataSizeRef.current = next.length;
        try { console.log('applyState', { prevSize: prev.length, nextSize: next.length, empty: next.length === 0 }); } catch {}
        // Persist fresh list to cache for resilience
        try {
          const cacheKey = `finalizadoras:list:${codigoEmpresa}`;
          localStorage.setItem(cacheKey, JSON.stringify(next));
        } catch {}
        return next;
      });
      // Retry once if empty due to late auth hydration
      if ((size === 0) && !retryOnceRef.current && authReady && codigoEmpresa) {
        retryOnceRef.current = true;
        setTimeout(() => { try { console.log('[Finalizadoras] retry after empty'); } catch {}; loadFinalizadoras(); }, 500);
      }
      // Optional: second retry if still empty after first retry
      if ((size === 0) && retryOnceRef.current && !secondRetryRef.current && authReady && codigoEmpresa) {
        secondRetryRef.current = true;
        setTimeout(() => { try { console.log('[Finalizadoras] second retry after empty'); } catch {}; loadFinalizadoras(); }, 1500);
      }
    } catch (e) {
      try { console.error(trace + ' error', e); } catch {}
      toast({ title: 'Falha ao carregar finalizadoras', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      try { clearTimeout(slowFallback); } catch {}
      if (mountedRef.current) setLoadingFins(false);
      try { console.log('finish', { dtMs: Date.now() - t0, loadingFinsAfter: loadingFins }); } catch {}
      try { console.groupEnd(); } catch {}
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

  const filteredSorted = useMemo(() => {
    let rows = Array.isArray(finalizadoras) ? [...finalizadoras] : [];
    const s = (searchTerm || '').trim().toLowerCase();
    if (s) rows = rows.filter(r => (r?.nome || '').toLowerCase().includes(s));
    if (filterTipo !== 'all') rows = rows.filter(r => (r?.tipo || 'outros') === filterTipo);
    if (filterStatus !== 'all') rows = rows.filter(r => (filterStatus === 'active') ? !!r?.ativo : !r?.ativo);
    rows.sort((a,b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      const av = (sort.by === 'tipo' ? (a?.tipo || '') : (a?.nome || '')).toLowerCase();
      const bv = (sort.by === 'tipo' ? (b?.tipo || '') : (b?.nome || '')).toLowerCase();
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });
    return rows;
  }, [finalizadoras, searchTerm, filterTipo, filterStatus, sort]);

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
    try {
      try { console.group(trace); } catch {}
      try { console.log('payloadDraft', { ...formFin }); } catch {}
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
      try { console.log('create:calling'); } catch {}
      await criarFinalizadora(payload, userProfile?.codigo_empresa);
      setFormFin({ nome: '', tipo: 'outros', ativo: true, taxa_percentual: '' });
      setIsCreateOpen(false);
      try { console.log('create:success -> reload'); } catch {}
      await loadFinalizadoras();
      toast({ title: 'Finalizadora criada', variant: 'success' });
    } catch (e) {
      try { console.error(trace + ' error', e); } catch {}
      toast({ title: 'Falha ao criar finalizadora', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { try { console.groupEnd(); } catch {} }
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

      <div className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Finalizadoras</h2>
            <p className="text-muted-foreground">Gerencie os métodos de pagamento do sistema</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Finalizadora
          </Button>
        </div>

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
      </div>

      {/* Modal de Criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Nova Finalizadora</DialogTitle>
            <DialogDescription>
              Adicione um novo método de pagamento ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4">
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
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateOpen(false)} 
              disabled={loadingFins}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button 
              onClick={submitCreate} 
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
