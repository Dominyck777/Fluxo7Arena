-- ============================================================================
-- SET JWT SECRET - Configurar secret para gerar tokens
-- ============================================================================

-- Configurar JWT secret (use uma chave segura em produção)
-- Esta é uma chave padrão para desenvolvimento
ALTER DATABASE postgres SET "app.settings.jwt_secret" = 'your-secret-key-change-in-production-fluxo7arena-dev-2024';

-- Verificar se foi configurado
SELECT current_setting('app.settings.jwt_secret', true) as jwt_secret;
