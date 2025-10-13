import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Settings, CalendarRange, Coins, CreditCard, Building2 } from 'lucide-react';

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

function ConfiguracoesPage() {
  const { toast } = useToast();

  const notImpl = () =>
    toast({
      title: 'Configurações em desenvolvimento',
      description: 'Centralizaremos aqui parâmetros do sistema como horários, preços, pagamentos e integrações.',
    });

  return (
    <>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
        <motion.div variants={itemVariants} className="fx-card">
          <div className="flex items-center mb-3">
            <div className="h-10 w-10 rounded-md border border-white/10 bg-white/5 flex items-center justify-center mr-3 text-brand">
              <Settings className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">Preferências do Sistema</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <div className="flex items-center mb-2">
                <CalendarRange className="h-4 w-4 mr-2" />
                <p className="font-semibold">Horários e Feriados</p>
              </div>
              <p className="text-sm text-text-secondary mb-2">Defina horários de funcionamento, feriados e bloqueios.</p>
              <Button size="sm" onClick={notImpl} variant="outline">Configurar</Button>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <div className="flex items-center mb-2">
                <Coins className="h-4 w-4 mr-2" />
                <p className="font-semibold">Políticas de Preço</p>
              </div>
              <p className="text-sm text-text-secondary mb-2">Regras por modalidade, período e descontos.</p>
              <Button size="sm" onClick={notImpl} variant="outline">Configurar</Button>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <div className="flex items-center mb-2">
                <CreditCard className="h-4 w-4 mr-2" />
                <p className="font-semibold">Pagamentos</p>
              </div>
              <p className="text-sm text-text-secondary mb-2">Métodos aceitos, taxas e integrações (PIX/Cartão).</p>
              <Button size="sm" onClick={notImpl} variant="outline">Configurar</Button>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <div className="flex items-center mb-2">
                <Building2 className="h-4 w-4 mr-2" />
                <p className="font-semibold">Dados da Empresa</p>
              </div>
              <p className="text-sm text-text-secondary mb-2">Informações fiscais, logo e contatos.</p>
              <Button size="sm" onClick={notImpl} variant="outline">Configurar</Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

export default ConfiguracoesPage;
