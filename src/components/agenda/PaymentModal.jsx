import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Edit, Search, X, Check, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAgenda } from '@/contexts/AgendaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toPng } from 'html-to-image';

// Helpers de moeda BRL
const maskBRL = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const val = (Number(digits) / 100).toFixed(2);
  const [ints, cents] = val.split('.');
  const withThousands = ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withThousands},${cents}`;
};

const parseBRL = (str) => {
  if (str == null || str === '') return NaN;
  const s = String(str).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

export default function PaymentModal({ 
  setIsModalOpen,
  setBookings,
  form,
  setForm,
  localCustomers,
  onOpenClientModal,
  onClientModalSuccess
}) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  // Context
  const {
    isPaymentModalOpen,
    closePaymentModal,
    editingBooking,
    participantsForm,
    setParticipantsForm,
    paymentTotal,
    setPaymentTotal,
    payMethods,
    openEditParticipantModal,
    protectPaymentModal
  } = useAgenda();
  
  // Estados locais
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentHiddenIndexes, setPaymentHiddenIndexes] = useState([]);
  const [paymentSelectedId, setPaymentSelectedId] = useState(null);
  const [paymentWarning, setPaymentWarning] = useState(null);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [addParticipantSearch, setAddParticipantSearch] = useState('');
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  
  // Estado local para participantes (não usar o do contexto diretamente)
  const [localParticipantsForm, setLocalParticipantsForm] = useState([]);
  
  // Refs
  const paymentSearchRef = useRef(null);
  const initializedRef = useRef(false);
  
  // Helper para pegar finalizadora padrão (menor código)
  const getDefaultPayMethod = useCallback(() => {
    if (!payMethods || payMethods.length === 0) return null;
    // Ordenar por código e pegar o primeiro
    const sorted = [...payMethods].sort((a, b) => {
      const codigoA = Number(a.codigo_interno || 999999);
      const codigoB = Number(b.codigo_interno || 999999);
      return codigoA - codigoB;
    });
    return sorted[0];
  }, [payMethods]);
  
  // Computações
  const participantsCount = useMemo(() => {
    const allParticipants = localParticipantsForm || [];
    const hidden = paymentHiddenIndexes || [];
    return allParticipants.filter((_, idx) => !hidden.includes(idx)).length;
  }, [localParticipantsForm, paymentHiddenIndexes]);
  
  const paymentSummary = useMemo(() => {
    const allParticipants = localParticipantsForm || [];
    const hidden = paymentHiddenIndexes || [];
    const visible = allParticipants.filter((_, idx) => !hidden.includes(idx));
    const totalTarget = parseBRL(paymentTotal);
    
    let totalAssigned = 0;
    let paid = 0;
    let pending = 0;
    let temTaxaAplicada = false;
    
    visible.forEach(pf => {
      const valor = parseBRL(pf?.valor_cota);
      if (Number.isFinite(valor)) totalAssigned += valor;
      
      const status = pf?.status_pagamento || 'Pendente';
      if (status === 'Pago') paid++;
      else pending++;
      
      // Verificar se algum participante tem taxa aplicada
      if (pf?.aplicar_taxa === true) {
        temTaxaAplicada = true;
      }
    });
    
    // Se houver taxa aplicada, não mostrar diferença
    const diff = temTaxaAplicada ? 0 : (Number.isFinite(totalTarget) ? (totalAssigned - totalTarget) : 0);
    
    return { totalTarget, totalAssigned, diff, paid, pending, temTaxaAplicada };
  }, [localParticipantsForm, paymentHiddenIndexes, paymentTotal]);
  
  // Funções
  const splitEqually = () => {
    const total = parseBRL(paymentTotal);
    if (!Number.isFinite(total) || participantsCount === 0) return;
    
    const perPerson = total / participantsCount;
    const masked = maskBRL(String(perPerson.toFixed(2)));
    
    const hidden = paymentHiddenIndexes || [];
    
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((p, idx) => {
        if (!hidden.includes(idx)) {
          newList[idx] = { ...newList[idx], valor_cota: masked, status_pagamento: 'Pago' };
        }
      });
      return newList;
    });
  };
  
  const zeroAllValues = () => {
    const hidden = paymentHiddenIndexes || [];
    
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((p, idx) => {
        if (!hidden.includes(idx)) {
          newList[idx] = { 
            ...newList[idx], 
            valor_cota: '', 
            status_pagamento: 'Pendente',
            aplicar_taxa: false  // Desmarcar checkbox ao zerar
          };
        }
      });
      return newList;
    });
  };
  
  const aplicarTaxaEmTodos = () => {
    const hidden = paymentHiddenIndexes || [];
    
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((p, idx) => {
        if (!hidden.includes(idx)) {
          const valorAtual = parseBRL(p.valor_cota);
          const temValor = valorAtual > 0;
          
          // Só aplicar taxa se tiver valor e finalizadora com taxa
          if (temValor) {
            const finalizadora = payMethods.find(m => String(m.id) === String(p.finalizadora_id));
            const taxa = Number(finalizadora?.taxa_percentual || 0);
            
            if (taxa > 0 && !p.aplicar_taxa) {
              // Aplicar taxa: valor atual * (1 + taxa/100)
              const novoValor = valorAtual * (1 + taxa / 100);
              newList[idx] = { 
                ...newList[idx], 
                aplicar_taxa: true,
                valor_cota: maskBRL(novoValor.toFixed(2))
              };
            }
          }
        }
      });
      return newList;
    });
  };
  
  const handleEditParticipant = (participantId, participantName) => {
    console.log('🔄 [PaymentModal] Abrindo modal de edição:', { participantId, participantName });
    openEditParticipantModal(participantId, participantName);
  };
  
  const handleSavePayments = async () => {
    try {
      if (isSavingPayments) return;
      
      setIsSavingPayments(true);
      const agendamentoId = editingBooking?.id;
      const codigo = userProfile?.codigo_empresa;
      
      if (!agendamentoId || !codigo) {
        toast({ 
          title: 'Erro ao salvar pagamentos', 
          description: 'Agendamento ou empresa indisponível.', 
          variant: 'destructive' 
        });
        return;
      }
      
      // Usar localParticipantsForm como fonte da verdade (inclui substituições temporárias)
      // Filtrar participantes que não foram removidos (por índice)
      const hidden = paymentHiddenIndexes || [];
      const effectiveParticipants = (localParticipantsForm || []).filter(
        (p, idx) => !hidden.includes(idx)
      );
      
      // Calcular pendentes
      const pendingCount = effectiveParticipants.reduce((acc, p) => {
        const st = p.status_pagamento || 'Pendente';
        return acc + (st !== 'Pago' ? 1 : 0);
      }, 0);
      
      // Deletar registros anteriores
      const { error: delErr } = await supabase
        .from('agendamento_participantes')
        .delete()
        .eq('codigo_empresa', codigo)
        .eq('agendamento_id', agendamentoId);
        
      if (delErr) {
        console.error('[PaymentModal] Delete error', delErr);
        toast({ 
          title: 'Erro ao salvar pagamentos', 
          description: 'Falha ao limpar registros anteriores.', 
          variant: 'destructive' 
        });
        throw delErr;
      }
      
      // Preparar novos registros baseados em participantsForm (permite duplicados)
      const rows = effectiveParticipants.map((p) => {
        const valor = parseBRL(p.valor_cota);
        const defaultMethod = getDefaultPayMethod();
        const finId = p.finalizadora_id || (defaultMethod?.id ? String(defaultMethod.id) : null);
        
        return {
          codigo_empresa: codigo,
          agendamento_id: agendamentoId,
          cliente_id: p.cliente_id,
          nome: p.nome,
          valor_cota: Number.isFinite(valor) ? valor : 0,
          status_pagamento: p.status_pagamento || 'Pendente',
          finalizadora_id: finId,
          aplicar_taxa: p.aplicar_taxa || false,
        };
      });
      
      // Inserir novos registros
      if (rows.length > 0) {
        const { data, error } = await supabase
          .from('agendamento_participantes')
          .insert(rows)
          .select();
          
        if (error) {
          toast({ 
            title: 'Erro ao salvar pagamentos', 
            description: 'Falha ao inserir pagamentos.', 
            variant: 'destructive' 
          });
          throw error;
        }
      }
      
      // Atualizar form.selectedClients com base em participantsForm (inclui substituições)
      const newSelectedClients = effectiveParticipants.map(p => ({
        id: p.cliente_id,
        nome: p.nome,
        codigo: p.codigo || null
      }));
      
      const primary = newSelectedClients[0] || null;
      const clientesArr = newSelectedClients.map(c => c?.nome).filter(Boolean);
      
      // Atualizar agendamento no banco
      await supabase
        .from('agendamentos')
        .update({
          cliente_id: primary?.id ?? null,
          clientes: clientesArr,
        })
        .eq('codigo_empresa', codigo)
        .eq('id', agendamentoId);
        
      // Atualizar form.selectedClients (persiste as mudanças)
      setForm(f => ({ ...f, selectedClients: newSelectedClients }));
      
      // Atualizar bookings
      setBookings(prev => prev.map(b => b.id === agendamentoId ? {
        ...b,
        customer: primary?.nome || b.customer,
        cliente_id: primary?.id ?? null,
        clientes: clientesArr,
      } : b));
      
      setPaymentHiddenIndexes([]);
      
      // Toast de sucesso
      if (pendingCount > 0) {
        toast({
          title: 'Pagamentos salvos',
          description: `Pendentes: ${pendingCount}`,
          variant: 'warning',
        });
      } else {
        toast({ title: 'Pagamentos salvos', variant: 'success' });
      }
      
      setPaymentWarning(null);
      // Atualizar contexto com os dados salvos
      setParticipantsForm(effectiveParticipants);
      closePaymentModal();
      setIsModalOpen(false);
      
    } catch (e) {
      toast({ 
        title: 'Erro ao salvar pagamentos', 
        description: 'Tente novamente.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSavingPayments(false);
    }
  };
  
  // Atalhos de teclado para modal de pagamentos
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPaymentModalOpen) return;
      
      // NÃO processar atalhos se modal de adicionar participante estiver aberto
      if (isAddParticipantOpen) return;
      
      // ESC para fechar modal
      if (e.key === 'Escape') {
        e.preventDefault();
        closePaymentModal();
      }
      
      // Enter para salvar (apenas se não estiver em um input de texto ou textarea)
      if (e.key === 'Enter' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        if (!isSavingPayments) {
          handleSavePayments();
        }
      }
      
      // F8 para dividir igualmente
      if (e.key === 'F8') {
        e.preventDefault();
        if (paymentTotal && participantsCount > 0) {
          splitEqually();
        }
      }
      
      // F9 para aplicar taxas
      if (e.key === 'F9') {
        e.preventDefault();
        if (participantsCount > 0) {
          aplicarTaxaEmTodos();
        }
      }
      
      // F10 para zerar valores
      if (e.key === 'F10') {
        e.preventDefault();
        if (participantsCount > 0) {
          zeroAllValues();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentModalOpen, isAddParticipantOpen, paymentTotal, participantsCount, splitEqually, aplicarTaxaEmTodos, zeroAllValues, isSavingPayments, handleSavePayments, closePaymentModal]);
  
  // Sincronizar estado local com contexto ao abrir modal
  useEffect(() => {
    if (isPaymentModalOpen) {
      // Só inicializar na PRIMEIRA abertura do modal
      if (!initializedRef.current) {
        // Pegar finalizadora padrão uma vez
        const defaultMethod = getDefaultPayMethod();
        const defaultFinalizadoraId = defaultMethod?.id ? String(defaultMethod.id) : null;
        const defaultAplicarTaxa = Number(defaultMethod?.taxa_percentual || 0) > 0;
        
        // Inicializar estado local a partir do contexto (ou form.selectedClients se vazio)
        const sourceData = (participantsForm && participantsForm.length > 0) 
          ? participantsForm 
          : (form?.selectedClients || []).map(c => {
              let codigo = c.codigo;
              if (!codigo && localCustomers && Array.isArray(localCustomers)) {
                const clienteCompleto = localCustomers.find(lc => lc.id === c.id);
                codigo = clienteCompleto?.codigo || null;
              }
              return {
                cliente_id: c.id,
                nome: c.nome,
                codigo: codigo,
                valor_cota: '',
                status_pagamento: 'Pendente',
                finalizadora_id: defaultFinalizadoraId,
                aplicar_taxa: defaultAplicarTaxa
              };
            });
        
        // Atualizar códigos faltantes e garantir finalizadora padrão
        const withCodes = sourceData.map(p => {
          let codigo = p.codigo;
          if (!codigo && localCustomers && Array.isArray(localCustomers)) {
            const clienteCompleto = localCustomers.find(lc => lc.id === p.cliente_id);
            codigo = clienteCompleto?.codigo || null;
          }
          
          // Garantir que tenha finalizadora_id (usar padrão se vazio)
          let finalizadoraId = p.finalizadora_id;
          if (!finalizadoraId) {
            const defaultMethod = getDefaultPayMethod();
            finalizadoraId = defaultMethod?.id ? String(defaultMethod.id) : null;
          }
          
          return { 
            ...p, 
            codigo: codigo || p.codigo,
            finalizadora_id: finalizadoraId
          };
        });
        
        setLocalParticipantsForm(withCodes);
        initializedRef.current = true;
      }
    } else {
      // Ao fechar, resetar estado local E flag de inicialização
      setPaymentSearch('');
      setPaymentWarning(null);
      setPaymentHiddenIndexes([]);
      setLocalParticipantsForm([]);
      initializedRef.current = false;
    }
  }, [isPaymentModalOpen, payMethods, getDefaultPayMethod, participantsForm, form?.selectedClients, localCustomers]);
  
  // Callback para EditParticipantModal atualizar participantes localmente
  const handleParticipantChange = useCallback((updatedParticipants) => {
    setLocalParticipantsForm(updatedParticipants);
  }, []);
  
  // Expor callback via contexto quando modal está aberto
  useEffect(() => {
    if (isPaymentModalOpen) {
      // Armazenar callback no contexto para EditParticipantModal usar
      setParticipantsForm.updateLocal = handleParticipantChange;
      setParticipantsForm.getLocal = () => localParticipantsForm;
    }
    return () => {
      if (setParticipantsForm.updateLocal) {
        delete setParticipantsForm.updateLocal;
        delete setParticipantsForm.getLocal;
      }
    };
  }, [isPaymentModalOpen, handleParticipantChange, localParticipantsForm]);
  
  // Limpar seleções quando o modal de adicionar participante fecha
  useEffect(() => {
    if (!isAddParticipantOpen) {
      setSelectedParticipants([]);
      setAddParticipantSearch('');
    }
  }, [isAddParticipantOpen]);
  
  // Atalhos de teclado para modal de adicionar participante
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isAddParticipantOpen) return;
      
      // ESC para fechar modal
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAddParticipantOpen(false);
        setAddParticipantSearch('');
        setSelectedParticipants([]);
      }
      
      // Enter para adicionar participantes (apenas se não estiver em um input)
      if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && selectedParticipants.length > 0) {
        e.preventDefault();
        // Adicionar todos os participantes selecionados
        const newParticipants = selectedParticipants.map(cliente => ({
          cliente_id: cliente.id,
          nome: cliente.nome,
          codigo: cliente.codigo,
          valor_cota: '',
          status_pagamento: 'Pendente',
          finalizadora_id: (() => {
            const defaultMethod = getDefaultPayMethod();
            return defaultMethod?.id ? String(defaultMethod.id) : null;
          })(),
          aplicar_taxa: (() => {
            const defaultMethod = getDefaultPayMethod();
            return Number(defaultMethod?.taxa_percentual || 0) > 0;
          })()
        }));
        
        setLocalParticipantsForm(prev => [...prev, ...newParticipants]);
        
        toast({
          title: 'Participantes adicionados',
          description: `${selectedParticipants.length} ${selectedParticipants.length === 1 ? 'participante foi adicionado' : 'participantes foram adicionados'} aos pagamentos.`,
          variant: 'success',
        });
        
        setIsAddParticipantOpen(false);
        setSelectedParticipants([]);
        setAddParticipantSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddParticipantOpen, selectedParticipants, getDefaultPayMethod, setLocalParticipantsForm, toast, setAddParticipantSearch, setIsAddParticipantOpen, setSelectedParticipants]);
  
  // Ref para o elemento que será convertido em imagem
  const relatorioRef = useRef(null);

  // Função para baixar relatório como imagem
  const baixarRelatorioImagem = async () => {
    try {
      if (!relatorioRef.current) {
        throw new Error('Elemento do relatório não encontrado');
      }

      toast({
        title: 'Gerando imagem...',
        description: 'Aguarde um momento.',
      });

      // Tornar o elemento visível temporariamente
      const elemento = relatorioRef.current;
      elemento.style.left = '0';
      elemento.style.top = '0';
      elemento.style.zIndex = '9999';

      // Aguardar um pouco para garantir que o elemento foi renderizado
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(elemento, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#1a1a1a',
      });

      // Ocultar o elemento novamente
      elemento.style.left = '-9999px';
      elemento.style.top = '-9999px';
      elemento.style.zIndex = '-1';

      // Criar link para download
      const link = document.createElement('a');
      link.download = `relatorio-pagamento-${editingBooking?.code || 'agendamento'}.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: 'Imagem baixada!',
        description: 'O relatório foi salvo como imagem.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      toast({
        title: 'Erro ao gerar imagem',
        description: error?.message || 'Não foi possível gerar a imagem.',
        variant: 'destructive'
      });
    }
  };
  
  if (!isPaymentModalOpen) return null;
  
  return (
    <>
    <Dialog 
      open={isPaymentModalOpen} 
      onOpenChange={(open) => {
        if (!open) {
          // Ao cancelar, mostrar toast e fechar - o estado local será descartado
          toast({
            title: 'Alterações não salvas',
            description: 'As modificações feitas não foram salvas.',
            variant: 'default',
          });
          closePaymentModal();
        }
      }}
    >
      <DialogContent
        forceMount
        className="w-[95vw] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => { 
          e.preventDefault();
          e.stopPropagation();
        }}
        onEscapeKeyDown={(e) => { 
          e.preventDefault();
        }}
      >
        <DialogHeader className="relative pb-4">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <DialogTitle>Registrar pagamento</DialogTitle>
              <DialogDescription>
                Gerencie valores, divisão e status de pagamento dos participantes.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={baixarRelatorioImagem}
              className="flex-shrink-0 gap-2 w-full sm:w-auto mt-2 sm:mt-0"
              title="Baixar relatório como imagem"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Relatório</span>
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-6">
          {/* Total e ações - Versão Mobile */}
          <div className="sm:hidden space-y-2 max-w-md mx-auto">
            {/* Cards compactos lado a lado */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 min-w-0">
                <div className="text-[10px] text-emerald-300/80 mb-1 truncate">Total</div>
                <div className="text-sm font-bold text-emerald-400 truncate">{maskBRL(paymentTotal) || 'R$ 0,00'}</div>
              </div>
              <div className={`p-2 rounded-lg border min-w-0 ${
                paymentSummary.diff === 0 
                  ? 'bg-emerald-600/10 border-emerald-500/30' 
                  : paymentSummary.diff > 0 
                    ? 'bg-amber-600/10 border-amber-500/30'
                    : 'bg-rose-600/10 border-rose-500/30'
              }`}>
                <div className={`text-[10px] mb-1 truncate ${
                  paymentSummary.diff === 0 ? 'text-emerald-300/80' : paymentSummary.diff > 0 ? 'text-amber-300/80' : 'text-rose-300/80'
                }`}>Diferença</div>
                <div className={`text-sm font-bold truncate ${
                  paymentSummary.diff === 0 ? 'text-emerald-400' : paymentSummary.diff > 0 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {paymentSummary.diff > 0 ? '+' : ''}{maskBRL(String(Math.abs(paymentSummary.diff).toFixed(2)))}
                </div>
              </div>
            </div>
            
            {/* Info compacta */}
            <div className="flex gap-1.5 text-xs justify-center">
              <span className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 whitespace-nowrap">
                <span className="text-text-secondary">Participantes:</span> <strong>{participantsCount}</strong>
              </span>
              <span className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 whitespace-nowrap">
                <span className="text-text-secondary">Atribuído:</span> <strong>R$ {paymentSummary.totalAssigned.toFixed(2)}</strong>
              </span>
              <span className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 whitespace-nowrap">
                <span className="text-text-secondary">Alvo:</span> <strong>R$ {paymentSummary.totalTarget.toFixed(2)}</strong>
              </span>
            </div>
            
            {/* Botões compactos */}
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                size="sm"
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-8 px-3 flex-shrink-0"
                onClick={splitEqually}
                disabled={!paymentTotal || participantsCount === 0}
              >
                {(() => {
                  const total = parseBRL(paymentTotal);
                  if (Number.isFinite(total) && participantsCount > 0) {
                    const perPerson = total / participantsCount;
                    return `Dividir (${maskBRL(String(perPerson.toFixed(2)))})`;
                  }
                  return 'Dividir';
                })()}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                className="border border-white/10 text-xs h-8 px-4 flex-shrink-0" 
                onClick={zeroAllValues} 
                disabled={participantsCount === 0}
              >
                Zerar
              </Button>
            </div>
          </div>
          
          {/* Versão Desktop (mantém original) */}
          <div className="hidden sm:block p-4 rounded-lg border border-border bg-gradient-to-br from-surface-2 to-surface shadow-md">
            <div className="flex flex-col md:flex-row md:items-start gap-3 w-full">
              {/* Valor total e diferença */}
              <div className="flex flex-row gap-3">
                <div className="space-y-1">
                  <Label className="font-bold text-base text-white">Valor total a receber</Label>
                  <div className="w-[180px] px-3 py-2 rounded-md bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border-2 border-emerald-500/40 shadow-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-emerald-400">
                      {maskBRL(paymentTotal) || 'R$ 0,00'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="font-bold text-base text-white">Diferença</Label>
                  <div className={`w-[180px] px-3 py-2 rounded-md border-2 shadow-lg flex items-center justify-center ${
                    paymentSummary.diff === 0 
                      ? 'bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border-emerald-500/40' 
                      : paymentSummary.diff > 0 
                        ? 'bg-gradient-to-br from-amber-600/20 to-amber-700/20 border-amber-500/40'
                        : 'bg-gradient-to-br from-rose-600/20 to-rose-700/20 border-rose-500/40'
                  }`}>
                    <span className={`text-xl font-bold ${
                      paymentSummary.diff === 0 
                        ? 'text-emerald-400' 
                        : paymentSummary.diff > 0 
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}>
                      {paymentSummary.diff > 0 ? '+' : ''}{maskBRL(String(Math.abs(paymentSummary.diff).toFixed(2)))}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Sumário e Botões */}
              <div className="ml-auto flex flex-col gap-3 items-end">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                    <span className="text-text-secondary">Participantes:</span>
                    <strong>{participantsCount}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                    <span className="text-text-secondary">Atribuído:</span>
                    <strong>R$ {paymentSummary.totalAssigned.toFixed(2)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                    <span className="text-text-secondary">Alvo:</span>
                    <strong>R$ {paymentSummary.totalTarget.toFixed(2)}</strong>
                  </span>
                </div>
                
                {/* Botões de ação */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="bg-sky-600 hover:bg-sky-500 text-white flex-shrink-0"
                    onClick={splitEqually}
                    disabled={!paymentTotal || participantsCount === 0}
                  >
                    {(() => {
                      const total = parseBRL(paymentTotal);
                      if (Number.isFinite(total) && participantsCount > 0) {
                        const perPerson = total / participantsCount;
                        return (
                          <>
                            Dividir igualmente ({maskBRL(String(perPerson.toFixed(2)))} cada)
                            <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-sky-700/50 rounded border border-sky-500/30">F8</kbd>
                          </>
                        );
                      }
                      return (
                        <>
                          Dividir igualmente
                          <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-sky-700/50 rounded border border-sky-500/30">F8</kbd>
                        </>
                      );
                    })()}
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 flex-1 sm:flex-initial whitespace-nowrap" 
                      onClick={aplicarTaxaEmTodos} 
                      disabled={participantsCount === 0}
                    >
                      Aplicar taxas
                      <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-amber-700/50 rounded border border-amber-500/30">F9</kbd>
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      className="border border-white/10 flex-1 sm:flex-initial" 
                      onClick={zeroAllValues} 
                      disabled={participantsCount === 0}
                    >
                      Zerar
                      <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-white/10 rounded border border-white/20">F10</kbd>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Lista de participantes */}
          {(form.selectedClients || []).length === 0 ? (
            <div className="text-xs text-text-muted italic">
              Nenhum participante neste agendamento. Adicione participantes no campo "Clientes" do modal principal.
            </div>
          ) : (
            <>
              {/* Busca e ações */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative w-full max-w-[320px]">
                  <Input
                    ref={paymentSearchRef}
                    type="text"
                    placeholder="Buscar participante..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-400 hover:text-amber-300"
                    onClick={() => {
                      setPaymentSearch('');
                      paymentSearchRef.current?.focus();
                    }}
                  >
                    limpar
                  </button>
                </div>
                
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-400 text-black shadow-md"
                    onClick={() => setIsAddParticipantOpen(true)}
                  >
                    Adicionar participante +
                  </Button>
                </div>
              </div>
              
              {/* Warning */}
              {paymentWarning?.type === 'pending' && (
                <div role="alert" className="mb-2 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <strong>Atenção:</strong> Existem <strong>{paymentWarning.count}</strong> participante(s) com status <strong>Pendente</strong>.
                  </div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-600/40"
                    onClick={() => setPaymentWarning(null)}
                  >
                    Entendi
                  </button>
                </div>
              )}
              
              {/* Tabela de participantes */}
              <div className="border border-border rounded-md overflow-hidden">
                <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                  {(() => {
                    const q = paymentSearch.trim().toLowerCase();
                    const hidden = paymentHiddenIndexes || [];
                    // Usar localParticipantsForm como fonte (inclui substituições temporárias e duplicados)
                    // Mapear com índice original para manter rastreamento
                    const withIndexes = (localParticipantsForm || []).map((p, idx) => ({ ...p, _originalIndex: idx }));
                    const filtered = withIndexes
                      .filter((p) => !hidden.includes(p._originalIndex))
                      .filter((p) => !q || String(p?.nome || '').toLowerCase().includes(q));
                    
                    if (filtered.length === 0) {
                      return (
                        <div className="px-3 py-4 text-sm text-text-muted">
                          Nenhum participante com esse nome
                        </div>
                      );
                    }
                    
                    return filtered.map((pf) => {
                      // Usar índice original como key para permitir duplicados
                      const uniqueKey = `participant-${pf._originalIndex}`;
                      const originalIdx = pf._originalIndex;
                      
                      return (
                        <div key={uniqueKey} className="p-2 sm:p-3 border-b last:border-b-0">
                          {/* Versão Mobile */}
                          <div className="sm:hidden space-y-2">
                            {/* Header com nome e ações */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {pf.codigo && (
                                  <span className={`text-xs font-bold rounded px-1.5 py-0.5 shrink-0 ${
                                    pf.status_pagamento === 'Pago' 
                                      ? 'text-emerald-400 bg-emerald-600/20 border border-emerald-700/40' 
                                      : 'text-amber-400 bg-amber-600/20 border border-amber-700/40'
                                  }`}>
                                    #{pf.codigo}
                                  </span>
                                )}
                                <span className="font-medium text-sm truncate">{pf.nome}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  className="p-1 text-text-secondary hover:text-brand transition-colors"
                                  onClick={() => handleEditParticipant(pf.cliente_id, pf.nome)}
                                  title="Trocar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-400 h-6 w-6 p-0"
                                  onClick={() => {
                                    setPaymentHiddenIndexes(prev => [...prev, originalIdx]);
                                  }}
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                            
                            {/* Campos compactos */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <Label className="text-[10px] text-text-muted">Método</Label>
                                <Select
                                  value={String(pf.finalizadora_id || '')}
                                  onValueChange={(val) => {
                                    setLocalParticipantsForm(prev => {
                                      const list = [...prev];
                                      if (originalIdx >= 0 && originalIdx < list.length) {
                                        const finalizadora = payMethods.find(m => String(m.id) === String(val));
                                        const temTaxa = Number(finalizadora?.taxa_percentual || 0) > 0;
                                        list[originalIdx] = { 
                                          ...list[originalIdx], 
                                          finalizadora_id: val,
                                          aplicar_taxa: temTaxa ? (list[originalIdx].aplicar_taxa ?? true) : false
                                        };
                                      }
                                      return list;
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Método" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {payMethods.map((m) => (
                                      <SelectItem key={m.id} value={String(m.id)}>
                                        {m.nome || m.tipo || 'Outros'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                {/* Checkbox de Taxa - Mobile */}
                                {(() => {
                                  const finalizadora = payMethods.find(m => String(m.id) === String(pf.finalizadora_id));
                                  const taxa = Number(finalizadora?.taxa_percentual || 0);
                                  if (taxa <= 0) return <div className="h-4 mt-1"></div>; // Espaço vazio para manter layout
                                  
                                  const valorAtual = parseBRL(pf.valor_cota);
                                  const temValor = valorAtual > 0;
                                  
                                  return (
                                    <label 
                                      className={`flex items-center gap-1 mt-1 text-[10px] ${
                                        temValor ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                      }`} 
                                      title={temValor ? `Taxa de ${taxa.toFixed(2)}%` : 'Informe o valor primeiro'}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!pf.aplicar_taxa}
                                        disabled={!temValor}
                                        onChange={(e) => {
                                          if (!temValor) {
                                            toast({
                                              title: 'Valor necessário',
                                              description: 'Informe o valor antes de aplicar a taxa.',
                                              variant: 'destructive'
                                            });
                                            return;
                                          }
                                          
                                          setLocalParticipantsForm(prev => {
                                            const list = [...prev];
                                            if (originalIdx >= 0 && originalIdx < list.length) {
                                              const aplicar = e.target.checked;
                                              let novoValor = valorAtual;
                                              
                                              if (aplicar) {
                                                // Aplicar taxa: valor atual * (1 + taxa/100)
                                                novoValor = valorAtual * (1 + taxa / 100);
                                              } else {
                                                // Remover taxa: valor atual / (1 + taxa/100)
                                                novoValor = valorAtual / (1 + taxa / 100);
                                              }
                                              
                                              list[originalIdx] = { 
                                                ...list[originalIdx], 
                                                aplicar_taxa: aplicar,
                                                valor_cota: maskBRL(novoValor.toFixed(2))
                                              };
                                            }
                                            return list;
                                          });
                                        }}
                                        className={`w-3 h-3 rounded border border-amber-500 checked:bg-amber-500 checked:border-amber-500 ${
                                          temValor ? 'cursor-pointer' : 'cursor-not-allowed'
                                        }`}
                                        style={{ accentColor: '#f59e0b' }}
                                      />
                                      <span className="text-amber-500 font-medium">Taxa ({taxa.toFixed(2)}%)</span>
                                    </label>
                                  );
                                })()}
                              </div>
                              <div className="isolate">
                                <Label className="text-[10px] text-text-muted">Valor</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="R$ 0,00"
                                  value={maskBRL(pf.valor_cota)}
                                  onChange={(e) => {
                                    const masked = maskBRL(e.target.value);
                                    const amount = parseBRL(masked);
                                    const autoStatus = (Number.isFinite(amount) && amount > 0) ? 'Pago' : 'Pendente';
                                    
                                    setLocalParticipantsForm(prev => {
                                      const list = [...prev];
                                      if (originalIdx >= 0 && originalIdx < list.length) {
                                        list[originalIdx] = { 
                                          ...list[originalIdx], 
                                          valor_cota: masked, 
                                          status_pagamento: autoStatus,
                                          // Desmarcar taxa se valor for zerado
                                          aplicar_taxa: (masked === '' || amount <= 0) ? false : list[originalIdx].aplicar_taxa
                                        };
                                      }
                                      return list;
                                    });
                                  }}
                                  className="h-8 text-xs text-text-primary placeholder:text-slate-400 bg-surface-2 border-border hover:border-border-hover focus:border-brand focus:ring-2 focus:ring-brand/20"
                                />
                              </div>
                            </div>
                            
                            {/* Status */}
                            <div className="flex justify-end">
                              <span
                                className={`inline-flex items-center justify-center px-3 py-0.5 rounded text-xs font-medium border ${
                                  pf.status_pagamento === 'Pago' ? 
                                  'bg-emerald-600/20 text-emerald-400 border-emerald-700/40' : 
                                  'bg-amber-600/20 text-amber-400 border-amber-700/40'
                                }`}
                              >
                                {pf.status_pagamento === 'Pago' ? 'Pago' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Versão Desktop */}
                          <div className="hidden sm:flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {pf.codigo && (
                                  <span className={`text-sm font-bold rounded-md px-2.5 py-1 shadow-sm ${
                                    pf.status_pagamento === 'Pago' 
                                      ? 'text-emerald-400 bg-emerald-600/20 border border-emerald-700/40' 
                                      : 'text-amber-400 bg-amber-600/20 border border-amber-700/40'
                                  }`}>
                                    #{pf.codigo}
                                  </span>
                                )}
                                <span className="font-medium text-base">{pf.nome}</span>
                                <button
                                  type="button"
                                  className="p-1 text-text-secondary hover:text-brand transition-colors"
                                  onClick={() => handleEditParticipant(pf.cliente_id, pf.nome)}
                                  title="Trocar participante"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Container isolado para Finalizadora + Checkbox */}
                            <div className="flex items-center gap-2 min-w-[240px] isolate">
                              <Select
                                value={String(pf.finalizadora_id || '')}
                                onValueChange={(val) => {
                                  setLocalParticipantsForm(prev => {
                                    const list = [...prev];
                                    // Usar o índice original para atualizar
                                    if (originalIdx >= 0 && originalIdx < list.length) {
                                      const finalizadora = payMethods.find(m => String(m.id) === String(val));
                                      const temTaxa = Number(finalizadora?.taxa_percentual || 0) > 0;
                                      list[originalIdx] = { 
                                        ...list[originalIdx], 
                                        finalizadora_id: val,
                                        aplicar_taxa: temTaxa ? (list[originalIdx].aplicar_taxa ?? true) : false
                                      };
                                    }
                                    return list;
                                  });
                                }}
                              >
                                <SelectTrigger className="w-[140px] flex-shrink-0">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {payMethods.map((m) => (
                                    <SelectItem key={m.id} value={String(m.id)}>
                                      {m.nome || m.tipo || 'Outros'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {/* Checkbox de Taxa */}
                              <div className="flex-1 min-w-0 isolate">
                                {(() => {
                                  const finalizadora = payMethods.find(m => String(m.id) === String(pf.finalizadora_id));
                                  const taxa = Number(finalizadora?.taxa_percentual || 0);
                                  if (taxa <= 0) return <div className="h-5"></div>; // Espaço vazio para manter layout
                                  
                                  const valorAtual = parseBRL(pf.valor_cota);
                                  const temValor = valorAtual > 0;
                                  
                                  return (
                                    <label 
                                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                                        temValor ? 'cursor-pointer hover:text-text-primary' : 'cursor-not-allowed opacity-50'
                                      }`} 
                                      title={temValor ? `Taxa de ${taxa.toFixed(2)}%` : 'Informe o valor primeiro'}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!pf.aplicar_taxa}
                                        disabled={!temValor}
                                        onChange={(e) => {
                                          if (!temValor) {
                                            toast({
                                              title: 'Valor necessário',
                                              description: 'Informe o valor antes de aplicar a taxa.',
                                              variant: 'destructive'
                                            });
                                            return;
                                          }
                                          
                                          setLocalParticipantsForm(prev => {
                                            const list = [...prev];
                                            if (originalIdx >= 0 && originalIdx < list.length) {
                                              const aplicar = e.target.checked;
                                              let novoValor = valorAtual;
                                              
                                              if (aplicar) {
                                                // Aplicar taxa: valor atual * (1 + taxa/100)
                                                novoValor = valorAtual * (1 + taxa / 100);
                                              } else {
                                                // Remover taxa: valor atual / (1 + taxa/100)
                                                novoValor = valorAtual / (1 + taxa / 100);
                                              }
                                              
                                              list[originalIdx] = { 
                                                ...list[originalIdx], 
                                                aplicar_taxa: aplicar,
                                                valor_cota: maskBRL(novoValor.toFixed(2))
                                              };
                                            }
                                            return list;
                                          });
                                        }}
                                        className={`w-4 h-4 rounded border-2 border-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 ${
                                          temValor ? 'cursor-pointer' : 'cursor-not-allowed'
                                        }`}
                                        style={{ accentColor: '#f59e0b' }}
                                      />
                                      <span className="whitespace-nowrap text-amber-500 font-medium">Taxa ({taxa.toFixed(2)}%)</span>
                                    </label>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            {/* Container isolado para Valor */}
                            <div className="isolate">
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="R$ 0,00"
                                value={maskBRL(pf.valor_cota)}
                                onChange={(e) => {
                                  const masked = maskBRL(e.target.value);
                                  const amount = parseBRL(masked);
                                  const autoStatus = (Number.isFinite(amount) && amount > 0) ? 'Pago' : 'Pendente';
                                  
                                  setLocalParticipantsForm(prev => {
                                    const list = [...prev];
                                    // Usar o índice original para atualizar
                                    if (originalIdx >= 0 && originalIdx < list.length) {
                                      list[originalIdx] = { 
                                        ...list[originalIdx], 
                                        valor_cota: masked, 
                                        status_pagamento: autoStatus,
                                        // Desmarcar taxa se valor for zerado
                                        aplicar_taxa: (masked === '' || amount <= 0) ? false : list[originalIdx].aplicar_taxa
                                      };
                                    }
                                    return list;
                                  });
                                }}
                                className="w-28 text-text-primary placeholder:text-slate-400 bg-surface-2 border-border hover:border-border-hover focus:border-brand focus:ring-2 focus:ring-brand/20"
                              />
                            </div>
                            
                            {/* Status */}
                            <span
                              className={`inline-flex items-center justify-center w-[90px] px-3 py-1 rounded text-sm font-medium border ${
                                pf.status_pagamento === 'Pago' ? 
                                'bg-emerald-600/20 text-emerald-400 border-emerald-700/40' : 
                                'bg-amber-600/20 text-amber-400 border-amber-700/40'
                              }`}
                            >
                              {pf.status_pagamento === 'Pago' ? 'Pago' : 'Pendente'}
                            </span>
                            
                            {/* Remover */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400"
                              onClick={() => {
                                // Adicionar índice original aos escondidos
                                setPaymentHiddenIndexes(prev => [...prev, originalIdx]);
                              }}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            type="button" 
            variant="ghost" 
            className="border border-white/10" 
            onClick={closePaymentModal}
          >
            Cancelar
            <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-white/10 rounded border border-white/20">Esc</kbd>
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            disabled={isSavingPayments}
            onClick={handleSavePayments}
          >
            Salvar Pagamentos
            <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-emerald-700/50 rounded border border-emerald-500/30">↵</kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Elemento oculto para gerar imagem do relatório */}
    <div 
      ref={relatorioRef}
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '1000px',
        padding: '60px',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ marginBottom: '50px', textAlign: 'center', borderBottom: '5px solid #4ade80', paddingBottom: '30px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#4ade80', margin: 0, letterSpacing: '2px' }}>
          RELATÓRIO DE PAGAMENTOS
        </h1>
      </div>

      <div style={{ marginBottom: '45px', backgroundColor: '#2a2a2a', padding: '35px', borderRadius: '12px', borderLeft: '6px solid #3b82f6' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', fontSize: '20px' }}>
          <div>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>📅 Data:</span>
            <strong style={{ marginLeft: '15px', fontSize: '24px' }}>
              {editingBooking?.start ? new Date(editingBooking.start).toLocaleDateString('pt-BR') : ''}
            </strong>
          </div>
          <div>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>🕐 Horário:</span>
            <strong style={{ marginLeft: '15px', fontSize: '24px' }}>
              {editingBooking?.start && editingBooking?.end 
                ? `${new Date(editingBooking.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${new Date(editingBooking.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </strong>
          </div>
          <div>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>🏐 Quadra:</span>
            <strong style={{ marginLeft: '15px', fontSize: '24px' }}>{editingBooking?.court || ''}</strong>
          </div>
          <div>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>🎯 Modalidade:</span>
            <strong style={{ marginLeft: '15px', fontSize: '24px' }}>{editingBooking?.modality || ''}</strong>
          </div>
          <div>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>📋 Código:</span>
            <strong style={{ marginLeft: '15px', fontSize: '24px' }}>#{editingBooking?.code || ''}</strong>
          </div>
          <div>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>💰 Valor Total:</span>
            <strong style={{ marginLeft: '15px', color: '#4ade80', fontSize: '26px' }}>R$ {maskBRL(paymentTotal || 0)}</strong>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '45px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#4ade80', marginBottom: '25px', borderBottom: '4px solid #374151', paddingBottom: '15px' }}>
          PARTICIPANTES
        </h2>
        {(localParticipantsForm || [])
          .filter((_, idx) => !(paymentHiddenIndexes || []).includes(idx))
          .map((p, index) => (
            <div key={index} style={{ marginBottom: '30px', backgroundColor: '#2a2a2a', padding: '28px', borderRadius: '12px', borderLeft: p.status_pagamento === 'Pago' ? '6px solid #4ade80' : '6px solid #fbbf24' }}>
              <div style={{ fontSize: '26px', fontWeight: 'bold', marginBottom: '15px', color: p.status_pagamento === 'Pago' ? '#4ade80' : '#fbbf24' }}>
                {index + 1}. {p.nome || 'Sem nome'}
              </div>
              <div style={{ fontSize: '20px', color: '#e5e7eb', lineHeight: '2.2' }}>
                <div><span style={{ color: '#9ca3af' }}>Código:</span> <strong style={{ marginLeft: '12px', fontSize: '22px' }}>{p.codigo || 'N/A'}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Valor:</span> <strong style={{ marginLeft: '12px', color: '#4ade80', fontSize: '22px' }}>R$ {maskBRL(p.valor_cota || 0)}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Status:</span> <strong style={{ marginLeft: '12px', fontSize: '22px' }}>{p.status_pagamento === 'Pago' ? '✅' : '⏳'} {p.status_pagamento || 'Pendente'}</strong></div>
                <div><span style={{ color: '#9ca3af' }}>Finalizadora:</span> <strong style={{ marginLeft: '12px', fontSize: '22px' }}>{payMethods.find(m => String(m.id) === String(p.finalizadora_id))?.nome || 'Não definido'}</strong></div>
                {p.pago_em && (
                  <div><span style={{ color: '#9ca3af' }}>Pago em:</span> <strong style={{ marginLeft: '12px', fontSize: '22px' }}>{new Date(p.pago_em).toLocaleString('pt-BR')}</strong></div>
                )}
              </div>
            </div>
          ))}
      </div>

      <div style={{ marginTop: '45px', textAlign: 'center', fontSize: '18px', color: '#9ca3af', borderTop: '4px solid #374151', paddingTop: '25px' }}>
        Gerado em: {new Date().toLocaleString('pt-BR')}
      </div>
    </div>
    
    {/* Dialog para adicionar participante */}
    <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Participante</DialogTitle>
          <DialogDescription>
            Selecione um cliente para adicionar aos pagamentos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Input de busca e botão +Novo */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={addParticipantSearch}
                onChange={(e) => setAddParticipantSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {addParticipantSearch && (
                <button
                  type="button"
                  onClick={() => setAddParticipantSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-black shadow-md"
              onClick={() => {
                if (onOpenClientModal) {
                  // Passar callback para reabrir o modal após salvar
                  onOpenClientModal(() => {
                    // Callback executado após salvar o cliente
                    setIsAddParticipantOpen(true);
                  });
                  setIsAddParticipantOpen(false);
                  setAddParticipantSearch('');
                }
              }}
            >
              +Novo
            </Button>
          </div>
          
          {/* Lista de clientes */}
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            {(() => {
              const searchLower = addParticipantSearch.toLowerCase().trim();
              const filtered = (localCustomers || [])
                .filter(cliente => {
                  if (!searchLower) return true;
                  const codigo = String(cliente.codigo || '');
                  const nome = (cliente.nome || '').toLowerCase();
                  return codigo.includes(searchLower) || nome.includes(searchLower);
                });

              // Separar cliente consumidor dos demais
              const clienteConsumidor = filtered.find(c => c?.is_consumidor_final === true);
              const clientesNormais = filtered.filter(c => c?.is_consumidor_final !== true);

              // Ordenar clientes normais por codigo
              const sortedNormais = clientesNormais.sort((a, b) => {
                const codigoA = a.codigo || 0;
                const codigoB = b.codigo || 0;
                return codigoA - codigoB;
              });

              // Cliente consumidor sempre no topo
              const finalList = clienteConsumidor ? [clienteConsumidor, ...sortedNormais] : sortedNormais;
              
              if (finalList.length === 0) {
                return (
                  <div className="p-8 text-center text-text-muted">
                    Nenhum cliente encontrado.
                  </div>
                );
              }
              
              return finalList.map((cliente) => {
                const isConsumidorFinal = cliente?.is_consumidor_final === true;
                const selectionCount = selectedParticipants.filter(p => p.id === cliente.id).length;
                
                return (
                  <div
                    key={cliente.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full px-4 py-3 text-left transition-all border-b border-border last:border-0 flex items-center gap-3 cursor-pointer ${
                      isConsumidorFinal
                        ? 'bg-gradient-to-r from-amber-500/5 to-transparent hover:from-amber-500/10 border-l-2 border-l-amber-500/40'
                        : selectionCount > 0 
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30' 
                          : 'hover:bg-surface-2'
                    }`}
                    onClick={() => {
                      // Adicionar timestamp único para permitir duplicados
                      const participantWithTimestamp = { ...cliente, timestamp: Date.now() };
                      setSelectedParticipants(prev => [...prev, participantWithTimestamp]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        // Adicionar timestamp único para permitir duplicados
                        const participantWithTimestamp = { ...cliente, timestamp: Date.now() };
                        setSelectedParticipants(prev => [...prev, participantWithTimestamp]);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {cliente.codigo !== null && cliente.codigo !== undefined && (
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-colors ${
                          isConsumidorFinal 
                            ? 'bg-amber-500/15 text-amber-300/90 ring-1 ring-amber-500/20' 
                            : 'bg-emerald-600/20 text-emerald-400'
                        }`}>
                          #{cliente.codigo}
                        </span>
                      )}
                      <div className="flex-1 flex flex-col gap-1">
                        <span className={`font-medium ${isConsumidorFinal ? 'text-amber-100/90' : ''}`}>
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
                    {selectionCount > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-base font-bold transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Remover uma ocorrência do cliente
                            setSelectedParticipants(prev => {
                              const index = prev.findIndex(p => p.id === cliente.id);
                              if (index !== -1) {
                                const newList = [...prev];
                                newList.splice(index, 1);
                                return newList;
                              }
                              return prev;
                            });
                          }}
                        >
                          -
                        </button>
                        <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-full bg-sky-600 text-white text-base font-bold">
                          {selectionCount}
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Adicionar uma ocorrência do cliente
                            const participantWithTimestamp = { ...cliente, timestamp: Date.now() };
                            setSelectedParticipants(prev => [...prev, participantWithTimestamp]);
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
        
        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-text-muted">
            {selectedParticipants.length > 0 && (
              <span className="font-medium">
                {selectedParticipants.length} {selectedParticipants.length === 1 ? 'participante selecionado' : 'participantes selecionados'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="border border-border"
              onClick={() => {
                setIsAddParticipantOpen(false);
                setAddParticipantSearch('');
                setSelectedParticipants([]);
              }}
            >
              Cancelar
              <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-white/10 rounded border border-white/20">Esc</kbd>
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={selectedParticipants.length === 0}
              onClick={() => {
                // Adicionar todos os participantes selecionados
                const newParticipants = selectedParticipants.map(cliente => ({
                  cliente_id: cliente.id,
                  nome: cliente.nome,
                  codigo: cliente.codigo,
                  valor_cota: '',
                  status_pagamento: 'Pendente',
                  finalizadora_id: (() => {
                    const defaultMethod = getDefaultPayMethod();
                    return defaultMethod?.id ? String(defaultMethod.id) : null;
                  })(),
                  aplicar_taxa: (() => {
                    const defaultMethod = getDefaultPayMethod();
                    return Number(defaultMethod?.taxa_percentual || 0) > 0;
                  })()
                }));
                
                setLocalParticipantsForm(prev => [...prev, ...newParticipants]);
                
                toast({
                  title: 'Participantes adicionados',
                  description: `${selectedParticipants.length} ${selectedParticipants.length === 1 ? 'participante foi adicionado' : 'participantes foram adicionados'} aos pagamentos.`,
                  variant: 'success',
                });
                
                setIsAddParticipantOpen(false);
                setAddParticipantSearch('');
                setSelectedParticipants([]);
              }}
            >
              Confirmar ({selectedParticipants.length})
              <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-emerald-700/50 rounded border border-emerald-500/30">↵</kbd>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
