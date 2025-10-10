# 🗄️ CHECKLIST SUPABASE PARA PRODUÇÃO - Fluxo7Arena

## 🚨 CONFIGURAÇÕES OBRIGATÓRIAS

### 1. **Domínios Permitidos (Site URL)**
No painel do Supabase > Authentication > URL Configuration:

```
Site URL: https://f7arena.com
Additional redirect URLs:
- https://f7arena.com
- https://www.f7arena.com  
- https://seu-site.netlify.app (temporário para testes)
```

### 2. **Variáveis de Ambiente**
```env
VITE_SUPABASE_URL=https://dlfryxtyxqoacuunswuc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZnJ5eHR5eHFvYWN1dW5zd3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODg0MzcsImV4cCI6MjA3MTQ2NDQzN30.AizQBbCE1p_xfAQ9T0Eha1anGzcFETcc__8AV4iaQTY
```

## 🔒 RLS POLICIES NECESSÁRIAS

### Tabelas Core que DEVEM ter RLS:
- ✅ agendamentos
- ✅ agendamento_participantes  
- ✅ quadras
- ✅ clientes
- ✅ produtos
- ✅ mesas
- ✅ comandas
- ✅ comanda_itens
- ✅ comanda_clientes
- ✅ pagamentos
- ✅ caixa_sessoes
- ✅ finalizadoras
- ✅ empresas

### Template de Policy RLS:
```sql
-- Exemplo para tabela 'clientes'
CREATE POLICY "Users can only see their company clients" 
ON clientes FOR ALL 
USING (codigo_empresa = auth.jwt() ->> 'codigo_empresa');

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
```

## 📊 VIEW CRÍTICA NECESSÁRIA

### v_agendamentos_detalhado
Esta view é ESSENCIAL para o sistema financeiro. Execute o SQL:

```sql
-- Arquivo: create_view_agendamentos_detalhado.sql
-- (já existe no projeto - executar no Supabase)
```

## 🔧 CONFIGURAÇÕES DE PERFORMANCE

### 1. **Connection Pooling**
- Habilitar no painel Supabase > Settings > Database
- Modo: Transaction (recomendado para apps web)

### 2. **Índices Recomendados**
```sql
-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_inicio 
ON agendamentos(codigo_empresa, inicio);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa_nome 
ON clientes(codigo_empresa, nome);

CREATE INDEX IF NOT EXISTS idx_comandas_empresa_status 
ON comandas(codigo_empresa, status);

CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa_recebido 
ON pagamentos(codigo_empresa, recebido_em);
```

## 🚨 FUNCIONALIDADES QUE DEPENDEM DO SUPABASE

### 1. **Autenticação Multi-Empresa**
- Login/logout com JWT
- Perfis de usuário com codigo_empresa
- Sessões persistentes

### 2. **Real-time Updates**
- Sincronização automática de agendamentos
- Updates em tempo real nas comandas
- Notificações de pagamentos

### 3. **Sistema de Agenda Complexo**
- Drag & drop com validação de conflitos
- Participantes múltiplos
- Status workflow (agendado → confirmado → em andamento)
- Auto-confirmação baseada em tempo

### 4. **Sistema de Vendas/Loja**
- Mesas com estados visuais
- Comandas com múltiplos itens
- Controle de caixa por sessão
- Múltiplas finalizadoras de pagamento

### 5. **CRM Avançado**
- Histórico unificado (comandas + agendamentos)
- Timeline cronológica de atividades
- Exportação CSV (37 campos)
- Cache inteligente com retry

## ⚠️ PONTOS DE ATENÇÃO IDENTIFICADOS

### 1. **Retry Logic para RLS**
O código já implementa retry automático para contornar atrasos de RLS:
```javascript
// Retry para contornar atrasos de token/RLS no Vercel
if (rows.length === 0 && hasCache && !clientsRetryRef.current) {
  clientsRetryRef.current = true;
  setTimeout(loadClients, 700); // Retry em 700ms
}
```

### 2. **Timeouts de Segurança**
```javascript
// Safety timeout: evita loader infinito em casos de latência/restrições RLS
let safetyTimer = setTimeout(() => setHistoryLoading(false), 10000);
```

### 3. **Cache Inteligente**
- localStorage para hidratação rápida
- Fallback em caso de falha de RLS
- Auto-refresh baseado em foco/visibilidade

## 🧪 TESTES CRÍTICOS PÓS-DEPLOY

### 1. **Autenticação**
- [ ] Login com usuário existente
- [ ] Logout e re-login
- [ ] Sessão persistente após refresh
- [ ] Multi-empresa funcionando

### 2. **Funcionalidades Core**
- [ ] Dashboard carrega métricas
- [ ] Agenda: criar/editar agendamentos
- [ ] Vendas: abrir comandas, adicionar itens
- [ ] Clientes: histórico unificado carrega
- [ ] Produtos: CRUD completo
- [ ] Financeiro: relatórios carregam

### 3. **Real-time**
- [ ] Agendamentos sincronizam entre abas
- [ ] Comandas atualizam em tempo real
- [ ] Notificações funcionam

### 4. **Performance**
- [ ] Carregamento inicial < 3s
- [ ] Navegação entre páginas fluida
- [ ] Sem erros de console relacionados ao Supabase

## 🔧 COMANDOS ÚTEIS PARA DEBUG

### No Console do Navegador:
```javascript
// Verificar conexão Supabase
window.__supabase.auth.getSession()

// Verificar usuário logado
window.__supabase.auth.getUser()

// Testar query simples
window.__supabase.from('empresas').select('*').limit(1)
```

## 📋 CHECKLIST FINAL

- [ ] Domínios configurados no Supabase
- [ ] Variáveis de ambiente no Netlify
- [ ] RLS policies ativas em todas as tabelas
- [ ] View v_agendamentos_detalhado criada
- [ ] Índices de performance criados
- [ ] Testes de autenticação passando
- [ ] Funcionalidades core testadas
- [ ] Real-time funcionando
- [ ] Performance aceitável
- [ ] Sem erros críticos no console

## 🚨 EM CASO DE PROBLEMAS

### Erro: "permission denied" ou "violates row-level security"
- Verificar se RLS está configurado corretamente
- Confirmar se codigo_empresa está no JWT do usuário
- Testar policies no SQL Editor do Supabase

### Erro: "Invalid API key" ou variáveis de ambiente
- Verificar se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão corretas no Netlify
- Confirmar se as chaves não expiraram

### Erro: Real-time não funciona
- Verificar se o plano Supabase suporta real-time
- Confirmar configuração de domínios permitidos

### Performance lenta
- Verificar índices no banco
- Monitorar usage no painel Supabase
- Considerar otimização de queries complexas
