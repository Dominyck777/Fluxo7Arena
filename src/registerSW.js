// Registro do Service Worker para PWA
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Service Worker registrado com sucesso

          // Verifica atualizações a cada 60 segundos
          setInterval(() => {
            registration.update();
          }, 60000);

          // Listener para atualizações
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                
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
        window.location.reload();
      });
    });
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
