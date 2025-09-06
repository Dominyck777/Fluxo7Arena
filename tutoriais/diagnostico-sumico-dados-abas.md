# Diagnóstico e Mitigação: “Dados somem nas abas” (Finalizadoras, Produtos, Quadras, etc.)

Este documento explica a causa raiz, sintomas e o padrão de solução aplicado para o problema intermitente de “sumir dados” nas abas que consultam o backend (Supabase). Serve como referência para replicar a solução nas demais páginas.

## Resumo do Problema

- Em desenvolvimento (Vite + React 18), algumas telas exibiam listas vazias (“Nenhuma finalizadora cadastrada”, etc.) até o usuário recarregar a página.
- No console, os logs paravam em pontos como:
  - `"[Finalizadoras:load N] start ..."`
  - `"[store.finalizadoras] start ..."` seguido de `"still waiting..."`
- Em muitos casos, isso acontecia logo após montar/desmontar o componente (ciclos de dev/HMR), e afetava várias abas simultaneamente.

## Causas Principais

- __Ambiente de desenvolvimento (React 18 / HMR)__
  - Montagens e atualizações frequentes durante HMR podem interromper requisições em voo.
  - Anteriormente, o StrictMode em dev duplicava o ciclo mount → unmount → mount, aumentando a janela para “carregar vazio” (já removido em `src/main.jsx`).

- __Hidratação tardia do Auth__
  - `userProfile.codigo_empresa` pode estar indisponível por milissegundos após o mount. Se a tela consulta sem a empresa, o RLS pode retornar vazio.

- __Fluxo de busca não resiliente__
  - Páginas acionavam busca sem garantir `authReady && codigo_empresa`.
  - Ausência de fallback de cache e de timeout+retry tornava a UI dependente de uma resposta imediata do backend.

## Solução Aplicada (padrão de resiliência)

As mudanças foram aplicadas e validadas primeiro em `FinalizadorasPage.jsx` e no `store.js` (função `listarFinalizadoras`). Devem ser replicadas para outras páginas.

### Em `src/pages/FinalizadorasPage.jsx`

- __Aguardar Auth__: só carrega dados quando `authReady && userProfile.codigo_empresa`.
- __Hydrate imediato de cache__: ao montar, lê `localStorage` em `finalizadoras:list:<codigo_empresa>` e renderiza imediatamente o snapshot (evita “vazio”).
- __Persistência de cache__: após um load bem sucedido, salva a lista no cache.
- __Fallback de lentidão (5s)__: se continuar vazio após 5s, reidrata do cache e loga `"slow fallback: using cached snapshot"`.
- __Guard de montagem__: `mountedRef` evita setState após unmount durante HMR.
- __Logs diagnósticos__: `start/loaded/applyState/finish` para rastrear cada ciclo.

Trechos relevantes:
- Função: `loadFinalizadoras()` em `src/pages/FinalizadorasPage.jsx`
- Efeito de montagem: hidratação de cache + chamada de load

### Em `src/lib/store.js` (`listarFinalizadoras`)

- __Timeout + retry__: usa `AbortController` (6s) e faz uma segunda tentativa se a primeira falhar/abortar.
- __Logs__: `start`, `still waiting...` (4s), `ok` / `ok(after-retry)`, `error`.
- __Filtro por empresa__: aplica `codigo_empresa` quando disponível para respeitar RLS.

Trecho relevante:
- Função: `export async function listarFinalizadoras({ somenteAtivas = true, codigoEmpresa } = {})`

### Em `src/main.jsx`

- __StrictMode removido em dev__: reduz mount/unmount duplicado e efeitos colaterais de buscas repetidas durante desenvolvimento.

## Sintomas e Como Validar

- __Antes__: UI mostrava “vazio” até refresh. Console parava em `still waiting...`.
- __Depois__: 
  - Snapshot do cache é exibido rapidamente ao montar.
  - Quando a resposta do backend chega, a lista é atualizada e o cache é persistido.
  - Em casos de latência, você verá logs `ok(after-retry)` ou a mensagem de fallback ao cache.

## Checklist para Replicar o Padrão em Outras Páginas

1. __Aguardar Auth__
   - Somente chamar o fetch quando `authReady && userProfile.codigo_empresa` estiverem prontos.
2. __Passar `codigoEmpresa`__
   - Enviar `codigoEmpresa` explícito às funções do `store.js` (evite depender apenas do cache interno do store).
3. __Cache Local__
   - Hydrate no mount: ler snapshot `{entidade}:list:<codigo_empresa>` do `localStorage` e setar na UI.
   - Persistir após load bem sucedido.
   - Fallback após 5s sem dados: reidratar do cache e logar.
4. __Timeout + Retry no Store__
   - Para cada função de listagem no `store.js`, implementar AbortController (p.ex. 6–8s) e uma tentativa extra.
   - Logar `start/still waiting/ok/ok(after-retry)/error`.
5. __Guard de Montagem__
   - `mountedRef` para evitar `setState` após unmount.
6. __Logs de Diagnóstico__ (temporários)
   - Em cada página: `start/loaded/applyState/finish`.

## Troubleshooting

- __Vem vazio mesmo com `codigoEmpresa`__
  - Verificar RLS da tabela e se o usuário realmente tem dados para a empresa.
  - Checar no console as linhas `ok { size: ... }`.

- __Requisição fica lenta com frequência__
  - Conferir a rede local, sumidouros de performance em HMR.
  - Ajustar timeout (maior), reduzir HMR em rotas críticas durante testes.

- __Divergências entre UI e Backend__
  - Confirmar que, após o retry, a UI está persistindo o novo snapshot e substituindo o cache.

## Referências de Código

- Página: `src/pages/FinalizadorasPage.jsx`
  - `loadFinalizadoras()`
  - Efeito de montagem com hidratação e listeners
- Store: `src/lib/store.js`
  - `listarFinalizadoras()`
- Bootstrap: `src/main.jsx`
  - Remoção do `React.StrictMode`

## Próximos Passos (quando for aplicar nas demais abas)

- Replicar o padrão em: `ProdutosPage.jsx`, `QuadrasPage.jsx`, `VendasPage.jsx` (outras telas que listam dados).
- Implementar timeout+retry equivalente nas funções do store: `listarProdutos`, `listMesas`, etc.
- Manter logs temporariamente para obter evidências; depois, limpar logs ou protegê-los por flag de DEV.

---

Com este padrão, a UI fica resiliente a atrasos de rede/HMR e a telas não mostram “vazio” de forma enganosa. A experiência melhora e o diagnóstico fica simples via logs estruturados.
