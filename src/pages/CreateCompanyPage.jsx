import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, User, Building2, Settings, CheckCircle, 
  ArrowRight, ArrowLeft, Loader2, AlertCircle,
  Home, Users, Package, CreditCard, Plus, X
} from 'lucide-react';

const SENHA_ACESSO = '18810778';

const pageVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

function formatCNPJ(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
}

function formatPhone(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 15);
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(0)) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(1)) return false;
  
  return true;
}

function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function gerarCodigoEmpresaSequencial() {
  try {
    // Buscar o maior código numérico existente
    const { data, error } = await supabase
      .from('empresas')
      .select('codigo_empresa')
      .order('codigo_empresa', { ascending: false })
      .limit(100); // Pega os últimos 100 para analisar
    
    if (error) {
      console.warn('Erro ao buscar códigos:', error);
      return '1'; // Se der erro, começa do 1
    }
    
    // Extrair números dos códigos existentes
    let maiorNumero = 0;
    if (data && data.length > 0) {
      data.forEach(empresa => {
        const numero = parseInt(empresa.codigo_empresa);
        if (!isNaN(numero) && numero > maiorNumero) {
          maiorNumero = numero;
        }
      });
    }
    
    // Retornar próximo número
    return (maiorNumero + 1).toString();
    
  } catch (e) {
    console.warn('Erro ao gerar código:', e);
    return '1';
  }
}

export default function CreateCompanyPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  
  // Dados do formulário
  const [formData, setFormData] = useState({
    // Etapa 2: Usuário
    email: '',
    nomeUsuario: '',
    cargo: '',
    
    // Etapa 3: Empresa
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    emailEmpresa: '',
    telefone: '',
    endereco: '',
    
    // Etapa 4: Configuração
    quadras: [],
    mesas: [],
    categorias: [],
  });
  
  const [resultado, setResultado] = useState(null);

  const handleSenhaSubmit = (e) => {
    e.preventDefault();
    if (senhaInput === SENHA_ACESSO) {
      setAuthenticated(true);
      setStep(2);
      toast({ title: 'Acesso liberado', description: 'Bem-vindo ao formulário de criação de empresa.' });
    } else {
      toast({ title: 'Senha incorreta', description: 'Tente novamente.', variant: 'destructive' });
      setSenhaInput('');
    }
  };

  const validateStep2 = () => {
    // Etapa 2 não tem campos obrigatórios
    return true;
  };

  const validateStep3 = () => {
    if (!formData.razaoSocial.trim()) {
      toast({ title: 'Razão Social obrigatória', variant: 'destructive' });
      return false;
    }
    if (!formData.nomeFantasia.trim()) {
      toast({ title: 'Nome Fantasia obrigatório', variant: 'destructive' });
      return false;
    }
    // Demais campos são opcionais
    return true;
  };

  const handleNext = () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleAddQuadra = () => {
    const numero = formData.quadras.length + 1;
    setFormData({
      ...formData,
      quadras: [...formData.quadras, { nome: `Quadra ${numero}` }]
    });
  };

  const handleRemoveQuadra = (index) => {
    setFormData({
      ...formData,
      quadras: formData.quadras.filter((_, i) => i !== index)
    });
  };

  const handleAddMesa = () => {
    const numero = formData.mesas.length + 1;
    setFormData({
      ...formData,
      mesas: [...formData.mesas, { numero, nome: `Mesa ${numero}` }]
    });
  };

  const handleRemoveMesa = (index) => {
    setFormData({
      ...formData,
      mesas: formData.mesas.filter((_, i) => i !== index)
    });
  };

  const handleAddCategoria = () => {
    const nome = prompt('Digite o nome da categoria:');
    if (nome && nome.trim()) {
      setFormData({
        ...formData,
        categorias: [...formData.categorias, { nome: nome.trim(), descricao: '' }]
      });
    }
  };

  const handleRemoveCategoria = (index) => {
    setFormData({
      ...formData,
      categorias: formData.categorias.filter((_, i) => i !== index)
    });
  };

  const handleCreateCompany = async () => {
    try {
      setLoading(true);
      
      // 1. Buscar usuário pelo email (se fornecido)
      // Nota: Como não temos acesso à Admin API, vamos buscar pelo email diretamente
      let userId = null;
      
      if (formData.email.trim()) {
        // Tenta buscar o colaborador existente pelo email
        // Se não existir, o usuário precisará fazer login primeiro para criar o vínculo
        console.log('Email fornecido:', formData.email);
        console.log('Nota: O vínculo com o usuário será criado no primeiro login');
        
        // Por enquanto, vamos pular a verificação do auth.users
        // O colaborador será criado sem ID específico, ou podemos usar o email como referência
        userId = null; // Será vinculado no primeiro login
      }
      
      // 2. Gerar código sequencial da empresa
      const codigoEmpresa = await gerarCodigoEmpresaSequencial();
      
      console.log('Código da empresa gerado:', codigoEmpresa);
      
      // 3. Criar empresa
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          codigo_empresa: codigoEmpresa,
          nome: formData.nomeFantasia,
          razao_social: formData.razaoSocial,
          nome_fantasia: formData.nomeFantasia,
          cnpj: formData.cnpj ? formData.cnpj.replace(/\D/g, '') : null,
          email: formData.emailEmpresa || null,
          telefone: formData.telefone || null,
          endereco: formData.endereco || null,
        })
        .select()
        .single();
      
      if (empresaError) throw new Error('Erro ao criar empresa: ' + empresaError.message);
      
      // 4. Criar contador da empresa
      const { error: counterError } = await supabase
        .from('empresa_counters')
        .insert({
          empresa_id: empresa.id,
          next_cliente_codigo: 1,
          next_agendamento_codigo: 1,
        });
      
      if (counterError) {
        console.warn('Erro ao criar contador:', counterError);
      }
      
      // 5. Criar perfil do usuário - em usuarios E colaboradores
      if (formData.email.trim() || formData.nomeUsuario.trim()) {
        try {
          // Gerar ID temporário (compatível com todos os navegadores)
          const tempId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          
          // Criar em usuarios
          const { error: userError } = await supabase
            .from('usuarios')
            .insert({
              id: tempId,
              email: formData.email || null,
              nome: formData.nomeUsuario || null,
              papel: formData.cargo || 'admin',
              codigo_empresa: codigoEmpresa,
            });
          
          if (userError) {
            console.warn('Aviso ao criar usuário:', userError.message);
          }
          
          // Criar em colaboradores com mesmo ID temporário
          const { error: colabError } = await supabase
            .from('colaboradores')
            .insert({
              id: tempId,
              nome: formData.nomeUsuario || 'Administrador',
              cargo: formData.cargo || 'admin',
              ativo: true,
              codigo_empresa: codigoEmpresa,
            });
          
          if (colabError) {
            console.warn('Aviso ao criar colaborador:', colabError.message);
          }
          
          // Mostrar SQL para atualizar após login
          if (formData.email) {
            console.log('⚠️ APÓS O PRIMEIRO LOGIN, execute este SQL no Supabase:');
            console.log(`
-- Atualizar ID do colaborador com o ID real do auth.users
UPDATE public.colaboradores 
SET id = (SELECT id FROM auth.users WHERE email = '${formData.email}')
WHERE codigo_empresa = '${codigoEmpresa}' AND id = '${tempId}';

-- Atualizar ID do usuário
UPDATE public.usuarios 
SET id = (SELECT id FROM auth.users WHERE email = '${formData.email}')
WHERE codigo_empresa = '${codigoEmpresa}' AND id = '${tempId}';
            `);
          }
          
        } catch (e) {
          console.warn('Erro ao criar registros de usuário:', e);
        }
      }
      
      // 6. Criar agenda_settings
      await supabase.from('agenda_settings').insert({
        empresa_id: empresa.id,
        auto_confirm_enabled: false,
        auto_start_enabled: true,
        auto_finish_enabled: true,
      });
      
      // 7. Finalizadoras removidas - usuário cria após login
      
      // 8. Criar quadras
      if (formData.quadras.length > 0) {
        const quadrasInsert = formData.quadras.map(q => ({
          nome: q.nome,
          codigo_empresa: codigoEmpresa,
        }));
        await supabase.from('quadras').insert(quadrasInsert);
      }
      
      // 9. Criar mesas
      if (formData.mesas.length > 0) {
        const mesasInsert = formData.mesas.map(m => ({
          numero: m.numero,
          nome: m.nome,
          codigo_empresa: codigoEmpresa,
          status: 'available',
        }));
        await supabase.from('mesas').insert(mesasInsert);
      }
      
      // 10. Criar categorias de produtos
      if (formData.categorias.length > 0) {
        const categoriasInsert = formData.categorias.map(c => ({ 
          nome: c.nome,
          descricao: c.descricao || null,
          codigo_empresa: codigoEmpresa, 
          ativa: true 
        }));
        await supabase.from('produto_categorias').insert(categoriasInsert);
      }
      
      // Sucesso!
      setResultado({
        success: true,
        codigoEmpresa,
        email: formData.email,
        nomeEmpresa: formData.nomeFantasia,
        numQuadras: formData.quadras.length,
        numMesas: formData.mesas.length,
        numCategorias: formData.categorias.length,
      });
      
      setStep(6);
      
      toast({ 
        title: '🎉 Empresa criada com sucesso!', 
        description: `Código: ${codigoEmpresa}` 
      });
      
    } catch (error) {
      console.error('Erro ao criar empresa:', error);
      toast({ 
        title: 'Erro ao criar empresa', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => {
    if (step === 1 || step === 6) return null;
    
    const progress = ((step - 1) / 4) * 100;
    
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-text-muted">Etapa {step - 1} de 4</span>
          <span className="text-sm text-text-muted">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <motion.div
      key="step1"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
          <Lock className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Área Restrita</h1>
        <p className="text-text-muted">Digite a senha para acessar</p>
      </div>
      
      <form onSubmit={handleSenhaSubmit} className="space-y-4">
        <div>
          <Label htmlFor="senha">Senha de Acesso</Label>
          <Input
            id="senha"
            type="password"
            value={senhaInput}
            onChange={(e) => setSenhaInput(e.target.value)}
            placeholder="Digite a senha"
            className="text-center text-lg tracking-widest"
            autoFocus
          />
        </div>
        
        <Button type="submit" className="w-full">
          Acessar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
          <User className="w-8 h-8 text-brand" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Primeiro Usuário</h2>
        <p className="text-text-muted">Informações do administrador da empresa</p>
      </div>
      
      <div className="space-y-6">
        <div>
          <Label htmlFor="email">Email cadastrado no Supabase Auth</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="usuario@email.com"
          />
          <p className="text-xs text-text-muted mt-1">Este email já deve estar cadastrado no Supabase Auth</p>
        </div>
        
        <div>
          <Label htmlFor="nomeUsuario">Nome Completo</Label>
          <Input
            id="nomeUsuario"
            type="text"
            value={formData.nomeUsuario}
            onChange={(e) => setFormData({ ...formData, nomeUsuario: e.target.value })}
            placeholder="João Silva"
          />
        </div>
        
        <div>
          <Label htmlFor="cargo">Cargo na Empresa</Label>
          <Input
            id="cargo"
            type="text"
            value={formData.cargo}
            onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
            placeholder="Ex: Proprietário, Gerente, Administrador, Sócio, etc."
          />
          <p className="text-xs text-text-muted mt-1">Digite o cargo que você ocupa na empresa</p>
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
            Cancelar
          </Button>
          <Button type="button" onClick={handleNext} className="flex-1">
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      key="step3"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
          <Building2 className="w-8 h-8 text-brand" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Dados da Empresa</h2>
        <p className="text-text-muted">Informações cadastrais da empresa</p>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="razaoSocial">Razão Social *</Label>
            <Input
              id="razaoSocial"
              type="text"
              value={formData.razaoSocial}
              onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
              placeholder="Empresa LTDA"
            />
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="nomeFantasia">Nome Fantasia *</Label>
            <Input
              id="nomeFantasia"
              type="text"
              value={formData.nomeFantasia}
              onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
              placeholder="Minha Empresa"
            />
            <p className="text-xs text-text-muted mt-1">Como a empresa aparecerá no sistema</p>
          </div>
          
          <div>
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              type="text"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
          </div>
          
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
              placeholder="(11) 99999-9999"
            />
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="emailEmpresa">Email da Empresa</Label>
            <Input
              id="emailEmpresa"
              type="email"
              value={formData.emailEmpresa}
              onChange={(e) => setFormData({ ...formData, emailEmpresa: e.target.value })}
              placeholder="contato@empresa.com"
            />
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="endereco">Endereço Completo (opcional)</Label>
            <Input
              id="endereco"
              type="text"
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Rua X, 123, Bairro, Cidade - UF"
            />
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button type="button" onClick={handleNext} className="flex-1">
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div
      key="step4"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
          <Settings className="w-8 h-8 text-brand" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Configuração Inicial</h2>
        <p className="text-text-muted">Adicione dados iniciais ou pule esta etapa</p>
      </div>
      
      <div className="space-y-6">
        {/* Quadras */}
        <div className="bg-surface-2 border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-brand" />
              <h3 className="font-semibold text-text-primary">Quadras Esportivas</h3>
            </div>
            <Button type="button" onClick={handleAddQuadra} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Quadra
            </Button>
          </div>
          
          {formData.quadras.length > 0 ? (
            <div className="space-y-2">
              {formData.quadras.map((quadra, index) => (
                <div key={index} className="flex items-center justify-between bg-background rounded-md p-3 border border-border">
                  <span className="text-sm text-text-primary">{quadra.nome}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveQuadra(index)}
                    className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">Nenhuma quadra adicionada</p>
          )}
        </div>
        
        {/* Mesas */}
        <div className="bg-surface-2 border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-brand" />
              <h3 className="font-semibold text-text-primary">Mesas da Loja</h3>
            </div>
            <Button type="button" onClick={handleAddMesa} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Mesa
            </Button>
          </div>
          
          {formData.mesas.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {formData.mesas.map((mesa, index) => (
                <div key={index} className="flex items-center justify-between bg-background rounded-md p-3 border border-border">
                  <span className="text-sm text-text-primary">{mesa.nome}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveMesa(index)}
                    className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">Nenhuma mesa adicionada</p>
          )}
        </div>
        
        {/* Categorias */}
        <div className="bg-surface-2 border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-brand" />
              <h3 className="font-semibold text-text-primary">Categorias de Produtos</h3>
            </div>
            <Button type="button" onClick={handleAddCategoria} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Categoria
            </Button>
          </div>
          
          {formData.categorias.length > 0 ? (
            <div className="space-y-2">
              {formData.categorias.map((categoria, index) => (
                <div key={index} className="flex items-center justify-between bg-background rounded-md p-3 border border-border">
                  <span className="text-sm text-text-primary">{categoria.nome}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveCategoria(index)}
                    className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">Nenhuma categoria adicionada</p>
          )}
        </div>
        
        <div className="bg-info/10 border border-info/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-info mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">Configurações Opcionais</p>
              <p className="text-xs text-text-muted">
                Você pode adicionar quadras, mesas e categorias agora ou configurar depois no sistema.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button type="button" onClick={handleNext} className="flex-1">
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderStep5 = () => {
    
    return (
      <motion.div
        key="step5"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="max-w-2xl mx-auto"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-brand" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Revisão Final</h2>
          <p className="text-text-muted">Confira os dados antes de criar a empresa</p>
        </div>
        
        <div className="space-y-6">
          <div className="bg-surface-2 border border-border rounded-lg p-6">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Primeiro Usuário
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Email:</span>
                <span className="text-text-primary font-medium">{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Nome:</span>
                <span className="text-text-primary font-medium">{formData.nomeUsuario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Cargo:</span>
                <span className="text-text-primary font-medium">{formData.cargo}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-2 border border-border rounded-lg p-6">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Empresa
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Razão Social:</span>
                <span className="text-text-primary font-medium">{formData.razaoSocial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Nome Fantasia:</span>
                <span className="text-text-primary font-medium">{formData.nomeFantasia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">CNPJ:</span>
                <span className="text-text-primary font-medium">{formData.cnpj}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Email:</span>
                <span className="text-text-primary font-medium">{formData.emailEmpresa}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Telefone:</span>
                <span className="text-text-primary font-medium">{formData.telefone}</span>
              </div>
              {formData.endereco && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Endereço:</span>
                  <span className="text-text-primary font-medium text-right">{formData.endereco}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-surface-2 border border-border rounded-lg p-6">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações Iniciais
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Quadras:</span>
                <span className="text-text-primary font-medium">{formData.quadras.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Mesas:</span>
                <span className="text-text-primary font-medium">{formData.mesas.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Categorias de Produtos:</span>
                <span className="text-text-primary font-medium">{formData.categorias.length}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">Atenção</p>
                <p className="text-xs text-text-muted">
                  Esta ação criará a empresa no banco de dados. Certifique-se de que todos os dados estão corretos.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1" disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button 
              type="button" 
              onClick={handleCreateCompany} 
              className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  🚀 Criar Empresa
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderStep6 = () => (
    <motion.div
      key="step6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-6">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <h2 className="text-3xl font-bold text-text-primary mb-2">🎉 Empresa Criada!</h2>
        <p className="text-text-muted">Tudo pronto para começar a usar o sistema</p>
      </div>
      
      <div className="space-y-6">
        <div className="bg-brand/10 border border-brand/30 rounded-lg p-6">
          <div className="text-center">
            <p className="text-sm text-text-muted mb-2">Código da Empresa</p>
            <p className="text-3xl font-bold text-brand font-mono">{resultado?.codigoEmpresa}</p>
          </div>
        </div>
        
        <div className="bg-surface-2 border border-border rounded-lg p-6">
          <h3 className="font-semibold text-text-primary mb-4">Dados de Acesso</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Email:</span>
              <span className="text-text-primary font-medium">{resultado?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Senha:</span>
              <span className="text-text-primary font-medium">(a que você definiu no Supabase)</span>
            </div>
          </div>
        </div>
        
        <div className="bg-surface-2 border border-border rounded-lg p-6">
          <h3 className="font-semibold text-text-primary mb-4">Dados Criados</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-2xl font-bold text-brand mb-1">✓</div>
              <div className="text-xs text-text-muted">Empresa</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-2xl font-bold text-brand mb-1">✓</div>
              <div className="text-xs text-text-muted">Configurações</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-2xl font-bold text-brand mb-1">{resultado?.numQuadras}</div>
              <div className="text-xs text-text-muted">Quadras</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-2xl font-bold text-brand mb-1">{resultado?.numMesas}</div>
              <div className="text-xs text-text-muted">Mesas</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-2xl font-bold text-brand mb-1">{resultado?.numCategorias}</div>
              <div className="text-xs text-text-muted">Categorias</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-2xl font-bold text-brand mb-1">✓</div>
              <div className="text-xs text-text-muted">Pronto para Uso</div>
            </div>
          </div>
        </div>
        
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary mb-2">⚠️ IMPORTANTE: Execute o SQL Antes de Fazer Login</p>
              <div className="space-y-2 text-xs text-text-muted">
                <p className="font-semibold text-text-primary">Para vincular seu usuário à empresa, siga estes passos:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Abra o <strong>Console do Navegador</strong> (pressione F12)</li>
                  <li>Procure pela mensagem <strong>"⚠️ APÓS O PRIMEIRO LOGIN, execute este SQL"</strong></li>
                  <li>Copie o comando SQL que aparece no console</li>
                  <li>Acesse o <strong>Supabase → SQL Editor</strong></li>
                  <li>Cole e execute o SQL</li>
                  <li>Agora sim, faça login normalmente</li>
                </ol>
                <p className="mt-2 text-warning font-medium">
                  ⚠️ Se não executar o SQL, você verá o erro "Empresa não vinculada"
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-4">
          <Button 
            type="button" 
            onClick={() => navigate('/')} 
            className="w-full bg-brand hover:bg-brand/90"
          >
            Ir para Login
          </Button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <div className="min-h-screen bg-background text-text-primary p-8">
        <div className="max-w-4xl mx-auto">
          {renderProgressBar()}
          
          <AnimatePresence mode="wait">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
            {step === 6 && renderStep6()}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
