import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';

/**
 * Input customizado para a Isis - Estilo F7Arena
 */
export const IsisInput = ({ 
  placeholder = 'Digite aqui...', 
  onSubmit, 
  multiline = false,
  autoFocus = true,
  type = 'text'
}) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        if (multiline) {
          textareaRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 100);
    }
  }, [autoFocus, multiline]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const trimmed = value.trim();
    if (!trimmed) return;
    
    onSubmit(trimmed);
    setValue('');
  };
  
  const handleKeyDown = (e) => {
    // Enter sem shift = enviar (se não for multiline)
    if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={handleSubmit}
      className={`
        flex items-end gap-2 md:gap-3 bg-surface/70 backdrop-blur-sm rounded-2xl p-3 md:p-4
        border transition-all duration-300
        ${isFocused ? 'border-brand/50 shadow-lg' : 'border-white/10 shadow-md'}
      `}
    >
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={3}
          className="flex-1 resize-none outline-none text-[15px] md:text-sm bg-transparent text-text-primary placeholder:text-text-muted px-2 py-1"
        />
      ) : (
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 outline-none text-[15px] md:text-sm bg-transparent text-text-primary placeholder:text-text-muted px-2 py-1"
        />
      )}
      
      <motion.button
        type="submit"
        whileHover={{ scale: value.trim() ? 1.05 : 1 }}
        whileTap={{ scale: value.trim() ? 0.95 : 1 }}
        disabled={!value.trim()}
        className={`
          relative p-3 rounded-xl transition-all duration-300 group
          ${
            value.trim()
              ? 'bg-brand text-bg shadow-lg shadow-brand/20 hover:shadow-xl hover:shadow-brand/30'
              : 'bg-surface border border-white/10 text-text-muted cursor-not-allowed'
          }
        `}
      >
        {value.trim() ? (
          <>
            <Send size={18} className="relative z-10" />
            <motion.div
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-warning to-brand"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          </>
        ) : (
          <Sparkles size={18} className="opacity-40" />
        )}
      </motion.button>
    </motion.form>
  );
};
