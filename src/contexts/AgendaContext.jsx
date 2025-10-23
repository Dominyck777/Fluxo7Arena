import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

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
  const lastVisibilityChangeRef = useRef(0);
  
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
  
  // Abrir modal de pagamentos
  const openPaymentModal = useCallback(() => {
    setIsPaymentModalOpen(true);
  }, []);
  
  // Fechar modal de pagamentos (com proteção)
  const closePaymentModal = useCallback(() => {
    const now = Date.now();
    
    if (modalProtectionRef.current.isProtected && now < modalProtectionRef.current.protectedUntil) {
      return false;
    }
    
    // Bloquear fechamento se aconteceu logo após mudança de visibilidade (500ms)
    const timeSinceVisibilityChange = Date.now() - lastVisibilityChangeRef.current;
    if (timeSinceVisibilityChange < 500) {
      return false;
    }
    
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
    
    // Desproteger modal de pagamentos após 500ms
    setTimeout(() => {
      modalProtectionRef.current.isProtected = false;
    }, 500);
  }, []);
  
  // Listener para rastrear mudanças de visibilidade
  useEffect(() => {
    const handleVisibilityChange = () => {
      lastVisibilityChangeRef.current = Date.now();
    };
    
    const handleFocus = () => {
      lastVisibilityChangeRef.current = Date.now();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
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
    protectPaymentModal
  };
  
  return (
    <AgendaContext.Provider value={value}>
      {children}
    </AgendaContext.Provider>
  );
};
