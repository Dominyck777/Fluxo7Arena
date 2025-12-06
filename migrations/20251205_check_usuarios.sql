-- Verificar dados na tabela usuarios
SELECT 
  id,
  email,
  senha_hash,
  nome,
  codigo_empresa
FROM public.usuarios
LIMIT 10;
