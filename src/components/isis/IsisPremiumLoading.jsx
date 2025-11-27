import { motion } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';

/**
 * Loading premium para a Isis com logo e animações do Fluxo7 Arena
 */
export const IsisPremiumLoading = ({ message = "Carregando..." }) => {
  // Mensagens curtas e diretas sobre a Isis como IA
  const mensagensIsis = [
    '🤖 Ísis IA iniciando...',
    '⚡ Processando dados em tempo real...',
    '✨ IA analisando disponibilidade...',
    '🧠 Ísis aprendendo suas preferências...',
    '💬 Assistente virtual ativando...',
    '🚀 IA otimizando seu agendamento...',
    '🎯 Ísis calculando melhores opções...',
    '⏰ Sincronizando com IA...',
    '🔮 Inteligência artificial carregando...',
    '💡 Ísis processando informações...'
  ];
  
  const mensagemAleatoria = mensagensIsis[Math.floor(Math.random() * mensagensIsis.length)];
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background com gradiente animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-surface/30 to-background">
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, #FF6600 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, #FFAA33 0%, transparent 50%)',
              'radial-gradient(circle at 50% 20%, #FF6600 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, #FF6600 0%, transparent 50%)',
            ]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Partículas flutuantes */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: i % 2 === 0 ? '#FF6600' : '#FFAA33',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, -100, -20],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Container principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center"
      >
        {/* Logo com animações */}
        <div className="mb-8 flex flex-col items-center gap-6">
          {/* Ícone do troféu com glow */}
          <motion.div 
            className="relative"
            animate={{ 
              rotateY: [0, 360],
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            {/* Glow animado */}
            <motion.div
              className="absolute inset-0 rounded-2xl blur-xl opacity-60"
              style={{ background: '#FFAA33' }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Container do troféu */}
            <motion.div 
              className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center"
              style={{ background: '#FFAA33' }}
              whileHover={{ scale: 1.05 }}
            >
              <Trophy className="w-12 h-12 md:w-14 md:h-14 text-white" strokeWidth={2} />
            </motion.div>
          </motion.div>

          {/* Nome da aplicação */}
          <motion.div 
            className="flex items-baseline gap-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <motion.span 
              className="font-extrabold text-4xl md:text-5xl"
              style={{ color: '#FF6600' }}
              animate={{ 
                textShadow: [
                  '0 0 10px rgba(255, 102, 0, 0.5)',
                  '0 0 20px rgba(255, 102, 0, 0.8)',
                  '0 0 10px rgba(255, 102, 0, 0.5)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Fluxo
            </motion.span>
            <motion.span 
              className="font-extrabold text-4xl md:text-5xl"
              style={{ color: '#FFAA33' }}
              animate={{ 
                textShadow: [
                  '0 0 10px rgba(255, 170, 51, 0.5)',
                  '0 0 20px rgba(255, 170, 51, 0.8)',
                  '0 0 10px rgba(255, 170, 51, 0.5)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
            >
              7
            </motion.span>
            <motion.span 
              className="font-medium text-4xl md:text-5xl ml-2"
              style={{ color: '#B0B0B0' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Arena
            </motion.span>
          </motion.div>
        </div>

        {/* Barra de progresso animada */}
        <div className="w-64 md:w-80 mx-auto mb-6">
          <div className="h-1 bg-surface/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #FFAA33, #FFD700, #FFAA33)'
              }}
              animate={{
                x: [-100, 300],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              initial={{ x: -100 }}
            />
          </div>
        </div>

        {/* Mensagem variada da Isis sobre agendamentos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="space-y-3"
        >
          <motion.p 
            className="text-base md:text-lg font-medium text-text-primary px-4"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {mensagemAleatoria}
          </motion.p>
          
          {/* Dots animados */}
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: '#FFAA33' }}
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
