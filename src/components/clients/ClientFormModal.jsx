import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
// UI extras (shadcn style). Caso não existam, podemos substituir por elementos nativos facilmente.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function ClientFormModal({ open, onOpenChange, client, onSaved }) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const initialForm = (c) => ({
    // Dados básicos
    tipo_pessoa: c?.tipo_pessoa || 'PF', // PF | PJ
    tipo_cadastro: c?.tipo_cadastro || 'cliente', // cliente | fornecedor | ambos
    nome: c?.nome || '', // PF: Nome; PJ: Razão Social
    apelido: c?.apelido || '', // Nome Fantasia
    cpf: c?.cpf || '',
    cnpj: c?.cnpj || '',
    rg: c?.rg || '',
    ie: c?.ie || '',
    email: c?.email || '',
    // Contatos
    telefone: c?.telefone || '', // principal
    fone2: c?.fone2 || '',
    celular1: c?.celular1 || '',
    celular2: c?.celular2 || '',
    whatsapp: c?.whatsapp || '',
    // Endereço
    cep: c?.cep || '',
    endereco: c?.endereco || '',
    numero: c?.numero || '',
    complemento: c?.complemento || '',
    bairro: c?.bairro || '',
    cidade: c?.cidade || '',
    uf: c?.uf || '',
    cidade_ibge: c?.cidade_ibge || '',
    // Financeiro
    limite_credito: c?.limite_credito ?? '',
    tipo_recebimento: c?.tipo_recebimento || '',
    regime_tributario: c?.regime_tributario || '',
    tipo_contribuinte: c?.tipo_contribuinte || '',
    // Adicionais
    aniversario: c?.aniversario ? String(c.aniversario).slice(0,10) : '',
    sexo: c?.sexo || '',
    estado_civil: c?.estado_civil || '',
    nome_mae: c?.nome_mae || '',
    nome_pai: c?.nome_pai || '',
    observacoes: c?.observacoes || '',
    // Status
    status: c?.status || 'active',
  });
  const [form, setForm] = useState(initialForm(client));
  const [activeTab, setActiveTab] = useState('basicos');

  useEffect(() => {
    // Determina tipo_cadastro baseado nas flags
    let tipoCadastro = 'cliente';
    if (client?.flag_cliente && client?.flag_fornecedor) {
      tipoCadastro = 'ambos';
    } else if (client?.flag_fornecedor) {
      tipoCadastro = 'fornecedor';
    }
    
    setForm({
      tipo_pessoa: client?.tipo_pessoa || 'PF',
      tipo_cadastro: tipoCadastro,
      nome: client?.nome || '',
      apelido: client?.apelido || '',
      cpf: client?.cpf || '',
      cnpj: client?.cnpj || '',
      rg: client?.rg || '',
      ie: client?.ie || '',
      email: client?.email || '',
      telefone: client?.telefone || '',
      fone2: client?.fone2 || '',
      celular1: client?.celular1 || '',
      celular2: client?.celular2 || '',
      whatsapp: client?.whatsapp || '',
      cep: client?.cep || '',
      endereco: client?.endereco || '',
      numero: client?.numero || '',
      complemento: client?.complemento || '',
      bairro: client?.bairro || '',
      cidade: client?.cidade || '',
      uf: client?.uf || '',
      cidade_ibge: client?.cidade_ibge || '',
      limite_credito: client?.limite_credito ?? '',
      tipo_recebimento: client?.tipo_recebimento || '',
      regime_tributario: client?.regime_tributario || '',
      tipo_contribuinte: client?.tipo_contribuinte || '',
      aniversario: client?.aniversario ? String(client.aniversario).slice(0,10) : '',
      sexo: client?.sexo || '',
      estado_civil: client?.estado_civil || '',
      nome_mae: client?.nome_mae || '',
      nome_pai: client?.nome_pai || '',
      observacoes: client?.observacoes || '',
      status: client?.status || 'active',
    });
  }, [client]);

  // Reset quando abrir/fechar: não persistir dados entre aberturas de "Novo Cliente"
  useEffect(() => {
    if (open) {
      // Ao abrir, sincroniza com o cliente atual (ou limpa se novo)
      setForm(initialForm(client || null));
    } else {
      // Ao fechar, se for novo cliente, limpa o estado
      if (!client) setForm(initialForm(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!client]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const toNull = (v) => (v === '' ? null : v);
  const parseMoney = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (!s) return null;
    // Trata formatos "1.234,56" ou "1234,56" e também "1234.56"
    const normalized = s
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '') // remove separadores de milhar
      .replace(/,/g, '.'); // vírgula como decimal
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const sanitizers = useMemo(() => ({
    digits: (v) => (v || '').replace(/\D+/g, ''),
  }), []);

  // Mask helpers
  const maskCPF = (v) => sanitizers.digits(v).slice(0,11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  const maskCNPJ = (v) => sanitizers.digits(v).slice(0,14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  const maskCEP = (v) => sanitizers.digits(v).slice(0,8).replace(/(\d{5})(\d)/, '$1-$2');
  const maskPhone = (v) => {
    const d = sanitizers.digits(v).slice(0,11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  };
  const maskUF = (v) => String(v || '').replace(/[^a-z]/gi, '').toUpperCase().slice(0,2);
  const maskNumber = (v, max=6) => sanitizers.digits(v).slice(0,max);

  const handleMaskedChange = (id, raw) => {
    let val = raw;
    if (id === 'cpf') val = maskCPF(raw);
    if (id === 'cnpj') val = maskCNPJ(raw);
    if (id === 'cep') val = maskCEP(raw);
    if (['telefone','fone2','celular1','celular2','whatsapp'].includes(id)) val = maskPhone(raw);
    if (id === 'uf') val = maskUF(raw);
    if (id === 'numero') val = maskNumber(raw, 8);
    if (id === 'cidade_ibge') val = maskNumber(raw, 7);
    setForm((p) => ({ ...p, [id]: val }));
  };

  const fetchCEP = async () => {
    const cepNum = sanitizers.digits(form.cep);
    if (!cepNum || cepNum.length !== 8) {
      toast({ title: 'CEP inválido', description: 'Informe 8 dígitos.', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`);
      const data = await res.json();
      if (data.erro) throw new Error('CEP não encontrado');
      setForm((prev) => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        cidade_ibge: data.ibge || prev.cidade_ibge,
      }));
    } catch (err) {
      toast({ title: 'Falha ao buscar CEP', description: err.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    try {
      // Validações mínimas
      if (!form.nome || form.nome.trim().length < 2) {
        throw new Error('Informe o nome/razão social do cliente.');
      }

      // Monta payload com todos os campos (strings vazias => null)
      const payload = {
        // básicos
        tipo_pessoa: toNull(form.tipo_pessoa),
        nome: form.nome,
        apelido: toNull(form.apelido),
        cpf: toNull(form.cpf),
        cnpj: toNull(form.cnpj),
        rg: toNull(form.rg),
        ie: toNull(form.ie),
        email: toNull(form.email),
        // contatos
        telefone: toNull(form.telefone),
        fone2: toNull(form.fone2),
        celular1: toNull(form.celular1),
        celular2: toNull(form.celular2),
        whatsapp: toNull(form.whatsapp),
        // endereço
        cep: toNull(form.cep),
        endereco: toNull(form.endereco),
        numero: toNull(form.numero),
        complemento: toNull(form.complemento),
        bairro: toNull(form.bairro),
        cidade: toNull(form.cidade),
        uf: toNull(form.uf),
        cidade_ibge: toNull(form.cidade_ibge),
        // financeiro
        limite_credito: parseMoney(form.limite_credito),
        tipo_recebimento: toNull(form.tipo_recebimento),
        regime_tributario: toNull(form.regime_tributario),
        tipo_contribuinte: toNull(form.tipo_contribuinte),
        // adicionais
        aniversario: toNull(form.aniversario),
        sexo: toNull(form.sexo),
        estado_civil: toNull(form.estado_civil),
        nome_mae: toNull(form.nome_mae),
        nome_pai: toNull(form.nome_pai),
        observacoes: toNull(form.observacoes),
        // flags baseadas no tipo_cadastro
        flag_cliente: form.tipo_cadastro === 'cliente' || form.tipo_cadastro === 'ambos',
        flag_fornecedor: form.tipo_cadastro === 'fornecedor' || form.tipo_cadastro === 'ambos',
        flag_funcionario: false,
        flag_administradora: false,
        flag_parceiro: false,
        flag_ccf_spc: false,
        status: form.status,
      };
      let error;
      let savedRow = null;
      if (client?.id) {
        const { data, error: upErr } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', client.id)
          .select()
          .single();
        error = upErr;
        savedRow = data ?? null;
      } else {
        const companyCode = userProfile?.codigo_empresa || null;
        if (!companyCode) {
          throw new Error('Não foi possível identificar a empresa do usuário (codigo_empresa). Tente recarregar a página ou entrar novamente.');
        }
        const insertPayload = { ...payload, codigo_empresa: companyCode };
        const { data, error: insErr } = await supabase
          .from('clientes')
          .insert(insertPayload)
          .select()
          .single();
        error = insErr;
        savedRow = data ?? null;
      }
      if (error) throw error;
      toast({ title: 'Cliente salvo!', description: 'As informações do cliente foram atualizadas.', variant: 'success' });
      
      // ✅ CORREÇÃO CRÍTICA: Chama onSaved ANTES de fechar o modal
      // para garantir que o estado seja sincronizado antes de qualquer cleanup
      onSaved?.(savedRow);
      
      // Pequeno delay para garantir que onSaved complete antes de fechar
      setTimeout(() => {
        onOpenChange?.(false);
      }, 50);
    } catch (err) {
      // Mensagem amigável quando colunas não existirem ainda no BD
      const raw = (err?.message || '').toLowerCase();
      const hint = raw.includes('column') && raw.includes('does not exist')
        ? 'Seu banco pode não estar migrado para os novos campos. Atualize o schema conforme estrutura_bd.'
        : err.message;
      toast({ title: 'Erro ao salvar cliente', description: hint, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto w-full">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>Preencha os dados cadastrais do cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4 sm:gap-6 py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Select para Mobile */}
            <div className="sm:hidden mb-4">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basicos">Dados Básicos</SelectItem>
                  <SelectItem value="endereco">Endereço</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="adicionais">Adicionais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs para Desktop */}
            <TabsList className="hidden sm:grid grid-cols-4 gap-2">
              <TabsTrigger value="basicos">Dados Básicos</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
            </TabsList>

            <TabsContent value="basicos" className="space-y-3 sm:space-y-4 mt-2">
            <div className="grid grid-cols-12 gap-3 sm:gap-4">
              <div className="col-span-12 sm:col-span-3">
                <Label>Tipo de Pessoa</Label>
                <Select value={form.tipo_pessoa} onValueChange={(v) => setForm((p) => ({ ...p, tipo_pessoa: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pessoa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Física</SelectItem>
                    <SelectItem value="PJ">Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label>Tipo de Cadastro *</Label>
                <Select value={form.tipo_cadastro} onValueChange={(v) => setForm((p) => ({ ...p, tipo_cadastro: v }))} required>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="ambos">Cliente e Fornecedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-6">
                <Label htmlFor="nome">{form.tipo_pessoa === 'PJ' ? 'Razão Social' : 'Nome'}</Label>
                <Input id="nome" value={form.nome} onChange={handleChange} required />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <Label htmlFor="apelido">{form.tipo_pessoa === 'PJ' ? 'Nome Fantasia' : 'Apelido'}</Label>
                <Input id="apelido" value={form.apelido} onChange={handleChange} />
              </div>
              {form.tipo_pessoa === 'PF' ? (
                <>
                  <div className="col-span-12 sm:col-span-3">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input id="cpf" value={form.cpf} onChange={(e)=>handleMaskedChange('cpf', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <Label htmlFor="rg">RG</Label>
                    <Input id="rg" value={form.rg} onChange={handleChange} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-12 sm:col-span-3">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" value={form.cnpj} onChange={(e)=>handleMaskedChange('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <Label htmlFor="ie">Inscrição Estadual (IE)</Label>
                    <Input id="ie" value={form.ie} onChange={handleChange} />
                  </div>
                </>
              )}

              <div className="col-span-12 sm:col-span-6">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={handleChange} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={form.telefone} onChange={(e)=>handleMaskedChange('telefone', e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="celular1">Celular</Label>
                <Input id="celular1" value={form.celular1} onChange={(e)=>handleMaskedChange('celular1', e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" value={form.whatsapp} onChange={(e)=>handleMaskedChange('whatsapp', e.target.value)} placeholder="(DDD) 9...." />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="fone2">Fone 2</Label>
                <Input id="fone2" value={form.fone2} onChange={(e)=>handleMaskedChange('fone2', e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="celular2">Celular 2</Label>
                <Input id="celular2" value={form.celular2} onChange={(e)=>handleMaskedChange('celular2', e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="aniversario">Nascimento</Label>
                <Input id="aniversario" type="date" value={form.aniversario || ''} onChange={handleChange} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-3 sm:space-y-4 mt-2">
            <div className="grid grid-cols-12 gap-3 sm:gap-4">
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input id="cep" value={form.cep} onChange={(e)=>handleMaskedChange('cep', e.target.value)} placeholder="00000-000" />
                  <Button type="button" variant="outline" onClick={fetchCEP}>Buscar</Button>
                </div>
              </div>
              <div className="col-span-12 sm:col-span-6">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={form.endereco} onChange={handleChange} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" value={form.numero} onChange={(e)=>handleMaskedChange('numero', e.target.value)} />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" value={form.complemento} onChange={handleChange} />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" value={form.bairro} onChange={handleChange} />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={form.cidade} onChange={handleChange} />
              </div>
              <div className="col-span-6 sm:col-span-1">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={form.uf} onChange={(e)=>handleMaskedChange('uf', e.target.value)} placeholder="UF" />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="cidade_ibge">Cód. IBGE</Label>
                <Input id="cidade_ibge" value={form.cidade_ibge} onChange={(e)=>handleMaskedChange('cidade_ibge', e.target.value)} />
              </div>
            </div>
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-3 sm:space-y-4 mt-2">
            <div className="grid grid-cols-12 gap-3 sm:gap-4">
              <div className="col-span-12 sm:col-span-3">
                <Label htmlFor="limite_credito">Limite de Crédito</Label>
                <Input id="limite_credito" value={form.limite_credito} onChange={handleChange} placeholder="0,00" />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label>Tipo de Recebimento</Label>
                <Select value={form.tipo_recebimento || ''} onValueChange={(v) => setForm((p) => ({ ...p, tipo_recebimento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="aprazo">A prazo</SelectItem>
                    <SelectItem value="misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label>Regime Tributário</Label>
                <Select value={form.regime_tributario || ''} onValueChange={(v) => setForm((p) => ({ ...p, regime_tributario: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label>Tipo de Contribuinte</Label>
                <Select value={form.tipo_contribuinte || ''} onValueChange={(v) => setForm((p) => ({ ...p, tipo_contribuinte: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_contribuinte">Não Contribuinte</SelectItem>
                    <SelectItem value="contribuinte">Contribuinte</SelectItem>
                    <SelectItem value="isento">Isento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            </TabsContent>

            <TabsContent value="adicionais" className="space-y-3 sm:space-y-4 mt-2">
            <div className="grid grid-cols-12 gap-3 sm:gap-4">
              <div className="col-span-12 sm:col-span-4">
                <Label htmlFor="sexo">Sexo</Label>
                <Select value={form.sexo || ''} onValueChange={(v) => setForm((p) => ({ ...p, sexo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">Masculino</SelectItem>
                    <SelectItem value="f">Feminino</SelectItem>
                    <SelectItem value="o">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Label htmlFor="estado_civil">Estado Civil</Label>
                <Select value={form.estado_civil || ''} onValueChange={(v) => setForm((p) => ({ ...p, estado_civil: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Label htmlFor="nome_mae">Nome da Mãe</Label>
                <Input id="nome_mae" value={form.nome_mae} onChange={handleChange} />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Label htmlFor="nome_pai">Nome do Pai</Label>
                <Input id="nome_pai" value={form.nome_pai} onChange={handleChange} />
              </div>
              <div className="col-span-12">
                <Label htmlFor="observacoes">Observações</Label>
                <textarea id="observacoes" value={form.observacoes} onChange={handleChange} rows={4} className="w-full rounded-md border border-border bg-background p-2 text-sm" />
              </div>
            </div>
            </TabsContent>
          </Tabs>
        </form>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="w-full sm:w-auto">Cancelar</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave} className="w-full sm:w-auto">Salvar Cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientFormModal;
