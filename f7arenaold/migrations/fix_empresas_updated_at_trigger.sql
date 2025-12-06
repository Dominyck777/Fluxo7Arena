-- Fix empresas table trigger to use 'atualizado_em' instead of 'updated_at'
-- 
-- PROBLEMA: O trigger empresas_set_updated_at usa a função set_updated_at() que tenta
-- definir um campo 'updated_at', mas a tabela empresas usa 'atualizado_em'
--
-- SOLUÇÃO: Criar uma função específica para empresas que usa 'atualizado_em'
-- e atualizar o trigger para usar essa nova função

-- 1. Criar função específica para empresas que usa 'atualizado_em'
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Remover o trigger atual que está causando erro
DROP TRIGGER IF EXISTS empresas_set_updated_at ON empresas;

-- 3. Criar novo trigger que usa a função correta
CREATE TRIGGER empresas_set_atualizado_em
    BEFORE UPDATE ON empresas
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();

-- 4. Comentário para documentar a mudança
COMMENT ON FUNCTION set_atualizado_em() IS 'Função para atualizar automaticamente o campo atualizado_em nas tabelas que usam nomenclatura em português';
COMMENT ON TRIGGER empresas_set_atualizado_em ON empresas IS 'Trigger que atualiza automaticamente o campo atualizado_em quando um registro da empresa é modificado';
