# Configuração PWA - F7 Arena

## ✅ O que foi implementado

### 1. Service Worker (`public/sw.js`)
- Cache de recursos estáticos
- Estratégia Network First com fallback para cache
- Atualização automática
- Suporte offline básico

### 2. Manifest.json melhorado
- Nome completo e descrição
- Ícones separados para `any` e `maskable`
- Shortcuts para Agenda e Clientes
- Categorias e orientação configuradas
- Theme color otimizado

### 3. Meta Tags completas
- Suporte para Android Chrome
- Suporte para iOS Safari
- Suporte para Microsoft Edge
- Theme color adaptativo (light/dark mode)

### 4. Registro automático
- Service Worker registra automaticamente no `main.jsx`
- Detecção de atualizações
- Logs para debug

### 5. Modal de instalação visual
- Instruções específicas por navegador
- Design profissional e responsivo
- Fallback quando prompt não está disponível

## 🧪 Como testar no Android

### Pré-requisitos
1. App deve estar em **HTTPS** (ou localhost)
2. Service Worker deve estar registrado
3. Manifest.json deve estar acessível

### Passos para testar

1. **Build da aplicação**
   ```bash
   npm run build
   npm run preview
   ```

2. **Abra no Chrome Android**
   - Acesse a URL da aplicação
   - Aguarde 3-5 segundos

3. **Verificar no DevTools (Desktop)**
   - F12 → Application → Manifest
   - Verificar se não há erros
   - Application → Service Workers
   - Verificar se está "activated and running"

4. **Instalar no Android**
   - Vá para a aba **Suporte**
   - Clique em **"Instalar App"**
   - Se o prompt aparecer → Clique em "Instalar"
   - Se não aparecer → Siga as instruções do modal

### Verificar logs no Console
Abra o console do navegador e procure por:
```
[PWA] beforeinstallprompt disparado
[SW] Service Worker registrado com sucesso
```

## 🔍 Troubleshooting

### Prompt não aparece no Android

**Possíveis causas:**
1. ❌ App já instalado → Desinstale e teste novamente
2. ❌ Usuário rejeitou antes → Limpe dados do site nas configurações
3. ❌ Service Worker não registrado → Verifique console
4. ❌ Manifest.json com erro → Verifique DevTools
5. ❌ Não está em HTTPS → Use HTTPS ou localhost
6. ❌ Navegador in-app (WhatsApp, Instagram) → Abra no Chrome

**Soluções:**
```bash
# Limpar cache do Service Worker
1. Chrome → Configurações → Privacidade → Limpar dados
2. Ou use DevTools → Application → Clear storage

# Forçar atualização do Service Worker
1. DevTools → Application → Service Workers
2. Clique em "Unregister"
3. Recarregue a página
```

### Service Worker não registra

**Verifique:**
1. Arquivo `public/sw.js` existe
2. Arquivo `src/registerSW.js` existe
3. Import no `main.jsx` está correto
4. Console não mostra erros

### Manifest não carrega

**Verifique:**
1. Arquivo está em `public/manifest.json`
2. Link no `index.html` está correto: `<link rel="manifest" href="/manifest.json" />`
3. Arquivo é JSON válido (sem vírgulas extras)
4. Ícones existem no caminho especificado

## 📱 Testar em diferentes dispositivos

### Android Chrome
✅ Suporte completo ao `beforeinstallprompt`

### Android Firefox
⚠️ Suporte limitado - Use instruções manuais

### Android Samsung Internet
⚠️ Suporte parcial - Pode precisar de instalação manual

### iOS Safari
❌ Não suporta `beforeinstallprompt` - Sempre usa instruções manuais

## 🎯 Checklist de validação

- [ ] Service Worker registrado (console mostra log)
- [ ] Manifest.json sem erros (DevTools → Application → Manifest)
- [ ] Ícones carregando corretamente
- [ ] HTTPS ou localhost
- [ ] Testado em Chrome Android
- [ ] Modal de instalação abre corretamente
- [ ] App instala e abre em standalone mode

## 📊 Métricas de sucesso

Após instalação bem-sucedida:
- App aparece na tela inicial
- Abre em tela cheia (sem barra do navegador)
- Ícone correto na tela inicial
- Nome "F7 Arena" visível

## 🔗 Recursos úteis

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)
- [Service Worker Cookbook](https://serviceworke.rs/)
