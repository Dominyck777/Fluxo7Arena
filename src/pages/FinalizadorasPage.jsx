import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  const [finalizadoras, setFinalizadoras] = useState([]);
  const [loadingFins, setLoadingFins] = useState(false);
  // Debug helpers
  const lastLoadTsRef = useRef(0);
  const loadsCountRef = useRef(0);
  const lastDataSizeRef = useRef(0);
  const retryOnceRef = useRef(false);
  const mountedRef = useRef(true);
  // Modal: criar
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formFin, setFormFin] = useState({ nome: '', tipo: 'outros', ativo: true, taxa_percentual: '' });
  // Modal: editar
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFin, setEditingFin] = useState(null);

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
      }, 5000);
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

  useEffect(() => {
    mountedRef.current = true;
    try { console.log('[Finalizadoras] mount'); } catch {}
    if (authReady && userProfile?.codigo_empresa) {
      // Immediate cache hydration to avoid empty list perception
      try {
        const cacheKey = `finalizadoras:list:${userProfile.codigo_empresa}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          setFinalizadoras(cached);
          lastDataSizeRef.current = cached.length;
        }
      } catch {}
      loadFinalizadoras();
    }
    const onVis = () => {
      try { console.log('[Finalizadoras] visibilitychange', { visibility: document.visibilityState, lastLoadTs: lastLoadTsRef.current, lastDataSize: lastDataSizeRef.current }); } catch {}
    };
    const onFocus = () => { try { console.log('[Finalizadoras] window:focus'); } catch {}; };
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
      await ativarDesativarFinalizadora(fin.id, !fin.ativo, userProfile?.codigo_empresa);
      try { console.log('success -> reload'); } catch {}
      await loadFinalizadoras();
      toast({ title: `${!fin.ativo ? 'Ativada' : 'Desativada'}`, description: fin.nome, variant: 'info' });
    } catch (e) {
      try { console.error(trace + ' error', e); } catch {}
      toast({ title: 'Falha ao alterar status', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { try { console.groupEnd(); } catch {} }
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

      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        <SectionCard>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-text-primary">Finalizadoras</h1>
            <Button variant="outline" onClick={loadFinalizadoras} disabled={loadingFins}>Recarregar</Button>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Cadastro</h2>
            <Button onClick={() => setIsCreateOpen(true)}>Adicionar uma finalizadora</Button>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">Finalizadoras</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Taxa (%)</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalizadoras.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-semibold">{f.nome}</TableCell>
                  <TableCell className="capitalize">{f.tipo}</TableCell>
                  <TableCell className="w-32">{typeof f.taxa_percentual === 'number' ? f.taxa_percentual.toFixed(2) : '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${f.ativo ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{f.ativo ? 'Ativa' : 'Inativa'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => openEdit(f)}>Editar</Button>
                      <Button variant={f.ativo ? 'destructive' : 'success'} size="sm" onClick={() => toggleAtivo(f)}>{f.ativo ? 'Desativar' : 'Ativar'}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {finalizadoras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-text-muted">Nenhuma finalizadora cadastrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>
        {/* Modal: Criar Finalizadora */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Nova Finalizadora</DialogTitle>
              <DialogDescription>Preencha os campos para cadastrar um novo método de pagamento.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nome" value={formFin.nome} onChange={(e) => setFormFin({ ...formFin, nome: e.target.value })} placeholder="Ex.: PIX, Cartão Crédito" />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Tipo</span>
                <select value={formFin.tipo} onChange={(e) => setFormFin({ ...formFin, tipo: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="pix">PIX</option>
                  <option value="voucher">Voucher</option>
                  <option value="outros">Outros</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Taxa (%)</span>
                <input type="number" step="0.01" value={formFin.taxa_percentual} onChange={(e) => setFormFin({ ...formFin, taxa_percentual: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input type="checkbox" checked={formFin.ativo} onChange={(e) => setFormFin({ ...formFin, ativo: e.target.checked })} />
                <span>Ativo</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={loadingFins}>Cancelar</Button>
              <Button onClick={submitCreate} disabled={loadingFins}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Modal: Editar Finalizadora */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingFin(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Editar Finalizadora</DialogTitle>
              <DialogDescription>Atualize os dados da finalizadora selecionada.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nome" value={formFin.nome} onChange={(e) => setFormFin({ ...formFin, nome: e.target.value })} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Tipo</span>
                <select value={formFin.tipo} onChange={(e) => setFormFin({ ...formFin, tipo: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="pix">PIX</option>
                  <option value="voucher">Voucher</option>
                  <option value="outros">Outros</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Taxa (%)</span>
                <input type="number" step="0.01" value={formFin.taxa_percentual} onChange={(e) => setFormFin({ ...formFin, taxa_percentual: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input type="checkbox" checked={formFin.ativo} onChange={(e) => setFormFin({ ...formFin, ativo: e.target.checked })} />
                <span>Ativo</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingFin(null); }}>Cancelar</Button>
              <Button onClick={submitEdit}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  );
}
