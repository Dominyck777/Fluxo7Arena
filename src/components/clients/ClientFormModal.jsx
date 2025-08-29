import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

function ClientFormModal({ open, onOpenChange, client, onSaved }) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    nome: client?.nome || '',
    cpf: client?.cpf || '',
    email: client?.email || '',
    telefone: client?.telefone || '',
    aniversario: client?.aniversario ? String(client.aniversario).slice(0,10) : '',
    status: client?.status || 'active',
  });

  useEffect(() => {
    setForm({
      nome: client?.nome || '',
      cpf: client?.cpf || '',
      email: client?.email || '',
      telefone: client?.telefone || '',
      aniversario: client?.aniversario ? String(client.aniversario).slice(0,10) : '',
      status: client?.status || 'active',
    });
  }, [client]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const toNull = (v) => (v === '' ? null : v);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    try {
      const payload = {
        nome: form.nome,
        cpf: toNull(form.cpf),
        email: toNull(form.email),
        telefone: toNull(form.telefone),
        aniversario: toNull(form.aniversario),
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
        const insertPayload = { ...payload, codigo_empresa: userProfile?.codigo_empresa || null };
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
      onOpenChange?.(false);
      onSaved?.(savedRow);
    } catch (err) {
      toast({ title: 'Erro ao salvar cliente', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>Preencha os dados cadastrais do cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nome" className="text-right">Nome</Label>
            <Input id="nome" value={form.nome} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cpf" className="text-right">CPF/CNPJ</Label>
            <Input id="cpf" value={form.cpf} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="telefone" className="text-right">Telefone</Label>
            <Input id="telefone" value={form.telefone} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="aniversario" className="text-right">Nascimento</Label>
            <Input id="aniversario" type="date" value={form.aniversario || ''} onChange={handleChange} className="col-span-3" />
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave}>Salvar Cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientFormModal;
