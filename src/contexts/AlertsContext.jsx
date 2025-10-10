import React, { createContext, useContext, useState } from 'react';

const AlertsContext = createContext();

export const AlertsProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBalloon, setShowBalloon] = useState(false);

  return (
    <AlertsContext.Provider value={{ 
      alerts, 
      setAlerts, 
      showModal, 
      setShowModal,
      showBalloon,
      setShowBalloon
    }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertsProvider');
  }
  return context;
};
