# Central Fiscal — NF-e (Modelo 55) — Plano, Handoff e Próximos Passos

## Visão Geral
- Objetivo: habilitar criação de NF-e na Central Fiscal (por comanda e manual), gerar XML, salvar no Supabase Storage e persistir metadados em `notas_fiscais`.
- Status atual: UI pronta (abas NFC-e/NF-e). Geração de XML por comanda e manual funcionando. Salvamento no Storage e inserção em `notas_fiscais` implementados. Migration aplicada.
- Próximo grande passo: integrar Transmite Nota para NF-e (enviar/consultar/cancelar/baixar PDF/XML).

## Escopo entregue
- Aba NF-e na Central Fiscal com:
  - Lista de comandas (mesma base da NFC-e) focada em NF-e.
  - Ação por linha “Gerar XML NF-e” (modelo 55) — abre modal com campos de IDE (natOp, série, nNF, idDest, indFinal, indPres).
  - Botão “Nova NF-e” (manual) — modal para preencher destinatário (PF/PJ) e itens (descrição, NCM, CFOP, qtd, preço) e gerar XML.
  - Ações pós-geração: Baixar XML e Salvar no Supabase (bucket `fiscal`).
- Persistência em banco ao salvar:
  - Inserção em `public.notas_fiscais` com origem (`comanda`/`manual`), número/série (se informados), status inicial `pendente`, `xml_url`/`valor_total` e snapshot de destinatário (no caso manual).
- Biblioteca NF-e:
  - `gerarXMLNFe({ comandaId, codigoEmpresa, modelo: '55', overrides })` com suporte a overrides de IDE.
  - `gerarXMLNFeFromData({ empresa|codigoEmpresa, cliente, itens, pagamentos, modelo: '55', overrides })` para criação manual.
- Ajustes de XML:
  - `cUF` derivado de `UF` e `cMunFG` de `codigo_municipio_ibge` (fallbacks aplicados).

## Migração de Banco
Arquivo: `supabase/migrations/20251208_create_notas_fiscais.sql`

Tabela `public.notas_fiscais`:
- Colunas: `id (uuid)`, `codigo_empresa (text)`, `origem (comanda|manual)`, `comanda_id (uuid)`, `modelo (text, '55')`, `numero (int)`, `serie (int)`, `status (text)`, `chave (text)`, `xml_url (text)`, `pdf_url (text)`, `valor_total (numeric)`, `destinatario (jsonb)`, `criado_em`, `atualizado_em`.
- Índices: por `codigo_empresa`, `status`, `criado_em desc`.
- Trigger de `updated_at`.
- RLS ativado com policies comparando `codigo_empresa = get_my_company_code()` (TEXT).

Como aplicar:
- Já aplicado via SQL Editor do Supabase. Em novos ambientes, executar o conteúdo do arquivo.
- Pré-requisito: função `get_my_company_code()` retornando TEXT (ver Observações).

## Observações de Segurança (RLS)
- Muitas tabelas do projeto usam `codigo_empresa text` e policies com `get_my_company_code()`.
- Se a função não existir no ambiente, criar uma equivalente que leia o claim de JWT e retorne `text`.

Exemplo (ajuste conforme padrão do projeto):
```sql
create or replace function public.get_my_company_code()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'codigo_empresa', '')
$$;
```

## Alterações de Código (resumo)
- `src/pages/FiscalHubPage.jsx`
  - Abas `NFC-e` e `NF-e` com filtros independentes.
  - Modal NF-e por comanda (gera XML, baixa, salva, insere em `notas_fiscais`).
  - Modal “Criar NF-e (manual)” com destinatário e itens (gera XML, baixa, salva, insere em `notas_fiscais`).
  - Preparado botão “Emitir via API (em breve)” na aba NF-e para futura integração TN.
- `src/lib/nfe.js`
  - `gerarXMLNFe` aceita `overrides` de campos IDE (natOp, série, nNF, idDest, indFinal, indPres).
  - `gerarXMLNFeFromData` para NF-e manual.
  - Melhoria de `cUF`/`cMunFG` e fallbacks de dados do cliente.
- `supabase/migrations/20251208_create_notas_fiscais.sql`
  - Criação da tabela e RLS.

## Como usar (fluxos)
- NF-e por comanda:
  1. Central Fiscal → aba NF-e → na linha da comanda, clique em “Gerar XML NF-e”.
  2. Preencha IDE (natOp, série, número etc.) → “Gerar XML”.
  3. Baixe o XML ou “Salvar no Supabase” (insere registro em `notas_fiscais` e marca comanda `pendente`).

- NF-e manual:
  1. Central Fiscal → aba NF-e → “Nova NF-e”.
  2. Preencha destinatário e itens → “Gerar XML”.
  3. Baixe o XML ou “Salvar no Supabase” (insere registro em `notas_fiscais`).

## Testes recomendados
- UI
  - Gerar NF-e por comanda com e sem cliente vinculado.
  - Gerar NF-e manual PF e PJ, com NCM e CFOP válidos.
  - Salvar no Storage e conferir o arquivo.
- Banco
  - Verificar inserção em `notas_fiscais` (origem, numero/serie, valor_total, destinatario quando manual).
  - Confirmar enforcement de RLS na tabela (somente dados da empresa corrente).

## Próximos passos (prioridade)
1. Integração Transmite Nota para NF-e (aba NF-e):
   - Enviar NF-e: endpoint TN (a confirmar nomes), payload com XML/JSON conforme documentação.
   - Consultar NF-e: atualizar `status`, `chave`, `pdf_url`, `xml_url` em `notas_fiscais` e/ou `comandas`.
   - Cancelar NF-e: motivo e atualização de `status`.
   - Baixar PDF/XML: persistir URLs e expor botões na UI.
   - UI: habilitar “Emitir via API”, “Consultar”, “Cancelar”, “PDF”, “XML”.
2. Sequenciamento de NF-e:
   - Definir origem dos números (ex.: `empresas.nfe_numeracao` e auto-incremento por série/ambiente), bloquear colisões.
3. Validações fiscais (modelo 55):
   - Checagem de NCM/CFOP/CSOSN/CST/aliquotas por item com feedback (sem depender da TN).
4. Listagem de `notas_fiscais` na aba NF-e:
   - Tabela dedicada (além de comandas), com filtros e ações de TN.
5. Certificado digital para NF-e (se aplicável via TN):
   - UI para upload de A1 (base64 + senha) e chamada `EnviarCertificado` (existe helper para NFC-e que podemos reutilizar).
6. Logs & observabilidade:
   - Registrar eventos de emissão/consulta/cancelamento com correlação (nota/comanda/usuário).

## Riscos e mitigação
- Diferenças de schema entre ambientes (TEXT vs INTEGER): já padronizado `codigo_empresa` como TEXT na nova tabela.
- Dependência de TN para autorização/DANFE: manter fallback de download/salvamento local do XML.
- Fiscais por item incompletos: adicionar validações e assistentes de preenchimento.

## Rollback
- Remover `notas_fiscais` (drop table) e revert UI (remover aba/ações). Evitar em produção se houver dados.
- Ou manter a tabela e apenas ocultar a aba NF-e pela feature flag.

## Checklist de PR (resumo)
- [x] Aba NF-e implementada
- [x] Geração de XML (comanda e manual)
- [x] Salvamento no Storage e inserção em `notas_fiscais`
- [x] Migration RLS compatível com `codigo_empresa text`
- [ ] TN NF-e integrada (enviar/consultar/cancelar/PDF/XML)
- [ ] Sequenciamento oficial NF-e
- [ ] Validações fiscais por item (modelo 55)
- [ ] Listagem dedicada de `notas_fiscais` na UI

## Itens alterados (rastreamento)
- `src/pages/FiscalHubPage.jsx` (abas, modais NF-e, salvamento e inserts)
- `src/lib/nfe.js` (overrides, `gerarXMLNFeFromData`, cUF/cMun)
- `supabase/migrations/20251208_create_notas_fiscais.sql` (tabela e RLS)

## Notas para a Integração TN (draft)
- Endpoints esperados (a confirmar com docs TN):
  - Enviar NF-e
  - Consultar emissão NF-e
  - Cancelar NF-e
  - Consultar PDF NF-e
  - Consultar XML NF-e
- Requisitos: `baseUrl` e `apiKey` por ambiente + CNPJ; provavelmente certificado A1 enviado previamente.
- Padrão de resposta: atualizar `status`, `chave`, `numero`, `serie`, `pdf_url`, `xml_url`.

## Aceite
- Usuário consegue criar NF-e por comanda e manual, baixar e salvar XML, e ver registros na tabela.
- RLS garantindo isolamento por `codigo_empresa`.


## Modo Manutenção e Changelog — Dez/2025

### Modo Manutenção
- Ativado globalmente via código: `src/lib/maintenanceConfig.js` → `FORCE_MAINTENANCE = true`.
- Frontend já roteia tudo para `/maintenance` quando manutenção ativa, com bypass opcional:
  - LocalStorage/SessionStorage: `maintenance:bypass = '1'`.
  - Cookie: `fx_maint_bypass=1`.
- Também respeita `VITE_MAINTENANCE_MODE=true` (env) e chave de tempo `maintenance:end` no localStorage.

### Alterações recentes no modal NF-e (UI/UX)
- Produtos/Itens
  - Código antes da descrição e campo de **Cód. Barras** por item.
  - Lookup por código e por EAN/GTIN (Enter/blur) para autopreencher item.
  - **Máscaras monetárias** (BR) em preço, desconto, acréscimos e novos campos.
  - Novos campos por item: **Frete (R$)**, **Seguro (R$)**.
  - Cabeçalho do card mostra “Item N: CÓDIGO - Descrição” e **Total do item** (com desconto, acréscimos, frete e seguro).
  - Tabela-resumo dos itens com colunas: Item, Produto, Descrição, UN, CST, Qtde, Vr. Unit, Vr. ICMS, Vr. ICMS-ST, Vr. FCP, Total.
- Impostos (por item)
  - ICMS básico + ST e **FCP/FCP-ST** (Base/Alíquota/Valor).
  - **Desoneração** e **Diferimento** (valor, alíquota, motivo).
  - **IPI** com “Tipo de Cálculo” (Alíquota | Vl Unit. | Nenhum) e campos condicionais.
  - Campos avançados (antes chamados de “Impostos 2”), agora inline: 
    - ICMS monofásico e retenções (BC/valores), % redução + motivo, cobrado anteriormente, próprio devido.
    - Grupo combustível: UF, % origem UF, indicador de importação.
    - **CIDE**: alíquota, base e valor.
  - Resumo superior exibe: ICMS/PIS/COFINS/FCP/IPI + Total do item.
- Cabeçalho NF-e
  - `CFOP padrão` com pesquisa/descrição e opção “Aplicar automaticamente aos itens”.
  - Indicadores: Consumidor Final, Baixar Estoque, Destacar Substituição Trib. (com o checkbox de auto-aplicar CFOP ao lado).

### Impacto em Banco de Dados
- Sem mudanças destrutivas. Não removemos colunas nem renomeamos existentes.
- Tabela `public.notas_fiscais` já criada em migração anterior e presente nos dois ambientes (DEV/MAIN).
  - Colunas presentes em ambos os ambientes: `id, codigo_empresa, origem, comanda_id, modelo, numero, serie, status, chave, xml_url, pdf_url, valor_total, destinatario, criado_em, atualizado_em`.
- Itens de UI adicionados (frete/seguro por item, campos fiscais ampliados) são apenas de interface na etapa atual — nenhum ajuste de schema foi aplicado nessas tabelas.

### Próximos passos (pós-manutenção)
1. Consolidar tooltips/ajuda nos campos fiscais avançados e máscaras.
2. Auto-preencher impostos por item a partir do catálogo de produto (ICMS/PIS/COFINS/IPI/FCP e, se aplicável, monofásico/CIDE).
3. Listagem dedicada de `notas_fiscais` e integração TN (emitir/consultar/cancelar/PDF/XML).

