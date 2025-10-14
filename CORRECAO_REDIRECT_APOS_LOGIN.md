# Correção: Redirecionamento Após Login Mantém Rota Original

## 🐛 Problema Identificado

Quando o usuário estava em uma rota protegida (ex: `/agenda`) e não estava autenticado, ao fazer login ele era **sempre redirecionado para `/` (dashboard)**, perdendo a rota original.

### Comportamento Esperado:
- Usuário acessa `/agenda` deslogado
- Sistema mostra tela de login
- Usuário faz login
- Sistema redireciona de volta para `/agenda` ✅

### Comportamento Anterior:
- Usuário acessa `/agenda` deslogado
- Sistema mostra tela de login
- Usuário faz login
- Sistema redireciona para `/` ❌

## 🔍 Causa Raiz

O `LoginPage` estava **hardcoded** para sempre redirecionar para `/` após o login, sem considerar a rota original que o usuário tentou acessar.

```javascript
// ❌ ANTES: Sempre redirecionava para raiz
window.location.replace('/');
```

## ✅ Solução Implementada

### 1. **ProtectedRoute salva a rota original**

**Arquivo**: `src/components/ProtectedRoute.jsx`

Quando detecta que o usuário não está autenticado, salva a rota atual no `sessionStorage`:

```javascript
useEffect(() => {
  if (authReady && !user && location.pathname !== '/login') {
    try {
      sessionStorage.setItem('auth:returnUrl', location.pathname + location.search);
      console.log('[ProtectedRoute] Salvando rota de retorno:', location.pathname + location.search);
    } catch (e) {
      console.warn('[ProtectedRoute] Erro ao salvar rota de retorno:', e);
    }
  }
}, [authReady, user, location.pathname, location.search]);
```

**Detalhes importantes:**
- Usa `sessionStorage` (não persiste entre abas/janelas)
- Salva pathname + search params (ex: `/agenda?date=2025-01-15`)
- Ignora rota `/login` para evitar loop
- Só salva quando `authReady` é `true` (evita condições de corrida)

### 2. **LoginPage redireciona para rota salva**

**Arquivo**: `src/pages/LoginPage.jsx`

Após login bem-sucedido, busca a rota salva e redireciona:

```javascript
// No useEffect (quando já está autenticado)
const returnUrl = sessionStorage.getItem('auth:returnUrl');
sessionStorage.removeItem('auth:returnUrl');
const targetUrl = returnUrl || '/';
console.log('[LoginPage] Redirecionando para:', targetUrl);
window.location.replace(targetUrl);
```

```javascript
// No handleSubmit (após login)
const returnUrl = sessionStorage.getItem('auth:returnUrl');
sessionStorage.removeItem('auth:returnUrl');
const targetUrl = returnUrl || '/';
console.log('[LoginPage] Redirecionando após login para:', targetUrl);
window.location.replace(targetUrl);
```

**Detalhes importantes:**
- Remove a rota salva após ler (evita redirecionamentos indesejados)
- Fallback para `/` se não houver rota salva
- Logs para facilitar debug
- Implementado em 2 lugares (useEffect + handleSubmit) para cobrir todos os casos

## 🔄 Fluxo Completo

### Cenário 1: Usuário deslogado tenta acessar rota protegida

```
1. Usuário acessa /agenda (deslogado)
   ↓
2. ProtectedRoute detecta !user
   ↓
3. ProtectedRoute salva '/agenda' em sessionStorage
   ↓
4. ProtectedRoute renderiza LoginPage
   ↓
5. Usuário faz login
   ↓
6. LoginPage lê '/agenda' do sessionStorage
   ↓
7. LoginPage redireciona para /agenda ✅
```

### Cenário 2: Usuário acessa /login diretamente

```
1. Usuário acessa /login
   ↓
2. Nenhuma rota é salva (pathname === '/login')
   ↓
3. Usuário faz login
   ↓
4. LoginPage não encontra returnUrl
   ↓
5. LoginPage redireciona para / (fallback) ✅
```

### Cenário 3: Usuário já autenticado acessa /login

```
1. Usuário autenticado acessa /login
   ↓
2. useEffect detecta user
   ↓
3. LoginPage lê returnUrl (se existir)
   ↓
4. LoginPage redireciona para returnUrl ou / ✅
```

## 📊 Por que sessionStorage?

| Storage | Persistência | Compartilhamento | Uso Ideal |
|---------|--------------|------------------|-----------|
| **sessionStorage** | Apenas na aba atual | Não compartilha entre abas | ✅ Redirecionamento temporário |
| localStorage | Persiste após fechar | Compartilha entre abas | ❌ Pode causar redirecionamentos inesperados |
| State/Context | Apenas na sessão | Não persiste reload | ❌ Perde dados no reload |

**Escolhemos `sessionStorage` porque:**
- ✅ Sobrevive ao reload da página (necessário para o fluxo de login)
- ✅ Não persiste entre abas (evita comportamentos inesperados)
- ✅ É limpo automaticamente quando a aba é fechada
- ✅ Perfeito para dados temporários de navegação

## 🧪 Como Testar

### Teste 1: Rota protegida → Login → Volta para rota
```bash
1. Fazer logout (se estiver logado)
2. Acessar http://localhost:5173/agenda
3. Verificar que mostra tela de login
4. Fazer login
5. Verificar que redireciona para /agenda ✅
```

### Teste 2: Login direto → Dashboard
```bash
1. Fazer logout
2. Acessar http://localhost:5173/login (ou /)
3. Fazer login
4. Verificar que redireciona para / ✅
```

### Teste 3: Com query params
```bash
1. Fazer logout
2. Acessar http://localhost:5173/agenda?date=2025-01-15
3. Fazer login
4. Verificar que redireciona para /agenda?date=2025-01-15 ✅
```

### Teste 4: Já autenticado
```bash
1. Já estar logado
2. Acessar http://localhost:5173/login
3. Verificar que redireciona automaticamente para / ✅
```

## 📋 Logs Esperados no Console

### Ao acessar rota protegida deslogado:
```
[ProtectedRoute] Salvando rota de retorno: /agenda
```

### Ao fazer login:
```
[LoginPage] Redirecionando após login para: /agenda
```

### Ao acessar /login já autenticado:
```
[LoginPage] Redirecionando para: /
```

## 🔧 Arquivos Modificados

1. **`src/components/ProtectedRoute.jsx`**
   - Adicionado import de `useEffect` e `useLocation`
   - Adicionado `useEffect` para salvar rota de retorno
   - Logs para debug

2. **`src/pages/LoginPage.jsx`**
   - Atualizado `useEffect` para ler e usar `returnUrl`
   - Atualizado `handleSubmit` para ler e usar `returnUrl`
   - Logs para debug
   - Limpeza do `sessionStorage` após uso

## ✅ Status

**RESOLVIDO** - O sistema agora mantém a rota original após o login, melhorando significativamente a experiência do usuário.

## 🎯 Benefícios

1. **Melhor UX**: Usuário não perde o contexto ao fazer login
2. **Menos cliques**: Não precisa navegar novamente para a rota desejada
3. **Deep linking**: Links diretos funcionam corretamente mesmo deslogado
4. **Query params preservados**: Filtros e estados na URL são mantidos

---

**Data**: 14/10/2025
**Versão**: 1.0.0
