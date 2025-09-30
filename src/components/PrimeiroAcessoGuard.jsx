import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Componente que verifica se o usuário está no primeiro acesso
 * e redireciona para a página de troca de senha obrigatória
 */
export default function PrimeiroAcessoGuard({ children }) {
  const { userProfile, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('[PrimeiroAcessoGuard] Verificando...', {
      authReady,
      hasProfile: !!userProfile,
      primeiro_acesso: userProfile?.primeiro_acesso,
      pathname: location.pathname,
    });

    // Só verificar após auth estar pronto
    if (!authReady) {
      console.log('[PrimeiroAcessoGuard] Auth não está pronto ainda');
      return;
    }

    // Se não tem perfil, não fazer nada
    if (!userProfile) {
      console.log('[PrimeiroAcessoGuard] Sem perfil de usuário');
      return;
    }

    // Se já está na página de troca de senha, não redirecionar
    if (location.pathname === '/alterar-senha-obrigatorio') {
      console.log('[PrimeiroAcessoGuard] Já está na página de troca de senha');
      return;
    }

    // Se é primeiro acesso, redirecionar
    if (userProfile.primeiro_acesso === true) {
      console.log('[PrimeiroAcessoGuard] ⚠️ Primeiro acesso detectado! Redirecionando...');
      navigate('/alterar-senha-obrigatorio', { replace: true });
    } else {
      console.log('[PrimeiroAcessoGuard] ✅ Não é primeiro acesso, liberado');
    }
  }, [userProfile, authReady, navigate, location.pathname]);

  return children;
}
