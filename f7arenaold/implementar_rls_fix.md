# Como Implementar a Correção RLS

## 1. Executar o SQL no Supabase

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute o arquivo `fix_rls_policies.sql`

## 2. Modificar o Código JavaScript

### Opção A: Definir empresa na inicialização

```javascript
// No useEffect inicial do IsisBookingPage.jsx
useEffect(() => {
  const initializeApp = async () => {
    try {
      // Definir empresa atual na sessão do Supabase
      await supabase.rpc('set_current_empresa', { 
        empresa_codigo: String(codigoEmpresa) 
      });
      
      // Agora carregar dados
      await loadEmpresa();
    } catch (error) {
      console.error('Erro ao inicializar:', error);
    }
  };
  
  if (codigoEmpresa) {
    initializeApp();
  }
}, [codigoEmpresa]);
```

### Opção B: Definir empresa antes de cada consulta

```javascript
// Na função loadEmpresa
const loadEmpresa = async (showLoading = true) => {
  try {
    // Definir empresa atual
    await supabase.rpc('set_current_empresa', { 
      empresa_codigo: String(codigoEmpresa) 
    });
    
    // Resto da função...
  } catch (error) {
    // ...
  }
};
```

## 3. Testar a Correção

1. Execute o SQL
2. Implemente uma das opções no JavaScript
3. Teste o acesso às quadras da empresa 1004
4. Verifique se não há mais problemas de RLS

## 4. Se Ainda Não Funcionar

Use as políticas mais permissivas (descomente a seção 7 do SQL):

```sql
-- POLÍTICA MAIS PERMISSIVA (TEMPORÁRIA)
CREATE POLICY "quadras_permissive_policy" ON quadras
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

## 5. Verificar Políticas

Execute no SQL Editor para ver as políticas ativas:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('quadras', 'clientes', 'agendamentos')
ORDER BY tablename, policyname;
```
