
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-full">
        <DialogHeader>
          <DialogTitle>Detalhes do Funcionário</DialogTitle>
        </DialogHeader>
        <div className="p-4 sm:p-6 space-y-4">
            <div className="text-center">
                <h2 className="text-xl font-bold">{member.name}</h2>
                <p className="text-brand font-semibold">{member.role}</p>
            </div>

            <div className="bg-surface-2 p-8 rounded-lg text-center border border-border">
                <p className="text-lg font-semibold text-text-secondary">🚧 Em desenvolvimento</p>
                <p className="text-sm text-text-muted mt-2">Detalhes completos do funcionário estarão disponíveis em breve.</p>
            </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <DialogClose asChild><Button type="button" variant="secondary" className="w-full sm:w-auto">Fechar</Button></DialogClose>
          <Button onClick={() => onEdit(member)} className="w-full sm:w-auto"><Edit className="mr-2 h-4 w-4" /> Editar</Button>
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
      <DialogContent className="sm:max-w-[700px] w-full">
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
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="w-full sm:w-auto">Cancelar</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit} disabled={!!loading} className="w-full sm:w-auto">{loading ? 'Salvando...' : 'Salvar'}</Button>
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
    const mountedRef = useRef(true);
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

    const loadTeam = async () => {
      try {
        const codigoEmpresa = company?.codigo_empresa || null;
        if (!codigoEmpresa && !company?.id) return;
        const cacheKey = codigoEmpresa ? `team:list:${codigoEmpresa}` : 'team:list';
        // slow fallback: reidratar cache após 5s
        const slowFallback = setTimeout(() => {
          if (!mountedRef.current) return;
          try {
            const raw = localStorage.getItem(cacheKey);
            const cached = raw ? JSON.parse(raw) : [];
            if (Array.isArray(cached) && cached.length > 0) {
              console.warn('[Equipe] slow fallback: using cached snapshot');
              setTeam(cached);
            }
          } catch {}
        }, 5000);

        // Query com escopo explícito por empresa
        let query = supabase
          .from('colaboradores')
          .select('*')
          .order('nome', { ascending: true });
        if (codigoEmpresa) {
          query = query.eq('codigo_empresa', codigoEmpresa);
        }
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
        if (!mountedRef.current) return;
        setTeam(mapped);
        try { localStorage.setItem(cacheKey, JSON.stringify(mapped)); } catch {}
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Falha ao carregar equipe:', e);
        const codigoEmpresa = company?.codigo_empresa || null;
        const cacheKey = codigoEmpresa ? `team:list:${codigoEmpresa}` : 'team:list';
        // fallback cache
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw && mountedRef.current) setTeam(JSON.parse(raw));
        } catch {}
      } finally {
        retryRef.current = false;
        // limpar qualquer timeout pendente deste ciclo
        // Nota: em erros, slowFallback pode já ter rodado; não é crítico se não limparmos aqui.
      }
    };

    useEffect(() => {
      const codigoEmpresa = company?.codigo_empresa || null;
      if (!authReady || !codigoEmpresa) return;
      // hydrate cache first para evitar UI vazia
      try {
        const raw = localStorage.getItem(`team:list:${codigoEmpresa}`);
        const cached = raw ? JSON.parse(raw) : [];
        if (Array.isArray(cached) && cached.length > 0) setTeam(cached);
      } catch {}
      loadTeam();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, company?.codigo_empresa]);

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
        total: team.length,
        active: team.filter(m => m.status === 'active').length,
        inactive: team.filter(m => m.status === 'inactive').length,
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
            <div className="h-full flex flex-col">
                <motion.div variants={pageVariants} initial="hidden" animate="visible">
                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tighter">Gestão de Equipe</h1>
                            <p className="text-sm sm:text-base text-text-secondary">Controle de funcionários, permissões e logs.</p>
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
                        <StatCard icon={Users} title="Total" value={stats.total} color="text-brand" />
                        <StatCard icon={UserCheck} title="Ativos" value={stats.active} color="text-success" />
                        <StatCard icon={ShieldCheck} title="Desativados" value={stats.inactive} color="text-danger" />
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
                            {/* Layout Mobile - Cards */}
                            <div className="md:hidden p-4 space-y-3">
                              {filteredTeam.length === 0 ? (
                                <div className="text-center py-10 text-text-muted">
                                  Nenhum funcionário cadastrado.
                                </div>
                              ) : (
                                filteredTeam.map((member, idx) => (
                                  <div key={member.id} className="rounded-lg border border-border bg-surface p-4 space-y-3" onClick={() => handleViewDetails(member)}>
                                    {/* Header: Nome + Status */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-base text-text-primary truncate">{member.name}</h3>
                                        <p className="text-sm text-text-muted mt-0.5">{member.role}</p>
                                      </div>
                                      <span className={cn(
                                        "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0",
                                        member.status === 'active' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                                      )}>
                                        {member.status === 'active' ? 'Ativo' : 'Inativo'}
                                      </span>
                                    </div>

                                    {/* Botões de Ação */}
                                    <div className="flex gap-2 pt-2">
                                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(member); }} className="flex-1">
                                        Ver Detalhes
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEditFromMenu(member); }}>
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                                            <MoreHorizontal className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            className="text-danger"
                                            disabled={idx === 0 || team.filter(m => m.status === 'active').length <= 1 || (userProfile?.id && member.id === userProfile.id)}
                                            onClick={(e) => { e.stopPropagation(); handleDeactivate(member); }}
                                          >
                                            Desativar
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Layout Desktop - Tabela */}
                            <div className="hidden md:block">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>Funcionário</TableHead>
                                          <TableHead>Cargo</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead className="w-[80px] text-center">Ações</TableHead>
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
                                              <TableCell className="text-center">
                                                  <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                          <Button variant="ghost" className="h-8 w-8 p-0 mx-auto" onClick={(e) => e.stopPropagation()}>
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
