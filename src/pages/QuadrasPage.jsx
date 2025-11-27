import React, { useEffect, useState, useRef } from 'react';
import { getCourtColor } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Users, TrendingUp, Eye, EyeOff, Calendar, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { when: 'beforeChildren', staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function SectionCard({ children, className = '' }) {
  return (
    <motion.div variants={itemVariants} className={`fx-card ${className}`}>
      {children}
    </motion.div>
  );
}

const StatCard = ({ icon, title, value, subtitle, color }) => {
  const Icon = icon;
  return (
    <motion.div variants={itemVariants} 
      className="bg-surface rounded-lg border-2 border-border hover:border-border-hover p-4 flex flex-col justify-between gap-2 transition-all duration-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm font-semibold">{title}</p>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
    </motion.div>
  );
};

function Input({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-text-muted">{label}</span>
      <input {...props} className={`bg-surface-2 border border-border rounded-md px-3 py-2 text-sm ${props.className || ''}`} />
    </label>
  );
}

export default function QuadrasPage() {
  const { toast } = useToast();
  const { userProfile, authReady } = useAuth();
  // Retry control similar to ClientesPage: contorna atrasos de token/RLS no Vercel
  const retryRef = useRef(false);
  const [quadras, setQuadras] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]');
      return !(Array.isArray(cached) && cached.length > 0);
    } catch {
      return true;
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [formQuadra, setFormQuadra] = useState({ nome: '', descricao: '', modalidades: [], tipo: 'Descoberta', status: 'Ativa', hora_inicio: '06:00', hora_fim: '23:59', valor_hora: '' });
  const [newMod, setNewMod] = useState("");

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nome: '', descricao: '', modalidades: [], tipo: 'Descoberta', status: 'Ativa', hora_inicio: '06:00', hora_fim: '23:59', valor_hora: '' });
  const [newEditMod, setNewEditMod] = useState("");
  
  // Stats
  const [showStats, setShowStats] = useState(true);
  const [stats, setStats] = useState({
    mostUsed: '-',
    topClient: '-',
    totalBookings: '-',
  });

  // Dias de funcionamento
  const [isDiasFuncionamentoOpen, setIsDiasFuncionamentoOpen] = useState(false);
  const [quadraFuncionamento, setQuadraFuncionamento] = useState(null);
  const [diasSemana, setDiasSemana] = useState({
    0: true, // Domingo
    1: true, // Segunda
    2: true, // Terça
    3: true, // Quarta
    4: true, // Quinta
    5: true, // Sexta
    6: true  // Sábado
  });
  const [datasEspeciais, setDatasEspeciais] = useState([]);
  const [novaDataFechamento, setNovaDataFechamento] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');
  const [loadingDiasFuncionamento, setLoadingDiasFuncionamento] = useState(false);

  // Helpers para converter entre input time (HH:mm) e banco (HH:mm:ss)
  const toDbTime = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = String(hhmm).split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
  };

  // Helpers de moeda BRL (R$) sem símbolo
  const maskBRL = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const val = (Number(digits) / 100).toFixed(2);
    const [ints, cents] = val.split('.');
    const withThousands = ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withThousands},${cents}`;
  };
  const parseBRL = (str) => {
    if (str == null || str === '') return NaN;
    const s = String(str).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  // Formata número para BRL (sem símbolo por padrão)
  const formatBRLNumber = (num, withSymbol = false) => {
    if (num == null || !Number.isFinite(Number(num))) return '-';
    const n = Number(num);
    const parts = n.toFixed(2).split('.');
    const ints = parts[0];
    const cents = parts[1];
    const withThousands = ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const out = `${withThousands},${cents}`;
    return withSymbol ? `R$ ${out}` : out;
  };
  const fromDbTime = (hhmmss) => {
    if (!hhmmss) return '';
    const [h, m] = String(hhmmss).split(':');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const timeToMinutes = (hhmm) => {
    if (!hhmm) return 0;
    const [h, m] = String(hhmm).split(':').map(Number);
    // Tratar 00:00 como 24:00 (fim do dia/meia-noite)
    const hours = (h === 0 && m === 0) ? 24 : (h || 0);
    return hours * 60 + (m || 0);
  };
  const isValidHalfHour = (hhmm) => {
    if (!hhmm) return false;
    const parts = String(hhmm).split(':');
    if (parts.length < 2) return false;
    const mm = Number(parts[1]);
    // Aceitar :00 ou :30 (incluindo 00:00 para meia-noite)
    return mm === 0 || mm === 30;
  };
  const snapToNearestHalfHour = (hhmm) => {
    if (!hhmm) return '';
    const [hStr, mStr] = String(hhmm).split(':');
    let h = Math.max(0, Math.min(23, parseInt(hStr || '0', 10)));
    let m = Math.max(0, Math.min(59, parseInt(mStr || '0', 10)));
    const roundedSlots = Math.round(m / 30); // 0,1,2
    if (roundedSlots >= 2) {
      // arredonda para próxima hora
      h += 1;
      m = 0;
    } else {
      m = roundedSlots * 30;
    }
    if (h >= 24) {
      // input type=time não aceita 24:00, então usamos 23:59 como representação de "fim do dia"
      return '23:59';
    }
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Watchdog: se uma submissão ficar presa, logar após 15s
  useEffect(() => {
    if (!submitting) return;
    const t = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('[Quadras] add/update stuck >15s', {
        route: '/quadras',
        codigo_empresa: userProfile?.codigo_empresa,
        editingId,
        formQuadra,
        editForm,
      });
    }, 15000);
    return () => clearTimeout(t);
  }, [submitting, userProfile?.codigo_empresa, editingId, formQuadra, editForm]);

  const loadQuadras = async () => {
    if (!userProfile?.codigo_empresa) return;
    const hasCache = quadras && quadras.length > 0;
    if (!hasCache) setLoading(true);
    const { data, error } = await supabase
      .from('quadras')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa)
      .order('nome', { ascending: true });
    if (error) {
      // Primeiro erro: não derruba lista atual; tenta 1x novamente
      if (!retryRef.current) {
        retryRef.current = true;
        setTimeout(loadQuadras, 800);
        if (!hasCache) setLoading(false);
        return;
      }
      toast({ title: 'Erro ao carregar quadras', description: error.message });
      if (!hasCache) setLoading(false);
      return;
    }
    const rows = data || [];
    // Resposta vazia pode acontecer por atraso de token/RLS em produção.
    // Se houver cache local, não sobrescrever imediatamente; tentar 1x novamente.
    if (rows.length === 0 && hasCache && !retryRef.current) {
      retryRef.current = true;
      setTimeout(loadQuadras, 600);
      if (!hasCache) setLoading(false);
      return;
    }
    retryRef.current = false;
    setQuadras(rows);
    try { localStorage.setItem('quadras:list', JSON.stringify(rows)); } catch {}
    if (!hasCache) setLoading(false);
  };

  const openEdit = (q) => {
    setEditingId(q.id);
    setEditForm({
      nome: q.nome || '',
      descricao: q.descricao || '',
      modalidades: Array.isArray(q.modalidades) ? q.modalidades : (q.modalidades ? [q.modalidades] : []),
      tipo: q.tipo || 'Descoberta',
      status: q.status || 'Ativa',
      hora_inicio: fromDbTime(q.hora_inicio || '06:00:00'),
      hora_fim: fromDbTime(q.hora_fim || '24:00:00') || '23:59',
      valor_hora: (q.valor != null && q.valor !== '') ? maskBRL(String((Number(q.valor) * 2).toFixed(2))) : '',
    });
    setNewEditMod('');
    setIsEditOpen(true);
  };

  const updateQuadra = async () => {
    if (!editForm.nome?.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe um nome para a quadra.' });
      return;
    }
    if (!editForm.hora_inicio || !editForm.hora_fim) {
      toast({ title: 'Horário obrigatório', description: 'Informe horário de abertura e fechamento.' });
      return;
    }
    if (!isValidHalfHour(editForm.hora_inicio) || !isValidHalfHour(editForm.hora_fim)) {
      toast({ title: 'Intervalo inválido', description: 'Use apenas horários em horas cheias ou :30.' });
      return;
    }
    if (timeToMinutes(editForm.hora_fim) <= timeToMinutes(editForm.hora_inicio)) {
      toast({ title: 'Horário inválido', description: 'Fechamento deve ser depois da abertura.' });
      return;
    }
    if (!editForm.modalidades?.length) {
      toast({ title: 'Adicione ao menos uma modalidade', description: 'Informe e adicione uma modalidade usando o botão +.' });
      return;
    }
    if (!userProfile?.codigo_empresa || !editingId) {
      toast({ title: 'Atualização indisponível', description: 'Dados insuficientes para atualizar.' });
      return;
    }
    setSubmitting(true);
    const payload = {
      nome: editForm.nome.trim(),
      descricao: editForm.descricao?.trim() || null,
      modalidades: editForm.modalidades,
      tipo: editForm.tipo,
      status: editForm.status,
      hora_inicio: toDbTime(editForm.hora_inicio),
      hora_fim: toDbTime(editForm.hora_fim === '24:00' ? '23:59' : editForm.hora_fim),
    };
    // Mapear valor_hora (hora) -> valor (meia-hora)
    if (editForm.valor_hora != null && String(editForm.valor_hora).trim() !== '') {
      const vh = parseBRL(editForm.valor_hora);
      if (!Number.isNaN(vh) && Number.isFinite(vh)) {
        payload.valor = Math.round((vh / 2) * 100) / 100;
      }
    } else {
      payload.valor = null;
    }

    // Helper de timeout, alinhado ao fluxo de criação
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar quadra (>12s)')), ms))
      ]);

    let data, error;
    try {
      ({ data, error } = await withTimeout(
        supabase
          .from('quadras')
          .update(payload)
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .eq('id', editingId)
          .select('id,nome,descricao,modalidades,tipo,status,hora_inicio,hora_fim,valor')
          .single(),
        12000
      ));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('update timeout/error', e);
      toast({ title: 'Tempo excedido', description: 'Sem resposta do servidor ao atualizar. Verifique conexão e tente novamente.' });
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao atualizar quadra', description: error.message });
      return;
    }

    // Alguns ambientes com RLS não retornam a representação no UPDATE
    if (!data) {
      await loadQuadras();
      toast({ title: 'Quadra atualizada', description: `${payload.nome} foi atualizada.` });
      setIsEditOpen(false);
      setEditingId(null);
      setNewEditMod('');
      return;
    }

    toast({ title: 'Quadra atualizada', description: `${data.nome} foi atualizada.` });
    setIsEditOpen(false);
    setEditingId(null);
    setNewEditMod('');
    // Atualiza item na lista
    setQuadras((prev) => prev.map((it) => (it.id === data.id ? data : it)).sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  // Hidratar do cache para evitar sumiço na troca de abas e carregar quando auth pronta
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]');
      if (Array.isArray(cached) && cached.length && quadras.length === 0) {
        setQuadras(cached);
        setLoading(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (authReady && userProfile?.codigo_empresa) {
      loadQuadras();
      loadStats();
    }
  }, [authReady, userProfile?.codigo_empresa]);
  
  const loadStats = async () => {
    if (!userProfile?.codigo_empresa) return;
    
    try {
      // Buscar agendamentos dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: agendamentos } = await supabase
        .from('agendamentos')
        .select('quadra_id, cliente_id, quadras!inner(nome), clientes(nome, codigo)')
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .gte('inicio', thirtyDaysAgo.toISOString())
        .neq('status', 'canceled');
      
      if (!agendamentos || agendamentos.length === 0) {
        setStats({ mostUsed: 'Sem dados', topClient: 'Sem dados', totalBookings: '0' });
        return;
      }
      
      // Quadra mais usada
      const quadraCount = {};
      agendamentos.forEach(a => {
        const nome = a.quadras?.nome || 'Sem nome';
        quadraCount[nome] = (quadraCount[nome] || 0) + 1;
      });
      const mostUsed = Object.entries(quadraCount).sort((a, b) => b[1] - a[1])[0];
      
      // Cliente mais agendado (excluindo cliente consumidor - código 0)
      const clienteCount = {};
      agendamentos.forEach(a => {
        if (a.cliente_id && a.clientes?.nome) {
          // Filtrar cliente consumidor (código 0)
          const codigo = a.clientes?.codigo;
          if (codigo === 0 || codigo === '0') return;
          
          const nome = a.clientes.nome;
          clienteCount[nome] = (clienteCount[nome] || 0) + 1;
        }
      });
      const topClient = Object.entries(clienteCount).sort((a, b) => b[1] - a[1])[0];
      
      setStats({
        mostUsed: mostUsed ? `${mostUsed[0]} (${mostUsed[1]})` : 'Sem dados',
        topClient: topClient ? `${topClient[0]} (${topClient[1]})` : 'Sem dados',
        totalBookings: agendamentos.length.toString(),
      });
    } catch (e) {
      console.error('Erro ao carregar stats:', e);
      setStats({ mostUsed: 'Erro', topClient: 'Erro', totalBookings: '0' });
    }
  };

  const addQuadra = async () => {
    // eslint-disable-next-line no-console
    console.groupCollapsed('[Quadras] addQuadra: CLICK');
    // eslint-disable-next-line no-console
    console.time('[Quadras] addQuadra duration');
    // eslint-disable-next-line no-console
    console.log('pre-validate', { codigo_empresa: userProfile?.codigo_empresa, formQuadra });
    if (!formQuadra.nome?.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe um nome para a quadra.' });
      // eslint-disable-next-line no-console
      console.warn('validation: missing nome');
      console.groupEnd();
      return;
    }
    if (!formQuadra.modalidades?.length) {
      toast({ title: 'Adicione ao menos uma modalidade', description: 'Informe e adicione uma modalidade usando o botão +.' });
      return;
    }
    if (!formQuadra.hora_inicio || !formQuadra.hora_fim) {
      toast({ title: 'Horário obrigatório', description: 'Informe horário de abertura e fechamento.' });
      return;
    }
    if (!isValidHalfHour(formQuadra.hora_inicio) || !isValidHalfHour(formQuadra.hora_fim)) {
      toast({ title: 'Intervalo inválido', description: 'Use apenas horários em horas cheias ou :30.' });
      return;
    }
    if (timeToMinutes(formQuadra.hora_fim) <= timeToMinutes(formQuadra.hora_inicio)) {
      toast({ title: 'Horário inválido', description: 'Fechamento deve ser depois da abertura.' });
      return;
    }
    if (!userProfile?.codigo_empresa) {
      toast({ title: 'Empresa não localizada', description: 'Associe o usuário a uma empresa para cadastrar quadras.' });
      return;
    }
    setSubmitting(true);
    // eslint-disable-next-line no-console
    console.log('validated, building payload');
    const payload = {
      codigo_empresa: userProfile.codigo_empresa,
      nome: formQuadra.nome.trim(),
      descricao: formQuadra.descricao?.trim() || null,
      modalidades: formQuadra.modalidades,
      tipo: formQuadra.tipo,
      status: formQuadra.status,
      hora_inicio: toDbTime(formQuadra.hora_inicio),
      hora_fim: toDbTime(formQuadra.hora_fim === '24:00' ? '23:59' : formQuadra.hora_fim),
    };
    // Mapear valor_hora (hora) -> valor (meia-hora)
    if (formQuadra.valor_hora != null && String(formQuadra.valor_hora).trim() !== '') {
      const vh = parseBRL(formQuadra.valor_hora);
      if (!Number.isNaN(vh) && Number.isFinite(vh)) {
        payload.valor = Math.round((vh / 2) * 100) / 100;
      }
    }
    // eslint-disable-next-line no-console
    console.log('payload', payload);
    // Helper para timeout sem travar UI
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao inserir quadra (>12s)')), ms))
      ]);
    let data, error;
    try {
      ({ data, error } = await withTimeout(
        supabase
          .from('quadras')
          .insert(payload)
          .select('id,nome,descricao,modalidades,tipo,status,hora_inicio,hora_fim,valor')
          .single(),
        12000
      ));
    } catch (e) {
      setSubmitting(false);
      // eslint-disable-next-line no-console
      console.error('insert timeout/error', e);
      toast({ title: 'Tempo excedido', description: 'Sem resposta do servidor ao cadastrar. Verifique conexão e tente novamente.' });
      console.timeEnd('[Quadras] addQuadra duration');
      console.groupEnd();
      return;
    }
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao cadastrar quadra', description: error.message });
      // eslint-disable-next-line no-console
      console.error('insert error', { code: error.code, message: error.message, details: error.details });
      console.timeEnd('[Quadras] addQuadra duration');
      console.groupEnd();
      return;
    }
    // Alguns ambientes com RLS não retornam a representação
    if (!data) {
      // eslint-disable-next-line no-console
      console.warn('insert success sem representação; recarregando lista');
      await loadQuadras();
      toast({ title: 'Quadra adicionada', description: `${payload.nome} foi cadastrada.` });
      setFormQuadra({ nome: '', descricao: '', modalidades: [], tipo: 'Descoberta', status: 'Ativa', hora_inicio: '06:00', hora_fim: '23:59', valor_hora: '' });
      setIsCreateOpen(false);
      setNewMod("");
      console.timeEnd('[Quadras] addQuadra duration');
      console.groupEnd();
      return;
    }
    // eslint-disable-next-line no-console
    console.log('insert success', { id: data?.id, nome: data?.nome });
    toast({ title: 'Quadra adicionada', description: `${data.nome} foi cadastrada.` });
    setFormQuadra({ nome: '', descricao: '', modalidades: [], tipo: 'Descoberta', status: 'Ativa', hora_inicio: '06:00', hora_fim: '23:59', valor_hora: '' });
    setIsCreateOpen(false);
    setNewMod("");
    // Atualiza lista
    setQuadras((prev) => [data, ...prev].sort((a, b) => a.nome.localeCompare(b.nome)));
    // eslint-disable-next-line no-console
    console.timeEnd('[Quadras] addQuadra duration');
    console.groupEnd();
  };

  // Funções para dias de funcionamento
  const openDiasFuncionamento = async (quadra) => {
    setQuadraFuncionamento(quadra);
    setLoadingDiasFuncionamento(true);
    
    try {
      // Carregar configurações existentes
      const { data: configuracoes, error } = await supabase
        .from('quadras_dias_funcionamento')
        .select('*')
        .eq('quadra_id', quadra.id)
        .eq('codigo_empresa', userProfile.codigo_empresa);
      
      if (error) throw error;
      
      // Resetar estados
      const novosDiasSemana = {
        0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true
      };
      const novasDatasEspeciais = [];
      
      // Aplicar configurações existentes
      configuracoes?.forEach(config => {
        if (config.tipo === 'dia_semana') {
          novosDiasSemana[config.dia_semana] = config.funciona;
        } else if (config.tipo === 'data_fechamento') {
          novasDatasEspeciais.push(config);
        }
      });
      
      setDiasSemana(novosDiasSemana);
      setDatasEspeciais(novasDatasEspeciais);
      setIsDiasFuncionamentoOpen(true);
      
    } catch (error) {
      console.error('Erro ao carregar dias de funcionamento:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar as configurações.' });
    } finally {
      setLoadingDiasFuncionamento(false);
    }
  };

  const salvarDiasSemana = async () => {
    if (!quadraFuncionamento) return;
    
    setLoadingDiasFuncionamento(true);
    
    try {
      // Deletar configurações existentes de dias da semana
      await supabase
        .from('quadras_dias_funcionamento')
        .delete()
        .eq('quadra_id', quadraFuncionamento.id)
        .eq('tipo', 'dia_semana');
      
      // Inserir novas configurações
      const configuracoes = Object.entries(diasSemana).map(([dia, funciona]) => ({
        quadra_id: quadraFuncionamento.id,
        codigo_empresa: userProfile.codigo_empresa,
        tipo: 'dia_semana',
        dia_semana: parseInt(dia),
        funciona: funciona,
        observacao: 'Configuração de dias da semana'
      }));
      
      const { error } = await supabase
        .from('quadras_dias_funcionamento')
        .insert(configuracoes);
      
      if (error) throw error;
      
      toast({ title: 'Sucesso', description: 'Dias da semana salvos com sucesso!' });
      
    } catch (error) {
      console.error('Erro ao salvar dias da semana:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar as configurações.' });
    } finally {
      setLoadingDiasFuncionamento(false);
    }
  };

  const adicionarDataFechamento = async () => {
    if (!quadraFuncionamento || !novaDataFechamento) return;
    
    setLoadingDiasFuncionamento(true);
    
    try {
      const { data, error } = await supabase
        .from('quadras_dias_funcionamento')
        .insert({
          quadra_id: quadraFuncionamento.id,
          codigo_empresa: userProfile.codigo_empresa,
          tipo: 'data_fechamento',
          data_fechamento: novaDataFechamento,
          funciona: false,
          observacao: observacaoFechamento || 'Fechamento especial'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setDatasEspeciais(prev => [...prev, data]);
      setNovaDataFechamento('');
      setObservacaoFechamento('');
      
      toast({ title: 'Sucesso', description: 'Data de fechamento adicionada!' });
      
    } catch (error) {
      console.error('Erro ao adicionar data de fechamento:', error);
      toast({ title: 'Erro', description: 'Não foi possível adicionar a data de fechamento.' });
    } finally {
      setLoadingDiasFuncionamento(false);
    }
  };

  const removerDataFechamento = async (id) => {
    setLoadingDiasFuncionamento(true);
    
    try {
      const { error } = await supabase
        .from('quadras_dias_funcionamento')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setDatasEspeciais(prev => prev.filter(item => item.id !== id));
      
      toast({ title: 'Sucesso', description: 'Data de fechamento removida!' });
      
    } catch (error) {
      console.error('Erro ao remover data de fechamento:', error);
      toast({ title: 'Erro', description: 'Não foi possível remover a data de fechamento.' });
    } finally {
      setLoadingDiasFuncionamento(false);
    }
  };

  return (
    <>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tighter">Controle de Quadras</h1>
            <p className="text-text-secondary">Gerencie as quadras e horários disponíveis.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowStats(s => !s)} title={showStats ? 'Ocultar resumo' : 'Mostrar resumo'} aria-label={showStats ? 'Ocultar resumo' : 'Mostrar resumo'}>
              {showStats ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="shadow-sm">Adicionar Quadra</Button>
          </div>
        </motion.div>
        
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <StatCard icon={Trophy} title="Quadra Mais Usada" value={stats.mostUsed} subtitle="Últimos 30 dias" color="text-brand" />
            <StatCard icon={Users} title="Cliente Top" value={stats.topClient} subtitle="Mais agendamentos no mês" color="text-purple" />
            <StatCard icon={TrendingUp} title="Total de Agendamentos" value={stats.totalBookings} subtitle="Últimos 30 dias" color="text-success" />
          </div>
        )}

        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">Quadras</h2>
            <div className="text-xs text-text-muted">
              {loading ? 'Carregando...' : `${quadras.length} registro(s)`}
            </div>
          </div>
          {(!loading && quadras.length === 0) ? (
            <div className="text-sm text-text-muted py-8 text-center">
              <div className="font-medium mb-1">Nenhuma quadra cadastrada</div>
              <div className="mb-4">Clique em "Adicionar Quadra" para cadastrar a primeira.</div>
              <Button onClick={() => setIsCreateOpen(true)}>Adicionar Quadra</Button>
            </div>
          ) : (
            <>
              {/* Layout Mobile - Cards */}
              <div className="md:hidden space-y-3">
                {quadras.map((q) => (
                  <div key={q.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
                    {/* Header: Nome + Status */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCourtColor(q.nome), boxShadow: '0 0 0 2px rgba(255,255,255,0.06)' }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-base text-text-primary truncate">{q.nome}</span>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${q.status === 'Ativa' ? 'bg-emerald-50/5 border-emerald-500/30 text-emerald-400' : q.status === 'Manutenção' ? 'bg-amber-50/5 border-amber-500/30 text-amber-400' : 'bg-surface-2 border-border text-text-muted'}`}>
                        {q.status}
                      </span>
                    </div>

                    {/* Modalidades */}
                    {Array.isArray(q.modalidades) && q.modalidades.length > 0 && (
                      <div>
                        <span className="text-xs text-text-muted mb-1 block">Modalidades</span>
                        <div className="flex flex-wrap gap-1">
                          {q.modalidades.map((m) => (
                            <span key={m} className="inline-flex px-2 py-0.5 rounded-full bg-surface-2 border border-border text-xs">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Valor e Horário */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-text-muted block mb-1">Valor/hora</span>
                        <span className="text-sm font-medium">
                          {q.valor == null || q.valor === '' ? '-' : formatBRLNumber(Number(q.valor) * 2, true)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-text-muted block mb-1">Funcionamento</span>
                        <span className="text-sm font-medium">
                          {fromDbTime(q.hora_inicio)} - {fromDbTime(q.hora_fim === '24:00:00' ? '23:59:00' : q.hora_fim)}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDiasFuncionamento(q)} className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Dias
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(q)}>
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Layout Desktop - Tabela */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-surface-0">
                <Table>
                  <TableHeader className="bg-surface-2/60 backdrop-blur supports-[backdrop-filter]:bg-surface-2/70">
                    <TableRow>
                      <TableHead className="text-[11px] md:text-xs uppercase tracking-wide text-text-muted">Nome</TableHead>
                      <TableHead className="text-[11px] md:text-xs uppercase tracking-wide text-text-muted">Modalidades</TableHead>
                      <TableHead className="text-[11px] md:text-xs uppercase tracking-wide text-text-muted">Valor por hora</TableHead>
                      <TableHead className="text-[11px] md:text-xs uppercase tracking-wide text-text-muted">Funcionamento</TableHead>
                      <TableHead className="text-[11px] md:text-xs uppercase tracking-wide text-text-muted">Status</TableHead>
                      <TableHead className="text-right text-[11px] md:text-xs uppercase tracking-wide text-text-muted">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quadras.map((q) => (
                      <TableRow key={q.id} className="hover:bg-surface-2/40 transition-colors">
                        <TableCell className="font-medium text-sm md:text-base text-text-primary">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getCourtColor(q.nome), boxShadow: '0 0 0 2px rgba(255,255,255,0.06)' }}
                              aria-hidden="true"
                            />
                            <span>{q.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm md:text-base">
                          {Array.isArray(q.modalidades) && q.modalidades.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {q.modalidades.map((m) => (
                                <span key={m} className="inline-flex px-2 py-0.5 rounded-full bg-surface-2 border border-border text-[11px] md:text-xs">{m}</span>
                              ))}
                            </div>
                          ) : (q.modalidades || '')}
                        </TableCell>
                        <TableCell className="text-sm md:text-base">
                          {q.valor == null || q.valor === ''
                            ? '-'
                            : (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-surface-2 border border-border text-[11px] md:text-xs">
                                {formatBRLNumber(Number(q.valor) * 2, true)}
                              </span>
                            )}
                        </TableCell>
                        <TableCell className="text-sm md:text-base">
                          {fromDbTime(q.hora_inicio)} - {fromDbTime(q.hora_fim === '24:00:00' ? '23:59:00' : q.hora_fim)}
                        </TableCell>
                        <TableCell className="text-sm md:text-base">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] md:text-xs border ${q.status === 'Ativa' ? 'bg-emerald-50/5 border-emerald-500/30 text-emerald-400' : q.status === 'Manutenção' ? 'bg-amber-50/5 border-amber-500/30 text-amber-400' : 'bg-surface-2 border-border text-text-muted'}`}>
                            {q.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => openDiasFuncionamento(q)} className="text-sm">
                              <Calendar className="h-3 w-3 mr-1" />
                              Dias
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEdit(q)} className="text-sm">Editar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </SectionCard>

        {/* Modal de criação */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Quadra</DialogTitle>
              <DialogDescription>Cadastre uma nova quadra da sua empresa.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <Input label="Nome" value={formQuadra.nome} onChange={(e) => setFormQuadra({ ...formQuadra, nome: e.target.value })} placeholder="Ex.: Quadra Society 2" />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Descrição (opcional)</span>
                <textarea
                  value={formQuadra.descricao}
                  onChange={(e) => setFormQuadra({ ...formQuadra, descricao: e.target.value })}
                  placeholder="Ex.: Quadra oficial com grama sintética, iluminação LED, vestiários completos"
                  rows={3}
                  className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm resize-none"
                />
              </label>
              <div className="flex flex-col gap-2 text-sm">
                <span className="text-xs text-text-muted">Modalidades</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMod}
                    onChange={(e) => setNewMod(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = newMod.trim();
                        if (!v) return;
                        setFormQuadra(prev => {
                          const exists = prev.modalidades.some(m => m.toLowerCase() === v.toLowerCase());
                          if (exists) return prev;
                          return { ...prev, modalidades: [...prev.modalidades, v] };
                        });
                        setNewMod('');
                      }
                    }}
                    placeholder="Ex.: Society"
                    className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm w-60 sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className={`bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={!newMod.trim()}
                    onClick={() => {
                      const v = newMod.trim();
                      if (!v) return;
                      setFormQuadra(prev => {
                        const exists = prev.modalidades.some(m => m.toLowerCase() === v.toLowerCase());
                        if (exists) return prev;
                        return { ...prev, modalidades: [...prev.modalidades, v] };
                      });
                      setNewMod('');
                    }}
                    aria-label="Adicionar modalidade"
                    title="Adicionar modalidade"
                  >
                    +
                  </Button>
                </div>
                {formQuadra.modalidades.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formQuadra.modalidades.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-surface-2 text-xs">
                        <span className="px-0.5">{m}</span>
                        <button
                          type="button"
                          className="text-text-muted hover:text-destructive/80"
                          onClick={() => setFormQuadra(prev => ({ ...prev, modalidades: prev.modalidades.filter(x => x !== m) }))}
                          aria-label={`Remover ${m}`}
                          title={`Remover ${m}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Tipo</span>
                <select value={formQuadra.tipo} onChange={(e) => setFormQuadra({ ...formQuadra, tipo: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option>Descoberta</option>
                  <option>Coberta</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Valor por hora (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0,00"
                  value={formQuadra.valor_hora}
                  onChange={(e) => setFormQuadra({ ...formQuadra, valor_hora: maskBRL(e.target.value) })}
                  className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm w-40"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Abertura</span>
                  <input
                    type="time"
                    step="1800"
                    value={formQuadra.hora_inicio}
                    onChange={(e) => setFormQuadra({ ...formQuadra, hora_inicio: e.target.value })}
                    onBlur={(e) => setFormQuadra(prev => ({ ...prev, hora_inicio: snapToNearestHalfHour(e.target.value) }))}
                    className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Fechamento</span>
                  <input
                    type="time"
                    step="1800"
                    value={formQuadra.hora_fim}
                    onChange={(e) => setFormQuadra({ ...formQuadra, hora_fim: e.target.value })}
                    onBlur={(e) => setFormQuadra(prev => ({ ...prev, hora_fim: snapToNearestHalfHour(e.target.value) }))}
                    className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Status</span>
                <select value={formQuadra.status} onChange={(e) => setFormQuadra({ ...formQuadra, status: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option>Ativa</option>
                  <option>Inativa</option>
                  <option>Manutenção</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button onClick={addQuadra} disabled={submitting || formQuadra.modalidades.length === 0}>
                {submitting ? 'Adicionando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de edição */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Quadra</DialogTitle>
              <DialogDescription>Atualize os dados da quadra selecionada.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} placeholder="Ex.: Quadra Society 2" />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Descrição (opcional)</span>
                <textarea
                  value={editForm.descricao}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                  placeholder="Ex.: Quadra oficial com grama sintética, iluminação LED, vestiários completos"
                  rows={3}
                  className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm resize-none"
                />
              </label>
              <div className="flex flex-col gap-2 text-sm">
                <span className="text-xs text-text-muted">Modalidades</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newEditMod}
                    onChange={(e) => setNewEditMod(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = newEditMod.trim();
                        if (!v) return;
                        setEditForm(prev => {
                          const exists = prev.modalidades.some(m => m.toLowerCase() === v.toLowerCase());
                          if (exists) return prev;
                          return { ...prev, modalidades: [...prev.modalidades, v] };
                        });
                        setNewEditMod('');
                      }
                    }}
                    placeholder="Ex.: Society"
                    className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm w-60 sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = newEditMod.trim();
                      if (!v) return;
                      setEditForm(prev => {
                        const exists = prev.modalidades.some(m => m.toLowerCase() === v.toLowerCase());
                        if (exists) return prev;
                        return { ...prev, modalidades: [...prev.modalidades, v] };
                      });
                      setNewEditMod('');
                    }}
                  >
                    +
                  </Button>
                </div>
                {editForm.modalidades.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editForm.modalidades.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-surface-2 text-xs">
                        <span className="px-0.5">{m}</span>
                        <button
                          type="button"
                          className="text-text-muted hover:text-destructive/80"
                          onClick={() => setEditForm(prev => ({ ...prev, modalidades: prev.modalidades.filter(x => x !== m) }))}
                          aria-label={`Remover ${m}`}
                          title={`Remover ${m}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Tipo</span>
                <select value={editForm.tipo} onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option>Descoberta</option>
                  <option>Coberta</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Valor por hora (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0,00"
                  value={editForm.valor_hora}
                  onChange={(e) => setEditForm({ ...editForm, valor_hora: maskBRL(e.target.value) })}
                  className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm w-40"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Abertura</span>
                  <input
                    type="time"
                    step="1800"
                    value={editForm.hora_inicio}
                    onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })}
                    onBlur={(e) => setEditForm(prev => ({ ...prev, hora_inicio: snapToNearestHalfHour(e.target.value) }))}
                    className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Fechamento</span>
                  <input
                    type="time"
                    step="1800"
                    value={editForm.hora_fim}
                    onChange={(e) => setEditForm({ ...editForm, hora_fim: e.target.value })}
                    onBlur={(e) => setEditForm(prev => ({ ...prev, hora_fim: snapToNearestHalfHour(e.target.value) }))}
                    className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Status</span>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option>Ativa</option>
                  <option>Inativa</option>
                  <option>Manutenção</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button onClick={updateQuadra} disabled={submitting || editForm.modalidades.length === 0}>
                {submitting ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Dias de Funcionamento */}
        <Dialog open={isDiasFuncionamentoOpen} onOpenChange={setIsDiasFuncionamentoOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden pointer-events-none">
            {/* Overlay de desenvolvimento encima do modal */}
            <div className="fixed inset-0 z-50 backdrop-blur-lg bg-black/60 flex items-center justify-center pointer-events-auto">
              <div className="rounded-2xl border border-white/30 bg-slate-900 shadow-2xl max-w-sm w-full text-center mx-4">
                <div className="px-8 py-10">
                  {/* Logo e nome Fluxo7Arena */}
                  <div className="flex items-center justify-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div className="flex items-baseline select-none">
                      <span className="font-extrabold text-3xl" style={{ color: '#FF6600' }}>Fluxo</span>
                      <span className="font-extrabold text-3xl" style={{ color: '#FFAA33' }}>7</span>
                      <span className="font-medium text-3xl" style={{ color: '#FFFFFF' }}> Arena</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white mb-3">Em Desenvolvimento</div>
                  <p className="text-base text-gray-200">Esta funcionalidade está sendo desenvolvida e em breve estará disponível.</p>
                  <div className="mt-8 flex items-center justify-center">
                    <Button variant="outline" onClick={() => setIsDiasFuncionamentoOpen(false)}>Fechar</Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Dias de Funcionamento - {quadraFuncionamento?.nome}
              </DialogTitle>
              <DialogDescription>
                Configure os dias da semana que a quadra funciona e adicione datas específicas de fechamento.
              </DialogDescription>
            </DialogHeader>
            
            {loadingDiasFuncionamento ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-text-muted">Carregando configurações...</div>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Dias da Semana */}
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Dias da Semana</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: 0, label: 'Domingo', short: 'Dom' },
                      { key: 1, label: 'Segunda', short: 'Seg' },
                      { key: 2, label: 'Terça', short: 'Ter' },
                      { key: 3, label: 'Quarta', short: 'Qua' },
                      { key: 4, label: 'Quinta', short: 'Qui' },
                      { key: 5, label: 'Sexta', short: 'Sex' },
                      { key: 6, label: 'Sábado', short: 'Sáb' }
                    ].map(dia => (
                      <label key={dia.key} className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-surface-2/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={diasSemana[dia.key]}
                          onChange={(e) => setDiasSemana(prev => ({ ...prev, [dia.key]: e.target.checked }))}
                          className="w-4 h-4 text-primary bg-surface-2 border-border rounded focus:ring-primary focus:ring-2"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary">{dia.short}</span>
                          <span className="text-xs text-text-muted hidden sm:block">{dia.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button onClick={salvarDiasSemana} disabled={loadingDiasFuncionamento} size="sm">
                      {loadingDiasFuncionamento ? 'Salvando...' : 'Salvar Dias da Semana'}
                    </Button>
                  </div>
                </div>

                {/* Datas Específicas de Fechamento */}
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Datas de Fechamento</h3>
                  
                  {/* Adicionar Nova Data */}
                  <div className="bg-surface-2/30 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Data</label>
                        <input
                          type="date"
                          value={novaDataFechamento}
                          onChange={(e) => setNovaDataFechamento(e.target.value)}
                          className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Observação</label>
                        <input
                          type="text"
                          placeholder="Ex: Feriado, Manutenção"
                          value={observacaoFechamento}
                          onChange={(e) => setObservacaoFechamento(e.target.value)}
                          className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={adicionarDataFechamento}
                          disabled={!novaDataFechamento || loadingDiasFuncionamento}
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Datas de Fechamento */}
                  {datasEspeciais.length > 0 ? (
                    <div className="space-y-2">
                      {datasEspeciais.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-surface-2/50 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-text-muted" />
                            <div>
                              <div className="text-sm font-medium text-text-primary">
                                {new Date(item.data_fechamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </div>
                              {item.observacao && (
                                <div className="text-xs text-text-muted">{item.observacao}</div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removerDataFechamento(item.id)}
                            disabled={loadingDiasFuncionamento}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-text-muted">
                      Nenhuma data de fechamento configurada
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDiasFuncionamentoOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  );
}
