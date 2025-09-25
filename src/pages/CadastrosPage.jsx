import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listarFinalizadoras, criarFinalizadora, atualizarFinalizadora, ativarDesativarFinalizadora } from '@/lib/store';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { when: 'beforeChildren', staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

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

export default function CadastrosPage() {
  const { toast } = useToast();
  const [finalizadoras, setFinalizadoras] = useState([]);
  const [loadingFins, setLoadingFins] = useState(false);
  const [formFin, setFormFin] = useState({ nome: '', tipo: 'outros', ativo: true, ordem: 0, taxa_percentual: '' });

  // Mock Quadras
  const [quadras, setQuadras] = useState([
    { id: 'Q-01', nome: 'Quadra Society 1', modalidade: 'Society', tipo: 'Descoberta', capacidade: 10, status: 'Ativa' },
    { id: 'Q-02', nome: 'Beach Tennis A', modalidade: 'Beach Tennis', tipo: 'Descoberta', capacidade: 4, status: 'Ativa' },
    { id: 'Q-03', nome: 'Futevôlei Norte', modalidade: 'Futevôlei', tipo: 'Coberta', capacidade: 6, status: 'Manutenção' },
  ]);

  const [formQuadra, setFormQuadra] = useState({ nome: '', modalidade: 'Society', tipo: 'Descoberta', capacidade: 10, status: 'Ativa' });

  const addQuadra = (e) => {
    e.preventDefault();
    if (!formQuadra.nome?.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe um nome para a quadra.' });
      return;
    }
    const newItem = { id: `Q-${String(quadras.length + 1).padStart(2, '0')}`, ...formQuadra };
    setQuadras([newItem, ...quadras]);
    setFormQuadra({ nome: '', modalidade: 'Society', tipo: 'Descoberta', capacidade: 10, status: 'Ativa' });
    toast({ title: 'Quadra adicionada', description: `${newItem.nome} foi cadastrada.` });
  };

  // Finalizadoras
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
        ordem: Number(formFin.ordem || 0),
        taxa_percentual: formFin.taxa_percentual === '' ? null : Number(formFin.taxa_percentual),
      };
      await criarFinalizadora(payload);
      setFormFin({ nome: '', tipo: 'outros', ativo: true, ordem: 0, taxa_percentual: '' });
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
      toast({ title: `${!fin.ativo ? 'Ativada' : 'Desativada'}`, description: fin.nome, variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao alterar status', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const saveInline = async (fin, patch) => {
    try {
      const payload = { ...patch };
      if (payload.taxa_percentual === '') payload.taxa_percentual = null;
      if (typeof payload.ordem !== 'undefined') payload.ordem = Number(payload.ordem || 0);
      await atualizarFinalizadora(fin.id, payload);
      await loadFinalizadoras();
      toast({ title: 'Finalizadora atualizada', variant: 'success' });
    } catch (e) {
      toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  // Empresa
  const [empresa, setEmpresa] = useState({
    razao: '', fantasia: '', cnpj: '', email: '', telefone: '', endereco: '', logoUrl: ''
  });

  const salvarEmpresa = (e) => {
    e.preventDefault();
    // Validações mínimas
    if (!empresa.fantasia?.trim()) {
      toast({ title: 'Nome Fantasia obrigatório', description: 'Informe o Nome Fantasia.' });
      return;
    }
    toast({ title: 'Dados salvos', description: 'Informações da empresa atualizadas (mock).'});
  };

  return (
    <>
      <Helmet>
        <title>Cadastros - Fluxo7 Arena</title>
      </Helmet>

      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        <SectionCard>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-text-primary">Cadastros</h1>
          </div>
        </SectionCard>

        <Tabs defaultValue="finalizadoras" className="w-full">
          <TabsList>
            <TabsTrigger value="finalizadoras">Finalizadoras</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="quadras">Quadras</TabsTrigger>
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
          </TabsList>

          {/* Clientes/Equipe/Produtos: placeholders com orientação */}
          <TabsContent value="clientes">
            <SectionCard>
              <p className="text-sm text-text-secondary">Use a aba Clientes existente para gestão. Em breve, integraremos aqui.</p>
            </SectionCard>
          </TabsContent>

          {/* Finalizadoras */}
          <TabsContent value="finalizadoras" className="space-y-6">
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
                  <span className="text-xs text-text-muted">Ordem</span>
                  <input type="number" value={formFin.ordem} onChange={(e) => setFormFin({ ...formFin, ordem: Number(e.target.value) })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm" />
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
                <Button variant="outline" onClick={loadFinalizadoras} disabled={loadingFins}>Recarregar</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ordem</TableHead>
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
                      <TableCell className="w-28">
                        <input type="number" defaultValue={f.ordem ?? 0} onBlur={(e) => Number(e.target.value) !== (f.ordem ?? 0) && saveInline(f, { ordem: Number(e.target.value) })} className="bg-surface-2 border border-border rounded-md px-2 py-1 w-full" />
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
                      <TableCell colSpan={6} className="text-center text-text-muted">Nenhuma finalizadora cadastrada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="equipe">
            <SectionCard>
              <p className="text-sm text-text-secondary">Use a aba Equipe existente para gestão. Em breve, integraremos aqui.</p>
            </SectionCard>
          </TabsContent>

          <TabsContent value="produtos">
            <SectionCard>
              <p className="text-sm text-text-secondary">Use a aba Produtos existente para gestão. Em breve, integraremos aqui.</p>
            </SectionCard>
          </TabsContent>

          {/* Quadras */}
          <TabsContent value="quadras" className="space-y-6">
            <SectionCard>
              <h2 className="text-lg font-bold text-text-primary mb-4">Nova Quadra</h2>
              <form onSubmit={addQuadra} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label="Nome" value={formQuadra.nome} onChange={(e) => setFormQuadra({ ...formQuadra, nome: e.target.value })} placeholder="Ex.: Quadra Society 2" />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Modalidade</span>
                  <select value={formQuadra.modalidade} onChange={(e) => setFormQuadra({ ...formQuadra, modalidade: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                    <option>Society</option>
                    <option>Beach Tennis</option>
                    <option>Futevôlei</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Tipo</span>
                  <select value={formQuadra.tipo} onChange={(e) => setFormQuadra({ ...formQuadra, tipo: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                    <option>Descoberta</option>
                    <option>Coberta</option>
                  </select>
                </label>
                <Input label="Capacidade (jogadores)" type="number" min={1} value={formQuadra.capacidade} onChange={(e) => setFormQuadra({ ...formQuadra, capacidade: Number(e.target.value) })} />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Status</span>
                  <select value={formQuadra.status} onChange={(e) => setFormQuadra({ ...formQuadra, status: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                    <option>Ativa</option>
                    <option>Inativa</option>
                    <option>Manutenção</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <Button type="submit" className="w-full md:w-auto">Adicionar</Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary">Quadras</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quadras.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{q.id}</TableCell>
                      <TableCell>{q.nome}</TableCell>
                      <TableCell>{q.modalidade}</TableCell>
                      <TableCell>{q.tipo}</TableCell>
                      <TableCell className="tabular-nums">{q.capacidade}</TableCell>
                      <TableCell>{q.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          {/* Empresa */}
          <TabsContent value="empresa" className="space-y-6">
            <SectionCard>
              <h2 className="text-lg font-bold text-text-primary mb-4">Dados da Empresa</h2>
              <form onSubmit={salvarEmpresa} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label="Razão Social" value={empresa.razao} onChange={(e) => setEmpresa({ ...empresa, razao: e.target.value })} placeholder="Ex.: Fluxo7 Arena LTDA" />
                <Input label="Nome Fantasia" value={empresa.fantasia} onChange={(e) => setEmpresa({ ...empresa, fantasia: e.target.value })} placeholder="Ex.: Fluxo7 Arena" />
                <Input label="CNPJ" value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                <Input label="Email" type="email" value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} placeholder="contato@empresa.com" />
                <Input label="Telefone" value={empresa.telefone} onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                <Input label="Endereço" value={empresa.endereco} onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })} placeholder="Rua Exemplo, 123 - Bairro, Cidade/UF" />
                <Input label="Logo URL" value={empresa.logoUrl} onChange={(e) => setEmpresa({ ...empresa, logoUrl: e.target.value })} placeholder="https://..." />
                <div className="flex items-end">
                  <Button type="submit" className="w-full md:w-auto">Salvar</Button>
                </div>
              </form>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
}
