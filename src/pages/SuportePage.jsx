import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LifeBuoy, MessageCircle, Mail, Bug, ClipboardCopy, CheckCircle2, Phone, Download, Smartphone, Share, X, Chrome, Monitor } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const APP_VERSION = 'v2.5.1'; // ajuste aqui se tiver uma fonte de versão global

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

  const [appVersionLabel, setAppVersionLabel] = useState(APP_VERSION);

  // Formulário simples de report (sem backend)
  const [categoria, setCategoria] = useState('Agenda');
  const [severidade, setSeveridade] = useState('Média');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [isDesktop, setIsDesktop] = useState(true);
  
  // PWA Install - usa window para persistir entre navegações
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__installPrompt || null);
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

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/release-notes.json', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) return;

        const json = await res.json();
        const version = typeof json?.versionLabel === 'string' ? json.versionLabel.trim() : '';
        if (version) setAppVersionLabel(version);
      } catch {
        // fallback mantém APP_VERSION
      }
    })();

    return () => controller.abort();
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
    }

    // Sincroniza com o prompt global capturado no main.jsx
    if (window.__installPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__installPrompt);
    }

    // Listener para quando o app for instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

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
        window.__installPrompt = null; // Limpa do global após uso
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
          <div className="flex flex-col items-end">
            <div className="inline-flex flex-col items-center">
              <img
                src="/fluxo7arena-removebg.png"
                alt="Fluxo7 Arena"
                className="h-10 md:h-12 w-auto object-contain"
                loading="eager"
                decoding="async"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="text-xs text-text-secondary mt-1 text-center">Versão {appVersionLabel}</div>
            </div>
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
                  Pode demorar alguns segundos. Se não aparecer nada, veja as instruções no tutorial.
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
            {/* Chrome Mobile */}
            {(browserType === 'chrome' || browserType === 'edge') && (
              <div className="bg-gradient-to-br from-brand/10 to-brand/5 rounded-xl p-6 border-2 border-brand/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center">
                    <Chrome className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Chrome (Celular)</h3>
                    <p className="text-xs text-text-muted">Siga os passos abaixo</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Passo 1 */}
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-black flex items-center justify-center font-bold">1</div>
                      <div className="flex-1">
                        <p className="font-semibold mb-2">Toque nos 3 pontinhos <span className="text-2xl">⋮</span></p>
                        <p className="text-sm text-text-secondary mb-3">No canto superior direito da tela</p>
                        <div className="bg-background/50 rounded-md p-3 border border-border/50">
                          <p className="text-xs text-text-muted">💡 Os 3 pontinhos ficam ao lado da barra de endereço</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Passo 2 */}
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-black flex items-center justify-center font-bold">2</div>
                      <div className="flex-1">
                        <p className="font-semibold mb-3">Procure uma destas opções:</p>
                        <div className="space-y-2 mb-3">
                          <div className="bg-brand/20 rounded-md p-3 border-2 border-brand/40">
                            <p className="font-bold text-center text-base">📱 "Instalar aplicativo"</p>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-text-muted text-sm font-medium">
                            <div className="h-px bg-border flex-1"></div>
                            <span>OU</span>
                            <div className="h-px bg-border flex-1"></div>
                          </div>
                          <div className="bg-brand/20 rounded-md p-3 border-2 border-brand/40">
                            <p className="font-bold text-center text-base">🏠 "Adicionar à tela inicial"</p>
                          </div>
                        </div>
                        <p className="text-sm text-text-secondary">Toque em qualquer uma dessas opções no menu</p>
                      </div>
                    </div>
                  </div>

                  {/* Passo 3 */}
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-black flex items-center justify-center font-bold">3</div>
                      <div className="flex-1">
                        <p className="font-semibold mb-2">Confirme a instalação</p>
                        <p className="text-sm text-text-secondary mb-3">Aparecerá uma janela perguntando se deseja instalar</p>
                        <div className="bg-success/10 rounded-md p-3 border border-success/30">
                          <p className="text-sm font-medium text-center">✅ Toque em "Instalar"</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resultado */}
                  <div className="bg-success/5 rounded-lg p-4 border border-success/20">
                    <p className="text-sm font-medium text-success mb-1">🎉 Pronto!</p>
                    <p className="text-xs text-text-secondary">O app aparecerá na sua tela inicial e você poderá abri-lo como qualquer outro aplicativo!</p>
                  </div>
                </div>
              </div>
            )}

            {/* Firefox Mobile */}
            {browserType === 'firefox' && (
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl p-6 border-2 border-orange-500/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Firefox (Celular)</h3>
                    <p className="text-xs text-text-muted">Siga os passos abaixo</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">1</div>
                      <div className="flex-1">
                        <p className="font-semibold mb-2">Toque nos 3 pontinhos <span className="text-2xl">⋮</span></p>
                        <p className="text-sm text-text-secondary">No canto inferior direito da tela</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">2</div>
                      <div className="flex-1">
                        <p className="font-semibold mb-3">Procure uma destas opções:</p>
                        <div className="space-y-2">
                          <div className="bg-orange-500/20 rounded-md p-3 border-2 border-orange-500/40">
                            <p className="font-bold text-center text-base">📱 "Instalar"</p>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-text-muted text-sm font-medium">
                            <div className="h-px bg-border flex-1"></div>
                            <span>OU</span>
                            <div className="h-px bg-border flex-1"></div>
                          </div>
                          <div className="bg-orange-500/20 rounded-md p-3 border-2 border-orange-500/40">
                            <p className="font-bold text-center text-base">🏠 "Adicionar à tela inicial"</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-success/5 rounded-lg p-4 border border-success/20">
                    <p className="text-sm font-medium text-success mb-1">🎉 Pronto!</p>
                    <p className="text-xs text-text-secondary">O app será adicionado à sua tela inicial!</p>
                  </div>
                </div>
              </div>
            )}

            {/* Safari não tem versão Android, então removido */}

            {/* Outros navegadores */}
            {(browserType === 'safari' || browserType === 'other') && (
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-6 border-2 border-purple-500/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Outros Navegadores</h3>
                    <p className="text-xs text-text-muted">Instruções gerais</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="font-semibold mb-3">Procure no menu do navegador:</p>
                    <div className="space-y-2">
                      <div className="bg-purple-500/10 rounded-md p-3 border border-purple-500/30">
                        <p className="font-medium">📱 "Instalar aplicativo"</p>
                      </div>
                      <div className="bg-purple-500/10 rounded-md p-3 border border-purple-500/30">
                        <p className="font-medium">🏠 "Adicionar à tela inicial"</p>
                      </div>
                      <div className="bg-purple-500/10 rounded-md p-3 border border-purple-500/30">
                        <p className="font-medium">➕ "Criar atalho"</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-background/50 rounded-lg p-4 border border-border/50">
                    <p className="text-sm text-text-muted">💡 Geralmente a opção está no menu de 3 pontos ou 3 linhas do navegador</p>
                  </div>
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
