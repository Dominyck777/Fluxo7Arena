import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardPage from '@/pages/DashboardPage';
import AgendaPage from '@/pages/AgendaPage';
import VendasPage from '@/pages/VendasPage';
import BalcaoPage from '@/pages/BalcaoPage';
import ProdutosPage from '@/pages/ProdutosPage';
import ClientesPage from '@/pages/ClientesPage';
import EquipePage from '@/pages/EquipePage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import SuportePage from '@/pages/SuportePage';
import FinanceiroPage from '@/pages/FinanceiroPage';
import QuadrasPage from '@/pages/QuadrasPage';
import EmpresasPage from '@/pages/EmpresasPage';
import FinalizadorasPage from '@/pages/FinalizadorasPage';
import TestPage from '@/pages/TestPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import HistoricoComandasPage from '@/pages/HistoricoComandasPage';
import CreateCompanyPage from '@/pages/CreateCompanyPage';
import { Helmet } from 'react-helmet';

function PrivateApp() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const handleSidebarButton = () => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        // Desktop: toggle pin. When pinning, ensure visible
        setSidebarPinned((p) => {
          const next = !p;
          if (next) setSidebarVisible(true);
          return next;
        });
      } else {
        // Mobile: just toggle visibility
        setSidebarVisible((v) => !v);
      }
    } catch {
      // Fallback safe toggle
      setSidebarVisible((v) => !v);
    }
  };
  const location = useLocation();
  const isAgendaPage = location.pathname === '/agenda';

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Helmet>
          <title>Fluxo7 Arena - Gestão de Quadras Esportivas</title>
          <meta name="description" content="Software para gestão de quadras esportivas." />
      </Helmet>
      
      <Sidebar isVisible={sidebarVisible} setIsVisible={setSidebarVisible} sidebarPinned={sidebarPinned} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={handleSidebarButton} sidebarVisible={sidebarVisible} sidebarPinned={sidebarPinned} />
        <main className={cn("flex-1 overflow-x-hidden overflow-y-auto bg-background", isAgendaPage ? "p-0 md:p-8" : "p-8")}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/vendas" element={<VendasPage />} />
            <Route path="/balcao" element={<BalcaoPage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/equipe" element={<EquipePage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
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
  );
}

function App() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/40028922" element={<CreateCompanyPage />} />
      
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
