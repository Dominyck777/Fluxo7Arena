-- ============================================================================
-- FIX: Upload de Logo - Políticas RLS para Storage
-- ============================================================================
-- Problema: StorageApiError: new row violates row-level security policy
-- Solução: Criar políticas RLS no bucket 'logos' do Supabase Storage
-- Data: 17/10/2025
-- ============================================================================

-- IMPORTANTE: Execute este SQL no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/[SEU_PROJETO]/sql/new

-- ============================================================================
-- PASSO 1: Verificar se o bucket 'logos' existe (criar se necessário)
-- ============================================================================

-- Criar bucket 'logos' se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,  -- Bucket público para permitir leitura das logos
  5242880,  -- 5MB de limite por arquivo
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PASSO 2: Remover políticas antigas (se existirem)
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their logos" ON storage.objects;

-- ============================================================================
-- PASSO 3: Criar políticas RLS para o bucket 'logos'
-- ============================================================================

-- 3.1) POLÍTICA DE INSERT (Upload de novas logos)
-- Permite que usuários autenticados façam upload apenas na pasta da sua empresa
CREATE POLICY "Allow authenticated users to upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
);

-- 3.2) POLÍTICA DE UPDATE (Atualizar logos existentes - upsert)
-- Permite que usuários autenticados atualizem apenas logos da sua empresa
CREATE POLICY "Allow authenticated users to update their logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
);

-- 3.3) POLÍTICA DE SELECT (Leitura pública das logos)
-- Permite que qualquer pessoa (mesmo não autenticada) visualize as logos
CREATE POLICY "Allow public read access to logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos');

-- 3.4) POLÍTICA DE DELETE (Deletar logos - opcional)
-- Permite que usuários autenticados deletem apenas logos da sua empresa
CREATE POLICY "Allow authenticated users to delete their logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
);

-- ============================================================================
-- PASSO 4: Verificar as políticas criadas
-- ============================================================================

-- Listar todas as políticas do bucket 'logos'
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND (
    policyname LIKE '%logo%' 
    OR qual::text LIKE '%logos%'
    OR with_check::text LIKE '%logos%'
  )
ORDER BY policyname;

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Após executar este SQL, você deve ver 4 políticas criadas:
-- 1. Allow authenticated users to upload logos (INSERT)
-- 2. Allow authenticated users to update their logos (UPDATE)
-- 3. Allow public read access to logos (SELECT)
-- 4. Allow authenticated users to delete their logos (DELETE)
--
-- Estrutura de pastas no bucket:
-- logos/
-- ├── 1004/
-- │   └── logo.png
-- ├── 1005/
-- │   └── logo.jpg
-- └── 1006/
--     └── logo.webp
--
-- Segurança garantida:
-- ✅ Cada empresa só pode fazer upload na sua própria pasta (codigo_empresa)
-- ✅ Usuários não autenticados podem apenas ler (visualizar logos)
-- ✅ Não é possível sobrescrever logos de outras empresas
-- ============================================================================

-- ============================================================================
-- TESTE (Opcional)
-- ============================================================================
-- Para testar se as políticas estão funcionando, você pode executar:

-- 1. Verificar se o bucket existe
SELECT * FROM storage.buckets WHERE id = 'logos';

-- 2. Verificar o código da empresa do usuário logado
SELECT id, nome, email, codigo_empresa 
FROM public.usuarios 
WHERE id = auth.uid();

-- 3. Tentar fazer upload via aplicação
-- Vá para: Empresa → Editar Dados → Escolher imagem
-- Deve funcionar sem erro de RLS!

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
