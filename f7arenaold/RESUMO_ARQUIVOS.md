# 📦 Resumo de Arquivos - Importação de Clientes/Fornecedores

## 🎯 Arquivos Principais (Use Estes!)

### 🚀 Para Executar

| Arquivo | Descrição | Como Usar |
|---------|-----------|-----------|
| **`importar.ps1`** ⭐ | Script PowerShell automático (TESTE) | Clique direito → "Executar com PowerShell" |
| **`importar_producao.ps1`** 🔥 | Script PowerShell automático (PRODUÇÃO) | Clique direito → "Executar com PowerShell" |
| `instalar_e_rodar.bat` | Script Batch para Windows | Duplo clique |
| `importar_clientes.py` | Script Python principal | `python importar_clientes.py` |

### 📖 Para Ler

| Arquivo | Descrição |
|---------|-----------|
| **`COMECE_AQUI.txt`** ⭐ | Guia visual rápido - LEIA PRIMEIRO! |
| **`README_IMPORTACAO.md`** | Guia completo de uso |
| `INSTRUCOES_IMPORTACAO.md` | Manual detalhado |
| `ANALISE_IMPORTACAO_CLIENTES.md` | Análise técnica completa |

### ⚙️ Configuração

| Arquivo | Descrição |
|---------|-----------|
| `.env.python` | Credenciais do Supabase (JÁ CONFIGURADO!) |
| `pessoas.csv` | Dados a serem importados (50 registros) |

---

## 🎬 Fluxo Recomendado

```
1. Leia: COMECE_AQUI.txt
   ↓
2. Execute: importar.ps1 (modo teste)
   ↓
3. Verifique os dados processados
   ↓
4. Execute: importar_producao.ps1 (importa de verdade)
   ↓
5. Pronto! ✅
```

---

## 📊 O que Cada Script Faz

### `importar.ps1` (Modo Teste) ⭐

```powershell
✅ Verifica Python
✅ Verifica arquivo CSV
✅ Verifica credenciais
✅ Instala dependências
✅ Executa em modo DRY-RUN (não insere no banco)
✅ Mostra estatísticas
✅ Mostra exemplo de registro
```

**Seguro:** NÃO insere dados no banco!

---

### `importar_producao.ps1` (Modo Produção) 🔥

```powershell
⚠️  Pede confirmação (digite SIM)
✅ Muda script para DRY_RUN = False
✅ Instala dependências
🚀 IMPORTA DE VERDADE no Supabase
✅ Oferece voltar para modo teste
```

**Atenção:** INSERE dados no banco de verdade!

---

### `importar_clientes.py` (Script Principal)

```python
📂 Lê pessoas.csv
🔄 Processa cada linha
✅ Valida CPF, CNPJ, Email, CEP
🔄 Converte datas (DD.MM.YYYY → YYYY-MM-DD)
🔄 Converte flags (S/N → true/false)
🔄 Detecta tipo pessoa (CPF/CNPJ)
📊 Gera estatísticas
💾 Insere no Supabase (se DRY_RUN = False)
```

---

## 🔧 Configurações Atuais

### Credenciais (`.env.python`)

```
✅ SUPABASE_URL = https://dlfryxtyxqoacuunswuc.supabase.co
✅ SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Mesmas credenciais do frontend!**

### Empresa

```python
CODIGO_EMPRESA = "1006"  # Fixo para todos
```

### Modo

```python
DRY_RUN = True  # Padrão: modo teste
```

---

## 📋 Dados a Importar

### Arquivo: `pessoas.csv`

- **Total:** 50 registros
- **Encoding:** UTF-8 (com correção automática)
- **Formato:** CSV separado por `;`

### Tipos de Registro

| Tipo | Flag | Quantidade Estimada |
|------|------|---------------------|
| Clientes | CLI = S | ~48 |
| Fornecedores | FORN = S | ~5 |
| Funcionários | FUN = S | ~2 |
| Administradoras | ADM = S | ~0 |

**Nota:** Um registro pode ter múltiplas flags!

### Campos Mapeados

- ✅ 44 campos da tabela `clientes`
- ✅ Identificação (nome, CPF, CNPJ, RG, IE)
- ✅ Contato (5 telefones + email)
- ✅ Endereço completo (8 campos)
- ✅ Dados pessoais (aniversário, sexo, pais)
- ✅ Financeiro (saldo, limite)
- ✅ Flags (cliente, fornecedor, funcionário, etc)

---

## ✅ Validações Automáticas

O script valida automaticamente:

- ✅ **CPF:** 11 dígitos, não pode ser 00000000000
- ✅ **CNPJ:** 14 dígitos, não pode ser 00000000000000
- ✅ **Email:** Formato válido (regex)
- ✅ **CEP:** 8 dígitos
- ✅ **Telefone:** Mínimo 10 dígitos
- ✅ **Datas:** Converte DD.MM.YYYY para YYYY-MM-DD

---

## 🔄 Transformações Automáticas

### Tipo de Pessoa

```
11 dígitos → Pessoa FÍSICA (CPF)
14 dígitos → Pessoa JURÍDICA (CNPJ)
```

### Flags Booleanas

```
S → true
N → false
vazio → false
```

### Encoding

```
F�SICA → FÍSICA
JUR�DICA → JURÍDICA
UBERL�NDIA → UBERLÂNDIA
```

### Datas

```
24.04.2019 → 2019-04-24
15.06.2025 → 2025-06-15
```

---

## 📈 Exemplo de Saída

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
  ✓ [  1] CONSUMIDOR FINAL              | FÍSICA   | CLIENTE
  ✓ [ 22] PREFEITURA DE UBERLANDIA      | JURÍDICA | CLIENTE
  ✓ [ 23] CEMIG DISTRIBUICAO S.A        | JURÍDICA | CLIENTE
  ✓ [ 24] Supermercados Leal Ltda       | JURÍDICA | CLIENTE, FORNECEDOR
  ...

✅ Registros processados: 50/50

📈 ESTATÍSTICAS:
   • Clientes: 48
   • Fornecedores: 5
   • Funcionários: 2
   • Pessoas Físicas: 35
   • Pessoas Jurídicas: 15
```

---

## ⚠️ Pontos de Atenção

### 1. Cliente Código 1

O primeiro registro é "CONSUMIDOR FINAL". Pode conflitar se já existe código 0.

**Soluções:**
- Pular código 1 (editar script)
- Manter ambos
- Deletar código 0 antes

### 2. Duplicados

Se já existirem clientes na empresa 1006:
- CPF/CNPJ duplicado → ERRO
- Email duplicado → ERRO
- Código duplicado → ERRO

**Solução:** Limpar tabela antes OU ajustar códigos.

### 3. Encoding

O script tenta corrigir automaticamente, mas pode não pegar tudo.

---

## 🆘 Problemas Comuns

### "Python não encontrado"

```bash
# Instale Python 3.8+
https://www.python.org/downloads/
```

### "ModuleNotFoundError: pandas"

```bash
pip install pandas supabase
```

### "Arquivo pessoas.csv não encontrado"

Certifique-se que está na mesma pasta do script.

### "Erro de conexão Supabase"

Verifique `.env.python` com as credenciais corretas.

---

## 📞 Suporte

1. Leia: `COMECE_AQUI.txt`
2. Leia: `README_IMPORTACAO.md`
3. Leia: `INSTRUCOES_IMPORTACAO.md`
4. Verifique: Credenciais em `.env.python`
5. Verifique: Arquivo `pessoas.csv` existe
6. Verifique: Python instalado (`python --version`)

---

## 🎉 Tudo Pronto!

Basta executar:

```powershell
.\importar.ps1
```

Ou duplo clique em:

```
importar.ps1
```

**Boa importação! 🚀**
