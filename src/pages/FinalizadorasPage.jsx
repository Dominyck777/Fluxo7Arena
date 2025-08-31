import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const [formFin, setFormFin] = useState({ nome: '', tipo: 'outros', ativo: true, taxa_percentual: '' });

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

  const submitFin = async (e) => {
    e.preventDefault();
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

  const saveInline = async (fin, patch) => {
    try {
      const payload = { ...patch };
      if (payload.taxa_percentual === '') payload.taxa_percentual = null;
      // ordem removida do UI; mantemos atualização sem esse campo
      await atualizarFinalizadora(fin.id, payload);
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
          <h2 className="text-lg font-bold text-text-primary mb-4">Nova Finalizadora</h2>
          <form onSubmit={submitFin} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto" disabled={loadingFins}>Adicionar</Button>
            </div>
          </form>
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
                  <TableCell>
                    <input defaultValue={f.nome} onBlur={(e) => e.target.value !== f.nome && saveInline(f, { nome: e.target.value })} className="bg-surface-2 border border-border rounded-md px-2 py-1 w-full" />
                  </TableCell>
                  <TableCell>
                    <select defaultValue={f.tipo} onChange={(e) => saveInline(f, { tipo: e.target.value })} className="bg-surface-2 border border-border rounded-md px-2 py-1">
                      <option value="dinheiro">Dinheiro</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                      <option value="pix">PIX</option>
                      <option value="voucher">Voucher</option>
                      <option value="outros">Outros</option>
                    </select>
                  </TableCell>
                  <TableCell className="w-32">
                    <input type="number" step="0.01" defaultValue={f.taxa_percentual ?? ''} onBlur={(e) => saveInline(f, { taxa_percentual: e.target.value })} className="bg-surface-2 border border-border rounded-md px-2 py-1 w-full" />
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${f.ativo ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{f.ativo ? 'Ativa' : 'Inativa'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant={f.ativo ? 'destructive' : 'success'} size="sm" onClick={() => toggleAtivo(f)}>{f.ativo ? 'Desativar' : 'Ativar'}</Button>
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
      </motion.div>
    </>
  );
}
