import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Users, UserX, UserCheck, Gift, FileText, Edit, Trash2, MoreHorizontal, DollarSign, History, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ClientFormModal from '@/components/clients/ClientFormModal';


// Dados carregados de Supabase (public.clientes)

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const StatCard = ({ icon, title, value, color, onClick, isActive }) => {
    const Icon = icon;
    return (
        <motion.div 
            variants={itemVariants} 
            className={cn(
                "bg-surface rounded-lg border p-4 flex items-center gap-4 cursor-pointer transition-all duration-200",
                isActive ? "border-brand ring-2 ring-brand/50" : "border-border hover:border-brand/50",
            )}
            onClick={onClick}
        >
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

function ClientDetailsModal({ open, onOpenChange, client, onEdit }) {
  const { toast } = useToast();
  if (!client) return null;

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! 🚧",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! 🚀",
    });
  };

  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-semibold text-text-primary text-right">{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Cliente</DialogTitle>
        </DialogHeader>
        <div className="flex-1 p-6 overflow-y-auto space-y-8">
            <div className="overflow-hidden">
              <h2 className="text-xl font-bold truncate">{client.nome}</h2>
              <span className="text-sm text-text-secondary truncate">{client.email || '—'}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h4 className="font-semibold text-text-primary mb-2">Informações Cadastrais</h4>
                     <div className="bg-surface-2 p-4 rounded-lg space-y-1">
                        <DetailRow label="Código" value={client.codigo} />
                        <DetailRow label="CPF/CNPJ" value={client.cpf || '—'} />
                        <DetailRow label="Telefone" value={client.telefone || '—'} />
                        <DetailRow label="Aniversário" value={client.aniversario ? new Date(client.aniversario).toLocaleDateString('pt-BR') : '—'} />
                    </div>
                </div>
                
                <div>
                    <div className="flex items-center gap-2 text-text-primary mb-2">
                        <DollarSign className="w-5 h-5 text-text-secondary"/>
                        <h4 className="font-semibold">Financeiro</h4>
                    </div>
                    <div className="bg-surface-2 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-text-secondary">Saldo Atual</span>
                            <span className={cn(
                                "text-xl font-black tracking-tighter",
                                Number(client.saldo || 0) >= 0 ? "text-success" : "text-danger"
                            )}>
                              R$ {Number(client.saldo || 0).toFixed(2)}
                            </span>
                        </div>
                         <div className="flex gap-2 mt-4">
                            <Button size="sm" className="flex-1" onClick={handleNotImplemented}>Ajustar Saldo</Button>
                            <Button size="sm" variant="outline" className="flex-1" onClick={handleNotImplemented}><FileText className="mr-2 h-4 w-4"/>Exportar p/ NF</Button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                 <div className="flex items-center gap-2 text-text-primary">
                    <History className="w-5 h-5 text-text-secondary"/>
                    <h4 className="font-semibold">Histórico Recente</h4>
                </div>
                <div className="bg-surface-2 p-4 rounded-lg text-center">
                  <p className="text-sm text-text-muted py-8">Histórico de consumo e reservas em breve.</p>
                </div>
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Fechar</Button>
          </DialogClose>
          <Button onClick={() => onEdit(client)}>
            <Edit className="mr-2 h-4 w-4" /> Editar Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ClientesPage() {
    const { toast } = useToast();
    const { userProfile, authReady } = useAuth();
    const [clients, setClients] = useState(() => {
      try {
        const cachedProfile = localStorage.getItem('auth:userProfile');
        const codigo = cachedProfile ? (JSON.parse(cachedProfile)?.codigo_empresa || null) : null;
        const key = codigo ? `clientes:list:${codigo}` : 'clientes:list';
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(cached) ? cached : [];
      } catch {
        return [];
      }
    });
    const [loading, setLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [editingClient, setEditingClient] = useState(null);
    const [filters, setFilters] = useState({ searchTerm: '', status: 'all', cardFilter: null });
    // Retry control para contornar atrasos de token/RLS no Vercel
    const clientsRetryRef = useRef(false);
    const lastLoadTsRef = useRef(0);
    const lastSizeRef = useRef(0);

    const loadClients = async () => {
      try {
        // Loading forte só quando não há cache
        const hasCache = clients && clients.length > 0;
        if (!hasCache) setLoading(true);
        if (!userProfile?.codigo_empresa) return; // aguarda empresa
        const cacheKey = `clientes:list:${userProfile.codigo_empresa}`;
        let query = supabase
          .from('clientes')
          .select('*')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .order('nome', { ascending: true });

        if (filters.searchTerm.trim() !== '') {
          const s = filters.searchTerm.trim();
          const isNumeric = /^\d+$/.test(s);
          if (isNumeric) {
            // inclui busca por codigo exato quando termo é numérico
            query = query.or(`codigo.eq.${s},nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`);
          } else {
            query = query.or(`nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`);
          }
        }
        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        const slowFallback = setTimeout(() => {
          try {
            if (!hasCache) {
              const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
              if (Array.isArray(cached) && cached.length > 0) {
                console.warn('[Clientes] slow fallback: using cached snapshot');
                setClients(cached);
                lastSizeRef.current = cached.length;
              }
            }
          } catch {}
        }, 2000);

        const { data, error } = await query;
        if (error) {
          // Primeiro erro: não derruba lista atual; tenta 1x novamente
          if (!clientsRetryRef.current) {
            clientsRetryRef.current = true;
            setTimeout(loadClients, 900);
            return;
          }
          throw error;
        }
        const rows = data || [];
        // Resposta vazia pode acontecer por atraso de token/RLS em produção.
        // Se houver cache local, não sobrescrever imediatamente; tentar 1x novamente.
        if (rows.length === 0 && hasCache && !clientsRetryRef.current) {
          clientsRetryRef.current = true;
          setTimeout(loadClients, 700);
          return;
        }
        clientsRetryRef.current = false;
        setClients(rows);
        try { localStorage.setItem(cacheKey, JSON.stringify(rows)); } catch {}
        lastSizeRef.current = rows.length;
        lastLoadTsRef.current = Date.now();
      } catch (err) {
        toast({ title: 'Erro ao carregar clientes', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
        try { clearTimeout(slowFallback); } catch {}
      }
    };

    // Hidratar do cache para evitar sumiço ao trocar de aba e depois atualizar em background
    useEffect(() => {
      try {
        const cachedProfile = localStorage.getItem('auth:userProfile');
        const codigo = userProfile?.codigo_empresa || (cachedProfile ? (JSON.parse(cachedProfile)?.codigo_empresa || null) : null);
        if (codigo) {
          const key = `clientes:list:${codigo}`;
          const cached = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(cached) && cached.length && clients.length === 0) {
            setClients(cached);
            lastSizeRef.current = cached.length;
          }
        }
      } catch {}
      // só dispara quando auth e perfil/empresa prontos
      if (authReady && userProfile?.codigo_empresa) {
        const t0 = setTimeout(loadClients, 50);
        return () => clearTimeout(t0);
      }
      return () => {};
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, userProfile?.codigo_empresa]);

    useEffect(() => {
      if (authReady && userProfile?.codigo_empresa) {
        const t = setTimeout(loadClients, 200);
        return () => clearTimeout(t);
      }
      return () => {};
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.searchTerm, filters.status, authReady, userProfile?.codigo_empresa]);

    // Recarregar ao focar/ficar visível se estiver estagnado
    useEffect(() => {
      const onFocus = () => {
        const elapsed = Date.now() - (lastLoadTsRef.current || 0);
        if (elapsed > 30000 || lastSizeRef.current === 0) {
          if (authReady && userProfile?.codigo_empresa) loadClients();
        }
      };
      const onVis = () => {
        if (document.visibilityState === 'visible') {
          const elapsed = Date.now() - (lastLoadTsRef.current || 0);
          if (elapsed > 30000 || lastSizeRef.current === 0) {
            if (authReady && userProfile?.codigo_empresa) loadClients();
          }
        }
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVis);
      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVis);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, userProfile?.codigo_empresa]);

    const stats = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        return {
            total: clients.length,
            withDebt: clients.filter(c => Number(c.saldo || 0) < 0).length,
            withCredit: clients.filter(c => Number(c.saldo || 0) > 0).length,
            birthdays: clients.filter(c => c.aniversario && new Date(c.aniversario).getMonth() === currentMonth).length,
        };
    }, [clients]);

    const filteredClients = useMemo(() => {
      const today = new Date();
      const currentMonth = today.getMonth();

      return clients.filter(client => {
          const searchTermMatch = filters.searchTerm.toLowerCase() === '' || 
              (client.nome || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
              (client.cpf || '').includes(filters.searchTerm) ||
              (client.telefone || '').includes(filters.searchTerm);
          
          const statusMatch = filters.status === 'all' || client.status === filters.status;

          const cardFilterMatch = !filters.cardFilter || (
              (filters.cardFilter === 'withDebt' && Number(client.saldo || 0) < 0) ||
              (filters.cardFilter === 'withCredit' && Number(client.saldo || 0) > 0) ||
              (filters.cardFilter === 'birthdays' && client.aniversario && new Date(client.aniversario).getMonth() === currentMonth)
          );

          return searchTermMatch && statusMatch && cardFilterMatch;
      });
    }, [clients, filters]);
    
    const handleViewDetails = (client) => {
      setSelectedClient(client);
      setIsDetailsOpen(true);
    };

    const handleAddNew = () => {
      setEditingClient(null);
      setIsFormOpen(true);
    };
    
    const handleEdit = (client) => {
        setIsDetailsOpen(false);
        setEditingClient(client);
        setIsFormOpen(true);
    }
    
    const handleEditFromMenu = (client) => {
        setEditingClient(client);
        setIsFormOpen(true);
    }

    const handleInactivate = async (client) => {
      try {
        const { error } = await supabase.from('clientes').update({ status: 'inactive' }).eq('id', client.id);
        if (error) throw error;
        toast({ title: 'Cliente inativado', description: `${client.nome} foi marcado como inativo.` });
        loadClients();
      } catch (err) {
        toast({ title: 'Erro ao inativar cliente', description: err.message, variant: 'destructive' });
      }
    };
    
    const handleCardFilter = (filterType) => {
        setFilters(prev => ({
            ...prev,
            cardFilter: prev.cardFilter === filterType ? null : filterType
        }));
    }

    const handleClearFilters = () => {
      setFilters({ searchTerm: '', status: 'all', cardFilter: null });
    }
    
    const hasActiveFilters = filters.searchTerm !== '' || filters.status !== 'all' || filters.cardFilter !== null;

    return (
      <>
        <Helmet>
          <title>Clientes - Fluxo7 Arena</title>
          <meta name="description" content="Gerenciamento completo de clientes (CRM)." />
        </Helmet>
        <div className="h-full flex flex-col">
            <motion.div variants={pageVariants} initial="hidden" animate="visible">
                <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tighter">Controle de Clientes</h1>
                        <p className="text-text-secondary">controle financeiro dos seus clientes.</p>
                    </div>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <StatCard icon={Users} title="Total de Clientes" value={stats.total} color="text-brand" />
                    <StatCard icon={UserX} title="Com Saldo Negativo" value={stats.withDebt} color="text-danger" onClick={() => handleCardFilter('withDebt')} isActive={filters.cardFilter === 'withDebt'}/>
                    <StatCard icon={UserCheck} title="Com Crédito" value={stats.withCredit} color="text-success" onClick={() => handleCardFilter('withCredit')} isActive={filters.cardFilter === 'withCredit'}/>
                    <StatCard icon={Gift} title="Aniversariantes do Mês" value={stats.birthdays} color="text-info" onClick={() => handleCardFilter('birthdays')} isActive={filters.cardFilter === 'birthdays'}/>
                </div>

                <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: 0.2}}>
                    <div className="bg-surface rounded-lg border border-border">
                        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4">
                           <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                                <Input 
                                  placeholder="Buscar por nome, CPF ou telefone..." 
                                  className="pl-9" 
                                  value={filters.searchTerm}
                                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-4">
                               <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({...prev, status: value}))}>
                                 <SelectTrigger className="w-[180px]">
                                   <SelectValue placeholder="Status" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="all">Todos os Status</SelectItem>
                                   <SelectItem value="active">Ativos</SelectItem>
                                   <SelectItem value="inactive">Inativos</SelectItem>
                                 </SelectContent>
                               </Select>
                               {hasActiveFilters && (
                                  <Button variant="ghost" onClick={handleClearFilters}>
                                      <XCircle className="mr-2 h-4 w-4"/>
                                      Limpar Filtros
                                  </Button>
                               )}
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                  <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">Carregando...</TableCell>
                                  </TableRow>
                                ) : filteredClients.length > 0 ? (
                                    filteredClients.map(client => (
                                        <TableRow key={client.id} className="cursor-pointer" onClick={() => handleViewDetails(client)}>
                                            <TableCell className="font-mono text-xs text-text-secondary">{client.codigo}</TableCell>
                                            <TableCell className="font-medium">{client.nome}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{client.email || '—'}</span>
                                                    <span className="text-xs text-text-muted">{client.telefone || '—'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-1 text-xs font-semibold rounded-full",
                                                    client.status === 'active' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                                                )}>
                                                    {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={cn(
                                                    "font-bold",
                                                    Number(client.saldo || 0) >= 0 ? "text-success" : "text-danger"
                                                )}>
                                                    R$ {Number(client.saldo || 0).toFixed(2)}
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
                                                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleViewDetails(client); }}>Ver Detalhes</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleEditFromMenu(client); }}>Editar</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-danger" onClick={(e) => { e.stopPropagation(); handleInactivate(client); }}>Inativar Cliente</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            Nenhum cliente encontrado com os filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </motion.div>
            </motion.div>
        </div>
        <ClientFormModal 
            open={isFormOpen} 
            onOpenChange={setIsFormOpen}
            client={editingClient}
            onSaved={loadClients}
        />
        <ClientDetailsModal
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          client={selectedClient}
          onEdit={handleEdit}
        />
      </>
    );
}

export default ClientesPage;