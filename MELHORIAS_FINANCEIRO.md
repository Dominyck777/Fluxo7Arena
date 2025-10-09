# 📊 Melhorias Planejadas - Página Financeiro

## 🎯 Objetivo
Integrar completamente os **pagamentos de agendamentos** no módulo financeiro, que atualmente só mostra dados de **comandas**.

---

## 🐛 Correções Necessárias

### 1. Remover Card "Descontos" da Visão Geral
**Localização:** `FinanceiroPage.jsx` - Linha 542  
**Motivo:** O sistema não trabalha com descontos, então este KPI sempre mostra R$ 0,00  
**Ação:**
- Remover o KpiCard de "Descontos"
- Ajustar o grid de 4 colunas para 3 colunas
- Manter apenas: **Vendas Brutas**, **Vendas Líquidas**, **Entradas**

```jsx
// ANTES (4 cards)
<motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <KpiCard icon={TrendingUp} label="Vendas Brutas" ... />
  <KpiCard icon={CreditCard} label="Descontos" ... /> ❌ REMOVER
  <KpiCard icon={TrendingUp} label="Vendas Líquidas" ... />
  <KpiCard icon={Wallet} label="Entradas" ... />
</motion.div>

// DEPOIS (3 cards)
<motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <KpiCard icon={TrendingUp} label="Vendas Brutas" ... />
  <KpiCard icon={TrendingUp} label="Vendas Líquidas" ... />
  <KpiCard icon={Wallet} label="Entradas" ... />
</motion.div>
```

---

## ✨ Novas Funcionalidades

### 2. Nova Aba: "Agendamentos"
**Objetivo:** Mostrar todos os pagamentos de agendamentos de forma detalhada

#### Estrutura da Aba:
```jsx
<TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
```

#### Dados a Exibir:
- **Data/Hora:** Data do início do agendamento
- **Código:** Código do agendamento (#001, #002, etc)
- **Quadra:** Nome da quadra
- **Participante:** Nome do cliente/participante
- **Valor:** Valor da cota pago
- **Finalizadora:** Método de pagamento usado
- **Status:** Pago/Pendente/Cancelado

#### Query SQL:
```sql
SELECT 
  a.codigo AS agendamento_codigo,
  a.inicio AS data_agendamento,
  q.nome AS quadra_nome,
  ap.nome AS participante_nome,
  ap.valor_cota,
  ap.status_pagamento,
  f.nome AS finalizadora_nome,
  f.tipo AS finalizadora_tipo
FROM agendamentos a
LEFT JOIN quadras q ON a.quadra_id = q.id
LEFT JOIN agendamento_participantes ap ON a.id = ap.agendamento_id
LEFT JOIN finalizadoras f ON ap.finalizadora_id = f.id
WHERE a.codigo_empresa = :codigo
  AND ap.status_pagamento = 'Pago'
  AND a.inicio >= :data_inicio
  AND a.inicio <= :data_fim
ORDER BY a.inicio DESC
```

#### Filtros:
- 🔍 **Busca:** Por nome do participante, código do agendamento ou quadra
- 🎯 **Finalizadora:** Filtro por método de pagamento
- 📅 **Status:** Pago/Pendente/Todos

---

### 3. KPIs Separados por Origem
**Objetivo:** Separar métricas de Comandas vs Agendamentos

#### Layout Proposto:
```
┌────────────────────────┬────────────────────────┬────────────────────────┐
│   💰 Total Geral       │  🏪 Comandas           │  🏟️ Agendamentos       │
│   R$ 15.420,00         │  R$ 8.320,00           │  R$ 7.100,00           │
└────────────────────────┴────────────────────────┴────────────────────────┘
```

#### Dados Necessários:
```javascript
// Estado
const [receitaComan das, setReceitaComandas] = useState(0);
const [receitaAgendamentos, setReceitaAgendamentos] = useState(0);

// Cálculo
const totalGeral = receitaComandas + receitaAgendamentos;
```

#### Implementação:
1. **Comandas:** Usar query existente da tabela `pagamentos`
2. **Agendamentos:** Query na tabela `agendamento_participantes` com `status_pagamento = 'Pago'`

```sql
-- Receita de Agendamentos
SELECT SUM(valor_cota) as total
FROM agendamento_participantes
WHERE codigo_empresa = :codigo
  AND status_pagamento = 'Pago'
  AND created_at >= :data_inicio
  AND created_at <= :data_fim
```

---

### 4. Aba "Recebimentos" Unificada
**Objetivo:** Juntar pagamentos de Comandas + Agendamentos em uma única lista

#### Colunas da Tabela:
| Data/Hora | Origem | Descrição | Finalizadora | Valor | Status |
|-----------|--------|-----------|--------------|-------|--------|
| 09/10 15:30 | 🏟️ Agendamento | #49 - Gabriel (Quadra Norte) | PIX | R$ 20,00 | Pago |
| 09/10 14:20 | 🏪 Comanda | Mesa 5 - João Silva | Dinheiro | R$ 45,00 | Pago |

#### Estrutura dos Dados:
```javascript
const recebimentosUnificados = [
  {
    tipo: 'agendamento', // ou 'comanda'
    data: '2025-10-09T15:30:00',
    descricao: '#49 - Gabriel (Quadra Norte)',
    finalizadora: 'PIX',
    valor: 20.00,
    status: 'Pago'
  },
  {
    tipo: 'comanda',
    data: '2025-10-09T14:20:00',
    descricao: 'Mesa 5 - João Silva',
    finalizadora: 'Dinheiro',
    valor: 45.00,
    status: 'Pago'
  }
];
```

#### Queries Necessárias:
```javascript
// 1. Buscar pagamentos de comandas (já existe)
const { data: pagamentosComandas } = await supabase
  .from('pagamentos')
  .select('*, finalizadoras(nome)')
  .eq('codigo_empresa', codigo)
  .gte('recebido_em', dataInicio)
  .lte('recebido_em', dataFim);

// 2. Buscar pagamentos de agendamentos (NOVO)
const { data: pagamentosAgendamentos } = await supabase
  .from('v_agendamentos_detalhado') // usar a view criada
  .select('*')
  .eq('codigo_empresa', codigo)
  .eq('status_pagamento', 'Pago')
  .gte('inicio', dataInicio)
  .lte('inicio', dataFim);

// 3. Unificar e ordenar
const todosRecebimentos = [
  ...pagamentosComandas.map(p => ({ tipo: 'comanda', ...p })),
  ...pagamentosAgendamentos.map(p => ({ tipo: 'agendamento', ...p }))
].sort((a, b) => new Date(b.data) - new Date(a.data));
```

#### Badge de Origem:
```jsx
{recebimento.tipo === 'agendamento' ? (
  <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-600/20 text-purple-400">
    🏟️ Agendamento
  </span>
) : (
  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-600/20 text-blue-400">
    🏪 Comanda
  </span>
)}
```

---

### 5. Gráfico: Comandas vs Agendamentos
**Objetivo:** Mostrar proporção da receita entre as duas origens

#### Tipo: Pizza (PieChart)
```jsx
const dadosOrigem = [
  { name: 'Comandas', value: receitaComandas, fill: '#3b82f6' },
  { name: 'Agendamentos', value: receitaAgendamentos, fill: '#8b5cf6' }
];

<PieChart width={300} height={300}>
  <Pie data={dadosOrigem} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
    {dadosOrigem.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={entry.fill} />
    ))}
  </Pie>
  <Tooltip formatter={(v) => fmtBRL(v)} />
  <Legend />
</PieChart>
```

---

### 6. Top Clientes - Já Implementado ✅
**Status:** A visão geral já soma pagamentos de comandas + agendamentos  
**Localização:** `FinanceiroPage.jsx` - Linhas 262-312  
**Observação:** Funciona corretamente, não precisa de alteração

---

## 📋 Resumo das Alterações

### Arquivo: `FinanceiroPage.jsx`

#### Estados Novos:
```javascript
const [receitaComandas, setReceitaComandas] = useState(0);
const [receitaAgendamentos, setReceitaAgendamentos] = useState(0);
const [pagamentosAgendamentos, setPagamentosAgendamentos] = useState([]);
```

#### Funções Novas:
```javascript
// Carregar receita de agendamentos
const loadReceitaAgendamentos = async () => { ... };

// Carregar pagamentos de agendamentos para a aba
const loadPagamentosAgendamentos = async () => { ... };

// Unificar recebimentos
const loadRecebimentosUnificados = async () => { ... };
```

#### Componentes Novos:
1. Nova aba `<TabsTrigger value="agendamentos">`
2. KPI de receita por origem
3. Gráfico PieChart de proporção
4. Coluna "Origem" na tabela de recebimentos

---

## 🔧 Dependências

### View do Banco de Dados:
Usar a view `v_agendamentos_detalhado` criada no arquivo:
```
create_view_agendamentos_detalhado.sql
```

Esta view já fornece todos os dados necessários:
- ✅ Código do agendamento
- ✅ Data/hora
- ✅ Quadra
- ✅ Participante
- ✅ Valor
- ✅ Status de pagamento
- ✅ Finalizadora

---

## 📊 Layout Final das Tabs

```
┌─────────────────────────────────────────────────────────────┐
│  [Visão Geral] [Caixa] [Recebimentos] [Agendamentos] [Relatórios]  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist de Implementação

### Correções:
- [ ] Remover card "Descontos" da Visão Geral
- [ ] Ajustar grid de 4 para 3 colunas nos KPIs

### Novas Funcionalidades:
- [ ] Criar aba "Agendamentos"
- [ ] Implementar query de pagamentos de agendamentos
- [ ] Adicionar filtros (busca, finalizadora, status)
- [ ] Criar KPIs separados (Comandas vs Agendamentos)
- [ ] Implementar gráfico PieChart de proporção
- [ ] Unificar recebimentos (Comandas + Agendamentos)
- [ ] Adicionar coluna "Origem" com badges
- [ ] Testar filtros de data/período
- [ ] Validar cálculos de totais

### Testes:
- [ ] Verificar se os totais batem com o banco
- [ ] Testar filtros de data
- [ ] Verificar performance com muitos registros
- [ ] Validar formatação de valores (R$)
- [ ] Testar responsividade mobile

---

## 🎨 Cores Sugeridas

```javascript
const CORES = {
  comandas: '#3b82f6',      // Azul
  agendamentos: '#8b5cf6',  // Roxo
  total: '#fbbf24',         // Amarelo/Brand
  pago: '#22c55e',          // Verde
  pendente: '#f59e0b',      // Laranja
  cancelado: '#ef4444'      // Vermelho
};
```

---

## 📝 Notas Importantes

1. **Performance:** Para períodos longos, considerar paginação na aba de Agendamentos
2. **Cache:** Implementar cache local para evitar queries repetidas
3. **Export:** Adicionar botão "Exportar" para relatório CSV/Excel
4. **Real-time:** Considerar atualização automática quando houver novos pagamentos
5. **Filtros Avançados:** Adicionar filtro por quadra, modalidade, etc.

---

## 🚀 Prioridade de Implementação

1. **Alta:** Remover card "Descontos" ✅
2. **Alta:** Criar aba "Agendamentos" 🔥
3. **Média:** KPIs separados por origem
4. **Média:** Unificar recebimentos
5. **Baixa:** Gráfico PieChart de proporção

---

**Última atualização:** 09/10/2025  
**Responsável:** Dominyck  
**Status:** 📋 Documentado - Aguardando implementação
