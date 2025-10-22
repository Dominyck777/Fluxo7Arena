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
  
  // Função para proteger o modal de pagamentos por um tempo
  const protectPaymentModal = useCallback((durationMs = 500) => {
    modalProtectionRef.current = {
      isProtected: true,
      protectedUntil: Date.now() + durationMs
    };
    
    // Desproteger após o tempo
    setTimeout(() => {
      modalProtectionRef.current.isProtected = false;
    }, durationMs);
  }, []);
  
  // Abrir modal de pagamentos
  const openPaymentModal = useCallback(() => {
    setIsPaymentModalOpen(true);
  }, []);
  
  // Fechar modal de pagamentos (com proteção)
  const closePaymentModal = useCallback(() => {
    if (modalProtectionRef.current.isProtected && Date.now() < modalProtectionRef.current.protectedUntil) {
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
    
    // Proteger modal de pagamentos
    protectPaymentModal(1000); // Protege por 1 segundo
  }, [protectPaymentModal]);
  
  // Fechar modal de edição de participante
  const closeEditParticipantModal = useCallback(() => {
    setIsEditParticipantModalOpen(false);
    setEditParticipantData({ participantId: null, participantName: '' });
    
    // Proteger modal de pagamentos ao fechar
    protectPaymentModal(500);
  }, [protectPaymentModal]);
  
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
