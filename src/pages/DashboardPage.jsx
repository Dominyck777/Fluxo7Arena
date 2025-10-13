import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, CalendarPlus, Users, ArrowUpRight, ArrowDownRight, Clock, Bell, ShieldCheck, CalendarCheck, TrendingUp, ShoppingCart, Store, Package, AlertTriangle, Info } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/contexts/AlertsContext';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ icon: Icon, title, value, trend, trendValue, color, className }) => {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
  const trendColor = trend === 'up' ? 'text-success' : 'text-danger';

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      className={`fx-card group flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center justify-center h-10 w-10 rounded-md border border-white/10 bg-white/5 transition-colors duration-300 group-hover:border-brand/50 group-hover:bg-brand/10`} style={{ color: `var(--${color})` }}>
                <Icon className="h-5 w-5" />
            </div>
            {trend && trendValue && (
              <div className={`flex items-center text-xs font-bold ${trendColor}`}>
                <TrendIcon className={`w-3.5 h-3.5 mr-1`} />
                <span>{trendValue}</span>
              </div>
            )}
        </div>
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums tracking-tight">{value}</p>
        </div>
      </div>
    </motion.div>
  );
};

const AlertCard = ({ alerts, className }) => {
  const navigate = useNavigate();
  const [showAllModal, setShowAllModal] = useState(false);
  
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
  
  const displayedAlerts = alerts.length > 2 ? alerts.slice(0, 2) : alerts;
  const hasMore = alerts.length > 2;
  
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
  
  return (
    <>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 30, scale: 0.98 },
          visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
        }}
        className={`fx-card ${className || ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-text-primary flex items-center">
            <Bell className="mr-2 h-5 w-5 text-brand" /> Alertas do Dia
          </h2>
          {hasMore && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-xs text-brand hover:text-brand/80"
              onClick={() => setShowAllModal(true)}
            >
              Ver todos
            </Button>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum alerta no momento! 🎉</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {displayedAlerts.map((alert, idx) => (
              <AlertItem 
                key={idx} 
                alert={alert}
                onClick={() => alert.link && navigate(alert.link)}
              />
            ))}
          </ul>
        )}
      </motion.div>

      {/* Modal Ver Todos */}
      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
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
                        setShowAllModal(false);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const MinimalFinanceCard = ({ title, icon: Icon, data, color, className }) => {
  const totalReceita = data.reduce((acc, d) => acc + (d.receita || 0), 0);
  const totalDespesa = data.reduce((acc, d) => acc + (d.despesa || 0), 0);
  const totalSaldo = totalReceita - totalDespesa;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      className={`fx-card group ${className || ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center justify-center h-10 w-10 rounded-md border border-white/10 bg-white/5 transition-colors duration-300 group-hover:border-brand/50 group-hover:bg-brand/10 mr-3`} style={{ color: `var(--${color})` }}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold text-text-primary flex-1">{title}</h3>
        <div className="text-xs font-semibold text-text-muted">últimos 14 dias</div>
      </div>
      <div className="mb-2">
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Tooltip
              cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
              contentStyle={{
                background: 'rgba(10, 10, 10, 0.85)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)'
              }}
              formatter={(value, name) => {
                if (name === 'saldo') return [`R$ ${value.toLocaleString('pt-BR')}`, 'Saldo'];
                return value;
              }}
              labelFormatter={(label) => label}
            />
            <Area type="monotone" dataKey="saldo" stroke="var(--brand)" strokeWidth={2} fill="var(--brand)" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-text-secondary">Receita</p>
          <p className="font-bold text-success tabular-nums">R$ {totalReceita.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-text-secondary">Despesa</p>
          <p className="font-bold text-danger tabular-nums">R$ {totalDespesa.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-text-secondary">Saldo</p>
          <p className="font-bold text-text-primary tabular-nums">R$ {totalSaldo.toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </motion.div>
  );
};

const StoreInfoCard = ({ title, icon: Icon, data, color, className }) => {
  return (
     <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      className={`fx-card group flex flex-col ${className || ''}`}
    >
      <div className="flex items-center mb-4">
        <div className={`flex items-center justify-center h-10 w-10 rounded-md border border-white/10 bg-white/5 transition-colors duration-300 group-hover:border-brand/50 group-hover:bg-brand/10 mr-3`} style={{ color: `var(--${color})` }}>
            <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold text-text-primary">{title}</h3>
      </div>
      <div className="space-y-3 mt-auto">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{item.name}</span>
            <span className="font-bold text-text-primary tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      when: "beforeChildren",
      staggerChildren: 0.1, 
      delayChildren: 0.2 
    } 
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

function DashboardPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const { alerts } = useAlerts(); // Usar alertas do contexto global
  const navigate = useNavigate();
  
  // Estados para dados reais
  const [loading, setLoading] = useState(true);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);
  const [agendamentosHoje, setAgendamentosHoje] = useState({ finalizados: 0, total: 0 });
  const [proximasReservas, setProximasReservas] = useState(0);
  const [quadrasEmUso, setQuadrasEmUso] = useState(0);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState(0);
  const [comandasAbertas, setComandasAbertas] = useState(0);
  const [mesasOcupadas, setMesasOcupadas] = useState(0);
  const [vendasLoja, setVendasLoja] = useState(0);
  const [financeMiniData, setFinanceMiniData] = useState([]);

  // Carregar dados do dia
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!userProfile?.codigo_empresa) return;
      
      try {
        setLoading(true);
        const codigo = userProfile.codigo_empresa;
        const hoje = new Date();
        const inicioHoje = startOfDay(hoje).toISOString();
        const fimHoje = endOfDay(hoje).toISOString();

        // 1. Faturamento de Hoje
        
        // 1.1. Pagamentos de comandas/vendas
        const { data: pagamentos } = await supabase
          .from('pagamentos')
          .select('valor, status')
          .eq('codigo_empresa', codigo)
          .gte('recebido_em', inicioHoje)
          .lte('recebido_em', fimHoje);
        
        const totalComandas = (pagamentos || [])
          .filter(p => !['Cancelado', 'Estornado'].includes(p.status))
          .reduce((sum, p) => sum + Number(p.valor || 0), 0);
        
        // 1.2. Pagamentos de agendamentos
        const { data: agendamentosHoje } = await supabase
          .from('agendamentos')
          .select('id')
          .eq('codigo_empresa', codigo)
          .gte('inicio', inicioHoje)
          .lte('inicio', fimHoje);
        
        let totalAgendamentos = 0;
        if (agendamentosHoje && agendamentosHoje.length > 0) {
          const agendamentoIds = agendamentosHoje.map(a => a.id);
          const { data: participantesPagos } = await supabase
            .from('agendamento_participantes')
            .select('valor_cota, status_pagamento')
            .eq('codigo_empresa', codigo)
            .in('agendamento_id', agendamentoIds)
            .eq('status_pagamento', 'Pago');
          
          totalAgendamentos = (participantesPagos || [])
            .reduce((sum, p) => sum + Number(p.valor_cota || 0), 0);
        }
        
        const totalHoje = totalComandas + totalAgendamentos;
        setFaturamentoHoje(totalHoje);

        // 2. Agendamentos de Hoje
        const { data: agendamentos } = await supabase
          .from('agendamentos')
          .select('id, status, inicio')
          .eq('codigo_empresa', codigo)
          .gte('inicio', inicioHoje)
          .lte('inicio', fimHoje);
        
        const finalizados = (agendamentos || []).filter(a => a.status === 'finished').length;
        setAgendamentosHoje({ finalizados, total: agendamentos?.length || 0 });

        // 3. Próximas Reservas
        const agora = new Date().toISOString();
        const proximas = (agendamentos || []).filter(a => 
          a.inicio > agora && !['canceled', 'finished'].includes(a.status)
        ).length;
        setProximasReservas(proximas);

        // 4. Quadras em Uso
        const emUso = (agendamentos || []).filter(a => a.status === 'in_progress').length;
        setQuadrasEmUso(emUso);

        // 5. Horários Disponíveis
        const { data: quadras } = await supabase
          .from('quadras')
          .select('id')
          .eq('codigo_empresa', codigo);
        const totalQuadras = quadras?.length || 0;
        setHorariosDisponiveis(totalQuadras * 3);

        // 6. Comandas Abertas
        const { data: comandas } = await supabase
          .from('comandas')
          .select('id')
          .eq('codigo_empresa', codigo)
          .eq('status', 'open');
        setComandasAbertas(comandas?.length || 0);

        // 7. Mesas Ocupadas
        const { data: mesas } = await supabase
          .from('mesas')
          .select('id, status')
          .eq('codigo_empresa', codigo);
        const ocupadas = (mesas || []).filter(m => ['in-use', 'awaiting-payment'].includes(m.status)).length;
        setMesasOcupadas(ocupadas);

        // 8. Vendas da Loja
        const { data: comandasFechadas } = await supabase
          .from('comandas')
          .select('id')
          .eq('codigo_empresa', codigo)
          .eq('status', 'closed')
          .gte('fechado_em', inicioHoje)
          .lte('fechado_em', fimHoje);
        setVendasLoja(comandasFechadas?.length || 0);

        // 9. Dados financeiros dos últimos 14 dias
        const dados14Dias = [];
        for (let i = 13; i >= 0; i--) {
          const dia = new Date();
          dia.setDate(dia.getDate() - i);
          const inicioDia = startOfDay(dia).toISOString();
          const fimDia = endOfDay(dia).toISOString();

          // Pagamentos de comandas
          const { data: pagsDia } = await supabase
            .from('pagamentos')
            .select('valor, status')
            .eq('codigo_empresa', codigo)
            .gte('recebido_em', inicioDia)
            .lte('recebido_em', fimDia);

          const receitaComandas = (pagsDia || [])
            .filter(p => !['Cancelado', 'Estornado'].includes(p.status))
            .reduce((sum, p) => sum + Number(p.valor || 0), 0);

          // Pagamentos de agendamentos
          const { data: agendsDia } = await supabase
            .from('agendamentos')
            .select('id')
            .eq('codigo_empresa', codigo)
            .gte('inicio', inicioDia)
            .lte('inicio', fimDia);
          
          let receitaAgendamentos = 0;
          if (agendsDia && agendsDia.length > 0) {
            const idsAgendsDia = agendsDia.map(a => a.id);
            const { data: partsPagosDia } = await supabase
              .from('agendamento_participantes')
              .select('valor_cota')
              .eq('codigo_empresa', codigo)
              .in('agendamento_id', idsAgendsDia)
              .eq('status_pagamento', 'Pago');
            
            receitaAgendamentos = (partsPagosDia || [])
              .reduce((sum, p) => sum + Number(p.valor_cota || 0), 0);
          }

          const receita = receitaComandas + receitaAgendamentos;

          dados14Dias.push({
            name: i === 0 ? 'Hoje' : `${i}d`,
            saldo: Math.round(receita),
            receita: Math.round(receita),
            despesa: 0
          });
        }
        setFinanceMiniData(dados14Dias);

      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [userProfile?.codigo_empresa]);

  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

  const storeData = [
    { name: "Comandas Abertas", value: comandasAbertas },
    { name: "Mesas Ocupadas", value: mesasOcupadas },
    { name: "Vendas Hoje", value: vendasLoja },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-text-secondary">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard - Fluxo7 Arena</title>
        <meta name="description" content="Visão geral e resumo do seu negócio." />
      </Helmet>
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {/* Top: Hero + Resumo/Alertas */}
        <motion.div variants={itemVariants} className="relative grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Hero */}
          <div className="xl:col-span-8">
            <div className="bg-surface/70 backdrop-blur-sm relative p-4 rounded-xl border border-white/10 overflow-hidden shadow-1">
              <div className="absolute inset-0 bg-court-pattern opacity-[0.03] mix-blend-overlay"></div>
              <div className="relative z-10 max-w-[720px]">
                <h1 className="text-3xl font-black mb-2 text-text-primary tracking-tighter">
                  Bem-vindo de volta, <span className="text-brand">{userProfile?.nome_exibicao || userProfile?.nome || userProfile?.email?.split('@')[0] || 'Admin'}!</span>
                </h1>
                <p className="text-text-secondary mb-3 max-w-[60ch] text-sm md:text-base font-normal">
                  Sua central de comando para uma gestão de sucesso. Monitore agendamentos, faturamento e clientes em um só lugar.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Button onClick={() => navigate('/agenda', { state: { openModal: true } })} size="default">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    + Agendamento
                  </Button>
                  <Button onClick={() => navigate('/clientes', { state: { openModal: true } })} variant="outline" size="default">
                    <Users className="mr-2 h-4 w-4" />
                    Adicionar Cliente
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo do Dia */}
          <div className="xl:col-span-4">
            <div className="fx-card">
              <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center">
                <Clock className="mr-2 h-5 w-5 text-brand" /> Resumo do Dia
              </h2>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between items-center">
                  <span className="text-text-secondary">Próximas Reservas</span> 
                  <span className="font-bold text-text-primary tabular-nums">{proximasReservas}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-text-secondary">Quadras em Uso</span> 
                  <span className="font-bold text-success tabular-nums">{quadrasEmUso}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-text-secondary">Horários Disponíveis</span> 
                  <span className="font-bold text-info tabular-nums">{horariosDisponiveis}</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Middle: 4 cards */}
        <motion.div variants={itemVariants} className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-3">
            <StatCard 
              icon={DollarSign} 
              title="Faturamento do Dia" 
              value={fmtBRL(faturamentoHoje)} 
              color="success" 
              className="h-full" 
            />
          </div>
          <div className="xl:col-span-3">
            <StatCard 
              icon={CalendarCheck} 
              title="Agend. Finalizados" 
              value={`${agendamentosHoje.finalizados} de ${agendamentosHoje.total}`} 
              color="info" 
              className="h-full" 
            />
          </div>
          <div className="xl:col-span-3">
            <AlertCard className="h-full" alerts={alerts} />
          </div>
          <div className="xl:col-span-3">
            <StoreInfoCard 
              icon={Store}
              title="Informações da Loja"
              data={storeData}
              color="purple"
              className="h-full"
            />
          </div>
        </motion.div>

        {/* Bottom: Resumo financeiro */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4">
          <MinimalFinanceCard 
            icon={TrendingUp}
            title="Resumo Financeiro"
            data={financeMiniData}
            color="brand"
          />
        </motion.div>
      </motion.div>
    </>
  );
}

export default DashboardPage;
