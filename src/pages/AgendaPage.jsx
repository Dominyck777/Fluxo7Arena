import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Lock, Search, SlidersHorizontal, Clock, CheckCircle, XCircle, CalendarPlus, Users, DollarSign, Repeat, Trash2, GripVertical, Sparkles, Ban, AlertTriangle, ChevronDown, Play, PlayCircle, Flag, UserX, X, Settings } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format, addDays, subDays, startOfDay, addHours, getHours, getMinutes, setHours, setMinutes, addMinutes, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, getCourtColor } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import ClientFormModal from '@/components/clients/ClientFormModal';

// Grade fixa de 30 em 30 minutos (constantes usadas por toda a página)
const SLOT_MINUTES = 30;

// Helpers de moeda BRL (sem símbolo), no formato 1.234,56
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

// Exibe apenas primeiro e segundo nomes (primeiros dois tokens)
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
}
const SLOT_HEIGHT = 56; // altura de cada bloco de 30 minutos (mais espaço para conteúdo)
const BOOKING_GAP_Y = 6; // margem vertical sutil (top/bottom) aplicada a todos os agendamentos (aumentada)
const START_HOUR = 6;
const END_HOUR = 24; // exclusivo
// timeSlots (não utilizado diretamente, mas mantido como referência útil)
const timeSlots = Array.from({ length: (END_HOUR - START_HOUR) * (60 / SLOT_MINUTES) }, (_, i) => {
  const totalMinutes = START_HOUR * 60 + i * SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    isHourMark: minutes === 0,
  };
});

// Modalidades disponíveis (clientes sempre vêm do banco por empresa; não usar mock)
const modalities = ['Futebol', 'Beach Tennis', 'Futevôlei', 'Treino'];
// Novos status alinhados ao statusConfig
const statuses = ['scheduled', 'confirmed', 'in_progress', 'finished', 'canceled', 'absent'];

function createBooking(baseDate, court, startHour, startMin, durationMin, status, modality, customer, id) {
  const start = setMinutes(setHours(startOfDay(baseDate), startHour), startMin);
  const endMinutesTotal = startHour * 60 + startMin + durationMin;
  const end = setMinutes(setHours(startOfDay(baseDate), Math.floor(endMinutesTotal / 60)), endMinutesTotal % 60);
  return { id, court, customer, start, end, status, modality };
}

function generateWeeklySamples(anchorDate = new Date()) {
  const baseWeek = startOfWeek(anchorDate, { weekStartsOn: 1 }); // segunda
  const samples = [];
  let id = 1;

  const slots = [
    { h: 8, m: 0, d: 60 },
    { h: 9, m: 30, d: 90 },
    { h: 11, m: 0, d: 60 },
    { h: 14, m: 0, d: 60 },
    { h: 16, m: 30, d: 60 },
    { h: 18, m: 0, d: 90 },
    { h: 20, m: 0, d: 60 },
  ];

  // Em produção, não gerar amostras quando não houver quadras do banco
  for (let day = 0; day < 7; day++) {
    const date = addDays(baseWeek, day);
    const demoCourts = [];
    demoCourts.forEach((court, ci) => {
      slots.forEach((s, si) => {
        // Variação leve por dia/quadra para não sobrecarregar
        if ((si + day + ci) % 2 === 0) {
          const status = statuses[(si + day) % statuses.length];
          const modality = modalities[(ci + si) % modalities.length];
          const customer = customers[(day + si + ci) % customers.length];
          const offsetMin = ((day + ci + si) % 2) * 30; // 0 ou 30
          const h = Math.min(END_HOUR - 1, s.h);
          const m = (s.m + offsetMin) % 60;
          const startHour = h + Math.floor((s.m + offsetMin) / 60);
          const startMin = m;
          // Garantir dentro da janela
          if (startHour >= START_HOUR && startHour < END_HOUR) {
            samples.push(
              createBooking(date, court, startHour, startMin, s.d, status, modality, customer, id++)
            );
          }
        }
      });
    });
  }
  return samples;
}

// Sem dados de amostra por padrão; bookings começam vazios
const initialBookings = [];

// (as constantes do grid foram movidas para o topo do arquivo)

const statusConfig = {
  // Azul médio (#3B82F6)
  scheduled:   { label: 'Agendado',    accent: 'bg-[#3B82F6]', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]', hex: '#3B82F6', icon: CalendarIcon },
  // Verde (#22C55E)
  confirmed:   { label: 'Confirmado',  accent: 'bg-[#22C55E]', text: 'text-[#22C55E]', border: 'border-[#22C55E]', hex: '#22C55E', icon: CheckCircle },
  // Amarelo (#FACC15)
  in_progress: { label: 'Em andamento',accent: 'bg-[#FACC15]', text: 'text-[#FACC15]', border: 'border-[#FACC15]', hex: '#FACC15', icon: PlayCircle },
  // Cinza (#6B7280)
  finished:    { label: 'Finalizado',  accent: 'bg-[#6B7280]', text: 'text-[#6B7280]', border: 'border-[#6B7280]', hex: '#6B7280', icon: Flag },
  // Vermelho (#EF4444)
  canceled:    { label: 'Cancelado',   accent: 'bg-[#EF4444]', text: 'text-[#EF4444]', border: 'border-[#EF4444]', hex: '#EF4444', icon: XCircle },
  // Laranja escuro (#F97316)
  absent:      { label: 'Ausente',     accent: 'bg-[#F97316]', text: 'text-[#F97316]', border: 'border-[#F97316]', hex: '#F97316', icon: UserX },
};

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function AgendaPage() {
  const { toast } = useToast();
  const { userProfile, authReady, company } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null); // quando definido, modal entra em modo edição
  // Participantes por agendamento (carregado após buscar bookings do dia)
  const [participantsByAgendamento, setParticipantsByAgendamento] = useState({});
  // Controle de concorrência e limpeza segura
  const participantsReqIdRef = useRef(0);
  const lastParticipantsDateKeyRef = useRef('');

  // Evita duplo disparo de abertura em dev/StrictMode ou por eventos sobrepostos
  const lastOpenRef = useRef(0);
  const hasOpenedRef = useRef(false);
  const openBookingModal = useCallback(() => {
    const now = Date.now();
    if (isModalOpen) return; // já aberto
    if (now - lastOpenRef.current < 350) return; // ignora repetição em ~350ms
    lastOpenRef.current = now;
    setIsModalOpen(true);
    hasOpenedRef.current = true;
  }, []);
  const [viewFilter, setViewFilter] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agenda:viewFilter') || '{}');
      if (saved && typeof saved === 'object') {
        return { scheduled: true, available: true, canceledOnly: false, ...saved };
      }
    } catch {}
    return { scheduled: true, available: true, canceledOnly: false };
  });

  // Lista de quadras vinda do banco (objetos com nome, modalidades, horario)
  const [dbCourts, setDbCourts] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]');
      return Array.isArray(cached) ? cached : null;
    } catch {
      return null;
    }
  });
  const [courtsLoading, setCourtsLoading] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]');
      return !(Array.isArray(cached) && cached.length > 0);
    } catch {
      return true;
    }
  });

  const courtsMap = useMemo(() => Object.fromEntries((dbCourts ?? []).map(c => [c.nome, c])), [dbCourts]);
  const availableCourts = useMemo(() => (dbCourts ?? []).map(c => c.nome), [dbCourts]);
  const [selectedCourts, setSelectedCourts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agenda:selectedCourts') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Lista de clientes vinda do banco (sem clientes fictícios)
  const [customerOptions, setCustomerOptions] = useState([]);
  const scrollRef = useRef(null);
  const prevFiltersRef = useRef({ scheduled: true, canceledOnly: false });
  // Prefill ao clicar em um slot livre
  const [prefill, setPrefill] = useState(null);
  // Busca
  const [searchQuery, setSearchQuery] = useState("");
  // Re-tentativas controladas para Vercel (evita sobrescrever cache com vazio em delays de token)
  const bookingsRetryRef = useRef(false);
  const courtsRetryRef = useRef(false);

  // Aviso inteligente sobre cancelados
  const [showCanceledInfo, setShowCanceledInfo] = useState(false);
  const [hideCanceledInfo, setHideCanceledInfo] = useState(() => {
    try { return localStorage.getItem('agenda:hideCanceledInfo') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('agenda:hideCanceledInfo', hideCanceledInfo ? '1' : '0'); } catch {}
  }, [hideCanceledInfo]);

  // Chave de cache por empresa/data (yyyy-mm-dd)
  const bookingsCacheKey = useMemo(() => {
    if (!userProfile?.codigo_empresa) return null;
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    return `agenda:bookings:${userProfile.codigo_empresa}:${dayStr}`;
  }, [userProfile?.codigo_empresa, currentDate]);

  // Cache local específico dos participantes por empresa/data
  const participantsCacheKey = useMemo(() => {
    if (!userProfile?.codigo_empresa) return null;
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    return `agenda:participants:${userProfile.codigo_empresa}:${dayStr}`;
  }, [userProfile?.codigo_empresa, currentDate]);

  // efeito de rolagem automática será definido após filteredBookings

  // Configurações (modal) e regras de automação de status
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const defaultAutomation = useMemo(() => ({
    autoConfirmEnabled: false,
    autoConfirmMinutesBefore: 120,
    autoStartEnabled: true,
    autoFinishEnabled: true,
  }), []);
  const [automation, setAutomation] = useState(defaultAutomation);
  const [savingSettings, setSavingSettings] = useState(false);
  // Carrega regras salvas quando empresa está disponível
  useEffect(() => {
    if (!userProfile?.codigo_empresa) return;
    try {
      const raw = localStorage.getItem(`agenda:automation:${userProfile.codigo_empresa}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setAutomation((prev) => ({ ...defaultAutomation, ...parsed }));
      } else {
        setAutomation(defaultAutomation);
      }
    } catch {
      setAutomation(defaultAutomation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.codigo_empresa]);
  // Persiste quando alterar
  useEffect(() => {
    if (!userProfile?.codigo_empresa) return;
    try { localStorage.setItem(`agenda:automation:${userProfile.codigo_empresa}`, JSON.stringify(automation)); } catch {}
  }, [automation, userProfile?.codigo_empresa]);

  // Carregar do banco (agenda_settings) quando empresa estiver disponível
  useEffect(() => {
    const loadSettings = async () => {
      if (!authReady || !company?.id) return;
      try {
        const { data, error } = await supabase
          .from('agenda_settings')
          .select('*')
          .eq('empresa_id', company.id)
          .maybeSingle();
        if (error) {
          // não quebra UX; mantém localStorage/defaults
          console.warn('[AgendaSettings] load error', error);
          return;
        }
        if (!data) return; // ainda não criado -> mantém defaults/local cache
        // Mapear colunas (horas -> minutos)
        const next = {
          autoConfirmEnabled: !!data.auto_confirm_enabled,
          autoConfirmMinutesBefore: data.auto_confirm_enabled && Number.isFinite(Number(data.auto_confirm_hours))
            ? Number(data.auto_confirm_hours) * 60
            : defaultAutomation.autoConfirmMinutesBefore,
          autoStartEnabled: !!data.auto_start_enabled,
          autoFinishEnabled: !!data.auto_finish_enabled,
        };
        setAutomation((prev) => ({ ...prev, ...next }));
      } catch (e) {
        console.warn('[AgendaSettings] unexpected load error', e);
      }
    };
    loadSettings();
  }, [authReady, company?.id]);

  // Manual override tracking: user actions take precedence over automation
  const [manualOverrides, setManualOverrides] = useState({});
  const MANUAL_OVERRIDE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas
  const markManualOverride = useCallback((bookingId) => {
    setManualOverrides((prev) => ({ ...prev, [bookingId]: Date.now() }));
  }, []);
  const clearManualOverride = useCallback((bookingId) => {
    setManualOverrides((prev) => {
      if (!prev || !(bookingId in prev)) return prev;
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });
  }, []);
  const isOverriddenRecently = useCallback((bookingId) => {
    const ts = manualOverrides?.[bookingId];
    return typeof ts === 'number' && (Date.now() - ts) < MANUAL_OVERRIDE_WINDOW_MS;
  }, [manualOverrides]);

  // Modal harmonizado para reativação da automação
  const [reactivateAsk, setReactivateAsk] = useState(null); // { resolve }
  const askReactivate = useCallback(() => {
    return new Promise((resolve) => {
      setReactivateAsk({ resolve });
    });
  }, []);

  // Salvar no banco (upsert)
  const handleSaveSettings = useCallback(async () => {
    if (!authReady || !company?.id) {
      toast({ title: 'Não autenticado', description: 'Faça login para salvar as configurações.', variant: 'destructive' });
      return;
    }
    try {
      setSavingSettings(true);
      const payload = {
        empresa_id: company.id,
        auto_confirm_enabled: !!automation.autoConfirmEnabled,
        auto_confirm_hours: !!automation.autoConfirmEnabled
          ? Math.max(0, Math.round(Number(automation.autoConfirmMinutesBefore || 0) / 60))
          : null,
        auto_start_enabled: !!automation.autoStartEnabled,
        auto_finish_enabled: !!automation.autoFinishEnabled,
      };
      const { error } = await supabase
        .from('agenda_settings')
        .upsert(payload, { onConflict: 'empresa_id' });
      if (error) throw error;
      toast({ title: 'Configurações salvas', description: 'As automações da agenda foram atualizadas com sucesso.' });
      setIsSettingsOpen(false);
    } catch (e) {
      console.error('[AgendaSettings] save error', e);
      const message = e?.message || 'Falha ao salvar as configurações.';
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  }, [authReady, company?.id, automation]);

  // Atualiza status no banco e estados locais
  // source: 'user' | 'automation'
  const updateBookingStatus = useCallback(async (bookingId, newStatus, source = 'user') => {
    try {
      const terminalStatuses = ['canceled', 'finished', 'absent'];
      const activeStatuses = ['scheduled', 'confirmed', 'in_progress'];
      const shouldDisable = terminalStatuses.includes(newStatus);

      // Verifica se devemos oferecer reativação da automação ao voltar para status ativo
      let reactivate = false;
      if (source === 'user' && activeStatuses.includes(newStatus)) {
        const prev = (bookings || []).find(b => b.id === bookingId);
        const wasTerminal = prev ? terminalStatuses.includes(prev.status) : false;
        const wasAutoDisabled = prev ? !!prev.auto_disabled : false;
        if (wasTerminal || wasAutoDisabled) {
          const confirmReactivate = await askReactivate();
          reactivate = !!confirmReactivate;
        }
      }

      const updatePayload = shouldDisable
        ? { status: newStatus, auto_disabled: true }
        : (reactivate ? { status: newStatus, auto_disabled: false } : { status: newStatus });
      const { error } = await supabase
        .from('agendamentos')
        .update(updatePayload)
        .eq('id', bookingId)
        .select('id');
      if (error) throw error;
      setBookings(prev => prev.map(b => {
        if (b.id !== bookingId) return b;
        const next = { ...b, status: newStatus };
        if (shouldDisable) next.auto_disabled = true;
        else if (reactivate) next.auto_disabled = false;
        return next;
      }));
      try {
        if (bookingsCacheKey) {
          const cached = JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]');
          const updated = Array.isArray(cached)
            ? cached.map(b => {
                if (b.id !== bookingId) return b;
                const next = { ...b, status: newStatus };
                if (shouldDisable) next.auto_disabled = true;
                else if (reactivate) next.auto_disabled = false;
                return next;
              })
            : cached;
          localStorage.setItem(bookingsCacheKey, JSON.stringify(updated));
        }
      } catch {}
      // Marca override manual somente quando a origem é usuário e NÃO houve reativação da automação.
      // Se houve reativação, removemos qualquer override existente para permitir que a automação atue imediatamente.
      if (source === 'user') {
        try {
          if (reactivate) {
            clearManualOverride(bookingId);
          } else {
            markManualOverride(bookingId);
          }
        } catch {}
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Auto-status: falha ao atualizar', bookingId, newStatus, e);
    }
  }, [bookings, bookingsCacheKey, markManualOverride, clearManualOverride, askReactivate, viewFilter]);

  // Runner periódico
  const automationRunningRef = useRef(false);
  const runAutomation = useCallback(async () => {
    if (!authReady || !userProfile?.codigo_empresa) return;
    if (automationRunningRef.current) return;
    automationRunningRef.current = true;
    try {
      const now = new Date();
      const nowTs = now.getTime();
      const todayStr = format(now, 'yyyy-MM-dd');
      // Candidatos do dia atual (da UI ou DB fallback)
      let candidates = (bookings || []).filter(b => format(b.start, 'yyyy-MM-dd') === todayStr);
      if (candidates.length === 0) {
        try {
          const dayStart = startOfDay(now);
          const dayEnd = addDays(dayStart, 1);
          const { data, error } = await supabase
            .from('agendamentos')
            .select('id, inicio, fim, status, auto_disabled')
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .gte('inicio', dayStart.toISOString())
            .lt('inicio', dayEnd.toISOString());
          if (!error && Array.isArray(data)) {
            candidates = data.map(row => ({
              id: row.id,
              start: new Date(row.inicio),
              end: new Date(row.fim),
              status: row.status || 'scheduled',
              auto_disabled: !!row.auto_disabled,
            }));
          }
        } catch {}
      }
      // Candidatos atrasados (dias anteriores) ainda não finalizados e com fim < agora
      try {
        const { data: backlog, error: backlogErr } = await supabase
          .from('agendamentos')
          .select('id, inicio, fim, status, auto_disabled')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .lt('fim', now.toISOString())
          .in('status', ['scheduled','confirmed','in_progress']);
        if (!backlogErr && Array.isArray(backlog) && backlog.length > 0) {
          const items = backlog.map(row => ({
            id: row.id,
            start: new Date(row.inicio),
            end: new Date(row.fim),
            status: row.status || 'scheduled',
            auto_disabled: !!row.auto_disabled,
          }));
          // Merge evitando duplicatas por id
          const byId = new Map(candidates.map(c => [c.id, c]));
          for (const it of items) { if (!byId.has(it.id)) byId.set(it.id, it); }
          candidates = Array.from(byId.values());
        }
      } catch {}

      for (const b of candidates) {
        if (b.auto_disabled) continue; // desligado
        if (isOverriddenRecently(b.id)) continue; // override manual
        const startTs = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        const endTs = b.end instanceof Date ? b.end.getTime() : new Date(b.end).getTime();

        // Ordem: finalizar > iniciar > confirmar
        if (b.status === 'in_progress' && automation.autoFinishEnabled) {
          if (nowTs >= endTs) { await updateBookingStatus(b.id, 'finished', 'automation'); continue; }
        }
        if (b.status === 'confirmed' && automation.autoStartEnabled) {
          if (nowTs >= startTs) { await updateBookingStatus(b.id, 'in_progress', 'automation'); continue; }
        }
        if (b.status === 'scheduled' && automation.autoConfirmEnabled) {
          const msBefore = Number(automation.autoConfirmMinutesBefore || 0) * 60000;
          if (nowTs >= (startTs - msBefore)) { await updateBookingStatus(b.id, 'confirmed', 'automation'); continue; }
        }
        // Catch-up: se ficou agendado/confirmado e já passou do fim, finalize direto
        if ((b.status === 'scheduled' || b.status === 'confirmed') && automation.autoFinishEnabled) {
          if (nowTs >= endTs) { await updateBookingStatus(b.id, 'finished', 'automation'); continue; }
        }
      }
    } finally {
      automationRunningRef.current = false;
    }
  }, [authReady, userProfile?.codigo_empresa, bookings, automation, updateBookingStatus, isOverriddenRecently]);
  useEffect(() => {
    const id = setInterval(runAutomation, 30000);
    try { runAutomation(); } catch {}
    return () => clearInterval(id);
  }, [runAutomation]);

  // Hidrata agendamentos a partir do cache antes da busca
  useEffect(() => {
    if (!bookingsCacheKey) return;
    try {
      const cached = JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        // Converte datas serializadas de volta para Date
        const mapped = cached.map((b) => ({
          ...b,
          start: new Date(b.start),
          end: new Date(b.end),
        }));
        setBookings(mapped);
      }
    } catch {}
  }, [bookingsCacheKey]);

  // Recuperação resiliente ao voltar foco/visibilidade da aba: reidrata cache e refaz fetch
  useEffect(() => {
    const onVisOrFocus = () => {
      if (document.visibilityState === 'visible') {
        try {
          if (bookingsCacheKey) {
            const cached = JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]');
            if (Array.isArray(cached) && cached.length > 0) {
              const mapped = cached.map((b) => ({ ...b, start: new Date(b.start), end: new Date(b.end) }));
              setBookings((prev) => (prev && prev.length > 0 ? prev : mapped));
            }
          }
        } catch {}
        // Recarrega dados frescos do backend
        try { fetchBookings(); } catch {}
        try { loadParticipants(); } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisOrFocus);
    window.addEventListener('focus', onVisOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisOrFocus);
      window.removeEventListener('focus', onVisOrFocus);
    };
  }, [bookingsCacheKey]);

  // Hidrata participantes a partir do cache do dia (evita sumiço ao voltar para a aba)
  useEffect(() => {
    if (!participantsCacheKey) return;
    try {
      const cached = JSON.parse(localStorage.getItem(participantsCacheKey) || '{}');
      if (cached && typeof cached === 'object') {
        setParticipantsByAgendamento(cached);
        lastParticipantsDateKeyRef.current = format(currentDate, 'yyyy-MM-dd');
      }
    } catch {}
  }, [participantsCacheKey]);

  // Carrega agendamentos do dia atual a partir do banco
  useEffect(() => {
    const fetchBookings = async () => {
      if (!userProfile?.codigo_empresa) return;
      const dayStart = startOfDay(currentDate);
      const dayEnd = addDays(dayStart, 1);
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          id, codigo_empresa, quadra_id, cliente_id, clientes, inicio, fim, modalidade, status, auto_disabled,
          quadra:quadra_id ( nome ),
          cliente:cliente_id ( nome )
        `)
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .gte('inicio', dayStart.toISOString())
        .lt('inicio', dayEnd.toISOString())
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .gte('inicio', dayStart.toISOString())
        .lt('inicio', dayEnd.toISOString())
        .order('inicio', { ascending: true });
      if (error) {
        toast({ title: 'Erro ao carregar agendamentos', description: error.message, variant: 'destructive' });
        // Não sobrescrever com vazio; tentar uma vez novamente (token/rls pode estar atrasado)
        if (!bookingsRetryRef.current) {
          bookingsRetryRef.current = true;
          setTimeout(fetchBookings, 900);
        }
        return;
      }
      // Em alguns casos no Vercel o retorno vem 200 mas vazio na primeira batida (RLS/propagação)
      if (!data || data.length === 0) {
        // Só tentar novamente se temos cache para manter UI preenchida
        let hasCache = false;
        try {
          const cached = bookingsCacheKey ? JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]') : [];
          hasCache = Array.isArray(cached) && cached.length > 0;
        } catch {}
        if (!bookingsRetryRef.current) {
          bookingsRetryRef.current = true;
          if (hasCache) {
            setTimeout(fetchBookings, 700);
            return; // não sobrescrever UI com vazio na primeira tentativa
          }
        }
      }
      bookingsRetryRef.current = false; // sucesso (ou segunda tentativa), libera novos retries futuros
      const mapped = (data || []).map(row => {
        const start = new Date(row.inicio);
        const end = new Date(row.fim);
        // Nome da quadra
        const courtName = row.quadra?.[0]?.nome || row.quadra?.nome || Object.values(courtsMap).find(c => c.id === row.quadra_id)?.nome || '';
        // Nome do cliente: usar apenas o cliente relacionado real; não usar fallback do array "clientes"
        const customerName = (row.cliente?.[0]?.nome || row.cliente?.nome || '');
        return {
          id: row.id,
          court: courtName,
          customer: customerName,
          start,
          end,
          status: row.status || 'scheduled',
          modality: row.modalidade || '',
          auto_disabled: !!row.auto_disabled,
        };
      });
      setBookings(mapped);
      // Persistir no cache (serializando datas)
      try {
        if (bookingsCacheKey) {
          const serializable = mapped.map(b => ({ ...b, start: b.start.toISOString(), end: b.end.toISOString() }));
          localStorage.setItem(bookingsCacheKey, JSON.stringify(serializable));
        }
      } catch {}
    };
    if (authReady && userProfile?.codigo_empresa) {
      fetchBookings();
    }
  }, [authReady, userProfile?.codigo_empresa, currentDate, courtsMap, bookingsCacheKey]);

  // Carrega participantes para os agendamentos listados (batch por dia)
  useEffect(() => {
    const loadParticipants = async () => {
      if (!authReady || !userProfile?.codigo_empresa) return;
      const ids = (bookings || []).map(b => b.id).filter(Boolean);
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      // Evita wipe em estados transitórios de carregamento de bookings
      if (!ids.length) {
        if (lastParticipantsDateKeyRef.current !== dateKey) {
          setParticipantsByAgendamento({});
          try { if (participantsCacheKey) localStorage.setItem(participantsCacheKey, '{}'); } catch {}
          lastParticipantsDateKeyRef.current = dateKey;
        }
        return;
      }
      const reqId = ++participantsReqIdRef.current;
      const { data, error } = await supabase
        .from('v_agendamento_participantes')
        .select('*')
        .in('agendamento_id', ids);
      // Ignora respostas atrasadas
      if (participantsReqIdRef.current !== reqId) return;
      if (error) {
        console.warn('[Participants] load error', error);
        return; // mantém estado anterior
      }
      const map = {};
      for (const row of (data || [])) {
        const k = row.agendamento_id;
        if (!map[k]) map[k] = [];
        map[k].push(row);
      }
      lastParticipantsDateKeyRef.current = dateKey;
      // Atualiza apenas os IDs consultados, preservando outros e persiste em cache
      setParticipantsByAgendamento(prev => {
        const next = { ...prev };
        for (const id of ids) {
          next[id] = map[id] || [];
        }
        try { if (participantsCacheKey) localStorage.setItem(participantsCacheKey, JSON.stringify(next)); } catch {}
        return next;
      });
    };
    loadParticipants();
  }, [authReady, userProfile?.codigo_empresa, bookings, currentDate, participantsCacheKey]);

  // Carregar quadras do banco por empresa (inclui modalidades e horários)
  useEffect(() => {
    // Hidratar quadras de cache para evitar sumiço ao trocar de aba
    try {
      const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]');
      if (Array.isArray(cached) && cached.length && (!dbCourts || dbCourts.length === 0)) {
        setDbCourts(cached);
        setCourtsLoading(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const loadCourts = async () => {
      if (!userProfile?.codigo_empresa) return;
      // Mantém UI responsiva: só ativa loading "forte" quando não há cache
      if (!dbCourts || dbCourts.length === 0) setCourtsLoading(true);
      const { data, error } = await supabase
        .from('quadras')
        .select('id, nome, modalidades, hora_inicio, hora_fim, valor')
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .order('nome', { ascending: true });
      if (error) {
        toast({ title: 'Erro ao carregar quadras', description: error.message });
        // Não sobrescrever cache com vazio. Tenta uma vez novamente após curto atraso.
        if (!courtsRetryRef.current) {
          courtsRetryRef.current = true;
          setTimeout(loadCourts, 900);
        } else {
          setCourtsLoading(false);
        }
        return;
      }
      const rows = data || [];
      // Evitar apagar UI com vazio na primeira resposta (RLS/propagação)
      if (rows.length === 0) {
        let cachedLen = 0;
        try { const cached = JSON.parse(localStorage.getItem('quadras:list') || '[]'); cachedLen = Array.isArray(cached) ? cached.length : 0; } catch {}
        if (cachedLen > 0 && !courtsRetryRef.current) {
          courtsRetryRef.current = true;
          setCourtsLoading(false);
          setTimeout(loadCourts, 700);
          return;
        }
      }
      courtsRetryRef.current = false; // sucesso (ou segunda tentativa)
      setDbCourts(rows);
      try { localStorage.setItem('quadras:list', JSON.stringify(rows)); } catch {}
      setCourtsLoading(false);
    };
    if (authReady && userProfile?.codigo_empresa) {
      loadCourts();
    }
  }, [authReady, userProfile?.codigo_empresa]);

  // Restaurar seleção e filtros de localStorage ao montar e sincronizar com quadras disponíveis
  useEffect(() => {
    // só roda quando quadras carregadas
    if (courtsLoading) return;
    const savedSel = (() => {
      try { return JSON.parse(localStorage.getItem('agenda:selectedCourts') || '[]'); } catch { return []; }
    })();
    const savedFilter = (() => {
      try { return JSON.parse(localStorage.getItem('agenda:viewFilter') || '{}'); } catch { return {}; }
    })();
    // Interseção com quadras disponíveis
    const validSavedSel = savedSel.filter((c) => availableCourts.includes(c));
    if (validSavedSel.length > 0) {
      setSelectedCourts(validSavedSel);
    } else if (selectedCourts.length === 0) {
      // inicializa apenas se ainda não houver seleção
      setSelectedCourts(availableCourts);
    }
    // Restaura filtros se existirem
    if (savedFilter && (typeof savedFilter === 'object')) {
      setViewFilter((prev) => ({ ...prev, canceledOnly: false, ...savedFilter }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtsLoading, availableCourts.length]);

  // Persistir seleção e filtros
  useEffect(() => {
    try { localStorage.setItem('agenda:selectedCourts', JSON.stringify(selectedCourts)); } catch {}
  }, [selectedCourts]);
  useEffect(() => {
    try { localStorage.setItem('agenda:viewFilter', JSON.stringify(viewFilter)); } catch {}
  }, [viewFilter]);

  // Definir janela dinâmica do grid com base nas quadras selecionadas (precisão de minutos)
  const dayStartHour = useMemo(() => {
    const starts = selectedCourts
      .map(name => courtsMap[name]?.hora_inicio || '06:00:00')
      .map((t) => {
        const [h, m] = String(t).split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      });
    if (!starts.length) return START_HOUR;
    const minStartMin = Math.min(...starts);
    return Math.floor(minStartMin / 60);
  }, [selectedCourts, courtsMap]);

  const dayEndHourExclusive = useMemo(() => {
    const ends = selectedCourts
      .map(name => courtsMap[name]?.hora_fim || '24:00:00')
      .map((t) => {
        const [h, m] = String(t).split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      });
    if (!ends.length) return END_HOUR;
    const maxEndMin = Math.max(...ends);
    return Math.ceil(maxEndMin / 60); // exclusivo
  }, [selectedCourts, courtsMap]);

  // Scroll inicial para próximo do horário atual
  useEffect(() => {
    const now = new Date();
    const nowH = getHours(now);
    const nowM = getMinutes(now);
    setTimeout(() => {
      if (!scrollRef.current) return;
      const minutesFromStart = Math.max(0, (nowH - dayStartHour) * 60 + nowM);
      const slotsFromStart = minutesFromStart / SLOT_MINUTES;
      scrollRef.current.scrollTop = Math.max(0, slotsFromStart * SLOT_HEIGHT - 120);
    }, 150);
  }, [dayStartHour]);

  // Persistência local desativada em favor do banco

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! 🚧",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! 🚀",
    });
  };

  const BookingCard = ({ booking }) => {
    const slotHeight = SLOT_HEIGHT;
    // Minutos absolutos do dia
    const minutesFromMidnight = (date) => getHours(date) * 60 + getMinutes(date);
    const startAbs = minutesFromMidnight(booking.start);
    const endAbs = minutesFromMidnight(booking.end);

    // Converter para minutos desde START_HOUR
    const startMinutes = startAbs - dayStartHour * 60;
    const endMinutes = endAbs - dayStartHour * 60;

    // Total de slots no dia
    const totalSlots = (dayEndHourExclusive - dayStartHour) * (60 / SLOT_MINUTES);

    // Índices dos slots com arredondamento e clamps
    let startSlotIndex = Math.floor(startMinutes / SLOT_MINUTES);
    // calcular quantidade de slots a partir da duração para evitar discrepância de fim
    const durationMin = Math.max(0, endAbs - startAbs);
    const slotsCount = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
    let endSlotIndex = startSlotIndex + slotsCount;

    // Clamps para dentro dos limites
    startSlotIndex = Math.max(0, Math.min(startSlotIndex, totalSlots - 1));
    endSlotIndex = Math.max(0, Math.min(endSlotIndex, totalSlots));

    // Garantir limites e pelo menos 1 slot visível
    if (endSlotIndex <= startSlotIndex) endSlotIndex = startSlotIndex + 1;
    endSlotIndex = Math.min(endSlotIndex, totalSlots);

    // Posição e altura baseadas em slots inteiros (sem sobreposição de linhas)
    const top = startSlotIndex * slotHeight;
    let height = (endSlotIndex - startSlotIndex) * slotHeight;
    const config = statusConfig[booking.status] || statusConfig.confirmed;
    const Icon = config.icon;
    // Usa a classe de borda explícita para evitar purge de classes dinâmicas
    const borderClass = config.border;

    // Sinaliza meia hora para ajustes de layout
    const isHalfHour = slotsCount === 1;
    // Gap específico para meia hora (um pouco menor para caber melhor o conteúdo)
    const HALF_HOUR_GAP_Y = 4;
    const gapY = isHalfHour ? HALF_HOUR_GAP_Y : BOOKING_GAP_Y;
    const adjTop = top + gapY;
    // Para meia hora, não force altura mínima acima do espaço disponível após os gaps
    const adjHeight = Math.max(isHalfHour ? 40 : 32, height - gapY * 2);
    // Participantes agregados (pago/total)
    const participants = participantsByAgendamento[booking.id] || [];
    const paidCount = participants.filter(p => (p.status_pagamento_text || '').toLowerCase() === 'pago').length;
    const totalParticipants = participants.length;
    return (
      <motion.div
        layout={isModalOpen ? false : "position"}
        initial={isModalOpen ? false : { opacity: 0, y: 6 }}
        animate={isModalOpen ? false : { opacity: 1, y: 0 }}
        exit={isModalOpen ? false : { opacity: 0, y: 6 }}
        id={`booking-${booking.id}`}
        className={cn(
          "absolute left-2 right-2 rounded-md border-2 bg-surface text-sm shadow-sm z-0 cursor-pointer",
          borderClass,
          // Hover sutil e opaco para não revelar linhas do grid por trás
          "overflow-hidden transition-all duration-150 hover:bg-surface-2 hover:shadow-md"
        )}
        style={{ top: `${adjTop}px`, height: `${adjHeight}px` }}
        onClick={() => { setEditingBooking(booking); openBookingModal(); }}
      >
        {/* Acento de status à esquerda */}
        <div className={cn("absolute left-0 top-0 h-full w-[6px] rounded-l-md", config.accent)} />

        {/* Conteúdo (centralizado verticalmente) */}
        <div className={cn("h-full flex", isHalfHour ? "px-3 py-3" : "px-4 py-4")}
        >
          <div className="flex-1 flex flex-col justify-center">
            <div className={cn("flex justify-between gap-2", isHalfHour ? "items-center" : "items-start") }>
              {/* Esquerda: cliente e, em meia hora, modalidade à direita do nome */}
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-text-primary truncate text-base">{shortName(booking.customer)}</p>
                {isHalfHour && (
                  <span className="text-sm font-medium text-text-secondary truncate bg-white/5 border border-white/10 rounded px-2.5 py-0 whitespace-nowrap">
                    {booking.modality}
                  </span>
                )}
              </div>
              <div className={cn("flex items-center gap-2", isHalfHour ? "whitespace-nowrap shrink-0" : "flex-col items-end") }>
                <span className={cn("text-text-muted whitespace-nowrap", isHalfHour ? "text-sm" : "text-base") }>
                  {format(booking.start, 'HH:mm')}–{format(booking.end, 'HH:mm')}
                </span>
                {/* Indicador de pagamento de participantes (pago/total) */}
                {totalParticipants > 0 && (
                  <span className={`text-xs font-semibold rounded px-2 py-0.5 border ${paidCount === totalParticipants ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' : 'text-amber-300 bg-amber-500/10 border-amber-400/30'}`}>
                    {paidCount}/{totalParticipants} pagos
                  </span>
                )}
                {isHalfHour ? (
                  <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <Icon className={cn("w-4 h-4", config.text)} />
                    <span className={cn("truncate", config.text, "text-xs")}>{config.label}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              {!isHalfHour && (
                <span className="text-sm font-medium text-text-secondary truncate bg-white/5 border border-white/10 rounded px-2.5 py-0.5">
                  {booking.modality}
                </span>
              )}
              {!isHalfHour && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Icon className={cn("w-6 h-6", config.text)} />
                  <span className={cn("truncate", config.text)}>{config.label}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
  
  const AddBookingModal = () => {
    // Helpers para exibição e seleção de clientes (compatível com string ou objeto)
    const getCustomerLabel = (c) => {
      if (!c) return '';
      if (typeof c === 'string') return c;
      const nome = c.nome || c.name || '';
      const codigo = c.codigo ?? c.code;
      return codigo != null ? `[${codigo}] ${nome}` : nome;
    };
    const getCustomerName = (c) => {
      if (!c) return '';
      if (typeof c === 'string') return c;
      return c.nome || c.name || '';
    };
    // Helper para obter limites de uma quadra específica
    const getCourtBounds = (courtName) => {
      const c = courtsMap[courtName];
      if (!c) return { start: dayStartHour * 60, end: dayEndHourExclusive * 60 };
      const [sh, sm] = String(c.hora_inicio || '06:00:00').split(':').map(Number);
      const [eh, em] = String(c.hora_fim || '24:00:00').split(':').map(Number);
      return { start: sh * 60 + (sm || 0), end: eh * 60 + (em || 0) };
    };
    const nearestSlot = () => {
      const h = getHours(new Date());
      const m = getMinutes(new Date());
      const total = h * 60 + m;
      // Usa a primeira quadra disponível (mesma usada no estado inicial)
      const initialCourt = availableCourts[0] || '';
      const bounds = getCourtBounds(initialCourt);
      const snapped = Math.max(bounds.start, Math.min(bounds.end - SLOT_MINUTES, Math.round(total / SLOT_MINUTES) * SLOT_MINUTES));
      return snapped;
    };

    const [form, setForm] = useState({
      selectedClients: [], // [{id, nome, codigo?}]
      court: availableCourts[0] || '',
      modality: modalities[0],
      status: 'scheduled',
      date: currentDate,
      startMinutes: nearestSlot(),
      endMinutes: nearestSlot() + 60,
    });
    const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [clientForModal, setClientForModal] = useState(null);
    // Destaque sutil no trigger ao fechar por clique fora
    const [highlightCustomerTrigger, setHighlightCustomerTrigger] = useState(false);
    const closedByOutsideRef = useRef(false);
    // Ref para o input de busca (para focar após limpar)
    const customerQueryInputRef = useRef(null);
    // Participantes (apenas no modo edição): { cliente_id, nome, valor_cota, status_pagamento }
    const [participantsForm, setParticipantsForm] = useState([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [isSavingPayments, setIsSavingPayments] = useState(false);
    const [isSavingBooking, setIsSavingBooking] = useState(false);
    // Busca de participantes no modal de pagamentos
    const [paymentSearch, setPaymentSearch] = useState('');
    const paymentSearchRef = useRef(null);
    // Ocultar participantes apenas na UI de Pagamentos (não altera o agendamento até salvar pagamentos)
    const [paymentHiddenIds, setPaymentHiddenIds] = useState([]);
    useEffect(() => {
      if (isPaymentModalOpen) {
        // Ao abrir o modal de pagamentos, não manter remoções anteriores
        setPaymentHiddenIds([]);
      }
    }, [isPaymentModalOpen]);
    const pendingSaveRef = useRef(false);
    const completedSaveRef = useRef(false);
    const [paymentSelectedId, setPaymentSelectedId] = useState(null);
    // Aviso de pendências no modal de pagamento
    const [paymentWarning, setPaymentWarning] = useState(null);
    const participantsPrefillOnceRef = useRef(false);
    // Evita que a auto-correção de horários rode imediatamente após aplicar um prefill
    const suppressAutoAdjustRef = useRef(false);
    // Lista local de clientes para evitar re-render do componente pai durante a 1ª abertura
    const [localCustomers, setLocalCustomers] = useState(customerOptions);
    // Rótulo resumido para o seletor de clientes (ex.: "Daniel +3")
    const selectedClientsLabel = useMemo(() => {
      const arr = form.selectedClients || [];
      if (arr.length === 0) return 'Adicionar clientes';
      const first = arr[0]?.nome || 'Cliente';
      const extra = arr.length - 1;
      return extra > 0 ? `${first} +${extra}` : first;
    }, [form.selectedClients]);

    // Evitar recarregar clientes repetidamente durante a mesma abertura do modal
    const clientsLoadedKeyRef = useRef(null);
    const clientsRetryRef = useRef(false);
    useEffect(() => {
      // Sincroniza lista local com o snapshot atual do pai ao abrir
      if (!isModalOpen) return;
      // Apenas propaga para local se vier com conteúdo (>0) para evitar apagar cache/hidratação temporária
      if (Array.isArray(customerOptions) && customerOptions.length > 0) {
        setLocalCustomers(customerOptions);
      }
      // Tenta hidratar de cache se lista estiver vazia
      try {
        if (!localCustomers || localCustomers.length === 0) {
          const key = userProfile?.codigo_empresa ? `clientes:list:${userProfile.codigo_empresa}` : null;
          if (key) {
            const cached = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(cached) && cached.length > 0) {
              setLocalCustomers(cached);
            }
          }
        }
      } catch {}
    }, [isModalOpen, customerOptions]);

    // Ao fechar o modal, reseta a chave de carregamento para permitir novo fetch na próxima abertura
    useEffect(() => {
      if (!isModalOpen) {
        clientsLoadedKeyRef.current = null;
        setClientsLoading(false);
      }
    }, [isModalOpen]);

    // Reidrata quando o usuário volta a aba (tab visibility) para evitar lista vazia
    useEffect(() => {
      if (!isModalOpen) return;
      const onVis = () => {
        if (document.visibilityState === 'visible') {
          try {
            const key = userProfile?.codigo_empresa ? `clientes:list:${userProfile.codigo_empresa}` : null;
            if (!key) return;
            const cached = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(cached) && cached.length > 0) {
              setLocalCustomers((prev) => (prev && prev.length > 0 ? prev : cached));
            }
          } catch {}
        }
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }, [isModalOpen, userProfile?.codigo_empresa]);

    // Limpa flags de salvamento quando abrir/fechar modal
    useEffect(() => {
      if (!isModalOpen) {
        pendingSaveRef.current = false;
        completedSaveRef.current = false;
        setIsSavingBooking(false);
      }
    }, [isModalOpen]);

    // Função idempotente para salvar uma vez; reusada em onClick e ao voltar foco da aba
    const saveBookingOnce = useCallback(async () => {
      if (isSavingBooking) return;
      setIsSavingBooking(true);
      console.group('[AgendamentoSave] Auto/Manual Start');
      try {
        const court = courtsMap[form.court];
        if (!court) {
          try { console.warn('[AgendamentoSave] Early return: court not found', { courtKey: form?.court, courtsKeys: Object.keys(courtsMap || {}) }); } catch {}
          toast({ title: 'Selecione uma quadra', variant: 'destructive' });
          // Falha de validação local: não manter pendência para auto-retry
          pendingSaveRef.current = false;
          completedSaveRef.current = false;
          try { console.log('[AgendamentoSave] Flags set: pending=false, completed=false (court invalid)'); } catch {}
          return;
        }
        const s = form.startMinutes, e = form.endMinutes;
        if (!(Number.isFinite(s) && Number.isFinite(e) && e > s)) {
          try { console.warn('[AgendamentoSave] Early return: invalid time range', { s, e }); } catch {}
          toast({ title: 'Horário inválido', variant: 'destructive' });
          pendingSaveRef.current = false;
          completedSaveRef.current = false;
          try { console.log('[AgendamentoSave] Flags set: pending=false, completed=false (invalid time)'); } catch {}
          return;
        }
        const free = isRangeFree(s, e);
        try { console.log('[AgendamentoSave] Range check', { s, e, free }); } catch {}
        if (!free) {
          toast({ title: 'Conflito de horário', description: 'O horário selecionado está ocupado.', variant: 'destructive' });
          pendingSaveRef.current = false;
          completedSaveRef.current = false;
          try { console.log('[AgendamentoSave] Flags set: pending=false, completed=false (conflict)'); } catch {}
          return;
        }

        const buildDate = (base, minutes) => new Date(
          base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0
        );
        const inicio = buildDate(form.date, s);
        const fim = buildDate(form.date, e);
        try { console.log('[AgendamentoSave] Computed dates', { inicio: inicio.toISOString(), fim: fim.toISOString() }); } catch {}
        const primaryClient = (form.selectedClients || [])[0];
        const clientesArr = (form.selectedClients || []).map(getCustomerName).filter(Boolean);

        if (editingBooking?.id) {
          try { console.log('[AgendamentoSave] Path: UPDATE', { id: editingBooking.id }); } catch {}
          const prevStatus = editingBooking.status;
          const statusChanged = form.status !== prevStatus;
          // Atualiza primeiro os campos não relacionados ao status
          const baseUpdate = {
            quadra_id: court.id,
            cliente_id: primaryClient?.id ?? null,
            clientes: clientesArr,
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            modalidade: form.modality,
          };
          // Se o usuário NÃO mudou manualmente o status, reavaliar automaticamente conforme janela de confirmação
          if (!statusChanged) {
            let nextStatus = form.status;
            try {
              const nowTs = Date.now();
              const startTs = inicio.getTime();
              const canAutoConfirm = !!automation?.autoConfirmEnabled && Number.isFinite(Number(automation?.autoConfirmMinutesBefore));
              if (canAutoConfirm) {
                const msBefore = Number(automation.autoConfirmMinutesBefore) * 60000;
                const thresholdTs = startTs - msBefore;
                // Se estava confirmado e editou o horário para fora da janela, volta para scheduled
                if (nextStatus === 'confirmed' && nowTs < thresholdTs) {
                  nextStatus = 'scheduled';
                }
                // Se estava scheduled e editou para dentro da janela, confirma
                else if (nextStatus === 'scheduled' && nowTs >= thresholdTs) {
                  nextStatus = 'confirmed';
                }
              }
            } catch {}
            baseUpdate.status = nextStatus;
          }
          const { error } = await supabase
            .from('agendamentos')
            .update(baseUpdate)
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .eq('id', editingBooking.id);
          if (error) throw error;
          // Atualiza estado local (sem mexer em status quando ele mudou; será tratado abaixo)
          setBookings((prev) => prev.map((b) => b.id === editingBooking.id ? ({
            ...b,
            court: form.court,
            customer: primaryClient?.nome || b.customer,
            start: inicio,
            end: fim,
            modality: form.modality,
            ...(statusChanged ? {} : { status: baseUpdate.status ?? form.status }),
          }) : b));
          // Se o status mudou, delega a atualização de status (e auto_disabled) para updateBookingStatus,
          // garantindo a exibição do modal de reativação quando aplicável.
          if (statusChanged) {
            try {
              // Fecha o modal de edição antes de abrir o modal de reativação para evitar sobreposição incorreta
              setIsModalOpen(false);
              await updateBookingStatus(editingBooking.id, form.status, 'user');
            } catch (stErr) {
              console.error('[AgendamentoSave] updateBookingStatus failed', stErr);
            }
          }
          toast({ title: 'Agendamento atualizado' });
          completedSaveRef.current = true;
          pendingSaveRef.current = false;
          try { console.log('[AgendamentoSave] Success UPDATE: flags set completed=true, pending=false'); } catch {}
          setIsModalOpen(false);
          return;
        }

        // CREATE com checagem idempotente (evita duplicar em reexecuções)
        let existingRow = null;
        try {
          try { console.log('[AgendamentoSave] Checking existing equivalent record…'); } catch {}
          const { data: found } = await supabase
            .from('agendamentos')
            .select('id, status')
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .eq('quadra_id', court.id)
            .eq('inicio', inicio.toISOString())
            .eq('fim', fim.toISOString())
            .limit(1);
          if (Array.isArray(found) && found.length > 0) existingRow = found[0];
          try { console.log('[AgendamentoSave] Existing check result', { existingId: existingRow?.id, status: existingRow?.status }); } catch {}
        } catch {}

        if (existingRow?.id) {
          if (existingRow.status !== 'canceled') {
            // Já existe registro ativo equivalente; tratar como sucesso (não duplica)
            try { console.log('[AgendamentoSave] Path: CREATE->EXISTING treated as success (active exists)', { existingId: existingRow.id, status: existingRow.status }); } catch {}
            const newItem = {
              id: existingRow.id,
              court: form.court,
              customer: primaryClient?.nome || clientesArr[0] || '',
              start: inicio,
              end: fim,
              status: form.status,
              modality: form.modality,
            };
            setBookings((prev) => {
              const foundLocal = prev.some((b) => b.id === existingRow.id);
              return foundLocal ? prev : [...prev, newItem];
            });
            toast({ title: 'Agendamento confirmado' });
            completedSaveRef.current = true;
            setIsModalOpen(false);
            return;
          }
          // Se o existente estiver cancelado, não atualiza: cairá no INSERT para manter histórico do cancelado
          try { console.log('[AgendamentoSave] Existing is canceled; will insert a new record to preserve history', { existingId: existingRow.id }); } catch {}
        }

        try { console.log('[AgendamentoSave] Path: CREATE inserting…'); } catch {}
        const { data, error } = await supabase
          .from('agendamentos')
          .insert({
            codigo_empresa: userProfile.codigo_empresa,
            quadra_id: court.id,
            cliente_id: primaryClient?.id ?? null,
            clientes: clientesArr,
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            modalidade: form.modality,
            status: form.status,
          })
          .select('id')
          .single();
        if (error) throw error;
        try { console.log('[AgendamentoSave] Inserted new agendamento', { id: data?.id }); } catch {}
        const newItem = {
          id: data.id,
          court: form.court,
          customer: primaryClient?.nome || clientesArr[0] || '',
          start: inicio,
          end: fim,
          status: form.status,
          modality: form.modality,
        };
        setBookings((prev) => [...prev, newItem]);
        toast({ title: 'Agendamento criado' });

        // Participantes (não bloqueia conclusão do salvamento principal)
        try {
          const rows = (form.selectedClients || []).map((c) => ({
            codigo_empresa: userProfile.codigo_empresa,
            agendamento_id: data.id,
            cliente_id: c.id,
            valor_cota: 0,
            status_pagamento: 'Pendente',
          }));
          if (rows.length > 0) {
            try { console.log('[ParticipantsCreate] Inserting', { count: rows.length }); } catch {}
            const { error: perr } = await supabase
              .from('agendamento_participantes')
              .insert(rows);
            if (perr) console.error('[ParticipantsCreate] Insert error', perr);
            else try { console.log('[ParticipantsCreate] Inserted successfully'); } catch {}
          }
        } catch (pe) {
          console.error('[ParticipantsCreate] Unexpected error', pe);
        }

        completedSaveRef.current = true;
        pendingSaveRef.current = false;
        try { console.log('[AgendamentoSave] Success CREATE: flags set completed=true, pending=false'); } catch {}
        setIsModalOpen(false);
      } catch (e) {
        console.error('[AgendamentoSave] Error', e);
        // Mantém pendingSaveRef = true para auto-reexecução
        toast({ title: 'Erro ao salvar agendamento', description: e?.message || 'Tentando novamente automaticamente…', variant: 'destructive' });
      } finally {
        setIsSavingBooking(false);
        console.groupEnd();
      }
    }, [isSavingBooking, courtsMap, form, editingBooking, userProfile, isRangeFree, setBookings, toast, setIsModalOpen, updateBookingStatus]);

    // Ao voltar para a aba, se houver salvamento pendente e não concluído, reexecuta automaticamente
    useEffect(() => {
      const onVis = () => {
        if (document.visibilityState === 'visible' && isModalOpen && pendingSaveRef.current && !completedSaveRef.current && !isSavingBooking) {
          try { console.info('[AgendamentoSave] visibilitychange: auto-resume triggered'); } catch {}
          // Reexecuta sem intervenção do usuário
          saveBookingOnce();
        }
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }, [isModalOpen, isSavingBooking, saveBookingOnce]);
  useEffect(() => {
    const loadClients = async () => {
      if (!isModalOpen || !userProfile?.codigo_empresa) return;
      const key = String(userProfile.codigo_empresa);
      if (clientsLoadedKeyRef.current === key) return; // já carregado nesta abertura
      try {
        setClientsLoading(true);
        // Hidrata imediatamente a lista a partir do cache local para evitar "sumir clientes"
        try {
          const cacheKey = `clientes:list:${userProfile.codigo_empresa}`;
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            setLocalCustomers(cached);
            try {
              setCustomerOptions((prev) => {
                const sameParent = JSON.stringify(prev) === JSON.stringify(cached);
                return sameParent ? prev : cached;
              });
            } catch {}
          }
        } catch {}
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome, codigo, email, telefone, status, codigo_empresa')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .eq('status', 'active')
          .order('nome', { ascending: true });
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Falha ao carregar clientes:', error);
          return;
        }
        if (Array.isArray(data)) {
          if (data.length === 0) {
            // Não sobrescrever com vazio; tenta de novo se houver cache
            let cachedLen = 0;
            try {
              const cacheKey = `clientes:list:${userProfile.codigo_empresa}`;
              const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
              cachedLen = Array.isArray(cached) ? cached.length : 0;
            } catch {}
            if (cachedLen > 0 && !clientsRetryRef.current) {
              clientsRetryRef.current = true;
              setTimeout(loadClients, 700);
              return;
            }
          }
          clientsRetryRef.current = false;
          clientsLoadedKeyRef.current = key;
          setLocalCustomers(data);
          try {
            const cacheKey = `clientes:list:${userProfile.codigo_empresa}`;
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {}
          try {
            setCustomerOptions((prev) => {
              const sameParent = JSON.stringify(prev) === JSON.stringify(data);
              return sameParent ? prev : data;
            });
          } catch {}
        }
      } catch {} finally {
        setClientsLoading(false);
      }
    };
    loadClients();
  }, [isModalOpen, userProfile?.codigo_empresa]);

    // timeOptions/endTimeOptions são declarados após helpers de disponibilidade para evitar TDZ

    // Atualiza o total automaticamente conforme quadra/duração mudam
    useEffect(() => {
      const court = courtsMap[form.court];
      if (!court) return;
      const perHalfHour = Number(court.valor || 0);
      if (!Number.isFinite(perHalfHour) || perHalfHour <= 0) return;
      const minutes = Math.max(0, form.endMinutes - form.startMinutes);
      if (minutes <= 0) return;
      const slots = minutes / SLOT_MINUTES; // SLOT_MINUTES é 30
      const total = Math.round(perHalfHour * slots * 100) / 100;
      setPaymentTotal(maskBRL(String(total.toFixed(2))));
    }, [courtsMap, form.court, form.startMinutes, form.endMinutes]);


    // Preencher formulário ao abrir em modo edição ou reset para novo
    useEffect(() => {
      if (!isModalOpen) return;

      if (editingBooking) {
        const startM = getHours(editingBooking.start) * 60 + getMinutes(editingBooking.start);
        const endM = getHours(editingBooking.end) * 60 + getMinutes(editingBooking.end);
        // Extrai participantes carregados para este agendamento
        const loadedParts = participantsByAgendamento[editingBooking.id] || [];
        const selectedFromParts = loadedParts
          .filter(p => p && p.cliente_id)
          .map(p => ({ id: p.cliente_id, nome: p.nome }))
          // Evitar duplicidades por segurança
          .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
        // Garante modalidade válida para a quadra do agendamento
        const allowedForEdit = courtsMap[editingBooking.court]?.modalidades || modalities;
        const safeModality = allowedForEdit.includes(editingBooking.modality) ? editingBooking.modality : (allowedForEdit[0] || '');
        setForm({
          selectedClients: selectedFromParts,
          court: editingBooking.court,
          modality: safeModality,
          status: editingBooking.status,
          date: startOfDay(editingBooking.start),
          startMinutes: startM,
          endMinutes: endM,
        });
        // Evita autoajuste imediato durante a animação de abertura
        suppressAutoAdjustRef.current = true;
        // Preenche formulário de participantes com valores atuais
        setParticipantsForm(
          loadedParts.map(p => ({
            cliente_id: p.cliente_id,
            nome: p.nome,
            valor_cota: (() => {
              const num = Number.isFinite(Number(p.valor_cota)) ? Number(p.valor_cota) : parseBRL(p.valor_cota);
              return maskBRL(String((Number.isFinite(num) ? num : 0).toFixed(2)));
            })(),
            status_pagamento: p.status_pagamento_text || 'Pendente',
          }))
        );
        // Seleciona primeiro participante por padrão
        setPaymentSelectedId(selectedFromParts[0]?.id || null);
        // Fallback: se ainda não carregou participantes, buscar direto do banco
        if (selectedFromParts.length === 0) {
          (async () => {
            try {
              const { data, error } = await supabase
                .from('agendamento_participantes')
                .select(`cliente_id, valor_cota, status_pagamento, cliente:clientes!agendamento_participantes_cliente_id_fkey ( nome )`)
                .eq('codigo_empresa', userProfile.codigo_empresa)
                .eq('agendamento_id', editingBooking.id);
              if (!error && Array.isArray(data)) {
                const sel = data
                  .filter(p => p && p.cliente_id)
                  .map(p => ({ id: p.cliente_id, nome: p.cliente?.nome || '' }))
                  .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
                setForm(f => ({ ...f, selectedClients: sel }));
                setParticipantsForm(data.map(p => ({
                  cliente_id: p.cliente_id,
                  nome: p.cliente?.nome || '',
                  valor_cota: (() => {
                    const num = Number.isFinite(Number(p.valor_cota)) ? Number(p.valor_cota) : parseBRL(p.valor_cota);
                    return maskBRL(String((Number.isFinite(num) ? num : 0).toFixed(2)));
                  })(),
                  status_pagamento: p.status_pagamento || 'Pendente',
                })));
                setPaymentSelectedId(sel[0]?.id || null);
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('Falha ao carregar participantes (fallback)', e);
            }
          })();
        }
      } else if (prefill) {
        setForm({
          selectedClients: [],
          court: prefill.court ?? (availableCourts[0] || ''),
          modality: (() => { const c = prefill.court ?? (availableCourts[0] || ''); const allowed = courtsMap[c]?.modalidades || modalities; return allowed[0] || ''; })(),
          status: 'scheduled',
          date: prefill.date ?? currentDate,
          startMinutes: prefill.startMinutes ?? nearestSlot(),
          endMinutes: prefill.endMinutes ?? (nearestSlot() + 60),
        });
        setParticipantsForm([]);
        suppressAutoAdjustRef.current = true;
      } else {
        const initialCourt = availableCourts[0] || '';
        const allowed = courtsMap[initialCourt]?.modalidades || modalities;
        setForm({
          selectedClients: [],
          court: initialCourt,
          modality: allowed[0] || '',
          status: 'scheduled',
          date: currentDate,
          startMinutes: nearestSlot(),
          endMinutes: nearestSlot() + 60,
        });
        setParticipantsForm([]);
        // Evita autoajuste imediato durante a animação de abertura
        suppressAutoAdjustRef.current = true;
      }
    }, [isModalOpen, editingBooking, currentDate, prefill, availableCourts, modalities, participantsByAgendamento]);

    // Prefill tardio: quando os participantes chegam após abrir o modal
    useEffect(() => {
      if (!isModalOpen || !editingBooking) return;
      if (participantsPrefillOnceRef.current) return;
      const loadedParts = participantsByAgendamento[editingBooking.id] || [];
      if (!loadedParts.length) return;
      const selectedFromParts = loadedParts
        .filter(p => p && p.cliente_id)
        .map(p => ({ id: p.cliente_id, nome: p.nome }))
        .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
      if ((form.selectedClients || []).length === 0 && selectedFromParts.length > 0) {
        setForm(f => ({ ...f, selectedClients: selectedFromParts }));
        setParticipantsForm(
          loadedParts.map(p => ({
            cliente_id: p.cliente_id,
            nome: p.nome,
            valor_cota: (() => {
              const num = Number.isFinite(Number(p.valor_cota)) ? Number(p.valor_cota) : parseBRL(p.valor_cota);
              return maskBRL(String((Number.isFinite(num) ? num : 0).toFixed(2)));
            })(),
            status_pagamento: p.status_pagamento_text || 'Pendente',
          }))
        );
        setPaymentSelectedId(selectedFromParts[0]?.id || null);
        participantsPrefillOnceRef.current = true;
      }
    }, [isModalOpen, editingBooking, participantsByAgendamento]);

    // Limites da quadra selecionada
    const courtBounds = useMemo(() => {
      const c = courtsMap[form.court];
      if (!c) return { start: dayStartHour * 60, end: dayEndHourExclusive * 60 };
      const [sh, sm] = String(c.hora_inicio || '06:00:00').split(':').map(Number);
      const [eh, em] = String(c.hora_fim || '24:00:00').split(':').map(Number);
      return { start: sh * 60 + (sm || 0), end: eh * 60 + (em || 0) };
    }, [courtsMap, form.court, dayStartHour, dayEndHourExclusive]);

    // Intervalos ocupados no dia/quadra selecionados (em minutos desde 00:00)
    const dayIntervals = useMemo(() => {
      const dayStr = format(form.date, 'yyyy-MM-dd');
      const toMinutes = (d) => getHours(d) * 60 + getMinutes(d);
      return bookings
        .filter(b => b.court === form.court && format(b.start, 'yyyy-MM-dd') === dayStr && b.status !== 'canceled' && (!editingBooking || b.id !== editingBooking.id))
        .map(b => [toMinutes(b.start), toMinutes(b.end)])
        .sort((a, b) => a[0] - b[0]);
    }, [bookings, form.court, form.date, editingBooking]);

    const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
    function isRangeFree(s, e) {
      if (e <= s) return false;
      // Garantir dentro da janela da quadra
      if (s < courtBounds.start || e > courtBounds.end) return false;
      for (const [bs, be] of dayIntervals) {
        if (overlaps(s, e, bs, be)) return false;
      }
      return true;
    }

    // Calcula o maior fim livre contínuo a partir de um início
    const maxFreeEndFrom = (start) => {
      let end = start + SLOT_MINUTES;
      if (!isRangeFree(start, end)) return null; // início inválido
      while (end + SLOT_MINUTES <= courtBounds.end && isRangeFree(start, end + SLOT_MINUTES)) {
        end += SLOT_MINUTES;
      }
      return end;
    };

    // Opções de início: todas dentro do limite da quadra, marcando se estão disponíveis
    const timeOptions = useMemo(() => {
      const bounds = courtBounds;
      const opts = [];
      for (let minutes = bounds.start; minutes <= bounds.end - SLOT_MINUTES; minutes += SLOT_MINUTES) {
        const available = isRangeFree(minutes, minutes + SLOT_MINUTES);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        opts.push({ value: minutes, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` , available});
      }
      return opts;
    }, [courtBounds, dayIntervals]);

    // Opções de término: todas a partir do início até o fim da quadra, marcando se estão dentro do contínuo livre
    const endTimeOptions = useMemo(() => {
      const maxEnd = maxFreeEndFrom(form.startMinutes);
      const opts = [];
      for (let minutes = form.startMinutes + SLOT_MINUTES; minutes <= courtBounds.end; minutes += SLOT_MINUTES) {
        const available = !!maxEnd && minutes <= maxEnd;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        opts.push({ value: minutes, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` , available});
      }
      return opts;
    }, [form.startMinutes, dayIntervals, courtBounds]);

    // Valida/auto-corrige início/fim ao mudar quadra/data/início
    useEffect(() => {
      if (suppressAutoAdjustRef.current) {
        // Não ajustar na primeira renderização após aplicar prefill manual
        suppressAutoAdjustRef.current = false;
        return;
      }
      const ensureValidStart = () => {
        if (isRangeFree(form.startMinutes, form.startMinutes + SLOT_MINUTES)) return form.startMinutes;
        for (let s = Math.max(courtBounds.start, form.startMinutes); s <= courtBounds.end - SLOT_MINUTES; s += SLOT_MINUTES) {
          if (isRangeFree(s, s + SLOT_MINUTES)) return s;
        }
        for (let s = courtBounds.start; s <= courtBounds.end - SLOT_MINUTES; s += SLOT_MINUTES) {
          if (isRangeFree(s, s + SLOT_MINUTES)) return s;
        }
        return form.startMinutes;
      };
      const newStart = ensureValidStart();
      if (newStart !== form.startMinutes) {
        setForm(f => ({ ...f, startMinutes: newStart }));
        return;
      }
      const maxEnd = maxFreeEndFrom(newStart);
      if (!maxEnd) return;
      let desiredEnd = form.endMinutes;
      if (!(Number.isFinite(desiredEnd)) || desiredEnd <= newStart || desiredEnd > maxEnd) {
        desiredEnd = Math.min(newStart + 60, maxEnd);
        if (desiredEnd < newStart + SLOT_MINUTES) desiredEnd = newStart + SLOT_MINUTES;
        setForm(f => ({ ...f, endMinutes: desiredEnd }));
      }
    }, [form.startMinutes, form.court, form.date, dayIntervals, courtBounds]);

    // Modalidades permitidas para a quadra
    const modalitiesForCourt = useMemo(() => (courtsMap[form.court]?.modalidades || modalities), [courtsMap, form.court]);

    // Garante modalidade válida quando a quadra muda
    useEffect(() => {
      const allowed = courtsMap[form.court]?.modalidades || modalities;
      if (!allowed.includes(form.modality)) {
        setForm(f => ({ ...f, modality: allowed[0] || '' }));
      }
    }, [form.court, courtsMap]);

    const durationLabel = useMemo(() => {
      const d = Math.max(0, form.endMinutes - form.startMinutes);
      const h = Math.floor(d / 60);
      const m = d % 60;
      if (h > 0 && m > 0) return `${h}h ${m}min`;
      if (h > 0) return `${h}h`;
      return `${m}min`;
    }, [form.startMinutes, form.endMinutes]);

    // (Resumo removido conforme solicitação)

    // Mensagem simples indicando automação ativa (não bloqueia ação manual)
    const nextAutomationMessage = useMemo(() => {
      if (!isModalOpen) return '';
      const now = new Date();
      const nowMin = getHours(now) * 60 + getMinutes(now);
      const startMin = Number(form.startMinutes);
      const endMin = Number(form.endMinutes);
      const hhmm = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      if (automation.autoConfirmEnabled && form.status === 'scheduled') {
        const threshold = Math.max(0, startMin - Number(automation.autoConfirmMinutesBefore || 0));
        if (nowMin < threshold) {
          return `Este agendamento está com automação ativa (Confirmar automaticamente às ${hhmm(threshold)})`;
        }
      }
      if (automation.autoStartEnabled && form.status === 'confirmed') {
        if (nowMin < startMin) {
          return `Este agendamento está com automação ativa (Iniciar automaticamente às ${hhmm(startMin)})`;
        }
      }
      if (automation.autoFinishEnabled && form.status === 'in_progress') {
        if (nowMin < endMin) {
          return `Este agendamento está com automação ativa (Finalizar automaticamente às ${hhmm(endMin)})`;
        }
      }
      return '';
    }, [isModalOpen, form.startMinutes, form.endMinutes, form.status, automation]);

    // ======================== Pagamentos: estado e helpers ========================
    const [paymentTotal, setPaymentTotal] = useState('');
    const participantsCount = useMemo(() => (form.selectedClients || []).length, [form.selectedClients]);
    const paymentSummary = useMemo(() => {
      const values = (form.selectedClients || []).map(c => {
        const pf = participantsForm.find(p => p.cliente_id === c.id);
        const v = parseBRL(pf?.valor_cota);
        return Number.isFinite(v) ? v : 0;
      });
      const totalAssigned = values.reduce((a, b) => a + b, 0);
      const totalTargetParsed = parseBRL(paymentTotal);
      const totalTarget = Number.isFinite(totalTargetParsed) ? totalTargetParsed : 0;
      const diff = Number((totalTarget - totalAssigned).toFixed(2));
      // contagem simples por status (Pago/Pendente)
      let paid = 0, pending = 0;
      for (const c of (form.selectedClients || [])) {
        const pf = participantsForm.find(p => p.cliente_id === c.id);
        const s = pf?.status_pagamento || 'Pendente';
        if (s === 'Pago') paid++; else pending++;
      }
      return { totalAssigned, totalTarget, diff, paid, pending };
    }, [form.selectedClients, participantsForm, paymentTotal]);

    // Regra global: se qualquer participante cobrir o total do agendamento, todos ficam 'Pago'
    useEffect(() => {
      const totalTarget = parseBRL(paymentTotal);
      if (!Number.isFinite(totalTarget) || totalTarget <= 0) return;
      const anyCoversAll = (participantsForm || []).some(p => parseBRL(p?.valor_cota) >= totalTarget);
      if (anyCoversAll && (participantsForm || []).some(p => p.status_pagamento !== 'Pago')) {
        setParticipantsForm(prev => prev.map(p => ({ ...p, status_pagamento: 'Pago' })));
      }
    }, [participantsForm, paymentTotal]);

    const splitEqually = useCallback(() => {
      const count = (form.selectedClients || []).length;
      if (!count) return;
      const total = parseBRL(paymentTotal);
      if (!Number.isFinite(total) || total < 0) return;
      // Distribui por centavos para somar exatamente ao total
      const totalCents = Math.round(total * 100);
      const base = Math.floor(totalCents / count);
      let remainder = totalCents - base * count; // número de participantes que recebem +1 centavo
      setParticipantsForm(prev => {
        const map = new Map(prev.map(p => [p.cliente_id, p]));
        const ordered = (form.selectedClients || []).slice();
        ordered.forEach((c, idx) => {
          const cents = base + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
          const valueStr = (cents / 100).toFixed(2);
          const masked = maskBRL(String(valueStr));
          const amount = parseBRL(masked);
          const row = map.get(c.id) || { cliente_id: c.id, nome: c.nome, status_pagamento: 'Pendente', valor_cota: '' };
          row.valor_cota = masked;
          row.status_pagamento = (Number.isFinite(amount) && amount > 0) ? 'Pago' : 'Pendente';
          map.set(c.id, row);
        });
        return Array.from(map.values());
      });
    }, [form.selectedClients, paymentTotal, setParticipantsForm]);

    const zeroAllValues = useCallback(() => {
      setParticipantsForm(prev => prev.map(p => ({ ...p, valor_cota: '', status_pagamento: 'Pendente' })));
    }, [setParticipantsForm]);

    // (removido: adjustValue e controles avançados de edição por participante)

    // ... (rest of the code remains the same)
  return (
    <>
      <Helmet>
        <title>Agenda - Fluxo7 Arena</title>
        <meta name="description" content="Gerencie seus agendamentos, horários e quadras." />
      </Helmet>
      {/* Dialogo de reativação de automação (top-level) */}
      <Dialog
        open={!!reactivateAsk}
        onOpenChange={(open) => {
          if (!open && reactivateAsk) {
            try { reactivateAsk.resolve(false); } catch {}
            setReactivateAsk(null);
          }
        }}
      >
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Reativar automação?</DialogTitle>
            <DialogDescription>
              Ao reativar, este agendamento voltará a ser atualizado automaticamente (início e término) pelas regras da agenda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="border border-white/10"
                onClick={() => {
                  try { reactivateAsk?.resolve(false); } catch {}
                  setReactivateAsk(null);
                }}
              >Cancelar</Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => {
                  try { reactivateAsk?.resolve(true); } catch {}
                  setReactivateAsk(null);
                }}
              >Reativar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Add/Edit Booking Modal (restaurado) */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          // Apenas trata fechamento aqui; abertura é feita por openBookingModal()
          if (!open) {
            setIsModalOpen(false);
            setEditingBooking(null);
            setPrefill(null);
            setIsPaymentModalOpen(false);
            participantsPrefillOnceRef.current = false;
          }
        }}
      >
        <DialogContent
          forceMount
          disableAnimations={true}
          alignTop
          className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto min-h-[360px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => { if (isPaymentModalOpen) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isPaymentModalOpen) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
              <span>{editingBooking ? 'Editar Agendamento' : 'Novo Agendamento'}</span>
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md border text-sm bg-white/5 border-white/10 text-text-primary"
                title="Data do agendamento"
              >
                <CalendarIcon className="w-4 h-4 opacity-80" />
                <span className="font-semibold">
                  {format(form.date, 'dd/MM/yyyy')}
                  {(() => {
                    const s = Number(form?.startMinutes);
                    const e = Number(form?.endMinutes);
                    const valid = Number.isFinite(s) && Number.isFinite(e) && e > s;
                    if (!valid) return '';
                    const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;
                    return ` • ${hhmm(s)}–${hhmm(e)}`;
                  })()}
                </span>
              </span>
            </DialogTitle>
            <DialogDescription>
              {editingBooking ? 'Atualize os detalhes do agendamento.' : 'Preencha os detalhes para criar uma nova reserva.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Coluna esquerda */}
            <div className="space-y-4">
              {/* Clientes */}
              <div>
                <Label className="font-bold">Clientes</Label>
                <div className="flex gap-2 mt-1">
                  <Popover
                    open={isCustomerPickerOpen}
                    onOpenChange={(open) => {
                      // Não fechar automaticamente enquanto o modal de novo cliente estiver aberto ou enquanto a lista estiver recarregando
                      if ((isClientFormOpen || clientsLoading) && open === false) return;
                      // Se estiver fechando e foi por clique fora, aplica destaque temporário ao trigger
                      if (!open && closedByOutsideRef.current) {
                        setHighlightCustomerTrigger(true);
                        closedByOutsideRef.current = false;
                        setTimeout(() => setHighlightCustomerTrigger(false), 1200);
                      }
                      setIsCustomerPickerOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("min-w-[180px] justify-between", highlightCustomerTrigger && "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-transparent transition-shadow") }>
                        {selectedClientsLabel}
                        <ChevronDown className="w-4 h-4 ml-2 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[360px] p-2"
                      onPointerDownOutside={(e) => {
                        if (clientsLoading || isClientFormOpen) { e.preventDefault(); return; }
                        // Marca intenção de fechar por clique fora
                        closedByOutsideRef.current = true;
                      }}
                      onFocusOutside={(e) => { if (clientsLoading || isClientFormOpen) e.preventDefault(); }}
                      onEscapeKeyDown={(e) => { if (clientsLoading || isClientFormOpen) e.preventDefault(); }}
                    >
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            ref={customerQueryInputRef}
                            placeholder="Buscar cliente..."
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            className="pr-10"
                          />
                          {customerQuery && (
                            <button
                              type="button"
                              aria-label="Limpar busca"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/10"
                              onClick={() => { setCustomerQuery(''); customerQueryInputRef.current?.focus(); }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div
                          className="max-h-[260px] overflow-y-auto divide-y divide-border rounded-md border border-border"
                          onWheel={(e) => { e.stopPropagation(); }}
                          onTouchMove={(e) => { e.stopPropagation(); }}
                          style={{ overscrollBehavior: 'contain' }}
                        >
                          {((localCustomers || [])
                            .filter((c) => {
                              const q = customerQuery.trim().toLowerCase();
                              if (!q) return true;
                              const label = String(getCustomerLabel(c) || '').toLowerCase();
                              return label.includes(q);
                            })
                            // Ordena por codigo asc (itens sem codigo vão para o final); desempate por nome
                            .slice()
                            .sort((a, b) => {
                              const ca = typeof a === 'object' ? (Number.isFinite(Number(a?.codigo)) ? Number(a.codigo) : Infinity) : Infinity;
                              const cb = typeof b === 'object' ? (Number.isFinite(Number(b?.codigo)) ? Number(b.codigo) : Infinity) : Infinity;
                              if (ca !== cb) return ca - cb;
                              const na = String(getCustomerName(a) || '').toLowerCase();
                              const nb = String(getCustomerName(b) || '').toLowerCase();
                              return na.localeCompare(nb);
                            })
                          ).map((c) => {
                            const id = typeof c === 'object' ? c.id : null;
                            const nome = getCustomerName(c);
                            const selected = (form.selectedClients || []).some(sc => sc.id === id || sc.nome === nome);
                            return (
                              <button
                                key={id || nome}
                                type="button"
                                className="w-full text-left py-2 px-3 hover:bg-white/5 flex items-center justify-between"
                                onClick={() => {
                                  setForm((f) => {
                                    const exists = (f.selectedClients || []).some(sc => sc.id === id || sc.nome === nome);
                                    if (exists) {
                                      return { ...f, selectedClients: (f.selectedClients || []).filter(x => (x.id || x.nome) !== (id || nome)) };
                                    }
                                    const novo = { id, nome };
                                    return { ...f, selectedClients: [...(f.selectedClients || []), novo] };
                                  });
                                }}
                              >
                                <span className={`truncate mr-2 ${selected ? 'text-text-muted' : ''}`}>{getCustomerLabel(c)}</span>
                                {selected && (
                                  <CheckCircle className={`w-4 h-4 ${statusConfig.confirmed.text}`} aria-label="Selecionado" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/40 ring-offset-2 ring-offset-transparent"
                            onClick={() => setIsCustomerPickerOpen(false)}
                          >
                            Concluir
                          </Button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted">{(form.selectedClients || []).length} selecionado(s)</span>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    onClick={() => {
                      // Fecha o popover antes de abrir o modal para evitar flicker/fechamento tardio
                      setIsCustomerPickerOpen(false);
                      setClientForModal(null);
                      setIsClientFormOpen(true);
                    }}
                  >
                    + Novo
                  </Button>
                </div>
                {(form.selectedClients || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(form.selectedClients || []).map((c) => (
                      <span key={c.id} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 flex items-center gap-2">
                        {shortName(c.nome)}
                        <button type="button" className="text-text-muted hover:text-red-400" onClick={() => setForm((f) => ({ ...f, selectedClients: (f.selectedClients || []).filter((x) => x.id !== c.id) }))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quadra */}
              <div>
                <Label className="font-bold">Quadra</Label>
                <Select value={form.court} onValueChange={(v) => setForm((f) => ({ ...f, court: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableCourts.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Modalidade */}
              <div>
                <Label className="font-bold">Modalidade</Label>
                <Select value={form.modality} onValueChange={(v) => setForm((f) => ({ ...f, modality: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(modalitiesForCourt || []).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Coluna direita */}
            <div className="space-y-4">
              {/* Status */}
              <div>
                <Label className="font-bold">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(statusConfig).map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className={`inline-block h-4 w-1 rounded ${statusConfig[k].accent}`} />
                          {statusConfig[k].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {nextAutomationMessage && (
                  <div className="mt-1 text-xs text-text-secondary italic">
                    {nextAutomationMessage}
                  </div>
                )}
              </div>

              {/* Horário */}
              <div>
                <Label className="font-bold">Horário</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select value={String(form.startMinutes)} onValueChange={(v) => setForm((f) => ({ ...f, startMinutes: Number(v) }))}>
                    <SelectTrigger className="w-32" aria-label="Hora início"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timeOptions.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={String(opt.value)}
                          disabled={!opt.available}
                          className={cn(!opt.available && 'opacity-60')}
                        >
                          <span className="inline-flex items-center gap-2">
                            {opt.available ? (
                              <Clock className="w-4 h-4 opacity-80" />
                            ) : (
                              <Lock className="w-4 h-4 opacity-80" />
                            )}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(form.endMinutes)} onValueChange={(v) => setForm((f) => ({ ...f, endMinutes: Number(v) }))}>
                    <SelectTrigger className="w-32" aria-label="Hora fim"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {endTimeOptions.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={String(opt.value)}
                          disabled={!opt.available}
                          className={cn(!opt.available && 'opacity-60')}
                        >
                          <span className="inline-flex items-center gap-2">
                            {opt.available ? (
                              <Clock className="w-4 h-4 opacity-80" />
                            ) : (
                              <Lock className="w-4 h-4 opacity-80" />
                            )}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-1 inline-block text-xs font-semibold text-text-secondary bg-white/5 border border-white/10 rounded px-2 py-0.5">Duração: {durationLabel}</div>
              </div>
            </div>
          </div>

          <DialogFooter className="w-full flex items-center -mx-6">
            {editingBooking && (
              <>
                <div className="ml-6 mr-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-500 text-white border border-red-700"
                    onClick={() => setIsCancelConfirmOpen(true)}
                  >
                    <XCircle className="w-4 h-4 mr-2 opacity-90" /> Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-teal-600 hover:bg-teal-500 text-white border-teal-700"
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    <DollarSign className="w-4 h-4 mr-2 opacity-90" /> Pagamentos
                  </Button>
                </div>
                <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ao cancelar, este agendamento deixará de aparecer na agenda padrão. Ele só será visível ao selecionar o filtro "Cancelados".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-500"
                        onClick={async () => {
                          try {
                            setIsCancelConfirmOpen(false);
                            setIsModalOpen(false);
                            await updateBookingStatus(editingBooking.id, 'canceled', 'user');
                            toast({ title: 'Agendamento cancelado' });
                          } catch (e) {
                            toast({ title: 'Erro ao cancelar', description: e?.message || 'Tente novamente.' });
                          }
                        }}
                      >
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <div className="ml-auto flex gap-2 pr-6">
              <Button type="button" variant="ghost" className="border border-white/10" onClick={() => setIsModalOpen(false)}>Fechar</Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingBooking}
                onClick={async () => {
                  const clickTs = Date.now();
                  const traceId = `[Click:SaveBooking ${clickTs}]`;
                  try { console.group(traceId); } catch {}
                  try {
                    try { console.log('Start', { isSavingBooking, hasEditing: !!editingBooking, formSnapshot: { court: form?.court, start: form?.startMinutes, end: form?.endMinutes, status: form?.status } }); } catch {}
                    if (isSavingBooking) {
                      try { console.warn('Ignored click: already saving'); } catch {}
                      return;
                    }
                    // Marca como pendente e executa; se algo interromper (ex.: troca de aba), auto-resume via visibilitychange
                    pendingSaveRef.current = true;
                    completedSaveRef.current = false;
                    await saveBookingOnce();
                    try { console.log('Completed saveBookingOnce()'); } catch {}
                  } catch (e) {
                    try { console.error('Unhandled click error (Salvar agendamento)', e); } catch {}
                  } finally {
                    try { console.groupEnd(); } catch {}
                  }
                }}
              >Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      {editingBooking && (
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent
            forceMount
            className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => { e.preventDefault(); }}
            onEscapeKeyDown={(e) => { e.preventDefault(); }}
          >
            <DialogHeader>
              <DialogTitle>Registrar pagamento</DialogTitle>
              <DialogDescription>Gerencie valores, divisão e status de pagamento dos participantes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Total e ações essenciais */}
              <div className="p-4 rounded-lg border border-border bg-gradient-to-br from-surface-2 to-surface shadow-md">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="font-bold">Valor total a receber</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        step="0.01"
                        placeholder="0,00"
                        value={maskBRL(paymentTotal)}
                        onChange={(e) => setPaymentTotal(maskBRL(e.target.value))}
                        className="max-w-[180px]"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="bg-sky-600 hover:bg-sky-500 text-white"
                        onClick={splitEqually}
                        disabled={!paymentTotal || participantsCount === 0}
                      >Dividir igualmente</Button>
                      {/* Removed secondary mass-pay button as requested */}
                      <Button type="button" variant="ghost" className="border border-white/10" onClick={zeroAllValues} disabled={participantsCount === 0}>Zerar valores</Button>
                    </div>
                  </div>
                  <div className="ml-auto text-sm">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-text-secondary">Participantes:</span>
                        <strong>{participantsCount}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-text-secondary">Atribuído:</span>
                        <strong>R$ {paymentSummary.totalAssigned.toFixed(2)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-text-secondary">Alvo:</span>
                        <strong>R$ {paymentSummary.totalTarget.toFixed(2)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-text-secondary">Diferença:</span>
                        <strong className={paymentSummary.diff === 0 ? 'text-emerald-500' : (paymentSummary.diff > 0 ? 'text-amber-500' : 'text-rose-500')}>R$ {paymentSummary.diff.toFixed(2)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-text-secondary">Pago:</span>
                        <strong>{paymentSummary.paid}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <span className="text-text-secondary">Pendente:</span>
                        <strong>{paymentSummary.pending}</strong>
                      </span>
                    </div>
                    {(() => {
                      const pctRaw = paymentSummary.totalTarget > 0 ? (paymentSummary.totalAssigned / paymentSummary.totalTarget) * 100 : 0;
                      // Usa o percentual real, sem "bump" artificial, e faz clamp entre 0 e 100
                      const pct = Math.max(0, Math.min(100, pctRaw));
                      // Apenas para a barra ficar visível quando >0% mas muito pequeno, sem alterar o texto
                      const pctVisual = pct > 0 && pct < 1 ? 1 : pct;
                      const barColor = paymentSummary.diff === 0 ? 'bg-emerald-500' : (paymentSummary.diff > 0 ? 'bg-amber-500' : 'bg-rose-500');
                      return (
                        <div className="mt-2 w-full min-w-[280px]">
                          <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                            <div className={`h-full ${barColor}`} style={{ width: `${pctVisual}%` }} />
                          </div>
                          <div className="mt-1 text-sm font-medium text-text-muted">{pct.toFixed(0)}% atribuído</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              {/* Nota quando sem participantes */}
              {(form.selectedClients || []).length === 0 && (
                <div className="text-xs text-text-muted italic">Nenhum participante neste agendamento. Adicione participantes no campo "Clientes" do modal principal.</div>
              )}

              {(form.selectedClients || []).length > 0 && (
                <>
                {/* Busca por participante */}
                <div className="flex items-center justify-between">
                  <div className="relative w-full max-w-[320px]">
                    <Input
                      ref={paymentSearchRef}
                      type="text"
                      placeholder="Buscar participante..."
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                      className="pr-16"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-400 hover:text-amber-300"
                      onClick={() => {
                        setPaymentSearch('');
                        try { paymentSearchRef.current?.focus(); } catch {}
                      }}
                    >limpar</button>
                  </div>
                </div>
                {paymentWarning?.type === 'pending' && (
                  <div role="alert" className="mb-2 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-amber-200 flex items-start gap-3">
                    <div className="mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="flex-1 text-sm">
                      <strong>Atenção:</strong> Existem <strong>{paymentWarning.count}</strong> participante(s) com status <strong>Pendente</strong>.
                      <span className="ml-1">Marque como <strong>Pago</strong> antes de salvar.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={() => {
                          const id = paymentWarning.firstPendingId;
                          if (id) {
                            setPaymentSelectedId(id);
                            const el = document.getElementById(`payment-row-${id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                      >Ver pendentes</button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-600/40"
                        onClick={() => setPaymentWarning(null)}
                      >Entendi</button>
                    </div>
                  </div>
                )}
                <div className="border border-border rounded-md overflow-x-auto">
                  <div className="grid grid-cols-12 items-center px-3 py-2 bg-surface-2 text-[11px] uppercase tracking-wide text-text-secondary">
                    <div className="col-span-6">Participante</div>
                    <div className="col-span-3">Valor</div>
                    <div className="col-span-2 flex items-center justify-between pr-2">
                      <span>Status</span>
                    </div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>
                  <div className="divide-y divide-border max-h-[50vh] overflow-y-auto fx-scroll">
                    {(() => {
                      const q = paymentSearch.trim().toLowerCase();
                      const filtered = (form.selectedClients || [])
                        .filter((c) => !paymentHiddenIds.includes(c.id))
                        .filter((c) => {
                          if (!q) return true;
                          return String(c?.nome || '').toLowerCase().includes(q);
                        });
                      return filtered;
                    })().map((c) => {
                      const pf = participantsForm.find(p => p.cliente_id === c.id) || { cliente_id: c.id, nome: c.nome, valor_cota: '', status_pagamento: 'Pendente' };
                      return (
                        <div
                          key={c.id}
                          id={`payment-row-${c.id}`}
                          className={`grid grid-cols-12 items-center px-3 py-2 ${paymentWarning?.type === 'pending' && pf.status_pagamento !== 'Pago' ? 'bg-amber-500/5' : ''}`}
                        >
                          <div className="col-span-6 truncate text-[15px] font-medium">{c.nome}</div>
                          <div className="col-span-3 pr-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              step="0.01"
                              placeholder="0,00"
                              value={maskBRL(pf.valor_cota)}
                              onChange={(e) => {
                                const masked = maskBRL(e.target.value);
                                const amount = parseBRL(masked);
                                const autoStatus = (Number.isFinite(amount) && amount > 0) ? 'Pago' : 'Pendente';
                                setParticipantsForm(prev => {
                                  let list = [...prev];
                                  const idx = list.findIndex(p => p.cliente_id === c.id);
                                  if (idx >= 0) {
                                    list[idx] = { ...list[idx], valor_cota: masked, status_pagamento: autoStatus };
                                  } else {
                                    list = [...list, { cliente_id: c.id, nome: c.nome, valor_cota: masked, status_pagamento: autoStatus }];
                                  }
                                  const totalTarget = parseBRL(paymentTotal);
                                  if (Number.isFinite(totalTarget)) {
                                    const anyCoversAll = parseBRL(masked) >= totalTarget; // participante atual cobre tudo
                                    if (anyCoversAll) {
                                      list = list.map(p => ({ ...p, status_pagamento: 'Pago' }));
                                      return list;
                                    }
                                  }
                                  return list;
                                });
                              }}
                              className="w-24 md:w-28 text-sm"
                            />
                          </div>
                          <div className="col-span-2 pr-2">
                            {/* Status automático, apenas leitura (derivado do valor_cota) */}
                            <span
                              className={`inline-flex items-center justify-center h-8 px-2 rounded text-sm font-medium border w-full select-none ${pf.status_pagamento === 'Pago' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-700/40' : 'bg-amber-600/20 text-amber-400 border-amber-700/40'}`}
                              title={pf.status_pagamento === 'Pago' ? 'Status automático: Pago (valor > 0)' : 'Status automático: Pendente (valor = 0)'}
                            >
                              {pf.status_pagamento === 'Pago' ? 'Pago' : 'Pendente'}
                            </span>
                          </div>
                          <div className="col-span-1 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400"
                              onClick={() => {
                                // Remove apenas na UI de pagamentos (não altera os clientes do agendamento aqui)
                                setPaymentHiddenIds((prev) => prev.includes(c.id) ? prev : [...prev, c.id]);
                                setParticipantsForm(prev => prev.filter(p => p.cliente_id !== c.id));
                              }}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" className="border border-white/10" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isSavingPayments}
                  onClick={async () => {
                    const clickTs = Date.now();
                    const traceId = `[Click:SavePayments ${clickTs}]`;
                    try { console.group(traceId); } catch {}
                    try {
                      try { console.log('Start', { isSavingPayments, participantsCount, selectedClients: (form?.selectedClients || []).map(c => c?.id), paymentTotal }); } catch {}
                      if (isSavingPayments) {
                        try { console.warn('Ignored click: already saving payments'); } catch {}
                        return;
                      }
                      setIsSavingPayments(true);
                      const agendamentoId = editingBooking.id;
                      const codigo = userProfile.codigo_empresa;
                      const t0 = Date.now();

                      // Verificação: pendentes (somente notificação; não exibir banner bloqueante)
                      const mapForm = new Map((participantsForm || []).map(p => [p.cliente_id, p]));
                      const effectiveSelected = (form.selectedClients || []).filter(c => !paymentHiddenIds.includes(c.id));
                      const pendingCount = effectiveSelected.reduce((acc, c) => {
                        const st = (mapForm.get(c.id)?.status_pagamento) || 'Pendente';
                        return acc + (st !== 'Pago' ? 1 : 0);
                      }, 0);
                      if (pendingCount > 0) {
                        // manter apenas toast mais abaixo; sem logs
                      }
                      const { error: delErr } = await supabase
                        .from('agendamento_participantes')
                        .delete()
                        .eq('codigo_empresa', codigo)
                        .eq('agendamento_id', agendamentoId);
                      if (delErr) {
                        console.error('[ParticipantsSave] Delete error', delErr);
                        toast({ title: 'Erro ao salvar pagamentos', description: 'Falha ao limpar registros anteriores.', variant: 'destructive' });
                        throw delErr;
                      }
                      
                      const rows = effectiveSelected.map((c) => {
                        const pf = participantsForm.find(p => p.cliente_id === c.id) || { valor_cota: null, status_pagamento: 'Pendente' };
                        const valor = parseBRL(pf.valor_cota);
                        return {
                          codigo_empresa: codigo,
                          agendamento_id: agendamentoId,
                          cliente_id: c.id,
                          valor_cota: Number.isFinite(valor) ? valor : 0,
                          status_pagamento: pf.status_pagamento || 'Pendente',
                        };
                      });
                      
                      if (rows.length > 0) {
                        const { data: inserted, error } = await supabase
                          .from('agendamento_participantes')
                          .insert(rows)
                          .select();
                        if (error) {
                          // erro tratado com toast abaixo
                          toast({ title: 'Erro ao salvar pagamentos', description: 'Falha ao inserir pagamentos.', variant: 'destructive' });
                          throw error;
                        }
                        
                      } else {
                        // nenhum participante selecionado
                      }
                      // Se houve remoções na UI (paymentHiddenIds), persistir também nos dados do agendamento (cliente_id e clientes)
                      try {
                        if ((paymentHiddenIds || []).length > 0) {
                          const newSelected = effectiveSelected;
                          const primary = newSelected[0] || null;
                          const clientesArr = newSelected.map(c => c?.nome).filter(Boolean);
                          await supabase
                            .from('agendamentos')
                            .update({
                              cliente_id: primary?.id ?? null,
                              clientes: clientesArr,
                            })
                            .eq('codigo_empresa', codigo)
                            .eq('id', agendamentoId);
                          // Reflete imediatamente no formulário/modais
                          setForm(f => ({ ...f, selectedClients: newSelected }));
                          // Atualiza o cartão na agenda (nome do cliente primário)
                          setBookings(prev => prev.map(b => b.id === agendamentoId ? {
                            ...b,
                            customer: primary?.nome || '',
                          } : b));
                        }
                      } catch {}

                      // Recarrega participantes deste agendamento para atualizar o indicador "pagos/total" na agenda
                      try {
                        const { data: freshParts, error: freshErr } = await supabase
                          .from('v_agendamento_participantes')
                          .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento_text')
                          .eq('codigo_empresa', codigo)
                          .eq('agendamento_id', agendamentoId);
                        if (!freshErr) {
                          setParticipantsByAgendamento((prev) => {
                            const next = { ...prev, [agendamentoId]: freshParts || [] };
                            try { if (participantsCacheKey) localStorage.setItem(participantsCacheKey, JSON.stringify(next)); } catch {}
                            return next;
                          });
                        }
                      } catch (rfErr) {
                        // falha silenciosa; indicador pode não atualizar imediatamente
                      }
                      
                      // Avalia total atribuído vs total alvo e pendências (notificações; salvamento não é bloqueado)
                      const totalTargetParsed = parseBRL(paymentTotal);
                      const totalTarget = Number.isFinite(totalTargetParsed) ? totalTargetParsed : 0;
                      const totalAssigned = (form.selectedClients || []).reduce((sum, c) => {
                        const pf = participantsForm.find(p => p.cliente_id === c.id);
                        const v = parseBRL(pf?.valor_cota);
                        return sum + (Number.isFinite(v) ? v : 0);
                      }, 0);
                      if (totalTarget > 0 && totalAssigned < totalTarget - 0.005) {
                        toast({
                          title: 'Pagamentos salvos',
                          description: 'Total não alcançado.',
                          variant: 'destructive',
                        });
                      } else if (pendingCount > 0) {
                        toast({
                          title: 'Pagamentos salvos',
                          description: `Pendentes: ${pendingCount}`,
                          variant: 'warning',
                        });
                      } else {
                        toast({ title: 'Pagamentos salvos', variant: 'success' });
                      }
                      setPaymentWarning(null);
                      try { console.log('Payments saved successfully in ms', Date.now() - t0); } catch {}
                      // Fecha o modal principal para voltar direto à agenda
                      setIsModalOpen(false);
                    } catch (e) {
                      toast({ title: 'Erro ao salvar pagamentos', description: 'Tente novamente.', variant: 'destructive' });
                      // eslint-disable-next-line no-console
                      console.error('Salvar pagamentos:', e);
                    } finally {
                      setIsSavingPayments(false);
                      try { console.groupEnd(); } catch {}
                    }
                  }}
                >Salvar Pagamentos</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
          <ClientFormModal
            open={isClientFormOpen}
            onOpenChange={(open) => { setIsClientFormOpen(open); if (!open) setClientForModal(null); }}
            client={clientForModal}
            onSaved={(saved) => {
            try {
              if (saved && typeof saved === 'object') {
                // Atualiza lista se ainda não contém este cliente
                const exists = (localCustomers || []).some((c) => typeof c === 'object' ? c.id === saved.id : false);
                if (!exists) {
                  setLocalCustomers((prev) => [...(prev || []), saved]);
                  // Opcional: sincroniza com o pai fora da animação inicial
                  setCustomerOptions((prev) => [...(prev || []), saved]);
                }
                // Insere como cliente primário do agendamento
                setForm((f) => {
                  const prev = Array.isArray(f.selectedClients) ? f.selectedClients : [];
                  const novo = { id: saved.id, nome: saved.nome || saved.name || getCustomerName(saved), codigo: saved.codigo };
                  const withoutDup = prev.filter(sc => sc.id !== saved.id);
                  return { ...f, selectedClients: [novo, ...withoutDup] };
                });
                setIsCustomerPickerOpen(false);
              }
            } catch {}
          }}
          />
          </>
          );
        };

    const filteredBookings = useMemo(() => {
      const dayStr = format(currentDate, 'yyyy-MM-dd');
      let dayBookings = bookings.filter(b => format(b.start, 'yyyy-MM-dd') === dayStr);
      // Regras de cancelados:
      // - Quando canceledOnly ativo: mostrar somente cancelados
      // - Caso contrário: excluir cancelados da agenda
      dayBookings = viewFilter.canceledOnly
        ? dayBookings.filter(b => b.status === 'canceled')
        : dayBookings.filter(b => b.status !== 'canceled');
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        dayBookings = dayBookings.filter(b =>
          (b.customer || '').toLowerCase().includes(q)
          || (b.court || '').toLowerCase().includes(q)
          || (statusConfig[b.status]?.label || '').toLowerCase().includes(q)
        );
      }
      return (viewFilter.scheduled || viewFilter.canceledOnly) ? dayBookings : [];
    }, [bookings, currentDate, viewFilter.scheduled, viewFilter.canceledOnly, searchQuery]);

  // Após computar os resultados, rola até o primeiro match quando houver busca
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (!(viewFilter.scheduled || viewFilter.canceledOnly)) return; // só quando agendados ou cancelados visíveis
    if (!filteredBookings || filteredBookings.length === 0) return;
    const first = [...filteredBookings].sort((a, b) => a.start - b.start)[0];
    if (!first?.id) return;
    const el = document.getElementById(`booking-${first.id}`);
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [searchQuery, filteredBookings, viewFilter.scheduled, viewFilter.canceledOnly]);

  // Inteligência nos checkboxes: ao ativar Agendados ou Cancelados, rola até o primeiro visível daquele tipo
  useEffect(() => {
    const container = scrollRef.current;
    const prev = prevFiltersRef.current || {};
    // Detecta habilitação dos filtros
    const justEnabledCanceled = viewFilter.canceledOnly && !prev.canceledOnly;
    const justEnabledScheduled = viewFilter.scheduled && !prev.scheduled && !viewFilter.canceledOnly; // scheduled ativo e não em modo cancelados
    if (!container || (!justEnabledCanceled && !justEnabledScheduled)) {
      prevFiltersRef.current = { scheduled: viewFilter.scheduled, canceledOnly: viewFilter.canceledOnly };
      return;
    }
    // Lista já está filtrada para o modo atual (canceledOnly restringe para cancelados)
    const list = filteredBookings || [];
    if (list.length === 0) {
      prevFiltersRef.current = { scheduled: viewFilter.scheduled, canceledOnly: viewFilter.canceledOnly };
      return;
    }
    // Verifica se algum desses itens já está visível no viewport do container
    const cRect = container.getBoundingClientRect();
    const anyVisible = list.some((b) => {
      const el = document.getElementById(`booking-${b.id}`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > cRect.top && r.top < cRect.bottom;
    });
    if (!anyVisible) {
      const first = [...list].sort((a, b) => a.start - b.start)[0];
      const el = first && document.getElementById(`booking-${first.id}`);
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }
    prevFiltersRef.current = { scheduled: viewFilter.scheduled, canceledOnly: viewFilter.canceledOnly };
  }, [viewFilter.scheduled, viewFilter.canceledOnly, filteredBookings]);

  // Cores por quadra agora são geradas de forma determinística via getCourtColor(name)

  const hoursList = useMemo(() => Array.from({ length: Math.max(0, dayEndHourExclusive - dayStartHour) }, (_, i) => dayStartHour + i), [dayStartHour, dayEndHourExclusive]);
  const totalGridHeight = useMemo(() => {
    return Math.max(0, (dayEndHourExclusive - dayStartHour)) * (60 / SLOT_MINUTES) * SLOT_HEIGHT; // 2 slots por hora
  }, [dayStartHour, dayEndHourExclusive]);

  return (
    <>
      <Helmet>
        <title>Agenda - Fluxo7 Arena</title>
        <meta name="description" content="Gerencie seus agendamentos, horários e quadras." />
      </Helmet>

      {/* Payment Modal movido para AddBookingModal para manter escopo correto */}

      {/* ClientFormModal já é renderizado dentro do AddBookingModal */}
      <motion.div variants={isModalOpen ? undefined : pageVariants} initial={isModalOpen ? false : "hidden"} animate={isModalOpen ? false : "visible"} className="h-full flex flex-col">

        {/* Controls */}
        <motion.div variants={itemVariants} className="p-3 rounded-lg bg-surface mb-6">
          <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Navegação de data */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft className="h-5 w-5" /></Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="w-full sm:w-auto max-w-full justify-center text-base font-semibold whitespace-nowrap truncate">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={currentDate} onSelect={(date) => date && setCurrentDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="h-5 w-5" /></Button>
            </div>
            {/* Filtros e ações */}
            <div className="flex items-center flex-wrap gap-3 justify-end">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Buscar agendamento..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => setSearchQuery("")}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-medium text-primary hover:bg-surface-2"
                    onClick={() => setSearchQuery("")}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <Button size="sm" onClick={openBookingModal} aria-label="Novo agendamento" className="gap-2" disabled={availableCourts.length === 0}>
                <Plus className="h-4 w-4" /> Agendar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={availableCourts.length === 0}>
                    <SlidersHorizontal className="h-4 w-4" /> Filtros
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Exibição</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-text-muted" />
                        <span>Agendados</span>
                      </div>
                      <Checkbox
                        checked={viewFilter.scheduled}
                        onCheckedChange={(checked) => setViewFilter(prev => ({ ...prev, scheduled: !!checked, canceledOnly: checked ? false : prev.canceledOnly }))}
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-text-muted" />
                        <span>Livres</span>
                      </div>
                      <Checkbox
                        checked={viewFilter.available}
                        onCheckedChange={(checked) => setViewFilter(prev => ({ ...prev, available: !!checked, canceledOnly: checked ? false : prev.canceledOnly }))}
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-rose-400" />
                        <span>Cancelados</span>
                      </div>
                      <Checkbox
                        checked={viewFilter.canceledOnly}
                        onCheckedChange={(checked) => {
                          const isOn = !!checked;
                          setViewFilter(prev => ({
                            ...prev,
                            canceledOnly: isOn,
                            scheduled: isOn ? false : prev.scheduled,
                            available: isOn ? false : prev.available,
                          }));
                          if (isOn && !hideCanceledInfo) setShowCanceledInfo(true);
                        }}
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-text-muted">Filtrar quadras</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableCourts.map((c) => {
                    const checked = selectedCourts.includes(c);
                    return (
                      <DropdownMenuItem key={c} onClick={(e) => e.preventDefault()}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getCourtColor(c), boxShadow: '0 0 0 2px rgba(255,255,255,0.06)' }}
                              aria-hidden="true"
                            />
                            <span>{c}</span>
                          </div>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => setSelectedCourts(prev => checked ? prev.filter(x => x !== c) : [...prev, c])}
                          />
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setIsSettingsOpen(true)}
                disabled={availableCourts.length === 0}
                aria-label="Configurar agenda"
                title="Configurar agenda"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Modal de Configurações da Agenda */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="sm:max-w-[680px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader className="pb-3 border-b border-border bg-surface-2/40 rounded-t-lg px-2 -mx-2 -mt-2">
              <DialogTitle className="text-base font-semibold tracking-tight">Configurações da Agenda</DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              {/* Grupo: Confirmação */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-text-secondary">
                  <CheckCircle className="h-4 w-4" style={{ color: statusConfig.confirmed.hex }} />
                  <span className="text-sm font-medium">Confirmação automática</span>
                </div>
                {/* Card confirmação */}
                <div className="rounded-lg border border-border bg-surface-2/40 p-4 space-y-3" style={{ borderLeftWidth: 3, borderLeftColor: statusConfig.confirmed.hex }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox id="autoConfirmEnabled" checked={automation.autoConfirmEnabled} onCheckedChange={(v) => setAutomation(a => ({ ...a, autoConfirmEnabled: !!v }))} />
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig.confirmed.hex }} />
                        <Label htmlFor="autoConfirmEnabled" className="font-medium">Confirmação automática</Label>
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-text-muted">Confirmar se faltar</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(Math.max(0, Math.round((automation.autoConfirmMinutesBefore || 0) / 60)))}
                        onValueChange={(v) => setAutomation(a => ({ ...a, autoConfirmMinutesBefore: Math.max(0, Number(v)) * 60 }))}
                        disabled={!automation.autoConfirmEnabled}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Horas" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="0">Imediato</SelectItem>
                          <SelectItem value="1">1 h</SelectItem>
                          <SelectItem value="2">2 h</SelectItem>
                          <SelectItem value="3">3 h</SelectItem>
                          <SelectItem value="4">4 h</SelectItem>
                          <SelectItem value="6">6 h</SelectItem>
                          <SelectItem value="8">8 h</SelectItem>
                          <SelectItem value="12">12 h</SelectItem>
                          <SelectItem value="24">24 h</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-text-muted">antes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grupo: Transições em tempo real */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-text-secondary">
                  <PlayCircle className="h-4 w-4" style={{ color: statusConfig.in_progress.hex }} />
                  <span className="text-sm font-medium">Transições automáticas</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-surface-2/40 p-4 space-y-2" style={{ borderLeftWidth: 3, borderLeftColor: statusConfig.in_progress.hex }}>
                    <div className="flex items-center gap-2">
                      <Checkbox id="autoStartEnabled" checked={automation.autoStartEnabled} onCheckedChange={(v) => setAutomation(a => ({ ...a, autoStartEnabled: !!v }))} />
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig.in_progress.hex }} />
                        <Label htmlFor="autoStartEnabled" className="font-medium">Iniciar no horário</Label>
                      </span>
                    </div>
                    <p className="text-xs text-text-muted ml-7">Confirmado → Em andamento no horário de início.</p>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-2/40 p-4 space-y-2" style={{ borderLeftWidth: 3, borderLeftColor: statusConfig.finished.hex }}>
                    <div className="flex items-center gap-2">
                      <Checkbox id="autoFinishEnabled" checked={automation.autoFinishEnabled} onCheckedChange={(v) => setAutomation(a => ({ ...a, autoFinishEnabled: !!v }))} />
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig.finished.hex }} />
                        <Label htmlFor="autoFinishEnabled" className="font-medium">Finalizar ao término</Label>
                      </span>
                    </div>
                    <p className="text-xs text-text-muted ml-7">Em andamento → Finalizado no horário de término.</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" className="border border-white/10" onClick={() => setIsSettingsOpen(false)}>Cancelar</Button>
              <Button type="button" variant="default" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Modal para filtro de Cancelados */}
        <Dialog open={showCanceledInfo} onOpenChange={setShowCanceledInfo}>
          <DialogContent className="sm:max-w-[520px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Sobre agendamentos cancelados</DialogTitle>
              <DialogDescription>
                Agendamentos cancelados não aparecem na agenda quando o filtro não está selecionado e não ocupam horário.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 mt-2">
              <Checkbox
                id="hide-canceled-info"
                checked={hideCanceledInfo}
                onCheckedChange={(v) => setHideCanceledInfo(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="hide-canceled-info" className="text-sm cursor-pointer text-text-secondary">
                Não mostrar novamente
              </Label>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" onClick={() => setShowCanceledInfo(false)}>Entendi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Aviso: nenhuma quadra cadastrada */}
        {!courtsLoading && availableCourts.length === 0 && (
          <div className="mb-4 p-4 rounded-lg border border-border bg-surface text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Nenhuma quadra encontrada</div>
              <div className="text-text-muted">Cadastre suas quadras para começar a usar a agenda.</div>
            </div>
            <Button asChild>
              <Link to="/quadras">Ir para Cadastros • Quadras</Link>
            </Button>
          </div>
        )}

        {/* Calendar Grid */}
        {selectedCourts.length > 0 && (
        <motion.div variants={isModalOpen ? undefined : itemVariants} className="flex-1 overflow-auto bg-surface rounded-lg border border-border fx-scroll" ref={scrollRef}>
          <div
            className="grid mx-auto"
            style={{
              gridTemplateColumns:
                selectedCourts.length === 1
                  ? `120px 760px`
                  : selectedCourts.length === 2
                  ? `120px repeat(2, 520px)`
                  : `120px repeat(${selectedCourts.length}, 1fr)`,
              width: (selectedCourts.length <= 2) ? 'fit-content' : undefined,
              columnGap: '16px'
            }}
          >
            {/* Time Column */}
            <div className="sticky left-0 bg-surface z-20">
              <div className="sticky top-0 z-20 h-14 border-b border-r border-border bg-surface flex items-center justify-center px-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="hover:bg-surface-2/50 text-lg font-semibold">
                      {isSameDay(currentDate, new Date())
                        ? 'Hoje'
                        : format(currentDate, 'EEEE', { locale: ptBR })}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    <DropdownMenuItem onClick={() => setCurrentDate(new Date())}>Hoje</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(() => {
                      const labels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
                      const base = startOfWeek(currentDate, { weekStartsOn: 1, locale: ptBR });
                      return labels.map((label, idx) => (
                        <DropdownMenuItem key={label} onClick={() => setCurrentDate(addDays(base, idx))}>
                          {label}
                        </DropdownMenuItem>
                      ));
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {hoursList.map((hour) => (
                <div key={`time-${hour}`} className={cn("border-r border-border", (hour % 2 === 1) && "bg-surface-2/30") }>
                  {/* Slot :00 */}
                  <div className="relative border-b border-border/60" style={{ height: SLOT_HEIGHT }}>
                    <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-surface px-2 rounded font-bold text-lg">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                  {/* Slot :30 */}
                  <div className="relative border-b border-border/60" style={{ height: SLOT_HEIGHT }}>
                    <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-surface px-2 rounded font-bold text-lg">
                      {String(hour).padStart(2, '0')}:30
                    </span>
                  </div>
                </div>
              ))}
            </div>

          {/* Court Columns */}
          {selectedCourts.map(court => (
            <div key={court} className="relative border-r border-border">
              <div className="h-14 border-b border-border text-center font-semibold text-lg flex items-center justify-center sticky top-0 bg-surface z-10">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: getCourtColor(court), boxShadow: '0 0 0 2px rgba(255,255,255,0.06)' }}
                    aria-hidden="true"
                  />
                  <span className="tracking-tight">{court}</span>
                </div>
              </div>
              {/* Container relativo para posicionar reservas */}
              <div className="relative" style={{ height: totalGridHeight }}>
                {/* Linhas base por quadra: exibe apenas durante o horário de funcionamento dessa quadra */}
                {(viewFilter.scheduled || viewFilter.canceledOnly) && (() => {
                  const bounds = (() => {
                    const tStart = courtsMap[court]?.hora_inicio;
                    const tEnd = courtsMap[court]?.hora_fim;
                    const [sh, sm] = String(tStart || `${dayStartHour}:00:00`).split(':').map(Number);
                    const [eh, em] = String(tEnd || `${dayEndHourExclusive}:00:00`).split(':').map(Number);
                    return { start: (sh||0)*60 + (sm||0), end: (eh||0)*60 + (em||0) };
                  })();
                  const dayStartM = dayStartHour * 60;
                  const dayEndM = dayEndHourExclusive * 60;
                  const startM = Math.max(bounds.start, dayStartM);
                  const endM = Math.min(bounds.end, dayEndM);
                  const startSlot = Math.max(0, Math.floor((startM - dayStartM) / SLOT_MINUTES));
                  const endSlot = Math.max(startSlot, Math.ceil((endM - dayStartM) / SLOT_MINUTES));
                  const totalSlots = Math.max(0, (dayEndM - dayStartM) / SLOT_MINUTES);
                  const topSpacerH = startSlot * SLOT_HEIGHT;
                  const visibleSlots = Math.min(totalSlots, Math.max(0, endSlot - startSlot));
                  const bottomSpacerH = Math.max(0, (totalSlots - endSlot) * SLOT_HEIGHT);
                  return (
                    <>
                      {/* Espaço superior sem linhas até a abertura */}
                      {topSpacerH > 0 && <div style={{ height: topSpacerH }} />}
                      {/* Slots visíveis com linhas a cada 30 minutos */}
                      {Array.from({ length: visibleSlots }, (_, i) => {
                        const globalSlotIdx = startSlot + i;
                        const hour = Math.floor(globalSlotIdx / (60 / SLOT_MINUTES)) + dayStartHour;
                        const isOddHour = hour % 2 === 1;
                        return (
                          <div key={`base-${court}-slot-${globalSlotIdx}`} className={cn("border-b border-border/60", isOddHour && "bg-surface-2/30")} style={{ height: SLOT_HEIGHT }} />
                        );
                      })}
                      {/* Espaço inferior sem linhas após o fechamento */}
                      {bottomSpacerH > 0 && <div style={{ height: bottomSpacerH }} />}
                    </>
                  );
                })()}
                {/* Agendados ou Cancelados (filtrados) */}
                {(viewFilter.scheduled || viewFilter.canceledOnly) && filteredBookings
                  .filter(b => b.court === court)
                  .map(b => <BookingCard key={b.id} booking={b} />)
                }
                {/* Livres */}
                {viewFilter.available && (() => {
                  // calcular intervalos livres para o dia/quadra
                  const courtStart = (() => {
                    const t = courtsMap[court]?.hora_inicio;
                    if (!t) return dayStartHour * 60;
                    const [h, m] = String(t).split(':').map(Number);
                    return h * 60 + (m || 0);
                  })();
                  const courtEnd = (() => {
                    const t = courtsMap[court]?.hora_fim;
                    if (!t) return dayEndHourExclusive * 60;
                    const [h, m] = String(t).split(':').map(Number);
                    return h * 60 + (m || 0);
                  })();
                  const toMinutes = (d) => getHours(d) * 60 + getMinutes(d);
                  const dayStr = format(currentDate, 'yyyy-MM-dd');
                  const intervals = bookings
                    .filter(b => b.court === court && format(b.start, 'yyyy-MM-dd') === dayStr && b.status !== 'canceled')
                    .map(b => [toMinutes(b.start), toMinutes(b.end)])
                    .sort((a,b) => a[0]-b[0]);
                  const free = [];
                  let cursor = courtStart;
                  for (const [s,e] of intervals) {
                    if (s > cursor) free.push([cursor, s]);
                    cursor = Math.max(cursor, e);
                  }
                  if (cursor < courtEnd) free.push([cursor, courtEnd]);

                  const FreeSlot = ({startM, endM}) => {
                    const [hoverSlot, setHoverSlot] = useState(null);
                    // posiciona por slots como BookingCard
                    const startSlotIndex = Math.floor((startM - (dayStartHour * 60)) / SLOT_MINUTES);
                    const slotsCount = Math.max(1, Math.ceil((endM - startM) / SLOT_MINUTES));
                    const endSlotIndex = startSlotIndex + slotsCount;
                    const top = startSlotIndex * SLOT_HEIGHT - 1;
                    const height = (endSlotIndex - startSlotIndex) * SLOT_HEIGHT + 2;
                    const sLabel = `${String(Math.floor(startM/60)).padStart(2,'0')}:${String(startM%60).padStart(2,'0')}`;
                    const eLabel = `${String(Math.floor(endM/60)).padStart(2,'0')}:${String(endM%60).padStart(2,'0')}`;
                    return (
                      <div
                        className={cn(
                          "absolute left-2 right-2 rounded-md border-2 border-dashed text-sm z-0 cursor-pointer",
                          // Tom de verde distinto do confirmado (#22C55E)
                          "border-[#10B981]",
                          // Sem preenchimento — apenas contorno pontilhado + leve sombra no hover
                          "bg-transparent hover:border-[#10B981]/80 hover:shadow-sm"
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const offsetY = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
                          // Slot sob o cursor: sempre para baixo (floor)
                          let slotIdx = Math.floor(offsetY / SLOT_HEIGHT);
                          // Garante limites dentro do bloco livre
                          slotIdx = Math.max(0, Math.min(slotIdx, slotsCount - 1));
                          setHoverSlot(slotIdx);
                        }}
                        onMouseLeave={() => setHoverSlot(null)}
                        onClick={(e) => {
                          // Calcula a posição do clique dentro do bloco livre
                          const rect = e.currentTarget.getBoundingClientRect();
                          const offsetY = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
                          // Converte para minutos a partir do início do bloco livre
                          // Importante: sempre usar floor para não "pular" para o :30 ao clicar na metade inferior
                          const slotsFromStart = Math.floor(offsetY / SLOT_HEIGHT);
                          let clickedStart = startM + slotsFromStart * SLOT_MINUTES;
                          // Garante que o início esteja dentro do intervalo livre
                          clickedStart = Math.max(startM, Math.min(clickedStart, endM - SLOT_MINUTES));

                          // Busca o próximo agendamento (início) após o clique para esta quadra e dia
                          const nextStart = (() => {
                            const starts = bookings
                              .filter(b => b.court === court && format(b.start, 'yyyy-MM-dd') === dayStr)
                              .map(b => getHours(b.start) * 60 + getMinutes(b.start))
                              .filter(m => m > clickedStart)
                              .sort((a,b) => a - b);
                            return starts[0];
                          })();

                          const extendLimit = typeof nextStart === 'number' ? nextStart : courtEnd; // até próximo agendamento ou fim do dia

                          // Duração padrão 60min, limitada pelo próximo agendamento
                          let clickedEnd = Math.min(clickedStart + 60, extendLimit);
                          // Se sobrar menos de 30min, tenta alinhar para garantir pelo menos 30min
                          if (clickedEnd - clickedStart < 30) {
                            const minStartForThirty = extendLimit - 30;
                            if (minStartForThirty >= startM) {
                              clickedStart = Math.max(startM, Math.min(clickedStart, minStartForThirty));
                              clickedEnd = extendLimit;
                            } else {
                              // Intervalo restante tem menos de 30min; usa o máximo possível
                              clickedStart = startM;
                              clickedEnd = Math.min(extendLimit, endM);
                            }
                          }

                          setPrefill({ court, date: currentDate, startMinutes: clickedStart, endMinutes: clickedEnd });
                          setEditingBooking(null);
                          openBookingModal();
                        }}
                        title={`Livre: ${sLabel}–${eLabel}`}
                      >
                        {hoverSlot !== null && (
                          <div
                            className="pointer-events-none absolute left-[6px] right-[6px] rounded-md border border-white/10 bg-white/5"
                            style={{ top: `${hoverSlot * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                          />
                        )}
                        <div className="h-full px-3 py-2 flex items-center justify-between">
                          <span className="font-medium text-[#10B981]">Livre</span>
                          <span className="text-text-muted">{sLabel}–{eLabel}</span>
                        </div>
                      </div>
                    );
                  };

                  return free.map(([s,e], idx) => <FreeSlot key={`free-${court}-${idx}`} startM={s} endM={e} />);
                })()}
              </div>
            </div>
          ))}
          </div>
        </motion.div>
        )}
      </motion.div>
      <AddBookingModal />
    </>
  );
}

export default AgendaPage;