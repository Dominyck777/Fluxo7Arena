-- ============================================================================
-- FIX: Políticas RLS para agenda_settings
-- ============================================================================
-- Problema: Configurações de automação não carregam após reload da página
-- Causa: Tabela agenda_settings não tem políticas RLS configuradas
-- Solução: Criar políticas permitindo SELECT, INSERT e UPDATE por empresa
-- ============================================================================

-- 1. Habilitar RLS na tabela (se ainda não estiver)
ALTER TABLE public.agenda_settings ENABLE ROW LEVEL SECURITY;

-- 2. Política de SELECT (Leitura)
-- Permite que usuários autenticados leiam as configurações da sua empresa
CREATE POLICY "Users can view their company agenda settings"
ON public.agenda_settings
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT id FROM public.empresas 
    WHERE codigo_empresa = (
      SELECT codigo_empresa FROM public.colaboradores 
      WHERE id = auth.uid()
    )
  )
);

-- 3. Política de INSERT (Criação)
-- Permite que usuários autenticados criem configurações para sua empresa
CREATE POLICY "Users can create their company agenda settings"
ON public.agenda_settings
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IN (
    SELECT id FROM public.empresas 
    WHERE codigo_empresa = (
      SELECT codigo_empresa FROM public.colaboradores 
      WHERE id = auth.uid()
    )
  )
);

-- 4. Política de UPDATE (Atualização)
-- Permite que usuários autenticados atualizem as configurações da sua empresa
CREATE POLICY "Users can update their company agenda settings"
ON public.agenda_settings
FOR UPDATE
TO authenticated
USING (
  empresa_id IN (
    SELECT id FROM public.empresas 
    WHERE codigo_empresa = (
      SELECT codigo_empresa FROM public.colaboradores 
      WHERE id = auth.uid()
    )
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT id FROM public.empresas 
    WHERE codigo_empresa = (
      SELECT codigo_empresa FROM public.colaboradores 
      WHERE id = auth.uid()
    )
  )
);

-- 5. Política de DELETE (Deleção) - Opcional
-- Permite que usuários autenticados deletem as configurações da sua empresa
CREATE POLICY "Users can delete their company agenda settings"
ON public.agenda_settings
FOR DELETE
TO authenticated
USING (
  empresa_id IN (
    SELECT id FROM public.empresas 
    WHERE codigo_empresa = (
      SELECT codigo_empresa FROM public.colaboradores 
      WHERE id = auth.uid()
    )
  )
);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
-- Execute este comando para verificar se as políticas foram criadas:
-- SELECT * FROM pg_policies WHERE tablename = 'agenda_settings';
-- ============================================================================
