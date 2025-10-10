import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X, Eye, EyeOff, PanelLeft, PanelLeftClose, Lock, Unlock, Building, ArrowUpRight, Package, DollarSign, CalendarCheck, Clock, ShoppingCart, Store, Users, CalendarPlus, AlertTriangle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/contexts/AlertsContext';

function Header({ onToggleSidebar, sidebarVisible, sidebarPinned }) {
  const { toast } = useToast();
  const { signOut, userProfile, company, user } = useAuth();
  const { alerts, showModal, setShowModal, showBalloon, setShowBalloon } = useAlerts();
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(false);
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

  // Mostrar notificação quando há alertas (apenas uma vez por sessão)
  useEffect(() => {
    if (alerts.length > 0 && !sessionStorage.getItem('alerts-shown')) {
      setShowNotification(true);
      sessionStorage.setItem('alerts-shown', 'true');
      
      // Auto-hide após 5 segundos
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [alerts]);

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

  return (
    <motion.header
      initial={{ opacity: 0, y: -80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-surface/80 backdrop-blur-sm text-text-primary h-[72px] flex-shrink-0 flex items-center justify-between px-8 border-b border-border shadow-[0_1px_0_RGBA(255,255,255,0.04)]"
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
          className="h-12 w-12 hover:bg-surface-2/60 transition-colors"
        >
          {/* Mobile: Menu (3 traços) */}
          <Menu className={`w-7 h-7 md:hidden transition-colors ${sidebarVisible ? 'text-brand' : 'text-text-primary'}`} />
          {/* Desktop: PanelLeft (ícone de painel) */}
          {sidebarVisible ? (
            <PanelLeftClose className="w-7 h-7 hidden md:block text-brand transition-colors" />
          ) : (
            <PanelLeft className="w-7 h-7 hidden md:block text-text-primary transition-colors" />
          )}
          {/* Indicador de fixação (desktop) */}
          <span className="hidden md:inline-flex items-center justify-center ml-1">
            {sidebarPinned ? (
              <Lock className="w-3.5 h-3.5 text-brand/80" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-text-secondary" />
            )}
          </span>
        </Button>
        <div
          className="group pl-3 pr-5 py-1.5 rounded-full border border-white/10 bg-gradient-to-b from-surface-2/60 to-surface/60 text-text-primary flex items-center gap-4 shadow-sm hover:border-white/20 transition-colors"
          title={companyName}
        >
          <div className="relative w-11 h-11 shrink-0 rounded-full overflow-hidden border border-white/10 ring-2 ring-brand/30 ring-offset-0 bg-surface-2/60 grid place-items-center shadow-[0_0_0_3px_RGBA(0,0,0,0.2)]">
            {companyLogoSrc ? (
              <img src={companyLogoSrc} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building className="w-6 h-6 opacity-80" />
            )}
          </div>
          <span className="tracking-tight max-w-[240px] md:max-w-[320px] truncate leading-[44px] text-base text-text-primary font-semibold">
            {companyName}
          </span>
        </div>
        {/* Data removida conforme solicitado */}
      </div>

      {/* Título central da aba atual (overlay centralizado) - Oculto em mobile */}
      {pageTitle ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-text-primary">{pageTitle}</h1>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
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
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-text-secondary hover:text-brand hover:bg-brand/10 transition-colors duration-200">
          <LogOut className="h-5 w-5" />
        </Button>
        <div className="w-px h-8 bg-border mx-2"></div>
        <div
          className="group pl-4 pr-4 py-1.5 rounded-full border border-white/10 bg-gradient-to-b from-surface-2/60 to-surface/60 text-text-primary flex items-center gap-3 shadow-sm hover:border-white/20 transition-colors"
          title={`${userName} • ${userRole}`}
        >
          <span className="text-sm font-semibold truncate max-w-[180px]">{userName}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/15 text-brand font-medium tracking-wide">{userRole}</span>
        </div>
      </div>

      {/* Notificação de Alertas */}
      {showNotification && alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="absolute top-20 right-8 bg-surface border border-border rounded-lg shadow-2xl p-4 max-w-sm z-50"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand" />
              Novos Alertas ({alerts.length})
            </h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowNotification(false)}
              className="h-6 w-6 p-0 text-text-muted hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1 text-xs">
            {alerts.slice(0, 3).map((alert, idx) => {
              const Icon = getIcon(alert.icone);
              const colorClass = getColorClass(alert.cor);
              return (
                <div key={idx} className="flex items-center gap-2 p-1">
                  <Icon className={`w-3 h-3 ${colorClass}`} />
                  <span className="text-text-secondary truncate">{alert.mensagem}</span>
                </div>
              );
            })}
            {alerts.length > 3 && (
              <div className="text-center pt-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowModal(true);
                    setShowNotification(false);
                  }}
                  className="text-xs text-brand hover:text-brand/80"
                >
                  Ver todos ({alerts.length})
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

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