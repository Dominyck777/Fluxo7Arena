-- ============================================================================
-- FIX: Registrar usuário autenticado em colaboradores/usuarios
-- ============================================================================

-- Verificar se o usuário existe em colaboradores
-- Se não existir, criar um registro com codigo_empresa = '1004'

INSERT INTO public.colaboradores (id, codigo_empresa, nome)
SELECT 
  auth.uid(),
  '1004',
  COALESCE((auth.jwt() ->> 'email'), 'Usuario')
WHERE auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.colaboradores WHERE id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid()
  );

-- Se ainda não existir em usuarios, criar lá também
INSERT INTO public.usuarios (id, codigo_empresa, nome)
SELECT 
  auth.uid(),
  '1004',
  COALESCE((auth.jwt() ->> 'email'), 'Usuario')
WHERE auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.colaboradores WHERE id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid()
  );
