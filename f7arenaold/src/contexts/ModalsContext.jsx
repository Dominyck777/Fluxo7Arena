import React, { createContext, useContext, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

const ModalsContext = createContext();

export const useModals = () => {
  const context = useContext(ModalsContext);
  if (!context) {
    throw new Error('useModals must be used within ModalsProvider');
  }
  return context;
};

export const ModalsProvider = ({ children }) => {
  const [modals, setModals] = useState({
    payment: { open: false, data: null },
    editParticipant: { open: false, data: null },
  });
  
  const [protectedModals, setProtectedModals] = useState(new Set());

  const openModal = useCallback((modalName, data = null) => {
    console.log('🟢 [MODALS] Abrindo modal:', modalName, data);
    setModals(prev => ({
      ...prev,
      [modalName]: { open: true, data }
    }));
  }, []);

  const closeModal = useCallback((name) => {
    // Verifica se o modal está protegido
    if (protectedModals.has(name)) {
      console.log(`🛑 [ModalsContext] Modal "${name}" está protegido, ignorando fechamento`);
      return;
    }
    
    setModals(prev => ({
      ...prev,
      [name]: { open: false, data: {} }
    }));
  }, [protectedModals]);

  const isModalOpen = useCallback((name) => {
    return modals[name]?.open || false;
  }, [modals]);

  const getModalData = useCallback((name) => {
    return modals[name]?.data || {};
  }, [modals]);
  
  const protectModal = useCallback((name) => {
    console.log(`🛡️ [ModalsContext] Protegendo modal "${name}"`);
    setProtectedModals(prev => new Set([...prev, name]));
  }, []);
  
  const unprotectModal = useCallback((name) => {
    console.log(`✅ [ModalsContext] Desprotegendo modal "${name}"`);
    setProtectedModals(prev => {
      const newSet = new Set(prev);
      newSet.delete(name);
      return newSet;
    });
  }, []);

  return (
    <ModalsContext.Provider value={{ openModal, closeModal, isModalOpen, getModalData, protectModal, unprotectModal }}>
      {children}
    </ModalsContext.Provider>
  );
};

// HOC para renderizar modais em Portals (fora da hierarquia DOM)
export const ModalPortal = ({ children, isOpen }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999]">
      {children}
    </div>,
    document.body
  );
};
