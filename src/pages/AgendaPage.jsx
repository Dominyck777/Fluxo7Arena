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
  // Debug toggle via localStorage: set localStorage.setItem('debug:agenda','1') to enable
  const debugOn = useMemo(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('debug:agenda') === '1'; } catch { return false; }
  }, []);
  const dbg = useCallback((...args) => { if (debugOn) { try { console.log('[AgendaDbg]', ...args); } catch {} } }, [debugOn]);
  // Console filter: keep console clean and show only the status summary line
  useEffect(() => {
    // If you need debugging again, comment out this whole block or adjust allowlist
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const shouldSuppress = (first) => {
      const s = String(first || '');
      return (
        s.startsWith('[AgendaDbg]') ||
        /* allow CustomerPicker diagnostics */ false ||
        s.startsWith('[PulseDump]') ||
        s.startsWith('[Clientes:load]') ||
        s.startsWith('[AgendaSettings]') ||
        s.startsWith('[Auto]') ||
        s.startsWith('🛡️ EditGuard')
      );
    };
    console.log = (...args) => {
      try { if (shouldSuppress(args[0])) return; } catch {}
      return origLog(...args);
    };
    console.warn = (...args) => {
      try { if (shouldSuppress(args[0])) return; } catch {}
      return origWarn(...args);
    };
    console.error = (...args) => {
      try { if (shouldSuppress(args[0])) return; } catch {}
      return origError(...args);
    };
    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    };
  }, []);
  // Pulse tracker: collect a short timeline of events to diagnose popover close pulses
  const pulseRef = useRef({ active: false, tag: '', start: 0, timer: null, events: [] });
  const pulseLog = useCallback((event, data) => {
    if (!debugOn) return;
    try {
      const now = Date.now();
      const rel = pulseRef.current && pulseRef.current.active ? (now - (pulseRef.current.start || now)) : 0;
      pulseRef.current.events.push({ t: now, ms: rel, event, data });
    } catch {}
  }, [debugOn]);
  const pulseDump = useCallback((reason) => {
    if (!debugOn) return;
    try {
      if (!pulseRef.current.active) return;
      const { tag, start, events } = pulseRef.current;
      const header = `[PulseDump] tag=${tag} dur=${Date.now()-start}ms reason=${reason}`;
      console.groupCollapsed(header);
      for (const e of events) {
        console.log(` +${String(e.ms).padStart(4,' ')}ms`, e.event, e.data || {});
      }
      console.groupEnd();
    } catch {}
    try { if (pulseRef.current.timer) clearTimeout(pulseRef.current.timer); } catch {}
    pulseRef.current = { active: false, tag: '', start: 0, timer: null, events: [] };
  }, [debugOn]);
  const pulseStart = useCallback((tag, timeoutMs = 5000) => {
    if (!debugOn) return;
    try { if (pulseRef.current.timer) clearTimeout(pulseRef.current.timer); } catch {}
    pulseRef.current = { active: true, tag, start: Date.now(), timer: null, events: [] };
    pulseRef.current.timer = setTimeout(() => pulseDump('timeout'), timeoutMs);
    dbg('PulseStart', { tag, timeoutMs });
  }, [debugOn, pulseDump, dbg]);
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
  // Evitar re-renders que fechem selects quando modal está aberto
  const modalOpenRef = useRef(false);
  useEffect(() => {
    modalOpenRef.current = isModalOpen;
    dbg('Modal state change:', { isModalOpen });
    pulseLog('modal', { open: isModalOpen });
  }, [isModalOpen, dbg]);
  // Debug instrumentation for Client picker popover
  const customerPickerIntentRef = useRef('init'); // 'open' | 'close' | 'outside' | 'escape' | 'focusOutside' | 'code'
  const customerPickerLastChangeAtRef = useRef(0);
  const customerPickerOpenRef = useRef(false);
  const suppressPickerCloseRef = useRef(0);
  const customerPickerDesiredOpenRef = useRef(false);
  const lastAutoReopenAtRef = useRef(0);
  const [effectiveCustomerPickerOpen, setEffectiveCustomerPickerOpen] = useState(false);
  // Forte: trava de seleção para impedir que efeitos concorrentes limpem a seleção logo após o fechamento do picker
  const selectionLockUntilRef = useRef(0);
  const pickerClosingRef = useRef(false);
  // Short-lived UI busy window (e.g., right after fetch/realtime) to avoid popover unintended close
  const uiBusyUntilRef = useRef(0);
  const setUiBusy = useCallback((ms = 800) => { uiBusyUntilRef.current = Date.now() + ms; dbg('UI:busy set', { ms }); }, [dbg]);
  const isUiBusy = useCallback(() => Date.now() < uiBusyUntilRef.current, []);
  // (moved) CustomerPicker state logging effect is added later, after isCustomerPickerOpen is declared

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
  // Janela de proteção extra para restaurar seleção se algum efeito concorrente limpar o array
  const restoreGuardUntilRef = useRef(0);
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
  // Offset de horário do servidor (Brasília) em relação ao relógio local do dispositivo, em ms
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  // Função utilitária para obter o "agora" corrigido por offset (Brasília)
  const getNowMs = useCallback(() => Date.now() + (Number.isFinite(serverOffsetMs) ? serverOffsetMs : 0), [serverOffsetMs]);
  // Debug/status: última sincronização bem-sucedida de horário
  const [lastTimeSyncAtMs, setLastTimeSyncAtMs] = useState(null);
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

  // Sincroniza periodicamente o horário de Brasília usando Supabase Edge Function (time-br)
  useEffect(() => {
    let active = true;
    let timer = null;
    let warnedOnce = false;
    const syncNow = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('time-br', { body: {} });
        if (!error && data && active) {
          const serverMs = Number(data.nowMs);
          if (Number.isFinite(serverMs)) {
            const offset = serverMs - Date.now();
            setServerOffsetMs(offset);
            setLastTimeSyncAtMs(Date.now());
            return;
          }
        }
        if (!warnedOnce) { warnedOnce = true; try { console.warn('[TimeSync] time-br sem dados válidos; usando relógio local.'); } catch {} }
      } catch (e) {
        if (!warnedOnce) { warnedOnce = true; try { console.warn('[TimeSync] time-br falhou; usando relógio local.'); } catch {} }
      }
    };
    // Sincroniza agora e depois a cada 5 minutos
    syncNow();
    timer = setInterval(syncNow, 5 * 60 * 1000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, []);

  

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

  // Proteção contra regressão por consistência eventual:
  // guarda mudanças locais recentes de status, para que um fetch logo em seguida não volte o status antigo
  const recentStatusUpdatesRef = useRef(new Map()); // id -> { status, ts }

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
        .eq('codigo_empresa', userProfile.codigo_empresa)
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
      try { recentStatusUpdatesRef.current.set(bookingId, { status: newStatus, ts: Date.now() }); } catch {}
      // Atualiza cache local (se existir)
      try {
        const cached = JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
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
  const nextAutoTimerRef = useRef(null);
  const runAutomationRef = useRef(null);
  const clearNextAutoTimer = useCallback(() => {
    try { if (nextAutoTimerRef.current) { clearTimeout(nextAutoTimerRef.current); nextAutoTimerRef.current = null; } } catch {}
  }, []);

  const scheduleNextAutomation = useCallback(() => {
    if (!authReady || !userProfile?.codigo_empresa) return;
    // Evita re-renders e timers enquanto o modal estiver aberto (melhora UX de selects)
    if (modalOpenRef.current) { dbg('scheduleNextAutomation:skipped (modal open)'); return; }
    pulseLog('auto:schedule');
    clearNextAutoTimer();
    const now = getNowMs();
    let nextTs = Infinity;
    const consider = (ts) => { if (Number.isFinite(ts) && ts > now && ts < nextTs) nextTs = ts; };
    try {
      for (const b of (bookings || [])) {
        if (!b || b.auto_disabled) continue;
        if (isOverriddenRecently(b.id)) continue;
        const startTs = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        const endTs = b.end instanceof Date ? b.end.getTime() : new Date(b.end).getTime();
        if (b.status === 'scheduled' && automation.autoConfirmEnabled) {
          const msBefore = Number(automation.autoConfirmMinutesBefore || 0) * 60000;
          consider(startTs - msBefore);
          if (automation.autoFinishEnabled) consider(endTs); // catch-up finish
        }
        if (b.status === 'confirmed') {
          if (automation.autoStartEnabled) consider(startTs);
          if (automation.autoFinishEnabled) consider(endTs);
        }
        if (b.status === 'in_progress' && automation.autoFinishEnabled) {
          consider(endTs);
        }
      }
    } catch {}
    if (nextTs !== Infinity) {
      const delay = Math.max(0, Math.min(nextTs - now + 250, 10 * 60 * 1000)); // pequeno buffer de 250ms
      try { console.debug('[Auto] next schedule in ms', delay); } catch {}
      try { setNextAutoAtMs(nextTs); } catch {}
      nextAutoTimerRef.current = setTimeout(() => { try { runAutomationRef.current && runAutomationRef.current(); } catch {} }, delay);
    }
  }, [authReady, userProfile?.codigo_empresa, bookings, automation, isOverriddenRecently, clearNextAutoTimer, getNowMs]);
  
  // Vigia ao clicar em editar: garante dados frescos antes de abrir o modal
  const ensureFreshOnEdit = useCallback(async (booking) => {
    try {
      // 1) Sincroniza horário se última sync tiver sido há mais de 10 minutos
      const needTimeSync = !(typeof lastTimeSyncAtMs === 'number' && (Date.now() - lastTimeSyncAtMs) < (10 * 60 * 1000));
      if (needTimeSync) {
        try {
          const { data } = await supabase.functions.invoke('time-br', { body: {} });
          const serverMs = Number(data?.nowMs);
          if (Number.isFinite(serverMs)) {
            setServerOffsetMs(serverMs - Date.now());
            setLastTimeSyncAtMs(Date.now());
          }
        } catch {}
      }
      // 2) Revalida Realtime/ticks (não bloqueante)
      try { scheduleNextAutomation(); } catch {}
      // 3) Busca a versão mais recente do agendamento no banco e atualiza estado local se necessário
      let updatedForReturn = null;
      if (booking?.id && userProfile?.codigo_empresa) {
        const { data: row } = await supabase
          .from('agendamentos')
          .select('id, inicio, fim, status, modalidade, quadra_id, cliente_id, auto_disabled')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .eq('id', booking.id)
          .single();
        if (row) {
          const mapped = {
            ...booking,
            start: new Date(row.inicio),
            end: new Date(row.fim),
            status: row.status || booking.status,
            modality: row.modalidade || booking.modality,
            auto_disabled: !!row.auto_disabled,
          };
          updatedForReturn = mapped;
          setBookings(prev => prev.map(b => b.id === booking.id ? mapped : b));
        }
      }
      // 4) Aplicar automação pontual neste agendamento (sem depender do ciclo global)
      try {
        const cand = updatedForReturn || booking;
        if (cand && cand.id) {
          const nowTs = getNowMs();
          const startTs = cand.start instanceof Date ? cand.start.getTime() : new Date(cand.start).getTime();
          const endTs = cand.end instanceof Date ? cand.end.getTime() : new Date(cand.end).getTime();
          const canAuto = !cand.auto_disabled && !isOverriddenRecently(cand.id);
          if (canAuto) {
            // Ordem: finalizar > iniciar > confirmar > catch-up finish
            if (cand.status === 'in_progress' && automation.autoFinishEnabled && Number.isFinite(endTs) && nowTs >= endTs) {
              await updateBookingStatus(cand.id, 'finished', 'automation');
            } else if (cand.status === 'confirmed' && automation.autoStartEnabled && Number.isFinite(startTs) && nowTs >= startTs) {
              await updateBookingStatus(cand.id, 'in_progress', 'automation');
            } else if (cand.status === 'scheduled' && automation.autoConfirmEnabled && Number.isFinite(startTs)) {
              const msBefore = Number(automation.autoConfirmMinutesBefore || 0) * 60000;
              if (nowTs >= (startTs - msBefore)) {
                await updateBookingStatus(cand.id, 'confirmed', 'automation');
              }
            } else if ((cand.status === 'scheduled' || cand.status === 'confirmed') && automation.autoFinishEnabled && Number.isFinite(endTs) && nowTs >= endTs) {
              await updateBookingStatus(cand.id, 'finished', 'automation');
            }
          }
        }
      } catch {}
      // 5) Opcional: roda automação global em background
      try { runAutomationRef.current && runAutomationRef.current(); } catch {}
      try { console.log('🛡️ EditGuard | ok | tempo=', (typeof lastTimeSyncAtMs==='number'?'Servidor':'Local')); } catch {}
      return { booking: updatedForReturn };
    } catch (e) {
      try { console.warn('🛡️ EditGuard | falha leve', e?.message || e); } catch {}
      return { booking: null };
    }
  }, [lastTimeSyncAtMs, supabase, userProfile, setBookings, scheduleNextAutomation, getNowMs, automation, isOverriddenRecently, updateBookingStatus]);
  const runAutomation = useCallback(async () => {
    if (!authReady || !userProfile?.codigo_empresa) return;
    // Pausa automação enquanto o modal estiver aberto para reduzir "pulsos" na UI
    if (modalOpenRef.current) { dbg('runAutomation:skipped (modal open)'); return; }
    if (automationRunningRef.current) return;
    automationRunningRef.current = true;
    try {
      try { console.debug('[Auto] tick'); } catch {}
      pulseLog('auto:tick');
      const nowTs = getNowMs();
      const now = new Date(nowTs);
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

      let anyChange = false;
      for (const b of candidates) {
        if (b.auto_disabled) continue; // desligado
        if (isOverriddenRecently(b.id)) continue; // override manual
        const startTs = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        const endTs = b.end instanceof Date ? b.end.getTime() : new Date(b.end).getTime();

        // Ordem: finalizar > iniciar > confirmar
        if (b.status === 'in_progress' && automation.autoFinishEnabled) {
          if (nowTs >= endTs) { try { console.debug('[Auto] finish', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'finished', 'automation'); anyChange = true; continue; }
        }
        if (b.status === 'confirmed' && automation.autoStartEnabled) {
          if (nowTs >= startTs) { try { console.debug('[Auto] start', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'in_progress', 'automation'); anyChange = true; continue; }
        }
        if (b.status === 'scheduled' && automation.autoConfirmEnabled) {
          const msBefore = Number(automation.autoConfirmMinutesBefore || 0) * 60000;
          if (nowTs >= (startTs - msBefore)) { try { console.debug('[Auto] confirm', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'confirmed', 'automation'); anyChange = true; continue; }
        }
        // Catch-up: se ficou agendado/confirmado e já passou do fim, finalize direto
        if ((b.status === 'scheduled' || b.status === 'confirmed') && automation.autoFinishEnabled) {
          if (nowTs >= endTs) { try { console.debug('[Auto] catchup-finish', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'finished', 'automation'); anyChange = true; continue; }
        }
      }
      // Se houve mudanças por automação, sincroniza lista com backend para refletir imediatamente
      if (anyChange) {
        // pequeno atraso para dar tempo de propagação no banco antes do re-carregamento
        try {
          setTimeout(() => { try { fetchBookings(); } catch {} }, 800);
        } catch {}
      }
      // Sempre reagenda próximo tick preciso após calcular os candidatos
      try { scheduleNextAutomation(); } catch {}
    } finally {
      automationRunningRef.current = false;
    }
  }, [authReady, userProfile?.codigo_empresa, bookings, automation, updateBookingStatus, isOverriddenRecently, scheduleNextAutomation, getNowMs]);

  // Keep a callable reference to avoid TDZ issues when scheduling before runAutomation is initialized
  useEffect(() => {
    runAutomationRef.current = runAutomation;
  }, [runAutomation]);
  useEffect(() => {
    const id = setInterval(runAutomation, 10000);
    try { runAutomationRef.current && runAutomationRef.current(); } catch {}
    try { scheduleNextAutomation(); } catch {}
    return () => clearInterval(id);
  }, [runAutomation]);

  // Watchdog: a cada 30 minutos força uma reavaliação completa se automação estiver ligada
  useEffect(() => {
    const watchdog = setInterval(() => {
      try {
        const enabled = !!(automation?.autoConfirmEnabled || automation?.autoStartEnabled || automation?.autoFinishEnabled);
        if (!enabled) return;
        if (runAutomationRef.current) {
          console.debug('[Auto][Watchdog] forcing periodic automation run');
          runAutomationRef.current();
        }
      } catch {}
    }, 30 * 60 * 1000);
    return () => clearInterval(watchdog);
  }, [automation]);

  


  // Hidrata agendamentos a partir do cache antes da busca (simplificado)
  useEffect(() => {
    if (!bookingsCacheKey) return;
    try {
      const cached = JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        const mapped = cached.map((b) => ({ ...b, start: new Date(b.start), end: new Date(b.end) }));
        dbg('cache:bookings:hydrate', { count: mapped.length });
        pulseLog('cache:hydrate', { count: mapped.length });
        setBookings((prev) => (prev && prev.length > 0 ? prev : mapped));
        setUiBusy(1200);
      }
    } catch {}
  }, [bookingsCacheKey, dbg]);

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
        // Ao voltar, roda automação e recarrega dados frescos do backend
        try { runAutomationRef.current && runAutomationRef.current(); } catch {}
        try { fetchBookings(); } catch {}
        try { scheduleNextAutomation(); } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisOrFocus);
    window.addEventListener('focus', onVisOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisOrFocus);
      window.removeEventListener('focus', onVisOrFocus);
    };
  }, [bookingsCacheKey]);

  // Reagendar quando lista de bookings ou regras mudarem
  useEffect(() => {
    try { scheduleNextAutomation(); } catch {}
    return () => { try { clearNextAutoTimer(); } catch {} };
  }, [bookings, automation, scheduleNextAutomation, clearNextAutoTimer]);

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

  // Carrega agendamentos do dia atual a partir do banco (extraído para useCallback para reuso)
  const fetchBookings = useCallback(async () => {
    if (!authReady || !userProfile?.codigo_empresa) return;
    dbg('fetchBookings:start', { date: format(currentDate, 'yyyy-MM-dd'), empresa: userProfile?.codigo_empresa });
    pulseLog('fetch:start', { day: format(currentDate, 'yyyy-MM-dd') });
    const dayStart = startOfDay(currentDate);
    const dayEnd = addDays(dayStart, 1);
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        id, codigo, codigo_empresa, quadra_id, cliente_id, clientes, inicio, fim, modalidade, status, auto_disabled,
        quadra:quadra_id ( nome ),
        cliente:cliente_id ( nome )
      `)
      .eq('codigo_empresa', userProfile.codigo_empresa)
      .gte('inicio', dayStart.toISOString())
      .lt('inicio', dayEnd.toISOString())
      .order('inicio', { ascending: true });
    if (error) {
      dbg('fetchBookings:error', { message: error?.message, code: error?.code, status: error?.status });
      pulseLog('fetch:error', { message: error?.message, code: error?.code, status: error?.status });
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
      dbg('fetchBookings:empty-first-hit');
       pulseLog('fetch:empty-first');
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
    const nowTs = Date.now();
    const mapped = (data || []).map(row => {
      const start = new Date(row.inicio);
      const end = new Date(row.fim);
      // Nome da quadra
      const courtName = row.quadra?.[0]?.nome || row.quadra?.nome || Object.values(courtsMap).find(c => c.id === row.quadra_id)?.nome || '';
      // Nome do cliente: usar apenas o cliente relacionado real; não usar fallback do array "clientes"
      const customerName = (row.cliente?.[0]?.nome || row.cliente?.nome || '');
      // Proteção: se mudamos localmente há pouco, preferir o status local por alguns segundos para evitar regressão visual
      const recent = recentStatusUpdatesRef.current.get(row.id);
      const preferLocal = recent && (nowTs - recent.ts) < 4000; // 4s de janela
      return {
        id: row.id,
        code: row.codigo,
        court: courtName,
        customer: customerName,
        start,
        end,
        status: preferLocal ? recent.status : (row.status || 'scheduled'),
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
  }, [authReady, userProfile?.codigo_empresa, currentDate, courtsMap, bookingsCacheKey, toast, dbg, debugOn]);

  // Log watcher: whenever bookings changes (after set), log a compact summary
  useEffect(() => {
    if (!debugOn) return;
    try {
      const summary = (bookings || []).map(b => `${b.id}:${format(b.start, 'HH:mm')}-${format(b.end, 'HH:mm')}:${b.status}`).join(' | ');
      console.log('[AgendaDbg] bookings:changed', { count: Array.isArray(bookings) ? bookings.length : 0, summary });
    } catch {}
  }, [bookings, debugOn]);
  // After bookings change, suppress picker auto-close for a short window
  useEffect(() => {
    try {
      const until = Date.now() + 1800;
      suppressPickerCloseRef.current = until;
      dbg('Picker:suppressClose window set', { until });
    } catch {}
  }, [bookings]);

  useEffect(() => {
    if (authReady && userProfile?.codigo_empresa) {
      fetchBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userProfile?.codigo_empresa, currentDate, courtsMap, bookingsCacheKey]);

  // Realtime: escuta mudanças em 'agendamentos' para a empresa atual e atualiza a lista sem reload
  const realtimeDebounceRef = useRef(null);
  const [realtimeStatus, setRealtimeStatus] = useState('idle');
  const [lastRealtimeEventAtMs, setLastRealtimeEventAtMs] = useState(null);
  // Se o modal estiver aberto, acumula uma atualização pendente para executar após o fechamento
  const pendingRealtimeRefreshRef = useRef(false);
  useEffect(() => {
    if (!authReady || !userProfile?.codigo_empresa) return;
    const dayStart = startOfDay(currentDate);
    const dayEnd = addDays(dayStart, 1);
    const inCurrentDay = (iso) => {
      try {
        const d = new Date(iso);
        return d >= dayStart && d < dayEnd;
      } catch { return false; }
    };
    const onChange = (payload) => {
      const row = payload?.new || payload?.old;
      if (!row) return;
      if (row.codigo_empresa !== userProfile.codigo_empresa) return;
      // Apenas reagir a registros do dia visível para evitar recargas desnecessárias
      if (!(inCurrentDay(row.inicio) || inCurrentDay(row.fim))) return;
      try { console.debug('[Realtime] agendamentos change', { event: payload.eventType, id: row.id }); } catch {}
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      try { setLastRealtimeEventAtMs(Date.now()); } catch {}
      // Se o modal está aberto, adiar refresh para não fechar selects dentro do modal
      if (modalOpenRef.current) {
        dbg('Realtime:onChange deferred due to modal open');
        pendingRealtimeRefreshRef.current = true;
        pulseLog('rt:change:deferred', { id: row.id, event: payload.eventType });
        return;
      }
      dbg('Realtime:onChange scheduling fetchBookings');
      pulseLog('rt:change', { id: row.id, event: payload.eventType });
      realtimeDebounceRef.current = setTimeout(() => {
        try { dbg('Realtime:debounced fetchBookings fire'); pulseLog('rt:debounced:fire'); setUiBusy(1200); fetchBookings(); } catch {}
      }, 400);
    };
    const channel = supabase
      .channel(`agendamentos:${userProfile.codigo_empresa}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `codigo_empresa=eq.${userProfile.codigo_empresa}` }, onChange)
      .subscribe((status) => { try { console.debug('[Realtime] channel status', status); } catch {}; try { setRealtimeStatus(String(status || 'unknown')); } catch {} });
    return () => {
      try { if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current); } catch {}
      try { supabase.removeChannel(channel); } catch {}
      try { setRealtimeStatus('unsubscribed'); } catch {}
    };
  }, [authReady, userProfile?.codigo_empresa, currentDate, fetchBookings]);

  // Ao fechar o modal, se houver refresh pendente devido a eventos realtime, executa agora
  useEffect(() => {
    if (!isModalOpen && pendingRealtimeRefreshRef.current) {
      pendingRealtimeRefreshRef.current = false;
      try { dbg('Modal closed: flushing pending realtime refresh'); pulseLog('rt:flushAfterModalClose'); fetchBookings(); } catch {}
    }
  }, [isModalOpen, fetchBookings, dbg]);

  // Próximo tick de automação (para debug)
  const [nextAutoAtMs, setNextAutoAtMs] = useState(null);
  // Evita logs repetidos no console
  const lastConnLineRef = useRef('');

  // Console fixo simples de status (conexão) ao entrar na Agenda e quando algo chave mudar
  useEffect(() => {
    try {
      const usingServer = typeof lastTimeSyncAtMs === 'number' && (Date.now() - lastTimeSyncAtMs) < (10 * 60 * 1000);
      const fmtHms = (ms) => (typeof ms === 'number' ? format(new Date(ms), 'HH:mm:ss', { locale: ptBR }) : '—');
      const fmtHm = (ms) => (typeof ms === 'number' ? format(new Date(ms), 'HH:mm', { locale: ptBR }) : '—');
      const timeEmoji = usingServer ? '🕒🇧🇷' : '🖥️';
      const rtOk = String(realtimeStatus).toUpperCase() === 'SUBSCRIBED';
      const rtEmoji = rtOk ? '✅' : '⚠️';
      const nextEmoji = typeof nextAutoAtMs === 'number' ? '⏭️' : '⏸️';
      const count = Array.isArray(bookings) ? bookings.length : 0;
      const line = `📊 Agenda | ${timeEmoji} Tempo=${usingServer ? 'Servidor' : 'Local'} (Δ${Math.round(serverOffsetMs)}ms, sync ${fmtHms(lastTimeSyncAtMs)}) | 🔌 Realtime=${rtEmoji} ${realtimeStatus}${lastRealtimeEventAtMs ? ` (${fmtHms(lastRealtimeEventAtMs)})` : ''} | ${nextEmoji} Próximo=${fmtHm(nextAutoAtMs)} | 📦 Agendamentos=${count}`;
      if (lastConnLineRef.current !== line) {
        lastConnLineRef.current = line;
        console.log(line);
      }
      if (typeof window !== 'undefined') {
        window.__AgendaConn = { usingServer, serverOffsetMs, lastTimeSyncAtMs, realtimeStatus, lastRealtimeEventAtMs, nextAutoAtMs };
      }
    } catch {}
  }, [serverOffsetMs, lastTimeSyncAtMs, realtimeStatus, lastRealtimeEventAtMs, automation, nextAutoAtMs, userProfile?.codigo_empresa, currentDate, Array.isArray(bookings) ? bookings.length : 0]);

  // Reconciliador: a cada 5 minutos, se o Realtime estiver parado por muito tempo
  // ou se o próximo tick já deveria ter ocorrido, força um fetchBookings e reprograma automação
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const now = Date.now();
        const rtOk = String(realtimeStatus || '').toUpperCase() === 'SUBSCRIBED';
        const lastEvtAge = typeof lastRealtimeEventAtMs === 'number' ? (now - lastRealtimeEventAtMs) : Infinity;
        const realtimeStale = !rtOk || lastEvtAge > (7 * 60 * 1000); // 7 min sem evento
        const tickDue = typeof nextAutoAtMs === 'number' ? (now > (nextAutoAtMs + 60 * 1000)) : false; // 1 min de tolerância
        if (realtimeStale || tickDue) {
          console.debug('[Reconcile] forcing fetchBookings (stale=', realtimeStale, ' tickDue=', tickDue, ')');
          fetchBookings();
          try { scheduleNextAutomation(); } catch {}
        }
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [realtimeStatus, lastRealtimeEventAtMs, nextAutoAtMs, fetchBookings, scheduleNextAutomation]);

  // Carrega participantes para os agendamentos listados (batch por dia)
  useEffect(() => {
    const loadParticipants = async () => {
      if (!authReady || !userProfile?.codigo_empresa) return;
      // Evitar re-renders do modal enquanto o usuário está interagindo com selects
      if (modalOpenRef.current) { dbg('Participants:skipped (modal open)'); return; }
      dbg('Participants:load start'); pulseLog('parts:start');
      const ids = (bookings || []).map(b => b.id).filter(Boolean);
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      // Evita wipe em estados transitórios de carregamento de bookings
      if (!ids.length) {
        if (lastParticipantsDateKeyRef.current !== dateKey) {
          setParticipantsByAgendamento({});
          try { if (participantsCacheKey) localStorage.setItem(participantsCacheKey, '{}'); } catch {}
          lastParticipantsDateKeyRef.current = dateKey;
        }
        dbg('Participants:skip empty ids'); pulseLog('parts:skip');
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
        dbg('Participants:error', { message: error?.message, code: error?.code, status: error?.status }); pulseLog('parts:error', { code: error?.code });
        return; // mantém estado anterior
      }
      const map = {};
      for (const row of (data || [])) {
        const k = row.agendamento_id;
        if (!map[k]) map[k] = [];
        map[k].push(row);
      }
      dbg('Participants:loaded', { bookings: ids.length, rows: (data || []).length }); pulseLog('parts:loaded', { rows: (data||[]).length });
      lastParticipantsDateKeyRef.current = dateKey;
      // Atualiza apenas os IDs consultados, preservando outros e persiste em cache
      setParticipantsByAgendamento(prev => {
        const next = { ...prev };
        for (const id of ids) {
          next[id] = map[id] || [];
        }
        try { if (participantsCacheKey) localStorage.setItem(participantsCacheKey, JSON.stringify(next)); } catch {}
        dbg('Participants:set state for ids', { ids }); pulseLog('parts:set', { idsCount: ids.length });
        return next;
      });
    };
    loadParticipants();
  }, [authReady, userProfile?.codigo_empresa, bookings, currentDate, participantsCacheKey, dbg]);

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

    // Escalonamento proporcional (>= 90min): já aumentar em 90min
    const isLong = durationMin >= 90;
    const maxScale = 2;
    const minScaleAt90 = 1.15; // 90min já fica maior
    const scale = isLong
      ? (() => {
          const t = Math.min(Math.max((durationMin - 90) / 90, 0), 1); // 0 em 90min, 1 em 180min
          return Math.min(minScaleAt90 + t * (maxScale - minScaleAt90), maxScale);
        })()
      : 1;
    // Tamanhos base aproximados
    const nameBasePx = 16; // text-base
    const smallBasePx = 14; // text-sm
    const timeBasePx = isHalfHour ? 14 : 16;
    const iconBasePx = isHalfHour ? 16 : 24;
    const namePx = Math.round(nameBasePx * (isLong ? scale : 1));
    const smallPx = Math.round(smallBasePx * (isLong ? scale : 1));
    const timePx = Math.round(timeBasePx * (isLong ? scale : 1));
    const iconPx = Math.round(iconBasePx * (isLong ? scale : 1));
    // Padding cresce levemente
    const basePadX = isHalfHour ? 12 : 16;
    const basePadY = isHalfHour ? 12 : 16;
    const padScale = isLong ? Math.min(scale, 1.3) : 1;
    const padX = Math.round(basePadX * padScale);
    const padY = Math.round(basePadY * padScale);

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
        onClick={async () => {
          // Executa o vigia com pequena janela de até 600ms; não bloqueia por muito tempo a UX
          const guard = ensureFreshOnEdit(booking);
          const timeout = new Promise((resolve) => setTimeout(resolve, 600));
          let result = null;
          try { result = await Promise.race([guard, timeout]); } catch {}
          // Prefira o booking atualizado retornado; senão busque do estado; fallback para o original
          const picked = (result && result.booking) || (bookings.find(b => b.id === booking.id) || booking);
          setEditingBooking(picked);
          openBookingModal();
        }}
      >
        {/* Acento de status à esquerda */}
        <div className={cn("absolute left-0 top-0 h-full w-[6px] rounded-l-md", config.accent)} />

        {/* Conteúdo (centralizado verticalmente) */}
        <div
          className={cn("h-full flex", isHalfHour ? "px-3 py-3" : "px-4 py-4")}
          style={{ paddingLeft: padX, paddingRight: padX, paddingTop: padY, paddingBottom: padY }}
        >
          <div className="flex-1 flex flex-col justify-center">
            <div className={cn("flex justify-between gap-2", isHalfHour ? "items-center" : "items-start") }>
              {/* Esquerda: cliente e, em meia hora, modalidade à direita do nome */}
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-text-primary truncate text-base" style={{ fontSize: namePx, lineHeight: 1.15 }}>{shortName(booking.customer)}</p>
                {isHalfHour && (
                  <span className="text-sm font-medium text-text-secondary truncate bg-white/5 border border-white/10 rounded px-2.5 py-0 whitespace-nowrap" style={{ fontSize: smallPx }}>
                    {booking.modality}
                  </span>
                )}
              </div>
              <div className={cn("flex items-center gap-2", isHalfHour ? "whitespace-nowrap shrink-0" : "flex-col items-end") }>
                <span className={cn("text-text-muted whitespace-nowrap", isHalfHour ? "text-sm" : "text-base") } style={{ fontSize: timePx }}>
                  {format(booking.start, 'HH:mm')}–{format(booking.end, 'HH:mm')}
                </span>
                {isHalfHour ? (
                  <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <Icon className={cn(config.text)} style={{ width: iconPx, height: iconPx }} />
                    <span className={cn("truncate", config.text, "text-xs")} style={{ fontSize: Math.max(12, Math.round(12 * (isLong ? scale : 1))) }}>{config.label}</span>
                  </div>
                ) : null}
                {/* Indicador de pagamento de participantes (pago/total) — em layout meia hora fica ao lado do status (à direita) */}
                {isHalfHour && totalParticipants > 0 && (
                  <span className={`text-sm font-semibold rounded-full px-2.5 py-1 border ${paidCount === totalParticipants ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' : 'text-amber-300 bg-amber-500/10 border-amber-400/30'}`} style={{ fontSize: Math.max(13, Math.round(13 * (isLong ? scale : 1))) }}>
                    {paidCount}/{totalParticipants} pagos
                  </span>
                )}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              {!isHalfHour && (
                <span className="text-sm font-medium text-text-secondary truncate bg-white/5 border border-white/10 rounded px-2.5 py-0.5" style={{ fontSize: smallPx }}>
                  {booking.modality}
                </span>
              )}
              {!isHalfHour && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn(config.text)} style={{ width: iconPx, height: iconPx }} />
                    <span className={cn("truncate", config.text)} style={{ fontSize: smallPx }}>{config.label}</span>
                  </div>
                  {/* Chip de pagamentos ao lado direito do status */}
                  {totalParticipants > 0 && (
                    <span className={`text-sm font-semibold rounded-full px-2.5 py-1 border ${paidCount === totalParticipants ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' : 'text-amber-300 bg-amber-500/10 border-amber-400/30'}`} style={{ fontSize: Math.max(13, Math.round(13 * (isLong ? scale : 1))) }}>
                      {paidCount}/{totalParticipants} pagos
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
  
  const AddBookingModal = () => {
    // ==== DIAGNOSTICS: lifecycle/mount tracking (logs removed) ====
    const mountIdRef = useRef(Math.random().toString(36).slice(2));
    // Janela dura para impedir quaisquer clears logo após concluir o picker
    const preventClearsUntilRef = useRef(0);
    // Modal session: id para escopar restauração à MESMA abertura do modal
    const modalSessionIdRef = useRef('');
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

    const [form, setForm] = useState(() => {
      // Hidratar seleção logo no primeiro render se estiver dentro da janela pós-concluir
      let initialSelected = [];
      try {
        const closingAtRaw = sessionStorage.getItem('agenda:customerPicker:closingAt');
        const closingAt = closingAtRaw ? Number(closingAtRaw) : 0;
        const within = closingAt && (Date.now() - closingAt < 10000);
        const rawSel = sessionStorage.getItem(persistLastKey);
        const persisted = rawSel ? JSON.parse(rawSel) : [];
        if (within && Array.isArray(persisted) && persisted.length > 0) {
          initialSelected = persisted;
        } else if (Array.isArray(chipsSnapshot) && chipsSnapshot.length > 0) {
          initialSelected = chipsSnapshot;
        } else if (Array.isArray(lastNonEmptySelectionRef.current) && lastNonEmptySelectionRef.current.length > 0) {
          initialSelected = lastNonEmptySelectionRef.current;
        }
        if (initialSelected.length > 0) {
          try { userSelectedOnceRef.current = true; } catch {}
        }
      } catch {}
      return {
        selectedClients: initialSelected, // [{id, nome, codigo?}]
        court: availableCourts[0] || '',
        modality: modalities[0],
        status: 'scheduled',
        date: currentDate,
        startMinutes: nearestSlot(),
        endMinutes: nearestSlot() + 60,
      };
    });
    // Always-current ref for selected clients to avoid stale closure during quick save after conclude
    const selectedClientsRef = useRef([]);
    // Track if the user has already selected any clients in this modal open cycle
    const userSelectedOnceRef = useRef(false);
    // Guarda o primeiro cliente selecionado nesta abertura do modal (para compor o rótulo corretamente)
    const firstSelectedIdRef = useRef(null);
    useEffect(() => {
      selectedClientsRef.current = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      try { if ((selectedClientsRef.current || []).length > 0) userSelectedOnceRef.current = true; } catch {}
    }, [form.selectedClients]);
    const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    // Track transitions of selectedClients length (moved after picker state declarations to avoid TDZ)
    const prevSelLenRef = useRef(0);
    useEffect(() => {
      const cur = Array.isArray(form.selectedClients) ? form.selectedClients.length : -1;
      const prev = prevSelLenRef.current;
      if (cur !== prev) {
        try {
          console.warn('[CustomerPicker][SEL:transition]', { id: mountIdRef.current, prev, cur, pickerOpen: isCustomerPickerOpen, effectiveOpen: effectiveCustomerPickerOpen, ts: new Date().toISOString() });
          if (prev > 0 && cur === 0) {
            console.warn('[CustomerPicker][SEL:became-empty]', { id: mountIdRef.current, reasonHint: lastSelActionRef?.current, clearedByUser: !!clearedByUserRef?.current });
            if (debugOn && typeof console.trace === 'function') console.trace('[CustomerPicker][TRACE] selection became empty');
          }
        } catch {}
        prevSelLenRef.current = cur;
      }
    }, [form.selectedClients, isCustomerPickerOpen, effectiveCustomerPickerOpen]);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [clientForModal, setClientForModal] = useState(null);
    // Destaque sutil no trigger ao fechar por clique fora
    const [highlightCustomerTrigger, setHighlightCustomerTrigger] = useState(false);
    const closedByOutsideRef = useRef(false);
    // Guarda a última seleção não vazia para proteção contra limpezas indevidas
    const lastNonEmptySelectionRef = useRef([]);
    // Track last action that changed selectedClients (for diagnostics)
    const lastSelActionRef = useRef('init');
    const persistLastKey = useMemo(() => {
      try {
        const emp = userProfile?.codigo_empresa || 'no-company';
        return `agenda:lastSelection:${emp}`;
      } catch { return 'agenda:lastSelection:no-company'; }
    }, [userProfile?.codigo_empresa]);
    const persistLastNonEmpty = useCallback((arr) => {
      try { sessionStorage.setItem(persistLastKey, JSON.stringify(arr || [])); } catch {}
    }, [persistLastKey]);
    const hydrateLastNonEmpty = useCallback(() => {
      try {
        const raw = sessionStorage.getItem(persistLastKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            lastNonEmptySelectionRef.current = parsed;
          }
        }
      } catch {}
    }, [persistLastKey]);
    // Marca se o usuário limpou intencionalmente todas as seleções durante o picker
    const clearedByUserRef = useRef(false);
    // Snapshot da seleção para manter os chips estáveis mesmo entre re-renders/efeitos concorrentes
    const [chipsSnapshot, setChipsSnapshot] = useState([]);
    // Setter com log para chipsSnapshot (declarado após o state para evitar referências indefinidas)
    const setChipsSnapshotSafe = useCallback((arr) => {
      try {
        console.warn('[CustomerPicker][chips:set]', { ts: new Date().toISOString(), len: Array.isArray(arr) ? arr.length : NaN });
      } catch {}
      setChipsSnapshot(arr);
    }, []);
    // Ref para o input de busca (para focar após limpar)
    const customerQueryInputRef = useRef(null);
    // Participantes (apenas no modo edição): { cliente_id, nome, valor_cota, status_pagamento }
    const [participantsForm, setParticipantsForm] = useState([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [clientsLoading, setClientsLoading] = useState(false);
    // Saving flags
    const [isSavingPayments, setIsSavingPayments] = useState(false);
    const [isSavingBooking, setIsSavingBooking] = useState(false);
    // Helper: aplica atualização de selectedClients com proteção contra esvaziamento indevido
    const applySelectedClients = useCallback((reason, nextArr) => {
      try {
        const now = Date.now();
        const guardActive = now < (restoreGuardUntilRef.current || 0) || now < (suppressPickerCloseRef.current || 0);
        const pickerClosed = !effectiveCustomerPickerOpen;
        const cleared = !!clearedByUserRef.current;
        let finalArr = Array.isArray(nextArr) ? nextArr : [];
        if (finalArr.length === 0 && pickerClosed && guardActive && !cleared) {
          const fallback = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
          if (fallback.length > 0) {
            console.warn('[CustomerPicker][BLOCK:empty-set]', { ts: new Date().toISOString(), reason, guardUntil: Math.max(restoreGuardUntilRef.current||0, suppressPickerCloseRef.current||0), fallbackLen: fallback.length });
            finalArr = fallback;
          }
        }
        // Reordenar para manter o primeiro cliente realmente escolhido na 1ª posição em NOVO agendamento
        try {
          if (!editingBooking && Array.isArray(finalArr) && finalArr.length > 0 && firstSelectedIdRef.current) {
            const idx = finalArr.findIndex(c => c && c.id === firstSelectedIdRef.current);
            if (idx > 0) {
              const primary = finalArr[idx];
              finalArr = [primary, ...finalArr.filter((_, i) => i !== idx)];
            }
          }
        } catch {}
        // Detailed decision log
        try {
          console.warn('[CustomerPicker][applySelectedClients]', {
            id: mountIdRef.current,
            reason,
            nextLen: Array.isArray(nextArr) ? nextArr.length : -1,
            finalLen: Array.isArray(finalArr) ? finalArr.length : -1,
            pickerClosed,
            guardActive,
            clearedByUser: !!clearedByUserRef.current,
            desiredOpen: !!customerPickerDesiredOpenRef.current,
          });
        } catch {}
        setForm((f) => ({ ...f, selectedClients: finalArr }));
        if (Array.isArray(finalArr) && finalArr.length > 0) {
          lastNonEmptySelectionRef.current = finalArr;
          setChipsSnapshotSafe(finalArr);
          try { sessionStorage.setItem(persistLastKey, JSON.stringify(finalArr)); } catch {}
          clearedByUserRef.current = false;
        }
        try { lastSelActionRef.current = reason; } catch {}
      } catch (e) {
        try { console.warn('[CustomerPicker][applySelectedClients:error]', e?.message || e); } catch {}
      }
    }, [effectiveCustomerPickerOpen, setForm, setChipsSnapshotSafe, persistLastKey]);
    // Pagamentos: busca por participante
    const [paymentSearch, setPaymentSearch] = useState('');
    const paymentSearchRef = useRef(null);
    // (console cleaned) Removed general CustomerPicker state logging to reduce noise
    useEffect(() => {
      try { customerPickerLastChangeAtRef.current = Date.now(); } catch {}
    }, [isCustomerPickerOpen, clientsLoading]);
    // Start/End pulse timeline around the Customer Picker lifecycle
    useEffect(() => {
      if (!debugOn) return;
      customerPickerOpenRef.current = isCustomerPickerOpen;
      if (isCustomerPickerOpen) {
        pulseStart('customer-picker', 6000);
        pulseLog('picker:open');
        customerPickerDesiredOpenRef.current = true;
        setEffectiveCustomerPickerOpen(true);
      } else {
        pulseLog('picker:close');
        pulseDump('picker-close');
        // Se havia refresh pendente (por termos adiado durante o picker), executar agora
        if (pendingRealtimeRefreshRef.current) {
          pendingRealtimeRefreshRef.current = false;
          try { dbg('Picker closed: flushing pending refresh'); pulseLog('picker:flush'); fetchBookings(); } catch {}
        }
        // Não baixar effectiveOpen aqui; só baixamos em fechamento explícito
      }
    }, [isCustomerPickerOpen]);

    // Diagnostic logger for Customer Picker behaviour
    const pickerLog = useCallback((event, extra = {}) => {
      if (!debugOn) return;
      try {
        const ts = new Date().toISOString();
        const intent = customerPickerIntentRef.current;
        const desired = !!customerPickerDesiredOpenRef.current;
        const closedByOutside = !!closedByOutsideRef.current;
        console.groupCollapsed(`[CustomerPicker] ${event} @ ${ts}`);
        console.log('state', {
          isModalOpen,
          isCustomerPickerOpen,
          effectiveCustomerPickerOpen,
          clientsLoading,
          isClientFormOpen,
          intent,
          desired,
          closedByOutside,
        });
        try {
          console.log('focus', {
            activeTag: document?.activeElement?.tagName,
            activeClasses: document?.activeElement?.className,
          });
        } catch {}
        if (extra && Object.keys(extra).length) console.log('extra', extra);
        console.groupEnd();
      } catch {}
    }, [debugOn, isModalOpen, isCustomerPickerOpen, effectiveCustomerPickerOpen, clientsLoading, isClientFormOpen]);

    // Log when internal open states change (post-render perspective)
    useEffect(() => {
      if (!debugOn) return;
      pickerLog('state-change', { isCustomerPickerOpen, effectiveCustomerPickerOpen });
    }, [debugOn, isCustomerPickerOpen, effectiveCustomerPickerOpen]);

    // Log whenever selectedClients length changes (diagnostics)
    useEffect(() => {
      try {
        const len = Array.isArray(form.selectedClients) ? form.selectedClients.length : -1;
        console.log('[CustomerPicker][selectedClients.len]', len, '| lastAction=', lastSelActionRef.current);
      } catch {}
    }, [form.selectedClients]);

    // Global restoration when picker is closed and selection becomes empty unintentionally
    useEffect(() => {
      if (!isModalOpen) return;
      if (effectiveCustomerPickerOpen) return; // only enforce when picker is closed
      const cur = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
      const lockActive = Date.now() < (selectionLockUntilRef.current || 0);
      if (cur.length === 0 && last.length > 0 && (!clearedByUserRef.current || lockActive)) {
        lastSelActionRef.current = 'global:restore';
        setForm((f) => ({ ...f, selectedClients: last }));
        try { console.warn('[CustomerPicker][GLOBAL:restore]', { id: mountIdRef.current, lastLen: last.length, lockActive }); } catch {}
      }
    }, [isModalOpen, effectiveCustomerPickerOpen, form.selectedClients]);

    // Watchdog: se o picker fechou sem intenção explícita e o usuário deseja mantê-lo aberto, reabre automaticamente
    useEffect(() => {
      if (!isModalOpen) return;
      // Persisted desire in localStorage (survive remounts)
      let desired = customerPickerDesiredOpenRef.current;
      try {
        const v = localStorage.getItem('agenda:customerPicker:desiredAt');
        if (v) {
          const ts = Number(v);
          if (Number.isFinite(ts) && Date.now() - ts < 3000) desired = true;
        }
      } catch {}
      if (!desired) return; // usuário não deseja aberto
      if (isCustomerPickerOpen) return; // já aberto
      // Não tentar reabrir durante busy/supressão
      if (Date.now() < suppressPickerCloseRef.current || isUiBusy()) return;
      // Debounce reabertura para evitar loops
      const now = Date.now();
      if (now - lastAutoReopenAtRef.current < 800) return;
      lastAutoReopenAtRef.current = now;
      /* console cleaned: removed auto-reopen debug */
      customerPickerIntentRef.current = 'open';
      setIsCustomerPickerOpen(true);
      setEffectiveCustomerPickerOpen(true);
    }, [isCustomerPickerOpen, isModalOpen]);

    // Mantém a última seleção não vazia em memória
    useEffect(() => {
      const arr = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      if (arr.length > 0) {
        lastNonEmptySelectionRef.current = arr;
        persistLastNonEmpty(arr);
        setChipsSnapshotSafe(arr);
      }
    }, [form.selectedClients, persistLastNonEmpty]);

    // Ao fechar o picker, se a seleção ficou vazia de forma inesperada, restaura
    useEffect(() => {
      if (!isModalOpen) return;
      // hydrate last non-empty selection from sessionStorage on open
      hydrateLastNonEmpty();
      if (effectiveCustomerPickerOpen) return;
      // Apenas considera restauração quando o usuário não deseja o picker aberto
      if (customerPickerDesiredOpenRef.current) return;
      const arr = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      const last = (() => {
        const mem = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
        if (mem && mem.length > 0) return mem;
        try {
          const raw = sessionStorage.getItem(persistLastKey);
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      })();
      if (arr.length === 0 && last.length > 0 && !clearedByUserRef.current) {
        // Restaura de forma silenciosa; evita perder seleção feita pelo usuário
        setForm(f => ({ ...f, selectedClients: last }));
        // Limpa o flag de clique fora para não reentrar
        closedByOutsideRef.current = false;
      }
    }, [effectiveCustomerPickerOpen, isModalOpen, hydrateLastNonEmpty, persistLastKey]);

    // Diagnostics: log any change to selectedClients and attempt delayed restore if it becomes empty unexpectedly
    const lastLoggedAtRef = useRef(0);
    useEffect(() => {
      try {
        const now = Date.now();
        const cur = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
        const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
        if (now - lastLoggedAtRef.current > 300) {
          lastLoggedAtRef.current = now;
        }
        if (isModalOpen && !effectiveCustomerPickerOpen && cur.length === 0 && last.length > 0 && !clearedByUserRef.current) {
          // Liga guarda por 2s para impedir efeitos tardios de sobrescreverem a restauração
          try { restoreGuardUntilRef.current = Date.now() + 2000; } catch {}
          try {
            const suppressUntil = suppressPickerCloseRef?.current || 0;
            const stateDump = {
              ts: new Date().toISOString(),
              reason: 'empty-after-close',
              modalOpen: isModalOpen,
              pickerOpen: effectiveCustomerPickerOpen,
              formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
              curLen: cur.length,
              lastLen: last.length,
              clearedByUser: !!clearedByUserRef?.current,
              lastAction: lastSelActionRef?.current,
              chipsLen: Array.isArray(chipsSnapshot) ? chipsSnapshot.length : NaN,
              clientsLoading: !!clientsLoading,
              suppressUntil,
            };
            console.warn('[CustomerPicker][ANOMALY] selection empty post-close', stateDump);
          } catch {}
          // attempt immediate restore and after short delays using refs to avoid stale closures
          setChipsSnapshotSafe(last);
          try { sessionStorage.setItem(persistLastKey, JSON.stringify(last)); } catch {}
          setForm(f => ({ ...f, selectedClients: [...last] }));
          // microtask
          try { Promise.resolve().then(() => { setForm(f => ({ ...f, selectedClients: [...lastNonEmptySelectionRef.current] })); }); } catch {}
          // animation frame
          try { requestAnimationFrame(() => { setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })); }); } catch {}
          setTimeout(() => {
            const cur2 = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
            const last2 = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
            if (cur2.length === 0 && last2.length > 0) {
              setForm(f => ({ ...f, selectedClients: [...last2] }));
            }
          }, 25);
          setTimeout(() => {
            const cur3 = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
            const last3 = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
            if (cur3.length === 0 && last3.length > 0) {
              setForm(f => ({ ...f, selectedClients: [...last3] }));
            }
          }, 120);
          setTimeout(() => {
            const cur4 = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
            const last4 = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
            if (cur4.length === 0 && last4.length > 0) {
              setForm(f => ({ ...f, selectedClients: [...last4] }));
            }
          }, 240);
        }
      } catch {}
    }, [form.selectedClients, effectiveCustomerPickerOpen, isModalOpen]);

    // Guarda forte: enquanto restoreGuardUntil estiver ativo, qualquer transição para array vazio é revertida de imediato
    useEffect(() => {
      try {
        const now = Date.now();
        const guardActive = now < (restoreGuardUntilRef.current || 0);
        const cur = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
        const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
        const lockActive = now < (selectionLockUntilRef.current || 0);
        if (isModalOpen && !effectiveCustomerPickerOpen && (guardActive || lockActive) && cur.length === 0 && last.length > 0 && !clearedByUserRef.current) {
          console.warn('[CustomerPicker][GUARD:restore]', { ts: new Date().toISOString(), guardUntil: restoreGuardUntilRef.current, lastLen: last.length });
          setChipsSnapshot(last);
          try { sessionStorage.setItem(persistLastKey, JSON.stringify(last)); } catch {}
          setForm(f => ({ ...f, selectedClients: [...last] }));
          // rAF + timeouts extras
          try { requestAnimationFrame(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
          setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 32);
          setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 96);
        }
      } catch {}
    }, [form.selectedClients, effectiveCustomerPickerOpen, isModalOpen]);

    // Watchdog adicional: durante janela de trava (selectionLock), qualquer transição para [] é revertida agressivamente
    useEffect(() => {
      const now = Date.now();
      if (!isModalOpen) return;
      if (effectiveCustomerPickerOpen) return;
      if (now >= (selectionLockUntilRef.current || 0)) return;
      const cur = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
      if (cur.length === 0 && last.length > 0) {
        setChipsSnapshot(last);
        try { sessionStorage.setItem(persistLastKey, JSON.stringify(last)); } catch {}
        setForm(f => ({ ...f, selectedClients: [...last] }));
        // reforços adicionais
        Promise.resolve().then(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })));
        setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 24);
        setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 80);
        setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 240);
        try { console.warn('[CustomerPicker][LOCK:restore]', { id: mountIdRef.current, lastLen: last.length }); } catch {}
      }
    }, [form.selectedClients, isModalOpen, effectiveCustomerPickerOpen]);
    // (removed erroneous stray return block)
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

    // Mantém o representante (paymentSelectedId) consistente com a seleção atual
    useEffect(() => {
      const sel = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      const current = paymentSelectedId;
      const valid = current && sel.some(c => c && c.id === current);
      if (sel.length > 0 && !valid) {
        // Força o representante para o primeiro selecionado
        setPaymentSelectedId(sel[0]?.id || null);
      } else if (sel.length === 0 && current) {
        // Sem clientes selecionados, limpa representante
        setPaymentSelectedId(null);
      }
    }, [form.selectedClients, isModalOpen, editingBooking]);
    // Evita que a auto-correção de horários rode imediatamente após aplicar um prefill
    const suppressAutoAdjustRef = useRef(false);
    // Garante que a inicialização do formulário ocorra apenas uma vez por abertura do modal
    const initializedRef = useRef(false);
    // Lista local de clientes para evitar re-render do componente pai durante a 1ª abertura
    const [localCustomers, setLocalCustomers] = useState(customerOptions);
    // Watchdog: se ficar carregando sem itens locais por >2s, desliga o loading para mostrar 'Nenhum cliente encontrado'
    const clientsLoadingSinceRef = useRef(0);
    useEffect(() => {
      if (clientsLoading) {
        if (!clientsLoadingSinceRef.current) clientsLoadingSinceRef.current = Date.now();
        const t = setTimeout(() => {
          if (clientsLoading && (!Array.isArray(localCustomers) || localCustomers.length === 0)) {
            setClientsLoading(false);
          }
        }, 2000);
        return () => clearTimeout(t);
      } else {
        clientsLoadingSinceRef.current = 0;
      }
    }, [clientsLoading, localCustomers]);
    // Lista efetiva de clientes selecionados: sempre refletir o estado atual do formulário
    const effectiveSelectedClients = useMemo(() => (Array.isArray(form.selectedClients) ? form.selectedClients : []), [form.selectedClients]);

    // Rótulo resumido para o seletor de clientes (ex.: "Daniel +3")
    const selectedClientsLabel = useMemo(() => {
      const arr = effectiveSelectedClients || [];
      if (arr.length === 0) return 'Adicionar clientes';
      const first = arr[0]?.nome || 'Cliente';
      const extra = arr.length - 1;
      return extra > 0 ? `${first} +${extra}` : first;
    }, [effectiveSelectedClients]);

    // Chips: sempre renderizar a partir do estado atual do formulário
    const chipsClients = useMemo(() => (Array.isArray(form.selectedClients) ? form.selectedClients : []), [form.selectedClients]);
    // console cleaned: removed "[CustomerPicker][chips render]" logs

    // Debug: loga quando a lista efetiva muda, para diagnosticar chips
    useEffect(() => {
      try {
        dbg('Chips:effective change', {
          effectiveLen: Array.isArray(effectiveSelectedClients) ? effectiveSelectedClients.length : 0,
          formLen: Array.isArray(form.selectedClients) ? form.selectedClients.length : 0,
          lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : 0,
          pickerOpen: isCustomerPickerOpen,
        });
      } catch {}
    }, [effectiveSelectedClients, form.selectedClients, isCustomerPickerOpen]);

    // (removido) Efeito duplicado de restauração que podia sobrescrever seleção válida ao fechar

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
        // Ao fechar o modal, permitir nova inicialização na próxima abertura
        initializedRef.current = false;
      }
    }, [isModalOpen]);

    // Ao abrir o modal especificamente para NOVO agendamento (não edição), zera seleção de clientes mesmo com prefill
    const wasOpenRef = useRef(false);
    useEffect(() => {
      if (isModalOpen && !wasOpenRef.current) {
        wasOpenRef.current = true;
        // Define/Reutiliza um sessionId para esta abertura do modal (sobrevive a remount)
        try {
          const prevPickerSid = sessionStorage.getItem('agenda:customerPicker:sessionId') || '';
          const prevClosingAtRaw = sessionStorage.getItem('agenda:customerPicker:closingAt');
          const prevClosingAt = prevClosingAtRaw ? Number(prevClosingAtRaw) : 0;
          const prevWithin = prevClosingAt && (Date.now() - prevClosingAt < 10000); // 10s
          if (prevPickerSid && prevWithin) {
            modalSessionIdRef.current = prevPickerSid;
            try { console.warn('[CustomerPicker][SESSION:reuse]', { id: mountIdRef.current, modalSid: modalSessionIdRef.current, withinMs: Date.now() - prevClosingAt }); } catch {}
          } else if (!modalSessionIdRef.current) {
            modalSessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            try { console.warn('[CustomerPicker][SESSION:new]', { id: mountIdRef.current, modalSid: modalSessionIdRef.current }); } catch {}
          }
          sessionStorage.setItem('agenda:modal:sessionId', modalSessionIdRef.current);
        } catch {}
        // Apenas quando não está editando (novo agendamento), independentemente de haver prefill
        if (!editingBooking) {
          // Antes de qualquer clear: tentar restaurar se acabamos de concluir o picker nesta MESMA sessão
          try {
            const closingAtRaw = sessionStorage.getItem('agenda:customerPicker:closingAt');
            const closingAt = closingAtRaw ? Number(closingAtRaw) : 0;
            const within = closingAt && (Date.now() - closingAt < 10000);
            const closingSessionId = sessionStorage.getItem('agenda:customerPicker:sessionId') || '';
            const modalSessionId = sessionStorage.getItem('agenda:modal:sessionId') || '';
            const rawSel = sessionStorage.getItem(persistLastKey);
            const persisted = rawSel ? JSON.parse(rawSel) : [];
            if (within && Array.isArray(persisted) && persisted.length > 0 && closingSessionId && modalSessionId && closingSessionId === modalSessionId) {
              try { console.warn('[CustomerPicker][RESTORE:init-open]', { id: mountIdRef.current, withinMs: Date.now() - closingAt, idsMatch: true, closingSessionId, modalSessionId, persistedLen: persisted.length }); } catch {}
              try { userSelectedOnceRef.current = true; } catch {}
              setForm(f => ({ ...f, selectedClients: persisted }));
              lastNonEmptySelectionRef.current = persisted;
              setChipsSnapshotSafe(persisted);
              try { clearedByUserRef.current = false; } catch {}
              // reforços para resistir a efeitos tardios
              try { Promise.resolve().then(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
              try { requestAnimationFrame(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
              setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 24);
              setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 96);
              // não limpar marcadores aqui; serão limpos no close do modal
              return;
            }
            // Fallback: se dentro da janela e há persisted, mas IDs não batem, ainda assim restaurar para evitar perda
            if (within && Array.isArray(persisted) && persisted.length > 0) {
              try { console.warn('[CustomerPicker][RESTORE:init-open:FALLBACK]', { id: mountIdRef.current, withinMs: Date.now() - closingAt, idsMatch: false, closingSessionId, modalSessionId, persistedLen: persisted.length }); } catch {}
              try { userSelectedOnceRef.current = true; } catch {}
              setForm(f => ({ ...f, selectedClients: persisted }));
              lastNonEmptySelectionRef.current = persisted;
              setChipsSnapshotSafe(persisted);
              try { clearedByUserRef.current = false; } catch {}
              try { Promise.resolve().then(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
              try { requestAnimationFrame(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
              setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 24);
              setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 96);
              return;
            }
            try { console.warn('[CustomerPicker][RESTORE:init-open:skip]', { id: mountIdRef.current, within, closingSessionId, modalSessionId, idsMatch: closingSessionId && modalSessionId && (closingSessionId === modalSessionId), persistedLen: Array.isArray(persisted)?persisted.length:NaN }); } catch {}
          } catch {}
          // Se estamos em janela de proteção pós-concluir, não executar o clear neste ciclo
          try {
            if (Date.now() < (preventClearsUntilRef.current || 0)) {
              console.warn('[CustomerPicker][INIT:clear:blocked:post-conclude]', { id: mountIdRef.current });
              return;
            }
          } catch {}
          try { customerPickerDesiredOpenRef.current = false; localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
          // Init de NOVO: somente zera se não houver seleção persistida recente
          try {
            const rawSel = sessionStorage.getItem(persistLastKey);
            const persisted = rawSel ? JSON.parse(rawSel) : [];
            const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
            if ((Array.isArray(persisted) && persisted.length > 0) || (Array.isArray(last) && last.length > 0)) {
              console.warn('[CustomerPicker][INIT:clear:new-open:skipped:have-last]', { id: mountIdRef.current, persistedLen: Array.isArray(persisted)?persisted.length:0, lastLen: last.length });
            } else {
              console.warn('[CustomerPicker][INIT:clear:new-open]', { id: mountIdRef.current });
              try { lastNonEmptySelectionRef.current = []; } catch {}
              try { setChipsSnapshot([]); } catch {}
              try { clearedByUserRef.current = false; } catch {}
              setForm(f => ({ ...f, selectedClients: [] }));
            }
          } catch {
            try { console.warn('[CustomerPicker][INIT:clear:new-open]', { id: mountIdRef.current, err: 'check-failed' }); } catch {}
            try { lastNonEmptySelectionRef.current = []; } catch {}
            try { setChipsSnapshot([]); } catch {}
            try { clearedByUserRef.current = false; } catch {}
            setForm(f => ({ ...f, selectedClients: [] }));
          }
        }
      } else if (!isModalOpen && wasOpenRef.current) {
      }
      if (!editingBooking) {
        if (newModeInitRef.current) return; // já limpou para este ciclo de "novo"
        newModeInitRef.current = true;
        // Também tenta restaurar dentro da mesma sessão ao transicionar para novo dentro do modal
        try {
          const closingAtRaw = sessionStorage.getItem('agenda:customerPicker:closingAt');
          const closingAt = closingAtRaw ? Number(closingAtRaw) : 0;
          const within = closingAt && (Date.now() - closingAt < 5000);
          const closingSessionId = sessionStorage.getItem('agenda:customerPicker:sessionId') || '';
          const modalSessionId = sessionStorage.getItem('agenda:modal:sessionId') || '';
          const rawSel = sessionStorage.getItem(persistLastKey);
          const persisted = rawSel ? JSON.parse(rawSel) : [];
          if (within && Array.isArray(persisted) && persisted.length > 0 && closingSessionId && modalSessionId && closingSessionId === modalSessionId) {
            try { console.warn('[CustomerPicker][RESTORE:new-mode]', { id: mountIdRef.current, withinMs: Date.now() - closingAt, idsMatch: true, closingSessionId, modalSessionId, persistedLen: persisted.length }); } catch {}
            try { userSelectedOnceRef.current = true; } catch {}
            setForm(f => ({ ...f, selectedClients: persisted }));
            lastNonEmptySelectionRef.current = persisted;
            setChipsSnapshotSafe(persisted);
            try { clearedByUserRef.current = false; } catch {}
            try { Promise.resolve().then(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
            try { requestAnimationFrame(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
            setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 24);
            setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 96);
            return;
          }
          // Fallback: dentro da janela com persisted, restaura mesmo que IDs não batam (evita perda)
          if (within && Array.isArray(persisted) && persisted.length > 0) {
            try { console.warn('[CustomerPicker][RESTORE:new-mode:FALLBACK]', { id: mountIdRef.current, withinMs: Date.now() - closingAt, idsMatch: false, closingSessionId, modalSessionId, persistedLen: persisted.length }); } catch {}
            try { userSelectedOnceRef.current = true; } catch {}
            setForm(f => ({ ...f, selectedClients: persisted }));
            lastNonEmptySelectionRef.current = persisted;
            setChipsSnapshotSafe(persisted);
            try { clearedByUserRef.current = false; } catch {}
            try { Promise.resolve().then(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
            try { requestAnimationFrame(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] }))); } catch {}
            setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 24);
            setTimeout(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || [])] })), 96);
            return;
          }
          try { console.warn('[CustomerPicker][RESTORE:new-mode:skip]', { id: mountIdRef.current, within, closingSessionId, modalSessionId, idsMatch: closingSessionId && modalSessionId && (closingSessionId === modalSessionId), persistedLen: Array.isArray(persisted)?persisted.length:NaN }); } catch {}
        } catch {}
        // Se estamos em janela de proteção pós-concluir, não executar o clear agora
        try {
          if (Date.now() < (preventClearsUntilRef.current || 0)) {
            console.warn('[CustomerPicker][INIT:clear:new-mode:blocked:post-conclude]', { id: mountIdRef.current });
            return;
          }
        } catch {}
        try { customerPickerDesiredOpenRef.current = false; localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
        try { clearedByUserRef.current = false; } catch {}
        try {
          const rawSel = sessionStorage.getItem(persistLastKey);
          const persisted = rawSel ? JSON.parse(rawSel) : [];
          const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
          if ((Array.isArray(persisted) && persisted.length > 0) || (Array.isArray(last) && last.length > 0)) {
            console.warn('[CustomerPicker][INIT:clear:new-mode:skipped:have-last]', { id: mountIdRef.current, persistedLen: Array.isArray(persisted)?persisted.length:0, lastLen: last.length });
          } else {
            console.warn('[CustomerPicker][INIT:clear:new-mode]', { id: mountIdRef.current });
            try { lastNonEmptySelectionRef.current = []; } catch {}
            try { setChipsSnapshot([]); } catch {}
            setForm(f => ({ ...f, selectedClients: [] }));
          }
        } catch {
          try { console.warn('[CustomerPicker][INIT:clear:new-mode]', { id: mountIdRef.current, err: 'check-failed' }); } catch {}
          try { lastNonEmptySelectionRef.current = []; } catch {}
          try { setChipsSnapshot([]); } catch {}
          setForm(f => ({ ...f, selectedClients: [] }));
        }
      } else {
        // Entrou em modo edição; libera reset quando voltar para novo
        newModeInitRef.current = false;
      }
    }, [isModalOpen, editingBooking]);

    // Se o modal já estiver aberto e transicionarmos para modo NOVO (editingBooking -> null),
    // garantir limpeza de clientes mesmo sem fechar/reabrir o modal.
    const newModeInitRef = useRef(false);
    useEffect(() => {
      if (!isModalOpen) { 
        newModeInitRef.current = false; 
        // Ao fechar o modal, limpa quaisquer marcadores e sessionId
        try {
          sessionStorage.removeItem('agenda:customerPicker:closing');
          sessionStorage.removeItem('agenda:customerPicker:closingAt');
          sessionStorage.removeItem('agenda:customerPicker:sessionId');
          sessionStorage.removeItem('agenda:modal:sessionId');
          modalSessionIdRef.current = '';
          // Limpa seleção persistida e snapshots para que próximo agendamento inicie vazio
          sessionStorage.removeItem(persistLastKey);
          try { lastNonEmptySelectionRef.current = []; } catch {}
          try { setChipsSnapshot([]); } catch {}
          try { userSelectedOnceRef.current = false; } catch {}
          try { preventClearsUntilRef.current = 0; } catch {}
          try { selectionLockUntilRef.current = 0; } catch {}
          try { suppressPickerCloseRef.current = 0; } catch {}
          try { customerPickerIntentRef.current = null; } catch {}
          try { customerPickerDesiredOpenRef.current = false; } catch {}
          // Também zera a seleção do form e representante para garantir limpeza total
          setForm(f => ({ ...f, selectedClients: [] }));
          setPaymentSelectedId(null);
          console.warn('[CustomerPicker][CLOSE:modal:clear-all]');
        } catch {}
        return; 
      }
      if (!editingBooking) {
        if (newModeInitRef.current) return; // já limpou para este ciclo de "novo"
        newModeInitRef.current = true;
        // Bloqueia clear se estamos em janela de proteção pós-concluir (remount)
        try {
          if (Date.now() < (preventClearsUntilRef.current || 0)) {
            console.warn('[CustomerPicker][INIT:clear:new-mode:blocked:post-conclude:effect2]', { id: mountIdRef.current });
            return;
          }
        } catch {}
        try { customerPickerDesiredOpenRef.current = false; localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
        try { clearedByUserRef.current = false; } catch {}
        try {
          const rawSel = sessionStorage.getItem(persistLastKey);
          const persisted = rawSel ? JSON.parse(rawSel) : [];
          const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
          if ((Array.isArray(persisted) && persisted.length > 0) || (Array.isArray(last) && last.length > 0)) {
            console.warn('[CustomerPicker][INIT:clear:new-mode:effect2:skipped:have-last]', { id: mountIdRef.current, persistedLen: Array.isArray(persisted)?persisted.length:0, lastLen: last.length });
          } else {
            console.warn('[CustomerPicker][INIT:clear:new-mode:effect2]', { id: mountIdRef.current });
            try { lastNonEmptySelectionRef.current = []; } catch {}
            try { setChipsSnapshot([]); } catch {}
            setForm(f => ({ ...f, selectedClients: [] }));
          }
        } catch {
          try { lastNonEmptySelectionRef.current = []; } catch {}
          try { setChipsSnapshot([]); } catch {}
          setForm(f => ({ ...f, selectedClients: [] }));
        }
      } else {
        // Entrou em modo edição; libera reset quando voltar para novo
        newModeInitRef.current = false;
      }
    }, [isModalOpen, editingBooking]);

    // Função idempotente para salvar uma vez; reusada em onClick e ao voltar foco da aba
    const saveBookingOnce = useCallback(async () => {
      if (isSavingBooking) return;
      setIsSavingBooking(true);
      try {
        const court = courtsMap[form.court];
        if (!court) {
          toast({ title: 'Selecione uma quadra', variant: 'destructive' });
          // Falha de validação local: não manter pendência para auto-retry
          pendingSaveRef.current = false;
          completedSaveRef.current = false;
          return;
        }
        const s = form.startMinutes, e = form.endMinutes;
        if (!(Number.isFinite(s) && Number.isFinite(e) && e > s)) {
          toast({ title: 'Horário inválido', variant: 'destructive' });
          pendingSaveRef.current = false;
          completedSaveRef.current = false;
          return;
        }
        const free = isRangeFree(s, e);
        if (!free) {
          toast({ title: 'Conflito de horário', description: 'O horário selecionado está ocupado.', variant: 'destructive' });
          pendingSaveRef.current = false;
          completedSaveRef.current = false;
          return;
        }

        const buildDate = (base, minutes) => new Date(
          base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0
        );
        const inicio = buildDate(form.date, s);
        const fim = buildDate(form.date, e);
        let selNow = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
        // Evita hidratação cruzada: apenas no modo edição tentamos recuperar de refs locais;
        // nunca restaurar de sessionStorage aqui.
        if ((!selNow || selNow.length === 0) && editingBooking?.id) {
          try {
            const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
            if (last && last.length > 0) {
              selNow = last;
              setForm((f) => ({ ...f, selectedClients: last }));
            }
          } catch {}
        }
        const primaryClient = selNow[0];
        const clientesArr = selNow.map(getCustomerName).filter(Boolean);
        // Targeted diagnostics for save
        try {
          console.groupCollapsed('[BookingSave] pre-validate');
          console.log('selectedClients.len', selNow.length);
          console.log('primaryClient', primaryClient);
          console.log('clientesArr.len', clientesArr.length, 'sample', clientesArr.slice(0,3));
          console.groupEnd();
        } catch {}

        // Validação: para NOVO agendamento é obrigatório selecionar pelo menos 1 cliente
        if (!editingBooking?.id) {
          if (!primaryClient?.id) {
            toast({
              title: 'Selecione um cliente',
              description: 'Para criar um agendamento, selecione pelo menos um cliente.',
              variant: 'destructive',
            });
            return;
          }
        }

        if (editingBooking?.id) {
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
              const nowTs = getNowMs();
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
            // Fecha o modal de edição antes de abrir o modal de reativação para evitar sobreposição incorreta
            try { setIsModalOpen(false); await updateBookingStatus(editingBooking.id, form.status, 'user'); } catch {}
          }
          toast({ title: 'Agendamento atualizado' });
          completedSaveRef.current = true;
          pendingSaveRef.current = false;
          // Clear customer selection caches to avoid carryover into next new booking
          try { lastNonEmptySelectionRef.current = []; } catch {}
          try { setChipsSnapshot([]); } catch {}
          try { sessionStorage.removeItem(persistLastKey); } catch {}
          setIsModalOpen(false);
          return;
        }

        // CREATE com checagem idempotente (evita duplicar em reexecuções)
        let existingRow = null;
        try {
          const { data: found } = await supabase
            .from('agendamentos')
            .select('id, status, codigo')
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .eq('quadra_id', court.id)
            .eq('inicio', inicio.toISOString())
            .eq('fim', fim.toISOString())
            .limit(1);
          if (Array.isArray(found) && found.length > 0) existingRow = found[0];
        } catch {}

        if (existingRow?.id) {
          if (existingRow.status !== 'canceled') {
            // Já existe registro ativo equivalente; tratar como sucesso (não duplica)
            const newItem = {
              id: existingRow.id,
              code: existingRow.codigo,
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
        }

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
          .select('id, codigo')
          .single();
        if (error) throw error;
        const newItem = {
          id: data.id,
          code: data.codigo,
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
            const { error: perr } = await supabase
              .from('agendamento_participantes')
              .insert(rows);
            if (perr) { /* no console noise */ }
          }
        } catch (pe) {
          /* swallow participants create console noise */
        }

        completedSaveRef.current = true;
        pendingSaveRef.current = false;
        // Clear customer selection caches to avoid carryover into next new booking
        try { lastNonEmptySelectionRef.current = []; } catch {}
        try { setChipsSnapshot([]); } catch {}
        try { sessionStorage.removeItem(persistLastKey); } catch {}
        setIsModalOpen(false);
      } catch (e) {
        // Evita ruído excessivo no console
        // Mantém pendingSaveRef = true para auto-reexecução
        toast({ title: 'Erro ao salvar agendamento', description: e?.message || 'Tentando novamente automaticamente…', variant: 'destructive' });
      } finally {
        setIsSavingBooking(false);
      }
    }, [isSavingBooking, courtsMap, form, editingBooking, userProfile, isRangeFree, setBookings, toast, setIsModalOpen, updateBookingStatus]);

    // Ao voltar para a aba, se houver salvamento pendente e não concluído, reexecuta automaticamente
    useEffect(() => {
      const onVis = () => {
        if (document.visibilityState === 'visible' && isModalOpen && pendingSaveRef.current && !completedSaveRef.current && !isSavingBooking) {
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
        // Carregar clientes da empresa (sem filtrar por status para evitar listas vazias em bancos com outros valores)
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome, codigo, email, telefone, status, codigo_empresa')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .order('nome', { ascending: true });
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Falha ao carregar clientes:', error);
          return;
        }
        if (Array.isArray(data)) {
          try { console.log('[Clientes:load] retornou', data.length, 'itens'); } catch {}
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


    // Preencher formulário ao abrir em modo edição ou reset para novo (apenas uma vez por abertura)
    useEffect(() => {
      if (!isModalOpen) return;
      // Evita sobrescrever escolhas do usuário devido a efeitos tardios (ex.: quadras/clientes chegando)
      if (initializedRef.current) return;

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
        // Marca como inicializado após preencher o formulário de edição
        initializedRef.current = true;
      } else if (prefill) {
        setForm({
          selectedClients: userSelectedOnceRef.current ? (Array.isArray(form.selectedClients) ? form.selectedClients : []) : [],
          court: prefill.court ?? (availableCourts[0] || ''),
          modality: (() => { const c = prefill.court ?? (availableCourts[0] || ''); const allowed = courtsMap[c]?.modalidades || modalities; return allowed[0] || ''; })(),
          status: 'scheduled',
          date: prefill.date ?? currentDate,
          startMinutes: prefill.startMinutes ?? nearestSlot(),
          endMinutes: prefill.endMinutes ?? (nearestSlot() + 60),
        });
        setParticipantsForm([]);
        suppressAutoAdjustRef.current = true;
        initializedRef.current = true;
      } else {
        const initialCourt = availableCourts[0] || '';
        const allowed = courtsMap[initialCourt]?.modalidades || modalities;
        // Proteção extra: se houver snapshot de chips (seleção recente) e o usuário ainda não selecionou "neste ciclo",
        // usa o snapshot para evitar que a seleção "suma" em re-renderizações concorrentes.
        const snapshot = Array.isArray(chipsSnapshot) ? chipsSnapshot : [];
        const initialSelected = userSelectedOnceRef.current
          ? (Array.isArray(form.selectedClients) ? form.selectedClients : [])
          : (snapshot.length > 0 ? snapshot : []);
        if (!userSelectedOnceRef.current && snapshot.length > 0) {
          try { userSelectedOnceRef.current = true; } catch {}
        }
        setForm({
          selectedClients: initialSelected,
          court: initialCourt,
          modality: allowed[0] || '',
          status: 'scheduled',
          date: currentDate,
          startMinutes: nearestSlot(),
          endMinutes: nearestSlot() + 60,
        });
        setParticipantsForm([]);
        // Não limpar snapshots aqui; faremos limpeza somente quando o Dialog for fechado de fato
        // Evita autoajuste imediato durante a animação de abertura
        suppressAutoAdjustRef.current = true;
        initializedRef.current = true;
      }
    }, [isModalOpen, editingBooking, currentDate, prefill, availableCourts, modalities, participantsByAgendamento]);

    // Se trocar o agendamento em edição com o modal aberto, re-inicializa o formulário de edição
    useEffect(() => {
      if (!isModalOpen) return;
      if (!editingBooking) return;
      // Permitir re-inicialização completa para o novo agendamento
      initializedRef.current = false;
      participantsPrefillOnceRef.current = false;
      // Esta limpeza evita carregar clientes do agendamento anterior, mas não deve apagar seleção do usuário já feita
      if (!userSelectedOnceRef.current) {
        setForm((f) => ({ ...f, selectedClients: [] }));
      }
      // Permitir restauração normal no modo edição
      try { clearedByUserRef.current = false; } catch {}
    }, [editingBooking, isModalOpen]);

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

    // Utilitário: garantir fechamento do Customer Picker antes de abrir outros popovers/selects
    const closeCustomerPicker = useCallback(() => {
      try { customerPickerDesiredOpenRef.current = false; localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
      try { customerPickerIntentRef.current = 'close'; } catch {}
      try { setIsCustomerPickerOpen(false); setEffectiveCustomerPickerOpen(false); } catch {}
    }, []);

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
            // Bloqueia fechamento quando o seletor de clientes estiver aberto
            // ou logo após o seu fechamento (janela de supressão),
            // ou quando o formulário de cliente estiver aberto.
            try {
              const suppress = Date.now() < (suppressPickerCloseRef.current || 0);
              if (effectiveCustomerPickerOpen || isClientFormOpen || suppress) {
                try {
                  const dump = {
                    ts: new Date().toISOString(),
                    hook: 'Dialog:onOpenChange(blocked)',
                    effectiveCustomerPickerOpen,
                    isClientFormOpen,
                    suppressUntil: suppressPickerCloseRef.current,
                    formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                    curLen: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : NaN,
                    lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : NaN,
                  };
                  console.warn('[CustomerPicker][DIALOG:block-close]', dump);
                } catch {}
                return;
              }
            } catch {}
            try {
              const dump = {
                ts: new Date().toISOString(),
                hook: 'Dialog:onOpenChange(allow-close)',
                effectiveCustomerPickerOpen,
                isClientFormOpen,
                suppressUntil: suppressPickerCloseRef.current,
                formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                curLen: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : NaN,
                lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : NaN,
              };
              console.warn('[CustomerPicker][DIALOG:allow-close]', dump);
            } catch {}
            setIsModalOpen(false);
            setEditingBooking(null);
            setPrefill(null);
            setIsPaymentModalOpen(false);
            participantsPrefillOnceRef.current = false;
          } else {
            setIsModalOpen(true);
          }
        }}
      >
        <DialogContent
          forceMount
          disableAnimations={true}
          alignTop
          className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto min-h-[360px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Não permitir fechar o Dialog enquanto o seletor de clientes estiver aberto
            // ou imediatamente após o seu fechamento (janela de supressão),
            // ou enquanto o formulário de cliente estiver aberto.
            try {
              const suppress = Date.now() < (suppressPickerCloseRef.current || 0);
              if (isPaymentModalOpen || effectiveCustomerPickerOpen || isClientFormOpen || suppress) {
                try {
                  const dump = {
                    ts: new Date().toISOString(),
                    hook: 'DialogContent:onInteractOutside(blocked)',
                    effectiveCustomerPickerOpen,
                    isClientFormOpen,
                    isPaymentModalOpen,
                    suppressUntil: suppressPickerCloseRef.current,
                    formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                    curLen: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : NaN,
                    lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : NaN,
                  };
                  console.warn('[CustomerPicker][DIALOG:interactOutside:block]', dump);
                } catch {}
                e.preventDefault();
                return;
              }
            } catch {}
          }}
          onEscapeKeyDown={(e) => {
            try {
              const suppress = Date.now() < (suppressPickerCloseRef.current || 0);
              if (isPaymentModalOpen || effectiveCustomerPickerOpen || isClientFormOpen || suppress) {
                e.preventDefault();
                return;
              }
            } catch {}
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
              <span>
                {editingBooking
                  ? (() => {
                      const code = editingBooking?.code;
                      const codeStr = typeof code === 'number' ? String(code).padStart(3, '0') : null;
                      return codeStr ? `Editar agendamento - ${codeStr}` : 'Editar Agendamento';
                    })()
                  : 'Novo Agendamento'}
              </span>
              {editingBooking && (
                (() => {
                  const allPaid = paymentSummary?.pending === 0 && participantsCount > 0;
                  const hasPending = (paymentSummary?.pending || 0) > 0;
                  const badgeBase = 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs';
                  const green = 'bg-emerald-600/10 text-emerald-400 border-emerald-700/30';
                  const amber = 'bg-amber-600/15 text-amber-400 border-amber-700/30';
                  const dot = (cls) => (<span aria-hidden className={`inline-block w-2 h-2 rounded-full ${cls}`} />);
                  return (
                    <span
                      className={`${badgeBase} ${hasPending ? amber : green}`}
                      title={hasPending ? 'Há pagamentos pendentes' : 'Todos participantes pagos'}
                      aria-live="polite"
                    >
                      {dot(hasPending ? 'bg-amber-400' : 'bg-emerald-400')}
                      <span className="tracking-wide">Pagos</span>
                      <strong className="text-base font-semibold tabular-nums">{paymentSummary?.paid || 0}</strong>
                      <span className="opacity-60">/</span>
                      <span className="text-base font-semibold tabular-nums">{participantsCount}</span>
                    </span>
                  );
                })()
              )}
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
                  {/* effective open fully controls visibility and ignores programmatic closes */}
                  <Popover
                    modal={false}
                    open={effectiveCustomerPickerOpen}
                    onOpenChange={(open) => {
                      pickerLog('onOpenChange', { requestedOpen: open });
                      // Não fechar automaticamente enquanto o modal de novo cliente estiver aberto ou enquanto a lista estiver recarregando
                      if ((isClientFormOpen || clientsLoading) && open === false) return;
                      // Sticky: só permite fechar quando a intenção for explícita ('close')
                      if (!open && customerPickerIntentRef.current !== 'close') {
                        pickerLog('onOpenChange:blocked:sticky-close');
                        return;
                      }
                      if (open) {
                        customerPickerDesiredOpenRef.current = true;
                        try { localStorage.setItem('agenda:customerPicker:desiredAt', String(Date.now())); } catch {}
                        setEffectiveCustomerPickerOpen(true);
                        pickerLog('open:accepted');
                      } else {
                        customerPickerDesiredOpenRef.current = false;
                        try { localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
                        // Before actually closing, ensure selection isn't lost unintentionally
                        try {
                          const cur = Array.isArray(selectedClientsRef.current) ? [...selectedClientsRef.current] : [];
                          const last = Array.isArray(lastNonEmptySelectionRef.current) ? [...lastNonEmptySelectionRef.current] : [];
                          const snapshot = cur.length > 0 ? cur : last;
                          if (snapshot.length > 0 && !clearedByUserRef.current) {
                            lastSelActionRef.current = 'onOpenChange:close:restore';
                            try { sessionStorage.setItem(persistLastKey, JSON.stringify(snapshot)); } catch {}
                            setChipsSnapshotSafe(snapshot);
                            applySelectedClients('onOpenChange:close:restore', snapshot);
                            // Reasserts
                            setTimeout(() => { applySelectedClients('onOpenChange:close:reassert:0', snapshot); }, 0);
                            setTimeout(() => { applySelectedClients('onOpenChange:close:reassert:60', snapshot); }, 60);
                          }
                        } catch {}
                        // Suppress external close interpretation for a short window
                        try { suppressPickerCloseRef.current = Date.now() + 1500; } catch {}
                        try {
                          const dump = {
                            ts: new Date().toISOString(),
                            hook: 'onOpenChange(false)',
                            formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                            curLen: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : NaN,
                            lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : NaN,
                            chipsLen: Array.isArray(chipsSnapshot) ? chipsSnapshot.length : NaN,
                            clientsLoading: !!clientsLoading,
                            lastAction: lastSelActionRef?.current,
                            clearedByUser: !!clearedByUserRef?.current,
                            suppressUntil: suppressPickerCloseRef.current,
                          };
                          console.warn('[CustomerPicker][CLOSE:onOpenChange]', dump);
                        } catch {}
                        setEffectiveCustomerPickerOpen(false);
                        pickerLog('close:accepted');
                      }
                      // Se estiver fechando e foi por clique fora, aplica destaque temporário ao trigger
                      if (!open && closedByOutsideRef.current) {
                        setHighlightCustomerTrigger(true);
                        closedByOutsideRef.current = false;
                        setTimeout(() => setHighlightCustomerTrigger(false), 1200);
                      }
                      customerPickerIntentRef.current = open ? 'open' : 'close';
                      setIsCustomerPickerOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("min-w-[180px] justify-between", highlightCustomerTrigger && "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-transparent transition-shadow") }
                        onClick={() => {
                          pickerLog('trigger:click');
                          // Abertura explícita do picker para evitar relutância
                          try { customerPickerIntentRef.current = 'open'; } catch {}
                          try { customerPickerDesiredOpenRef.current = true; localStorage.setItem('agenda:customerPicker:desiredAt', String(Date.now())); } catch {}
                          setIsCustomerPickerOpen(true);
                          setEffectiveCustomerPickerOpen(true);
                          // Reassert after a tick to beat any concurrent close attempts
                          setTimeout(() => {
                            setIsCustomerPickerOpen(true);
                            setEffectiveCustomerPickerOpen(true);
                            pickerLog('trigger:reassert-open');
                          }, 30);
                          pickerLog('trigger:after-set-open');
                        }}
                      >
                        {selectedClientsLabel}
                        <ChevronDown className="w-4 h-4 ml-2 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      forceMount
                      side="bottom"
                      align="start"
                      className="w-[360px] p-2 z-[9999]"
                      onPointerDownOutside={(e) => {
                        pickerLog('pointerDownOutside');
                        // Permitir interação externa quando não estiver carregando e nem com o modal de cliente aberto
                        if (isClientFormOpen || clientsLoading) { e.preventDefault(); return; }
                        // Snapshot da seleção atual antes de fechar por clique fora
                        try {
                          const cur = Array.isArray(selectedClientsRef.current) ? [...selectedClientsRef.current] : [];
                          const last = Array.isArray(lastNonEmptySelectionRef.current) ? [...lastNonEmptySelectionRef.current] : [];
                          const currentSel = cur.length > 0 ? cur : last;
                          if (currentSel.length > 0) {
                            lastSelActionRef.current = 'outside:close:snapshot';
                            lastNonEmptySelectionRef.current = currentSel;
                            try { sessionStorage.setItem(persistLastKey, JSON.stringify(currentSel)); } catch {}
                            setChipsSnapshotSafe(currentSel);
                            // Garante que o form persista a seleção atual
                            applySelectedClients('outside:close:apply', currentSel);
                            // Reassert após pequenos atrasos para vencer efeitos concorrentes tardios
                            setTimeout(() => { applySelectedClients('outside:close:reassert:25', currentSel); }, 25);
                            setTimeout(() => { applySelectedClients('outside:close:reassert:120', currentSel); }, 120);
                            clearedByUserRef.current = false;
                          }
                        } catch {}
                        // Abre janela de supressão para evitar o Dialog interpretar como clique fora e fechar
                        try { suppressPickerCloseRef.current = Date.now() + 1500; } catch {}
                        try {
                          const dump = {
                            ts: new Date().toISOString(),
                            hook: 'onPointerDownOutside',
                            formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                            curLen: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : NaN,
                            lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : NaN,
                            chipsLen: Array.isArray(chipsSnapshot) ? chipsSnapshot.length : NaN,
                            clientsLoading: !!clientsLoading,
                            lastAction: lastSelActionRef?.current,
                            clearedByUser: !!clearedByUserRef?.current,
                            suppressUntil: suppressPickerCloseRef.current,
                          };
                          console.warn('[CustomerPicker][CLOSE:pointerOutside]', dump);
                        } catch {}
                        closedByOutsideRef.current = true;
                        customerPickerIntentRef.current = 'close';
                        customerPickerDesiredOpenRef.current = false; try { localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
                        setIsCustomerPickerOpen(false);
                        setEffectiveCustomerPickerOpen(false);
                      }}
                      onFocusOutside={(e) => {
                        pickerLog('focusOutside');
                        if (isClientFormOpen || clientsLoading) { e.preventDefault(); }
                      }}
                      onEscapeKeyDown={(e) => {
                        pickerLog('escapeKeyDown');
                        if (isClientFormOpen || clientsLoading) { e.preventDefault(); }
                      }}
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
                          {/* Loading state: só exibe se não houver itens locais */}
                          {clientsLoading && ((localCustomers || []).length === 0) && (
                            <div className="px-3 py-4 text-sm text-text-muted">Carregando clientes…</div>
                          )}
                          {/* Empty state when not loading */}
                          {!clientsLoading && ((localCustomers || []).length === 0) && (
                            <div className="px-3 py-4 text-sm text-text-muted">Nenhum cliente encontrado</div>
                          )}
                          {!clientsLoading && ((localCustomers || [])
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
                            const nameKey = String(nome || '').toLowerCase();
                            const isSame = (sc) => (sc.id && id) ? (sc.id === id) : (String(sc.nome || '').toLowerCase() === nameKey);
                            const selected = (form.selectedClients || []).some(isSame);
                            return (
                              <button
                                key={id || nameKey}
                                type="button"
                                className="w-full text-left py-2 px-3 hover:bg-white/5 flex items-center justify-between"
                                onMouseDown={(e) => { e.stopPropagation(); }}
                                role="option"
                                aria-checked={selected}
                                onClick={() => {
                                  // Calcula próximo estado e aplica via helper para evitar esvaziamento indevido
                                  const exists = (Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []).some(isSame);
                                  if (exists) {
                                    const next = (Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []).filter(x => (x.id && id) ? (x.id !== id) : (String(x.nome || '').toLowerCase() !== nameKey));
                                    try { clearedByUserRef.current = next.length === 0; } catch {}
                                    // Se o usuário removeu até zerar, limpar o marcador do primeiro selecionado
                                    try { if (next.length === 0) firstSelectedIdRef.current = null; } catch {}
                                    try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                                    try { selectedClientsRef.current = next; } catch {}
                                    applySelectedClients('list:remove', next);
                                  } else {
                                    const novo = { id, nome };
                                    const next = [...(Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []), novo];
                                    // Se é o primeiro desta sessão, fixar como primeiro para o rótulo
                                    try { if ((selectedClientsRef.current || []).length === 0) firstSelectedIdRef.current = id || null; } catch {}
                                    try { clearedByUserRef.current = false; } catch {}
                                    try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                                    try { selectedClientsRef.current = next; } catch {}
                                    applySelectedClients('list:add', next);
                                  }
                                  // Garante que o picker permaneça aberto após a seleção
                                  customerPickerDesiredOpenRef.current = true;
                                  try { localStorage.setItem('agenda:customerPicker:desiredAt', String(Date.now())); } catch {}
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
                            onMouseDown={(e) => {
                              // Pré-armar supressão e lock ANTES do clique ser processado pelo Radix
                              try { suppressPickerCloseRef.current = Date.now() + 3000; } catch {}
                              try { selectionLockUntilRef.current = Date.now() + 3500; } catch {}
                              try { preventClearsUntilRef.current = Date.now() + 5000; } catch {}
                              try { customerPickerIntentRef.current = 'close'; } catch {}
                              try { customerPickerDesiredOpenRef.current = false; localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
                              // Marca fechamento em curso (sobrevive a remount) e persiste seleção atual
                              try {
                                sessionStorage.setItem('agenda:customerPicker:closing', '1');
                                sessionStorage.setItem('agenda:customerPicker:closingAt', String(Date.now()));
                                const modalSessionId = modalSessionIdRef.current || sessionStorage.getItem('agenda:modal:sessionId') || '';
                                if (modalSessionId) sessionStorage.setItem('agenda:customerPicker:sessionId', modalSessionId);
                                const cur = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
                                if (cur.length > 0) {
                                  sessionStorage.setItem(persistLastKey, JSON.stringify(cur));
                                }
                                // LOG: mousedown conclude
                                try {
                                  const dump = {
                                    ts: new Date().toISOString(),
                                    hook: 'conclude:mousedown',
                                    modalSessionId,
                                    closingAt: sessionStorage.getItem('agenda:customerPicker:closingAt'),
                                    selLen: Array.isArray(cur) ? cur.length : NaN,
                                    formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                                    lockUntil: selectionLockUntilRef.current,
                                    suppressUntil: suppressPickerCloseRef.current,
                                    isPickerOpen: !!effectiveCustomerPickerOpen,
                                    isModalOpen: !!isModalOpen,
                                  };
                                  console.warn('[CustomerPicker][CONCLUDE:mousedown]', dump);
                                } catch {}
                              } catch {}
                              // Evita que o mousedown seja interpretado como outside imediatamente
                              e.stopPropagation();
                            }}
                            onClick={() => {
                              // Intenção explícita de fechar
                              customerPickerIntentRef.current = 'close';
                              customerPickerDesiredOpenRef.current = false;
                              try { preventClearsUntilRef.current = Date.now() + 5000; } catch {}
                              try { localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
                              // Marca estado de fechamento e trava seleção por uma janela maior
                              pickerClosingRef.current = true;
                              // Snapshot da seleção atual a partir das refs (fallback para última não-vazia)
                              const cur = Array.isArray(selectedClientsRef.current) ? [...selectedClientsRef.current] : [];
                              const last = Array.isArray(lastNonEmptySelectionRef.current) ? [...lastNonEmptySelectionRef.current] : [];
                              const currentSel = cur.length > 0 ? cur : last;
                              // Persistir como última seleção não-vazia
                              try {
                                if (currentSel.length > 0) {
                                  lastSelActionRef.current = 'conclude:close:snapshot';
                                  lastNonEmptySelectionRef.current = currentSel;
                                  sessionStorage.setItem(persistLastKey, JSON.stringify(currentSel));
                                }
                              } catch {}
                              // Atualizar chipsSnapshot e garantir que o form reflita a seleção atual
                              setChipsSnapshotSafe(currentSel);
                              // Trava restauração e evita limpezas por 3s
                              try { selectionLockUntilRef.current = Date.now() + 3000; } catch {}
                              applySelectedClients('conclude:close:apply', currentSel);
                              // Reforços síncronos/adicionais para evitar race após close
                              setForm(f => ({ ...f, selectedClients: [...currentSel] }));
                              try { requestAnimationFrame(() => setForm(f => ({ ...f, selectedClients: [...(lastNonEmptySelectionRef.current || currentSel)] }))); } catch {}
                              // Não é uma limpeza intencional
                              try { clearedByUserRef.current = false; } catch {}
                              // Fechar picker (com janela de supressão para evitar reabertura)
                              try { suppressPickerCloseRef.current = Date.now() + 2500; } catch {}
                              setIsCustomerPickerOpen(false);
                              setEffectiveCustomerPickerOpen(false);
                              setTimeout(() => {
                                try { suppressPickerCloseRef.current = Date.now() + 2500; } catch {}
                                setIsCustomerPickerOpen(false);
                                setEffectiveCustomerPickerOpen(false);
                              }, 15);
                              setTimeout(() => {
                                try { suppressPickerCloseRef.current = Date.now() + 2500; } catch {}
                                setIsCustomerPickerOpen(false);
                                setEffectiveCustomerPickerOpen(false);
                              }, 120);
                              // Janela de supressão imediata também aqui
                              try { suppressPickerCloseRef.current = Date.now() + 2500; } catch {}
                              try {
                                const dump = {
                                  ts: new Date().toISOString(),
                                  hook: 'conclude:click',
                                  formLen: Array.isArray(form?.selectedClients) ? form.selectedClients.length : NaN,
                                  curLen: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : NaN,
                                  lastLen: Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current.length : NaN,
                                  chipsLen: Array.isArray(chipsSnapshot) ? chipsSnapshot.length : NaN,
                                  clientsLoading: !!clientsLoading,
                                  lastAction: lastSelActionRef?.current,
                                  clearedByUser: !!clearedByUserRef?.current,
                                  suppressUntil: suppressPickerCloseRef.current,
                                  selectionLockUntil: selectionLockUntilRef.current,
                                  restoreGuardUntil: restoreGuardUntilRef.current,
                                  modalSessionId: (modalSessionIdRef.current || sessionStorage.getItem('agenda:modal:sessionId') || ''),
                                  closingAt: sessionStorage.getItem('agenda:customerPicker:closingAt'),
                                  pickerOpen: !!effectiveCustomerPickerOpen,
                                  modalOpen: !!isModalOpen,
                                };
                                console.warn('[CustomerPicker][CLOSE:conclude]', dump);
                              } catch {}
                              // Libera flag de fechamento após a janela de trava
                              setTimeout(() => { try { pickerClosingRef.current = false; } catch {} }, 3000);
                            }}
                          >
                            Concluir
                          </Button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted">{(effectiveSelectedClients || []).length} selecionado(s)</span>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    onClick={() => {
                      // Fecha o popover antes de abrir o modal para evitar flicker/fechamento tardio
                      customerPickerDesiredOpenRef.current = false; try { localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}; customerPickerIntentRef.current = 'close'; setIsCustomerPickerOpen(false); setEffectiveCustomerPickerOpen(false);
                      setClientForModal(null);
                      setIsClientFormOpen(true);
                    }}
                  >
                    + Novo
                  </Button>
                </div>
                {chipsClients.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {chipsClients.map((c) => {
                      const nameKey = String(c?.nome || '').toLowerCase();
                      const key = c?.id || nameKey || Math.random().toString(36).slice(2);
                      const token = c?.id || `__name:${nameKey}`;
                      return (
                        <span key={key} className="text-sm font-medium bg-white/5 border border-white/10 rounded px-2 py-1 flex items-center gap-2">
                          {shortName(c.nome)}
                          <button
                            type="button"
                            aria-label="Remover cliente"
                            title="Remover cliente"
                            className="text-text-muted hover:text-red-400 p-1 rounded hover:bg-red-500/10"
                            onClick={() => {
                              dbg('CustomerPicker:chip:remove', { token }); // keep chip-related log
                              const next = (Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []).filter((x) => (x?.id && c?.id) ? (x.id !== c.id) : (String(x?.nome || '').toLowerCase() !== nameKey));
                              try { clearedByUserRef.current = next.length === 0; } catch {}
                              try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                              try { selectedClientsRef.current = next; } catch {}
                              applySelectedClients('chips:remove', next);
                            }}
                          >
                            <X className="w-5 h-5" />
                            <span className="sr-only">Remover</span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  ) : null}
              </div>

              {/* Quadra */}
              <div>
                <Label className="font-bold">Quadra</Label>
                <Select value={form.court} onValueChange={(v) => setForm((f) => ({ ...f, court: v }))}>
                  <SelectTrigger className="mt-1" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60]">
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
                  <SelectTrigger className="mt-1" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="mt-1" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="w-32" aria-label="Hora início" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px] z-[60]">
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
                    <SelectTrigger className="w-32" aria-label="Hora fim" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px] z-[60]">
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
                    <XCircle className="w-4 h-4 mr-2 opacity-90" /> Cancelar agendamento
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
                      if (filtered.length === 0) {
                        return (
                          <div className="px-3 py-4 text-sm text-text-muted">Nenhum participante com esse nome</div>
                        );
                      }
                      return filtered.map((c) => {
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
                    });
                    })()}
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
                    const tClick = Date.now();
                    const traceId = `[PaymentsSave Trace ${tClick}]`;
                    try { console.groupCollapsed(traceId); } catch {}
                    try {
                      const snap = {
                        modalOpen: isPaymentModalOpen,
                        isSavingPayments,
                        bookingId: editingBooking?.id,
                        company: userProfile?.codigo_empresa,
                        participantsCount,
                        selectedClientIds: (form?.selectedClients || []).map(c => c?.id),
                        hiddenIds: [...(paymentHiddenIds || [])],
                        paymentTotal,
                      };
                      try { console.info('[PaymentsSave] click', snap); } catch {}
                      if (isSavingPayments) {
                        try { console.warn('[PaymentsSave] ignored: already saving'); } catch {}
                        return;
                      }
                      setIsSavingPayments(true);
                      try { console.debug('[PaymentsSave] state set: isSavingPayments=true'); } catch {}
                      const agendamentoId = editingBooking?.id;
                      const codigo = userProfile?.codigo_empresa;
                      if (!agendamentoId || !codigo) {
                        try { console.error('[PaymentsSave] missing identifiers', { agendamentoId, codigo }); } catch {}
                        toast({ title: 'Erro ao salvar pagamentos', description: 'Agendamento ou empresa indisponível.', variant: 'destructive' });
                        return;
                      }
                      const t0 = Date.now();

                      // Verificação: pendentes (somente notificação; não exibir banner bloqueante)
                      let mapForm, effectiveSelected, pendingCount;
                      try {
                        mapForm = new Map((participantsForm || []).map(p => [p.cliente_id, p]));
                        effectiveSelected = (form.selectedClients || []).filter(c => !paymentHiddenIds.includes(c.id));
                        pendingCount = effectiveSelected.reduce((acc, c) => {
                          const st = (mapForm.get(c.id)?.status_pagamento) || 'Pendente';
                          return acc + (st !== 'Pago' ? 1 : 0);
                        }, 0);
                      } catch (calcErr) {
                        try { console.error('[PaymentsSave] calc error', calcErr, { participantsForm, formSelected: form?.selectedClients, paymentHiddenIds }); } catch {}
                        toast({ title: 'Erro ao processar participantes', description: 'Tente novamente.', variant: 'destructive' });
                        return;
                      }
                      try { console.debug('[PaymentsSave] pendingCount', { pendingCount, effectiveSelected: effectiveSelected.map(c => c.id) }); } catch {}
                      // manter apenas toast para usuário mais abaixo; sem logs adicionais

                      const tDel0 = Date.now();
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
                      try { console.debug('[PaymentsSave] delete ok', { ms: Date.now() - tDel0 }); } catch {}
                      
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
                      try { console.debug('[PaymentsSave] rows prepared', { count: rows.length, sample: rows.slice(0,3) }); } catch {}
                      
                      if (rows.length > 0) {
                        const tIns0 = Date.now();
                        const { data: inserted, error } = await supabase
                          .from('agendamento_participantes')
                          .insert(rows)
                          .select();
                        if (error) {
                          // erro tratado com toast abaixo
                          toast({ title: 'Erro ao salvar pagamentos', description: 'Falha ao inserir pagamentos.', variant: 'destructive' });
                          throw error;
                        }
                        try { console.debug('[PaymentsSave] insert ok', { insertedCount: inserted?.length || 0, ms: Date.now() - tIns0 }); } catch {}
                        
                      } else {
                        // nenhum participante selecionado
                        try { console.warn('[PaymentsSave] no rows to insert'); } catch {}
                      }
                      // Se houve remoções na UI (paymentHiddenIds), persistir também nos dados do agendamento (cliente_id e clientes)
                      try {
                        if ((paymentHiddenIds || []).length > 0) {
                          const newSelected = effectiveSelected;
                          const primary = newSelected[0] || null;
                          const clientesArr = newSelected.map(c => c?.nome).filter(Boolean);
                          const tUpd0 = Date.now();
                          await supabase
                            .from('agendamentos')
                            .update({
                              cliente_id: primary?.id ?? null,
                              clientes: clientesArr,
                            })
                            .eq('codigo_empresa', codigo)
                            .eq('id', agendamentoId);
                          try { console.debug('[PaymentsSave] booking updated after removals', { primaryId: primary?.id || null, count: newSelected.length, ms: Date.now() - tUpd0 }); } catch {}
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
                        const tRf0 = Date.now();
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
                          try { console.debug('[PaymentsSave] refresh participants ok', { count: freshParts?.length || 0, ms: Date.now() - tRf0 }); } catch {}
                        }
                      } catch (rfErr) {
                        // falha silenciosa; indicador pode não atualizar imediatamente
                        try { console.warn('[PaymentsSave] refresh participants failed', rfErr); } catch {}
                      }
                      
                      // Avalia total atribuído vs total alvo e pendências (notificações; salvamento não é bloqueado)
                      const totalTargetParsed = parseBRL(paymentTotal);
                      const totalTarget = Number.isFinite(totalTargetParsed) ? totalTargetParsed : 0;
                      const totalAssigned = (form.selectedClients || []).reduce((sum, c) => {
                        const pf = participantsForm.find(p => p.cliente_id === c.id);
                        const v = parseBRL(pf?.valor_cota);
                        return sum + (Number.isFinite(v) ? v : 0);
                      }, 0);
                      try { console.info('[PaymentsSave] totals', { totalTarget, totalAssigned, pendingCount }); } catch {}
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
                      try { console.info('[PaymentsSave] done', { ms: Date.now() - t0 }); } catch {}
                      // Fecha o modal de pagamentos e, em seguida, o modal principal
                      setIsPaymentModalOpen(false);
                      setIsModalOpen(false);
                    } catch (e) {
                      toast({ title: 'Erro ao salvar pagamentos', description: 'Tente novamente.', variant: 'destructive' });
                      // eslint-disable-next-line no-console
                      console.error('[PaymentsSave] error', e);
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
                /* console cleaned: onSaved */
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