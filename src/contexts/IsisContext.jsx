import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const IsisContext = createContext();

export const useIsis = () => {
  const context = useContext(IsisContext);
  if (!context) {
    throw new Error('useIsis deve ser usado dentro de IsisProvider');
  }
  return context;
};

export const IsisProvider = ({ children }) => {
  // Estado atual do fluxo
  const [currentStep, setCurrentStep] = useState('greeting'); // greeting, quadra, data, horario, modalidade, quantidade, nomes, contato, review, confirmation, avaliacao
  
  // Histórico de mensagens do chat
  const [messages, setMessages] = useState([]);
  // ID da sessão persistida (isis_chat_sessions.id)
  const [sessionId, setSessionId] = useState(null);
  
  // Seleções do usuário
  const [selections, setSelections] = useState({
    empresa: null,        // Dados da empresa
    quadra: null,         // Quadra selecionada
    data: null,           // Date object
    horario: null,        // { inicio: '18:00', fim: '19:00', inicioDate, fimDate }
    modalidade: null,     // String
    quantidade: null,     // Number
    nomes: [],           // Array de strings
    contato: {
      nome: '',
      telefone: ''
    }
  });
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  // Referência para scroll automático
  const chatEndRef = useRef(null);

  // Garante uma sessão persistida no banco (cria se não existir)
  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    try {
      const empresaCodigo = (selections?.empresa?.codigo_empresa ?? selections?.empresa?.codigoEmpresa ?? null) || null;
      const clienteId = selections?.cliente?.id ?? null;
      const payload = {
        empresa_codigo: empresaCodigo,
        cliente_id: clienteId,
        started_at: new Date().toISOString(),
        source: 'isis',
      };
      const { data, error } = await supabase
        .from('isis_chat_sessions')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      setSessionId(data.id);
      return data.id;
    } catch (_) {
      return null; // segue sem persistir se não houver tabela/erro
    }
  }, [sessionId, selections?.empresa?.codigo_empresa, selections?.empresa?.codigoEmpresa, selections?.cliente?.id]);

  // Atualiza sessão com cliente/empresa se ainda não setados (quando identificação acontece depois)
  const tryUpdateSessionMeta = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const empresaCodigo = (selections?.empresa?.codigo_empresa ?? selections?.empresa?.codigoEmpresa ?? null) || null;
      const clienteId = selections?.cliente?.id ?? null;
      if (!empresaCodigo && !clienteId) return;
      await supabase
        .from('isis_chat_sessions')
        .update({
          empresa_codigo: empresaCodigo || undefined,
          cliente_id: clienteId || undefined,
        })
        .eq('id', sid);
    } catch {}
  }, [selections?.empresa?.codigo_empresa, selections?.empresa?.codigoEmpresa, selections?.cliente?.id]);

  // Persiste mensagem no banco
  const persistMessage = useCallback(async (msg) => {
    try {
      const sid = await ensureSession();
      if (!sid) return;
      const record = {
        session_id: sid,
        from_role: msg.from === 'isis' ? 'assistant' : 'user',
        type: msg.type || 'text',
        text: String(msg.text ?? ''),
        buttons: Array.isArray(msg.buttons) ? msg.buttons : null,
        created_at: new Date().toISOString(),
      };
      await supabase.from('isis_chat_messages').insert(record);
      // tentar enriquecer sessão após salvar a primeira mensagem (caso cliente/empresa tenham surgido agora)
      tryUpdateSessionMeta(sid);
    } catch {}
  }, [ensureSession, tryUpdateSessionMeta]);
  
  // Adiciona mensagem ao chat
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      ...message
    }]);
    
    // Scroll automático após adicionar mensagem
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    // Persistência assíncrona (best-effort)
    try { persistMessage(message); } catch {}
  }, []);
  
  // Simula digitação da Isis
  const addIsisMessage = useCallback((textOrMessage, delay = 2000, color = null) => {
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      const payload = (textOrMessage && typeof textOrMessage === 'object' && textOrMessage.text)
        ? textOrMessage
        : { text: textOrMessage };
      addMessage({
        from: 'isis',
        text: payload.text,
        type: 'text',
        color: payload.color ?? color,
        copyable: !!payload.copyable,
        copyText: payload.copyText
      });
    }, delay);
  }, [addMessage]);
  
  // Adiciona mensagem com botões
  const addIsisMessageWithButtons = useCallback((text, buttons, delay = 2000) => {
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      
      // Desabilita todos os botões de mensagens anteriores
      setMessages(prev => prev.map(msg => {
        if (msg.type === 'buttons' && msg.buttons && msg.buttons.length > 0) {
          return {
            ...msg,
            disabled: true
          };
        }
        return msg;
      }));
      
      // Adiciona nova mensagem com botões ativos
      addMessage({
        from: 'isis',
        text,
        type: 'buttons',
        buttons,
        disabled: false
      });
    }, delay);
  }, [addMessage]);
  
  // Desabilita todos os botões ativos (chamado quando usuário clica em um botão)
  const disableAllButtons = useCallback(() => {
    setMessages(prev => prev.map(msg => {
      if (msg.type === 'buttons' && msg.buttons && msg.buttons.length > 0 && !msg.disabled) {
        return {
          ...msg,
          disabled: true
        };
      }
      return msg;
    }));
  }, []);

  // Remove uma mensagem específica (ex.: esconder botões após clique)
  const removeMessageById = useCallback((messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // Oculta os botões de uma mensagem (mantendo o balão de texto)
  const hideButtonsInMessage = useCallback((messageId) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId && m.type === 'buttons') {
        return { ...m, buttonsHidden: true, disabled: true };
      }
      return m;
    }));
  }, []);
  
  // Adiciona mensagem do usuário
  const addUserMessage = useCallback((text) => {
    addMessage({
      from: 'user',
      text,
      type: 'text'
    });
  }, [addMessage]);
  
  // Atualiza seleção
  const updateSelection = useCallback((key, value) => {
    setSelections(prev => ({
      ...prev,
      [key]: value
    }));
    // Se cliente/empresa atualizados, tentar atualizar a sessão existente
    if ((key === 'cliente' || key === 'empresa') && sessionId) {
      try { tryUpdateSessionMeta(sessionId); } catch {}
    }
  }, []);
  
  // Atualiza contato (nested)
  const updateContact = useCallback((key, value) => {
    setSelections(prev => ({
      ...prev,
      contato: {
        ...prev.contato,
        [key]: value
      }
    }));
  }, []);
  
  // Avança para próximo step
  const nextStep = useCallback((step) => {
    setCurrentStep(step);
  }, []);
  
  // Volta para step anterior
  const previousStep = useCallback(() => {
    const stepOrder = [
      'greeting',
      'quadra',
      'data',
      'horario',
      'modalidade',
      'quantidade',
      'nomes',
      'contato',
      'review',
      'confirmation',
      'avaliacao'
    ];
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }, [currentStep]);
  
  // Reseta conversa
  const resetConversation = useCallback(() => {
    setCurrentStep('greeting');
    setMessages([]);
    setSelections({
      empresa: null,
      quadra: null,
      data: null,
      horario: null,
      modalidade: null,
      quantidade: null,
      nomes: [],
      contato: { nome: '', telefone: '' }
    });
    setIsLoading(false);
    setIsTyping(false);
    setSessionId(null);
  }, []);
  
  const value = {
    // Estado
    currentStep,
    messages,
    selections,
    isLoading,
    isTyping,
    chatEndRef,
    
    // Ações
    addMessage,
    addIsisMessage,
    addIsisMessageWithButtons,
    addUserMessage,
    disableAllButtons,
    removeMessageById,
    hideButtonsInMessage,
    updateSelection,
    updateContact,
    nextStep,
    previousStep,
    resetConversation,
    setIsLoading,
    setIsTyping
  };
  
  return (
    <IsisContext.Provider value={value}>
      {children}
    </IsisContext.Provider>
  );
};
