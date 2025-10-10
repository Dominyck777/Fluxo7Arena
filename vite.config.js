import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

const isDev = process.env.NODE_ENV !== 'production';

async function getConfig() {

  const configHorizonsViteErrorHandler = `
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        if (
          addedNode.nodeType === Node.ELEMENT_NODE &&
          (
            addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
            addedNode.classList?.contains('backdrop')
          )
        ) {
          handleViteOverlay(addedNode);
        }
      }
    }
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  function handleViteOverlay(node) {
    if (!node.shadowRoot) {
      return;
    }
  
    const backdrop = node.shadowRoot.querySelector('.backdrop');
  
    if (backdrop) {
      const overlayHtml = backdrop.outerHTML;
      const parser = new DOMParser();
      const doc = parser.parseFromString(overlayHtml, 'text/html');
      const messageBodyElement = doc.querySelector('.message-body');
      const fileElement = doc.querySelector('.file');
      const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
      const fileText = fileElement ? fileElement.textContent.trim() : '';
      const error = messageText + (fileText ? ' File:' + fileText : '');
  
      window.parent.postMessage({
        type: 'horizons-vite-error',
        error,
      }, '*');
    }
  }
  `;

  const configHorizonsRuntimeErrorHandler = `
  window.onerror = (message, source, lineno, colno, errorObj) => {
    const errorDetails = errorObj ? JSON.stringify({
      name: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
      source,
      lineno,
      colno,
    }) : null;
  
    window.parent.postMessage({
      type: 'horizons-runtime-error',
      message,
      error: errorDetails
    }, '*');
  };
  `;

  const configHorizonsConsoleErrroHandler = `
  const originalConsoleError = console.error;
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
  
    let errorString = '';
  
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg instanceof Error) {
        errorString = arg.stack || (String(arg && arg.name) + ': ' + String(arg && arg.message));
        break;
      }
    }
  
    if (!errorString) {
      errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    }
  
    window.parent.postMessage({
      type: 'horizons-console-error',
      error: errorString
    }, '*');
  };
  `;

  const configWindowFetchMonkeyPatch = `
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];
  
    // Skip WebSocket URLs
    if (url.startsWith('ws:') || url.startsWith('wss:')) {
      return originalFetch.apply(this, args);
    }
  
    return originalFetch.apply(this, args)
      .then(async response => {
        const contentType = response.headers.get('Content-Type') || '';
  
        // Exclude HTML document responses
        const isDocumentResponse =
          contentType.includes('text/html') ||
          contentType.includes('application/xhtml+xml');
  
        if (!response.ok && !isDocumentResponse) {
            const responseClone = response.clone();
            const errorFromRes = await responseClone.text();
            const requestUrl = response.url;
            console.error('Fetch error from ' + requestUrl + ': ' + errorFromRes);
        }
  
        return response;
      })
      .catch(error => {
        if (!url.match(/\\.html?$/i)) {
          console.error(error);
        }
  
        throw error;
      });
  };
  `;

  const configConsoleFilter = `
  (function(){
    const patterns = [
      'Download the React DevTools',
      'React Router Future Flag Warning',
      'Using UNSAFE_componentWillMount in strict mode is not recommended',
      'Each child in a list should have a unique "key" prop',
      '[AuthDebug]',
      '[AuthContext]',
      // Suppress known noisy third-party warning from react-beautiful-dnd
      'Connect(Droppable): Support for defaultProps will be removed from memo components',
      // Suppress verbose products api logs
      '[products.api]'
    ];

    function shouldSuppress(args) {
      try {
        const text = args.map(a => {
          if (typeof a === 'string') return a;
          if (a && typeof a.message === 'string') return a.message;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');
        return patterns.some(p => text.includes(p));
      } catch { return false; }
    }

    const _log = console.log.bind(console);
    const _info = console.info.bind(console);
    const _warn = console.warn.bind(console);
    const _error = console.error.bind(console);

    console.log = (...args) => { if (!shouldSuppress(args)) _log(...args); };
    console.info = (...args) => { if (!shouldSuppress(args)) _info(...args); };
    console.warn = (...args) => { if (!shouldSuppress(args)) _warn(...args); };
    console.error = (...args) => { if (!shouldSuppress(args)) _error(...args); };
  })();
  `;

  const addTransformIndexHtml = {
    name: 'add-transform-index-html',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: configHorizonsRuntimeErrorHandler,
            injectTo: 'head',
          },
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: configHorizonsViteErrorHandler,
            injectTo: 'head',
          },
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: configHorizonsConsoleErrroHandler,
            injectTo: 'head',
          },
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: configWindowFetchMonkeyPatch,
            injectTo: 'head',
          },
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: configConsoleFilter,
            injectTo: 'head',
          },
        ],
      };
    },
  };

  console.warn = () => {};

  const logger = createLogger();
  const loggerError = logger.error;

  logger.error = (msg, options) => {
    if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
      return;
    }
    loggerError(msg, options);
  };

  return defineConfig({
    customLogger: logger,
    plugins: [
      react(),
      addTransformIndexHtml
    ],
    // ✅ Otimização de dependências - força pré-bundling do Supabase
    optimizeDeps: {
      include: ['@supabase/supabase-js'],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    server: {
      cors: true,
      headers: {
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      allowedHosts: true,
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
    resolve: {
      extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      // ✅ Sourcemaps para debug em produção (pode remover depois de resolver)
      sourcemap: isDev ? true : false,
      // ✅ Minificação mais suave - não quebra Supabase
      minify: isDev ? false : 'esbuild',
      // ✅ CommonJS options - garante compatibilidade com Supabase
      commonjsOptions: {
        include: [/@supabase/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: [
          '@babel/parser',
          '@babel/traverse',
          '@babel/generator',
          '@babel/types',
        ],
        // ✅ Sem code splitting manual - deixa Vite otimizar automaticamente
        // Isso evita problemas de dependências circulares e ordem de carregamento
      },
    },
  });
}

export default getConfig();