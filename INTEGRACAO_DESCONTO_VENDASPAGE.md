# 🔧 INTEGRAÇÃO DE DESCONTO EM VendasPage.jsx

## 📋 PASSO 1: Importar Componentes

No topo de `VendasPage.jsx`, adicione:

```javascript
import { DescontoItemDialog } from '@/components/DescontoItemDialog'
import { DescontoComandaDialog } from '@/components/DescontoComandaDialog'
import { adicionarObservacaoComanda } from '@/lib/store'
```

---

## 📋 PASSO 2: Adicionar Estados

Dentro da função `VendasPage()`, após os outros `useState`, adicione:

```javascript
// Desconto de item
const [selectedItemForDesconto, setSelectedItemForDesconto] = useState(null)
const [isDescontoItemDialogOpen, setIsDescontoItemDialogOpen] = useState(false)

// Desconto de comanda
const [isDescontoComandaDialogOpen, setIsDescontoComandaDialogOpen] = useState(false)
```

---

## 📋 PASSO 3: Modificar OrderPanel

Encontre o componente `OrderPanel` (dentro do `return` de `VendasPage`).

### 3.1 - Adicionar Botão de Desconto na Comanda

Procure por onde está o botão "Fechar Conta" e adicione ANTES dele:

```jsx
{/* Desconto da Comanda */}
<Button
  size="sm"
  variant="outline"
  onClick={() => setIsDescontoComandaDialogOpen(true)}
  className="w-full mb-2 gap-2"
>
  {selectedTable?.desconto_valor > 0 ? (
    <>
      <span>Desconto:</span>
      <span className="text-destructive font-bold">
        -{selectedTable.desconto_tipo === 'percentual' 
          ? selectedTable.desconto_valor + '%' 
          : 'R$' + selectedTable.desconto_valor.toFixed(2)}
      </span>
    </>
  ) : (
    'Aplicar Desconto na Comanda'
  )}
</Button>
```

### 3.2 - Adicionar Campo de Observações

Procure pelo `return` do componente `OrderPanel` e adicione ANTES do fechamento:

```jsx
{/* Observações */}
<div className="p-3 border-t border-border">
  <Label className="text-xs font-semibold">Observações</Label>
  <textarea
    className="w-full border border-border rounded p-2 text-sm mt-1 resize-none"
    placeholder="Ex: sem cebola, urgente, etc."
    value={selectedTable?.observacoes || ''}
    onChange={(e) => {
      adicionarObservacaoComanda({
        comandaId: selectedTable.comandaId,
        observacoes: e.target.value,
        codigoEmpresa: userProfile?.codigo_empresa
      }).catch(err => console.error('Erro ao salvar observação:', err))
    }}
    rows="3"
  />
</div>
```

---

## 📋 PASSO 4: Modificar Itens da Comanda

Encontre onde os itens são renderizados (no map de `table.order`).

Procure pelo botão de remover item e adicione ANTES um botão de desconto:

```jsx
{/* Botão de Desconto */}
<Button
  size="sm"
  variant="ghost"
  onClick={() => {
    setSelectedItemForDesconto(item)
    setIsDescontoItemDialogOpen(true)
  }}
  className="text-xs h-7 px-2"
  title="Aplicar desconto neste item"
>
  {item.desconto_valor > 0 ? (
    <span className="text-destructive font-semibold">
      -{item.desconto_tipo === 'percentual' 
        ? item.desconto_valor + '%' 
        : 'R$' + item.desconto_valor.toFixed(2)}
    </span>
  ) : (
    'Desc'
  )}
</Button>
```

---

## 📋 PASSO 5: Adicionar Diálogos

No final do `return` de `VendasPage` (antes do fechamento), adicione:

```jsx
{/* Dialog de Desconto de Item */}
{selectedItemForDesconto && (
  <DescontoItemDialog
    item={selectedItemForDesconto}
    onApply={() => {
      // Recarregar itens da comanda
      refreshTablesLight({ showToast: false })
    }}
    onClose={() => {
      setSelectedItemForDesconto(null)
      setIsDescontoItemDialogOpen(false)
    }}
    codigoEmpresa={userProfile?.codigo_empresa}
  />
)}

{/* Dialog de Desconto de Comanda */}
{selectedTable && (
  <DescontoComandaDialog
    comanda={selectedTable}
    subtotal={calculateTotal(selectedTable.order || [])}
    onApply={() => {
      // Recarregar mesas
      refreshTablesLight({ showToast: false })
    }}
    onClose={() => setIsDescontoComandaDialogOpen(false)}
    codigoEmpresa={userProfile?.codigo_empresa}
  />
)}
```

---

## 📋 PASSO 6: Atualizar Cálculo de Total

Encontre a função `calculateTotal` e modifique para incluir descontos:

```javascript
const calculateTotalWithDiscount = (items, comanda) => {
  let subtotal = 0
  
  // Subtotal com descontos por item
  for (const item of items) {
    let valor = item.preco_unitario * item.quantidade
    
    if (item.desconto_tipo === 'percentual') {
      valor *= (1 - item.desconto_valor / 100)
    } else if (item.desconto_tipo === 'fixo') {
      valor -= item.desconto_valor
    }
    
    subtotal += Math.max(0, valor)
  }
  
  // Desconto da comanda
  let total = subtotal
  if (comanda?.desconto_tipo === 'percentual') {
    total *= (1 - comanda.desconto_valor / 100)
  } else if (comanda?.desconto_tipo === 'fixo') {
    total -= comanda.desconto_valor
  }
  
  return Math.max(0, total)
}
```

E use no lugar de `calculateTotal`:

```jsx
const total = calculateTotalWithDiscount(selectedTable?.order || [], selectedTable)
```

---

## 🎨 VISUAL ESPERADO

```
┌─ COMANDA - Mesa 5 ─────────────────────┐
│                                        │
│ Coca-cola 2L                           │
│ R$ 15.00 x 2 = R$ 30.00               │
│ [Desc] [-10%] = R$ 27.00              │
│                                        │
│ Cerveja 600ml                          │
│ R$ 8.00 x 3 = R$ 24.00                │
│ [Desc] [Sem desconto]                  │
│                                        │
│ ─────────────────────────────────────  │
│ Subtotal:           R$ 51.00           │
│ Desconto Itens:     -R$ 3.00           │
│ Subtotal:           R$ 48.00           │
│                                        │
│ [Aplicar Desconto na Comanda]          │
│ Desconto Comanda:   -5% = -R$ 2.40     │
│ ═════════════════════════════════════  │
│ TOTAL:              R$ 45.60           │
│                                        │
│ Observações:                           │
│ [sem cebola, urgente]                  │
│                                        │
│ [Fechar Conta] [Cancelar]              │
└────────────────────────────────────────┘
```

---

## ✅ CHECKLIST

- [ ] Importar componentes
- [ ] Adicionar estados
- [ ] Adicionar botão de desconto na comanda
- [ ] Adicionar campo de observações
- [ ] Adicionar botão de desconto nos itens
- [ ] Adicionar diálogos
- [ ] Atualizar cálculo de total
- [ ] Testar desconto por item
- [ ] Testar desconto na comanda
- [ ] Testar observações

---

## 🧪 TESTES

### Teste 1: Desconto por Item
1. Abrir mesa
2. Adicionar produto
3. Clicar em "Desc"
4. Selecionar "Percentual" e digitar "10"
5. Verificar se total atualiza

### Teste 2: Desconto na Comanda
1. Abrir mesa com 2+ itens
2. Clicar em "Aplicar Desconto na Comanda"
3. Selecionar "Fixo" e digitar "5.00"
4. Verificar se total final reduz

### Teste 3: Observações
1. Abrir mesa
2. Digitar observação
3. Fechar e reabrir mesa
4. Verificar se observação persiste

---

## 🐛 TROUBLESHOOTING

**Erro: "DescontoItemDialog is not defined"**
- Verificar se o import está correto
- Verificar se o arquivo existe em `src/components/`

**Desconto não aparece**
- Verificar se a migração SQL foi executada
- Verificar console do navegador (F12)

**Total não atualiza**
- Verificar se `calculateTotalWithDiscount` está sendo usado
- Verificar se `refreshTablesLight()` está sendo chamado

---

**Status:** Pronto para integração
**Data:** 2025-11-26
