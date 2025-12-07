import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AlertsProvider } from '@/contexts/AlertsContext';
import { ModalsProvider } from '@/contexts/ModalsContext';
import { AgendaProvider } from '@/contexts/AgendaContext';
import DashboardPage from '@/pages/DashboardPage';
import AgendaPage from '@/pages/AgendaPage';
import VendasPage from '@/pages/VendasPage';
import BalcaoPage from '@/pages/BalcaoPage';
import ProdutosPage from '@/pages/ProdutosPage';
import ComprasPage from '@/pages/ComprasPage';
import ClientesPage from '@/pages/ClientesPage';
import EquipePage from '@/pages/EquipePage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import SuportePage from '@/pages/SuportePage';
import FinanceiroPage from '@/pages/FinanceiroPage';
import QuadrasPage from '@/pages/QuadrasPage';
import EmpresasPage from '@/pages/EmpresasPage';
import FinalizadorasPage from '@/pages/FinalizadorasPage';
import TestPage from '@/pages/TestPage';
import BackendDeployPage from '@/pages/BackendDeployPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import IsisPremiumPage from '@/pages/IsisPremiumPage';
import HistoricoComandasPage from '@/pages/HistoricoComandasPage';
import PrintComandaPage from '@/pages/PrintComandaPage';
import CreateCompanyPage from '@/pages/CreateCompanyPage';
import IsisBookingPage from '@/pages/IsisBookingPage';
import MaintenancePage from '@/pages/MaintenancePage';
import { Helmet } from 'react-helmet';
import { FORCE_MAINTENANCE } from '@/lib/maintenanceConfig';

function PrivateApp() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const handleSidebarButton = () => {
    // Simplesmente alterna visibilidade em qualquer dispositivo
    setSidebarVisible((v) => !v);
  };
  const location = useLocation();
  const navigate = useNavigate();
  const isAgendaPage = location.pathname === '/agenda';

  // Hotkeys globais (B e H) - funcionam em qualquer página
  useEffect(() => {
    const handler = (e) => {
      // Ignorar quando digitando em campos de texto
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (['input','textarea','select'].includes(tag) || e.target?.isContentEditable) return;
      if (e.repeat) return;

      // B: Alternar entre Mesas (/vendas) e Balcão (/balcao)
      if (String(e.key).toLowerCase() === 'b') {
        e.preventDefault();
        const path = String(location?.pathname || '').toLowerCase();
        console.log('[Global Hotkey B] Current path:', path);
        if (path.includes('balcao')) {
          console.log('[Global Hotkey B] Navigating to /vendas');
          navigate('/vendas');
        } else {
          console.log('[Global Hotkey B] Navigating to /balcao');
          navigate('/balcao');
        }
        return;
      }

      // H: Ir para Histórico
      if (String(e.key).toLowerCase() === 'h') {
        e.preventDefault();
        navigate('/historico');
        return;
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [location, navigate]);

  return (
    <ModalsProvider>
      <AlertsProvider>
        <AgendaProvider>
          <div className="relative flex h-screen bg-background text-text-primary">
            <Helmet>
              <title>F7 Arena</title>
              <meta name="description" content="Software para gestão de quadras esportivas." />
            </Helmet>

            <Sidebar isVisible={sidebarVisible} setIsVisible={setSidebarVisible} sidebarPinned={sidebarPinned} />

            {/* Overlay mobile: fecha sidebar ao clicar fora (sidebar agora sobrepõe conteúdo) */}
            {sidebarVisible && (
              <button
                type="button"
                onClick={() => setSidebarVisible(false)}
                className="md:hidden fixed inset-0 z-30 bg-black/40"
                aria-label="Fechar menu lateral"
              />
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
              <Header onToggleSidebar={handleSidebarButton} sidebarVisible={sidebarVisible} sidebarPinned={sidebarPinned} />
              <main className={cn("flex-1 overflow-x-hidden overflow-y-auto bg-background", isAgendaPage ? "p-0 md:p-8" : "p-8")}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/agenda" element={<AgendaPage sidebarVisible={sidebarVisible} />} />
                  <Route path="/isis" element={<IsisPremiumPage />} />
                  <Route path="/vendas" element={<VendasPage />} />
                  <Route path="/balcao" element={<BalcaoPage />} />
                  <Route path="/produtos" element={<ProdutosPage />} />
                  <Route path="/compras" element={<ComprasPage />} />
                  <Route path="/clientes" element={<ClientesPage />} />
                  <Route path="/equipe" element={<EquipePage />} />
                  <Route path="/financeiro" element={<FinanceiroPage />} />
                  <Route path="/caixa" element={<Navigate to="/financeiro?tab=caixa" replace />} />
                  <Route path="/quadras" element={<QuadrasPage />} />
                  <Route path="/empresas" element={<EmpresasPage />} />
                  <Route path="/finalizadoras" element={<FinalizadorasPage />} />
                  <Route path="/test-page" element={<TestPage />} />
                  <Route path="/historico" element={<HistoricoComandasPage />} />
                  <Route path="/suporte" element={<SuportePage />} />
                </Routes>
              </main>
            </div>
          </div>
        </AgendaProvider>
      </AlertsProvider>
    </ModalsProvider>
  );
}

function App() {
  const location = useLocation();
  const [bypassed, setBypassed] = useState(false);
  const [active, setActive] = useState(false);
  const envMaintenance = String(import.meta.env.VITE_MAINTENANCE_MODE || '').toLowerCase() === 'true';

  // Detecta subdomínio para experiência da Ísis Cliente: nomedaempresa.f7arena.com
  const hostNomeFantasia = React.useMemo(() => {
    try {
      if (typeof window === 'undefined') return null;
      const host = window.location.host || '';
      const base = 'f7arena.com';
      if (!host.endsWith(base)) return null;
      const sub = host.slice(0, -base.length).replace(/\.$/, '').toLowerCase();
      if (!sub || sub === 'www') return null;
      return sub;
    } catch { return null; }
  }, []);

  useEffect(() => {
    try {
      const computeActive = () => {
        const isActive = localStorage.getItem('maintenance:active') === 'true';
        const end = localStorage.getItem('maintenance:end');
        if (isActive && end) {
          const now = new Date();
          if (now > new Date(end)) {
            localStorage.removeItem('maintenance:active');
            return false;
          }
        }
        return isActive;
      };

      setBypassed(localStorage.getItem('maintenance:bypass') === '1');
      setActive(computeActive());

      // Escutar mudanças de storage (multi-aba)
      const onStorage = (e) => {
        if (!e || !e.key) {
          setActive(computeActive());
          setBypassed(localStorage.getItem('maintenance:bypass') === '1');
          return;
        }
        if (e.key === 'maintenance:bypass') setBypassed(e.newValue === '1');
        if (e.key === 'maintenance:active' || e.key === 'maintenance:end') setActive(computeActive());
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    } catch {}
  }, []);

  const maintenanceActive = Boolean(FORCE_MAINTENANCE) || envMaintenance || active;
  const isBypassed = (() => {
    try {
      const ls = localStorage.getItem('maintenance:bypass') === '1';
      const ss = (() => { try { return sessionStorage.getItem('maintenance:bypass') === '1'; } catch { return false; } })();
      const ck = (() => {
        try { return document.cookie.split(';').some(c => c.trim() === 'fx_maint_bypass=1'); } catch { return false; }
      })();
      return ls || ss || ck;
    } catch { return false; }
  })();

  if (maintenanceActive && !isBypassed) {
    return (
      <Routes>
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="*" element={<Navigate to="/maintenance" replace />} />
      </Routes>
    );
  }

  // Se estamos em um subdomínio (nomedaempresa.f7arena.com), roteia tudo para a página da Ísis
  if (hostNomeFantasia) {
    return (
      <Routes>
        <Route path="/*" element={<IsisBookingPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/40028922" element={<CreateCompanyPage />} />
      <Route path="/agendar/:nomeFantasia" element={<IsisBookingPage />} />
      
      {/* Opcional: manter rota de manutenção acessível mesmo quando inativo */}
      <Route path="/maintenance" element={<MaintenancePage />} />
      {/* Painel interno para alternar branch/maintenance (local override) */}
      <Route path="/backenddeploy" element={<BackendDeployPage />} />
      
      {/* Rota de impressão sem layout */}
      <Route path="/print-comanda" element={
        <ProtectedRoute>
          <PrintComandaPage />
        </ProtectedRoute>
      } />
      
      {/* Todas as demais rotas protegidas */}
      <Route path="/*" element={
        <ProtectedRoute>
          <PrivateApp />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;
