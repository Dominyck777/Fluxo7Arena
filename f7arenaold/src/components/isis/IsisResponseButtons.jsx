import { motion } from 'framer-motion';

/**
 * Botões de resposta rápida - Estilo F7Arena
 */
export const IsisResponseButtons = ({ buttons, onSelect, disabled = false, hideText = false, hidden = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, gridTemplateRows: '1fr' }}
      animate={{
        opacity: hidden ? 0 : 1,
        y: hidden ? -8 : 0,
        gridTemplateRows: hidden ? '0fr' : '1fr'
      }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`grid ml-12 md:ml-[68px] overflow-hidden transition-all duration-500 ${hidden ? 'mb-0 md:mb-0 pointer-events-none' : 'mb-2 md:mb-3'}`}
    >
      <div className="flex flex-wrap gap-2 md:gap-2.5">
        {buttons.map((button, index) => (
          <motion.button
            key={button.value || index}
            initial={{ opacity: 0, scale: 0.92, y: 4, filter: 'blur(2px)' }}
            animate={{
              opacity: hidden || hideText ? 0 : 1,
              scale: hidden ? 0.96 : 1,
              y: hidden ? -8 : 0,
              filter: hidden ? 'blur(3.5px)' : 'blur(0px)'
            }}
            transition={{ duration: hidden ? 0.4 : 0.45, delay: hidden ? index * 0.03 : 0.2 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            onClick={() => !disabled && onSelect(button)}
            disabled={disabled}
            className={`
              group relative px-5 py-3.5 md:px-6 md:py-4 rounded-xl font-semibold text-[15px] md:text-[15px]
              transition-all duration-300 ease-out
              ${
                disabled
                  ? 'bg-surface/30 text-text-muted cursor-not-allowed border border-white/5'
                  : 'bg-surface/70 backdrop-blur-sm text-text-primary border border-white/10 hover:border-brand/70 hover:bg-brand/10 hover:text-brand hover:shadow-lg hover:shadow-brand/20 shadow-md'
              }
              ${hideText ? 'opacity-0 pointer-events-none' : ''}
            `}
          >
            <div className="flex flex-col gap-0.5 md:gap-1 relative z-10">
              <div className="flex items-center gap-2">
                {button.icon && !hideText && (
                  <span className={`text-base md:text-lg transition-transform duration-300 ${!disabled && 'group-hover:scale-110'}`}>
                    {button.icon}
                  </span>
                )}
                {!hideText && <span className="font-semibold">{button.label}</span>}
              </div>
              {button.subtitle && !hideText && (
                <span className="text-[12px] md:text-xs opacity-70 pl-6 md:pl-7 font-normal">
                  {button.subtitle}
                </span>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};
