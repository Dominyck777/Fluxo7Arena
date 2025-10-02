# Códigos Oficiais de Forma de Pagamento NF-e/NFC-e (SEFAZ)

**Fonte:** Informe Técnico 2024.002 - SEFAZ Nacional  
**Vigência:** 01/07/2024

## Tabela Completa de Meios de Pagamento

| Código | Descrição | Observações |
|--------|-----------|-------------|
| 01 | Dinheiro | |
| 02 | Cheque | |
| 03 | Cartão de Crédito | |
| 04 | Cartão de Débito | |
| 05 | Cartão da Loja (Private Label) | Crédito de Loja |
| 10 | Vale Alimentação | |
| 11 | Vale Refeição | |
| 12 | Vale Presente | |
| 13 | Vale Combustível | |
| 14 | Duplicata Mercantil | Emitida com base em compra e venda mercantil |
| 15 | Boleto Bancário | |
| 16 | Depósito Bancário | |
| 17 | Pagamento Instantâneo (PIX) - Dinâmico | QR-Code Dinâmico |
| 18 | Transferência Bancária, Carteira Digital | |
| 19 | Programa de Fidelidade, Cashback, Crédito Virtual | |
| 20 | Pagamento Instantâneo (PIX) - Estático | QR-Code Estático |
| 21 | Crédito em Loja | Valor pago antecipadamente, devolução de mercadoria, etc |
| 22 | Pagamento Eletrônico não Informado | Falha de hardware do sistema emissor |
| 90 | Sem Pagamento | |
| 99 | Outros | Informar na tag vOutro o valor |

## Implementação no Sistema

### Campos Necessários na Tabela `finalizadoras`:
- `codigo` (TEXT) - Código SEFAZ (01, 02, 03, etc)
- `nome` (TEXT) - Nome da finalizadora
- `codigo_sefaz` (TEXT) - Código oficial para XML (redundante com codigo, mas explícito)
- `taxa_percentual` (NUMERIC)
- `ativo` (BOOLEAN)

### Mapeamento Recomendado:
- **01** - Dinheiro
- **03** - Cartão de Crédito
- **04** - Cartão de Débito
- **17** - PIX Dinâmico
- **20** - PIX Estático
- **10** - Vale Alimentação
- **11** - Vale Refeição
- **12** - Vale Presente
- **15** - Boleto Bancário
- **99** - Outros

## Próximos Passos:
1. Adicionar coluna `codigo_sefaz` na tabela finalizadoras
2. Criar seed com finalizadoras padrão
3. Ajustar geração de XML para usar código correto
4. Validar código SEFAZ no cadastro
