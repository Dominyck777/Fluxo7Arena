import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Construction, Trophy } from 'lucide-react';

function PlaceholderPage({ title }) {
  return (
    <>
      <Helmet>
        <title>{title} - Fluxo7 Arena</title>
        <meta name="description" content={`Página de ${title} do sistema Fluxo7 Arena.`} />
      </Helmet>
      <motion.div 
        className="flex flex-col items-center justify-center h-full text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="p-6 bg-surface-2 rounded-full mb-8 border border-border"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Construction className="w-12 h-12 text-brand" />
        </motion.div>
        <h1 className="text-4xl font-bold text-text-primary mb-4">Página de {title}</h1>
        <p className="text-lg text-text-secondary max-w-md">
          Esta área está em construção! Em breve, você poderá gerenciar tudo relacionado a {title.toLowerCase()} por aqui.
        </p>
        {title === 'Suporte' && (
          <div className="mt-8 flex flex-col items-center">
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center mr-3">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex items-baseline text-2xl font-extrabold">
                <span style={{ color: '#FF6600' }}>Fluxo</span>
                <span style={{ color: '#FFAA33' }}>7</span>
                <span className="font-medium" style={{ color: '#B0B0B0' }}> Arena</span>
              </div>
            </div>
            <div className="text-sm text-text-secondary mt-1">2025 • todos os direitos reservados</div>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-text-muted">versão</span>
              <span className="text-sm font-semibold">v0.0.3</span>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}

export default PlaceholderPage;