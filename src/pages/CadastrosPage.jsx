import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

        <Tabs defaultValue="quadras" className="w-full">
          <TabsList>
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
