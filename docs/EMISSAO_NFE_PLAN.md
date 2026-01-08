# Plano de Emissão de Notas (NF-e/NFC-e)

Este documento organiza o trabalho para habilitar emissão de notas a partir das comandas e registrar o ciclo fiscal completo.

## Objetivos
- **Emitir NF-e (modelo 55)** e **NFC-e (modelo 65)** a partir de comandas fechadas.
- Armazenar XML/PDF, chave de acesso, número/série e status na base.
- Permitir consulta de status, reimpressão/envio e cancelamento.
- Garantir segurança multi-tenant (RLS por `codigo_empresa`).

## Escopo Inicial (MVP)
- Geração de XML (lib/nfe.js) e envio por provedor (lib/transmitenota.js).
- UI na Central Fiscal (FiscalHubPage.jsx):
  - Listar comandas fechadas e status fiscal.
  - Prévia (validações/missing) e emissão.
  - Consulta assíncrona de status e atualização da comanda.
  - Upload/ingestão manual de XML (quando necessário).
- Registro em banco:
  - Campos NF na `comandas` (DEV já possui: `nf_modelo`, `nf_serie`, `nf_numero`, `nf_status`, `nf_protocolo`, `nf_xml`, `nf_xml_url`, `nf_pdf_url`, `nf_autorizado_em`, `nf_cancelado_em`, `nf_motivo_cancelamento`).
  - Índices para busca/performance (por status, datas, código empresa).

## Diferenças MAIN vs DEV (relevantes ao fiscal)
- DEV possui os campos fiscais em `comandas` e diversos índices úteis.
- MAIN não possui todos os campos/índices (confirmar e promover melhorias do DEV para MAIN).

## Alterações de Banco (para MAIN)
- Tabela `comandas` (adicionar se faltarem):
  - `nf_modelo smallint`, `nf_serie smallint`, `nf_numero integer`, `nf_status varchar(20)`, `nf_protocolo text`, `nf_xml text`, `nf_xml_url text`, `nf_pdf_url text`, `nf_autorizado_em timestamptz`, `nf_cancelado_em timestamptz`, `nf_motivo_cancelamento text`.
- Índices recomendados:
  - `(codigo_empresa, status)`, `(fechado_em DESC) WHERE fechado_em IS NOT NULL`, `(aberto_em DESC)`, `(codigo_empresa)`, `(origem)`, `(xml_chave)` se houver.
- Garantir RLS por `codigo_empresa` para leitura/atualização desses campos.

## RLS e Segurança
- Políticas padrão: `codigo_empresa = get_my_company_code()` para SELECT/INSERT/UPDATE.
- Funções SECURITY DEFINER para operações server-side quando necessário.

## Integração com Provedor Fiscal
- Opções: TransmiteNota (já referenciado), FocusNFe, TecnoSpeed etc.
- Config por empresa (tabela `empresas`):
  - Ambiente: `homologacao | producao`.
  - API keys e base URLs (hml/prod). Campos já existem para TransmiteNota.
  - `nfce_serie`, `nfce_itoken` (CSC) para NFC-e.
- Fluxos:
  - Enviar XML → receber `protocolo`/status (ou pendente).
  - Consultar status por recibo/chave.
  - Cancelar por protocolo/chave e motivo.

## Fluxo de UI (FiscalHubPage.jsx)
- Listagem filtrável (período/status/busca).
- Ações por comanda:
  - Prévia NFC-e/NF-e (validar empresa e itens: CFOP, NCM, CST/CSOSN, PIS/COFINS/ICMS/IPI).
  - Emitir → grava campos fiscais na `comandas`.
  - Consultar status (polling/ação manual).
  - Baixar/visualizar XML/PDF e enviar por e-mail.
  - Cancelar (com motivo) → atualiza `nf_status = 'cancelada'` e `nf_cancelado_em`.

## API/Funções (camada lib/ e Supabase Functions)
- `lib/nfe.js`:
  - `gerarXMLNFe({ comandaId, codigoEmpresa, modelo, overrides })`.
  - `gerarXMLNFeFromData(data)`.
- `lib/transmitenota.js`:
  - `enviarNfce|enviarNfe`, `consultarEmissaoNfce|Nfe`, `cancelarNfce|Nfe`.
- Supabase Functions (opcional para esconder chaves/limitar CORS):
  - `create-nfe`, `check-nfe`, `cancel-nfe`.

## Validações Fiscais (mínimas no MVP)
- Empresa: CNPJ(14), IE, CRT, UF, cMun IBGE, Série NFC-e/NF-e, CSC (NFC-e), API key/URL por ambiente.
- Produto: NCM, CFOP (interno/externo), CST/CSOSN, alíquotas (quando aplicável), unidade.
- Cliente/Parte: CPF/CNPJ, IE (ou isento), endereço completo e UF.
- Pagamentos: métodos (finalizadoras) e valores coerentes com total.

## Migração (para MAIN)
- Script SQL com `ALTER TABLE comandas ADD COLUMN`* para todos os campos fiscais ausentes.
- Criação de índices mencionados.
- Revisão/adição de políticas RLS.

## Testes
- Ambiente HML: emitir NFC-e e NF-e com dados de teste.
- Casos: comanda sem itens, dados faltantes, rejeição simulada, autorização e cancelamento.
- Verificar gravação de todos os campos e download de XML.

## Próximos Passos
1. Remover bloqueio de manutenção na Central Fiscal (sem alterar segurança).
2. Gerar script de migração MAIN para campos da `comandas`.
3. Validar mapeamento fiscal (CFOP/CSOSN/CST) e lacunas no catálogo de produtos.
4. Integrar emissão NFC-e (modelo 65) no MVP; em seguida, NF-e (modelo 55).
5. Implementar consulta e cancelamento.
6. Adicionar botões e estados na UI.

## Auditoria Fiscal (implementado DEV)
- Tabela: `public.auditoria_fiscal` com RLS por `codigo_empresa`.
- Índices por empresa/data, ação e modelo.
- Inserções automáticas nas ações: emitir, consultar, cancelar (status: start/success/error).
- Arquivo SQL: `migrations/20251218_create_auditoria_fiscal.sql`.

## Controle de Numeração (implementado DEV)
- Tabela: `public.empresa_fiscal_numeracao` (empresa, modelo 55/65, série, próximo número).
- RPC `reservar_numero_fiscal(p_modelo text, p_serie int)` para reserva transacional.
- Integrado em:
  - NFC-e: `handleEmit` reserva número/série e injeta em `payload.Dados`.
  - NF-e: `generateNfe` reserva antes de gerar XML, via `overrides`.

## Inutilização de Numeração (implementado DEV - registro/RPC)
- Tabela: `public.inutilizacoes_fiscais` (faixas por empresa/modelo/série, justificativa, status).
- RPC `inutilizar_numero_fiscal(p_modelo, p_serie, p_inicio, p_fim, p_justificativa)` valida e registra solicitação.
- Próximo: edge function para enviar ao provedor e atualizar protocolo/status.

## Webhooks/Conciliação (em andamento)
- Edge Function `fiscal-webhook` para receber callbacks do provedor.
- Ações: conciliar status (autorizada/processando/rejeitada/cancelada), atualizar `comandas` (chave/numero/serie/pdf/xml/protocolo) e registrar em `auditoria_fiscal` (ação `webhook`).
- Requisitos de ambiente: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
