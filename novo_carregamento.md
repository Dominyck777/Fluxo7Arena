# 📚 GUIA DE WRAPPERS - FLUXO7ARENA

## 🎯 Objetivo Desta Documentação

Este guia mostra **exemplos reais de wrappers já implementados** na aplicação para você usar como referência ao corrigir problemas no Vercel.

### Quando usar este guia:
- ❌ Página não carrega dados no Vercel
- ❌ Erro "Cannot read property of undefined"
- ❌ Funcionalidade funciona local mas falha em produção
- ❌ Loading infinito
- ✅ Precisa implementar wrapper em nova funcionalidade

---

## 🏗️ O QUE SÃO WRAPPERS

### Definição Simples
Wrappers são componentes que **envolvem outros componentes** para garantir que dados estejam prontos antes da renderização.

**Analogia:** É como esperar a água ferver antes de fazer café. O wrapper "espera" os dados estarem prontos.

### Por que Falha no Vercel?

| Ambiente | Comportamento |
|----------|---------------|
| **Localhost** | Cache do navegador, hot reload, conexão rápida |
| **Vercel** | Cold start, latência de rede, hydration do zero |

**Problema:** No Vercel, componentes tentam usar dados que ainda não existem.

---

## 🔍 IDENTIFICANDO COMPONENTES QUE PRECISAM DE WRAPPER

### Checklist de Sintomas

Verifique se o componente/página:

- [ ] Usa `useAuth()` ou `useContext()` no início
- [ ] Faz queries ao Supabase no `useEffect` inicial
- [ ] Depende de `userProfile.codigo_empresa`
- [ ] Tem real-time subscriptions (Supabase channels)
- [ ] Acessa `localStorage` ou `sessionStorage`
- [ ] Carrega dados críticos no mount

**Se marcou 2 ou mais:** Provavelmente precisa de wrapper!

---

## ✅ WRAPPERS JÁ IMPLEMENTADOS NA APLICAÇÃO

Use estes exemplos como referência para implementar wrappers em outras partes do código.

---

### 🔒 EXEMPLO 1: ProtectedRoute (Wrapper de Autenticação)

**Localização:** `src/components/ProtectedRoute.jsx`

**O que faz:** Garante que o usuário está autenticado antes de renderizar qualquer página.

**Código completo:**
```javascript
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';

const ProtectedRoute = ({ children }) => {
  const { user, authReady } = useAuth();

  // ✅ PASSO 1: Espera autenticação estar pronta
  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <span className="text-text-primary font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  // ✅ PASSO 2: Verifica se tem usuário
  if (!user) {
    return <LoginPage />;
  }

  // ✅ PASSO 3: Renderiza children com dados garantidos
  return children;
};

export default ProtectedRoute;
```

**Como é usado no App.jsx:**
```javascript
// src/App.jsx (linhas 81-85)
<Route path="/*" element={
  <ProtectedRoute>
    <PrivateApp />  {/* Todas as páginas protegidas */}
  </ProtectedRoute>
} />
```

**Páginas protegidas por este wrapper:**
- ✅ Dashboard
- ✅ Agenda
- ✅ Vendas
- ✅ Produtos
- ✅ Clientes
- ✅ Financeiro
- ✅ Todas as outras páginas (exceto login e reset-password)

**Aprenda com este exemplo:**
- 🔑 **Verificação em etapas**: Primeiro `authReady`, depois `user`
- 🔑 **Loading state**: Mostra spinner enquanto aguarda
- 🔑 **Fallback**: Redireciona para login se não autenticado
- 🔑 **Return early**: Retorna antes de renderizar children

---

### 🎨 EXEMPLO 2: AlertsProvider (Wrapper de Contexto)

**Localização:** `src/contexts/AlertsContext.jsx`

**O que faz:** Carrega alertas do sistema apenas quando `userProfile` está pronto.

**Código relevante:**
```javascript
// src/contexts/AlertsContext.jsx (linhas 8-34)
export const AlertsProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ Função que depende de userProfile
  const loadAlerts = useCallback(async () => {
    // PASSO 1: Verifica se userProfile está pronto
    if (!userProfile?.codigo_empresa) return;
    
    try {
      setLoading(true);
      const codigo = userProfile.codigo_empresa;
      
      // PASSO 2: Agora pode fazer queries com segurança
      const { data: produtosBaixoEstoque } = await supabase
        .from('produtos')
        .select('nome, estoque, estoque_minimo')
        .eq('codigo_empresa', codigo); // ✅ codigo_empresa garantido
      
      // ... mais queries
      
      setAlerts(alertasList);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.codigo_empresa]);

  // ✅ PASSO 3: Só executa quando userProfile existe
  useEffect(() => {
    if (userProfile?.codigo_empresa) {
      loadAlerts();
      
      // Recarrega a cada 5 minutos
      const interval = setInterval(loadAlerts, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userProfile?.codigo_empresa, loadAlerts]);

  return (
    <AlertsContext.Provider value={{ alerts, loading, loadAlerts }}>
      {children}
    </AlertsContext.Provider>
  );
};
```

**Como é usado no App.jsx:**
```javascript
// src/App.jsx (linha 38)
<AlertsProvider>
  <div className="flex h-screen">
    {/* Toda a aplicação privada */}
  </div>
</AlertsProvider>
```

**Aprenda com este exemplo:**
- 🔑 **Guard clause**: `if (!userProfile?.codigo_empresa) return;`
- 🔑 **useCallback**: Memoiza função para evitar re-renders
- 🔑 **Dependência correta**: `[userProfile?.codigo_empresa]`
- 🔑 **Cleanup**: Remove interval ao desmontar
- 🔑 **Try/catch**: Tratamento de erros robusto

---

## 📋 FUNCIONALIDADES QUE PRECISAM DE WRAPPER

Use os exemplos acima como base para implementar wrappers nestas funcionalidades:

### 1. Sistema de Automação de Agendamentos ⭐

**Localização:** `AgendaPage.jsx` (linhas 800-850)

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Falha no Vercel
useEffect(() => {
  // Tenta carregar automação antes do userProfile estar pronto
  const loadAutomation = async () => {
    const { data } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa) // 💥 undefined
      .single();
  };
  loadAutomation();
}, []); // Executa imediatamente
```

**✅ COMO CORRIGIR - Use o padrão do AlertsProvider:**
```javascript
// Dentro do AgendaPage.jsx, no useEffect que carrega automação
const loadAutomation = useCallback(async () => {
  // ✅ ADICIONE ESTA VERIFICAÇÃO (igual AlertsProvider linha 17)
  if (!userProfile?.codigo_empresa) return;
  
  try {
    const { data } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa) // Agora é seguro
      .single();
  } catch (error) {
    console.error('Erro ao carregar automação:', error);
  }
}, [userProfile?.codigo_empresa]); // ✅ Dependência correta

useEffect(() => {
  // ✅ Só executa se userProfile existe (igual AlertsProvider linha 164)
  if (userProfile?.codigo_empresa) {
    loadAutomation();
  }
}, [userProfile?.codigo_empresa, loadAutomation]);
```

**Funcionalidades afetadas:**
- Auto-confirmação de agendamentos
- Transição automática de status (agendado → confirmado)
- Validação de horários baseada em configuração
- Notificações automáticas

**Referência:** Use o padrão do `AlertsProvider` (linhas 16-34)

---

### 2. Sistema de Real-time (Sincronização Automática)

**Localização:** `AgendaPage.jsx` (linhas 997-1038)

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Canal não conecta
useEffect(() => {
  const channel = supabase
    .channel(`agendamentos:${userProfile.codigo_empresa}`) // 💥 undefined
    .on('postgres_changes', { /* ... */ }, onChange)
    .subscribe();
}, [userProfile?.codigo_empresa]); // userProfile pode ser undefined
```

**Funcionalidades afetadas:**
- Sincronização em tempo real de agendamentos
- Atualização automática quando outro usuário faz alterações
- Notificações de conflitos de horário

---

### 3. Sistema de Caixa e Sessões

**Localização:** `VendasPage.jsx`, `FinanceiroPage.jsx`

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Sessão não carrega
useEffect(() => {
  const loadCaixaSession = async () => {
    const { data } = await supabase
      .from('caixa_sessoes')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa) // 💥 undefined
      .eq('status', 'aberta')
      .single();
  };
  loadCaixaSession();
}, []);
```

**Funcionalidades afetadas:**
- Abertura/fechamento de caixa
- Controle de movimentações
- Validação de sessão ativa
- Resumo financeiro

---

### 4. Cache Inteligente de Clientes

**Localização:** `ClientesPage.jsx` (linhas 724-838)

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Cache key incorreta
const [clients, setClients] = useState(() => {
  const codigo = userProfile?.codigo_empresa; // 💥 undefined no primeiro render
  const key = `clientes:list:${codigo}`; // key = "clientes:list:undefined"
  return JSON.parse(localStorage.getItem(key) || '[]');
});
```

**Funcionalidades afetadas:**
- Hidratação rápida da lista de clientes
- Sistema de retry automático
- Auto-refresh ao focar janela

---

### 5. Histórico Unificado de Clientes

**Localização:** `ClientesPage.jsx` (linhas 233-456)

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Queries falham
const loadHistory = async () => {
  // Múltiplas queries dependem de userProfile
  const { data: comandas } = await supabase
    .from('comandas')
    .select('*')
    .eq('codigo_empresa', userProfile.codigo_empresa); // 💥 undefined
    
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('codigo_empresa', userProfile.codigo_empresa); // 💥 undefined
};
```

**Funcionalidades afetadas:**
- Timeline de comandas + agendamentos
- Cálculos financeiros em tempo real
- Modal de detalhes expandível

---

### 6. Sistema de Participantes e Pagamentos

**Localização:** `AgendaPage.jsx` (linhas 1096-1146)

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Participantes não carregam
useEffect(() => {
  const loadParticipants = async () => {
    const { data } = await supabase
      .from('agendamento_participantes')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa) // 💥 undefined
      .in('agendamento_id', bookingIds);
  };
  loadParticipants();
}, [bookings]); // Pode executar antes de userProfile estar pronto
```

**Funcionalidades afetadas:**
- Chip de pagamentos (ex: "0/2 pagos")
- Lista de participantes por agendamento
- Status de pagamento de cotas
- Modal de gerenciamento de pagamentos

---

### 7. Gestão de Mesas e Comandas

**Localização:** `VendasPage.jsx`

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Mesas não carregam
useEffect(() => {
  const loadTables = async () => {
    const { data } = await supabase
      .from('mesas')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa) // 💥 undefined
      .order('ordem');
  };
  loadTables();
}, []);
```

**Funcionalidades afetadas:**
- Mapa de mesas (drag & drop)
- Estados visuais (livre, ocupada, pagamento)
- Comandas vinculadas
- Sistema de pedidos

---

### 8. Controle de Produtos e Estoque

**Localização:** `ProdutosPage.jsx`

**Por que precisa de wrapper:**
```javascript
// ❌ SEM WRAPPER - Produtos não carregam
useEffect(() => {
  const loadProducts = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa) // 💥 undefined
      .order('nome');
  };
  loadProducts();
}, []);
```

**Funcionalidades afetadas:**
- Lista de produtos
- Controle de estoque
- Produtos mais vendidos
- Exportação CSV

---

---

## 🛠️ PADRÕES DE IMPLEMENTAÇÃO

### Padrão 1: Guard Clause (Mais Simples)

**Use quando:** Componente já existe e só precisa proteger queries

**Baseado em:** `AlertsProvider` (linha 17)

**Antes:**
```javascript
useEffect(() => {
  const loadData = async () => {
    const { data } = await supabase
      .from('tabela')
      .eq('codigo_empresa', userProfile.codigo_empresa); // 💥 ERRO
  };
  loadData();
}, []);
```

**Depois:**
```javascript
const loadData = useCallback(async () => {
  // ✅ GUARD CLAUSE - Para se não tiver dados
  if (!userProfile?.codigo_empresa) return;
  
  try {
    const { data } = await supabase
      .from('tabela')
      .eq('codigo_empresa', userProfile.codigo_empresa); // ✅ Seguro
  } catch (error) {
    console.error('Erro:', error);
  }
}, [userProfile?.codigo_empresa]); // ✅ Dependência

useEffect(() => {
  // ✅ Só executa se tiver dados
  if (userProfile?.codigo_empresa) {
    loadData();
  }
}, [userProfile?.codigo_empresa, loadData]);
```

---

### Padrão 2: Wrapper Component (Mais Robusto)

**Use quando:** Precisa proteger uma página inteira

**Baseado em:** `ProtectedRoute` (linhas 5-24)

**Passo 1: Criar o Componente DataGuard**

Crie o arquivo `src/components/DataGuard.jsx`:

```javascript
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function DataGuard({ children, requireProfile = true }) {
  const { authReady, userProfile, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Aguarda autenticação estar pronta
    if (!authReady) return;
    
    // Se não tem usuário, redireciona para login
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Se requer perfil e não tem, aguarda
    if (requireProfile && !userProfile?.codigo_empresa) {
      return;
    }
    
    // Tudo pronto!
    setIsReady(true);
  }, [authReady, userProfile, user, requireProfile, navigate]);
  
  // Loading state
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-text-secondary">Carregando dados...</p>
        </div>
      </div>
    );
  }
  
  // Renderiza children com dados garantidos
  return children;
}
```

---

**Passo 2: Aplicar o Wrapper**

**Baseado em:** Como `ProtectedRoute` é usado no `App.jsx` (linha 82)

```javascript
// src/App.jsx
import { DataGuard } from './components/DataGuard';

// ✅ OPÇÃO 1: Wrapper Global (igual ProtectedRoute)
<Route path="/*" element={
  <ProtectedRoute>
    <DataGuard>  {/* Adicione aqui */}
      <PrivateApp />
    </DataGuard>
  </ProtectedRoute>
} />

// ✅ OPÇÃO 2: Wrapper por Página (mais granular)
<Route path="/agenda" element={
  <ProtectedRoute>
    <DataGuard>
      <AgendaPage />
    </DataGuard>
  </ProtectedRoute>
} />
```

---

## 🎯 GUIA RÁPIDO DE DECISÃO

```
┌─────────────────────────────────────┐
│ Funcionalidade falha no Vercel?    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ É um useEffect que carrega dados?   │
└──────────────┬──────────────────────┘
               │ SIM
               ▼
┌─────────────────────────────────────┐
│ Use PADRÃO 1: Guard Clause          │
│ (Baseado em AlertsProvider)         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ É uma página inteira?               │
└──────────────┬──────────────────────┘
               │ SIM
               ▼
┌─────────────────────────────────────┐
│ Use PADRÃO 2: DataGuard Component   │
│ (Baseado em ProtectedRoute)         │
└─────────────────────────────────────┘
```

---

## 🧪 TESTANDO A CORREÇÃO

### Checklist de Testes

Após aplicar o wrapper, teste:

- [ ] **Página carrega** sem erro 500
- [ ] **Dados aparecem** corretamente
- [ ] **Loading state** é exibido brevemente
- [ ] **Automação funciona** (agendamentos auto-confirmam)
- [ ] **Real-time sincroniza** (mudanças aparecem automaticamente)
- [ ] **Caixa abre/fecha** corretamente
- [ ] **Mesas carregam** com estados corretos
- [ ] **Produtos listam** sem erros
- [ ] **Clientes carregam** com histórico

### Teste no Vercel

1. **Deploy** a aplicação com o wrapper
2. **Limpe cache** do navegador (Ctrl+Shift+Delete)
3. **Abra em aba anônima**
4. **Faça login** e teste cada funcionalidade
5. **Verifique console** (F12) para erros

---

## 🚨 TROUBLESHOOTING AVANÇADO

### Problema: Loading Infinito

**Causa:** `authReady` ou `userProfile` nunca ficam prontos

**Solução:**
```javascript
// Adicione timeout de segurança no DataGuard
useEffect(() => {
  const timeout = setTimeout(() => {
    console.error('DataGuard timeout - forçando renderização');
    setIsReady(true);
  }, 10000); // 10 segundos
  
  return () => clearTimeout(timeout);
}, []);
```

---

### Problema: Dados Carregam mas Automação Não Funciona

**Causa:** Automação depende de dados adicionais além de `userProfile`

**Solução:**
```javascript
// Crie wrapper específico para Agenda
export function AgendaGuard({ children }) {
  const { userProfile } = useAuth();
  const [automationReady, setAutomationReady] = useState(false);
  
  useEffect(() => {
    const loadAutomation = async () => {
      // Carrega configurações de automação
      const { data } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .single();
      
      setAutomationReady(true);
    };
    
    if (userProfile?.codigo_empresa) {
      loadAutomation();
    }
  }, [userProfile]);
  
  if (!automationReady) return <Loading />;
  return children;
}

// Uso
<DataGuard>
  <AgendaGuard>
    <AgendaPage />
  </AgendaGuard>
</DataGuard>
```

---

### Problema: Real-time Não Conecta

**Causa:** Canal Supabase tenta conectar antes da autenticação

**Solução:**
```javascript
// No componente que usa real-time
useEffect(() => {
  // ✅ Só conecta se tudo estiver pronto
  if (!authReady || !userProfile?.codigo_empresa) return;
  
  const channel = supabase
    .channel(`agendamentos:${userProfile.codigo_empresa}`)
    .on('postgres_changes', { /* ... */ }, onChange)
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [authReady, userProfile?.codigo_empresa]); // Dependências corretas
```

---

## 📊 MATRIZ DE FUNCIONALIDADES X PADRÕES

| Funcionalidade | Padrão Recomendado | Referência | Sintoma se Faltar |
|----------------|-------------------|------------|-------------------|
| **Automação de Agendamentos** | Guard Clause | AlertsProvider (linha 17) | Auto-confirmação não funciona |
| **Real-time Sync** | Guard Clause | AlertsProvider (linha 164) | Mudanças não aparecem |
| **Sistema de Caixa** | Guard Clause | AlertsProvider (linha 17) | Caixa não abre |
| **Cache de Clientes** | Guard Clause | AlertsProvider (linha 17) | Lista vazia ou lenta |
| **Histórico Unificado** | Guard Clause | AlertsProvider (linha 17) | Timeline não carrega |
| **Participantes/Pagamentos** | Guard Clause | AlertsProvider (linha 17) | Chip "0/0 pagos" não aparece |
| **Mesas e Comandas** | Guard Clause | AlertsProvider (linha 17) | Mapa de mesas vazio |
| **Produtos/Estoque** | Guard Clause | AlertsProvider (linha 17) | Lista de produtos vazia |
| **Página Inteira Nova** | DataGuard Component | ProtectedRoute (linha 5) | Tela branca ou erro 500 |

---

## 📝 RESUMO EXECUTIVO

### Wrappers Já Implementados na Aplicação:
1. ✅ **ProtectedRoute** (`src/components/ProtectedRoute.jsx`)
   - Protege todas as páginas autenticadas
   - Verifica `authReady` e `user`
   - Mostra loading enquanto aguarda

2. ✅ **AlertsProvider** (`src/contexts/AlertsContext.jsx`)
   - Carrega alertas do sistema
   - Usa guard clause: `if (!userProfile?.codigo_empresa) return;`
   - Recarrega a cada 5 minutos

### Dois Padrões para Usar:

#### Padrão 1: Guard Clause (Simples)
**Use para:** useEffects que carregam dados  
**Referência:** `AlertsProvider` linha 17  
**Código:**
```javascript
if (!userProfile?.codigo_empresa) return;
```

#### Padrão 2: DataGuard Component (Robusto)
**Use para:** Páginas inteiras  
**Referência:** `ProtectedRoute` linhas 5-24  
**Código:** Ver seção "Padrão 2" acima

### Como Corrigir Problemas:
1. **Identifique** o sintoma (tabela acima)
2. **Escolha** o padrão (Guard Clause ou DataGuard)
3. **Copie** o código de referência
4. **Adapte** para sua funcionalidade
5. **Teste** no Vercel

---

## 🆘 SUPORTE

Se após aplicar o wrapper ainda houver problemas:

1. **Verifique console** (F12) para erros específicos
2. **Teste localmente** com `npm run build && npm run preview`
3. **Verifique variáveis de ambiente** no Vercel
4. **Confirme RLS** (Row Level Security) no Supabase
5. **Revise logs** no painel do Vercel

---

## 📚 REFERÊNCIAS RÁPIDAS

### Arquivos para Consultar:
1. **`src/components/ProtectedRoute.jsx`** - Exemplo de wrapper de página
2. **`src/contexts/AlertsContext.jsx`** - Exemplo de guard clause
3. **`src/App.jsx`** - Como aplicar wrappers em rotas

### Linha de Código Mais Importante:
```javascript
if (!userProfile?.codigo_empresa) return;
```
**Onde está:** `AlertsContext.jsx` linha 17  
**O que faz:** Para a execução se dados não estiverem prontos  
**Use em:** 90% dos casos de problemas no Vercel

### Checklist de Implementação:
- [ ] Identifiquei o problema (tabela de sintomas)
- [ ] Escolhi o padrão (Guard Clause ou DataGuard)
- [ ] Copiei o código de referência
- [ ] Adaptei para minha funcionalidade
- [ ] Adicionei try/catch
- [ ] Testei localmente
- [ ] Fiz deploy no Vercel
- [ ] Testei em aba anônima
- [ ] Verifiquei console (F12)

---

**Documentação criada em:** 13/10/2025  
**Versão:** 2.0 (Baseada em Exemplos Reais)  
**Aplicação:** Fluxo7Arena  
**Stack:** React + Vite + Supabase + Vercel

**Última atualização:** Adicionados exemplos reais de `ProtectedRoute` e `AlertsProvider`
