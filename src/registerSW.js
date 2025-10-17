// Registro do Service Worker para PWA
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Service Worker registrado com sucesso:', registration.scope);

          // Verifica atualizações a cada 60 segundos
          setInterval(() => {
            registration.update();
          }, 60000);

          // Listener para atualizações
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[SW] Nova versão encontrada, instalando...');

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] Nova versão disponível! Recarregue a página para atualizar.');
                
                // Opcional: Notificar o usuário sobre atualização
                if (window.confirm('Nova versão disponível! Deseja atualizar agora?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((error) => {
          console.error('[SW] Erro ao registrar Service Worker:', error);
        });

      // Listener para quando o SW tomar controle
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] Service Worker atualizado, recarregando...');
        window.location.reload();
      });
    });
  } else {
    console.warn('[SW] Service Worker não é suportado neste navegador');
  }
}

// Função para desregistrar (útil para debug)
export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log('[SW] Service Worker desregistrado');
      })
      .catch((error) => {
        console.error('[SW] Erro ao desregistrar:', error);
      });
  }
}
