import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import FinanceiroPage from '@/pages/FinanceiroPage';
import QuadrasPage from '@/pages/QuadrasPage';
import EmpresasPage from '@/pages/EmpresasPage';
import FinalizadorasPage from '@/pages/FinalizadorasPage.new';
import TestPage from '@/pages/TestPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import HistoricoComandasPage from '@/pages/HistoricoComandasPage';
import CreateCompanyPage from '@/pages/CreateCompanyPage';
import AlterarSenhaObrigatorioPage from '@/pages/AlterarSenhaObrigatorioPage';
import PrimeiroAcessoGuard from '@/components/PrimeiroAcessoGuard';
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
      {/* Rotas públicas */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/40028922" element={<CreateCompanyPage />} />
      
      {/* Rota de troca de senha obrigatória (protegida mas sem guard) */}
      <Route path="/alterar-senha-obrigatorio" element={
        <ProtectedRoute>
          <AlterarSenhaObrigatorioPage />
        </ProtectedRoute>
      } />
      
      {/* Todas as demais rotas protegidas com guard de primeiro acesso */}
      <Route path="/*" element={
        <ProtectedRoute>
          <PrimeiroAcessoGuard>
            <PrivateApp />
          </PrimeiroAcessoGuard>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;
