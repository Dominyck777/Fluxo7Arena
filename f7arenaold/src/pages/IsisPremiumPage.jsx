import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import isisMasterPrompt from '@/prompts/isisMasterPrompt.md?raw';
import { IsisMessage } from '@/components/isis/IsisMessage';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { motion } from 'framer-motion';
import { Bot, Send } from 'lucide-react';

export default function IsisPremiumPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [showPremiumOverlay, setShowPremiumOverlay] = useState(true);
  const chatEndRef = useRef(null);
  const { company, userProfile, user } = useAuth();

  useEffect(() => {
    const hello = {
      id: Date.now() + Math.random(),
      from: 'isis',
      text: 'Olá! Eu sou a versão Premium da Ísis, integrada à OpenAI. Em que posso ajudar? 😊',
      timestamp: new Date()
    };
    setMessages([hello]);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(t);
  }, [messages, isTyping]);

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), timestamp: new Date(), ...msg }]);
  };

  const computeStatusText = (userText) => {
    const t = String(userText || '').toLowerCase();

    if (!t) return '...';

    // Agenda / agendamentos
    if (t.includes('agend') || t.includes('agenda')) {
      if (t.includes('hoje')) return 'Consultando os agendamentos de hoje...';
      if (t.includes('amanhã')) return 'Consultando os agendamentos de amanhã...';
      return 'Consultando seus agendamentos...';
    }

    // Clientes
    if (t.includes('cliente')) {
      return 'Buscando informações de clientes...';
    }

    // Caixa / financeiro
    if (t.includes('caixa') || t.includes('faturamento') || t.includes('financeiro') || t.includes('venda') || t.includes('pagamento')) {
      return 'Analisando movimentações da sua arena...';
    }

    // Quadras / reservas
    if (t.includes('quadra') || t.includes('reserva')) {
      return 'Verificando horários e quadras disponíveis...';
    }

    // Fallback genérico
    return '...';
  };

  const sendToBackend = async (userText, historyMessages) => {
    try {
      const empresaCodigo = company?.codigoEmpresa || company?.codigo_empresa || null;
      const usuarioId = userProfile?.id || user?.id || null;
      const usuarioNome = userProfile?.nome || user?.email || null;
      const usuarioCargo = userProfile?.cargo || null;
      // Janela padrão de consulta: hoje (00:00 até amanhã 00:00), alinhada com a Agenda
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const data_inicio = dayStart.toISOString();
      const data_fim = dayEnd.toISOString();

      // Converter histórico local em formato de mensagens da OpenAI
      const history = Array.isArray(historyMessages)
        ? historyMessages.map((m) => ({
            role: m.from === 'isis' ? 'assistant' : 'user',
            content: m.text,
          }))
        : [];

      const { data, error } = await supabase.functions.invoke('chat-proxy', {
        body: { message: userText, empresaCodigo, usuarioId, usuarioNome, usuarioCargo, data_inicio, data_fim, history }
      });
      if (error) throw error;

      const fallbackText = typeof data?.reply === 'string' && data.reply.trim().length > 0
        ? data.reply
        : 'Certo! (resposta provisória)';

      // Suporte a múltiplas respostas (replies) vindas do backend.
      // Quando data.replies existir, usamos cada item como um balão separado da Ísis.
      let replies = Array.isArray(data?.replies)
        ? data.replies.filter((r) => typeof r === 'string' && r.trim().length > 0)
        : [];
      if (replies.length === 0) {
        replies = [fallbackText];
      }

      // Log da resposta da IA no frontend
      // Inclui fonte (openai vs openai+tools) e payload cru para facilitar debug
      console.log('[Ísis][response]', {
        replies,
        raw: data,
      });
      // Versão serializada para facilitar visualização em texto
      if (data) {
        try {
          console.log('[Ísis][response raw JSON]', JSON.stringify(data, null, 2));
        } catch {}
      }

      // Exibir as replies sequencialmente como múltiplos balões da Ísis
      for (let i = 0; i < replies.length; i++) {
        const text = replies[i];
        addMessage({ from: 'isis', text });
        if (i < replies.length - 1) {
          // Pequeno delay entre os balões para dar sensação de fluxo
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }

      setIsTyping(false);
      setStatusText('');
    } catch (e) {
      addMessage({ from: 'isis', text: 'No momento, estou operando em modo de demonstração. Em breve estarei 100% conectada à OpenAI aqui na aba Premium! ✨' });
      setIsTyping(false);
      setStatusText('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    // Histórico até o momento (antes de adicionar a nova pergunta)
    const historyMessages = [...messages];
    // Log da pergunta do usuário no frontend
    console.log('[Ísis][question]', { message: text });
    addMessage({ from: 'user', text });
    setInput('');
    setIsTyping(true);
    setStatusText(computeStatusText(text));
    await sendToBackend(text, historyMessages);
  };

  return (
    <div className="flex h-full w-full relative">
      <div className="flex-1 flex flex-col pointer-events-none">

        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6">
          {messages.map((m) => (
            <IsisMessage key={m.id} message={m} />
          ))}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-4">
              <div className="px-4 py-2 rounded-2xl bg-brand border border-brand text-[#0A0A0A] flex items-center gap-2 animate-pulse">
                {statusText && statusText !== '...' ? (
                  <>
                    <span role="img" aria-label="pensando">🤔</span>
                    <span>{statusText}</span>
                  </>
                ) : (
                  <span className="font-semibold tracking-widest">...</span>
                )}
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="sticky bottom-0 px-3 md:px-6 pb-3 md:pb-6 pt-3 md:pt-4 bg-gradient-to-t from-background via-background to-transparent">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-surface/70 border border-white/10 rounded-xl px-3 py-2.5">
            <Bot className="w-5 h-5 text-text-muted" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva aqui…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${input.trim() ? 'bg-brand text-bg' : 'bg-surface/40 text-text-muted cursor-not-allowed'}`}
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </form>
        </div>
      </div>

      {/* Overlay Premium */}
      {showPremiumOverlay && (
        <div className="absolute inset-0 z-10 backdrop-blur-lg bg-black/60 flex items-center justify-center pointer-events-auto rounded-lg overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-white/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-2xl max-w-sm w-full text-center mx-4 overflow-hidden"
          >
            <div className="px-8 py-10">
              {/* Avatar da Isis com borda reluzente */}
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="flex items-center justify-center mb-8"
              >
                <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_20px_rgba(168,85,247,0.5)] overflow-hidden">
                  <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center">
                    <IsisAvatar size="lg" />
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                <div className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-violet-300 to-emerald-300 mb-4">
                  Ísis
                </div>
                <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                  Em breve sua assistente IA vai estar pronta para revolucionar a gestão da sua arena. 🚀
                </p>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3 text-sm text-gray-200">
                    <span className="text-emerald-400 font-bold mt-0.5">✨</span>
                    <span>Gerencie agendamentos com inteligência artificial</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-gray-200">
                    <span className="text-violet-400 font-bold mt-0.5">📊</span>
                    <span>Otimize sua agenda e maximize ocupação</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-gray-200">
                    <span className="text-fuchsia-400 font-bold mt-0.5">🧠</span>
                    <span>Insights inteligentes sobre sua arena</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
