import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useLocation } from 'react-router-dom';

const AlertsContext = createContext();

export const AlertsProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const location = useLocation();
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBalloon, setShowBalloon] = useState(false);
  const [loading, setLoading] = useState(false);
  const previousPathnameRef = useRef(location.pathname);
  const balloonShownOnceRef = useRef(false);
  const balloonTimerRef = useRef(null);
  const [eventBalloon, setEventBalloon] = useState(null); // Notificação transitória (ex.: eventos da Ísis)
  const alertsRef = useRef([]);
  const balloonWaitRef = useRef(null);
  const previewDisabledRef = useRef(false); // Desativa prévia após usuário abrir o modal
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
  
  // Helpers de persistência (somente alertas da Ísis) por empresa
  const getIsisStorageKey = useCallback(() => {
    const codigo = userProfile?.codigo_empresa || 'na';
    return `alerts:persisted:isis:${codigo}`;
  }, [userProfile?.codigo_empresa]);
  
  const readPersistedIsisAlerts = useCallback(() => {
    try {
      const raw = localStorage.getItem(getIsisStorageKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(a => a && a.tipo === 'isis-event' && a.id) : [];
    } catch { return []; }
  }, [getIsisStorageKey]);
  
  const writePersistedIsisAlerts = useCallback((list) => {
    try { localStorage.setItem(getIsisStorageKey(), JSON.stringify(list || [])); } catch {}
  }, [getIsisStorageKey]);
  
  const dismissAlert = useCallback((id) => {
    if (!id) return;
    setAlerts(prev => (Array.isArray(prev) ? prev.filter(a => a?.id !== id) : []));
    const persisted = readPersistedIsisAlerts();
    const next = persisted.filter(a => a?.id !== id);
    writePersistedIsisAlerts(next);
  }, [readPersistedIsisAlerts, writePersistedIsisAlerts]);
  
  // Função para verificar se há modais abertos (evita recarregar alertas durante interações)
  const hasOpenModals = useCallback(() => {
    // Verifica se há algum dialog/modal aberto no DOM
    const dialogs = document.querySelectorAll('[role="dialog"]');
    return dialogs.length > 0;
  }, []);

  // Função para carregar alertas
  const loadAlerts = useCallback(async () => {
    if (!userProfile?.codigo_empresa) return;
    
    try {
      setLoading(true);
      const codigo = userProfile.codigo_empresa;
      const hoje = new Date();
      const inicioHoje = startOfDay(hoje).toISOString();
      const fimHoje = endOfDay(hoje).toISOString();
      const alertasList = [];
      
      // 1. Produtos com estoque baixo
      const { data: produtosBaixoEstoque } = await supabase
        .from('produtos')
        .select('nome, estoque, estoque_minimo, status')
        .eq('codigo_empresa', codigo)
        .not('estoque_minimo', 'is', null);
      
      const produtosCriticos = (produtosBaixoEstoque || []).filter(p => {
        const qtd = Number(p.estoque || 0);
        const min = Number(p.estoque_minimo || 0);
        return qtd <= min && min > 0;
      });
      
      if (produtosCriticos.length > 0) {
        alertasList.push({
          tipo: 'estoque',
          icone: 'Package',
          cor: 'danger',
          mensagem: `${produtosCriticos.length} produto${produtosCriticos.length > 1 ? 's' : ''} com estoque baixo`,
          link: '/produtos'
        });
      }
      
      // 2. Pagamentos pendentes em agendamentos (incluindo passados)
      // Buscar todos os participantes pendentes
      const { data: participantesPendentes } = await supabase
        .from('agendamento_participantes')
        .select('id, agendamento_id')
        .eq('codigo_empresa', codigo)
        .eq('status_pagamento', 'Pendente');
      
      if (participantesPendentes && participantesPendentes.length > 0) {
        // Buscar TODOS os agendamentos com pagamento pendente
        // Excluindo agendamentos cancelados ou ausentes
        const agendamentoIds = [...new Set(participantesPendentes.map(p => p.agendamento_id))];
        const { data: agendamentos } = await supabase
          .from('agendamentos')
          .select('id, inicio, status')
          .in('id', agendamentoIds)
          .not('status', 'in', '(canceled,absent)')
          .order('inicio', { ascending: true });
        
        // Filtrar participantes apenas dos agendamentos válidos (não cancelados/ausentes)
        const agendamentosValidosIds = new Set((agendamentos || []).map(a => a.id));
        const participantesValidos = participantesPendentes.filter(p => 
          agendamentosValidosIds.has(p.agendamento_id)
        );
        
        // Só mostrar alerta se houver participantes pendentes em agendamentos válidos
        if (participantesValidos.length > 0) {
          // Pegar a data do primeiro agendamento com pendência
          const primeiroAgendamento = agendamentos?.[0];
          const dataAgendamento = primeiroAgendamento 
            ? format(new Date(primeiroAgendamento.inicio), 'yyyy-MM-dd')
            : format(hoje, 'yyyy-MM-dd');
          
          alertasList.push({
            tipo: 'pagamento',
            icone: 'DollarSign',
            cor: 'warning',
            mensagem: `${participantesValidos.length} pagamento${participantesValidos.length > 1 ? 's' : ''} pendente${participantesValidos.length > 1 ? 's' : ''} em agendamentos`,
            link: `/agenda?date=${dataAgendamento}`
          });
        }
      }
      
      // 3. Comandas abertas há muito tempo (> 3 horas)
      const tres_horas_atras = new Date();
      tres_horas_atras.setHours(tres_horas_atras.getHours() - 3);
      const { data: comandasAntigas } = await supabase
        .from('comandas')
        .select('id, aberto_em, status')
        .eq('codigo_empresa', codigo)
        .eq('status', 'open')
        .is('fechado_em', null)
        .lte('aberto_em', tres_horas_atras.toISOString());
      
      if (comandasAntigas && comandasAntigas.length > 0) {
        alertasList.push({
          tipo: 'comanda',
          icone: 'Clock',
          cor: 'warning',
          mensagem: `${comandasAntigas.length} comanda${comandasAntigas.length > 1 ? 's' : ''} aberta${comandasAntigas.length > 1 ? 's' : ''} há mais de 3 horas`,
          link: '/vendas'
        });
      }
      
      // 4. Caixa aberto há muito tempo (> 12 horas)
      const doze_horas_atras = new Date();
      doze_horas_atras.setHours(doze_horas_atras.getHours() - 12);
      const { data: caixaAberto } = await supabase
        .from('caixa_sessoes')
        .select('id, aberto_em')
        .eq('codigo_empresa', codigo)
        .eq('status', 'open')
        .lte('aberto_em', doze_horas_atras.toISOString())
        .limit(1);
      
      if (caixaAberto && caixaAberto.length > 0) {
        alertasList.push({
          tipo: 'caixa',
          icone: 'ShoppingCart',
          cor: 'danger',
          mensagem: 'Caixa aberto há mais de 12 horas',
          link: '/vendas'
        });
      }
      
      // 5. Mesas com saldo alto aguardando pagamento (> R$ 100)
      const { data: mesasAguardando } = await supabase
        .from('mesas')
        .select('id, nome, numero')
        .eq('codigo_empresa', codigo)
        .eq('status', 'awaiting-payment');
      
      if (mesasAguardando && mesasAguardando.length > 0) {
        const mesaIds = mesasAguardando.map(m => m.id);
        const { data: comandasMesas } = await supabase
          .from('comandas')
          .select('id, mesa_id')
          .eq('codigo_empresa', codigo)
          .in('mesa_id', mesaIds)
          .eq('status', 'open');
        
        if (comandasMesas && comandasMesas.length > 0) {
          const comandaIds = comandasMesas.map(c => c.id);
          const { data: itensComandas } = await supabase
            .from('comanda_itens')
            .select('comanda_id, quantidade, preco_unitario, desconto')
            .in('comanda_id', comandaIds);
          
          const totaisPorComanda = {};
          (itensComandas || []).forEach(item => {
            const subtotal = (Number(item.quantidade) || 0) * (Number(item.preco_unitario) || 0);
            const desconto = Number(item.desconto) || 0;
            const total = subtotal - desconto;
            totaisPorComanda[item.comanda_id] = (totaisPorComanda[item.comanda_id] || 0) + total;
          });
          
          const mesasComSaldoAlto = Object.values(totaisPorComanda).filter(t => t > 100).length;
          
          if (mesasComSaldoAlto > 0) {
            alertasList.push({
              tipo: 'mesa',
              icone: 'Store',
              cor: 'info',
              mensagem: `${mesasComSaldoAlto} mesa${mesasComSaldoAlto > 1 ? 's' : ''} com saldo alto aguardando pagamento`,
              link: '/vendas'
            });
          }
        }
      }
      
      // 6. Aniversariantes do dia
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome, aniversario')
        .eq('codigo_empresa', codigo)
        .eq('status', 'Ativo')
        .not('aniversario', 'is', null);
      
      const hojeDiaMes = format(hoje, 'MM-dd');
      const aniversariantesHoje = (clientes || []).filter(c => {
        if (!c.aniversario) return false;
        const nascDiaMes = format(new Date(c.aniversario), 'MM-dd');
        return nascDiaMes === hojeDiaMes;
      });
      
      if (aniversariantesHoje.length > 0) {
        alertasList.push({
          tipo: 'aniversario',
          icone: 'Users',
          cor: 'success',
          mensagem: `🎂 ${aniversariantesHoje.length} aniversariante${aniversariantesHoje.length > 1 ? 's' : ''} hoje!`,
          link: '/clientes'
        });
      }
      
      // 7. Aniversariantes da semana
      const proximos7Dias = [];
      for (let i = 1; i <= 7; i++) {
        const dia = new Date(hoje);
        dia.setDate(dia.getDate() + i);
        proximos7Dias.push(format(dia, 'MM-dd'));
      }
      
      const aniversariantesSemana = (clientes || []).filter(c => {
        if (!c.aniversario) return false;
        const nascDiaMes = format(new Date(c.aniversario), 'MM-dd');
        return proximos7Dias.includes(nascDiaMes);
      });
      
      if (aniversariantesSemana.length > 0) {
        alertasList.push({
          tipo: 'aniversario-semana',
          icone: 'CalendarPlus',
          cor: 'purple',
          mensagem: `🎉 ${aniversariantesSemana.length} aniversariante${aniversariantesSemana.length > 1 ? 's' : ''} esta semana`,
          link: '/clientes'
        });
      }
      
      // Carregar alertas da Ísis persistidos (até o usuário clicar) e mesclar
      const persistedIsisAlerts = readPersistedIsisAlerts();
      setAlerts([...persistedIsisAlerts, ...alertasList]);

      // Exibir balão inicial com os 3 primeiros alertas apenas uma vez por carregamento
      // (mostra novamente em recarregamento da página), somente quando a aba estiver visível
      // e sem outros modais abertos
      try {
        const canShow = !balloonShownOnceRef.current && !previewDisabledRef.current && alertasList.length > 0 && typeof document !== 'undefined' && document.visibilityState === 'visible' && !hasOpenModals();
        if (canShow) {
          const isMobile = (() => { try { return typeof window !== 'undefined' && window.innerWidth < 768; } catch { return false; }})();
          const mobileSidebarOpen = (() => { try { return !!document.querySelector('button[aria-label="Fechar menu lateral"]'); } catch { return false; }})();
          if (isMobile && mobileSidebarOpen) {
            try { if (balloonWaitRef.current) clearInterval(balloonWaitRef.current); } catch {}
            balloonWaitRef.current = setInterval(() => {
              try {
                if (balloonShownOnceRef.current) { clearInterval(balloonWaitRef.current); balloonWaitRef.current = null; return; }
                const overlayOpen = !!document.querySelector('button[aria-label="Fechar menu lateral"]');
                if (!overlayOpen && !hasOpenModals()) {
                  setShowBalloon(true);
                  balloonShownOnceRef.current = true;
                  try { if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current); } catch {}
                  balloonTimerRef.current = setTimeout(() => { setShowBalloon(false); }, 3500);
                  clearInterval(balloonWaitRef.current);
                  balloonWaitRef.current = null;
                }
              } catch {}
            }, 250);
          } else {
            setTimeout(() => {
              if (balloonShownOnceRef.current) return;
              if (hasOpenModals()) { balloonShownOnceRef.current = true; return; }
              setShowBalloon(true);
              balloonShownOnceRef.current = true;
              try { if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current); } catch {}
              balloonTimerRef.current = setTimeout(() => { setShowBalloon(false); }, 3500);
            }, 350);
          }
        }
      } catch {}
    } catch (error) {
      console.error('[AlertsContext] Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.codigo_empresa]);

  // Se o usuário abrir o modal de alertas, suprime a abertura do balão de preview nesta carga
  useEffect(() => {
    if (showModal) {
      // Ao abrir o modal, nunca mais mostrar a prévia neste carregamento
      balloonShownOnceRef.current = true;
      previewDisabledRef.current = true;
      setShowBalloon(false);
      try { if (balloonWaitRef.current) { clearInterval(balloonWaitRef.current); balloonWaitRef.current = null; } } catch {}
    } else {
      // Ao fechar modal, garantir que o balão permaneça fechado
      setShowBalloon(false);
    }
  }, [showModal]);

  // Cleanup do timer ao desmontar
  useEffect(() => {
    return () => {
      try { if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current); } catch {}
      try { if (balloonWaitRef.current) clearInterval(balloonWaitRef.current); } catch {}
    };
  }, []);

  // Fechar e limpar qualquer balão ativo (preview ou evento)
  const closeBalloon = useCallback(() => {
    try { if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current); } catch {}
    setShowBalloon(false);
    setEventBalloon(null);
  }, []);

  const clearIsisAlerts = useCallback(() => {
    // Limpa apenas alertas da Ísis (tipo 'isis-event'), mantendo os demais
    setAlerts(prev => (Array.isArray(prev) ? prev.filter(a => a?.tipo !== 'isis-event') : []));
    try { writePersistedIsisAlerts([]); } catch {}
    try { closeBalloon(); } catch {}
  }, [writePersistedIsisAlerts, closeBalloon]);

  // Realtime: escuta criação/cancelamento via Ísis e abre um balão de notificação
  useEffect(() => {
    if (!userProfile?.codigo_empresa) return;
    const codigo = userProfile.codigo_empresa;

    const channel = supabase
      .channel(`isis-events:${codigo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `codigo_empresa=eq.${codigo}` }, (payload) => {
        try {
          const { eventType, new: novo, old: antigo } = payload || {};
          const row = novo || antigo;
          if (!row) return;
          // Considerar apenas eventos realmente relacionados à Ísis:
          // - criação feita pela Ísis (created_by_isis = true)
          // - cancelamento feito pela Ísis (canceled_by = 'isis')
          const createdByIsis = (novo?.created_by_isis === true) || (antigo?.created_by_isis === true);
          const canceledByIsis = (novo?.canceled_by === 'isis') || (antigo?.canceled_by === 'isis');
          if (!createdByIsis && !canceledByIsis) return;

          // Não abrir sobre modais existentes para evitar atrito (mesma política do preview)
          if (hasOpenModals()) return;

          const dtIso = (novo?.inicio || antigo?.inicio);
          let link = '';
          try {
            if (dtIso) {
              const yyyy = new Date(dtIso);
              const dateStr = `${yyyy.getFullYear()}-${String(yyyy.getMonth()+1).padStart(2,'0')}-${String(yyyy.getDate()).padStart(2,'0')}`;
              link = `/agenda?date=${dateStr}`;
            }
          } catch {}

          let message = '';
          if (eventType === 'INSERT') {
            // Mostrar criação apenas se foi criada pela Ísis
            if (!createdByIsis) return;
            message = 'Ísis criou um agendamento';
          } else if (eventType === 'UPDATE') {
            // Mostrar cancelamento pela Ísis somente quando novo.status=canceled E canceled_by='isis'
            if (antigo?.status !== 'canceled' && novo?.status === 'canceled' && novo?.canceled_by === 'isis') {
              message = 'Ísis cancelou um agendamento';
            } else {
              return; // ignorar demais updates
            }
          } else if (eventType === 'DELETE') {
            // Só atribuir à Ísis se o registro antigo indicar canceled_by='isis'
            if (antigo?.canceled_by === 'isis') {
              message = 'Ísis cancelou um agendamento';
            } else {
              return; // não atribuir cancelamento à Ísis
            }
          } else {
            // Ignorar outras atualizações
            return;
          }

          // Criar alerta persistente (com id) e armazenar
          const id = `isis-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          const novoAlerta = {
            id,
            tipo: 'isis-event',
            icone: 'AlertTriangle',
            cor: 'warning',
            mensagem: message,
            link: '/isis/analytics',
            createdAt: new Date().toISOString(),
          };
          // Atualiza estado e persistência
          setAlerts((prev) => [novoAlerta, ...(Array.isArray(prev) ? prev : [])]);
          try {
            const persisted = readPersistedIsisAlerts();
            // Deduplicar por id
            const combined = [novoAlerta, ...persisted.filter(a => a.id !== id)];
            writePersistedIsisAlerts(combined);
          } catch {}

          // Balão transitório (inclui id para permitir descartar ao clicar)
          setEventBalloon({ id, message, link });
          setShowBalloon(true);
          try { if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current); } catch {}
          balloonTimerRef.current = setTimeout(() => {
            closeBalloon();
          }, 5000);

          // Persistir também nos alertas para consulta posterior via sino
          try {
            setAlerts((prev) => {
              // Já inserido acima (com id). Apenas retorna estado atual (prev)
              return Array.isArray(prev) ? prev : [];
            });
          } catch {}
        } catch (e) {
          console.warn('[AlertsContext] erro ao processar evento isis:', e);
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [userProfile?.codigo_empresa, hasOpenModals, closeBalloon]);

  // Carregar alertas quando o usuário estiver autenticado
  useEffect(() => {
    if (userProfile?.codigo_empresa) {
      loadAlerts();
      
      // Recarregar alertas a cada 5 minutos
      const interval = setInterval(() => {
        loadAlerts();
      }, 5 * 60 * 1000); // 5 minutos
      
      return () => clearInterval(interval);
    }
  }, [userProfile?.codigo_empresa, loadAlerts]);

  // Recarregar alertas quando a aba voltar a ficar visível ou ganhar foco
  useEffect(() => {
    if (!userProfile?.codigo_empresa) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Não recarregar se há modais abertos
        if (hasOpenModals()) {
          return;
        }
        loadAlerts();
      }
    };
    
    const handleFocus = () => {
      // Não recarregar se há modais abertos
      if (hasOpenModals()) {
        return;
      }
      loadAlerts();
    };

    // Listener para mudança de visibilidade da aba
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listener para quando a janela ganha foco
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userProfile?.codigo_empresa, loadAlerts, hasOpenModals]);

  // Recarregar alertas quando mudar de rota (página) na aplicação
  useEffect(() => {
    if (userProfile?.codigo_empresa) {
      // Verificar se o pathname realmente mudou (ignora mudanças de query params)
      if (previousPathnameRef.current === location.pathname) {
        return;
      }
      
      // Atualizar pathname anterior
      previousPathnameRef.current = location.pathname;
      
      // Não recarregar se há modais abertos
      if (hasOpenModals()) {
        console.log('[AlertsContext] Mudança de rota detectada, mas há modais abertos - ignorando recarga');
        return;
      }
      console.log('[AlertsContext] Mudança de rota detectada - recarregando alertas');
      loadAlerts();
    }
  }, [location.pathname, userProfile?.codigo_empresa, loadAlerts, hasOpenModals]);

  return (
    <AlertsContext.Provider value={{ 
      alerts, 
      setAlerts, 
      showModal, 
      setShowModal,
      showBalloon,
      setShowBalloon,
      eventBalloon,
      setEventBalloon,
      closeBalloon,
      dismissAlert,
      clearIsisAlerts,
      loading,
      loadAlerts
    }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertsProvider');
  }
  return context;
};
