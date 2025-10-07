# Correção: Finalizadora não Persistia ao Reabrir Modal de Pagamentos

## 🐛 Problema Identificado

Ao editar um agendamento e definir finalizadoras (métodos de pagamento) para cada participante, ao salvar e reabrir o modal, os selects voltavam para "Dinheiro" (padrão) ao invés de mostrar a finalizadora que foi realmente salva no banco de dados.

## 🔍 Causa Raiz

A aplicação estava usando a **view** `v_agendamento_participantes` para carregar os participantes dos agendamentos. Porém, essa view **não inclui o campo `finalizadora_id`**.

### Estrutura da View (ANTES)
```sql
CREATE VIEW v_agendamento_participantes AS
SELECT 
  ap.id,
  ap.agendamento_id,
  ap.codigo_empresa,
  ap.cliente_id,
  COALESCE(c.nome, ap.nome) as nome,
  ap.valor_cota,
  ap.status_pagamento,
  CASE 
    WHEN ap.status_pagamento = 'Pago' THEN 'Pago'
    WHEN ap.status_pagamento = 'Parcial' THEN 'Parcial'
    WHEN ap.status_pagamento = 'Cancelado' THEN 'Cancelado'
    ELSE 'Pendente'
  END as status_pagamento_text
FROM agendamento_participantes ap
LEFT JOIN clientes c ON ap.cliente_id = c.id;
```

**Campos faltantes na view:**
- ❌ `finalizadora_id` (campo crítico para o problema)
- ❌ `pago_em`
- ❌ `metodo_pagamento`

## ✅ Solução Implementada

Mudamos a query para buscar **diretamente da tabela** `agendamento_participantes` ao invés da view, incluindo explicitamente o campo `finalizadora_id`.

### Mudanças no Código

#### 1. Carregamento de Participantes (Linha ~1106)

**ANTES:**
```javascript
const { data, error } = await supabase
  .from('v_agendamento_participantes')
  .select('*')
  .in('agendamento_id', ids);
```

**DEPOIS:**
```javascript
const { data, error } = await supabase
  .from('agendamento_participantes')
  .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento, finalizadora_id')
  .in('agendamento_id', ids);
```

#### 2. Carregamento ao Salvar Pagamentos (Linha ~4457)

**ANTES:**
```javascript
const { data: freshParts, error: freshErr } = await supabase
  .from('v_agendamento_participantes')
  .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento_text')
  .eq('codigo_empresa', codigo)
  .eq('agendamento_id', agendamentoId);
```

**DEPOIS:**
```javascript
const { data: freshParts, error: freshErr } = await supabase
  .from('agendamento_participantes')
  .select('id, agendamento_id, codigo_empresa, cliente_id, nome, valor_cota, status_pagamento, finalizadora_id')
  .eq('codigo_empresa', codigo)
  .eq('agendamento_id', agendamentoId);
```

#### 3. Uso do Campo `status_pagamento` Diretamente

**ANTES:**
```javascript
const paidCount = participants.filter(p => 
  (p.status_pagamento_text || '').toLowerCase() === 'pago'
).length;
```

**DEPOIS:**
```javascript
const paidCount = participants.filter(p => 
  String(p.status_pagamento || '').toLowerCase() === 'pago'
).length;
```

#### 4. Mapeamento ao Carregar Participantes (Linha ~2714)

**ANTES:**
```javascript
status_pagamento: p.status_pagamento_text || 'Pendente',
```

**DEPOIS:**
```javascript
status_pagamento: p.status_pagamento || 'Pendente',
```

#### 5. Remoção de Campo Redundante ao Criar Participantes (Linha ~2550)

**ANTES:**
```javascript
const participantsForState = rows.map(row => ({
  agendamento_id: row.agendamento_id,
  cliente_id: row.cliente_id,
  nome: form.selectedClients.find(c => c.id === row.cliente_id)?.nome || '',
  valor_cota: row.valor_cota,
  status_pagamento: row.status_pagamento,
  status_pagamento_text: 'Pendente'  // ❌ Redundante
}));
```

**DEPOIS:**
```javascript
const participantsForState = rows.map(row => ({
  agendamento_id: row.agendamento_id,
  cliente_id: row.cliente_id,
  nome: form.selectedClients.find(c => c.id === row.cliente_id)?.nome || '',
  valor_cota: row.valor_cota,
  status_pagamento: row.status_pagamento
}));
```

## 🎯 Resultado

Agora, ao editar um agendamento e abrir o modal de pagamentos:

✅ **Os selects de finalizadora mostram corretamente o método salvo** (PIX, Dinheiro, Cartão, etc.)  
✅ **O campo `finalizadora_id` é carregado do banco de dados**  
✅ **O status de pagamento é lido diretamente do enum `status_pagamento`**  
✅ **Não há mais dependência de campos calculados da view**

## 📊 Fluxo Corrigido

```
1. Usuário abre agendamento para editar
   ↓
2. Sistema busca participantes de agendamento_participantes
   SELECT id, agendamento_id, cliente_id, nome, 
          valor_cota, status_pagamento, finalizadora_id ✅
   ↓
3. Modal carrega com finalizadoras corretas
   - João: PIX ✅
   - Maria: Dinheiro ✅
   - Pedro: Cartão Crédito ✅
   ↓
4. Usuário pode alterar e salvar
   ↓
5. Ao reabrir, finalizadoras persistem corretamente ✅
```

## 🔧 Arquivos Modificados

- `src/pages/AgendaPage.jsx`
  - Linha ~1106: Query de carregamento de participantes
  - Linha ~1394: Filtro de contagem de pagos
  - Linha ~2550: Criação de participantes no estado
  - Linha ~2714: Mapeamento ao carregar para edição
  - Linha ~4457: Query ao salvar pagamentos

## 🧪 Como Testar

1. Crie um agendamento com múltiplos participantes
2. Abra o modal de pagamentos
3. Defina finalizadoras diferentes para cada participante:
   - Participante 1: PIX
   - Participante 2: Dinheiro
   - Participante 3: Cartão de Crédito
4. Salve o agendamento
5. **Reabra o agendamento para editar**
6. ✅ Verifique que os selects mostram as finalizadoras corretas

## 📝 Notas Técnicas

### Por que não corrigimos a View?

Optamos por buscar diretamente da tabela ao invés de alterar a view por:

1. **Menor impacto**: Não afeta outras partes do sistema que possam usar a view
2. **Controle explícito**: Sabemos exatamente quais campos estamos buscando
3. **Performance**: Menos overhead de view (embora mínimo)
4. **Flexibilidade**: Podemos adicionar/remover campos conforme necessário

### Alternativa (se preferir usar View)

Se quiser manter o uso da view, seria necessário alterá-la para incluir `finalizadora_id`:

```sql
CREATE OR REPLACE VIEW v_agendamento_participantes AS
SELECT 
  ap.id,
  ap.agendamento_id,
  ap.codigo_empresa,
  ap.cliente_id,
  COALESCE(c.nome, ap.nome) as nome,
  ap.valor_cota,
  ap.status_pagamento,
  ap.finalizadora_id,  -- ✅ Adicionar este campo
  ap.pago_em,          -- ✅ Opcional: adicionar também
  CASE 
    WHEN ap.status_pagamento = 'Pago' THEN 'Pago'
    WHEN ap.status_pagamento = 'Parcial' THEN 'Parcial'
    WHEN ap.status_pagamento = 'Cancelado' THEN 'Cancelado'
    ELSE 'Pendente'
  END as status_pagamento_text
FROM agendamento_participantes ap
LEFT JOIN clientes c ON ap.cliente_id = c.id;
```

## ✨ Benefícios Adicionais

Além de corrigir o bug, as mudanças também:

1. **Simplificaram o código**: Uso direto de `status_pagamento` ao invés de `status_pagamento_text`
2. **Melhoraram a consistência**: Todos os lugares agora usam o mesmo campo
3. **Reduziram redundância**: Removemos campos calculados desnecessários
4. **Facilitam manutenção**: Menos dependências de views

---

**Data da correção:** ${new Date().toLocaleString('pt-BR')}  
**Problema reportado por:** Usuário  
**Status:** ✅ Corrigido e testado
