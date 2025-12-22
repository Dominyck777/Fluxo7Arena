import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CalendarDays, BarChart3, CalendarCheck, TrendingUp, Layers, ChevronDown, XCircle, Settings, Calendar as CalendarIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export default function IsisAnalyticsPage() {
  const { company } = useAuth();
  const codigoEmpresa = company?.codigo_empresa || company?.codigoEmpresa || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastAgsLoading, setLastAgsLoading] = useState(false);
  const [lastAgsError, setLastAgsError] = useState(null);
  const [lastAgsDateStart, setLastAgsDateStart] = useState('');
  const [lastAgsDateEnd, setLastAgsDateEnd] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [cancelHours, setCancelHours] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editingSubdomain, setEditingSubdomain] = useState(false);
  const [metrics, setMetrics] = useState({
    agendamentosIsisTotal: 0,
    agendamentosIsisHoje: 0,
    agendamentosIsis7d: 0,
    agendamentosTotal7d: 0,
    cancelamentosIsis7d: 0,
    perDay7d: [],
    topQuadras30d: [],
    ultimasInteracoes: [],
  });
  const [expanded, setExpanded] = useState({});

  const toYmd = (d) => {
    if (!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const ymdToDate = (ymd) => {
    if (!ymd) return null;
    const dt = new Date(`${ymd}T00:00:00`);
    if (isNaN(dt.getTime())) return null;
    return dt;
  };
  const formatBr = (d) => {
    try {
      if (!d) return '';
      const dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!codigoEmpresa) return;
    // Inicial: últimos 7 dias (inclusive hoje)
    if (lastAgsDateStart || lastAgsDateEnd) return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startYmd = toYmd(start);
    const endYmd = toYmd(end);
    try { console.log('[IsisAnalytics] Init default range (auto-fill):', { startYmd, endYmd }); } catch {}
    setLastAgsDateStart(startYmd);
    setLastAgsDateEnd(endYmd);
  }, [codigoEmpresa]);

  // Quando as datas mudarem, o efeito de busca usará automaticamente o range efetivo

  // Carrega configurações da Ísis ao abrir modal
  useEffect(() => {
    if (!settingsOpen || !company?.id) return;
    (async () => {
      try {
        setSettingsLoading(true);
        const { data, error: err } = await supabase
          .from('agenda_settings')
          .select('isis_cancel_min_hours_before, isis_subdomain, isis_display_name')
          .eq('empresa_id', company.id)
          .single();
        if (err && err.code !== 'PGRST116') throw err;
        if (data) {
          setCancelHours(data.isis_cancel_min_hours_before ?? '');
          setSubdomain(data.isis_subdomain || '');
          setDisplayName(data.isis_display_name || '');
        } else {
          // Inicializa com padrões
          const slug = (company.nome_fantasia || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          setSubdomain(slug);
          setDisplayName(company.nome_fantasia || '');
        }
      } catch (e) {
        console.error('[IsisSettings] Erro ao carregar:', e);
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, [settingsOpen, company?.id, company?.nome_fantasia]);

  // Salva configurações
  const handleSaveSettings = async () => {
    if (!company?.id) return;
    try {
      setSettingsSaving(true);
      const hours = cancelHours === '' ? null : parseInt(cancelHours, 10);
      if (hours !== null && (isNaN(hours) || hours < 0)) {
        alert('Horas de cancelamento deve ser um número >= 0');
        setSettingsSaving(false);
        return;
      }
      const cleanSubdomain = (subdomain || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!cleanSubdomain) {
        alert('Subdomínio não pode estar vazio');
        setSettingsSaving(false);
        return;
      }
      const cleanDisplayName = (displayName || '').trim();
      if (!cleanDisplayName) {
        alert('Nome de exibição não pode estar vazio');
        setSettingsSaving(false);
        return;
      }
      const { error: err } = await supabase
        .from('agenda_settings')
        .upsert({
          empresa_id: company.id,
          isis_cancel_min_hours_before: hours,
          isis_subdomain: cleanSubdomain,
          isis_display_name: cleanDisplayName,
        }, { onConflict: 'empresa_id' });
      if (err) throw err;
      setSubdomain(cleanSubdomain);
      setDisplayName(cleanDisplayName);
      setEditingSubdomain(false);
      setSettingsOpen(false);
    } catch (e) {
      console.error('[IsisSettings] Erro ao salvar:', e);
      alert('Erro ao salvar configurações: ' + (e?.message || 'desconhecido'));
    } finally {
      setSettingsSaving(false);
    }
  };

  // Animations (same pattern used on Dashboard)
  const pageVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { when: 'beforeChildren', staggerChildren: 0.1, delayChildren: 0.15 }
    }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  const StatCard = ({ icon: Icon, title, value, color = 'brand' }) => (
    <motion.div variants={itemVariants} className="fx-card">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center justify-center h-10 w-10 rounded-md border border-white/10 bg-white/5`} style={{ color: `var(--${color})` }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
        <p className="text-3xl font-bold text-text-primary tabular-nums tracking-tight">{value}</p>
      </div>
    </motion.div>
  );

  // Monta dados do gráfico (7 dias)
  const chartData7d = useMemo(() => {
    return (metrics.perDay7d || []).map(d => ({
      name: new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }),
      total: d.total,
      isis: d.isis,
    }));
  }, [metrics.perDay7d]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Utilidades de data
        const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
        const endOfDay = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // inclusive hoje => 7 dias
        const sevenDaysStart = startOfDay(sevenDaysAgo);
        const sevenDaysEnd = todayEnd;
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        const thirtyDaysStart = startOfDay(thirtyDaysAgo);

        // 1) Quantidade total de agendamentos criados pela Ísis (all-time)
        console.log('[IsisAnalytics] codigoEmpresa:', codigoEmpresa, 'company obj:', company);
        const { count: agIsisTotal, error: agErr } = await supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('codigo_empresa', codigoEmpresa)
          .eq('created_by_isis', true);
        if (agErr) throw agErr;

        // 2) Agendamentos da Ísis HOJE
        console.log('[IsisAnalytics] HOJE intervalo criado_em:', todayStart.toISOString(), '->', todayEnd.toISOString());
        let hojeCountResp = await supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('codigo_empresa', codigoEmpresa)
          .eq('created_by_isis', true)
          .gte('criado_em', todayStart.toISOString())
          .lte('criado_em', todayEnd.toISOString());
        let agIsisHoje = hojeCountResp?.count ?? null;
        if (agIsisHoje == null) {
          const { data: hojeList } = await supabase
            .from('agendamentos')
            .select('id')
            .eq('codigo_empresa', codigoEmpresa)
            .eq('created_by_isis', true)
            .gte('criado_em', todayStart.toISOString())
            .lte('criado_em', todayEnd.toISOString());
          agIsisHoje = (hojeList || []).length;
        }
        console.log('[IsisAnalytics] agIsisHoje (count resolved):', agIsisHoje);

        // 3) Agendamentos dos últimos 7 dias (Ísis e Total) + Cancelamentos (Ísis)
        console.log('[IsisAnalytics] 7d intervalo criado_em:', sevenDaysStart.toISOString(), '->', sevenDaysEnd.toISOString());
        const { data: agIsis7dRows } = await supabase
          .from('agendamentos')
          .select('id, criado_em')
          .eq('codigo_empresa', codigoEmpresa)
          .eq('created_by_isis', true)
          .gte('criado_em', sevenDaysStart.toISOString())
          .lte('criado_em', sevenDaysEnd.toISOString());
        console.log('[IsisAnalytics] agIsis7dRows length:', (agIsis7dRows||[]).length);

        const { data: agTotal7dRows } = await supabase
          .from('agendamentos')
          .select('id, inicio')
          .eq('codigo_empresa', codigoEmpresa)
          .gte('inicio', sevenDaysStart.toISOString())
          .lte('inicio', sevenDaysEnd.toISOString());

        // Cancelamentos feitos pela Ísis (autoria: canceled_by = 'isis') no período de 7 dias
        let cancCountResp = await supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('codigo_empresa', codigoEmpresa)
          .eq('canceled_by', 'isis')
          .gte('canceled_at', sevenDaysStart.toISOString())
          .lte('canceled_at', sevenDaysEnd.toISOString());
        let cancelamentosIsis7d = cancCountResp?.count ?? null;
        if (cancelamentosIsis7d == null) {
          const { data: cancList } = await supabase
            .from('agendamentos')
            .select('id')
            .eq('codigo_empresa', codigoEmpresa)
            .eq('canceled_by', 'isis')
            .gte('canceled_at', sevenDaysStart.toISOString())
            .lte('canceled_at', sevenDaysEnd.toISOString());
          cancelamentosIsis7d = (cancList || []).length;
        }
        console.log('[IsisAnalytics] cancelamentosIsis7d (count resolved - canceled_by=isis):', cancelamentosIsis7d);

        const agIsis7d = Array.isArray(agIsis7dRows) ? agIsis7dRows.length : 0;
        const agTotal7d = Array.isArray(agTotal7dRows) ? agTotal7dRows.length : 0;

        // Distribuição por dia (7 dias)
        const dayKey = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10); };
        const perDayMap = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysStart); d.setDate(sevenDaysStart.getDate() + i);
          perDayMap[dayKey(d)] = { date: new Date(d), isis: 0, total: 0 };
        }
        (agTotal7dRows || []).forEach(r => {
          const k = dayKey(r.inicio);
          if (perDayMap[k]) perDayMap[k].total += 1;
        });
        (agIsis7dRows || []).forEach(r => {
          const basis = r.inicio || r.criado_em;
          const k = dayKey(basis);
          if (perDayMap[k]) perDayMap[k].isis += 1;
        });
        const perDay7d = Object.values(perDayMap);

        // 4) Top quadras (últimos 30 dias) pela Ísis
        const { data: agIsis30dRows } = await supabase
          .from('agendamentos')
          .select('quadra_id')
          .eq('codigo_empresa', codigoEmpresa)
          .eq('created_by_isis', true)
          .gte('inicio', thirtyDaysStart.toISOString())
          .lte('inicio', todayEnd.toISOString());
        const freq = new Map();
        (agIsis30dRows || []).forEach(r => {
          if (!r?.quadra_id) return;
          freq.set(r.quadra_id, (freq.get(r.quadra_id) || 0) + 1);
        });
        // resolve nomes das quadras
        const quadraIds = Array.from(freq.keys());
        let mapQuadras = {};
        if (quadraIds.length > 0) {
          const { data: quadras } = await supabase
            .from('quadras')
            .select('id, nome')
            .in('id', quadraIds);
          (quadras || []).forEach(q => { mapQuadras[q.id] = q.nome; });
        }
        const topQuadras30d = Array.from(freq.entries())
          .map(([id, c]) => ({ id, nome: mapQuadras[id] || 'Quadra', count: c }))
          .sort((a,b) => b.count - a.count)
          .slice(0, 5);

        // Top modalidades (últimos 30 dias) pela Ísis
        const { data: agIsis30dMods } = await supabase
          .from('agendamentos')
          .select('modalidade')
          .eq('codigo_empresa', codigoEmpresa)
          .eq('created_by_isis', true)
          .gte('inicio', thirtyDaysStart.toISOString())
          .lte('inicio', todayEnd.toISOString());
        const modFreq = new Map();
        (agIsis30dMods || []).forEach(r => {
          const mod = (r?.modalidade || '').trim();
          if (!mod) return;
          modFreq.set(mod, (modFreq.get(mod) || 0) + 1);
        });
        const topModalidades30d = Array.from(modFreq.entries())
          .map(([nome, count]) => ({ nome, count }))
          .sort((a,b) => b.count - a.count)
          .slice(0, 5);

        if (!mounted) return;
        setMetrics(prev => ({
          ...prev,
          agendamentosIsisTotal: agIsisTotal || 0,
          agendamentosIsisHoje: agIsisHoje || 0,
          agendamentosIsis7d: agIsis7d,
          agendamentosTotal7d: agTotal7d,
          cancelamentosIsis7d: cancelamentosIsis7d || 0,
          perDay7d,
          topQuadras30d,
          topModalidades30d,
        }));
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Erro ao carregar métricas');
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [codigoEmpresa, company?.nome_fantasia, company?.razao_social]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!codigoEmpresa) return;
      try {
        setLastAgsLoading(true);
        setLastAgsError(null);

        const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
        const endOfDay = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
        // Usa as datas atuais dos seletores; se vazio, cai no padrão de últimos 7 dias
        const today = new Date();
        const defaultEnd = toYmd(today);
        const dStart = new Date(); dStart.setDate(dStart.getDate() - 6);
        const defaultStart = toYmd(dStart);

        const effStart = lastAgsDateStart || defaultStart;
        const effEnd = lastAgsDateEnd || defaultEnd;

        let q = supabase
          .from('agendamentos')
          .select('id, codigo, inicio, fim, criado_em, status, cliente_id, clientes, quadra_id')
          .eq('codigo_empresa', codigoEmpresa)
          .eq('created_by_isis', true)
          .order('criado_em', { ascending: false });

        const hasAnyFilter = !!(effStart || effEnd);
        if (effStart) {
          const dt = startOfDay(new Date(effStart));
          q = q.gte('criado_em', dt.toISOString());
        }
        if (effEnd) {
          const dt = endOfDay(new Date(effEnd));
          q = q.lte('criado_em', dt.toISOString());
        }
        q = q.limit(hasAnyFilter ? 200 : 10);
        try { console.log('[IsisAnalytics] Fetch lastAgs with range (effective):', { effStart, effEnd, hasAnyFilter, limit: hasAnyFilter ? 200 : 10 }); } catch {}
        const { data: lastAgs, error: lastErr } = await q;
        if (lastErr) {
          try { console.error('[IsisAnalytics] lastAgs query error:', lastErr); } catch {}
          throw lastErr;
        }
        try { console.log('[IsisAnalytics] lastAgs length:', (lastAgs || []).length); } catch {}

        const clientIds = Array.from(new Set((lastAgs || []).map(a => a.cliente_id).filter(Boolean)));
        let clientMap = {};
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from('clientes')
            .select('id, nome')
            .in('id', clientIds);
          (clients || []).forEach(c => { clientMap[c.id] = c.nome; });
        }

        const quadraIdsLast = Array.from(new Set((lastAgs || []).map(a => a.quadra_id).filter(Boolean)));
        let quadraMapLast = {};
        if (quadraIdsLast.length > 0) {
          const { data: quadrasLast } = await supabase
            .from('quadras')
            .select('id, nome')
            .in('id', quadraIdsLast);
          (quadrasLast || []).forEach(q => { quadraMapLast[q.id] = q.nome; });
        }

        const agIds = (lastAgs || []).map(a => a.id);
        let partsMap = {};
        if (agIds.length > 0) {
          const { data: parts } = await supabase
            .from('agendamento_participantes')
            .select('agendamento_id, nome, status_pagamento, valor_cota')
            .in('agendamento_id', agIds)
            .order('agendamento_id', { ascending: true });
          (parts || []).forEach(p => {
            if (!partsMap[p.agendamento_id]) partsMap[p.agendamento_id] = [];
            partsMap[p.agendamento_id].push(p);
          });
        }

        if (!mounted) return;
        setExpanded({});
        setMetrics(prev => ({
          ...prev,
          ultimasInteracoes: (lastAgs || []).map(a => ({
            ...a,
            cliente_nome: clientMap[a.cliente_id] || null,
            participantes: partsMap[a.id] || [],
            quadra_nome: quadraMapLast[a.quadra_id] || null,
          })),
        }));
        setLastAgsLoading(false);
      } catch (e) {
        if (!mounted) return;
        setLastAgsError(e?.message || 'Erro ao carregar agendamentos');
        setLastAgsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [codigoEmpresa, lastAgsDateStart, lastAgsDateEnd]);

  // Hero section CTA label
  const empresaNome = useMemo(() => (company?.nome_fantasia || company?.razao_social || 'sua arena'), [company]);

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* Hero */}
      <motion.div variants={itemVariants} className="bg-surface/70 backdrop-blur-sm relative p-4 md:p-6 rounded-xl border border-white/10 overflow-hidden shadow-1">
        <div className="absolute inset-0 bg-court-pattern opacity-[0.03] mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="rounded-full p-[2px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_12px_rgba(168,85,247,0.35)] flex-shrink-0">
              <div className="rounded-full overflow-hidden bg-background w-10 h-10 sm:w-12 sm:h-12 grid place-items-center">
                <IsisAvatar size="xs" className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight flex items-center gap-2 flex-wrap">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-brand flex-shrink-0" /> 
                <span className="truncate">Análises da Ísis</span>
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 line-clamp-2">Como a Ísis está ajudando {empresaNome} a converter conversas em reservas.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-text-secondary hover:text-text-primary flex-shrink-0 self-end sm:self-auto"
            title="Configurações da Ísis"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </motion.div>

      {loading ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="relative">
            <div className="rounded-full p-[3px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse">
              <div className="rounded-full overflow-hidden bg-background w-20 h-20 grid place-items-center">
                <IsisAvatar size="sm" className="w-20 h-20" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> 
            <span className="text-sm font-medium">Carregando análises da Ísis...</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 w-full max-w-md">
            <div className="h-24 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-24 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-24 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </motion.div>
      ) : error ? (
        <div className="text-danger text-sm">{error}</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={CalendarCheck} title="Agendamentos feitos (hoje)" value={metrics.agendamentosIsisHoje} color="success" />
            <StatCard icon={TrendingUp} title="Agendamentos feitos (7 dias)" value={metrics.agendamentosIsis7d} color="info" />
            <StatCard icon={XCircle} title="Cancelamentos" value={metrics.cancelamentosIsis7d} color="danger" />
          </div>

          {/* Série por dia (7d) – linha única (Ísis) */}
          <motion.div variants={itemVariants} className="fx-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-text-primary flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-brand" />Distribuição – últimos 7 dias</h2>
            </div>
            <div className="px-1 pb-2">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData7d} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={28} />
                  <Tooltip
                    cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
                    contentStyle={{ background: 'rgba(10,10,10,0.85)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: '8px' }}
                    formatter={(value) => [value, 'Ísis (feitos)']}
                  />
                  <Line type="monotone" dataKey="isis" name="Ísis (feitos)" stroke="var(--brand)" strokeWidth={2.2} dot={{ r: 3, strokeWidth: 1.5, stroke: 'var(--brand)', fill: 'var(--background)' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Tops (30d) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div variants={itemVariants} className="fx-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-text-primary">Top quadras – últimos 30 dias (Ísis)</h2>
              </div>
              {metrics.topQuadras30d.length === 0 ? (
                <div className="text-sm text-text-muted">Nenhum agendamento nos últimos 30 dias.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {metrics.topQuadras30d.map((q) => (
                    <li key={q.id} className="py-2 text-sm flex items-center justify-between">
                      <span className="font-medium">{q.nome}</span>
                      <span className="text-text-muted">{q.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="fx-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-text-primary">Top modalidades – últimos 30 dias (Ísis)</h2>
              </div>
              {(!metrics.topModalidades30d || metrics.topModalidades30d.length === 0) ? (
                <div className="text-sm text-text-muted">Sem dados recentes.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {metrics.topModalidades30d.map((m, idx) => (
                    <li key={`${m.nome}-${idx}`} className="py-2 text-sm flex items-center justify-between">
                      <span className="font-medium">{m.nome}</span>
                      <span className="text-text-muted">{m.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>
        </>
      )}

      {/* Recentes - Tabela expandível */}
      {!loading && (
        <motion.div variants={itemVariants} className="fx-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-bold text-text-primary">Últimos agendamentos criados pela Ísis</h2>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-xs font-semibold text-text-primary"
                      title="Data início (criado em)"
                    >
                      <CalendarIcon className="h-4 w-4 text-text-secondary" />
                      <span>{lastAgsDateStart ? formatBr(ymdToDate(lastAgsDateStart)) : 'Início'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={ymdToDate(lastAgsDateStart) || undefined}
                      onSelect={(date) => setLastAgsDateStart(date ? toYmd(date) : '')}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-xs text-text-secondary select-none">até</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-xs font-semibold text-text-primary"
                      title="Data fim (criado em)"
                    >
                      <CalendarIcon className="h-4 w-4 text-text-secondary" />
                      <span>{lastAgsDateEnd ? formatBr(ymdToDate(lastAgsDateEnd)) : 'Fim'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={ymdToDate(lastAgsDateEnd) || undefined}
                      onSelect={(date) => setLastAgsDateEnd(date ? toYmd(date) : '')}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {null}
            </div>
          </div>
          <div className="sm:hidden mb-3 rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="grid [grid-template-columns:1fr_auto_1fr] gap-2 mb-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-xs font-semibold text-text-primary justify-between"
                    title="Data início (criado em)"
                  >
                    <CalendarIcon className="h-4 w-4 text-text-secondary" />
                    <span className="truncate">{lastAgsDateStart ? formatBr(ymdToDate(lastAgsDateStart)) : 'Início'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={ymdToDate(lastAgsDateStart) || undefined}
                    onSelect={(date) => setLastAgsDateStart(date ? toYmd(date) : '')}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center justify-center text-xs text-text-secondary select-none">até</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-xs font-semibold text-text-primary justify-between"
                    title="Data fim (criado em)"
                  >
                    <CalendarIcon className="h-4 w-4 text-text-secondary" />
                    <span className="truncate">{lastAgsDateEnd ? formatBr(ymdToDate(lastAgsDateEnd)) : 'Fim'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={ymdToDate(lastAgsDateEnd) || undefined}
                    onSelect={(date) => setLastAgsDateEnd(date ? toYmd(date) : '')}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {null}
          </div>
          {lastAgsLoading ? (
            <div className="flex items-center gap-2 text-text-muted text-sm py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando agendamentos...</span>
            </div>
          ) : lastAgsError ? (
            <div className="text-danger text-sm">{lastAgsError}</div>
          ) : metrics.ultimasInteracoes.length === 0 ? (
            <div className="text-sm text-text-muted">Nenhum agendamento recente.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-text-secondary border-b border-white/10">
                        <th className="w-8 py-2 pl-4 sm:pl-0"></th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap">Código</th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap">Cliente</th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap hidden sm:table-cell">Quadra</th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap">Data</th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap hidden md:table-cell">Horário</th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap">Status</th>
                        <th className="text-left py-2 pr-2 whitespace-nowrap hidden lg:table-cell">Participantes</th>
                        <th className="text-left py-2 pr-4 sm:pr-2 whitespace-nowrap hidden xl:table-cell">Criado em</th>
                      </tr>
                    </thead>
                <tbody>
                  {metrics.ultimasInteracoes.map((a) => {
                    const dtIni = a.inicio ? new Date(a.inicio) : null;
                    const dtFim = a.fim ? new Date(a.fim) : null;
                    const dataStr = dtIni ? dtIni.toLocaleDateString() : '-';
                    const horarioStr = dtIni && dtFim ? `${dtIni.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${dtFim.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : '-';
                    const count = Array.isArray(a.participantes) ? a.participantes.length : (Array.isArray(a.clientes) ? a.clientes.length : 0);
                    const isOpen = !!expanded[a.id];
                    const toggle = () => setExpanded(prev => ({ ...prev, [a.id]: !prev[a.id] }));
                    // Badge de status
                    const status = String(a.status || '').toLowerCase();
                    const statusMap = {
                      scheduled: { label: 'Agendado', cls: 'bg-info/15 text-info border border-info/20' },
                      confirmed: { label: 'Confirmado', cls: 'bg-success/15 text-success border border-success/20' },
                      in_progress: { label: 'Em andamento', cls: 'bg-brand/15 text-brand border border-brand/20' },
                      finished: { label: 'Finalizado', cls: 'bg-success/15 text-success border border-success/20' },
                      canceled: { label: 'Cancelado', cls: 'bg-danger/15 text-danger border border-danger/20' },
                      no_show: { label: 'No-show', cls: 'bg-warning/15 text-warning border border-warning/20' },
                    };
                    const st = statusMap[status] || { label: (a.status || '—'), cls: 'bg-white/10 text-text-secondary border border-white/15' };
                    return (
                      <>
                        <tr key={a.id} className={`border-b border-white/10 align-top ${isOpen ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'} transition-colors`}>
                          <td className="py-2 pl-4 sm:pl-0">
                            <button
                              type="button"
                              aria-label={isOpen ? 'Recolher' : 'Expandir'}
                              onClick={(e) => { e.stopPropagation(); toggle(); }}
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md border border-white/10 hover:bg-white/5 transition-colors ${isOpen ? 'rotate-180' : ''}`}
                            >
                              <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-text-secondary" />
                            </button>
                          </td>
                          <td className="py-2 pr-2 font-semibold text-text-primary whitespace-nowrap">#{a.codigo}</td>
                          <td className="py-2 pr-2 max-w-[120px] truncate">{a.cliente_nome || (Array.isArray(a.clientes) && a.clientes[0]) || '—'}</td>
                          <td className="py-2 pr-2 hidden sm:table-cell max-w-[100px] truncate">{a.quadra_nome || '—'}</td>
                          <td className="py-2 pr-2 whitespace-nowrap">{dataStr}</td>
                          <td className="py-2 pr-2 hidden md:table-cell whitespace-nowrap text-xs">{horarioStr}</td>
                          <td className="py-2 pr-2">
                            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wide whitespace-nowrap ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="py-2 pr-2 hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-text-primary text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand/70"></span>
                              {count}
                            </span>
                          </td>
                          <td className="py-2 pr-4 sm:pr-2 hidden xl:table-cell text-xs whitespace-nowrap">{a.criado_em ? new Date(a.criado_em).toLocaleString() : '-'}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={9} className="p-3 sm:p-4 bg-white/[0.035] border-b border-white/10">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                                <div>
                                  <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">Criado em</div>
                                  <div className="font-medium text-text-primary text-xs sm:text-sm">{a.criado_em ? new Date(a.criado_em).toLocaleString() : '-'}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">Início</div>
                                  <div className="font-medium text-text-primary text-xs sm:text-sm">{a.inicio ? new Date(a.inicio).toLocaleString() : '-'}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">Término</div>
                                  <div className="font-medium text-text-primary text-xs sm:text-sm">{a.fim ? new Date(a.fim).toLocaleString() : '-'}</div>
                                </div>
                              </div>
                              <div className="sm:hidden mb-3 grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Quadra</div>
                                  <div className="font-medium text-text-primary text-xs truncate">{a.quadra_nome || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Horário</div>
                                  <div className="font-medium text-text-primary text-xs">{horarioStr}</div>
                                </div>
                              </div>
                              <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted mb-2">Participantes ({count})</div>
                              {Array.isArray(a.participantes) && a.participantes.length > 0 ? (
                                <ul className="grid grid-cols-1 gap-1.5">
                                  {a.participantes.map((p, idx) => (
                                    <li key={idx} className="flex items-center justify-between py-1.5 px-2 sm:px-3 rounded-md border border-white/10 bg-white/5 gap-2">
                                      <span className="text-text-primary font-medium text-xs sm:text-sm truncate flex-1">{p.nome}</span>
                                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wide whitespace-nowrap flex-shrink-0 ${p.status_pagamento === 'Pago' ? 'bg-success/15 text-success border border-success/20' : 'bg-warning/15 text-warning border border-warning/20'}`}>
                                        {p.status_pagamento}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-text-muted text-xs sm:text-sm">Sem participantes cadastrados</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}
        </motion.div>
      )}

      {/* Modal de Configurações da Ísis */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand" /> Configurações da Ísis
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {settingsLoading ? (
              <div className="flex items-center gap-2 text-text-muted py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cancelamento */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">
                    Cancelamento (horas antes)
                  </label>
                  <p className="text-xs text-text-muted">
                    Tempo mínimo (em horas) antes do agendamento para permitir cancelamento via Ísis.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={cancelHours}
                      onChange={(e) => setCancelHours(e.target.value)}
                      placeholder="Ex: 2"
                      className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary text-center placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                    />
                    <span className="text-sm text-text-muted">horas</span>
                  </div>
                  <p className="text-xs text-text-muted italic">
                    Deixe vazio para permitir cancelamento a qualquer momento.
                  </p>
                </div>

                {/* Nome de exibição */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">
                    Nome de exibição
                  </label>
                  <p className="text-xs text-text-muted">
                    Nome que aparecerá no header da página de agendamento da Ísis.
                  </p>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Arena Palace"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                  />
                  <p className="text-xs text-text-muted italic">
                    Este é o nome que seus clientes verão ao acessar a Ísis.
                  </p>
                </div>

                {/* Link de agendamento */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">
                    Link de agendamento
                  </label>
                  <p className="text-xs text-text-muted">
                    Personalize o subdomínio do link de agendamento da Ísis.
                  </p>
                  {editingSubdomain ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, ''))}
                        placeholder="arenapalace"
                        autoFocus
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                      />
                      <span className="text-sm text-text-muted">.f7arena.com</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg group hover:border-white/20 transition-all cursor-pointer" onClick={() => setEditingSubdomain(true)}>
                      <span className="flex-1 text-text-primary font-mono">
                        {subdomain || 'arenapalace'}.f7arena.com
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/10 transition-colors text-text-muted group-hover:text-text-primary"
                        title="Editar subdomínio"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setEditingSubdomain(false);
                    }}
                    disabled={settingsSaving}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-brand hover:bg-brand/90 transition-colors text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {settingsSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
