import React, { useMemo, useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, ShoppingCart, Users, UserCog, LifeBuoy, Settings, Trophy, Package, Wallet, ChevronDown, Layers, Building2, Banknote, Folder, CreditCard, ShoppingBag, Bot } from 'lucide-react';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Painel Principal' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/vendas', icon: ShoppingCart, label: 'Loja' },
  { to: '/financeiro', icon: Wallet, label: 'Financeiro' },
];

const navItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05 + 0.3,
      duration: 0.3,
      ease: 'easeOut',
    },
  }),
};

const NavItem = ({ to, icon: Icon, label, index, onNavigate }) => {
  const activeLink = "flex items-center h-[52px] px-4 rounded-sm bg-brand text-primary-foreground font-bold shadow-lg shadow-brand/10 border-l-4 border-brand w-full";
  const inactiveLink = "flex items-center h-[52px] px-4 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all duration-200 border-l-4 border-transparent w-full";

  return (
    <motion.li
      custom={index}
      variants={navItemVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      <NavLink
        to={to}
        onClick={onNavigate}
        className={({ isActive }) => {
          if (to === '/isis' && isActive) {
            return "flex items-center h-[52px] px-4 rounded-sm font-bold text-white shadow-lg shadow-emerald-500/10 border-l-4 border-transparent bg-gradient-to-r from-fuchsia-600 via-violet-600 to-emerald-600 ring-1 ring-white/10";
          }
          return isActive ? activeLink : inactiveLink;
        }}
      >
        {to === '/isis' ? (
          <span className="mr-4 flex-shrink-0 inline-flex items-center justify-center rounded-full p-[3px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_12px_rgba(168,85,247,0.35)]">
            <span className="rounded-full overflow-hidden bg-background">
              <IsisAvatar size="sm" />
            </span>
          </span>
        ) : (
          <Icon className="h-5 w-5 mr-4 flex-shrink-0" />
        )}
        <span className="text-base flex items-center gap-2">
          {label}
        </span>
      </NavLink>
    </motion.li>
  );
};

function Sidebar({ onNavigate, isVisible, setIsVisible, sidebarPinned }) {
  const location = useLocation();
  const groupPaths = ['/produtos', '/compras', '/clientes', '/equipe', '/quadras', '/empresas', '/finalizadoras'];
  const groupActive = useMemo(() => groupPaths.includes(location.pathname), [location.pathname]);
  const [openCadastros, setOpenCadastros] = useState(groupActive);
  
  const sidebarRef = useRef(null);
  const triggerZoneRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Função para fechar sidebar ao clicar em um link
  const handleNavClick = () => {
    // Mobile: sempre fecha ao clicar
    if (window.innerWidth < 768) {
      setIsVisible(false);
    }
    // Desktop: não faz nada (mantém estado atual)
  };

  // Removido: hover no canto esquerdo (desktop)
  // Agora apenas o botão do Header controla a sidebar

  // Touch events para mobile (swipe da esquerda)
  useEffect(() => {
    const handleTouchStart = (e) => {
      // Apenas em mobile (< 768px)
      if (window.innerWidth >= 768) return;

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (window.innerWidth >= 768) return;

      const touchCurrentX = e.touches[0].clientX;
      const touchCurrentY = e.touches[0].clientY;
      const diffX = touchCurrentX - touchStartX.current;
      const diffY = Math.abs(touchCurrentY - touchStartY.current);

      // Swipe horizontal da esquerda (> 50px) e não muito vertical
      if (touchStartX.current < 50 && diffX > 50 && diffY < 50) {
        setIsVisible(true);
      }
    };

    const handleTouchEnd = () => {
      touchStartX.current = 0;
      touchStartY.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isVisible]);

  return (
    <>
      {/* Sidebar
         - Mobile: sobrepõe o conteúdo (fixed, z-index alto)
         - Desktop: continua empurrando conteúdo (flex-shrink-0)
      */}
      <motion.aside
        ref={sidebarRef}
        initial={false}
        animate={{ width: (sidebarPinned || isVisible) ? 280 : 0 }}
        className="h-screen bg-surface flex flex-col border-r border-border shadow-xl shadow-black/20 overflow-hidden
                   fixed inset-y-0 left-0 z-40 md:static md:flex-shrink-0"
      >
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex items-center px-6 pt-8 pb-6 h-[120px] flex-shrink-0"
      >
        <div className="w-14 h-14 bg-brand rounded-xl flex items-center justify-center mr-4">
            <Trophy className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="flex items-baseline">
            <span className="font-extrabold text-2xl" style={{ color: '#FF6600' }}>Fluxo</span>
            <span className="font-extrabold text-2xl" style={{ color: '#FFAA33' }}>7</span>
            <span className="font-medium text-2xl" style={{ color: '#B0B0B0' }}> Arena</span>
        </div>
      </motion.div>

      <nav className="flex-1 overflow-y-auto px-6 py-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-border-hover">
        <ul className="space-y-3">
          {navItems.map((item, i) => (
            <NavItem key={item.to} {...item} index={i} onNavigate={handleNavClick} />
          ))}
          <motion.li
            custom={navItems.length}
            variants={navItemVariants}
            initial="hidden"
            animate="visible"
          >
            <button
              type="button"
              onClick={() => setOpenCadastros((v) => !v)}
              className={`w-full flex items-center h-[52px] px-4 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all duration-200 border-l-4 ${groupActive ? 'bg-brand text-primary-foreground font-bold border-brand' : 'border-transparent'}`}
            >
              <Folder className="h-5 w-5 mr-4 flex-shrink-0" />
              <span className="text-base flex-1 text-left">Cadastros</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${openCadastros ? 'rotate-180' : ''}`} />
            </button>
            {openCadastros && (
              <ul className="mt-2 ml-8 space-y-2">
                {/* 1. Clientes & Fornecedores */}
                <li>
                  <NavLink
                    to="/clientes"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Users className="h-4 w-4 mr-3" /> Clientes & Fornecedores
                  </NavLink>
                </li>
                {/* 2. Finalizadoras */}
                <li>
                  <NavLink
                    to="/finalizadoras"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <CreditCard className="h-4 w-4 mr-3" /> Finalizadoras
                  </NavLink>
                </li>
                {/* 3. Produtos */}
                <li>
                  <NavLink
                    to="/produtos"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Package className="h-4 w-4 mr-3" /> Produtos
                  </NavLink>
                </li>
                {/* 4. Compras */}
                <li>
                  <NavLink
                    to="/compras"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <ShoppingBag className="h-4 w-4 mr-3" /> Compras
                  </NavLink>
                </li>
                {/* 5. Equipe */}
                <li>
                  <NavLink
                    to="/equipe"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <UserCog className="h-4 w-4 mr-3" /> Equipe
                  </NavLink>
                </li>
                {/* 5. Quadras */}
                <li>
                  <NavLink
                    to="/quadras"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Layers className="h-4 w-4 mr-3" /> Quadras
                  </NavLink>
                </li>
                {/* 6. Empresa */}
                <li>
                  <NavLink
                    to="/empresas"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Building2 className="h-4 w-4 mr-3" /> Empresa
                  </NavLink>
                </li>
              </ul>
            )}
          </motion.li>
          
          {/* Suporte - movido para dentro do nav */}
          <motion.li
            custom={navItems.length + 1}
            variants={navItemVariants}
            initial="hidden"
            animate="visible"
            className="pt-4 border-t border-border/50 mt-4"
          >
            <NavLink
              to="/suporte"
              onClick={handleNavClick}
              className={({ isActive }) => (isActive ? "flex items-center h-[52px] px-4 rounded-sm bg-brand text-primary-foreground font-bold shadow-lg shadow-brand/10 border-l-4 border-brand" : "flex items-center h-[52px] px-4 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all duration-200 border-l-4 border-transparent")}
            >
              <LifeBuoy className="h-5 w-5 mr-4 flex-shrink-0" />
              <span className="text-base">Suporte</span>
            </NavLink>
          </motion.li>
          <motion.li
            custom={navItems.length + 2}
            variants={navItemVariants}
            initial="hidden"
            animate="visible"
          >
            <NavLink
              to="/isis"
              onClick={handleNavClick}
              className={({ isActive }) => (
                isActive
                  ? "flex items-center h-[56px] px-4 rounded-sm font-extrabold text-text-primary bg-surface-2/80 border border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "flex items-center h-[56px] px-4 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all duration-200 border border-white/15"
              )}
            >
              <span className="mr-4 flex-shrink-0 inline-flex items-center justify-center rounded-full p-[3px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_12px_rgba(168,85,247,0.35)]">
                <span className="rounded-full overflow-hidden bg-background">
                  <IsisAvatar size="sm" />
                </span>
              </span>
              <span className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-violet-300 to-emerald-300">
                Ísis
              </span>
            </NavLink>
          </motion.li>
        </ul>
      </nav>
    </motion.aside>
    </>
  );
}

export default Sidebar;