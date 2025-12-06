# Correção: Persistência de Configurações da Agenda em Produção

## 🐛 Problema Identificado

As configurações de automação da agenda (confirmação automática, início automático, finalização automática) **não persistiam após reload** na versão do Vercel, mas funcionavam corretamente em desenvolvimento local.

## 🔍 Causa Raiz

O **Supabase Fetch Wrapper** (usado em produção para contornar bugs de minificação) não tinha implementado o método `.maybeSingle()`, que é usado para carregar as configurações existentes.

### Fluxo do Problema:

1. **DEV (npm run dev)**: Usa client original do Supabase → `.maybeSingle()` funciona ✅
2. **PROD (Vercel)**: Usa wrapper customizado → `.maybeSingle()` não existia ❌

```javascript
// Código que falhava em produção:
const { data, error } = await supabase
  .from('agenda_settings')
  .select('*')
  .eq('empresa_id', company.id)
  .maybeSingle(); // ❌ Método não implementado no wrapper
```

## ✅ Solução Implementada

### 1. Adicionado método `.maybeSingle()` no Wrapper

**Arquivo**: `src/lib/supabase-fetch-wrapper.js`

```javascript
// Adicionado na classe SupabaseQueryBuilder (linha 189-193)
maybeSingle() {
  this.params.limit = 1
  this.isMaybeSingle = true
  return this
}
```

### 2. Atualizada lógica de processamento

```javascript
// Atualizado em ambos os métodos `then()` (linhas 206-209 e 266-269)
if (this.isMaybeSingle && result.data) {
  // maybeSingle retorna null se não encontrar, não lança erro
  result.data = result.data[0] || null
}
```

### 3. Adicionados logs detalhados para debug

**Arquivo**: `src/pages/AgendaPage.jsx`

#### No carregamento (linhas 400-410):
```javascript
console.log('[AgendaSettings][LOAD] Modo:', import.meta.env.PROD ? 'PRODUÇÃO (wrapper)' : 'DEV (client original)');
console.log('[AgendaSettings][LOAD] Buscando para empresa_id:', company.id);
console.log('[AgendaSettings][LOAD] Data type:', data === null ? 'null' : typeof data);
```

#### No salvamento (linhas 536-546):
```javascript
console.log('[AgendaSettings][SAVE] Modo:', import.meta.env.PROD ? 'PRODUÇÃO (wrapper)' : 'DEV (client original)');
console.log('[AgendaSettings][SAVE] Supabase client type:', typeof supabase.from);
console.log('[AgendaSettings][SAVE] Data type:', Array.isArray(data) ? 'array' : typeof data);
console.log('[AgendaSettings][SAVE] Data length:', data?.length);
```

## 📊 Diferença entre `.single()` e `.maybeSingle()`

### `.single()`
- Espera **exatamente 1 resultado**
- Lança **erro** se não encontrar nada
- Lança **erro** se encontrar múltiplos resultados

### `.maybeSingle()`
- Espera **0 ou 1 resultado**
- Retorna **null** se não encontrar (sem erro)
- Lança **erro** apenas se encontrar múltiplos resultados

## 🔧 Arquivos Modificados

1. **`src/lib/supabase-fetch-wrapper.js`**
   - Adicionado método `.maybeSingle()` (linhas 189-193)
   - Atualizada lógica de processamento em `SupabaseQueryBuilder.then()` (linhas 206-209)
   - Atualizada lógica de processamento em `SupabaseModifyBuilder.then()` (linhas 266-269)

2. **`src/pages/AgendaPage.jsx`**
   - Adicionados logs detalhados no carregamento (linhas 400-410)
   - Adicionados logs detalhados no salvamento (linhas 536-546)

## 🧪 Como Testar

### Em Desenvolvimento (Local):
```bash
npm run dev -- --host
```
1. Abrir modal de configurações da agenda
2. Ativar "Confirmação automática"
3. Clicar em "Salvar"
4. Recarregar página (F5)
5. Verificar se configuração persiste ✅

### Em Produção (Vercel):
1. Fazer deploy das mudanças
2. Acessar aplicação no Vercel
3. Repetir passos acima
4. Verificar console para logs detalhados
5. Confirmar que configuração persiste ✅

## 📋 Logs Esperados no Console

### Ao Carregar Página:
```
[AgendaSettings][LOAD] Iniciando carregamento...
[AgendaSettings][LOAD] Modo: PRODUÇÃO (wrapper)
[AgendaSettings][LOAD] Buscando para empresa_id: 123
[AgendaSettings][LOAD] Resultado da query: { data: {...}, error: null }
[AgendaSettings][LOAD] Data type: object
[AgendaSettings][LOAD] ✅ Registro encontrado: {...}
[AgendaSettings][LOAD] ✅ Estado mapeado: {...}
[AgendaSettings][LOAD] ✅ Estados atualizados com sucesso!
```

### Ao Salvar Configurações:
```
[AgendaSettings][SAVE] FUNÇÃO CHAMADA!
[AgendaSettings][SAVE] ✅ Autenticado! Preparando payload...
[AgendaSettings][SAVE] Payload preparado: {...}
[AgendaSettings][SAVE] Modo: PRODUÇÃO (wrapper)
[AgendaSettings][SAVE] Supabase client type: function
[AgendaSettings][SAVE] Resultado do upsert: { data: [...], error: null }
[AgendaSettings][SAVE] Data type: array
[AgendaSettings][SAVE] Data length: 1
[AgendaSettings][SAVE] ✅ Dados salvos com sucesso: {...}
[AgendaSettings][SAVE] ✅ Salvamento concluído!
```

## ✅ Status

**RESOLVIDO** - O método `.maybeSingle()` foi implementado no wrapper e as configurações agora devem persistir corretamente em produção.

## 🔄 Próximos Passos

1. Fazer commit das mudanças
2. Deploy no Vercel
3. Testar em produção
4. Verificar logs no console
5. Confirmar persistência das configurações

---

**Data**: 14/10/2025
**Versão**: 1.0.0
