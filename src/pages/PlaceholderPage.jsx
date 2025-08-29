import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

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
      </motion.div>
    </>
  );
}

export default PlaceholderPage;