# Padrão de Carregamento Resiliente (evitar "Carregando..." travado)

Este documento descreve um padrão reutilizável para prevenir e corrigir problemas de carregamento que ficam presos (exibindo apenas "Carregando...") em modais, páginas e componentes da aplicação.

## Problemas comuns

- Falta de pré-requisitos (ex.: `codigo_empresa`) no momento de iniciar os fetches.
- Consultas com arrays vazios (ex.: `.in('id', [])`) que podem ter comportamento inesperado.
- Latência alta / RLS (Row Level Security) provocando respostas vazias temporárias ou demoradas.
- Atualizações de estado após desmontagem do componente (ex.: modal fechado).
- Um loader controlando o estado de outro (mistura indevida de flags).

## Princípios do padrão

- Independência dos loaders
  - Mantenha estados de loading separados por recurso (ex.: `historyLoading`, `bookingsLoading`).
  - Evite ligar/desligar o loading de outro recurso sem necessidade.

- Short-circuit de pré-requisitos
  - Se o pré-requisito não estiver pronto (ex.: `codigoEmpresa`), não inicie o fetch.
  - Retorne imediatamente e garanta que o loading fique `false`.

- Timeouts de segurança
  - Adicione timeouts (ex.: 10s) para desligar loaders caso a resposta demore/trave.

- Guardas para arrays vazios
  - Antes de usar `.in('id', ids)`, valide `ids.length > 0`. Se for 0, retorne cedo e finalize o loading.

- Retentativa leve (apenas 1x)
  - Se a primeira chamada vier vazia, faça uma nova tentativa após pequeno atraso (ex.: 700ms), mitigando atrasos de token/RLS.

- Cancelamento seguro
  - Use uma flag `cancelled` no `useEffect` e cheque antes de `setState`.
  - No cleanup do efeito, desligue possíveis loaders quando o componente for desmontado.

- Renderização resiliente
  - Renderize assim que qualquer fonte de dados estiver pronta (render parcial).
  - Exiba o placeholder “Carregando...” somente se todos os recursos ainda estiverem carregando.

## Exemplo (trechos)

Arquivo de referência: `src/pages/ClientesPage.jsx` (componente `ClientDetailsModal`)

```jsx
// Estados
const [historyLoading, setHistoryLoading] = useState(false)
const [bookingsLoading, setBookingsLoading] = useState(false)
const [history, setHistory] = useState([])
const [bookings, setBookings] = useState([])
const historyRetryRef = useRef(false)
const bookingsRetryRef = useRef(false)

useEffect(() => {
  let cancelled = false

  // Reset de tentativas ao abrir
  if (open) {
    historyRetryRef.current = false
    bookingsRetryRef.current = false
  }

  // Short-circuit se faltar codigoEmpresa
  if (open && client?.id && !codigoEmpresa) {
    setHistoryLoading(false)
    setBookingsLoading(false)
    return () => { cancelled = true }
  }

  const loadHistory = async () => {
    if (!open || !client?.id) return
    setHistoryLoading(true)
    let safetyTimer = setTimeout(() => setHistoryLoading(false), 10000)
    try {
      // ... montar ids
      if (comandaIds.length === 0) {
        setHistory([])
        setHistoryLoading(false)
        return
      }
      // ... fetchs
      const merged = [...rowsFromVinc, ...rowsFromDirect].sort(...).slice(0, 10)
      if (!cancelled && merged.length === 0 && !historyRetryRef.current) {
        historyRetryRef.current = true
        setTimeout(() => { if (open && client?.id) loadHistory() }, 700)
        return
      }
      if (!cancelled) setHistory(merged)
    } finally {
      clearTimeout(safetyTimer)
      if (!cancelled) setHistoryLoading(false)
    }
  }

  const loadBookings = async () => {
    if (!open || !client?.id) return
    setBookingsLoading(true)
    let safetyTimer = setTimeout(() => setBookingsLoading(false), 10000)
    try {
      // ... fetchs
      const merged = [...baseRows, ...addRows].sort(...).slice(0, 10)
      if (!cancelled && merged.length === 0 && !bookingsRetryRef.current) {
        bookingsRetryRef.current = true
        setTimeout(() => { if (open && client?.id) loadBookings() }, 700)
        return
      }
      if (!cancelled) setBookings(merged)
    } finally {
      clearTimeout(safetyTimer)
      if (!cancelled) setBookingsLoading(false)
    }
  }

  loadHistory()
  loadBookings()

  return () => {
    cancelled = true
    if (!open) {
      setHistoryLoading(false)
      setBookingsLoading(false)
    }
  }
}, [open, client?.id, codigoEmpresa])

// Renderização: mostra placeholder apenas se ambos estiverem carregando
{(historyLoading && bookingsLoading) ? (
  <div>Carregando histórico...</div>
) : (unifiedRecent?.length > 0) ? (
  <Lista ... />
) : (
  <div>Sem registros recentes...</div>
)}
```

## Checklist de aplicação

- **Separar loaders** por recurso.
- **Short-circuit** ao faltar `codigoEmpresa` (ou outros pré-requisitos).
- **Timeout** por loader (ex.: 10s).
- **Guardar arrays vazios** antes de `.in()`.
- **Retry 1x** com atraso curto em caso de vazio.
- **Cancelar com segurança** (flag + cleanup).
- **Render parcial** quando um dos recursos terminar.
- **Dependências corretas** no `useEffect` (inclua `codigoEmpresa`).

## Onde replicar

- `src/pages/VendasPage.jsx`
- `src/pages/HistoricoComandasPage.jsx`
- `src/pages/AgendaPage.jsx`
- Qualquer modal/lista com múltiplas fontes de dados assíncronas.

## Observabilidade

- Durante desenvolvimento, use `console.debug` no início dos fetches e `console.warn` para falhas não-críticas.
- Em produção, considere um logger controlado por flag de ambiente.

---

Adote este padrão ao criar novas telas e ao refatorar telas existentes com sinais de “Carregando...” persistente. Isso melhora a resiliência contra latência/RLS, previne travamentos visuais e entrega melhor UX.
