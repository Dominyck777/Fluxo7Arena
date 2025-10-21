import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAgenda } from '@/contexts/AgendaContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function EditParticipantModal({
  form,
  setForm,
  localCustomers
}) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  // Context
  const {
    isEditParticipantModalOpen,
    closeEditParticipantModal,
    editParticipantData,
    participantsForm,
    setParticipantsForm,
    payMethods,
    protectPaymentModal
  } = useAgenda();
  
  // Estados locais
  const [editParticipantSearch, setEditParticipantSearch] = useState('');
  const [editParticipantLoading, setEditParticipantLoading] = useState(false);
  
  // Função para substituir participante
  const handleSelectParticipant = (cliente) => {
    if (cliente.id === editParticipantData.participantId) {
      return; // Já é o participante atual
    }
    
    console.log('🔄 [EditParticipantModal] Substituindo participante:', {
      de: editParticipantData.participantName,
      para: cliente.nome,
      id_de: editParticipantData.participantId,
      id_para: cliente.id
    });
    
    // Pegar dados de pagamento do participante antigo
    const oldPaymentData = participantsForm.find(
      p => p.cliente_id === editParticipantData.participantId
    );
    
    // NÃO atualizar form.selectedClients aqui - isso será feito ao salvar pagamentos
    // Apenas atualizar participantsForm (estado temporário do modal de pagamentos)
    
    // Atualizar participantsForm (transferir dados de pagamento) - mantém posição
    // Se PaymentModal está aberto, atualizar estado local; senão atualizar contexto
    if (setParticipantsForm.updateLocal && setParticipantsForm.getLocal) {
      // PaymentModal está aberto - atualizar estado local
      const localParticipants = setParticipantsForm.getLocal();
      const oldIndex = localParticipants.findIndex(
        p => p.cliente_id === editParticipantData.participantId
      );
      
      if (oldIndex >= 0) {
        const newParticipant = {
          cliente_id: cliente.id,
          nome: cliente.nome,
          codigo: cliente.codigo,
          valor_cota: oldPaymentData?.valor_cota || '',
          status_pagamento: oldPaymentData?.status_pagamento || 'Pendente',
          finalizadora_id: oldPaymentData?.finalizadora_id || 
            (payMethods[0]?.id ? String(payMethods[0].id) : null)
        };
        
        const newList = [...localParticipants];
        newList[oldIndex] = newParticipant;
        setParticipantsForm.updateLocal(newList);
      }
    } else {
      // PaymentModal não está aberto - atualizar contexto normalmente
      setParticipantsForm(prev => {
        const oldIndex = prev.findIndex(
          p => p.cliente_id === editParticipantData.participantId
        );
        
        if (oldIndex === -1) return prev;
        
        const newParticipant = {
          cliente_id: cliente.id,
          nome: cliente.nome,
          codigo: cliente.codigo,
          valor_cota: oldPaymentData?.valor_cota || '',
          status_pagamento: oldPaymentData?.status_pagamento || 'Pendente',
          finalizadora_id: oldPaymentData?.finalizadora_id || 
            (payMethods[0]?.id ? String(payMethods[0].id) : null)
        };
        
        const newList = [...prev];
        newList[oldIndex] = newParticipant;
        return newList;
      });
    }
    
    // Proteger modal de pagamentos
    protectPaymentModal(1500); // Protege por 1.5 segundos
    
    // Fechar modal de edição
    closeEditParticipantModal();
    setEditParticipantSearch('');
    
    // Toast de sucesso
    setTimeout(() => {
      toast({
        title: 'Participante substituído',
        description: `${editParticipantData.participantName} foi substituído por ${cliente.nome}`,
      });
    }, 100);
  };
  
  // Reset quando modal abre
  useEffect(() => {
    if (isEditParticipantModalOpen) {
      setEditParticipantSearch('');
      setEditParticipantLoading(false);
    }
  }, [isEditParticipantModalOpen]);
  
  if (!isEditParticipantModalOpen) return null;
  
  const query = editParticipantSearch.trim().toLowerCase();
  const filteredBase = (localCustomers || [])
    .filter(c => {
      if (!query) return true;
      return String(c?.nome || '').toLowerCase().includes(query);
    });

  // Separar cliente consumidor dos demais
  const clienteConsumidor = filteredBase.find(c => c?.is_consumidor_final === true);
  const clientesNormais = filteredBase.filter(c => c?.is_consumidor_final !== true);

  // Ordenar clientes normais por código
  const sortedNormais = clientesNormais.sort((a, b) => {
    const codigoA = Number(a?.codigo);
    const codigoB = Number(b?.codigo);
    if (Number.isFinite(codigoA) && Number.isFinite(codigoB)) {
      return codigoA - codigoB;
    }
    return String(a?.nome || '').localeCompare(String(b?.nome || ''));
  });

  // Cliente consumidor sempre no topo
  const filtered = clienteConsumidor ? [clienteConsumidor, ...sortedNormais] : sortedNormais;
  
  return (
    <Dialog
      open={isEditParticipantModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeEditParticipantModal();
          setEditParticipantSearch('');
        }
      }}
      modal={true}
    >
      <DialogContent 
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => {
          console.log('👆 [EditParticipantModal] onPointerDownOutside - prevenindo');
          e.preventDefault();
          e.stopPropagation();
        }}
        onInteractOutside={(e) => {
          console.log('👆 [EditParticipantModal] onInteractOutside - prevenindo');
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle>Trocar Participante</DialogTitle>
          <DialogDescription>
            Substituindo: <strong>{editParticipantData.participantName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Campo de busca */}
          <div>
            <Label htmlFor="edit-participant-search">Buscar cliente</Label>
            <Input
              id="edit-participant-search"
              type="text"
              placeholder="Digite o nome do cliente..."
              value={editParticipantSearch}
              onChange={(e) => setEditParticipantSearch(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>
          
          {/* Lista de clientes */}
          <div className="border border-border rounded-md max-h-[300px] overflow-y-auto">
            {editParticipantLoading ? (
              <div className="p-4 text-center text-sm text-text-muted">
                Carregando clientes...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-muted">
                {query ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </div>
            ) : (
              filtered.map((cliente) => {
                const isCurrentParticipant = cliente.id === editParticipantData.participantId;
                const isConsumidorFinal = cliente?.is_consumidor_final === true;
                
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 text-left transition-all",
                      "border-b border-border last:border-b-0",
                      "flex items-center gap-3",
                      isCurrentParticipant && "bg-brand/10 cursor-not-allowed opacity-60",
                      !isCurrentParticipant && isConsumidorFinal && "bg-gradient-to-r from-amber-500/5 to-transparent hover:from-amber-500/10 border-l-2 border-l-amber-500/40",
                      !isCurrentParticipant && !isConsumidorFinal && "hover:bg-surface-2"
                    )}
                    disabled={isCurrentParticipant}
                    onClick={() => handleSelectParticipant(cliente)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {cliente.codigo !== null && cliente.codigo !== undefined && (
                        <span className={cn(
                          "inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-colors",
                          isConsumidorFinal && "bg-amber-500/15 text-amber-300/90 ring-1 ring-amber-500/20",
                          !isConsumidorFinal && "bg-emerald-600/20 text-emerald-400"
                        )}>
                          #{cliente.codigo}
                        </span>
                      )}
                      <div className="flex-1 flex flex-col gap-1">
                        <span className={cn(
                          "font-medium",
                          isConsumidorFinal && "text-amber-100/90"
                        )}>
                          {cliente.nome}
                        </span>
                        {isConsumidorFinal && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/70 font-medium">
                            <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Cliente Padrão
                          </span>
                        )}
                      </div>
                    </div>
                    {isCurrentParticipant && (
                      <span className="text-xs text-brand font-medium">Atual</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="border border-white/10"
            onClick={() => {
              closeEditParticipantModal();
              setEditParticipantSearch('');
            }}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
