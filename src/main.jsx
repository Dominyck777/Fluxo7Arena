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