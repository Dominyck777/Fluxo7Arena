
CREATE VIEW public.v_agendamento_participantes AS
 SELECT ap.id,
    ap.agendamento_id,
    ap.codigo_empresa,
    ap.cliente_id,
    c.nome,
    ap.valor_cota,
    (ap.status_pagamento)::text AS status_pagamento_text,
    ap.status_pagamento
   FROM (public.agendamento_participantes ap
     JOIN public.clientes c ON ((c.id = ap.cliente_id)));




CREATE VIEW public.v_agendamentos_detalhado AS
 SELECT a.id AS agendamento_id,
    a.codigo AS agendamento_codigo,
    a.codigo_empresa,
    a.inicio,
    a.fim,
    a.modalidade,
    a.status AS agendamento_status,
    a.valor_total AS valor_total_agendamento,
    a.criado_em AS agendamento_criado_em,
    q.id AS quadra_id,
    q.nome AS quadra_nome,
    ap.id AS participante_id,
    ap.cliente_id,
    ap.nome AS participante_nome,
    ap.valor_cota,
    ap.status_pagamento,
    ap.pago_em,
    ap.metodo_pagamento,
    ap.created_at AS participante_criado_em,
    ap.updated_at AS participante_atualizado_em,
    c.nome AS cliente_nome_completo,
    c.cpf AS cliente_cpf,
    c.telefone AS cliente_telefone,
    c.email AS cliente_email,
    f.id AS finalizadora_id,
    f.nome AS finalizadora_nome,
    f.tipo AS finalizadora_tipo,
    f.taxa_percentual AS finalizadora_taxa,
        CASE
            WHEN (ap.status_pagamento OPERATOR(public.=) 'Pago'::text) THEN ap.valor_cota
            ELSE (0)::numeric
        END AS valor_pago,
        CASE
            WHEN (ap.status_pagamento OPERATOR(public.=) 'Pendente'::text) THEN ap.valor_cota
            ELSE (0)::numeric
        END AS valor_pendente,
    (EXTRACT(epoch FROM (a.fim - a.inicio)) / (60)::numeric) AS duracao_minutos,
        CASE ap.status_pagamento
            WHEN 'Pago'::text THEN 'âœ… Pago'::text
            WHEN 'Pendente'::text THEN 'â³ Pendente'::text
            WHEN 'Cancelado'::text THEN 'âŒ Cancelado'::text
            ELSE (ap.status_pagamento)::text
        END AS status_pagamento_legivel
   FROM ((((public.agendamentos a
     LEFT JOIN public.quadras q ON ((a.quadra_id = q.id)))
     LEFT JOIN public.agendamento_participantes ap ON ((a.id = ap.agendamento_id)))
     LEFT JOIN public.clientes c ON ((ap.cliente_id = c.id)))
     LEFT JOIN public.finalizadoras f ON ((ap.finalizadora_id = f.id)))
  ORDER BY a.inicio DESC, a.codigo DESC, ap.nome;




CREATE VIEW public.v_agendamentos_isis AS
 SELECT a.id AS agendamento_id,
    a.codigo AS agendamento_codigo,
    a.codigo_empresa,
    a.inicio,
    a.fim,
    a.modalidade,
    a.status AS agendamento_status,
    q.id AS quadra_id,
    q.nome AS quadra_nome,
    ( SELECT p.nome
           FROM public.agendamento_participantes p
          WHERE ((p.agendamento_id = a.id) AND ((p.codigo_empresa)::text = a.codigo_empresa))
          ORDER BY (p.nome ~~* 'cliente consumidor%'::text), p.created_at
         LIMIT 1) AS representante_nome,
    ( SELECT count(*) AS count
           FROM public.agendamento_participantes p
          WHERE ((p.agendamento_id = a.id) AND ((p.codigo_empresa)::text = a.codigo_empresa))) AS participantes_total,
    ( SELECT count(*) AS count
           FROM public.agendamento_participantes p
          WHERE ((p.agendamento_id = a.id) AND ((p.codigo_empresa)::text = a.codigo_empresa) AND (p.status_pagamento OPERATOR(public.=) 'Pago'::text))) AS participantes_pagos,
    ( SELECT count(*) AS count
           FROM public.agendamento_participantes p
          WHERE ((p.agendamento_id = a.id) AND ((p.codigo_empresa)::text = a.codigo_empresa) AND (p.status_pagamento OPERATOR(public.=) 'Pendente'::text))) AS participantes_pendentes
   FROM (public.agendamentos a
     JOIN public.quadras q ON (((q.id = a.quadra_id) AND (q.codigo_empresa = a.codigo_empresa))));




COMMENT ON VIEW public.v_agendamentos_detalhado IS 'View detalhada dos agendamentos com participantes e finalizadoras. 
Cada linha representa um participante do agendamento. 
Agendamentos sem participantes tambÃ©m aparecem (com dados de participante NULL).';



