# Fix para Erro de Trigger na Tabela Empresas

## 🚨 Problema Identificado

**Erro:** `record "new" has no field "updated_at"`

**Contexto:** Ao tentar fazer PATCH (update) na tabela `empresas` através da EmpresasPage.jsx, o sistema retorna erro 400 (Bad Request).

## 🔍 Análise da Causa

1. **Trigger Problemático:** `empresas_set_updated_at`
   - Executa a função `set_updated_at()` antes de cada UPDATE
   - A função tenta definir um campo chamado `updated_at`

2. **Estrutura da Tabela:** A tabela `empresas` possui:
   - ✅ `atualizado_em` (timestamp with time zone)
   - ❌ `updated_at` (não existe)

3. **Inconsistência:** O trigger usa nomenclatura em inglês, mas a tabela usa português.

## 🛠️ Solução Implementada

### Arquivo: `migrations/fix_empresas_updated_at_trigger.sql`

A solução cria:

1. **Nova Função:** `set_atualizado_em()`
   - Específica para tabelas com nomenclatura em português
   - Atualiza o campo `atualizado_em` corretamente

2. **Novo Trigger:** `empresas_set_atualizado_em`
   - Substitui o trigger problemático
   - Usa a função correta

### Passos da Migração:

```sql
-- 1. Criar função específica
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Remover trigger problemático
DROP TRIGGER IF EXISTS empresas_set_updated_at ON empresas;

-- 3. Criar novo trigger
CREATE TRIGGER empresas_set_atualizado_em
    BEFORE UPDATE ON empresas
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();
```

## 📋 Como Aplicar a Correção

### Opção 1: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para SQL Editor
3. Execute o conteúdo do arquivo `migrations/fix_empresas_updated_at_trigger.sql`

### Opção 2: Via CLI do Supabase
```bash
supabase db reset --linked
# ou
supabase migration new fix_empresas_trigger
# Copie o conteúdo do arquivo SQL para a nova migração
supabase db push
```

### Opção 3: Via psql (se tiver acesso direto)
```bash
psql -h [host] -U [user] -d [database] -f migrations/fix_empresas_updated_at_trigger.sql
```

## ✅ Verificação da Correção

Após aplicar a migração, teste:

1. **Via Interface:** Acesse a página Empresas e tente salvar dados
2. **Via SQL:** Execute um UPDATE manual:
   ```sql
   UPDATE empresas 
   SET nome_fantasia = 'Teste' 
   WHERE codigo_empresa = '1005';
   
   -- Verifique se atualizado_em foi modificado
   SELECT atualizado_em FROM empresas WHERE codigo_empresa = '1005';
   ```

## 🔄 Outras Tabelas Afetadas

Verifique se outras tabelas têm o mesmo problema:
- `colaboradores` - usa `set_updated_at()` mas pode ter `updated_at`
- `mesas` - usa `set_updated_at()`
- `comandas` - usa `set_updated_at()`
- `caixa_sessoes` - usa `set_updated_at()`

## 📝 Notas Técnicas

- **Compatibilidade:** A solução mantém a funcionalidade existente
- **Performance:** Não há impacto na performance
- **Rollback:** Para reverter, basta recriar o trigger original (não recomendado)
- **Padrão:** Considere padronizar nomenclatura (português vs inglês) em futuras tabelas

## 🎯 Resultado Esperado

Após a correção:
- ✅ PATCH requests na tabela empresas funcionarão normalmente
- ✅ Campo `atualizado_em` será atualizado automaticamente
- ✅ EmpresasPage.jsx permitirá salvar dados da empresa
- ✅ Não haverá mais erro 400 (Bad Request)
