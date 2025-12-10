import { createContext, useContext, useState, useRef, useCallback } from 'react';

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

  // JSONBin helpers
  const JSONBIN_API_KEY = import.meta.env.VITE_JSONBIN_API_KEY;
  const JSONBIN_BIN_ID = import.meta.env.VITE_JSONBIN_ISIS_BIN_ID || import.meta.env.VITE_JSONBIN_BIN_ID;
  const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

  const loadBin = useCallback(async () => {
    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return null;
    const res = await fetch(`${JSONBIN_BASE}/${JSONBIN_BIN_ID}`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Meta': 'false',
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return null;
    try { return await res.json(); } catch { return null; }
  }, [JSONBIN_API_KEY, JSONBIN_BIN_ID]);

  const saveBin = useCallback(async (content) => {
    if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return false;
    const res = await fetch(`${JSONBIN_BASE}/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(content)
    });
    return res.ok;
  }, [JSONBIN_API_KEY, JSONBIN_BIN_ID]);

  // Garante inicialização do bin e retorna um pseudo sessionId
  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    try {
      const empresa = selections?.empresa || null;
      const company = empresa ? { code: empresa.codigo_empresa || empresa.codigoEmpresa, name: empresa.nome_fantasia || empresa.nome } : null;
      const cliente = selections?.cliente || null;

      // Tenta carregar conteúdo atual
      let content = await loadBin();
      if (!content || typeof content !== 'object') {
        // Inicializa com estrutura simples
        content = {
          projects: [{ name: 'F7 Arena' }],
          chat: {
            client_code: cliente?.id ? String(cliente.id) : null,
            client_name: cliente?.nome || cliente?.name || '',
            company: company,
            project: 'F7 Arena',
            conversation: []
          }
        };
        await saveBin(content);
      } else {
        // Garante que existam as chaves mínimas
        if (!Array.isArray(content.projects)) content.projects = [{ name: 'F7 Arena' }];
        if (!content.chat) content.chat = { client_code: null, client_name: '', company: company, project: 'F7 Arena', conversation: [] };
        // Preenche metadados se disponíveis
        if (cliente?.id && !content.chat.client_code) content.chat.client_code = String(cliente.id);
        if (cliente?.nome && !content.chat.client_name) content.chat.client_name = cliente.nome;
        if (company && !content.chat.company) content.chat.company = company;
        if (!content.chat.project) content.chat.project = 'F7 Arena';
        if (!Array.isArray(content.chat.conversation)) content.chat.conversation = [];
        await saveBin(content);
      }
      // Usa bin id como sessionId lógico
      setSessionId(JSONBIN_BIN_ID);
      return JSONBIN_BIN_ID;
    } catch (_) {
      return null;
    }
  }, [sessionId, selections?.empresa, selections?.cliente, loadBin, saveBin]);

  // Atualiza sessão com cliente/empresa se ainda não setados (quando identificação acontece depois)
  const tryUpdateSessionMeta = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const empresa = selections?.empresa || null;
      const company = empresa ? { code: empresa.codigo_empresa || empresa.codigoEmpresa, name: empresa.nome_fantasia || empresa.nome } : null;
      const cliente = selections?.cliente || null;
      const content = await loadBin();
      if (!content) return;
      content.chat = content.chat || {};
      if (cliente?.id) content.chat.client_code = String(cliente.id);
      if (cliente?.nome) content.chat.client_name = cliente.nome;
      if (company) content.chat.company = company;
      if (!content.chat.project) content.chat.project = 'F7 Arena';
      if (!Array.isArray(content.chat.conversation)) content.chat.conversation = [];
      await saveBin(content);
    } catch {}
  }, [selections?.empresa, selections?.cliente, loadBin, saveBin]);

  // Persiste mensagem no banco
  const persistMessage = useCallback(async (msg) => {
    try {
      const sid = await ensureSession();
      if (!sid) return;
      const from = msg.from === 'isis' ? 'assistant' : 'user';
      const entry = {
        ts: new Date().toISOString(),
        from,
        text: String(msg.text ?? '')
      };
      const content = await loadBin();
      if (!content) return;
      content.chat = content.chat || { project: 'F7 Arena', conversation: [] };
      if (!Array.isArray(content.chat.conversation)) content.chat.conversation = [];
      content.chat.conversation.push(entry);
      await saveBin(content);
      tryUpdateSessionMeta(sid);
    } catch {}
  }, [ensureSession, tryUpdateSessionMeta, loadBin, saveBin]);
  
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
    sessionId,
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
