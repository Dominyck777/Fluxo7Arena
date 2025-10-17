# 🔔 Sistema de Alertas - Documentação Completa

## ✅ SIM, existe notificação para agendamentos pendentes!

---

## 📋 **Visão Geral**

O sistema de alertas é gerenciado pelo **`AlertsContext`** e monitora 7 tipos diferentes de situações em tempo real.

**Arquivo**: `src/contexts/AlertsContext.jsx`

---

## 🎯 **Tipos de Alertas Implementados**

### **1. 📦 Produtos com Estoque Baixo**
- **Condição**: `estoque <= estoque_minimo`
- **Cor**: 🔴 Vermelho (`danger`)
- **Ícone**: `Package`
- **Mensagem**: "X produto(s) com estoque baixo"
- **Link**: `/produtos`

```javascript
// Linhas 27-48
const produtosCriticos = produtosBaixoEstoque.filter(p => {
  const qtd = Number(p.estoque || 0);
  const min = Number(p.estoque_minimo || 0);
  return qtd <= min && min > 0;
});
```

---

### **2. 💰 Pagamentos Pendentes em Agendamentos (HOJE)** ⭐
- **Condição**: Participantes com `status_pagamento = 'Pendente'` em agendamentos de hoje
- **Cor**: 🟡 Amarelo (`warning`)
- **Ícone**: `DollarSign`
- **Mensagem**: "X pagamento(s) pendente(s) em agendamentos de hoje"
- **Link**: `/agenda`

```javascript
// Linhas 50-76
// 1. Busca agendamentos de hoje
const { data: agendamentosHoje } = await supabase
  .from('agendamentos')
  .select('id')
  .eq('codigo_empresa', codigo)
  .gte('inicio', inicioHoje)  // 00:00:00
  .lte('inicio', fimHoje);    // 23:59:59

// 2. Busca participantes pendentes desses agendamentos
const { data: participantesPendentes } = await supabase
  .from('agendamento_participantes')
  .select('id')
  .eq('codigo_empresa', codigo)
  .in('agendamento_id', idsAgendHoje)
  .eq('status_pagamento', 'Pendente');

// 3. Cria alerta se houver pendentes
if (participantesPendentes.length > 0) {
  alertasList.push({
    tipo: 'pagamento',
    icone: 'DollarSign',
    cor: 'warning',
    mensagem: `${participantesPendentes.length} pagamento(s) pendente(s)...`,
    link: '/agenda'
  });
}
```

---

### **3. ⏰ Comandas Abertas Há Muito Tempo**
- **Condição**: Comandas abertas há mais de **3 horas**
- **Cor**: 🟡 Amarelo (`warning`)
- **Ícone**: `Clock`
- **Mensagem**: "X comanda(s) aberta(s) há mais de 3 horas"
- **Link**: `/vendas`

```javascript
// Linhas 78-96
const tres_horas_atras = new Date();
tres_horas_atras.setHours(tres_horas_atras.getHours() - 3);

const { data: comandasAntigas } = await supabase
  .from('comandas')
  .select('id, aberto_em')
  .eq('status', 'open')
  .lte('aberto_em', tres_horas_atras.toISOString());
```

---

### **4. 💵 Caixa Aberto Há Muito Tempo**
- **Condição**: Caixa aberto há mais de **12 horas**
- **Cor**: 🔴 Vermelho (`danger`)
- **Ícone**: `ShoppingCart`
- **Mensagem**: "Caixa aberto há mais de 12 horas"
- **Link**: `/vendas`

```javascript
// Linhas 98-117
const doze_horas_atras = new Date();
doze_horas_atras.setHours(doze_horas_atras.getHours() - 12);

const { data: caixaAberto } = await supabase
  .from('caixa_sessoes')
  .select('id, aberto_em')
  .eq('status', 'open')
  .lte('aberto_em', doze_horas_atras.toISOString());
```

---

### **5. 🏪 Mesas com Saldo Alto Aguardando Pagamento**
- **Condição**: Mesas com status `awaiting-payment` e saldo > **R$ 100**
- **Cor**: 🔵 Azul (`info`)
- **Ícone**: `Store`
- **Mensagem**: "X mesa(s) com saldo alto aguardando pagamento"
- **Link**: `/vendas`

```javascript
// Linhas 119-162
// 1. Busca mesas aguardando pagamento
const { data: mesasAguardando } = await supabase
  .from('mesas')
  .select('id, nome, numero')
  .eq('status', 'awaiting-payment');

// 2. Busca comandas dessas mesas
// 3. Calcula total de cada comanda
// 4. Filtra mesas com saldo > R$ 100
const mesasComSaldoAlto = Object.values(totaisPorComanda)
  .filter(t => t > 100).length;
```

---

### **6. 🎂 Aniversariantes do Dia**
- **Condição**: Clientes com aniversário **hoje**
- **Cor**: 🟢 Verde (`success`)
- **Ícone**: `Users`
- **Mensagem**: "🎂 X aniversariante(s) hoje!"
- **Link**: `/clientes`

```javascript
// Linhas 164-187
const hojeDiaMes = format(hoje, 'MM-dd');
const aniversariantesHoje = clientes.filter(c => {
  const nascDiaMes = format(new Date(c.aniversario), 'MM-dd');
  return nascDiaMes === hojeDiaMes;
});
```

---

### **7. 🎉 Aniversariantes da Semana**
- **Condição**: Clientes com aniversário nos **próximos 7 dias**
- **Cor**: 🟣 Roxo (`purple`)
- **Ícone**: `CalendarPlus`
- **Mensagem**: "🎉 X aniversariante(s) esta semana"
- **Link**: `/clientes`

```javascript
// Linhas 189-211
const proximos7Dias = [];
for (let i = 1; i <= 7; i++) {
  const dia = new Date(hoje);
  dia.setDate(dia.getDate() + i);
  proximos7Dias.push(format(dia, 'MM-dd'));
}

const aniversariantesSemana = clientes.filter(c => {
  const nascDiaMes = format(new Date(c.aniversario), 'MM-dd');
  return proximos7Dias.includes(nascDiaMes);
});
```

---

## ⚙️ **Como Funciona**

### **1. Carregamento Automático**
```javascript
// Linhas 223-234
useEffect(() => {
  if (userProfile?.codigo_empresa) {
    loadAlerts(); // Carrega imediatamente
    
    // Recarrega a cada 5 minutos
    const interval = setInterval(() => {
      loadAlerts();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }
}, [userProfile?.codigo_empresa, loadAlerts]);
```

### **2. Atualização Periódica**
- ⏱️ **Intervalo**: A cada **5 minutos**
- 🔄 **Automático**: Não requer ação do usuário
- 🎯 **Escopo**: Apenas dados da empresa do usuário logado

### **3. Exibição na Dashboard**
```javascript
// DashboardPage.jsx
const { alerts } = useAlerts(); // Consome os alertas

<AlertCard alerts={alerts} /> // Exibe no card
```

---

## 📊 **Estrutura de um Alerta**

```javascript
{
  tipo: 'pagamento',           // Identificador único
  icone: 'DollarSign',         // Nome do ícone (Lucide React)
  cor: 'warning',              // danger | warning | info | success | purple
  mensagem: 'X pagamentos...', // Texto exibido
  link: '/agenda'              // Rota para navegação ao clicar
}
```

---

## 🎨 **Cores e Significados**

| Cor | Classe CSS | Uso | Prioridade |
|-----|-----------|-----|------------|
| 🔴 **Vermelho** | `danger` | Situações críticas | Alta |
| 🟡 **Amarelo** | `warning` | Atenção necessária | Média |
| 🔵 **Azul** | `info` | Informação importante | Baixa |
| 🟢 **Verde** | `success` | Positivo/Celebração | Info |
| 🟣 **Roxo** | `purple` | Lembretes futuros | Info |

---

## 🔗 **Integração com a Dashboard**

### **Card de Alertas**
- **Localização**: Dashboard principal (lado direito)
- **Exibição**: Mostra **2 alertas** por padrão
- **Botão**: "Ver todos" se houver mais de 2
- **Modal**: Exibe lista completa ao clicar

### **Interação**
```javascript
// Ao clicar em um alerta
onClick={() => alert.link && navigate(alert.link)}
// Navega para a página relacionada
```

---

## 🚀 **Como Adicionar um Novo Alerta**

```javascript
// Em AlertsContext.jsx, dentro de loadAlerts()

// 1. Buscar dados
const { data: minhaConsulta } = await supabase
  .from('minha_tabela')
  .select('*')
  .eq('codigo_empresa', codigo)
  .eq('minha_condicao', 'valor');

// 2. Verificar condição
if (minhaConsulta && minhaConsulta.length > 0) {
  // 3. Adicionar à lista
  alertasList.push({
    tipo: 'meu-alerta',
    icone: 'MeuIcone',
    cor: 'warning',
    mensagem: `${minhaConsulta.length} itens encontrados`,
    link: '/minha-rota'
  });
}
```

---

## 📝 **Resposta à Sua Pergunta**

### ✅ **SIM, existe notificação para agendamentos pendentes!**

**Como funciona:**
1. 🔍 **Busca** todos os agendamentos de **hoje** (00:00 às 23:59)
2. 🔎 **Verifica** participantes com `status_pagamento = 'Pendente'`
3. 🔔 **Cria alerta** se houver pelo menos 1 pendente
4. 🟡 **Exibe** com cor amarela e ícone de dólar
5. 🔗 **Link** direciona para `/agenda` ao clicar
6. ⏱️ **Atualiza** automaticamente a cada 5 minutos

**Exemplo de mensagem:**
```
💰 3 pagamentos pendentes em agendamentos de hoje
```

---

**Implementado em**: `src/contexts/AlertsContext.jsx` (linhas 50-76)  
**Documentado em**: 17/10/2025
