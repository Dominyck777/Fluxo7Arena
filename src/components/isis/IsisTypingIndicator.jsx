import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { IsisAvatar } from './IsisAvatar';

/**
 * Indicador de digitação (3 pontinhos animados) - Estilo F7Arena
 */
export const IsisTypingIndicator = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-start mb-6"
    >
      <div className="flex items-end gap-3 max-w-[85%] md:max-w-[75%]">
        {/* Avatar */}
        <IsisAvatar size="md" variant="message" />
        
        {/* Typing bubble */}
        <div className="px-4 py-3 bg-brand border border-brand backdrop-blur-sm rounded-2xl rounded-bl-sm shadow-lg shadow-brand/20">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 md:w-2 md:h-2 bg-[#0A0A0A] rounded-full"
                animate={{
                  y: [0, -6, 0],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
