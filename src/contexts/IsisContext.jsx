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
  // Gera um UUID estável para esta sessão de chat (não usar ID do JSONBin)
  const sessionUidRef = useRef((() => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      // Fallback: gera UUID v4-like
      const hex = [...Array(36)].map(() => 'x');
      hex[8] = hex[13] = hex[18] = hex[23] = '-';
      hex[14] = '4';
      return hex.map((c, i) => {
        if (c !== 'x') return c;
        const r = (Math.random() * 16) | 0;
        const v = (i === 19) ? ((r & 0x3) | 0x8) : r;
        return v.toString(16);
      }).join('');
    } catch {
      return '00000000-0000-4000-8000-000000000000';
    }
  })());
  const [sessionId, setSessionId] = useState(sessionUidRef.current);
  
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
  // IMPORTANT: Chat persistence MUST use the ISIS chat key only (no fallback to generic feedback key)
  const keyCandidates = [
    ['VITE_KEY_CHAT_ISIS', import.meta.env.VITE_KEY_CHAT_ISIS],
    ['VITE-KEY-CHAT-ISIS', import.meta.env['VITE-KEY-CHAT-ISIS']],
    ['KEY_CHAT_ISIS', import.meta.env.KEY_CHAT_ISIS],
    ['KEY-CHAT-ISIS', import.meta.env['KEY-CHAT-ISIS']],
  ];
  const keyPick = keyCandidates.find(([name, val]) => !!val);
  const JSONBIN_API_KEY = keyPick?.[1];
  const JSONBIN_API_KEY_SOURCE = keyPick?.[0] || 'none';
  const JSONBIN_COLLECTION_ID = import.meta.env.VITE_JSONBIN_COLLECTION_ID || null;
  const ENV_BIN_ID = import.meta.env.VITE_JSONBIN_ISIS_BIN_ID || import.meta.env.VITE_JSONBIN_BIN_ID || null;
  const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';
  const [jsonbinId, setJsonbinId] = useState(ENV_BIN_ID || (typeof window !== 'undefined' ? window.localStorage.getItem('ISIS_JSONBIN_BIN_ID') : null));
  if (typeof window !== 'undefined') {
    // Safe debug log (does not print key value)
    try { console.info('[Isis][JSONBin] keySource=%s binId=%s', JSONBIN_API_KEY_SOURCE, ENV_BIN_ID || window.localStorage.getItem('ISIS_JSONBIN_BIN_ID') || 'none'); } catch {}
  }

  // Chamada via supabase.functions (sem precisar de .env no cliente)
  const postToEdge = useCallback(async (payload) => {
    // Se não houver chave de JSONBin no cliente, evitamos chamadas de persistência para reduzir ruído
    if (!JSONBIN_API_KEY) {
      try { console.debug('[Isis][Edge] skipped (no JSONBIN key) mode=%s', payload?.mode); } catch {}
      return { ok: false, data: null };
    }
    try {
      const { data, error } = await supabase.functions.invoke('isis-chat', {
        body: payload,
      });
      if (error) {
        try { console.debug('[Isis][Edge] %s error=%o', payload?.mode, error); } catch {}
        return { ok: false, data: null };
      }
      try { console.debug('[Isis][Edge] %s ok resp=%o', payload?.mode, data); } catch {}
      return { ok: true, data };
    } catch (e) {
      try { console.debug('[Isis][Edge] invoke exception:', e); } catch {}
      return { ok: false, data: null };
    }
  }, [JSONBIN_API_KEY]);

  const createBin = useCallback(async (initialContent) => {
    if (!JSONBIN_API_KEY) return null;
    const headers = {
      'X-Master-Key': JSONBIN_API_KEY,
      'X-Access-Key': JSONBIN_API_KEY,
      'Content-Type': 'application/json'
    };
    if (JSONBIN_COLLECTION_ID) headers['X-Collection-Id'] = JSONBIN_COLLECTION_ID;
    const res = await fetch(`${JSONBIN_BASE}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(initialContent || { projects: [{ name: 'F7 Arena' }], chat_sessions: [] })
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const newId = data?.metadata?.id || data?.id || null;
    if (newId) {
      setJsonbinId(newId);
      try { window?.localStorage?.setItem('ISIS_JSONBIN_BIN_ID', newId); } catch {}
    }
    return newId;
  }, [JSONBIN_API_KEY]);

  const loadBin = useCallback(async () => {
    if (!JSONBIN_API_KEY) return null;
    if (!jsonbinId) return null;
    try { console.debug('[Isis][JSONBin] loadBin: GET %s/%s', JSONBIN_BASE, jsonbinId); } catch {}
    const headers = {
      'X-Master-Key': JSONBIN_API_KEY,
      'X-Access-Key': JSONBIN_API_KEY,
      'X-Bin-Meta': 'false',
      'Content-Type': 'application/json'
    };
    if (JSONBIN_COLLECTION_ID) headers['X-Collection-Id'] = JSONBIN_COLLECTION_ID;
    const res = await fetch(`${JSONBIN_BASE}/${jsonbinId}`, {
      method: 'GET',
      headers
    });
    try { console.debug('[Isis][JSONBin] loadBin: status=%s', res?.status); } catch {}
    if (res.status === 401 || res.status === 404) {
      try { console.error('[Isis][JSONBin] GET unauthorized or not found. keySource=%s binId=%s status=%s', JSONBIN_API_KEY_SOURCE, jsonbinId, res.status); } catch {}
      // Sem acesso ou bin inexistente: cria um novo bin sob esta key
      const newId = await createBin();
      if (!newId) return null;
      // retorna conteúdo inicial usado na criação
      return { projects: [{ name: 'F7 Arena' }], chat_sessions: [] };
    }
    if (!res.ok) return null;
    try { return await res.json(); } catch { return null; }
  }, [JSONBIN_API_KEY, jsonbinId, createBin]);

  const saveBin = useCallback(async (content) => {
    if (!JSONBIN_API_KEY) return false;
    if (!jsonbinId) {
      const newId = await createBin(content);
      if (!newId) return false;
    }
    const targetId = jsonbinId || (typeof window !== 'undefined' ? window.localStorage.getItem('ISIS_JSONBIN_BIN_ID') : null);
    try { console.debug('[Isis][JSONBin] saveBin: PUT %s/%s', JSONBIN_BASE, targetId); } catch {}
    const headers = {
      'X-Master-Key': JSONBIN_API_KEY,
      'X-Access-Key': JSONBIN_API_KEY,
      'Content-Type': 'application/json'
    };
    if (JSONBIN_COLLECTION_ID) headers['X-Collection-Id'] = JSONBIN_COLLECTION_ID;
    const res = await fetch(`${JSONBIN_BASE}/${targetId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(content)
    });
    try { console.debug('[Isis][JSONBin] saveBin: status=%s', res?.status); } catch {}
    if (res.status === 401 || res.status === 404) {
      try { console.error('[Isis][JSONBin] PUT unauthorized or not found. keySource=%s binId=%s status=%s', JSONBIN_API_KEY_SOURCE, targetId, res.status); } catch {}
      const newId = await createBin(content);
      return !!newId;
    }
    return res.ok;
  }, [JSONBIN_API_KEY, jsonbinId, createBin]);

  // Local helpers for chat_sessions
  const ensureChatSessionsKey = (content) => {
    if (!content || typeof content !== 'object') return { projects: [{ name: 'F7 Arena' }], chat_sessions: [] };
    if (!Array.isArray(content.chat_sessions)) content.chat_sessions = [];
    return content;
  };

  const findSessionIndex = (content, criteria) => {
    const list = Array.isArray(content?.chat_sessions) ? content.chat_sessions : [];
    return list.findIndex((s) =>
      (s?.project || '').toString() === (criteria.project || '').toString() &&
      (s?.company?.code || '').toString() === (criteria.companyCode || '').toString() &&
      (s?.client_code || '').toString() === (criteria.clientCode || '').toString()
    );
  };

  // Garante inicialização do bin e retorna um pseudo sessionId
  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    try {
      try { console.info('[Isis][Chat] ensureSession: start'); } catch {}
      const empresa = selections?.empresa || null;
      const company = empresa ? { code: empresa.codigo_empresa || empresa.codigoEmpresa, name: empresa.nome_fantasia || empresa.nome } : null;
      const cliente = selections?.cliente || null;

      // Tenta carregar conteúdo atual
      let content = await loadBin();
      content = ensureChatSessionsKey(content);
      if (!Array.isArray(content.projects)) content.projects = [{ name: 'F7 Arena' }];

      // Opcionalmente, cria um registro base se já tivermos metadados e não existir
      const criteria = {
        project: 'F7 Arena',
        companyCode: company?.code || null,
        clientCode: cliente?.id ? String(cliente.id) : null,
      };
      try { console.debug('[Isis][Chat] ensureSession: criteria=%o', criteria); } catch {}
      if (criteria.companyCode && criteria.clientCode) {
        const idx = findSessionIndex(content, criteria);
        try { console.debug('[Isis][Chat] ensureSession: existingIndex=%s', idx); } catch {}
        if (idx === -1) {
          content.chat_sessions.push({
            client_code: criteria.clientCode,
            client_name: cliente?.nome || cliente?.name || '',
            company: company,
            project: criteria.project,
            conversation: []
          });
        }
      }
      await saveBin(content);
      // Mantém sessionId como UUID local (não usa JSONBin ID)
      try { console.info('[Isis][Chat] ensureSession: sessionId=%s', sessionId); } catch {}
      return sessionId;
    } catch (_) {
      try { console.error('[Isis][Chat] ensureSession: failed', _); } catch {}
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
      let content = await loadBin();
      if (!content) return;
      content = ensureChatSessionsKey(content);
      const criteria = {
        project: 'F7 Arena',
        companyCode: company?.code || null,
        clientCode: cliente?.id ? String(cliente.id) : null,
      };
      try { console.debug('[Isis][Chat] tryUpdateSessionMeta: criteria=%o', criteria); } catch {}
      if (!criteria.companyCode && !criteria.clientCode) return;
      let idx = findSessionIndex(content, criteria);
      if (idx === -1) {
        content.chat_sessions.push({
          client_code: criteria.clientCode,
          client_name: cliente?.nome || cliente?.name || '',
          company: company,
          project: criteria.project,
          conversation: []
        });
        idx = content.chat_sessions.length - 1;
        try { console.debug('[Isis][Chat] tryUpdateSessionMeta: created index=%s', idx); } catch {}
      } else {
        // Atualiza metadados se ainda não setados
        if (cliente?.id && !content.chat_sessions[idx].client_code) content.chat_sessions[idx].client_code = String(cliente.id);
        if (cliente?.nome && !content.chat_sessions[idx].client_name) content.chat_sessions[idx].client_name = cliente.nome;
        if (company && !content.chat_sessions[idx].company) content.chat_sessions[idx].company = company;
        try { console.debug('[Isis][Chat] tryUpdateSessionMeta: updated index=%s', idx); } catch {}
      }
      await saveBin(content);

      // Também envia metadados para a Edge Function (bin único de chat)
      // Apenas quando já temos cliente identificado (cod_cliente obrigatório no servidor)
      if (company?.name && cliente?.id) {
        await postToEdge({
          mode: 'set_meta',
          cod_cliente: cliente?.id ? String(cliente.id) : '',
          nome_cliente: cliente?.nome || cliente?.name || '',
          empresa: company.name,
          software: 'F7 Arena'
        });
      }
    } catch {}
  }, [selections?.empresa, selections?.cliente, loadBin, saveBin, postToEdge]);

  // Persiste mensagem no banco
  const persistMessage = useCallback(async (msg) => {
    try {
      try { console.info('[Isis][Chat] persistMessage: incoming=%o', { from: msg.from, text: msg.text }); } catch {}

      // Identidade atual (empresa/cliente) para estruturar por cliente no bin
      const empresaSel = selections?.empresa || null;
      const company = empresaSel ? { code: empresaSel.codigo_empresa || empresaSel.codigoEmpresa, name: empresaSel.nome_fantasia || empresaSel.nome } : null;
      const clienteSel = selections?.cliente || null;

      // Envia para Edge Function (fonte de verdade) com metadados
      await postToEdge({
        mode: 'append_message',
        cod_cliente: clienteSel?.id ? String(clienteSel.id) : '_unknown',
        nome_cliente: clienteSel?.nome || clienteSel?.name || '',
        empresa: company?.name || '',
        software: 'F7 Arena',
        session_id: sessionId,
        message: {
          from: msg.from === 'isis' ? 'assistant' : 'user',
          text: String(msg.text ?? ''),
        }
      });

      // Best-effort: mantém persistência local/legada também (opcional)
      try {
        const sid = await ensureSession();
        if (!sid) return;
        const from = msg.from === 'isis' ? 'assistant' : 'user';
        const entry = { ts: new Date().toISOString(), from, text: String(msg.text ?? '') };
        let content = await loadBin();
        if (!content) return;
        content = ensureChatSessionsKey(content);
        const empresa = selections?.empresa || null;
        const company = empresa ? { code: empresa.codigo_empresa || empresa.codigoEmpresa, name: empresa.nome_fantasia || empresa.nome } : null;
        const cliente = selections?.cliente || null;
        const criteria = {
          project: 'F7 Arena',
          companyCode: company?.code || null,
          clientCode: cliente?.id ? String(cliente.id) : null,
        };
        let idx = findSessionIndex(content, criteria);
        if (idx === -1) {
          content.chat_sessions.push({
            client_code: criteria.clientCode,
            client_name: cliente?.nome || cliente?.name || '',
            company: company,
            project: criteria.project,
            conversation: [entry]
          });
        } else {
          if (!Array.isArray(content.chat_sessions[idx].conversation)) content.chat_sessions[idx].conversation = [];
          content.chat_sessions[idx].conversation.push(entry);
        }
        await saveBin(content);
        tryUpdateSessionMeta(sid);
      } catch {}
    } catch {}
  }, [ensureSession, tryUpdateSessionMeta, loadBin, saveBin, postToEdge, selections?.empresa, selections?.cliente, sessionId]);
  
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
