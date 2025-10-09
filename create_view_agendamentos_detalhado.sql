-- View para facilitar visualização dos participantes dos agendamentos
-- Inclui informações do agendamento, quadra, cliente, participante e finalizadora

CREATE OR REPLACE VIEW public.v_agendamentos_detalhado AS
SELECT 
    -- Dados do Agendamento
    a.id AS agendamento_id,
    a.codigo AS agendamento_codigo,
    a.codigo_empresa,
    a.inicio,
    a.fim,
    a.modalidade,
    a.status AS agendamento_status,
    a.valor_total AS valor_total_agendamento,
    a.criado_em AS agendamento_criado_em,
    
    -- Dados da Quadra
    q.id AS quadra_id,
    q.nome AS quadra_nome,
    
    -- Dados do Participante
    ap.id AS participante_id,
    ap.cliente_id,
    ap.nome AS participante_nome,
    ap.valor_cota,
    ap.status_pagamento,
    ap.pago_em,
    ap.metodo_pagamento,
    ap.created_at AS participante_criado_em,
    ap.updated_at AS participante_atualizado_em,
    
    -- Dados do Cliente (se vinculado)
    c.nome AS cliente_nome_completo,
    c.cpf AS cliente_cpf,
    c.telefone AS cliente_telefone,
    c.email AS cliente_email,
    
    -- Dados da Finalizadora
    f.id AS finalizadora_id,
    f.nome AS finalizadora_nome,
    f.tipo AS finalizadora_tipo,
    f.taxa_percentual AS finalizadora_taxa,
    
    -- Campos calculados
    CASE 
        WHEN ap.status_pagamento = 'Pago' THEN ap.valor_cota
        ELSE 0
    END AS valor_pago,
    
    CASE 
        WHEN ap.status_pagamento = 'Pendente' THEN ap.valor_cota
        ELSE 0
    END AS valor_pendente,
    
    -- Duração do agendamento em minutos
    EXTRACT(EPOCH FROM (a.fim - a.inicio)) / 60 AS duracao_minutos,
    
    -- Status legível do pagamento
    CASE ap.status_pagamento
        WHEN 'Pago' THEN '✅ Pago'
        WHEN 'Pendente' THEN '⏳ Pendente'
        WHEN 'Cancelado' THEN '❌ Cancelado'
        ELSE ap.status_pagamento::text
    END AS status_pagamento_legivel

FROM 
    public.agendamentos a
    
    -- Join com quadras (sempre existe)
    LEFT JOIN public.quadras q 
        ON a.quadra_id = q.id
    
    -- Join com participantes (pode não ter)
    LEFT JOIN public.agendamento_participantes ap 
        ON a.id = ap.agendamento_id
    
    -- Join com clientes (participante pode ou não estar vinculado a um cliente)
    LEFT JOIN public.clientes c 
        ON ap.cliente_id = c.id
    
    -- Join com finalizadoras (participante pode ou não ter finalizadora)
    LEFT JOIN public.finalizadoras f 
        ON ap.finalizadora_id = f.id

ORDER BY 
    a.inicio DESC,
    a.codigo DESC,
    ap.nome ASC;

-- Comentários da view
COMMENT ON VIEW public.v_agendamentos_detalhado IS 
'View detalhada dos agendamentos com participantes e finalizadoras. 
Cada linha representa um participante do agendamento. 
Agendamentos sem participantes também aparecem (com dados de participante NULL).';


-- EXEMPLOS DE QUERIES ÚTEIS:

-- 1. Ver agendamentos com seus participantes e formas de pagamento
-- SELECT 
--     agendamento_codigo,
--     inicio,
--     quadra_nome,
--     participante_nome,
--     valor_cota,
--     status_pagamento_legivel,
--     finalizadora_nome,
--     finalizadora_tipo
-- FROM v_agendamentos_detalhado
-- WHERE codigo_empresa = 'SUA_EMPRESA'
-- ORDER BY inicio DESC;

-- 2. Total pago por finalizadora
-- SELECT 
--     finalizadora_nome,
--     finalizadora_tipo,
--     COUNT(*) AS quantidade_pagamentos,
--     SUM(valor_pago) AS total_recebido
-- FROM v_agendamentos_detalhado
-- WHERE status_pagamento = 'Pago'
--     AND codigo_empresa = 'SUA_EMPRESA'
-- GROUP BY finalizadora_nome, finalizadora_tipo
-- ORDER BY total_recebido DESC;

-- 3. Agendamentos com pagamento pendente
-- SELECT 
--     agendamento_codigo,
--     inicio,
--     quadra_nome,
--     participante_nome,
--     valor_cota AS valor_pendente,
--     cliente_telefone
-- FROM v_agendamentos_detalhado
-- WHERE status_pagamento = 'Pendente'
--     AND codigo_empresa = 'SUA_EMPRESA'
-- ORDER BY inicio DESC;

-- 4. Resumo de pagamentos por agendamento
-- SELECT 
--     agendamento_codigo,
--     inicio,
--     quadra_nome,
--     COUNT(participante_id) AS total_participantes,
--     SUM(valor_cota) AS valor_total,
--     SUM(valor_pago) AS total_pago,
--     SUM(valor_pendente) AS total_pendente,
--     STRING_AGG(
--         participante_nome || ' (' || status_pagamento_legivel || ')', 
--         ', '
--     ) AS participantes_status
-- FROM v_agendamentos_detalhado
-- WHERE codigo_empresa = 'SUA_EMPRESA'
-- GROUP BY agendamento_codigo, inicio, quadra_nome
-- ORDER BY inicio DESC;

-- 5. Participantes que mais pagam (top clientes)
-- SELECT 
--     participante_nome,
--     cliente_telefone,
--     COUNT(*) AS total_agendamentos,
--     SUM(valor_pago) AS total_gasto,
--     STRING_AGG(DISTINCT finalizadora_nome, ', ') AS formas_pagamento_usadas
-- FROM v_agendamentos_detalhado
-- WHERE status_pagamento = 'Pago'
--     AND codigo_empresa = 'SUA_EMPRESA'
-- GROUP BY participante_nome, cliente_telefone
-- ORDER BY total_gasto DESC
-- LIMIT 10;
