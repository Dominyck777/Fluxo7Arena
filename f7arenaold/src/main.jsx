import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import '@/index.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { registerServiceWorker } from '@/registerSW';

// Registrar Service Worker para PWA
registerServiceWorker();

// Bloquear rotação de tela em modo portrait (apenas para mobile)
if (window.screen?.orientation?.lock) {
  window.screen.orientation.lock('portrait').catch((err) => {
    console.log('[Orientation] Lock não suportado ou já bloqueado:', err.message);
  });
}

// Capturar evento de instalação PWA globalmente (antes do React montar)
// Nota: preventDefault() bloqueia o banner automático do navegador, permitindo controle manual
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // Suprime banner automático (warning esperado no console)
  window.__installPrompt = e;
}, { passive: false });

window.addEventListener('appinstalled', () => {
  window.__installPrompt = null;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
      <Toaster />
    </AuthProvider>
  </BrowserRouter>
);