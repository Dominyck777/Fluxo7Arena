# Ísis Premium (OpenAI) – Guia de Implementação

Este documento descreve como a nova aba “Ísis Premium” foi implementada no Fluxo7 Arena, incluindo as alterações no frontend, a Edge Function no Supabase (chat-proxy), configuração de variáveis/segredos e procedimentos de deploy e teste.

---

## Visão Geral
- A aba “Ísis Premium” fornece um chat dedicado, alimentado pela OpenAI, acessível pela rota `/isis-premium` e pelo item correspondente no Sidebar.
- O frontend conversa com uma Supabase Edge Function (`chat-proxy`) que encaminha as mensagens para a API da OpenAI usando a chave administrativa guardada como secret no Supabase.
- O design do chat é harmonizado com a aplicação. Mensagens de sucesso (como agendamento criado/editado) já utilizam o balão verde no componente `IsisMessage` quando `message.color === 'green'`.

---

## Alterações no Frontend

### 1) Rota e Página
- Arquivo criado: `src/pages/IsisPremiumPage.jsx`
- Rota registrada em `src/App.jsx`:
  - Import: `import IsisPremiumPage from '@/pages/IsisPremiumPage';`
  - Rota privada: `<Route path="/isis-premium" element={<IsisPremiumPage />} />`

### 2) Sidebar
- Arquivo: `src/components/layout/Sidebar.jsx`
- Foi adicionado o item de menu:
  - `{ to: '/isis-premium', icon: Bot, label: 'Ísis Premium' }`

### 3) Componente de Chat (Página Premium)
- A página contém:
  - Estado local de mensagens (`messages`) e input.
  - Renderização de mensagens via componente `IsisMessage` (já utilizado no chat da Ísis tradicional).
  - Integração com Supabase Functions: `supabase.functions.invoke('chat-proxy', { body: { message } })`.
  - Fallback amigável caso a function ainda não esteja disponível.

> Observação: Para produção, recomenda-se evoluir para streaming (SSE) e histórico de conversa (enviado no `body.history`).

---

## Edge Function (Backend)

### 1) Função: `chat-proxy`
- Arquivo criado: `supabase/functions/chat-proxy/index.ts`
- Responsável por:
  - Ler o secret `OPENAI_API_KEY_ISIS_ADMIN` do ambiente (Deno) com `Deno.env.get(...)`.
  - Montar um system prompt básico e encaminhar a mensagem do usuário para a OpenAI (`/v1/chat/completions`, modelo `gpt-4o-mini`).
  - Retornar a resposta (`reply`) ao frontend, com headers CORS e telemetria (`x-isis-source`, `x-isis-duration-ms`).
- Estrutura do request esperado (exemplo):
  ```json
  {
    "message": "Olá, Ísis!",
    "history": [
      { "role": "assistant", "content": "..." },
      { "role": "user", "content": "..." }
    ]
  }
  ```

### 2) Segurança
- A chave administrativa da OpenAI NÃO fica no front. É lida apenas no runtime da Function via secret.
- RLS segue valendo para chamadas internas a dados.
- Recomenda-se aplicar rate limit e logs mais detalhados por empresa/usuário nas próximas iterações.

---

## Variáveis e Secrets

### No Front (`.env.local`)
- Necessárias para Supabase JS:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Evitar colocar a chave administrativa da OpenAI no `.env.local`. Ela deve residir apenas nos **Secrets** do Supabase.

### No Supabase (Secrets)
- `OPENAI_API_KEY_ISIS_ADMIN`: chave usada pelo `chat-proxy`.
- Definição via CLI (exemplo):
  ```bash
  supabase secrets set OPENAI_API_KEY_ISIS_ADMIN="<SUA_CHAVE>"
  ```

---

## Deploy e Testes

### Deploy da Function
1. (Opcional) Vincular projeto: `supabase link --project-ref <PROJECT_REF>`
2. Definir secret: `supabase secrets set OPENAI_API_KEY_ISIS_ADMIN="<SUA_CHAVE>"`
3. Deploy: `supabase functions deploy chat-proxy`

### Invoke (teste)
- Caso a versão do CLI não suporte `--no-verify-jwt`, é possível chamar via HTTPS:
  ```powershell
  $anon = "<VITE_SUPABASE_ANON_KEY>"
  $body = '{"message":"Olá, Ísis!"}'
  Invoke-RestMethod -Method Post `
    -Uri 'https://<PROJECT_REF>.functions.supabase.co/chat-proxy' `
    -Headers @{ Authorization = "Bearer $anon"; apikey = $anon; 'Content-Type' = 'application/json' } `
    -Body $body
  ```
- Se preferir via CLI, com versão atualizada:
  ```bash
  supabase functions invoke chat-proxy --project-ref <PROJECT_REF> --no-verify-jwt --body '{"message":"Olá, Ísis!"}'
  ```

### Teste no App
- Acesse `/isis-premium` e envie uma mensagem. Se a function estiver ok e o secret configurado, a resposta virá do OpenAI.

---

## Melhorias Planejadas
- **Streaming (SSE)** no `chat-proxy` para digitação em tempo real.
- **Function Calling**: expor tools (get-availability, create/update/cancel booking, parse-participants, kb-search) para a OpenAI decidir quando chamar.
- **RAG** (busca semântica) sobre docs/FAQs da empresa (embeddings + pgvector).
- **Rate limit e observabilidade**: métricas por empresa/usuário, custos e latência.
- **Histórico**: manter contexto da conversa por sessão/usuário.

---

## Arquivos Criados/Alterados
- Criados:
  - `src/pages/IsisPremiumPage.jsx`
  - `supabase/functions/chat-proxy/index.ts`
  - `docs/ISIS_PREMIUM_IMPLEMENTACAO.md` (este documento)
- Alterados:
  - `src/App.jsx` (rota `/isis-premium`)
  - `src/components/layout/Sidebar.jsx` (item “Ísis Premium”)
  - `src/components/isis/IsisMessage.jsx` (balão verde para `message.color === 'green'`)

---

## Troubleshooting
- `unknown flag: --project-ref` ou `--no-verify-jwt` no CLI:
  - Atualize o CLI: `supabase update`.
  - Use a chamada HTTP direta (Invoke-RestMethod) enquanto isso.
- 401 no invoke HTTP:
  - Garanta os headers `Authorization: Bearer <ANON>` e `apikey: <ANON>`.
- Sem resposta no app:
  - Verifique se `OPENAI_API_KEY_ISIS_ADMIN` está setado como secret e a function `chat-proxy` está deployada.

---

## Notas de Segurança
- Nunca exponha a chave administrativa da OpenAI no frontend.
- Use apenas Secrets do Supabase para chaves sensíveis.
- Audite periodicamente logs de acesso e consumo.
