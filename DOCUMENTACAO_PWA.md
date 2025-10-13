# 📱 Documentação: Implementação de PWA com Botão de Instalação

## 📋 Índice
1. [Configuração Básica do PWA](#1-configuração-básica-do-pwa)
2. [Manifest.json](#2-manifestjson)
3. [Meta Tags no HTML](#3-meta-tags-no-html)
4. [Botão de Instalação React](#4-botão-de-instalação-react)
5. [Estilos e Temas](#5-estilos-e-temas)
6. [Testando](#6-testando)

---

## 1. Configuração Básica do PWA

### Estrutura de Arquivos
```
seu-projeto/
├── public/
│   ├── manifest.json          # Configuração do PWA
│   ├── icon-192.png          # Ícone 192x192
│   └── icon-512.png          # Ícone 512x512
├── index.html                # HTML principal
└── src/
    └── pages/
        └── SuportePage.jsx   # Página com botão de instalação
```

---

## 2. Manifest.json

Crie o arquivo `public/manifest.json`:

```json
{
  "name": "Seu App",
  "short_name": "App",
  "description": "Descrição do seu app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 📝 Campos Importantes:

- **`name`**: Nome completo do app (aparece na tela de instalação)
- **`short_name`**: Nome curto (aparece no ícone)
- **`display`**: `standalone` (sem barra de navegador) ou `fullscreen`
- **`background_color`**: Cor de fundo durante splash screen
- **`theme_color`**: Cor da barra de status
- **`icons`**: Ícones em diferentes tamanhos (mínimo 192x192 e 512x512)

---

## 3. Meta Tags no HTML

Adicione no `<head>` do seu `index.html`:

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu App</title>
  
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json" />
  
  <!-- PWA Meta Tags -->
  <meta name="theme-color" content="#0a0a0a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Seu App" />
  
  <!-- Splash Screen Background -->
  <style>
    html, body {
      background-color: #0a0a0a;
      margin: 0;
      padding: 0;
    }
    #root {
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### 📝 Explicação das Meta Tags:

- **`theme-color`**: Cor da barra de status no Android
- **`apple-mobile-web-app-capable`**: Habilita modo standalone no iOS
- **`apple-mobile-web-app-status-bar-style`**: Estilo da barra de status no iOS
  - `default`: Barra branca
  - `black`: Barra preta
  - `black-translucent`: Barra preta translúcida
- **Background inline**: Evita flash branco durante carregamento

---

## 4. Botão de Instalação React

### 4.1. Imports Necessários

```jsx
import React, { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
```

### 4.2. Component Completo

```jsx
export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detectar se já está instalado
  useEffect(() => {
    // Verifica se está rodando como PWA
    if (
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone
    ) {
      setIsInstalled(true);
    }

    // Capturar evento de instalação
    const handleBeforeInstallPrompt = (e) => {
      // Prevenir o prompt automático do navegador
      e.preventDefault();
      // Guardar o evento para usar depois
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Função para instalar
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar o prompt de instalação
    deferredPrompt.prompt();
    
    // Aguardar a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    // Limpar o prompt
    setDeferredPrompt(null);
  };

  // Se já está instalado, mostrar mensagem de sucesso
  if (isInstalled) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">App instalado com sucesso!</span>
        </div>
      </div>
    );
  }

  // Se não pode instalar (navegador não suporta ou já instalado), não mostrar nada
  if (!deferredPrompt) {
    return null;
  }

  // Botão de instalação
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">
            Instalar Aplicativo
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            Instale nosso app para acesso rápido e experiência completa.
          </p>
          <button
            onClick={handleInstallClick}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Instalar Agora
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4.3. Uso do Component

```jsx
import InstallPWAButton from './components/InstallPWAButton';

function SuportePage() {
  return (
    <div>
      <h1>Suporte</h1>
      
      {/* Botão de instalação PWA */}
      <InstallPWAButton />
      
      {/* Resto do conteúdo */}
    </div>
  );
}
```

---

## 5. Estilos e Temas

### 5.1. Cores Personalizadas

Ajuste as cores no `manifest.json` e meta tags para combinar com sua marca:

```json
{
  "background_color": "#ffffff",  // Branco
  "theme_color": "#3b82f6"        // Azul
}
```

```html
<meta name="theme-color" content="#3b82f6" />
```

### 5.2. Ícones

**Requisitos:**
- **192x192px**: Ícone padrão
- **512x512px**: Ícone de alta resolução
- **Formato**: PNG com fundo transparente ou sólido
- **Purpose**: `any maskable` (funciona em todos os dispositivos)

**Ferramentas para gerar ícones:**
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

---

## 6. Testando

### 6.1. Navegadores Suportados

| Navegador | Suporte | Observações |
|-----------|---------|-------------|
| Chrome Android | ✅ Completo | Melhor suporte |
| Edge Android | ✅ Completo | Baseado em Chromium |
| Samsung Internet | ✅ Completo | - |
| Firefox Android | ⚠️ Parcial | Sem `beforeinstallprompt` |
| Safari iOS | ⚠️ Parcial | Instalação manual (Add to Home Screen) |
| Chrome Desktop | ✅ Completo | - |
| Edge Desktop | ✅ Completo | - |

### 6.2. Como Testar

#### **Chrome DevTools (Desktop)**

1. Abra DevTools (F12)
2. Vá em **Application** → **Manifest**
3. Verifique se o manifest está carregando corretamente
4. Clique em **Add to Home Screen** para testar

#### **Chrome Mobile (Android)**

1. Acesse o site no Chrome
2. O navegador mostrará automaticamente um banner de instalação
3. Ou use o botão customizado que você criou
4. Ou vá em Menu (⋮) → **Instalar app**

#### **Safari (iOS)**

1. Acesse o site no Safari
2. Toque no botão de compartilhar (□↑)
3. Role para baixo e toque em **Adicionar à Tela de Início**
4. O botão customizado **não funciona** no iOS (limitação do Safari)

### 6.3. Checklist de Validação

- [ ] Manifest.json está acessível em `/manifest.json`
- [ ] Ícones 192x192 e 512x512 estão disponíveis
- [ ] Meta tag `theme-color` está definida
- [ ] Site está servido via HTTPS (obrigatório para PWA)
- [ ] Service Worker registrado (opcional, mas recomendado)
- [ ] Botão de instalação aparece em navegadores suportados
- [ ] Botão desaparece após instalação
- [ ] App abre em modo standalone após instalação

### 6.4. Ferramentas de Auditoria

**Lighthouse (Chrome DevTools)**
```
1. Abra DevTools (F12)
2. Vá em "Lighthouse"
3. Selecione "Progressive Web App"
4. Clique em "Generate report"
```

**PWA Builder**
- Acesse: https://www.pwabuilder.com/
- Digite a URL do seu site
- Veja o score e sugestões de melhorias

---

## 7. Troubleshooting

### Problema: Botão não aparece

**Possíveis causas:**
1. Site não está em HTTPS
2. Manifest.json não está carregando
3. Navegador não suporta (Safari iOS)
4. App já está instalado
5. Usuário já recusou a instalação recentemente

**Solução:**
```javascript
// Adicione logs para debug
useEffect(() => {
  console.log('PWA: Checking install status...');
  
  const handleBeforeInstallPrompt = (e) => {
    console.log('PWA: beforeinstallprompt fired!');
    e.preventDefault();
    setDeferredPrompt(e);
  };
  
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  
  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  };
}, []);
```

### Problema: Ícone não aparece

**Solução:**
- Verifique se os caminhos dos ícones estão corretos
- Ícones devem estar em `public/` (Vite/React) ou `static/` (Next.js)
- Use caminhos absolutos: `/icon-192.png` (não `./icon-192.png`)

### Problema: Cor de fundo errada

**Solução:**
- `background_color` no manifest.json
- `theme-color` na meta tag
- CSS inline no `<body>` do HTML

---

## 8. Recursos Adicionais

### Documentação Oficial
- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA](https://web.dev/progressive-web-apps/)
- [Google: Install Prompt](https://web.dev/customize-install/)

### Ferramentas
- [PWA Builder](https://www.pwabuilder.com/)
- [Maskable.app](https://maskable.app/) - Editor de ícones maskable
- [Favicon Generator](https://realfavicongenerator.net/)

### Exemplos
- [Twitter PWA](https://twitter.com)
- [Instagram PWA](https://instagram.com)
- [Spotify PWA](https://open.spotify.com)

---

## 9. Checklist Final

Antes de fazer deploy:

- [ ] `manifest.json` configurado corretamente
- [ ] Ícones 192x192 e 512x512 criados
- [ ] Meta tags adicionadas no HTML
- [ ] Botão de instalação implementado
- [ ] Testado no Chrome Android
- [ ] Testado no Chrome Desktop
- [ ] Lighthouse PWA score > 90
- [ ] HTTPS habilitado (obrigatório)
- [ ] Background color combina com o design
- [ ] Theme color combina com a marca

---

## 10. Exemplo Completo (Resumo)

```jsx
// InstallPWAButton.jsx
import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="p-4 bg-green-50 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <span>App instalado!</span>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <button onClick={handleInstall} className="btn-primary">
      <Download className="w-4 h-4" />
      Instalar App
    </button>
  );
}
```

---

**Criado por:** Fluxo7 Team  
**Data:** 13/10/2025  
**Versão:** 1.0
