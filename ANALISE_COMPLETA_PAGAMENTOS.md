# Análise Completa da Aplicação Fluxo7Arena
## Foco: Sistema de Pagamentos de Agendamentos

---

## 📋 Índice
1. [Visão Geral da Aplicação](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura)
3. [Sistema de Pagamentos de Agendamentos](#sistema-de-pagamentos)
4. [Estrutura do Banco de Dados](#estrutura-bd)
5. [Fluxo de Pagamento por Participante](#fluxo-pagamento)
6. [Componentes Frontend](#componentes-frontend)
7. [Regras de Negócio](#regras-negocio)
8. [Casos de Uso](#casos-uso)

---

## 🎯 Visão Geral da Aplicação {#visão-geral}

**Fluxo7Arena** é um sistema completo de gestão para arenas esportivas (quadras de futebol, beach tennis, futevôlei, etc.) que integra:

- **Gestão de Agendamentos** (AgendaPage)
- **Gestão de Clientes** (ClientesPage)
- **Sistema de Comandas** (para bar/lanchonete)
- **Controle de Caixa**
- **Gestão de Produtos**
- **Controle de Estoque**
- **Sistema Multi-empresa** (cada empresa tem seu próprio código)

### Tecnologias Principais
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Autenticação**: Supabase Auth com RLS (Row Level Security)
- **Estado**: React Hooks + Context API

---

## 🏗️ Arquitetura do Sistema {#arquitetura}

### Estrutura Multi-tenant
Cada empresa possui:
- `codigo_empresa`: Identificador único (VARCHAR(10))
- Isolamento de dados via RLS no Supabase
- Tabelas compartilhadas com filtro por `codigo_empresa`

### Principais Entidades

```
empresas
├── clientes (flag_cliente, flag_fornecedor, flag_funcionario)
├── quadras (modalidades[], valor, horários)
├── agendamentos
│   └── agendamento_participantes (PAGAMENTOS POR PARTICIPANTE)
├── comandas
│   ├── comanda_itens
│   ├── comanda_clientes
│   └── pagamentos
├── produtos
├── finalizadoras (métodos de pagamento)
└── caixa_sessoes
```

---

## 💰 Sistema de Pagamentos de Agendamentos {#sistema-de-pagamentos}

### Conceito Central: **Pagamento Distribuído por Participante**

Diferente de um pagamento único por agendamento, o sistema permite que **cada participante pague sua própria cota** do valor total.

### Tabela: `agendamento_participantes`

```sql
CREATE TABLE agendamento_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  nome TEXT,  -- Nome do participante (pode ser livre ou vir do cliente)
  
  -- CAMPOS DE PAGAMENTO
  valor_cota NUMERIC(10,2) DEFAULT 0,  -- Valor que este participante deve pagar
  status_pagamento payment_status DEFAULT 'Pendente',  -- Status do pagamento
  pago_em TIMESTAMP WITH TIME ZONE,  -- Quando foi pago
  metodo_pagamento TEXT,  -- Método usado (legado)
  finalizadora_id UUID REFERENCES finalizadoras(id),  -- Finalizadora (método) atual
  
  codigo_empresa VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Enum: `payment_status`

```sql
CREATE TYPE payment_status AS ENUM (
  'Pendente',
  'Pago',
  'Parcial',
  'Cancelado'
);
```

### View: `v_agendamento_participantes`

Consolida informações de participantes com dados do cliente:

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

---

## 🗄️ Estrutura do Banco de Dados {#estrutura-bd}

### Tabela: `agendamentos`

```sql
CREATE TABLE agendamentos (
  id UUID PRIMARY KEY,
  codigo_empresa TEXT,
  codigo BIGINT,  -- Código sequencial por empresa
  
  quadra_id UUID REFERENCES quadras(id),
  cliente_id UUID,  -- Cliente principal (organizador)
  clientes TEXT[],  -- Array com nomes dos participantes (legado)
  
  inicio TIMESTAMP WITH TIME ZONE,
  fim TIMESTAMP WITH TIME ZONE,
  modalidade VARCHAR(100),  -- 'Futebol', 'Beach Tennis', etc.
  
  status VARCHAR(20) DEFAULT 'scheduled',
  -- Status: 'scheduled', 'confirmed', 'in_progress', 'finished', 'canceled', 'absent'
  
  valor_total NUMERIC(10,2),  -- Valor total do agendamento
  auto_disabled BOOLEAN DEFAULT false,  -- Desativa automações
  
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Tabela: `finalizadoras`

Métodos de pagamento configuráveis por empresa:

```sql
CREATE TABLE finalizadoras (
  id UUID PRIMARY KEY,
  codigo_empresa TEXT,
  nome TEXT,  -- 'Dinheiro', 'PIX', 'Cartão Crédito', etc.
  tipo TEXT DEFAULT 'outros',  -- 'dinheiro', 'credito', 'debito', 'pix', 'voucher', 'outros'
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,  -- Ordem de exibição
  taxa_percentual NUMERIC(8,4),  -- Taxa da finalizadora (ex: 2.5% para cartão)
  codigo_interno TEXT,  -- Código interno sequencial
  codigo_sefaz TEXT,  -- Código oficial para NF-e
  observacao TEXT
);
```

### Tabela: `clientes`

```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY,
  codigo_empresa TEXT,
  codigo INTEGER,  -- Código sequencial por empresa
  
  nome VARCHAR(255),
  cpf VARCHAR(14),
  cnpj TEXT,
  email VARCHAR(255),
  telefone VARCHAR(20),
  
  saldo NUMERIC(10,2) DEFAULT 0.00,  -- Saldo de crédito do cliente
  status VARCHAR(20) DEFAULT 'active',  -- 'active' ou 'inactive'
  
  -- Flags de tipo
  flag_cliente BOOLEAN DEFAULT true,
  flag_fornecedor BOOLEAN DEFAULT false,
  flag_funcionario BOOLEAN DEFAULT false,
  
  aniversario DATE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Tabela: `movimentos_saldo`

Registra movimentações de saldo (créditos/débitos) dos clientes:

```sql
CREATE TABLE movimentos_saldo (
  id UUID PRIMARY KEY,
  codigo_empresa TEXT,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE CASCADE,
  
  tipo TEXT,  -- 'credito' ou 'debito'
  valor NUMERIC(12,2),
  motivo TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 🔄 Fluxo de Pagamento por Participante {#fluxo-pagamento}

### 1. Criação do Agendamento

```javascript
// AgendaPage.jsx - Função saveBookingOnce()

// 1. Criar o agendamento
const { data, error } = await supabase
  .from('agendamentos')
  .insert({
    codigo_empresa: userProfile.codigo_empresa,
    quadra_id: court.id,
    cliente_id: primaryClient?.id,  // Primeiro cliente selecionado
    clientes: clientesArr,  // Array com nomes
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    modalidade: form.modality,
    status: form.status,
  })
  .select('id, codigo')
  .single();

// 2. Criar registros de participantes (inicialmente sem pagamento)
const rows = form.selectedClients.map(c => ({
  codigo_empresa: userProfile.codigo_empresa,
  agendamento_id: data.id,
  cliente_id: c.id,
  valor_cota: 0,  // Inicialmente zero
  status_pagamento: 'Pendente',
}));

await supabase
  .from('agendamento_participantes')
  .insert(rows);
```

### 2. Atribuição de Valores (Modal de Pagamento)

O modal de agendamento possui uma seção de pagamento onde:

```javascript
// Estado do formulário de participantes
const [participantsForm, setParticipantsForm] = useState([]);
// Estrutura: { cliente_id, nome, valor_cota, status_pagamento, finalizadora_id }

// Funções de distribuição automática
const distributeEqually = () => {
  const totalTarget = parseBRL(paymentTotal);
  const count = form.selectedClients.length;
  const perPerson = totalTarget / count;
  
  setParticipantsForm(
    form.selectedClients.map(c => ({
      cliente_id: c.id,
      nome: c.nome,
      valor_cota: maskBRL(String(perPerson.toFixed(2))),
      status_pagamento: 'Pago',
      finalizadora_id: payMethods[0]?.id
    }))
  );
};

const zeroAllValues = () => {
  setParticipantsForm(prev => 
    prev.map(p => ({ 
      ...p, 
      valor_cota: '', 
      status_pagamento: 'Pendente' 
    }))
  );
};
```

### 3. Salvamento dos Valores de Pagamento

```javascript
// Ao salvar o agendamento (edição), atualiza os participantes
if (editingBooking?.id) {
  // Atualiza agendamento...
  
  // Atualiza participantes
  for (const pf of participantsForm) {
    const valor = parseBRL(pf.valor_cota);
    
    await supabase
      .from('agendamento_participantes')
      .update({
        valor_cota: Number.isFinite(valor) ? valor : 0,
        status_pagamento: pf.status_pagamento,
        finalizadora_id: pf.finalizadora_id,
        pago_em: pf.status_pagamento === 'Pago' ? new Date().toISOString() : null
      })
      .eq('agendamento_id', editingBooking.id)
      .eq('cliente_id', pf.cliente_id);
  }
}
```

### 4. Visualização do Status de Pagamento

```javascript
// AgendaPage.jsx - Componente BookingCard

// Carrega participantes do agendamento
const participants = participantsByAgendamento[booking.id] || [];

// Conta quantos pagaram
const paidCount = participants.filter(
  p => (p.status_pagamento_text || '').toLowerCase() === 'pago'
).length;

const totalParticipants = participants.length;

// Exibe chip com status
{totalParticipants > 0 && (
  <div className="flex items-center gap-1 text-xs">
    <DollarSign className="w-3 h-3" />
    <span className={cn(
      "font-medium",
      paidCount === totalParticipants ? "text-emerald-400" : "text-amber-400"
    )}>
      {paidCount}/{totalParticipants}
    </span>
  </div>
)}
```

### 5. Histórico do Cliente

```javascript
// ClientesPage.jsx - ClientDetailsModal

// Busca agendamentos do cliente (como organizador ou participante)
const { data: baseRows } = await supabase
  .from('agendamentos')
  .select('id, inicio, fim, status, modalidade, quadra:quadra_id(nome)')
  .eq('cliente_id', client.id)
  .order('inicio', { ascending: false });

// Busca agendamentos onde é participante
const { data: partRows } = await supabase
  .from('v_agendamento_participantes')
  .select('agendamento_id')
  .eq('cliente_id', client.id);

// Ao abrir detalhes de um agendamento, mostra participantes e pagamentos
const { data: parts } = await supabase
  .from('v_agendamento_participantes')
  .select('*')
  .eq('agendamento_id', agId);

// Exibe para cada participante:
// - Nome
// - Valor da cota
// - Status de pagamento
// - Método de pagamento (finalizadora)
```

---

## 🎨 Componentes Frontend {#componentes-frontend}

### AgendaPage.jsx

**Responsabilidades:**
- Grid de agendamentos por quadra e horário
- Modal de criação/edição de agendamentos
- Seleção de clientes participantes
- **Seção de pagamento por participante**
- Distribuição automática de valores
- Atualização de status de pagamento

**Principais Estados:**

```javascript
// Participantes por agendamento (carregado do banco)
const [participantsByAgendamento, setParticipantsByAgendamento] = useState({});
// Estrutura: { [agendamento_id]: [{ cliente_id, nome, valor_cota, status_pagamento }] }

// Formulário de participantes (edição no modal)
const [participantsForm, setParticipantsForm] = useState([]);
// Estrutura: [{ cliente_id, nome, valor_cota, status_pagamento, finalizadora_id }]

// Finalizadoras disponíveis
const [payMethods, setPayMethods] = useState([]);

// Total do agendamento (calculado automaticamente)
const [paymentTotal, setPaymentTotal] = useState('');
```

**Seção de Pagamento no Modal:**

```jsx
{/* Resumo de Pagamento */}
<div className="grid grid-cols-3 gap-2">
  <div className="bg-surface-2 rounded p-2">
    <p className="text-xs text-text-secondary">Total</p>
    <p className="font-bold text-lg">{formatCurrency(parseBRL(paymentTotal))}</p>
  </div>
  <div className="bg-surface-2 rounded p-2">
    <p className="text-xs text-text-secondary">Atribuído</p>
    <p className="font-bold text-lg">{formatCurrency(paymentSummary.totalAssigned)}</p>
  </div>
  <div className="bg-surface-2 rounded p-2">
    <p className="text-xs text-text-secondary">Diferença</p>
    <p className={cn("font-bold text-lg", paymentSummary.diff === 0 ? "text-success" : "text-warning")}>
      {formatCurrency(paymentSummary.diff)}
    </p>
  </div>
</div>

{/* Botões de Ação */}
<div className="flex gap-2">
  <Button onClick={distributeEqually}>Dividir Igualmente</Button>
  <Button onClick={zeroAllValues} variant="outline">Zerar Valores</Button>
</div>

{/* Lista de Participantes */}
{form.selectedClients.map(c => {
  const pf = participantsForm.find(p => p.cliente_id === c.id) || {
    cliente_id: c.id,
    nome: c.nome,
    valor_cota: '',
    status_pagamento: 'Pendente',
    finalizadora_id: null
  };
  
  return (
    <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
      {/* Nome */}
      <div className="col-span-4">{c.nome}</div>
      
      {/* Finalizadora */}
      <div className="col-span-3">
        <Select
          value={pf.finalizadora_id}
          onValueChange={(val) => {
            setParticipantsForm(prev => {
              const list = [...prev];
              const idx = list.findIndex(p => p.cliente_id === c.id);
              if (idx >= 0) list[idx] = { ...list[idx], finalizadora_id: val };
              else list.push({ ...pf, finalizadora_id: val });
              return list;
            });
          }}
        >
          {payMethods.map(m => (
            <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
          ))}
        </Select>
      </div>
      
      {/* Valor */}
      <div className="col-span-3">
        <Input
          type="text"
          placeholder="0,00"
          value={maskBRL(pf.valor_cota)}
          onChange={(e) => {
            const masked = maskBRL(e.target.value);
            const amount = parseBRL(masked);
            const autoStatus = (Number.isFinite(amount) && amount > 0) ? 'Pago' : 'Pendente';
            
            setParticipantsForm(prev => {
              let list = [...prev];
              const idx = list.findIndex(p => p.cliente_id === c.id);
              if (idx >= 0) {
                list[idx] = { ...list[idx], valor_cota: masked, status_pagamento: autoStatus };
              } else {
                list = [...list, { ...pf, valor_cota: masked, status_pagamento: autoStatus }];
              }
              return list;
            });
          }}
        />
      </div>
      
      {/* Status Badge */}
      <div className="col-span-2">
        <Badge variant={pf.status_pagamento === 'Pago' ? 'success' : 'warning'}>
          {pf.status_pagamento}
        </Badge>
      </div>
    </div>
  );
})}
```

### ClientesPage.jsx

**Responsabilidades:**
- Listagem de clientes
- Modal de detalhes do cliente
- **Histórico de agendamentos e pagamentos**
- Histórico de comandas

**Modal de Detalhes:**

```jsx
// Carrega histórico unificado (comandas + agendamentos)
const unifiedRecent = useMemo(() => {
  const a = history.map(h => ({
    kind: 'comanda',
    ts: new Date(h.aberto_em).getTime(),
    data: h,
  }));
  
  const b = bookings.map(bk => ({
    kind: 'agendamento',
    ts: new Date(bk.inicio).getTime(),
    data: bk,
  }));
  
  return [...a, ...b]
    .sort((x, y) => y.ts - x.ts)
    .slice(0, 10);
}, [history, bookings]);

// Ao clicar em um agendamento, abre modal com detalhes
const openDetail = async (item) => {
  if (item.kind === 'agendamento') {
    // Busca participantes e status de pagamento
    const { data: parts } = await supabase
      .from('v_agendamento_participantes')
      .select('*')
      .eq('agendamento_id', item.data.id);
    
    // Exibe:
    // - Informações do agendamento
    // - Lista de participantes
    // - Valor da cota de cada um
    // - Status de pagamento
  }
};
```

---

## 📐 Regras de Negócio {#regras-negocio}

### 1. Distribuição de Valores

**Regra:** O valor total do agendamento pode ser distribuído entre os participantes de forma:
- **Manual**: Cada participante recebe um valor específico
- **Igualitária**: Valor total dividido igualmente entre todos
- **Livre**: Valores podem não somar o total (útil para cortesias/descontos)

**Validação:**
```javascript
const paymentSummary = useMemo(() => {
  const values = form.selectedClients.map(c => {
    const pf = participantsForm.find(p => p.cliente_id === c.id);
    const v = parseBRL(pf?.valor_cota);
    return Number.isFinite(v) ? v : 0;
  });
  
  const totalAssigned = values.reduce((a, b) => a + b, 0);
  const totalTarget = parseBRL(paymentTotal);
  const diff = totalTarget - totalAssigned;
  
  return { totalAssigned, totalTarget, diff };
}, [participantsForm, paymentTotal, form.selectedClients]);
```

### 2. Status de Pagamento Automático

**Regra:** Quando um participante recebe um valor > 0, seu status muda automaticamente para "Pago":

```javascript
const autoStatus = (Number.isFinite(amount) && amount > 0) ? 'Pago' : 'Pendente';
```

**Exceção:** Se um participante cobre o valor total sozinho, todos são marcados como "Pago":

```javascript
useEffect(() => {
  const totalTarget = parseBRL(paymentTotal);
  const anyCoversAll = participantsForm.some(p => parseBRL(p?.valor_cota) >= totalTarget);
  
  if (anyCoversAll && participantsForm.some(p => p.status_pagamento !== 'Pago')) {
    setParticipantsForm(prev => prev.map(p => ({ ...p, status_pagamento: 'Pago' })));
  }
}, [participantsForm, paymentTotal]);
```

### 3. Finalizadoras (Métodos de Pagamento)

**Regra:** Cada participante pode pagar com um método diferente:
- Dinheiro
- PIX
- Cartão de Crédito
- Cartão de Débito
- Voucher
- Outros

**Carregamento:**
```javascript
useEffect(() => {
  const loadPayMethods = async () => {
    const { data } = await supabase
      .from('finalizadoras')
      .select('*')
      .eq('codigo_empresa', userProfile.codigo_empresa)
      .eq('ativo', true)
      .order('ordem', { ascending: true });
    
    setPayMethods(data || []);
  };
  
  if (isModalOpen) loadPayMethods();
}, [isModalOpen, userProfile]);
```

### 4. Cálculo do Valor Total

**Regra:** Valor total = (Valor por meia hora da quadra) × (Número de slots de 30 min)

```javascript
useEffect(() => {
  const court = courtsMap[form.court];
  if (!court) return;
  
  const perHalfHour = Number(court.valor || 0);
  const minutes = Math.max(0, form.endMinutes - form.startMinutes);
  const slots = minutes / 30;  // SLOT_MINUTES = 30
  const total = Math.round(perHalfHour * slots * 100) / 100;
  
  setPaymentTotal(maskBRL(String(total.toFixed(2))));
}, [courtsMap, form.court, form.startMinutes, form.endMinutes]);
```

### 5. Participantes Obrigatórios

**Regra:** Para criar um agendamento, é obrigatório selecionar pelo menos 1 cliente:

```javascript
if (!editingBooking?.id) {
  if (!primaryClient?.id) {
    toast({
      title: 'Selecione um cliente',
      description: 'Para criar um agendamento, selecione pelo menos um cliente.',
      variant: 'destructive',
    });
    return;
  }
}
```

### 6. Isolamento Multi-tenant

**Regra:** Todos os dados são filtrados por `codigo_empresa` automaticamente:

```javascript
// Exemplo de query com isolamento
const { data } = await supabase
  .from('agendamento_participantes')
  .select('*')
  .eq('codigo_empresa', userProfile.codigo_empresa)  // ✅ Filtro obrigatório
  .eq('agendamento_id', bookingId);
```

---

## 🎬 Casos de Uso {#casos-uso}

### Caso 1: Criar Agendamento com Pagamento Dividido

**Cenário:** 4 amigos querem agendar uma quadra de futebol por 2 horas (R$ 200,00 total)

**Fluxo:**

1. **Usuário abre o modal de agendamento**
   - Seleciona quadra, data, horário
   - Total calculado automaticamente: R$ 200,00

2. **Adiciona os 4 participantes**
   - João Silva
   - Maria Santos
   - Pedro Oliveira
   - Ana Costa

3. **Clica em "Dividir Igualmente"**
   - Sistema distribui: R$ 50,00 para cada
   - Status de todos muda para "Pago"

4. **Seleciona método de pagamento para cada um**
   - João: PIX
   - Maria: Dinheiro
   - Pedro: Cartão de Crédito
   - Ana: PIX

5. **Salva o agendamento**
   - Cria registro em `agendamentos`
   - Cria 4 registros em `agendamento_participantes`:
     ```sql
     INSERT INTO agendamento_participantes VALUES
     (uuid1, agendamento_id, joao_id, 'João Silva', 50.00, 'Pago', now(), pix_id),
     (uuid2, agendamento_id, maria_id, 'Maria Santos', 50.00, 'Pago', now(), dinheiro_id),
     (uuid3, agendamento_id, pedro_id, 'Pedro Oliveira', 50.00, 'Pago', now(), credito_id),
     (uuid4, agendamento_id, ana_id, 'Ana Costa', 50.00, 'Pago', now(), pix_id);
     ```

6. **Visualização no grid**
   - Card do agendamento mostra: 💰 4/4 (todos pagaram)

### Caso 2: Pagamento Parcial

**Cenário:** 3 pessoas agendaram, mas apenas 2 pagaram

**Fluxo:**

1. **Agendamento criado com 3 participantes**
   - Total: R$ 150,00
   - Carlos: R$ 50,00 (Pago)
   - Fernanda: R$ 50,00 (Pago)
   - Roberto: R$ 50,00 (Pendente)

2. **Salvamento:**
   ```sql
   INSERT INTO agendamento_participantes VALUES
   (uuid1, agendamento_id, carlos_id, 'Carlos', 50.00, 'Pago', now(), pix_id),
   (uuid2, agendamento_id, fernanda_id, 'Fernanda', 50.00, 'Pago', now(), dinheiro_id),
   (uuid3, agendamento_id, roberto_id, 'Roberto', 50.00, 'Pendente', NULL, NULL);
   ```

3. **Visualização:**
   - Card mostra: 💰 2/3 (amarelo, indicando pendência)

4. **Edição posterior:**
   - Usuário abre o agendamento
   - Atualiza Roberto para "Pago" com método "Dinheiro"
   - Sistema atualiza o registro:
     ```sql
     UPDATE agendamento_participantes
     SET status_pagamento = 'Pago',
         pago_em = now(),
         finalizadora_id = dinheiro_id
     WHERE id = uuid3;
     ```

### Caso 3: Pagamento Desigual

**Cenário:** Um participante paga mais que os outros

**Fluxo:**

1. **Agendamento de R$ 100,00 com 2 participantes**
   - Gustavo: R$ 70,00 (Pago)
   - Helena: R$ 30,00 (Pago)

2. **Entrada manual dos valores:**
   - Usuário digita manualmente cada valor
   - Sistema valida: R$ 70 + R$ 30 = R$ 100 ✅

3. **Salvamento:**
   ```sql
   INSERT INTO agendamento_participantes VALUES
   (uuid1, agendamento_id, gustavo_id, 'Gustavo', 70.00, 'Pago', now(), pix_id),
   (uuid2, agendamento_id, helena_id, 'Helena', 30.00, 'Pago', now(), dinheiro_id);
   ```

### Caso 4: Cortesia (Valor Zero)

**Cenário:** Um participante não paga (cortesia/funcionário)

**Fluxo:**

1. **Agendamento de R$ 80,00 com 3 participantes**
   - Igor: R$ 40,00 (Pago)
   - Julia: R$ 40,00 (Pago)
   - Funcionário: R$ 0,00 (Pendente)

2. **Entrada:**
   - Usuário deixa valor zero para o funcionário
   - Status permanece "Pendente" (regra: valor > 0 = Pago)

3. **Salvamento:**
   ```sql
   INSERT INTO agendamento_participantes VALUES
   (uuid1, agendamento_id, igor_id, 'Igor', 40.00, 'Pago', now(), pix_id),
   (uuid2, agendamento_id, julia_id, 'Julia', 40.00, 'Pago', now(), dinheiro_id),
   (uuid3, agendamento_id, func_id, 'Funcionário', 0.00, 'Pendente', NULL, NULL);
   ```

4. **Visualização:**
   - Card mostra: 💰 2/3 (amarelo)
   - Mas o total atribuído (R$ 80) bate com o total do agendamento

### Caso 5: Um Participante Paga Tudo

**Cenário:** Uma pessoa paga pelo grupo inteiro

**Fluxo:**

1. **Agendamento de R$ 120,00 com 4 participantes**
   - Leonardo (pagador): R$ 120,00
   - Mariana: R$ 0,00
   - Nicolas: R$ 0,00
   - Olivia: R$ 0,00

2. **Entrada:**
   - Usuário digita R$ 120 para Leonardo
   - Sistema detecta que um valor >= total
   - **Automaticamente marca todos como "Pago"** (regra especial)

3. **Salvamento:**
   ```sql
   INSERT INTO agendamento_participantes VALUES
   (uuid1, agendamento_id, leonardo_id, 'Leonardo', 120.00, 'Pago', now(), pix_id),
   (uuid2, agendamento_id, mariana_id, 'Mariana', 0.00, 'Pago', now(), NULL),
   (uuid3, agendamento_id, nicolas_id, 'Nicolas', 0.00, 'Pago', now(), NULL),
   (uuid4, agendamento_id, olivia_id, 'Olivia', 0.00, 'Pago', now(), NULL);
   ```

4. **Visualização:**
   - Card mostra: 💰 4/4 (verde, todos pagos)

### Caso 6: Consultar Histórico de Pagamentos de um Cliente

**Cenário:** Ver todos os agendamentos e pagamentos de um cliente específico

**Fluxo:**

1. **Usuário abre ClientesPage**
   - Clica em "Detalhes" de um cliente

2. **Sistema carrega:**
   ```javascript
   // Agendamentos como organizador
   const { data: asOrganizer } = await supabase
     .from('agendamentos')
     .select('id, inicio, fim, status, modalidade')
     .eq('cliente_id', clientId);
   
   // Agendamentos como participante
   const { data: asParticipant } = await supabase
     .from('v_agendamento_participantes')
     .select('agendamento_id, valor_cota, status_pagamento')
     .eq('cliente_id', clientId);
   ```

3. **Modal exibe:**
   - Lista unificada de agendamentos (últimos 10)
   - Para cada agendamento:
     - Data/hora
     - Modalidade
     - Quadra
     - Status do agendamento
     - **Se foi participante: valor pago e status**

4. **Ao clicar em um agendamento:**
   - Abre submódulo com detalhes completos
   - Lista todos os participantes
   - Mostra quanto cada um pagou
   - Exibe métodos de pagamento usados

---

## 🔍 Pontos Importantes da Implementação

### 1. Máscaras de Moeda

```javascript
// Máscara BRL (sem símbolo): 1.234,56
const maskBRL = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const val = (Number(digits) / 100).toFixed(2);
  const [ints, cents] = val.split('.');
  const withThousands = ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withThousands},${cents}`;
};

// Parse BRL para número
const parseBRL = (str) => {
  if (str == null || str === '') return NaN;
  const s = String(str).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};
```

### 2. Carregamento de Participantes

```javascript
// Carrega participantes de todos os agendamentos do dia
useEffect(() => {
  if (!bookings.length || !userProfile?.codigo_empresa) return;
  
  const loadParticipants = async () => {
    const ids = bookings.map(b => b.id);
    
    const { data } = await supabase
      .from('v_agendamento_participantes')
      .select('*')
      .in('agendamento_id', ids)
      .eq('codigo_empresa', userProfile.codigo_empresa);
    
    // Agrupa por agendamento
    const byAgendamento = {};
    for (const p of data || []) {
      if (!byAgendamento[p.agendamento_id]) {
        byAgendamento[p.agendamento_id] = [];
      }
      byAgendamento[p.agendamento_id].push(p);
    }
    
    setParticipantsByAgendamento(byAgendamento);
  };
  
  loadParticipants();
}, [bookings, userProfile]);
```

### 3. Atualização em Lote

```javascript
// Ao salvar edição, atualiza todos os participantes
for (const pf of participantsForm) {
  const valor = parseBRL(pf.valor_cota);
  
  await supabase
    .from('agendamento_participantes')
    .update({
      valor_cota: Number.isFinite(valor) ? valor : 0,
      status_pagamento: pf.status_pagamento,
      finalizadora_id: pf.finalizadora_id,
      pago_em: pf.status_pagamento === 'Pago' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('agendamento_id', editingBooking.id)
    .eq('cliente_id', pf.cliente_id);
}
```

### 4. Validação de Diferença

```javascript
// Calcula diferença entre total e atribuído
const paymentSummary = useMemo(() => {
  const values = (form.selectedClients || []).map(c => {
    const pf = participantsForm.find(p => p.cliente_id === c.id);
    const v = parseBRL(pf?.valor_cota);
    return Number.isFinite(v) ? v : 0;
  });
  
  const totalAssigned = values.reduce((a, b) => a + b, 0);
  const totalTarget = parseBRL(paymentTotal);
  const diff = totalTarget - totalAssigned;
  
  // Conta status
  let paid = 0, pending = 0;
  for (const c of form.selectedClients) {
    const pf = participantsForm.find(p => p.cliente_id === c.id);
    const s = pf?.status_pagamento || 'Pendente';
    if (s === 'Pago') paid++; else pending++;
  }
  
  return { totalAssigned, totalTarget, diff, paid, pending };
}, [participantsForm, paymentTotal, form.selectedClients]);

// Exibe aviso se houver diferença
{paymentSummary.diff !== 0 && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      Diferença de {formatCurrency(Math.abs(paymentSummary.diff))}
      {paymentSummary.diff > 0 ? ' faltando' : ' a mais'}
    </AlertDescription>
  </Alert>
)}
```

---

## 📊 Resumo do Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    CRIAÇÃO DE AGENDAMENTO                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Usuário seleciona quadra, horário, modalidade           │
│  2. Sistema calcula valor_total (quadra.valor × slots)      │
│  3. Usuário adiciona participantes (clientes)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SEÇÃO DE PAGAMENTO (OPCIONAL)                   │
│  - Dividir igualmente                                        │
│  - Atribuir valores manualmente                             │
│  - Selecionar finalizadora por participante                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SALVAMENTO NO BANCO                       │
│                                                              │
│  INSERT INTO agendamentos (...)                             │
│  ├─ quadra_id, cliente_id, inicio, fim                      │
│  ├─ modalidade, status, valor_total                         │
│  └─ codigo_empresa                                          │
│                                                              │
│  INSERT INTO agendamento_participantes (...)                │
│  ├─ agendamento_id, cliente_id, nome                        │
│  ├─ valor_cota, status_pagamento                            │
│  ├─ finalizadora_id, pago_em                                │
│  └─ codigo_empresa                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  VISUALIZAÇÃO NO GRID                        │
│  - Card do agendamento                                       │
│  - Chip de pagamento: 💰 X/Y                                │
│    (X = pagos, Y = total participantes)                     │
│  - Cor: Verde (todos pagos) / Amarelo (pendente)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              HISTÓRICO DO CLIENTE                            │
│  - Lista de agendamentos                                     │
│  - Detalhes de participação                                 │
│  - Valores pagos                                            │
│  - Métodos de pagamento                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Conclusão

O sistema de **pagamentos por participante** do Fluxo7Arena é uma solução flexível e robusta que permite:

✅ **Divisão de custos** entre múltiplos participantes  
✅ **Métodos de pagamento diferentes** para cada pessoa  
✅ **Rastreamento individual** de quem pagou e quanto  
✅ **Flexibilidade** para cortesias, descontos e valores desiguais  
✅ **Histórico completo** por cliente  
✅ **Isolamento multi-tenant** seguro  

### Principais Vantagens

1. **Transparência**: Cada participante sabe exatamente quanto deve pagar
2. **Flexibilidade**: Suporta diversos cenários (igual, desigual, cortesia, um paga tudo)
3. **Rastreabilidade**: Histórico completo de pagamentos por cliente
4. **Automação**: Cálculo automático, distribuição igualitária, status automático
5. **UX Intuitiva**: Interface clara com resumos visuais e validações em tempo real

### Tecnologias-Chave

- **PostgreSQL** com tipos customizados (`payment_status`)
- **Views** para agregação de dados (`v_agendamento_participantes`)
- **Foreign Keys** com cascata para integridade referencial
- **RLS (Row Level Security)** para isolamento multi-tenant
- **React Hooks** para gerenciamento de estado complexo
- **Máscaras de moeda** para entrada/exibição de valores

---

**Documento gerado em:** ${new Date().toLocaleString('pt-BR')}  
**Versão da aplicação:** Baseada em análise do código-fonte atual  
**Autor:** Análise técnica automatizada
