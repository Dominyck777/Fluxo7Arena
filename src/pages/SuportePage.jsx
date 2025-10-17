import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LifeBuoy, MessageCircle, Mail, Bug, ClipboardCopy, CheckCircle2, Phone, Trophy, Download, Smartphone, Share, X, Chrome, Monitor } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const APP_VERSION = 'v1.0.0'; // ajuste aqui se tiver uma fonte de versão global

function SectionCard({ title, icon: Icon, children, className = '', collapsible = false, defaultOpen = true }) {
  if (collapsible) {
    return (
      <div className={`bg-surface rounded-lg border border-border shadow-sm ${className}`}>
        <details className="group" open={defaultOpen}>
          <summary className="list-none cursor-pointer select-none p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-brand" />}
              <h3 className="text-base font-semibold">{title}</h3>
            </div>
            <span className="text-xs text-text-secondary group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-4 pb-4">
            {children}
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className={`bg-surface rounded-lg border border-border shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-5 h-5 text-brand" />}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium truncate">{value || '—'}</span>
    </div>
  );
}

export default function SuportePage() {
  const { userProfile, company, authReady, loading } = useAuth();
  const { pathname } = useLocation();

  // Formulário simples de report (sem backend)
  const [categoria, setCategoria] = useState('Agenda');
  const [severidade, setSeveridade] = useState('Média');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [isDesktop, setIsDesktop] = useState(true);
  
  // PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [browserType, setBrowserType] = useState('unknown');

  const appName = 'Fluxo7 Arena';
  const supportEmail = 'fluxo7team@gmail.com';
  const whatsappUrl = 'https://wa.me/5534998936088';
  const phoneHref = 'tel:+5534998936088';
  const displayPhone = '+55 (34) 99893-6088';

  useEffect(() => {
    try {
      const mq = window.matchMedia('(pointer:fine)');
      const update = () => setIsDesktop(mq.matches);
      update();
      mq.addEventListener?.('change', update);
      return () => mq.removeEventListener?.('change', update);
    } catch {
      setIsDesktop(true);
    }
  }, []);

  // PWA Install Detection
  useEffect(() => {
    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Detectar tipo de navegador
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      setBrowserType('chrome');
    } else if (ua.includes('Edg')) {
      setBrowserType('edge');
    } else if (ua.includes('Firefox')) {
      setBrowserType('firefox');
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      setBrowserType('safari');
    } else {
      setBrowserType('other');
    }

    // Detectar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return; // Se já instalado, não precisa continuar
    }

    // Capturar evento de instalação (não funciona no iOS)
    const handleBeforeInstallPrompt = (e) => {
      console.log('[PWA] beforeinstallprompt disparado');
      e.preventDefault();
      setDeferredPrompt(e);
      // Salva no localStorage para persistir entre recarregamentos
      localStorage.setItem('pwa-prompt-available', 'true');
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App instalado com sucesso');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
      localStorage.removeItem('pwa-prompt-available');
    };

    // Verifica se o prompt estava disponível antes
    const wasPromptAvailable = localStorage.getItem('pwa-prompt-available');
    if (wasPromptAvailable && !deferredPrompt) {
      console.log('[PWA] Prompt estava disponível anteriormente');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Tenta forçar o evento após um delay (alguns navegadores precisam disso)
    const timer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled) {
        console.log('[PWA] Prompt não capturado após 3s, pode não estar disponível');
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setShowInstallModal(false);
        } else {
          setShowInstallModal(true);
        }
        
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Erro ao mostrar prompt de instalação:', err);
        setShowInstallModal(true);
      }
    } else {
      // Se não houver prompt disponível, mostrar modal com instruções
      setShowInstallModal(true);
    }
  };

  const handleIOSInstall = () => {
    // Tentar abrir o menu de compartilhar do iOS
    if (navigator.share) {
      navigator.share({
        title: 'F7 Arena',
        text: 'Adicione F7 Arena à sua tela inicial',
        url: window.location.href,
      }).catch(() => {
        // Se falhar, mostrar alerta com instruções
        alert('Para adicionar à tela inicial:\n\n1. Toque no botão de Compartilhar (ícone de quadrado com seta)\n2. Role para baixo\n3. Toque em "Adicionar à Tela de Início"');
      });
    } else {
      // Fallback: mostrar alerta com instruções
      alert('Para adicionar à tela inicial:\n\n1. Toque no botão de Compartilhar (ícone de quadrado com seta)\n2. Role para baixo\n3. Toque em "Adicionar à Tela de Início"');
    }
  };

  const diagnostico = useMemo(() => {
    try {
      return {
        empresa:
          company?.nome ||
          company?.fantasia ||
          company?.razao_social ||
          company?.razaoSocial ||
          company?.displayName ||
          company?.codigo_empresa ||
          '—',
        usuario: userProfile?.nome || userProfile?.name || userProfile?.email || '—',
        dataHora: new Date().toLocaleString('pt-BR'),
      };
    } catch {
      return {
        empresa: '—',
        usuario: '—',
        dataHora: new Date().toLocaleString('pt-BR'),
      };
    }
  }, [company?.nome, company?.fantasia, company?.razao_social, company?.razaoSocial, company?.displayName, company?.codigo_empresa, userProfile?.nome, userProfile?.name, userProfile?.email]);

  const mensagemTemplate = useMemo(() => {
    return [
      `[${appName} - Suporte]`,
      `Assunto: ${assunto || '(sem assunto)'} `,
      `Categoria: ${categoria} `,
      `Severidade: ${severidade}`,
      '',
      'Descrição:',
      (descricao || '(adicione uma descrição detalhada, passos para reproduzir, prints se possível)') + '\n',
      '— Dados —',
      `Empresa: ${diagnostico.empresa}`,
      `Usuário: ${diagnostico.usuario}`,
      `Data e Hora: ${diagnostico.dataHora}`,
    ].join('\n');
  }, [assunto, categoria, severidade, descricao, diagnostico]);

  const whatsappHref = `${whatsappUrl}?text=${encodeURIComponent(mensagemTemplate)}`;
  const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(`[Suporte] ${assunto || 'Assunto'}`)}&body=${encodeURIComponent(mensagemTemplate)}`;

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
      {/* Header/Hero */}
      <div className="bg-surface rounded-xl border border-border p-5 md:p-6 mb-6">        
        <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Suporte</h1>
              <p className="text-sm text-text-secondary">Precisa de ajuda? Fale com a gente ou consulte as respostas rápidas abaixo.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex items-baseline">
                <span className="font-extrabold text-base md:text-xl" style={{ color: '#FF6600' }}>Fluxo</span>
                <span className="font-extrabold text-base md:text-xl" style={{ color: '#FFAA33' }}>7</span>
                <span className="font-medium text-base md:text-xl" style={{ color: '#B0B0B0' }}> Arena</span>
              </div>
            </div>
            <div className="text-xs text-text-secondary mt-1">Versão {APP_VERSION}</div>
          </div>
        </div>

        {/* Status rápido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <SectionCard title="Status" icon={CheckCircle2}>
            <div className="grid grid-cols-1 gap-1">
              <Row label="Empresa" value={diagnostico.empresa} />
              <Row label="Usuário" value={`${diagnostico.usuario}`}/>
            </div>
          </SectionCard>
          <SectionCard title="Fale com a gente" icon={MessageCircle}>
            <div className="flex flex-wrap gap-2">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand text-black hover:opacity-90 transition">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-surface-2 transition">
                <Mail className="w-4 h-4" /> E-mail
              </a>
              <a href={phoneHref} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-surface-2 transition">
                <Phone className="w-4 h-4" /> {isDesktop ? displayPhone : 'Telefone'}
              </a>
            </div>
          </SectionCard>
          
          {/* PWA Install Card */}
          {!isInstalled && isIOS && (
            <SectionCard title="Adicionar à Tela Inicial" icon={Smartphone}>
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  Crie um atalho do F7 Arena na sua tela inicial para acesso rápido.
                </p>
                <button
                  onClick={handleIOSInstall}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-brand text-black font-medium hover:opacity-90 transition"
                >
                  <Share className="w-4 h-4" /> Criar Atalho
                </button>
                <details className="text-xs text-text-muted">
                  <summary className="cursor-pointer hover:text-text-secondary">Como fazer manualmente?</summary>
                  <div className="mt-2 space-y-1 pl-2">
                    <p>1. Toque no botão <Share className="inline w-3 h-3" /> (Compartilhar)</p>
                    <p>2. Role para baixo e toque em "Adicionar à Tela de Início"</p>
                    <p>3. Toque em "Adicionar"</p>
                  </div>
                </details>
              </div>
            </SectionCard>
          )}
          
          {!isInstalled && !isIOS && (
            <SectionCard title="Instalar Aplicativo" icon={Smartphone}>
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Instale o F7 Arena no seu dispositivo para acesso rápido e experiência completa de aplicativo.
                </p>
                <button
                  onClick={handleInstallClick}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-brand text-black font-medium hover:opacity-90 transition"
                >
                  <Download className="w-4 h-4" /> Instalar App
                </button>
                <p className="text-xs text-text-muted text-center">
                  Clique para instalar ou ver instruções detalhadas
                </p>
              </div>
            </SectionCard>
          )}
          
          {isInstalled && (
            <SectionCard title="Aplicativo Instalado" icon={CheckCircle2}>
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4" />
                <span>F7 Arena está instalado no seu dispositivo!</span>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FAQ */}
        <div className="lg:col-span-2 space-y-3">
          <SectionCard title="Perguntas Frequentes (FAQ)">
            <div className="divide-y divide-border/60">
              <details className="py-3">
                <summary className="cursor-pointer select-none font-medium">Como abrir comanda de balcão?</summary>
                <p className="mt-2 text-sm text-text-secondary">Abra o caixa antes. A tela de balcão utiliza uma comanda sem mesa (mesa_id nulo). Se não existir, o sistema cria ao abrir o balcão; caso o caixa esteja fechado, a abertura da comanda é bloqueada.</p>
              </details>
              <details className="py-3">
                <summary className="cursor-pointer select-none font-medium">Por que não consigo fechar o caixa?</summary>
                <p className="mt-2 text-sm text-text-secondary">O fechamento é bloqueado se houver comandas com itens em aberto (inclui balcão e mesas). Finalize ou feche as comandas pendentes antes de encerrar o caixa.</p>
              </details>
              <details className="py-3">
                <summary className="cursor-pointer select-none font-medium">Como adicionar participantes no agendamento?</summary>
                <p className="mt-2 text-sm text-text-secondary">No modal de agendamento, selecione um ou mais clientes. Após salvar, o chip de pagamentos é atualizado imediatamente. Se não visualizar, recarregue os dados da agenda.</p>
              </details>
              
              <details className="py-3">
                <summary className="cursor-pointer select-none font-medium">Como ver o histórico completo do cliente?</summary>
                <p className="mt-2 text-sm text-text-secondary">Abra o cliente e utilize o “Histórico Recente”, que combina comandas e agendamentos em uma única timeline com totais e status.</p>
              </details>
              <details className="py-3">
                <summary className="cursor-pointer select-none font-medium">Como ajustar estoque mínimo e ver mais vendidos?</summary>
                <p className="mt-2 text-sm text-text-secondary">Na aba de Produtos você pode gerenciar estoque, preços e relatórios. Utilize filtros e exportações para análise.</p>
              </details>
              
            </div>
          </SectionCard>
        </div>

        {/* Ações de suporte */}
        <div className="lg:col-span-1">
          <div className="space-y-3 lg:sticky lg:top-6">
          <SectionCard title="Reportar um problema" icon={Bug} collapsible defaultOpen={false}>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-secondary">Categoria</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-md bg-background border border-border">
                    <option>Agenda</option>
                    <option>Vendas</option>
                    <option>Clientes</option>
                    <option>Produtos</option>
                    <option>Financeiro</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Severidade</label>
                  <select value={severidade} onChange={(e) => setSeveridade(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-md bg-background border border-border">
                    <option>Baixa</option>
                    <option>Média</option>
                    <option>Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary">Assunto</label>
                <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Erro ao salvar agendamento" className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border" />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Descrição</label>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Descreva o que aconteceu, passos para reproduzir, expectativa."
                  className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border resize-y" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand text-black hover:opacity-90 transition">
                  <MessageCircle className="w-4 h-4" /> Enviar no WhatsApp
                </a>
                <a href={emailHref} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-surface-2 transition">
                  <Mail className="w-4 h-4" /> Enviar por E-mail
                </a>
                <a href={phoneHref} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-surface-2 transition">
                  <Phone className="w-4 h-4" /> {isDesktop ? displayPhone : 'Ligar agora'}
                </a>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Diagnóstico" icon={ClipboardCopy}>
            <div className="space-y-1 text-sm">
              <Row label="Empresa" value={diagnostico.empresa} />
              <Row label="Usuário" value={`${diagnostico.usuario}`} />
              <Row label="Data/Hora" value={diagnostico.dataHora} />
              <Row label="Canal - WhatsApp" value="(34) 99893-6088" />
              <Row label="Canal - E-mail" value="fluxo7team@gmail.com" />
              <Row label="Canal - Telefone" value="(34) 99893-6088" />
            </div>
          </SectionCard>
          </div>
        </div>
      </div>

      {/* Modal de Instalação */}
      <Dialog open={showInstallModal} onOpenChange={setShowInstallModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
                <Download className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Como Instalar o F7 Arena</h2>
                <p className="text-sm text-text-secondary font-normal">Siga as instruções para o seu navegador</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            {/* Chrome/Edge */}
            {(browserType === 'chrome' || browserType === 'edge') && (
              <div className="bg-surface-2 rounded-lg p-5 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Chrome className="w-6 h-6 text-brand" />
                  <h3 className="text-lg font-semibold">
                    {browserType === 'chrome' ? 'Google Chrome' : 'Microsoft Edge'}
                  </h3>
                </div>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">1</span>
                    <div>
                      <p className="font-medium mb-1">Procure o ícone de instalação</p>
                      <p className="text-text-secondary">Na barra de endereço (URL), procure por um ícone de <strong>computador com seta para baixo</strong> ou <strong>+ (mais)</strong></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">2</span>
                    <div>
                      <p className="font-medium mb-1">Clique no ícone</p>
                      <p className="text-text-secondary">Aparecerá a opção <strong>"Instalar F7 Arena"</strong> ou <strong>"Instalar aplicativo"</strong></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">3</span>
                    <div>
                      <p className="font-medium mb-1">Confirme a instalação</p>
                      <p className="text-text-secondary">Clique em <strong>"Instalar"</strong> na janela que aparecer</p>
                    </div>
                  </li>
                </ol>
                <div className="mt-4 p-3 bg-background rounded-md border border-border/50">
                  <p className="text-xs text-text-muted">
                    <strong>Alternativa:</strong> Clique no menu <strong>⋮</strong> (três pontos) → <strong>"Instalar F7 Arena"</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Firefox */}
            {browserType === 'firefox' && (
              <div className="bg-surface-2 rounded-lg p-5 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-6 h-6 text-brand" />
                  <h3 className="text-lg font-semibold">Mozilla Firefox</h3>
                </div>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">1</span>
                    <div>
                      <p className="font-medium mb-1">Adicione aos favoritos</p>
                      <p className="text-text-secondary">Pressione <strong>Ctrl + D</strong> (Windows) ou <strong>Cmd + D</strong> (Mac)</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">2</span>
                    <div>
                      <p className="font-medium mb-1">Crie um atalho</p>
                      <p className="text-text-secondary">Ou arraste o ícone da URL para a área de trabalho</p>
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {/* Safari */}
            {browserType === 'safari' && (
              <div className="bg-surface-2 rounded-lg p-5 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-6 h-6 text-brand" />
                  <h3 className="text-lg font-semibold">Safari (macOS)</h3>
                </div>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">1</span>
                    <div>
                      <p className="font-medium mb-1">Abra o menu Arquivo</p>
                      <p className="text-text-secondary">No topo da tela, clique em <strong>Arquivo</strong></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center font-bold text-xs">2</span>
                    <div>
                      <p className="font-medium mb-1">Adicionar à Dock</p>
                      <p className="text-text-secondary">Selecione <strong>"Adicionar à Dock"</strong></p>
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {/* Outros navegadores */}
            {browserType === 'other' && (
              <div className="bg-surface-2 rounded-lg p-5 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-6 h-6 text-brand" />
                  <h3 className="text-lg font-semibold">Instruções Gerais</h3>
                </div>
                <div className="space-y-3 text-sm text-text-secondary">
                  <p>Procure por uma das seguintes opções no menu do seu navegador:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>"Instalar aplicativo"</strong></li>
                    <li><strong>"Adicionar à tela inicial"</strong></li>
                    <li><strong>"Criar atalho"</strong></li>
                    <li>Ícone de <strong>instalação na barra de endereço</strong></li>
                  </ul>
                </div>
              </div>
            )}

            {/* Benefícios */}
            <div className="bg-brand/5 rounded-lg p-4 border border-brand/20">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-brand" />
                Benefícios do App Instalado
              </h4>
              <ul className="space-y-1.5 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                  Acesso rápido direto da área de trabalho ou menu iniciar
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                  Funciona em tela cheia, sem barras do navegador
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                  Notificações e atualizações automáticas
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                  Melhor desempenho e experiência de uso
                </li>
              </ul>
            </div>

            {/* Botão de fechar */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-6 py-2.5 rounded-md bg-surface-2 hover:bg-surface text-text-primary font-medium transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
