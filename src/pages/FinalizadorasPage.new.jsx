import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Filter, X, Loader2, Check, ChevronDown, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { listarFinalizadoras, criarFinalizadora, atualizarFinalizadora, ativarDesativarFinalizadora } from '@/lib/store';

const TIPOS_FINALIZADORA = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'credito', label: 'Cartão de Crédito' },
  { value: 'debito', label: 'Cartão de Débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'outros', label: 'Outros' },
];

export default function FinalizadorasPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [finalizadoras, setFinalizadoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipos, setFiltroTipos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    tipo: 'dinheiro',
    taxa_percentual: '0.00',
    ativo: true,
  });
  const [formErrors, setFormErrors] = useState({});
  
  // Resetar formulário
  const resetForm = () => {
    setFormData({
      id: '',
      nome: '',
      tipo: 'dinheiro',
      taxa_percentual: '0.00',
      ativo: true,
    });
    setFormErrors({});
    setIsEditing(false);
  };
  
  // Validar formulário
  const validateForm = () => {
    const errors = {};
    if (!formData.nome.trim()) {
      errors.nome = 'O nome é obrigatório';
    }
    if (formData.taxa_percentual === '' || isNaN(Number(formData.taxa_percentual))) {
      errors.taxa_percentual = 'Taxa inválida';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Manipulador de mudança no formulário
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Limpar erro ao digitar
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Carregar finalizadoras
  useEffect(() => {
    async function loadFinalizadoras() {
      try {
        setLoading(true);
        const data = await listarFinalizadoras({ somenteAtivas: false });
        setFinalizadoras(data || []);
      } catch (error) {
        console.error('Erro ao carregar finalizadoras:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as finalizadoras',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    
    if (userProfile) {
      loadFinalizadoras();
    }
  }, [userProfile, toast]);
  
  // Filtrar finalizadoras
  const filteredFinalizadoras = useMemo(() => {
    return finalizadoras.filter(fin => {
      const matchesSearch = fin.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo = filtroTipos.length === 0 || filtroTipos.includes(fin.tipo);
      const matchesStatus = filtroStatus === 'todos' || 
                          (filtroStatus === 'ativo' && fin.ativo) || 
                          (filtroStatus === 'inativo' && !fin.ativo);
      
      return matchesSearch && matchesTipo && matchesStatus;
    });
  }, [finalizadoras, searchTerm, filtroTipos, filtroStatus]);
  
  // Abrir modal para edição
  const handleEdit = (finalizadora) => {
    setFormData({
      id: finalizadora.id,
      nome: finalizadora.nome,
      tipo: finalizadora.tipo,
      taxa_percentual: String(finalizadora.taxa_percentual || '0.00'),
      ativo: finalizadora.ativo
    });
    setIsEditing(true);
    setIsOpen(true);
  };
  
  // Confirmar exclusão
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta finalizadora?')) {
      return;
    }
    
    try {
      setIsDeleting(id);
      await ativarDesativarFinalizadora(id, false);
      
      toast({
        title: 'Sucesso',
        description: 'Finalizadora desativada com sucesso',
      });
      
      // Recarregar a lista
      const data = await listarFinalizadoras({ somenteAtivas: false });
      setFinalizadoras(data || []);
    } catch (error) {
      console.error('Erro ao desativar finalizadora:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desativar a finalizadora',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Enviar formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const finalizadoraData = {
        ...formData,
        taxa_percentual: parseFloat(formData.taxa_percentual) || 0,
      };
      
      if (isEditing) {
        await atualizarFinalizadora(formData.id, finalizadoraData);
        toast({
          title: 'Sucesso',
          description: 'Finalizadora atualizada com sucesso',
        });
      } else {
        await criarFinalizadora(finalizadoraData);
        toast({
          title: 'Sucesso',
          description: 'Finalizadora criada com sucesso',
        });
      }
      
      // Recarregar a lista
      const data = await listarFinalizadoras({ somenteAtivas: false });
      setFinalizadoras(data || []);
      
      // Fechar modal e limpar formulário
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar finalizadora:', error);
      toast({
        title: 'Erro',
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} a finalizadora`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3 w-full items-center">
          <h1 className="text-2xl font-bold mr-4 whitespace-nowrap">Finalizadoras</h1>
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar finalizadora..."
              className="pl-9 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 flex-nowrap">
            <Select 
              value={filtroTipos.length > 0 ? filtroTipos[0] : 'todos'} 
              onValueChange={(value) => {
                if (value === 'todos') {
                  setFiltroTipos([]);
                } else {
                  setFiltroTipos([value]);
                }
              }}
            >
              <SelectTrigger className="w-[160px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {TIPOS_FINALIZADORA.map(tipo => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[140px] ml-2">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Somente ativos</SelectItem>
                <SelectItem value="inativo">Somente inativos</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={() => {
                resetForm();
                setIsOpen(true);
              }}
              className="whitespace-nowrap"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Taxa %</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredFinalizadoras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Nenhuma finalizadora encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredFinalizadoras.map((fin) => (
                <TableRow 
                  key={fin.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => {
                    setFormData({
                      id: fin.id,
                      nome: fin.nome,
                      tipo: fin.tipo,
                      taxa_percentual: String(fin.taxa_percentual || '0.00'),
                      ativo: fin.ativo
                    });
                    setIsEditing(true);
                    setIsOpen(true);
                  }}
                >
                  <TableCell className="font-medium">
                    {fin.nome}
                  </TableCell>
                  <TableCell>
                    {TIPOS_FINALIZADORA.find(t => t.value === fin.tipo)?.label || fin.tipo}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(fin.taxa_percentual || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}%
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between">
                      <span className={fin.ativo ? 'text-success' : 'text-muted-foreground'}>
                        {fin.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(fin.id);
                        }}
                        disabled={isDeleting === fin.id}
                      >
                        {isDeleting === fin.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Finalizadora */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm();
        }
        setIsOpen(open);
      }}>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Editar Finalizadora' : 'Nova Finalizadora'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  className={formErrors.nome ? 'border-red-500' : ''}
                />
                {formErrors.nome && (
                  <p className="text-sm text-red-500">{formErrors.nome}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, tipo: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_FINALIZADORA.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="taxa_percentual">Taxa %</Label>
                <Input
                  id="taxa_percentual"
                  name="taxa_percentual"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.taxa_percentual}
                  onChange={handleChange}
                  className={formErrors.taxa_percentual ? 'border-red-500' : ''}
                />
                {formErrors.taxa_percentual && (
                  <p className="text-sm text-red-500">{formErrors.taxa_percentual}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="ativo"
                  name="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, ativo: checked }))
                  }
                />
                <Label htmlFor="ativo" className="text-sm font-medium leading-none">
                  Ativo
                </Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsOpen(false);
                  resetForm();
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {isEditing ? 'Atualizar' : 'Salvar'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>
    </div>
  );
}
