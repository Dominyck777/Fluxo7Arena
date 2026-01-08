import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const AgendaContext = createContext();

export const useAgenda = () => {
  const context = useContext(AgendaContext);
  if (!context) {
    throw new Error('useAgenda must be used within AgendaProvider');
  }
  return context;
};

export const AgendaProvider = ({ children }) => {
  // Estados dos modais
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditParticipantModalOpen, setIsEditParticipantModalOpen] = useState(false);
  const [isAddBookingModalOpen, setIsAddBookingModalOpen] = useState(false);
  
  // Dados do modal de edição de participante
  const [editParticipantData, setEditParticipantData] = useState({
    participantId: null,
    participantName: ''
  });
  
  // Estado compartilhado de booking em edição
  const [editingBooking, setEditingBooking] = useState(null);
  
  // Estados de participantes e pagamentos
  const [participantsForm, setParticipantsForm] = useState([]);
  const [paymentTotal, setPaymentTotal] = useState('');
  const [payMethods, setPayMethods] = useState([]);
  
  // Form do agendamento (selectedClients, etc) - será setado pelo AddBookingModal
  const [bookingForm, setBookingForm] = useState(null);
  
  // Lista de clientes locais - será setada pelo AddBookingModal
  const [localCustomers, setLocalCustomers] = useState([]);
  
  // Ref para proteção de modal
  const modalProtectionRef = useRef({
    isProtected: false,
    protectedUntil: 0
  });
  
  // Ref para detectar mudanças de visibilidade
  // IMPORTANTE: Inicializa com Date.now() para evitar bug ao abrir modal pela primeira vez
  const lastVisibilityChangeRef = useRef(Date.now());
  
  // Ref para callback de substituição de participante
  const onParticipantReplacedRef = useRef(null);
  const location = useLocation();
  
  // Função para proteger modal de pagamentos de fechamento acidental
  const protectPaymentModal = useCallback((durationMs = 2000) => {
    const newProtectionUntil = Date.now() + durationMs;
    
    // Só atualizar se a nova proteção for mais longa que a atual
    if (newProtectionUntil > modalProtectionRef.current.protectedUntil) {
      modalProtectionRef.current.isProtected = true;
      modalProtectionRef.current.protectedUntil = newProtectionUntil;
    } else {
      return;
    }
    
    // Desproteger após o tempo APENAS se nenhuma proteção mais longa foi ativada
    setTimeout(() => {
      const now = Date.now();
      if (now >= modalProtectionRef.current.protectedUntil) {
        modalProtectionRef.current.isProtected = false;
      }
    }, durationMs);
  }, []);

  const unprotectPaymentModal = useCallback(() => {
    modalProtectionRef.current.isProtected = false;
    modalProtectionRef.current.protectedUntil = 0;
  }, []);
  
  // Abrir modal de pagamentos
  const openPaymentModal = useCallback(() => {
    setIsPaymentModalOpen(true);
  }, []);
  
  // Fechar modal de pagamentos (com proteção)
  const closePaymentModal = useCallback((opts = {}) => {
    const force = opts === true || (opts && opts.force === true);
    const now = Date.now();

    if (force) {
      setIsPaymentModalOpen(false);
      return true;
    }
    
    if (modalProtectionRef.current.isProtected && now < modalProtectionRef.current.protectedUntil) {
      const remainingMs = modalProtectionRef.current.protectedUntil - now;
      try { if (localStorage.getItem('debug:agenda') === '1') console.log(`🛡️ [PaymentModal] Fechamento bloqueado por proteção (${remainingMs}ms restantes)`); } catch {}
      return false;
    }
    
    // Bloquear fechamento se aconteceu logo após mudança de visibilidade (500ms)
    const timeSinceVisibilityChange = Date.now() - lastVisibilityChangeRef.current;
    if (timeSinceVisibilityChange < 500) {
      try { if (localStorage.getItem('debug:agenda') === '1') console.log('🛡️ [PaymentModal] Fechamento bloqueado por mudança de visibilidade recente'); } catch {}
      return false;
    }
    
    try { if (localStorage.getItem('debug:agenda') === '1') console.log('✅ [PaymentModal] Fechando modal (não protegido)'); } catch {}
    setIsPaymentModalOpen(false);
    return true;
  }, []);
  
  // Abrir modal de edição de participante
  const openEditParticipantModal = useCallback((participantId, participantName) => {
    setEditParticipantData({ participantId, participantName });
    setIsEditParticipantModalOpen(true);
    protectPaymentModal(3000);
  }, [protectPaymentModal]);
  
  // Fechar modal de edição de participante
  const closeEditParticipantModal = useCallback(() => {
    setIsEditParticipantModalOpen(false);
    setEditParticipantData({ participantId: null, participantName: '' });
    
    // Não força desproteger - deixa o timestamp expirar naturalmente
    // A proteção configurada por protectPaymentModal() irá expirar automaticamente
  }, []);
  
  // Listener para rastrear mudanças de visibilidade (apenas na rota de Agenda)
  useEffect(() => {
    const pathname = location?.pathname || '';
    const isOnAgenda = pathname.startsWith('/agenda');
    if (!isOnAgenda) {
      return () => {};
    }
    const handleVisibilityChange = () => {
      const newTime = Date.now();
      const wasHidden = document.hidden;
      try {
        if (localStorage.getItem('debug:agenda') === '1') {
          console.log('👁️ [AgendaContext] visibilitychange:', {
            hidden: wasHidden,
            timestamp: new Date().toISOString(),
            isPaymentModalOpen: isPaymentModalOpen
          });
        }
      } catch {}
      lastVisibilityChangeRef.current = newTime;
      
      // 🛡️ Se a aba voltou a ficar visível E o modal de pagamentos está aberto, proteger por 3s
      if (!wasHidden && isPaymentModalOpen) {
        try { if (localStorage.getItem('debug:agenda') === '1') console.log('🛡️ [AgendaContext] Aba restaurada com modal aberto - protegendo por 3s'); } catch {}
        const newProtectionUntil = Date.now() + 3000;
        modalProtectionRef.current.isProtected = true;
        modalProtectionRef.current.protectedUntil = newProtectionUntil;
      }
    };
    
    const handleFocus = () => {
      const newTime = Date.now();
      try {
        if (localStorage.getItem('debug:agenda') === '1') {
          console.log('🎯 [AgendaContext] window focus:', {
            timestamp: new Date().toISOString(),
            isPaymentModalOpen: isPaymentModalOpen
          });
        }
      } catch {}
      lastVisibilityChangeRef.current = newTime;
      
      // 🛡️ Se a janela ganhou foco E o modal de pagamentos está aberto, proteger por 3s
      if (isPaymentModalOpen) {
        try { if (localStorage.getItem('debug:agenda') === '1') console.log('🛡️ [AgendaContext] Janela ganhou foco com modal aberto - protegendo por 3s'); } catch {}
        const newProtectionUntil = Date.now() + 3000;
        modalProtectionRef.current.isProtected = true;
        modalProtectionRef.current.protectedUntil = newProtectionUntil;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isPaymentModalOpen, location?.pathname]);
  
  const value = {
    // Estados dos modais
    isPaymentModalOpen,
    isEditParticipantModalOpen,
    isAddBookingModalOpen,
    
    // Funções dos modais
    openPaymentModal,
    closePaymentModal,
    openEditParticipantModal,
    closeEditParticipantModal,
    setIsAddBookingModalOpen,
    
    // Dados compartilhados
    editParticipantData,
    editingBooking,
    setEditingBooking,
    participantsForm,
    setParticipantsForm,
    paymentTotal,
    setPaymentTotal,
    payMethods,
    setPayMethods,
    bookingForm,
    setBookingForm,
    localCustomers,
    setLocalCustomers,
    
    // Proteção
    protectPaymentModal,
    unprotectPaymentModal,
    
    // Callback de substituição
    onParticipantReplacedRef,
    
    // Timestamp de mudança de visibilidade
    get lastVisibilityChangeTime() {
      return lastVisibilityChangeRef.current;
    },
    
    // Verificar se modal está protegido
    get isModalProtected() {
      const now = Date.now();
      return modalProtectionRef.current.isProtected && now < modalProtectionRef.current.protectedUntil;
    }
  };
  
  return (
    <AgendaContext.Provider value={value}>
      {children}
    </AgendaContext.Provider>
  );
};
