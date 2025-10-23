# 📋 Instruções de Importação de Clientes/Fornecedores

## 🎯 O que o script faz

O script `importar_clientes.py` importa dados do arquivo `pessoas.csv` para a tabela `clientes` do Supabase, incluindo:

✅ **Clientes** (flag_cliente = true)  
✅ **Fornecedores** (flag_fornecedor = true)  
✅ **Funcionários** (flag_funcionario = true)  
✅ **Administradoras** (flag_administradora = true)  

**Nota:** Um mesmo registro pode ter múltiplas flags ativas (ex: ser cliente E fornecedor)

---

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
pip install pandas supabase
```

### 2. Configurar Credenciais do Supabase

Edite o arquivo `importar_clientes.py` e substitua:

```python
SUPABASE_URL = "https://sua-url.supabase.co"
SUPABASE_KEY = "sua-service-role-key-aqui"
```

**Onde encontrar:**
- URL: Projeto Supabase → Settings → API → Project URL
- Key: Projeto Supabase → Settings → API → **service_role key** (não use a anon key!)

### 3. Testar Primeiro (Dry-Run)

```bash
python importar_clientes.py
```

O script está configurado com `DRY_RUN = True` por padrão, então ele vai:
- ✅ Ler o CSV
- ✅ Processar todos os dados
- ✅ Mostrar estatísticas
- ✅ Mostrar exemplo de registro
- ❌ **NÃO vai inserir no banco**

### 4. Importar de Verdade

Depois de verificar que está tudo OK, edite o script:

```python
DRY_RUN = False  # Mude de True para False
```

E execute novamente:

```bash
python importar_clientes.py
```

Agora ele VAI inserir os dados no Supabase!

---

## 📊 O que o Script Faz

### Validações Automáticas

- ✅ **CPF/CNPJ** - Valida formato e tamanho
- ✅ **Email** - Valida formato
- ✅ **CEP** - Formata para 8 dígitos
- ✅ **Telefones** - Remove formatação, mantém só números
- ✅ **Datas** - Converte DD.MM.YYYY → YYYY-MM-DD

### Transformações

- 🔄 **Tipo Pessoa** - Detecta automaticamente por tamanho do documento
  - 11 dígitos → Pessoa FÍSICA (CPF)
  - 14 dígitos → Pessoa JURÍDICA (CNPJ)
- 🔄 **Flags S/N** → true/false
- 🔄 **Encoding** - Tenta corrigir caracteres especiais
- 🔄 **Textos** - Remove espaços extras, normaliza

### Campos Mapeados

**Do CSV → Para o Banco:**

| CSV | Banco | Observação |
|-----|-------|------------|
| CODIGO | codigo | Mantém código original |
| FANTASIA/RAZAO | nome | Prioriza FANTASIA |
| RAZAO | apelido | Razão social |
| CNPJ (11 dig) | cpf | Se for pessoa física |
| CNPJ (14 dig) | cnpj | Se for jurídica |
| IE | ie | Inscrição estadual |
| FONE1 | telefone | Telefone principal |
| FONE2 | fone2 | Telefone 2 |
| CELULAR1 | celular1 | Celular 1 |
| CELULAR2 | celular2 | Celular 2 |
| WHATSAPP | whatsapp | WhatsApp |
| EMAIL1 | email | Email |
| CEP | cep | CEP formatado |
| ENDERECO | endereco | Endereço |
| NUMERO | numero | Número |
| COMPLEMENTO | complemento | Complemento |
| BAIRRO | bairro | Bairro |
| MUNICIPIO | cidade | Cidade |
| UF | uf | Estado |
| CODMUN | cidade_ibge | Código IBGE |
| DT_NASC | aniversario | Data nascimento |
| SEXO | sexo | Sexo |
| ECIVIL | estado_civil | Estado civil |
| MAE | nome_mae | Nome da mãe |
| PAI | nome_pai | Nome do pai |
| LIMITE | limite_credito | Limite crédito |
| CLI | flag_cliente | S→true, N→false |
| FORN | flag_fornecedor | S→true, N→false |
| FUN | flag_funcionario | S→true, N→false |
| ADM | flag_administradora | S→true, N→false |
| SPC/CCF | flag_ccf_spc | S→true, N→false |
| REGIME_TRIBUTARIO | regime_tributario | Regime |
| TIPO_RECEBIMENTO | tipo_recebimento | Tipo receb. |
| ATIVO | status | S→active, N→inactive |

### Campos Fixos

- `codigo_empresa` = **"1006"** (fixo para todos)
- `saldo` = **0.00** (todos iniciam zerados)
- `criado_em` = Data/hora atual
- `atualizado_em` = Data/hora atual

---

## 📈 Saída do Script

### Exemplo de Saída (Dry-Run)

```
================================================================================
IMPORTAÇÃO DE CLIENTES/FORNECEDORES - FLUXO7ARENA
================================================================================
Empresa: 1006
Arquivo: pessoas.csv
Modo: DRY-RUN (teste)
================================================================================

📂 Lendo arquivo CSV...
✅ Arquivo lido com encoding: utf-8
📊 Total de linhas no CSV: 50

🔄 Processando registros...
  ✓ [  1] CONSUMIDOR FINAL                         | FÍSICA   | CLIENTE
  ✓ [ 22] PREFEITURA DE UBERLANDIA                 | JURÍDICA | CLIENTE
  ✓ [ 23] CEMIG DISTRIBUICAO S.A                   | JURÍDICA | CLIENTE
  ✓ [ 24] Supermercados Leal Ltda                  | JURÍDICA | CLIENTE
  ...

✅ Registros processados: 50/50

📈 ESTATÍSTICAS:
   • Clientes: 48
   • Fornecedores: 5
   • Funcionários: 2
   • Pessoas Físicas: 35
   • Pessoas Jurídicas: 15

================================================================================
🔍 MODO DRY-RUN ATIVO
================================================================================
Os dados foram processados mas NÃO foram inseridos no banco.
Para inserir de verdade, altere DRY_RUN = False no script.
```

---

## ⚠️ Pontos de Atenção

### 1. Cliente Código 0 (Consumidor Final)

O sistema já tem um cliente padrão com código 0. Opções:

- **Opção A:** Pular código 1 do CSV (já que é "CONSUMIDOR FINAL")
- **Opção B:** Renumerar todos começando do código 1
- **Opção C:** Manter códigos originais (1-50)

**Recomendação:** Verificar se código 1 do CSV é mesmo o consumidor final e pular ele.

### 2. Duplicados

O script NÃO verifica duplicados. Se já existirem clientes na empresa 1006:

- CPF/CNPJ duplicados → **ERRO** (constraint do banco)
- Email duplicado → **ERRO** (constraint do banco)
- Código duplicado → **ERRO** (constraint do banco)

**Solução:** Limpar tabela antes OU ajustar códigos no CSV.

### 3. Encoding de Caracteres

O script tenta corrigir automaticamente, mas pode não pegar tudo.

Se aparecerem caracteres estranhos, você pode:
- Editar o CSV manualmente antes
- Ajustar a função `limpar_texto()` no script

---

## 🔧 Customizações Possíveis

### Alterar Empresa

```python
CODIGO_EMPRESA = "1007"  # Trocar para outra empresa
```

### Alterar Arquivo CSV

```python
CSV_FILE = "outro_arquivo.csv"
```

### Pular Registros Específicos

Adicione condição no `processar_linha()`:

```python
# Pular código 1 (consumidor final já existe)
if int(row.get('CODIGO', 0)) == 1:
    return None
```

### Renumerar Códigos

```python
# Começar do código 1 ao invés de usar código original
cliente['codigo'] = index + 1  # Ao invés de row.get('CODIGO')
```

---

## 🆘 Problemas Comuns

### "ModuleNotFoundError: No module named 'pandas'"

```bash
pip install pandas
```

### "ModuleNotFoundError: No module named 'supabase'"

```bash
pip install supabase
```

### "Erro ao conectar: Invalid API key"

Verifique se você está usando a **service_role key** e não a anon key.

### "duplicate key value violates unique constraint"

Já existe um registro com mesmo CPF/CNPJ/Email/Código na empresa.

**Solução:** Limpar dados existentes OU ajustar códigos no CSV.

---

## ✅ Checklist Pós-Importação

Depois de importar, verifique no Supabase:

- [ ] Total de registros importados está correto
- [ ] Todos têm `codigo_empresa = "1006"`
- [ ] CPF/CNPJ estão corretos
- [ ] Emails válidos
- [ ] Telefones formatados
- [ ] Endereços completos
- [ ] Flags de cliente/fornecedor corretas
- [ ] Tipo pessoa (FÍSICA/JURÍDICA) correto
- [ ] Nenhum campo obrigatório NULL

---

## 📞 Suporte

Se tiver problemas, verifique:

1. Credenciais do Supabase estão corretas?
2. Service role key está sendo usada?
3. Arquivo pessoas.csv está no mesmo diretório?
4. Dependências instaladas (pandas, supabase)?

**Dica:** Sempre rode primeiro em modo DRY_RUN para testar!
