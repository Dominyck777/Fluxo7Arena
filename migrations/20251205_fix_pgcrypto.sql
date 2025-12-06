-- ============================================================================
-- FIX PGCRYPTO - Instalar e verificar extensão
-- ============================================================================

-- 1. Instalar pgcrypto com permissões
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Verificar se pgcrypto foi instalado corretamente
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- 3. Testar função crypt
SELECT crypt('test', gen_salt('bf'));
