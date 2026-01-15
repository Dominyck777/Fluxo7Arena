import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, CheckCircle, Unlock, Lock, Banknote, X, FileText, ShoppingBag, AlertCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';
import { DescontoComandaDialog } from '@/components/DescontoComandaDialog';
import { getOrCreateComandaBalcao, listarComandaBalcaoAberta, criarComandaBalcao, listarItensDaComanda, adicionarItem, listarFinalizadoras, registrarPagamento, fecharComandaEMesa, listarClientes, adicionarClientesAComanda, atualizarQuantidadeItem, removerItem, listarClientesDaComanda, verificarEstoqueComanda, ensureCaixaAberto, fecharCaixa, listarResumoSessaoCaixaAtual, getCaixaAberto, listarMovimentacoesCaixa, listarComandasAbertas, criarMovimentacaoCaixa, listarItensDeTodasComandasAbertas } from '@/lib/store';
import { supabase } from '@/lib/supabase';

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function BalcaoPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [comandaId, setComandaId] = useState(null);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saleOpening, setSaleOpening] = useState(false);
  const [saleCancelling, setSaleCancelling] = useState(false);
  const [saleClosing, setSaleClosing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [addingProductId, setAddingProductId] = useState(null);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  // Guarda se já existiram itens nesta sessão para detectar sumiço inesperado
  const hadItemsRefFlag = useRef(false);
  // Estoque reservado global (todas as comandas abertas)
  const [reservedStock, setReservedStock] = useState(new Map());

  // Caixa
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isCashierDetailsOpen, setIsCashierDetailsOpen] = useState(false);
  const [openCashDialogOpen, setOpenCashDialogOpen] = useState(false);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashSummary, setCashSummary] = useState(null);
  const [isCloseCashOpen, setIsCloseCashOpen] = useState(false);

  // Pagamento
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payMethods, setPayMethods] = useState([]);
  const [selectedPayId, setSelectedPayId] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentLines, setPaymentLines] = useState([]); // {id, clientId, methodId, value}
  const [nextPayLineId, setNextPayLineId] = useState(1);
  const [payClients, setPayClients] = useState([]); // clientes carregados para o modal (id, nome, codigo)
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [comandaDiscount, setComandaDiscount] = useState({ tipo: null, valor: 0, motivo: '' });
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);
  const [selectedCommandItem, setSelectedCommandItem] = useState(null);
  // Product picker (mobile): abre um seletor de produtos em modal em vez de listar na tela
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  // Alerta compacto no mobile (banner inferior)
  const [mobileWarnOpen, setMobileWarnOpen] = useState(false);
  const [mobileWarnMsg, setMobileWarnMsg] = useState('');
  // Flag de viewport mobile
  const [isMobileView, setIsMobileView] = useState(() => {
    try { return typeof window !== 'undefined' && window.innerWidth <= 640; } catch { return false; }
  });
  useEffect(() => {
    const update = () => {
      try { setIsMobileView(typeof window !== 'undefined' && window.innerWidth <= 640); } catch { setIsMobileView(false); }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Cliente
  const [clientMode, setClientMode] = useState('cadastrado'); // fixo: apenas 'cadastrado'
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [linking, setLinking] = useState(false);
  const [showClientBox, setShowClientBox] = useState(false); // desativado no novo fluxo
  const [isClientWizardOpen, setIsClientWizardOpen] = useState(false);
  const [clientChosen, setClientChosen] = useState(false);
  
  // Navegação por teclado e filtros
  const [productFocusIndex, setProductFocusIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'low', 'out'
  const [sortOrder, setSortOrder] = useState(() => {
    try {
      return localStorage.getItem('balcao_sort_order') || 'code';
    } catch {
      return 'code';
    }
  }); // 'code', 'name'
  const productItemRefs = useRef([]);
  const productListRef = useRef(null);
  
  // Redimensionamento de painéis
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('balcao_left_panel_width');
      return saved ? parseFloat(saved) : 50;
    } catch {
      return 50;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  
  // Refs para robustez contra respostas antigas (stale)
  const itemsReqIdRef = useRef(0); // identifica a última requisição válida de itens
  const itemsRef = useRef([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Resilient mounting flag (evitar setState após unmount)
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const rtChanRef = useRef(null);
  const rtDebounceRef = useRef(null);
  const pollTimerRef = useRef(null);
  const comandaIdRef = useRef(null);
  useEffect(() => { comandaIdRef.current = comandaId; }, [comandaId]);

  useEffect(() => {
    const codigoEmpresa = userProfile?.codigo_empresa;
    if (!codigoEmpresa) return;
    // Garantir que o Realtime está autenticado antes de criar o canal (melhora mobile)
    try {
      const c = typeof window !== 'undefined' ? window.localStorage.getItem('custom-auth-token') : null;
      if (c && c.trim()) {
        supabase.realtime.setAuth(c.trim());
      } else {
        let ref = '';
        try { const u = new URL(supabase.supabaseUrl || ''); const h = u.host || ''; ref = (h.split('.')[0] || '') } catch {}
        const k = ref ? `sb-${ref}-auth-token` : 'sb-auth-token';
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(k) : null;
        if (raw) {
          try {
            const p = JSON.parse(raw);
            const t = p?.access_token || p?.currentSession?.access_token;
            if (t) supabase.realtime.setAuth(t);
          } catch {}
        }
      }
    } catch {}
    const ch = supabase.channel(`loja:${codigoEmpresa}`);
    const handler = async (payload) => {
      const t = payload?.table || payload?.table_name || '';
      const row = payload?.new || payload?.old || {};
      const evt = payload?.eventType || payload?.type || payload?.event || '';
      const isBalcaoComanda = (cmd) => cmd && (cmd.mesa_id == null || typeof cmd.mesa_id === 'undefined');

      // Atualizações específicas por tabela para reação imediata
      try {
        // Itens da comanda: atualizar instantaneamente a comanda atual do balcão
        if (t === 'comanda_itens') {
          const comId = payload?.new?.comanda_id || payload?.old?.comanda_id || row?.comanda_id || null;
          if (comId) {
            const cid = comandaIdRef.current;
            if (cid && String(cid) === String(comId)) {
              try { await refetchItemsAndCustomer(cid, 2); } catch {}
              // Atualizar estoque reservado imediatamente
              try {
                const itensGlobal = await listarItensDeTodasComandasAbertas({ codigoEmpresa });
                const reservedMap = new Map();
                for (const item of itensGlobal || []) { reservedMap.set(item.produto_id, (reservedMap.get(item.produto_id) || 0) + Number(item.quantidade || 0)); }
                setReservedStock(reservedMap);
              } catch {}
              return; // já tratou
            }
            // Se ainda não temos comandaId, verificar se é a comanda do balcão e sincronizar
            try {
              const c = await listarComandaBalcaoAberta({ codigoEmpresa });
              if (c?.id && String(c.id) === String(comId)) {
                setComandaId(c.id);
                try { await refetchItemsAndCustomer(c.id, 2); } catch {}
                // Atualizar estoque reservado imediatamente
                try {
                  const itensGlobal = await listarItensDeTodasComandasAbertas({ codigoEmpresa });
                  const reservedMap = new Map();
                  for (const item of itensGlobal || []) { reservedMap.set(item.produto_id, (reservedMap.get(item.produto_id) || 0) + Number(item.quantidade || 0)); }
                  setReservedStock(reservedMap);
                } catch {}
                return;
              }
            } catch {}
          }
        }

        // Vinculação de clientes também deve refletir
        if (t === 'comanda_clientes') {
          const comId = payload?.new?.comanda_id || payload?.old?.comanda_id || row?.comanda_id || null;
          if (comId && comandaIdRef.current && String(comandaIdRef.current) === String(comId)) {
            try { await refetchItemsAndCustomer(comId, 2); } catch {}
            return;
          }
        }

        // Fechamento/cancelamento da comanda do balcão em outro dispositivo
        if (t === 'comandas') {
          const mesaId = row?.mesa_id;
          const comId = row?.id || payload?.old?.id || null;
          const statusStr = String(row?.status || '').toLowerCase();
          const isClosedEvt = (String(evt || '').toUpperCase() === 'DELETE') || statusStr.includes('fechad') || statusStr.includes('closed') || statusStr.includes('encerr');
          const isInsertEvt = String(evt || '').toUpperCase() === 'INSERT';
          if (isClosedEvt && (mesaId == null) && comandaIdRef.current && comId && String(comandaIdRef.current) === String(comId)) {
            // Resetar estado do balcão
            setItems([]);
            setComandaId(null);
            setSelectedClientIds([]);
            setCustomerName('');
            setClientChosen(false);
            // Limpar cache relacionado
            try {
              localStorage.removeItem(LS_KEY.comandaId);
              localStorage.removeItem(LS_KEY.items);
              localStorage.removeItem(LS_KEY.customerName);
              localStorage.removeItem(LS_KEY.pendingClientIds);
              localStorage.removeItem(LS_KEY.clientChosen);
            } catch {}
          }
          // Nova comanda do balcão criada em outro dispositivo: adotar imediatamente
          if (isInsertEvt && (mesaId == null) && ['open','awaiting-payment','awaiting_payment'].includes(statusStr)) {
            setComandaId(comId);
            try { await refetchItemsAndCustomer(comId, 2); } catch {}
          }
        }
      } catch {}

      // Debounce genérico como fallback
      if (rtDebounceRef.current) { try { clearTimeout(rtDebounceRef.current); } catch {} }
      rtDebounceRef.current = setTimeout(async () => {
        const cid = comandaIdRef.current;
        if (cid) {
          try { await refetchItemsAndCustomer(cid, 2); } catch {}
        } else {
          try {
            const c = await listarComandaBalcaoAberta({ codigoEmpresa });
            if (c?.id) {
              setComandaId(c.id);
              try { await refetchItemsAndCustomer(c.id, 2); } catch {}
            }
          } catch {}
        }
      }, 250);
    };
    ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `codigo_empresa=eq.${codigoEmpresa}` }, handler)
      // comanda_itens/comanda_clientes podem não ter codigo_empresa; assinar sem filtro
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comanda_itens' }, handler)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comanda_clientes' }, handler)
      .subscribe();
    rtChanRef.current = ch;
    if (pollTimerRef.current) { try { clearInterval(pollTimerRef.current); } catch {} }
    pollTimerRef.current = setInterval(async () => {
      const cid = comandaIdRef.current;
      if (cid) {
        try { await refetchItemsAndCustomer(cid, 1); } catch {}
      } else {
        try {
          const c = await listarComandaBalcaoAberta({ codigoEmpresa });
          if (c?.id) {
            setComandaId(c.id);
            try { await refetchItemsAndCustomer(c.id, 1); } catch {}
          }
        } catch {}
      }
    }, 60000);
    return () => {
      if (rtChanRef.current) { try { supabase.removeChannel(rtChanRef.current); } catch {} rtChanRef.current = null; }
      if (rtDebounceRef.current) { try { clearTimeout(rtDebounceRef.current); } catch {} rtDebounceRef.current = null; }
      if (pollTimerRef.current) { try { clearInterval(pollTimerRef.current); } catch {} pollTimerRef.current = null; }
    };
  }, [userProfile?.codigo_empresa]);

  // Marca quando já tivemos itens, para detectar quedas inesperadas para 0
  useEffect(() => {
    if ((items || []).length > 0) hadItemsRefFlag.current = true;
  }, [items]);

  // Se os itens zerarem inesperadamente com comanda aberta, tenta recarregar rapidamente
  useEffect(() => {
    if (comandaId && hadItemsRefFlag.current && (items || []).length === 0) {
      refetchItemsAndCustomer(comandaId, 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId, items?.length]);

  // Estado inicial do caixa
  useEffect(() => {
    if (isCloseCashOpen) return;
    let active = true;
    (async () => {
      try {
        const sess = await getCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        if (active) setIsCashierOpen(!!sess);
      } catch { if (active) setIsCashierOpen(false); }
    })();
    return () => { active = false; };
  }, [userProfile?.codigo_empresa, isCloseCashOpen]);

  // ===== Caixa: funções iguais às de Vendas =====
  const reloadCashSummary = async () => {
    const codigoEmpresa = userProfile?.codigo_empresa || null;
    try {
      if (!codigoEmpresa) return;
      setCashLoading(true);
      const [summary, sess] = await Promise.all([
        listarResumoSessaoCaixaAtual({ codigoEmpresa }).catch(() => null),
        getCaixaAberto({ codigoEmpresa }).catch(() => null),
      ]);
      
      // Se não há sessão aberta, não mostrar nada
      if (!sess?.id) {
        setCashSummary(null);
        return;
      }
      
      let totalSangria = 0;
      let totalSuprimento = 0;
      let movimentacoes = [];
      try {
        movimentacoes = await listarMovimentacoesCaixa({ caixaSessaoId: sess.id, codigoEmpresa });
        totalSangria = (movimentacoes || []).filter(m => String(m?.tipo || '').toLowerCase() === 'sangria').reduce((acc, m) => acc + Number(m?.valor || 0), 0);
        totalSuprimento = (movimentacoes || []).filter(m => String(m?.tipo || '').toLowerCase() === 'suprimento').reduce((acc, m) => acc + Number(m?.valor || 0), 0);
      } catch {}
      
      // Sempre usar dados da sessão, mesmo sem vendas
      const merged = {
        saldo_inicial: sess.saldo_inicial || 0,
        totalPorFinalizadora: summary?.totalPorFinalizadora || summary?.porFinalizadora || {},
        totalEntradas: summary?.totalEntradas || summary?.entradas || 0,
        totalSangria,
        totalSuprimento,
        totalSaidas: totalSangria,
        sessaoId: sess.id,
        movimentacoes
      };
      setCashSummary(merged);
    } catch {
      setCashSummary(null);
    } finally {
      setCashLoading(false);
    }
  };

  // Mantém clientes e linhas sincronizados quando o modal está aberto e a lista de clientes selecionados muda
  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        if (!isPayOpen || !comandaId) return;
        const codigoEmpresa = userProfile?.codigo_empresa;
        // Recarrega clientes vinculados
        let normalized = [];
        try {
          const vinc = await listarClientesDaComanda({ comandaId, codigoEmpresa });
          const arr = Array.isArray(vinc) ? vinc : [];
          normalized = arr.map(r => {
            const id = r?.clientes?.id ?? r?.cliente_id ?? r?.id ?? null;
            const nome = r?.clientes?.nome ?? r?.nome ?? r?.nome_livre ?? '';
            return id ? { id, nome } : null;
          }).filter(Boolean);
        } catch { normalized = []; }
        if (!active) return;
        setPayClients(normalized);

        // Pool preferencial: selectedClientIds; fallback: normalized
        const hasSelected = Array.isArray(selectedClientIds) && selectedClientIds.length > 0;
        const pool = hasSelected ? selectedClientIds : normalized.map(c => c.id);
        if (!Array.isArray(pool) || pool.length === 0) return;

        // Garante que a primeira linha use o cliente principal
        setPaymentLines(prev => {
          let lines = prev && prev.length ? [...prev] : [{ id: 1, clientId: pool[0], methodId: (payMethods[0]?.id || ''), value: '' }];
          // Ajusta primeira linha
          if (!lines[0]) lines[0] = { id: 1, clientId: pool[0], methodId: (payMethods[0]?.id || ''), value: '' };
          lines[0].clientId = pool[0];
          // Para as demais, evita duplicados e preenche vazios com clientes restantes
          const used = new Set([lines[0].clientId].filter(Boolean));
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].clientId || used.has(lines[i].clientId)) {
              const candidate = (pool || []).find(id => !used.has(id));
              lines[i].clientId = candidate || pool[0];
            }
            used.add(lines[i].clientId);
          }
          return lines;
        });
      } catch {}
    };
    sync();
    return () => { active = false; };
  }, [isPayOpen, selectedClientIds, comandaId, userProfile?.codigo_empresa]);
  useEffect(() => {
    let active = true;
    const loadDiscount = async () => {
      try {
        if (!isPayOpen || !comandaId) return;
        const { data } = await supabase
          .from('comandas')
          .select('desconto_tipo, desconto_valor, desconto_motivo')
          .eq('id', comandaId)
          .single();
        if (!active) return;
        setComandaDiscount({
          tipo: data?.desconto_tipo || null,
          valor: Number(data?.desconto_valor || 0),
          motivo: data?.desconto_motivo || ''
        });
      } catch {
        if (active) setComandaDiscount({ tipo: null, valor: 0, motivo: '' });
      }
    };
    loadDiscount();
    return () => { active = false; };
  }, [isPayOpen, comandaId]);

  // ===== Helpers de Pagamento (base + taxa) =====
  const parseBRL = (s) => { const d = String(s || '').replace(/\D/g, ''); return d ? Number(d) / 100 : 0; };
  const formatBRL = (n) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const getMethod = (methodId) => (payMethods || []).find(m => String(m.id) === String(methodId));
  const linePct = (ln) => Number(getMethod(ln.methodId)?.taxa_percentual || 0);
  // Retorna a base (sem taxa) considerando o estado atual do input (que pode ou não incluir taxa)
  const lineBase = (ln) => {
    const v = parseBRL(ln.value);
    const pct = linePct(ln);
    if (!ln.chargeFee || !pct) return v;
    return v / (1 + (pct/100));
  };
  const lineFee = (ln) => {
    const base = lineBase(ln);
    const pct = linePct(ln);
    if (!ln.chargeFee || !pct || base <= 0) return 0;
    return base * (pct / 100);
  };
  const lineWithBase = (ln, base) => {
    const pct = linePct(ln);
    if (ln.chargeFee && pct > 0) {
      const totalWithFee = base * (1 + pct/100);
      return { ...ln, value: formatBRL(totalWithFee) };
    }
    return { ...ln, value: formatBRL(base) };
  };
  const sumBasePayments = () => (paymentLines || []).reduce((acc, ln) => acc + lineBase(ln), 0);
  const sumFees = () => (paymentLines || []).reduce((acc, ln) => acc + lineFee(ln), 0);
  const sumPayments = () => sumBasePayments() + sumFees();

  // Auto-ajuste de centavos quando linhas mudam (tolerância 5 centavos)
  useEffect(() => {
    try {
      if (!isPayOpen) return;
      // total dos itens da comanda (considerando desconto)
      let subtotal = 0;
      try {
        subtotal = (items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0);
      } catch {}
      const tipo = comandaDiscount?.tipo; const val = Number(comandaDiscount?.valor || 0);
      let descCmd = 0; if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100); else if (tipo === 'fixo' && val > 0) descCmd = val;
      const discountedBase = Math.max(0, subtotal - descCmd);
      const baseSum = sumBasePayments();
      const diff = discountedBase - baseSum;
      if (Math.abs(diff) > 0.009 && Math.abs(diff) <= 0.05 && Array.isArray(paymentLines) && paymentLines.length > 0) {
        setPaymentLines(prev => prev.map((line, idx, arr) => {
          if (idx !== arr.length - 1) return line;
          const base = lineBase(line) + diff;
          return lineWithBase(line, base);
        }));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentLines, isPayOpen]);

  // Confirmar pagamento no Balcão
  const confirmPay = async () => {
    try {
      setSaleClosing(true);
      if (!comandaId) { toast({ title: 'Nenhuma comanda aberta', description: 'Adicione itens para abrir uma comanda.', variant: 'warning' }); return; }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }

      // Validar que a comanda existe no banco antes de prosseguir
      try {
        const { data: comandaExists, error: checkError } = await supabase
          .from('comandas')
          .select('id')
          .eq('id', comandaId)
          .eq('codigo_empresa', codigoEmpresa)
          .single();
        
        if (checkError || !comandaExists) {
          console.error('[confirmPay] Comanda não encontrada no banco:', comandaId);
          toast({ title: 'Comanda inválida', description: 'A comanda não existe mais. Criando nova comanda...', variant: 'warning' });
          
          // Limpar cache e recarregar
          setComandaId(null);
          setItems([]);
          try {
            localStorage.removeItem(LS_KEY.comandaId);
            localStorage.removeItem(LS_KEY.items);
          } catch {}
          
          await loadAll();
          return;
        }
      } catch (validationError) {
        console.error('[confirmPay] Erro ao validar comanda:', validationError);
        toast({ title: 'Erro de validação', description: 'Não foi possível validar a comanda.', variant: 'destructive' });
        return;
      }

      // validações de múltiplos pagamentos
      if (!Array.isArray(paymentLines) || paymentLines.length === 0) { toast({ title: 'Informe os pagamentos', description: 'Adicione pelo menos uma forma de pagamento.', variant: 'warning' }); return; }
      for (const ln of paymentLines) {
        if (!ln.methodId) { toast({ title: 'Forma de pagamento faltando', description: 'Selecione a finalizadora em todas as linhas.', variant: 'warning' }); return; }
        const digits = String(ln.value || '').replace(/\D/g, '');
        if (!digits) { toast({ title: 'Valor inválido', description: 'Informe valores maiores que zero.', variant: 'warning' }); return; }
      }
      // Verificar total vs soma (comparar BASE com total de itens COM desconto da comanda)
      let subtotal = 0;
      try {
        const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
        subtotal = (itens || []).reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0);
      } catch {}
      // desconto da comanda aplicado sobre a base
      const tipoDesc = comandaDiscount?.tipo;
      const valDesc = Number(comandaDiscount?.valor || 0);
      let descCmd = 0;
      if (tipoDesc === 'percentual' && valDesc > 0) descCmd = subtotal * (valDesc / 100);
      else if (tipoDesc === 'fixo' && valDesc > 0) descCmd = valDesc;
      const expectedBase = Math.max(0, subtotal - descCmd);
      const sumBase = sumBasePayments();
      const diff = Math.abs(sumBase - expectedBase);

      // Se a diferença for apenas centavos (até 0.05), ajustar automaticamente na última linha
      if (diff > 0.009 && diff <= 0.05) {
        const adjustment = expectedBase - sumBase; // ajuste em BASE
        setPaymentLines(prev => prev.map((line, idx, arr) => {
          if (idx !== arr.length - 1) return line;
          const base = lineBase(line) + adjustment;
          return lineWithBase(line, base);
        }));

        // Não retornar - continuar com o pagamento após ajuste
      } else if (diff > 0.05) {
        // Diferença maior que 5 centavos - mostrar erro
        const remaining = expectedBase - sumBase;
        if (remaining > 0) {
          toast({ title: 'Valor insuficiente', description: `Faltam R$ ${remaining.toFixed(2)} para fechar o total.`, variant: 'warning' });
        } else {
          toast({ title: 'Valor excedente', description: `Excedeu em R$ ${Math.abs(remaining).toFixed(2)}. Ajuste os valores.`, variant: 'warning' });
        }
        return;
      }
      setPayLoading(true);
      await ensureCaixaAberto({ codigoEmpresa });
      for (const ln of paymentLines) {
        const valor = parseBRL(ln.value); // já inclui taxa quando chargeFee=true
        const fin = payMethods.find(m => String(m.id) === String(ln.methodId));
        const metodo = fin?.nome || fin?.tipo || 'outros';
        await registrarPagamento({ comandaId, finalizadoraId: ln.methodId, metodo, valor, status: 'Pago', codigoEmpresa, clienteId: ln.clientId || null });
      }

      await fecharComandaEMesa({ comandaId, codigoEmpresa });
      // Limpeza de estado e cache
      setComandaId(null);
      setItems([]);
      setSelectedClientIds([]);
      setCustomerName('');
      setClientChosen(false);
      setPaymentLines([]);
      try {
        localStorage.removeItem(LS_KEY.comandaId);
        localStorage.removeItem(LS_KEY.items);
        localStorage.removeItem(LS_KEY.customerName);
      } catch {}
      toast({ title: 'Pagamento concluído', description: `Total R$ ${expectedBase.toFixed(2)}`, variant: 'success' });
      setIsPayOpen(false);
    } catch (e) {
      toast({ title: 'Falha ao concluir', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setPayLoading(false);
      setSaleClosing(false);
    }
  };

  // Soma total (base + taxas)
  // sumPayments/sumFees já definidos nos helpers

  useEffect(() => {
    const loadSummary = async () => {
      try {
        if (!isCashierDetailsOpen) return;
        await reloadCashSummary();
      } catch {}
    };
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCashierDetailsOpen, userProfile?.codigo_empresa]);

  // Componentes utilitários (iguais aos de Vendas)
  const OpenCashContent = () => {
    const [openCashInitial, setOpenCashInitial] = useState('');
    const inputRef = useRef(null);
    useEffect(() => {
      // Evita abrir teclado automaticamente no mobile
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
      if (isMobile) return;
      const t = setTimeout(() => { try { inputRef.current?.focus(); } catch {} }, 0);
      return () => clearTimeout(t);
    }, []);
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>Abrir Caixa</AlertDialogTitle>
          <AlertDialogDescription>Insira o valor inicial (suprimento) para abrir o caixa.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label className="mb-2 block" htmlFor="open-cash-initial">Saldo inicial</Label>
          <Input
            id="open-cash-initial"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0,00"
            value={openCashInitial}
            onChange={(e) => {
              const digits = (e.target.value || '').replace(/\D/g, '');
              const cents = digits ? Number(digits) / 100 : 0;
              const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
              setOpenCashInitial(formatted);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
              if (allowed.includes(e.key)) return;
              if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); }
            }}
            onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
          />
          <div className="text-xs text-text-muted mt-1">Digite números; a máscara formata em reais automaticamente.</div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpenCashDialogOpen(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            try {
              const digits = String(openCashInitial || '').replace(/\D/g, '');
              const v = digits ? Number(digits) / 100 : 0;
              await ensureCaixaAberto({ saldoInicial: v, codigoEmpresa: userProfile?.codigo_empresa });
              setIsCashierOpen(true);
              setOpenCashDialogOpen(false);
              toast({ title: 'Caixa aberto com sucesso!', variant: 'success' });
            } catch (e) {
              toast({ title: 'Falha ao abrir caixa', description: e?.message || 'Tente novamente', variant: 'destructive' });
            }
          }}>Confirmar Abertura</AlertDialogAction>
        </AlertDialogFooter>
      </>
    );
  };

  const OpenCashierDialog = () => (
    <AlertDialog open={openCashDialogOpen} onOpenChange={setOpenCashDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="success"
          size="sm"
          disabled={isCashierOpen}
          onClick={() => setOpenCashDialogOpen(true)}
          className="px-3"
        >
          <Unlock className="h-4 w-4" />
          <span className="ml-2 md:hidden">Abrir</span>
          <span className="ml-2 hidden md:inline">Abrir Caixa</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[425px] w-[92vw] animate-none" onKeyDown={(e) => e.stopPropagation()} onEscapeKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} onFocusOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} onOpenAutoFocus={(e) => { e.preventDefault(); }} onCloseAutoFocus={(e) => { e.preventDefault(); }}>
        <OpenCashContent />
      </AlertDialogContent>
    </AlertDialog>
  );

  const CloseCashierDialog = () => {
    const [closingData, setClosingData] = useState({ loading: false, saldoInicial: 0, resumo: null });
    const [showMobileWarn, setShowMobileWarn] = useState(false);
    const [contado, setContado] = useState('');
    const [confirmStep, setConfirmStep] = useState(false); // false = revisão, true = confirmação
    const handlePrepareClose = async () => {
      try {
        setClosingData({ loading: true, saldoInicial: 0, resumo: null });
        const sess = await getCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        const sum = await listarResumoSessaoCaixaAtual({ codigoEmpresa: userProfile?.codigo_empresa });
        setClosingData({ loading: false, saldoInicial: Number(sess?.saldo_inicial || 0), resumo: sum || { totalPorFinalizadora: {} } });
      } catch (e) {
        setClosingData({ loading: false, saldoInicial: 0, resumo: { totalPorFinalizadora: {} } });
      }
    };
    const totalPorFinalizadora = closingData?.resumo?.totalPorFinalizadora || {};
    const somaFinalizadoras = Object.values(totalPorFinalizadora).reduce((acc, v) => acc + Number(v || 0), 0);
    const totalCaixa = Number(closingData.saldoInicial || 0) + somaFinalizadoras;
    const suprimentosDinheiro = Number(cashSummary?.totalSuprimento || 0);
    const sangriasDinheiro = Number(cashSummary?.totalSangria || 0);
    return (
      <AlertDialog open={isCloseCashOpen} onOpenChange={(open) => { if (open) { setIsCloseCashOpen(true); setConfirmStep(false); handlePrepareClose(); } }}>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            disabled={!isCashierOpen}
            onClick={() => { setIsCloseCashOpen(true); }}
            className="px-3"
          >
            <Lock className="h-4 w-4" />
            <span className="ml-2">Fechar Caixa</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="sm-max-w-[425px] animate-none" onKeyDown={(e) => e.stopPropagation()} onEscapeKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDownOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} onFocusOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} onInteractOutside={(e) => { e.preventDefault(); e.stopPropagation(); }} onOpenAutoFocus={(e) => { e.preventDefault(); }} onCloseAutoFocus={(e) => { e.preventDefault(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Caixa</AlertDialogTitle>
            <AlertDialogDescription>Confira os valores e confirme o fechamento do caixa. Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          {showMobileWarn && (
            <div className="md:hidden mb-2 text-[12px] text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Existem comandas abertas. Finalize-as antes de fechar o caixa.
            </div>
          )}
          {closingData.loading ? (
            <div className="py-4 text-text-muted">Carregando resumo…</div>
          ) : (
            <div className="py-4 space-y-2">
              {!confirmStep ? (
                <>
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Resumo</div>
                  <div className="flex justify-between"><span className="text-text-secondary">Valor Inicial</span> <span className="font-mono">R$ {Number(closingData.saldoInicial||0).toFixed(2)}</span></div>
                  {Object.keys(totalPorFinalizadora).length === 0 ? (
                    <div className="text-sm text-text-muted">Sem pagamentos nesta sessão.</div>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(totalPorFinalizadora).map(([metodo, valor]) => (
                        <div key={metodo} className="flex justify-between"><span className="text-text-secondary">{String(metodo)}</span> <span className="font-mono">R$ {Number(valor||0).toFixed(2)}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="my-2 h-px bg-border" />
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Conferência</div>
                  <div className="flex justify-between"><span className="text-text-secondary">Suprimentos</span> <span className="font-mono">R$ {suprimentosDinheiro.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Sangrias</span> <span className="font-mono">R$ {sangriasDinheiro.toFixed(2)}</span></div>
                  <div className="flex justify-between font-medium text-base"><span className="text-text-secondary">Total em Caixa</span> <span className="font-mono text-success">R$ {Number(totalCaixa||0).toFixed(2)}</span></div>
                </>
              ) : (
                <>
                  {/* Mini-resumo no topo da etapa 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-text-secondary">Valor Inicial</span> <span className="font-mono">R$ {Number(closingData.saldoInicial||0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-text-secondary">Valor Final</span> <span className="font-mono">{(() => { const d=String(contado||'').replace(/\D/g,''); const v=d?Number(d)/100:0; return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); })()}</span></div>
                  </div>
                  <div className="mt-2">
                    <Label className="mb-1 block">Saldo Final (opcional)</Label>
                    <Input type="text" inputMode="numeric" placeholder="0,00" value={contado}
                      onChange={(e) => { const digits = (e.target.value || '').replace(/\D/g, ''); const cents = digits ? Number(digits) / 100 : 0; const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents); setContado(formatted); }}
                      onKeyDown={(e) => { e.stopPropagation(); const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab']; if (allowed.includes(e.key)) return; if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); } }}
                      onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <AlertDialogFooter>
            {!confirmStep ? (
              <>
                <AlertDialogCancel onClick={() => setIsCloseCashOpen(false)}>Cancelar</AlertDialogCancel>
                <Button onClick={() => setConfirmStep(true)}>Confirmar Fechamento</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmStep(false)}>Voltar</Button>
                <Button onClick={async () => {
                  try {
                    // Bloqueio se houver comandas abertas
                    try {
                      const abertas = await listarComandasAbertas({ codigoEmpresa: userProfile?.codigo_empresa });
                      if (Array.isArray(abertas) && abertas.length > 0) {
                        if (isMobileView) {
                          setShowMobileWarn(true);
                          toast({ title: 'Fechamento bloqueado', description: `Existem ${abertas.length} comandas abertas. Feche todas antes de encerrar o caixa.`, variant: 'warning' });
                        } else {
                          toast({ title: 'Fechamento bloqueado', description: `Existem ${abertas.length} comandas abertas. Feche todas antes de encerrar o caixa.`, variant: 'warning', duration: 2500 });
                        }
                        return;
                      }
                    } catch {}
                    // Fechar caixa com valor final contado
                    const digits = String(contado || '').replace(/\D/g, '');
                    const valorFinal = digits ? Number(digits) / 100 : 0;
                    await fecharCaixa({ codigoEmpresa: userProfile?.codigo_empresa, valorFinalDinheiro: valorFinal });
                    setIsCashierOpen(false);
                    setIsCloseCashOpen(false);
                    toast({ title: 'Caixa fechado!', description: 'Fechamento registrado com sucesso.', variant: 'success' });
                  } catch (e) {
                    toast({ title: 'Falha ao fechar caixa', description: e?.message || 'Tente novamente', variant: 'destructive' });
                  }
                }}>Fechar Caixa</Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const CashierDetailsDialog = () => {
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    const [isSangriaOpen, setIsSangriaOpen] = useState(false);
    const [isSuprimentoOpen, setIsSuprimentoOpen] = useState(false);
    const [sangriaValor, setSangriaValor] = useState('');
    const [sangriaObs, setSangriaObs] = useState('');
    const [sangriaLoading, setSangriaLoading] = useState(false);
    const performSangria = async () => {
      try {
        setSangriaLoading(true);
        const digits = String(sangriaValor || '').replace(/\D/g, '');
        const valor = digits ? Number(digits) / 100 : 0;
        if (valor <= 0) { toast({ title: 'Valor inválido', description: 'Informe um valor positivo.', variant: 'warning' }); return; }
        await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        await criarMovimentacaoCaixa({ tipo: 'sangria', valor, observacao: sangriaObs, codigoEmpresa: userProfile?.codigo_empresa });
        setIsSangriaOpen(false);
        setSangriaValor('');
        setSangriaObs('');
        await reloadCashSummary();
        toast({ title: 'Sangria registrada', variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao registrar sangria', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally { setSangriaLoading(false); }
    };
    const [suprimentoValor, setSuprimentoValor] = useState('');
    const [suprimentoObs, setSuprimentoObs] = useState('');
    const [suprimentoLoading, setSuprimentoLoading] = useState(false);
    const performSuprimento = async () => {
      try {
        setSuprimentoLoading(true);
        const digits = String(suprimentoValor || '').replace(/\D/g, '');
        const valor = digits ? Number(digits) / 100 : 0;
        if (valor <= 0) { toast({ title: 'Valor inválido', description: 'Informe um valor positivo.', variant: 'warning' }); return; }
        await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
        await criarMovimentacaoCaixa({ tipo: 'suprimento', valor, observacao: suprimentoObs, codigoEmpresa: userProfile?.codigo_empresa });
        setIsSuprimentoOpen(false);
        setSuprimentoValor('');
        setSuprimentoObs('');
        await reloadCashSummary();
        toast({ title: 'Suprimento registrado', variant: 'success' });
      } catch (e) {
        toast({ title: 'Falha ao registrar suprimento', description: e?.message || 'Tente novamente', variant: 'destructive' });
      } finally { setSuprimentoLoading(false); }
    };
    return (
      <Dialog open={isCashierDetailsOpen} onOpenChange={setIsCashierDetailsOpen}>
        <DialogContent className="sm:max-w-lg w-[92vw] max-h-[85vh] animate-none flex flex-col overflow-hidden" onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Detalhes do Caixa</DialogTitle>
            <DialogDescription>
              {cashLoading ? 'Carregando resumo...' : (cashSummary ? 'Resumo da sessão atual do caixa.' : 'Nenhuma sessão de caixa aberta.')}
            </DialogDescription>
          </DialogHeader>
          {cashSummary ? (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-surface-2 rounded-lg p-3 border border-border text-center">
                    <div className="text-[12px] text-text-secondary whitespace-nowrap mb-1">Saldo Inicial</div>
                    <div className="text-base md:text-lg font-bold tabular-nums leading-tight">{fmt(cashSummary.saldo_inicial)}</div>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border text-center">
                    <div className="text-[12px] text-text-secondary whitespace-nowrap mb-1">Entradas</div>
                    <div className="text-base md:text-lg font-bold text-success tabular-nums leading-tight">{fmt(cashSummary.totalEntradas)}</div>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border text-center">
                    <div className="text-[12px] text-text-secondary whitespace-nowrap mb-1">Saídas</div>
                    <div className="text-base md:text-lg font-bold text-danger tabular-nums leading-tight">{fmt(cashSummary.totalSangria)}</div>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-3 border border-border text-center">
                    <div className="text-[12px] text-text-secondary whitespace-nowrap mb-1">Saldo Atual</div>
                    <div className="text-base md:text-lg font-bold tabular-nums leading-tight">{fmt((cashSummary.saldo_inicial || 0) + (cashSummary.totalEntradas || 0) - (cashSummary.totalSangria || 0))}</div>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-text-secondary">Totais por Finalizadora</h4>
                  </div>
                  {Object.keys(cashSummary.totalPorFinalizadora || {}).length === 0 ? (
                    <div className="p-3 text-sm text-text-muted border rounded-md">Nenhuma finalizadora registrada ainda.</div>
                  ) : (
                    <ul className="rounded-md border border-border overflow-hidden divide-y divide-border">
                      {Object.entries(cashSummary.totalPorFinalizadora || {}).map(([nome, valor]) => (
                        <li key={nome} className="bg-surface px-3 py-2 flex items-center justify-between">
                          <span className="text-sm text-text-secondary truncate pr-3">{String(nome)}</span>
                          <span className="text-sm font-semibold tabular-nums">{fmt(valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-text-secondary truncate pr-3">Suprimentos</span>
                    <span className="text-sm font-semibold tabular-nums text-success">{fmt(cashSummary.totalSuprimento || 0)}</span>
                  </div>
                  <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-text-secondary truncate pr-3">Sangrias</span>
                    <span className="text-sm font-semibold tabular-nums text-danger">{fmt(cashSummary.totalSangria || 0)}</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex items-center justify-between gap-2">
                <div className="mr-auto" />
                <Button variant="outline" onClick={() => setIsSuprimentoOpen(true)}>Registrar Suprimento</Button>
                <Button variant="destructive" onClick={() => setIsSangriaOpen(true)}>Registrar Sangria</Button>
                <Button variant="secondary" onClick={() => setIsCashierDetailsOpen(false)}>Fechar</Button>
              </DialogFooter>
              <Dialog open={isSuprimentoOpen} onOpenChange={setIsSuprimentoOpen}>
                <DialogContent className="sm:max-w-sm w-[92vw] max-h-[85vh] animate-none" onKeyDown={(e) => e.stopPropagation()}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Registrar Suprimento</DialogTitle>
                    <DialogDescription>Informe o valor de entrada no caixa e, opcionalmente, uma observação.</DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 flex flex-col space-y-3">
                    <div>
                      <Label htmlFor="r-valor">Valor</Label>
                      <Input id="r-valor" type="text" inputMode="numeric" autoComplete="off" placeholder="0,00" value={suprimentoValor}
                        onChange={(e) => { const digits = (e.target.value || '').replace(/\D/g, ''); const cents = digits ? Number(digits) / 100 : 0; const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents); setSuprimentoValor(formatted); }}
                        onKeyDown={(e) => { e.stopPropagation(); const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab']; if (allowed.includes(e.key)) return; if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); } }}
                        onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="r-obs">Observação</Label>
                      <Input id="r-obs" placeholder="Opcional" value={suprimentoObs} onChange={(e) => setSuprimentoObs(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSuprimentoOpen(false)} disabled={suprimentoLoading}>Cancelar</Button>
                    <Button onClick={performSuprimento} disabled={suprimentoLoading}>{suprimentoLoading ? 'Registrando...' : 'Confirmar'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isSangriaOpen} onOpenChange={setIsSangriaOpen}>
                <DialogContent className="sm:max-w-sm w-[92vw] max-h-[85vh] animate-none" onKeyDown={(e) => e.stopPropagation()}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Registrar Sangria</DialogTitle>
                    <DialogDescription>Informe o valor a retirar do caixa e, opcionalmente, uma observação.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="s-valor">Valor</Label>
                      <Input id="s-valor" type="text" inputMode="numeric" autoComplete="off" placeholder="0,00" value={sangriaValor}
                        onChange={(e) => { const digits = (e.target.value || '').replace(/\D/g, ''); const cents = digits ? Number(digits) / 100 : 0; const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents); setSangriaValor(formatted); }}
                        onKeyDown={(e) => { e.stopPropagation(); const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab']; if (allowed.includes(e.key)) return; if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); } }}
                        onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="s-obs">Observação</Label>
                      <Input id="s-obs" placeholder="Opcional" value={sangriaObs} onChange={(e) => setSangriaObs(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSangriaOpen(false)} disabled={sangriaLoading}>Cancelar</Button>
                    <Button onClick={performSangria} disabled={sangriaLoading}>{sangriaLoading ? 'Registrando...' : 'Confirmar'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="text-sm text-text-muted">Nenhuma sessão de caixa aberta.</div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  // Chaves de cache por empresa
  const companyCode = userProfile?.codigo_empresa || 'anon';
  const LS_KEY = {
    comandaId: `balcao:comandaId:${companyCode}`,
    items: `balcao:items:${companyCode}`,
    customerName: `balcao:customer:${companyCode}`,
    clientChosen: `balcao:clientChosen:${companyCode}`,
    pendingClientIds: `balcao:pendingClientIds:${companyCode}`,
    missCount: `balcao:missCount:${companyCode}`,
    lastMissTs: `balcao:lastMissTs:${companyCode}`,
  };

  // Utilitário: recarregar itens e cliente para a comanda atual com retry leve
  const refetchItemsAndCustomer = async (targetComandaId, attempts = 3) => {
    if (!targetComandaId) return;
    const codigoEmpresa = userProfile?.codigo_empresa;
    const reqId = ++itemsReqIdRef.current;
    for (let i = 0; i < attempts; i++) {
      try {
        const itens = await listarItensDaComanda({ comandaId: targetComandaId, codigoEmpresa });
        // Ignora respostas antigas
        if (reqId !== itemsReqIdRef.current) return;
        const normalized = (itens || []).map((it) => ({
          id: it.id,
          productId: it.produto_id,
          name: it.descricao || 'Item',
          price: Number(it.preco_unitario || 0),
          quantity: Number(it.quantidade || 1),
        }));
        // Sempre confiar na resposta do servidor, inclusive quando vier vazia
        setItems(normalized);
        try {
          const vincs = await listarClientesDaComanda({ comandaId: targetComandaId, codigoEmpresa });
          if (reqId !== itemsReqIdRef.current) return;
          // Nomes para exibição
          const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
          const nomeFinal = nomes.length ? nomes.join(', ') : '';
          setCustomerName(nomeFinal);
          setClientChosen(Boolean(nomeFinal));
          // IDs para seleção no wizard/pagamento (sempre usar cliente_id)
          const ids = Array.from(
            new Set(
              (vincs || [])
                .map(v => v?.cliente_id)
                .filter(Boolean)
            )
          );
          if (ids.length > 0) {
            setSelectedClientIds(ids);
          }
        } catch {
          setCustomerName('');
          setClientChosen(false);
        }
        break;
      } catch (err) {
        if (i === attempts - 1) {
          toast({ title: 'Falha ao atualizar itens', description: err?.message || 'Tente novamente', variant: 'destructive' });
        } else {
          // Backoff com jitter leve
          const base = 350 * (i + 1);
          const jitter = Math.floor(Math.random() * 120);
          await new Promise(r => setTimeout(r, base + jitter));
        }
      }
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      // Timeout de segurança para não travar em loading
      let safetyTimer = setTimeout(() => { if (mountedRef.current) setLoading(false); }, 10000);
      // Garantir codigo da empresa
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) {
        // Short-circuit de pré-requisito
        if (mountedRef.current) setLoading(false);
        return;
      }

      // 1) Hidratar de cache, se existir (para exibirmos imediatamente)
      try {
        const cachedId = localStorage.getItem(LS_KEY.comandaId);
        const cachedItems = JSON.parse(localStorage.getItem(LS_KEY.items) || '[]');
        const cachedCustomer = localStorage.getItem(LS_KEY.customerName) || '';
        const cachedChosen = localStorage.getItem(LS_KEY.clientChosen);
        const cachedPendingIds = JSON.parse(localStorage.getItem(LS_KEY.pendingClientIds) || '[]');
        if (cachedId) setComandaId(Number.isNaN(+cachedId) ? cachedId : Number(cachedId));
        if (Array.isArray(cachedItems) && cachedItems.length > 0) setItems(cachedItems);
        if (cachedCustomer) setCustomerName(cachedCustomer);
        if (cachedChosen === 'true') setClientChosen(true);
        if (Array.isArray(cachedPendingIds) && cachedPendingIds.length > 0) setSelectedClientIds(cachedPendingIds);
      } catch { /* ignore cache errors */ }

      // 2) Obter comanda aberta existente (não cria automaticamente)
      // Se não encontrar, mas existir comandaId em cache, ainda tentamos refetch para evitar sumiço temporário
      const cachedIdStr = localStorage.getItem(LS_KEY.comandaId);
      const cachedId = cachedIdStr ? (Number.isNaN(+cachedIdStr) ? cachedIdStr : Number(cachedIdStr)) : null;
      const c = await listarComandaBalcaoAberta({ codigoEmpresa }).catch(() => null);
      if (c?.id) {
        setComandaId(c.id);
        await refetchItemsAndCustomer(c.id);
      } else if (cachedId) {
        // Tenta reaproveitar a comanda do cache (mitiga atrasos de RLS)
        setComandaId(cachedId);
        await refetchItemsAndCustomer(cachedId, 3);
      } else {
        // Nenhuma comanda aberta encontrada e não há cache de comandaId
        // Aplicar "dois strikes" antes de limpar itens/cache para mitigar latência/RLS
        let missCount = 0; let lastMissTs = 0;
        try {
          missCount = Number(localStorage.getItem(LS_KEY.missCount) || '0');
          lastMissTs = Number(localStorage.getItem(LS_KEY.lastMissTs) || '0');
        } catch {}
        const now = Date.now();
        const withinWindow = (now - lastMissTs) < 90000; // 90s janela
        const nextMiss = withinWindow ? (missCount + 1) : 1;
        try {
          localStorage.setItem(LS_KEY.missCount, String(nextMiss));
          localStorage.setItem(LS_KEY.lastMissTs, String(now));
        } catch {}

        // Sempre manter possíveis seleções de cliente
        try {
          const cachedCustomer = localStorage.getItem(LS_KEY.customerName) || '';
          const cachedChosen = localStorage.getItem(LS_KEY.clientChosen) === 'true';
          const cachedPendingIds = JSON.parse(localStorage.getItem(LS_KEY.pendingClientIds) || '[]');
          setCustomerName(cachedCustomer || '');
          setClientChosen(Boolean(cachedChosen));
          setSelectedClientIds(Array.isArray(cachedPendingIds) ? cachedPendingIds : []);
        } catch {}

        setComandaId(null);
        // Só limpar itens e cache após 2 misses consecutivos na janela
        if (nextMiss >= 2) {
          setItems([]);
          try {
            localStorage.removeItem(LS_KEY.comandaId);
            localStorage.removeItem(LS_KEY.items);
          } catch {}
        } else {
          // No primeiro miss, manter os itens cacheados visíveis
          try {
            const cachedItems = JSON.parse(localStorage.getItem(LS_KEY.items) || '[]');
            if (Array.isArray(cachedItems) && cachedItems.length > 0) setItems(cachedItems);
          } catch {}
        }
      }
      // Carregar produtos (com busca inicial se houver)
      try {
        const prods = await listProducts({ includeInactive: false, search: productSearch?.trim() || undefined, codigoEmpresa });
        if (mountedRef.current) setProducts(prods || []);
      } catch { setProducts([]); }
      clearTimeout(safetyTimer);
    } catch (e) {
      toast({ title: 'Falha ao carregar Modo Balcão', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Cancelar venda atual (não deve ir para histórico): marca como 'canceled' e limpa UI
  const cancelSale = async () => {
    try {
      setCancelLoading(true);
      setSaleCancelling(true);
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (comandaId && codigoEmpresa) {
        try {
          // 1) Apagar itens e vínculos de clientes da comanda
          try { await supabase.from('comanda_itens').delete().eq('comanda_id', comandaId).eq('codigo_empresa', codigoEmpresa); } catch {}
          try { await supabase.from('comanda_clientes').delete().eq('comanda_id', comandaId).eq('codigo_empresa', codigoEmpresa); } catch {}
          // 2) Deletar a comanda completamente (não apenas marcar como cancelada)
          await supabase.from('comandas').delete().eq('id', comandaId).eq('codigo_empresa', codigoEmpresa);
        } catch { /* ignora e segue limpando UI */ }
      }
    } finally {
      // Limpa UI e cache independentemente do resultado do backend
      setComandaId(null);
      setItems([]);
      setSelectedClientIds([]);
      setCustomerName('');
      setClientChosen(false);
      setPendingProduct(null);
      try {
        localStorage.removeItem(LS_KEY.comandaId);
        localStorage.removeItem(LS_KEY.items);
        localStorage.removeItem(LS_KEY.customerName);
      } catch {}
      setCancelLoading(false);
      toast({ title: 'Venda cancelada', variant: 'success' });
      setSaleCancelling(false);
    }
  };

  useEffect(() => {
    let retryOnce = false;
    const run = async () => {
      await loadAll();
      // Retry leve se após o load inicial continuarmos sem comanda e sem itens, para mitigar latência/RLS
      if (!retryOnce && mountedRef.current && !comandaId && (itemsRef.current || []).length === 0) {
        retryOnce = true;
        setTimeout(() => { if (mountedRef.current) loadAll(); }, 700);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.codigo_empresa]);

  // Persistir em cache quando comandaId/itens/cliente mudarem
  useEffect(() => {
    try {
      if (comandaId) localStorage.setItem(LS_KEY.comandaId, String(comandaId));
      localStorage.setItem(LS_KEY.items, JSON.stringify(items || []));
      localStorage.setItem(LS_KEY.customerName, customerName || '');
      localStorage.setItem(LS_KEY.clientChosen, clientChosen ? 'true' : 'false');
      if (!comandaId) {
        // Antes da comanda, guardamos possíveis clientes pendentes
        localStorage.setItem(LS_KEY.pendingClientIds, JSON.stringify(selectedClientIds || []));
      } else {
        // Com comanda aberta, removemos pendências
        localStorage.removeItem(LS_KEY.pendingClientIds);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId, items, customerName, clientChosen, selectedClientIds]);

  // Recarregar itens quando janela ganha foco ou página volta a ficar visível
  useEffect(() => {
    const onFocus = () => { if (comandaId) refetchItemsAndCustomer(comandaId, 2); };
    const onVisibility = () => { if (document.visibilityState === 'visible' && comandaId) refetchItemsAndCustomer(comandaId, 2); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId]);

  // Atalhos de teclado globais
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignorar se estiver digitando em input/textarea
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      
      // P = focar na lista de produtos
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        productListRef.current?.focus();
        return;
      }
      
      // C = abrir wizard de clientes (se caixa aberto e cliente escolhido)
      if ((e.key === 'c' || e.key === 'C') && isCashierOpen && clientChosen) {
        e.preventDefault();
        setIsClientWizardOpen(true);
        return;
      }
      
      // Escape = fechar modais abertos
      if (e.key === 'Escape') {
        if (isProductPickerOpen) {
          setIsProductPickerOpen(false);
          return;
        }
        if (isClientWizardOpen) {
          setIsClientWizardOpen(false);
          return;
        }
        if (isPayOpen) {
          setIsPayOpen(false);
          return;
        }
        if (isProductDetailsOpen) {
          setIsProductDetailsOpen(false);
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCashierOpen, clientChosen, isProductPickerOpen, isClientWizardOpen, isPayOpen, isProductDetailsOpen]);

  // Redimensionamento de painéis
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      // Considerar a largura do divisor + margens (w-2 + mx-2 = 2px + 16px = 18px total)
      const dividerWidth = 18;
      const availableWidth = rect.width - dividerWidth;
      const mouseX = e.clientX - rect.left;
      const newWidth = (mouseX / rect.width) * 100;
      
      // Limitar entre 20% e 80%
      if (newWidth >= 20 && newWidth <= 80) {
        setLeftPanelWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        // Salvar no localStorage
        try {
          localStorage.setItem('balcao_left_panel_width', String(leftPanelWidth));
        } catch {}
      }
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, leftPanelWidth]);

  // Busca de produtos com debounce
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const prods = await listProducts({ includeInactive: false, search: productSearch?.trim() || undefined, codigoEmpresa: userProfile?.codigo_empresa });
        if (!active) return;
        // Filtrar por código ou nome
        let filtered = prods || [];
        if (productSearch?.trim()) {
          const term = productSearch.trim().toLowerCase();
          filtered = filtered.filter(p => 
            (p.name || '').toLowerCase().includes(term) ||
            (p.code || '').toLowerCase().includes(term)
          );
        }
        // Ordenar por código
        filtered.sort((a, b) => {
          const codeA = a.code || '';
          const codeB = b.code || '';
          // Se ambos são números, comparar numericamente
          if (/^\d+$/.test(codeA) && /^\d+$/.test(codeB)) {
            return parseInt(codeA, 10) - parseInt(codeB, 10);
          }
          // Caso contrário, comparar alfabeticamente
          return codeA.localeCompare(codeB);
        });
        setProducts(filtered);
      } catch {
        if (active) setProducts([]);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [productSearch]);

  // Buscar estoque reservado global (todas as comandas abertas)
  useEffect(() => {
    // Pausar enquanto o modal de fechar caixa estiver aberto para evitar flicker/unmount
    if (isCloseCashOpen) return;
    let active = true;
    const fetchReservedStock = async () => {
      try {
        const codigoEmpresa = userProfile?.codigo_empresa;
        if (!codigoEmpresa) return;
        
        const itens = await listarItensDeTodasComandasAbertas({ codigoEmpresa });
        if (!active) return;

        const map = new Map();
        for (const item of itens || []) {
          const pid = item.produto_id;
          const qty = Number(item.quantidade || 0);
          map.set(pid, (map.get(pid) || 0) + qty);
        }

        setReservedStock(map);
      } catch (err) {
        console.error('[BalcaoPage] Erro ao buscar estoque reservado:', err);
        if (active) setReservedStock(new Map());
      }
    };
    
    fetchReservedStock();
    
    // Atualizar a cada 5 segundos (reduzido de 10s para melhor sincronização)
    const interval = setInterval(fetchReservedStock, 5000);
    
    return () => { 
      active = false; 
      clearInterval(interval);
    };
  }, [userProfile?.codigo_empresa, items, isCloseCashOpen]); // Pausa quando modal de fechamento está aberto

  useEffect(() => {
    if (isCloseCashOpen) return;
    let active = true;
    const t = setTimeout(async () => {
      try {
        const rows = await listarClientes({ searchTerm: clientSearch, limit: 20, codigoEmpresa: userProfile?.codigo_empresa });
        if (!active) return;
        // Ordenar por código
        const sorted = (rows || []).slice().sort((a, b) => Number(a?.codigo || 0) - Number(b?.codigo || 0));
        setClients(sorted);
        
        // Antes de existir comanda aberta, se não houver clientes selecionados e o modal acabou de abrir,
        // selecionar cliente Consumidor (cod 0) automaticamente como default inicial
        if (!comandaId && !clientChosen && isClientWizardOpen && (!selectedClientIds || selectedClientIds.length === 0)) {
          const consumidor = sorted?.find(c => c?.codigo === 0);
          if (consumidor) {
            setSelectedClientIds([consumidor.id]);
            try { localStorage.setItem(LS_KEY.pendingClientIds, JSON.stringify([consumidor.id])); } catch {}
          }
        }
      } catch { if (active) setClients([]); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [clientSearch, isClientWizardOpen, isCloseCashOpen]);

  const total = useMemo(() => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0), [items]);
  const totalWithDiscount = useMemo(() => {
    try {
      const subtotal = (items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0), 0);
      const tipo = comandaDiscount?.tipo;
      const val = Number(comandaDiscount?.valor || 0);
      let descCmd = 0;
      if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100);
      else if (tipo === 'fixo' && val > 0) descCmd = val;
      return Math.max(0, subtotal - descCmd);
    } catch { return total; }
  }, [items, comandaDiscount, total]);
  
  // Mapa de quantidades por produto APENAS da comanda atual (para badge)
  const qtyByProductId = useMemo(() => {
    const map = new Map();
    for (const it of items || []) {
      const pid = it.productId;
      if (!pid) continue;
      const q = Number(it.quantity || 0);
      map.set(pid, (map.get(pid) || 0) + q);
    }
    return map;
  }, [items]);

  const addProduct = async (prod, opts = {}) => {
    try {
      // Verificar se caixa está aberto ANTES de tudo
      if (!isCashierOpen) {
        toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de iniciar uma venda.', variant: 'warning' });
        return;
      }
      if (!clientChosen && !opts.skipClientCheck) {
        setPendingProduct(prod);
        setIsClientWizardOpen(true);
        toast({ title: 'Selecione o cliente', description: 'Escolha um cliente cadastrado antes de vender.', variant: 'warning' });
        return;
      }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { 
        toast({ title: 'Empresa não definida', description: 'Faça login novamente.', variant: 'destructive' }); 
        return; 
      }
      if (addingProductId) return;

      // Pré-validação no cliente para UX imediata (servidor também valida)
      const stock = Number(prod.stock ?? prod.currentStock ?? 0);
      const reserved = reservedStock.get(prod.id) || 0;
      const available = Math.max(0, stock - reserved);
      const minStock = Number(prod.minStock ?? 0);
      
      if (available <= 0) {
        toast({ 
          title: 'Sem estoque disponível', 
          description: `Produto "${prod.name}" está sem estoque (${stock} total, ${reserved} reservado em outras comandas).`, 
          variant: 'destructive' 
        });
        return;
      }

      // Só aqui marcamos como "adicionando" para não travar em early-returns
      setAddingProductId(prod.id);

      // Criar comanda se não existir ainda (somente no primeiro item)
      let cid = comandaId;
      const createdNow = !cid;
      if (!cid) {
        try {
          setSaleOpening(true);
          const c = await getOrCreateComandaBalcao({ codigoEmpresa });
          cid = c.id;
          setComandaId(c.id);
          
          // Aguardar RLS processar antes de continuar
          await new Promise(r => setTimeout(r, 300));
          
          // Validar que a comanda foi criada e está acessível
          const { data: checkComanda } = await supabase
            .from('comandas')
            .select('id')
            .eq('id', cid)
            .eq('codigo_empresa', codigoEmpresa)
            .single();
          
          if (!checkComanda) {
            throw new Error('Comanda criada mas não acessível via RLS');
          }
        } catch (err) {
          if (err?.code === 'NO_OPEN_CASH_SESSION') {
            toast({ title: 'Abra o caixa para vender', description: 'Você precisa abrir o caixa antes de iniciar uma comanda no Balcão.', variant: 'warning' });
            return;
          }
          throw err;
        } finally {
          setSaleOpening(false);
        }
      }
      
      const price = Number(prod.salePrice ?? prod.price ?? 0);
      
      // Se já existe item deste produto na comanda, apenas incrementa a quantidade
      const existing = (itemsRef.current || []).find(it => it.productId === prod.id);
      
      if (existing) {
        await atualizarQuantidadeItem({ 
          itemId: existing.id, 
          quantidade: Number(existing.quantity || 0) + 1, 
          codigoEmpresa 
        });
      } else {
        await adicionarItem({ 
          comandaId: cid, 
          produtoId: prod.id, 
          descricao: prod.name, 
          quantidade: 1, 
          precoUnitario: price, 
          codigoEmpresa 
        });
      }
      
      // Atualizar itens da comanda
      await refetchItemsAndCustomer(cid);
      
      // Atualizar estoque reservado global após adicionar item
      try {
        const itensGlobal = await listarItensDeTodasComandasAbertas({ codigoEmpresa });
        const reservedMap = new Map();
        for (const item of itensGlobal || []) {
          const pid = item.produto_id;
          const qty = Number(item.quantidade || 0);
          reservedMap.set(pid, (reservedMap.get(pid) || 0) + qty);
        }
        setReservedStock(reservedMap);
      } catch (err) {
        console.error('[BalcaoPage:addProduct] Erro ao atualizar estoque reservado:', err);
      }
      
      // Se havia clientes selecionados em memória e a comanda acabou de ser criada, associar agora
      if (createdNow) {
        try {
          const ids = Array.from(new Set(selectedClientIds || []));
          if (ids.length > 0) {
            await adicionarClientesAComanda({ 
              comandaId: cid, 
              clienteIds: ids, 
              nomesLivres: [], 
              codigoEmpresa,
              replace: true,
            });
            // Atualizar cliente após associação
            await refetchItemsAndCustomer(cid);
            
            // Atualizar estado local
            const vincs = await listarClientesDaComanda({ comandaId: cid, codigoEmpresa });
            const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
            setCustomerName(nomes.length ? nomes.join(', ') : '');
            setClientChosen(true);
            
            // Atualizar cache local
            try {
              localStorage.removeItem(LS_KEY.pendingClientIds);
              localStorage.setItem(LS_KEY.customerName, nomes.length ? nomes.join(', ') : '');
              localStorage.setItem(LS_KEY.clientChosen, 'true');
            } catch (error) {
              console.error('Erro ao atualizar cache local:', error);
            }
          }
        } catch (error) {
          console.error('Erro ao associar clientes:', error);
        }
      }
      
      // Avisos de estoque baixo/último
      if (stock - 1 <= 0) {
        toast({ 
          title: 'Última unidade vendida', 
          description: `"${prod.name}" esgotou após esta venda.`, 
          variant: 'warning' 
        });
      } else if (stock - 1 <= minStock) {
        toast({ 
          title: 'Estoque baixo', 
          description: `"${prod.name}" atingiu nível de estoque baixo.`, 
          variant: 'warning' 
        });
      } else {
        toast({ 
          title: 'Produto adicionado', 
          description: prod.name, 
          variant: 'success' 
        });
      }
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (e?.code === 'OUT_OF_STOCK' || msg.includes('sem estoque')) {
        toast({ title: 'Sem estoque', description: 'Este produto está sem estoque.', variant: 'destructive' });
      } else if (e?.code === 'INSUFFICIENT_STOCK' || msg.includes('insuficiente')) {
        toast({ title: 'Estoque insuficiente', description: e?.message || 'Quantidade maior que o disponível.', variant: 'destructive' });
      } else {
        toast({ title: 'Falha ao adicionar', description: e?.message || 'Tente novamente', variant: 'destructive' });
      }
    } finally {
      setAddingProductId(null);
    }
  };

  const openPay = async () => {
    try {
      setPayLoading(true);
      if (!clientChosen) { setIsClientWizardOpen(true); toast({ title: 'Selecione o cliente', description: 'Escolha um cliente cadastrado antes de pagar.', variant: 'warning' }); setPayLoading(false); return; }
      const codigoEmpresa = userProfile?.codigo_empresa;
      if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
      if (!comandaId) {
        try {
          setSaleOpening(true);
          const c = await getOrCreateComandaBalcao({ codigoEmpresa });
          if (!c?.id) { toast({ title: 'Comanda não encontrada', description: 'Abra uma comanda antes de pagar.', variant: 'destructive' }); setPayLoading(false); return; }
          setComandaId(c.id);
        } catch (err) {
          if (err?.code === 'NO_OPEN_CASH_SESSION') {
            toast({ title: 'Abra o caixa para pagar', description: 'É necessário abrir o caixa antes de iniciar/confirmar uma venda.', variant: 'warning' });
            setPayLoading(false);
            return;
          }
          throw err;
        } finally {
          setSaleOpening(false);
        }
      }
      // Validação forte de estoque antes do pagamento
      try {
        await verificarEstoqueComanda({ comandaId: comandaId, codigoEmpresa });
      } catch (err) {
        const msg = Array.isArray(err?.items) && err.items.length
          ? err.items.map(v => `${v.name} (solicitado ${v.solicitado}, estoque ${v.estoque})`).join('; ')
          : (err?.message || 'Estoque insuficiente na comanda');
        toast({ title: 'Estoque insuficiente', description: msg, variant: 'destructive', duration: 7000 });
        setPayLoading(false);
        return;
      }
      const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa });
      setPayMethods(fins || []);
      // carregar clientes vinculados à comanda para exibir nomes corretamente (normalizando para {id, nome})
      let normalized = [];
      try {
        const vinc = await listarClientesDaComanda({ comandaId, codigoEmpresa });
        const arr = Array.isArray(vinc) ? vinc : [];
        normalized = arr.map(r => {
          // Use SEMPRE o cliente_id como chave principal; nunca o id da tabela de vínculo
          const id = r?.cliente_id ?? r?.clientes?.id ?? null;
          const nome = r?.clientes?.nome ?? r?.nome ?? r?.nome_livre ?? '';
          return id ? { id, nome } : null;
        }).filter(Boolean);
      } catch { normalized = []; }
      setPayClients(normalized);
      // Inicia primeira linha já respeitando taxa da finalizadora padrão
      const def = (fins && fins[0] && fins[0].id) ? fins[0].id : null;
      const mainClientId = (selectedClientIds && selectedClientIds.length > 0)
        ? selectedClientIds[0]
        : (normalized[0]?.id || null);
      // Auto-preencher total base (itens) já considerando desconto de comanda e aplicar taxa se houver
      let subtotalBase = 0;
      try {
        const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
        subtotalBase = (itens || []).reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0);
      } catch {}
      // Aplicar desconto da comanda, se existir, para sugerir o valor correto a pagar
      const descTipo = comandaDiscount?.tipo;
      const descVal = Number(comandaDiscount?.valor || 0);
      let descCmd = 0;
      if (descTipo === 'percentual' && descVal > 0) {
        descCmd = subtotalBase * (descVal / 100);
      } else if (descTipo === 'fixo' && descVal > 0) {
        descCmd = descVal;
      }
      const totalBase = Math.max(0, subtotalBase - descCmd);
      const fin0 = (fins || []).find(m => String(m.id) === String(def));
      const pct0 = Number(fin0?.taxa_percentual || 0);
      const charge0 = pct0 > 0;
      const initialValue = charge0 ? (totalBase * (1 + pct0/100)) : totalBase;
      const formattedInit = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(initialValue);
      setPaymentLines([{ id: 1, clientId: mainClientId, methodId: def, value: formattedInit, chargeFee: charge0 }]);
      setNextPayLineId(2);
      setIsPayOpen(true);
      setPayLoading(false);
      return;
    } catch (err) {
      if (err?.code === 'NO_OPEN_CASH_SESSION') {
        toast({ title: 'Abra o caixa para pagar', description: 'É necessário abrir o caixa antes de iniciar/confirmar uma venda.', variant: 'warning' });
        setPayLoading(false);
        return;
      }
      toast({ title: 'Falha ao iniciar pagamento', description: err?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs - Mobile em cima, Desktop na mesma linha */}
      <div className="md:hidden mb-2 w-full">
        <Tabs value="balcao" onValueChange={(v) => {
          if (v === 'mesas') navigate('/vendas');
          if (v === 'balcao') navigate('/balcao');
          if (v === 'historico') navigate('/historico');
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mesas" className="text-xs">Mesas</TabsTrigger>
            <TabsTrigger value="balcao" className="text-xs">Balcão</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center justify-between mb-2 md:mb-6 gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-2 md:gap-3">
          <Tabs value="balcao" onValueChange={(v) => {
            if (v === 'mesas') navigate('/vendas');
            if (v === 'balcao') navigate('/balcao');
            if (v === 'historico') navigate('/historico');
          }}>
            <TabsList className="inline-flex">
              <TabsTrigger value="mesas" className="text-sm">Mesas</TabsTrigger>
              <TabsTrigger value="balcao" className="text-sm">Balcão</TabsTrigger>
              <TabsTrigger value="historico" className="text-sm">Histórico</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3 md:ml-auto">
          <OpenCashierDialog />
          <CloseCashierDialog />
          <Button variant="outline" size="sm" onClick={() => setIsCashierDetailsOpen(true)} className="px-3">
            <Banknote className="h-4 w-4" />
            <span className="ml-2 md:hidden">Detalhes</span>
            <span className="ml-2 hidden md:inline">Detalhes do Caixa</span>
          </Button>
        </div>
      </div>

      {/* Mobile: fluxo guiado - primeiro iniciar venda (cliente), depois produtos / cancelar / finalizar */}
      <div className="md:hidden flex-1 flex flex-col">
        <div className="flex flex-col border rounded-lg border-border overflow-hidden bg-surface flex-1 min-h-0">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-text-secondary">Comanda</div>
              <div className="text-base font-bold truncate">Balcão</div>
              {clientChosen && customerName && (
                <div className="text-[11px] text-text-muted truncate mt-0.5">{customerName}</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {/* Antes de escolher cliente: CTA claro para iniciar venda */}
              {!clientChosen ? (
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60"
                  disabled={!isCashierOpen}
                  onClick={() => {
                    if (!isCashierOpen) {
                      toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de iniciar uma venda.', variant: 'warning' });
                      return;
                    }
                    setIsClientWizardOpen(true);
                  }}
                >
                  Iniciar venda
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="h-8 px-2 text-xs bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60"
                      disabled={!isCashierOpen}
                      onClick={() => {
                        if (!isCashierOpen) {
                          toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de adicionar produtos.', variant: 'warning' });
                          return;
                        }
                        setIsProductPickerOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Produto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      onClick={() => setIsClientWizardOpen(true)}
                    >
                      + Cliente
                    </Button>
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    Total: R$ {total.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 thin-scroll min-h-0">
            {!clientChosen ? (
              <div className="text-center pt-8 text-xs text-text-muted space-y-2">
                <div>Para começar, toque em <span className="font-semibold">Iniciar venda</span> e selecione o cliente.</div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center pt-8 text-xs text-text-muted space-y-2">
                <div>Comanda criada para o cliente.</div>
                <div>Use o botão <span className="font-semibold">Produto</span> para adicionar itens.</div>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map(it => (
                  <li key={it.id} className="p-2 rounded-md border border-border/40 bg-surface-2">
                    <div className="text-sm font-medium truncate" title={it.name}>{it.name}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const codigoEmpresa = userProfile?.codigo_empresa;
                            if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
                            const next = Number(it.quantity || 1) - 1;
                            try {
                              if (next <= 0) {
                                await removerItem({ itemId: it.id, codigoEmpresa });
                                setItems(prev => prev.filter(n => n.id !== it.id));
                              } else {
                                await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa });
                                setItems(prev => prev.map(n => n.id === it.id ? { ...n, quantity: next } : n));
                              }
                            } catch (err) {
                              toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
                            }
                          }}
                        >
                          -
                        </Button>
                        <span className="w-7 text-center text-sm font-semibold">{it.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const codigoEmpresa = userProfile?.codigo_empresa;
                            if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
                            const next = Number(it.quantity || 1) + 1;
                            try {
                              await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa });
                              setItems(prev => prev.map(n => n.id === it.id ? { ...n, quantity: next } : n));
                            } catch (err) {
                              toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
                            }
                          }}
                        >
                          +
                        </Button>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        R$ {(Number(it.quantity) * Number(it.price)).toFixed(2)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            {!clientChosen ? (
              <Button
                className="flex-1"
                size="sm"
                variant="outline"
                disabled={!isCashierOpen}
                onClick={() => {
                  if (!isCashierOpen) {
                    toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de iniciar uma venda.', variant: 'warning' });
                    return;
                  }
                  setIsClientWizardOpen(true);
                }}
              >
                Iniciar venda
              </Button>
            ) : (
              <>
                <Button
                  className="flex-1"
                  variant="outline"
                  size="sm"
                  onClick={cancelSale}
                  disabled={cancelLoading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  disabled={total <= 0}
                  onClick={openPay}
                >
                  Finalizar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Detalhes do Caixa renderizado via componente único */}
      <CashierDetailsDialog />

      {/* Detalhes do Produto (Balcão) */}
      <Dialog open={isProductDetailsOpen} onOpenChange={(open) => { setIsProductDetailsOpen(open); if (!open) setSelectedProduct(null); }}>
        <DialogContent className="sm:max-w-[420px] w-full max-h-[85vh] flex flex-col animate-none" onKeyDown={(e) => e.stopPropagation()} onPointerDownOutside={(e) => e.stopPropagation()} onInteractOutside={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold break-words" title={selectedProduct?.name || ''}>{selectedProduct?.name || 'Produto'}</DialogTitle>
            <DialogDescription>Detalhes do produto e ações rápidas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Preço</span>
              <span className="text-sm font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(selectedProduct?.price ?? selectedProduct?.salePrice ?? 0))}</span>
            </div>
            {selectedProduct?.category ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Categoria</span>
                <span className="text-sm font-medium">{selectedProduct.category}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2 text-center">
              {typeof selectedProduct?.stock !== 'undefined' && (
                <div className="bg-surface-2 rounded-md p-3 border border-border">
                  <div className="text-xs text-text-secondary">Estoque</div>
                  <div className="text-base font-semibold">{selectedProduct.stock}</div>
                </div>
              )}
              {typeof selectedProduct?.minStock !== 'undefined' && (
                <div className="bg-surface-2 rounded-md p-3 border border-border">
                  <div className="text-xs text-text-secondary">Mínimo</div>
                  <div className="text-base font-semibold">{selectedProduct.minStock}</div>
                </div>
              )}
              <div className="bg-surface-2 rounded-md p-3 border border-border">
                <div className="text-xs text-text-secondary">Na Comanda</div>
                <div className="text-base font-semibold">x{qtyByProductId.get(selectedProduct?.id) || 0}</div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="mr-auto inline-flex items-center gap-1" onClick={() => { if (selectedProduct) { navigate('/produtos', { state: { productId: selectedProduct.id, productName: selectedProduct.name } }); } }}>
              <FileText className="w-4 h-4" />
              <span>Info</span>
            </Button>
            <Button variant="outline" onClick={() => { setIsProductDetailsOpen(false); setSelectedProduct(null); }}>Fechar</Button>
            <Button onClick={async () => { if (selectedProduct) { await addProduct(selectedProduct, { skipClientCheck: false }); setIsProductDetailsOpen(false); setSelectedProduct(null); } }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlay global de carregamento para abrir/cancelar/fechar venda no balcão */}
      {(saleOpening || saleCancelling || saleClosing) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
          <div className="px-8 py-6 rounded-xl bg-surface border border-border shadow-2xl flex flex-col items-center gap-4 max-w-sm w-[85vw] text-center">
            <div className="w-8 h-8 rounded-full border-4 border-brand border-t-transparent animate-spin" aria-hidden="true" />
            <div className="space-y-1">
              <span className="block text-base font-semibold text-text-primary">
                {saleOpening
                  ? 'Abrindo venda...'
                  : saleCancelling
                    ? 'Cancelando venda...'
                    : 'Fechando conta...'}
              </span>
              <span className="block text-xs text-text-muted">
                {saleOpening
                  ? 'Aguarde, estamos iniciando a venda e sincronizando com os dispositivos.'
                  : saleCancelling
                    ? 'Aguarde, estamos cancelando a venda e limpando os itens.'
                    : 'Aguarde, estamos registrando o pagamento e encerrando a venda.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Product Picker (mobile e desktop) - lista de produtos em modal */}
      <Dialog open={isProductPickerOpen} onOpenChange={setIsProductPickerOpen}>
        <DialogContent
          className="sm:max-w-xl w-[92vw] sm:w-auto max-h-[85vh] flex flex-col overflow-hidden animate-none p-3 sm:p-6"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-brand" />
              Adicionar Produtos
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Balcão • Busque e adicione produtos à comanda atual
            </DialogDescription>
          </DialogHeader>
          <div className="px-3 pt-0 pb-3 sm:p-4 sm:pt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input placeholder="Buscar produto..." className="pl-9" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-0 sm:px-4 pb-3 sm:pb-4 thin-scroll">
            <ul className="space-y-2">
              {(products || [])
                .filter(p => {
                  const q = (pickerSearch || '').toLowerCase();
                  if (!q) return true;
                  const name = String(p.name || p.descricao || '').toLowerCase();
                  const code = String(p.code || p.codigo || '').toLowerCase();
                  return name.includes(q) || code.includes(q);
                })
                .sort((a, b) => {
                  const codeA = a.code ? parseInt(a.code, 10) : 999999;
                  const codeB = b.code ? parseInt(b.code, 10) : 999999;
                  return codeA - codeB;
                })
                .map(prod => {
                  const qty = qtyByProductId.get(prod.id) || 0;
                  const stock = Number(prod.stock ?? prod.currentStock ?? 0);
                  const remaining = Math.max(0, stock - qty);
                  const price = Number(prod.salePrice ?? prod.price ?? 0);
                  const isOutOfStock = remaining === 0;
                  return (
                    <li
                      key={prod.id}
                      className={`flex items-center w-full px-3 sm:px-2 py-2 sm:py-2 rounded-md border border-border/40 transition-colors ${
                        isOutOfStock ? 'opacity-50 grayscale' : 'hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p
                            className="font-semibold text-xs sm:text-sm truncate w-full"
                            title={`${prod.code ? `[${prod.code}] ` : ''}${prod.name}`}
                          >
                            {prod.code && <span className="text-text-muted">[{prod.code}]</span>} {prod.name}
                          </p>
                          {qty > 0 && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-brand/10 text-brand text-[11px] font-semibold rounded whitespace-nowrap flex-shrink-0">
                              {qty}x na comanda
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs mt-0.5">
                          <span className={`font-bold ${remaining === 0 ? 'text-text-muted' : 'text-brand'}`}>
                            R$ {price.toFixed(2)}
                          </span>
                          <span className="text-text-muted whitespace-nowrap">
                            Estoque:{' '}
                            <span className={`font-semibold ${remaining <= 5 ? 'text-destructive' : 'text-text-secondary'}`}>
                              {remaining}
                            </span>
                          </span>
                        </div>
                      </div>
                      <Button size="icon" className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60" onClick={async () => { await addProduct(prod); }} aria-label={`Adicionar ${prod.name}`}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
            </ul>
            {Array.isArray(products) && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingBag className="w-16 h-16 text-text-muted mb-4" />
                <p className="text-sm text-text-muted">Nenhum produto encontrado.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductPickerOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layout principal: desktop usa painéis lado a lado; mobile foca na comanda + botão Produto */}
      <div ref={containerRef} className="hidden md:flex gap-0 h-full overflow-hidden relative">
        <div 
          className="flex flex-col border rounded-lg border-border overflow-hidden"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div 
            className="p-4 border-b border-border space-y-3 cursor-pointer"
            onClick={(e) => {
              // Não focar se clicou em input ou botão
              if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
              }
              productListRef.current?.focus();
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input 
                placeholder="Buscar produto..." 
                className="pl-9" 
                value={productSearch} 
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  // Bloquear setas no input de busca
                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.stopPropagation();
                  }
                }}
              />
            </div>
            
            {/* Filtros de Status e Ordenação */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === 'all' 
                      ? 'bg-brand text-black' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('available')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === 'available' 
                      ? 'bg-success text-white' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Disponível
                </button>
                <button
                  onClick={() => setStatusFilter('low')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === 'low' 
                      ? 'bg-warning text-black' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Estoque Baixo
                </button>
                <button
                  onClick={() => setStatusFilter('out')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === 'out' 
                      ? 'bg-destructive text-white' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                >
                  Sem Estoque
                </button>
              </div>
              
              {/* Ordenação */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSortOrder('code');
                    try { localStorage.setItem('balcao_sort_order', 'code'); } catch {}
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    sortOrder === 'code' 
                      ? 'bg-brand text-black' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                  title="Ordenar por código"
                >
                  Código
                </button>
                <button
                  onClick={() => {
                    setSortOrder('name');
                    try { localStorage.setItem('balcao_sort_order', 'name'); } catch {}
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    sortOrder === 'name' 
                      ? 'bg-brand text-black' 
                      : 'bg-surface text-text-muted hover:bg-surface-2'
                  }`}
                  title="Ordenar por nome"
                >
                  A-Z
                </button>
              </div>
            </div>
            
            <div 
              className="flex items-center gap-4 text-sm text-text-muted cursor-pointer"
              onClick={() => productListRef.current?.focus()}
            >
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-surface border border-border rounded text-xs font-mono">↑↓</kbd>
                <span>Navegar</span>
              </div>
            </div>
          </div>
          <div 
            ref={productListRef}
            className="flex-1 overflow-y-auto p-4 thin-scroll focus:outline-none focus:ring-2 focus:ring-brand/20"
            tabIndex={0}
            onClick={() => productListRef.current?.focus()}
            onKeyDown={(e) => {
              const filtered = products.filter(p => {
                const q = productSearch.trim().toLowerCase();
                const matchesSearch = !q || (p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q);
                
                if (statusFilter === 'all') return matchesSearch;
                
                const reserved = reservedStock.get(p.id) || 0;
                const stock = Number(p.stock ?? p.currentStock ?? 0);
                const remaining = Math.max(0, stock - reserved);
                
                if (statusFilter === 'available') return matchesSearch && remaining > 0;
                if (statusFilter === 'low') return matchesSearch && remaining > 0 && remaining <= 5;
                if (statusFilter === 'out') return matchesSearch && remaining <= 0;
                
                return matchesSearch;
              }).sort((a, b) => {
                if (sortOrder === 'name') {
                  const nameA = (a.name || '').toLowerCase();
                  const nameB = (b.name || '').toLowerCase();
                  return nameA.localeCompare(nameB);
                } else {
                  const codeA = a.code ? parseInt(a.code, 10) : 999999;
                  const codeB = b.code ? parseInt(b.code, 10) : 999999;
                  return codeA - codeB;
                }
              });
              
              if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
              e.preventDefault();
              
              const idx = productFocusIndex || 0;
              const n = filtered.length;
              
              if (e.key === 'ArrowDown') {
                const next = Math.min(idx + 1, n - 1);
                setProductFocusIndex(next);
                requestAnimationFrame(() => productItemRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
              }
              if (e.key === 'ArrowUp') {
                const next = Math.max(idx - 1, 0);
                setProductFocusIndex(next);
                requestAnimationFrame(() => productItemRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
              }
              if (e.key === 'Home') {
                setProductFocusIndex(0);
                requestAnimationFrame(() => productItemRefs.current[0]?.scrollIntoView({ block: 'nearest' }));
              }
              if (e.key === 'End') {
                const next = Math.max(0, n - 1);
                setProductFocusIndex(next);
                requestAnimationFrame(() => productItemRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
              }
            }}
          >
            {(products || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <ShoppingBag className="w-16 h-16 text-text-muted mb-4" />
                <p className="text-lg font-semibold text-text-primary mb-2">Nenhum produto cadastrado</p>
                <p className="text-sm text-text-muted mb-6 text-center">Cadastre produtos para começar a vender</p>
                <Button onClick={() => navigate('/produtos')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Produto
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {products.filter(p => {
                  const q = productSearch.trim().toLowerCase();
                  const matchesSearch = !q || (p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q);
                  
                  if (statusFilter === 'all') return matchesSearch;
                  
                  const reserved = reservedStock.get(p.id) || 0;
                  const stock = Number(p.stock ?? p.currentStock ?? 0);
                  const remaining = Math.max(0, stock - reserved);
                  
                  if (statusFilter === 'available') return matchesSearch && remaining > 0;
                  if (statusFilter === 'low') return matchesSearch && remaining > 0 && remaining <= 5;
                  if (statusFilter === 'out') return matchesSearch && remaining <= 0;
                  
                  return matchesSearch;
                }).sort((a, b) => {
                  if (sortOrder === 'name') {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                  } else {
                    const codeA = a.code ? parseInt(a.code, 10) : 999999;
                    const codeB = b.code ? parseInt(b.code, 10) : 999999;
                    return codeA - codeB;
                  }
                }).map((prod, idx) => {
                  const qty = qtyByProductId.get(prod.id) || 0;
                  const reserved = reservedStock.get(prod.id) || 0;
                  const stock = Number(prod.stock ?? prod.currentStock ?? 0);
                  const remaining = Math.max(0, stock - reserved);
                  const price = Number(prod.salePrice ?? prod.price ?? 0);
                  const isFocused = idx === productFocusIndex;
                  
                  return (
                    <React.Fragment key={prod.id}>
                      <li 
                        ref={(el) => { productItemRefs.current[idx] = el; }}
                        className={`flex items-center gap-3 p-2 rounded-md transition-colors border-2 ${
                          isFocused
                            ? 'border-brand bg-brand/5'
                            : 'border-transparent hover:bg-surface-2'
                        } ${
                          remaining === 0 && qty === 0
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                        onClick={() => {
                          setProductFocusIndex(idx);
                          productListRef.current?.focus();
                        }}
                      >
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={(e) => { 
                            e.stopPropagation();
                            setSelectedProduct({ ...prod, qty, remaining, price }); 
                            setIsProductDetailsOpen(true); 
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold truncate" title={`${prod.code ? `[${prod.code}] ` : ''}${prod.name}`}>
                              {prod.code && <span className="text-text-muted">[{prod.code}]</span>} {prod.name}
                            </p>
                            {qty > 0 && (
                              <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30 flex-shrink-0">x{qty}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-text-muted">R$ {price.toFixed(2)}</p>
                            <span className={`text-xs font-medium whitespace-nowrap ${
                              remaining <= 0 
                                ? 'text-destructive' 
                                : remaining <= 5 
                                ? 'text-warning' 
                                : 'text-text-secondary'
                            }`}>
                              Estoque: {remaining}
                            </span>
                          </div>
                        </div>
                        <Button 
                          size="icon" 
                          className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            addProduct(prod);
                          }}
                          disabled={remaining === 0}
                          aria-label={`Adicionar ${prod.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </li>
                    </React.Fragment>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Divisor redimensionável */}
        <div
          className="w-2 bg-border hover:bg-brand cursor-col-resize transition-colors flex-shrink-0 mx-2"
          onMouseDown={() => setIsResizing(true)}
          title="Arraste para redimensionar"
        />

        <div 
          className="flex flex-col border rounded-lg border-border overflow-hidden"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="p-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-shrink">
              <div className="text-xs text-text-secondary">Comanda</div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-bold whitespace-nowrap">Balcão</span>
                {customerName ? (
                  <span className="truncate text-[11px] px-2 py-0.5 rounded-full border border-border bg-surface-2 text-text-secondary">
                    {customerName}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
              {/* Botão Produto - apenas mobile */}
              <Button
                size="sm"
                className="md:hidden h-8 px-2 text-xs whitespace-nowrap bg-amber-500 hover:bg-amber-400 text-black border border-amber-500/60"
                disabled={!isCashierOpen}
                onClick={() => { if (!isCashierOpen) { toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de adicionar produtos.', variant: 'warning' }); return; } setIsProductPickerOpen(true); }}
                title="Adicionar produto"
              >
                <Plus className="h-4 w-4 mr-1" />
                Produto
              </Button>
              {clientChosen && (
                <Button size="sm" variant="outline" className="h-8 px-2 text-xs whitespace-nowrap" disabled={!isCashierOpen} onClick={() => { if (!isCashierOpen) { toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de adicionar clientes.', variant: 'warning' }); return; } setIsClientWizardOpen(true); }}>+ Cliente</Button>
              )}
              {clientChosen ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 px-2 text-xs whitespace-nowrap bg-red-600 hover:bg-red-500 text-white border border-red-600/70 focus:outline-none focus:ring-0 focus-visible:ring-0 shadow-none"
                      disabled={cancelLoading}
                    >
                      {cancelLoading ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-[420px] animate-none" onKeyDown={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar venda do balcão?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Os itens serão descartados e a venda será limpa. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={cancelSale}>Confirmar Cancelamento</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button size="sm" variant="outline" className="h-8 px-2 text-xs opacity-60 cursor-not-allowed whitespace-nowrap" disabled>Cancelar</Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 thin-scroll">
            {(!clientChosen) ? (
              <div className="text-center pt-12">
                <div className="text-sm text-text-secondary mb-3">Para começar, inicie uma nova venda e selecione o cliente.</div>
                <Button disabled={!isCashierOpen} onClick={() => { if (!isCashierOpen) { toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de iniciar uma venda.', variant: 'warning' }); return; } setIsClientWizardOpen(true); }}>Iniciar nova venda</Button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center text-text-muted pt-16">Comanda vazia. Use o botão "+" para adicionar produtos.</div>
            ) : (
              <ul className="space-y-3 pr-1">
                {items.map(it => (
                  <li key={it.id} className="p-2 rounded-md border border-border/30 bg-surface hover:bg-surface-2 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate" title={it.name}>
                        {it.name}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={async (e) => {
                        e.stopPropagation();
                        const codigoEmpresa = userProfile?.codigo_empresa;
                        if (!codigoEmpresa) { toast({ title: 'Empresa não definida', variant: 'destructive' }); return; }
                        const next = Number(it.quantity || 1) - 1;
                        try {
                          if (next <= 0) {
                            await removerItem({ itemId: it.id, codigoEmpresa });
                            // Remove da UI após sucesso
                            setItems(prev => prev.filter(n => n.id !== it.id));
                          } else {
                            await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa });
                            // Atualiza UI após sucesso
                            setItems(prev => prev.map(n => n.id === it.id ? { ...n, quantity: next } : n));
                          }
                          
                          // Atualizar estoque reservado global após remover/diminuir
                          try {
                            const itensGlobal = await listarItensDeTodasComandasAbertas({ codigoEmpresa });
                            const reservedMap = new Map();
                            for (const item of itensGlobal || []) {
                              const pid = item.produto_id;
                              const qty = Number(item.quantidade || 0);
                              reservedMap.set(pid, (reservedMap.get(pid) || 0) + qty);
                            }
                            setReservedStock(reservedMap);
                          } catch (err) {
                            console.error('[BalcaoPage:removeItem] Erro ao atualizar estoque reservado:', err);
                          }
                        } catch (err) {
                          const msg = String(err?.message || '').toLowerCase();
                          if (err?.code === 'INSUFFICIENT_STOCK' || msg.includes('insuficiente')) {
                            toast({ title: 'Estoque insuficiente', description: err?.message || 'Quantidade maior que o disponível.', variant: 'warning' });
                          } else {
                            toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
                          }
                        }
                      }}>-</Button>
                      <span className="w-7 text-center font-semibold">
                        {it.quantity}
                      </span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={async (e) => {
                        e.stopPropagation();
                        const codigoEmpresa = userProfile?.codigo_empresa;
                        if (!codigoEmpresa) { 
                          toast({ title: 'Empresa não definida', variant: 'destructive' }); 
                          return; 
                        }
                        const next = Number(it.quantity || 1) + 1;
                        try {
                          await atualizarQuantidadeItem({ itemId: it.id, quantidade: next, codigoEmpresa });
                          // Atualiza UI após sucesso
                          setItems(prev => prev.map(n => n.id === it.id ? { ...n, quantity: next } : n));
                        } catch (err) {
                          const msg = String(err?.message || '').toLowerCase();
                          if (err?.code === 'INSUFFICIENT_STOCK' || msg.includes('insuficiente')) {
                            toast({ title: 'Estoque insuficiente', description: err?.message || 'Quantidade maior que o disponível.', variant: 'warning' });
                          } else {
                            toast({ title: 'Falha ao atualizar item', description: err?.message || 'Tente novamente', variant: 'destructive' });
                          }
                        }
                      }}>+</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold whitespace-nowrap">R$ {(Number(it.quantity)*Number(it.price)).toFixed(2)}</span>
                        <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded-full bg-surface text-text-secondary border border-border">x{it.quantity}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-border">
            <div className="flex justify-between items-center text-lg font-bold mb-3">
              <span>Total</span>
              <span>R$ {totalWithDiscount.toFixed(2)}</span>
            </div>
            <Button size="lg" className="w-full" onClick={openPay} disabled={totalWithDiscount <= 0}>Finalizar Pagamento</Button>
          </div>
        </div>
      </div>

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent
          className="sm:max-w-xl w-[92vw] max-h-[80vh] min-h-0 flex flex-col overflow-hidden animate-none p-3 sm:p-6"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader className="flex flex-col gap-1 pr-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <DialogTitle className="text-2xl font-bold">Fechar Conta</DialogTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start sm:self-auto"
                onClick={() => setIsDiscountOpen(true)}
              >
                Desconto
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {(() => {
              const subtotal = (items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0);
              const tipo = comandaDiscount?.tipo; const val = Number(comandaDiscount?.valor || 0);
              let descCmd = 0; if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100); else if (tipo === 'fixo' && val > 0) descCmd = val;
              const totalDisp = Math.max(0, subtotal - descCmd);
              const hasDiscount = descCmd > 0.0005;
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-text-secondary">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Desconto da comanda</span>
                      <span>-R$ {descCmd.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold border-t border-border pt-1 mt-1">
                    <span>Total com desconto</span>
                    <span>R$ {totalDisp.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
            <div className="flex-1 min-h-0 space-y-2 overflow-y-auto thin-scroll pr-0 sm:pr-1">
              <Label className="block">Pagamentos</Label>
              {/** Helper para resolver nome do cliente em qualquer cenário */}
              {(() => null)()}
              {/** Função local */}
              {/**/}
              {/** Não é executada, apenas declarada inline para manter escopo */}
              {/* eslint-disable-next-line */}
              {(() => { return null; })()}
              {/* resolver nome */}
              {/**/}
              {/**/}
              {/** Mantemos a função fora do JSX computado abaixo */}
              {(paymentLines || []).map((ln, idx) => {
                const resolveClientName = (cid) => {
                  if (!cid) return customerName || 'Cliente';
                  const sId = String(cid);
                  const byPay = (payClients || []).find(c => String(c.id) === sId);
                  if (byPay?.nome) return byPay.nome;
                  const byClients = (clients || []).find(c => String(c.id) === sId);
                  if (byClients?.nome) return byClients.nome;
                  return customerName || 'Cliente';
                };
                const hasMultiClients = (payClients || []).length > 1;
                const primary = (payClients || [])[0] || null;
                // PERMITIR selecionar o mesmo cliente múltiplas vezes - não filtrar por usados
                const remaining = (payClients || []).filter(c => String(c.id) !== String(primary?.id || ''));
                return (
                <div key={ln.id} className="space-y-2">
                  {/* Layout suspenso/colapsável para mobile */}
                  <div className="sm:hidden rounded-md bg-surface-2 border border-border overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                      onClick={() => setExpandedPaymentId(prev => (prev === ln.id ? null : ln.id))}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-xs text-text-secondary truncate">
                          {resolveClientName(primary?.id || ln.clientId)}
                        </span>
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {ln.methodId ? (getMethod(ln.methodId)?.nome || 'Forma não selecionada') : 'Forma não selecionada'} • R$ {ln.value || '0,00'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {paymentLines.length > 1 && idx > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentLines(prev => {
                                const remain = prev.filter(x => x.id !== ln.id);
                                if (remain.length === 0) return [];
                                const subtotal = (items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0);
                                const tipo = comandaDiscount?.tipo; const val = Number(comandaDiscount?.valor || 0);
                                let descCmd = 0; if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100); else if (tipo === 'fixo' && val > 0) descCmd = val;
                                const totalBase = Math.max(0, subtotal - descCmd);
                                const basePer = Math.floor((totalBase / remain.length) * 100) / 100;
                                const baseRemainder = totalBase - (basePer * remain.length);
                                return remain.map((line, i) => {
                                  const base = i === remain.length - 1 ? basePer + baseRemainder : basePer;
                                  return lineWithBase(line, base);
                                });
                              });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </button>
                    {expandedPaymentId === ln.id && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/60">
                        <div className="flex items-center gap-2">
                          <Select value={ln.methodId || ''} onValueChange={(v) => setPaymentLines(prev => prev.map(x => {
                            if (x.id !== ln.id) return x;
                            const fin = getMethod(v);
                            const pct = Number(fin?.taxa_percentual || 0);
                            if (pct > 0) {
                              const base = lineBase(x);
                              const totalWithFee = base * (1 + pct/100);
                              return { ...x, methodId: v, chargeFee: true, value: formatBRL(totalWithFee) };
                            } else {
                              const base = lineBase(x);
                              return { ...x, methodId: v, chargeFee: false, value: formatBRL(base) };
                            }
                          }))}>
                            <SelectTrigger className="flex-1 h-9 truncate text-sm">
                              <SelectValue placeholder="Forma de pagamento" />
                            </SelectTrigger>
                            <SelectContent>
                              {(payMethods || []).map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="0,00"
                            inputMode="numeric"
                            value={ln.value}
                            className="w-28 h-9 text-sm"
                            onChange={(e) => {
                              const digits = (e.target.value || '').replace(/\D/g, '');
                              const cents = digits ? Number(digits) / 100 : 0;
                              const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
                              setPaymentLines(prev => prev.map(x => x.id === ln.id ? { ...x, value: formatted } : x));
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                              if (allowed.includes(e.key)) return;
                              if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); }
                            }}
                            onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                          />
                        </div>
                        {(() => {
                          const pct = linePct(ln);
                          if (!pct) return null;
                          const fee = lineFee(ln);
                          const active = !!ln.chargeFee;
                          return (
                            <button
                              type="button"
                              onClick={() => setPaymentLines(prev => prev.map(x => {
                                if (x.id !== ln.id) return x;
                                const base = lineBase(x);
                                if (!active) {
                                  const totalWithFee = base * (1 + pct/100);
                                  return { ...x, chargeFee: true, value: formatBRL(totalWithFee) };
                                }
                                return { ...x, chargeFee: false, value: formatBRL(base) };
                              }))}
                              className={[
                                "inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-medium border transition-colors w-full justify-between",
                                active ? "bg-black text-amber-400 border-amber-500" : "bg-surface text-text-secondary border-border hover:border-border-hover"
                              ].join(' ')}
                              title={active ? 'Desmarcar taxa' : 'Cobrar taxa'}
                            >
                              <span className={["inline-block h-3 w-3 rounded-sm border",
                                active ? "bg-amber-500 border-amber-400" : "bg-transparent border-border"].join(' ')} />
                              <span className="text-[11px]">Taxa R$ {fee.toFixed(2)}</span>
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Layout atual mantido para desktop/tablet */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 items-start">
                    {/* Remove button aligned to the LEFT */}
                    <div className="sm:col-span-1 flex sm:justify-start">
                      {paymentLines.length > 1 && idx > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setPaymentLines(prev => {
                              const remain = prev.filter(x => x.id !== ln.id);
                              if (remain.length === 0) return [];
                              const subtotal = (items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0);
                              const tipo = comandaDiscount?.tipo; const val = Number(comandaDiscount?.valor || 0);
                              let descCmd = 0; if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100); else if (tipo === 'fixo' && val > 0) descCmd = val;
                              const totalBase = Math.max(0, subtotal - descCmd);
                              const basePer = Math.floor((totalBase / remain.length) * 100) / 100; // Arredondar para baixo
                              const baseRemainder = totalBase - (basePer * remain.length); // Calcular resto
                              return remain.map((line, i) => {
                                const base = i === remain.length - 1 ? basePer + baseRemainder : basePer;
                                return lineWithBase(line, base);
                              });
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {(idx === 0) ? (
                      <div className="sm:col-span-4">
                        <div className="h-9 px-3 rounded-md border border-border bg-surface flex items-center text-sm truncate">{resolveClientName(primary?.id || ln.clientId)}</div>
                      </div>
                    ) : hasMultiClients ? (
                      <div className="sm:col-span-4">
                        <Select value={ln.clientId || ''} onValueChange={(v) => setPaymentLines(prev => prev.map(x => x.id === ln.id ? { ...x, clientId: v } : x))}>
                          <SelectTrigger className="w-full truncate"><SelectValue placeholder="Cliente" /></SelectTrigger>
                          <SelectContent>
                            {/* Mostrar TODOS os clientes, incluindo o primary */}
                            {(payClients || []).map(c => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="sm:col-span-4">
                        <div className="h-9 px-3 rounded-md border border-border bg-surface flex items-center text-sm truncate">{resolveClientName(primary?.id || ln.clientId)}</div>
                      </div>
                    )}
                    <div className="sm:col-span-4">
                      <Select value={ln.methodId || ''} onValueChange={(v) => setPaymentLines(prev => prev.map(x => {
                        if (x.id !== ln.id) return x;
                        const fin = getMethod(v);
                        const pct = Number(fin?.taxa_percentual || 0);
                        if (pct > 0) {
                          const base = lineBase(x);
                          const totalWithFee = base * (1 + pct/100);
                          return { ...x, methodId: v, chargeFee: true, value: formatBRL(totalWithFee) };
                        } else {
                          const base = lineBase(x);
                          return { ...x, methodId: v, chargeFee: false, value: formatBRL(base) };
                        }
                      }))}>
                        <SelectTrigger className="w-full h-9 truncate"><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
                        <SelectContent>
                          {(payMethods || []).map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const pct = linePct(ln);
                        if (!pct) return null;
                        const fee = lineFee(ln);
                        const active = !!ln.chargeFee;
                        return (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => setPaymentLines(prev => prev.map(x => {
                                if (x.id !== ln.id) return x;
                                const base = lineBase(x);
                                if (!active) {
                                  const totalWithFee = base * (1 + pct/100);
                                  return { ...x, chargeFee: true, value: formatBRL(totalWithFee) };
                                }
                                return { ...x, chargeFee: false, value: formatBRL(base) };
                              }))}
                              className={[
                                "inline-flex items-center gap-2 px-3 py-1 rounded-sm text-xs font-medium border transition-colors",
                                active ? "bg-black text-amber-400 border-amber-500" : "bg-surface text-text-secondary border-border hover:border-border-hover"
                              ].join(' ')}
                              title={active ? 'Desmarcar taxa' : 'Cobrar taxa'}
                            >
                              <span className={["inline-block h-3 w-3 rounded-sm border",
                                active ? "bg-amber-500 border-amber-400" : "bg-transparent border-border"].join(' ')} />
                              <span>Taxa R$ {fee.toFixed(2)}</span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        placeholder="0,00"
                        inputMode="numeric"
                        value={ln.value}
                        className="h-9"
                        onChange={(e) => {
                          const digits = (e.target.value || '').replace(/\D/g, '');
                          const cents = digits ? Number(digits) / 100 : 0;
                          const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
                          setPaymentLines(prev => prev.map(x => x.id === ln.id ? { ...x, value: formatted } : x));
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                          if (allowed.includes(e.key)) return;
                          if (!/^[0-9]$/.test(e.key)) { e.preventDefault(); }
                        }}
                        onBeforeInput={(e) => { const data = e.data ?? ''; if (data && /\D/.test(data)) e.preventDefault(); }}
                      />
                    </div>
                  </div>
                </div>
                );
              })}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPaymentLines(prev => {
                      const hasSelected = Array.isArray(selectedClientIds) && selectedClientIds.length > 0;
                      const pool = hasSelected ? selectedClientIds : (payClients || []).map(c => c.id);
                      const used = new Set(prev.map(x => x.clientId).filter(Boolean));
                      const candidates = (pool || []).filter(id => !used.has(id));
                      const clientPick = candidates[0] || pool[0] || '';
                      const defMethod = (payMethods[0]?.id || '');
                      const fin = getMethod(defMethod);
                      const hasPct = Number(fin?.taxa_percentual || 0) > 0;
                      const newLines = [...prev, { id: nextPayLineId, clientId: clientPick, methodId: defMethod, value: '', chargeFee: hasPct }];
                      // Distribuir BASE
                      const subtotal = (items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0);
                            const tipo = comandaDiscount?.tipo; const val = Number(comandaDiscount?.valor || 0);
                            let descCmd = 0; if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100); else if (tipo === 'fixo' && val > 0) descCmd = val;
                            const totalBase = Math.max(0, subtotal - descCmd);
                      const basePer = Math.floor((totalBase / newLines.length) * 100) / 100;
                      const baseRemainder = totalBase - (basePer * newLines.length);
                      return newLines.map((line, idx) => {
                        const base = idx === newLines.length - 1 ? basePer + baseRemainder : basePer;
                        return lineWithBase(line, base);
                      });
                    });
                    setNextPayLineId((n) => n + 1);
                  }}
                >
                  Adicionar forma
                </Button>
              </div>
              {(() => {
                const somaExibida = sumPayments();
                const feeSum = sumFees();
                const subtotal = (items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0);
                const tipo = comandaDiscount?.tipo; const val = Number(comandaDiscount?.valor || 0);
                let descCmd = 0; if (tipo === 'percentual' && val > 0) descCmd = subtotal * (val/100); else if (tipo === 'fixo' && val > 0) descCmd = val;
                const totalBase = Math.max(0, subtotal - descCmd);
                const esperado = Math.max(0, totalBase + feeSum);
                let restante = esperado - somaExibida;
                let troco = 0;
                if (restante < 0) {
                  troco = Math.abs(restante);
                  restante = 0;
                }
                return (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                      <span>Total a pagar</span>
                      <span>R$ {esperado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-text-secondary">Pagamentos</span>
                      <span>R$ {somaExibida.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Restante</span>
                      <span className={Math.abs(restante) < 0.005 ? 'text-success' : 'text-warning'}>R$ {restante.toFixed(2)}</span>
                    </div>
                    {troco > 0 && (
                      <div className="flex justify-between font-semibold text-text-secondary">
                        <span>Troco</span>
                        <span>R$ {troco.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/75 border-t border-border">
            <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={payLoading}>Cancelar</Button>
            <Button onClick={confirmPay} disabled={payLoading}>{payLoading ? 'Processando...' : 'Confirmar Pagamento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isDiscountOpen && (
        <DescontoComandaDialog
          comanda={{ id: comandaId, desconto_tipo: comandaDiscount?.tipo, desconto_valor: Number(comandaDiscount?.valor || 0), desconto_motivo: comandaDiscount?.motivo || '' }}
          subtotal={(items || []).reduce((acc, it) => acc + Number(it.quantity||0)*Number(it.price||0), 0)}
          onApply={async () => {
            try {
              const { data } = await supabase
                .from('comandas')
                .select('desconto_tipo, desconto_valor, desconto_motivo')
                .eq('id', comandaId)
                .single();
              setComandaDiscount({ tipo: data?.desconto_tipo || null, valor: Number(data?.desconto_valor || 0), motivo: data?.desconto_motivo || '' });
            } catch {}
            setIsDiscountOpen(false);
          }}
          onClose={() => setIsDiscountOpen(false)}
          codigoEmpresa={userProfile?.codigo_empresa}
        />
      )}

      {/* Wizard de Cliente: obrigatório antes de vender */}
      <Dialog open={isClientWizardOpen} onOpenChange={(open) => setIsClientWizardOpen(open)}>
        <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()} onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Identificar Cliente</DialogTitle>
            <DialogDescription>Selecione um cliente cadastrado para esta venda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="w-full">
              <Label className="mb-1 block">Buscar cliente</Label>
              <div className="flex items-center gap-2 justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input placeholder="Nome, e-mail, telefone ou código" className="pl-9" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
                </div>
                <Button type="button" size="icon" title="Cadastrar cliente" className="ml-2 bg-brand text-black hover:bg-brand/90 border border-brand" onClick={() => { window.location.href = '/clientes'; }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 max-h-48 overflow-auto border rounded-md thin-scroll">
                <ul>
                  {(clients || []).map(c => {
                    const isSelected = (selectedClientIds || []).includes(c.id);
                    return (
                      <li
                        key={c.id}
                        className={`p-2 flex items-center justify-between cursor-pointer hover:bg-surface-2 ${c?.codigo === 0 ? 'bg-warning/10 border-l-4 border-warning' : ''} ${isSelected ? 'bg-surface-2' : ''}`}
                        onClick={() => {
                          setSelectedClientIds(prev => {
                            const set = new Set(prev || []);
                            if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
                            const arr = Array.from(set);
                            try { localStorage.setItem(LS_KEY.pendingClientIds, JSON.stringify(arr)); } catch {}
                            return arr;
                          });
                        }}
                      >
                        <div>
                          <div className="font-medium">
                            {(c.codigo != null ? String(c.codigo) + ' - ' : '')}{c.nome}
                            {c?.codigo === 0 && <span className="ml-2 text-xs text-warning">(Padrão)</span>}
                          </div>
                        </div>
                        <CheckCircle size={16} className={isSelected ? 'text-success' : 'text-text-muted opacity-40'} />
                      </li>
                    );
                  })}
                  {(!clients || clients.length === 0) && (
                    <li className="p-2 text-sm text-text-muted">Nenhum cliente encontrado.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClientWizardOpen(false)}>Fechar</Button>
            <Button onClick={async () => {
              try {
                const ids = Array.from(new Set(selectedClientIds || []));
                if (ids.length === 0) { toast({ title: 'Selecione pelo menos um cliente', variant: 'warning' }); return; }
                const codigoEmpresa = userProfile?.codigo_empresa;
                if (!comandaId) {
                  // Não existe comanda ainda: criar/obter comanda de balcão e já vincular clientes
                  if (!codigoEmpresa) {
                    toast({ title: 'Empresa não definida', variant: 'destructive' });
                    return;
                  }
                  try {
                    setSaleOpening(true);
                    const c = await getOrCreateComandaBalcao({ codigoEmpresa });
                    if (!c?.id) {
                      toast({ title: 'Falha ao abrir venda', description: 'Não foi possível criar a comanda.', variant: 'destructive' });
                      return;
                    }
                    const cid = c.id;
                    await adicionarClientesAComanda({ comandaId: cid, clienteIds: ids, nomesLivres: [], codigoEmpresa, replace: true });
                    setComandaId(cid);
                    // Nome do cliente na UI
                    const nomesEscolhidos = (clients || [])
                      .filter(x => ids.includes(x.id))
                      .map(x => x?.nome)
                      .filter(Boolean);
                    const nomeFinal = nomesEscolhidos.length ? nomesEscolhidos.join(', ') : '';
                    setCustomerName(nomeFinal);
                    setClientChosen(true);
                    // Atualizar cache principal da comanda
                    try {
                      localStorage.setItem(LS_KEY.comandaId, String(cid));
                      localStorage.setItem(LS_KEY.customerName, nomeFinal || '');
                      localStorage.setItem(LS_KEY.clientChosen, 'true');
                      localStorage.removeItem(LS_KEY.pendingClientIds);
                    } catch {}
                    // Garantir itens sincronizados (caso já existam de uso anterior)
                    try { await refetchItemsAndCustomer(cid, 2); } catch {}
                    setIsClientWizardOpen(false);
                  } catch (err) {
                    console.error('[ClientWizard] Erro ao criar comanda de balcão:', err);
                    toast({ title: 'Falha ao iniciar venda', description: err?.message || 'Tente novamente.', variant: 'destructive' });
                    return;
                  } finally {
                    setSaleOpening(false);
                  }
                } else {
                  // Validar que a comanda existe antes de adicionar clientes
                  try {
                    const { data: checkComanda, error: checkError } = await supabase
                      .from('comandas')
                      .select('id')
                      .eq('id', comandaId)
                      .eq('codigo_empresa', codigoEmpresa)
                      .single();
                    
                    if (checkError || !checkComanda) {
                      console.error('[ClientWizard] Comanda não encontrada:', comandaId);
                      toast({ title: 'Comanda inválida', description: 'A comanda não existe mais. Reiniciando...', variant: 'warning' });
                      
                      // Limpar cache e estado
                      setComandaId(null);
                      setItems([]);
                      setClientChosen(false);
                      setCustomerName('');
                      try {
                        localStorage.removeItem(LS_KEY.comandaId);
                        localStorage.removeItem(LS_KEY.items);
                        localStorage.removeItem(LS_KEY.customerName);
                        localStorage.removeItem(LS_KEY.clientChosen);
                      } catch {}
                      
                      setIsClientWizardOpen(false);
                      return;
                    }
                  } catch (validationError) {
                    console.error('[ClientWizard] Erro ao validar comanda:', validationError);
                    toast({ title: 'Erro de validação', variant: 'destructive' });
                    return;
                  }
                  
                  try {
                    await adicionarClientesAComanda({ comandaId, clienteIds: ids, nomesLivres: [], codigoEmpresa, replace: true });
                  } catch (error) {
                    // Se erro de foreign key, limpar cache
                    if (error?.message?.includes('violates foreign key')) {
                      console.error('[ClientWizard] Foreign key error, limpando cache:', error);
                      setComandaId(null);
                      setItems([]);
                      try {
                        localStorage.removeItem(LS_KEY.comandaId);
                        localStorage.removeItem(LS_KEY.items);
                      } catch {}
                      toast({ title: 'Comanda inválida', description: 'Reinicie a venda.', variant: 'destructive' });
                      setIsClientWizardOpen(false);
                      return;
                    }
                    // Ignora erro de duplicata
                    if (!error?.message?.includes('duplicate')) {
                      throw error;
                    }
                  }
                  const vincs = await listarClientesDaComanda({ comandaId, codigoEmpresa });
                  const nomes = (vincs || []).map(v => v?.nome).filter(Boolean);
                  setCustomerName(nomes.length ? nomes.join(', ') : '');
                  setClientChosen(true);
                  setIsClientWizardOpen(false);
                }
                if (pendingProduct) {
                  const p = pendingProduct; setPendingProduct(null);
                  await addProduct(p, { skipClientCheck: true });
                }
              } catch (e) {
                toast({ title: 'Falha ao iniciar venda', description: e?.message || 'Tente novamente', variant: 'destructive' });
              }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Item da Comanda */}
      <Dialog open={!!selectedCommandItem} onOpenChange={(open) => !open && setSelectedCommandItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          {selectedCommandItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedCommandItem.name}</DialogTitle>
                <DialogDescription className="text-sm">Detalhes do item</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Preço Unitário</p>
                    <p className="text-lg font-bold">R$ {Number(selectedCommandItem.price).toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Quantidade</p>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 p-0" 
                        onClick={async (e) => {
                          e.stopPropagation();
                          const codigoEmpresa = userProfile?.codigo_empresa;
                          if (!codigoEmpresa) { 
                            toast({ title: 'Empresa não definida', variant: 'destructive' }); 
                            return; 
                          }
                          const next = Math.max(0, selectedCommandItem.quantity - 1);
                          try {
                            if (next <= 0) {
                              await removerItem({ itemId: selectedCommandItem.id, codigoEmpresa });
                              setSelectedCommandItem(null);
                            } else {
                              await atualizarQuantidadeItem({ 
                                itemId: selectedCommandItem.id, 
                                quantidade: next, 
                                codigoEmpresa 
                              });
                              setSelectedCommandItem({
                                ...selectedCommandItem,
                                quantity: next
                              });
                            }
                            // Atualiza a lista de itens
                            const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
                            setItems((itens || []).map((n) => ({ 
                              id: n.id, 
                              productId: n.produto_id, 
                              name: n.descricao || 'Item', 
                              price: Number(n.preco_unitario || 0), 
                              quantity: Number(n.quantidade || 1) 
                            })));
                          } catch (err) {
                            toast({ 
                              title: 'Erro ao atualizar quantidade', 
                              description: err?.message || 'Tente novamente', 
                              variant: 'destructive' 
                            });
                          }
                        }}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-semibold">
                        {selectedCommandItem.quantity}
                      </span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 p-0"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const codigoEmpresa = userProfile?.codigo_empresa;
                          if (!codigoEmpresa) { 
                            toast({ title: 'Empresa não definida', variant: 'destructive' }); 
                            return; 
                          }
                          const next = selectedCommandItem.quantity + 1;
                          try {
                            await atualizarQuantidadeItem({ 
                              itemId: selectedCommandItem.id, 
                              quantidade: next, 
                              codigoEmpresa 
                            });
                            setSelectedCommandItem({
                              ...selectedCommandItem,
                              quantity: next
                            });
                            // Atualiza a lista de itens
                            const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
                            setItems((itens || []).map((n) => ({ 
                              id: n.id, 
                              productId: n.produto_id, 
                              name: n.descricao || 'Item', 
                              price: Number(n.preco_unitario || 0), 
                              quantity: Number(n.quantidade || 1) 
                            })));
                          } catch (err) {
                            toast({ 
                              title: 'Erro ao atualizar quantidade', 
                              description: err?.message || 'Tente novamente', 
                              variant: 'destructive' 
                            });
                          }
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Subtotal</p>
                  <p className="text-lg font-bold">
                    R$ {(selectedCommandItem.quantity * selectedCommandItem.price).toFixed(2)}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="destructive"
                  onClick={async () => {
                    try {
                      const codigoEmpresa = userProfile?.codigo_empresa;
                      if (!codigoEmpresa) { 
                        toast({ title: 'Empresa não definida', variant: 'destructive' }); 
                        return; 
                      }
                      await removerItem({ 
                        itemId: selectedCommandItem.id, 
                        codigoEmpresa 
                      });
                      // Atualiza a lista de itens
                      const itens = await listarItensDaComanda({ comandaId, codigoEmpresa });
                      setItems((itens || []).map((n) => ({ 
                        id: n.id, 
                        productId: n.produto_id, 
                        name: n.descricao || 'Item', 
                        price: Number(n.preco_unitario || 0), 
                        quantity: Number(n.quantidade || 1) 
                      })));
                      setSelectedCommandItem(null);
                      toast({ title: 'Item removido', variant: 'success' });
                    } catch (err) {
                      toast({ 
                        title: 'Falha ao remover item', 
                        description: err?.message || 'Tente novamente', 
                        variant: 'destructive' 
                      });
                    }
                  }}
                >
                  Remover Item
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Mobile warning banner */}
      {mobileWarnOpen && (
        <div className="fixed left-3 right-3 z-[9999] md:hidden" role="alert" aria-live="assertive" style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="pointer-events-none flex items-start gap-2 rounded-md border border-amber-500 bg-amber-400 text-black px-3 py-2 shadow-lg">
            <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
            <div className="text-sm font-semibold leading-snug drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">{mobileWarnMsg || 'Atenção'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Banner de aviso mobile fixo
// Renderizar após o componente principal para ficar acima do conteúdo
