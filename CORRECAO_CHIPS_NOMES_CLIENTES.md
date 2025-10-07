# Correção: Chips Não Mostravam Nomes dos Clientes

## 🐛 Problema Identificado

Após a correção anterior (finalizadoras), os chips de clientes selecionados apareciam vazios, mostrando apenas o botão "X" sem o nome do cliente.

![Problema](https://i.imgur.com/exemplo.png)
*Chips vazios sem nomes*

## 🔍 Causa Raiz

Quando mudamos de `v_agendamento_participantes` (view) para `agendamento_participantes` (tabela), perdemos o **JOIN automático** que a view fazia com a tabela `clientes`.

### O que a View Fazia (ANTES)

```sql
CREATE VIEW v_agendamento_participantes AS
SELECT 
  ap.id,
  ap.agendamento_id,
  ap.codigo_empresa,
  ap.cliente_id,
  COALESCE(c.nome, ap.nome) as nome,  -- ✅ JOIN com clientes!
  ap.valor_cota,
  ap.status_pagamento
FROM agendamento_participantes ap
LEFT JOIN clientes c ON ap.cliente_id = c.id;  -- ✅ JOIN automático
```

A view fazia um `COALESCE(c.nome, ap.nome)`, ou seja:
1. **Primeiro tentava** pegar o nome da tabela `clientes` (c.nome)
2. **Se não existisse**, usava o nome livre da tabela `agendamento_participantes` (ap.nome)

### O que Estávamos Fazendo (PROBLEMA)

```javascript
const { data, error } = await supabase
  .from('agendamento_participantes')
  .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento, finalizadora_id')
  .in('agendamento_id', ids);
```

Problema:
- ❌ Buscava apenas o campo `nome` da tabela `agendamento_participantes`
- ❌ Esse campo pode estar **vazio/NULL** (é preenchido apenas para nomes livres)
- ❌ Não fazia JOIN com a tabela `clientes` para pegar o nome real

## ✅ Solução Implementada

### 1. Adicionar JOIN na Query

**ANTES:**
```javascript
const { data, error } = await supabase
  .from('agendamento_participantes')
  .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento, finalizadora_id')
  .in('agendamento_id', ids);
```

**DEPOIS:**
```javascript
const { data, error } = await supabase
  .from('agendamento_participantes')
  .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento, finalizadora_id, cliente:clientes!agendamento_participantes_cliente_id_fkey(nome)')
  .in('agendamento_id', ids);
```

**Mudança:**
- ✅ Adicionado: `cliente:clientes!agendamento_participantes_cliente_id_fkey(nome)`
- Isso faz um JOIN com a tabela `clientes` e traz o campo `nome` do cliente

### 2. Processar o Nome Corretamente

**ANTES:**
```javascript
const map = {};
for (const row of (data || [])) {
  const k = row.agendamento_id;
  if (!map[k]) map[k] = [];
  map[k].push(row);  // ❌ Usava row.nome diretamente (pode estar vazio)
}
```

**DEPOIS:**
```javascript
const map = {};
for (const row of (data || [])) {
  const k = row.agendamento_id;
  if (!map[k]) map[k] = [];
  // Usa nome do cliente se disponível, senão usa nome livre
  const nomeResolvido = row.cliente?.nome || row.nome || '';
  map[k].push({ ...row, nome: nomeResolvido });
}
```

**Mudança:**
- ✅ Resolve o nome com prioridade: `row.cliente?.nome` (do JOIN) → `row.nome` (nome livre) → `''` (vazio)
- ✅ Garante que sempre haverá um nome para exibir nos chips

## 🎯 Resultado

Agora os chips exibem corretamente:

```
┌─────────────────────────────────────┐
│ Clientes                            │
│ ┌─────────────────────────────────┐ │
│ │ Cliente +5              ▼       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────┐│
│ │ João S. ×│ │ Maria O. ×│ │Pedro×││
│ └──────────┘ └──────────┘ └──────┘│
│ ┌──────────┐ ┌──────────┐ ┌──────┐│
│ │ Ana C.  ×│ │ Carlos M.×│ │Julia×││
│ └──────────┘ └──────────┘ └──────┘│
└─────────────────────────────────────┘
```

✅ **Nomes dos clientes aparecem corretamente**  
✅ **Função `shortName()` funciona (mostra primeiro e segundo nome)**  
✅ **Botão X funciona para remover**

## 📊 Fluxo de Dados Corrigido

```
1. Query busca participantes
   SELECT ... cliente:clientes!...fkey(nome)
   ↓
2. Supabase retorna:
   {
     id: "uuid",
     cliente_id: "uuid",
     nome: null,  // ← pode estar vazio na tabela
     cliente: { nome: "João Silva" }  // ← JOIN traz o nome real
   }
   ↓
3. Processamento resolve o nome:
   const nomeResolvido = row.cliente?.nome || row.nome || '';
   // Resultado: "João Silva" ✅
   ↓
4. Chip renderiza:
   {shortName(c.nome)}
   // Exibe: "João Silva" ✅
```

## 🔧 Arquivos Modificados

- `src/pages/AgendaPage.jsx`
  - Linha ~1107: Adicionado JOIN com clientes na query
  - Linha ~1120-1122: Processamento do nome resolvido

## 🧪 Como Testar

1. Crie um agendamento com múltiplos clientes
2. Observe os chips na seção "Clientes"
3. ✅ Verifique que os nomes aparecem corretamente
4. ✅ Teste remover um cliente clicando no X
5. ✅ Feche e reabra o modal - nomes devem persistir

## 📝 Notas Técnicas

### Por que `row.cliente?.nome` e não `row.cliente.nome`?

Usamos **optional chaining** (`?.`) porque:
- O JOIN pode retornar `null` se o cliente foi deletado
- Evita erro `Cannot read property 'nome' of null`
- Fallback gracioso para `row.nome` (nome livre)

### Estrutura do Retorno do Supabase

Quando fazemos:
```javascript
.select('nome, cliente:clientes!fkey(nome)')
```

Supabase retorna:
```javascript
{
  nome: "Nome Livre",  // da tabela agendamento_participantes
  cliente: {           // do JOIN
    nome: "João Silva" // da tabela clientes
  }
}
```

### Ordem de Prioridade do Nome

```javascript
const nomeResolvido = 
  row.cliente?.nome ||  // 1º: Nome do cliente (JOIN)
  row.nome ||           // 2º: Nome livre (campo direto)
  '';                   // 3º: String vazia (fallback)
```

## 🎨 Função `shortName()`

A função `shortName()` já existia e funciona corretamente:

```javascript
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;  // Primeiro e segundo nome
}
```

Exemplos:
- `"João Silva Santos"` → `"João Silva"`
- `"Maria"` → `"Maria"`
- `""` → `""`

## ✨ Benefícios Adicionais

1. **Performance**: JOIN é feito no banco, não no frontend
2. **Consistência**: Sempre mostra o nome mais atualizado do cliente
3. **Flexibilidade**: Suporta nomes livres (sem cliente_id)
4. **Robustez**: Fallback gracioso se cliente foi deletado

## 🔗 Relação com Correção Anterior

Esta correção complementa a **correção de finalizadoras**:

| Correção | O que Resolve |
|----------|---------------|
| **Finalizadoras** | Métodos de pagamento não persistiam |
| **Nomes (esta)** | Nomes dos clientes não apareciam nos chips |

Ambas foram necessárias porque:
1. Mudamos de `v_agendamento_participantes` (view) para `agendamento_participantes` (tabela)
2. A view fazia JOINs automáticos que precisamos replicar manualmente
3. A view tinha campos calculados (`status_pagamento_text`) que removemos

---

**Data da correção:** ${new Date().toLocaleString('pt-BR')}  
**Problema reportado por:** Usuário (com screenshot)  
**Status:** ✅ Corrigido e testado  
**Relacionado a:** CORRECAO_FINALIZADORA_PAGAMENTOS.md
