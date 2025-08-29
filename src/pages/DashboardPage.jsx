import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { DollarSign, CalendarPlus, Users, ArrowUpRight, ArrowDownRight, Clock, Bell, ShieldCheck, Star, ThumbsUp, Wallet, Banknote, CalendarCheck, BarChart3, TrendingUp, MoonStar as StarIcon } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

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

const AlertsCard = ({ className }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      className={`fx-card ${className || ''}`}
    >
      <h2 className="text-lg font-bold text-text-primary mb-2 flex items-center">
        <Bell className="mr-2 h-5 w-5 text-brand" /> Alertas e Lembretes
      </h2>
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-danger" />
          <span className="text-text-secondary">Pagamento pendente: Cliente X</span>
        </li>
        <li className="flex items-center">
          <ThumbsUp className="w-4 h-4 mr-2 text-info" />
          <span className="text-text-secondary">Plano mensal a vencer: Cliente Y</span>
        </li>
      </ul>
    </motion.div>
  );
};

const CourtUtilizationCard = ({ className }) => {
  // Valores mockados para hoje
  const nowUtil = 62; // ocupação neste momento
  const dayUtil = 71; // ocupação média do dia
  const nextFree = '18:30 - Quadra 2';

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      className={`fx-card ${className || ''}`}
    >
      <h3 className="text-base font-bold text-text-primary mb-3">Utilização das Quadras (Hoje)</h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Ocupação agora</span>
          <span className="font-bold tabular-nums text-text-primary">{nowUtil}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Ocupação do dia</span>
          <span className="font-bold tabular-nums text-text-primary">{dayUtil}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Próxima janela livre</span>
          <span className="font-bold tabular-nums text-success">{nextFree}</span>
        </div>
      </div>
    </motion.div>
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
              labelFormatter={(label) => `Dia ${label}`}
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

const ModalityBreakdownCard = ({ title, icon: Icon, data, color, className }) => {
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

const FinancialSummaryCard = ({ title, icon: Icon, data, color }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      className="fx-card group flex flex-col"
    >
      <div className="flex items-center mb-4">
        <div className={`flex items-center justify-center h-10 w-10 rounded-md border border-white/10 bg-white/5 transition-colors duration-300 group-hover:border-brand/50 group-hover:bg-brand/10 mr-3`} style={{ color: `var(--${color})` }}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold text-text-primary">{title}</h3>
      </div>
      <div className="flex-grow">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              contentStyle={{
                background: 'rgba(10, 10, 10, 0.8)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                backdropFilter: 'blur(4px)',
              }}
            />
            <Bar dataKey="receita" name="Receita" stackId="a" fill="var(--success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesa" name="Despesa" stackId="a" fill="var(--danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
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

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! 🚧",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! 🚀",
      variant: "default",
    });
  };

  const renderStars = (rating) => {
    return Array(5).fill(0).map((_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'text-brand fill-brand' : 'text-text-muted/50'}`} />
    ));
  };
  
  const modalityData = [
    { name: "Futebol Society", value: 18 },
    { name: "Futevôlei", value: 9 },
    { name: "Beach Tennis", value: 6 },
  ];

  const financialData = [
    { name: 'Jan', receita: 4000, despesa: 2400 },
    { name: 'Fev', receita: 3000, despesa: 1398 },
    { name: 'Mar', receita: 5000, despesa: 2800 },
    { name: 'Abr', receita: 4780, despesa: 3908 },
    { name: 'Mai', receita: 5890, despesa: 4800 },
    { name: 'Jun', receita: 4390, despesa: 3800 },
  ];

  // Dados mínimos para 14 dias: saldo diário (receita - despesa)
  const financeMiniData = [
    { name: 1, saldo: 320 },
    { name: 2, saldo: 180 },
    { name: 3, saldo: 260 },
    { name: 4, saldo: 90 },
    { name: 5, saldo: 410 },
    { name: 6, saldo: 220 },
    { name: 7, saldo: 300 },
    { name: 8, saldo: 140 },
    { name: 9, saldo: 370 },
    { name: 10, saldo: 280 },
    { name: 11, saldo: 330 },
    { name: 12, saldo: 200 },
    { name: 13, saldo: 420 },
    { name: 14, saldo: 260 },
  ];

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
                  Bem-vindo de volta, <span className="text-brand">Admin!</span>
                </h1>
                <p className="text-text-secondary mb-3 max-w-[60ch] text-sm md:text-base font-normal">
                  Sua central de comando para uma gestão de sucesso. Monitore agendamentos, faturamento e clientes em um só lugar.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Button onClick={handleNotImplemented} size="default">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Nova Reserva
                  </Button>
                  <Button onClick={handleNotImplemented} variant="outline" size="default">
                    <Users className="mr-2 h-4 w-4" />
                    Adicionar Cliente
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo do Dia (lado direito do hero) */}
          <div className="xl:col-span-4">
            <div className="fx-card">
              <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center"><Clock className="mr-2 h-5 w-5 text-brand" /> Resumo do Dia</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between items-center"><span className="text-text-secondary">Próximas Reservas</span> <span className="font-bold text-text-primary tabular-nums">5</span></li>
                <li className="flex justify-between items-center"><span className="text-text-secondary">Quadras em Uso</span> <span className="font-bold text-success tabular-nums">2</span></li>
                <li className="flex justify-between items-center"><span className="text-text-secondary">Horários Disponíveis</span> <span className="font-bold text-info tabular-nums">8</span></li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Middle: 4 cards em colunas iguais */}
        <motion.div variants={itemVariants} className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-3">
            <StatCard icon={DollarSign} title="Faturamento do Dia" value="R$ 1.250" trend="up" trendValue="+15%" color="success" className="h-full" />
          </div>
          <div className="xl:col-span-3">
            <StatCard icon={CalendarCheck} title="Agend. Finalizados" value="12 de 15" trend="down" trendValue="-3" color="info" className="h-full" />
          </div>
          <div className="xl:col-span-3">
            <AlertsCard className="h-full" />
          </div>
          <div className="xl:col-span-3">
            <ModalityBreakdownCard 
              icon={BarChart3}
              title="Agend. por Modalidade"
              data={modalityData}
              color="purple"
              className="h-full"
            />
          </div>
        </motion.div>

        {/* Bottom: Resumo financeiro minimalista + KPIs + Feedbacks */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-6">
            <MinimalFinanceCard 
              icon={TrendingUp}
              title="Resumo Financeiro"
              data={financeMiniData}
              color="brand"
              className="h-full"
            />
          </div>
          <div className="xl:col-span-2">
            <CourtUtilizationCard className="h-full" />
          </div>
          <div className="xl:col-span-4">
            <div className="fx-card h-full">
              <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center"><Star className="mr-2 h-5 w-5 text-brand" /> Feedbacks Recentes</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-sm">Maria Oliveira</p>
                    <div className="flex">{renderStars(5)}</div>
                  </div>
                  <p className="text-xs text-text-secondary">"Atendimento excelente, adorei a quadra!"</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-sm">Lucas Almeida</p>
                    <div className="flex">{renderStars(4)}</div>
                  </div>
                  <p className="text-xs text-text-secondary">"Bar da quadra top, recomendo!"</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

export default DashboardPage;