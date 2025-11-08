import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
    
    const hidden = paymentHiddenIndexes || [];
    
    setLocalParticipantsForm(prev => {
      const newList = [...prev];
      newList.forEach((p, idx) => {
        if (!hidden.includes(idx)) {
          newList[idx] = { 
            ...newList[idx], 
            valor_cota: masked, 
            status_pagamento: 'Pago',
            aplicar_taxa: false // Desmarca taxa ao dividir igualmente
          };
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
      const saveTimestamp = new Date().toISOString();
      console.log(`\n\n========== SALVAMENTO INICIADO ${saveTimestamp} ==========`);
      console.log('\ud83d\uddd1\ufe0f DELETANDO participantes antigos:', { agendamentoId, codigo });
      const { error: delErr } = await supabase
        .from('agendamento_participantes')
        .delete()
        .eq('codigo_empresa', codigo)
        .eq('agendamento_id', agendamentoId);
      
      if (delErr) {
        console.error('\u274c ERRO ao deletar:', delErr);
      } else {
        console.log('\u2705 Participantes antigos deletados');
      }
        
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
        
        const rowData = {
          codigo_empresa: codigo,
          agendamento_id: agendamentoId,
          cliente_id: p.cliente_id,
          nome: p.nome,
          valor_cota: Number.isFinite(valor) ? valor : 0,
          status_pagamento: p.status_pagamento || 'Pendente',
          finalizadora_id: finId,
          aplicar_taxa: p.aplicar_taxa || false,
        };
        
        console.log(`\ud83d\udcbe SALVAR: ${p.nome} | Valor: ${p.valor_cota} \u2192 ${rowData.valor_cota} | Fin: ${finId?.slice(-4)} | Taxa: ${rowData.aplicar_taxa} | Status: ${rowData.status_pagamento}`);
        
        return rowData;
      });
      
      console.log(`\ud83d\udcbe TOTAL A SALVAR: ${rows.length} participantes`);
      console.log('\ud83d\udcbe AGENDAMENTO ID:', agendamentoId);
      console.log('\ud83d\udcbe EMPRESA:', codigo);
      
      // Inserir novos registros
      if (rows.length > 0) {
        console.log('\ud83d\udcbe INSERINDO no banco...');
        const { data, error } = await supabase
          .from('agendamento_participantes')
          .insert(rows)
          .select();
          
        if (error) {
          console.error('\u274c ERRO ao inserir:', error);
          toast({ 
            title: 'Erro ao salvar pagamentos', 
            description: 'Falha ao inserir pagamentos.', 
            variant: 'destructive' 
          });
          throw error;
        }
        
        console.log('\u2705 INSERT bem-sucedido! Registros inseridos:', data?.length || 0);
        console.log('========== SALVAMENTO CONCLU\u00cdDO ==========\n\n');
        
        if (data && data.length > 0) {
          data.forEach((row, idx) => {
            console.log(`\u2705 SALVO #${idx + 1}: ${row.nome} | Valor: ${row.valor_cota} | Fin: ${row.finalizadora_id?.slice(-4)} | Taxa: ${row.aplicar_taxa} | Status: ${row.status_pagamento}`);
          });
        }
      }
      
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
      
      // Recarregar alertas após salvar pagamentos (não bloqueia salvamento)
      loadAlerts().catch(err => {
        console.error('[PaymentModal] Erro ao recarregar alertas:', err);
      });
      
      // Só fecha o modal se NÃO for auto-save
      if (!autoSave) {
        closePaymentModal();
        setIsModalOpen(false);
      }
      
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
      // Timeout para detectar se finalizadoras não carregam (3 segundos)
      loadingTimeoutRef.current = setTimeout(() => {
        if (!initializedRef.current && (!payMethods || payMethods.length === 0)) {
          // Inicializar mesmo sem finalizadoras após timeout
          
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
            const loadTimestamp = new Date().toISOString();
            console.log(`\n\n========== CARREGAMENTO INICIADO ${loadTimestamp} ==========`);
            console.log('🔍 BUSCANDO PARTICIPANTES DO BANCO...');
            console.log('🔍 Query params:', {
              agendamento_id: editingBooking.id,
              codigo_empresa: userProfile?.codigo_empresa
            });
            try {
              const { data: dbParticipants, error } = await supabase
                .from('agendamento_participantes')
                .select('*')
                .eq('agendamento_id', editingBooking.id)
                .eq('codigo_empresa', userProfile?.codigo_empresa);
              
              console.log('🔍 Resultado da query:', { 
                encontrados: dbParticipants?.length || 0, 
                erro: error,
                dados: dbParticipants
              });
              
              if (error) {
                console.error('❌ Erro ao buscar participantes:', error);
              } else if (dbParticipants && dbParticipants.length > 0) {
                console.log(`✅ ${dbParticipants.length} participantes encontrados no banco`);
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
                console.log('⚠️ Nenhum participante encontrado no banco!');
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
          const withCodes = sourceData.map(p => {
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
          
          // ALERTA CRÍTICO: Se não encontrou participantes em nenhuma fonte
          if (withCodes.length === 0 && editingBooking?.id) {
            console.error('\ud83d\udea8 ALERTA CRÍTICO: Nenhum participante encontrado em NENHUMA fonte!');
            console.error('\ud83d\udea8 Agendamento ID:', editingBooking.id);
            console.error('\ud83d\udea8 Empresa:', userProfile?.codigo_empresa);
            console.error('\ud83d\udea8 Isso pode indicar perda de dados!');
            
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
          
          console.log(`\ud83d\udcc2 CARREGANDO: ${withCodes.length} participantes de ${dataSource}`);
          console.log('========== CARREGAMENTO CONCLU\u00cdDO ==========\n\n');
          
          withCodes.forEach((p, idx) => {
            console.log(`\ud83d\udcc2 #${idx + 1}: ${p.nome} (cod:${p.codigo}) | Valor: ${p.valor_cota} | Fin: ${p.finalizadora_id?.slice(-4)} | Taxa: ${p.aplicar_taxa} | Status: ${p.status_pagamento}`);
          });
          
          // Só atualizar se tiver dados OU se for novo agendamento
          if (withCodes.length > 0 || !editingBooking?.id) {
            setLocalParticipantsForm(withCodes);
            initializedRef.current = Date.now();
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
  
  // ✅ AUTO-SAVE: Salva automaticamente ao detectar mudanças
  useEffect(() => {
    if (!isPaymentModalOpen) {
      autoSaveEnabledRef.current = false;
      lastSavedFormRef.current = null;
      return;
    }
    
    // Aguarda inicialização completa (500ms após abrir)
    if (!autoSaveEnabledRef.current) {
      const timeout = setTimeout(() => {
        autoSaveEnabledRef.current = true;
        lastSavedFormRef.current = JSON.stringify(localParticipantsForm);
      }, 500);
      return () => clearTimeout(timeout);
    }
    
    // Serializa form atual para comparar
    const currentForm = JSON.stringify(localParticipantsForm);
    
    // Se não houve mudança real, não faz nada
    if (currentForm === lastSavedFormRef.current) {
      return;
    }
    
    // Limpa timeout anterior
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Debounce de 1.5 segundos
    autoSaveTimeoutRef.current = setTimeout(async () => {
      console.log('🔄 [Auto-save Payments] Salvando alterações...');
      setIsAutoSaving(true);
      
      try {
        await handleSavePayments({ autoSave: true });
        lastSavedFormRef.current = currentForm;
        console.log('✅ [Auto-save Payments] Salvo com sucesso!');
      } catch (error) {
        console.error('❌ [Auto-save Payments] Erro ao salvar:', error);
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

      // Dividir em grupos de 8
      const PARTICIPANTS_PER_PAGE = 8;
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
        
        // Atualizar indicador de página
        const pageIndicator = elemento.querySelector('#page-indicator');
        if (pageIndicator) {
          pageIndicator.textContent = `Página ${pageNum + 1} de ${totalPages}`;
        }
        
        // Temporariamente esconder participantes que não são desta página
        const allParticipantDivs = elemento.querySelectorAll('[data-participant-index]');
        allParticipantDivs.forEach((div, idx) => {
          div.style.display = (idx >= startIdx && idx < endIdx) ? 'block' : 'none';
        });

        console.log(`📄 [PDF] Capturando página ${pageNum + 1}/${totalPages} (participantes ${startIdx + 1}-${endIdx})`);
        
        // Criar container offscreen para renderização invisível
        const container = document.createElement('div');
        container.style.cssText = `
          position: fixed;
          left: 0;
          top: 0;
          width: 1px;
          height: 1px;
          overflow: hidden;
          opacity: 0.01;
          pointer-events: none;
          z-index: -1;
        `;
        document.body.appendChild(container);
        
        // Mover elemento para dentro do container offscreen
        const originalParent = elemento.parentNode;
        elemento.style.position = 'absolute';
        elemento.style.left = '0';
        elemento.style.top = '0';
        elemento.style.transform = 'none';
        elemento.style.visibility = 'visible';
        elemento.style.opacity = '1';
        elemento.style.pointerEvents = 'none';
        container.appendChild(elemento);

        // Aguardar renderização completa
        await new Promise(resolve => setTimeout(resolve, 600));

        console.log(`📸 [PDF] Renderizado offscreen, iniciando captura...`);

        // Capturar página com qualidade otimizada (mais leve)
        let canvas;
        try {
          canvas = await toJpeg(elemento, {
            quality: 0.85, // Reduzido para diminuir tamanho
            pixelRatio: 1.5, // Reduzido de 3 para 1.5 (muito mais leve)
            backgroundColor: '#1a1a1a',
            cacheBust: true,
            skipFonts: false,
            width: 2400, // Reduzido de 2800
            height: elemento.scrollHeight,
          });
          
          if (!canvas || canvas.length === 0) {
            throw new Error('Canvas vazio retornado pela captura');
          }
          
          console.log(`✅ [PDF] Página ${pageNum + 1} capturada (${canvas.length} bytes, ${elemento.scrollHeight}px altura)`);
        } catch (captureError) {
          console.error(`❌ [PDF] Erro ao capturar página ${pageNum + 1}:`, captureError);
          throw new Error(`Falha ao capturar página ${pageNum + 1}: ${captureError.message}`);
        }
        
        // Retornar elemento ao parent original
        originalParent.appendChild(elemento);
        document.body.removeChild(container);

        // Retornar elemento para posição original (fora da tela)
        elemento.style.position = 'fixed';
        elemento.style.left = '-9999px';
        elemento.style.top = '0';
        elemento.style.transform = 'none';
        elemento.style.visibility = 'hidden';
        elemento.style.zIndex = '-1';
        elemento.style.opacity = '1';
        elemento.style.pointerEvents = 'none';

        // Adicionar ao PDF
        if (pageNum > 0) {
          pdf.addPage();
        }

        // Adicionar imagem como JPEG (mais leve que PNG)
        pdf.addImage(canvas, 'JPEG', 0, 0, pdfWidth, pdfHeight, '', 'MEDIUM');
        console.log(`📑 [PDF] Página ${pageNum + 1} adicionada ao PDF`);
      }

      // Restaurar visibilidade de todos os participantes e limpar indicador
      if (relatorioRef.current) {
        const allParticipantDivs = relatorioRef.current.querySelectorAll('[data-participant-index]');
        allParticipantDivs.forEach(div => {
          div.style.display = 'block';
        });
        
        // Limpar indicador de página
        const pageIndicator = relatorioRef.current.querySelector('#page-indicator');
        if (pageIndicator) {
          pageIndicator.textContent = '';
        }
        
        // Garantir que elemento fique oculto
        relatorioRef.current.style.visibility = 'hidden';
        relatorioRef.current.style.zIndex = '-1';
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
        className="w-[95vw] sm:max-w-[1100px] max-h-[90vh] overflow-y-scroll"
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
            isModalProtected: isModalProtected,
            timestamp: new Date().toISOString()
          });
          
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
              clearTimeout(autoSaveTimeoutRef.current);
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
        left: '-9999px',
        top: '0',
        width: '2400px',
        minHeight: 'auto',
        padding: '60px',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, sans-serif',
        visibility: 'hidden',
        zIndex: '-1',
        pointerEvents: 'none',
      }}
    >
      <div style={{ marginBottom: '30px', textAlign: 'center', borderBottom: '3px solid #333', paddingBottom: '20px', backgroundColor: '#000' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#fff', margin: 0, padding: '15px 0' }}>
          RELATÓRIO DE PAGAMENTOS
        </h1>
      </div>

      <div style={{ marginBottom: '30px', backgroundColor: '#f5f5f5', padding: '30px', border: '2px solid #ddd' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px', fontSize: '26px' }}>
          <div>
            <span style={{ color: '#666' }}>Data:</span>
            <strong style={{ marginLeft: '10px', fontSize: '28px' }}>
              {editingBooking?.start ? new Date(editingBooking.start).toLocaleDateString('pt-BR') : ''}
            </strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Horário:</span>
            <strong style={{ marginLeft: '10px', fontSize: '28px' }}>
              {editingBooking?.start && editingBooking?.end 
                ? `${new Date(editingBooking.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${new Date(editingBooking.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Quadra:</span>
            <strong style={{ marginLeft: '10px', fontSize: '28px' }}>{editingBooking?.court || ''}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Modalidade:</span>
            <strong style={{ marginLeft: '10px', fontSize: '28px' }}>{editingBooking?.modality || ''}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Código:</span>
            <strong style={{ marginLeft: '10px', fontSize: '28px' }}>#{editingBooking?.code || ''}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Valor Total:</span>
            <strong style={{ marginLeft: '10px', color: '#16a34a', fontSize: '30px' }}>R$ {maskBRL(paymentTotal || 0)}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Diferença:</span>
            <strong style={{ 
              marginLeft: '10px', 
              color: paymentSummary.diff < 0 ? '#dc2626' : '#16a34a', 
              fontSize: '30px' 
            }}>
              {paymentSummary.diff < 0 ? '-' : ''}R$ {maskBRL(Math.abs(paymentSummary.diff).toFixed(2))}
            </strong>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginBottom: '20px', textAlign: 'center', borderBottom: '2px solid #ddd', paddingBottom: '15px', backgroundColor: '#000', padding: '10px 0' }}>
          PARTICIPANTES
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {(localParticipantsForm || [])
          .filter((_, idx) => !(paymentHiddenIndexes || []).includes(idx))
          .map((p, index) => (
            <div key={index} data-participant-index={index} style={{ backgroundColor: p.status_pagamento === 'Pago' ? '#f0fdf4' : '#fef9c3', padding: '30px', border: p.status_pagamento === 'Pago' ? '3px solid #16a34a' : '3px solid #ca8a04', borderRadius: '8px' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '18px', color: p.status_pagamento === 'Pago' ? '#16a34a' : '#ca8a04' }}>
                {index + 1}. {p.nome || 'Sem nome'} {p.status_pagamento === 'Pago' ? '✓' : '○'}
              </div>
              <div style={{ fontSize: '26px', color: '#333', lineHeight: '1.9' }}>
                <div><span style={{ color: '#666' }}>Código:</span> <strong style={{ marginLeft: '10px', fontSize: '28px' }}>{p.codigo || 'N/A'}</strong></div>
                <div><span style={{ color: '#666' }}>Valor:</span> <strong style={{ marginLeft: '10px', color: '#16a34a', fontSize: '30px' }}>R$ {maskBRL(p.valor_cota || 0)}</strong></div>
                <div><span style={{ color: '#666' }}>Status:</span> <strong style={{ marginLeft: '10px', fontSize: '28px' }}>{p.status_pagamento || 'Pendente'}</strong></div>
                <div><span style={{ color: '#666' }}>Forma:</span> <strong style={{ marginLeft: '10px', fontSize: '28px' }}>{payMethods.find(m => String(m.id) === String(p.finalizadora_id))?.nome || 'N/D'}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '16px', color: '#666', borderTop: '2px solid #ddd', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>Gerado em: {new Date().toLocaleString('pt-BR')}</div>
        <div id="page-indicator" style={{ fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
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
    </>
  );
}
