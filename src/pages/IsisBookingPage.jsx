import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IsisProvider, useIsis } from '@/contexts/IsisContext';
import { IsisChat } from '@/components/isis/IsisChat';
import { IsisInput } from '@/components/isis/IsisInput';
import { IsisHorarioInput } from '@/components/isis/IsisHorarioInput';
import { IsisIdentificacaoInput } from '@/components/isis/IsisIdentificacaoInput';
import { IsisCadastroInput } from '@/components/isis/IsisCadastroInput';
import { IsisParticipantesInput } from '@/components/isis/IsisParticipantesInput';
import { IsisResponseButtons } from '@/components/isis/IsisResponseButtons';
import { IsisAvatar } from '@/components/isis/IsisAvatar';
import { IsisAvaliacaoInput } from '@/components/isis/IsisAvaliacaoInput';
import { IsisPremiumLoading } from '@/components/isis/IsisPremiumLoading';
import { getIsisMessage } from '@/lib/isisMessages';
import { supabase } from '@/lib/supabase';
import { adicionarFeedbackIsis } from '@/lib/jsonbinService';
import { format, addDays, startOfDay, setHours, setMinutes, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, Clock, Users, MapPin, Bot, Trophy, Building2 } from 'lucide-react';

/**
 * Página principal do agendamento via Isis
 */
const IsisBookingPageContent = () => {
  const { nomeFantasia } = useParams();
  const nomeFantasiaHost = React.useMemo(() => {
    try {
      if (typeof window === 'undefined') return null;
      const host = window.location.host || '';
      const base = 'f7arena.com';
      if (!host.endsWith(base)) return null;
      const sub = host.slice(0, -base.length).replace(/\.$/, '');
      if (!sub) return null; // apex
      const subLower = sub.toLowerCase();
      if (subLower === 'www') return null;
      return subLower; // nomedaempresa
    } catch { return null; }
  }, []);
  const nomeFantasiaEfetivo = nomeFantasia || nomeFantasiaHost;
  const navigate = useNavigate();
  const [codigoEmpresa, setCodigoEmpresa] = useState(null);
  
  const {
    currentStep,
    selections,
    addIsisMessage,
    addIsisMessageWithButtons,
    addUserMessage,
    disableAllButtons,
    removeMessageById,
    hideButtonsInMessage,
    updateSelection,
    updateContact,
    nextStep,
    setIsLoading,
    setIsTyping,
    chatEndRef
  } = useIsis();
  
  const [empresa, setEmpresa] = useState(null);
  const [quadras, setQuadras] = useState([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [tipoIdentificacao, setTipoIdentificacao] = useState('telefone'); // 'telefone' ou 'email'
  const [showInput, setShowInput] = useState(false); // Controla quando mostrar input
  const [editingType, setEditingType] = useState(null); // Controla qual tipo de edição está ativa: 'participantes', 'horario', etc.
  const [agendamentoCriado, setAgendamentoCriado] = useState(null); // Armazena o agendamento criado para edições posteriores
  const [identificacaoIniciada, setIdentificacaoIniciada] = useState(false); // Flag para evitar múltiplas execuções
  const [deferredPrompt, setDeferredPrompt] = useState(null); // Guardar evento de instalação PWA
  
  // Logo da empresa com cache-buster (igual ao Header principal)
  const empresaLogoSrc = React.useMemo(() => {
    console.log('[Isis] Logo da empresa:', { logo_url: empresa?.logo_url, empresa });
    if (empresa?.logo_url) return `${empresa.logo_url}?v=${Date.now()}`;
    return empresa?.logo_url || '';
  }, [empresa?.logo_url]);
  
  // Busca código da empresa pelo nome fantasia (rota ou subdomínio)
  useEffect(() => {
    const buscarEmpresaPorNome = async () => {
      if (!nomeFantasiaEfetivo) {
        setLoadingEmpresa(false);
        return;
      }
      
      try {
        console.log('[Isis] Buscando empresa por nome fantasia:', nomeFantasiaEfetivo);
        
        // Busca empresa pelo nome fantasia (URL-friendly)
        const nomeDecodificado = decodeURIComponent(nomeFantasiaEfetivo);
        
        // Normaliza o nome para busca flexível (remove espaços, hífens, etc.)
        const nomeNormalizado = nomeDecodificado
          .toLowerCase()
          .replace(/[\s\-_]+/g, '') // Remove espaços, hífens e underscores
          .trim();
        
        console.log('[Isis] Nome normalizado para busca:', nomeNormalizado);
        // 1) Tenta via RPC (melhor para contornar RLS). Se a função não existir, cai no fallback abaixo.
        let empresaEncontradaViaRpc = null;
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('get_empresa_public_by_slug', { p_slug: nomeNormalizado });
          if (!rpcErr && rpcData && rpcData.length > 0) {
            empresaEncontradaViaRpc = rpcData[0];
          }
        } catch (_) {}

        let empresaFinal = empresaEncontradaViaRpc || null;

        // 2) Fallback local: tenta selecionar e filtrar (pode falhar por RLS). Inclui 'nome' como candidato.
        if (!empresaFinal) {
          const { data: todasEmpresas, error } = await supabase
            .from('empresas')
            .select('codigo_empresa, nome_fantasia, razao_social, nome, logo_url');

          if (!error && Array.isArray(todasEmpresas)) {
            const emp = todasEmpresas.find((e) => {
              const candidatos = [
                (e?.nome_fantasia || ''),
                (e?.razao_social || ''),
                (e?.nome || ''),
              ];
              return candidatos.some((c) => c.toLowerCase().replace(/[\s\-_]+/g, '').trim() === nomeNormalizado);
            });
            if (emp) empresaFinal = emp;
          }
        }

        if (!empresaFinal) {
          console.error('[Isis] Empresa não encontrada (RPC e fallback)');
          setCodigoEmpresa(null);
          setLoadingEmpresa(false);
          return;
        }

        console.log('[Isis] Empresa encontrada:', empresaFinal);
        setCodigoEmpresa(empresaFinal.codigo_empresa);
        setEmpresa(empresaFinal);
        setLoadingEmpresa(false);
        
      } catch (error) {
        console.error('[Isis] Erro ao buscar empresa:', error);
        setCodigoEmpresa(null);
        setLoadingEmpresa(false);
      }
    };
    
    buscarEmpresaPorNome();
  }, [nomeFantasiaEfetivo]);

  // Captura o evento de instalação PWA para disparar quando o usuário clicar em "Instalar App"
  useEffect(() => {
    const handler = (e) => {
      try { e.preventDefault(); } catch {}
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  
  // Inicia conversa com identificação do cliente
  useEffect(() => {
    console.log('[DEBUG] useEffect iniciarConversa:', {
      codigoEmpresa,
      loadingEmpresa,
      hasCliente: !!selections.cliente,
      identificacaoIniciada,
      timestamp: new Date().toISOString()
    });
    
    if (!codigoEmpresa || loadingEmpresa) {
      console.log('[DEBUG] Saindo - sem código ou ainda carregando');
      return;
    }
    
    // Verifica se já tem cliente identificado ou se identificação já foi iniciada
    if (!selections.cliente && !identificacaoIniciada) {
      console.log('[DEBUG] Cliente não identificado e identificação não iniciada, agendando iniciarIdentificacao em 1s');
      setIdentificacaoIniciada(true); // Marca como iniciada para evitar duplicação
      
      // Aguarda mais tempo para garantir que o loading premium saiu completamente da tela
      setTimeout(() => {
        console.log('[DEBUG] Executando iniciarIdentificacao após delay (loading fora da tela)');
        iniciarIdentificacao();
      }, 2500); // 2.5 segundos adicionais após loading premium terminar
    } else {
      console.log('[DEBUG] Cliente já identificado ou identificação já iniciada, não fazendo nada');
    }
  }, [codigoEmpresa, loadingEmpresa, selections.cliente, identificacaoIniciada]);
  
  // Carrega dados da empresa
  useEffect(() => {
    const initializeApp = async () => {
      if (!codigoEmpresa) {
        setLoadingEmpresa(false);
        return;
      }
      
      try {
        // Define empresa atual na sessão do Supabase para RLS
        console.log('[useEffect] Definindo empresa atual para RLS:', codigoEmpresa);
        await supabase.rpc('set_current_empresa', { 
          empresa_codigo: String(codigoEmpresa) 
        });
        
        // Agora carrega dados da empresa
        await loadEmpresa();
      } catch (error) {
        console.error('[useEffect] Erro ao definir empresa para RLS:', error);
        // Se falhar, tenta carregar sem RLS
        await loadEmpresa();
      }
    };
    
    initializeApp();
  }, [codigoEmpresa]);
  
  // Função para obter cumprimento baseado no horário
  const getCumprimentoPorHorario = () => {
    const agora = new Date();
    const hora = agora.getHours();
    
    if (hora >= 5 && hora < 12) {
      return 'Bom dia';
    } else if (hora >= 12 && hora < 18) {
      return 'Boa tarde';
    } else {
      return 'Boa noite';
    }
  };

  // Inicia identificação do cliente
  const iniciarIdentificacao = () => {
    console.log('[DEBUG] iniciarIdentificacao INICIOU:', {
      loadingEmpresa,
      empresa: empresa?.nome_fantasia,
      timestamp: new Date().toISOString()
    });
    
    setTipoIdentificacao('telefone'); // Sempre inicia com telefone
    setShowInput(false); // Esconde input inicialmente
    
    const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Arena Palace';
    const cumprimento = getCumprimentoPorHorario();
    
    // Mensagem única de boas-vindas com identificação
    const mensagensBoasVindas = [
      `**${cumprimento}!** Tudo bem? 😊\n\nSou a **Ísis**, assistente virtual da **${nomeEmpresa}** e estou aqui para tornar seu **agendamento** super fácil!\n\nPara começar, qual seu **telefone** ou **e-mail**?`,
      `Hey! **${cumprimento}!** ⚽ **Ísis** na área!\n\nSou a assistente virtual da **${nomeEmpresa}** e vim facilitar sua vida.\n\nBora **agendar**? Me passa seu **telefone** ou **e-mail**:`,
      `**${cumprimento}!** Prazer em te atender! 💪\n\nSou a **Ísis** da **${nomeEmpresa}**, sua assistente virtual para **agendamentos**.\n\nPara começar, preciso do seu **telefone** ou **e-mail**:`,
      `Opa! **${cumprimento}!** 🎾 **Ísis** aqui, sua assistente virtual da **${nomeEmpresa}**!\n\nVamos **marcar seu horário**? É rapidinho!\n\nMe informa seu **telefone** ou **e-mail**:`,
      `**${cumprimento}!** Seja bem-vindo! 🤗\n\nEu sou a **Ísis**, sua assistente virtual aqui na **${nomeEmpresa}**.\n\nVou te ajudar a **agendar seu horário** rapidinho!\n\nInforme seu **telefone** ou **e-mail**:`
    ];
    
    const randomIndex = Math.floor(Math.random() * mensagensBoasVindas.length);
    console.log('[DEBUG] Mostrando indicador de digitação primeiro:', {
      loadingEmpresa,
      timestamp: new Date().toISOString()
    });
    
    // Primeiro mostra o indicador de "digitando" (...)
    setIsTyping(true);
    
    // Scroll logo após começar a digitar (para mostrar o indicador)
    setTimeout(() => {
      console.log('[DEBUG] Fazendo scroll inicial para mostrar indicador de digitação');
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300); // 300ms após começar a digitar
    
    // Depois de um tempo, remove o indicador e mostra a mensagem
    setTimeout(() => {
      console.log('[DEBUG] Enviando mensagem da Isis após indicador de digitação');
      setIsTyping(false);
      addIsisMessage(mensagensBoasVindas[randomIndex], 0); // Sem delay adicional pois já esperou
      
      // Scroll novamente após mensagem aparecer
      setTimeout(() => {
        console.log('[DEBUG] Fazendo scroll após mensagem aparecer');
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }, 3500); // 3.5 segundos mostrando "digitando"
    
    // Mostra input após mensagem aparecer
    setTimeout(() => {
      console.log('[DEBUG] Mostrando input');
      setShowInput(true);
      // Scroll novamente quando input aparecer
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 200);
    }, 3500 + 600); // 3.5s do indicador + 600ms
    
    nextStep('identificacao');
  };
  
  // Busca cliente por telefone ou email
  const buscarCliente = async (valor) => {
    try {
      console.log('[DEBUG] Buscando cliente com valor:', valor);
      console.log('[DEBUG] Código empresa:', codigoEmpresa);
      
      // Remove caracteres especiais do telefone para busca
      const valorLimpo = valor.replace(/\D/g, '');
      
      // Se for número (telefone), busca por telefone/whatsapp/celular1 que contenha os dígitos
      if (valorLimpo.length >= 10) {
        console.log('[DEBUG] Buscando telefone:', valorLimpo);
        
        // Busca TODOS os clientes ativos da empresa e filtra no JavaScript
        // (mais confiável do que queries complexas com .or())
        const { data: todosClientes, error } = await supabase
          .from('clientes')
          .select('id, nome, email, telefone, whatsapp, celular1, codigo')
          .eq('codigo_empresa', codigoEmpresa)
          .eq('status', 'active');
        
        if (error) throw error;
        
        console.log('[DEBUG] Total de clientes ativos:', todosClientes?.length);
        
        // Filtra no JavaScript procurando o telefone sem máscara
        const clienteEncontrado = todosClientes?.find(c => {
          const tel = (c.telefone || '').replace(/\D/g, '');
          const whats = (c.whatsapp || '').replace(/\D/g, '');
          const cel = (c.celular1 || '').replace(/\D/g, '');
          
          return tel.includes(valorLimpo) || 
                 whats.includes(valorLimpo) || 
                 cel.includes(valorLimpo);
        });
        
        console.log('[DEBUG] Cliente encontrado:', clienteEncontrado);
        
        return clienteEncontrado || null;
      }
      
      // Se não for número, busca por email
      const { data: clientes, error } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, whatsapp, codigo')
        .eq('codigo_empresa', codigoEmpresa)
        .eq('status', 'active')
        .ilike('email', `%${valor}%`);
      
      console.log('[DEBUG] Busca por email - Clientes encontrados:', clientes);
      
      if (error) throw error;
      return clientes?.[0] || null;
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      return null;
    }
  };
  
  // Extrai primeiro e segundo nome
  const getNomeCurto = (nomeCompleto) => {
    const partes = nomeCompleto.trim().split(' ').filter(p => p);
    if (partes.length === 1) return partes[0];
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return partes[0];
  };

  // Handler para data customizada
  const handleDataCustomizada = async (dataTexto) => {
    if (!dataTexto) {
      addIsisMessage('Por favor, informe a data desejada.', 400);
      return;
    }

    // Valida formato DD/MM/AAAA
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dataTexto.match(regex);
    
    if (!match) {
      addIsisMessage('**Formato inválido!** Por favor, use o formato DD/MM/AAAA (exemplo: 15/12/2024)', 400);
      return;
    }

    const [, dia, mes, ano] = match;
    const dataEscolhida = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    
    // Valida se a data é válida
    if (isNaN(dataEscolhida.getTime()) || 
        dataEscolhida.getDate() !== parseInt(dia) ||
        dataEscolhida.getMonth() !== parseInt(mes) - 1 ||
        dataEscolhida.getFullYear() !== parseInt(ano)) {
      addIsisMessage('**Data inválida!** Verifique se o dia, mês e ano estão corretos.', 400);
      return;
    }

    // Valida se a data não é no passado
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataEscolhida.setHours(0, 0, 0, 0);
    
    if (dataEscolhida < hoje) {
      addIsisMessage('**Data no passado!** Por favor, escolha uma data de hoje em diante.', 400);
      return;
    }

    // Data válida - verifica funcionamento ANTES de confirmar
    addUserMessage(dataTexto);
    
    // Formata data para exibição
    const dataFormatada = format(dataEscolhida, "dd/MM/yyyy", { locale: ptBR });
    const diaSemana = format(dataEscolhida, "EEEE", { locale: ptBR });

    // Carrega horários disponíveis para verificar se a quadra funciona
    setIsLoading(true);
    const resultado = await loadHorariosDisponiveis(selections.quadra.id, dataEscolhida);
    setIsLoading(false);

    // Verifica se a quadra está fechada ANTES de confirmar
    if (resultado.fechada) {
      if (resultado.motivo === 'data_especifica') {
        addIsisMessage(`**Ops!** A quadra estará **fechada** no dia **${dataFormatada}** (${diaSemana}). 🚫\n\n**Motivo:** ${resultado.observacao}`, 800);
      } else if (resultado.motivo === 'dia_semana') {
        const diaDaSemana = format(dataEscolhida, "EEEE", { locale: ptBR });
        const preposicao = diaDaSemana === 'domingo' || diaDaSemana === 'sábado' ? 'aos' : 'às';
        addIsisMessage(`**Ops!** A quadra não funciona ${preposicao} **${diaDaSemana}s**. 🚫\n\nEscolha outro dia da semana!`, 800);
      }
      
      // Reativa input imediatamente
      setTimeout(() => {
        addIsisMessage('Digite **outra data** no formato DD/MM/AAAA:', 1200);
        setTimeout(() => {
          setShowInput(true);
          // Scroll após input aparecer
          setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }, 400);
      }, 1200);
      return;
    }

    // Só confirma a data se a quadra funcionar
    updateSelection('data', dataEscolhida);
    setShowInput(false);
    setTipoIdentificacao('telefone'); // Reseta para telefone
    
    addIsisMessage(`**Perfeito!** Data escolhida: **${dataFormatada}** (${diaSemana}) 📅`, 600);

    const slots = resultado.slots;
    if (slots.length === 0) {
      addIsisMessage('Ops! Não encontrei **horários disponíveis** para esse dia. 😔 Que tal tentar outra data?', 800);
      // Volta para seleção de data
      setTimeout(() => {
        perguntarData();
      }, 1200);
      return;
    }

    // Agrupa slots em intervalos contínuos
    const intervalos = agruparSlotsEmIntervalos(slots);
    
    // Monta mensagem com os intervalos
    let msgIntervalos = '';
    if (intervalos.length === 1) {
      msgIntervalos = `Tenho **horários livres** das **${intervalos[0].inicio}** às **${intervalos[0].fim}**! 🕒`;
    } else {
      const partes = intervalos.map((int, idx) => {
        if (idx === intervalos.length - 1) {
          return `e das **${int.inicio}** às **${int.fim}**`;
        } else if (idx === 0) {
          return `das **${int.inicio}** às **${int.fim}**`;
        } else {
          return `das **${int.inicio}** às **${int.fim}**`;
        }
      });
      msgIntervalos = `Tenho **horários livres** ${partes.join(', ')}! 🕒`;
    }

    addIsisMessage(msgIntervalos, 1000);

    setTimeout(() => {
      addIsisMessage('Escolha o horário de início e término: ⏰', 1200);
      nextStep('horario');
      
      // Mostra input após mensagem aparecer
      setTimeout(() => {
        setShowInput(true);
        // Scroll após input aparecer
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }, 1000);
    }, 1600);
  };
  
  // Handler para identificação (telefone, email ou data customizada)
  const handleIdentificacaoSubmit = async (valor) => {
    // Se é data customizada, processa diferente
    if (tipoIdentificacao === 'data_custom') {
      return await handleDataCustomizada(valor);
    }
    
    if (!valor) {
      addIsisMessage('Por favor, informe seu telefone ou e-mail.', 400);
      return;
    }
    
    // Formata para exibição (telefone com máscara)
    const valorExibicao = tipoIdentificacao === 'telefone' 
      ? `(${valor.slice(0,2)}) ${valor.slice(2,7)}-${valor.slice(7)}`
      : valor;
    
    addUserMessage(valorExibicao);
    // setIsLoading(true); // Removido para usar apenas indicador de digitando
    
    const cliente = await buscarCliente(valor);
    
    // setIsLoading(false); // Removido para usar apenas indicador de digitando
    
    if (cliente) {
      // Cliente encontrado!
      updateSelection('cliente', cliente);
      setShowInput(false); // Esconde input
      
      const nomeCurto = getNomeCurto(cliente.nome);
      
      // Variações de mensagem de boas-vindas após identificação (sem repetir cumprimento)
      const saudacoes = [
        `**${nomeCurto}!** 👋`,
        `Opa, **${nomeCurto}!** 😊`,
        `E aí, **${nomeCurto}!** 🎾`,
        `**${nomeCurto}!** Que bom te ver! 👋`,
        `Fala, **${nomeCurto}!** 💪`,
        `**${nomeCurto}!** Tudo bem? 😊`,
        `Hey, **${nomeCurto}!** 🏐`
      ];
      
      const randomIndex = Math.floor(Math.random() * saudacoes.length);
      addIsisMessage(saudacoes[randomIndex], 600);
      
      setTimeout(() => {
        perguntarAcaoInicial();
      }, 1000);
    } else {
      // Cliente não encontrado, pedir cadastro completo
      // Salva o valor formatado (com máscara) que o usuário digitou
      updateSelection('identificacao_valor', valorExibicao);
      updateSelection('identificacao_tipo', tipoIdentificacao);
      setShowInput(false); // Esconde input
      
      addIsisMessage('Não encontrei seu cadastro. Sem problemas! Vamos fazer rapidinho. 😊', 800);
      addIsisMessage('Preciso de algumas informações:', 1400);
      
      // Mostra input de cadastro após mensagens
      setTimeout(() => {
        setShowInput(true);
        // Rola PARA CIMA após input aparecer (mobile)
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 600);
      }, 1400 + 800);
      
      nextStep('cadastro');
    }
  };
  
  // Handler para cadastro completo de novo cliente
  const handleCadastroSubmit = async (dados) => {
    // Formata para exibição
    let mensagem = `Nome: ${dados.nome}`;
    if (dados.telefone) {
      const telefoneFormatado = `(${dados.telefone.slice(0,2)}) ${dados.telefone.slice(2,7)}-${dados.telefone.slice(7)}`;
      mensagem += `\nTelefone: ${telefoneFormatado}`;
    }
    if (dados.email) {
      mensagem += `\nE-mail: ${dados.email}`;
    }
    
    addUserMessage(mensagem);
    
    // Cria o cliente no banco
    await criarNovoCliente(dados.nome, dados.email, dados.telefone);
  };
  
  // Cria novo cliente no banco
  const criarNovoCliente = async (nome, email, telefone) => {
    try {
      setIsLoading(true);
      
      // Verificar duplicidade por telefone/email antes de criar
      try {
        // 1) Telefone: procurar cliente ativo com mesmo número (telefone/whatsapp/celular1)
        if (telefone) {
          const numeroLimpo = String(telefone || '').replace(/\D/g, '');
          const { data: todosClientes, error: dupErrTel } = await supabase
            .from('clientes')
            .select('id, nome, email, telefone, whatsapp, celular1, codigo')
            .eq('codigo_empresa', codigoEmpresa)
            .eq('status', 'active');
          if (!dupErrTel && Array.isArray(todosClientes)) {
            const matchTel = todosClientes.find(c => {
              const tel = (c.telefone || '').replace(/\D/g, '');
              const whats = (c.whatsapp || '').replace(/\D/g, '');
              const cel = (c.celular1 || '').replace(/\D/g, '');
              return tel === numeroLimpo || whats === numeroLimpo || cel === numeroLimpo;
            });
            if (matchTel) {
              setIsLoading(false);
              updateSelection('cliente_sugerido', matchTel);
              addIsisMessageWithButtons(
                `Encontrei um cadastro existente para este telefone: **${getNomeCurto(matchTel.nome)}**. É você?`,
                [
                  { label: '✅ Sim, sou eu', value: 'confirm_cliente_existente' },
                  { label: '❌ Não, quero corrigir', value: 'corrigir_cadastro' }
                ],
                200
              );
              setShowInput(false);
              nextStep('confirmar_cliente_existente');
              return; // aguarda confirmação do usuário
            }
          }
        }
        // 2) Email: procurar cliente ativo com mesmo email (case-insensitive)
        if (email) {
          const emailLc = String(email || '').trim().toLowerCase();
          const { data: clientesEmail, error: dupErrEmail } = await supabase
            .from('clientes')
            .select('id, nome, email, telefone, whatsapp, codigo')
            .eq('codigo_empresa', codigoEmpresa)
            .eq('status', 'active')
            .ilike('email', emailLc);
          if (!dupErrEmail && Array.isArray(clientesEmail) && clientesEmail.length > 0) {
            const matchEmail = clientesEmail.find(c => String(c.email || '').trim().toLowerCase() === emailLc) || null;
            if (matchEmail) {
              setIsLoading(false);
              updateSelection('cliente_sugerido', matchEmail);
              addIsisMessageWithButtons(
                `Este e-mail já possui cadastro: **${getNomeCurto(matchEmail.nome)}**. É você?`,
                [
                  { label: '✅ Sim, sou eu', value: 'confirm_cliente_existente' },
                  { label: '❌ Não, quero corrigir', value: 'corrigir_cadastro' }
                ],
                200
              );
              setShowInput(false);
              nextStep('confirmar_cliente_existente');
              return; // aguarda confirmação do usuário
            }
          }
        }
      } catch {}

      // Prosseguindo com criação: exibe loading agora (não antes da pergunta)
      addIsisMessage(getIsisMessage('loading'));

      // Busca próximo código disponível
      const { data: counter } = await supabase
        .from('empresa_counters')
        .select('next_cliente_codigo')
        .eq('empresa_id', empresa?.id)
        .single();
      
      const proximoCodigo = counter?.next_cliente_codigo || 1;
      
      // Cria cliente
      const { data: novoCliente, error } = await supabase
        .from('clientes')
        .insert({
          codigo_empresa: codigoEmpresa,
          codigo: proximoCodigo,
          nome,
          email: email || null,
          telefone,
          whatsapp: telefone,
          status: 'active'
        })
        .select('id, nome, email, telefone, whatsapp, codigo')
        .single();
      
      if (error) {
        // Se for erro de código duplicado, tenta novamente com próximo código
        if (error.code === '23505' && error.message.includes('uq_clientes_empresa_codigo')) {
          console.log('[Isis] Código duplicado, tentando próximo código...');
          
          // Tenta com próximo código disponível
          const { data: novoClienteRetry, error: errorRetry } = await supabase
            .from('clientes')
            .insert({
              codigo_empresa: codigoEmpresa,
              codigo: proximoCodigo + 1,
              nome,
              email: email || null,
              telefone,
              whatsapp: telefone,
              status: 'active'
            })
            .select('id, nome, email, telefone, whatsapp, codigo')
            .single();
          
          if (errorRetry) throw errorRetry;
          
          // Atualiza counter para código + 2
          await supabase
            .from('empresa_counters')
            .update({ next_cliente_codigo: proximoCodigo + 2 })
            .eq('empresa_id', empresa?.id);
          
          setIsLoading(false);
          updateSelection('cliente', novoClienteRetry);
          
          addIsisMessage(`Pronto, ${nome}! Cadastro realizado com sucesso! 🎉`, 800);
          
          setTimeout(() => {
            iniciarAgendamento();
          }, 1400);
          
          return;
        }
        
        throw error;
      }
      
      // Atualiza counter para próximo código
      await supabase
        .from('empresa_counters')
        .update({ next_cliente_codigo: proximoCodigo + 1 })
        .eq('empresa_id', empresa?.id);
      
      setIsLoading(false);
      updateSelection('cliente', novoCliente);
      
      addIsisMessage(`Pronto, ${nome}! Cadastro realizado com sucesso! 🎉`, 800);
      
      setTimeout(() => {
        iniciarAgendamento();
      }, 1400);
      
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      setIsLoading(false);
      addIsisMessage('Ops! Erro ao criar cadastro. Tente novamente.', 400);
    }
  };
  
  // Mostra seleção de data
  const mostrarSelecaoData = () => {
    const hoje = new Date();
    const amanha = addDays(hoje, 1);
    
    const dataButtons = [
      {
        label: `Hoje (${format(hoje, 'dd/MM')})`,
        value: format(hoje, 'yyyy-MM-dd'),
        icon: '📅',
        date: hoje
      },
      {
        label: `Amanhã (${format(amanha, 'dd/MM')})`,
        value: format(amanha, 'yyyy-MM-dd'),
        icon: '📅',
        date: amanha
      },
      {
        label: 'Outro dia...',
        value: 'custom',
        icon: '📅'
      }
    ];
    
    addIsisMessageWithButtons('Para qual dia você gostaria de agendar?', dataButtons, 600);
    nextStep('data');
  };

  // Handler para mudar data no input de horário
  const handleMudarData = () => {
    addUserMessage('📅 Mudar Data');
    setShowInput(false);
    
    // Volta para seleção de data
    setTimeout(() => {
      mostrarSelecaoData();
    }, 400);
  };
  
  // Pergunta se quer agendar ou editar agendamento
  const perguntarAcaoInicial = () => {
    const perguntasVariadas = [
      'O que você gostaria de fazer hoje?',
      'Como posso te ajudar?',
      'Qual é o plano para hoje?',
      'O que vamos fazer?',
      'Em que posso te auxiliar?',
      'Qual sua necessidade hoje?',
      'Como posso ser útil?'
    ];
    
    const randomPergunta = perguntasVariadas[Math.floor(Math.random() * perguntasVariadas.length)];
    
    const acaoButtons = [
      {
        label: 'Fazer Agendamento',
        value: 'novo_agendamento',
        icon: '📅'
      },
      {
        label: 'Editar Agendamento',
        value: 'buscar_agendamento',
        icon: '✏️'
      },
      {
        label: 'Informei o telefone errado',
        value: 'corrigir_telefone',
        icon: '☎️'
      },
      // Inserimos o botão de instalar app antes de finalizar
      {
        label: 'Instalar App',
        value: 'instalar_app',
        icon: '📲'
      },
      {
        label: 'Finalizar Atendimento',
        value: 'finalizar_atendimento',
        icon: '👋'
      }
    ];
    // Se o usuário tentou identificar por e-mail, oferece correção de e-mail também
    if (tipoIdentificacao === 'email' || selections?.identificacao_tipo === 'email') {
      acaoButtons.splice(3, 0, {
        label: 'Informei o e-mail errado',
        value: 'corrigir_email',
        icon: '✉️'
      });
    }
    
    addIsisMessageWithButtons(randomPergunta, acaoButtons, 600);
  };

  // Mostra um tutorial rápido de instalação PWA (Chrome e Safari)
  const mostrarTutorialInstalacao = () => {
    try {
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
      if (isStandalone) {
        addIsisMessage('Você já está com o app instalado! 🎉 Abra-o diretamente da sua tela inicial.', 400);
        return;
      }
      const chromeSteps = [
        'Toque no ícone ⋮ no canto superior direito',
        'Escolha "Adicionar à tela inicial"',
        'Confirme em "Adicionar"'
      ].map(s => `• ${s}`).join('\n');
      const safariSteps = [
        'Toque no botão Compartilhar (ícone de quadrado com seta para cima)',
        'Escolha "Adicionar à Tela de Início"',
        'Toque em "Adicionar" no topo'
      ].map(s => `• ${s}`).join('\n');
      const msg = (isIOS || isSafari)
        ? `📲 Para instalar no Safari (iPhone/iPad):\n${safariSteps}`
        : `📲 Para instalar no Chrome (Android):\n${chromeSteps}`;
      addIsisMessage(msg, 600);
    } catch (_) {
      addIsisMessage('Para instalar, use o menu do navegador e selecione "Adicionar à Tela Inicial".', 600);
    }
  };
  
  // Inicia o fluxo de agendamento após identificação
  const iniciarAgendamento = async () => {
    console.log('[iniciarAgendamento] Dados disponíveis:', {
      quadras: quadras?.length || 0,
      empresa: !!empresa,
      empresaNome: empresa?.nome_fantasia || empresa?.razao_social
    });
    
    let quadrasParaUsar = quadras;
    let empresaParaUsar = empresa;
    
    // Se quadras não estão carregadas, carrega empresa e quadras
    if (!quadrasParaUsar || quadrasParaUsar.length === 0) {
      console.log('[iniciarAgendamento] Quadras não disponíveis, carregando...');
      const dadosCarregados = await loadEmpresa(false); // false = sem loading na tela
      
      quadrasParaUsar = dadosCarregados.quadras;
      empresaParaUsar = dadosCarregados.empresa;
      
      // Verifica se conseguiu carregar
      if (!quadrasParaUsar || quadrasParaUsar.length === 0) {
        console.error('[iniciarAgendamento] Quadras ainda não disponíveis após carregar!');
        addIsisMessage('Ops! Não consegui carregar as quadras. Tente novamente.', 600);
        return;
      }
    }
    
    if (!empresaParaUsar) {
      console.error('[iniciarAgendamento] Empresa não disponível!');
      addIsisMessage('Ops! Não consegui carregar os dados da empresa. Tente novamente.', 600);
      return;
    }
    
    setTimeout(() => {
      iniciarConversa(quadrasParaUsar, empresaParaUsar, true); // true = já identificado
    }, 800);
  };
  
  const loadEmpresa = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoadingEmpresa(true);
      }
      
      // Delay mínimo para mostrar o loading premium (3.5 segundos)
      const startTime = Date.now();
      const minLoadingTime = 3500;
      console.log('[DEBUG] Loading premium INICIOU:', {
        startTime,
        minLoadingTime,
        timestamp: new Date().toISOString()
      });
      
      // Busca empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas')
        .select('*')
        .eq('codigo_empresa', codigoEmpresa)
        .single();
      
      if (empresaError) throw empresaError;
      if (!empresaData) {
        toast({
          title: 'Empresa não encontrada',
          description: 'Verifique o código e tente novamente',
          variant: 'destructive'
        });
        return { empresa: null, quadras: [] };
      }
      
      setEmpresa(empresaData);
      updateSelection('empresa', empresaData);
      
      // Busca quadras ativas
      
      const { data: quadrasData, error: quadrasError } = await supabase
        .from('quadras')
        .select('id, nome, modalidades, hora_inicio, hora_fim, valor, codigo_empresa, status, descricao')
        .eq('codigo_empresa', String(codigoEmpresa))
        .eq('status', 'Ativa')
        .order('nome', { ascending: true });
      
      if (quadrasError) {
        console.error('[loadEmpresa] Erro ao buscar quadras:', quadrasError);
        throw quadrasError;
      }
      
      // Se não conseguiu carregar quadras devido a RLS, cria uma quadra padrão temporária
      if (!quadrasData || quadrasData.length === 0) {
        console.warn('[loadEmpresa] Nenhuma quadra encontrada devido a RLS. Criando quadra temporária.');
        const quadraTemporaria = [{
          id: 'temp-quadra-1004',
          nome: 'Quadra Principal',
          modalidades: ['Futebol', 'Futsal'],
          hora_inicio: '07:00:00',
          hora_fim: '22:00:00',
          valor: 30,
          codigo_empresa: String(codigoEmpresa),
          status: 'Ativa',
          descricao: 'Quadra temporária (problema de permissão)'
        }];
        
        setQuadras(quadraTemporaria);
        return { empresa: empresaData, quadras: quadraTemporaria };
      }
      
      setQuadras(quadrasData || []);
      
      // Garante delay mínimo antes de finalizar loading
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      console.log('[DEBUG] Verificando delay mínimo:', {
        elapsedTime,
        remainingTime,
        willWait: remainingTime > 0,
        timestamp: new Date().toISOString()
      });
      
      if (remainingTime > 0) {
        console.log('[DEBUG] Aguardando delay mínimo de', remainingTime, 'ms');
        await new Promise(resolve => setTimeout(resolve, remainingTime));
        console.log('[DEBUG] Delay mínimo CONCLUÍDO');
      }
      
      return { empresa: empresaData, quadras: quadrasData || [] };
      
    } catch (error) {
      console.error('[Isis] Erro ao carregar empresa:', error);
      
      // Mesmo em caso de erro, respeita o delay mínimo
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os dados da empresa',
        variant: 'destructive'
      });
      return { empresa: null, quadras: [] };
    } finally {
      if (showLoading) {
        console.log('[DEBUG] loadEmpresa FINALIZOU - setLoadingEmpresa(false):', {
          timestamp: new Date().toISOString()
        });
        setLoadingEmpresa(false);
      }
    }
  };
  
  const iniciarConversa = (quadrasList, empresaData, jaIdentificado = false) => {
    console.log('[iniciarConversa] Iniciando com:', {
      quadras: quadrasList?.length || 0,
      empresa: empresaData?.nome_fantasia || empresaData?.razao_social,
      jaIdentificado
    });
    
    // Mensagem de boas-vindas personalizada com nome da empresa (variações)
    const nomeEmpresa = empresaData.nome_fantasia || empresaData.razao_social;
    const cumprimento = getCumprimentoPorHorario();
    
    // Se há apenas uma quadra, auto-seleciona e pula para data
    if (quadrasList.length === 1) {
      console.log('[iniciarConversa] Uma quadra detectada, auto-selecionando:', quadrasList[0].nome);
      const quadraUnica = quadrasList[0];
      
      // Só envia boas-vindas se cliente já foi identificado (evita duplicação)
      if (jaIdentificado) {
        const greetingVariationsSingle = [
          `Perfeito! Agora vamos **agendar** seu horário na **${quadraUnica.nome}!** 🎾`,
          `Ótimo! Vou te ajudar a **marcar sua partida** na **${quadraUnica.nome}!** ⚽`,
          `Show! Bora **agendar** a **${quadraUnica.nome}?** 🏐`,
          `Perfeito! Vamos **marcar sua reserva** na **${quadraUnica.nome}!** 🏆`
        ];
        
        const randomIndex = Math.floor(Math.random() * greetingVariationsSingle.length);
        const greeting = greetingVariationsSingle[randomIndex];
        
        addIsisMessage(greeting);
      }
      
      // Auto-seleciona a quadra
      updateSelection('quadra', quadraUnica);
      
      // Vai direto para seleção de data (sem mensagem "afterQuadra")
      setTimeout(() => {
        const hoje = new Date();
        const amanha = addDays(hoje, 1);
        
        const dataButtons = [
          {
            label: `Hoje (${format(hoje, 'dd/MM')})`,
            value: format(hoje, 'yyyy-MM-dd'),
            icon: '📅',
            date: hoje
          },
          {
            label: `Amanhã (${format(amanha, 'dd/MM')})`,
            value: format(amanha, 'yyyy-MM-dd'),
            icon: '📅',
            date: amanha
          },
          {
            label: 'Outro dia...',
            value: 'custom',
            icon: '🗓️'
          }
        ];
        
        addIsisMessageWithButtons('Para qual dia você gostaria de agendar?', dataButtons, 800);
        nextStep('data');
      }, 1200);
      
      return;
    }
    
    // Se há múltiplas quadras, mostra seleção
    let greeting;
    
    if (jaIdentificado) {
      // Cliente já identificado - mensagem curta
      const perguntasQuadra = [
        'Qual quadra você quer reservar? 🏐',
        'Qual quadra te interessa? 🎾',
        'Me diz, qual quadra? ⚽',
        'Qual quadra você prefere? 🏀',
        'Bora escolher a quadra? Qual delas? 💪'
      ];
      const randomIdx = Math.floor(Math.random() * perguntasQuadra.length);
      greeting = perguntasQuadra[randomIdx];
    } else {
      // Cliente não identificado - não envia mensagem aqui (evita duplicação)
      // A mensagem de boas-vindas já foi enviada em iniciarIdentificacao()
      return;
    }
    
    // Monta botões de quadras com descrição (se houver)
    const quadraButtons = quadrasList.map(q => ({
      label: q.nome,
      subtitle: q.descricao || null, // Descrição opcional
      value: q.id,
      icon: '🏟️',
      quadra: q
    }));
    
    addIsisMessageWithButtons(greeting, quadraButtons);
    nextStep('quadra');
  };
  
  // Handler para seleção de quadra
  const handleQuadraSelection = async (button) => {
    console.log('[handleQuadraSelection] Iniciando...', { button, currentStep });
    const quadra = button.quadra;
    
    addUserMessage(quadra.nome);
    updateSelection('quadra', quadra);
    
    // Se está editando (review), recarrega horários para a nova quadra
    if (currentStep === 'review') {
      console.log('[handleQuadraSelection] Modo edição detectado - recarregando horários');
      console.log('[handleQuadraSelection] Quadra ID:', quadra.id);
      console.log('[handleQuadraSelection] Data:', selections.data);
      
      setShowInput(false);
      setEditingType('horario'); // Define que está editando horário após trocar quadra
      setIsLoading(true);
      
      // Recarrega horários disponíveis para a nova quadra (incluindo horário atual se editando)
      const resultado = await loadHorariosDisponiveis(quadra.id, selections.data, agendamentoCriado?.id);
      
      console.log('[handleQuadraSelection] Resultado:', resultado);
      
      setIsLoading(false);
      
      // Verifica se a quadra está fechada
      if (resultado.fechada) {
        const dataFormatada = format(selections.data, "dd/MM/yyyy", { locale: ptBR });
        const diaSemana = format(selections.data, "EEEE", { locale: ptBR });
        
        if (resultado.motivo === 'data_especifica') {
          addIsisMessage(`**Ops!** A **${quadra.nome}** estará **fechada** no dia **${dataFormatada}** (${diaSemana}). 🚫\n\n**Motivo:** ${resultado.observacao}`, 800);
        } else if (resultado.motivo === 'dia_semana') {
          const diaDaSemana = format(selections.data, "EEEE", { locale: ptBR });
          const preposicao = diaDaSemana === 'domingo' || diaDaSemana === 'sábado' ? 'aos' : 'às';
          addIsisMessage(`**Ops!** A **${quadra.nome}** não funciona ${preposicao} **${diaDaSemana}s**. 🚫`, 800);
        }
        
        setTimeout(() => {
          addIsisMessage('Escolha **outra quadra** ou **mude a data**:', 1200);
          // Volta para seleção de quadra ou data
          setTimeout(() => {
            mostrarSelecaoData();
          }, 400);
        }, 1600);
        return;
      }
      
      const slots = resultado.slots;
      if (slots && slots.length > 0) {
        // Agrupa slots em intervalos contínuos
        const intervalos = agruparSlotsEmIntervalos(slots);
        
        // Monta mensagem com os intervalos (igual fluxo normal)
        let msgIntervalos = '';
        if (intervalos.length === 1) {
          msgIntervalos = `Tenho **horários livres** das **${intervalos[0].inicio}** às **${intervalos[0].fim}**! 🕒`;
        } else {
          const partes = intervalos.map((int, idx) => {
            if (idx === intervalos.length - 1) {
              return `e das **${int.inicio}** às **${int.fim}**`;
            } else if (idx === 0) {
              return `das **${int.inicio}** às **${int.fim}**`;
            } else {
              return `das **${int.inicio}** às **${int.fim}**`;
            }
          });
          msgIntervalos = `Tenho **horários livres** ${partes.join(', ')}! 🕒`;
        }
        
        console.log('[handleQuadraSelection] Mostrando horários disponíveis e input de horário');
        addIsisMessage(msgIntervalos, 600);
        
        setTimeout(() => {
          addIsisMessage('Escolha o horário de início e término: ⏰', 800);
          
          // Aguarda a mensagem aparecer e depois mostra input
          setTimeout(() => {
            console.log('[handleQuadraSelection] Ativando showInput=true');
            setShowInput(true);
            // Scroll após input aparecer
            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
          }, 1000);
        }, 800);
      } else {
        console.log('[handleQuadraSelection] Nenhum horário disponível');
        addIsisMessage('Ops! Não encontrei **horários disponíveis** para essa quadra nesse dia. 😔');
      }
      return;
    }
    
    console.log('[handleQuadraSelection] Fluxo normal (não edição)');
    
    // Mensagem após selecionar quadra
    const afterQuadraMsg = getIsisMessage('afterQuadra', { quadra: quadra.nome });
    addIsisMessage(afterQuadraMsg, 600);
    
    const hoje = new Date();
    const amanha = addDays(hoje, 1);
    
    const dataButtons = [
      {
        label: `Hoje (${format(hoje, 'dd/MM')})`,
        value: format(hoje, 'yyyy-MM-dd'),
        icon: '📅',
        date: hoje
      },
      {
        label: `Amanhã (${format(amanha, 'dd/MM')})`,
        value: format(amanha, 'yyyy-MM-dd'),
        icon: '📅',
        date: amanha
      },
      {
        label: 'Outro dia...',
        value: 'custom',
        icon: '🗓️'
      }
    ];
    
    addIsisMessageWithButtons('Para qual dia você gostaria de agendar?', dataButtons, 1000);
    nextStep('data');
  };
  
  // Handler para seleção de data
  const handleDataSelection = async (button) => {
    console.log('[handleDataSelection] Iniciando...', { button, currentStep });
    
    if (button.value === 'custom') {
      // Implementar seletor de data customizado
      addUserMessage('📅 Outro dia...');
      addIsisMessage('**Perfeito!** Me informe a **data desejada** no formato DD/MM/AAAA:', 600);
      
      // Ativa input de texto para data customizada
      setTipoIdentificacao('data_custom');
      setTimeout(() => {
        setShowInput(true);
        // Scroll após input aparecer
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }, 800);
      return;
    }
    
    const dataEscolhida = button.date;
    addUserMessage(button.label);
    updateSelection('data', dataEscolhida);
    
    // Se está editando (review), recarrega horários para a nova data
    if (currentStep === 'review') {
      console.log('[handleDataSelection] Modo edição detectado - recarregando horários');
      console.log('[handleDataSelection] Quadra ID:', selections.quadra?.id);
      console.log('[handleDataSelection] Nova Data:', dataEscolhida);
      
      setShowInput(false);
      setEditingType('horario'); // Define que está editando horário após trocar data
      setIsLoading(true);
      
      // Recarrega horários disponíveis para a nova data (incluindo horário atual se editando)
      const resultado = await loadHorariosDisponiveis(selections.quadra.id, dataEscolhida, agendamentoCriado?.id);
      
      console.log('[handleDataSelection] Resultado:', resultado);
      
      setIsLoading(false);
      
      // Verifica se a quadra está fechada
      if (resultado.fechada) {
        const dataFormatada = format(dataEscolhida, "dd/MM/yyyy", { locale: ptBR });
        const diaSemana = format(dataEscolhida, "EEEE", { locale: ptBR });
        
        if (resultado.motivo === 'data_especifica') {
          addIsisMessage(`**Ops!** A quadra estará **fechada** no dia **${dataFormatada}** (${diaSemana}). 🚫\n\n**Motivo:** ${resultado.observacao}`, 800);
        } else if (resultado.motivo === 'dia_semana') {
          const diaDaSemana = format(dataEscolhida, "EEEE", { locale: ptBR });
          const preposicao = diaDaSemana === 'domingo' || diaDaSemana === 'sábado' ? 'aos' : 'às';
          addIsisMessage(`**Ops!** A quadra não funciona ${preposicao} **${diaDaSemana}s**. 🚫`, 800);
        }
        
        setTimeout(() => {
          addIsisMessage('Escolha **outra data**:', 1200);
          setTimeout(() => {
            mostrarSelecaoData();
          }, 400);
        }, 1600);
        return;
      }
      
      const slots = resultado.slots;
      if (slots && slots.length > 0) {
        // Agrupa slots em intervalos contínuos
        const intervalos = agruparSlotsEmIntervalos(slots);
        
        // Monta mensagem com os intervalos (igual fluxo normal)
        let msgIntervalos = '';
        if (intervalos.length === 1) {
          msgIntervalos = `Tenho **horários livres** das **${intervalos[0].inicio}** às **${intervalos[0].fim}**! 🕒`;
        } else {
          const partes = intervalos.map((int, idx) => {
            if (idx === intervalos.length - 1) {
              return `e das **${int.inicio}** às **${int.fim}**`;
            } else if (idx === 0) {
              return `das **${int.inicio}** às **${int.fim}**`;
            } else {
              return `das **${int.inicio}** às **${int.fim}**`;
            }
          });
          msgIntervalos = `Tenho **horários livres** ${partes.join(', ')}! 🕒`;
        }
        
        console.log('[handleDataSelection] Mostrando horários disponíveis e input');
        addIsisMessage(msgIntervalos, 600);
        
        setTimeout(() => {
          addIsisMessage('Escolha o horário de início e término: ⏰', 800);
          
          // Aguarda a mensagem aparecer e depois mostra input
          setTimeout(() => {
            console.log('[handleDataSelection] Ativando showInput=true');
            setShowInput(true);
            // Scroll após input aparecer
            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
          }, 1000);
        }, 800);
      } else {
        console.log('[handleDataSelection] Nenhum horário disponível');
        addIsisMessage('Ops! Não encontrei **horários disponíveis** para essa quadra nesse dia. 😔 Tente outra data.');
      }
      return;
    }
    
    console.log('[handleDataSelection] Fluxo normal (não edição)');
    
    // Carrega horários disponíveis
    setIsLoading(true);
    
    const resultado = await loadHorariosDisponiveis(selections.quadra.id, dataEscolhida);
    
    console.log('[handleDataSelection] Resultado (fluxo normal):', resultado);
    
    setIsLoading(false);
    
    // Verifica se a quadra está fechada
    if (resultado.fechada) {
      const dataFormatada = format(dataEscolhida, "dd/MM/yyyy", { locale: ptBR });
      const diaSemana = format(dataEscolhida, "EEEE", { locale: ptBR });
      
      if (resultado.motivo === 'data_especifica') {
        addIsisMessage(`**Ops!** A quadra estará **fechada** no dia **${dataFormatada}** (${diaSemana}). 🚫\n\n**Motivo:** ${resultado.observacao}`, 800);
      } else if (resultado.motivo === 'dia_semana') {
        const diaDaSemana = format(dataEscolhida, "EEEE", { locale: ptBR });
        const preposicao = diaDaSemana === 'domingo' || diaDaSemana === 'sábado' ? 'aos' : 'às';
        addIsisMessage(`**Ops!** A quadra não funciona ${preposicao} **${diaDaSemana}s**. 🚫\n\nEscolha outro dia da semana!`, 800);
      }
      
      // Volta para seleção de data
      setTimeout(() => {
        addIsisMessage('Que tal tentar **outra data**? 😊', 1200);
        setTimeout(() => {
          mostrarSelecaoData();
        }, 400);
      }, 1600);
      return;
    }
    
    const slots = resultado.slots;
    if (slots.length === 0) {
      console.log('[handleDataSelection] Nenhum horário disponível');
      addIsisMessage('Ops! Não encontrei **horários disponíveis** para esse dia. 😔 Que tal tentar outro dia?');
      return;
    }
    
    // Agrupa slots em intervalos contínuos
    const intervalos = agruparSlotsEmIntervalos(slots);
    
    // Monta mensagem com os intervalos
    let msgIntervalos = '';
    if (intervalos.length === 1) {
      msgIntervalos = `Tenho **horários livres** das **${intervalos[0].inicio}** às **${intervalos[0].fim}**! 🕒`;
    } else {
      const partes = intervalos.map((int, idx) => {
        if (idx === intervalos.length - 1) {
          return `e das **${int.inicio}** às **${int.fim}**`;
        } else if (idx === 0) {
          return `das **${int.inicio}** às **${int.fim}**`;
        } else {
          return `das **${int.inicio}** às **${int.fim}**`;
        }
      });
      msgIntervalos = `Tenho **horários livres** ${partes.join(', ')}! 🕒`;
    }
    
    addIsisMessage(msgIntervalos, 800);
    
    setTimeout(() => {
      addIsisMessage('Escolha o horário de início e término: ⏰', 1000);
      nextStep('horario');
      
      // Mostra input após mensagem aparecer
      setTimeout(() => {
        setShowInput(true);
        // Força scroll PARA CIMA após select aparecer (principalmente mobile)
        // block: 'start' faz rolar para mostrar o topo do elemento
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 600);
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 1000);
      }, 1000 + 600);
    }, 1400);
  };
  
  // Carrega horários disponíveis
  const loadHorariosDisponiveis = async (quadraId, data, agendamentoEditandoId = null) => {
    try {
      console.log('[loadHorariosDisponiveis] quadraId:', quadraId);
      console.log('[loadHorariosDisponiveis] data:', data);
      
      // Busca a quadra correta pelo ID
      const quadra = quadras.find(q => q.id === quadraId);
      
      if (!quadra) {
        console.error('[loadHorariosDisponiveis] Quadra não encontrada:', quadraId);
        return [];
      }
      
      console.log('[loadHorariosDisponiveis] Quadra encontrada:', quadra.nome);
      console.log('[loadHorariosDisponiveis] Horário funcionamento:', quadra.hora_inicio, '-', quadra.hora_fim);
      
      // Verificar se a quadra funciona na data selecionada
      const dataFormatada = format(data, 'yyyy-MM-dd');
      const diaSemana = data.getDay();
      
      console.log('[loadHorariosDisponiveis] Verificando funcionamento para:', dataFormatada, 'dia da semana:', diaSemana);
      
      // Buscar configurações de funcionamento
      const { data: configuracoes, error: configError } = await supabase
        .from('quadras_dias_funcionamento')
        .select('*')
        .eq('codigo_empresa', codigoEmpresa)
        .eq('quadra_id', quadraId)
        .or(`and(tipo.eq.data_fechamento,data_fechamento.eq.${dataFormatada}),and(tipo.eq.dia_semana,dia_semana.eq.${diaSemana})`);
      
      if (configError) {
        console.error('[loadHorariosDisponiveis] Erro ao buscar configurações de funcionamento:', configError);
        // Em caso de erro, continua sem verificação (comportamento anterior)
      } else {
        console.log('[loadHorariosDisponiveis] Configurações encontradas:', configuracoes?.length || 0);
        
        // Verificar fechamento específico para esta data (prioridade maior)
        const fechamentoEspecifico = configuracoes?.find(
          config => config.tipo === 'data_fechamento' && 
                   config.data_fechamento === dataFormatada
        );
        
        if (fechamentoEspecifico && !fechamentoEspecifico.funciona) {
          console.log('[loadHorariosDisponiveis] Quadra fechada em data específica:', fechamentoEspecifico.observacao);
          return { 
            slots: [], 
            fechada: true, 
            motivo: 'data_especifica', 
            observacao: fechamentoEspecifico.observacao || 'Fechamento especial'
          };
        }
        
        // Verificar funcionamento do dia da semana
        const funcionamentoSemanal = configuracoes?.find(
          config => config.tipo === 'dia_semana' && 
                   config.dia_semana === diaSemana
        );
        
        if (funcionamentoSemanal && !funcionamentoSemanal.funciona) {
          console.log('[loadHorariosDisponiveis] Quadra não funciona neste dia da semana');
          const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
          return { 
            slots: [], 
            fechada: true, 
            motivo: 'dia_semana', 
            observacao: `Quadra fechada às ${diasSemana[diaSemana]}s`
          };
        }
        
        console.log('[loadHorariosDisponiveis] Quadra funciona normalmente na data selecionada');
      }
      
      const dataInicio = startOfDay(data);
      const dataFim = addDays(dataInicio, 1);
      
      // Busca agendamentos existentes (exceto cancelados e o que está sendo editado)
      let query = supabase
        .from('agendamentos')
        .select('inicio, fim, status')
        .eq('codigo_empresa', codigoEmpresa)
        .eq('quadra_id', quadraId)
        .gte('inicio', dataInicio.toISOString())
        .lt('inicio', dataFim.toISOString())
        .neq('status', 'canceled');
      
      // Se está editando um agendamento, exclui ele da busca
      if (agendamentoEditandoId) {
        query = query.neq('id', agendamentoEditandoId);
        console.log('[loadHorariosDisponiveis] Excluindo agendamento sendo editado:', agendamentoEditandoId);
      }
      
      const { data: agendamentos, error } = await query;
      
      if (error) throw error;
      
      console.log('[loadHorariosDisponiveis] Agendamentos encontrados:', agendamentos?.length || 0);
      
      // Gera slots de 30 em 30 minutos
      const horaInicio = parseInt(quadra.hora_inicio?.split(':')[0] || '6');
      let horaFim = parseInt(quadra.hora_fim?.split(':')[0] || '24');
      
      // Se hora_fim é 00:00 (meia-noite), tratar como 24h
      if (horaFim === 0) {
        horaFim = 24;
      }
      
      const agora = new Date();
      const ehHoje = startOfDay(data).getTime() === startOfDay(agora).getTime();
      const slots = [];
      
      for (let hora = horaInicio; hora < horaFim; hora++) {
        for (let minuto of [0, 30]) {
          const inicio = setMinutes(setHours(data, hora), minuto);
          const fim = addMinutes(inicio, 30);
          
          // Ignora horários que já passaram APENAS se for hoje
          if (ehHoje && inicio < agora) continue;
          
          // Verifica se não conflita com agendamentos existentes
          const conflito = agendamentos?.some(ag => {
            const agInicio = new Date(ag.inicio);
            const agFim = new Date(ag.fim);
            
            // Normaliza para minutos (ignora segundos e milissegundos)
            const slotInicioMin = Math.floor(inicio.getTime() / 60000);
            const slotFimMin = Math.floor(fim.getTime() / 60000);
            const agInicioMin = Math.floor(agInicio.getTime() / 60000);
            const agFimMin = Math.floor(agFim.getTime() / 60000);
            
            // Slots que terminam quando agendamento começa NÃO conflitam
            // Slots que começam quando agendamento termina NÃO conflitam
            if (slotFimMin === agInicioMin || slotInicioMin === agFimMin) {
              return false;
            }
            
            // Verifica sobreposição real
            return (slotInicioMin < agFimMin && slotFimMin > agInicioMin);
          });
          
          if (!conflito) {
            slots.push({
              inicio: format(inicio, 'HH:mm'),
              fim: format(fim, 'HH:mm'),
              inicioDate: inicio,
              fimDate: fim
            });
          }
        }
      }
      
      console.log('[loadHorariosDisponiveis] Total de slots disponíveis:', slots.length);
      
      setHorariosDisponiveis(slots);
      
      // Retorna objeto com informações completas para compatibilidade
      return {
        slots: slots,
        fechada: false,
        motivo: null,
        observacao: null
      };
      
    } catch (error) {
      console.error('[loadHorariosDisponiveis] Erro ao carregar horários:', error);
      setHorariosDisponiveis([]);
      return {
        slots: [],
        fechada: false,
        motivo: 'erro',
        observacao: 'Erro ao carregar horários'
      };
    }
  };
  
  // Agrupa slots consecutivos em intervalos e filtra intervalos < 60min
  const agruparSlotsEmIntervalos = (slots) => {
    if (slots.length === 0) return [];
    
    const intervalos = [];
    let intervaloAtual = {
      inicio: slots[0].inicio,
      fim: slots[0].fim
    };
    
    for (let i = 1; i < slots.length; i++) {
      // Se o slot atual começa onde o anterior termina, é contínuo
      if (slots[i].inicio === intervaloAtual.fim) {
        intervaloAtual.fim = slots[i].fim;
      } else {
        // Intervalo quebrou, salva o atual e começa um novo
        intervalos.push(intervaloAtual);
        intervaloAtual = {
          inicio: slots[i].inicio,
          fim: slots[i].fim
        };
      }
    }
    
    // Adiciona o último intervalo
    intervalos.push(intervaloAtual);
    
    // Converte HH:mm em minutos, tratando 00:00 como 24:00 (fim do dia)
    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      if (h === 0 && m === 0) return 24 * 60;
      return h * 60 + m;
    };
    
    // Filtra para manter apenas intervalos com duração mínima de 60 minutos
    return intervalos.filter((int) => {
      const dur = toMinutes(int.fim) - toMinutes(int.inicio);
      return dur >= 60;
    });
  };
  
  // Handler para input de horário (início, fim e esporte juntos)
  const handleHorarioSubmit = ({ inicio, fim, esporte }) => {
    // O componente já valida que os horários estão disponíveis e são válidos
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fim.split(':').map(Number);
    
    const dataBase = selections.data;
    const inicioDate = setMinutes(setHours(dataBase, h1), m1);
    const fimDate = h2 === 0 && m2 === 0 
      ? setMinutes(setHours(addDays(dataBase, 1), 0), 0)
      : setMinutes(setHours(dataBase, h2), m2);
    
    const horario = {
      inicio,
      fim,
      inicioDate,
      fimDate
    };
    
    addUserMessage(`${horario.inicio} - ${horario.fim} • ${esporte}`);
    
    console.log('[handleHorarioSubmit] Atualizando horário:', horario);
    console.log('[handleHorarioSubmit] Atualizando esporte:', esporte);
    
    updateSelection('horario', horario);
    updateSelection('esporte', esporte);
    setShowInput(false); // Esconde input
    
    // Se está editando horário (mesmo que currentStep tenha mudado por causa da mudança de data), volta pro resumo
    if (currentStep === 'review' || editingType === 'horario') {
      setTimeout(() => {
        setEditingType(null); // Limpa o tipo de edição
        nextStep('review'); // Garante que volta para review
        mostrarResumo(horario, esporte); // Passa os valores atualizados diretamente
      }, 600);
      return;
    }
    
    // Inicializa lista de participantes com o usuário identificado
    const participantesIniciais = [{
      nome: selections.cliente.nome,
      cliente_id: selections.cliente.id,
      principal: true
    }];
    updateSelection('participantes', participantesIniciais);
    
    const nomeCurto = getNomeCurto(selections.cliente.nome);
    
    addIsisMessage(`Perfeito! ${nomeCurto}, você já está na lista! 🎯`, 800);
    addIsisMessage('Quer adicionar mais pessoas? Digite o nome e clique em "Adicionar" para cada um, ou finalize quando quiser.', 1400);
    
    // Mostra input de participantes
    setTimeout(() => {
      setShowInput(true);
      // Rola PARA CIMA após input aparecer (mobile)
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 600);
    }, 1400 + 600);
    
    nextStep('participantes');
  };
  
  
  // Handler para adicionar participante
  const handleAdicionarParticipante = (nome) => {
    if (!nome || !nome.trim()) return;
    
    const participantesAtuais = selections.participantes || [];
    const novoParticipante = {
      nome: nome.trim(),
      cliente_id: null, // Será cliente consumidor
      principal: false
    };
    
    const novosParticipantes = [...participantesAtuais, novoParticipante];
    updateSelection('participantes', novosParticipantes);
    
    // NÃO envia mensagem ao chat - apenas atualiza a lista localmente
  };

  // Adiciona participantes em lote (usado pela importação com IA)
  const handleAdicionarParticipantesLote = (nomes) => {
    if (!Array.isArray(nomes) || nomes.length === 0) return;

    const canonicalKey = (str) =>
      String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

    const cliente = selections.cliente;
    const selfName = cliente?.nome ? String(cliente.nome).trim() : null;
    const selfKey = selfName ? canonicalKey(selfName) : null;

    const participantesAtuais = selections.participantes || [];

    const baseLista = participantesAtuais.length > 0
      ? participantesAtuais
      : (selfName && cliente)
        ? [{
            nome: selfName,
            cliente_id: cliente.id,
            principal: true
          }]
        : [];

    const vistos = new Set();
    const resultado = [];

    const editing = Boolean(selections?.editing_agendamento);
    if (editing) {
      // Em edição: substituir toda a lista (exceto o principal) pelos importados
      // 1) encontra principal atual ou self
      let principal = baseLista.find(p => p.principal) || (selfName && cliente ? { nome: selfName, cliente_id: cliente.id, principal: true } : null);
      // 2) constrói lista apenas com principal, se houver
      if (principal) {
        const key = canonicalKey(principal.nome);
        vistos.add(key);
        resultado.push({ ...principal, principal: true });
      }
      // 3) adiciona apenas os importados, únicos e sem o principal
      nomes.forEach((n) => {
        const nomeStr = String(n || '').trim();
        if (!nomeStr) return;
        const key = canonicalKey(nomeStr);
        if (!key || vistos.has(key)) return;
        if (selfKey && key === selfKey) return;
        vistos.add(key);
        resultado.push({ nome: nomeStr, cliente_id: null, principal: false });
      });
    } else {
      // Fluxo normal: manter existentes e acrescentar importados, evitando duplicatas
      // Garante que o participante principal (cliente logado) fique na frente
      baseLista.forEach((p) => {
        const key = canonicalKey(p.nome);
        if (!key || vistos.has(key)) return;
        vistos.add(key);
        const isPrincipal = selfKey && key === selfKey;
        resultado.push({
          ...p,
          principal: isPrincipal
        });
      });
      // Adiciona nomes importados, evitando duplicados e o próprio usuário
      nomes.forEach((n) => {
        const nomeStr = String(n || '').trim();
        if (!nomeStr) return;
        const key = canonicalKey(nomeStr);
        if (!key || vistos.has(key)) return;
        if (selfKey && key === selfKey) return;
        vistos.add(key);
        resultado.push({ nome: nomeStr, cliente_id: null, principal: false });
      });
    }

    if (resultado.length === 0 && selfName && cliente) {
      resultado.push({
        nome: selfName,
        cliente_id: cliente.id,
        principal: true
      });
    }

    updateSelection('participantes', resultado);
  };
  
  // Handler para remover participante
  const handleRemoverParticipante = (index) => {
    const participantesAtuais = selections.participantes || [];
    
    // Não permite remover o primeiro (usuário principal)
    if (index === 0) return;
    
    const novosParticipantes = participantesAtuais.filter((_, i) => i !== index);
    updateSelection('participantes', novosParticipantes);
  };
  
  // Handler para finalizar lista de participantes
  const handleFinalizarParticipantes = () => {
    const participantes = selections.participantes || [];
    
    if (participantes.length === 0) {
      addIsisMessage('Você precisa ter pelo menos 1 participante!', 400);
      return;
    }
    
    setShowInput(false);
    
    const total = participantes.length;
    
    // Monta mensagem com lista de participantes
    if (total === 1) {
      // Apenas o usuário
      addUserMessage(`✓ Apenas eu por enquanto`);
    } else {
      // Usuário + outros
      const listaNomes = participantes
        .filter(p => !p.principal)
        .map(p => p.nome)
        .join(', ');
      
      addUserMessage(`✓ Eu + ${listaNomes} (${total} pessoas)`);
    }
    
    // Sempre vai para o resumo (seja edição ou primeira vez)
    setTimeout(() => {
      setEditingType(null); // Limpa o tipo de edição
      mostrarResumo();
    }, 600);
  };
  
  
  // Mostra resumo para confirmação
  const mostrarResumo = (
    horarioAtualizado = null, 
    esporteAtualizado = null, 
    modoEdicaoInicial = false,
    quadraAtualizada = null,
    dataAtualizada = null,
    participantesAtualizados = null,
    agendamentoParaEdicao = null
  ) => {
    // Usa valores passados como parâmetro ou valores do estado
    const horarioFinal = horarioAtualizado || selections.horario;
    const esporteFinal = esporteAtualizado || selections.esporte;
    const quadraFinal = quadraAtualizada || selections.quadra;
    const dataFinal = dataAtualizada || selections.data;
    const participantesFinal = participantesAtualizados || selections.participantes || [];
    // Considera edição apenas quando veio um agendamento para edição ou flag explícita de edição
    const isEditing = Boolean(agendamentoParaEdicao || selections?.editing_agendamento);
    const agendamentoFinal = agendamentoParaEdicao || null;
    
    console.log('[mostrarResumo] Selections atuais:', selections);
    console.log('[mostrarResumo] Horário usado:', horarioFinal);
    console.log('[mostrarResumo] Esporte usado:', esporteFinal);
    console.log('[mostrarResumo] Quadra atual:', quadraFinal);
    console.log('[mostrarResumo] Data atual:', dataFinal);
    console.log('[mostrarResumo] Modo edição inicial:', modoEdicaoInicial);
    
    // Verifica se todos os dados necessários estão disponíveis
    if (!dataFinal || !horarioFinal || !quadraFinal) {
      console.error('[mostrarResumo] Dados obrigatórios faltando:', { dataFinal, horarioFinal, quadraFinal });
      return;
    }
    
    // Mensagem ANTES do resumo (apenas se não for modo edição inicial)
    if (!modoEdicaoInicial) {
      const msg = getIsisMessage('reviewData');
      addIsisMessage(msg, 400);
    }
    
    const listaNomes = participantesFinal
      .map((p, i) => {
        const bullet = i === 0 ? '👤' : '👥';
        const suffix = i === 0 ? ' (você)' : '';
        return `${bullet} ${p.nome}${suffix}`;
      })
      .join('\n');
    
    // Formata data de forma mais legível
    const dataFormatada = format(dataFinal, "dd/MM/yyyy", { locale: ptBR });
    const diaSemana = format(dataFinal, "EEEE", { locale: ptBR });
    
    // Calcula duração do agendamento
    const [h1, m1] = horarioFinal.inicio.split(':').map(Number);
    const [h2, m2] = horarioFinal.fim.split(':').map(Number);
    let duracaoMinutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    
    // Se fim for 00:00, é meia-noite do dia seguinte
    if (h2 === 0 && m2 === 0) {
      duracaoMinutos = (24 * 60) - (h1 * 60 + m1);
    }
    
    const duracaoHoras = Math.floor(duracaoMinutos / 60);
    const duracaoMinutosResto = duracaoMinutos % 60;
    const duracaoTexto = duracaoMinutosResto > 0 
      ? `${duracaoHoras}h ${duracaoMinutosResto}min`
      : `${duracaoHoras}h`;
    
    // Calcula valor total baseado na duração (valor da quadra é por meia hora)
    const valorPorMeiaHora = quadraFinal.valor || 0;
    const slots = duracaoMinutos / 30; // Slots de 30 minutos
    const valorTotal = Math.round(valorPorMeiaHora * slots * 100) / 100;
    const valorDividido = valorTotal / participantesFinal.length;
    
    console.log('[mostrarResumo] Cálculo do valor:');
    console.log('- Valor por meia hora:', valorPorMeiaHora);
    console.log('- Slots de 30min:', slots);
    console.log('- Duração em minutos:', duracaoMinutos);
    console.log('- Valor total:', valorTotal);
    console.log('- Participantes:', participantesFinal.length);
    console.log('- Valor dividido:', valorDividido);
    
    // Resumo com emojis e formatação limpa
    // Endereço da empresa (opcional)
    const enderecoEmpresa = selections?.empresa?.endereco && String(selections.empresa.endereco).trim().length > 0
      ? String(selections.empresa.endereco).trim()
      : null;

    const blocoEndereco = enderecoEmpresa ? `\n📍 **Endereço**\n${enderecoEmpresa}\n` : '';

    // Formata contato do responsável (telefone/whatsapp) com máscara BR
    const formatTelBR = (v) => {
      if (!v) return 'N/A';
      const d = String(v).replace(/\D/g, '');
      if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
      if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
      return v;
    };
    const contatoBruto = selections.cliente.telefone || selections.cliente.whatsapp || null;
    const contatoFormatado = formatTelBR(contatoBruto);

    const resumo = `📋 **RESUMO DO AGENDAMENTO**\n\n🏟️ **Quadra**\n${quadraFinal.nome}${blocoEndereco}\n📅 **Data**\n${dataFormatada} (${diaSemana})\n\n⏰ **Horário**\n${horarioFinal.inicio} às ${horarioFinal.fim}\n⏱️ Duração: **${duracaoTexto}**\n\n🏆 **Modalidade**\n${esporteFinal}\n\n👥 **Participantes** (${participantesFinal.length})\n${listaNomes}\n\n💰 **Valor Total**\nR$ **${valorTotal.toFixed(2).replace('.', ',')}**\n💵 **Valor Dividido**\nR$ **${valorDividido.toFixed(2).replace('.', ',')}** por pessoa\n\n👤 **Responsável**\n${selections.cliente.nome}\n📞 ${contatoFormatado}`;
    
    // Delay menor se for modo edição inicial
    const delay = modoEdicaoInicial ? 200 : 1000;
    // Converte **negrito** (markdown) para *negrito* (WhatsApp) apenas no texto de cópia
    const resumoCopyText = resumo.replace(/\*\*(.+?)\*\*/g, '*$1*');
    addIsisMessage({ text: resumo, copyable: true, copyText: resumoCopyText }, delay);
    
    // Botões de confirmação e edição
    const confirmButtons = [
      { 
        label: isEditing ? 'Salvar Alterações' : 'Confirmar Agendamento', 
        value: isEditing ? 'confirm' : 'criar agendamento', 
        icon: '✅'
      }
    ];
    
    // Botões de edição
    const editButtons = [];
    
    // Editar Quadra - só se tiver mais de uma
    if (quadras.length > 1) {
      editButtons.push({
        label: 'Editar Quadra',
        value: 'edit_quadra',
        icon: '🏟️'
      });
    }
    
    // Editar Data
    editButtons.push({
      label: 'Editar Data',
      value: 'edit_data',
      icon: '📅'
    });
    
    // Editar Horário e Esporte
    editButtons.push({
      label: 'Editar Horário e Esporte',
      value: 'edit_horario',
      icon: '⏰'
    });
    
    // Editar Participantes
    editButtons.push({
      label: 'Editar Participantes',
      value: 'edit_participantes',
      icon: '👥'
    });
    
    // Gerar Times:
    // - Deve aparecer ao entrar na edição (modoEdicaoInicial)
    // - Deve aparecer ao revisar um agendamento existente, desde que não esteja no resumo pós-edição
    const allowGenerateInReview = modoEdicaoInicial || (isEditing && !Boolean(selections?.editing_agendamento));
    if (allowGenerateInReview) {
      editButtons.push({
        label: 'Gerar Times',
        value: 'gerar_times',
        icon: '🎲'
      });
    }
    
    // Cancelar Agendamento (só se estiver editando um agendamento existente)
    if (isEditing) {
      editButtons.push({
        label: 'Cancelar Agendamento',
        value: 'cancelar_agendamento',
        icon: '❌'
      });
    }
    
    // Junta todos os botões em uma única mensagem
    const allButtons = [...confirmButtons, ...editButtons];
    
    
    // Delay menor para botões se for modo edição inicial
    const buttonsDelay = modoEdicaoInicial ? 400 : 1600;
    addIsisMessageWithButtons('Está tudo correto?', allButtons, buttonsDelay);
    
    nextStep('review');
  };
  
  // Mostra resumo final após agendamento confirmado
  const mostrarResumoFinal = (agendamento, isUpdate = false) => {
    // Mensagem de confirmação (verde)
    const successMessage = isUpdate 
      ? '🎉 **Perfeito!** Suas **alterações** foram **salvas com sucesso!**'
      : '🎉 **Pronto!** Seu **agendamento** foi **confirmado com sucesso!**';
    addIsisMessage(successMessage, 600, 'green');
    
    const participantes = selections.participantes || [];
    const listaNomes = participantes.map(p => `• ${p.nome}`).join('\n');
    
    // Formata data
    const dataFormatada = format(selections.data, "dd/MM/yyyy", { locale: ptBR });
    const diaSemana = format(selections.data, "EEEE", { locale: ptBR });
    
    // Calcula duração
    const [h1, m1] = selections.horario.inicio.split(':').map(Number);
    const [h2, m2] = selections.horario.fim.split(':').map(Number);
    let duracaoMinutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (h2 === 0 && m2 === 0) {
      duracaoMinutos = (24 * 60) - (h1 * 60 + m1);
    }
    const duracaoHoras = Math.floor(duracaoMinutos / 60);
    const duracaoMinutosResto = duracaoMinutos % 60;
    const duracaoTexto = duracaoMinutosResto > 0 
      ? `${duracaoHoras}h ${duracaoMinutosResto}min`
      : `${duracaoHoras}h`;
    
    // Calcula valor total baseado na duração (valor da quadra é por meia hora)
    const valorPorMeiaHora = selections.quadra.valor || 0;
    const slots = duracaoMinutos / 30; // Slots de 30 minutos
    const valorTotal = Math.round(valorPorMeiaHora * slots * 100) / 100;
    const valorDivididoFinal = participantes.length > 0 ? (valorTotal / participantes.length) : 0;
    
    // Resumo final (visual diferente - mais limpo e focado)
    // Endereço da empresa para o resumo final (opcional)
    const enderecoEmpresaFinal = selections?.empresa?.endereco && String(selections.empresa.endereco).trim().length > 0
      ? String(selections.empresa.endereco).trim()
      : null;
    const blocoEnderecoFinal = enderecoEmpresaFinal ? `\n📍 **Endereço**\n${enderecoEmpresaFinal}\n` : '';

    const resumoFinal = `🎉 **AGENDAMENTO CONFIRMADO**

🆔 **Código:** #${agendamento.codigo}

📍 **Local**
${selections.quadra.nome}${blocoEnderecoFinal}

📅 **Quando**
${dataFormatada} (${diaSemana})
⏰ ${selections.horario.inicio} às ${selections.horario.fim} **(${duracaoTexto})**

🏆 **Modalidade**
${selections.esporte}

👥 **Participantes** (${participantes.length})
${listaNomes}

💰 **Valor Total:** R$ **${valorTotal.toFixed(2).replace('.', ',')}**
💵 **Valor Dividido:** R$ **${valorDivididoFinal.toFixed(2).replace('.', ',')}** por pessoa

👤 **Responsável:** ${selections.cliente.nome}`;
    
    const resumoFinalCopyText = resumoFinal.replace(/\*\*(.+?)\*\*/g, '*$1*');
    addIsisMessage({ text: resumoFinal, copyable: true, copyText: resumoFinalCopyText }, 1200);
    
    // Botões finais
    const finalButtons = [
      {
        label: 'Gerar Times',
        value: 'gerar_times',
        icon: '🎲'
      },
      {
        label: 'Finalizar Atendimento',
        value: 'finalizar',
        icon: '✅'
      },
      {
        label: 'Editar Agendamento',
        value: 'editar_agendamento',
        icon: '✏️'
      },
      {
        label: 'Cancelar Agendamento',
        value: 'cancelar_agendamento',
        icon: '❌'
      }
    ];
    
    addIsisMessageWithButtons('O que você gostaria de fazer?', finalButtons, 1800);
  };
  
  // Gera times com base na modalidade e apresenta no chat (com opção de regenerar)
  const gerarTimesEApresentar = async () => {
    try { setIsTyping(true); } catch {}
    try {
      const nomes = (selections.participantes || []).map(p => String(p?.nome || '').trim()).filter(Boolean);
      if (!nomes || nomes.length === 0) {
        addIsisMessage('Não há participantes suficientes para formar times.');
        return;
      }
      const rawModalidade = String(selections?.esporte || selections?.quadra?.tipo || '').toLowerCase();
      let teamSize = 0;
      // Tenta inferir via Edge Function (OpenAI)
      try {
        const { data } = await supabase.functions.invoke('infer-team-size', {
          body: { modalidade: rawModalidade, quadra: selections?.quadra || null },
        });
        if (data && Number(data.teamSize) > 0) teamSize = Number(data.teamSize);
      } catch {}
      // Heurística de fallback
      if (!teamSize) {
        if (/areia/.test(rawModalidade)) teamSize = 2; // vôlei de praia
        else if (/(v[ôo]lei)/.test(rawModalidade)) teamSize = 6; // vôlei indoor
        else if (/(hand|handebol)/.test(rawModalidade)) teamSize = 7; // handebol
        else if (/(futsal|society)/.test(rawModalidade)) teamSize = 5; // futsal / society
        else if (/(futebol|campo)/.test(rawModalidade)) teamSize = 11; // futebol de campo
        else teamSize = 5; // default
      }
      // Identifica fixos (levantador/goleiro) vindos de selections.fixos (nomes exatos)
      const norm = (s) => String(s || '').trim().toLowerCase();
      // Conjunto de fixos pode vir em selections.fixos, selections.goleiros, selections.levantadores
      const baseFixos = Array.isArray(selections?.fixos) ? selections.fixos : [];
      const goleiros = Array.isArray(selections?.goleiros) ? selections.goleiros : [];
      const levantadores = Array.isArray(selections?.levantadores) ? selections.levantadores : [];
      const fixosSet = new Set([
        ...baseFixos,
        ...goleiros,
        ...levantadores,
      ].map(norm).filter(Boolean));
      const isFixo = (n) => fixosSet.has(norm(n));
      // labels opcionais por fixo: selections.fixoRoles = { nomeLower: 'Levantador'|'Goleiro' }
      const fixoRolesMap = (() => {
        const out = {};
        // Explícitos (nomeLower -> role)
        const raw = selections?.fixoRoles;
        if (raw && typeof raw === 'object') {
          for (const k of Object.keys(raw)) out[k] = raw[k];
        }
        // Derivados das listas específicas
        goleiros.forEach(n => { out[norm(n)] = 'Goleiro'; });
        levantadores.forEach(n => { out[norm(n)] = 'Levantador'; });
        return out;
      })();
      const getFixoLabel = (n) => {
        if (!isFixo(n)) return '';
        const role = fixoRolesMap[norm(n)] || 'Fixo';
        return ` (${role})`;
      };

      // Particiona em fixos e não-fixos
      const fixos = nomes.filter(isFixo);
      const livres = nomes.filter((n) => !isFixo(n));

      // Embaralha apenas os não-fixos para aleatoriedade
      const arrLivres = livres.slice();
      for (let i = arrLivres.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arrLivres[i], arrLivres[j]] = [arrLivres[j], arrLivres[i]]; }

      // Gera o máximo de times completos possível e define reservas
      if (teamSize < 2) teamSize = 2;
      const fmt = (xs) => xs.map((n, i) => `${i + 1}) ${n}${getFixoLabel(n)}`).join('\n') || '—';
      const totalCount = nomes.length;
      let teamCount = Math.ceil(totalCount / teamSize);
      const titleModalidade = rawModalidade ? (rawModalidade[0].toUpperCase() + rawModalidade.slice(1)) : 'modalidade';
      let text = `🏆 **Times gerados (${titleModalidade})**`;
      const teamIcons = ['🟠', '🔵', '🟢', '🟣', '🟡', '🟤'];
      // Identifica modalidade para priorizar papéis
      const modalidadeLower = (rawModalidade || '').toLowerCase();
      const isSoccerLike = /(fut|society|sal[aã]o)/.test(modalidadeLower);
      const isVolleyLike = /(v[oô]lei|volei)/.test(modalidadeLower);
      if (teamCount >= 2) {
        // Cria recipientes vazios
        const teams = Array.from({ length: teamCount }, () => []);
        // 1) Distribui Goleiros primeiro: 1 por time, ciclano se houver menos goleiros que times
        if (isSoccerLike && goleiros.length > 0) {
          for (let t = 0; t < teamCount; t++) {
            const g = goleiros[t % goleiros.length];
            const hasGk = teams[t].some(name => goleiros.includes(name));
            if (teams[t].length < teamSize && !hasGk && !teams[t].includes(g)) teams[t].push(g);
          }
        }
        // 2) Distribui Levantadores: 1 por time, ciclano se houver menos que times
        if (isVolleyLike && levantadores.length > 0) {
          for (let t = 0; t < teamCount; t++) {
            const l = levantadores[t % levantadores.length];
            const hasSetter = teams[t].some(name => levantadores.includes(name));
            if (teams[t].length < teamSize && !hasSetter && !teams[t].includes(l)) teams[t].push(l);
          }
        }
        // 3) Distribui outros fixos (restantes) em round-robin
        const outrosFixos = fixos.filter(n => !goleiros.includes(n) && !levantadores.includes(n));
        if (outrosFixos.length > 0) {
          let ti = 0;
          for (const f of outrosFixos) {
            let tries = 0;
            while (tries < teamCount && teams[ti].length >= teamSize) {
              ti = (ti + 1) % teamCount;
              tries++;
            }
            if (teams[ti].length < teamSize) teams[ti].push(f);
            ti = (ti + 1) % teamCount;
          }
        }
        // 4) Preenche restantes com jogadores livres embaralhados
        for (const p of arrLivres) {
          // pega o time com menos jogadores no momento
          let bestIdx = 0;
          let bestLen = Infinity;
          for (let i = 0; i < teams.length; i++) {
            if (teams[i].length < bestLen && teams[i].length < teamSize) {
              bestLen = teams[i].length;
              bestIdx = i;
            }
          }
          if (teams[bestIdx].length < teamSize) teams[bestIdx].push(p);
        }
        // 4.1) Se ainda faltar preencher vagas, NÃO repetir o mesmo jogador no mesmo time.
        // Mantém a regra de no máximo 1 goleiro/levantador por time. Se não houver jogador
        // de papel obrigatório disponível sem duplicar, mantém o time incompleto.
        for (let t = 0; t < teams.length; t++) {
          while (teams[t].length < teamSize) {
            if (isSoccerLike && goleiros.length > 0) {
              // Adiciona no máximo 1 goleiro por time
              const hasGk = teams[t].some(name => goleiros.includes(name));
              if (hasGk) break;
              const g = goleiros.find(name => !teams[t].includes(name));
              if (g) {
                teams[t].push(g);
              } else {
                break; // todos os goleiros já estão neste time
              }
            } else if (isVolleyLike && levantadores.length > 0) {
              // Adiciona no máximo 1 levantador por time
              const hasSetter = teams[t].some(name => levantadores.includes(name));
              if (hasSetter) break;
              const l = levantadores.find(name => !teams[t].includes(name));
              if (l) {
                teams[t].push(l);
              } else {
                break; // todos os levantadores já estão neste time
              }
            } else {
              break;
            }
          }
        }
        // 5) Reservas: o que sobrar (se total > teamCount*teamSize)
        const usedCount = teamCount * teamSize;
        const reservas = totalCount > usedCount
          ? [...fixos, ...arrLivres].slice(usedCount)
          : [];
        teams.forEach((t, idx) => {
          const icon = teamIcons[idx % teamIcons.length];
          text += `\n\n**${icon} Time ${idx + 1} (${t.length})**:\n${fmt(t)}`;
        });
        if (reservas.length) {
          text += `\n\n**🪑 Reservas (${reservas.length})**:\n${fmt(reservas)}`;
        }
      } else {
        // Participantes insuficientes para 2 times completos: ainda assim montar 2 times balanceados
        const arr = [...fixos, ...arrLivres];
        if (arr.length === 0) {
          addIsisMessage('Não há participantes suficientes para formar times.');
          return;
        }
        if (arr.length === 1) {
          // Caso limite: apenas 1 jogador
          text += `\n\nℹ️ Ainda não há jogadores suficientes para formar 2 times. Adicione mais participantes.`;
          text += `\n\n**🟠 Time 1 (1)**:\n1) ${arr[0]}${getFixoLabel(arr[0])}`;
        } else {
          const t1Count = Math.min(teamSize, Math.ceil(arr.length / 2));
          const t2Count = Math.min(teamSize, arr.length - t1Count);
          const t1 = arr.slice(0, t1Count);
          const t2 = arr.slice(t1Count, t1Count + t2Count);
          text += `\n\n⚠️ Jogadores insuficientes para 2 equipes completas de ${teamSize}. Montei 2 times balanceados de ${t1.length} e ${t2.length}.`;
          text += `\n\n**🟠 Time 1 (${t1.length})**:\n${fmt(t1)}`;
          text += `\n\n**🔵 Time 2 (${t2.length})**:\n${fmt(t2)}`;
        }
      }
      const copyText = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
      addIsisMessage({ text, copyable: true, copyText }, 600);
      // Sempre permite "Gerar novamente" após gerar
      const allowRegen = true;
      const again = [
        ...(allowRegen ? [{ label: 'Gerar novamente', value: 'gerar_times_again', icon: '🎲' }] : []),
        { label: 'Concluir', value: 'aceitar_times', icon: '✅' },
      ];
      // Mostra as opções logo abaixo do balão de times, com rótulo visível
      addIsisMessageWithButtons('Tudo certo com os times?', again, 1400);
    } catch (e) {
      addIsisMessage('Não foi possível gerar times agora. Tente novamente.');
    }
  };

  // Handler para confirmação final
  const handleConfirmacao = async (button) => {
    // Se o botão tem propriedade 'quadra', é um botão de seleção de quadra
    if (button.quadra) {
      await handleQuadraSelection(button);
      return;
    }
    
    // Se o botão tem propriedade 'date', é um botão de seleção de data
    if (button.date) {
      await handleDataSelection(button);
      return;
    }
    
    // Se o botão tem propriedade 'agendamento', é um botão de seleção de agendamento
    if (button.agendamento) {
      const dataFormatada = format(new Date(button.agendamento.inicio), 'dd/MM/yyyy', { locale: ptBR });
      const horaInicio = format(new Date(button.agendamento.inicio), 'HH:mm');
      const horaFim = format(new Date(button.agendamento.fim), 'HH:mm');
      
      addUserMessage(`${dataFormatada} • ${horaInicio}-${horaFim}`);
      await carregarAgendamentoParaEdicao(button.agendamento);
      return;
    }
    
    switch (button.value) {
      case 'instalar_app': {
        addUserMessage('📲 Instalar App');
        const globalPrompt = typeof window !== 'undefined' ? window.__installPrompt : null;
        if (globalPrompt) {
          try {
            const dp = globalPrompt;
            if (typeof window !== 'undefined') window.__installPrompt = null;
            await dp.prompt();
            const choice = await dp.userChoice;
            if (choice && choice.outcome === 'accepted') {
              addIsisMessage('Legal! Instalando o app… 📲', 400);
            } else {
              addIsisMessage('Tudo bem! Você pode instalar mais tarde pelo menu do navegador. 😉', 400);
            }
          } catch (_) {
            // fallback para deferredPrompt local
            if (deferredPrompt) {
              try {
                const dp2 = deferredPrompt;
                setDeferredPrompt(null);
                await dp2.prompt();
                const choice2 = await dp2.userChoice;
                if (choice2 && choice2.outcome === 'accepted') {
                  addIsisMessage('Legal! Instalando o app… 📲', 400);
                } else {
                  addIsisMessage('Tudo bem! Você pode instalar mais tarde pelo menu do navegador. 😉', 400);
                }
              } catch {
                mostrarTutorialInstalacao();
              }
            } else {
              mostrarTutorialInstalacao();
            }
          }
        } else if (deferredPrompt) {
          try {
            const dp = deferredPrompt;
            setDeferredPrompt(null);
            await dp.prompt();
            const choice = await dp.userChoice;
            if (choice && choice.outcome === 'accepted') {
              addIsisMessage('Legal! Instalando o app… 📲', 400);
            } else {
              addIsisMessage('Tudo bem! Você pode instalar mais tarde pelo menu do navegador. 😉', 400);
            }
          } catch (_) {
            mostrarTutorialInstalacao();
          }
        } else {
          mostrarTutorialInstalacao();
        }
        break;
      }
      case 'corrigir_telefone': {
        addUserMessage('☎️ Informei o telefone errado');
        updateSelection('cliente', null);
        updateSelection('identificacao_valor', null);
        setTipoIdentificacao('telefone');
        setShowInput(true);
        nextStep('identificacao');
        break;
      }
      case 'corrigir_email': {
        addUserMessage('✉️ Informei o e-mail errado');
        updateSelection('cliente', null);
        updateSelection('identificacao_valor', null);
        setTipoIdentificacao('email');
        setShowInput(true);
        nextStep('identificacao');
        break;
      }
      case 'continuar_fluxo': {
        perguntarAcaoInicial();
        break;
      }
      case 'gerar_times':
      case 'gerar_times_again': {
        addUserMessage(button.value === 'gerar_times_again' ? '🎲 Gerar novamente' : '🎲 Gerar Times');
        await gerarTimesEApresentar();
        break;
      }
      case 'aceitar_times': {
        addUserMessage('✅ Concluir');
        // Pergunta o que fazer agora e mostra o mesmo menu inicial pós-identificação
        addIsisMessage('Beleza! O que você gostaria de fazer agora?', 400);
        setTimeout(() => {
          perguntarAcaoInicial();
        }, 800);
        break;
      }
      case 'confirm':
        // Marca botão como clicado (usuário vê)
        const confirmText = agendamentoCriado ? '✅ Salvar Alterações' : '✅ Confirmar Agendamento';
        addUserMessage(confirmText);
        
        // Confirma agendamento (cria novo ou atualiza existente)
        if (agendamentoCriado) {
          await atualizarAgendamento();
        } else {
          await criarAgendamento();
        }
        break;
      case 'criar agendamento':
        // Fluxo explícito para novo agendamento
        addUserMessage('✅ Confirmar Agendamento');
        await criarAgendamento();
        break;
        
      case 'edit_quadra':
        addUserMessage('✏️ Editar Quadra');
        
        // Mostra botões de quadras novamente (igual ao fluxo inicial)
        const quadraButtons = quadras.map(q => ({
          label: q.nome,
          value: q.id,
          icon: '🏟️',
          subtitle: q.descricao || q.tipo || null,
          quadra: q
        }));
        
        addIsisMessageWithButtons('Qual quadra você quer?', quadraButtons, 600);
        break;
        
      case 'edit_data':
        addUserMessage('✏️ Editar Data');
        
        // Mostra botões de data (igual ao fluxo inicial)
        const hoje = new Date();
        const amanha = addDays(hoje, 1);
        
        const dataButtons = [
          {
            label: `Hoje (${format(hoje, 'dd/MM')})`,
            value: format(hoje, 'yyyy-MM-dd'),
            icon: '📅',
            date: hoje
          },
          {
            label: `Amanhã (${format(amanha, 'dd/MM')})`,
            value: format(amanha, 'yyyy-MM-dd'),
            icon: '📅',
            date: amanha
          },
          {
            label: 'Outro dia...',
            value: 'custom',
            icon: '🗓️'
          }
        ];
        
        addIsisMessageWithButtons('Para qual dia?', dataButtons, 600);
        break;
        
      case 'edit_horario':
        addUserMessage('✏️ Editar Horário e Esporte');
        setShowInput(false);
        setEditingType('horario'); // Define que está editando horário
        setIsLoading(true);
        
        // Recarrega horários disponíveis (incluindo horário atual se editando agendamento existente)
        const resultado = await loadHorariosDisponiveis(selections.quadra.id, selections.data, agendamentoCriado?.id);
        
        setIsLoading(false);
        
        // Verifica se a quadra está fechada
        if (resultado.fechada) {
          const dataFormatada = format(selections.data, "dd/MM/yyyy", { locale: ptBR });
          const diaSemana = format(selections.data, "EEEE", { locale: ptBR });
          
          if (resultado.motivo === 'data_especifica') {
            addIsisMessage(`**Ops!** A quadra estará **fechada** no dia **${dataFormatada}** (${diaSemana}). 🚫\n\n**Motivo:** ${resultado.observacao}`, 800);
          } else if (resultado.motivo === 'dia_semana') {
            const diaDaSemana = format(selections.data, "EEEE", { locale: ptBR });
            const preposicao = diaDaSemana === 'domingo' || diaDaSemana === 'sábado' ? 'aos' : 'às';
            addIsisMessage(`**Ops!** A quadra não funciona ${preposicao} **${diaDaSemana}s**. 🚫`, 800);
          }
          
          setTimeout(() => {
            addIsisMessage('Não é possível editar o horário. Escolha **outra data** ou **quadra**:', 1200);
            setTimeout(() => {
              mostrarSelecaoData();
            }, 400);
          }, 1600);
          return;
        }
        
        const horariosSlots = resultado.slots;
        if (horariosSlots && horariosSlots.length > 0) {
          // Agrupa slots em intervalos contínuos
          const intervalos = agruparSlotsEmIntervalos(horariosSlots);
          
          // Monta mensagem com os intervalos (igual fluxo normal)
          let msgIntervalos = '';
          if (intervalos.length === 1) {
            msgIntervalos = `Tenho **horários livres** das **${intervalos[0].inicio}** às **${intervalos[0].fim}**! 🕒`;
          } else {
            const partes = intervalos.map((int, idx) => {
              if (idx === intervalos.length - 1) {
                return `e das **${int.inicio}** às **${int.fim}**`;
              } else if (idx === 0) {
                return `das **${int.inicio}** às **${int.fim}**`;
              } else {
                return `das **${int.inicio}** às **${int.fim}**`;
              }
            });
            msgIntervalos = `Tenho **horários livres** ${partes.join(', ')}! 🕒`;
          }
          
          addIsisMessage(msgIntervalos, 600);
          
          setTimeout(() => {
            addIsisMessage('Escolha o horário de início e término: ⏰', 800);
            // Mantém no step review para detectar edição
            
            setTimeout(() => {
              setShowInput(true);
              setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 300);
            }, 1000);
          }, 800);
        } else {
          addIsisMessage('Ops! Não encontrei **horários disponíveis**. 😔');
        }
        break;
        
      case 'edit_participantes':
        addUserMessage('✏️ Editar Participantes');
        setShowInput(false);
        setEditingType('participantes'); // Define que está editando participantes
        
        addIsisMessage('Edite a lista de participantes:', 600);
        
        setTimeout(() => {
          setShowInput(true);
          setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }, 800);
        
        // Mantém no step review (handleFinalizarParticipantes sempre volta pro resumo)
        break;
      
      case 'finalizar':
        addUserMessage('✅ Finalizar Atendimento');
        
        // Mensagem de agradecimento (para agendamentos criados)
        const thankYouMessages = [
          'Pronto! Seu agendamento está confirmado! 🎉',
          'Perfeito! Agendamento realizado com sucesso! ✅',
          'Tudo certo! Seu horário está garantido! 🏆',
          'Sucesso! Agendamento confirmado! 💪'
        ];
        
        const randomThankYou = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
        addIsisMessage(randomThankYou, 800);
        
        // Vai direto para avaliação ao invés de perguntar o que fazer
        setTimeout(() => {
          iniciarAvaliacao();
        }, 1400);
        break;
      
      case 'cancelar_agendamento':
        addUserMessage('❌ Cancelar Agendamento');
        
        // Confirma se realmente quer cancelar
        const cancelButtons = [
          {
            label: 'Sim, cancelar',
            value: 'confirmar_cancelamento',
            icon: '✅'
          },
          {
            label: 'Não, voltar',
            value: 'voltar_cancelamento',
            icon: '↩️'
          }
        ];
        
        const cancelMessages = [
          'Tem certeza que deseja cancelar este agendamento?',
          'Confirma o cancelamento do agendamento?',
          'Realmente quer cancelar? Esta ação não pode ser desfeita.',
          'Deseja mesmo cancelar este agendamento?'
        ];
        
        const randomCancelMsg = cancelMessages[Math.floor(Math.random() * cancelMessages.length)];
        addIsisMessageWithButtons(randomCancelMsg, cancelButtons, 600);
        break;
      
      case 'confirmar_cancelamento':
        await cancelarAgendamento();
        break;
        
      case 'voltar_cancelamento':
        addUserMessage('↩️ Voltar');
        addIsisMessage('Ok! Voltando ao resumo do agendamento.', 400);
        setTimeout(() => {
          // Volta para o resumo de edição sem mensagem de confirmação
          mostrarResumo(null, null, true, null, null, null, agendamentoCriado);
        }, 800);
        break;
      
      case 'editar_agendamento':
        addUserMessage('✏️ Editar Agendamento');
        
        addIsisMessage('Claro! O que você gostaria de alterar?', 600);
        
        // Volta para o resumo de revisão para permitir edição (sem mensagem de confirmação)
        setTimeout(() => {
          mostrarResumo(null, null, true); // true = modo edição inicial
        }, 800);
        break;
      
      case 'novo_agendamento':
        addUserMessage('📅 Fazer Agendamento');
        iniciarAgendamento();
        break;
        
      case 'buscar_agendamento':
        addUserMessage('✏️ Editar Agendamento');
        addIsisMessage('Vou buscar seus agendamentos...', 600);
        buscarAgendamentosCliente();
        break;
        
      case 'finalizar_atendimento':
        addUserMessage('👋 Finalizar Atendimento');
        
        // Inicia processo de avaliação
        iniciarAvaliacao();
        break;
        
      default:
        console.warn('[Isis] Ação não reconhecida:', button.value);
    }
  };
  
  // Busca agendamentos do cliente para edição
  const buscarAgendamentosCliente = async () => {
    try {
      console.log('[buscarAgendamentosCliente] Iniciando busca de agendamentos...');
      // setIsLoading(true); // Removido para usar apenas indicador de digitando
      
      // Busca agendamentos futuros do cliente (não cancelados)
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          codigo,
          inicio,
          fim,
          modalidade,
          status,
          valor_total,
          quadras!inner(nome, descricao, valor)
        `)
        .eq('codigo_empresa', codigoEmpresa)
        .eq('cliente_id', selections.cliente.id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('inicio', new Date().toISOString())
        .order('inicio', { ascending: true });
      
      if (error) throw error;
      
      // setIsLoading(false); // Removido para usar apenas indicador de digitando
      
      if (!agendamentos || agendamentos.length === 0) {
        // Nenhum agendamento encontrado
        addIsisMessage('Não encontrei agendamentos futuros para você. 😔', 800);
        addIsisMessage('Que tal fazer um novo agendamento? 😊', 1400);
        
        setTimeout(() => {
          iniciarAgendamento();
        }, 2000);
        return;
      }
      
      if (agendamentos.length === 1) {
        // Apenas um agendamento - seleciona automaticamente
        const agendamento = agendamentos[0];
        const dataFormatada = format(new Date(agendamento.inicio), 'dd/MM/yyyy', { locale: ptBR });
        const horaInicio = format(new Date(agendamento.inicio), 'HH:mm');
        const horaFim = format(new Date(agendamento.fim), 'HH:mm');
        
        addIsisMessage(`Encontrei seu agendamento para ${dataFormatada} das ${horaInicio} às ${horaFim} - ${agendamento.modalidade}! 🎯`, 800);
        
        setTimeout(() => {
          carregarAgendamentoParaEdicao(agendamento);
        }, 1200);
      } else {
        // Múltiplos agendamentos - permite escolher
        addIsisMessage(`Encontrei ${agendamentos.length} agendamentos futuros! Qual você quer editar?`, 800);
        
        const agendamentoButtons = agendamentos.map(ag => {
          const dataInicio = new Date(ag.inicio);
          const dataFormatada = format(dataInicio, 'dd/MM/yyyy', { locale: ptBR });
          const diaSemana = format(dataInicio, 'EEEE', { locale: ptBR });
          const horaInicio = format(dataInicio, 'HH:mm');
          const horaFim = format(new Date(ag.fim), 'HH:mm');
          
          // Calcula duração
          const duracaoMinutos = (new Date(ag.fim) - dataInicio) / (1000 * 60);
          const duracaoHoras = Math.floor(duracaoMinutos / 60);
          const duracaoRestante = duracaoMinutos % 60;
          let duracaoTexto = '';
          if (duracaoHoras > 0) {
            duracaoTexto = duracaoRestante > 0 ? `${duracaoHoras}h${duracaoRestante}m` : `${duracaoHoras}h`;
          } else {
            duracaoTexto = `${duracaoRestante}m`;
          }
          
          // Recalcula valor correto baseado na duração e valor da quadra
          const valorPorMeiaHora = Number(ag.quadras?.valor ?? 0);
          const slots = duracaoMinutos / 30; // Slots de 30 minutos
          const valorCorreto = Math.round(valorPorMeiaHora * slots * 100) / 100;
          
          // Usa valor recalculado ao invés do valor do banco
          const valorFormatado = valorCorreto.toFixed(2).replace('.', ',');
          
          // Determina se é hoje, amanhã ou outra data
          const hoje = new Date();
          const amanha = new Date(hoje);
          amanha.setDate(hoje.getDate() + 1);
          
          let dataDisplay = '';
          if (dataInicio.toDateString() === hoje.toDateString()) {
            dataDisplay = 'Hoje';
          } else if (dataInicio.toDateString() === amanha.toDateString()) {
            dataDisplay = 'Amanhã';
          } else {
            dataDisplay = `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dataFormatada}`;
          }
          
          return {
            label: `${dataDisplay} • ${horaInicio}-${horaFim}`,
            value: `editar_agendamento_${ag.id}`,
            icon: '🏟️',
            subtitle: `${(ag.quadras?.nome || 'Quadra')} • ${(ag.modalidade || '—')} • ${duracaoTexto}`,
            agendamento: ag
          };
        });
        
        setTimeout(() => {
          addIsisMessageWithButtons('Escolha o agendamento:', agendamentoButtons, 600);
        }, 1200);
      }
      
    } catch (error) {
      console.error('[Isis] Erro ao buscar agendamentos:', error);
      // setIsLoading(false); // Removido para usar apenas indicador de digitando
      
      addIsisMessage('Ops! Tive um problema ao buscar seus agendamentos. 😔', 800);
      addIsisMessage('Que tal tentar fazer um novo agendamento?', 1400);
      
      setTimeout(() => {
        iniciarAgendamento();
      }, 2000);
    }
  };
  
  // Carrega agendamento existente para edição
  const carregarAgendamentoParaEdicao = async (agendamento) => {
    try {
      console.log('[carregarAgendamentoParaEdicao] Iniciando carregamento do agendamento:', agendamento.id);
      // Usa indicador de digitando ao invés de loading
      // setIsLoading(true);
      
      // Busca dados completos do agendamento
      console.debug('[carregarAgendamentoParaEdicao] Iniciando JOIN: agendamentos ⇢ quadras, agendamento_participantes');
      const { data: agendamentoCompleto, error: agendamentoError } = await supabase
        .from('agendamentos')
        .select(`
          *,
          quadras(id, nome, descricao, modalidades, valor),
          agendamento_participantes(nome, cliente_id)
        `)
        .eq('id', agendamento.id)
        .single();
      console.debug('[carregarAgendamentoParaEdicao] Resultado JOIN:', {
        hasError: !!agendamentoError,
        error: agendamentoError?.message,
        code: agendamentoError?.code,
        participantes_len: Array.isArray(agendamentoCompleto?.agendamento_participantes) ? agendamentoCompleto.agendamento_participantes.length : null
      });
      
      if (agendamentoError) {
        console.error('[Isis] Erro ao buscar agendamento:', agendamentoError);
        throw new Error(`Agendamento não encontrado ou inacessível: ${agendamentoError.message}`);
      }
      
      if (!agendamentoCompleto) {
        throw new Error('Agendamento não encontrado');
      }
      
      // Empresa já foi carregada no useEffect inicial, não precisa carregar novamente
      // await loadEmpresa(); // REMOVIDO - não é necessário, a empresa já está carregada
      
      // setIsLoading(false); // Removido para usar apenas indicador de digitando
      
      // Popula selections com dados do agendamento
      const dataAgendamento = new Date(agendamentoCompleto.inicio);
      const horaInicio = format(dataAgendamento, 'HH:mm');
      const horaFim = format(new Date(agendamentoCompleto.fim), 'HH:mm');
      
      // Garantir quadra mesmo se o join vier nulo por RLS
      let quadraFromJoin = agendamentoCompleto.quadras || null;
      if (!quadraFromJoin) {
        try {
          const { data: quadraFetched } = await supabase
            .from('quadras')
            .select('id, nome, descricao, modalidades, valor')
            .eq('id', agendamentoCompleto.quadra_id)
            .single();
          quadraFromJoin = quadraFetched || null;
        } catch {}
      }

      updateSelection('quadra', quadraFromJoin);
      updateSelection('data', dataAgendamento);
      updateSelection('horario', {
        inicio: horaInicio,
        fim: horaFim,
        inicioDate: new Date(agendamentoCompleto.inicio),
        fimDate: new Date(agendamentoCompleto.fim)
      });
      updateSelection('esporte', agendamentoCompleto.modalidade);
      
      // Monta lista de participantes garantindo que o cliente responsável seja o principal
      const participanteClienteId = agendamentoCompleto.cliente_id || selections.cliente?.id || null;
      let brutos = agendamentoCompleto.agendamento_participantes || [];

      // Se o JOIN não trouxe participantes (possível bloqueio de RLS), tenta SELECT direto para log/contorno
      if (!brutos || brutos.length === 0) {
        try {
          console.debug('[carregarAgendamentoParaEdicao] JOIN sem participantes. Fazendo SELECT direto em agendamento_participantes...');
          const { data: partsDirect, error: partsErr } = await supabase
            .from('agendamento_participantes')
            .select('nome, cliente_id, codigo_empresa')
            .eq('agendamento_id', agendamento.id);
          console.debug('[carregarAgendamentoParaEdicao] SELECT direto participantes:', {
            hasError: !!partsErr,
            error: partsErr?.message,
            code: partsErr?.code,
            count: Array.isArray(partsDirect) ? partsDirect.length : null
          });
          if (Array.isArray(partsDirect) && partsDirect.length > 0) {
            brutos = partsDirect.map(p => ({ nome: p.nome, cliente_id: p.cliente_id }));
          }
        } catch (e) {
          console.debug('[carregarAgendamentoParaEdicao] Falha no SELECT direto participantes:', e?.message || e);
        }
      }
      let principalParticipante = null;
      const outrosParticipantes = [];

      brutos.forEach((p) => {
        const isPrincipal = participanteClienteId && p.cliente_id === participanteClienteId;
        const item = {
          nome: p.nome,
          cliente_id: p.cliente_id,
          principal: isPrincipal
        };
        if (isPrincipal && !principalParticipante) {
          principalParticipante = item;
        } else {
          outrosParticipantes.push(item);
        }
      });

      const participantes = principalParticipante
        ? [
            principalParticipante,
            ...outrosParticipantes.map(p => ({ ...p, principal: false }))
          ]
        : brutos.map((p, index) => ({
            nome: p.nome,
            cliente_id: p.cliente_id,
            principal: index === 0
          }));
      
      updateSelection('participantes', participantes);
      // Marca que estamos no fluxo de edição de agendamento existente
      try { updateSelection('editing_agendamento', true); } catch {}
      // Restaura papéis fixos a partir do banco (meta_roles); fallback para localStorage
      try {
        const meta = agendamentoCompleto?.meta_roles || null;
        if (meta && typeof meta === 'object') {
          const levs = Array.isArray(meta.levantadores) ? meta.levantadores : [];
          const gols = Array.isArray(meta.goleiros) ? meta.goleiros : [];
          const fixos = Array.isArray(meta.fixos) ? meta.fixos : Array.from(new Set([...levs, ...gols]));
          const map = meta.fixoRoles && typeof meta.fixoRoles === 'object' ? meta.fixoRoles : {};
          updateSelection('levantadores', levs);
          updateSelection('goleiros', gols);
          updateSelection('fixos', fixos);
          updateSelection('fixoRoles', map);
        } else {
          const key = `f7a:fixos:${agendamentoCompleto.id}`;
          const saved = JSON.parse(localStorage.getItem(key) || 'null');
          if (saved && typeof saved === 'object') {
            const levs = Array.isArray(saved.levantadores) ? saved.levantadores : [];
            const gols = Array.isArray(saved.goleiros) ? saved.goleiros : [];
            const fixos = Array.isArray(saved.fixos) ? saved.fixos : Array.from(new Set([...levs, ...gols]));
            const map = saved.fixoRoles && typeof saved.fixoRoles === 'object' ? saved.fixoRoles : {};
            updateSelection('levantadores', levs);
            updateSelection('goleiros', gols);
            updateSelection('fixos', fixos);
            updateSelection('fixoRoles', map);
          }
        }
      } catch {}
      
      // Armazena o agendamento para edição IMEDIATAMENTE
      setAgendamentoCriado(agendamentoCompleto);
      
      // Mostra resumo em modo de edição
      addIsisMessage('Perfeito! Aqui estão os detalhes do seu agendamento:', 600);
      
      // Aguarda tempo suficiente para que as selections sejam atualizadas pelo contexto
      setTimeout(() => {
        // Passa TODOS os dados diretamente para mostrarResumo para evitar problemas de timing
        const horarioData = {
          inicio: horaInicio,
          fim: horaFim,
          inicioDate: new Date(agendamentoCompleto.inicio),
          fimDate: new Date(agendamentoCompleto.fim)
        };
        
        if (quadraFromJoin) {
          mostrarResumo(
            horarioData,                           // horário
            agendamentoCompleto.modalidade,        // esporte
            true,                                  // modo edição inicial
            quadraFromJoin,                        // quadra garantida
            dataAgendamento,                       // data
            participantes,                         // participantes
            agendamentoCompleto                    // agendamento para edição
          );
          nextStep('review');
        } else {
          // Se ainda não temos quadra, orientar usuário a selecionar novamente
          addIsisMessage('Não consegui carregar os dados da quadra deste agendamento. Vamos escolher a quadra novamente?', 800);
          setTimeout(() => {
            // Reaproveita fluxo de seleção de quadra inicial
            const quadraButtons = quadras.map(q => ({
              label: q.nome,
              value: q.id,
              icon: '🏟️',
              subtitle: q.descricao || q.tipo || null,
              quadra: q
            }));
            addIsisMessageWithButtons('Qual quadra você quer?', quadraButtons, 600);
          }, 1200);
        }
      }, 1400); // Delay único maior para aguardar atualização do contexto
      
    } catch (error) {
      console.error('[Isis] Erro ao carregar agendamento:', error);
      // setIsLoading(false); // Removido para usar apenas indicador de digitando
      
      // Mensagem mais específica baseada no tipo de erro
      if (error.message.includes('não encontrado')) {
        addIsisMessage('Ops! Este agendamento não foi encontrado ou pode ter sido cancelado. 😔', 800);
        addIsisMessage('Vou buscar seus agendamentos atualizados...', 1400);
        setTimeout(() => {
          buscarAgendamentosCliente(); // Busca novamente
        }, 2000);
      } else {
        addIsisMessage('Ops! Tive um problema ao carregar o agendamento. 😔', 800);
        addIsisMessage('Que tal tentar fazer um novo agendamento?', 1400);
        setTimeout(() => {
          iniciarAgendamento();
        }, 2000);
      }
    }
  };
  
  // Cancela o agendamento existente
  const cancelarAgendamento = async () => {
    if (!agendamentoCriado) {
      console.error('[Isis] Nenhum agendamento para cancelar');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Atualiza status do agendamento para cancelado
      const { error: agendamentoError } = await supabase
        .from('agendamentos')
        .update({ status: 'canceled' })
        .eq('id', agendamentoCriado.id);
      
      if (agendamentoError) throw agendamentoError;
      
      // Sucesso!
      setIsLoading(false);
      
      // Mensagens variadas de cancelamento
      const cancelSuccessMessages = [
        '✅ Agendamento cancelado com sucesso!',
        '✅ Pronto! Seu agendamento foi cancelado.',
        '✅ Cancelamento realizado! Agendamento removido.',
        '✅ Feito! O agendamento foi cancelado com sucesso.'
      ];
      
      const randomSuccessMsg = cancelSuccessMessages[Math.floor(Math.random() * cancelSuccessMessages.length)];
      addIsisMessage(randomSuccessMsg, 600);
      
      // Limpa o agendamento criado
      setAgendamentoCriado(null);
      
      // Pergunta o que quer fazer agora
      setTimeout(() => {
        addIsisMessage('O que você gostaria de fazer agora?', 800);
        setTimeout(() => {
          perguntarAcaoInicial();
        }, 1200);
      }, 1200);
      
    } catch (error) {
      console.error('[Isis] Erro ao cancelar agendamento:', error);
      setIsLoading(false);
      
      const errorMsg = getIsisMessage('error');
      addIsisMessage(errorMsg);
    }
  };
  
  // Inicia processo de avaliação
  const iniciarAvaliacao = () => {
    // Desabilita todos os botões anteriores para evitar que apareçam durante avaliação
    disableAllButtons();
    
    const mensagensAvaliacao = [
      // Mensagens diretas e amigáveis
      'Antes de finalizar, que tal me dar uma avaliação? 😊',
      'Para finalizar, gostaria que avaliasse nosso atendimento! ⭐',
      'Quase pronto! Me ajuda com uma avaliação rápida? 🌟',
      'Última etapa! Como foi nosso atendimento hoje? ⭐',
      'Para encerrar, que nota você daria para nosso atendimento? 😊',
      
      // Mensagens mais casuais e descontraídas
      'Ei, que tal me contar como foi a experiência? 🤔',
      'Curiosa para saber: como você avalia nosso atendimento? 💭',
      'Rapidinho aqui: o que achou do nosso serviço? ⚡',
      'Me conta aí, como foi para você hoje? 😄',
      'Sua opinião é super importante! Como foi tudo? 💬',
      
      // Mensagens focadas na melhoria
      'Sua avaliação nos ajuda a melhorar! Como foi? 📈',
      'Para continuarmos evoluindo, como você nos avalia? 🚀',
      'Queremos sempre melhorar! Que nota você daria? 💪',
      'Seu feedback é ouro para nós! Como foi o atendimento? 🏆',
      'Ajude-nos a ser ainda melhores! Qual sua avaliação? ✨',
      
      // Mensagens mais pessoais
      'Espero ter te ajudado bem! Como você me avalia? 🤗',
      'Fiz um bom trabalho hoje? Me conta sua opinião! 😊',
      'Consegui resolver tudo certinho? Que tal uma avaliação? 👍',
      'Antes de você ir, me diz como foi nossa conversa? 💫',
      'Sua experiência foi boa? Adoraria saber! 🌈',
      
      // Mensagens com gratidão
      'Obrigada pela confiança! Como foi para você? 🙏',
      'Foi um prazer te atender! Que nota você daria? 💝',
      'Agradeço pela paciência! Como avalia nosso serviço? 🌸',
      'Muito obrigada! Me conta como foi tudo? 💖',
      
      // Mensagens incentivando honestidade
      'Pode ser sincero(a)! Como foi o atendimento? 🎯',
      'Sem papas na língua: que nota você daria? 😉',
      'Honestamente, como você nos avalia? 🔍',
      'Sua opinião real é importante! Como foi? 💯',
      
      // Mensagens mais técnicas/profissionais
      'Para finalizar o atendimento, preciso da sua avaliação! 📋',
      'Processo quase concluído! Falta só sua avaliação! ✅',
      'Última etapa do nosso protocolo: sua opinião! 📝',
      'Para encerrar com chave de ouro: como nos avalia? 🔑'
    ];
    
    const randomMsg = mensagensAvaliacao[Math.floor(Math.random() * mensagensAvaliacao.length)];
    addIsisMessage(randomMsg, 800);
    
    // Mostra input de avaliação
    setTimeout(() => {
      setShowInput(true);
      nextStep('avaliacao');
      
      // Scroll após input aparecer
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }, 1200);
  };
  
  // Handler para submissão da avaliação
  const handleAvaliacaoSubmit = async (avaliacaoData) => {
    try {
      // Mostra mensagem do usuário
      const ratingText = `${avaliacaoData.rating} estrela${avaliacaoData.rating > 1 ? 's' : ''}`;
      const userMsg = avaliacaoData.comentario 
        ? `⭐ ${ratingText}\n💬 "${avaliacaoData.comentario}"`
        : `⭐ ${ratingText}`;
      
      addUserMessage(userMsg);
      setShowInput(false);
      setIsLoading(true);
      
      // Prepara dados do feedback conforme especificado
      const feedbackData = {
        rating: avaliacaoData.rating, // Será mapeado para 'estrelas' no JSONBin
        comentario: avaliacaoData.comentario, // Input de texto opcional
        cliente_nome: selections.cliente?.nome, // Nome do cliente
        empresa_nome: empresa?.nome_fantasia || empresa?.razao_social || 'Arena' // Nome da empresa de quadras
      };
      
      // Envia para JSONBin
      await adicionarFeedbackIsis(feedbackData);
      
      setIsLoading(false);
      
      // Mensagem única de agradecimento + despedida baseada na avaliação
      const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'a empresa';
      const hora = new Date().getHours();
      
      // Despedida contextualizada por horário
      let despedidaHorario;
      if (hora >= 5 && hora < 12) {
        despedidaHorario = 'Tenha um ótimo dia! ☀️';
      } else if (hora >= 12 && hora < 18) {
        despedidaHorario = 'Tenha uma ótima tarde! 🌤️';
      } else if (hora >= 18 && hora < 22) {
        despedidaHorario = 'Tenha uma ótima noite! 🌙';
      } else {
        despedidaHorario = 'Tenha uma boa noite! 🌃';
      }
      
      let mensagemFinal;
      
      if (avaliacaoData.rating >= 4) {
        const mensagensPositivas = [
          // Mensagens clássicas de agradecimento
          `🤩 **Muito obrigada pela avaliação!** A **${nomeEmpresa}** agradece imensamente! Foi um prazer te atender! ${despedidaHorario}`,
          `😊 **Que bom que gostou!** A **${nomeEmpresa}** fica muito feliz! Volte sempre! ${despedidaHorario}`,
          `🌟 **Perfeito!** A **${nomeEmpresa}** agradece de coração! Espero ter ajudado! ${despedidaHorario}`,
          `💖 **Adorei seu feedback!** A **${nomeEmpresa}** está muito grata! Nos vemos em breve! ${despedidaHorario}`,
          `🎉 **Excelente!** A **${nomeEmpresa}** agradece pela confiança! Até a próxima! ${despedidaHorario}`,
          
          // Mensagens mais entusiasmadas
          `🚀 **Uau, que nota incrível!** A **${nomeEmpresa}** está nas nuvens! Obrigada! ${despedidaHorario}`,
          `✨ **Você é demais!** A **${nomeEmpresa}** adora clientes como você! ${despedidaHorario}`,
          `🏆 **Top demais!** A **${nomeEmpresa}** se sente campeã com seu feedback! ${despedidaHorario}`,
          `💫 **Que alegria!** A **${nomeEmpresa}** fica radiante com sua avaliação! ${despedidaHorario}`,
          `🎊 **Sensacional!** A **${nomeEmpresa}** está celebrando sua nota! ${despedidaHorario}`,
          
          // Mensagens mais pessoais
          `😍 **Amei sua avaliação!** Fico feliz em saber que te atendi bem! A **${nomeEmpresa}** agradece! ${despedidaHorario}`,
          `🤗 **Que feedback maravilhoso!** Me deixou super feliz! A **${nomeEmpresa}** é grata! ${despedidaHorario}`,
          `💝 **Seu carinho me emociona!** A **${nomeEmpresa}** tem sorte de ter você! ${despedidaHorario}`,
          `🌈 **Você iluminou meu dia!** A **${nomeEmpresa}** agradece de todo coração! ${despedidaHorario}`,
          
          // Mensagens com convite para retorno
          `🎯 **Nota máxima!** A **${nomeEmpresa}** te espera sempre de braços abertos! ${despedidaHorario}`,
          `💎 **Cliente 5 estrelas!** A **${nomeEmpresa}** adora te ter aqui! Volte logo! ${despedidaHorario}`,
          `🌟 **Você é especial!** A **${nomeEmpresa}** sempre terá um lugar especial para você! ${despedidaHorario}`,
          `🎪 **Show de avaliação!** A **${nomeEmpresa}** te aguarda para a próxima apresentação! ${despedidaHorario}`
        ];
        mensagemFinal = mensagensPositivas[Math.floor(Math.random() * mensagensPositivas.length)];
      } else if (avaliacaoData.rating === 3) {
        const mensagensNeutras = [
          // Mensagens focadas em melhoria
          `😊 **Obrigada pelo feedback!** A **${nomeEmpresa}** vai melhorar ainda mais! ${despedidaHorario}`,
          `🙏 **Agradecemos sua avaliação!** A **${nomeEmpresa}** está trabalhando para evoluir! ${despedidaHorario}`,
          `💪 **Obrigada!** A **${nomeEmpresa}** valoriza seu retorno! Foi um prazer te atender! ${despedidaHorario}`,
          
          // Mensagens mais otimistas
          `🌱 **Toda avaliação nos faz crescer!** A **${nomeEmpresa}** agradece sua sinceridade! ${despedidaHorario}`,
          `🎯 **Feedback valioso!** A **${nomeEmpresa}** usa cada retorno para evoluir! ${despedidaHorario}`,
          `📈 **Obrigada pela nota!** A **${nomeEmpresa}** está sempre buscando melhorar! ${despedidaHorario}`,
          `🔧 **Seu retorno é importante!** A **${nomeEmpresa}** vai usar para aprimorar nosso serviço! ${despedidaHorario}`,
          
          // Mensagens com convite para nova chance
          `🤝 **Agradecemos a oportunidade!** A **${nomeEmpresa}** espera te surpreender na próxima! ${despedidaHorario}`,
          `💡 **Obrigada pela dica!** A **${nomeEmpresa}** vai trabalhar para te conquistar! ${despedidaHorario}`,
          `🎪 **Toda crítica construtiva é bem-vinda!** A **${nomeEmpresa}** agradece! ${despedidaHorario}`
        ];
        mensagemFinal = mensagensNeutras[Math.floor(Math.random() * mensagensNeutras.length)];
      } else {
        const mensagensNegativas = [
          // Mensagens empáticas e comprometidas
          `😔 **Obrigada pela sinceridade.** A **${nomeEmpresa}** vai trabalhar para melhorar! ${despedidaHorario}`,
          `💙 **Agradecemos seu feedback.** A **${nomeEmpresa}** está comprometida em evoluir! ${despedidaHorario}`,
          `🙏 **Obrigada por compartilhar.** A **${nomeEmpresa}** vai usar seu retorno para melhorar! ${despedidaHorario}`,
          
          // Mensagens mais humildes e responsáveis
          `😞 **Lamentamos não ter atendido suas expectativas.** A **${nomeEmpresa}** vai se esforçar mais! ${despedidaHorario}`,
          `💔 **Sentimos muito pela experiência.** A **${nomeEmpresa}** levará isso muito a sério! ${despedidaHorario}`,
          `🤲 **Assumimos a responsabilidade.** A **${nomeEmpresa}** vai fazer melhor da próxima vez! ${despedidaHorario}`,
          `😓 **Sua insatisfação nos preocupa.** A **${nomeEmpresa}** vai revisar todos os processos! ${despedidaHorario}`,
          
          // Mensagens com pedido de nova oportunidade
          `🔄 **Obrigada pelo alerta!** A **${nomeEmpresa}** espera uma nova chance de te impressionar! ${despedidaHorario}`,
          `💪 **Vamos melhorar!** A **${nomeEmpresa}** promete que da próxima vez será diferente! ${despedidaHorario}`,
          `🎯 **Seu feedback é nosso combustível!** A **${nomeEmpresa}** vai usar para crescer! ${despedidaHorario}`,
          `🛠️ **Já estamos trabalhando nas melhorias!** A **${nomeEmpresa}** agradece sua paciência! ${despedidaHorario}`,
          
          // Mensagens valorizando a honestidade
          `💯 **Sua honestidade é valiosa!** A **${nomeEmpresa}** prefere a verdade para evoluir! ${despedidaHorario}`,
          `🎪 **Críticas nos fazem crescer!** A **${nomeEmpresa}** agradece sua coragem de falar! ${despedidaHorario}`
        ];
        mensagemFinal = mensagensNegativas[Math.floor(Math.random() * mensagensNegativas.length)];
      }
      
      addIsisMessage(mensagemFinal, 600);
      
    } catch (error) {
      console.error('[Isis] Erro ao enviar avaliação:', error);
      setIsLoading(false);
      
      const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'a empresa';
      const hora = new Date().getHours();
      
      // Despedida contextualizada por horário
      let despedidaHorario;
      if (hora >= 5 && hora < 12) {
        despedidaHorario = 'Tenha um ótimo dia! ☀️';
      } else if (hora >= 12 && hora < 18) {
        despedidaHorario = 'Tenha uma ótima tarde! 🌤️';
      } else if (hora >= 18 && hora < 22) {
        despedidaHorario = 'Tenha uma ótima noite! 🌙';
      } else {
        despedidaHorario = 'Tenha uma boa noite! 🌃';
      }
      
      const mensagensErro = [
        // Mensagens técnicas mas amigáveis
        `Ops! Tive um problema ao salvar sua avaliação, mas a **${nomeEmpresa}** agradece muito seu feedback! ${despedidaHorario}`,
        `😊 Não consegui salvar sua avaliação, mas a **${nomeEmpresa}** agradece imensamente! ${despedidaHorario}`,
        
        // Mensagens mais descontraídas
        `🤖 Deu uma travadinha aqui, mas sua opinião já ficou guardada no meu coração! A **${nomeEmpresa}** agradece! ${despedidaHorario}`,
        `😅 Ops, falhei na tecnologia, mas não falhei em te ouvir! A **${nomeEmpresa}** valoriza seu feedback! ${despedidaHorario}`,
        `🔧 Parece que o sistema deu soluço, mas sua avaliação foi ouvida! A **${nomeEmpresa}** agradece! ${despedidaHorario}`,
        
        // Mensagens com humor leve
        `🤷‍♀️ A internet não colaborou, mas sua opinião chegou até mim! A **${nomeEmpresa}** é grata! ${despedidaHorario}`,
        `📡 Problema técnico aqui, mas o importante é que você compartilhou! A **${nomeEmpresa}** agradece! ${despedidaHorario}`,
        `💻 O sistema travou, mas sua avaliação não passou despercebida! A **${nomeEmpresa}** valoriza! ${despedidaHorario}`
      ];
      
      const mensagemErro = mensagensErro[Math.floor(Math.random() * mensagensErro.length)];
      addIsisMessage(mensagemErro, 600);
    }
  };
  
  // Atualiza o agendamento existente no banco
  const atualizarAgendamento = async () => {
    if (!agendamentoCriado) {
      console.error('[Isis] Nenhum agendamento para atualizar');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Usa o cliente identificado
      const cliente = selections.cliente;
      const participantesLista = selections.participantes || [];
      
      // Busca cliente consumidor (para participantes sem cadastro)
      const { data: clienteConsumidor } = await supabase
        .from('clientes')
        .select('id')
        .eq('codigo_empresa', codigoEmpresa)
        .eq('is_consumidor_final', true)
        .single();
      
      // Reorganiza participantes garantindo que o principal fique em primeiro
      const participantePrincipal = participantesLista.find(p => p.principal);
      const outrosParticipantes = participantesLista.filter(p => !p.principal);
      const participantesOrdenados = participantePrincipal ? [participantePrincipal, ...outrosParticipantes] : participantesLista;

      // Array de nomes para campo 'clientes' do agendamento (usando ordem correta)
      const nomesArray = participantesOrdenados.map(p => p.nome);
      
      // Calcula valor total baseado na duração
      const [h1, m1] = selections.horario.inicio.split(':').map(Number);
      const [h2, m2] = selections.horario.fim.split(':').map(Number);
      let duracaoMinutos = (h2 * 60 + m2) - (h1 * 60 + m1);
      
      // Se fim for 00:00, é meia-noite do dia seguinte
      if (h2 === 0 && m2 === 0) {
        duracaoMinutos = (24 * 60) - (h1 * 60 + m1);
      }
      
      const valorPorMeiaHora = selections.quadra.valor || 0;
      const slots = duracaoMinutos / 30; // Slots de 30 minutos
      const valorTotal = Math.round(valorPorMeiaHora * slots * 100) / 100;
      
      // Monta metaRoles a partir das selections (papéis fixos)
      const metaRoles = {
        levantadores: Array.isArray(selections.levantadores) ? selections.levantadores : [],
        goleiros: Array.isArray(selections.goleiros) ? selections.goleiros : [],
        fixos: Array.isArray(selections.fixos) ? selections.fixos : [],
        fixoRoles: (selections.fixoRoles && typeof selections.fixoRoles === 'object') ? selections.fixoRoles : {},
      };

      // Atualizar agendamento
      const { data: agendamento, error: agendamentoError } = await supabase
        .from('agendamentos')
        .update({
          quadra_id: selections.quadra.id,
          clientes: nomesArray,
          inicio: selections.horario.inicioDate.toISOString(),
          fim: selections.horario.fimDate.toISOString(),
          modalidade: selections.esporte,
          valor_total: valorTotal,
          meta_roles: metaRoles
        })
        .eq('id', agendamentoCriado.id)
        .select()
        .single();
      
      if (agendamentoError) throw agendamentoError;
      
      // Remove participantes antigos
      const { error: deleteError } = await supabase
        .from('agendamento_participantes')
        .delete()
        .eq('agendamento_id', agendamentoCriado.id);
      
      if (deleteError) throw deleteError;
      
      // Cria novos participantes preservando a ordem (principal primeiro)
      const participantes = participantesOrdenados.map((p, index) => ({
        agendamento_id: agendamento.id,
        codigo_empresa: codigoEmpresa,
        cliente_id: p.cliente_id || clienteConsumidor?.id,
        nome: p.nome,
        valor_cota: 0,
        status_pagamento: 'Pendente',
        ordem: index + 1
      }));
      
      const { error: participantesError } = await supabase
        .from('agendamento_participantes')
        .insert(participantes);
      
      if (participantesError) throw participantesError;
      
      // Sucesso!
      setIsLoading(false);
      
      // Atualiza o agendamento armazenado
      setAgendamentoCriado(agendamento);
      // Salva papéis fixos localmente para este agendamento
      try {
        const key = `f7a:fixos:${agendamento.id}`;
        const payload = {
          levantadores: selections.levantadores || [],
          goleiros: selections.goleiros || [],
          fixos: selections.fixos || [],
          fixoRoles: selections.fixoRoles || {},
        };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {}
      
      // Mostra resumo final do agendamento atualizado
      mostrarResumoFinal(agendamento, true);
      
      nextStep('confirmation');
      
    } catch (error) {
      console.error('[Isis] Erro ao atualizar agendamento:', error);
      setIsLoading(false);
      
      const errorMsg = getIsisMessage('error');
      addIsisMessage(errorMsg);
    }
  };
  
  // Cria o agendamento no banco
  const criarAgendamento = async () => {
    try {
      setIsLoading(true);
      
      // Usa o cliente identificado
      const cliente = selections.cliente;
      const participantesLista = selections.participantes || [];
      
      // Busca cliente consumidor (para participantes sem cadastro)
      const { data: clienteConsumidor } = await supabase
        .from('clientes')
        .select('id')
        .eq('codigo_empresa', codigoEmpresa)
        .eq('is_consumidor_final', true)
        .single();
      
      // Reorganizar participantes - garantir que o cliente principal seja sempre o primeiro
      const participantePrincipal = participantesLista.find(p => p.principal);
      const outrosParticipantes = participantesLista.filter(p => !p.principal);
      const participantesOrdenados = participantePrincipal ? [participantePrincipal, ...outrosParticipantes] : participantesLista;
      
      // Array de nomes para campo 'clientes' do agendamento - usando ordem correta
      const nomesArrayOrdenado = participantesOrdenados.map(p => p.nome);
      
      // Calcula valor total baseado na duração
      const [h1, m1] = selections.horario.inicio.split(':').map(Number);
      const [h2, m2] = selections.horario.fim.split(':').map(Number);
      let duracaoMinutos = (h2 * 60 + m2) - (h1 * 60 + m1);
      
      // Se fim for 00:00, é meia-noite do dia seguinte
      if (h2 === 0 && m2 === 0) {
        duracaoMinutos = (24 * 60) - (h1 * 60 + m1);
      }
      
      const valorPorMeiaHora = selections.quadra.valor || 0;
      const slots = duracaoMinutos / 30; // Slots de 30 minutos
      const valorTotal = Math.round(valorPorMeiaHora * slots * 100) / 100;
      
      // Monta metaRoles a partir das selections (papéis fixos)
      const metaRoles = {
        levantadores: Array.isArray(selections.levantadores) ? selections.levantadores : [],
        goleiros: Array.isArray(selections.goleiros) ? selections.goleiros : [],
        fixos: Array.isArray(selections.fixos) ? selections.fixos : [],
        fixoRoles: (selections.fixoRoles && typeof selections.fixoRoles === 'object') ? selections.fixoRoles : {},
      };

      // Busca o maior código já usado para esta empresa
      const { data: ultimoAgendamento } = await supabase
        .from('agendamentos')
        .select('codigo')
        .eq('codigo_empresa', codigoEmpresa)
        .order('codigo', { ascending: false })
        .limit(1)
        .single();
      
      let proximoCodigo = ultimoAgendamento ? ultimoAgendamento.codigo + 1 : 1;
      console.log('[criarAgendamento] Último código usado:', ultimoAgendamento?.codigo);
      console.log('[criarAgendamento] Próximo código inicial:', proximoCodigo);
      
      // Tenta criar agendamento, incrementando código se necessário
      let agendamento;
      let tentativas = 0;
      const maxTentativas = 10;
      
      while (!agendamento && tentativas < maxTentativas) {
        tentativas++;
        console.log('[criarAgendamento] Tentativa', tentativas, 'com código:', proximoCodigo);
        
        const { data, error } = await supabase
          .from('agendamentos')
          .insert({
            codigo: proximoCodigo,
            codigo_empresa: codigoEmpresa,
            quadra_id: selections.quadra.id,
            cliente_id: cliente.id,
            clientes: nomesArrayOrdenado,
            inicio: selections.horario.inicioDate.toISOString(),
            fim: selections.horario.fimDate.toISOString(),
            modalidade: selections.esporte,
            status: 'scheduled',
            valor_total: valorTotal,
            meta_roles: metaRoles
          })
          .select('id, codigo')
          .single();
        
        if (error) {
          if (error.code === '23505') {
            // Código duplicado, tenta o próximo
            console.log('[criarAgendamento] Código', proximoCodigo, 'já existe, tentando próximo...');
            proximoCodigo++;
          } else {
            // Outro erro, lança exceção
            throw error;
          }
        } else {
          // Sucesso!
          agendamento = data;
          console.log('[criarAgendamento] Agendamento criado com código:', agendamento.codigo);
        }
      }
      
      if (!agendamento) {
        throw new Error('Não foi possível gerar um código único após ' + maxTentativas + ' tentativas');
      }
      
      // Atualizar counter para manter sincronização com AgendaPage
      try {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('id')
          .eq('codigo_empresa', codigoEmpresa)
          .single();
          
        if (empresaData) {
          await supabase
            .from('empresa_counters')
            .update({ next_agendamento_codigo: agendamento.codigo + 1 })
            .eq('empresa_id', empresaData.id);
          
          console.log('[criarAgendamento] Counter atualizado para:', agendamento.codigo + 1);
        }
      } catch (counterError) {
        // Não bloqueia o fluxo se falhar - apenas loga
        console.warn('[criarAgendamento] Erro ao atualizar counter:', counterError);
      }
      
      // Criar participantes usando a ordem já definida (cliente principal primeiro)
      const participantes = participantesOrdenados.map((p, index) => ({
        codigo_empresa: codigoEmpresa,
        agendamento_id: agendamento.id,
        // Primeiro participante = cliente identificado, outros = cliente consumidor
        cliente_id: p.principal ? cliente.id : (clienteConsumidor?.id || null),
        nome: p.nome,
        valor_cota: 0,
        status_pagamento: 'Pendente',
        ordem: index + 1 // Garante que o primeiro participante tem ordem = 1, segundo = 2, etc.
      }));
      
      const { error: participantesError } = await supabase
        .from('agendamento_participantes')
        .insert(participantes);
      
      if (participantesError) throw participantesError;
      
      // Sucesso!
      setIsLoading(false);
      
      // Armazena o agendamento criado para edições posteriores
      setAgendamentoCriado(agendamento);
      // Salva papéis fixos localmente para este agendamento
      try {
        const key = `f7a:fixos:${agendamento.id}`;
        const payload = {
          levantadores: selections.levantadores || [],
          goleiros: selections.goleiros || [],
          fixos: selections.fixos || [],
          fixoRoles: selections.fixoRoles || {},
        };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {}
      
      // Mostra resumo final do agendamento confirmado
      mostrarResumoFinal(agendamento);
      
      nextStep('confirmation');
      
    } catch (error) {
      console.error('[Isis] Erro ao criar agendamento:', error);
      setIsLoading(false);
      
      const errorMsg = getIsisMessage('error');
      addIsisMessage(errorMsg);
      
      toast({
        title: 'Erro ao criar agendamento',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    }
  };
  
  // Handler centralizado para cliques em botões
  const handleButtonClick = (button, sourceMessageId) => {
    // Desabilita todos os botões imediatamente para evitar cliques duplos
    disableAllButtons();
    // Oculta SOMENTE os botões do balão de pergunta (mantendo o texto)
    if (sourceMessageId) {
      try { hideButtonsInMessage(sourceMessageId); } catch {}
    }
    
    switch (currentStep) {
      case 'quadra':
        handleQuadraSelection(button);
        break;
      case 'data':
        handleDataSelection(button);
        break;
      case 'identificacao':
        // Após identificação, trata botões de ação inicial
        handleConfirmacao(button);
        break;
      case 'review':
        handleConfirmacao(button);
        break;
      case 'confirmation':
        handleConfirmacao(button);
        break;
      case 'confirmar_cliente_existente': {
        const v = (button?.value || '').toString();
        if (v === 'confirm_cliente_existente') {
          const sugerido = selections?.cliente_sugerido || null;
          if (sugerido) {
            updateSelection('cliente', sugerido);
            updateSelection('cliente_sugerido', null);
            const nomeCurto = getNomeCurto(sugerido.nome || '');
            addIsisMessage(`Perfeito, **${nomeCurto}**! 👌`, 300);
            setShowInput(false);
            // segue para ações iniciais
            setTimeout(() => {
              try { perguntarAcaoInicial(); } catch {}
            }, 700);
          } else {
            // fallback: volta ao início de identificação
            setShowInput(true);
            nextStep('identificacao');
          }
        } else if (v === 'corrigir_cadastro') {
          // Volta para o formulário de cadastro para correção dos dados
          addIsisMessage('Sem problemas! Vamos corrigir seus dados. ✏️', 300);
          setShowInput(true);
          nextStep('cadastro');
        }
        break;
      }
      default:
        console.warn('[Isis] Nenhum handler para step:', currentStep);
    }
  };
  
  // Renderiza input apropriado baseado no step
  const renderInput = () => {
    console.log('[renderInput] currentStep:', currentStep, 'showInput:', showInput);
    
    // Não mostra input se showInput for false (efeito de delay)
    if (!showInput) {
      console.log('[renderInput] showInput=false, retornando null');
      return null;
    }
    
    if (currentStep === 'participantes' || (currentStep === 'review' && showInput && editingType === 'participantes')) {
      console.log('[renderInput] Renderizando IsisParticipantesInput');
      
      return (
        <IsisParticipantesInput
          participantesAtuais={selections.participantes || []}
          onAdicionar={handleAdicionarParticipante}
          onRemover={handleRemoverParticipante}
          onFinalizar={handleFinalizarParticipantes}
          onAdicionarLote={handleAdicionarParticipantesLote}
          selfName={selections.cliente?.nome}
          onFixedRolesDetected={(roles) => {
            try {
              const levs = Array.isArray(roles?.levantadores) ? roles.levantadores : [];
              const gols = Array.isArray(roles?.goleiros) ? roles.goleiros : [];
              const norm = (s) => String(s || '').trim().toLowerCase();
              const fixos = Array.from(new Set([...levs, ...gols]));
              const map = {};
              levs.forEach(n => { map[norm(n)] = 'Levantador'; });
              gols.forEach(n => { map[norm(n)] = 'Goleiro'; });
              updateSelection('levantadores', levs);
              updateSelection('goleiros', gols);
              updateSelection('fixos', fixos);
              updateSelection('fixoRoles', map);
              // Se já existe agendamento, persiste imediatamente no banco
              if (agendamentoCriado?.id) {
                (async () => {
                  try {
                    const metaRoles = {
                      levantadores: levs,
                      goleiros: gols,
                      fixos,
                      fixoRoles: map,
                    };
                    await supabase
                      .from('agendamentos')
                      .update({ meta_roles: metaRoles })
                      .eq('id', agendamentoCriado.id);
                  } catch (e) {
                    console.debug('[Isis] Falha ao persistir meta_roles imediatos:', e?.message || e);
                  }
                })();
              }
            } catch {}
          }}
        />
      );
    }
    
    if (currentStep === 'identificacao' || tipoIdentificacao === 'data_custom') {
      return (
        <IsisIdentificacaoInput
          tipo={tipoIdentificacao}
          onSubmit={handleIdentificacaoSubmit}
          onTrocarTipo={() => {
            const novoTipo = tipoIdentificacao === 'telefone' ? 'email' : 'telefone';
            setTipoIdentificacao(novoTipo);
          }}
        />
      );
    }
    
    if (currentStep === 'cadastro') {
      return (
        <IsisCadastroInput
          onSubmit={handleCadastroSubmit}
          valorInicial={selections.identificacao_valor}
          tipoInicial={selections.identificacao_tipo || 'telefone'}
          onCorrigirTelefone={() => {
            try { addIsisMessage('Sem problemas! Informe seu telefone novamente:', 400); } catch {}
            updateSelection('cliente', null);
            updateSelection('identificacao_valor', null);
            setTipoIdentificacao('telefone');
            nextStep('identificacao');
            setShowInput(true);
          }}
          onCorrigirEmail={() => {
            try { addIsisMessage('Sem problemas! Informe seu e-mail novamente:', 400); } catch {}
            updateSelection('cliente', null);
            updateSelection('identificacao_valor', null);
            setTipoIdentificacao('email');
            nextStep('identificacao');
            setShowInput(true);
          }}
        />
      );
    }
    
    if (currentStep === 'horario' || (currentStep === 'review' && showInput && editingType === 'horario')) {
      console.log('[renderInput] Renderizando IsisHorarioInput');
      console.log('[renderInput] horariosDisponiveis:', horariosDisponiveis?.length || 0);
      console.log('[renderInput] esportes:', selections.quadra?.modalidades);
      
      return (
        <IsisHorarioInput
          onSubmit={handleHorarioSubmit}
          onMudarData={handleMudarData}
          onMudarQuadra={() => {
            try {
              // Força modo edição de horário para que handleQuadraSelection recarregue os horários
              setShowInput(false);
              setEditingType('horario');
              nextStep('review');
              const quadraButtons = (quadras || []).map(q => ({
                label: q.nome,
                value: q.id,
                icon: '🏟️',
                subtitle: q.descricao || q.tipo || null,
                quadra: q
              }));
              if (quadraButtons.length > 0) addIsisMessageWithButtons('Qual quadra você quer?', quadraButtons, 600);
            } catch {}
          }}
          hasMultipleQuadras={(quadras || []).length > 1}
          horariosDisponiveis={horariosDisponiveis}
          esportes={selections.quadra?.modalidades || []}
        />
      );
    }
    
    if (currentStep === 'avaliacao') {
      console.log('[renderInput] Renderizando IsisAvaliacaoInput');
      
      return (
        <IsisAvaliacaoInput
          onSubmit={handleAvaliacaoSubmit}
        />
      );
    }
    
    return null;
  };
  
  // Tela quando não há nome fantasia via rota NEM via subdomínio
  if (!nomeFantasiaEfetivo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl"
        >
          {/* Isis Avatar com animação */}
          <motion.div 
            className="mb-8 flex justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="relative">
              <IsisAvatar size="xl" variant="header" />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-brand/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>

          {/* Mensagem principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-6"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              {getCumprimentoPorHorario()}👋! Tentando Agendar?
            </h1>
            
            <div className="bg-surface/70 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-xl">
              <p className="text-xl text-text-primary mb-4 leading-relaxed">
                Entre em contato com o dono da quadra e solicite o link de agendamento.
              </p>
              
            </div>
          </motion.div>

          {/* Footer - Logo Fluxo7Arena */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 flex items-center justify-center"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex items-baseline">
                <span className="font-extrabold text-2xl" style={{ color: '#FF6600' }}>Fluxo</span>
                <span className="font-extrabold text-2xl" style={{ color: '#FFAA33' }}>7</span>
                <span className="font-medium text-2xl" style={{ color: '#B0B0B0' }}> Arena</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }
  
  // Loading inicial
  if (loadingEmpresa) {
    return <IsisPremiumLoading message="Preparando sua experiência..." />;
  }
  
  if (!empresa) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl"
        >
          {/* Isis Avatar com animação */}
          <motion.div 
            className="mb-8 flex justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="relative">
              <IsisAvatar size="xl" variant="header" />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-brand/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>

          {/* Mensagem principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-6"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              {getCumprimentoPorHorario()}! Tentando Agendar? 👋
            </h1>
            
            <div className="bg-surface/70 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-xl">
              <p className="text-xl text-text-primary mb-6 leading-relaxed">
                Entre em contato com o dono da quadra e solicite o **link de agendamento**.
              </p>
              
              <div className="bg-surface-2/50 border border-white/5 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-brand" />
                  Formato do Link
                </h3>
                <div className="bg-background/60 border border-white/10 rounded-lg p-4 font-mono text-sm">
                  <span className="text-text-muted">fluxo7arena.com/agendar/</span>
                  <span className="text-brand font-bold">nome-da-empresa</span>
                </div>
                
              </div>

            </div>
          </motion.div>

          {/* Footer - Logo Fluxo7Arena */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 flex items-center justify-center"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex items-baseline">
                <span className="font-extrabold text-2xl" style={{ color: '#FF6600' }}>Fluxo</span>
                <span className="font-extrabold text-2xl" style={{ color: '#FFAA33' }}>7</span>
                <span className="font-medium text-2xl" style={{ color: '#B0B0B0' }}> Arena</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-surface/70 backdrop-blur-xl border-b border-white/10 sticky top-0 z-20 shadow-lg"
      >
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-4">
          {/* Ísis + Badge AI */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Logo/Avatar */}
            <div className="relative group">
              <div className="transition-all duration-300 group-hover:scale-105">
                <IsisAvatar size="md" variant="header" className="md:w-20 md:h-20" />
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-success rounded-full border-2 border-surface" />
            </div>
            
            {/* Nome Ísis com Badge AI Embaixo */}
            <div className="flex flex-col gap-0.5 md:gap-1">
              <h1 className="font-bold text-text-primary text-lg md:text-2xl tracking-tight leading-none">
                Ísis
              </h1>
              
              {/* Badge AI Futurista */}
              <div className="relative group w-fit">
                {/* Glow animado */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 blur-md opacity-60 group-hover:opacity-100 animate-pulse rounded-md"></div>
                
                {/* Badge principal */}
                <div className="relative px-2 py-0.5 md:px-2.5 md:py-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-cyan-500/50 rounded-md flex items-center gap-1 md:gap-1.5 shadow-lg">
                  {/* Ícone de chip/circuito */}
                  <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7H7v6h6V7z"/>
                    <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd"/>
                  </svg>
                  
                  {/* Texto AI */}
                  <span className="text-[9px] md:text-[10px] font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    AI
                  </span>
                  
                  {/* Dots pulsantes - hidden em mobile */}
                  <div className="hidden md:flex gap-0.5">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-pink-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Badge da Empresa - Mobile: aumentado / Desktop: centro */}
          <div className="flex flex-1 justify-end md:justify-center">
            <div className="group relative">
              {/* Glow sutil - apenas desktop */}
              <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-brand/20 via-brand/10 to-brand/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Container principal - aumentado no mobile */}
              <div className="relative flex items-center gap-2.5 md:gap-3 px-4 py-2 md:px-5 md:py-2.5 bg-gradient-to-r from-surface via-surface-2 to-surface backdrop-blur-sm rounded-lg md:rounded-xl border border-brand/20 shadow-md md:shadow-lg">
                {/* Logo da empresa - quadrada com destaque */}
                <div className="relative w-9 h-9 md:w-10 md:h-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface-2/60 grid place-items-center shadow-[0_0_0_3px_RGBA(0,0,0,0.2)] group-hover:border-white/20 transition-colors duration-300">
                  {empresaLogoSrc ? (
                    <img 
                      src={empresaLogoSrc} 
                      alt="Logo da empresa" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback para ícone se imagem não carregar
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  <Building2 
                    className={`w-5 h-5 md:w-6 md:h-6 opacity-80 ${empresaLogoSrc ? 'hidden' : 'block'}`} 
                    strokeWidth={2} 
                  />
                </div>
                
                {/* Nome - aumentado no mobile */}
                <h2 className="text-sm md:text-base font-bold text-text-primary tracking-wide truncate max-w-[140px] md:max-w-none">
                  {empresa.nome_fantasia || empresa.razao_social}
                </h2>
              </div>
            </div>
          </div>
          
          {/* Logo F7 Arena - Apenas Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
              <Trophy className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="hidden lg:flex items-baseline">
              <span className="font-extrabold text-xl" style={{ color: '#FF6600' }}>Fluxo</span>
              <span className="font-extrabold text-xl" style={{ color: '#FFAA33' }}>7</span>
              <span className="font-medium text-xl" style={{ color: '#B0B0B0' }}> Arena</span>
            </div>
          </div>
        </div>
      </motion.header>
      
      {/* Chat Container */}
      <div className="container mx-auto max-w-5xl pb-6 md:pb-6 mb-12 md:mb-0">
        <IsisChat 
          onButtonClick={handleButtonClick}
          hideButtonTexts={currentStep === 'avaliacao'}
        >
          {renderInput()}
        </IsisChat>
      </div>
      
      {/* Footer Mobile - Logo F7 */}
      <motion.footer
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-white/10 z-20 shadow-lg"
      >
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex items-baseline">
              <span className="font-extrabold text-sm" style={{ color: '#FF6600' }}>Fluxo</span>
              <span className="font-extrabold text-sm" style={{ color: '#FFAA33' }}>7</span>
              <span className="font-medium text-sm" style={{ color: '#B0B0B0' }}> Arena</span>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

/**
 * Wrapper com Provider
 */
export default function IsisBookingPage() {
  return (
    <IsisProvider>
      <IsisBookingPageContent />
    </IsisProvider>
  );
}
