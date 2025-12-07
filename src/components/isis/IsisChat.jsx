import { useIsis } from '@/contexts/IsisContext';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IsisMessage } from './IsisMessage';
import { IsisTypingIndicator } from './IsisTypingIndicator';
import { IsisResponseButtons } from './IsisResponseButtons';

/**
 * Container principal do chat
 */
export const IsisChat = ({ children, onButtonClick, hideButtonTexts = false }) => {
  const { messages, isTyping, chatEndRef } = useIsis();
  const [extraBottomPad, setExtraBottomPad] = useState(0);

  useEffect(() => {
    const onExpand = (e) => {
      const expanded = !!(e?.detail?.expanded);
      const base = (typeof window !== 'undefined' && window.innerWidth < 768) ? 280 : 360; // deve casar com max-h expandido
      const compact = 140; // deve casar com max-h compacto
      const margin = 24; // respiro extra
      const pad = Math.max(0, base - compact + margin);
      setExtraBottomPad(expanded ? pad : 0);
    };
    try { window.addEventListener('isis-participantes-expand', onExpand); } catch {}
    return () => { try { window.removeEventListener('isis-participantes-expand', onExpand); } catch {} };
  }, []);
  
  return (
    <div className="flex flex-col min-h-full">
      {/* Mensagens */}
      <div className="flex-1 px-3 md:px-6 py-4 md:py-8" style={{ paddingBottom: extraBottomPad }}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            layout="position"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <IsisMessage message={message} />

            {/* Se mensagem tem botões, renderiza */}
            {message.type === 'buttons' && message.buttons && (
              <div
                className={`overflow-hidden transition-all duration-500 ${message.buttonsHidden ? 'max-h-0 mb-0 md:mb-0' : 'max-h-[480px]'}`}
              >
                <IsisResponseButtons
                  buttons={message.buttons}
                  onSelect={(button) => (onButtonClick || message.onButtonClick)?.(button, message.id)}
                  disabled={message.disabled}
                  hideText={hideButtonTexts}
                  hidden={!!message.buttonsHidden}
                />
              </div>
            )}
          </motion.div>
        ))}
        
        {/* Typing indicator */}
        {isTyping && <IsisTypingIndicator />}
        
        {/* Referência para scroll automático */}
        <div ref={chatEndRef} />
      </div>
      
      {/* Área de input (renderizada pelo pai) */}
      <div className="sticky bottom-0 px-3 md:px-6 pb-3 md:pb-6 pt-3 md:pt-4 bg-gradient-to-t from-background via-background to-transparent">
        {children}
      </div>
    </div>
  );
};
