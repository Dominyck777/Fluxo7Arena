import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';

const ProtectedRoute = ({ children }) => {
  const { user, authReady } = useAuth();
  const location = useLocation();

  // Salvar a rota atual quando o usuário não estiver autenticado
  useEffect(() => {
    if (authReady && !user && location.pathname !== '/login') {
      try {
        sessionStorage.setItem('auth:returnUrl', location.pathname + location.search);
        console.log('[ProtectedRoute] Salvando rota de retorno:', location.pathname + location.search);
      } catch (e) {
        console.warn('[ProtectedRoute] Erro ao salvar rota de retorno:', e);
      }
    }
  }, [authReady, user, location.pathname, location.search]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <span className="text-text-primary font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return children;
};

export default ProtectedRoute;
