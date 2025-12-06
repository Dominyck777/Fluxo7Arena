import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Bot, User, Copy as CopyIcon, Check as CheckIcon } from 'lucide-react';
import { IsisAvatar } from './IsisAvatar';

/**
 * Função para processar markdown de negrito **texto**
 */
const processMarkdown = (text, isIsis, isSuccess) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove os ** e retorna em negrito com destaque visual forte
      const boldText = part.slice(2, -2);
      return (
        <strong 
          key={index} 
          className={`font-black ${isIsis ? (isSuccess ? 'text-white' : 'text-[#000000]') : 'text-white'}`}
          style={{ 
            fontWeight: 900,
            textShadow: isIsis ? (isSuccess ? '0 0 1px rgba(0,0,0,0.25)' : '0 0 1px rgba(0,0,0,0.3)') : '0 0 1px rgba(255,255,255,0.5)'
          }}
        >
          {boldText}
        </strong>
      );
    }
    return part;
  });
};

/**
 * Componente de mensagem individual no chat - Estilo F7Arena
 */
export const IsisMessage = ({ message }) => {
  const isIsis = message.from === 'isis';
  const isSuccess = isIsis && message?.color === 'green';
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isIsis ? 'justify-start' : 'justify-end'} mb-4 md:mb-6`}
    >
      <div className={`flex items-end gap-2 md:gap-3 max-w-[90%] md:max-w-[85%] lg:max-w-[75%] ${!isIsis && 'flex-row-reverse'}`}>
        {/* Avatar */}
        {isIsis ? (
          <IsisAvatar size="sm" variant="message" className="md:w-14 md:h-14" />
        ) : (
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center flex-shrink-0 border bg-surface border-border-color">
            <User className="w-5 h-5 md:w-6 md:h-6 text-text-secondary" />
          </div>
        )}
        
        {/* Mensagem */}
        <div className="flex flex-col gap-1">
          <div
            className={`relative px-3 py-2.5 md:px-5 md:py-3.5 backdrop-blur-sm transition-all duration-300 ${
              isIsis
                ? (isSuccess
                    ? 'bg-emerald-600/90 border border-emerald-400 text-white rounded-2xl rounded-bl-sm shadow-lg shadow-emerald-600/30'
                    : 'bg-brand border border-brand text-[#0A0A0A] rounded-2xl rounded-bl-sm shadow-lg shadow-brand/20')
                : 'bg-surface/70 border border-white/10 text-text-primary rounded-2xl rounded-br-sm'
            }`}
          >
            <p className="text-[15px] md:text-[15px] font-bold leading-relaxed whitespace-pre-wrap tracking-wide relative">
              {processMarkdown(message.text, isIsis, isSuccess)}
            </p>
            {message.copyable && (
              <button
                type="button"
                onClick={() => copyToClipboard(message.copyText || (typeof message.text === 'string' ? message.text : ''))}
                className={`absolute right-2 bottom-2 p-1.5 md:p-2 rounded-full border shadow-sm transition ${
                  isIsis
                    ? 'bg-white/80 border-white/40 text-[#0A0A0A] hover:bg-white'
                    : 'bg-white/10 border-white/10 text-text-primary hover:bg-white/20'
                }`}
                aria-label="Copiar texto"
              >
                {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
              </button>
            )}
          </div>
          
          {/* Timestamp */}
          <p className={`text-[10px] md:text-[10px] text-text-muted px-2 ${isIsis ? 'text-left' : 'text-right'}`}>
            {format(message.timestamp, 'HH:mm')}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
