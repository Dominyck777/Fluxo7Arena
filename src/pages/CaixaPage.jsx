import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Banknote, Wallet, ArrowDownCircle, ArrowUpCircle, FileText, CalendarDays } from 'lucide-react';
import { ensureCaixaAberto, fecharCaixa, listarFechamentosCaixa } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';

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
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [history, setHistory] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadHistory = async () => {
    try {
      setLoading(true);
      const rows = await listarFechamentosCaixa({ from, to, limit: 50, codigoEmpresa: userProfile?.codigo_empresa });
      setHistory(rows || []);
    } catch (e) {
      toast({ title: 'Falha ao carregar histórico', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userProfile?.codigo_empresa]);

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
                  <Button onClick={async () => {
                    try {
                      setLoading(true);
                      await ensureCaixaAberto({ codigoEmpresa: userProfile?.codigo_empresa });
                      toast({ title: 'Caixa aberto', description: 'Sessão iniciada com sucesso.' });
                    } catch (e) {
                      toast({ title: 'Falha ao abrir caixa', description: e?.message || 'Tente novamente', variant: 'destructive' });
                    } finally { setLoading(false); }
                  }} size="sm" disabled={loading}>
                    <Wallet className="h-4 w-4 mr-2" /> Abrir Caixa
                  </Button>
                  <Button onClick={async () => {
                    try {
                      setClosing(true);
                      await fecharCaixa({ saldoFinal: 0, codigoEmpresa: userProfile?.codigo_empresa });
                      toast({ title: 'Caixa fechado', description: 'Fechamento registrado no histórico.' });
                      loadHistory();
                    } catch (e) {
                      toast({ title: 'Falha ao fechar caixa', description: e?.message || 'Verifique comandas abertas (mesas e balcão).', variant: 'destructive' });
                    } finally { setClosing(false); }
                  }} variant="outline" size="sm" disabled={closing}>
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
                <Button onClick={() => toast({ title: 'Em breve', description: 'Suprimento será implementado em breve.' })} variant="outline" className="justify-start">
                  <ArrowUpCircle className="h-4 w-4 mr-2 text-success" /> Suprimento
                </Button>
                <Button onClick={() => toast({ title: 'Em breve', description: 'Sangria será implementada em breve.' })} variant="outline" className="justify-start">
                  <ArrowDownCircle className="h-4 w-4 mr-2 text-danger" /> Sangria
                </Button>
                <Button onClick={loadHistory} variant="outline" className="justify-start col-span-2" disabled={loading}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Fechamentos Anteriores
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="fx-card">
          <div className="flex items-end justify-between mb-3">
            <h3 className="text-base font-bold">Fechamentos Anteriores</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">De</span>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">Até</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px]" />
              </div>
              <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>Filtrar</Button>
            </div>
          </div>
          {(!history || history.length === 0) ? (
            <div className="text-sm text-text-secondary">Nenhum fechamento encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="py-2">ID</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Aberto em</th>
                    <th className="py-2">Fechado em</th>
                    <th className="py-2">Saldo Inicial</th>
                    <th className="py-2">Saldo Final</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="py-2">{h.id}</td>
                      <td className="py-2 capitalize">{h.status}</td>
                      <td className="py-2">{h.aberto_em ? new Date(h.aberto_em).toLocaleString() : '—'}</td>
                      <td className="py-2">{h.fechado_em ? new Date(h.fechado_em).toLocaleString() : '—'}</td>
                      <td className="py-2">R$ {(Number(h.saldo_inicial || 0)).toFixed(2)}</td>
                      <td className="py-2">R$ {(Number(h.saldo_final || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}

export default CaixaPage;
