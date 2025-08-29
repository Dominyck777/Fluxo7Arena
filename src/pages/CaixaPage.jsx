import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Banknote, Wallet, ArrowDownCircle, ArrowUpCircle, FileText, CalendarDays } from 'lucide-react';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: 'beforeChildren', staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function CaixaPage() {
  const { toast } = useToast();

  const notImpl = () =>
    toast({
      title: 'Funcionalidade em desenvolvimento',
      description: 'Fluxos completos de caixa (abertura/fechamento, sangria/suprimento) serão implementados aqui.',
    });

  return (
    <>
      <Helmet>
        <title>Caixa - Fluxo7 Arena</title>
        <meta name="description" content="Gestão do caixa: abertura, fechamento e movimentações." />
      </Helmet>

      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            <div className="fx-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-md border border-white/10 bg-white/5 flex items-center justify-center mr-3 text-brand">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold">Sessão do Caixa</h2>
                </div>
                <div className="flex gap-2">
                  <Button onClick={notImpl} size="sm">
                    <Wallet className="h-4 w-4 mr-2" /> Abrir Caixa
                  </Button>
                  <Button onClick={notImpl} variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" /> Fechar Caixa
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-surface-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Saldo Inicial</p>
                  <p className="text-2xl font-bold tabular-nums">R$ 0,00</p>
                </div>
                <div className="bg-surface-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Entradas</p>
                  <p className="text-2xl font-bold text-success tabular-nums">R$ 0,00</p>
                </div>
                <div className="bg-surface-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Saídas</p>
                  <p className="text-2xl font-bold text-danger tabular-nums">R$ 0,00</p>
                </div>
              </div>
            </div>
          </div>
          <div className="md:col-span-4">
            <div className="fx-card">
              <h3 className="text-base font-bold mb-3">Atalhos</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={notImpl} variant="outline" className="justify-start">
                  <ArrowUpCircle className="h-4 w-4 mr-2 text-success" /> Suprimento
                </Button>
                <Button onClick={notImpl} variant="outline" className="justify-start">
                  <ArrowDownCircle className="h-4 w-4 mr-2 text-danger" /> Sangria
                </Button>
                <Button onClick={notImpl} variant="outline" className="justify-start col-span-2">
                  <CalendarDays className="h-4 w-4 mr-2" /> Fechamentos Anteriores
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="fx-card">
          <h3 className="text-base font-bold mb-3">Movimentações do Dia</h3>
          <div className="text-sm text-text-secondary">Nenhuma movimentação registrada.</div>
        </motion.div>
      </motion.div>
    </>
  );
}

export default CaixaPage;
