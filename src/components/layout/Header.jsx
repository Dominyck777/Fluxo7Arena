import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X, Eye, EyeOff, PanelLeft, PanelLeftClose, Lock, Unlock, Building, ArrowUpRight, Package, DollarSign, CalendarCheck, Clock, ShoppingCart, Store, Users, CalendarPlus, AlertTriangle, Info, Link as LinkIcon, Copy } from 'lucide-react';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/contexts/AlertsContext';

function Header({ onToggleSidebar, sidebarVisible, sidebarPinned }) {
  const { toast } = useToast();
  const { signOut, userProfile, company, user } = useAuth();
  const { alerts, showModal, setShowModal } = useAlerts();
  const navigate = useNavigate();
  // Extrair apenas nome e sobrenome (primeiras duas palavras)
  const fullName = userProfile?.nome || 'Usuário';
  const userName = React.useMemo(() => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    return fullName;
  }, [fullName]);
  const userRole = userProfile?.cargo || userProfile?.papel || '—';
  // Garantir exibição do nome real da empresa mesmo durante hidratação
  let cachedCompanyName = '';
  try {
    const raw = localStorage.getItem('auth:company');
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedCompanyName = parsed?.nome_fantasia || parsed?.razao_social || parsed?.nome || parsed?.codigoEmpresa || '';
      // cache simples da logo
      var cachedLogo = parsed?.logo_url || '';
    }
  } catch {}
  const companyName = company?.nome_fantasia || company?.razao_social || company?.nome || company?.codigoEmpresa || cachedCompanyName || 'Empresa não vinculada';
  const companyLogo = company?.logo_url || (typeof cachedLogo !== 'undefined' ? cachedLogo : '');
  // Cache-buster para garantir atualização visual quando a logo for trocada mas a URL base se mantiver
  const companyLogoSrc = React.useMemo(() => {
    if (company?.logo_url) return `${company.logo_url}?v=${Date.now()}`;
    return companyLogo || '';
  }, [company?.logo_url]);

  // Balão de alertas removido - funcionalidade desabilitada

  const isDevTarget = React.useMemo(() => {
    try { return typeof window !== 'undefined' && String(window.__ACTIVE_TARGET || '').toLowerCase() === 'dev'; } catch { return false; }
  }, []);

  const getIcon = (iconName) => {
    const icons = {
      Package, DollarSign, CalendarCheck, Clock, ShoppingCart, Store, Users, CalendarPlus, AlertTriangle, Info
    };
    return icons[iconName] || AlertTriangle;
  };
  
  const getColorClass = (cor) => {
    const colors = {
      danger: 'text-danger',
      warning: 'text-warning',
      info: 'text-info',
      success: 'text-success',
      purple: 'text-purple'
    };
    return colors[cor] || 'text-warning';
  };

  const AlertItem = ({ alert, onClick }) => {
    const Icon = getIcon(alert.icone);
    const colorClass = getColorClass(alert.cor);
    
    return (
      <li 
        className="flex items-center gap-2 p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer group"
        onClick={onClick}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />
        <span className="text-text-secondary group-hover:text-text-primary transition-colors flex-1">
          {alert.mensagem}
        </span>
        {alert.link && (
          <ArrowUpRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </li>
    );
  };

  const handleLogout = async () => {
    console.log('[Header] Logout button clicked', { at: new Date().toISOString(), userBefore: !!user });
    const { error } = await signOut();
    console.log('[Header] Logout completed', { error, userAfter: !!user });
    if (error) {
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
        variant: "default",
      });
    }
  };

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const location = useLocation();
  const pageTitle = React.useMemo(() => {
    try {
      const pathname = String(location?.pathname || '');
      // Painel principal: não exibir título central
      if (pathname === '/' || pathname.startsWith('/dashboard')) return '';
      const map = [
        { key: '/agenda', label: 'Agenda' },
        { key: '/isis', label: 'Ísis' },
        { key: '/clientes', label: 'Clientes & Fornecedores' },
        { key: '/produtos', label: 'Produtos' },
        { key: '/vendas', label: 'Vendas' },
        { key: '/financeiro', label: 'Financeiro' },
        { key: '/balcao', label: 'Balcão' },
        { key: '/cadastros', label: 'Cadastros' },
        { key: '/quadras', label: 'Quadras' },
        { key: '/equipe', label: 'Equipe' },
        { key: '/finalizadoras', label: 'Finalizadoras' },
        { key: '/empresas', label: 'Empresas' },
        { key: '/configuracoes', label: 'Configurações' },
        { key: '/login', label: 'Login' },
      ];
      const found = map.find(m => pathname.startsWith(m.key));
      if (found) return found.label;
      // Fallback: usar título do documento antes de " - "
      if (typeof document !== 'undefined') {
        const raw = String(document.title || '');
        const base = raw.includes(' - ') ? raw.split(' - ')[0] : raw;
        return base || '';
      }
    } catch {}
    return '';
  }, [location?.pathname]);

  const isIsis = React.useMemo(() => String(location?.pathname || '').startsWith('/isis'), [location?.pathname]);

  // Gera slug da empresa para montar link público de agendamento
  const companySlug = React.useMemo(() => {
    const base = company?.nome_fantasia || company?.nome || company?.razao_social || company?.codigoEmpresa || cachedCompanyName || '';
    return String(base)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '') // remove espaços e símbolos
      .trim();
  }, [company?.nome_fantasia, company?.nome, company?.razao_social, company?.codigoEmpresa, cachedCompanyName]);

  const agendaPublicUrl = React.useMemo(() => {
    return companySlug ? `https://${companySlug}.f7arena.com` : '';
  }, [companySlug]);

  // Copia texto com fallback (igual padrão usado nas mensagens da Ísis)
  const copyTextWithFallback = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  return (
    <motion.header
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-surface/80 backdrop-blur-sm text-text-primary h-[72px] flex-shrink-0 flex items-center justify-between px-8 border-b border-border shadow-[0_1px_0_RGBA(255,255,255,0.04)]"
    >
      <div className="flex items-center gap-4 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
          className="h-12 w-12 hover:bg-surface-2/60 transition-colors"
        >
          {/* Menu (3 traços) em todas as versões - amarelo quando aberto */}
          <Menu className={`w-7 h-7 transition-colors ${sidebarVisible ? 'text-brand' : 'text-text-primary'}`} />
        </Button>
        <div
          className="group pl-3 pr-5 py-1.5 border border-white/10 bg-gradient-to-b from-surface-2/60 to-surface/60 text-text-primary flex items-center gap-4 shadow-sm hover:border-white/20 transition-colors overflow-hidden max-w-[36vw] md:max-w-[30vw] lg:max-w-[24vw]"
          title={companyName}
        >
          <div className="relative w-11 h-11 shrink-0 overflow-hidden border border-white/10 bg-surface-2/60 grid place-items-center shadow-[0_0_0_3px_RGBA(0,0,0,0.2)]">
            {companyLogoSrc ? (
              <img src={companyLogoSrc} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building className="w-6 h-6 opacity-80" />
            )}
          </div>
          <span className="tracking-tight truncate leading-[44px] text-base text-text-primary font-semibold flex-1 min-w-0">
            {companyName}
          </span>
          {/* Botão de copiar link de agendamento foi movido para a aba Agenda (no grid) */}
          {isDevTarget && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white shadow animate-pulse">
              Dev
            </span>
          )}
        </div>
        {/* Data removida conforme solicitado */}
      </div>

      {/* Título central da aba atual (overlay centralizado) - Oculto em mobile */}
      {isIsis ? (
        <div className="pointer-events-none absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <div className="flex items-center gap-3">
            <div className="rounded-full p-[2px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_12px_rgba(168,85,247,0.35)] w-8 h-8">
              <div className="rounded-full overflow-hidden bg-background w-full h-full">
                <IsisAvatar size="xs" className="w-8 h-8" />
              </div>
            </div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-text-primary">Ísis</h1>
          </div>
        </div>
      ) : pageTitle ? (
        <div className="pointer-events-none absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-text-primary">{pageTitle}</h1>
        </div>
      ) : null}

      <div className="flex items-center gap-1 md:gap-2">
        {!isIsis && (
          <Button
            variant="ghost"
            onClick={() => navigate('/isis')}
            className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-white/10 bg-surface/60 hover:bg-surface-2/70 hover:border-white/20 transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
          >
            <span className="inline-flex items-center justify-center rounded-full p-[2px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400">
              <span className="rounded-full overflow-hidden bg-background">
                <IsisAvatar size="xs" />
              </span>
            </span>
            <span className="text-sm font-semibold text-text-primary">Ísis</span>
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setShowModal(true)} 
          className="relative text-text-secondary hover:text-text-primary transition-colors duration-200"
        >
          <Bell className="h-5 w-5" />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {alerts.length}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-text-secondary hover:text-brand hover:bg-brand/10 transition-colors duration-200 shrink-0">
          <LogOut className="h-5 w-5" />
        </Button>
        <div className="w-px h-8 bg-border mx-1 md:mx-2"></div>
        <div
          className="group pl-2 pr-3 md:pl-4 md:pr-4 py-1.5 rounded-full border border-white/10 bg-gradient-to-b from-surface-2/60 to-surface/60 text-text-primary flex items-center gap-2 md:gap-3 shadow-sm hover:border-white/20 transition-colors"
          title={`${userName} • ${userRole}`}
        >
          <span className="text-xs md:text-sm font-semibold truncate max-w-[120px] md:max-w-[180px]">{userName}</span>
          <span className="text-[10px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full bg-brand/15 text-brand font-medium tracking-wide">{userRole}</span>
        </div>
      </div>

      {/* Balão de alertas removido */}

      {/* Modal de Alertas */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand" />
              Todos os Alertas ({alerts.length})
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {alerts.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Nenhum alerta no momento! 🎉</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.map((alert, idx) => (
                  <AlertItem 
                    key={idx} 
                    alert={alert}
                    onClick={() => {
                      if (alert.link) {
                        navigate(alert.link);
                        setShowModal(false);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.header>
  );
}

export default Header;


