# 📊 EXPLICAÇÃO DOS CARDS FINANCEIROS - VISÃO GERAL

## 🎯 DE ONDE VÊM OS DADOS DOS CARDS

Todos os 4 cards (KPIs) da aba **Visão Geral** são calculados pela função `listarResumoPeriodo()` que está no arquivo `src/lib/store.js`.

---

## 🔍 FLUXO DE DADOS DETALHADO

### **Função Principal:** `listarResumoPeriodo({ from, to, codigoEmpresa })`

Esta função faz 3 consultas principais ao banco:

```javascript
// 1️⃣ BUSCA COMANDAS FECHADAS NO PERÍODO
SELECT id, fechado_em 
FROM comandas 
WHERE status = 'closed'
  AND codigo_empresa = [sua_empresa]
  AND fechado_em BETWEEN [from] AND [to]
```

```javascript
// 2️⃣ BUSCA ITENS DESSAS COMANDAS
SELECT comanda_id, quantidade, preco_unitario, desconto
FROM comanda_itens
WHERE comanda_id IN [ids_das_comandas]
  AND codigo_empresa = [sua_empresa]
```

```javascript
// 3️⃣ BUSCA PAGAMENTOS DO PERÍODO
SELECT metodo, valor, recebido_em, status
FROM pagamentos
WHERE codigo_empresa = [sua_empresa]
  AND recebido_em BETWEEN [from] AND [to]
  AND status NOT IN ('Cancelado', 'Estornado')
```

---

## 💰 CÁLCULO DE CADA CARD

### **1. VENDAS BRUTAS** (Verde)
```javascript
// Soma de todos os itens vendidos (sem descontos)
totalVendasBrutas = 0

Para cada item em comanda_itens:
  valorBruto = item.quantidade × item.preco_unitario
  totalVendasBrutas += valorBruto

Exemplo:
- Item 1: 2 × R$ 10,00 = R$ 20,00
- Item 2: 1 × R$ 15,00 = R$ 15,00
- Item 3: 3 × R$ 8,00 = R$ 24,00
TOTAL VENDAS BRUTAS = R$ 59,00
```

**Fonte:** Tabela `comanda_itens` → campos `quantidade` e `preco_unitario`

---

### **2. DESCONTOS** (Amarelo/Laranja)
```javascript
// Soma de todos os descontos aplicados
totalDescontos = 0

Para cada item em comanda_itens:
  totalDescontos += item.desconto

Exemplo:
- Item 1: desconto R$ 2,00
- Item 2: desconto R$ 0,00
- Item 3: desconto R$ 1,00
TOTAL DESCONTOS = R$ 3,00
```

**Fonte:** Tabela `comanda_itens` → campo `desconto`

---

### **3. VENDAS LÍQUIDAS** (Azul/Brand)
```javascript
// Vendas Brutas menos Descontos
totalVendasLiquidas = totalVendasBrutas - totalDescontos

Exemplo:
R$ 59,00 (brutas) - R$ 3,00 (descontos) = R$ 56,00
```

**Cálculo:** Derivado dos dois anteriores

---

### **4. ENTRADAS** (Verde)
```javascript
// Soma de todos os pagamentos recebidos
totalEntradas = 0

Para cada pagamento em pagamentos:
  if (pagamento.status != 'Cancelado' && pagamento.status != 'Estornado'):
    totalEntradas += pagamento.valor
    
    // Também agrupa por finalizadora para o gráfico
    finalizadora = pagamento.metodo (ex: "PIX", "Dinheiro")
    porFinalizadora[finalizadora] += pagamento.valor

Exemplo:
- Pagamento 1: R$ 30,00 via PIX
- Pagamento 2: R$ 20,00 via Dinheiro
- Pagamento 3: R$ 6,00 via PIX
TOTAL ENTRADAS = R$ 56,00

Por Finalizadora:
- PIX: R$ 36,00
- Dinheiro: R$ 20,00
```

**Fonte:** Tabela `pagamentos` → campos `valor`, `metodo`, `status`

---

## 📊 GRÁFICO "ENTRADAS POR FINALIZADORA"

O gráfico mostra a distribuição dos pagamentos por método:

```javascript
// Dados do gráfico
finalizadoraChart = [
  { name: "PIX", valor: 36.00 },
  { name: "Dinheiro", valor: 20.00 },
  { name: "Cartão", valor: 0.00 }
]
```

**Cor:** Agora está **AMARELO** (#fbbf24) conforme solicitado!

**Tooltip:** Melhorado com borda amarela e fundo escuro para melhor visualização ao passar o mouse.

---

## ⚠️ DIFERENÇA IMPORTANTE

### **Por que Vendas Líquidas ≠ Entradas?**

```
VENDAS LÍQUIDAS = Quanto foi vendido (itens)
ENTRADAS = Quanto foi pago (dinheiro recebido)
```

**Podem ser diferentes porque:**
- ✅ Cliente pode pagar mais tarde (venda a prazo)
- ✅ Cliente pode pagar parcialmente
- ✅ Pode haver pagamentos de comandas antigas
- ✅ Pode haver suprimentos de caixa (não são vendas)

**Exemplo Real:**
- Vendas Líquidas: R$ 120,25 (vendido hoje)
- Entradas: R$ 167,05 (recebido hoje, incluindo pagamentos de ontem)

---

## 🎨 MELHORIAS APLICADAS

### ✅ **Gráfico Amarelo**
- Cor alterada de verde (#22c55e) para amarelo (#fbbf24)
- Melhor contraste e visualização

### ✅ **Tooltip Melhorado**
- Fundo escuro semi-transparente
- Borda amarela para destaque
- Padding aumentado para melhor legibilidade
- Agora não fica com espaço em branco grande

### ✅ **Top 5 Clientes**
- Mensagem "Em desenvolvimento" melhorada
- Ícone centralizado
- Texto explicativo mais claro

---

## 📅 FILTROS DE PERÍODO

Os filtros afetam **TODOS** os cards e gráficos:

- **Últimos 7 dias:** Hoje - 6 dias até hoje
- **Últimos 30 dias:** Hoje - 29 dias até hoje
- **Ano atual:** 01/01/2025 até hoje
- **Customizado:** Data início e fim que você escolher
- **Limpar:** Remove filtros (mostra tudo)

---

## 🔄 ATUALIZAÇÃO DOS DADOS

Os dados são recarregados automaticamente quando:
- ✅ Você muda o período (início/fim)
- ✅ Você clica nos botões de preset (7 dias, 30 dias, etc.)
- ✅ Você troca de aba
- ✅ A página é carregada pela primeira vez

---

## 🗂️ TABELAS DO BANCO ENVOLVIDAS

| Card | Tabelas Usadas | Campos Principais |
|------|----------------|-------------------|
| Vendas Brutas | `comanda_itens` | `quantidade`, `preco_unitario` |
| Descontos | `comanda_itens` | `desconto` |
| Vendas Líquidas | Cálculo | Brutas - Descontos |
| Entradas | `pagamentos` | `valor`, `metodo`, `status` |
| Gráfico | `pagamentos` | `valor`, `metodo` (agrupado) |

---

## 💡 DICAS DE USO

1. **Para ver vendas de hoje:** Deixe os filtros vazios ou clique em "Limpar"
2. **Para comparar períodos:** Anote os valores, mude o período e compare
3. **Para ver detalhes:** Vá na aba "Recebimentos" para ver cada pagamento individual
4. **Para conferir caixa:** Vá na aba "Caixa" para ver a sessão atual

---

## 🐛 OBSERVAÇÕES

- ⚠️ **Vendas Brutas/Líquidas:** Só contam comandas **fechadas** (finalizadas)
- ⚠️ **Entradas:** Conta pagamentos **recebidos** no período (pela data de recebimento)
- ⚠️ **Top 5 Clientes:** Ainda não implementado (mostra placeholder)
- ✅ **Gráfico:** Agora está amarelo e o tooltip não deixa espaço em branco

---

**Última Atualização:** 2025-10-08  
**Versão:** 1.1
