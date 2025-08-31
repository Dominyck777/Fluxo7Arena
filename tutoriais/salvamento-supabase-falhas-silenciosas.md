# Salvamento com Supabase: evitando falhas silenciosas (padrão aplicado na Agenda)

Este guia documenta um problema crítico observado em algumas abas ao salvar dados (ex.: pagamentos) e o padrão de solução adotado em `AgendaPage` para tornar o salvamento confiável, com feedback de erro e prevenção de duplicidade de envios.

- Arquivo de referência: `src/pages/AgendaPage.jsx`
- Seção: `AgendaPage.AddBookingModal`

## Sintomas
- Na primeira tentativa de salvar, funciona normalmente.
- Ao tentar novamente (sem recarregar a página), o salvamento aparenta não acontecer e nenhum erro é exibido.
- Em alguns casos, múltiplos cliques no botão de salvar podem deixar a UI inconsistente.

## Causa raiz
- **Falhas silenciosas em chamadas Supabase**: operações `delete()`/`insert()` não tinham verificação de erro e toasts. Se a primeira falhava (RLS, timeout, etc.), a UI seguia adiante sem informar.
- **Duplo submit/condição de corrida**: o botão não possuía trava, permitindo requisições concorrentes.
- **Estado não resetado**: sem `finally`, um erro intermediário podia deixar o estado de "processando" travado, bloqueando novas tentativas.

## Padrão de solução (checklist)
1. **Trava de envio**: criar `isSaving` e desabilitar o botão enquanto salva.
2. **Tratamento explícito de erros**: sempre capturar `{ error }` de Supabase e exibir `toast` com mensagem clara. Em caso de erro, `throw` para abortar o fluxo.
3. **Reset garantido**: usar `finally` para restaurar `isSaving = false`.
4. **Feedback ao usuário**: toasts de sucesso/erro e logs com `console.group` para diagnóstico.
5. **Fechar modais corretamente**: em sucesso, fechar modais filhos e pai, se o fluxo exigir retorno à tela anterior.

## Exemplo aplicado (pagamentos na Agenda)
Arquivo: `src/pages/AgendaPage.jsx`

### Estado e botão
```jsx
// Estado
const [isSavingPayments, setIsSavingPayments] = useState(false);

// Botão Salvar
<Button
  type="button"
  className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
  disabled={isSavingPayments}
  onClick={async () => {
    if (isSavingPayments) return;
    setIsSavingPayments(true);
    try {
      // ... lógica de preparo
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsSavingPayments(false);
    }
  }}
>
  Salvar
</Button>
```

### Verificação de erros Supabase
```jsx
// DELETE com verificação
a const { error: delErr } = await supabase
  .from('agendamento_participantes')
  .delete()
  .eq('codigo_empresa', codigo)
  .eq('agendamento_id', agendamentoId);
if (delErr) {
  console.error('[ParticipantsSave] Delete error', delErr);
  toast({ title: 'Erro ao salvar pagamentos', description: 'Falha ao limpar registros anteriores.', variant: 'destructive' });
  throw delErr; // interrompe o fluxo
}

// INSERT com verificação
const { data: inserted, error } = await supabase
  .from('agendamento_participantes')
  .insert(rows)
  .select();
if (error) {
  console.error('[ParticipantsSave] Insert error', error);
  toast({ title: 'Erro ao salvar pagamentos', description: 'Falha ao inserir pagamentos.', variant: 'destructive' });
  throw error;
}
```

### Fechar modais ao concluir
```jsx
// Após sucesso
setIsPaymentModalOpen(false);
setIsModalOpen(false); // volta direto para a Agenda
```

## Boas práticas adicionais
- **Toasts informativos**: diferenciar mensagens de sucesso parcial (ex.: pendentes) e total.
- **Logs agrupados**: usar `console.group('[Contexto]')` e `console.groupEnd()` para facilitar leitura.
- **RLS e views**: se usar views/tabelas com RLS, confirme que políticas estão alinhadas (ex.: `codigo_empresa` vs `empresa_id`) para evitar erros intermitentes.
- **Prevenção de race conditions**: além do `isSaving`, evite disparar efeitos colaterais duplicados no `useEffect` que dependam de estados do salvamento.

## Como aplicar em outras abas
1. Identifique handlers de salvar/confirmar.
2. Adicione `isSaving` local e desabilite UI durante a operação.
3. Envolva chamadas Supabase (ou API) com `try/catch/finally` e valide `{ error }` explicitamente.
4. Exiba toasts específicos em cada ponto crítico (DELETE/UPDATE/INSERT/UPSERT).
5. Opcional: feche modais e recarregue dados locais após sucesso para manter UI sincronizada.

## Perguntas frequentes
- **Por que funcionava só na primeira vez?**
  Porque a falha inicial não era capturada; o componente seguia em frente. Na segunda tentativa, o estado/efeitos estavam inconsistentes e sem reset.
- **Preciso usar transações?**
  Se a operação envolver múltiplas tabelas e consistência estrita, considere uma RPC/Edge Function. Para uma sequência simples (DELETE + INSERT), o padrão acima, com verificação e toasts, costuma ser suficiente.

---

Se encontrar outra aba com comportamento semelhante, replique o padrão e, se houver mensagem de erro nova do Supabase (RLS, rede, schema), anexe-a a este documento para tratarmos de forma centralizada.
