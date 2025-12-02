import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Edit, Search, X, Check, Download, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAgenda } from '@/contexts/AgendaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/contexts/AlertsContext';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

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
  const { loadAlerts } = useAlerts();
  
  const { 
    isPaymentModalOpen, 
    closePaymentModal,
    editingBooking,
    paymentTotal,
    setPaymentTotal,
    participantsForm,
    setParticipantsForm,
    payMethods,
    openEditParticipantModal,
    protectPaymentModal,
    onParticipantReplacedRef,
    lastVisibilityChangeTime, // Timestamp de visibilidade
    isModalProtected // Verificar se modal está protegido
  } = useAgenda();
  
  // Expor protectPaymentModal globalmente para uso em callbacks (imediatamente)
  window.__protectPaymentModal = protectPaymentModal;
  
  // Garantir que o body permita scroll quando modal está aberto
  useEffect(() => {
    if (isPaymentModalOpen) {
      // Forçar body a permitir scroll
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    }
    return () => {
      // Limpar ao desmontar
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [isPaymentModalOpen]);
  
  // Estados locais
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentHiddenIndexes, setPaymentHiddenIndexes] = useState([]);
  const [paymentSelectedId, setPaymentSelectedId] = useState(null);
  const [paymentWarning, setPaymentWarning] = useState(null);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [addParticipantSearch, setAddParticipantSearch] = useState('');
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [editingNameIndex, setEditingNameIndex] = useState(null);
  const [focusedAddParticipantIndex, setFocusedAddParticipantIndex] = useState(0);
  
  // Estados para edição do valor total
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [editingTotalValue, setEditingTotalValue] = useState('');
  
  // Estado para animação de participantes recém-adicionados
  const [highlightedIndexes, setHighlightedIndexes] = useState([]);
  
  // Estado local para participantes (não usar o do contexto diretamente)
  const [localParticipantsForm, setLocalParticipantsForm] = useState([]);
  
  // Refs para inputs de Cliente Consumidor (para foco após limpar)
  const consumidorInputRefs = useRef({});
  
  // Refs para inputs de valor (para navegação com Enter)
  const valorInputRefs = useRef({});
  
  // Ref para armazenar últimos nomes (undo)
  const lastConsumidorNames = useRef({});
  
  // Estado para destacar o próximo badge DEL que será acionado
  const [nextDeleteIndex, setNextDeleteIndex] = useState(null);
  
  // Estado para rastrear qual input está focado
  const [focusedInputIndex, setFocusedInputIndex] = useState(null);
  
  // Estados para modal de download
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('downloading'); // 'downloading' | 'success'
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  
  // Refs
  const paymentSearchRef = useRef(null);
  const initializedRef = useRef(null); // Armazena timestamp de inicialização
  const loadingTimeoutRef = useRef(null);
  const addParticipantSearchRef = useRef(null);
  const addParticipantButtonRefs = useRef([]);
  const addParticipantListRef = useRef(null);
  
  // Refs para auto-save
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedFormRef = useRef(null);
  const autoSaveEnabledRef = useRef(false);
  
  // Estado para indicador visual de auto-save
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  // Estado para modal de confirmação de status de pagamento
  const [statusConfirmationModal, setStatusConfirmationModal] = useState({
    isOpen: false,
    participantIndex: null,
    currentStatus: null
  });
  
  // Ref para proteger o modal de confirmação de fechamento acidental
  const statusConfirmationProtectedRef = useRef(false);
  
  // Handler para atualizar nome do cliente consumidor
  const handleUpdateConsumidorName = useCallback((index, newName) => {
    setLocalParticipantsForm(prev => {
      const list = [...prev];
      if (index >= 0 && index < list.length) {
        // Se está limpando (newName vazio), salvar o nome atual para undo
        if (newName === '' && list[index].nome) {
          lastConsumidorNames.current[index] = list[index].nome;
        }
        // Se está restaurando um nome, limpar o histórico de undo
        else if (newName !== '') {
          delete lastConsumidorNames.current[index];
        }
        
        list[index] = { 
          ...list[index], 
          nome: newName
        };
      }
      // Também sincronizar com o contexto
      setParticipantsForm(list);
      return list;
    });
  }, [setParticipantsForm]);
  
  // Handler para desfazer limpeza do nome (undo)
  const handleUndoConsumidorName = useCallback((index) => {
    const lastName = lastConsumidorNames.current[index];
    if (lastName) {
      setLocalParticipantsForm(prev => {
        const list = [...prev];
        if (index >= 0 && index < list.length) {
          list[index] = { 
            ...list[index], 
            nome: lastName
          };
        }
        // Limpar o histórico de undo após restaurar
        delete lastConsumidorNames.current[index];
        // Sincronizar com o contexto
        setParticipantsForm(list);
        return list;
      });
      // Focar no input após restaurar
      setTimeout(() => {
        consumidorInputRefs.current[index]?.focus();
      }, 0);
    }
  }, [setParticipantsForm]);
  
  // Handler para clicar no status de pagamento
  const handleStatusClick = useCallback((index, currentStatus, valor) => {
    // Se está "Pago", só permitir clicar se valor está zerado (para refazer)
    if (currentStatus === 'Pago') {
      const valorNumerico = parseBRL(valor);
      if (Number.isFinite(valorNumerico) && valorNumerico > 0) {
        // Valor preenchido, não permite clicar
        return;
      }
      // Valor zerado, permite clicar para refazer
    }
    
    // Proteger o modal de confirmação por 3 segundos
    statusConfirmationProtectedRef.current = true;
    console.log('🛡️ [StatusConfirmation] Modal protegido por 3 segundos');
    setTimeout(() => {
      statusConfirmationProtectedRef.current = false;
      console.log('🛡️ [StatusConfirmation] Proteção removida');
    }, 3000);
    
    // Abrir modal de confirmação
    setStatusConfirmationModal({
      isOpen: true,
      participantIndex: index,
      currentStatus: currentStatus
    });
  }, []);
  
  // Handler para confirmar mudança de status
  const handleConfirmStatusChange = useCallback((newStatus) => {
    const { participantIndex } = statusConfirmationModal;
    
    if (participantIndex !== null) {
      setLocalParticipantsForm(prev => {
        const list = [...prev];
        if (participantIndex >= 0 && participantIndex < list.length) {
          list[participantIndex] = {
            ...list[participantIndex],
            status_pagamento: newStatus
          };
        }
        setParticipantsForm(list);
        return list;
      });
      
      // Marcar para auto-save imediato (será feito no useEffect)
      autoSaveEnabledRef.current = true;
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        console.log('💾 [StatusChange] Salvando mudança de status...');
      }, 100);
      
      // Recarregar alertas imediatamente após mudança de status
      setTimeout(() => {
        console.log('🔄 [StatusChange] Recarregando alertas...');
        loadAlerts().catch(err => {
          console.error('❌ [StatusChange] Erro ao recarregar alertas:', err);
        });
      }, 500);
    }
    
    // Fechar modal
    setStatusConfirmationModal({
      isOpen: false,
      participantIndex: null,
      currentStatus: null
    });
  }, [statusConfirmationModal, setParticipantsForm, loadAlerts]);
  
  // Helper para verificar se é cliente consumidor
  const isClienteConsumidor = useCallback((clienteId) => {
    if (!localCustomers || !Array.isArray(localCustomers)) return false;
    const cliente = localCustomers.find(c => c.id === clienteId);
    return cliente?.is_consumidor_final === true;
  }, [localCustomers]);
  
  // Helper para calcular próximo índice que será limpo ao pressionar Delete
  const getNextDeleteIndex = useCallback(() => {
    const hidden = paymentHiddenIndexes || [];
    const visibleParticipants = (localParticipantsForm || [])
      .map((p, idx) => ({ ...p, _originalIndex: idx }))
      .filter((p) => !hidden.includes(p._originalIndex));
    
    // Buscar primeiro Cliente Consumidor que ainda tem nome padrão
    const firstComNomePadrao = visibleParticipants.find(p => 
      isClienteConsumidor(p.cliente_id) && 
      p.nome && 
      p.nome.toLowerCase().includes('cliente consumidor')
    );
    
    if (firstComNomePadrao) {
      return firstComNomePadrao._originalIndex;
    }
    
    // Se não encontrou com nome padrão, retorna o primeiro Cliente Consumidor com nome
    const firstConsumidor = visibleParticipants.find(p => 
      isClienteConsumidor(p.cliente_id) && p.nome
    );
    
    return firstConsumidor?._originalIndex ?? null;
  }, [localParticipantsForm, paymentHiddenIndexes, isClienteConsumidor]);
  
  // Helper para encontrar próximo input de Cliente Consumidor (circular)
  const getNextConsumidorInputIndex = useCallback((currentIndex) => {
    const hidden = paymentHiddenIndexes || [];
    const visibleParticipants = (localParticipantsForm || [])
      .map((p, idx) => ({ ...p, _originalIndex: idx }))
      .filter((p) => !hidden.includes(p._originalIndex));
    
    // Filtrar apenas Clientes Consumidores
    const consumidores = visibleParticipants.filter(p => 
      isClienteConsumidor(p.cliente_id)
    );
    
    // Se não há consumidores, retornar null
    if (consumidores.length === 0) return null;
    
    // Encontrar índice atual na lista de consumidores
    const currentPosition = consumidores.findIndex(p => p._originalIndex === currentIndex);
    
    // Se encontrou
    if (currentPosition !== -1) {
      // Se não é o último, retornar o próximo
      if (currentPosition < consumidores.length - 1) {
        return consumidores[currentPosition + 1]._originalIndex;
      }
      // Se é o último, retornar o primeiro (navegação circular)
      return consumidores[0]._originalIndex;
    }
    
    return null;
  }, [localParticipantsForm, paymentHiddenIndexes, isClienteConsumidor]);
  
  // Helper para encontrar input anterior de Cliente Consumidor
  const getPreviousConsumidorInputIndex = useCallback((currentIndex) => {
    const hidden = paymentHiddenIndexes || [];
    const visibleParticipants = (localParticipantsForm || [])
      .map((p, idx) => ({ ...p, _originalIndex: idx }))
      .filter((p) => !hidden.includes(p._originalIndex));
    
    // Filtrar apenas Clientes Consumidores
    const consumidores = visibleParticipants.filter(p => 
      isClienteConsumidor(p.cliente_id)
    );
    
    // Encontrar índice atual na lista de consumidores
    const currentPosition = consumidores.findIndex(p => p._originalIndex === currentIndex);
    
    // Se encontrou e não é o primeiro, retornar o anterior
    if (currentPosition > 0) {
      return consumidores[currentPosition - 1]._originalIndex;
    }
    
    return null;
  }, [localParticipantsForm, paymentHiddenIndexes, isClienteConsumidor]);
  
  // Helper para pegar finalizadora padrão (menor código)
  const getDefaultPayMethod = useCallback(() => {
    if (!payMethods || payMethods.length === 0) {
      return null;
    }
    
    // Priorizar finalizadora com codigo_interno = '01'
    const finalizadora01 = payMethods.find(m => m.codigo_interno === '01');
    
    if (finalizadora01) {
      return finalizadora01;
    }
    
    // Se não encontrar '01', retorna a primeira
    return payMethods[0];
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
      let valor = parseBRL(pf?.valor_cota);
      
      // Se tem taxa aplicada, descontar a taxa para o cálculo da diferença
      if (pf?.aplicar_taxa === true && Number.isFinite(valor)) {
        const finalizadora = payMethods.find(m => String(m.id) === String(pf.finalizadora_id));
        const taxa = Number(finalizadora?.taxa_percentual || 0);
        if (taxa > 0) {
          // Remover a taxa do valor para calcular o valor líquido
          valor = valor / (1 + taxa / 100);
          temTaxaAplicada = true;
        }
      }
      
      if (Number.isFinite(valor)) totalAssigned += valor;
      
      const status = pf?.status_pagamento || 'Pendente';
      if (status === 'Pago') paid++;
      else pending++;
    });
    
    const diff = Number.isFinite(totalTarget) ? (totalAssigned - totalTarget) : 0;
    
    return { totalTarget, totalAssigned, diff, paid, pending, temTaxaAplicada };
  }, [localParticipantsForm, paymentHiddenIndexes, paymentTotal, payMethods]);
  
  // Funções
  const splitEqually = () => {
    const total = parseBRL(paymentTotal);
    if (!Number.isFinite(total) || participantsCount === 0) return;
    
    const perPerson = total / participantsCount;
    const masked = maskBRL(String(perPerson.toFixed(2)));
    
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((_, idx) => {
        newList[idx] = { 
          ...newList[idx], 
          valor_cota: masked, 
          status_pagamento: 'Pago',
          aplicar_taxa: false // Desmarca taxa ao dividir igualmente
        };
      });
      return newList;
    });
  };
  
  const zeroAllValues = () => {
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((_, idx) => {
        newList[idx] = { 
          ...newList[idx], 
          valor_cota: '', 
          status_pagamento: 'Pendente',
          aplicar_taxa: false  // Desmarcar checkbox ao zerar
        };
      });
      return newList;
    });
  };
  
  const aplicarTaxaEmTodos = () => {
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((p, idx) => {
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
      });
      return newList;
    });
  };
  
  const handleEditParticipant = (participantIndex, participantName) => {
    // Passar o índice do participante na lista, não o cliente_id
    openEditParticipantModal(participantIndex, participantName);
  };
  
  // Funções para editar valor total
  const startEditingTotal = () => {
    setEditingTotalValue(paymentTotal || '');
    setIsEditingTotal(true);
  };
  
  const confirmEditingTotal = () => {
    setPaymentTotal(editingTotalValue);
    setIsEditingTotal(false);
  };
  
  const cancelEditingTotal = () => {
    setEditingTotalValue('');
    setIsEditingTotal(false);
  };
  
  const handleSavePayments = async (options = {}) => {
    const { autoSave = false } = options;
    try {
      if (isSavingPayments) return;
      
      setIsSavingPayments(true);
      const agendamentoId = editingBooking?.id;
      const codigo = userProfile?.codigo_empresa;
      
      try { if (localStorage.getItem('debug:agenda') === '1') console.log('🔍 [SAVE-PAYMENTS] Iniciando salvamento', { autoSave, agendamentoId, timestamp: new Date().toISOString() }); } catch {}
      
      if (!agendamentoId || !codigo) {
        toast({ 
          title: 'Erro ao salvar pagamentos', 
          description: 'Agendamento ou empresa indisponível.', 
          variant: 'destructive' 
        });
        return;
      }
      
      // Usar TODOS participantes como fonte da verdade (ocultos no UI continuam sendo salvos)
      const effectiveParticipants = (localParticipantsForm || []);
      
      // Calcular pendentes
      const pendingCount = effectiveParticipants.reduce((acc, p) => {
        const st = p.status_pagamento || 'Pendente';
        return acc + (st !== 'Pago' ? 1 : 0);
      }, 0);
      
      try {
        if (localStorage.getItem('debug:agenda') === '1') {
          console.log('🔍 [SAVE-PAYMENTS] Dados a salvar:', {
            totalParticipantes: effectiveParticipants.length,
            pendentes: pendingCount,
          });
          console.log('[ORDER-SAVE] savingIds:', effectiveParticipants.map(p => p.cliente_id));
        }
      } catch {}
      
      // 🔧 SUBSTITUIÇÃO INTELIGENTE: Manter posição original, apenas trocar dados
      const saveTimestamp = new Date().toISOString();
      try { if (localStorage.getItem('debug:agenda') === '1') console.log(`\n\n========== SALVAMENTO INICIADO ${saveTimestamp} ==========`); } catch {}
      
      // Buscar participantes originais do banco para comparar
      const { data: originalParticipants, error: fetchErr } = await supabase
        .from('agendamento_participantes')
        .select('*')
        .eq('codigo_empresa', codigo)
        .eq('agendamento_id', agendamentoId)
        .order('ordem', { ascending: true })
        .order('id', { ascending: true });
      
      if (fetchErr) {
        console.error('❌ Erro ao buscar participantes originais:', fetchErr);
        throw fetchErr;
      }
      
      try {
        if (localStorage.getItem('debug:agenda') === '1') {
          console.log(`📋 Participantes originais no banco: ${originalParticipants?.length || 0}`);
          console.log('[ORDER-SAVE] originalIds:', (originalParticipants || []).map(p => p.cliente_id));
        }
      } catch {}
      
      effectiveParticipants.forEach((p, i) => {
        console.log(`  #${i + 1} (novo): ${p.nome}`);
      });
      
      // 🎯 SEMPRE fazer UPDATE por posição (não deletar)
      // Atualizar cada participante original com os dados do novo
      console.log('✅ Fazendo substituição inteligente por posição');
      
      for (let i = 0; i < originalParticipants.length; i++) {
        const original = originalParticipants[i];
        const novo = effectiveParticipants[i];
        
        if (!novo) {
          console.log(`⚠️ Posição #${i + 1}: Sem participante novo, pulando`);
          continue;
        }
        
        const valor = parseBRL(novo.valor_cota);
        const defaultMethod = getDefaultPayMethod();
        const finId = novo.finalizadora_id || (defaultMethod?.id ? String(defaultMethod.id) : null);
        
        // Atualizar sempre (não verificar se mudou)
        console.log(`🔄 Atualizando posição #${i + 1}: ${original.nome} → ${novo.nome}`);
        
        const { error: updateErr } = await supabase
          .from('agendamento_participantes')
          .update({
            cliente_id: novo.cliente_id,
            nome: novo.nome,
            valor_cota: Number.isFinite(valor) ? valor : 0,
            status_pagamento: novo.status_pagamento || 'Pendente',
            finalizadora_id: finId,
            aplicar_taxa: novo.aplicar_taxa || false,
            ordem: i + 1,
          })
          .eq('id', original.id);
        
        if (updateErr) {
          console.error(`❌ Erro ao atualizar posição #${i + 1}:`, updateErr);
          throw updateErr;
        }
      }
      
      console.log('✅ Substituição inteligente concluída');
      console.log('========== SALVAMENTO CONCLUÍDO ==========\n\n');
      
      // Atualizar form.selectedClients com base em participantsForm (inclui substituições)
      const newSelectedClients = effectiveParticipants.map(p => ({
        id: p.cliente_id,
        nome: p.nome,
        codigo: p.codigo !== null && p.codigo !== undefined ? p.codigo : null
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
      
      // Toast de sucesso (apenas se não for auto-save)
      if (!autoSave) {
        if (pendingCount > 0) {
          toast({
            title: 'Pagamentos salvos',
            description: `${pendingCount} ${pendingCount === 1 ? 'pendente' : 'pendentes'}`,
            variant: 'warning',
          });
        } else {
          toast({ title: 'Pagamentos salvos', variant: 'success' });
        }
      }
      
      setPaymentWarning(null);
      // Atualizar contexto com os dados salvos
      setParticipantsForm(effectiveParticipants);
      // Notificar Agenda para atualizar chips imediatamente
      try {
        window.dispatchEvent(
          new CustomEvent('payments:saved', {
            detail: {
              agendamentoId,
              participants: effectiveParticipants,
            },
          })
        );
      } catch {}
      
      // Recarregar alertas após salvar pagamentos (não bloqueia salvamento)
      loadAlerts().catch(err => {
        console.error('[PaymentModal] Erro ao recarregar alertas:', err);
      });
      
      try { if (localStorage.getItem('debug:agenda') === '1') { console.log('✅ [SAVE-PAYMENTS] Salvamento concluído com sucesso'); console.log('📊 [SAVE-PAYMENTS] Contagem final de pendentes:', pendingCount); } } catch {}
      
      // 📊 LOG 2: Ao fechar PaymentModal (após salvar)
      console.log('📊 [LOG 2 - FECHAR PAYMENT MODAL] Dados salvos no banco:');
      console.log('   Total:', effectiveParticipants.length);
      console.log('   Pendentes:', pendingCount);
      effectiveParticipants.forEach((p, idx) => {
        console.log(`   #${idx + 1}: ${p.nome} | Status: ${p.status_pagamento} | Valor: ${p.valor_cota}`);
      });
      
      // Só fecha o modal se NÃO for auto-save
      if (!autoSave) {
        console.log('🔍 [SAVE-PAYMENTS] Fechando modal de pagamentos (não é auto-save)');
        closePaymentModal();
        setIsModalOpen(false);
      } else {
        console.log('🔍 [SAVE-PAYMENTS] Auto-save concluído - modal permanece aberto');
      }
      
    } catch (e) {
      console.error('❌ [SAVE-PAYMENTS] Erro ao salvar:', e);
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
      
      // NÃO processar atalhos se modal de download estiver aberto
      if (isDownloadModalOpen) return;
      
      // ESC para fechar modal
      if (e.key === 'Escape') {
        e.preventDefault();
        
        // 🔄 Auto-save ao fechar: SEMPRE salva antes de fechar
        console.log('💾 [Auto-save Payments] Salvando ao fechar modal (ESC)...');
        // Cancela timeout pendente
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        handleSavePayments({ autoSave: true })
          .then(() => {
            console.log('✅ [Auto-save Payments] Salvo ao fechar (ESC)!');
            closePaymentModal();
          })
          .catch((error) => {
            console.error('❌ [Auto-save Payments] Erro ao salvar ao fechar (ESC):', error);
            closePaymentModal();
          });
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
      
      // Delete para limpar próximo Cliente Consumidor (se nenhum input estiver focado)
      if (e.key === 'Delete') {
        // Verificar se algum input de Cliente Consumidor está focado
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && activeElement.tagName === 'INPUT';
        
        // Se nenhum input está focado, limpar o próximo Cliente Consumidor
        if (!isInputFocused) {
          e.preventDefault();
          
          const nextIndex = getNextDeleteIndex();
          
          if (nextIndex !== null) {
            handleUpdateConsumidorName(nextIndex, '');
            // Focar no input após limpar
            setTimeout(() => {
              consumidorInputRefs.current[nextIndex]?.focus();
            }, 0);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentModalOpen, isAddParticipantOpen, isDownloadModalOpen, paymentTotal, participantsCount, splitEqually, aplicarTaxaEmTodos, zeroAllValues, isSavingPayments, handleSavePayments, closePaymentModal, localParticipantsForm, paymentHiddenIndexes, isClienteConsumidor, handleUpdateConsumidorName, getNextDeleteIndex]);
  
  // Atualizar nextDeleteIndex sempre que os participantes mudarem
  useEffect(() => {
    if (isPaymentModalOpen) {
      const nextIndex = getNextDeleteIndex();
      setNextDeleteIndex(nextIndex);
    }
  }, [isPaymentModalOpen, localParticipantsForm, paymentHiddenIndexes, getNextDeleteIndex]);
  
  // Sincronizar estado local com contexto ao abrir modal
  useEffect(() => {
    if (isPaymentModalOpen) {
      try { if (localStorage.getItem('debug:agenda') === '1') console.log('⏱️ [PaymentModal] Modal aberto - payMethods:', payMethods?.length || 0, 'initializedRef:', initializedRef.current); } catch {}
      
      // Timeout para detectar se finalizadoras não carregam (3 segundos)
      loadingTimeoutRef.current = setTimeout(() => {
        try { if (localStorage.getItem('debug:agenda') === '1') console.log('⏱️ [PaymentModal] Timeout de 3s acionado - initializedRef:', initializedRef.current, 'payMethods:', payMethods?.length || 0); } catch {}
        if (!initializedRef.current && (!payMethods || payMethods.length === 0)) {
          // Inicializar mesmo sem finalizadoras após timeout
          try { if (localStorage.getItem('debug:agenda') === '1') console.log('⏱️ [PaymentModal] Inicializando com timeout (sem finalizadoras)'); } catch {}
          
          const sourceData = (form?.selectedClients || []).map(c => {
            let codigo = c.codigo;
            if ((codigo === null || codigo === undefined) && localCustomers && Array.isArray(localCustomers)) {
              const clienteCompleto = localCustomers.find(lc => lc.id === c.id);
              codigo = clienteCompleto?.codigo !== null && clienteCompleto?.codigo !== undefined ? clienteCompleto.codigo : null;
            }
            return {
              cliente_id: c.id,
              nome: c.nome,
              codigo: codigo,
              valor_cota: '',
              status_pagamento: 'Pendente',
              finalizadora_id: null,
              aplicar_taxa: false
            };
          });
          
          setLocalParticipantsForm(sourceData);
          initializedRef.current = Date.now();
        }
      }, 3000);
      
      // Só inicializar na PRIMEIRA abertura do modal E quando houver finalizadoras
      if (!initializedRef.current && payMethods && payMethods.length > 0) {
        // Limpar timeout se finalizadoras carregaram
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        
        // Função async para inicializar participantes
        const initializeParticipants = async () => {
          const { defaultMethod, defaultFinalizadoraId, defaultAplicarTaxa } = (() => { 
            const defaultMethod = getDefaultPayMethod();
            const defaultFinalizadoraId = defaultMethod?.id ? String(defaultMethod.id) : null;
            const defaultAplicarTaxa = Number(defaultMethod?.taxa_percentual || 0) > 0;
            return { defaultMethod, defaultFinalizadoraId, defaultAplicarTaxa };
          })();
          
          // PROTEÇÃO EM CAMADAS: Buscar participantes de múltiplas fontes
          let sourceData = [];
          let dataSource = 'nenhuma';
          
          // CAMADA 1: BANCO DE DADOS (prioridade para agendamentos existentes)
          // Sempre buscar do banco primeiro para garantir dados atualizados e completos
          if (editingBooking?.id) {
            // Buscar do banco para garantir dados corretos (especialmente duplicados)
            try {
              const { data: dbParticipants, error } = await supabase
                .from('agendamento_participantes')
                .select('*')
                .eq('agendamento_id', editingBooking.id)
                .eq('codigo_empresa', userProfile?.codigo_empresa)
                .order('ordem', { ascending: true })
                .order('id', { ascending: true });
              
              if (error) {
                console.error('❌ Erro ao buscar participantes:', error);
              } else if (dbParticipants && dbParticipants.length > 0) {
                sourceData = dbParticipants.map(p => ({
                  cliente_id: p.cliente_id,
                  nome: p.nome,
                  codigo: null, // Será preenchido abaixo
                  valor_cota: p.valor_cota ? maskBRL(String(Number(p.valor_cota).toFixed(2))) : '0,00',
                  status_pagamento: p.status_pagamento || 'Pendente',
                  finalizadora_id: p.finalizadora_id ? String(p.finalizadora_id) : defaultFinalizadoraId,
                  aplicar_taxa: p.aplicar_taxa || false
                }));
                dataSource = 'banco de dados';
              } else {
                dataSource = 'banco vazio';
              }
            } catch (err) {
              console.error('❌ Erro ao buscar participantes:', err);
            }
          }
          
          // CAMADA 2: Contexto (apenas se não encontrou no banco)
          if (sourceData.length === 0 && participantsForm && participantsForm.length > 0) {
            sourceData = participantsForm;
            dataSource = 'participantsForm (contexto)';
          } 
          // CAMADA 3: Form (dados do formulário - apenas para novos agendamentos)
          else if (sourceData.length === 0 && form?.selectedClients && form.selectedClients.length > 0) {
            sourceData = (form?.selectedClients || []).map(c => {
              let codigo = c.codigo;
              if ((codigo === null || codigo === undefined) && localCustomers && Array.isArray(localCustomers)) {
                const clienteCompleto = localCustomers.find(lc => lc.id === c.id);
                codigo = clienteCompleto?.codigo !== null && clienteCompleto?.codigo !== undefined ? clienteCompleto.codigo : null;
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
            dataSource = 'form.selectedClients';
          }
          
          // Atualizar códigos faltantes e garantir finalizadora padrão
          let withCodes = sourceData.map(p => {
            let codigo = p.codigo;
            if ((codigo === null || codigo === undefined) && localCustomers && Array.isArray(localCustomers)) {
              const clienteCompleto = localCustomers.find(lc => lc.id === p.cliente_id);
              codigo = clienteCompleto?.codigo !== null && clienteCompleto?.codigo !== undefined ? clienteCompleto.codigo : null;
            }
            
            // Garantir que tenha finalizadora_id (usar padrão se vazio)
            let finalizadoraId = p.finalizadora_id;
            if (!finalizadoraId) {
              const defaultMethod = getDefaultPayMethod();
              finalizadoraId = defaultMethod?.id ? String(defaultMethod.id) : null;
            }
            
            return { 
              ...p, 
              codigo: (codigo !== null && codigo !== undefined) ? codigo : p.codigo,
              finalizadora_id: finalizadoraId
            };
          });
          
          // Reordenar para seguir a ordem dos chips (com suporte a duplicados) e anexar sobras
          try {
            const chips = (form?.selectedClients || []).slice();
            if (chips.length > 0 && withCodes.length > 0) {
              // Buckets por cliente_id preservando múltiplas ocorrências
              const buckets = new Map();
              withCodes.forEach((p) => {
                const list = buckets.get(p.cliente_id) || [];
                list.push(p);
                buckets.set(p.cliente_id, list);
              });
              const occ = new Map();
              const reordered = [];
              for (const c of chips) {
                const used = occ.get(c.id) || 0;
                const list = buckets.get(c.id) || [];
                const pick = list[used];
                if (pick) {
                  reordered.push(pick);
                  occ.set(c.id, used + 1);
                } else {
                  // Se não existe no banco (ex.: recém adicionado), cria entrada padrão
                  const defaultMethod = getDefaultPayMethod();
                  const defaultFinalizadoraId = defaultMethod?.id ? String(defaultMethod.id) : null;
                  reordered.push({
                    cliente_id: c.id,
                    nome: c.nome,
                    codigo: c.codigo ?? null,
                    valor_cota: '0,00',
                    status_pagamento: 'Pendente',
                    finalizadora_id: defaultFinalizadoraId,
                    aplicar_taxa: Number(defaultMethod?.taxa_percentual || 0) > 0,
                  });
                }
              }
              // Anexar quaisquer sobras do banco não consumidas (por segurança)
              const usedCounts = new Map(occ);
              const leftovers = [];
              buckets.forEach((list, key) => {
                const usedN = usedCounts.get(key) || 0;
                for (let i = usedN; i < list.length; i++) leftovers.push(list[i]);
              });
              sourceData = reordered.concat(leftovers);
              // Promover representante (primeiro não-consumidor) para posição 0
              try {
                const idxRep = sourceData.findIndex(p => String(p?.nome || '').toLowerCase() !== 'cliente consumidor');
                if (idxRep > 0) {
                  const rep = sourceData.splice(idxRep, 1)[0];
                  sourceData.unshift(rep);
                  if (localStorage.getItem('debug:agenda') === '1') console.log('[REP] Promovido a representante:', rep?.nome);
                }
              } catch {}
              dataSource = dataSource + ' (reordenado pelos chips)';
            }
          } catch (e) {
            console.error('[PaymentModal] Falha ao reordenar por chips:', e);
          }

          // Após reordenar/promover, recalcular withCodes para refletir a nova ordem
          withCodes = sourceData.map(p => {
            let codigo = p.codigo;
            if ((codigo === null || codigo === undefined) && localCustomers && Array.isArray(localCustomers)) {
              const clienteCompleto = localCustomers.find(lc => lc.id === p.cliente_id);
              codigo = clienteCompleto?.codigo !== null && clienteCompleto?.codigo !== undefined ? clienteCompleto.codigo : null;
            }
            return { 
              ...p, 
              codigo: (codigo !== null && codigo !== undefined) ? codigo : p.codigo,
              finalizadora_id: p.finalizadora_id || (() => { const dm = getDefaultPayMethod(); return dm?.id ? String(dm.id) : null; })()
            };
          });

          // ALERTA CRÍTICO: Se não encontrou participantes em nenhuma fonte
          if (withCodes.length === 0 && editingBooking?.id) {
            console.error('🚨 ALERTA CRÍTICO: Nenhum participante encontrado em NENHUMA fonte!');
            console.error('🚨 Agendamento ID:', editingBooking.id);
            console.error('🚨 Empresa:', userProfile?.codigo_empresa);
            console.error('🚨 Isso pode indicar perda de dados!');
            
            // Tentar buscar novamente com mais detalhes
            try {
              const { data: debugData, error: debugError } = await supabase
                .from('agendamento_participantes')
                .select('*')
                .eq('agendamento_id', editingBooking.id);
              
              console.error('\ud83d\udea8 Busca sem filtro de empresa:', {
                encontrados: debugData?.length || 0,
                dados: debugData,
                erro: debugError
              });
            } catch (err) {
              console.error('\ud83d\udea8 Erro na busca de debug:', err);
            }
          }
          
          // Só atualizar se tiver dados OU se for novo agendamento
          if (withCodes.length > 0 || !editingBooking?.id) {
            setLocalParticipantsForm(withCodes);
            initializedRef.current = Date.now();
            
            // 📊 LOG 1: Ao abrir PaymentModal
            try {
              if (localStorage.getItem('debug:agenda') === '1') {
                console.log('📊 [LOG 1 - ABRIR PAYMENT MODAL] Participantes carregados:');
                console.log('   Total:', withCodes.length);
                console.log('   Fonte:', dataSource);
                withCodes.forEach((p, idx) => {
                  console.log(`   #${idx + 1}: ${p.nome} | Status: ${p.status_pagamento} | Valor: ${p.valor_cota}`);
                });
                // 👇 Diagnóstico de ordem
                const chips = (form?.selectedClients || []).map(c => c.id);
                const finalIds = withCodes.map(p => p.cliente_id);
                console.log('[ORDER] chipsIds:', chips);
                console.log('[ORDER] finalIds:', finalIds);
              }
            } catch {}
          } else {
            console.error('\ud83d\udea8 BLOQUEADO: Não vou sobrescrever com array vazio!');
            console.error('\ud83d\udea8 Mantendo dados anteriores para evitar perda.');
          }
        };
        
        initializeParticipants();
      }
    } else {
      // Ao fechar, resetar estado local MAS NÃO resetar initializedRef
      // (para que na próxima abertura busque do banco ao invés de reinicializar)
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setPaymentSearch('');
      setPaymentWarning(null);
      setPaymentHiddenIndexes([]);
      setLocalParticipantsForm([]);
      // NÃO resetar initializedRef aqui - deixar para quando agendamento mudar
    }
    
    // Cleanup do timeout ao desmontar
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isPaymentModalOpen, payMethods, getDefaultPayMethod, participantsForm, form?.selectedClients, localCustomers]);
  
  // Resetar initializedRef quando o agendamento mudar (não quando o modal fechar)
  useEffect(() => {
    // Resetar flag de inicialização quando trocar de agendamento
    initializedRef.current = null;
  }, [editingBooking?.id]);
  
  // Registrar callback para animação de substituição de participante
  useEffect(() => {
    onParticipantReplacedRef.current = (replacedIndex) => {
      // Destacar participante substituído por 1 segundo
      setHighlightedIndexes([replacedIndex]);
      setTimeout(() => {
        setHighlightedIndexes([]);
      }, 1000);
    };
    
    return () => {
      onParticipantReplacedRef.current = null;
    };
  }, [onParticipantReplacedRef]);
  
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

  // Reaplicar ordenação para seguir os chips se a ordem dos chips mudar durante o modal aberto
  // Use layout effect para evitar flicker/hidratação inconsistente em Vercel
  useLayoutEffect(() => {
    if (!isPaymentModalOpen) return;
    const chips = (form?.selectedClients || []).slice();
    if (chips.length === 0) return;
    if (!localParticipantsForm || localParticipantsForm.length === 0) return;
    try {
      // Buckets por cliente_id preservando múltiplas ocorrências
      const buckets = new Map();
      localParticipantsForm.forEach((p) => {
        const list = buckets.get(p.cliente_id) || [];
        list.push(p);
        buckets.set(p.cliente_id, list);
      });
      const occ = new Map();
      const reordered = [];
      for (const c of chips) {
        const used = occ.get(c.id) || 0;
        const list = buckets.get(c.id) || [];
        const pick = list[used];
        if (pick) {
          reordered.push(pick);
          occ.set(c.id, used + 1);
        } else {
          // Se o chip não tem correspondente ainda, cria placeholder neutro
          reordered.push({
            cliente_id: c.id,
            nome: c.nome,
            codigo: c.codigo ?? null,
            valor_cota: '0,00',
            status_pagamento: 'Pendente',
            finalizadora_id: getDefaultPayMethod()?.id ? String(getDefaultPayMethod().id) : null,
            aplicar_taxa: Number(getDefaultPayMethod()?.taxa_percentual || 0) > 0,
          });
        }
      }
      // Anexar sobras não consumidas (por segurança)
      const usedCounts = new Map(occ);
      const leftovers = [];
      buckets.forEach((list, key) => {
        const usedN = usedCounts.get(key) || 0;
        for (let i = usedN; i < list.length; i++) leftovers.push(list[i]);
      });
      const next = reordered.concat(leftovers);
      // Só aplicar se a ordem realmente mudou (shallow check por cliente_id sequência)
      const hasChange = next.length !== localParticipantsForm.length || next.some((p, i) => p.cliente_id !== localParticipantsForm[i]?.cliente_id || p.nome !== localParticipantsForm[i]?.nome);
      if (hasChange) {
        try {
          if (localStorage.getItem('debug:agenda') === '1') {
            const chipsNames = chips.map(c => c.nome);
            const nextNames = next.map(p => p.nome);
            console.log('[ORDER] chipsNames:', chipsNames);
            console.log('[ORDER] finalNames (next):', nextNames);
          }
        } catch {}
        setLocalParticipantsForm(next);
      }
    } catch (e) {
      console.error('[PaymentModal] Falha ao reordenar após mudança de chips:', e);
    }
  }, [isPaymentModalOpen, form?.selectedClients]);
  
  // Limpar seleções quando o modal de adicionar participante fecha
  useEffect(() => {
    if (!isAddParticipantOpen) {
      setSelectedParticipants([]);
      setAddParticipantSearch('');
      setFocusedAddParticipantIndex(0);
    } else {
      setFocusedAddParticipantIndex(0);
    }
  }, [isAddParticipantOpen]);
  
  // Scroll automático para o item focado no modal de adicionar participante
  useEffect(() => {
    if (isAddParticipantOpen && addParticipantButtonRefs.current[focusedAddParticipantIndex]) {
      addParticipantButtonRefs.current[focusedAddParticipantIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [focusedAddParticipantIndex, isAddParticipantOpen]);
  
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
        
        setLocalParticipantsForm(prev => {
          const currentLength = prev.length;
          const newIndexes = newParticipants.map((_, i) => currentLength + i);
          
          // Destacar novos participantes por 1 segundo
          setHighlightedIndexes(newIndexes);
          setTimeout(() => {
            setHighlightedIndexes([]);
          }, 1000);
          
          return [...prev, ...newParticipants];
        });
        
        setIsAddParticipantOpen(false);
        setSelectedParticipants([]);
        setAddParticipantSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddParticipantOpen, selectedParticipants, getDefaultPayMethod, setLocalParticipantsForm, toast, setAddParticipantSearch, setIsAddParticipantOpen, setSelectedParticipants]);

  // Coordenação externa: salvar e fechar sob demanda (usado pelo modal de agendamento)
  useEffect(() => {
    const handler = async () => {
      try {
        if (!isPaymentModalOpen) return;
        // Cancelar debounce pendente
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
          autoSaveTimeoutRef.current = null;
        }
        // Não duplicar salvamento
        if (!isSavingPayments) {
          await handleSavePayments({ autoSave: true });
        }
      } catch (err) {
        console.error('[PaymentModal] save-and-close erro:', err);
      } finally {
        closePaymentModal();
        try { window.dispatchEvent(new Event('paymentmodal:closed')); } catch {}
      }
    };
    window.addEventListener('paymentmodal:save-and-close', handler);
    return () => window.removeEventListener('paymentmodal:save-and-close', handler);
  }, [isPaymentModalOpen, handleSavePayments, closePaymentModal]);

  // ✅ AUTO-SAVE: Salva automaticamente ao detectar mudanças
  useEffect(() => {
    if (!isPaymentModalOpen) {
      console.log('🔍 [AUTO-SAVE] Modal de pagamentos fechado - desabilitando auto-save');
      console.log('📊 [AUTO-SAVE] Estado final ao fechar:', {
        localParticipantsForm: localParticipantsForm.map(p => ({
          nome: p.nome,
          status: p.status_pagamento,
          valor: p.valor_cota
        })),
        timestamp: new Date().toISOString()
      });
      autoSaveEnabledRef.current = false;
      lastSavedFormRef.current = null;
      return;
    }
    
    // Aguarda inicialização completa (500ms após abrir)
    if (!autoSaveEnabledRef.current) {
      console.log('🔍 [AUTO-SAVE] Inicializando auto-save (aguardando 500ms)');
      const timeout = setTimeout(() => {
        autoSaveEnabledRef.current = true;
        lastSavedFormRef.current = JSON.stringify(localParticipantsForm);
        console.log('🔍 [AUTO-SAVE] Auto-save habilitado');
      }, 500);
      return () => clearTimeout(timeout);
    }
    
    // Serializa form atual para comparar
    const currentForm = JSON.stringify(localParticipantsForm);
    
    // Se não houve mudança real, não faz nada
    if (currentForm === lastSavedFormRef.current) {
      return;
    }
    
    console.log('🔍 [AUTO-SAVE] Mudança detectada - agendando salvamento em 1.5s');
    
    // Limpa timeout anterior
    if (autoSaveTimeoutRef.current) {
      console.log('🔍 [AUTO-SAVE] Cancelando auto-save anterior');
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Debounce de 1.5 segundos
    autoSaveTimeoutRef.current = setTimeout(async () => {
      console.log('🔍 [AUTO-SAVE] Iniciando auto-save AGORA');
      console.log('📊 [AUTO-SAVE] Participantes a salvar:', localParticipantsForm.length);
      setIsAutoSaving(true);
      
      try {
        await handleSavePayments({ autoSave: true });
        lastSavedFormRef.current = currentForm;
        console.log('✅ [AUTO-SAVE] Salvo com sucesso!');
      } catch (error) {
        console.error('❌ [AUTO-SAVE] Erro ao salvar:', error);
      } finally {
        setIsAutoSaving(false);
      }
    }, 1500);
    
    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [isPaymentModalOpen, localParticipantsForm, handleSavePayments]);
  
  // Limpar URL do blob quando o modal de download fechar
  useEffect(() => {
    // Quando o modal fechar, revogar a URL do blob
    if (!isDownloadModalOpen && pdfBlobUrl) {
      console.log('🧹 [PDF] Revogando URL do blob ao fechar modal');
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  }, [isDownloadModalOpen, pdfBlobUrl]);
  
  // Ref para o elemento que será convertido em imagem
  const relatorioRef = useRef(null);

  // Função para baixar relatório como imagem
  const baixarRelatorioImagem = async () => {
    try {
      console.log('🔵 [PDF] Iniciando geração do PDF');
      if (!relatorioRef.current) {
        throw new Error('Elemento do relatório não encontrado');
      }

      // Abrir modal de download e resetar estados
      console.log('🔵 [PDF] Abrindo modal de download');
      
      // Revogar URL antiga se existir
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      
      setIsDownloadModalOpen(true);
      setDownloadStatus('downloading');
      setDownloadProgress(0);
      setPdfBlob(null);
      setPdfBlobUrl(null);
      setPdfFileName('');

      // Obter participantes visíveis
      const visibleParticipants = (localParticipantsForm || [])
        .filter((_, idx) => !(paymentHiddenIndexes || []).includes(idx));

      // Dividir em grupos de 20 (tabela simplificada cabe mais pessoas por página)
      const PARTICIPANTS_PER_PAGE = 20;
      const totalPages = Math.ceil(visibleParticipants.length / PARTICIPANTS_PER_PAGE);
      
      // Atualizar progresso inicial
      setDownloadProgress(5);

      // Criar PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 297;
      const pdfHeight = 210;

      // Gerar cada página
      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const startIdx = pageNum * PARTICIPANTS_PER_PAGE;
        const endIdx = Math.min(startIdx + PARTICIPANTS_PER_PAGE, visibleParticipants.length);
        const pageParticipants = visibleParticipants.slice(startIdx, endIdx);
        
        // Atualizar progresso (10% a 90% durante geração das páginas)
        const progress = 10 + Math.floor((pageNum / totalPages) * 80);
        setDownloadProgress(progress);

        // Atualizar o relatório para mostrar apenas os participantes desta página
        const elemento = relatorioRef.current;
        if (!elemento) {
          throw new Error('Elemento do relatório não encontrado durante a geração');
        }
        
        console.log(`📄 [PDF] Capturando página ${pageNum + 1}/${totalPages} (participantes ${startIdx + 1}-${endIdx})`);
        
        // Tornar elemento visível temporariamente para captura
        const originalStyles = {
          visibility: elemento.style.visibility,
          opacity: elemento.style.opacity,
        };
        
        // Tornar visível para captura
        elemento.style.visibility = 'visible';
        elemento.style.opacity = '1';
        
        console.log(`📋 [PDF] Elemento innerHTML length: ${elemento.innerHTML.length}`);
        console.log(`📋 [PDF] Elemento scrollHeight: ${elemento.scrollHeight}`);
        console.log(`📋 [PDF] Elemento scrollWidth: ${elemento.scrollWidth}`);
        
        // Ocultar cabeçalho e resumo nas páginas posteriores
        const headerDiv = elemento.querySelector('div[style*="borderBottom"]');
        const summaryDiv = elemento.querySelectorAll('div[style*="borderBottom"]')[1];
        
        if (pageNum > 0) {
          // Ocultar cabeçalho e resumo
          if (headerDiv) headerDiv.style.display = 'none';
          if (summaryDiv) summaryDiv.style.display = 'none';
        } else {
          // Mostrar cabeçalho e resumo na primeira página
          if (headerDiv) headerDiv.style.display = 'block';
          if (summaryDiv) summaryDiv.style.display = 'flex';
        }
        
        // Apenas esconder participantes que não são desta página
        const allParticipantRows = elemento.querySelectorAll('tbody tr');
        console.log(`📋 [PDF] Total de linhas na tabela: ${allParticipantRows.length}`);
        
        allParticipantRows.forEach((row, idx) => {
          row.style.display = (idx >= startIdx && idx < endIdx) ? 'table-row' : 'none';
        });
        
        // Atualizar indicador de página
        const pageIndicatorElem = elemento.querySelector('#page-indicator');
        if (pageIndicatorElem) {
          pageIndicatorElem.textContent = `Página ${pageNum + 1} de ${totalPages}`;
        }
        
        // Forçar reflow para garantir renderização
        console.log(`🔄 [PDF] Forçando reflow...`);
        elemento.offsetHeight;
        elemento.getBoundingClientRect();
        elemento.scrollHeight;
        
        // Forçar reflow novamente
        void elemento.offsetWidth;
        void elemento.clientHeight;

        // Aguardar renderização completa com múltiplos frames
        console.log(`⏳ [PDF] Aguardando renderização...`);
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(resolve, 2000);
              });
            });
          });
        });
        
        console.log(`✨ [PDF] Renderização completa, iniciando captura...`);
        
        // Verificar se os dados estão sendo renderizados
        const tableRows = elemento.querySelectorAll('tbody tr');
        console.log(`📊 [PDF] Linhas da tabela encontradas: ${tableRows.length}`);
        
        // Verificar conteúdo de cada linha
        tableRows.forEach((row, idx) => {
          const cells = row.querySelectorAll('td');
          const cellTexts = Array.from(cells).map(c => c.textContent.trim()).join(' | ');
          console.log(`📊 [PDF] Linha ${idx + 1}: ${cellTexts}`);
        });
        
        if (tableRows.length === 0) {
          console.warn('⚠️ [PDF] AVISO: Nenhuma linha de tabela encontrada! Verificando estrutura...');
          const tbody = elemento.querySelector('tbody');
          console.log('📋 [PDF] tbody existe:', !!tbody);
          if (tbody) {
            console.log('📋 [PDF] innerHTML do tbody:', tbody.innerHTML.substring(0, 500));
          }
        }

        // Capturar página com qualidade otimizada
        let canvas;
        try {
          // Usar apenas a altura do conteúdo real
          const elementHeight = elemento.scrollHeight;
          const elementWidth = elemento.scrollWidth;
          console.log(`📐 [PDF] Dimensões reais: width=${elementWidth}px, height=${elementHeight}px`);
          
          // Usar toPng para melhor qualidade e compatibilidade
          canvas = await toPng(elemento, {
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            cacheBust: true,
            skipFonts: false,
          });
          
          if (!canvas || canvas.length === 0) {
            throw new Error('Canvas vazio retornado pela captura');
          }
          
          console.log(`✅ [PDF] Página ${pageNum + 1} capturada (${canvas.length} bytes, ${elementHeight}px altura, ${tableRows.length} linhas)`);
        } catch (captureError) {
          console.error(`❌ [PDF] Erro ao capturar página ${pageNum + 1}:`, captureError);
          // Restaurar estilos originais mesmo em caso de erro
          elemento.style.visibility = originalStyles.visibility;
          elemento.style.opacity = originalStyles.opacity;
          throw new Error(`Falha ao capturar página ${pageNum + 1}: ${captureError.message}`);
        }
        
        // Restaurar estilos originais após captura bem-sucedida
        elemento.style.visibility = originalStyles.visibility;
        elemento.style.opacity = originalStyles.opacity;

        // Adicionar ao PDF
        if (pageNum > 0) {
          pdf.addPage();
        }

        // Calcular altura proporcional no PDF baseado na largura
        const imgWidth = pdfWidth;
        const imgHeight = (elemento.scrollHeight / elemento.scrollWidth) * pdfWidth;
        
        // Adicionar imagem como PNG (melhor qualidade)
        pdf.addImage(canvas, 'PNG', 0, 0, imgWidth, imgHeight, '', 'MEDIUM');
        console.log(`📑 [PDF] Página ${pageNum + 1} adicionada ao PDF (${imgWidth}mm x ${imgHeight}mm)`);
      }

      // Restaurar visibilidade de todos os participantes e limpar indicador
      if (relatorioRef.current) {
        const allParticipantRows = relatorioRef.current.querySelectorAll('tbody tr');
        allParticipantRows.forEach(row => {
          row.style.display = 'table-row';
        });
        
        // Limpar indicador de página
        const pageIndicator = relatorioRef.current.querySelector('#page-indicator');
        if (pageIndicator) {
          pageIndicator.textContent = '';
        }
      }

      // Progresso: Finalizando
      setDownloadProgress(95);
      
      // Gerar blob do PDF
      const pageInfo = totalPages > 1 ? ` (${totalPages} páginas)` : '';
      
      // Pegar nome do representante (primeiro participante não-consumidor)
      const participantesVisiveis = (localParticipantsForm || []).filter((_, idx) => !(paymentHiddenIndexes || []).includes(idx));
      let representante = participantesVisiveis.find(p => {
        const cliente = localCustomers?.find(c => c.id === p.cliente_id);
        return !cliente?.is_consumidor_final;
      });
      
      // Se todos forem consumidores, pega o primeiro
      if (!representante && participantesVisiveis.length > 0) {
        representante = participantesVisiveis[0];
      }
      
      // Pegar apenas nome e sobrenome do representante
      const nomeCompleto = representante?.nome || 'sem-nome';
      const partesNome = nomeCompleto.trim().split(/\s+/); // Divide por espaços
      const primeiroNome = partesNome[0] || 'sem';
      const sobrenome = partesNome.length > 1 ? partesNome[partesNome.length - 1] : 'nome';
      
      // Normalizar nome e sobrenome (remover acentos e caracteres especiais)
      const nomeNormalizado = `${primeiroNome}-${sobrenome}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9-]+/g, '-') // Substitui caracteres especiais por hífen
        .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
      
      const fileName = `rel-${nomeNormalizado}-${editingBooking?.code || '0'}${pageInfo}.pdf`;
      const pdfBlobData = pdf.output('blob');
      
      // Criar URL do blob (será revogada apenas ao fechar o modal)
      const blobUrl = URL.createObjectURL(pdfBlobData);
      
      // Salvar blob, URL e nome para uso posterior
      setPdfBlob(pdfBlobData);
      setPdfBlobUrl(blobUrl);
      setPdfFileName(fileName);
      
      // Progresso: 100%
      setDownloadProgress(100);
      
      // Fazer download automático
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();
      // NÃO revogar a URL aqui - será revogada ao fechar o modal
      
      // Aguardar um pouco antes de mostrar sucesso
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Atualizar status para sucesso (modal continua aberto)
      console.log('✅ [PDF] PDF gerado com sucesso! Modal de download deve permanecer aberto.');
      console.log('✅ [PDF] isPaymentModalOpen deve continuar true');
      setDownloadStatus('success');
      console.log('✅ [PDF] Status atualizado para success');
    } catch (error) {
      console.error('❌ [PDF] Erro ao gerar PDF:', error);
      setIsDownloadModalOpen(false);
      toast({
        title: 'Erro ao gerar PDF',
        description: error?.message || 'Não foi possível gerar o PDF.',
        variant: 'destructive'
      });
    }
  };
  
  return (
    <>
    <Dialog 
      open={isPaymentModalOpen}
      onOpenChange={(open) => {
        console.log('🟡 [PaymentModal] onOpenChange chamado:', { open, isDownloadModalOpen });
        if (!open) {
          console.log('🔴 [PaymentModal] Tentando fechar modal de pagamentos');
          if (isDownloadModalOpen) {
            console.log('⚠️ [PaymentModal] BLOQUEADO: Modal de download está aberto');
            return; // Bloqueia fechamento se modal de download estiver aberto
          }
          console.log('✅ [PaymentModal] Fechando modal de pagamentos');
          closePaymentModal();
        }
      }}
    >
      <DialogContent
        forceMount
        className="w-full max-w-[95vw] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={async (e) => {
          const now = Date.now();
          const timeSinceInit = initializedRef.current ? now - initializedRef.current : 0;
          const timeSinceVisibility = now - lastVisibilityChangeTime;
          
          console.log('🔍 [PaymentModal] onInteractOutside disparado:', {
            target: e.target?.tagName,
            className: e.target?.className?.substring?.(0, 50),
            timeSinceInit: `${timeSinceInit}ms`,
            timeSinceVisibility: `${timeSinceVisibility}ms`,
            isAddParticipantOpen,
            isDownloadModalOpen,
            statusConfirmationOpen: statusConfirmationModal.isOpen,
            isModalProtected: isModalProtected,
            timestamp: new Date().toISOString()
          });
          
          // 🛡️ PROTEÇÃO: Bloquear fechamento se modal de confirmação de status está aberto
          if (statusConfirmationModal.isOpen) {
            console.log('🛡️ [PaymentModal] Bloqueado: modal de confirmação de status está aberto');
            e.preventDefault();
            return;
          }
          
          // 🛡️ PROTEÇÃO: Bloquear fechamento se modal de download estiver aberto
          if (isDownloadModalOpen) {
            console.log('🛡️ [PaymentModal] Bloqueado: modal de download está aberto');
            e.preventDefault();
            return;
          }
          
          // 🛡️ PROTEÇÃO PRINCIPAL: Verificar se modal está protegido (modalProtectionRef)
          if (isModalProtected) {
            console.log('🛡️ [PaymentModal] Bloqueado: modal protegido (protectPaymentModal ativo)');
            e.preventDefault();
            return;
          }
          
          // Prevenir fechamento se modal de adicionar participante estiver aberto
          if (isAddParticipantOpen) {
            console.log('🛡️ [PaymentModal] Bloqueado: modal de adicionar participante aberto');
            e.preventDefault();
            return;
          }
          
          // Prevenir fechamento nos primeiros 500ms após abrir (falsos positivos)
          if (initializedRef.current && timeSinceInit < 500) {
            console.log('🛡️ [PaymentModal] Bloqueado: modal abriu recentemente');
            e.preventDefault();
            return;
          }
          
          // 🛡️ PROTEÇÃO ADICIONAL: Bloquear fechamento se aconteceu logo após mudança de visibilidade
          // Aumentado para 3 segundos para evitar múltiplos disparos ao restaurar aba
          if (timeSinceVisibility < 3000) {
            console.log(`🛡️ [PaymentModal] Bloqueado: mudança de visibilidade recente (${timeSinceVisibility}ms atrás)`);
            e.preventDefault();
            return;
          }
          
          // 🔄 Auto-save ao clicar fora: SEMPRE salva antes de fechar
          e.preventDefault();
          console.log('💾 [Auto-save Payments] Salvando ao clicar fora do modal...');
          try {
            // Cancela timeout pendente
            if (autoSaveTimeoutRef.current) {
              console.log('🔍 [Auto-save Payments] Cancelando auto-save pendente antes de salvar ao clicar fora');
              clearTimeout(autoSaveTimeoutRef.current);
              autoSaveTimeoutRef.current = null;
            }
            
            // 🛡️ PROTEÇÃO: Se já está salvando, não fazer novo salvamento
            if (isSavingPayments) {
              console.log('🛡️ [Auto-save Payments] Já está salvando - ignorando novo salvamento ao clicar fora');
              closePaymentModal();
              return;
            }
            
            await handleSavePayments({ autoSave: true });
            console.log('✅ [Auto-save Payments] Salvo ao clicar fora!');
          } catch (error) {
            console.error('❌ [Auto-save Payments] Erro ao salvar ao clicar fora:', error);
          } finally {
            closePaymentModal();
          }
        }}
        onEscapeKeyDown={(e) => { 
          // ESC já é tratado pelo useEffect de atalhos
          e.preventDefault();
        }}
      >
        {/* Mostrar loading/aviso se finalizadoras ainda não carregaram */}
        {(!payMethods || payMethods.length === 0) ? (
          !initializedRef.current ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Carregando</DialogTitle>
                <DialogDescription>Carregando formas de pagamento</DialogDescription>
              </DialogHeader>
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                <p className="text-sm text-text-muted">Carregando formas de pagamento...</p>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Aviso</DialogTitle>
                <DialogDescription>Nenhuma forma de pagamento cadastrada</DialogDescription>
              </DialogHeader>
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
                <div className="text-center space-y-2">
                  <p className="font-semibold text-amber-500">Nenhuma forma de pagamento cadastrada</p>
                  <p className="text-sm text-text-muted">
                    Cadastre pelo menos uma finalizadora para gerenciar pagamentos.
                  </p>
                </div>
              <div className="flex gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePaymentModal}
                >
                  Fechar
                </Button>
                <Link to="/finalizadoras">
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={closePaymentModal}
                  >
                    Cadastrar Finalizadora
                  </Button>
                </Link>
              </div>
            </div>
            </>
          )
        ) : (
          <>
        <DialogHeader className="relative pb-4">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <DialogTitle>Registrar pagamento</DialogTitle>
                {isAutoSaving && (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs bg-blue-600/10 text-blue-400 border-blue-700/30">
                    <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </span>
                )}
              </div>
              <DialogDescription>
                As alterações são salvas automaticamente enquanto você edita.
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
              <div className="p-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 min-w-0 relative group">
                <div className="text-[10px] text-emerald-300/80 mb-1 truncate">Total</div>
                {isEditingTotal ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      value={editingTotalValue}
                      onChange={(e) => setEditingTotalValue(maskBRL(e.target.value))}
                      className="w-full h-6 text-xs text-center font-bold bg-emerald-950/50 border-emerald-400/50 text-emerald-300 px-1"
                      placeholder="0,00"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingTotalValue !== paymentTotal) {
                          confirmEditingTotal();
                        } else if (e.key === 'Escape') {
                          cancelEditingTotal();
                        }
                      }}
                      onBlur={() => {
                        if (editingTotalValue !== paymentTotal) {
                          confirmEditingTotal();
                        } else {
                          cancelEditingTotal();
                        }
                      }}
                    />
                    {editingTotalValue !== paymentTotal && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={confirmEditingTotal}
                        className="p-0.5 rounded hover:bg-emerald-500/20 transition-colors flex-shrink-0"
                        title="Confirmar"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-bold text-emerald-400 truncate">{maskBRL(paymentTotal) || 'R$ 0,00'}</div>
                    <button
                      onClick={startEditingTotal}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-emerald-500/20 transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-3 h-3 text-emerald-400" />
                    </button>
                  </>
                )}
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
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-8 px-3"
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
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-8 px-3 flex-1" 
                  onClick={aplicarTaxaEmTodos} 
                  disabled={participantsCount === 0}
                >
                  Aplicar taxas
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="border border-white/10 text-xs h-8 px-3 flex-1" 
                  onClick={zeroAllValues} 
                  disabled={participantsCount === 0}
                >
                  Zerar
                </Button>
              </div>
            </div>
          </div>
          
          {/* Versão Desktop (mantém original) */}
          <div className="hidden sm:block p-4 rounded-lg border border-border bg-gradient-to-br from-surface-2 to-surface shadow-md">
            <div className="flex flex-col md:flex-row md:items-start gap-3 w-full">
              {/* Valor total e diferença */}
              <div className="flex flex-row gap-3">
                <div className="space-y-1">
                  <Label className="font-bold text-base text-white">Valor total a receber</Label>
                  <div className="w-[180px] px-3 py-2 rounded-md bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border-2 border-emerald-500/40 shadow-lg flex items-center justify-center gap-2 relative group">
                    {isEditingTotal ? (
                      <>
                        <Input
                          type="text"
                          value={editingTotalValue}
                          onChange={(e) => setEditingTotalValue(maskBRL(e.target.value))}
                          className="w-full h-8 text-center text-lg font-bold bg-emerald-950/50 border-emerald-400/50 text-emerald-300"
                          placeholder="0,00"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingTotalValue !== paymentTotal) {
                              confirmEditingTotal();
                            } else if (e.key === 'Escape') {
                              cancelEditingTotal();
                            }
                          }}
                          onBlur={() => {
                            if (editingTotalValue !== paymentTotal) {
                              confirmEditingTotal();
                            } else {
                              cancelEditingTotal();
                            }
                          }}
                        />
                        {editingTotalValue !== paymentTotal && (
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={confirmEditingTotal}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-emerald-500/20 transition-colors"
                            title="Confirmar (Enter)"
                          >
                            <Check className="w-4 h-4 text-emerald-400" />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-emerald-400">
                          {maskBRL(paymentTotal) || 'R$ 0,00'}
                        </span>
                        <button
                          onClick={startEditingTotal}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-emerald-500/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar valor total"
                        >
                          <Edit className="w-4 h-4 text-emerald-400" />
                        </button>
                      </>
                    )}
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
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-0">
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
                
                <Button
                  type="button"
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-400 text-black shadow-md flex-shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    protectPaymentModal(2000); // Proteger por 2 segundos
                    setIsAddParticipantOpen(true);
                  }}
                >
                  <span className="hidden sm:inline">Adicionar participante +</span>
                  <span className="sm:hidden">Participante +</span>
                </Button>
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
                <div className="divide-y divide-border max-h-[50vh] overflow-y-scroll">
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
                      const isHighlighted = highlightedIndexes.includes(originalIdx);
                      
                      return (
                        <div 
                          key={uniqueKey} 
                          className={`p-2 sm:p-3 border-b last:border-b-0 transition-all duration-500 ease-out ${
                            isHighlighted 
                              ? 'bg-white/10' 
                              : ''
                          }`}
                        >
                          {/* Versão Mobile */}
                          <div className="sm:hidden space-y-2">
                            {/* Header com nome e ações */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {(pf.codigo !== null && pf.codigo !== undefined) && (
                                  <span className={`text-xs font-bold rounded px-1.5 py-0.5 shrink-0 ${
                                    pf.status_pagamento === 'Pago' 
                                      ? 'text-emerald-400 bg-emerald-600/20 border border-emerald-700/40' 
                                      : 'text-amber-400 bg-amber-600/20 border border-amber-700/40'
                                  }`}>
                                    #{pf.codigo}
                                  </span>
                                )}
                                {isClienteConsumidor(pf.cliente_id) ? (
                                  <div className="relative flex-1 min-w-0">
                                    <input
                                      ref={(el) => {
                                        if (el) consumidorInputRefs.current[originalIdx] = el;
                                      }}
                                      type="text"
                                      value={pf.nome || ''}
                                      onChange={(e) => handleUpdateConsumidorName(originalIdx, e.target.value)}
                                      onFocus={() => setFocusedInputIndex(originalIdx)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          // Focar no próximo input de Cliente Consumidor
                                          const nextIndex = getNextConsumidorInputIndex(originalIdx);
                                          if (nextIndex !== null) {
                                            setTimeout(() => {
                                              consumidorInputRefs.current[nextIndex]?.focus();
                                            }, 0);
                                          }
                                        } else if (e.key === 'Delete' && pf.nome && e.target === document.activeElement) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          
                                          // Limpar o próprio input
                                          handleUpdateConsumidorName(originalIdx, '');
                                          // Manter foco no mesmo input
                                          setTimeout(() => {
                                            consumidorInputRefs.current[originalIdx]?.focus();
                                          }, 0);
                                        } else if (e.key === 'ArrowDown') {
                                          e.preventDefault();
                                          
                                          // Encontrar próximo input de Cliente Consumidor
                                          const nextIndex = getNextConsumidorInputIndex(originalIdx);
                                          if (nextIndex !== null) {
                                            setTimeout(() => {
                                              consumidorInputRefs.current[nextIndex]?.focus();
                                            }, 0);
                                          }
                                        } else if (e.key === 'ArrowUp') {
                                          e.preventDefault();
                                          
                                          // Encontrar input anterior de Cliente Consumidor
                                          const prevIndex = getPreviousConsumidorInputIndex(originalIdx);
                                          if (prevIndex !== null) {
                                            setTimeout(() => {
                                              consumidorInputRefs.current[prevIndex]?.focus();
                                            }, 0);
                                          }
                                        }
                                      }}
                                      onBlur={async () => {
                                        // Limpar foco ao sair do input
                                        setFocusedInputIndex(null);
                                        
                                        // Se o input está vazio ao sair, restaurar o último nome
                                        if (!pf.nome && lastConsumidorNames.current[originalIdx]) {
                                          handleUndoConsumidorName(originalIdx);
                                        }
                                        
                                        try {
                                          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                          await handleSavePayments({ autoSave: true });
                                        } catch (err) {
                                          console.error('[PaymentModal] Erro ao salvar ao sair do nome consumidor (compacto):', err);
                                        }
                                      }}
                                      placeholder="Nome do cliente..."
                                      className="font-medium text-sm bg-black/40 text-white placeholder:text-white/50 border border-white/15 rounded px-2 py-0.5 pr-11 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 w-full"
                                      title="Editar nome do Cliente Consumidor (histórico do agendamento)"
                                    />
                                    {/* Badge DEL quando há nome, ícone UNDO quando vazio */}
                                    {pf.nome ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateConsumidorName(originalIdx, '');
                                          // Focar no input após limpar
                                          setTimeout(() => {
                                            consumidorInputRefs.current[originalIdx]?.focus();
                                          }, 0);
                                        }}
                                        className={`absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-bold border rounded transition-all ${
                                          (focusedInputIndex === originalIdx || (!focusedInputIndex && nextDeleteIndex === originalIdx))
                                            ? 'text-amber-300 bg-amber-500/20 border-amber-400/50 animate-pulse shadow-lg shadow-amber-500/20'
                                            : 'text-white/60 bg-white/10 hover:bg-white/20 hover:text-white/90 border-white/20'
                                        }`}
                                        title={(focusedInputIndex === originalIdx || (!focusedInputIndex && nextDeleteIndex === originalIdx)) ? 'Será limpo ao pressionar Delete' : 'Limpar nome (tecla Delete)'}
                                      >
                                        DEL
                                      </button>
                                    ) : lastConsumidorNames.current[originalIdx] ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUndoConsumidorName(originalIdx)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/30 rounded transition-all"
                                        title="Restaurar último nome"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="font-medium text-sm truncate">{pf.nome}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  className="p-1 text-text-secondary hover:text-brand transition-colors"
                                  onClick={() => handleEditParticipant(originalIdx, pf.nome)}
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
                                  const temValor = Number.isFinite(valorAtual) && valorAtual > 0;
                                  
                                  return (
                                    <label 
                                      className={`flex items-center gap-1.5 mt-1 text-[11px] ${
                                        temValor ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                      }`} 
                                      title={temValor ? `Taxa de ${taxa.toFixed(2)}%` : 'Informe o valor primeiro'}
                                    >
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4"
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
                                                // Adicionar taxa ao valor (cliente paga mais)
                                                novoValor = valorAtual * (1 + taxa / 100);
                                              } else {
                                                // Remover taxa do valor (voltar ao valor base)
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
                                  ref={(el) => {
                                    if (el) valorInputRefs.current[originalIdx] = el;
                                  }}
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
                              {(() => {
                                const isPago = pf.status_pagamento === 'Pago';
                                const temValor = Number.isFinite(parseBRL(pf.valor_cota)) && parseBRL(pf.valor_cota) > 0;
                                const isDisabled = isPago && temValor;
                                
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusClick(originalIdx, pf.status_pagamento, pf.valor_cota)}
                                    disabled={isDisabled}
                                    className={`inline-flex items-center justify-center px-3 py-0.5 rounded text-xs font-medium border transition-all ${
                                      isPago && temValor
                                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-700/40 cursor-not-allowed' 
                                        : isPago
                                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-700/40 hover:bg-emerald-600/30 hover:border-emerald-600/60 cursor-pointer'
                                        : 'bg-amber-600/20 text-amber-400 border-amber-700/40 hover:bg-amber-600/30 hover:border-amber-600/60 cursor-pointer'
                                    }`}
                                    title={isDisabled ? 'Não é possível alterar (valor preenchido)' : 'Clique para alterar status'}
                                  >
                                    {isPago ? 'Pago' : 'Pendente'}
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                          
                          {/* Versão Desktop */}
                          <div className="hidden sm:flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {(pf.codigo !== null && pf.codigo !== undefined) && (
                                  <span className={`text-sm font-bold rounded-md px-2.5 py-1 shadow-sm ${
                                    pf.status_pagamento === 'Pago' 
                                      ? 'text-emerald-400 bg-emerald-600/20 border border-emerald-700/40' 
                                      : 'text-amber-400 bg-amber-600/20 border border-amber-700/40'
                                  }`}>
                                    #{pf.codigo}
                                  </span>
                                )}
                                {isClienteConsumidor(pf.cliente_id) ? (
                                  <div className="relative">
                                    <input
                                      ref={(el) => {
                                        if (el) consumidorInputRefs.current[originalIdx] = el;
                                      }}
                                      type="text"
                                      value={pf.nome || ''}
                                      onChange={(e) => handleUpdateConsumidorName(originalIdx, e.target.value)}
                                      onFocus={() => setFocusedInputIndex(originalIdx)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          // Focar no próximo input de Cliente Consumidor
                                          const nextIndex = getNextConsumidorInputIndex(originalIdx);
                                          if (nextIndex !== null) {
                                            setTimeout(() => {
                                              consumidorInputRefs.current[nextIndex]?.focus();
                                            }, 0);
                                          }
                                        } else if (e.key === 'Delete' && pf.nome && e.target === document.activeElement) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          
                                          // Limpar o próprio input
                                          handleUpdateConsumidorName(originalIdx, '');
                                          // Manter foco no mesmo input
                                          setTimeout(() => {
                                            consumidorInputRefs.current[originalIdx]?.focus();
                                          }, 0);
                                        } else if (e.key === 'ArrowDown') {
                                          e.preventDefault();
                                          
                                          // Encontrar próximo input de Cliente Consumidor
                                          const nextIndex = getNextConsumidorInputIndex(originalIdx);
                                          if (nextIndex !== null) {
                                            setTimeout(() => {
                                              consumidorInputRefs.current[nextIndex]?.focus();
                                            }, 0);
                                          }
                                        } else if (e.key === 'ArrowUp') {
                                          e.preventDefault();
                                          
                                          // Encontrar input anterior de Cliente Consumidor
                                          const prevIndex = getPreviousConsumidorInputIndex(originalIdx);
                                          if (prevIndex !== null) {
                                            setTimeout(() => {
                                              consumidorInputRefs.current[prevIndex]?.focus();
                                            }, 0);
                                          }
                                        }
                                      }}
                                      onBlur={async () => {
                                        // Limpar foco ao sair do input
                                        setFocusedInputIndex(null);
                                        
                                        // Se o input está vazio ao sair, restaurar o último nome
                                        if (!pf.nome && lastConsumidorNames.current[originalIdx]) {
                                          handleUndoConsumidorName(originalIdx);
                                        }
                                        
                                        try {
                                          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                          await handleSavePayments({ autoSave: true });
                                        } catch (err) {
                                          console.error('[PaymentModal] Erro ao salvar ao sair do nome consumidor (normal):', err);
                                        }
                                      }}
                                      placeholder="Nome do cliente..."
                                      className="font-medium text-base bg-black/40 text-white placeholder:text-white/50 border border-white/15 rounded-md px-3 py-1.5 pr-14 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 min-w-[200px] max-w-[300px]"
                                      title="Editar nome do Cliente Consumidor (histórico do agendamento)"
                                    />
                                    {/* Badge DEL quando há nome, ícone UNDO quando vazio */}
                                    {pf.nome ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateConsumidorName(originalIdx, '');
                                          // Focar no input após limpar
                                          setTimeout(() => {
                                            consumidorInputRefs.current[originalIdx]?.focus();
                                          }, 0);
                                        }}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold border rounded transition-all ${
                                          (focusedInputIndex === originalIdx || (!focusedInputIndex && nextDeleteIndex === originalIdx))
                                            ? 'text-amber-300 bg-amber-500/20 border-amber-400/50 animate-pulse shadow-lg shadow-amber-500/30'
                                            : 'text-white/60 bg-white/10 hover:bg-white/20 hover:text-white/90 border-white/20 shadow-sm'
                                        }`}
                                        title={(focusedInputIndex === originalIdx || (!focusedInputIndex && nextDeleteIndex === originalIdx)) ? 'Será limpo ao pressionar Delete' : 'Limpar nome (tecla Delete)'}
                                      >
                                        DEL
                                      </button>
                                    ) : lastConsumidorNames.current[originalIdx] ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUndoConsumidorName(originalIdx)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/30 rounded transition-all shadow-sm"
                                        title="Restaurar último nome"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="font-medium text-base">{pf.nome}</span>
                                )}
                                <button
                                  type="button"
                                  className="p-1 text-text-secondary hover:text-brand transition-colors"
                                  onClick={() => handleEditParticipant(originalIdx, pf.nome)}
                                  title="Trocar participante"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Container isolado para Valor */}
                            <div className="isolate">
                              <Input
                                ref={(el) => {
                                  if (el) valorInputRefs.current[originalIdx] = el;
                                }}
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
                                                // Adicionar taxa ao valor (cliente paga mais)
                                                novoValor = valorAtual * (1 + taxa / 100);
                                              } else {
                                                // Remover taxa do valor (voltar ao valor base)
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
                            
                            {/* Status */}
                            {(() => {
                              const isPago = pf.status_pagamento === 'Pago';
                              const temValor = Number.isFinite(parseBRL(pf.valor_cota)) && parseBRL(pf.valor_cota) > 0;
                              const isDisabled = isPago && temValor;
                              
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleStatusClick(originalIdx, pf.status_pagamento, pf.valor_cota)}
                                  disabled={isDisabled}
                                  className={`inline-flex items-center justify-center w-[90px] px-3 py-1 rounded text-sm font-medium border transition-all ${
                                    isPago && temValor
                                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-700/40 cursor-not-allowed' 
                                      : isPago
                                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-700/40 hover:bg-emerald-600/30 hover:border-emerald-600/60 cursor-pointer'
                                      : 'bg-amber-600/20 text-amber-400 border-amber-700/40 hover:bg-amber-600/30 hover:border-amber-600/60 cursor-pointer'
                                  }`}
                                  title={isDisabled ? 'Não é possível alterar (valor preenchido)' : 'Clique para alterar status'}
                                >
                                  {isPago ? 'Pago' : 'Pendente'}
                                </button>
                              );
                            })()}
                            
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
            onClick={async () => {
              // 🔄 Auto-save ao fechar: SEMPRE salva antes de fechar
              console.log('💾 [Auto-save Payments] Salvando ao fechar modal...');
              try {
                // Cancela timeout pendente
                if (autoSaveTimeoutRef.current) {
                  clearTimeout(autoSaveTimeoutRef.current);
                }
                await handleSavePayments({ autoSave: true });
                console.log('✅ [Auto-save Payments] Salvo ao fechar!');
              } catch (error) {
                console.error('❌ [Auto-save Payments] Erro ao salvar ao fechar:', error);
              }
              
              closePaymentModal();
            }}
          >
            Fechar
            <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-white/10 rounded border border-white/20">Esc</kbd>
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Elemento oculto para gerar imagem do relatório */}
    <div 
      ref={relatorioRef}
      style={{
        position: 'fixed',
        left: '0',
        top: '0',
        width: '900px',
        minHeight: 'auto',
        padding: '30px',
        backgroundColor: '#ffffff !important',
        color: '#000000 !important',
        fontFamily: 'Arial, sans-serif',
        opacity: '0',
        visibility: 'hidden',
        zIndex: '-9999',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #000', backgroundColor: '#fff', color: '#000' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#000', letterSpacing: '0.5px', textAlign: 'center' }}>
          RELATÓRIO DE PAGAMENTOS
        </h1>
        
        {/* Informações do agendamento e resumo na mesma linha */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#000', fontWeight: '600' }}>
          {/* Informações do agendamento (esquerda) */}
          <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
            <div>
              <span style={{ fontWeight: '700' }}>Data:</span>
              <span style={{ marginLeft: '4px' }}>{editingBooking?.start ? new Date(editingBooking.start).toLocaleDateString('pt-BR') : '-'}</span>
            </div>
            <div>
              <span style={{ fontWeight: '700' }}>Quadra:</span>
              <span style={{ marginLeft: '4px' }}>{editingBooking?.court || '-'}</span>
            </div>
            <div>
              <span style={{ fontWeight: '700' }}>Código:</span>
              <span style={{ marginLeft: '4px' }}>{editingBooking?.code ? `#${editingBooking.code}` : '-'}</span>
            </div>
          </div>
          
          {/* Resumo (direita) */}
          <div style={{ display: 'flex', gap: '30px', textAlign: 'right' }}>
            <div>
              <span style={{ fontWeight: '700' }}>Total:</span>
              <strong style={{ marginLeft: '4px', color: '#000', fontSize: '11px', display: 'inline' }}>R$ {maskBRL(paymentTotal || 0)}</strong>
            </div>
            <div>
              <span style={{ fontWeight: '700' }}>Diferença:</span>
              <strong style={{ 
                marginLeft: '4px', 
                color: paymentSummary.diff < 0 ? '#dc2626' : '#16a34a',
                fontSize: '11px',
                display: 'inline'
              }}>
                {paymentSummary.diff < 0 ? '-' : ''}R$ {maskBRL(Math.abs(paymentSummary.diff).toFixed(2))}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '10px', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif', border: '1px solid #000', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ backgroundColor: '#cccccc', borderBottom: '1px solid #000' }}>
            <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '900', color: '#000', width: '5%', backgroundColor: '#cccccc', fontSize: '9px', border: '1px solid #000', wordWrap: 'break-word' }}>Nº</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '900', color: '#000', width: '35%', backgroundColor: '#cccccc', fontSize: '9px', border: '1px solid #000', wordWrap: 'break-word' }}>Nome</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '900', color: '#000', width: '10%', backgroundColor: '#cccccc', fontSize: '9px', border: '1px solid #000', wordWrap: 'break-word' }}>Código</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '900', color: '#000', width: '15%', backgroundColor: '#cccccc', fontSize: '9px', border: '1px solid #000', wordWrap: 'break-word' }}>Valor</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '900', color: '#000', width: '20%', backgroundColor: '#cccccc', fontSize: '9px', border: '1px solid #000', wordWrap: 'break-word' }}>Forma</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '900', color: '#000', width: '15%', backgroundColor: '#cccccc', fontSize: '9px', border: '1px solid #000', wordWrap: 'break-word' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const visibleParticipants = (localParticipantsForm || [])
              .filter((_, idx) => !(paymentHiddenIndexes || []).includes(idx));
            
            return visibleParticipants.map((p, index) => {
              const finalizadora = payMethods?.find(m => String(m.id) === String(p.finalizadora_id));
              const statusPago = p.status_pagamento === 'Pago';
              const cliente = localCustomers?.find(c => c.id === p.cliente_id);
              const isConsumidor = cliente?.is_consumidor_final;
              
              // Limitar nome a primeiro e segundo nome
              const nomeParts = (p.nome || 'Sem nome').trim().split(/\s+/);
              const nomeAbreviado = nomeParts.slice(0, 2).join(' ');
              
              // Mostrar 0 para consumidores, código normal para outros
              const codigoExibido = isConsumidor ? '0' : (p.codigo || 'N/A');
              
              return (
                <tr key={`participant-${index}-${p.cliente_id}`} data-participant-index={index} style={{ backgroundColor: '#fff' }}>
                  <td style={{ padding: '4px 2px', textAlign: 'center', color: '#000', backgroundColor: '#fff', fontSize: '10px', fontWeight: '600', border: '1px solid #000', wordWrap: 'break-word' }}>{index + 1}</td>
                  <td style={{ padding: '4px 2px', textAlign: 'left', color: '#000', backgroundColor: '#fff', fontSize: '10px', fontWeight: '600', border: '1px solid #000', wordWrap: 'break-word', overflow: 'hidden' }}>{nomeAbreviado}</td>
                  <td style={{ padding: '4px 2px', textAlign: 'center', color: '#000', fontSize: '10px', fontWeight: '600', backgroundColor: '#fff', border: '1px solid #000', wordWrap: 'break-word' }}>{codigoExibido}</td>
                  <td style={{ padding: '4px 2px', textAlign: 'center', color: '#000', backgroundColor: '#fff', fontSize: '10px', fontWeight: '600', border: '1px solid #000', wordWrap: 'break-word' }}>R$ {maskBRL(p.valor_cota || 0)}</td>
                  <td style={{ padding: '4px 2px', textAlign: 'center', color: '#000', fontSize: '10px', fontWeight: '600', backgroundColor: '#fff', border: '1px solid #000', wordWrap: 'break-word' }}>{finalizadora?.nome || 'N/D'}</td>
                  <td style={{ 
                    padding: '4px 2px', 
                    textAlign: 'center', 
                    fontWeight: '900',
                    color: statusPago ? '#16a34a' : '#ca8a04',
                    fontSize: '10px',
                    backgroundColor: '#fff',
                    border: '1px solid #000',
                    wordWrap: 'break-word'
                  }}>
                    {statusPago ? '✓ Pago' : '○ Pendente'}
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>

      {/* Respiro/Padding ao final da primeira página */}
      <div style={{ height: '2px', backgroundColor: '#fff' }}></div>

      {/* Rodapé */}
      <div style={{ marginTop: '2px', textAlign: 'center', fontSize: '10px', color: '#000', borderTop: '1px solid #000', paddingTop: '2px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff' }}>
        <div style={{ color: '#000', fontWeight: '500' }}>Gerado em: {new Date().toLocaleString('pt-BR')}</div>
        <div id="page-indicator" style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>
          {/* Será preenchido dinamicamente */}
        </div>
      </div>
    </div>
    
    {/* Dialog para adicionar participante */}
    <Dialog 
      open={isAddParticipantOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedParticipants([]);
          setAddParticipantSearch('');
        }
        setIsAddParticipantOpen(open);
      }}
    >
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          e.preventDefault();
          protectPaymentModal(2000);
          setIsAddParticipantOpen(false);
        }}
      >
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
                ref={addParticipantSearchRef}
                placeholder="Buscar por código ou nome..."
                value={addParticipantSearch}
                onChange={(e) => {
                  setAddParticipantSearch(e.target.value);
                  setFocusedAddParticipantIndex(0);
                }}
                onKeyDown={(e) => {
                  const searchLower = addParticipantSearch.toLowerCase().trim();
                  const filtered = (localCustomers || [])
                    .filter(cliente => {
                      if (!searchLower) return true;
                      const codigo = String(cliente.codigo || '');
                      const nome = (cliente.nome || '').toLowerCase();
                      return codigo.includes(searchLower) || nome.includes(searchLower);
                    });
                  const clienteConsumidor = filtered.find(c => c?.is_consumidor_final === true);
                  const clientesNormais = filtered.filter(c => c?.is_consumidor_final !== true);
                  const sortedNormais = clientesNormais.sort((a, b) => {
                    const codigoA = a.codigo || 0;
                    const codigoB = b.codigo || 0;
                    return codigoA - codigoB;
                  });
                  const finalList = clienteConsumidor ? [clienteConsumidor, ...sortedNormais] : sortedNormais;
                  
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedAddParticipantIndex(prev => Math.min(prev + 1, finalList.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedAddParticipantIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter' && finalList[focusedAddParticipantIndex]) {
                    e.preventDefault();
                    const cliente = finalList[focusedAddParticipantIndex];
                    const participantWithTimestamp = { ...cliente, timestamp: Date.now() };
                    setSelectedParticipants(prev => [...prev, participantWithTimestamp]);
                  }
                }}
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
                  // Proteger modal de pagamentos por 15 segundos (tempo para abrir e cancelar modal de cliente)
                  protectPaymentModal(15000);
                  
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
          <div ref={addParticipantListRef} className="border rounded-md max-h-[400px] overflow-y-auto">
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
              
              return finalList.map((cliente, listIndex) => {
                const isConsumidorFinal = cliente?.is_consumidor_final === true;
                const selectionCount = selectedParticipants.filter(p => p.id === cliente.id).length;
                const isFocused = listIndex === focusedAddParticipantIndex;
                
                return (
                  <div
                    key={cliente.id}
                    ref={(el) => { addParticipantButtonRefs.current[listIndex] = el; }}
                    role="button"
                    tabIndex={0}
                    className={`w-full px-4 py-3 text-left transition-all border-b border-border last:border-0 flex items-center gap-3 cursor-pointer ${
                      isFocused ? 'ring-2 ring-blue-500 ring-inset z-10' : ''
                    } ${
                      isConsumidorFinal
                        ? 'bg-gradient-to-r from-amber-500/5 to-transparent hover:from-amber-500/10 border-l-2 border-l-amber-500/40'
                        : selectionCount > 0 
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30' 
                          : 'hover:bg-surface-2'
                    }`}
                    onMouseEnter={() => setFocusedAddParticipantIndex(listIndex)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
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
                      {(() => {
                        const shouldShow = cliente.codigo !== null && cliente.codigo !== undefined;
                        return shouldShow ? (
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-colors ${
                            isConsumidorFinal 
                              ? 'bg-amber-500/15 text-amber-300/90 ring-1 ring-amber-500/20' 
                              : 'bg-emerald-600/20 text-emerald-400'
                          }`}>
                            #{cliente.codigo}
                          </span>
                        ) : null;
                      })()}
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
                            e.preventDefault();
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
                            e.preventDefault();
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                protectPaymentModal(1000); // Proteger modal de pagamentos
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
              onClick={(e) => {
                console.log('[AddParticipant] Botão Salvar clicado');
                e.preventDefault();
                e.stopPropagation();
                console.log('[AddParticipant] Protegendo modal de pagamentos (3000ms)');
                protectPaymentModal(3000); // Proteger modal de pagamentos por mais tempo
                
                console.log('[AddParticipant] Adicionando participantes:', selectedParticipants.length);
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
                
                setLocalParticipantsForm(prev => {
                  const currentLength = prev.length;
                  const newIndexes = newParticipants.map((_, i) => currentLength + i);
                  
                  // Destacar novos participantes por 1 segundo
                  setHighlightedIndexes(newIndexes);
                  setTimeout(() => {
                    setHighlightedIndexes([]);
                  }, 1000);
                  
                  return [...prev, ...newParticipants];
                });
                
                console.log('[AddParticipant] Fechando modal de adicionar participante');
                setIsAddParticipantOpen(false);
                setAddParticipantSearch('');
                setSelectedParticipants([]);
                console.log('[AddParticipant] Concluído');
              }}
            >
              Confirmar ({selectedParticipants.length})
              <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-emerald-700/50 rounded border border-emerald-500/30">↵</kbd>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal de Download do PDF */}
    <Dialog 
      open={isDownloadModalOpen} 
      onOpenChange={(open) => {
        console.log('🟢 [DownloadModal] onOpenChange chamado:', { open, downloadStatus });
        // Só permite fechar se estiver no estado de sucesso
        if (!open && downloadStatus === 'success') {
          console.log('✅ [DownloadModal] Fechando modal de download (sucesso)');
          setIsDownloadModalOpen(false);
        } else if (!open) {
          console.log('⚠️ [DownloadModal] BLOQUEADO: Ainda baixando');
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          // Impedir fechamento ao clicar fora durante download
          if (downloadStatus === 'downloading') {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Impedir fechamento com ESC durante download
          if (downloadStatus === 'downloading') {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {downloadStatus === 'downloading' ? 'Gerando PDF...' : 'PDF Gerado com Sucesso!'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {downloadStatus === 'downloading' 
              ? 'Aguarde enquanto o relatório de pagamentos está sendo gerado' 
              : 'Relatório de pagamentos gerado e baixado com sucesso'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          {downloadStatus === 'downloading' ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
              <p className="text-sm text-gray-500">Gerando seu relatório...</p>
              
              {/* Barra de progresso */}
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progresso</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-full bg-green-100 p-3">
                <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 text-center">
                Relatório baixado com sucesso!
              </p>
              <p className="text-xs text-gray-400 text-center">
                {pdfFileName}
              </p>
            </>
          )}
        </div>

        {downloadStatus === 'success' && (
          <div className="flex flex-col gap-2">
            {/* Botão Compartilhar - APENAS em dispositivos móveis */}
            {navigator.share && navigator.canShare && navigator.canShare({ files: [] }) && (
              <Button
                onClick={async () => {
                  if (!pdfBlob) {
                    toast({
                      title: 'Arquivo não disponível',
                      description: 'Tente gerar o PDF novamente.',
                      variant: 'destructive'
                    });
                    return;
                  }
                  
                  try {
                    console.log('📱 [PDF] Compartilhando via Web Share API...');
                    const file = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
                    await navigator.share({
                      files: [file],
                      title: 'Relatório de Pagamentos',
                      text: 'Confira o relatório de pagamentos'
                    });
                    console.log('✅ [PDF] Compartilhado com sucesso');
                    toast({
                      title: 'Compartilhado com sucesso!',
                      variant: 'success'
                    });
                  } catch (error) {
                    if (error.name === 'AbortError') {
                      console.log('ℹ️ [PDF] Compartilhamento cancelado');
                      return;
                    }
                    console.error('❌ [PDF] Erro ao compartilhar:', error);
                    toast({
                      title: 'Erro ao compartilhar',
                      description: error.message,
                      variant: 'destructive'
                    });
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Compartilhar
              </Button>
            )}
            
            <Button
              onClick={() => {
                if (pdfBlobUrl) {
                  console.log('📄 [PDF] Abrindo PDF em nova aba:', pdfBlobUrl);
                  window.open(pdfBlobUrl, '_blank');
                } else {
                  console.error('❌ [PDF] URL do blob não disponível');
                  toast({
                    title: 'Erro ao abrir PDF',
                    description: 'URL do PDF não está disponível.',
                    variant: 'destructive'
                  });
                }
              }}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Abrir PDF
            </Button>
            
            <p className="text-xs text-center text-gray-500 px-2">
              O PDF foi baixado. Abra-o para visualizar, imprimir ou compartilhar.
            </p>

            <Button
              onClick={() => setIsDownloadModalOpen(false)}
              variant="ghost"
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Mini Modal de Confirmação de Status */}
    <Dialog 
      open={statusConfirmationModal.isOpen} 
      onOpenChange={(open) => {
        // Bloquear qualquer tentativa de fechar nos primeiros 3 segundos
        if (!open && statusConfirmationProtectedRef.current) {
          console.log('🛡️ [StatusConfirmation] Bloqueado onOpenChange (protegido)');
          return;
        }
        if (!open) {
          console.log('🛡️ [StatusConfirmation] Fechando modal via onOpenChange');
          setStatusConfirmationModal({
            isOpen: false,
            participantIndex: null,
            currentStatus: null
          });
        }
      }}
    >
      <DialogContent 
        className="w-[95vw] sm:max-w-[400px]"
        onInteractOutside={(e) => {
          // Bloquear clique fora nos primeiros 3 segundos
          if (statusConfirmationProtectedRef.current) {
            console.log('🛡️ [StatusConfirmation] Bloqueado clique fora');
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Bloquear ESC nos primeiros 3 segundos
          if (statusConfirmationProtectedRef.current) {
            console.log('🛡️ [StatusConfirmation] Bloqueado ESC');
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Alterar Status de Pagamento</DialogTitle>
          <DialogDescription>
            {statusConfirmationModal.currentStatus === 'Pago' ? (
              <>Tem certeza que deseja marcar este participante como <strong>Pendente</strong>?</>
            ) : (
              <>Tem certeza que deseja marcar este participante como <strong>Pago</strong> mesmo sem valor registrado?</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm text-amber-400">
              {statusConfirmationModal.currentStatus === 'Pago' ? (
                <>⚠️ Esta ação marcará o participante como pendente novamente para refazer o pagamento.</>
              ) : (
                <>⚠️ Esta ação marcará o participante como pago sem um valor específico.</>
              )}
            </p>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            className="border border-white/10"
            onClick={() => {
              setStatusConfirmationModal({
                isOpen: false,
                participantIndex: null,
                currentStatus: null
              });
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => handleConfirmStatusChange(statusConfirmationModal.currentStatus === 'Pago' ? 'Pendente' : 'Pago')}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
