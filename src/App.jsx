import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardPage from '@/pages/DashboardPage';
import AgendaPage from '@/pages/AgendaPage';
import VendasPage from '@/pages/VendasPage';
import ProdutosPage from '@/pages/ProdutosPage';
import ClientesPage from '@/pages/ClientesPage';
import EquipePage from '@/pages/EquipePage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import FinanceiroPage from '@/pages/FinanceiroPage';
import QuadrasPage from '@/pages/QuadrasPage';
import EmpresasPage from '@/pages/EmpresasPage';
import FinalizadorasPage from '@/pages/FinalizadorasPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import { Helmet } from 'react-helmet';

function PrivateApp() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const toggleSidebar = () => setSidebarVisible(v => !v);

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Helmet>
          <title>Fluxo7 Arena - Gestão de Quadras</title>
          <meta name="description" content="Software completo para gestão de quadras esportivas." />
      </Helmet>
      
      {sidebarVisible && <Sidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={toggleSidebar} sidebarVisible={sidebarVisible} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/vendas" element={<VendasPage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/equipe" element={<EquipePage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/quadras" element={<QuadrasPage />} />
            <Route path="/empresas" element={<EmpresasPage />} />
            <Route path="/finalizadoras" element={<FinalizadorasPage />} />
            <Route path="/suporte" element={<PlaceholderPage title="Suporte" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Rota pública para redefinição de senha */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
