-- Verificar qual é o codigo_empresa do usuário autenticado
SELECT 
  auth.uid() as user_id,
  c.codigo_empresa as company_from_colaboradores,
  u.codigo_empresa as company_from_usuarios,
  public.get_my_company_code() as function_result
FROM (SELECT auth.uid() as uid) auth_info
LEFT JOIN public.colaboradores c ON c.id = auth_info.uid
LEFT JOIN public.usuarios u ON u.id = auth_info.uid;
