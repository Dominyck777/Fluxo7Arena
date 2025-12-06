-- ============================================================================
-- DEBUG RLS - Verificar o que get_my_company_code() está retornando
-- ============================================================================

-- 1. Verificar se o usuário autenticado existe
SELECT auth.uid() as user_id;

-- 2. Verificar se existe em colaboradores
SELECT id, codigo_empresa FROM public.colaboradores WHERE id = auth.uid();

-- 3. Verificar se existe em usuarios
SELECT id, codigo_empresa FROM public.usuarios WHERE id = auth.uid();

-- 4. Testar a função
SELECT public.get_my_company_code() as company_code;

-- 5. Ver quantas comandas existem no total
SELECT COUNT(*) as total_comandas FROM public.comandas;

-- 6. Ver quantas comandas o usuário consegue acessar
SELECT COUNT(*) as comandas_acessiveis FROM public.comandas 
WHERE codigo_empresa::text = public.get_my_company_code();

-- 7. Ver dados das comandas (sem filtro RLS)
SELECT id, codigo_empresa, status FROM public.comandas LIMIT 5;
