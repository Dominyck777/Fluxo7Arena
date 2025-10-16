# 🔍 DIAGNÓSTICO: Travamento em Produção (f7arena.com)

## PROBLEMA ATUAL

O sistema trava ao carregar a página `/vendas` em produção:
- Vários logs de "still waiting..." e "safety timeout reached"
- Requisições para `listMesas()` e `listarComandasAbertas()` não finalizam
- Não aparece erro no console, apenas timeout silencioso

## CAUSA RAIZ IDENTIFICADA

**O wrapper em produção está fazendo requisições que não retornam do Supabase.**

Possíveis causas:
1. **RLS sem políticas** → Queries ficam pendentes aguardando permissão
2. **Token de sessão incorreto** → Supabase rejeita silenciosamente
3. **Performance do banco** → Queries lentas sem índices

## CORREÇÕES APLICADAS

### 1. Wrapper com Timeout e Logs Detalhados ✅
- `src/lib/supabase-fetch-wrapper.js`: Timeout de 8s, logs de duração, captura de token via `getSession()`
- Se token não for encontrado, avisa no console: "⚠️ Nenhum token encontrado"

### 2. Funções com Timeout e Logs ✅
- `listMesas()`: Timeout 5s + logs detalhados
- `listarComandasAbertas()`: Timeout 5s + logs detalhados
- Ambas imprimem: início, query montada, resultado/erro

### 3. Script SQL de RLS Criado ✅
- `sql/rls_policies_vendas.sql`: Políticas completas para todas as tabelas críticas
- Inclui: comandas, comanda_itens, pagamentos, mesas, caixa_sessoes, comanda_clientes, finalizadoras
- Índices para performance

## PRÓXIMOS PASSOS (EXECUTAR NESTA ORDEM)

### Passo 1: Fazer Build e Deploy
```bash
npm run build
# Depois fazer deploy no Netlify/Vercel
```

### Passo 2: Testar com Logs Detalhados
No console do f7arena.com após login:
1. Abrir DevTools (F12) → Aba Console
2. Navegar para `/vendas`
3. Observar os logs:
   - `[Supabase Wrapper] Token obtido via...` OU `⚠️ Nenhum token encontrado`
   - `[listMesas] Iniciando - codigo_empresa: 1004`
   - `[listMesas] Query montada, executando...`
   - `[listMesas] ✅ Sucesso - X mesas carregadas` OU `❌ EXCEPTION: ...`

### Passo 3: Aplicar RLS no Supabase
1. Abrir SQL Editor no Supabase Dashboard
2. Copiar todo o conteúdo de `sql/rls_policies_vendas.sql`
3. Executar o script
4. Verificar se as políticas foram criadas (query no final do script)

### Passo 4: Validar no Console do Navegador
```javascript
// Testar com wrapper
await __supabase.from('mesas').select('id,numero,codigo_empresa').eq('codigo_empresa', 1004).limit(1)

// Testar com client original
await __supabase_original.from('mesas').select('id,numero,codigo_empresa').eq('codigo_empresa', 1004).limit(1)
```

Se wrapper retornar dados: ✅ problema resolvido
Se wrapper travar mas original funcionar: ❌ problema no wrapper, investigar mais
Se ambos travarem: ❌ problema de RLS/permissão no banco

## LOGS ESPERADOS APÓS CORREÇÃO

### Sucesso (Wrapper Funcionando)
```
[Supabase Wrapper] Token obtido via getSession
[listMesas] Iniciando - codigo_empresa: 1004
[listMesas] Query montada, executando...
[Supabase Wrapper] fetch mesas OK (345ms)
[listMesas] ✅ Sucesso - 7 mesas carregadas
```

### Problema de Token
```
[Supabase Wrapper] getSession falhou ou timeout: ...
[Supabase Wrapper] ⚠️ Nenhum token encontrado - usando anon key
[listMesas] Iniciando - codigo_empresa: 1004
[listMesas] Query montada, executando...
[listMesas] ❌ EXCEPTION: listMesas timeout após 5s
```

### Problema de RLS
```
[Supabase Wrapper] Token obtido via localStorage
[listMesas] Iniciando - codigo_empresa: 1004
[listMesas] Query montada, executando...
[Supabase Wrapper] HTTP 401 (2345ms) - JWT expired
[listMesas] ❌ ERRO: {...}
```

## SE AINDA NÃO FUNCIONAR

### Verificar Token Manualmente
```javascript
// No console do f7arena.com
const { data } = await __supabase_original.auth.getSession()
console.log('Token:', data?.session?.access_token?.substring(0, 20))
console.log('User:', data?.session?.user?.email)
```

### Verificar RLS Direto no Banco
No SQL Editor do Supabase:
```sql
-- Ver políticas da tabela mesas
SELECT * FROM pg_policies WHERE tablename = 'mesas';

-- Ver políticas da tabela comandas
SELECT * FROM pg_policies WHERE tablename = 'comandas';
```

### Forçar Uso do Client Original (Bypass Wrapper)
Em `src/lib/supabase.js`, linha 46, trocar:
```javascript
export const supabase = import.meta.env.PROD ? {
```
Por:
```javascript
export const supabase = false ? {  // FORÇA CLIENT ORIGINAL
```

Isso usa o SDK oficial em produção (mais lento mas mais confiável).

## CONTATO SUPORTE SUPABASE

Se nada funcionar, abrir ticket com:
- Projeto: [seu-ref].supabase.co
- Problema: "Queries ficam pendentes/timeout em produção"
- Logs: colar logs do console
- Tabelas afetadas: mesas, comandas, comanda_itens

## RESUMO EXECUTIVO

**O que foi feito:**
- ✅ Wrapper com timeout e logs detalhados
- ✅ Funções críticas com timeout e diagnóstico
- ✅ Script SQL pronto para aplicar RLS

**O que fazer agora:**
1. Build + Deploy
2. Olhar logs no console (f7arena.com)
3. Aplicar SQL de RLS no Supabase
4. Testar queries no console do navegador
5. Compartilhar os logs comigo para análise final

**Tempo estimado:** 15-20 minutos
