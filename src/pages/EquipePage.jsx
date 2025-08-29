
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Users, ShieldCheck, UserCheck, MoreHorizontal, Edit, KeyRound, Activity, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// UI usa 'status' para badge. No banco usaremos 'ativo' boolean.
const initialTeam = [];

// Cargos agora são livre digitação
const permissionsList = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'vendas', label: 'Vendas (PDV)' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'equipe', label: 'Equipe' },
];

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const StatCard = ({ icon, title, value, color }) => {
    const Icon = icon;
    return (
        <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}/20`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-text-secondary text-sm font-medium">{title}</p>
                <p className="text-2xl font-bold text-text-primary">{value}</p>
            </div>
        </motion.div>
    );
};

function MemberDetailsModal({ open, onOpenChange, member, onEdit }) {
  if (!member) return null;

  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-semibold text-text-primary text-right">{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Funcionário</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-6">
            <div>
                <h2 className="text-xl font-bold">{member.name}</h2>
                <p className="text-brand font-semibold">{member.role}</p>
            </div>

            <div>
                <h4 className="font-semibold text-text-primary mb-2 flex items-center gap-2"><KeyRound className="w-5 h-5 text-text-secondary"/> Permissões de Acesso</h4>
                <div className="bg-surface-2 p-4 rounded-lg grid grid-cols-2 gap-x-4 gap-y-2">
                  {permissionsList.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{p.label}</span>
                      <span className={cn("font-semibold", member.permissions[p.id] ? "text-success" : "text-danger")}>
                        {member.permissions[p.id] ? (member.permissions[p.id] === 'edit' ? 'Edição' : 'Visualização') : 'Sem Acesso'}
                      </span>
                    </div>
                  ))}
                  {member.permissions.admin && <div className="col-span-2 text-center font-bold text-success p-2 bg-success/10 rounded-md mt-2">Acesso total de Administrador</div>}
                </div>
            </div>
             <div>
                <h4 className="font-semibold text-text-primary mb-2 flex items-center gap-2"><Activity className="w-5 h-5 text-text-secondary"/> Log de Atividades Recentes</h4>
                <div className="bg-surface-2 p-4 rounded-lg text-center">
                    <p className="text-sm text-text-muted py-8">O histórico de atividades do funcionário aparecerá aqui.</p>
                </div>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Fechar</Button></DialogClose>
          <Button onClick={() => onEdit(member)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberFormModal({ open, onOpenChange, member, onSave, loading }) {
  const { toast } = useToast();

  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState(member?.role || '');

  // Sync form fields when editing an existing member or when modal opens
  useEffect(() => {
    if (open) {
      setName(member?.name || '');
      setRole(member?.role || '');
    }
  }, [member, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    await onSave({ name: name.trim(), role: role.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{member ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          <DialogDescription>Informe apenas nome e cargo. O cargo é livre (texto).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-2">
          <div className="bg-surface-2 border border-border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="pl-9" placeholder="Ex.: Maria Silva" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Cargo</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} className="pl-9" placeholder="Ex.: Gerente, Caixa, ..." />
                </div>
              </div>
            </div>
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit} disabled={!!loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EquipePage() {
    const { company, authReady, userProfile } = useAuth();
    const { toast } = useToast();
    const [team, setTeam] = useState(initialTeam);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const retryRef = useRef(false);

    const loadTeam = async () => {
      try {
        const hasCache = team && team.length > 0;
        if (!company?.codigo_empresa && !company?.id) return;
        // Rely on RLS; no explicit company filter needed
        let query = supabase
          .from('colaboradores')
          .select('*')
          .order('nome', { ascending: true });
        const { data, error } = await query;
        if (error) {
          if (!retryRef.current) {
            retryRef.current = true;
            setTimeout(loadTeam, 800);
            return;
          }
          throw error;
        }
        const rows = data || [];
        let mapped = rows.map(r => ({
          id: r.id,
          name: r.nome || '',
          role: r.cargo || 'user',
          status: r.ativo === false ? 'inactive' : 'active',
          online: false,
          permissions: {},
        }));
        // Garantir que o colaborador logado apareça na lista, mesmo que não venha do banco
        // Comparar apenas por codigo_empresa (novo identificador)
        const sameCompany = (
          userProfile?.codigo_empresa && company?.codigo_empresa && userProfile.codigo_empresa === company.codigo_empresa
        );
        if (userProfile?.id && sameCompany) {
          const exists = mapped.some(m => m.id === userProfile.id);
          if (!exists) {
            mapped = [
              {
                id: userProfile.id,
                name: userProfile.nome || 'Você',
                role: userProfile.cargo || 'user',
                status: 'active',
                online: false,
                permissions: {},
              },
              ...mapped,
            ];
          }
        }
        setTeam(mapped);
        try { localStorage.setItem('team:list', JSON.stringify(mapped)); } catch {}
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Falha ao carregar equipe:', e);
        if (!team?.length) {
          // fallback cache
          try {
            const raw = localStorage.getItem('team:list');
            if (raw) setTeam(JSON.parse(raw));
          } catch {}
        }
      } finally {
        retryRef.current = false;
      }
    };

    useEffect(() => {
      if (authReady && (company?.codigo_empresa || company?.id)) loadTeam();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, company?.codigo_empresa, company?.id]);

    // Recarregar quando a aba voltar a ficar visível ou quando a janela ganhar foco
    useEffect(() => {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && authReady && (company?.codigo_empresa || company?.id)) {
          loadTeam();
        }
      };
      const handleFocus = () => {
        if (authReady && (company?.codigo_empresa || company?.id)) {
          loadTeam();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleFocus);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
      };
    }, [authReady, company?.codigo_empresa, company?.id]);

    const stats = useMemo(() => ({
        total: team.filter(m => m.status === 'active').length,
        online: team.filter(m => m.online && m.status === 'active').length,
        admins: team.filter(m => m.permissions?.admin && m.status === 'active').length,
    }), [team]);

    const filteredTeam = useMemo(() => {
        return team.filter(member =>
            member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.role.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [team, searchTerm]);

    const handleViewDetails = (member) => {
        setSelectedMember(member);
        setIsDetailsOpen(true);
    };

    const handleAddNew = () => {
        setEditingMember(null);
        setIsFormOpen(true);
    };

    const handleEdit = (member) => {
        setIsDetailsOpen(false);
        setEditingMember(member);
        setIsFormOpen(true);
    }
    
    const handleEditFromMenu = (member) => {
        setEditingMember(member);
        setIsFormOpen(true);
    }

    const handleSave = async ({ name, role }) => {
        try {
            setSaving(true);
            if (!company?.codigo_empresa && !company?.id) {
              throw new Error('Empresa não encontrada para o usuário atual.');
            }
            // Garantir que temos um codigo_empresa válido
            let codigoEmpresa = company?.codigo_empresa || null;
            if (!codigoEmpresa && company?.id) {
              const { data: empById } = await supabase
                .from('empresas')
                .select('codigo_empresa')
                .eq('id', company.id)
                .single();
              codigoEmpresa = empById?.codigo_empresa || null;
            }
            if (!codigoEmpresa) {
              throw new Error('Empresa sem código. Defina o código da empresa antes de adicionar colaboradores.');
            }
            if (!editingMember) {
              // Criar colaborador apenas com nome/cargo; ID será gerado pelo banco se houver default
              const { error: insertErr } = await supabase
                  .from('colaboradores')
                  .insert({
                      // Enviar somente o codigo_empresa. O banco deve preencher empresa_id automaticamente.
                      codigo_empresa: codigoEmpresa,
                      nome: name,
                      cargo: role,
                      ativo: true,
                  });
              if (insertErr) throw insertErr;
              toast({ title: 'Funcionário criado com sucesso', description: name, variant: 'success' });
            } else {
              // Editar colaborador existente
              const { error: updErr } = await supabase
                .from('colaboradores')
                .update({ nome: name, cargo: role })
                .eq('id', editingMember.id);
              if (updErr) throw updErr;
              toast({ title: 'Funcionário atualizado', description: editingMember.name, variant: 'default' });
            }

            await loadTeam();
            setIsFormOpen(false);
            setEditingMember(null);
        } catch (e) {
            toast({ title: 'Erro ao salvar funcionário', description: e.message || String(e), variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (member) => {
      try {
        if (!(company?.id || company?.codigo_empresa)) return;
        // Não permitir desativar se for o primeiro da lista ou se houver apenas um ativo
        const firstMemberId = team[0]?.id;
        if (member.id === firstMemberId) {
          toast({ title: 'Ação não permitida', description: 'Não é possível desativar o primeiro funcionário.', variant: 'destructive' });
          return;
        }
        // Não permitir desativar a si mesmo
        if (userProfile?.id && member.id === userProfile.id) {
          toast({ title: 'Ação não permitida', description: 'Você não pode desativar o seu próprio usuário.', variant: 'destructive' });
          return;
        }
        if (team.filter(m => m.status === 'active').length <= 1) {
          toast({ title: 'Ação não permitida', description: 'Deve haver pelo menos um funcionário ativo.', variant: 'destructive' });
          return;
        }
        const { error } = await supabase
          .from('colaboradores')
          .update({ ativo: false })
          .eq('id', member.id);
        if (error) throw error;
        toast({ title: 'Funcionário desativado', description: member.name });
        await loadTeam();
      } catch (e) {
        toast({ title: 'Erro ao desativar', description: e.message || String(e), variant: 'destructive' });
      }
    };

    return (
        <>
            <Helmet>
                <title>Equipe - Fluxo7 Arena</title>
                <meta name="description" content="Gerencie sua equipe, permissões e atividades." />
            </Helmet>
            <div className="h-full flex flex-col">
                <motion.div variants={pageVariants} initial="hidden" animate="visible">
                    <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-black text-text-primary tracking-tighter">Gestão de Equipe</h1>
                            <p className="text-text-secondary">Controle de funcionários, permissões e logs.</p>
                        </div>
                        <Button
                          onClick={handleAddNew}
                          disabled={!authReady || !company?.codigo_empresa}
                          title={!authReady ? 'Aguardando autenticação...' : (!company?.codigo_empresa ? 'Empresa sem código. Defina o código da empresa antes.' : '')}
                        >
                          <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
                        </Button>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <StatCard icon={Users} title="Funcionários Ativos" value={stats.total} color="text-brand" />
                        <StatCard icon={UserCheck} title="Online Agora" value={stats.online} color="text-success" />
                        <StatCard icon={ShieldCheck} title="Administradores" value={stats.admins} color="text-info" />
                    </div>

                    <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: 0.2}}>
                        <div className="bg-surface rounded-lg border border-border">
                            <div className="p-4 border-b border-border">
                               <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                                    <Input 
                                      placeholder="Buscar por nome ou cargo..." 
                                      className="pl-9" 
                                      value={searchTerm}
                                      onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Funcionário</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTeam.length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-text-muted">
                                          Nenhum funcionário cadastrado.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    {filteredTeam.map((member, idx) => (
                                        <TableRow key={member.id} className="cursor-pointer" onClick={() => handleViewDetails(member)}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    <span>{member.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{member.role}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-1 text-xs font-semibold rounded-full",
                                                    member.status === 'active' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                                                )}>
                                                    {member.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleViewDetails(member); }}>Ver Detalhes</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleEditFromMenu(member); }}>Editar</DropdownMenuItem>
                                                        <DropdownMenuItem
                                                          className="text-danger"
                                                          disabled={idx === 0 || team.filter(m => m.status === 'active').length <= 1 || (userProfile?.id && member.id === userProfile.id)}
                                                          onClick={(e) => { e.stopPropagation(); handleDeactivate(member); }}
                                                        >
                                                          Desativar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            <MemberFormModal 
              open={isFormOpen} 
              onOpenChange={setIsFormOpen}
              member={editingMember}
              onSave={handleSave}
              loading={saving}
            />
            <MemberDetailsModal
              open={isDetailsOpen}
              onOpenChange={setIsDetailsOpen}
              member={selectedMember}
              onEdit={handleEdit}
            />
        </>
    );
}
