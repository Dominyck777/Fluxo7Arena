import React from 'react';
import { Calendar, Bell, LogOut, Building, SidebarClose, SidebarOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/contexts/AuthContext';

function Header({ onToggleSidebar, sidebarVisible }) {
  const { toast } = useToast();
  const { signOut, userProfile, company, user } = useAuth();
  const userName = userProfile?.nome || 'Usuário';
  const userRole = userProfile?.cargo || userProfile?.papel || '—';
  // Garantir exibição do nome real da empresa mesmo durante hidratação
  let cachedCompanyName = '';
  try {
    const raw = localStorage.getItem('auth:company');
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedCompanyName = parsed?.nome_fantasia || parsed?.razao_social || parsed?.nome || parsed?.codigo_empresa || '';
      // cache simples da logo
      var cachedLogo = parsed?.logo_url || '';
    }
  } catch {}
  const companyName = company?.nome_fantasia || company?.razao_social || company?.nome || company?.codigo_empresa || cachedCompanyName || 'Empresa não vinculada';
  const companyLogo = company?.logo_url || (typeof cachedLogo !== 'undefined' ? cachedLogo : '');
  // Cache-buster para garantir atualização visual quando a logo for trocada mas a URL base se mantiver
  const companyLogoSrc = React.useMemo(() => {
    if (company?.logo_url) return `${company.logo_url}?v=${Date.now()}`;
    return companyLogo || '';
  }, [company?.logo_url]);

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! 🚧",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! 🚀",
      variant: "default",
    });
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

  return (
    <motion.header
      initial={{ opacity: 0, y: -80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="bg-surface/80 backdrop-blur-sm text-text-primary h-[72px] flex-shrink-0 flex items-center justify-between px-8 border-b border-border shadow-[0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
          className={`rounded-full transition-colors ${sidebarVisible
            ? 'bg-brand/20 border-brand/50 text-brand hover:bg-brand/30'
            : 'border-border/60 bg-surface hover:bg-surface-2/60 text-text-primary'}`}
        >
          {sidebarVisible ? (
            <SidebarClose className="w-5 h-5" />
          ) : (
            <SidebarOpen className="w-5 h-5" />
          )}
        </Button>
        <div
          className="group pl-3 pr-5 py-1.5 rounded-full border border-white/10 bg-gradient-to-b from-surface-2/60 to-surface/60 text-text-primary flex items-center gap-4 shadow-sm hover:border-white/20 transition-colors"
          title={companyName}
        >
          <div className="relative w-11 h-11 shrink-0 rounded-full overflow-hidden border border-white/10 ring-2 ring-brand/30 ring-offset-0 bg-surface-2/60 grid place-items-center shadow-[0_0_0_3px_rgba(0,0,0,0.2)]">
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

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleNotImplemented} className="text-text-secondary hover:text-text-primary transition-colors duration-200">
          <Bell className="h-5 w-5" />
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
    </motion.header>
  );
}

export default Header;