-- Migration: Atualizar constraint de produtos para incluir unidade
-- Objetivo: Permitir produtos com mesmo nome mas unidades diferentes
-- Data: 2025-10-22

-- 1. Remover a constraint antiga que considera apenas (codigo_empresa, nome)
DROP INDEX IF EXISTS produtos_codigo_empresa_nome_unique;

-- 2. Criar nova constraint que considera (codigo_empresa, nome, unidade)
CREATE UNIQUE INDEX produtos_codigo_empresa_nome_unidade_unique 
ON public.produtos 
USING btree (codigo_empresa, lower((nome)::text), COALESCE(upper(unidade), ''));

-- Explicação:
-- - codigo_empresa: Isolamento multi-tenant
-- - lower((nome)::text): Nome em lowercase para comparação case-insensitive
-- - COALESCE(upper(unidade), ''): Unidade em uppercase, ou string vazia se NULL
-- 
-- Agora é possível ter:
-- - COCA-COLA | CX
-- - COCA-COLA | UN
-- - COCA-COLA | L
-- Como produtos diferentes
