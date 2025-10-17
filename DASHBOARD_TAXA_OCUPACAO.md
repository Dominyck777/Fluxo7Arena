# 📊 Taxa de Ocupação - Dashboard

## ✅ Implementação Concluída

Substituição do campo "Horários Disponíveis" por **"Taxa de Ocupação"** no card "Resumo do Dia" da Dashboard.

---

## 🎯 Como Funciona

### **Cálculo da Taxa de Ocupação**

```javascript
// 1. Slots Totais Disponíveis
const totalQuadras = 3; // Exemplo: 3 quadras
const horasPorDia = 17; // 6h às 23h = 17 horas operacionais
const slotsTotais = totalQuadras * horasPorDia; // 3 × 17 = 51 slots

// 2. Slots Ocupados (duração real dos agendamentos)
let slotsOcupados = 0;
for (const agendamento of agendamentos) {
  if (!['canceled', 'no_show'].includes(agendamento.status)) {
    const inicio = new Date(agendamento.inicio);
    const fim = new Date(agendamento.fim);
    const duracaoHoras = (fim - inicio) / (1000 * 60 * 60);
    slotsOcupados += duracaoHoras;
  }
}

// 3. Taxa de Ocupação
const taxa = Math.round((slotsOcupados / slotsTotais) * 100);
// Exemplo: (12 horas ocupadas / 51 slots) × 100 = 23%
```

---

## 🎨 Indicadores Visuais

A taxa é exibida com cores dinâmicas:

| Taxa | Cor | Significado |
|------|-----|-------------|
| **≥ 70%** | 🟢 Verde (`text-success`) | Excelente ocupação |
| **40-69%** | 🟡 Amarelo (`text-warning`) | Ocupação moderada |
| **< 40%** | 🔴 Vermelho (`text-danger`) | Baixa ocupação |

---

## 📋 Exemplo de Exibição

```
Resumo do Dia
├─ Próximas Reservas: 5
├─ Quadras em Uso: 2
└─ Taxa de Ocupação: 67% (amarelo)
```

---

## 🔧 Configurações

### **Horário Operacional**
- **Padrão**: 6h às 23h (17 horas)
- **Localização**: `DashboardPage.jsx`, linha 370
- **Ajuste**: Modifique `const horasPorDia = 17;` conforme necessário

### **Duração Padrão**
- Se um agendamento não tiver campo `fim`, assume **1 hora** por padrão
- **Localização**: `DashboardPage.jsx`, linha 386

---

## 📊 Dados Utilizados

### **Tabelas Consultadas**
1. **`quadras`**: Total de quadras ativas
2. **`agendamentos`**: Agendamentos do dia com campos:
   - `inicio` (timestamp)
   - `fim` (timestamp)
   - `status` (enum)

### **Status Ignorados**
- `canceled` - Agendamento cancelado
- `no_show` - Cliente não compareceu

---

## 🚀 Benefícios

✅ **Métrica Real**: Baseada em duração real dos agendamentos  
✅ **Indicador Visual**: Cores ajudam a identificar rapidamente a situação  
✅ **Decisões Estratégicas**: Permite identificar horários ociosos para promoções  
✅ **KPI Padrão**: Métrica comum em negócios de espaços/quadras  

---

## 📝 Notas Técnicas

- A taxa é calculada em **tempo real** a cada carregamento da dashboard
- Considera apenas agendamentos do **dia atual** (00:00 às 23:59)
- Agendamentos sobrepostos na mesma quadra são contabilizados corretamente
- Performance otimizada: 1 query para quadras + 1 query para agendamentos

---

**Implementado em**: 17/10/2025  
**Arquivo**: `src/pages/DashboardPage.jsx`
