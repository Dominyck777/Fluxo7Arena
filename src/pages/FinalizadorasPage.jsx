import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { listarFinalizadoras, criarFinalizadora, atualizarFinalizadora, ativarDesativarFinalizadora } from '@/lib/store';

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
  const [finalizadoras, setFinalizadoras] = useState([]);
  const [loadingFins, setLoadingFins] = useState(false);
  // Modal: criar
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formFin, setFormFin] = useState({ nome: '', tipo: 'outros', ativo: true, taxa_percentual: '' });
  // Modal: editar
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFin, setEditingFin] = useState(null);

  const loadFinalizadoras = async () => {
    try {
      setLoadingFins(true);
      const data = await listarFinalizadoras({ somenteAtivas: false });
      setFinalizadoras(data || []);
    } catch (e) {
      toast({ title: 'Falha ao carregar finalizadoras', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoadingFins(false);
    }
  };

  useEffect(() => {
    loadFinalizadoras();
  }, []);

  const submitCreate = async () => {
    try {
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
      await criarFinalizadora(payload);
      setFormFin({ nome: '', tipo: 'outros', ativo: true, taxa_percentual: '' });
      setIsCreateOpen(false);
      await loadFinalizadoras();
      toast({ title: 'Finalizadora criada', variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao criar finalizadora', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const toggleAtivo = async (fin) => {
    try {
      await ativarDesativarFinalizadora(fin.id, !fin.ativo);
      await loadFinalizadoras();
      toast({ title: `${!fin.ativo ? 'Ativada' : 'Desativada'}`, description: fin.nome, variant: 'info' });
    } catch (e) {
      toast({ title: 'Falha ao alterar status', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
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
    try {
      if (!editingFin) return;
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
      await atualizarFinalizadora(editingFin.id, payload);
      setIsEditOpen(false);
      setEditingFin(null);
      await loadFinalizadoras();
      toast({ title: 'Finalizadora atualizada', variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
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
