import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Lock, Search, SlidersHorizontal, Clock, CheckCircle, XCircle, CalendarPlus, Users, DollarSign, Repeat, Trash2, GripVertical, Sparkles, Ban, AlertTriangle, ChevronDown, Play, PlayCircle, Flag, UserX, X, Settings, Maximize2, Minimize2 } from 'lucide-react';
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
import { listarFinalizadoras } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda } from '@/contexts/AgendaContext';
import { useAlerts } from '@/contexts/AlertsContext';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import ClientFormModal from '@/components/clients/ClientFormModal';
import PaymentModal from '@/components/agenda/PaymentModal';
import EditParticipantModal from '@/components/agenda/EditParticipantModal';
import WeeklyGrid from '@/components/agenda/WeeklyGrid';

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

// Funções auxiliares para visão semanal
function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 }); // segunda-feira
}

function getWeekDays(date) {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function getDayLabel(date) {
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  return labels[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

function getWeekRangeLabel(date) {
  const start = getWeekStart(date);
  const end = addDays(start, 6);
  // Se a semana está no mesmo mês, mostra: "24-30 de novembro de 2025"
  // Se está em meses diferentes, mostra: "28 de outubro - 3 de novembro de 2025"
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'dd')}-${format(end, 'dd')} de ${format(end, 'MMMM', { locale: ptBR })} de ${format(end, 'yyyy')}`;
  } else {
    return `${format(start, 'dd')} de ${format(start, 'MMMM', { locale: ptBR })} - ${format(end, 'dd')} de ${format(end, 'MMMM', { locale: ptBR })} de ${format(end, 'yyyy')}`;
  }
}

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

// Helper function para formatar minutos em HH:MM
const formatMinutesToTime = (minutes) => {
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // Converter 24:00 para 00:00
  if (h >= 24) h = h % 24;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

function AgendaPage({ sidebarVisible = false }) {
  const { toast } = useToast();
  const { loadAlerts } = useAlerts();
  const location = useLocation();
  
  // Context da Agenda
  const {
    isPaymentModalOpen,
    openPaymentModal,
    closePaymentModal,
    isEditParticipantModalOpen,
    openEditParticipantModal,
    closeEditParticipantModal,
    editParticipantData,
    editingBooking: editingBookingContext,
    setEditingBooking: setEditingBookingContext,
    participantsForm,
    setParticipantsForm,
    paymentTotal,
    setPaymentTotal,
    payMethods,
    setPayMethods
  } = useAgenda();
  // Debug toggle via localStorage: set localStorage.setItem('debug:agenda','1') to enable
  const debugOn = useMemo(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('debug:agenda') === '1'; } catch { return false; }
  }, []);
  const dbg = useCallback((...args) => { if (debugOn) { try { console.log('[AgendaDbg]', ...args); } catch {} } }, [debugOn]);
  // Console filter: keep console clean and show only the status summary line
  useEffect(() => {
    // If you need debugging again, comment out this whole block or adjust allowlist
    const origLog = console.log;
    const origInfo = console.info;
    const origDebug = console.debug;
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
        // Hide PaymentModal debug noise
        s.startsWith('[DEBUG-PaymentModal]') ||
        // s.startsWith('[PaymentModal]') || // TEMPORARIAMENTE DESABILITADO PARA DEBUG
        s.startsWith('🛡️ EditGuard')
      );
    };
    console.log = (...args) => {
      try { if (shouldSuppress(args[0])) return; } catch {}
      return origLog(...args);
    };
    console.info = (...args) => {
      try { if (shouldSuppress(args[0])) return; } catch {}
      return origInfo(...args);
    };
    console.debug = (...args) => {
      try { if (shouldSuppress(args[0])) return; } catch {}
      return origDebug(...args);
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
      console.info = origInfo;
      console.debug = origDebug;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [isGridExpanded, setIsGridExpanded] = useState(false); // expandir grid em tela cheia
  const [diasFuncionamento, setDiasFuncionamento] = useState({});
  const [loadingDiasFuncionamento, setLoadingDiasFuncionamento] = useState(false);
  const [weekDiasFuncionamento, setWeekDiasFuncionamento] = useState({}); // Funcionamento para toda a semana
  
  
  // Listener de teclado: Escape fecha expandido • F10 alterna modo expandir
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Fechar com ESC quando expandido
      if (e.key === 'Escape' && isGridExpanded) {
        setIsGridExpanded(false);
        return;
      }
      // Alternar expandir com F10
      if (e.key === 'F10') {
        try { e.preventDefault(); } catch {}
        setIsGridExpanded((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGridExpanded]);

  // Controlar orientação da tela no mobile quando expandir
  useEffect(() => {
    if (isGridExpanded && window.innerWidth < 768) {
      // Tentar forçar orientação landscape
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
          // Fallback: atualizar meta tag (silenciar erro de orientação não suportada)
          const metaTag = document.getElementById('screen-orientation-meta');
          if (metaTag) {
            metaTag.setAttribute('content', 'landscape');
          }
        });
      } else {
        // Fallback se screen.orientation não existir
        const metaTag = document.getElementById('screen-orientation-meta');
        if (metaTag) {
          metaTag.setAttribute('content', 'landscape');
        }
      }
    } else if (!isGridExpanded && window.innerWidth < 768) {
      // Voltar para orientação automática
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      // Atualizar meta tag
      const metaTag = document.getElementById('screen-orientation-meta');
      if (metaTag) {
        metaTag.setAttribute('content', 'portrait-primary');
      }
    }
  }, [isGridExpanded]);

  // Ler parâmetro date da URL ao carregar
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        // Adicionar 'T00:00:00' para evitar problemas de timezone
        const parsedDate = new Date(dateParam + 'T00:00:00');
        if (!isNaN(parsedDate.getTime())) {
          setCurrentDate(parsedDate);
          // Remover o parâmetro da URL após aplicar
          searchParams.delete('date');
          setSearchParams(searchParams, { replace: true });
        }
      } catch (e) {
        console.error('[AgendaPage] Erro ao parsear date da URL:', e);
      }
    }
  }, [searchParams, setSearchParams]);
  const [bookings, setBookings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Estados para agendamento fixo/recorrente
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [quantidadeSemanas, setQuantidadeSemanas] = useState(4);
  const [showRecorrenteConfirm, setShowRecorrenteConfirm] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  // editingBooking agora vem do contexto, mas vou criar um alias local
  const editingBooking = editingBookingContext;
  const setEditingBooking = setEditingBookingContext;
  // Participantes por agendamento (carregado após buscar bookings do dia)
  const [participantsByAgendamento, setParticipantsByAgendamento] = useState({});
  // Controle de concorrência e limpeza segura
  const participantsReqIdRef = useRef(0);
  const lastParticipantsDateKeyRef = useRef('');

  // Atualizar chips imediatamente quando PaymentModal salva
  useEffect(() => {
    const onPaymentsSaved = (e) => {
      try {
        const detail = e?.detail || {};
        const agendamentoId = detail.agendamentoId;
        const participants = detail.participants;
        if (!agendamentoId || !Array.isArray(participants)) return;
        setParticipantsByAgendamento((prev) => {
          const old = prev[agendamentoId] || [];
          const next = participants.map((p, idx) => {
            const prevP = old[idx] || {};
            return {
              ...prevP,
              cliente_id: p.cliente_id,
              nome: p.nome,
              codigo: (prevP.codigo !== undefined ? prevP.codigo : (p.codigo ?? null)),
              valor_cota: typeof p.valor_cota === 'string' ? p.valor_cota : (prevP.valor_cota ?? ''),
              status_pagamento: p.status_pagamento || prevP.status_pagamento || 'Pendente',
              finalizadora_id: p.finalizadora_id ?? prevP.finalizadora_id ?? null,
              aplicar_taxa: p.aplicar_taxa ?? prevP.aplicar_taxa ?? false,
              ordem: prevP.ordem ?? (idx + 1),
            };
          });
          return { ...prev, [agendamentoId]: next };
        });
      } catch {}
    };
    window.addEventListener('payments:saved', onPaymentsSaved);
    return () => window.removeEventListener('payments:saved', onPaymentsSaved);
  }, []);
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
  // Guard: janela curta após retornar da aba para amortecer automação/realtime
  const returningFromHiddenUntilRef = useRef(0);
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
  }, [isModalOpen]); // ✅ CORREÇÃO: Adiciona isModalOpen nas dependências
  
  // Abrir modal automaticamente quando vindo do Dashboard (apenas uma vez)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (location.state?.openModal && !isModalOpen && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      openBookingModal();
      // Limpar o state para não reabrir ao navegar de volta
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.openModal, isModalOpen, openBookingModal]);
  
  const [viewFilter, setViewFilter] = useState({ scheduled: true, available: true, canceledOnly: false, pendingPayments: false });

  // Lista de quadras vinda do banco (objetos com nome, modalidades, horario)
  const [dbCourts, setDbCourts] = useState(null);
  const [courtsLoading, setCourtsLoading] = useState(true);

  const courtsMap = useMemo(() => Object.fromEntries((dbCourts ?? []).map(c => [c.nome, c])), [dbCourts]);
  const availableCourts = useMemo(() => (dbCourts ?? []).map(c => c.nome), [dbCourts]);
  const [selectedCourts, setSelectedCourts] = useState([]);

  // Chaves de cache por empresa
  const companyCode = userProfile?.codigo_empresa;
  const courtsCacheKey = useMemo(() => companyCode ? `quadras:list:${companyCode}` : 'quadras:list', [companyCode]);
  const selectedCourtsKey = useMemo(() => companyCode ? `agenda:selectedCourts:${companyCode}` : 'agenda:selectedCourts', [companyCode]);
  const viewFilterKey = useMemo(() => companyCode ? `agenda:viewFilter:${companyCode}` : 'agenda:viewFilter', [companyCode]);
  
  // Estado para filtrar qual quadra está sendo visualizada (primeira quadra por padrão)
  const [activeCourtFilter, setActiveCourtFilter] = useState(null);
  
  // Estado para navegação mobile
  const [mobileCourtIndex, setMobileCourtIndex] = useState(0);
  
  // useEffect para selecionar primeira quadra automaticamente
  useEffect(() => {
    if (selectedCourts.length > 0 && activeCourtFilter === null) {
      setActiveCourtFilter(selectedCourts[0]);
    }
  }, [selectedCourts, activeCourtFilter]);

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

  // Chave de cache por empresa/data (yyyy-mm-dd) ou semana (prefixo week:yyyy-mm-dd do início da semana)
  const bookingsCacheKey = useMemo(() => {
    if (!userProfile?.codigo_empresa) return null;
    const keyDate = viewMode === 'week' ? format(getWeekStart(currentDate), 'yyyy-MM-dd') : format(currentDate, 'yyyy-MM-dd');
    const prefix = viewMode === 'week' ? 'week' : 'day';
    return `agenda:bookings:${userProfile.codigo_empresa}:${prefix}:${keyDate}`;
  }, [userProfile?.codigo_empresa, currentDate, viewMode]);

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
  const [savedAutomation, setSavedAutomation] = useState(defaultAutomation); // Último estado salvo no banco
  const [savingSettings, setSavingSettings] = useState(false);
  // Offset de horário do servidor (Brasília) em relação ao relógio local do dispositivo, em ms
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  // Função utilitária para obter o "agora" corrigido por offset (Brasília)
  const getNowMs = useCallback(() => Date.now() + (Number.isFinite(serverOffsetMs) ? serverOffsetMs : 0), [serverOffsetMs]);
  // Debug/status: última sincronização bem-sucedida de horário
  const [lastTimeSyncAtMs, setLastTimeSyncAtMs] = useState(null);
  // Carrega regras salvas do banco quando empresa está disponível
  // Removido: localStorage auto-save para evitar persistência sem clicar em Salvar

  // Carregar do banco (agenda_settings) quando empresa estiver disponível
  useEffect(() => {
    const loadSettings = async () => {
      console.log('[AgendaSettings][LOAD] Iniciando carregamento...', { authReady, company_id: company?.id });
      
      if (!authReady || !company?.id) {
        console.warn('[AgendaSettings][LOAD] Aguardando autenticação...');
        return;
      }
      
      try {
        console.log('[AgendaSettings][LOAD] Modo:', import.meta.env.PROD ? 'PRODUÇÃO (wrapper)' : 'DEV (client original)');
        console.log('[AgendaSettings][LOAD] Buscando para empresa_id:', company.id);
        
        const { data, error } = await supabase
          .from('agenda_settings')
          .select('*')
          .eq('empresa_id', company.id)
          .maybeSingle();
        
        console.log('[AgendaSettings][LOAD] Resultado da query:', { data, error });
        console.log('[AgendaSettings][LOAD] Data type:', data === null ? 'null' : typeof data);
        
        if (error) {
          // não quebra UX; mantém localStorage/defaults
          console.error('[AgendaSettings][LOAD] ERRO ao carregar:', error);
          return;
        }
        
        if (!data) {
          console.warn('[AgendaSettings][LOAD] Nenhum registro encontrado (ainda não criado)');
          return; // ainda não criado -> mantém defaults/local cache
        }
        
        console.log('[AgendaSettings][LOAD] ✅ Registro encontrado:', data);
        
        // Mapear colunas (horas -> minutos)
        const next = {
          autoConfirmEnabled: !!data.auto_confirm_enabled,
          autoConfirmMinutesBefore: data.auto_confirm_enabled && Number.isFinite(Number(data.auto_confirm_hours))
            ? Number(data.auto_confirm_hours) * 60
            : defaultAutomation.autoConfirmMinutesBefore,
          autoStartEnabled: !!data.auto_start_enabled,
          autoFinishEnabled: !!data.auto_finish_enabled,
        };
        
        console.log('[AgendaSettings][LOAD] ✅ Estado mapeado:', next);
        
        setAutomation((prev) => ({ ...prev, ...next }));
        setSavedAutomation(next); // Guardar como último estado salvo
        
        console.log('[AgendaSettings][LOAD] ✅ Estados atualizados com sucesso!');
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
  const handleSaveSettings = async () => {
    console.log('🔥🔥🔥 [AgendaSettings][SAVE] FUNÇÃO CHAMADA! 🔥🔥🔥');
    console.log('[AgendaSettings][SAVE] Linha 509 - Antes do try');
    
    try {
      console.log('[AgendaSettings][SAVE] Linha 511 - Dentro do try');
      console.log('[AgendaSettings][SAVE] authReady:', authReady);
      console.log('[AgendaSettings][SAVE] company:', company);
      
      if (!authReady || !company?.id) {
        console.error('[AgendaSettings][SAVE] ERRO: Não autenticado', { authReady, company });
        toast({ title: 'Não autenticado', description: 'Faça login para salvar as configurações.', variant: 'destructive' });
        return;
      }
      
      console.log('[AgendaSettings][SAVE] ✅ Autenticado! Preparando payload...');
      console.log('[AgendaSettings][SAVE] automation atual:', automation);
      
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
      
      console.log('[AgendaSettings][SAVE] Payload preparado:', payload);
      console.log('[AgendaSettings][SAVE] Modo:', import.meta.env.PROD ? 'PRODUÇÃO (wrapper)' : 'DEV (client original)');
      console.log('[AgendaSettings][SAVE] Supabase client type:', typeof supabase.from);
      
      const { data, error } = await supabase
        .from('agenda_settings')
        .upsert(payload, { onConflict: 'empresa_id' })
        .select();
      
      console.log('[AgendaSettings][SAVE] Resultado do upsert:', { data, error });
      console.log('[AgendaSettings][SAVE] Data type:', Array.isArray(data) ? 'array' : typeof data);
      console.log('[AgendaSettings][SAVE] Data length:', data?.length);
      
      if (error) {
        console.error('[AgendaSettings][SAVE] ❌ ERRO no upsert:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.error('[AgendaSettings][SAVE] ❌ AVISO: Upsert não retornou dados!');
      } else {
        console.log('[AgendaSettings][SAVE] ✅ Dados salvos com sucesso:', data[0]);
      }
      
      setSavedAutomation(automation); // Atualizar último estado salvo
      console.log('[AgendaSettings][SAVE] ✅ savedAutomation atualizado:', automation);
      
      toast({ title: 'Configurações salvas', description: 'As automações da agenda foram atualizadas com sucesso.' });
      setIsSettingsOpen(false);
      
      console.log('[AgendaSettings][SAVE] ✅ Salvamento concluído!');
    } catch (e) {
      console.error('❌❌❌ [AgendaSettings][SAVE] ERRO CAPTURADO:', e);
      console.error('[AgendaSettings][SAVE] Stack:', e?.stack);
      console.error('[AgendaSettings][SAVE] Message:', e?.message);
      const message = e?.message || 'Falha ao salvar as configurações.';
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' });
    } finally {
      console.log('[AgendaSettings][SAVE] Finally executado');
      setSavingSettings(false);
    }
  };

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
        const next = { ...b, status: newStatus, customer: b.customer || '' }; // Preservar customer
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
                const next = { ...b, status: newStatus, customer: b.customer || '' }; // Preservar customer
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
    // Evita re-renders e timers durante janela crítica ou modal aberto
    const now = Date.now();
    if (now < (returningFromHiddenUntilRef.current || 0)) {
      console.log('[AutoDiag] scheduleNextAutomation:deferred returning-from-hidden');
      setTimeout(() => scheduleNextAutomation(), 600);
      return;
    }
    if (modalOpenRef.current) { dbg('scheduleNextAutomation:skipped (modal open)'); return; }
    pulseLog('auto:schedule');
    clearNextAutoTimer();
    const nowMs = getNowMs();
    let nextTs = Infinity;
    const consider = (ts) => { if (Number.isFinite(ts) && ts > nowMs && ts < nextTs) nextTs = ts; };
    try {
      for (const b of (bookings || [])) {
        if (!b || b.auto_disabled) continue;
        if (isOverriddenRecently(b.id)) continue;
        const startTs = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        const endTs = b.end instanceof Date ? b.end.getTime() : new Date(b.end).getTime();
        if (b.status === 'scheduled' && savedAutomation.autoConfirmEnabled) {
          const msBefore = Number(savedAutomation.autoConfirmMinutesBefore || 0) * 60000;
          consider(startTs - msBefore);
          if (savedAutomation.autoFinishEnabled) consider(endTs); // catch-up finish
        }
        if (b.status === 'confirmed') {
          if (savedAutomation.autoStartEnabled) consider(startTs);
          if (savedAutomation.autoFinishEnabled) consider(endTs);
        }
        if (b.status === 'in_progress' && savedAutomation.autoFinishEnabled) {
          consider(endTs);
        }
      }
    } catch {}
    if (nextTs !== Infinity) {
      const delay = Math.max(0, Math.min(nextTs - nowMs + 250, 10 * 60 * 1000)); // pequeno buffer de 250ms
      try { console.debug('[Auto] next schedule in ms', delay); } catch {}
      try { setNextAutoAtMs(nextTs); } catch {}
      nextAutoTimerRef.current = setTimeout(() => { try { runAutomationRef.current && runAutomationRef.current(); } catch {} }, delay);
    }
  }, [authReady, userProfile?.codigo_empresa, bookings, savedAutomation, isOverriddenRecently, clearNextAutoTimer, getNowMs]);
  
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
            customer: booking.customer || '', // Preservar customer
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
            // Ordem: finalizar > iniciar direto (skip confirm se aplicável) > iniciar > confirmar > catch-up finish (usar savedAutomation)
            if (cand.status === 'in_progress' && savedAutomation.autoFinishEnabled && Number.isFinite(endTs) && nowTs >= endTs) {
              await updateBookingStatus(cand.id, 'finished', 'automation');
            } else if (cand.status === 'scheduled' && savedAutomation.autoStartEnabled && Number.isFinite(startTs) && nowTs >= startTs) {
              // Pular direto para in_progress se autoStart estiver ativo
              await updateBookingStatus(cand.id, 'in_progress', 'automation');
            } else if (cand.status === 'confirmed' && savedAutomation.autoStartEnabled && Number.isFinite(startTs) && nowTs >= startTs) {
              await updateBookingStatus(cand.id, 'in_progress', 'automation');
            } else if (cand.status === 'scheduled' && savedAutomation.autoConfirmEnabled && Number.isFinite(startTs)) {
              const msBefore = Number(savedAutomation.autoConfirmMinutesBefore || 0) * 60000;
              if (nowTs >= (startTs - msBefore)) {
                await updateBookingStatus(cand.id, 'confirmed', 'automation');
              }
            } else if ((cand.status === 'scheduled' || cand.status === 'confirmed') && savedAutomation.autoFinishEnabled && Number.isFinite(endTs) && nowTs >= endTs) {
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

        // Ordem: finalizar > iniciar > confirmar (usar savedAutomation ao invés de automation)
        if (b.status === 'in_progress' && savedAutomation.autoFinishEnabled) {
          if (nowTs >= endTs) { try { console.debug('[Auto] finish', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'finished', 'automation'); anyChange = true; continue; }
        }
        
        // Permitir pular de scheduled direto para in_progress se autoStart estiver ativo e já passou do horário
        if (b.status === 'scheduled' && savedAutomation.autoStartEnabled && nowTs >= startTs) {
          try { console.debug('[Auto] start-direct (skip confirm)', { id: b.id }); } catch {};
          await updateBookingStatus(b.id, 'in_progress', 'automation');
          anyChange = true;
          continue;
        }
        
        if (b.status === 'confirmed' && savedAutomation.autoStartEnabled) {
          if (nowTs >= startTs) { try { console.debug('[Auto] start', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'in_progress', 'automation'); anyChange = true; continue; }
        }
        if (b.status === 'scheduled' && savedAutomation.autoConfirmEnabled) {
          const msBefore = Number(savedAutomation.autoConfirmMinutesBefore || 0) * 60000;
          if (nowTs >= (startTs - msBefore)) { try { console.debug('[Auto] confirm', { id: b.id }); } catch {}; await updateBookingStatus(b.id, 'confirmed', 'automation'); anyChange = true; continue; }
        }
        // Catch-up: se ficou agendado/confirmado e já passou do fim, finalize direto
        if ((b.status === 'scheduled' || b.status === 'confirmed') && savedAutomation.autoFinishEnabled) {
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
  }, [authReady, userProfile?.codigo_empresa, bookings, savedAutomation, updateBookingStatus, isOverriddenRecently, scheduleNextAutomation, getNowMs]);

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
        const enabled = !!(savedAutomation?.autoConfirmEnabled || savedAutomation?.autoStartEnabled || savedAutomation?.autoFinishEnabled);
        if (!enabled) return;
        if (runAutomationRef.current) {
          console.debug('[Auto][Watchdog] forcing periodic automation run');
          runAutomationRef.current();
        }
      } catch {}
    }, 30 * 60 * 1000);
    return () => clearInterval(watchdog);
  }, [savedAutomation]);

  


  // Hidrata agendamentos a partir do cache antes da busca (simplificado)
  useEffect(() => {
    if (!bookingsCacheKey) return;
    try {
      const cached = JSON.parse(localStorage.getItem(bookingsCacheKey) || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        const mapped = cached.map((b) => ({ 
          ...b, 
          start: new Date(b.start), 
          end: new Date(b.end),
          customer: b.customer || '', // Garantir que customer existe
        }));
        dbg('cache:bookings:hydrate', { count: mapped.length, sample: mapped[0] });
        pulseLog('cache:hydrate', { count: mapped.length });
        setBookings((prev) => (prev && prev.length > 0 ? prev : mapped));
        setUiBusy(1200);
      }
    } catch {}
  }, [bookingsCacheKey, dbg]);

  // Visibilidade/foco: comportamento desativado para evitar pulsos ao retornar à aba
  // (Antes: reidratava cache, executava automação e refetch em visibility/focus)
  // useEffect(() => {}, []);

  // Diagnóstico e guard: logs e janela curta ao retornar da aba (sem efeitos funcionais além do guard)
  useEffect(() => {
    const onVis = () => {
      try {
        const ts = new Date().toISOString();
        // [VisDebug] silenciado
        if (document.visibilityState === 'visible') {
          const now = Date.now();
          returningFromHiddenUntilRef.current = now + 800;
          // [GuardDiag] silenciado
        }
      } catch {}
    };
    const onFocus = () => {
      try {
        const ts = new Date().toISOString();
        // [VisDebug] silenciado
      } catch {}
    };
    const onBlur = () => {
      try {
        const ts = new Date().toISOString();
        // [VisDebug] silenciado
      } catch {}
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [isModalOpen, bookings]);

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
    // Evita fetch durante janela crítica pós-retorno de aba ou com modal aberto
    if (Date.now() < (returningFromHiddenUntilRef.current || 0)) {
      // [GuardDiag] silenciado
      return;
    }
    if (isModalOpen) {
      // [GuardDiag] silenciado
      return;
    }
    dbg('fetchBookings:start', { date: format(currentDate, 'yyyy-MM-dd'), empresa: userProfile?.codigo_empresa });
    pulseLog('fetch:start', { day: format(currentDate, 'yyyy-MM-dd') });
    // Seleciona o período conforme a visão (dia ou semana)
    const dayStart = startOfDay(currentDate);
    const periodStart = viewMode === 'week' ? getWeekStart(currentDate) : dayStart;
    const periodEnd = viewMode === 'week' ? addDays(periodStart, 7) : addDays(periodStart, 1);
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        id, codigo, codigo_empresa, quadra_id, cliente_id, clientes, inicio, fim, modalidade, status, auto_disabled,
        quadra:quadra_id ( nome )
      `)
      .eq('codigo_empresa', userProfile.codigo_empresa)
      .gte('inicio', periodStart.toISOString())
      .lt('inicio', periodEnd.toISOString())
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
      
      // Nome do cliente: SEMPRE buscar dos participantes primeiro (contém histórico editado)
      let customerName = '';
      
      // Prioridade 1: buscar dos participantes já carregados (histórico editado)
      if (participantsByAgendamento[row.id]) {
        const participants = participantsByAgendamento[row.id];
        if (Array.isArray(participants) && participants.length > 0) {
          customerName = participants[0]?.nome || '';
        }
      }
      
      // Fallback: se não tem participantes carregados, buscar do array clientes (legado)
      if (!customerName && row.clientes) {
        try {
          const clientesArray = typeof row.clientes === 'string' ? JSON.parse(row.clientes) : row.clientes;
          if (Array.isArray(clientesArray) && clientesArray.length > 0) {
            customerName = clientesArray[0]?.nome || clientesArray[0] || '';
          }
        } catch {}
      }
      
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
    // Persistir no cache (serializando datas e garantindo customer)
    try {
      if (bookingsCacheKey) {
        const serializable = mapped.map(b => ({
          id: b.id,
          code: b.code,
          court: b.court,
          customer: b.customer, // Garantir que customer está sendo salvo
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          status: b.status,
          modality: b.modality,
          auto_disabled: b.auto_disabled,
        }));
        localStorage.setItem(bookingsCacheKey, JSON.stringify(serializable));
      }
    } catch {}
  }, [authReady, userProfile?.codigo_empresa, currentDate, courtsMap, bookingsCacheKey, toast, dbg, debugOn, participantsByAgendamento]);

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
    // 🔴 REAL-TIME DESABILITADO - Plano gratuito Supabase limita a 2 conexões simultâneas
    // Para reabilitar: remova os comentários abaixo
    // const channel = supabase
    //   .channel(`agendamentos:${userProfile.codigo_empresa}`)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `codigo_empresa=eq.${userProfile.codigo_empresa}` }, onChange)
    //   .subscribe((status) => { try { console.debug('[Realtime] channel status', status); } catch {}; try { setRealtimeStatus(String(status || 'unknown')); } catch {} });
    
    // ✅ POLLING: Recarrega agendamentos a cada 30 segundos
    const pollingInterval = setInterval(() => {
      if (!modalOpenRef.current) {
        fetchBookings();
      }
    }, 30000); // 30 segundos
    
    return () => {
      try { if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current); } catch {}
      // try { supabase.removeChannel(channel); } catch {}
      try { clearInterval(pollingInterval); } catch {}
      try { setRealtimeStatus('polling'); } catch {}
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
      const rtOk = String(realtimeStatus).toUpperCase() === 'SUBSCRIBED' || String(realtimeStatus).toLowerCase() === 'polling';
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
        // Skip durante janela crítica ou modal aberto
        if (now < (returningFromHiddenUntilRef.current || 0)) {
          console.log('[AutoDiag] reconcile:skipped returning-from-hidden');
          return;
        }
        if (isModalOpen) {
          console.log('[AutoDiag] reconcile:skipped modal-open');
          return;
        }
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
      // Evita carregamento durante janela crítica pós-retorno ou com modal aberto
      if (Date.now() < (returningFromHiddenUntilRef.current || 0)) {
        // [GuardDiag] silenciado
        return;
      }
      if (modalOpenRef.current) { dbg('Participants:skipped (modal open)'); return; }
      dbg('Participants:load start'); pulseLog('parts:start');
      const ids = (bookings || []).map(b => b.id).filter(Boolean);
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      // Evita wipe em estados transitórios de carregamento de bookings
      if (!ids.length) {
        if (lastParticipantsDateKeyRef.current !== dateKey) {
          setParticipantsByAgendamento({});
          try { if (participantsCacheKey) localStorage.setItem(participantsCacheKey, '{}'); } catch {}
        }
        lastParticipantsDateKeyRef.current = dateKey;
        return;
      }
      const reqId = ++participantsReqIdRef.current;
      const { data, error } = await supabase
        .from('agendamento_participantes')
        .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento, finalizadora_id, aplicar_taxa, cliente:clientes!agendamento_participantes_cliente_id_fkey(nome, codigo)')
        .in('agendamento_id', ids)
        .order('ordem', { ascending: true }); // Ordena por campo ordem explícito
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

        // Priorizar nome da tabela agendamento_participantes (histórico editado) sobre o nome do cliente (cadastro)
        const nomeResolvido = row.nome || (Array.isArray(row.cliente) ? row.cliente[0]?.nome : row.cliente?.nome) || '';
        const codigoResolvido = (Array.isArray(row.cliente) ? row.cliente[0]?.codigo : row.cliente?.codigo) || null;

        map[k].push({ ...row, nome: nomeResolvido, codigo: codigoResolvido });
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

  // Carregar dias de funcionamento das quadras para a data atual
  useEffect(() => {
    const loadDiasFuncionamento = async () => {
      if (!authReady || !userProfile?.codigo_empresa || !availableCourts.length) return;
      
      setLoadingDiasFuncionamento(true);
      
      try {
        const dataFormatada = format(currentDate, 'yyyy-MM-dd');
        const diaSemana = currentDate.getDay();
        
        // Buscar configurações para todas as quadras
        const { data: configuracoes, error } = await supabase
          .from('quadras_dias_funcionamento')
          .select('*')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .or(`and(tipo.eq.data_fechamento,data_fechamento.eq.${dataFormatada}),and(tipo.eq.dia_semana,dia_semana.eq.${diaSemana})`);
        
        if (error) {
          console.error('Erro ao carregar dias de funcionamento:', error);
          return;
        }
        
        const funcionamentoPorQuadra = {};
        
        // Para cada quadra, verificar se funciona
        availableCourts.forEach(quadraNome => {
          const quadra = courtsMap[quadraNome];
          if (!quadra) return;
          
          // Verificar fechamento específico para esta data
          const fechamentoEspecifico = configuracoes?.find(
            config => config.quadra_id === quadra.id && 
                     config.tipo === 'data_fechamento' && 
                     config.data_fechamento === dataFormatada
          );
          
          if (fechamentoEspecifico && !fechamentoEspecifico.funciona) {
            funcionamentoPorQuadra[quadraNome] = {
              funciona: false,
              motivo: 'data_especifica',
              observacao: fechamentoEspecifico.observacao || 'Fechamento especial'
            };
            return;
          }
          
          // Verificar funcionamento do dia da semana
          const funcionamentoSemanal = configuracoes?.find(
            config => config.quadra_id === quadra.id && 
                     config.tipo === 'dia_semana' && 
                     config.dia_semana === diaSemana
          );
          
          if (funcionamentoSemanal) {
            funcionamentoPorQuadra[quadraNome] = {
              funciona: funcionamentoSemanal.funciona,
              motivo: funcionamentoSemanal.funciona ? 'normal' : 'dia_semana',
              observacao: funcionamentoSemanal.funciona ? null : 'Fechado neste dia da semana'
            };
          } else {
            // Se não tem configuração, assume que funciona
            funcionamentoPorQuadra[quadraNome] = {
              funciona: true,
              motivo: 'normal',
              observacao: null
            };
          }
        });
        
        setDiasFuncionamento(funcionamentoPorQuadra);
        
      } catch (error) {
        console.error('Erro ao verificar dias de funcionamento:', error);
      } finally {
        setLoadingDiasFuncionamento(false);
      }
    };
    
    loadDiasFuncionamento();
  }, [authReady, userProfile?.codigo_empresa, currentDate, availableCourts, courtsMap]);

  // Carregar funcionamento para toda a semana (para a visão semanal)
  useEffect(() => {
    if (!authReady || !userProfile?.codigo_empresa || availableCourts.length === 0) return;

    const loadWeekDiasFuncionamento = async () => {
      try {
        // Obter início da semana
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        // Buscar configurações para toda a semana
        const { data: configuracoes, error } = await supabase
          .from('quadras_dias_funcionamento')
          .select('*')
          .eq('codigo_empresa', userProfile.codigo_empresa);

        if (error) {
          console.error('Erro ao carregar funcionamento da semana:', error);
          return;
        }

        const weekFuncionamento = {};

        // Para cada dia da semana
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          const dataFormatada = format(dayDate, 'yyyy-MM-dd');
          const diaSemana = dayDate.getDay();

          const dayFuncionamento = {};

          // Para cada quadra
          availableCourts.forEach(quadraNome => {
            const quadra = courtsMap[quadraNome];
            if (!quadra) return;

            // Verificar fechamento específico para esta data
            const fechamentoEspecifico = configuracoes?.find(
              config => config.quadra_id === quadra.id &&
                       config.tipo === 'data_fechamento' &&
                       config.data_fechamento === dataFormatada
            );

            if (fechamentoEspecifico && !fechamentoEspecifico.funciona) {
              dayFuncionamento[quadraNome] = {
                funciona: false,
                motivo: 'data_especifica',
                observacao: fechamentoEspecifico.observacao || 'Fechamento especial'
              };
              return;
            }

            // Verificar funcionamento do dia da semana
            const funcionamentoSemanal = configuracoes?.find(
              config => config.quadra_id === quadra.id &&
                       config.tipo === 'dia_semana' &&
                       config.dia_semana === diaSemana
            );

            if (funcionamentoSemanal) {
              dayFuncionamento[quadraNome] = {
                funciona: funcionamentoSemanal.funciona,
                motivo: funcionamentoSemanal.funciona ? 'normal' : 'dia_semana',
                observacao: funcionamentoSemanal.funciona ? null : 'Fechado neste dia da semana'
              };
            } else {
              dayFuncionamento[quadraNome] = {
                funciona: true,
                motivo: 'normal',
                observacao: null
              };
            }
          });

          weekFuncionamento[dataFormatada] = dayFuncionamento;
        }

        setWeekDiasFuncionamento(weekFuncionamento);
      } catch (error) {
        console.error('Erro ao carregar funcionamento da semana:', error);
      }
    };

    loadWeekDiasFuncionamento();
  }, [authReady, userProfile?.codigo_empresa, currentDate, availableCourts, courtsMap]);

  // Rolar para o topo quando mudar para um dia com quadras fechadas
  useEffect(() => {
    const hasClosedCourts = Object.values(diasFuncionamento).some(info => !info.funciona);
    
    if (hasClosedCourts && scrollRef.current) {
      // Não alterar o scroll automaticamente; manter posição (geralmente próxima do horário atual)
    }
  }, [diasFuncionamento]);

  // Carregar quadras do banco por empresa (inclui modalidades e horários)
  useEffect(() => {
    // Hidratar quadras do cache específico da empresa para evitar sumiço ao trocar de aba
    if (!companyCode) return;
    try {
      const cached = JSON.parse(localStorage.getItem(courtsCacheKey) || '[]');
      if (Array.isArray(cached) && cached.length && (!dbCourts || dbCourts.length === 0)) {
        setDbCourts(cached);
        setCourtsLoading(false);
      }
    } catch {}
  }, [companyCode, courtsCacheKey]);

  useEffect(() => {
    const loadCourts = async () => {
      if (!userProfile?.codigo_empresa) return;
      
      // ✅ CORREÇÃO: Verifica se o cache é da empresa atual, senão limpa
      try {
        const cached = JSON.parse(localStorage.getItem(courtsCacheKey) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          const cachedEmpresa = cached[0]?.codigo_empresa;
          if (cachedEmpresa && cachedEmpresa !== userProfile.codigo_empresa) {
            console.warn('🧹 [Cache Limpo] Quadras de outra empresa detectadas e removidas');
            localStorage.removeItem(courtsCacheKey);
            localStorage.removeItem(selectedCourtsKey);
            setDbCourts([]);
            // Evita mostrar nome de quadra de outra empresa no SelectValue
            try { setSelectedCourts([]); } catch {}
            try { setActiveCourtFilter(null); } catch {}
            try { setForm((f) => ({ ...f, court: '' })); } catch {}
          }
        }
      } catch {}
      
      // Mantém UI responsiva: só ativa loading "forte" quando não há cache
      if (!dbCourts || dbCourts.length === 0) setCourtsLoading(true);
      const { data, error } = await supabase
        .from('quadras')
        .select('id, nome, modalidades, hora_inicio, hora_fim, valor, codigo_empresa, status')
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .eq('status', 'Ativa')  // Filtrar apenas quadras ativas
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
      try { localStorage.setItem(courtsCacheKey, JSON.stringify(rows)); } catch {}
      setCourtsLoading(false);
    };
    if (authReady && userProfile?.codigo_empresa) {
      loadCourts();
    }
  }, [authReady, userProfile?.codigo_empresa, courtsCacheKey, selectedCourtsKey]);

  // Corrige o valor exibido do select de quadra quando a lista disponível muda
  useEffect(() => {
    try {
      if (courtsLoading) return;
      const list = availableCourts || [];
      // Se a quadra atual não existe na empresa/consulta atual, seleciona a primeira disponível
      if (form?.court && !list.includes(form.court)) {
        setForm((f) => ({ ...f, court: list[0] || '' }));
      }
      // Se não há nenhuma selecionada e existem quadras, seleciona a primeira
      if ((!form?.court || form.court === '') && list.length > 0) {
        setForm((f) => ({ ...f, court: list[0] }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtsLoading, availableCourts, userProfile?.codigo_empresa]);

  // Restaurar seleção e filtros de localStorage ao montar e sincronizar com quadras disponíveis
  useEffect(() => {
    // só roda quando quadras carregadas
    if (courtsLoading) return;
    const savedSel = (() => {
      try { return JSON.parse(localStorage.getItem(selectedCourtsKey) || '[]'); } catch { return []; }
    })();
    const savedFilter = (() => {
      try { return JSON.parse(localStorage.getItem(viewFilterKey) || '{}'); } catch { return {}; }
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
    try { localStorage.setItem(selectedCourtsKey, JSON.stringify(selectedCourts)); } catch {}
  }, [selectedCourts, selectedCourtsKey]);
  useEffect(() => {
    try { localStorage.setItem(viewFilterKey, JSON.stringify(viewFilter)); } catch {}
  }, [viewFilter, viewFilterKey]);

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
        // Tratar 00:00:00 como 24:00 (meia-noite = fim do dia)
        const hours = (h === 0 && m === 0) ? 24 : (h || 0);
        return hours * 60 + (m || 0);
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

  const BookingCard = ({ booking, courtGridStart, courtGridEnd }) => {
    const slotHeight = SLOT_HEIGHT;
    // Minutos absolutos do dia
    const minutesFromMidnight = (date) => {
      const h = getHours(date);
      const m = getMinutes(date);
      // Se for 00:00 (meia-noite), tratar como 24:00 (1440 minutos)
      if (h === 0 && m === 0) return 1440;
      return h * 60 + m;
    };
    const startAbs = minutesFromMidnight(booking.start);
    const endAbs = minutesFromMidnight(booking.end);

    // Converter para minutos desde START_HOUR
    // Usar horários passados via props (calculados no contexto do grid)
    const gridStartM = courtGridStart !== undefined ? courtGridStart : (activeCourtFilter ? activeCourtHours.start * 60 : dayStartHour * 60);
    const gridEndM = courtGridEnd !== undefined ? courtGridEnd : (activeCourtFilter ? activeCourtHours.end * 60 : dayEndHourExclusive * 60);
    
    const startMinutes = startAbs - gridStartM;
    const endMinutes = endAbs - gridStartM;

    // Total de slots no dia
    const totalSlots = (gridEndM - gridStartM) / SLOT_MINUTES;

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
    const paidCount = participants.filter(p => String(p.status_pagamento || '').toLowerCase() === 'pago').length;
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
            {/* Linha 1: Nome do cliente */}
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-text-primary truncate text-base" style={{ fontSize: namePx, lineHeight: 1.15 }}>{shortName(booking.customer)}</p>
              {isHalfHour && (
                <span className="text-xs font-bold text-white truncate bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600/60 rounded-md px-2 py-0.5 whitespace-nowrap shadow-md" style={{ fontSize: smallPx }}>
                  {booking.modality}
                </span>
              )}
            </div>
            
            {/* Linha 2: Horário + Status + Pagamentos */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Horário - sempre visível completo */}
              <span className={cn("text-text-muted font-semibold text-base whitespace-nowrap") } style={{ fontSize: namePx }}>
                {format(booking.start, 'HH:mm')}–{format(booking.end, 'HH:mm')}
              </span>
              
              {/* Status (apenas em meia hora) */}
              {isHalfHour && (
                <div className="flex items-center gap-1">
                  <Icon className={cn(config.text)} style={{ width: iconPx, height: iconPx }} />
                  <span className={cn("truncate font-semibold", config.text, "text-base")} style={{ fontSize: namePx }}>{config.label}</span>
                </div>
              )}
              
              {/* Indicador de pagamento de participantes (pago/total) — em layout meia hora */}
              {isHalfHour && totalParticipants > 0 && (
                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${paidCount === totalParticipants ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' : 'text-amber-300 bg-amber-500/10 border-amber-400/30'}`} style={{ fontSize: Math.max(11, Math.round(11 * (isLong ? scale : 1))) }}>
                  {paidCount}/{totalParticipants}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
              {!isHalfHour && (
                <span className="text-xs font-bold text-white truncate bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600/60 rounded-md px-2.5 py-1 shadow-md" style={{ fontSize: smallPx }}>
                  {booking.modality}
                </span>
              )}
              {!isHalfHour && (
                <div className="flex items-center gap-1.5 text-base flex-wrap justify-end">
                  <div className="flex items-center gap-1">
                    <Icon className={cn(config.text)} style={{ width: iconPx, height: iconPx }} />
                    <span className={cn("truncate font-semibold", config.text)} style={{ fontSize: namePx }}>
                      {(() => {
                        const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
                        if (isMobileView && booking.status === 'in_progress') {
                          return 'Andamento';
                        }
                        return config.label;
                      })()}
                    </span>
                  </div>
                  {/* Chip de pagamentos ao lado direito do status */}
                  {totalParticipants > 0 && (() => {
                    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
                    return (
                      <span 
                        className={cn(
                          "font-bold rounded-full border flex items-center gap-1 whitespace-nowrap",
                          isHalfHour ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
                          paidCount === totalParticipants 
                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' 
                            : 'text-amber-300 bg-amber-500/10 border-amber-400/30'
                        )} 
                        style={{ fontSize: Math.max(isHalfHour ? 11 : 13, Math.round((isHalfHour ? 11 : 13) * (isLong ? scale : 1))) }}
                      >
                        <DollarSign className="w-3 h-3 flex-shrink-0" />
                        <span className="whitespace-nowrap">{paidCount}/{totalParticipants}{isMobileView ? '' : ' pagos'}</span>
                      </span>
                    );
                  })()}
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
    
    // Pegar funções do contexto para sincronizar
    const { setBookingForm, setLocalCustomers: setLocalCustomersContext } = useAgenda();
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
      // Tratar 00:00:00 como 24:00 (meia-noite)
      const endHours = (eh === 0 && em === 0) ? 24 : eh;
      return { start: sh * 60 + (sm || 0), end: endHours * 60 + (em || 0) };
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
      // Encontrar primeira quadra disponível (que não esteja fechada)
      const getAvailableCourt = () => {
        const firstAvailable = availableCourts.find(court => 
          !diasFuncionamento[court] || diasFuncionamento[court].funciona
        );
        return firstAvailable || availableCourts[0] || '';
      };
      
      return {
        selectedClients: initialSelected, // [{id, nome, codigo?}]
        court: getAvailableCourt(),
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
      // [DEBUG-PaymentModal] silenciado
      selectedClientsRef.current = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      try { if ((selectedClientsRef.current || []).length > 0) userSelectedOnceRef.current = true; } catch {}
    }, [form.selectedClients]);
    
    const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [focusedCustomerIndex, setFocusedCustomerIndex] = useState(0);
    // Janela de bloqueio para ignorar fechamentos logo após retornar à aba
    const pickerBlockUntilRef = useRef(0);
    // Se o usuário saiu da aba com o picker aberto, reabrir uma vez ao voltar
    const pickerWasOpenOnHideRef = useRef(false);
    useEffect(() => {
      const onVis = () => {
        try {
          if (document.visibilityState === 'hidden') {
            pickerWasOpenOnHideRef.current = !!(effectiveCustomerPickerOpen || isCustomerPickerOpen);
            const now = Date.now();
            // Janela curta de proteção para evitar flapping logo ao retornar
            try { selectionLockUntilRef.current = now + 1200; } catch {}
            try { suppressPickerCloseRef.current = now + 1200; } catch {}
            try { pickerBlockUntilRef.current = now + 800; } catch {}
            // [PickerDiag] silenciado
          } else if (document.visibilityState === 'visible') {
            const wasOpen = pickerWasOpenOnHideRef.current;
            pickerWasOpenOnHideRef.current = false;
            const now = Date.now();
            // Reforça janelas de proteção por mais alguns ms ao voltar
            try { selectionLockUntilRef.current = Math.max(selectionLockUntilRef.current || 0, now + 600); } catch {}
            try { suppressPickerCloseRef.current = Math.max(suppressPickerCloseRef.current || 0, now + 600); } catch {}
            try { pickerBlockUntilRef.current = Math.max(pickerBlockUntilRef.current || 0, now + 400); } catch {}
            // [PickerDiag] silenciado
            if (wasOpen && !modalOpenRef.current) {
              // Reabre uma única vez com pequeno atraso (só se modal não estiver aberto)
              setTimeout(() => {
                if (!modalOpenRef.current) {
                  setIsCustomerPickerOpen(true);
                  setEffectiveCustomerPickerOpen(true);
                  // [PickerDiag] silenciado
                } else {
                  // [PickerDiag] silenciado
                }
              }, 60);
            }
          }
        } catch {}
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }, [effectiveCustomerPickerOpen, isCustomerPickerOpen, isModalOpen]);

    // Log de qualquer mudança de estado do picker, com janelas de guarda ativas
    useEffect(() => {
      const now = Date.now();
      // [PickerDiag] silenciado
    }, [isCustomerPickerOpen, effectiveCustomerPickerOpen]);
    // Track transitions of selectedClients length (moved after picker state declarations to avoid TDZ)
    const prevSelLenRef = useRef(0);
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      const cur = Array.isArray(form.selectedClients) ? form.selectedClients.length : -1;
      const prev = prevSelLenRef.current;
      if (cur !== prev) {
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
      setChipsSnapshot(arr);
    }, []);
    // Ref para o input de busca (para focar após limpar)
    const customerQueryInputRef = useRef(null);
    // Ref para o container da lista de clientes (para scroll automático)
    const customerListContainerRef = useRef(null);
    // Ref para os botões de clientes (para scroll no item focado)
    const customerButtonRefs = useRef([]);
    
    // Scroll automático para o item focado
    useEffect(() => {
      if (effectiveCustomerPickerOpen && customerButtonRefs.current[focusedCustomerIndex]) {
        customerButtonRefs.current[focusedCustomerIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }, [focusedCustomerIndex, effectiveCustomerPickerOpen]);
    
    // Resetar foco ao abrir o picker
    useEffect(() => {
      if (effectiveCustomerPickerOpen) {
        setFocusedCustomerIndex(0);
      }
    }, [effectiveCustomerPickerOpen]);
    
    // Participantes (apenas no modo edição): { cliente_id, nome, valor_cota, status_pagamento, finalizadora_id }
    // participantsForm e payMethods agora vem do contexto
    // payMethods já vem do contexto
    // isPaymentModalOpen já vem do contexto
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [clientsLoading, setClientsLoading] = useState(false);
    // Saving flags
    const [isSavingPayments, setIsSavingPayments] = useState(false);
    const [isSavingBooking, setIsSavingBooking] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    
    // Refs para auto-save
    const autoSaveTimeoutRef = useRef(null);
    const lastSavedFormRef = useRef(null);
    const autoSaveEnabledRef = useRef(false); // Só ativa após inicialização completa

    // Carrega finalizadoras quando o modal de pagamentos abre
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      if (!isPaymentModalOpen) return;
      let cancelled = false;
      (async () => {
        try {
          if (!authReady || !userProfile?.codigo_empresa) return;
          const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa: userProfile.codigo_empresa });
          if (!cancelled) setPayMethods(Array.isArray(fins) ? fins : []);
        } catch {}
      })();
      return () => { cancelled = true; };
    }, [isPaymentModalOpen, authReady, userProfile?.codigo_empresa]);

    // Define uma finalizadora padrão para linhas sem seleção
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      if (!isPaymentModalOpen) return;
      if (!Array.isArray(payMethods) || payMethods.length === 0) return;
      const def = String(payMethods[0].id);
      setParticipantsForm(prev => {
        // [DEBUG-PaymentModal] silenciado
        // Se participantsForm está vazio, inicializar com os clientes selecionados
        if (prev.length === 0 && Array.isArray(form.selectedClients) && form.selectedClients.length > 0) {
          const initialized = form.selectedClients.map(c => ({
            cliente_id: c.id,
            nome: c.nome,
            valor_cota: '',
            status_pagamento: 'Pendente',
            finalizadora_id: def,
          }));
          // Removed verbose PaymentModal log
          return initialized;
        }
        // ✅ CORREÇÃO: Só define padrão se finalizadora_id for explicitamente null/undefined/vazio
        // NÃO sobrescreve finalizadoras já salvas
        const updated = prev.map(p => ({ 
          ...p, 
          finalizadora_id: (p.finalizadora_id && p.finalizadora_id !== '') ? p.finalizadora_id : def 
        }));
        // [DEBUG-PaymentModal] silenciado
        return updated;
      });
    }, [isPaymentModalOpen, payMethods]); // ✅ CORREÇÃO: Removido form.selectedClients para evitar sobrescrever finalizadoras ao abrir modal principal

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
            // [CustomerPicker] silenciado
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
        // Removed verbose applySelectedClients log
        setForm((f) => ({ ...f, selectedClients: finalArr }));
        if (Array.isArray(finalArr) && finalArr.length > 0) {
          lastNonEmptySelectionRef.current = finalArr;
          setChipsSnapshotSafe(finalArr);
          try { sessionStorage.setItem(persistLastKey, JSON.stringify(finalArr)); } catch {}
          clearedByUserRef.current = false;
        }
        try { lastSelActionRef.current = reason; } catch {}
      } catch (e) {
        // Removed verbose applySelectedClients:error log
      }
    }, [effectiveCustomerPickerOpen, setForm, setChipsSnapshotSafe, persistLastKey]);
    // Pagamentos: busca por participante
    const [paymentSearch, setPaymentSearch] = useState('');
    const paymentSearchRef = useRef(null);
    // (console cleaned) Removed general CustomerPicker state logging to reduce noise
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      try { customerPickerLastChangeAtRef.current = Date.now(); } catch {}
    }, [isCustomerPickerOpen, clientsLoading]);
    // Start/End pulse timeline around the Customer Picker lifecycle
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
        // Removed verbose CustomerPicker debug logs
      } catch {}
    }, [debugOn, isModalOpen, isCustomerPickerOpen, effectiveCustomerPickerOpen, clientsLoading, isClientFormOpen]);

    // Log when internal open states change (post-render perspective)
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      if (!debugOn) return;
      pickerLog('state-change', { isCustomerPickerOpen, effectiveCustomerPickerOpen });
    }, [debugOn, isCustomerPickerOpen, effectiveCustomerPickerOpen]);

    // Log whenever selectedClients length changes (diagnostics)
    // useEffect(() => {
    //   try {
    //     const len = Array.isArray(form.selectedClients) ? form.selectedClients.length : -1;
    //     console.log('[CustomerPicker][selectedClients.len]', len, '| lastAction=', lastSelActionRef.current);
    //   } catch {}
    // }, [form.selectedClients]);

    // Global restoration when picker is closed and selection becomes empty unintentionally
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      if (!isModalOpen) return;
      if (effectiveCustomerPickerOpen) return; // only enforce when picker is closed
      const cur = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
      const lockActive = Date.now() < (selectionLockUntilRef.current || 0);
      // ✅ CORREÇÃO: Não restaura se usuário limpou intencionalmente E não há lock ativo
      if (cur.length === 0 && last.length > 0 && !clearedByUserRef.current && lockActive) {
        lastSelActionRef.current = 'global:restore';
        setForm((f) => ({ ...f, selectedClients: last }));
        // [CustomerPicker] silenciado
      } else if (cur.length === 0 && last.length > 0 && clearedByUserRef.current && !lockActive) {
        try { 
          lastNonEmptySelectionRef.current = [];
          // [CustomerPicker] silenciado
        } catch {}
      }
    }, [isModalOpen, effectiveCustomerPickerOpen, form.selectedClients]);

    // Watchdog: se o picker fechou sem intenção explícita e o usuário deseja mantê-lo aberto, reabre automaticamente
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
      const arr = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      if (arr.length > 0) {
        lastNonEmptySelectionRef.current = arr;
        persistLastNonEmpty(arr);
        setChipsSnapshotSafe(arr);
      }
    }, [form.selectedClients, persistLastNonEmpty]);

    // Ao fechar o picker, se a seleção ficou vazia de forma inesperada, restaura
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
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
            // Removed verbose ANOMALY log
            // console.warn('[CustomerPicker][ANOMALY] selection empty post-close', stateDump);
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
      // [DEBUG-PaymentModal] silenciado
      try {
        const guardActive = now < (restoreGuardUntilRef.current || 0);
        const cur = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
        const last = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
        const lockActive = now < (selectionLockUntilRef.current || 0);
        if (isModalOpen && !effectiveCustomerPickerOpen && (guardActive || lockActive) && cur.length === 0 && last.length > 0 && !clearedByUserRef.current) {
          // [CustomerPicker] silenciado
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
      // [DEBUG-PaymentModal] silenciado
      const now = Date.now();
      // Skip durante janela crítica pós-retorno
      if (now < (returningFromHiddenUntilRef.current || 0)) return;
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
        // [CustomerPicker] silenciado
      }
    }, [form.selectedClients, isModalOpen, effectiveCustomerPickerOpen]);
    // (removed erroneous stray return block)
    // Ocultar participantes apenas na UI de Pagamentos (não altera o agendamento até salvar pagamentos)
    const [paymentHiddenIds, setPaymentHiddenIds] = useState([]);
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
      // Skip durante janela crítica pós-retorno
      const now = Date.now();
      if (now < (returningFromHiddenUntilRef.current || 0)) return;
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
    // ✅ CORREÇÃO: Garante que chips sempre tenham nome, buscando de múltiplas fontes
    const chipsClients = useMemo(() => {
      const formClients = Array.isArray(form.selectedClients) ? form.selectedClients : [];
      const refClients = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
      const lastClients = Array.isArray(lastNonEmptySelectionRef.current) ? lastNonEmptySelectionRef.current : [];
      const snapshotClients = Array.isArray(chipsSnapshot) ? chipsSnapshot : [];
      
      // Se form.selectedClients tem dados completos (com nome), usa ele
      if (formClients.length > 0 && formClients.every(c => c?.nome)) {
        return formClients;
      }
      
      // Se form.selectedClients tem IDs mas sem nomes, tenta enriquecer com dados das refs
      if (formClients.length > 0) {
        return formClients.map(fc => {
          // Se já tem nome, retorna como está
          if (fc?.nome) return fc;
          
          // Busca nome nas outras fontes pelo ID
          const fromRef = refClients.find(rc => rc?.id === fc?.id);
          const fromLast = lastClients.find(lc => lc?.id === fc?.id);
          const fromSnapshot = snapshotClients.find(sc => sc?.id === fc?.id);
          const fromLocal = (localCustomers || []).find(lc => lc?.id === fc?.id);
          
          // Retorna com nome da primeira fonte que tiver
          return {
            ...fc,
            nome: fromRef?.nome || fromLast?.nome || fromSnapshot?.nome || fromLocal?.nome || fc?.nome || 'Cliente'
          };
        });
      }
      
      // Fallback: usa refs se form estiver vazio
      if (refClients.length > 0 && refClients.every(c => c?.nome)) {
        return refClients;
      }
      
      if (snapshotClients.length > 0 && snapshotClients.every(c => c?.nome)) {
        return snapshotClients;
      }
      
      if (lastClients.length > 0 && lastClients.every(c => c?.nome)) {
        return lastClients;
      }
      
      return formClients;
    }, [form.selectedClients, chipsSnapshot, localCustomers]);
    // console cleaned: removed "[CustomerPicker][chips render]" logs

    // Debug: loga quando a lista efetiva muda, para diagnosticar chips
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
      // Skip durante janela crítica pós-retorno
      const now = Date.now();
      if (now < (returningFromHiddenUntilRef.current || 0)) return;
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
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
      if (!isModalOpen) {
        clientsLoadedKeyRef.current = null;
        setClientsLoading(false);
      }
    }, [isModalOpen]);

    // Visibilidade: desativado para evitar pulsos ao retornar à aba
    // (Antes: reidratava lista de clientes ao voltar a aba)
    // useEffect(() => {}, [isModalOpen, userProfile?.codigo_empresa]);

    // Limpa flags de salvamento quando abrir/fechar modal
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
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
            // try { console.warn('[CustomerPicker][SESSION:reuse]', { id: mountIdRef.current, modalSid: modalSessionIdRef.current, withinMs: Date.now() - prevClosingAt }); } catch {}
          } else if (!modalSessionIdRef.current) {
            modalSessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            // try { console.warn('[CustomerPicker][SESSION:new]', { id: mountIdRef.current, modalSid: modalSessionIdRef.current }); } catch {}
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
              // [CustomerPicker] silenciado
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
              // [CustomerPicker] silenciado
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
            // try { console.warn('[CustomerPicker][RESTORE:init-open:skip]', { id: mountIdRef.current, within, closingSessionId, modalSessionId, idsMatch: closingSessionId && modalSessionId && (closingSessionId === modalSessionId), persistedLen: Array.isArray(persisted)?persisted.length:NaN }); } catch {}
          } catch {}
          // Se estamos em janela de proteção pós-concluir, não executar o clear neste ciclo
          try {
            if (Date.now() < (preventClearsUntilRef.current || 0)) {
              // console.warn('[CustomerPicker][INIT:clear:blocked:post-conclude]', { id: mountIdRef.current });
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
              // console.warn('[CustomerPicker][INIT:clear:new-open:skipped:have-last]', { id: mountIdRef.current, persistedLen: Array.isArray(persisted)?persisted.length:0, lastLen: last.length });
            } else {
              // console.warn('[CustomerPicker][INIT:clear:new-open]', { id: mountIdRef.current });
              try { lastNonEmptySelectionRef.current = []; } catch {}
              try { setChipsSnapshot([]); } catch {}
              try { clearedByUserRef.current = false; } catch {}
              setForm(f => ({ ...f, selectedClients: [] }));
            }
          } catch {
            // try { console.warn('[CustomerPicker][INIT:clear:new-open]', { id: mountIdRef.current, err: 'check-failed' }); } catch {}
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
            // try { console.warn('[CustomerPicker][RESTORE:new-mode]', { id: mountIdRef.current, withinMs: Date.now() - closingAt, idsMatch: true, closingSessionId, modalSessionId, persistedLen: persisted.length }); } catch {}
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
            // try { console.warn('[CustomerPicker][RESTORE:new-mode:FALLBACK]', { id: mountIdRef.current, withinMs: Date.now() - closingAt, idsMatch: false, closingSessionId, modalSessionId, persistedLen: persisted.length }); } catch {}
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
          // try { console.warn('[CustomerPicker][RESTORE:new-mode:skip]', { id: mountIdRef.current, within, closingSessionId, modalSessionId, idsMatch: closingSessionId && modalSessionId && (closingSessionId === modalSessionId), persistedLen: Array.isArray(persisted)?persisted.length:NaN }); } catch {}
        } catch {}
        // Se estamos em janela de proteção pós-concluir, não executar o clear agora
        try {
          if (Date.now() < (preventClearsUntilRef.current || 0)) {
            // console.warn('[CustomerPicker][INIT:clear:new-mode:blocked:post-conclude]', { id: mountIdRef.current });
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
            // console.warn('[CustomerPicker][INIT:clear:new-mode:skipped:have-last]', { id: mountIdRef.current, persistedLen: Array.isArray(persisted)?persisted.length:0, lastLen: last.length });
          } else {
            // console.warn('[CustomerPicker][INIT:clear:new-mode]', { id: mountIdRef.current });
            try { lastNonEmptySelectionRef.current = []; } catch {}
            try { setChipsSnapshot([]); } catch {}
            setForm(f => ({ ...f, selectedClients: [] }));
          }
        } catch {
          // try { console.warn('[CustomerPicker][INIT:clear:new-mode]', { id: mountIdRef.current, err: 'check-failed' }); } catch {}
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
      // [DEBUG-PaymentModal] silenciado
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
          
          // Resetar estado de agendamento recorrente
          setIsRecorrente(false);
          setQuantidadeSemanas(4);
          try { suppressPickerCloseRef.current = 0; } catch {}
          try { customerPickerIntentRef.current = null; } catch {}
          try { customerPickerDesiredOpenRef.current = false; } catch {}
          // Também zera a seleção do form e representante para garantir limpeza total
          setForm(f => ({ ...f, selectedClients: [] }));
          setPaymentSelectedId(null);
          // console.warn('[CustomerPicker][CLOSE:modal:clear-all]');
        } catch {}
        return; 
      }
      if (!editingBooking) {
        if (newModeInitRef.current) return; // já limpou para este ciclo de "novo"
        newModeInitRef.current = true;
        // Bloqueia clear se estamos em janela de proteção pós-concluir (remount)
        try {
          if (Date.now() < (preventClearsUntilRef.current || 0)) {
            // console.warn('[CustomerPicker][INIT:clear:new-mode:blocked:post-conclude:effect2]', { id: mountIdRef.current });
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
            // console.warn('[CustomerPicker][INIT:clear:new-mode:effect2:skipped:have-last]', { id: mountIdRef.current, persistedLen: Array.isArray(persisted)?persisted.length:0, lastLen: last.length });
          } else {
            // console.warn('[CustomerPicker][INIT:clear:new-mode:effect2]', { id: mountIdRef.current });
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
    const saveBookingOnce = useCallback(async (options = {}) => {
      const { autoSave = false } = options;
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
        // Prioriza form.selectedClients (que é a fonte da verdade), depois tenta refs
        let selNow = Array.isArray(form.selectedClients) && form.selectedClients.length > 0 
          ? form.selectedClients 
          : (Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []);
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
        
        // Para agendamentos existentes, reordena participantes para manter ordem original (representante primeiro)
        // MAS: Não reordena se estamos vindo do modal de pagamentos (substituição de participantes)
        let selNowFinal = selNow;
        if (editingBooking?.id) {
          // 🔧 NÃO reordenar se os nomes mudaram (indicativo de substituição no modal de pagamentos)
          // Comparar nomes atuais com o campo 'clientes' do agendamento
          const nomesAtuais = selNow.map(p => p.nome).sort().join('|');
          let nomesOriginais = '';
          
          if (editingBooking.clientes) {
            try {
              const clientes = Array.isArray(editingBooking.clientes) 
                ? editingBooking.clientes 
                : JSON.parse(editingBooking.clientes);
              nomesOriginais = Array.isArray(clientes) ? clientes.sort().join('|') : '';
            } catch {
              nomesOriginais = '';
            }
          }
          
          const houveMudancaDeParticipantes = nomesAtuais !== nomesOriginais;
          
          if (!houveMudancaDeParticipantes) {
            // Prioriza o campo 'clientes' do agendamento (salvo pela Isis) sobre os participantes carregados
            let ordemReferencia = [];
            
            // Tenta usar o campo 'clientes' do agendamento primeiro (mais confiável)
            if (editingBooking.clientes) {
              try {
                // Pode ser array ou string JSON
                ordemReferencia = Array.isArray(editingBooking.clientes) 
                  ? editingBooking.clientes 
                  : JSON.parse(editingBooking.clientes);
              } catch {
                // Se falhar o parse, usa participantes carregados
                const loadedParts = participantsByAgendamento[editingBooking.id] || [];
                ordemReferencia = loadedParts.map(p => p.nome);
              }
            } else {
              // Fallback: usa participantes carregados
              const loadedParts = participantsByAgendamento[editingBooking.id] || [];
              ordemReferencia = loadedParts.map(p => p.nome);
            }
            
            if (ordemReferencia.length > 0) {
              selNowFinal = [...selNow].sort((a, b) => {
                const indexA = ordemReferencia.findIndex(nome => nome === a.nome);
                const indexB = ordemReferencia.findIndex(nome => nome === b.nome);
                
                // Se ambos existem na ordem original, manter essa ordem
                if (indexA !== -1 && indexB !== -1) {
                  return indexA - indexB;
                }
                // Se apenas A existe na ordem original, A vem primeiro
                if (indexA !== -1) return -1;
                // Se apenas B existe na ordem original, B vem primeiro  
                if (indexB !== -1) return 1;
                // Se nenhum existe na ordem original, manter ordem atual
                return 0;
              });
              
            }
          }
        }
        
        const primaryClient = selNowFinal[0];
        const clientesArr = selNowFinal.map(getCustomerName).filter(Boolean);

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
          
          // 🔄 Atualiza participantes na tabela agendamento_participantes
          // Busca participantes atuais do banco para preservar dados de pagamento
          const { data: currentParticipants } = await supabase
            .from('agendamento_participantes')
            .select('*')
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .eq('agendamento_id', editingBooking.id)
            .order('ordem', { ascending: true }); // Mantém ordem de inserção original
          
          // ⚠️ IMPORTANTE: Não usar Map por cliente_id pois sobrescreve duplicados!
          // Usar array indexado para preservar cada participante individualmente
          const currentArray = currentParticipants || [];
          
          const __mudancaDeParticipantes = (typeof houveMudancaDeParticipantes !== 'undefined') ? houveMudancaDeParticipantes : (() => {
            try {
              const nomesAtuais = (selNow || []).map(p => p.nome).sort().join('|');
              let nomesOriginais = '';
              if (editingBooking?.clientes) {
                const clientes = Array.isArray(editingBooking.clientes) ? editingBooking.clientes : JSON.parse(editingBooking.clientes);
                nomesOriginais = Array.isArray(clientes) ? clientes.sort().join('|') : '';
              }
              return nomesAtuais !== nomesOriginais;
            } catch { return true; }
          })();
          if (__mudancaDeParticipantes) {
            // Remove e recria participantes somente quando houve mudança (substituição)
            const { error: deleteError } = await supabase
              .from('agendamento_participantes')
              .delete()
              .eq('codigo_empresa', userProfile.codigo_empresa)
              .eq('agendamento_id', editingBooking.id);
            if (deleteError) console.error('Erro ao deletar participantes:', deleteError);
            
            if (selNowFinal && selNowFinal.length > 0) {
              const participantesRows = selNowFinal.map((c, index) => {
                const existing = currentArray[index];
                const shouldPreserve = existing && existing.cliente_id === c.id;
                return {
                  codigo_empresa: userProfile.codigo_empresa,
                  agendamento_id: editingBooking.id,
                  cliente_id: c.id,
                  nome: c.nome,
                  ordem: index + 1,
                  valor_cota: shouldPreserve ? (existing.valor_cota ?? 0) : 0,
                  status_pagamento: shouldPreserve ? (existing.status_pagamento ?? 'Pendente') : 'Pendente',
                  finalizadora_id: shouldPreserve ? (existing.finalizadora_id ?? null) : null,
                  aplicar_taxa: shouldPreserve ? (existing.aplicar_taxa ?? false) : false,
                  pago_em: shouldPreserve ? (existing.pago_em ?? null) : null,
                };
              });
              const { error: insertError } = await supabase
                .from('agendamento_participantes')
                .insert(participantesRows);
              if (insertError) console.error('Erro ao inserir participantes:', insertError);
            }
          }
          // Atualiza estado local (sem mexer em status quando ele mudou; será tratado abaixo)
          // Garante que pegamos o nome do cliente corretamente
          const customerName = primaryClient?.nome || primaryClient?.name || getCustomerName(primaryClient) || clientesArr[0] || editingBooking.customer;
          const updatedBooking = {
            ...editingBooking,
            court: form.court,
            customer: customerName,
            start: inicio,
            end: fim,
            modality: form.modality,
            ...(statusChanged ? {} : { status: baseUpdate.status ?? form.status }),
          };
          setBookings((prev) => prev.map((b) => b.id === editingBooking.id ? updatedBooking : b));
          // Atualiza editingBooking no contexto para que os modais tenham dados atualizados
          setEditingBooking(updatedBooking);
          // Se o status mudou, delega a atualização de status (e auto_disabled) para updateBookingStatus,
          // garantindo a exibição do modal de reativação quando aplicável.
          if (statusChanged) {
            // Fecha o modal de edição antes de abrir o modal de reativação para evitar sobreposição incorreta
            try { setIsModalOpen(false); await updateBookingStatus(editingBooking.id, form.status, 'user'); } catch {}
          }
          // Toast apenas se não for auto-save (evita notificação em cada mudança)
          if (!autoSave) {
            toast({ title: 'Agendamento atualizado' });
          }
          completedSaveRef.current = true;
          pendingSaveRef.current = false;
          
          // 🔄 Atualiza cache de participantes para refletir mudanças imediatamente
          // ⚠️ FIX: Usar cliente_id como chave em vez de índice para preservar dados de pagamento
          // Isso evita desalinhamento quando há reordenação de participantes
          const updatedParticipants = selNow.map((c, index) => {
            // 🔑 Buscar pelo cliente_id (chave) em vez de índice
            // Isso preserva dados de pagamento mesmo se a ordem mudar
            const existing = currentArray.find(p => p.cliente_id === c.id);
            const shouldPreserve = !!existing;
            
            return {
              cliente_id: c.id,
              nome: c.nome,
              codigo: c.codigo || null,
              valor_cota: shouldPreserve ? (existing.valor_cota ?? 0) : 0,
              status_pagamento: shouldPreserve ? (existing.status_pagamento ?? 'Pendente') : 'Pendente',
              finalizadora_id: shouldPreserve ? (existing.finalizadora_id ?? null) : null,
              aplicar_taxa: shouldPreserve ? (existing.aplicar_taxa ?? false) : false,
              ordem: index + 1, // Campo ordem baseado na posição (1, 2, 3...)
            };
          });
          setParticipantsByAgendamento(prev => ({
            ...prev,
            [editingBooking.id]: updatedParticipants
          }));
          
          // 🛡️ FIX: Não sobrescrever participantsForm se não houve mudança de participantes
          // Isso evita que dados de pagamento salvos pelo PaymentModal sejam perdidos
          if (!__mudancaDeParticipantes) {
            // Sem mudança de participantes: preservar dados atuais do contexto
            // Apenas atualizar se houver dados novos do banco
            console.log('🛡️ [FIX] Sem mudança de participantes - preservando dados de pagamento do contexto');
            setParticipantsForm(prev => {
              // Mesclar dados atuais com dados do banco usando cliente_id como chave
              const merged = (prev || []).map(p => {
                const fromBank = updatedParticipants.find(up => up.cliente_id === p.cliente_id);
                if (!fromBank) return p; // Manter dados atuais se não encontrar no banco
                
                // Mesclar: priorizar dados do contexto (PaymentModal) sobre dados do banco
                return {
                  cliente_id: p.cliente_id,
                  nome: p.nome || fromBank.nome,
                  codigo: p.codigo ?? fromBank.codigo,
                  valor_cota: p.valor_cota || fromBank.valor_cota, // Manter valor do contexto
                  status_pagamento: p.status_pagamento || fromBank.status_pagamento, // Manter status do contexto
                  finalizadora_id: p.finalizadora_id ?? fromBank.finalizadora_id,
                  aplicar_taxa: p.aplicar_taxa ?? fromBank.aplicar_taxa,
                };
              });
              console.log('✅ [FIX] Dados de pagamento preservados:', merged);
              return merged.length > 0 ? merged : updatedParticipants;
            });
          } else {
            // Com mudança de participantes: reconstruir do zero
            console.log('🔄 [FIX] Mudança de participantes detectada - reconstruindo participantsForm');
            setParticipantsForm(updatedParticipants.map(p => ({
              cliente_id: p.cliente_id,
              nome: p.nome,
              codigo: p.codigo,
              valor_cota: p.valor_cota ? maskBRL(String(Number(p.valor_cota).toFixed(2))) : '',
              status_pagamento: p.status_pagamento,
              finalizadora_id: p.finalizadora_id ? String(p.finalizadora_id) : (payMethods?.[0]?.id ? String(payMethods[0].id) : null),
              aplicar_taxa: p.aplicar_taxa,
            })));
          }
          
          // Recarregar alertas após salvar agendamento (não bloqueia auto-save)
          loadAlerts().catch(err => {
            console.error('[AgendaPage] Erro ao recarregar alertas:', err);
          });
          
          // Só fecha o modal e limpa caches se NÃO for auto-save
          if (!autoSave) {
            // Clear customer selection caches to avoid carryover into next new booking
            try { lastNonEmptySelectionRef.current = []; } catch {}
            try { setChipsSnapshot([]); } catch {}
            try { sessionStorage.removeItem(persistLastKey); } catch {}
            setIsModalOpen(false);
          }
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

        // ✅ AGENDAMENTO RECORRENTE: Criar múltiplos agendamentos
        if (isRecorrente && quantidadeSemanas > 1) {
          const agendamentosParaCriar = [];
          const newBookingsForState = [];
          
          // Gerar datas para as próximas semanas
          for (let semana = 0; semana < quantidadeSemanas; semana++) {
            const dataAgendamento = addDays(form.date, semana * 7);
            const inicioRecorrente = new Date(dataAgendamento);
            inicioRecorrente.setHours(Math.floor(form.startMinutes / 60), form.startMinutes % 60, 0, 0);
            const fimRecorrente = new Date(dataAgendamento);
            fimRecorrente.setHours(Math.floor(form.endMinutes / 60), form.endMinutes % 60, 0, 0);
            
            agendamentosParaCriar.push({
              codigo_empresa: userProfile.codigo_empresa,
              quadra_id: court.id,
              cliente_id: primaryClient?.id ?? null,
              clientes: clientesArr,
              inicio: inicioRecorrente.toISOString(),
              fim: fimRecorrente.toISOString(),
              modalidade: form.modality,
              status: form.status,
            });
          }
          
          // Inserir todos os agendamentos
          const { data: agendamentosCriados, error: errorBatch } = await supabase
            .from('agendamentos')
            .insert(agendamentosParaCriar)
            .select('id, codigo, inicio, fim');
          
          if (errorBatch) throw errorBatch;
          
          // Criar participantes para cada agendamento
          const todosParticipantes = [];
          for (const agendamento of agendamentosCriados) {
            // IMPORTANTE: Usar selNowFinal (mesma ordem do campo clientes) ao invés de form.selectedClients
            const participantesRows = selNowFinal.map((c, index) => ({
              codigo_empresa: userProfile.codigo_empresa,
              agendamento_id: agendamento.id,
              cliente_id: c.id,
              nome: c.nome,
              valor_cota: 0,
              status_pagamento: 'Pendente',
              ordem: index + 1, // Campo ordem baseado na posição (1, 2, 3...)
            }));
            todosParticipantes.push(...participantesRows);
            
            // Adicionar ao estado local
            newBookingsForState.push({
              id: agendamento.id,
              code: agendamento.codigo,
              court: form.court,
              customer: primaryClient?.nome || clientesArr[0] || '',
              start: new Date(agendamento.inicio),
              end: new Date(agendamento.fim),
              status: form.status,
              modality: form.modality,
            });
          }
          
          // Inserir todos os participantes de uma vez
          if (todosParticipantes.length > 0) {
            await supabase
              .from('agendamento_participantes')
              .insert(todosParticipantes);
          }
          
          // Atualizar estado
          setBookings((prev) => [...prev, ...newBookingsForState]);
          toast({ 
            title: `${quantidadeSemanas} Agendamentos criados!`,
            description: `Agendamentos recorrentes criados com sucesso.`,
            variant: 'success'
          });
          
          // Limpar estado de recorrente
          setIsRecorrente(false);
          setQuantidadeSemanas(4);
        } else {
          // ✅ AGENDAMENTO ÚNICO (lógica original)
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
          toast({ 
            title: 'Agendamento criado',
            variant: 'success',
            duration: 2000
          });
          
          // Recarregar alertas após criar agendamento (não bloqueia fechamento do modal)
          loadAlerts().catch(err => {
            console.error('[AgendaPage] Erro ao recarregar alertas:', err);
          });

          // Participantes (não bloqueia conclusão do salvamento principal)
          try {
            // IMPORTANTE: Usar selNowFinal (mesma ordem do campo clientes) ao invés de form.selectedClients
            const rows = selNowFinal.map((c, index) => ({
              codigo_empresa: userProfile.codigo_empresa,
              agendamento_id: data.id,
              cliente_id: c.id,
              nome: c.nome,
              valor_cota: 0,
              status_pagamento: 'Pendente',
              ordem: index + 1, // Campo ordem baseado na posição (1, 2, 3...)
            }));
            
            if (rows.length > 0) {
              const { error: perr } = await supabase
                .from('agendamento_participantes')
                .insert(rows);
              if (!perr) {
                // Atualiza imediatamente o estado dos participantes para exibir o chip correto
                const participantsForState = rows.map(row => ({
                  agendamento_id: row.agendamento_id,
                  cliente_id: row.cliente_id,
                  nome: row.nome,
                  codigo: selNowFinal.find(c => c.id === row.cliente_id)?.codigo || null,
                  valor_cota: row.valor_cota,
                  status_pagamento: row.status_pagamento,
                  ordem: row.ordem
                }));
                setParticipantsByAgendamento(prev => ({
                  ...prev,
                  [data.id]: participantsForState
                }));
              }
            }
          } catch (pe) {
            /* swallow participants create console noise */
          }
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
    // Auto-retry ao voltar de outra aba: desativado para evitar pulsos
    // useEffect(() => {}, [isModalOpen, isSavingBooking, saveBookingOnce]);
  
  // ✅ AUTO-SAVE: Salva automaticamente ao detectar mudanças no modo de edição
  useEffect(() => {
    // Só aplica auto-save no modo de EDIÇÃO (não em criação)
    if (!editingBooking?.id) {
      autoSaveEnabledRef.current = false;
      lastSavedFormRef.current = null;
      return;
    }
    
    // Aguarda inicialização completa do form (sincroniza com initializedRef)
    if (!initializedRef.current || !autoSaveEnabledRef.current) {
      // Ativa auto-save após 500ms da inicialização para evitar saves prematuros
      const timeout = setTimeout(() => {
        if (initializedRef.current) {
          autoSaveEnabledRef.current = true;
          lastSavedFormRef.current = JSON.stringify({
            court: form.court,
            startMinutes: form.startMinutes,
            endMinutes: form.endMinutes,
            modality: form.modality,
            status: form.status,
            selectedClients: form.selectedClients,
          });
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
    
    // Serializa form atual para comparar
    const currentForm = JSON.stringify({
      court: form.court,
      startMinutes: form.startMinutes,
      endMinutes: form.endMinutes,
      modality: form.modality,
      status: form.status,
      selectedClients: form.selectedClients,
    });
    
    // Se não houve mudança real, não faz nada
    if (currentForm === lastSavedFormRef.current) {
      return;
    }
    
    // Limpa timeout anterior
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Debounce de 1.5 segundos
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Validações básicas antes de salvar
      const court = courtsMap[form.court];
      if (!court) return; // Sem quadra válida
      
      const s = form.startMinutes, e = form.endMinutes;
      if (!(Number.isFinite(s) && Number.isFinite(e) && e > s)) return; // Horário inválido
      
      const free = isRangeFree(s, e);
      if (!free) return; // Conflito de horário
      
      // Detecta se houve mudança nos participantes
      const oldClients = lastSavedFormRef.current ? JSON.parse(lastSavedFormRef.current).selectedClients : [];
      const newClients = form.selectedClients || [];
      const clientsChanged = JSON.stringify(oldClients) !== JSON.stringify(newClients);
      
      // Salva automaticamente
      if (clientsChanged) {
        console.log('🔄 [Auto-save] Salvando alterações (participantes modificados)...');
      } else {
        console.log('🔄 [Auto-save] Salvando alterações...');
      }
      setIsAutoSaving(true);
      
      try {
        await saveBookingOnce({ autoSave: true });
        lastSavedFormRef.current = currentForm;
        if (clientsChanged) {
          console.log('✅ [Auto-save] Participantes salvos no banco! Disponíveis no modal de pagamentos.');
        } else {
          console.log('✅ [Auto-save] Salvo com sucesso!');
        }
      } catch (error) {
        console.error('❌ [Auto-save] Erro ao salvar:', error);
      } finally {
        setIsAutoSaving(false);
      }
    }, 1500);
    
    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    editingBooking?.id,
    form.court,
    form.startMinutes,
    form.endMinutes,
    form.modality,
    form.status,
    form.selectedClients,
    courtsMap,
    isRangeFree,
    saveBookingOnce,
  ]);
  
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
        // Carregar clientes da empresa - apenas clientes ativos
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome, codigo, email, telefone, status, codigo_empresa, is_consumidor_final')
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .eq('status', 'active')  // ✅ Filtro: apenas clientes ativos
          .eq('flag_cliente', true)  // ✅ Filtro: apenas registros marcados como cliente
          .order('nome', { ascending: true });
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Falha ao carregar clientes:', error);
          return;
        }
        if (Array.isArray(data)) {
          // Removed verbose Clientes:load log
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
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
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
          .map(p => ({ id: p.cliente_id, nome: p.nome, codigo: p.codigo || null }));
          // Removido filtro de deduplicação para permitir clientes duplicados
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
            codigo: p.codigo,
            valor_cota: (() => {
              const num = Number.isFinite(Number(p.valor_cota)) ? Number(p.valor_cota) : parseBRL(p.valor_cota);
              return maskBRL(String((Number.isFinite(num) ? num : 0).toFixed(2)));
            })(),
            status_pagamento: p.status_pagamento || 'Pendente',
            finalizadora_id: p.finalizadora_id ? String(p.finalizadora_id) : null,
            aplicar_taxa: p.aplicar_taxa || false,
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
                .select(`cliente_id, nome, valor_cota, status_pagamento, finalizadora_id, aplicar_taxa, cliente:clientes!agendamento_participantes_cliente_id_fkey ( nome, codigo )`)
                .eq('codigo_empresa', userProfile.codigo_empresa)
                .eq('agendamento_id', editingBooking.id)
                .order('ordem', { ascending: true }); // Ordena por campo ordem explícito
              if (!error && Array.isArray(data)) {
                const sel = data
                  .filter(p => p && p.cliente_id)
                  .map(p => ({ 
                    id: p.cliente_id, 
                    // Priorizar nome editado (agendamento_participantes.nome) sobre nome do cadastro
                    nome: p.nome || p.cliente?.nome || '', 
                    codigo: p.cliente?.codigo || null 
                  }));
                  // Removido filtro de deduplicação para permitir clientes duplicados
                setForm(f => ({ ...f, selectedClients: sel }));
                setParticipantsForm(data.map(p => ({
                  cliente_id: p.cliente_id,
                  // Priorizar nome editado (agendamento_participantes.nome) sobre nome do cadastro
                  nome: p.nome || p.cliente?.nome || '',
                  codigo: p.cliente?.codigo || null,
                  valor_cota: (() => {
                    const num = Number.isFinite(Number(p.valor_cota)) ? Number(p.valor_cota) : parseBRL(p.valor_cota);
                    return maskBRL(String((Number.isFinite(num) ? num : 0).toFixed(2)));
                  })(),
                  status_pagamento: p.status_pagamento || 'Pendente',
                  finalizadora_id: p.finalizadora_id ? String(p.finalizadora_id) : null,
                  aplicar_taxa: p.aplicar_taxa || false,
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
        
        // 🔄 Inicializa snapshot para detecção de mudanças ao fechar
        lastSavedFormRef.current = JSON.stringify({
          court: editingBooking.court,
          startMinutes: startM,
          endMinutes: endM,
          modality: safeModality,
          status: editingBooking.status,
          selectedClients: selectedFromParts,
        });
      } else if (prefill) {
        // Sanitize: garante que a quadra do prefill pertença às quadras disponíveis da empresa atual
        const safeCourt = (availableCourts || []).includes(prefill.court)
          ? prefill.court
          : ((availableCourts || [])[0] || '');
        const newForm = {
          selectedClients: userSelectedOnceRef.current ? (Array.isArray(form.selectedClients) ? form.selectedClients : []) : [],
          court: safeCourt,
          modality: (() => { const c = safeCourt; const allowed = courtsMap[c]?.modalidades || modalities; return allowed[0] || ''; })(),
          status: 'scheduled',
          date: prefill.date ?? currentDate,
          startMinutes: prefill.startMinutes ?? nearestSlot(),
          endMinutes: prefill.endMinutes ?? (nearestSlot() + 60),
        };
        setForm(newForm);
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
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
      if (!isModalOpen || !editingBooking) return;
      if (participantsPrefillOnceRef.current) return;
      
      // 🛡️ PROTEÇÃO: Não sobrescreve se auto-save está ativo (usuário já fez mudanças)
      if (autoSaveEnabledRef.current) return;
      
      const loadedParts = participantsByAgendamento[editingBooking.id] || [];
      if (!loadedParts.length) return;
      const selectedFromParts = loadedParts
        .filter(p => p && p.cliente_id)
        .map(p => ({ id: p.cliente_id, nome: p.nome, codigo: p.codigo || null }));
        // Removido filtro de deduplicação para permitir clientes duplicados
      
      // ✅ CORREÇÃO: Sempre atualiza os participantes quando o modal abre, não apenas quando está vazio
      if (selectedFromParts.length > 0) {
        setForm(f => ({ ...f, selectedClients: selectedFromParts }));
        setParticipantsForm(
          loadedParts.map(p => ({
            cliente_id: p.cliente_id,
            nome: p.nome,
            codigo: p.codigo || null,
            valor_cota: (() => {
              const num = Number.isFinite(Number(p.valor_cota)) ? Number(p.valor_cota) : parseBRL(p.valor_cota);
              return maskBRL(String((Number.isFinite(num) ? num : 0).toFixed(2)));
            })(),
            status_pagamento: p.status_pagamento || 'Pendente',
            finalizadora_id: p.finalizadora_id || null, // ✅ CORREÇÃO: Preserva a finalizadora salva
            aplicar_taxa: p.aplicar_taxa || false,
          }))
        );
        setPaymentSelectedId(selectedFromParts[0]?.id || null);
        participantsPrefillOnceRef.current = true;
      }
    }, [isModalOpen, editingBooking, participantsByAgendamento]);

    // Atalhos de teclado para modal de agendamento
    useEffect(() => {
      const handleKeyDown = (e) => {
        // Apenas se modal principal estiver aberto
        if (!isModalOpen) return;
        
        // NÃO processar atalhos se modal de pagamentos estiver aberto
        if (isPaymentModalOpen) return;
        
        // ESC para fechar modal
        if (e.key === 'Escape') {
          e.preventDefault();
          
          // 🔄 Auto-save ao fechar: SEMPRE salva antes de fechar no modo de edição
          if (editingBooking?.id) {
            console.log('💾 [Auto-save] Salvando ao fechar modal (ESC)...');
            // Cancela timeout pendente
            if (autoSaveTimeoutRef.current) {
              clearTimeout(autoSaveTimeoutRef.current);
            }
            saveBookingOnce({ autoSave: true })
              .then(() => {
                console.log('✅ [Auto-save] Salvo ao fechar (ESC)!');
                setIsModalOpen(false);
              })
              .catch((error) => {
                console.error('❌ [Auto-save] Erro ao salvar ao fechar (ESC):', error);
                setIsModalOpen(false);
              });
            return; // Não fecha imediatamente
          }
          
          setIsModalOpen(false);
        }
        
        // Enter para salvar (apenas se não estiver em um input de texto ou textarea)
        if (e.key === 'Enter' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
          e.preventDefault();
          if (!pendingSaveRef.current && !completedSaveRef.current) {
            pendingSaveRef.current = true;
            completedSaveRef.current = false;
            saveBookingOnce().catch(() => {});
          }
        }
        
        // Atalhos apenas para modo de edição
        if (!editingBooking) return;
        
        // F3 para cancelar agendamento
        if (e.key === 'F3') {
          e.preventDefault();
          setIsCancelConfirmOpen(true);
        }
        
        // F4 para abrir modal de pagamentos
        if (e.key === 'F4') {
          e.preventDefault();
          openPaymentModal();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, editingBooking, isPaymentModalOpen, openPaymentModal, setIsCancelConfirmOpen, saveBookingOnce, pendingSaveRef, completedSaveRef, setIsModalOpen, form]);

    // Limites da quadra selecionada
    const courtBounds = useMemo(() => {
      const c = courtsMap[form.court];
      if (!c) return { start: dayStartHour * 60, end: dayEndHourExclusive * 60 };
      const [sh, sm] = String(c.hora_inicio || '06:00:00').split(':').map(Number);
      const [eh, em] = String(c.hora_fim || '24:00:00').split(':').map(Number);
      // Tratar 00:00:00 como 24:00 (meia-noite)
      const endHours = (eh === 0 && em === 0) ? 24 : eh;
      return { start: sh * 60 + (sm || 0), end: endHours * 60 + (em || 0) };
    }, [courtsMap, form.court, dayStartHour, dayEndHourExclusive]);

    // Intervalos ocupados no dia/quadra selecionados (em minutos desde 00:00)
    const dayIntervals = useMemo(() => {
      const dayStr = format(form.date, 'yyyy-MM-dd');
      const toMinutes = (d) => {
        const h = getHours(d);
        const m = getMinutes(d);
        // Se for 00:00 (meia-noite), tratar como 24:00 (1440 minutos)
        if (h === 0 && m === 0) return 1440;
        return h * 60 + m;
      };
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
      for (let minutes = bounds.start; minutes <= bounds.end; minutes += SLOT_MINUTES) {
        const available = isRangeFree(minutes, minutes + SLOT_MINUTES);
        let h = Math.floor(minutes / 60);
        const m = minutes % 60;
        // Converter 24:00 para 00:00
        if (h >= 24 && minutes === 1440) h = 0;
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
        let h = Math.floor(minutes / 60);
        const m = minutes % 60;
        // Converter 24:00 para 00:00
        if (h >= 24) h = h % 24;
        opts.push({ value: minutes, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` , available});
      }
      return opts;
    }, [form.startMinutes, dayIntervals, courtBounds]);

    // Valida/auto-corrige início/fim ao mudar quadra/data/início
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
      // [DEBUG-PaymentModal] silenciado
      const allowed = courtsMap[form.court]?.modalidades || modalities;
      if (!allowed.includes(form.modality)) {
        setForm(f => ({ ...f, modality: allowed[0] || '' }));
      }
    }, [form.court, courtsMap]);

    // Garante que quadra fechada não fique selecionada
    useEffect(() => {
      // Não alterar quadra se acabamos de aplicar um prefill
      if (suppressAutoAdjustRef.current) {
        return;
      }
      
      // Só verificar fechamento se a data do formulário é hoje (currentDate)
      // Se for outro dia, o diasFuncionamento pode estar desatualizado
      const isFormDateToday = isSameDay(form.date, currentDate);
      
      if (!isFormDateToday) {
        return;
      }
      
      const isCurrentCourtClosed = diasFuncionamento[form.court] && !diasFuncionamento[form.court].funciona;
      
      if (isCurrentCourtClosed) {
        // Encontrar primeira quadra disponível
        const availableCourt = availableCourts.find(court => 
          !diasFuncionamento[court] || diasFuncionamento[court].funciona
        );
        if (availableCourt) {
          setForm(f => ({ ...f, court: availableCourt }));
        }
      }
    }, [form.court, form.date, diasFuncionamento, availableCourts, currentDate]);

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
        let h = Math.floor(mins / 60);
        const m = mins % 60;
        // Converter 24:00 para 00:00
        if (h >= 24) h = h % 24;
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
    // paymentTotal e setPaymentTotal agora vem do contexto (via useAgenda no topo do componente)
    // Usar participantsForm como fonte da verdade (inclui duplicados e substituições)
    const participantsCount = useMemo(() => (participantsForm || []).length, [participantsForm]);
    const paymentSummary = useMemo(() => {
      const values = (participantsForm || []).map(pf => {
        const v = parseBRL(pf?.valor_cota);
        return Number.isFinite(v) ? v : 0;
      });
      const totalAssigned = values.reduce((a, b) => a + b, 0);
      const totalTargetParsed = parseBRL(paymentTotal);
      const totalTarget = Number.isFinite(totalTargetParsed) ? totalTargetParsed : 0;
      const diff = Number((totalTarget - totalAssigned).toFixed(2));
      // contagem simples por status (Pago/Pendente) - conta todos do participantsForm
      let paid = 0, pending = 0;
      for (const pf of (participantsForm || [])) {
        const s = pf?.status_pagamento || 'Pendente';
        if (s === 'Pago') paid++; else pending++;
      }
      return { totalAssigned, totalTarget, diff, paid, pending };
    }, [participantsForm, paymentTotal]);

    // Regra global: se qualquer participante cobrir o total do agendamento, todos ficam 'Pago'
    useEffect(() => {
      // [DEBUG-PaymentModal] silenciado
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
        // [DEBUG-PaymentModal] silenciado
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
    const closeCustomerPicker = useCallback(async () => {
      try { customerPickerDesiredOpenRef.current = false; localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
      try { customerPickerIntentRef.current = 'close'; } catch {}
      try { setIsCustomerPickerOpen(false); setEffectiveCustomerPickerOpen(false); } catch {}
      
      // Salva imediatamente ao fechar o picker de clientes (modo edição)
      if (editingBooking?.id && autoSaveEnabledRef.current) {
        try {
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
          }
          console.log('💾 [CustomerPicker] Salvando participantes ao fechar...');
          await saveBookingOnce({ autoSave: true });
          console.log('✅ [CustomerPicker] Participantes salvos!');
        } catch (error) {
          console.error('❌ [CustomerPicker] Erro ao salvar:', error);
        }
      }
    }, [editingBooking?.id, saveBookingOnce]);

    // ... (rest of the code remains the same)
  return (
    <>
      {/* Dialogo de reativação de automação (top-level) */}
      {reactivateAsk && (
        <Dialog
          open={true}
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
      )}

      {/* Main Add/Edit Booking Modal (restaurado) */}
      {isModalOpen && (
        <Dialog
          open={true}
          onOpenChange={async (open) => {
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
            
            // Se o modal de pagamentos estiver aberto, não bloquear aqui: coordenar abaixo
            if (isPaymentModalOpen) {
              console.log('[Dialog] Fechamento solicitado com PaymentModal aberto - iniciando coordenação');
            }
            
            console.log('🔍 [FLUXO CRÍTICO] Solicitação de fechamento do modal de agendamento recebida');
            console.log('📊 Estado atual:', {
              isPaymentModalOpen,
              editingBooking: editingBooking?.id,
              timestamp: new Date().toISOString()
            });

            // 🔧 Coordenação com PaymentModal no wrapper (Vercel):
            // Se o modal de pagamentos estiver aberto, solicitar "save-and-close" e aguardar confirmação
            if (isPaymentModalOpen && typeof window !== 'undefined') {
              console.log('🔍 [FLUXO CRÍTICO] PaymentModal aberto - solicitando save-and-close');
              try {
                await new Promise((resolve) => {
                  const handler = () => {
                    window.removeEventListener('paymentmodal:closed', handler);
                    console.log('✅ [FLUXO CRÍTICO] PaymentModal confirmou fechamento');
                    resolve();
                  };
                  // Fallback se o evento não vier (3s)
                  const timeout = setTimeout(() => {
                    window.removeEventListener('paymentmodal:closed', handler);
                    console.warn('⏱️ [FLUXO CRÍTICO] Timeout aguardando PaymentModal fechar');
                    resolve();
                  }, 3000);
                  const wrappedHandler = () => { clearTimeout(timeout); handler(); };
                  window.addEventListener('paymentmodal:closed', wrappedHandler, { once: true });
                  // Disparar solicitação
                  window.dispatchEvent(new Event('paymentmodal:save-and-close'));
                });
              } catch {}
            }

            // Agora fechar o modal de agendamento
            setIsModalOpen(false);
            setEditingBooking(null);
            setPrefill(null);
            participantsPrefillOnceRef.current = false;
            console.log('🔍 [FLUXO CRÍTICO] Modal de agendamento fechado');
            
            // Resetar estado de agendamento recorrente
            setIsRecorrente(false);
            setQuantidadeSemanas(4);
          } else {
            setIsModalOpen(true);
          }
        }}
      >
        <DialogContent
          forceMount
          disableAnimations={true}
          alignTop
          className="sm:max-w-[960px] max-h-[85vh] min-h-[360px] flex flex-col p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={async (e) => {
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
                  // Removed verbose DIALOG:interactOutside:block log
                } catch {}
                e.preventDefault();
                return;
              }
              
              // 🔄 Auto-save ao clicar fora: SEMPRE salva antes de fechar em modo de edição
              if (editingBooking?.id) {
                e.preventDefault();
                console.log('💾 [Auto-save] Salvando ao clicar fora do modal...');
                try {
                  // Cancela timeout pendente
                  if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                  }
                  await saveBookingOnce({ autoSave: true });
                  console.log('✅ [Auto-save] Salvo ao clicar fora!');
                } catch (error) {
                  console.error('❌ [Auto-save] Erro ao salvar ao clicar fora:', error);
                } finally {
                  setIsModalOpen(false);
                }
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
          {/* Header fixo */}
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span>
                  {editingBooking
                    ? (() => {
                        const code = editingBooking?.code;
                        const codeStr = typeof code === 'number' ? String(code).padStart(3, '0') : null;
                        return codeStr ? `Editar agendamento - ${codeStr}` : 'Editar Agendamento';
                      })()
                    : 'Novo Agendamento'}
                </span>
                {isAutoSaving && (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs bg-blue-600/10 text-blue-400 border-blue-700/30">
                    <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </span>
                )}
              </div>
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
                    const hhmm = (mins) => {
                      let h = Math.floor(mins / 60);
                      const m = mins % 60;
                      // Converter 24:00 para 00:00
                      if (h >= 24) h = h % 24;
                      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    };
                    return ` • ${hhmm(s)}–${hhmm(e)}`;
                  })()}
                </span>
              </span>
            </DialogTitle>
            <DialogDescription>
              {editingBooking 
                ? 'As alterações são salvas automaticamente enquanto você edita.' 
                : 'Preencha os detalhes para criar uma nova reserva.'}
            </DialogDescription>
          </DialogHeader>

          {/* Conteúdo com scroll */}
          <div className="flex-1 overflow-y-auto px-6">
            <div className="grid md:grid-cols-2 gap-4 pb-4">
            {/* Coluna esquerda */}
            <div className="space-y-4">
              {/* Clientes */}
              <div>
                <Label htmlFor="clientes-field" className="font-bold">Clientes</Label>
                <div className="flex gap-2 mt-1">
                  {/* effective open fully controls visibility and ignores programmatic closes */}
                  <Popover
                    modal={false}
                    open={effectiveCustomerPickerOpen}
                    onOpenChange={(open) => {
                      const now = Date.now();
                      const guardActive = (
                        now < (selectionLockUntilRef.current || 0) ||
                        now < (suppressPickerCloseRef.current || 0) ||
                        now < (pickerBlockUntilRef.current || 0) ||
                        isUiBusy()
                      );
                      // Não fechar automaticamente enquanto o modal de novo cliente estiver aberto ou enquanto a lista estiver recarregando
                      if ((isClientFormOpen || clientsLoading) && open === false) return;
                      // Bloqueio de fechamento durante janelas de proteção / uiBusy
                      if (!open && guardActive) {
                        pickerLog('onOpenChange:blocked:guard-window');
                        return;
                      }
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
                        // Before actually closing, preserve current selection (even if empty)
                        try {
                          const cur = Array.isArray(selectedClientsRef.current) ? [...selectedClientsRef.current] : [];
                          // Respeita seleção vazia se usuário removeu todos os clientes
                          if (cur.length > 0) {
                            lastSelActionRef.current = 'onOpenChange:close:preserve';
                            try { sessionStorage.setItem(persistLastKey, JSON.stringify(cur)); } catch {}
                            setChipsSnapshotSafe(cur);
                            applySelectedClients('onOpenChange:close:preserve', cur);
                          } else if (!clearedByUserRef.current) {
                            // Só aplica seleção vazia se não foi limpeza intencional
                            lastSelActionRef.current = 'onOpenChange:close:empty';
                            applySelectedClients('onOpenChange:close:empty', []);
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
                        const now = Date.now();
                        const guardActive = (
                          now < (selectionLockUntilRef.current || 0) ||
                          now < (suppressPickerCloseRef.current || 0) ||
                          now < (pickerBlockUntilRef.current || 0) ||
                          isUiBusy()
                        );
                        if (guardActive) { e.preventDefault(); return; }
                        // Permitir interação externa quando não estiver carregando e nem com o modal de cliente aberto
                        if (isClientFormOpen || clientsLoading) { e.preventDefault(); return; }
                        // Snapshot da seleção atual antes de fechar por clique fora
                        try {
                          const cur = Array.isArray(selectedClientsRef.current) ? [...selectedClientsRef.current] : [];
                          // Respeita seleção atual, mesmo que vazia
                          if (cur.length > 0) {
                            lastSelActionRef.current = 'outside:close:snapshot';
                            lastNonEmptySelectionRef.current = cur;
                            try { sessionStorage.setItem(persistLastKey, JSON.stringify(cur)); } catch {}
                            setChipsSnapshotSafe(cur);
                            // Garante que o form persista a seleção atual
                            applySelectedClients('outside:close:apply', cur);
                            clearedByUserRef.current = false;
                          } else {
                            // Seleção vazia - limpa refs para evitar restauração futura
                            lastSelActionRef.current = 'outside:close:empty';
                            // CORREÇÃO: Limpa lastNonEmptySelectionRef quando usuário limpou intencionalmente
                            if (clearedByUserRef.current) {
                              lastNonEmptySelectionRef.current = [];
                              try { sessionStorage.removeItem(persistLastKey); } catch {}
                              console.warn('[CustomerPicker][outside:close:empty:cleared]', { ts: new Date().toISOString() });
                            }
                            applySelectedClients('outside:close:empty', []);
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
                          // Removed verbose CLOSE:pointerOutside log
                        } catch {}
                        closedByOutsideRef.current = true;
                        customerPickerIntentRef.current = 'close';
                        customerPickerDesiredOpenRef.current = false; try { localStorage.removeItem('agenda:customerPicker:desiredAt'); } catch {}
                        setIsCustomerPickerOpen(false);
                        setEffectiveCustomerPickerOpen(false);
                        
                        // Salva imediatamente ao clicar fora (modo edição)
                        if (editingBooking?.id && autoSaveEnabledRef.current) {
                          (async () => {
                            try {
                              if (autoSaveTimeoutRef.current) {
                                clearTimeout(autoSaveTimeoutRef.current);
                              }
                              console.log('💾 [CustomerPicker] Salvando participantes (clique fora)...');
                              await saveBookingOnce({ autoSave: true });
                              console.log('✅ [CustomerPicker] Participantes salvos!');
                            } catch (error) {
                              console.error('❌ [CustomerPicker] Erro ao salvar:', error);
                            }
                          })();
                        }
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
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                          <Input
                            ref={customerQueryInputRef}
                            placeholder="Buscar por código ou nome..."
                            value={customerQuery}
                            onChange={(e) => {
                              setCustomerQuery(e.target.value);
                              setFocusedCustomerIndex(0); // Reset foco ao buscar
                            }}
                            onKeyDown={(e) => {
                              // Permitir navegação por setas mesmo no input
                              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                const filtered = (localCustomers || []).filter((c) => {
                                  const q = customerQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  const label = String(getCustomerLabel(c) || '').toLowerCase();
                                  return label.includes(q);
                                });
                                const clienteConsumidor = filtered.find(c => c?.is_consumidor_final === true);
                                const clientesNormais = filtered.filter(c => c?.is_consumidor_final !== true);
                                const sortedNormais = clientesNormais.slice().sort((a, b) => {
                                  const ca = typeof a === 'object' ? (Number.isFinite(Number(a?.codigo)) ? Number(a.codigo) : Infinity) : Infinity;
                                  const cb = typeof b === 'object' ? (Number.isFinite(Number(b?.codigo)) ? Number(b.codigo) : Infinity) : Infinity;
                                  if (ca !== cb) return ca - cb;
                                  const na = String(getCustomerName(a) || '').toLowerCase();
                                  const nb = String(getCustomerName(b) || '').toLowerCase();
                                  return na.localeCompare(nb);
                                });
                                const finalList = clienteConsumidor ? [clienteConsumidor, ...sortedNormais] : sortedNormais;
                                
                                if (e.key === 'ArrowDown') {
                                  setFocusedCustomerIndex(prev => Math.min(prev + 1, finalList.length - 1));
                                } else {
                                  setFocusedCustomerIndex(prev => Math.max(prev - 1, 0));
                                }
                              }
                              
                              // Enter para selecionar o cliente focado
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const filtered = (localCustomers || []).filter((c) => {
                                  const q = customerQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  const label = String(getCustomerLabel(c) || '').toLowerCase();
                                  return label.includes(q);
                                });
                                const clienteConsumidor = filtered.find(c => c?.is_consumidor_final === true);
                                const clientesNormais = filtered.filter(c => c?.is_consumidor_final !== true);
                                const sortedNormais = clientesNormais.slice().sort((a, b) => {
                                  const ca = typeof a === 'object' ? (Number.isFinite(Number(a?.codigo)) ? Number(a.codigo) : Infinity) : Infinity;
                                  const cb = typeof b === 'object' ? (Number.isFinite(Number(b?.codigo)) ? Number(b.codigo) : Infinity) : Infinity;
                                  if (ca !== cb) return ca - cb;
                                  const na = String(getCustomerName(a) || '').toLowerCase();
                                  const nb = String(getCustomerName(b) || '').toLowerCase();
                                  return na.localeCompare(nb);
                                });
                                const finalList = clienteConsumidor ? [clienteConsumidor, ...sortedNormais] : sortedNormais;
                                
                                const focusedClient = finalList[focusedCustomerIndex];
                                if (focusedClient) {
                                  const id = focusedClient.id;
                                  const nome = getCustomerName(focusedClient);
                                  const codigo = focusedClient.codigo;
                                  const novo = { id, nome, codigo };
                                  const next = [...(Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []), novo];
                                  try { if ((selectedClientsRef.current || []).length === 0) firstSelectedIdRef.current = id || null; } catch {}
                                  try { clearedByUserRef.current = false; } catch {}
                                  try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                                  try { selectedClientsRef.current = next; } catch {}
                                  applySelectedClients('keyboard:enter', next);
                                  customerPickerDesiredOpenRef.current = true;
                                  try { localStorage.setItem('agenda:customerPicker:desiredAt', String(Date.now())); } catch {}
                                }
                              }
                            }}
                            className="pl-10 pr-10"
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
                          ref={customerListContainerRef}
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
                          {!clientsLoading && (() => {
                            const filtered = (localCustomers || []).filter((c) => {
                              const q = customerQuery.trim().toLowerCase();
                              if (!q) return true;
                              const label = String(getCustomerLabel(c) || '').toLowerCase();
                              return label.includes(q);
                            });

                            // Separar cliente consumidor dos demais
                            const clienteConsumidor = filtered.find(c => c?.is_consumidor_final === true);
                            const clientesNormais = filtered.filter(c => c?.is_consumidor_final !== true);

                            // Ordenar clientes normais por codigo
                            const sortedNormais = clientesNormais.slice().sort((a, b) => {
                              const ca = typeof a === 'object' ? (Number.isFinite(Number(a?.codigo)) ? Number(a.codigo) : Infinity) : Infinity;
                              const cb = typeof b === 'object' ? (Number.isFinite(Number(b?.codigo)) ? Number(b.codigo) : Infinity) : Infinity;
                              if (ca !== cb) return ca - cb;
                              const na = String(getCustomerName(a) || '').toLowerCase();
                              const nb = String(getCustomerName(b) || '').toLowerCase();
                              return na.localeCompare(nb);
                            });

                            // Cliente consumidor sempre no topo, depois os normais
                            const finalList = clienteConsumidor ? [clienteConsumidor, ...sortedNormais] : sortedNormais;

                            return finalList;
                          })().map((c, listIndex) => {
                            const isConsumidorFinal = c?.is_consumidor_final === true;
                            const id = typeof c === 'object' ? c.id : null;
                            const nome = getCustomerName(c);
                            const codigo = typeof c === 'object' ? c.codigo : null;
                            const nameKey = String(nome || '').toLowerCase();
                            const isSame = (sc) => (sc.id && id) ? (sc.id === id) : (String(sc.nome || '').toLowerCase() === nameKey);
                            const selected = (form.selectedClients || []).some(isSame);
                            const isFocused = listIndex === focusedCustomerIndex;
                            return (
                              <button
                                key={id || nameKey}
                                ref={(el) => { customerButtonRefs.current[listIndex] = el; }}
                                type="button"
                                className={`w-full text-left py-3 px-4 flex items-center gap-3 transition-all border-b border-border last:border-0 ${
                                  isFocused ? 'ring-2 ring-blue-500 ring-inset z-10' : ''
                                } ${
                                  isConsumidorFinal
                                    ? 'bg-gradient-to-r from-amber-500/5 to-transparent hover:from-amber-500/10 border-l-2 border-l-amber-500/40' // Cliente Consumidor com destaque sutil
                                    : selected 
                                      ? 'bg-emerald-600/20 hover:bg-emerald-600/30' 
                                      : 'hover:bg-surface-2'
                                }`}
                                onMouseEnter={() => setFocusedCustomerIndex(listIndex)}
                                onMouseDown={(e) => { e.stopPropagation(); }}
                                role="option"
                                aria-checked={selected}
                                onClick={() => {
                                  // Sempre adiciona, permitindo duplicados (mesmo comportamento do modal de pagamentos)
                                  const novo = { id, nome, codigo };
                                  const next = [...(Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []), novo];
                                  // Se é o primeiro desta sessão, fixar como primeiro para o rótulo
                                  try { if ((selectedClientsRef.current || []).length === 0) firstSelectedIdRef.current = id || null; } catch {}
                                  try { clearedByUserRef.current = false; } catch {}
                                  try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                                  try { selectedClientsRef.current = next; } catch {}
                                  applySelectedClients('list:add', next);
                                  // Garante que o picker permaneça aberto após a seleção
                                  customerPickerDesiredOpenRef.current = true;
                                  try { localStorage.setItem('agenda:customerPicker:desiredAt', String(Date.now())); } catch {}
                                }}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  {codigo !== null && codigo !== undefined && (
                                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-colors ${
                                      isConsumidorFinal 
                                        ? 'bg-amber-500/15 text-amber-300/90 ring-1 ring-amber-500/20' 
                                        : 'bg-emerald-600/20 text-emerald-400'
                                    }`}>
                                      #{codigo}
                                    </span>
                                  )}
                                  <div className="flex-1 flex flex-col gap-1">
                                    <span className={`font-medium truncate ${isConsumidorFinal ? 'text-amber-100/90' : ''}`}>
                                      {nome}
                                    </span>
                                    {isConsumidorFinal && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/70 font-medium">
                                        <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Cliente Padrão
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {(() => {
                                  const selectionCount = (form.selectedClients || []).filter(sc => isSame(sc)).length;
                                  if (selectionCount > 0) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-base font-bold transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Remover uma ocorrência do cliente
                                            const current = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
                                            const index = current.findIndex(sc => isSame(sc));
                                            if (index !== -1) {
                                              const next = [...current];
                                              next.splice(index, 1);
                                              try { clearedByUserRef.current = next.length === 0; } catch {}
                                              try { if (next.length === 0) firstSelectedIdRef.current = null; } catch {}
                                              try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                                              try { selectedClientsRef.current = next; } catch {}
                                              applySelectedClients('list:remove-one', next);
                                            }
                                          }}
                                        >
                                          -
                                        </button>
                                        <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-full bg-sky-600 text-white text-base font-bold">
                                          {selectionCount}
                                        </span>
                                        <button
                                          type="button"
                                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Adicionar uma ocorrência do cliente
                                            const novo = { id, nome, codigo };
                                            const next = [...(Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []), novo];
                                            try { if ((selectedClientsRef.current || []).length === 0) firstSelectedIdRef.current = id || null; } catch {}
                                            try { clearedByUserRef.current = false; } catch {}
                                            try { if (next.length > 0) { lastNonEmptySelectionRef.current = next; } } catch {}
                                            try { selectedClientsRef.current = next; } catch {}
                                            applySelectedClients('list:add-one', next);
                                          }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
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
                              // Snapshot da seleção atual a partir das refs
                              // IMPORTANTE: Respeita seleção vazia se usuário desselecionou intencionalmente
                              const cur = Array.isArray(selectedClientsRef.current) ? [...selectedClientsRef.current] : [];
                              const currentSel = cur; // Usa seleção atual, mesmo que vazia
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
                              // Aplica seleção atual (respeitando se está vazia)
                              setForm(f => ({ ...f, selectedClients: [...currentSel] }));
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
                              
                              // Salva imediatamente ao clicar em Concluir (modo edição)
                              if (editingBooking?.id && autoSaveEnabledRef.current) {
                                (async () => {
                                  try {
                                    if (autoSaveTimeoutRef.current) {
                                      clearTimeout(autoSaveTimeoutRef.current);
                                    }
                                    console.log('💾 [CustomerPicker] Salvando participantes (Concluir)...');
                                    await saveBookingOnce({ autoSave: true });
                                    console.log('✅ [CustomerPicker] Participantes salvos!');
                                  } catch (error) {
                                    console.error('❌ [CustomerPicker] Erro ao salvar:', error);
                                  }
                                })();
                              }
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
                      // PROTEÇÃO: Salva seleção atual antes de abrir modal de cadastro
                      try {
                        const current = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
                        if (current.length > 0) {
                          lastNonEmptySelectionRef.current = current;
                          sessionStorage.setItem(persistLastKey, JSON.stringify(current));
                          setChipsSnapshotSafe(current);
                          console.warn('[CustomerPicker][+Novo:save-selection]', { 
                            savedCount: current.length 
                          });
                        }
                      } catch {}
                      
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
                    {chipsClients.map((c, chipIdx) => {
                      const nameKey = String(c?.nome || '').toLowerCase();
                      // Usar índice para permitir duplicados
                      const key = `${c?.id || nameKey}-${chipIdx}`;
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
                              dbg('CustomerPicker:chip:remove', { token, chipIdx }); // keep chip-related log
                              // Remover apenas este cliente específico pelo índice
                              const next = (Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : []).filter((_, idx) => idx !== chipIdx);
                              try { clearedByUserRef.current = next.length === 0; } catch {}
                              // CORREÇÃO: Sempre atualiza lastNonEmptySelectionRef, mesmo se vazio
                              try { 
                                lastNonEmptySelectionRef.current = next; 
                                // Se ficou vazio, também limpa do sessionStorage
                                if (next.length === 0) {
                                  sessionStorage.removeItem(persistLastKey);
                                  console.warn('[CustomerPicker][chip:remove:cleared-all]', { ts: new Date().toISOString() });
                                }
                              } catch {}
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
                <Label htmlFor="quadra-select" className="font-bold">Quadra</Label>
                <Select value={form.court} onValueChange={(v) => setForm((f) => ({ ...f, court: v }))}>
                  <SelectTrigger className="mt-1" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}>
                    <SelectValue>
                      {form.court && (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: getCourtColor(form.court) }}
                          />
                          <span>{form.court}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {availableCourts.map((name) => {
                      // Usar weekDiasFuncionamento se disponível, senão usar diasFuncionamento
                      const dateKey = format(form.date, 'yyyy-MM-dd');
                      const dayFuncionamento = weekDiasFuncionamento[dateKey] || {};
                      const isDisabled = dayFuncionamento[name] && !dayFuncionamento[name].funciona;
                      return (
                        <SelectItem 
                          key={name} 
                          value={name}
                          disabled={isDisabled}
                          className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getCourtColor(name) }}
                            />
                            <span>{name}</span>
                            {isDisabled && (
                              <span className="text-xs text-text-muted ml-auto">
                                (Fechada)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Modalidade */}
              <div>
                <Label htmlFor="modalidade-select" className="font-bold">Modalidade</Label>
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
                <Label htmlFor="status-select" className="font-bold">Status</Label>
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
                  <div className="mt-1.5 text-xs text-text-primary font-medium bg-brand/5 border border-brand/20 rounded px-2 py-1.5">
                    {nextAutomationMessage}
                  </div>
                )}
              </div>

              {/* Horário */}
              <div>
                <Label htmlFor="horario-inicio" className="font-bold">Horário</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select value={String(form.startMinutes)} onValueChange={(v) => setForm((f) => ({ ...f, startMinutes: Number(v) }))}>
                    <SelectTrigger className="w-32" aria-label="Hora início" onMouseDown={() => { if (effectiveCustomerPickerOpen) setTimeout(closeCustomerPicker, 0); }}><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px] z-[60] [&>div]:scrollbar-thin [&>div]:scrollbar-track-surface [&>div]:scrollbar-thumb-brand/40 [&>div]:hover:scrollbar-thumb-brand/60">
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
                    <SelectContent className="max-h-[300px] z-[60] [&>div]:scrollbar-thin [&>div]:scrollbar-track-surface [&>div]:scrollbar-thumb-brand/40 [&>div]:hover:scrollbar-thumb-brand/60">
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

              {/* Agendamento Fixo/Recorrente - Apenas para NOVOS agendamentos */}
              {!editingBooking && (
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="is-recorrente"
                      checked={isRecorrente}
                      onChange={(e) => setIsRecorrente(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                    <div className="flex-1">
                      <label htmlFor="is-recorrente" className="font-semibold text-text-primary cursor-pointer">
                        Agendamento Fixo (Recorrente)
                      </label>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Criar este agendamento automaticamente nas próximas semanas, no mesmo dia e horário
                      </p>
                    </div>
                  </div>

                  {isRecorrente && (
                    <div className="ml-7 mt-3 space-y-3">
                      <div>
                        <Label htmlFor="quantidade-semanas" className="text-sm font-medium">
                          Repetir por quantas semanas?
                        </Label>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center border border-border rounded-md bg-surface-2">
                            <button
                              type="button"
                              onClick={() => setQuantidadeSemanas(prev => Math.max(2, (prev || 2) - 1))}
                              className="px-3 py-2 hover:bg-surface-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={quantidadeSemanas <= 2}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <div className="px-4 py-2 min-w-[60px] text-center font-semibold border-x border-border">
                              {quantidadeSemanas}
                            </div>
                            <button
                              type="button"
                              onClick={() => setQuantidadeSemanas(prev => (prev || 2) + 1)}
                              className="px-3 py-2 hover:bg-surface-3 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                          <span className="text-sm text-text-secondary">
                            semanas ({quantidadeSemanas} agendamentos)
                          </span>
                        </div>
                      </div>

                      {/* Preview das datas que serão criadas */}
                      {form.date && quantidadeSemanas >= 2 && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                          <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">Datas que serão criadas:</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: quantidadeSemanas }).map((_, index) => {
                              const dataAgendamento = addDays(form.date, index * 7);
                              return (
                                <div key={index} className="inline-flex items-center gap-1.5 bg-slate-700/50 border border-slate-600 rounded px-2 py-1">
                                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs font-medium text-white">
                                    {format(dataAgendamento, "dd/MM/yyyy '('EEEE')'", { locale: ptBR })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-800/50 border-l-4 border-blue-600 rounded-r-lg p-3">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="text-xs text-gray-300">
                            <p className="font-semibold mb-1 text-blue-300">Importante: Revise os dados antes de salvar</p>
                            <p>
                              Serão criados <strong className="text-white">{quantidadeSemanas} agendamentos</strong> incluindo a data selecionada e as próximas {quantidadeSemanas - 1} semanas.
                              Editar ou cancelar depois exigirá alterar cada agendamento individualmente.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Footer fixo */}
          <DialogFooter className="flex-shrink-0 border-t border-border bg-surface px-6 py-3">
            <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Botões de ação (esquerda no desktop, topo no mobile) */}
              {editingBooking && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 sm:mr-auto w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-500 text-white border border-red-700 w-full sm:w-auto justify-center"
                      onClick={() => setIsCancelConfirmOpen(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2 opacity-90" /> 
                      Cancelar agendamento
                      <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-red-700/50 rounded border border-red-500/30">F3</kbd>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-teal-600 hover:bg-teal-500 text-white border-teal-700 w-full sm:w-auto justify-center"
                      onClick={() => { /* [DEBUG-PaymentModal] silenciado */ openPaymentModal(); }}
                    >
                      <DollarSign className="w-4 h-4 mr-2 opacity-90" /> 
                      <span className="hidden sm:inline">Gerenciar Pagamentos</span>
                      <span className="sm:hidden">Pagamentos</span>
                      <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-teal-700/50 rounded border border-teal-500/30">F4</kbd>
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
              
              {/* Botões principais (direita no desktop, embaixo no mobile) */}
              <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="border border-white/10 flex-1 sm:flex-none" 
                  onClick={async () => {
                    // 🔄 Auto-save ao fechar: SEMPRE salva antes de fechar no modo de edição
                    if (editingBooking?.id) {
                      console.log('💾 [Auto-save] Salvando ao fechar modal...');
                      try {
                        // Cancela timeout pendente
                        if (autoSaveTimeoutRef.current) {
                          clearTimeout(autoSaveTimeoutRef.current);
                        }
                        await saveBookingOnce({ autoSave: true });
                        console.log('✅ [Auto-save] Salvo ao fechar!');
                      } catch (error) {
                        console.error('❌ [Auto-save] Erro ao salvar ao fechar:', error);
                      }
                    }
                    
                    setIsModalOpen(false);
                  }}
                >
                  Fechar
                  <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-white/10 rounded border border-white/20">Esc</kbd>
                </Button>
                {/* Botão Salvar: apenas em modo de criação (auto-save em modo de edição) */}
                {!editingBooking?.id && (
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed flex-1 sm:flex-none"
                    disabled={isSavingBooking}
                    onClick={async () => {
                      const clickTs = Date.now();
                      try {
                        if (isSavingBooking) {
                          return;
                        }
                        
                        // Se for recorrente e não estiver editando, mostrar modal de confirmação
                        if (isRecorrente && !editingBooking) {
                          setShowRecorrenteConfirm(true);
                          return;
                        }
                        
                        pendingSaveRef.current = true;
                        completedSaveRef.current = false;
                        await saveBookingOnce();
                      } catch (e) {
                        // Error handled in saveBookingOnce
                      }
                    }}
                  >
                    Salvar
                    <kbd className="hidden sm:inline ml-2 px-2 py-1 text-sm font-mono bg-emerald-700/50 rounded border border-emerald-500/30">↵</kbd>
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {/* Modal de Confirmação para Agendamento Recorrente */}
      <AlertDialog open={showRecorrenteConfirm} onOpenChange={setShowRecorrenteConfirm}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-600/40">
                <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              Confirmar Criação de Agendamentos Recorrentes
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 mt-4">
              {/* Preview das datas no modal */}
              {form.date && quantidadeSemanas >= 2 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">📅 Datas que serão criadas:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: quantidadeSemanas }).map((_, index) => {
                      const dataAgendamento = addDays(form.date, index * 7);
                      return (
                        <div key={index} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5">
                          <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                          <span className="text-xs font-medium text-white">
                            {format(dataAgendamento, "dd/MM/yyyy '('EEEE')'", { locale: ptBR })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resumo dos Dados */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Resumo do Agendamento</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-sm text-slate-400">Quadra</span>
                    <span className="font-semibold text-white">{courtsMap[form.court]?.name || form.court}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-sm text-slate-400">Horário</span>
                    <span className="font-semibold text-white font-mono">
                      {formatMinutesToTime(form.startMinutes)} - {formatMinutesToTime(form.endMinutes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-sm text-slate-400">Modalidade</span>
                    <span className="font-semibold text-white">{form.modality}</span>
                  </div>
                  <div className="flex items-start justify-between py-2">
                    <span className="text-sm text-slate-400">Participantes</span>
                    <div className="text-right max-w-xs">
                      {form.selectedClients?.length > 0 ? (
                        <div className="font-semibold text-white">
                          {showAllParticipants 
                            ? form.selectedClients.map(c => c.nome).join(', ')
                            : form.selectedClients.slice(0, 3).map(c => c.nome).join(', ')
                          }
                          {!showAllParticipants && form.selectedClients.length > 3 && (
                            <span className="text-slate-400"> +{form.selectedClients.length - 3}</span>
                          )}
                          {form.selectedClients.length > 3 && (
                            <>
                              {' '}
                              <button
                                type="button"
                                onClick={() => setShowAllParticipants(!showAllParticipants)}
                                className="text-xs text-blue-400 hover:text-blue-300 underline inline"
                              >
                                {showAllParticipants ? 'Ver menos' : 'Ver todos'}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="font-semibold text-white">Nenhum participante</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aviso Importante */}
              <div className="bg-red-900/30 border-l-4 border-red-600 rounded-r-lg p-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">
                      <strong className="text-red-300">Importante:</strong> Após criar, editar ou cancelar exigirá alterar cada agendamento individualmente. Certifique-se de que todos os dados estão corretos!
                    </p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => {
                setShowRecorrenteConfirm(false);
                setShowAllParticipants(false);
              }}
              className="border-slate-600 hover:bg-slate-800"
            >
              Cancelar e Revisar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
              onClick={async () => {
                setShowRecorrenteConfirm(false);
                setShowAllParticipants(false);
                pendingSaveRef.current = true;
                completedSaveRef.current = false;
                await saveBookingOnce();
              }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirmar e Criar {quantidadeSemanas} Agendamentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Removido modal de pagamentos antigo - agora está em componente separado */}
      
      {isClientFormOpen && (
        <ClientFormModal
            open={isClientFormOpen}
            onOpenChange={(open) => {
              setIsClientFormOpen(open); 
              if (!open) {
                setClientForModal(null);
                if (window.__paymentModalCallback) {
                  window.__paymentModalCallback = null;
                }
              }
            }}
            client={clientForModal}
            onSaved={(saved) => {
            try {
              if (saved && typeof saved === 'object') {
                console.warn('[CustomerPicker][onSaved:START]', { 
                  clientId: saved.id, 
                  clientName: saved.nome,
                  currentSelection: Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current.length : 0
                });
                
                // ✅ PROTEÇÃO CRÍTICA: Bloqueia qualquer limpeza por 3 segundos
                try { 
                  preventClearsUntilRef.current = Date.now() + 3000;
                  selectionLockUntilRef.current = Date.now() + 3000;
                  restoreGuardUntilRef.current = Date.now() + 3000;
                } catch {}
                
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
                  const newSelection = [novo, ...withoutDup];
                  
                  // ✅ CORREÇÃO: Sincroniza TODAS as refs para evitar dessincronização
                  try { selectedClientsRef.current = newSelection; } catch {}
                  try { lastNonEmptySelectionRef.current = newSelection; } catch {}
                  try { setChipsSnapshotSafe(newSelection); } catch {}
                  try { sessionStorage.setItem(persistLastKey, JSON.stringify(newSelection)); } catch {}
                  
                  // Marca que NÃO foi limpeza intencional do usuário
                  try { clearedByUserRef.current = false; } catch {}
                  
                  console.warn('[CustomerPicker][onSaved:COMPLETE]', { 
                    newClientId: saved.id, 
                    newClientName: saved.nome,
                    totalSelected: newSelection.length,
                    refsSynced: true,
                    protectionActive: true
                  });
                  
                  return { ...f, selectedClients: newSelection };
                });
                
                // Reforço adicional após microtask para garantir persistência
                Promise.resolve().then(() => {
                  try {
                    const current = Array.isArray(selectedClientsRef.current) ? selectedClientsRef.current : [];
                    if (current.length > 0) {
                      setForm(f => ({ ...f, selectedClients: [...current] }));
                      console.warn('[CustomerPicker][onSaved:REASSERT]', { count: current.length });
                    }
                  } catch {}
                });
                
                /* console cleaned: onSaved */
              }
              
              // Executar callback do PaymentModal se existir
              if (window.__paymentModalCallback && typeof window.__paymentModalCallback === 'function') {
                try {
                  if (window.__protectPaymentModal) {
                    window.__protectPaymentModal(3000);
                  }
                  window.__paymentModalCallback();
                  window.__paymentModalCallback = null;
                } catch (e) {
                  console.error('[PaymentModal][callback:ERROR]', e);
                }
              }
            } catch (e) {
              console.error('[CustomerPicker][onSaved:ERROR]', e);
            }
          }}
          />
      )}
      
      {/* Modais de pagamento e edição de participantes - renderizados aqui para ter acesso ao form e localCustomers */}
      {isPaymentModalOpen && (
        <PaymentModal 
          setIsModalOpen={setIsModalOpen}
          setBookings={setBookings}
          form={form}
          setForm={setForm}
          localCustomers={localCustomers}
          onOpenClientModal={(callback) => {
            setIsClientFormOpen(true);
            // Armazenar callback para executar após salvar
            window.__paymentModalCallback = callback;
          }}
        />
      )}
      
      {isEditParticipantModalOpen && (
        <EditParticipantModal 
          form={form}
          setForm={setForm}
          localCustomers={localCustomers}
        />
      )}
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
      
      // Filtro de pagamentos pendentes
      if (viewFilter.pendingPayments) {
        dayBookings = dayBookings.filter(b => {
          const participants = participantsByAgendamento[b.id] || [];
          const hasPending = participants.some(p => String(p.status_pagamento || '').toLowerCase() !== 'pago');
          return hasPending && participants.length > 0;
        });
      }
      
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        dayBookings = dayBookings.filter(b =>
          (b.customer || '').toLowerCase().includes(q)
          || (b.court || '').toLowerCase().includes(q)
          || (statusConfig[b.status]?.label || '').toLowerCase().includes(q)
        );
      }
      return (viewFilter.scheduled || viewFilter.canceledOnly || viewFilter.pendingPayments) ? dayBookings : [];
    }, [bookings, currentDate, viewFilter.scheduled, viewFilter.canceledOnly, viewFilter.pendingPayments, searchQuery, participantsByAgendamento]);

  // Calcular estatísticas do dia para o header (filtrado pela quadra ativa)
  const dayStats = useMemo(() => {
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    const courtFilter = activeCourtFilter || selectedCourts[0];
    const dayBookings = bookings.filter(b => 
      format(b.start, 'yyyy-MM-dd') === dayStr && 
      b.status !== 'canceled' &&
      b.court === courtFilter
    );
    
    let totalPendingPayments = 0;
    dayBookings.forEach(booking => {
      const participants = participantsByAgendamento[booking.id] || [];
      const pendingCount = participants.filter(p => String(p.status_pagamento || '').toLowerCase() !== 'pago').length;
      totalPendingPayments += pendingCount;
    });
    
    return {
      totalBookings: dayBookings.length,
      totalPendingPayments
    };
  }, [bookings, currentDate, participantsByAgendamento, activeCourtFilter, selectedCourts]);

  // Agendamentos da semana (para visão semanal)
  const weekBookings = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = addDays(weekStart, 6);
    let weekBookingsData = bookings.filter(b => {
      const bookingDate = startOfDay(b.start);
      const start = startOfDay(weekStart);
      const end = startOfDay(weekEnd);
      return bookingDate >= start && bookingDate <= end;
    });
    
    // Aplicar mesmos filtros que o dia
    weekBookingsData = viewFilter.canceledOnly
      ? weekBookingsData.filter(b => b.status === 'canceled')
      : weekBookingsData.filter(b => b.status !== 'canceled');
    
    if (viewFilter.pendingPayments) {
      weekBookingsData = weekBookingsData.filter(b => {
        const participants = participantsByAgendamento[b.id] || [];
        const hasPending = participants.some(p => String(p.status_pagamento || '').toLowerCase() !== 'pago');
        return hasPending && participants.length > 0;
      });
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      weekBookingsData = weekBookingsData.filter(b =>
        (b.customer || '').toLowerCase().includes(q)
        || (b.court || '').toLowerCase().includes(q)
        || (statusConfig[b.status]?.label || '').toLowerCase().includes(q)
      );
    }
    
    return (viewFilter.scheduled || viewFilter.canceledOnly || viewFilter.pendingPayments) ? weekBookingsData : [];
  }, [bookings, currentDate, viewFilter.scheduled, viewFilter.canceledOnly, viewFilter.pendingPayments, searchQuery, participantsByAgendamento]);

  // Após computar os resultados, rola até o primeiro match quando houver busca
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (!(viewFilter.scheduled || viewFilter.canceledOnly || viewFilter.pendingPayments)) return; // só quando algum filtro visível
    if (!filteredBookings || filteredBookings.length === 0) return;
    const first = [...filteredBookings].sort((a, b) => a.start - b.start)[0];
    if (!first?.id) return;
    const el = document.getElementById(`booking-${first.id}`);
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [searchQuery, filteredBookings, viewFilter.scheduled, viewFilter.canceledOnly, viewFilter.pendingPayments]);

  // Inteligência nos checkboxes: ao ativar Agendados, Cancelados ou Pagamentos Pendentes, rola até o primeiro visível daquele tipo
  useEffect(() => {
    const container = scrollRef.current;
    const prev = prevFiltersRef.current || {};
    // Detecta habilitação dos filtros
    const justEnabledCanceled = viewFilter.canceledOnly && !prev.canceledOnly;
    const justEnabledScheduled = viewFilter.scheduled && !prev.scheduled && !viewFilter.canceledOnly; // scheduled ativo e não em modo cancelados
    const justEnabledPending = viewFilter.pendingPayments && !prev.pendingPayments;
    if (!container || (!justEnabledCanceled && !justEnabledScheduled && !justEnabledPending)) {
      prevFiltersRef.current = { scheduled: viewFilter.scheduled, canceledOnly: viewFilter.canceledOnly, pendingPayments: viewFilter.pendingPayments };
      return;
    }
    // Lista já está filtrada para o modo atual (canceledOnly restringe para cancelados)
    const list = filteredBookings || [];
    if (list.length === 0) {
      prevFiltersRef.current = { scheduled: viewFilter.scheduled, canceledOnly: viewFilter.canceledOnly, pendingPayments: viewFilter.pendingPayments };
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
    prevFiltersRef.current = { scheduled: viewFilter.scheduled, canceledOnly: viewFilter.canceledOnly, pendingPayments: viewFilter.pendingPayments };
  }, [viewFilter.scheduled, viewFilter.canceledOnly, viewFilter.pendingPayments, filteredBookings]);

  // Cores por quadra agora são geradas de forma determinística via getCourtColor(name)

  // Calcular horários baseado na quadra ativa (se houver filtro)
  const activeCourtHours = useMemo(() => {
    if (!activeCourtFilter || !courtsMap[activeCourtFilter]) {
      return { start: dayStartHour, end: dayEndHourExclusive };
    }
    
    const court = courtsMap[activeCourtFilter];
    const startTime = court.hora_inicio || `${dayStartHour}:00:00`;
    const endTime = court.hora_fim || `${dayEndHourExclusive}:00:00`;
    
    const [startHour, startMin] = String(startTime).split(':').map(Number);
    const [endHour, endMin] = String(endTime).split(':').map(Number);
    
    // Tratar 00:00:00 como 24:00 (meia-noite)
    const adjustedEndHour = (endHour === 0 && endMin === 0) ? 24 : endHour;
    const endMinutesTotal = adjustedEndHour * 60 + (endMin || 0);
    
    // Usar exatamente os horários da quadra
    return {
      start: startHour || dayStartHour,
      end: adjustedEndHour || dayEndHourExclusive,
      startMinutes: (startHour || 0) * 60 + (startMin || 0),
      endMinutes: endMinutesTotal
    };
  }, [activeCourtFilter, courtsMap, dayStartHour, dayEndHourExclusive]);
  
  const hoursList = useMemo(() => {
    const start = activeCourtHours.start;
    const end = activeCourtHours.end;
    return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
  }, [activeCourtHours]);
  
  const totalGridHeight = useMemo(() => {
    const start = activeCourtHours.start;
    const end = activeCourtHours.end;
    return Math.max(0, (end - start)) * (60 / SLOT_MINUTES) * SLOT_HEIGHT;
  }, [activeCourtHours]);

  return (
    <>
      <motion.div variants={isModalOpen ? undefined : pageVariants} initial={isModalOpen ? false : "hidden"} animate={isModalOpen ? false : "visible"} className={cn("h-full w-full flex flex-col md:px-0", isGridExpanded && "fixed inset-0 z-40 bg-surface")}>

        {/* Controls */}
        <motion.div variants={itemVariants} className="p-3 bg-surface mb-6 md:rounded-lg">
          <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            {/* Navegação de data */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => viewMode === 'day' ? setCurrentDate(subDays(currentDate, 1)) : setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="h-5 w-5" /></Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="w-full sm:w-auto max-w-full justify-center text-base font-semibold whitespace-nowrap truncate">
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {viewMode === 'day' ? (
                      <>
                        <span className="hidden sm:inline">{format(currentDate, "EEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                        <span className="sm:hidden">{format(currentDate, "EEE, dd/MM/yyyy", { locale: ptBR })}</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">{getWeekRangeLabel(currentDate)}</span>
                        <span className="sm:hidden">{format(getWeekStart(currentDate), 'dd/MM/yyyy')} - {format(addDays(getWeekStart(currentDate), 6), 'dd/MM/yyyy')}</span>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={currentDate} onSelect={(date) => date && setCurrentDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => viewMode === 'day' ? setCurrentDate(addDays(currentDate, 1)) : setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-5 w-5" /></Button>
            </div>

            {/* Desktop: Select de Quadras (entre data e filtros) */}
            {selectedCourts.length > 0 && (
              <div className="hidden md:flex md:justify-center md:flex-1">
                {selectedCourts.length === 1 ? (
                  // Badge quando há apenas uma quadra (mesmo estilo do select)
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg w-52 h-10 border-2 border-brand/30 bg-gradient-to-r from-brand/5 to-brand/10">
                    <div
                      className="h-3 w-3 rounded-full shadow-sm"
                      style={{ backgroundColor: getCourtColor(selectedCourts[0]) }}
                    />
                    <span className="font-semibold text-sm">{selectedCourts[0]}</span>
                  </div>
                ) : (
                  // Select quando há múltiplas quadras
                  <Select value={activeCourtFilter || selectedCourts[0]} onValueChange={(court) => {
                    setActiveCourtFilter(court);
                  }}>
                    <SelectTrigger className="w-52 h-10 border-2 border-brand/30 bg-gradient-to-r from-brand/5 to-brand/10 hover:border-brand/50 hover:bg-gradient-to-r hover:from-brand/10 hover:to-brand/15 transition-all shadow-sm">
                      <SelectValue placeholder="Selecionar quadra" />
                    </SelectTrigger>
                    <SelectContent className="border-brand/30">
                      {selectedCourts.map((court) => {
                        const color = getCourtColor(court);
                        return (
                          <SelectItem key={court} value={court}>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-3 w-3 rounded-full shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-semibold">{court}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Filtros e ações - Reorganizado para mobile */}
            <div className="flex flex-col gap-3 w-full md:w-auto md:ml-auto">
              {/* Linha 1 (Mobile): Toggle Dia/Semana, Filtros, Expandir e Configurações */}
              <div className="flex items-center gap-3 justify-center md:hidden">
                {/* Toggle Dia/Semana */}
                <div className="flex items-center border border-border rounded-lg bg-surface-2/30 p-0.5">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => setViewMode('day')}
                  >
                    Dia
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => setViewMode('week')}
                  >
                    Semana
                  </Button>
                </div>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={availableCourts.length === 0}>
                    <SlidersHorizontal className="h-4 w-4" /> Filtros
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <DropdownMenuLabel className="p-0">Exibição</DropdownMenuLabel>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-text-muted hover:text-text-primary"
                      onClick={() => setViewFilter({ scheduled: true, available: true, canceledOnly: false, pendingPayments: false })}
                    >
                      Limpar
                    </Button>
                  </div>
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
                  <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-warning" />
                        <span>Pagamentos Pendentes</span>
                      </div>
                      <Checkbox
                        checked={viewFilter.pendingPayments}
                        onCheckedChange={(checked) => setViewFilter(prev => ({ ...prev, pendingPayments: !!checked }))}
                      />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="relative inline-block group">
                <Button
                  variant={isGridExpanded ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsGridExpanded(!isGridExpanded)}
                  aria-label={isGridExpanded ? "Minimizar grid" : "Expandir grid"}
                >
                  {isGridExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <div className="hidden group-hover:block absolute right-0 mt-1 z-50 pointer-events-none">
                  <div className="px-2 py-1 rounded-md bg-surface-2 text-xs text-text-primary border border-border shadow">
                    {isGridExpanded ? "Minimizar (F10)" : "Expandir (F10)"}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsSettingsOpen(true)}
                disabled={availableCourts.length === 0}
                aria-label="Configurar agenda"
                title="Configurar agenda"
              >
                <Settings className="h-5 w-5" />
              </Button>
              </div>

              {/* Linha 2: Busca e Agendar */}
              <div className="flex items-center gap-3 justify-end flex-shrink-0">
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
                <Button 
                  size="sm" 
                  onClick={() => {
                    // Limpa estado antes de abrir novo agendamento
                    setEditingBooking(null);
                    setPrefill(null);
                    // Limpa sessionStorage que pode ter dados antigos
                    try {
                      sessionStorage.removeItem('agenda:customerPicker:closing');
                      sessionStorage.removeItem('agenda:customerPicker:closingAt');
                    } catch {}
                    openBookingModal();
                  }} 
                  aria-label="Novo agendamento" 
                  className="gap-2" 
                  disabled={
                    availableCourts.length === 0 || 
                    selectedCourts.every(court => diasFuncionamento[court] && !diasFuncionamento[court].funciona)
                  }
                >
                  <Plus className="h-4 w-4" /> Agendar
                </Button>
              </div>

              {/* Linha 3 (Mobile): Select de Quadras */}
              {selectedCourts.length > 0 && (
                <div className="md:hidden flex justify-center">
                  {selectedCourts.length === 1 ? (
                    // Badge quando há apenas uma quadra (mesmo estilo do select)
                    <div className="flex items-center gap-3 px-4 py-2 rounded-lg w-full h-10 border-2 border-brand/30 bg-gradient-to-r from-brand/5 to-brand/10">
                      <div
                        className="h-3 w-3 rounded-full shadow-sm"
                        style={{ backgroundColor: getCourtColor(selectedCourts[0]) }}
                      />
                      <span className="font-semibold text-sm">{selectedCourts[0]}</span>
                    </div>
                  ) : (
                    // Select quando há múltiplas quadras
                    <Select value={selectedCourts[mobileCourtIndex % selectedCourts.length]} onValueChange={(court) => {
                      const index = selectedCourts.indexOf(court);
                      if (index !== -1) {
                        setMobileCourtIndex(index);
                      }
                    }}>
                      <SelectTrigger className="w-48 h-10 border-2 border-brand/30 bg-gradient-to-r from-brand/5 to-brand/10 hover:border-brand/50 hover:bg-gradient-to-r hover:from-brand/10 hover:to-brand/15 transition-all shadow-sm">
                        <SelectValue placeholder="Selecionar quadra" />
                      </SelectTrigger>
                      <SelectContent className="border-brand/30">
                        {selectedCourts.map((court) => {
                          const color = getCourtColor(court);
                          return (
                            <SelectItem key={court} value={court}>
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-3 w-3 rounded-full shadow-sm"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="font-semibold">{court}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Desktop: Toggle Dia/Semana e Filtros (mantém layout original) */}
              <div className="hidden md:flex items-center gap-3 justify-end">
                {/* Toggle Dia/Semana */}
                <div className="flex items-center border border-border rounded-lg bg-surface-2/30 p-0.5">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => setViewMode('day')}
                  >
                    Dia
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => setViewMode('week')}
                  >
                    Semana
                  </Button>
                </div>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={availableCourts.length === 0}>
                    <SlidersHorizontal className="h-4 w-4" /> Filtros
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <DropdownMenuLabel className="p-0">Exibição</DropdownMenuLabel>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-text-muted hover:text-text-primary"
                      onClick={() => setViewFilter({ scheduled: true, available: true, canceledOnly: false, pendingPayments: false })}
                    >
                      Limpar
                    </Button>
                  </div>
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
                  <DropdownMenuItem onClick={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-warning" />
                        <span>Pagamentos Pendentes</span>
                      </div>
                      <Checkbox
                        checked={viewFilter.pendingPayments}
                        onCheckedChange={(checked) => setViewFilter(prev => ({ ...prev, pendingPayments: !!checked }))}
                      />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="relative inline-block group">
                <Button
                  variant={isGridExpanded ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsGridExpanded(!isGridExpanded)}
                  aria-label={isGridExpanded ? "Minimizar grid" : "Expandir grid"}
                >
                  {isGridExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <div className="hidden group-hover:block absolute right-0 mt-1 z-50 pointer-events-none">
                  <div className="px-2 py-1 rounded-md bg-surface-2 text-xs text-text-primary border border-border shadow">
                    {isGridExpanded ? "Minimizar (F10)" : "Expandir (F10)"}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsSettingsOpen(true)}
                disabled={availableCourts.length === 0}
                aria-label="Configurar agenda"
                title="Configurar agenda"
              >
                <Settings className="h-5 w-5" />
              </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Modal de Configurações da Agenda */}
      <Dialog open={isSettingsOpen} onOpenChange={(open) => {
        if (!open) {
          // Ao fechar o modal, resetar para o último estado salvo
          setAutomation(savedAutomation);
        }
        setIsSettingsOpen(open);
      }}>
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
                    <Label htmlFor="autoconfirm-hours" className="text-sm text-text-muted">Confirmar se faltar</Label>
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
            <DialogFooter className="mt-2 gap-2">
              <Button type="button" variant="ghost" className="border border-white/10" onClick={() => setIsSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                variant="default" 
                onClick={() => {
                  console.log('🚀 BOTÃO SALVAR CLICADO!');
                  handleSaveSettings();
                }} 
                disabled={savingSettings}
              >
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
          <div className="mb-4 p-4 rounded-lg border border-border bg-surface text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="font-medium">Nenhuma quadra encontrada</div>
              <div className="text-text-muted">Cadastre suas quadras para começar a usar a agenda.</div>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/quadras">
                <span className="hidden sm:inline">Ir para Cadastros • Quadras</span>
                <span className="sm:hidden">Adicionar</span>
              </Link>
            </Button>
          </div>
        )}

        {/* Calendar Grid - Visão Semanal */}
        {selectedCourts.length > 0 && viewMode === 'week' && (() => {
          // Filtrar agendamentos da semana pela quadra ativa
          const courtFilter = activeCourtFilter || selectedCourts[0];
          const filteredWeekBookings = weekBookings.filter(b => b.court === courtFilter);
          
          return (
            <>
              <WeeklyGrid
                key={`weekly-${courtFilter}`}
                weekStart={getWeekStart(currentDate)}
                weekBookings={filteredWeekBookings}
                activeCourtFilter={courtFilter}
                courtsMap={courtsMap}
                participantsByAgendamento={participantsByAgendamento}
                onBookingClick={(booking) => {
                  setEditingBooking(booking);
                  setIsModalOpen(true);
                }}
                onSlotClick={(slotDate, court) => {
                  // Limpa estado antes de abrir novo agendamento
                  setEditingBooking(null);
                  const startMinutes = slotDate.getHours() * 60 + slotDate.getMinutes();
                  const chosenCourt = court || activeCourtFilter || selectedCourts[0];
                  const dayKey = format(slotDate, 'yyyy-MM-dd');
                  const nextStart = (() => {
                    try {
                      return (bookings || [])
                        .filter(b => b.court === chosenCourt && format(b.start, 'yyyy-MM-dd') === dayKey && b.status !== 'canceled')
                        .map(b => getHours(b.start) * 60 + getMinutes(b.start))
                        .filter(m => m > startMinutes)
                        .sort((a,b) => a - b)[0];
                    } catch {}
                    return undefined;
                  })();
                  const courtEnd = (() => {
                    const t = courtsMap[chosenCourt]?.hora_fim;
                    if (!t) return dayEndHourExclusive * 60;
                    const [h, m] = String(t).split(':').map(Number);
                    const hours = (h === 0 && (m || 0) === 0) ? 24 : h;
                    return hours * 60 + (m || 0);
                  })();
                  const extendLimit = typeof nextStart === 'number' ? nextStart : courtEnd;
                  let endMinutes = Math.min(startMinutes + 60, extendLimit);
                  if (endMinutes - startMinutes < 30) {
                    const minStartForThirty = extendLimit - 30;
                    if (minStartForThirty >= startMinutes) {
                      endMinutes = extendLimit;
                    } else {
                      endMinutes = Math.min(courtEnd, startMinutes + 30);
                    }
                  }
                  const prefillData = {
                    date: startOfDay(slotDate),
                    court: chosenCourt,
                    startMinutes,
                    endMinutes,
                  };
                  console.log('onSlotClick in AgendaPage - BEFORE setPrefill', { slotDate, court, activeCourtFilter, selectedCourts, startMinutes, endMinutes, prefillData });
                  setPrefill(prefillData);
                  console.log('onSlotClick in AgendaPage - AFTER setPrefill (state not updated yet)');
                  // Limpa sessionStorage que pode ter dados antigos
                  try {
                    sessionStorage.removeItem('agenda:customerPicker:closing');
                    sessionStorage.removeItem('agenda:customerPicker:closingAt');
                  } catch {}
                  openBookingModal();
                }}
                statusConfig={statusConfig}
                dayStartHour={dayStartHour}
                dayEndHourExclusive={dayEndHourExclusive}
                weekDiasFuncionamento={weekDiasFuncionamento}
                sidebarVisible={sidebarVisible}
              />
            </>
          );
        })()}

        {/* Calendar Grid - Visão Diária */}
        {selectedCourts.length > 0 && viewMode === 'day' && (() => {
          // Mobile: mostrar apenas uma quadra por vez
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          
          // Filtrar quadras baseado na tab ativa (Desktop) ou mobile index
          const courtsToShow = isMobile 
            ? [selectedCourts[mobileCourtIndex % selectedCourts.length]]
            : activeCourtFilter 
              ? [activeCourtFilter]
              : selectedCourts;
          
          // Calcular horários para o grid atual (mobile usa quadra atual, desktop usa filtro)
          const currentDisplayCourt = isMobile ? courtsToShow[0] : activeCourtFilter;
          const gridHours = (() => {
            if (currentDisplayCourt && courtsMap[currentDisplayCourt]) {
              const court = courtsMap[currentDisplayCourt];
              const startTime = court.hora_inicio || `${dayStartHour}:00:00`;
              const endTime = court.hora_fim || `${dayEndHourExclusive}:00:00`;
              const [startHour] = String(startTime).split(':').map(Number);
              const [endHour, endMinute] = String(endTime).split(':').map(Number);
              // Tratar 00:00:00 como 24:00 (meia-noite)
              let adjustedEndHour = (endHour === 0 && endMinute === 0) ? 24 : endHour;
              // Se tem minutos no horário final (ex: 23:30), adiciona +1 hora para incluir o slot
              if (endMinute > 0 && adjustedEndHour < 24) adjustedEndHour += 1;
              return {
                start: startHour || dayStartHour,
                end: adjustedEndHour || dayEndHourExclusive
              };
            }
            return { start: dayStartHour, end: dayEndHourExclusive };
          })();
          
          const displayHoursList = Array.from(
            { length: Math.max(0, gridHours.end - gridHours.start) }, 
            (_, i) => gridHours.start + i
          );
          
          const displayTotalGridHeight = Math.max(0, (gridHours.end - gridHours.start)) * (60 / SLOT_MINUTES) * SLOT_HEIGHT;
          
          // Verificar se alguma quadra está fechada
          const hasClosedCourts = courtsToShow.some(court => 
            diasFuncionamento[court] && !diasFuncionamento[court].funciona
          );
          
          return (
            <>
              <motion.div 
                variants={isModalOpen ? undefined : itemVariants} 
                className={cn(
                  "bg-surface fx-scroll", 
                  "overflow-auto",
                  isMobile ? "" : "rounded-lg border border-border"
                )} 
                ref={scrollRef}
                style={{ flex: '1 1 auto', minWidth: 0 }}
              >
                <div
                  className={cn("grid", !isMobile && "mx-auto")}
                  style={{
                    gridTemplateColumns: isMobile
                      ? `60px 1fr`
                      : courtsToShow.length === 1
                      ? `120px 760px`
                      : courtsToShow.length === 2
                      ? `120px repeat(2, 520px)`
                      : `120px repeat(${courtsToShow.length}, 1fr)`,
                    width: isMobile ? '100%' : (courtsToShow.length <= 2) ? 'fit-content' : undefined,
                    columnGap: isMobile ? '4px' : '16px'
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
              {displayHoursList.map((hour) => (
                <div key={`time-${hour}`} className={cn("border-r border-border", (hour % 2 === 1) && "bg-surface-2/30") }>
                  {/* Slot :00 */}
                  <div className="relative border-b border-border/80" style={{ height: SLOT_HEIGHT }}>
                    <span className={cn("absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-surface rounded font-bold", isMobile ? "px-1 text-sm" : "px-2 text-lg")}>
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                  {/* Slot :30 */}
                  <div className="relative border-b border-border/80" style={{ height: SLOT_HEIGHT }}>
                    <span className={cn("absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-surface rounded font-bold", isMobile ? "px-1 text-sm" : "px-2 text-lg")}>
                      {String(hour).padStart(2, '0')}:30
                    </span>
                  </div>
                </div>
              ))}
            </div>

          {/* Court Columns */}
          {courtsToShow.map((court, courtIndex) => (
            <div key={court} className="relative border-r border-border">
              {/* Header simples sem tabs */}
              <div className="h-14 border-b border-border sticky top-0 bg-surface z-10 flex items-center justify-center">
                {/* Mostrar estatísticas apenas na primeira coluna de quadras */}
                {courtIndex === 0 && (
                  <div className="flex items-center gap-4">
                    {dayStats.totalBookings > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-2/50">
                        <span className="text-lg">📅</span>
                        <span className="font-bold text-text-primary">{dayStats.totalBookings}</span>
                        <span className="font-semibold text-xs text-text-muted">agendamento{dayStats.totalBookings !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {dayStats.totalPendingPayments > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-2/50">
                        <span className="text-lg">💰</span>
                        <span className="font-bold text-text-primary">{dayStats.totalPendingPayments}</span>
                        <span className="font-semibold text-xs text-text-muted">pendente{dayStats.totalPendingPayments !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Container relativo para posicionar reservas */}
              <div 
                className={cn(
                  "relative"
                )} 
                style={{ height: displayTotalGridHeight }}
              >
                {/* Blocos de 1 hora para quadra fechada */}
                {diasFuncionamento[court] && !diasFuncionamento[court].funciona ? (() => {
                  return displayHoursList.map((hour) => (
                    <div
                      key={`closed-${court}-${hour}`}
                      className="absolute w-full cursor-not-allowed bg-surface/60 flex items-center justify-center border-b border-border/30 transition-colors"
                      style={{
                        height: SLOT_HEIGHT * 2,
                        top: (displayHoursList.indexOf(hour)) * SLOT_HEIGHT * 2,
                      }}
                    >
                      <div className="text-center pointer-events-none">
                        <Ban className="h-5 w-5 text-text-primary mx-auto mb-1" />
                        <div className="text-xs font-medium text-text-primary mb-1">Fechada</div>
                        {diasFuncionamento[court].observacao && (
                          <div className="text-xs text-text-muted">
                            {diasFuncionamento[court].observacao}
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })() : null}
                {/* Linhas base por quadra: exibe apenas durante o horário de funcionamento dessa quadra */}
                {(viewFilter.scheduled || viewFilter.canceledOnly || viewFilter.pendingPayments) && (() => {
                  // Usar horários do grid atual (já calculados no escopo externo)
                  const dayStartM = gridHours.start * 60;
                  const dayEndM = gridHours.end * 60;
                  
                  // Horários da quadra individual (pode ser diferente se estiver mostrando todas)
                  const bounds = (() => {
                    const tStart = courtsMap[court]?.hora_inicio;
                    const tEnd = courtsMap[court]?.hora_fim;
                    const [sh, sm] = String(tStart || `${gridHours.start}:00:00`).split(':').map(Number);
                    const [eh, em] = String(tEnd || `${gridHours.end}:00:00`).split(':').map(Number);
                    // Tratar 00:00:00 como 24:00 (meia-noite)
                    const endHours = (eh === 0 && em === 0) ? 24 : (eh || 0);
                    return { start: (sh||0)*60 + (sm||0), end: endHours*60 + (em||0) };
                  })();
                  
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
                        const hour = Math.floor(globalSlotIdx / (60 / SLOT_MINUTES)) + Math.floor(dayStartM / 60);
                        const isOddHour = hour % 2 === 1;
                        return (
                          <div key={`base-${court}-slot-${globalSlotIdx}`} className={cn("border-b border-border/80", isOddHour && "bg-surface-2/30")} style={{ height: SLOT_HEIGHT }} />
                        );
                      })}
                      {/* Espaço inferior sem linhas após o fechamento */}
                      {bottomSpacerH > 0 && <div style={{ height: bottomSpacerH }} />}
                    </>
                  );
                })()}
                {/* Agendados ou Cancelados (filtrados) */}
                {(viewFilter.scheduled || viewFilter.canceledOnly || viewFilter.pendingPayments) && filteredBookings
                  .filter(b => b.court === court)
                  .map(b => <BookingCard key={b.id} booking={b} courtGridStart={gridHours.start * 60} courtGridEnd={gridHours.end * 60} />)
                }
                {/* Livres */}
                {(viewFilter.available && !(diasFuncionamento[court] && !diasFuncionamento[court].funciona)) && (() => {
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
                    // Tratar 00:00:00 como 24:00 (meia-noite)
                    const hours = (h === 0 && m === 0) ? 24 : h;
                    return hours * 60 + (m || 0);
                  })();
                  const toMinutes = (d) => {
                    const h = getHours(d);
                    const m = getMinutes(d);
                    // Se for 00:00 (meia-noite), tratar como 24:00 (1440 minutos)
                    if (h === 0 && m === 0) return 1440;
                    return h * 60 + m;
                  };
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
                    // Usar horários do grid atual (já calculados no escopo externo)
                    const gridStartM = gridHours.start * 60;
                    const startSlotIndex = Math.floor((startM - gridStartM) / SLOT_MINUTES);
                    const slotsCount = Math.max(1, Math.ceil((endM - startM) / SLOT_MINUTES));
                    const endSlotIndex = startSlotIndex + slotsCount;
                    const top = startSlotIndex * SLOT_HEIGHT - 1;
                    const height = (endSlotIndex - startSlotIndex) * SLOT_HEIGHT + 2;
                    let sH = Math.floor(startM/60);
                    let eH = Math.floor(endM/60);
                    // Converter 24:00 para 00:00
                    if (sH >= 24) sH = sH % 24;
                    if (eH >= 24) eH = eH % 24;
                    const sLabel = `${String(sH).padStart(2,'0')}:${String(startM%60).padStart(2,'0')}`;
                    const eLabel = `${String(eH).padStart(2,'0')}:${String(endM%60).padStart(2,'0')}`;
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

                          // Limpa completamente o estado antes de abrir novo agendamento
                          setEditingBooking(null);
                          // Sanitize court at click time to ensure it exists for the current company
                          {
                            const list = availableCourts || [];
                            const safeCourt = list.includes(court) ? court : (list[0] || '');
                            setPrefill({ court: safeCourt, date: currentDate, startMinutes: clickedStart, endMinutes: clickedEnd });
                          }
                          // Limpa seleção de clientes para evitar carregar dados de agendamento anterior
                          try {
                            lastNonEmptySelectionRef.current = [];
                            setChipsSnapshot([]);
                            sessionStorage.removeItem(persistLastKey);
                            sessionStorage.removeItem('agenda:customerPicker:closing');
                            sessionStorage.removeItem('agenda:customerPicker:closingAt');
                          } catch {}
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
            </>
          );
        })()}
      </motion.div>
      
      {/* AddBookingModal - chamado como função */}
      {AddBookingModal()}
    </>
  );
}

export default AgendaPage;
