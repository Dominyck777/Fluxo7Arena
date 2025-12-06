-- =====================================================
-- CORREÇÃO DAS POLÍTICAS RLS (ROW LEVEL SECURITY)
-- Para garantir acesso às quadras, clientes e agendamentos
-- da empresa logada
-- =====================================================

-- 1. REMOVER POLÍTICAS EXISTENTES (se houver conflitos)
-- =====================================================

-- Quadras
DROP POLICY IF EXISTS "quadras_policy" ON quadras;
DROP POLICY IF EXISTS "quadras_select_policy" ON quadras;
DROP POLICY IF EXISTS "quadras_insert_policy" ON quadras;
DROP POLICY IF EXISTS "quadras_update_policy" ON quadras;
DROP POLICY IF EXISTS "quadras_delete_policy" ON quadras;

-- Clientes  
DROP POLICY IF EXISTS "clientes_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;

-- Agendamentos
DROP POLICY IF EXISTS "agendamentos_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_select_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_update_policy" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_delete_policy" ON agendamentos;

-- Agendamento Participantes
DROP POLICY IF EXISTS "agendamento_participantes_policy" ON agendamento_participantes;
DROP POLICY IF EXISTS "agendamento_participantes_select_policy" ON agendamento_participantes;
DROP POLICY IF EXISTS "agendamento_participantes_insert_policy" ON agendamento_participantes;
DROP POLICY IF EXISTS "agendamento_participantes_update_policy" ON agendamento_participantes;
DROP POLICY IF EXISTS "agendamento_participantes_delete_policy" ON agendamento_participantes;

-- 2. HABILITAR RLS NAS TABELAS
-- =====================================================

ALTER TABLE quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento_participantes ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR POLÍTICAS PERMISSIVAS PARA QUADRAS
-- =====================================================

-- Política para SELECT (leitura) - permite acesso a quadras da empresa
CREATE POLICY "quadras_select_policy" ON quadras
    FOR SELECT
    USING (
        -- Permite acesso se o codigo_empresa corresponde ao parâmetro da URL
        -- ou se não há restrição de empresa (para admins)
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
        OR current_setting('app.current_empresa', true) = ''
    );

-- Política para INSERT (criação)
CREATE POLICY "quadras_insert_policy" ON quadras
    FOR INSERT
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para UPDATE (atualização)
CREATE POLICY "quadras_update_policy" ON quadras
    FOR UPDATE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    )
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para DELETE (exclusão)
CREATE POLICY "quadras_delete_policy" ON quadras
    FOR DELETE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- 4. CRIAR POLÍTICAS PERMISSIVAS PARA CLIENTES
-- =====================================================

-- Política para SELECT (leitura)
CREATE POLICY "clientes_select_policy" ON clientes
    FOR SELECT
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
        OR current_setting('app.current_empresa', true) = ''
    );

-- Política para INSERT (criação)
CREATE POLICY "clientes_insert_policy" ON clientes
    FOR INSERT
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para UPDATE (atualização)
CREATE POLICY "clientes_update_policy" ON clientes
    FOR UPDATE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    )
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para DELETE (exclusão)
CREATE POLICY "clientes_delete_policy" ON clientes
    FOR DELETE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- 5. CRIAR POLÍTICAS PERMISSIVAS PARA AGENDAMENTOS
-- =====================================================

-- Política para SELECT (leitura)
CREATE POLICY "agendamentos_select_policy" ON agendamentos
    FOR SELECT
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
        OR current_setting('app.current_empresa', true) = ''
    );

-- Política para INSERT (criação)
CREATE POLICY "agendamentos_insert_policy" ON agendamentos
    FOR INSERT
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para UPDATE (atualização)
CREATE POLICY "agendamentos_update_policy" ON agendamentos
    FOR UPDATE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    )
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para DELETE (exclusão)
CREATE POLICY "agendamentos_delete_policy" ON agendamentos
    FOR DELETE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- 6. CRIAR POLÍTICAS PERMISSIVAS PARA AGENDAMENTO_PARTICIPANTES
-- =====================================================

-- Política para SELECT (leitura)
CREATE POLICY "agendamento_participantes_select_policy" ON agendamento_participantes
    FOR SELECT
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
        OR current_setting('app.current_empresa', true) = ''
    );

-- Política para INSERT (criação)
CREATE POLICY "agendamento_participantes_insert_policy" ON agendamento_participantes
    FOR INSERT
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para UPDATE (atualização)
CREATE POLICY "agendamento_participantes_update_policy" ON agendamento_participantes
    FOR UPDATE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    )
    WITH CHECK (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- Política para DELETE (exclusão)
CREATE POLICY "agendamento_participantes_delete_policy" ON agendamento_participantes
    FOR DELETE
    USING (
        codigo_empresa::text = current_setting('app.current_empresa', true)
        OR current_setting('app.current_empresa', true) IS NULL
    );

-- 7. CRIAR FUNÇÃO PARA DEFINIR EMPRESA ATUAL
-- =====================================================

-- Função que será chamada pelo JavaScript para definir a empresa atual
CREATE OR REPLACE FUNCTION set_current_empresa(empresa_codigo text)
RETURNS void AS $$
BEGIN
    -- Define a empresa atual na sessão
    PERFORM set_config('app.current_empresa', empresa_codigo, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. POLÍTICA ALTERNATIVA MAIS PERMISSIVA (CASO A ANTERIOR NÃO FUNCIONE)
-- =====================================================

-- Se as políticas acima não funcionarem, use estas mais permissivas:

/*
-- QUADRAS - Política permissiva alternativa
DROP POLICY IF EXISTS "quadras_select_policy" ON quadras;
CREATE POLICY "quadras_permissive_policy" ON quadras
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- CLIENTES - Política permissiva alternativa  
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
CREATE POLICY "clientes_permissive_policy" ON clientes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- AGENDAMENTOS - Política permissiva alternativa
DROP POLICY IF EXISTS "agendamentos_select_policy" ON agendamentos;
CREATE POLICY "agendamentos_permissive_policy" ON agendamentos
    FOR ALL
    USING (true)
    WITH CHECK (true);
*/

-- 8. VERIFICAR POLÍTICAS CRIADAS
-- =====================================================

-- Para verificar se as políticas foram criadas corretamente:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('quadras', 'clientes', 'agendamentos', 'agendamento_participantes')
ORDER BY tablename, policyname;

-- 9. INSTRUÇÕES DE USO NO JAVASCRIPT
-- =====================================================

/*
No seu código JavaScript, antes de fazer consultas, chame:

// Definir empresa atual na sessão do Supabase
await supabase.rpc('set_current_empresa', { empresa_codigo: '1004' });

// Agora as consultas vão funcionar para a empresa 1004
const { data: quadras } = await supabase
  .from('quadras')
  .select('*')
  .eq('codigo_empresa', '1004');
*/
