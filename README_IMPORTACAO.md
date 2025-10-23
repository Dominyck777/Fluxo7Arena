# 🚀 Importação de Clientes/Fornecedores - PRONTO PARA USAR!

## ✅ Tudo Configurado!

O script já está **100% configurado** com as credenciais do Supabase que o frontend usa.

---

## 🎯 Como Usar (3 Opções)

### Opção 1: PowerShell (RECOMENDADO) ⭐

```powershell
.\importar.ps1
```

**O que faz:**
- ✅ Verifica Python
- ✅ Verifica arquivo CSV
- ✅ Verifica credenciais
- ✅ Instala dependências automaticamente
- ✅ Executa importação em modo teste (DRY-RUN)

---

### Opção 2: Batch (Windows)

```cmd
instalar_e_rodar.bat
```

Duplo clique no arquivo ou execute no CMD.

---

### Opção 3: Manual

```bash
# 1. Instalar dependências
pip install pandas supabase

# 2. Executar (modo teste)
python importar_clientes.py
```

---

## 📊 O que Será Importado

### Do arquivo `pessoas.csv` (50 registros):

- ✅ **Clientes** (flag CLI = S)
- ✅ **Fornecedores** (flag FORN = S)
- ✅ **Funcionários** (flag FUN = S)
- ✅ **Administradoras** (flag ADM = S)

**Nota:** Um mesmo registro pode ter múltiplas flags!

### Para a tabela `clientes` no Supabase:

- 🏢 **Empresa:** 1006
- 📝 **Campos:** 44 campos mapeados
- 🔄 **Validações:** CPF, CNPJ, Email, CEP, Telefones
- 📅 **Datas:** Convertidas automaticamente
- 🔤 **Encoding:** Corrigido automaticamente

---

## 🔒 Modo Seguro (DRY-RUN)

Por padrão, o script está em **modo teste**:

```python
DRY_RUN = True  # ✅ Apenas mostra, NÃO insere no banco
```

### O que acontece no DRY-RUN:
- ✅ Lê e processa o CSV
- ✅ Valida todos os dados
- ✅ Mostra estatísticas
- ✅ Mostra exemplo de registro
- ❌ **NÃO insere no banco**

---

## 💾 Para Importar DE VERDADE

Depois de verificar que está tudo OK:

### 1. Edite o arquivo `importar_clientes.py`

Encontre a linha:
```python
DRY_RUN = True
```

Mude para:
```python
DRY_RUN = False
```

### 2. Execute novamente

```bash
python importar_clientes.py
```

Agora ele **VAI inserir** os dados no Supabase!

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
  ✓ [  1] CONSUMIDOR FINAL                         | FÍSICA   | CLIENTE
  ✓ [ 22] PREFEITURA DE UBERLANDIA                 | JURÍDICA | CLIENTE
  ✓ [ 23] CEMIG DISTRIBUICAO S.A                   | JURÍDICA | CLIENTE
  ✓ [ 24] Supermercados Leal Ltda                  | JURÍDICA | CLIENTE, FORNECEDOR
  ✓ [ 25] SCALIBU SPORTS LTDA                      | JURÍDICA | CLIENTE
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

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `importar_clientes.py` | Script Python principal |
| `.env.python` | Credenciais do Supabase (já configurado!) |
| `importar.ps1` | Script PowerShell automatizado |
| `instalar_e_rodar.bat` | Script Batch para Windows |
| `README_IMPORTACAO.md` | Este arquivo |
| `INSTRUCOES_IMPORTACAO.md` | Manual completo detalhado |
| `ANALISE_IMPORTACAO_CLIENTES.md` | Análise técnica completa |

---

## ⚙️ Configurações

### Credenciais (já configuradas!)

```
SUPABASE_URL=https://dlfryxtyxqoacuunswuc.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Mesmas credenciais que o frontend usa! ✅

### Empresa

```python
CODIGO_EMPRESA = "1006"  # Fixo para todos os registros
```

### Arquivo CSV

```python
CSV_FILE = "pessoas.csv"  # Deve estar na mesma pasta
```

---

## ⚠️ Pontos de Atenção

### 1. Cliente Código 1 (Consumidor Final)

O primeiro registro do CSV é "CONSUMIDOR FINAL". Se você já tem um cliente padrão código 0 no sistema, pode:

- **Opção A:** Pular o código 1 (editar script)
- **Opção B:** Manter e ter dois consumidores
- **Opção C:** Deletar o código 0 antes de importar

### 2. Duplicados

Se já existirem clientes na empresa 1006, podem ocorrer erros de:
- CPF/CNPJ duplicado
- Email duplicado
- Código duplicado

**Solução:** Limpar tabela antes OU ajustar códigos no CSV.

### 3. Validações

O script valida automaticamente:
- ✅ CPF (11 dígitos)
- ✅ CNPJ (14 dígitos)
- ✅ Email (formato válido)
- ✅ CEP (8 dígitos)
- ✅ Telefones (mínimo 10 dígitos)

Registros com dados inválidos podem ser pulados ou ter campos NULL.

---

## 🆘 Problemas?

### Python não encontrado

```bash
# Baixe e instale Python 3.8+
https://www.python.org/downloads/
```

### Erro ao instalar pandas/supabase

```bash
# Tente com pip atualizado
python -m pip install --upgrade pip
pip install pandas supabase
```

### Arquivo pessoas.csv não encontrado

Certifique-se de que o arquivo está na mesma pasta do script.

### Erro de conexão com Supabase

Verifique se as credenciais em `.env.python` estão corretas.

---

## ✅ Checklist

Antes de importar de verdade:

- [ ] Executei em modo DRY-RUN
- [ ] Verifiquei as estatísticas
- [ ] Conferi exemplo de registro
- [ ] Total de registros está correto (50)
- [ ] Flags de cliente/fornecedor estão corretas
- [ ] Não há duplicados na empresa 1006
- [ ] Fiz backup (se necessário)
- [ ] Mudei DRY_RUN = False
- [ ] Executei novamente

---

## 🎉 Pronto!

Tudo configurado e pronto para usar. Basta executar:

```powershell
.\importar.ps1
```

Ou:

```bash
python importar_clientes.py
```

**Boa importação! 🚀**
