import { useIsis } from '@/contexts/IsisContext';
import { motion } from 'framer-motion';
import { IsisMessage } from './IsisMessage';
import { IsisTypingIndicator } from './IsisTypingIndicator';
import { IsisResponseButtons } from './IsisResponseButtons';

/**
 * Container principal do chat
 */
export const IsisChat = ({ children, onButtonClick, hideButtonTexts = false }) => {
  const { messages, isTyping, chatEndRef } = useIsis();
  
  return (
    <div className="flex flex-col min-h-full">
      {/* Mensagens */}
      <div className="flex-1 px-3 md:px-6 py-4 md:py-8">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            layout="position"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <IsisMessage message={message} />

            {/* Se mensagem tem botões, renderiza */}
            {message.type === 'buttons' && message.buttons && (
              <IsisResponseButtons
                buttons={message.buttons}
                onSelect={(button) => (onButtonClick || message.onButtonClick)?.(button, message.id)}
                disabled={message.disabled}
                hideText={hideButtonTexts}
                hidden={!!message.buttonsHidden}
              />
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
