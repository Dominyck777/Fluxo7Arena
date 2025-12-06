import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { listarItensDaComanda, listarClientesDaComanda, listarPagamentos } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

export default function PrintComandaPage() {
  const { userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const comandaId = searchParams.get('comanda');
  
  const [loading, setLoading] = useState(true);
  const [comanda, setComanda] = useState(null);
  const [itens, setItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [mesa, setMesa] = useState(null);
  const [observacoes, setObservacoes] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const loadComanda = async () => {
      try {
        if (!comandaId || !userProfile?.codigo_empresa) return;

        // Buscar nome_fantasia da empresa pela tabela empresas (coluna codigo_empresa)
        try {
          const { data: emp, error: empError } = await supabase
            .from('empresas')
            .select('nome_fantasia, nome')
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .single();

          if (empError) {
            console.warn('[PrintComandaPage] Erro ao buscar empresa:', empError.message);
          }

          if (emp) {
            const fantasia = emp.nome_fantasia || emp.nome || '';
            console.log('[PrintComandaPage] Empresa carregada:', emp, '-> nome exibido:', fantasia);
            setCompanyName(fantasia);
          } else {
            console.warn('[PrintComandaPage] Empresa não encontrada para codigo_empresa:', userProfile.codigo_empresa);
          }
        } catch (e) {
          console.warn('[PrintComandaPage] Exceção ao carregar empresa:', e);
        }

        // Buscar dados da comanda (mesa_id e observações)
        const { data: comandaData } = await supabase
          .from('comandas')
          .select('mesa_id, observacoes')
          .eq('id', comandaId)
          .eq('codigo_empresa', userProfile.codigo_empresa)
          .single();

        // Buscar dados da mesa se houver mesa_id
        if (comandaData?.mesa_id) {
          const { data: mesaData } = await supabase
            .from('mesas')
            .select('numero')
            .eq('id', comandaData.mesa_id)
            .eq('codigo_empresa', userProfile.codigo_empresa)
            .single();
          setMesa(mesaData);
        }

        setObservacoes(comandaData?.observacoes || '');

        const [itensData, clientesData, pagamentosData] = await Promise.all([
          listarItensDaComanda({ comandaId, codigoEmpresa: userProfile.codigo_empresa }),
          listarClientesDaComanda({ comandaId, codigoEmpresa: userProfile.codigo_empresa }),
          listarPagamentos({ comandaId, codigoEmpresa: userProfile.codigo_empresa })
        ]);

        setItens(itensData || []);
        setClientes(clientesData || []);
        setPagamentos(pagamentosData || []);

        // Calcular totais
        const totalItens = (itensData || []).reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0);
        const totalPagamentos = (pagamentosData || []).reduce((acc, p) => acc + Number(p.valor || 0), 0);

        setComanda({
          id: comandaId,
          totalItens,
          totalPagamentos,
          diferenca: totalPagamentos - totalItens
        });
      } catch (error) {
        console.error('Erro ao carregar comanda:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComanda();
  }, [comandaId, userProfile?.codigo_empresa]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-text-muted">Carregando comanda...</p>
        </div>
      </div>
    );
  }

  if (!comanda) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-text-muted mb-4">Comanda não encontrada</p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const clientesStr = (clientes || []).map(c => c?.nome || c?.nome_livre || '').filter(Boolean).join(', ') || 'Sem cliente';
  const totalItens = comanda.totalItens;
  const totalPagamentos = comanda.totalPagamentos;

  return (
    <div className="w-screen h-screen bg-gray-100 flex flex-col print:bg-white print:p-0">
      {/* Botões de controle (ocultos na impressão) */}
      <div className="flex gap-2 p-4 bg-white border-b border-gray-200 print:hidden">
        <Button
          onClick={handleBack}
          size="sm"
          className="bg-black text-white hover:bg-black/80 border border-black shadow-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={handlePrint} size="sm" className="ml-auto">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Conteúdo da Comanda */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 print:p-0 print:overflow-visible print:flex-none">
        <div className="w-80 border border-black p-6 bg-white print:border-0 print:p-0 print:w-full">
        {/* Cabeçalho */}
        <div className="text-center mb-4 border-b border-black pb-3">
          <p className="text-xs font-semibold text-black mb-2">{companyName || ' '}</p>
          <h1 className="text-xl font-bold text-black">COMANDA</h1>
          {mesa && <p className="text-xs text-black mt-1">Mesa {mesa.numero}</p>}
          <p className="text-xs text-black mt-1">{new Date().toLocaleString('pt-BR')}</p>
        </div>

        {/* Cliente */}
        <div className="mb-6 pb-4 border-b border-black">
          <p className="text-sm font-semibold text-black">CLIENTE:</p>
          <p className="text-sm text-black">{clientesStr}</p>
        </div>

        {/* Itens */}
        <div className="mb-6 pb-4 border-b border-black">
          <div className="space-y-2">
            {itens.map((item, idx) => {
              const subtotal = Number(item.quantidade || 0) * Number(item.preco_unitario || 0);
              return (
                <div key={idx} className="flex justify-between text-sm text-black">
                  <div className="flex-1">
                    <span>{item.descricao || 'Item'}</span>
                    <span className="ml-2 text-xs">x{item.quantidade}</span>
                  </div>
                  <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Observações */}
        {observacoes && (
          <div className="mb-4 pb-3">
            <p className="text-xs font-semibold text-black mb-1">OBS:</p>
            <p className="text-xs text-black border-b border-black pb-3">{observacoes}</p>
          </div>
        )}

        {/* Total Final */}
        <div className="text-center pt-4">
          <p className="text-lg font-bold text-black mt-2">TOTAL: R$ {comanda.totalItens.toFixed(2)}</p>
        </div>

          {/* Rodapé */}
          <div className="text-center mt-8 pt-4 border-t border-black text-xs text-black">
            <p>Obrigado pela preferência!</p>
            <p className="mt-2">Fluxo7Arena</p>
          </div>
        </div>
      </div>

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-0 {
            border: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
