import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, ShoppingCart, Users, UserCog, LifeBuoy, Settings, Trophy, Package, Wallet, ChevronDown, Layers, Building2, Banknote, Folder } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const activeLink = "flex items-center h-[52px] px-4 rounded-sm bg-brand text-primary-foreground font-bold shadow-lg shadow-brand/10 border-l-4 border-brand";
  const inactiveLink = "flex items-center h-[52px] px-4 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all duration-200 border-l-4 border-transparent";

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
        className={({ isActive }) => (isActive ? activeLink : inactiveLink)}
      >
        <Icon className="h-5 w-5 mr-4 flex-shrink-0" />
        <span className="text-base">{label}</span>
      </NavLink>
    </motion.li>
  );
};

function Sidebar({ onNavigate }) {
  const location = useLocation();
  const groupPaths = ['/produtos', '/clientes', '/equipe', '/quadras', '/empresas', '/finalizadoras'];
  const groupActive = useMemo(() => groupPaths.includes(location.pathname), [location.pathname]);
  const [openCadastros, setOpenCadastros] = useState(groupActive);

  // Função para fechar sidebar em mobile ao clicar em um link
  const handleNavClick = () => {
    // Verifica se é mobile (largura < 768px)
    if (window.innerWidth < 768 && onNavigate) {
      onNavigate();
    }
  };

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-[280px] h-screen flex-shrink-0 bg-surface flex flex-col border-r border-border shadow-xl shadow-black/20"
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
                <li>
                  <NavLink
                    to="/finalizadoras"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Banknote className="h-4 w-4 mr-3" /> Finalizadoras
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/quadras"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Layers className="h-4 w-4 mr-3" /> Quadras
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/produtos"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Package className="h-4 w-4 mr-3" /> Produtos
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/clientes"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <Users className="h-4 w-4 mr-3" /> Clientes
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/equipe"
                    onClick={handleNavClick}
                    className={({ isActive }) => isActive ? 'flex items-center h-[40px] px-3 rounded-sm bg-brand/20 text-text-primary font-medium text-sm' : 'flex items-center h-[40px] px-3 rounded-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors text-sm'}
                  >
                    <UserCog className="h-4 w-4 mr-3" /> Equipe
                  </NavLink>
                </li>
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
        </ul>
      </nav>

      {/* Rodapé */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="px-6 pb-6 flex-shrink-0">
         <NavItem to="/suporte" icon={LifeBuoy} label="Suporte" index={navItems.length} onNavigate={handleNavClick} />
      </motion.div>
    </motion.aside>
  );
}

export default Sidebar;