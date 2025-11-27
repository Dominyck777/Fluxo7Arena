import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Send, MessageSquare } from 'lucide-react';

/**
 * Componente de avaliação da ISIS - 5 estrelas + comentário opcional
 */
export const IsisAvaliacaoInput = ({ onSubmit, disabled = false }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (rating === 0 || disabled) return;
    
    onSubmit({
      rating,
      comentario: comentario.trim() || null,
      timestamp: new Date().toISOString()
    });
  };

  const handleStarClick = (starRating) => {
    if (disabled) return;
    setRating(starRating);
  };

  const handleStarHover = (starRating) => {
    if (disabled) return;
    setHoveredRating(starRating);
  };

  const handleStarLeave = () => {
    if (disabled) return;
    setHoveredRating(0);
  };

  const displayRating = hoveredRating || rating;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full mb-8 md:mb-4"
    >
      {/* Container único com background para toda a avaliação */}
      <div className="bg-background/98 backdrop-blur-3xl border-2 border-white/50 rounded-3xl p-6 md:p-8 shadow-2xl relative z-50">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Sistema de Estrelas */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  type="button"
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => handleStarHover(star)}
                  onMouseLeave={handleStarLeave}
                  disabled={disabled}
                  whileHover={{ scale: disabled ? 1 : 1.2 }}
                  whileTap={{ scale: disabled ? 1 : 0.9 }}
                  className={`
                    p-2 transition-all duration-200 rounded-full
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-brand/10'}
                  `}
                >
                  <Star
                    className={`w-8 h-8 md:w-10 md:h-10 transition-all duration-200 ${
                      star <= displayRating
                        ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg'
                        : 'text-text-muted hover:text-yellow-300'
                    }`}
                  />
                </motion.button>
              ))}
            </div>
            
            {/* Texto da avaliação */}
            {rating > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <p className="text-base font-semibold text-text-primary">
                  {rating === 1 && '😞 Muito ruim'}
                  {rating === 2 && '😕 Ruim'}
                  {rating === 3 && '😐 Regular'}
                  {rating === 4 && '😊 Bom'}
                  {rating === 5 && '🤩 Excelente'}
                </p>
              </motion.div>
            )}
          </div>

          {/* Divisor sutil */}
          {rating > 0 && (
            <div className="w-full h-px bg-white/10 my-2"></div>
          )}

          {/* Campo de Comentário */}
          {rating > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex flex-col gap-4"
            >
              <label className="text-base font-semibold text-text-primary flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand" />
                Comentário (opcional)
              </label>
              
              <div className={`
                flex items-start gap-2 px-4 py-3 rounded-xl
                bg-background/60 backdrop-blur-sm
                border-2 transition-all duration-300
                ${focused ? 'border-brand/50 shadow-lg shadow-brand/10' : 'border-white/10 shadow-md'}
              `}>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Conte-nos mais sobre sua experiência..."
                  disabled={disabled}
                  rows={3}
                  maxLength={500}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-base resize-none min-w-0"
                />
              </div>
              
              {/* Contador de caracteres */}
              <div className="text-sm text-text-muted text-right">
                {comentario.length}/500
              </div>
            </motion.div>
          )}

        {/* Botão Enviar com mais destaque */}
        {rating > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="mt-2 mb-4" // Espaçamento extra para mobile
          >
            <motion.button
              type="submit"
              disabled={disabled}
              whileHover={{ scale: disabled ? 1 : 1.02 }}
              whileTap={{ scale: disabled ? 1 : 0.98 }}
              className={`
                w-full px-6 py-4 rounded-2xl font-bold text-lg
                transition-all duration-300 flex items-center justify-center gap-3
                shadow-xl border-2
                ${
                  disabled
                    ? 'bg-surface text-text-muted cursor-not-allowed border-white/10'
                    : 'bg-gradient-to-r from-brand to-brand/90 text-white shadow-brand/30 hover:shadow-2xl hover:shadow-brand/40 border-brand/20 hover:from-brand/90 hover:to-brand'
                }
              `}
            >
              <Send className="w-6 h-6" />
              Enviar Avaliação
            </motion.button>
          </motion.div>
        )}
        </form>
      </div>
    </motion.div>
  );
};
