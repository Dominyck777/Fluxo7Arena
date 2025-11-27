# 🚀 IMPLEMENTAÇÃO DE MELHORIAS NA LOJA

## ✅ O QUE FOI PREPARADO

### 1. **MIGRAÇÃO SQL** (Segura - Apenas ADD)
📁 `migrations/20251126_add_desconto_fields.sql`

**Campos adicionados:**
- ✅ `comanda_itens.desconto_tipo` - 'percentual' ou 'fixo'
- ✅ `comanda_itens.desconto_valor` - Valor do desconto
- ✅ `comanda_itens.desconto_motivo` - Motivo (ex: "Promoção")
- ✅ `comandas.desconto_tipo` - Desconto da comanda
- ✅ `comandas.desconto_valor` - Valor do desconto
- ✅ `comandas.desconto_motivo` - Motivo
- ✅ `comandas.observacoes` - Notas da comanda
- ✅ `comandas.observacoes_atualizadas_em` - Timestamp
- ✅ `comandas.vendedor_id` - Quem vendeu
- ✅ `comandas.comissao_percentual` - % de comissão
- ✅ `comandas.comissao_valor` - Valor da comissão
- ✅ `comandas.agendamento_id` - Agendamento vinculado
- ✅ `comandas.versao_sincronizacao` - Para Realtime
- ✅ `comandas.ultima_atualizacao` - Timestamp

**Tabelas criadas:**
- ✅ `comanda_historico` - Auditoria de alterações
- ✅ `estoque_reservado` - Lock pessimista de estoque

**Triggers criados:**
- ✅ `trigger_atualizar_ultima_atualizacao_comanda` - Auto-update timestamp
- ✅ `trigger_atualizar_ultima_atualizacao_item` - Sincroniza comanda
- ✅ `trigger_registrar_historico_comanda` - Registra mudanças

---

### 2. **FUNÇÕES BACKEND** (lib/store.js)
Adicionadas 15 novas funções:

#### **DESCONTOS**
```javascript
aplicarDescontoItem({ itemId, desconto_tipo, desconto_valor, desconto_motivo, codigoEmpresa })
aplicarDescontoComanda({ comandaId, desconto_tipo, desconto_valor, desconto_motivo, codigoEmpresa })
removerDescontoItem({ itemId, codigoEmpresa })
removerDescontoComanda({ comandaId, codigoEmpresa })
```

#### **OBSERVAÇÕES**
```javascript
adicionarObservacaoComanda({ comandaId, observacoes, codigoEmpresa })
```

#### **HISTÓRICO**
```javascript
registrarAlteracaoHistorico({ comandaId, tipo_alteracao, descricao, usuario_id, codigoEmpresa })
listarHistoricoComanda({ comandaId, codigoEmpresa })
```

#### **ESTOQUE RESERVADO**
```javascript
reservarEstoque({ comandaId, produto_id, quantidade, codigoEmpresa })
liberarEstoque({ reserva_id, codigoEmpresa })
listarEstoqueReservadoComanda({ comandaId, codigoEmpresa })
```

#### **VENDEDOR E COMISSÃO**
```javascript
vincularVendedorComanda({ comandaId, vendedor_id, comissao_percentual, codigoEmpresa })
```

#### **AGENDAMENTOS**
```javascript
vincularAgendamentoComanda({ comandaId, agendamento_id, codigoEmpresa })
```

---

## 📋 PRÓXIMOS PASSOS

### **PASSO 1: Executar Migração SQL**
```bash
# No Supabase SQL Editor, copie e execute:
# migrations/20251126_add_desconto_fields.sql
```

**Verificar:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'comandas' 
AND column_name LIKE 'desconto%';
```

---

### **PASSO 2: Implementar UI - Desconto por Item**

Criar componente `DescontoItemDialog.jsx`:

```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aplicarDescontoItem, removerDescontoItem } from '@/lib/store'
import { useState } from 'react'

export function DescontoItemDialog({ item, onApply, onClose, codigoEmpresa }) {
  const [tipo, setTipo] = useState(item.desconto_tipo || 'percentual')
  const [valor, setValor] = useState(item.desconto_valor || 0)
  const [motivo, setMotivo] = useState(item.desconto_motivo || '')
  const [loading, setLoading] = useState(false)
  
  const precoOriginal = item.preco_unitario * item.quantidade
  const precoComDesconto = tipo === 'percentual'
    ? precoOriginal * (1 - valor / 100)
    : precoOriginal - valor
  
  const handleAplicar = async () => {
    try {
      setLoading(true)
      await aplicarDescontoItem({
        itemId: item.id,
        desconto_tipo: tipo,
        desconto_valor: Number(valor),
        desconto_motivo: motivo || null,
        codigoEmpresa
      })
      onApply()
      onClose()
    } catch (err) {
      console.error('Erro ao aplicar desconto:', err)
      alert('Erro: ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleRemover = async () => {
    try {
      setLoading(true)
      await removerDescontoItem({ itemId: item.id, codigoEmpresa })
      onApply()
      onClose()
    } catch (err) {
      console.error('Erro ao remover desconto:', err)
      alert('Erro: ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desconto - {item.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <Label>Tipo de Desconto</Label>
            <div className="flex gap-2">
              <Button
                variant={tipo === 'percentual' ? 'default' : 'outline'}
                onClick={() => setTipo('percentual')}
                disabled={loading}
              >
                Percentual (%)
              </Button>
              <Button
                variant={tipo === 'fixo' ? 'default' : 'outline'}
                onClick={() => setTipo('fixo')}
                disabled={loading}
              >
                Fixo (R$)
              </Button>
            </div>
          </div>
          
          {/* Valor */}
          <div>
            <Label>Valor {tipo === 'percentual' ? '(0-100)' : '(R$)'}</Label>
            <Input
              type="number"
              value={valor}
              onChange={(e) => setValor(Number(e.target.value))}
              placeholder="0"
              disabled={loading}
              min="0"
              max={tipo === 'percentual' ? 100 : undefined}
              step="0.01"
            />
          </div>
          
          {/* Motivo */}
          <div>
            <Label>Motivo</Label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full border rounded p-2"
              disabled={loading}
            >
              <option value="">Selecione...</option>
              <option value="Promoção">Promoção</option>
              <option value="Meia entrada">Meia entrada</option>
              <option value="Cortesia">Cortesia</option>
              <option value="Ajuste">Ajuste</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          
          {/* Preview */}
          <div className="bg-surface-2 p-3 rounded space-y-1">
            <div className="flex justify-between text-sm">
              <span>Original:</span>
              <span>R$ {precoOriginal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-destructive">
              <span>Desconto:</span>
              <span>-R$ {(precoOriginal - precoComDesconto).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1">
              <span>Total:</span>
              <span>R$ {Math.max(0, precoComDesconto).toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {item.desconto_valor > 0 && (
            <Button variant="destructive" onClick={handleRemover} disabled={loading}>
              Remover Desconto
            </Button>
          )}
          <Button onClick={handleAplicar} disabled={loading}>
            {loading ? 'Aplicando...' : 'Aplicar Desconto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### **PASSO 3: Integrar no OrderPanel (VendasPage.jsx)**

Adicionar no estado:
```jsx
const [selectedItemForDesconto, setSelectedItemForDesconto] = useState(null)
const [isDescontoDialogOpen, setIsDescontoDialogOpen] = useState(false)
```

Adicionar no JSX (dentro do map de itens):
```jsx
<Button
  size="sm"
  variant="ghost"
  onClick={() => {
    setSelectedItemForDesconto(item)
    setIsDescontoDialogOpen(true)
  }}
  className="text-xs"
>
  {item.desconto_valor > 0 ? (
    <span className="text-destructive font-semibold">
      -{item.desconto_tipo === 'percentual' ? item.desconto_valor + '%' : 'R$' + item.desconto_valor.toFixed(2)}
    </span>
  ) : (
    'Desconto'
  )}
</Button>
```

Adicionar componente:
```jsx
{selectedItemForDesconto && (
  <DescontoItemDialog
    item={selectedItemForDesconto}
    onApply={() => {
      // Recarregar itens da comanda
      refreshTablesLight({ showToast: false })
    }}
    onClose={() => {
      setSelectedItemForDesconto(null)
      setIsDescontoDialogOpen(false)
    }}
    codigoEmpresa={userProfile?.codigo_empresa}
  />
)}
```

---

### **PASSO 4: Desconto na Comanda Inteira**

Adicionar botão antes do "Fechar Conta":
```jsx
<Button
  size="sm"
  variant="outline"
  onClick={() => setIsDescontoComandaOpen(true)}
  className="w-full mb-2"
>
  {selectedTable?.desconto_valor > 0 ? (
    <>
      Desconto: -{selectedTable.desconto_tipo === 'percentual' 
        ? selectedTable.desconto_valor + '%' 
        : 'R$' + selectedTable.desconto_valor.toFixed(2)}
    </>
  ) : (
    'Aplicar Desconto na Comanda'
  )}
</Button>
```

---

### **PASSO 5: Observações**

Adicionar campo de observações:
```jsx
<div className="p-3 border-t">
  <Label className="text-xs">Observações</Label>
  <textarea
    className="w-full border rounded p-2 text-sm"
    placeholder="Ex: sem cebola, urgente, etc."
    value={selectedTable?.observacoes || ''}
    onChange={(e) => {
      adicionarObservacaoComanda({
        comandaId: selectedTable.comandaId,
        observacoes: e.target.value,
        codigoEmpresa: userProfile?.codigo_empresa
      })
    }}
    rows="3"
  />
</div>
```

---

## 🔧 CÁLCULO DE TOTAIS

Função auxiliar para calcular total com descontos:

```javascript
export function calcularTotalComDescontos(items, descontoComanda) {
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
  if (descontoComanda?.desconto_tipo === 'percentual') {
    total *= (1 - descontoComanda.desconto_valor / 100)
  } else if (descontoComanda?.desconto_tipo === 'fixo') {
    total -= descontoComanda.desconto_valor
  }
  
  return {
    subtotal,
    descontoItens: items.reduce((sum, item) => {
      let desc = 0
      if (item.desconto_tipo === 'percentual') {
        desc = (item.preco_unitario * item.quantidade) * (item.desconto_valor / 100)
      } else if (item.desconto_tipo === 'fixo') {
        desc = item.desconto_valor
      }
      return sum + desc
    }, 0),
    descontoComanda: subtotal - total,
    total: Math.max(0, total)
  }
}
```

---

## 🧪 TESTES

### Testar Desconto por Item
1. Abrir mesa
2. Adicionar produto
3. Clicar em "Desconto"
4. Selecionar "Percentual" e digitar "10"
5. Verificar se total atualiza

### Testar Desconto na Comanda
1. Abrir mesa com 2+ itens
2. Clicar em "Aplicar Desconto na Comanda"
3. Selecionar "Fixo" e digitar "5.00"
4. Verificar se total final reduz

### Testar Observações
1. Abrir mesa
2. Digitar observação
3. Fechar e reabrir mesa
4. Verificar se observação persiste

---

## 📊 ESTRUTURA DE DADOS

### Comanda com Desconto
```json
{
  "id": 123,
  "desconto_tipo": "percentual",
  "desconto_valor": 10,
  "desconto_motivo": "Promoção",
  "observacoes": "sem cebola",
  "vendedor_id": "uuid-123",
  "comissao_percentual": 5,
  "agendamento_id": "uuid-456",
  "versao_sincronizacao": 5,
  "ultima_atualizacao": "2025-11-26T10:00:00Z"
}
```

### Item com Desconto
```json
{
  "id": 456,
  "comanda_id": 123,
  "produto_id": "uuid-789",
  "quantidade": 2,
  "preco_unitario": 15.00,
  "desconto_tipo": "percentual",
  "desconto_valor": 10,
  "desconto_motivo": "Meia entrada"
}
```

---

## ⚠️ IMPORTANTE

- ✅ **Migração é segura** - Apenas ADD, sem ALTER destrutivo
- ✅ **Compatível com sistema em uso** - Campos opcionais com DEFAULT
- ✅ **Sem breaking changes** - Código existente continua funcionando
- ✅ **Triggers automáticos** - Histórico registrado automaticamente
- ⚠️ **Executar migração ANTES de usar novas funções**

---

## 📞 SUPORTE

Se encontrar erros:
1. Verificar se migração foi executada
2. Verificar console do navegador (F12)
3. Verificar logs do Supabase
4. Testar com dados simples primeiro

---

**Status:** ✅ Pronto para implementação
**Data:** 2025-11-26
**Versão:** 1.0
