# Análise de Importação de Clientes - pessoas.csv para Fluxo7Arena

## 📊 Resumo Executivo

**Origem:** pessoas.csv (50 registros)  
**Destino:** Tabela `clientes` do Fluxo7Arena  
**Empresa:** Código 1006  

---

## 🗂️ Estrutura da Tabela `clientes` (Fluxo7Arena)

### Campos Obrigatórios/Principais
- `id` - UUID (gerado automaticamente)
- `codigo` - INTEGER (sequencial por empresa)
- `codigo_empresa` - TEXT (fixo: "1006")
- `nome` - VARCHAR(255) ✅
- `tipo_pessoa` - TEXT (FÍSICA ou JURÍDICA) ✅

### Campos de Identificação
- `cpf` - VARCHAR(14) ✅
- `cnpj` - TEXT ✅
- `rg` - TEXT ✅
- `ie` - TEXT (Inscrição Estadual) ✅

### Campos de Contato
- `telefone` - VARCHAR(20) ✅
- `fone2` - TEXT ✅
- `celular1` - TEXT ✅
- `celular2` - TEXT ✅
- `whatsapp` - TEXT ✅
- `email` - VARCHAR(255) ✅

### Campos de Endereço
- `cep` - TEXT ✅
- `endereco` - TEXT ✅
- `numero` - TEXT ✅
- `complemento` - TEXT ✅
- `bairro` - TEXT ✅
- `cidade` - TEXT ✅
- `uf` - TEXT ✅
- `cidade_ibge` - TEXT ✅

### Campos Pessoais
- `apelido` - TEXT ✅
- `aniversario` - DATE ✅
- `sexo` - TEXT ✅
- `estado_civil` - TEXT ✅
- `nome_mae` - TEXT ✅
- `nome_pai` - TEXT ✅

### Campos Financeiros
- `saldo` - NUMERIC(10,2) (default 0.00)
- `limite_credito` - NUMERIC(12,2) (default 0)
- `tipo_recebimento` - TEXT ✅
- `regime_tributario` - TEXT ✅
- `tipo_contribuinte` - TEXT

### Flags/Categorias
- `flag_cliente` - BOOLEAN (default true)
- `flag_fornecedor` - BOOLEAN (default false) ✅
- `flag_funcionario` - BOOLEAN (default false) ✅
- `flag_administradora` - BOOLEAN (default false) ✅
- `flag_parceiro` - BOOLEAN (default false)
- `flag_ccf_spc` - BOOLEAN (default false) ✅

### Campos de Sistema
- `status` - VARCHAR(20) (default 'active')
- `criado_em` - TIMESTAMP (default now())
- `atualizado_em` - TIMESTAMP (default now())
- `observacoes` - TEXT

---

## 🔄 Mapeamento pessoas.csv → clientes

### ✅ Campos com Correspondência Direta

| pessoas.csv | clientes | Observação |
|-------------|----------|------------|
| CODIGO | codigo | Manter código original |
| TIPO | tipo_pessoa | Converter "F�SICA"→"FÍSICA", "JUR�DICA"→"JURÍDICA" |
| FANTASIA | nome | Nome principal |
| RAZAO | apelido | Razão social como apelido |
| CNPJ | cnpj | Apenas para jurídicas |
| CNPJ (11 dígitos) | cpf | Quando for pessoa física |
| IE | ie | Inscrição estadual |
| ENDERECO | endereco | Endereço |
| NUMERO | numero | Número |
| COMPLEMENTO | complemento | Complemento |
| CODMUN | cidade_ibge | Código IBGE |
| MUNICIPIO | cidade | Cidade |
| BAIRRO | bairro | Bairro |
| UF | uf | Estado |
| CEP | cep | CEP |
| FONE1 | telefone | Telefone principal |
| FONE2 | fone2 | Telefone secundário |
| CELULAR1 | celular1 | Celular 1 |
| CELULAR2 | celular2 | Celular 2 |
| WHATSAPP | whatsapp | WhatsApp |
| EMAIL1 | email | Email principal |
| SEXO | sexo | Sexo |
| DT_NASC | aniversario | Data de nascimento |
| ECIVIL | estado_civil | Estado civil |
| LIMITE | limite_credito | Limite de crédito |
| MAE | nome_mae | Nome da mãe |
| PAI | nome_pai | Nome do pai |
| FORN | flag_fornecedor | S→true, N→false |
| FUN | flag_funcionario | S→true, N→false |
| CLI | flag_cliente | S→true, N→false |
| ADM | flag_administradora | S→true, N→false |
| SPC/CCF | flag_ccf_spc | S→true, N→false |
| REGIME_TRIBUTARIO | regime_tributario | Regime tributário |
| TIPO_RECEBIMENTO | tipo_recebimento | Tipo de recebimento |

### ⚠️ Campos que Precisam de Tratamento

1. **TIPO (Pessoa Física/Jurídica)**
   - Problema: Encoding ruim ("F�SICA", "JUR�DICA")
   - Solução: Detectar pela presença de CNPJ (14 dígitos) ou CPF (11 dígitos)

2. **CPF/CNPJ**
   - Problema: Campo CNPJ contém tanto CPF quanto CNPJ
   - Solução: Verificar tamanho após remover pontuação
     - 11 dígitos → CPF
     - 14 dígitos → CNPJ

3. **NOME/FANTASIA/RAZAO**
   - Problema: Alguns registros têm FANTASIA vazio
   - Solução: Usar FANTASIA se existir, senão usar RAZAO

4. **Encoding de Caracteres**
   - Problema: Acentos mal codificados (UBERL�NDIA)
   - Solução: Converter UTF-8 corretamente ou fazer replace manual

5. **Datas**
   - Problema: Formato DD.MM.YYYY
   - Solução: Converter para YYYY-MM-DD (formato PostgreSQL)

6. **Valores Numéricos**
   - Problema: Podem ter formato diferente
   - Solução: Converter para NUMERIC adequado

---

## 🎯 Estratégia de Importação Recomendada

### Opção 1: Script Python (RECOMENDADO) ✅

**Vantagens:**
- Controle total sobre transformações
- Validação de dados antes de inserir
- Tratamento de erros robusto
- Logs detalhados
- Pode fazer dry-run antes de importar

**Processo:**
1. Ler pessoas.csv com encoding correto
2. Limpar e validar cada campo
3. Detectar tipo de pessoa (CPF/CNPJ)
4. Converter datas
5. Mapear flags (S/N → true/false)
6. Gerar SQL INSERT ou usar biblioteca Supabase
7. Inserir em lote com transação

### Opção 2: SQL Direto com COPY

**Vantagens:**
- Mais rápido para grandes volumes
- Nativo do PostgreSQL

**Desvantagens:**
- Menos controle sobre transformações
- Difícil tratar encoding
- Precisa preparar CSV no formato exato

### Opção 3: Interface Web (Importação Manual)

**Vantagens:**
- Visual e interativo
- Validação em tempo real

**Desvantagens:**
- Trabalhoso para 50 registros
- Propenso a erros manuais

---

## 📝 Recomendação Final

### **Usar Script Python com as seguintes características:**

1. **Biblioteca:** `pandas` + `supabase-py`
2. **Encoding:** Tentar UTF-8, se falhar usar `latin1` ou `cp1252`
3. **Validações:**
   - CPF/CNPJ válidos
   - Email válido (regex)
   - CEP formato correto
   - Telefones formatados
4. **Transformações:**
   - Limpar caracteres especiais
   - Normalizar nomes (title case)
   - Converter datas
   - Mapear flags booleanas
5. **Segurança:**
   - Dry-run mode (preview sem inserir)
   - Backup antes de importar
   - Log de todas operações
   - Rollback em caso de erro

---

## 🚀 Próximos Passos

1. **Criar script Python de importação**
2. **Testar com 5 registros primeiro (dry-run)**
3. **Validar dados importados**
4. **Importar todos os 50 registros**
5. **Verificar integridade no sistema**

---

## ⚠️ Pontos de Atenção

1. **Código do Cliente:**
   - Manter códigos originais (1-50)?
   - Ou gerar novos sequenciais?
   - **Recomendação:** Manter originais se não houver conflito

2. **Cliente Consumidor (código 0):**
   - Sistema já tem cliente padrão código 0
   - Começar do código 1 ou renumerar?

3. **Duplicados:**
   - Verificar CPF/CNPJ duplicados
   - Verificar emails duplicados
   - Decidir política de merge ou skip

4. **Status:**
   - Todos como 'active'?
   - Verificar campo ATIVO do CSV?

5. **Saldo Inicial:**
   - Importar saldo do CSV?
   - Ou iniciar todos com 0.00?

---

## 📋 Checklist de Validação Pós-Importação

- [ ] Todos os 50 registros foram importados
- [ ] Códigos estão corretos e únicos
- [ ] CPF/CNPJ válidos e únicos por empresa
- [ ] Emails únicos (se preenchidos)
- [ ] Telefones formatados corretamente
- [ ] Endereços completos
- [ ] Flags booleanas corretas
- [ ] Datas de aniversário válidas
- [ ] Tipo de pessoa correto (FÍSICA/JURÍDICA)
- [ ] codigo_empresa = "1006" em todos
- [ ] Nenhum campo obrigatório NULL

---

**Deseja que eu crie o script Python de importação agora?**
