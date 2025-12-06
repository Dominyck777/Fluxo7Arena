--
-- PostgreSQL database dump
--

\restrict xphx7gwY9Bsk7YcBsp8udCbC8fGxGTSbNZSxcs7C2Le90K7rLXYVkMgfboEDGmp

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS vendas_update_empresa ON public.vendas;
DROP POLICY IF EXISTS vendas_select_empresa ON public.vendas;
DROP POLICY IF EXISTS vendas_insert_empresa ON public.vendas;
DROP POLICY IF EXISTS vendas_delete_empresa ON public.vendas;
DROP POLICY IF EXISTS usuarios_select_self ON public.usuarios;
DROP POLICY IF EXISTS quadras_update_policy ON public.quadras;
DROP POLICY IF EXISTS quadras_update_company ON public.quadras;
DROP POLICY IF EXISTS quadras_select_policy ON public.quadras;
DROP POLICY IF EXISTS quadras_select_company ON public.quadras;
DROP POLICY IF EXISTS quadras_insert_policy ON public.quadras;
DROP POLICY IF EXISTS quadras_insert_company ON public.quadras;
DROP POLICY IF EXISTS quadras_delete_policy ON public.quadras;
DROP POLICY IF EXISTS quadras_delete_company ON public.quadras;
DROP POLICY IF EXISTS produtos_update_company ON public.produtos;
DROP POLICY IF EXISTS produtos_select_company ON public.produtos;
DROP POLICY IF EXISTS produtos_insert_company ON public.produtos;
DROP POLICY IF EXISTS produtos_delete_company ON public.produtos;
DROP POLICY IF EXISTS produto_categorias_update ON public.produto_categorias;
DROP POLICY IF EXISTS produto_categorias_select ON public.produto_categorias;
DROP POLICY IF EXISTS produto_categorias_insert ON public.produto_categorias;
DROP POLICY IF EXISTS produto_categorias_delete ON public.produto_categorias;
DROP POLICY IF EXISTS pagamentos_update_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_select_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_delete_by_company ON public.pagamentos;
DROP POLICY IF EXISTS mesas_update_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_select_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_insert_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_delete_by_company ON public.mesas;
DROP POLICY IF EXISTS itens_venda_update_empresa ON public.itens_venda;
DROP POLICY IF EXISTS itens_venda_select_empresa ON public.itens_venda;
DROP POLICY IF EXISTS itens_venda_insert_empresa ON public.itens_venda;
DROP POLICY IF EXISTS itens_venda_delete_empresa ON public.itens_venda;
DROP POLICY IF EXISTS finalizadoras_update_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_select_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_insert_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_delete_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS empresas_update_user_company ON public.empresas;
DROP POLICY IF EXISTS empresas_select_user_company ON public.empresas;
DROP POLICY IF EXISTS empresas_by_company ON public.empresas;
DROP POLICY IF EXISTS contas_receber_update ON public.contas_receber;
DROP POLICY IF EXISTS contas_receber_select ON public.contas_receber;
DROP POLICY IF EXISTS contas_receber_insert ON public.contas_receber;
DROP POLICY IF EXISTS contas_receber_delete ON public.contas_receber;
DROP POLICY IF EXISTS contas_receber_baixas_update ON public.contas_receber_baixas;
DROP POLICY IF EXISTS contas_receber_baixas_select ON public.contas_receber_baixas;
DROP POLICY IF EXISTS contas_receber_baixas_insert ON public.contas_receber_baixas;
DROP POLICY IF EXISTS contas_receber_baixas_delete ON public.contas_receber_baixas;
DROP POLICY IF EXISTS contas_pagar_update ON public.contas_pagar;
DROP POLICY IF EXISTS contas_pagar_select ON public.contas_pagar;
DROP POLICY IF EXISTS contas_pagar_insert ON public.contas_pagar;
DROP POLICY IF EXISTS contas_pagar_delete ON public.contas_pagar;
DROP POLICY IF EXISTS contas_pagar_baixas_update ON public.contas_pagar_baixas;
DROP POLICY IF EXISTS contas_pagar_baixas_select ON public.contas_pagar_baixas;
DROP POLICY IF EXISTS contas_pagar_baixas_insert ON public.contas_pagar_baixas;
DROP POLICY IF EXISTS contas_pagar_baixas_delete ON public.contas_pagar_baixas;
DROP POLICY IF EXISTS comandas_update_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_select_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_insert_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_delete_by_company ON public.comandas;
DROP POLICY IF EXISTS comanda_itens_update_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_select_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_insert_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_delete_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_clientes_update_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_select_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_insert_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_delete_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS colaboradores_update_company ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_select_company ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_insert_company ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_delete_company ON public.colaboradores;
DROP POLICY IF EXISTS clientes_update_policy ON public.clientes;
DROP POLICY IF EXISTS clientes_update_company ON public.clientes;
DROP POLICY IF EXISTS clientes_select_policy ON public.clientes;
DROP POLICY IF EXISTS clientes_select_company ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_policy ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_company ON public.clientes;
DROP POLICY IF EXISTS clientes_delete_policy ON public.clientes;
DROP POLICY IF EXISTS clientes_delete_company ON public.clientes;
DROP POLICY IF EXISTS caixa_sessoes_update_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_select_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_insert_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_delete_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_resumos_update ON public.caixa_resumos;
DROP POLICY IF EXISTS caixa_resumos_select ON public.caixa_resumos;
DROP POLICY IF EXISTS caixa_resumos_insert ON public.caixa_resumos;
DROP POLICY IF EXISTS caixa_resumos_delete ON public.caixa_resumos;
DROP POLICY IF EXISTS caixa_movimentos_rls_all ON public.caixa_movimentos;
DROP POLICY IF EXISTS caixa_movimentacoes_update_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_select_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_insert_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_delete_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_mov_update ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_mov_select ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_mov_insert ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_mov_delete ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS agendamentos_update_policy ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_select_policy ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_insert_policy ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_delete_policy ON public.agendamentos;
DROP POLICY IF EXISTS agendamento_participantes_update_policy ON public.agendamento_participantes;
DROP POLICY IF EXISTS agendamento_participantes_select_policy ON public.agendamento_participantes;
DROP POLICY IF EXISTS agendamento_participantes_insert_policy ON public.agendamento_participantes;
DROP POLICY IF EXISTS agendamento_participantes_delete_policy ON public.agendamento_participantes;
DROP POLICY IF EXISTS agenda_settings_update_company ON public.agenda_settings;
DROP POLICY IF EXISTS agenda_settings_select_company ON public.agenda_settings;
DROP POLICY IF EXISTS agenda_settings_insert_company ON public.agenda_settings;
DROP POLICY IF EXISTS agenda_settings_delete_company ON public.agenda_settings;
DROP POLICY IF EXISTS ag_update_by_company ON public.agendamentos;
DROP POLICY IF EXISTS ag_select_by_company ON public.agendamentos;
DROP POLICY IF EXISTS ag_participantes_update_company ON public.agendamento_participantes;
DROP POLICY IF EXISTS ag_participantes_select_company ON public.agendamento_participantes;
DROP POLICY IF EXISTS ag_participantes_insert_company ON public.agendamento_participantes;
DROP POLICY IF EXISTS ag_participantes_delete_company ON public.agendamento_participantes;
DROP POLICY IF EXISTS ag_insert_by_company ON public.agendamentos;
DROP POLICY IF EXISTS ag_delete_by_company ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários podem ver resumos de caixa da sua empresa" ON public.caixa_resumos;
DROP POLICY IF EXISTS "Usuários podem ver movimentações de caixa da sua empresa" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Usuários podem ver itens de compras da própria empresa" ON public.compras_itens;
DROP POLICY IF EXISTS "Usuários podem ver compras da própria empresa" ON public.compras;
DROP POLICY IF EXISTS "Usuários podem inserir itens de compras da própria empresa" ON public.compras_itens;
DROP POLICY IF EXISTS "Usuários podem inserir compras na própria empresa" ON public.compras;
DROP POLICY IF EXISTS "Usuários podem deletar resumos de caixa da sua empresa" ON public.caixa_resumos;
DROP POLICY IF EXISTS "Usuários podem deletar movimentações de caixa da sua empresa" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Usuários podem deletar itens de compras da própria empresa" ON public.compras_itens;
DROP POLICY IF EXISTS "Usuários podem deletar compras da própria empresa" ON public.compras;
DROP POLICY IF EXISTS "Usuários podem criar resumos de caixa na sua empresa" ON public.caixa_resumos;
DROP POLICY IF EXISTS "Usuários podem criar movimentações de caixa na sua empresa" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar resumos de caixa da sua empresa" ON public.caixa_resumos;
DROP POLICY IF EXISTS "Usuários podem atualizar movimentações de caixa da sua empre" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar itens de compras da própria empresa" ON public.compras_itens;
DROP POLICY IF EXISTS "Usuários podem atualizar compras da própria empresa" ON public.compras;
DROP POLICY IF EXISTS "Usuarios podem ler counters da propria empresa" ON public.empresa_counters;
DROP POLICY IF EXISTS "Usuarios podem gerenciar dias de funcionamento da propria empre" ON public.quadras_dias_funcionamento;
DROP POLICY IF EXISTS "Usuarios podem criar counters da propria empresa" ON public.empresa_counters;
DROP POLICY IF EXISTS "Usuarios podem atualizar counters da propria empresa" ON public.empresa_counters;
DROP POLICY IF EXISTS "Users can view their company agenda settings" ON public.agenda_settings;
DROP POLICY IF EXISTS "Users can update their company agenda settings" ON public.agenda_settings;
DROP POLICY IF EXISTS "Users can manage own ui settings" ON public.user_ui_settings;
DROP POLICY IF EXISTS "Users can delete their company agenda settings" ON public.agenda_settings;
DROP POLICY IF EXISTS "Users can create their company agenda settings" ON public.agenda_settings;
DROP POLICY IF EXISTS "Isis pode ler quadras" ON public.quadras;
DROP POLICY IF EXISTS "Isis pode ler dias funcionamento" ON public.quadras_dias_funcionamento;
DROP POLICY IF EXISTS "Isis pode criar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Isis pode buscar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can read companies" ON public.empresas;
DROP POLICY IF EXISTS "Allow public read by codigo_empresa" ON public.clientes;
DROP POLICY IF EXISTS "Allow public read agendamentos by codigo_empresa" ON public.agendamentos;
DROP POLICY IF EXISTS "Allow public insert usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Allow public insert quadras" ON public.quadras;
DROP POLICY IF EXISTS "Allow public insert produto_categorias" ON public.produto_categorias;
DROP POLICY IF EXISTS "Allow public insert colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Allow public insert agendamentos by codigo_empresa" ON public.agendamentos;
DROP POLICY IF EXISTS "Allow public insert agendamento_participantes by codigo_empresa" ON public.agendamento_participantes;
DROP POLICY IF EXISTS "Allow public insert agenda_settings" ON public.agenda_settings;
DROP POLICY IF EXISTS "Allow insert new companies" ON public.empresas;
DROP POLICY IF EXISTS "Allow anonymous read access to quadras" ON public.quadras;
DROP POLICY IF EXISTS "Acesso publico empresa_counters" ON public.empresa_counters;
ALTER TABLE IF EXISTS ONLY public.vendas DROP CONSTRAINT IF EXISTS vendas_company_code_fkey;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_codigo_empresa_fkey;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_ui_settings DROP CONSTRAINT IF EXISTS user_ui_settings_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vendas DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.itens_venda DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE IF EXISTS ONLY public.itens_venda DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.quadras_dias_funcionamento DROP CONSTRAINT IF EXISTS quadras_dias_funcionamento_quadra_id_fkey;
ALTER TABLE IF EXISTS ONLY public.quadras DROP CONSTRAINT IF EXISTS quadras_codigo_empresa_fkey;
ALTER TABLE IF EXISTS ONLY public.produtos DROP CONSTRAINT IF EXISTS produtos_fornecedor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.produtos DROP CONSTRAINT IF EXISTS produtos_company_code_fkey;
ALTER TABLE IF EXISTS ONLY public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_finalizadora_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_comanda_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_caixa_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagamentos DROP CONSTRAINT IF EXISTS fk_pagamentos_finalizadora;
ALTER TABLE IF EXISTS ONLY public.pagamentos DROP CONSTRAINT IF EXISTS fk_pagamentos_caixa;
ALTER TABLE IF EXISTS ONLY public.movimentos_saldo DROP CONSTRAINT IF EXISTS fk_mov_saldo_cliente;
ALTER TABLE IF EXISTS ONLY public.movimentos_saldo DROP CONSTRAINT IF EXISTS fk_mov_saldo_agendamento;
ALTER TABLE IF EXISTS ONLY public.comandas DROP CONSTRAINT IF EXISTS fk_comandas_mesa;
ALTER TABLE IF EXISTS ONLY public.comanda_itens DROP CONSTRAINT IF EXISTS fk_comanda_itens_produto;
ALTER TABLE IF EXISTS ONLY public.comanda_itens DROP CONSTRAINT IF EXISTS fk_comanda_itens_comanda;
ALTER TABLE IF EXISTS ONLY public.comanda_clientes DROP CONSTRAINT IF EXISTS fk_comanda_clientes_cliente;
ALTER TABLE IF EXISTS ONLY public.agendamento_participantes DROP CONSTRAINT IF EXISTS fk_agp_cliente;
ALTER TABLE IF EXISTS ONLY public.estoque_reservado DROP CONSTRAINT IF EXISTS estoque_reservado_produto_id_fkey;
ALTER TABLE IF EXISTS ONLY public.estoque_reservado DROP CONSTRAINT IF EXISTS estoque_reservado_comanda_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_receber_baixas DROP CONSTRAINT IF EXISTS contas_receber_baixas_pagamento_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_receber_baixas DROP CONSTRAINT IF EXISTS contas_receber_baixas_finalizadora_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_receber_baixas DROP CONSTRAINT IF EXISTS contas_receber_baixas_conta_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_fornecedor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_pagar_baixas DROP CONSTRAINT IF EXISTS contas_pagar_baixas_conta_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contas_pagar_baixas DROP CONSTRAINT IF EXISTS contas_pagar_baixas_caixa_movimentacao_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compras_itens DROP CONSTRAINT IF EXISTS compras_itens_produto_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compras_itens DROP CONSTRAINT IF EXISTS compras_itens_compra_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compras DROP CONSTRAINT IF EXISTS compras_inativado_por_fkey;
ALTER TABLE IF EXISTS ONLY public.compras DROP CONSTRAINT IF EXISTS compras_fornecedor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compras DROP CONSTRAINT IF EXISTS compras_criado_por_fkey;
ALTER TABLE IF EXISTS ONLY public.comandas DROP CONSTRAINT IF EXISTS comandas_mesa_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comanda_itens DROP CONSTRAINT IF EXISTS comanda_itens_produto_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comanda_itens DROP CONSTRAINT IF EXISTS comanda_itens_comanda_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comanda_historico DROP CONSTRAINT IF EXISTS comanda_historico_comanda_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comanda_clientes DROP CONSTRAINT IF EXISTS comanda_clientes_comanda_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comanda_clientes DROP CONSTRAINT IF EXISTS comanda_clientes_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.colaboradores DROP CONSTRAINT IF EXISTS colaboradores_codigo_empresa_fkey;
ALTER TABLE IF EXISTS ONLY public.clientes DROP CONSTRAINT IF EXISTS clientes_codigo_empresa_fkey;
ALTER TABLE IF EXISTS ONLY public.caixa_resumos DROP CONSTRAINT IF EXISTS caixa_resumos_caixa_sessao_id_fkey;
ALTER TABLE IF EXISTS ONLY public.caixa_movimentos DROP CONSTRAINT IF EXISTS caixa_movimentos_caixa_id_fkey;
ALTER TABLE IF EXISTS ONLY public.caixa_movimentacoes DROP CONSTRAINT IF EXISTS caixa_movimentacoes_caixa_sessao_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamentos DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamentos DROP CONSTRAINT IF EXISTS bookings_court_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamento_participantes DROP CONSTRAINT IF EXISTS agp_finalizadora_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamento_participantes DROP CONSTRAINT IF EXISTS agp_codigo_empresa_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_codigo_empresa_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamento_participantes DROP CONSTRAINT IF EXISTS agendamento_participantes_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agendamento_participantes DROP CONSTRAINT IF EXISTS agendamento_participantes_agendamento_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agenda_settings DROP CONSTRAINT IF EXISTS agenda_settings_empresa_id_fkey;
DROP TRIGGER IF EXISTS zz_clientes_set_codigo ON public.clientes;
DROP TRIGGER IF EXISTS zz_agendamentos_set_codigo ON public.agendamentos;
DROP TRIGGER IF EXISTS trigger_update_compras_timestamp ON public.compras;
DROP TRIGGER IF EXISTS trigger_registrar_historico_comanda ON public.comandas;
DROP TRIGGER IF EXISTS trigger_atualizar_ultima_atualizacao_item ON public.comanda_itens;
DROP TRIGGER IF EXISTS trigger_atualizar_ultima_atualizacao_comanda ON public.comandas;
DROP TRIGGER IF EXISTS trg_set_company_code_pagamentos ON public.pagamentos;
DROP TRIGGER IF EXISTS trg_set_company_code_mesas ON public.mesas;
DROP TRIGGER IF EXISTS trg_set_company_code_finalizadoras ON public.finalizadoras;
DROP TRIGGER IF EXISTS trg_set_company_code_comandas ON public.comandas;
DROP TRIGGER IF EXISTS trg_set_company_code_comanda_itens ON public.comanda_itens;
DROP TRIGGER IF EXISTS trg_set_company_code_comanda_clientes ON public.comanda_clientes;
DROP TRIGGER IF EXISTS trg_set_company_code_caixa ON public.caixa_sessoes;
DROP TRIGGER IF EXISTS trg_quadras_dias_funcionamento_updated_at ON public.quadras_dias_funcionamento;
DROP TRIGGER IF EXISTS trg_protect_consumidor_final ON public.clientes;
DROP TRIGGER IF EXISTS trg_produtos_set_company_code ON public.produtos;
DROP TRIGGER IF EXISTS trg_produtos_normalize ON public.produtos;
DROP TRIGGER IF EXISTS trg_produtos_autocode ON public.produtos;
DROP TRIGGER IF EXISTS trg_produto_categorias_touch ON public.produto_categorias;
DROP TRIGGER IF EXISTS trg_produto_categorias_set_empresa ON public.produto_categorias;
DROP TRIGGER IF EXISTS trg_pagamentos_updated_at ON public.pagamentos;
DROP TRIGGER IF EXISTS trg_mov_saldo_apply ON public.movimentos_saldo;
DROP TRIGGER IF EXISTS trg_mesas_updated_at ON public.mesas;
DROP TRIGGER IF EXISTS trg_finalizadoras_updated_at ON public.finalizadoras;
DROP TRIGGER IF EXISTS trg_contas_receber_set_updated_at ON public.contas_receber;
DROP TRIGGER IF EXISTS trg_contas_pagar_set_updated_at ON public.contas_pagar;
DROP TRIGGER IF EXISTS trg_comandas_updated_at ON public.comandas;
DROP TRIGGER IF EXISTS trg_comanda_itens_updated_at ON public.comanda_itens;
DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON public.colaboradores;
DROP TRIGGER IF EXISTS trg_clientes_set_timestamp ON public.clientes;
DROP TRIGGER IF EXISTS trg_caixa_sessoes_updated_at ON public.caixa_sessoes;
DROP TRIGGER IF EXISTS trg_caixa_movimentos_updated_at ON public.caixa_movimentos;
DROP TRIGGER IF EXISTS trg_baixa_estoque_on_close ON public.comandas;
DROP TRIGGER IF EXISTS trg_agenda_settings_set_updated_at ON public.agenda_settings;
DROP TRIGGER IF EXISTS trg_ag_participantes_set_empresa ON public.agendamento_participantes;
DROP TRIGGER IF EXISTS set_updated_at_agp ON public.agendamento_participantes;
DROP TRIGGER IF EXISTS clientes_set_timestamp ON public.clientes;
DROP TRIGGER IF EXISTS clientes_set_empresa_from_user ON public.clientes;
DROP TRIGGER IF EXISTS agendamentos_set_empresa_from_user ON public.agendamentos;
DROP INDEX IF EXISTS public.ux_produtos_empresa_codigo_produto;
DROP INDEX IF EXISTS public.ux_produto_categorias_empresa_nome;
DROP INDEX IF EXISTS public.ux_agendamentos_empresa_codigo;
DROP INDEX IF EXISTS public.usuarios_codigo_empresa_idx;
DROP INDEX IF EXISTS public.uq_mesas_empresa_numero;
DROP INDEX IF EXISTS public.uq_finalizadoras_empresa_nome;
DROP INDEX IF EXISTS public.uq_clientes_empresa_email_lower;
DROP INDEX IF EXISTS public.uq_clientes_empresa_cpf;
DROP INDEX IF EXISTS public.uq_clientes_empresa_codigo;
DROP INDEX IF EXISTS public.uq_caixa_aberto_por_empresa;
DROP INDEX IF EXISTS public.quadras_codigo_empresa_idx;
DROP INDEX IF EXISTS public.produtos_codigo_empresa_nome_unidade_unique;
DROP INDEX IF EXISTS public.idx_vendas_empresa_status;
DROP INDEX IF EXISTS public.idx_vendas_criado_em;
DROP INDEX IF EXISTS public.idx_quadras_dias_funcionamento_quadra_dia_semana;
DROP INDEX IF EXISTS public.idx_quadras_dias_funcionamento_quadra_data_fechamento;
DROP INDEX IF EXISTS public.idx_quadras_dias_funcionamento_quadra;
DROP INDEX IF EXISTS public.idx_quadras_dias_funcionamento_empresa;
DROP INDEX IF EXISTS public.idx_quadras_dias_funcionamento_data;
DROP INDEX IF EXISTS public.idx_produtos_xml_chave;
DROP INDEX IF EXISTS public.idx_produtos_ncm;
DROP INDEX IF EXISTS public.idx_produtos_marca;
DROP INDEX IF EXISTS public.idx_produtos_importados;
DROP INDEX IF EXISTS public.idx_produtos_importado_via_xml;
DROP INDEX IF EXISTS public.idx_produtos_grupo;
DROP INDEX IF EXISTS public.idx_produtos_fornecedor;
DROP INDEX IF EXISTS public.idx_produtos_codigo_empresa;
DROP INDEX IF EXISTS public.idx_produtos_codigo_barras;
DROP INDEX IF EXISTS public.idx_produtos_categoria;
DROP INDEX IF EXISTS public.idx_pagamentos_xml_chave;
DROP INDEX IF EXISTS public.idx_pagamentos_recebido_em;
DROP INDEX IF EXISTS public.idx_pagamentos_origem;
DROP INDEX IF EXISTS public.idx_pagamentos_finalizadora;
DROP INDEX IF EXISTS public.idx_pagamentos_empresa;
DROP INDEX IF EXISTS public.idx_pagamentos_comanda_id;
DROP INDEX IF EXISTS public.idx_pagamentos_comanda;
DROP INDEX IF EXISTS public.idx_pagamentos_codigo_empresa;
DROP INDEX IF EXISTS public.idx_pagamentos_caixa;
DROP INDEX IF EXISTS public.idx_mov_saldo_empresa;
DROP INDEX IF EXISTS public.idx_mov_saldo_cliente;
DROP INDEX IF EXISTS public.idx_mov_saldo_agendamento;
DROP INDEX IF EXISTS public.idx_mesas_nome;
DROP INDEX IF EXISTS public.idx_mesas_empresa;
DROP INDEX IF EXISTS public.idx_mesas_codigo_empresa;
DROP INDEX IF EXISTS public.idx_itens_venda_empresa;
DROP INDEX IF EXISTS public.idx_finalizadoras_ordem;
DROP INDEX IF EXISTS public.idx_finalizadoras_empresa;
DROP INDEX IF EXISTS public.idx_finalizadoras_codigo_sefaz;
DROP INDEX IF EXISTS public.idx_finalizadoras_codigo;
DROP INDEX IF EXISTS public.idx_finalizadoras_ativo;
DROP INDEX IF EXISTS public.idx_estoque_reservado_produto_id;
DROP INDEX IF EXISTS public.idx_estoque_reservado_comanda_id;
DROP INDEX IF EXISTS public.idx_estoque_reservado_ativo;
DROP INDEX IF EXISTS public.idx_cr_baixas_empresa_data;
DROP INDEX IF EXISTS public.idx_cr_baixas_empresa_conta;
DROP INDEX IF EXISTS public.idx_cp_baixas_empresa_data;
DROP INDEX IF EXISTS public.idx_cp_baixas_empresa_conta;
DROP INDEX IF EXISTS public.idx_contas_receber_empresa_vencimento;
DROP INDEX IF EXISTS public.idx_contas_receber_empresa_status;
DROP INDEX IF EXISTS public.idx_contas_receber_empresa_cliente;
DROP INDEX IF EXISTS public.idx_contas_pagar_empresa_vencimento;
DROP INDEX IF EXISTS public.idx_contas_pagar_empresa_status;
DROP INDEX IF EXISTS public.idx_contas_pagar_empresa_fornecedor;
DROP INDEX IF EXISTS public.idx_compras_status;
DROP INDEX IF EXISTS public.idx_compras_itens_selecionado;
DROP INDEX IF EXISTS public.idx_compras_itens_produto;
DROP INDEX IF EXISTS public.idx_compras_itens_compra;
DROP INDEX IF EXISTS public.idx_compras_fornecedor;
DROP INDEX IF EXISTS public.idx_compras_empresa_modelo_nfe;
DROP INDEX IF EXISTS public.idx_compras_empresa_ativo;
DROP INDEX IF EXISTS public.idx_compras_empresa;
DROP INDEX IF EXISTS public.idx_compras_data_emissao;
DROP INDEX IF EXISTS public.idx_compras_chave_nfe;
DROP INDEX IF EXISTS public.idx_compras_ativo;
DROP INDEX IF EXISTS public.idx_comandas_xml_chave;
DROP INDEX IF EXISTS public.idx_comandas_vendedor_id;
DROP INDEX IF EXISTS public.idx_comandas_ultima_atualizacao;
DROP INDEX IF EXISTS public.idx_comandas_origem;
DROP INDEX IF EXISTS public.idx_comandas_mesa_status;
DROP INDEX IF EXISTS public.idx_comandas_mesa;
DROP INDEX IF EXISTS public.idx_comandas_fechado_em;
DROP INDEX IF EXISTS public.idx_comandas_empresa_status;
DROP INDEX IF EXISTS public.idx_comandas_empresa_fechado;
DROP INDEX IF EXISTS public.idx_comandas_desconto_tipo;
DROP INDEX IF EXISTS public.idx_comandas_codigo_empresa;
DROP INDEX IF EXISTS public.idx_comandas_agendamento_id;
DROP INDEX IF EXISTS public.idx_comandas_aberto_em;
DROP INDEX IF EXISTS public.idx_comanda_itens_produto;
DROP INDEX IF EXISTS public.idx_comanda_itens_empresa;
DROP INDEX IF EXISTS public.idx_comanda_itens_desconto_tipo;
DROP INDEX IF EXISTS public.idx_comanda_itens_comanda_id;
DROP INDEX IF EXISTS public.idx_comanda_itens_comanda;
DROP INDEX IF EXISTS public.idx_comanda_itens_codigo_empresa;
DROP INDEX IF EXISTS public.idx_comanda_historico_tipo;
DROP INDEX IF EXISTS public.idx_comanda_historico_comanda_id;
DROP INDEX IF EXISTS public.idx_comanda_historico_codigo_empresa;
DROP INDEX IF EXISTS public.idx_comanda_clientes_empresa;
DROP INDEX IF EXISTS public.idx_comanda_clientes_comanda;
DROP INDEX IF EXISTS public.idx_comanda_clientes_cliente;
DROP INDEX IF EXISTS public.idx_colaboradores_codigo_empresa;
DROP INDEX IF EXISTS public.idx_colaboradores_ativo;
DROP INDEX IF EXISTS public.idx_clientes_empresa_telefone;
DROP INDEX IF EXISTS public.idx_clientes_empresa_nome;
DROP INDEX IF EXISTS public.idx_clientes_empresa_aniversario;
DROP INDEX IF EXISTS public.idx_clientes_consumidor_final;
DROP INDEX IF EXISTS public.idx_caixa_sessoes_empresa_status;
DROP INDEX IF EXISTS public.idx_caixa_sessoes_empresa;
DROP INDEX IF EXISTS public.idx_caixa_resumos_sessao_criado_em;
DROP INDEX IF EXISTS public.idx_caixa_resumos_periodo;
DROP INDEX IF EXISTS public.idx_caixa_resumos_empresa_sessao;
DROP INDEX IF EXISTS public.idx_caixa_movimentos_empresa;
DROP INDEX IF EXISTS public.idx_caixa_movimentos_caixa;
DROP INDEX IF EXISTS public.idx_caixa_mov_tipo;
DROP INDEX IF EXISTS public.idx_caixa_mov_empresa_sessao;
DROP INDEX IF EXISTS public.idx_caixa_empresa;
DROP INDEX IF EXISTS public.idx_agp_finalizadora;
DROP INDEX IF EXISTS public.idx_agp_codigo_empresa;
DROP INDEX IF EXISTS public.idx_agp_agendamento;
DROP INDEX IF EXISTS public.idx_agendamento_participantes_ordem;
DROP INDEX IF EXISTS public.gin_trgm_clientes_telefone;
DROP INDEX IF EXISTS public.gin_trgm_clientes_nome;
DROP INDEX IF EXISTS public.gin_trgm_clientes_email;
DROP INDEX IF EXISTS public.compras_chave_nfe_ativa_unique;
DROP INDEX IF EXISTS public.companies_code_idx;
DROP INDEX IF EXISTS public.comanda_clientes_empresa_idx;
DROP INDEX IF EXISTS public.comanda_clientes_comanda_idx;
DROP INDEX IF EXISTS public.comanda_clientes_cliente_idx;
DROP INDEX IF EXISTS public.colaboradores_codigo_empresa_idx;
DROP INDEX IF EXISTS public.clientes_codigo_empresa_idx;
DROP INDEX IF EXISTS public.agendamentos_codigo_empresa_idx;
DROP INDEX IF EXISTS public.agendamento_participantes_agendamento_id_idx;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.user_ui_settings DROP CONSTRAINT IF EXISTS user_ui_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.colaboradores DROP CONSTRAINT IF EXISTS user_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.vendas DROP CONSTRAINT IF EXISTS sales_pkey;
ALTER TABLE IF EXISTS ONLY public.itens_venda DROP CONSTRAINT IF EXISTS sale_items_pkey;
ALTER TABLE IF EXISTS ONLY public.quadras_dias_funcionamento DROP CONSTRAINT IF EXISTS quadras_dias_funcionamento_pkey;
ALTER TABLE IF EXISTS ONLY public.produto_categorias DROP CONSTRAINT IF EXISTS produto_categorias_pkey;
ALTER TABLE IF EXISTS ONLY public.produtos DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_pkey;
ALTER TABLE IF EXISTS ONLY public.movimentos_saldo DROP CONSTRAINT IF EXISTS movimentos_saldo_pkey;
ALTER TABLE IF EXISTS ONLY public.mesas DROP CONSTRAINT IF EXISTS mesas_pkey;
ALTER TABLE IF EXISTS ONLY public.mesas DROP CONSTRAINT IF EXISTS mesas_codigo_empresa_numero_key;
ALTER TABLE IF EXISTS ONLY public.finalizadoras DROP CONSTRAINT IF EXISTS finalizadoras_pkey;
ALTER TABLE IF EXISTS ONLY public.finalizadoras DROP CONSTRAINT IF EXISTS finalizadoras_empresa_nome_unique;
ALTER TABLE IF EXISTS ONLY public.estoque_reservado DROP CONSTRAINT IF EXISTS estoque_reservado_pkey;
ALTER TABLE IF EXISTS ONLY public.estoque_baixa_log DROP CONSTRAINT IF EXISTS estoque_baixa_log_pkey;
ALTER TABLE IF EXISTS ONLY public.empresas DROP CONSTRAINT IF EXISTS empresas_codigo_empresa_unique;
ALTER TABLE IF EXISTS ONLY public.empresa_counters DROP CONSTRAINT IF EXISTS empresa_counters_pkey;
ALTER TABLE IF EXISTS ONLY public.clientes DROP CONSTRAINT IF EXISTS customers_pkey;
ALTER TABLE IF EXISTS ONLY public.quadras DROP CONSTRAINT IF EXISTS courts_pkey;
ALTER TABLE IF EXISTS ONLY public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_pkey;
ALTER TABLE IF EXISTS ONLY public.contas_receber_baixas DROP CONSTRAINT IF EXISTS contas_receber_baixas_pkey;
ALTER TABLE IF EXISTS ONLY public.contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_pkey;
ALTER TABLE IF EXISTS ONLY public.contas_pagar_baixas DROP CONSTRAINT IF EXISTS contas_pagar_baixas_pkey;
ALTER TABLE IF EXISTS ONLY public.compras DROP CONSTRAINT IF EXISTS compras_pkey;
ALTER TABLE IF EXISTS ONLY public.compras_itens DROP CONSTRAINT IF EXISTS compras_itens_pkey;
ALTER TABLE IF EXISTS ONLY public.empresas DROP CONSTRAINT IF EXISTS companies_pkey;
ALTER TABLE IF EXISTS ONLY public.empresas DROP CONSTRAINT IF EXISTS companies_company_code_key;
ALTER TABLE IF EXISTS ONLY public.comandas DROP CONSTRAINT IF EXISTS comandas_pkey;
ALTER TABLE IF EXISTS ONLY public.comanda_itens DROP CONSTRAINT IF EXISTS comanda_itens_pkey;
ALTER TABLE IF EXISTS ONLY public.comanda_historico DROP CONSTRAINT IF EXISTS comanda_historico_pkey;
ALTER TABLE IF EXISTS ONLY public.comanda_clientes DROP CONSTRAINT IF EXISTS comanda_clientes_pkey;
ALTER TABLE IF EXISTS ONLY public.caixa_sessoes DROP CONSTRAINT IF EXISTS caixa_sessoes_pkey;
ALTER TABLE IF EXISTS ONLY public.caixa_resumos DROP CONSTRAINT IF EXISTS caixa_resumos_pkey;
ALTER TABLE IF EXISTS ONLY public.caixa_movimentos DROP CONSTRAINT IF EXISTS caixa_movimentos_pkey;
ALTER TABLE IF EXISTS ONLY public.caixa_movimentacoes DROP CONSTRAINT IF EXISTS caixa_movimentacoes_pkey;
ALTER TABLE IF EXISTS ONLY public.agendamentos DROP CONSTRAINT IF EXISTS bookings_pkey;
ALTER TABLE IF EXISTS ONLY public.agendamento_participantes DROP CONSTRAINT IF EXISTS agendamento_participantes_pkey;
ALTER TABLE IF EXISTS ONLY public.agenda_settings DROP CONSTRAINT IF EXISTS agenda_settings_pkey;
ALTER TABLE IF EXISTS public.caixa_resumos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.caixa_movimentacoes ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.vendas;
DROP VIEW IF EXISTS public.v_agendamentos_isis;
DROP VIEW IF EXISTS public.v_agendamentos_detalhado;
DROP VIEW IF EXISTS public.v_agendamento_participantes;
DROP TABLE IF EXISTS public.usuarios;
DROP TABLE IF EXISTS public.user_ui_settings;
DROP TABLE IF EXISTS public.quadras_dias_funcionamento;
DROP TABLE IF EXISTS public.quadras;
DROP TABLE IF EXISTS public.produtos;
DROP TABLE IF EXISTS public.produto_categorias;
DROP TABLE IF EXISTS public.pagamentos;
DROP TABLE IF EXISTS public.movimentos_saldo;
DROP TABLE IF EXISTS public.mesas;
DROP TABLE IF EXISTS public.itens_venda;
DROP TABLE IF EXISTS public.finalizadoras;
DROP TABLE IF EXISTS public.estoque_reservado;
DROP TABLE IF EXISTS public.estoque_baixa_log;
DROP TABLE IF EXISTS public.empresas;
DROP TABLE IF EXISTS public.empresa_counters;
DROP TABLE IF EXISTS public.contas_receber_baixas;
DROP TABLE IF EXISTS public.contas_receber;
DROP TABLE IF EXISTS public.contas_pagar_baixas;
DROP TABLE IF EXISTS public.contas_pagar;
DROP TABLE IF EXISTS public.compras_itens;
DROP TABLE IF EXISTS public.compras;
DROP TABLE IF EXISTS public.comandas;
DROP TABLE IF EXISTS public.comanda_itens;
DROP TABLE IF EXISTS public.comanda_historico;
DROP TABLE IF EXISTS public.comanda_clientes;
DROP TABLE IF EXISTS public.colaboradores;
DROP TABLE IF EXISTS public.clientes;
DROP TABLE IF EXISTS public.caixa_sessoes;
DROP SEQUENCE IF EXISTS public.caixa_resumos_id_seq;
DROP TABLE IF EXISTS public.caixa_resumos;
DROP TABLE IF EXISTS public.caixa_movimentos;
DROP SEQUENCE IF EXISTS public.caixa_movimentacoes_id_seq;
DROP TABLE IF EXISTS public.caixa_movimentacoes;
DROP TABLE IF EXISTS public.agendamentos;
DROP TABLE IF EXISTS public.agendamento_participantes;
DROP TABLE IF EXISTS public.agenda_settings;
DROP OPERATOR IF EXISTS public.= (public.payment_status, text);
DROP OPERATOR IF EXISTS public.= (text, public.payment_status);
DROP FUNCTION IF EXISTS public.update_compras_timestamp();
DROP FUNCTION IF EXISTS public.trg_contas_receber_set_updated_at();
DROP FUNCTION IF EXISTS public.trg_contas_pagar_set_updated_at();
DROP FUNCTION IF EXISTS public.trg_comandas_baixar_estoque();
DROP FUNCTION IF EXISTS public.touch_updated_at();
DROP FUNCTION IF EXISTS public.tg_set_timestamp();
DROP FUNCTION IF EXISTS public.text_eq_payment_status(a text, b public.payment_status);
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.set_timestamp_updated_at();
DROP FUNCTION IF EXISTS public.set_timestamp();
DROP FUNCTION IF EXISTS public.set_empresa_produto_categorias();
DROP FUNCTION IF EXISTS public.set_empresa_from_user();
DROP FUNCTION IF EXISTS public.set_current_empresa(empresa_codigo text);
DROP FUNCTION IF EXISTS public.set_company_code_default();
DROP FUNCTION IF EXISTS public.set_agendamento_empresa_from_user();
DROP FUNCTION IF EXISTS public.set_ag_participantes_codigo_empresa();
DROP FUNCTION IF EXISTS public.registrar_historico_comanda();
DROP FUNCTION IF EXISTS public.quadra_funciona_na_data(p_quadra_id uuid, p_data date);
DROP FUNCTION IF EXISTS public.protect_consumidor_final();
DROP FUNCTION IF EXISTS public.produtos_set_company_code();
DROP FUNCTION IF EXISTS public.payment_status_eq_text(a public.payment_status, b text);
DROP FUNCTION IF EXISTS public.normalize_codigo_produto();
DROP FUNCTION IF EXISTS public.get_my_company_id();
DROP FUNCTION IF EXISTS public.get_my_company_code();
DROP FUNCTION IF EXISTS public.gen_codigo_produto();
DROP FUNCTION IF EXISTS public.fn_mov_saldo_apply();
DROP FUNCTION IF EXISTS public.fix_invalid_comanda_status(target_comanda_id uuid);
DROP FUNCTION IF EXISTS public.current_empresa_id();
DROP FUNCTION IF EXISTS public.current_codigo_empresa();
DROP FUNCTION IF EXISTS public.create_company_full(payload jsonb);
DROP FUNCTION IF EXISTS public.colaboradores_enforce_codigo_empresa();
DROP FUNCTION IF EXISTS public.clientes_set_codigo_fn();
DROP FUNCTION IF EXISTS public.clientes_next_codigo();
DROP FUNCTION IF EXISTS public.calcular_total_comanda_com_desconto(p_comanda_id uuid);
DROP FUNCTION IF EXISTS public.baixar_estoque_por_comanda(p_comanda_id uuid);
DROP FUNCTION IF EXISTS public.atualizar_ultima_atualizacao_item();
DROP FUNCTION IF EXISTS public.atualizar_ultima_atualizacao_comanda();
DROP FUNCTION IF EXISTS public.atualizar_observacoes_comanda(p_comanda_id uuid, p_observacoes text);
DROP FUNCTION IF EXISTS public.agendamentos_set_codigo_fn();
DROP FUNCTION IF EXISTS public._ensure_policy(tbl regclass, pol_name text, cmd text);
DROP TYPE IF EXISTS public.payment_status;
DROP TYPE IF EXISTS public.payment_method;
DROP TYPE IF EXISTS public.mesa_status;
DROP TYPE IF EXISTS public.comanda_status;
DROP TYPE IF EXISTS public.caixa_mov_tipo;
DROP SCHEMA IF EXISTS public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: caixa_mov_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.caixa_mov_tipo AS ENUM (
    'sale',
    'supply',
    'withdrawal',
    'refund',
    'expense',
    'adjust'
);


--
-- Name: comanda_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comanda_status AS ENUM (
    'open',
    'awaiting-payment',
    'closed',
    'canceled'
);


--
-- Name: mesa_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mesa_status AS ENUM (
    'available',
    'in-use',
    'awaiting-payment',
    'inactive'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'pix',
    'transfer',
    'other'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'Pendente',
    'Pago',
    'Pago parcial',
    'Reembolsado'
);


--
-- Name: _ensure_policy(regclass, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._ensure_policy(tbl regclass, pol_name text, cmd text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  schema_name text := split_part(tbl::text, '.', 1);
  table_name  text := split_part(tbl::text, '.', 2);
begin
  if not exists (
    select 1
    from pg_policies p
    where p.schemaname = schema_name
      and p.tablename = table_name
      and p.policyname = pol_name
  ) then
    begin
      execute format(
        'create policy %I on %s for %s using (codigo_empresa = public.get_my_company_code()) with check (codigo_empresa = public.get_my_company_code())',
        pol_name, tbl, cmd
      );
    exception
      when duplicate_object then
        -- Política já existe: ignora
        null;
    end;
  end if;
end;
$$;


--
-- Name: agendamentos_set_codigo_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agendamentos_set_codigo_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_empresa_id uuid;
  v_next bigint;
begin
  -- Se já vier com codigo, não altera
  if new.codigo is not null then
    return new;
  end if;

  -- Resolve empresa_id via codigo_empresa
  if new.codigo_empresa is null then
    raise exception 'agendamentos_set_codigo_fn: NEW.codigo_empresa não pode ser nulo';
  end if;

  select e.id into v_empresa_id
  from public.empresas e
  where e.codigo_empresa = new.codigo_empresa
  limit 1;

  if v_empresa_id is null then
    raise exception 'agendamentos_set_codigo_fn: empresa não encontrada para codigo_empresa=%', new.codigo_empresa;
  end if;

  -- Garante existência da linha em empresa_counters
  insert into public.empresa_counters (empresa_id)
  values (v_empresa_id)
  on conflict (empresa_id) do nothing;

  -- Lê o próximo código atual e incrementa (lock com for update implícito via update)
  select next_agendamento_codigo
    into v_next
  from public.empresa_counters
  where empresa_id = v_empresa_id
  for update;

  new.codigo := v_next;

  update public.empresa_counters
  set next_agendamento_codigo = v_next + 1
  where empresa_id = v_empresa_id;

  return new;
end;
$$;


--
-- Name: atualizar_observacoes_comanda(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_observacoes_comanda(p_comanda_id uuid, p_observacoes text) RETURNS json
    LANGUAGE plpgsql
    AS $$
begin
  update comandas
  set 
    observacoes = case when p_observacoes = '' then null else p_observacoes end,
    observacoes_atualizadas_em = now()
  where id = p_comanda_id;

  return json_build_object('success', true);
end;
$$;


--
-- Name: atualizar_ultima_atualizacao_comanda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_ultima_atualizacao_comanda() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.ultima_atualizacao = NOW();
  NEW.versao_sincronizacao = COALESCE(NEW.versao_sincronizacao, 0) + 1;
  RETURN NEW;
END;
$$;


--
-- Name: atualizar_ultima_atualizacao_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_ultima_atualizacao_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE comandas 
  SET ultima_atualizacao = NOW(), versao_sincronizacao = versao_sincronizacao + 1
  WHERE id = NEW.comanda_id;
  RETURN NEW;
END;
$$;


--
-- Name: baixar_estoque_por_comanda(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.baixar_estoque_por_comanda(p_comanda_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_exists boolean;
  rec record;
  v_has_estoque boolean;
  v_has_estoque_atual boolean;
begin
  if p_comanda_id is null then
    raise exception 'comanda_id ausente';
  end if;

  -- já baixou?
  select exists(select 1 from public.estoque_baixa_log where comanda_id = p_comanda_id) into v_exists;
  if v_exists then
    return;
  end if;

  -- verifica colunas de estoque
  select exists(
           select 1 from information_schema.columns
           where table_schema='public' and table_name='produtos' and column_name='estoque'
         ),
         exists(
           select 1 from information_schema.columns
           where table_schema='public' and table_name='produtos' and column_name='estoque_atual'
         )
    into v_has_estoque, v_has_estoque_atual;

  -- agrega quantidades por produto
  for rec in
    select produto_id, sum(coalesce(quantidade,0)) as qty
    from public.comanda_itens
    where comanda_id = p_comanda_id
      and produto_id is not null
    group by produto_id
  loop
    if v_has_estoque then
      update public.produtos
         set estoque = greatest(0, coalesce(estoque,0) - rec.qty)
       where id = rec.produto_id;
    end if;

    if v_has_estoque_atual then
      update public.produtos
         set estoque_atual = greatest(0, coalesce(estoque_atual,0) - rec.qty)
       where id = rec.produto_id;
    end if;
  end loop;

  -- marca como baixado
  insert into public.estoque_baixa_log (comanda_id) values (p_comanda_id)
  on conflict (comanda_id) do nothing;
end;
$$;


--
-- Name: calcular_total_comanda_com_desconto(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_total_comanda_com_desconto(p_comanda_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_subtotal NUMERIC := 0;
  v_desconto_comanda NUMERIC := 0;
  v_total NUMERIC := 0;
  v_desconto_tipo VARCHAR;
  v_desconto_valor NUMERIC;
BEGIN
  -- Calcular subtotal com descontos por item
  SELECT COALESCE(SUM(
    CASE 
      WHEN ci.desconto_tipo = 'percentual' 
      THEN (ci.preco_unitario * ci.quantidade) * (1 - ci.desconto_valor/100)
      WHEN ci.desconto_tipo = 'fixo'
      THEN (ci.preco_unitario * ci.quantidade) - ci.desconto_valor
      ELSE ci.preco_unitario * ci.quantidade
    END
  ), 0)
  INTO v_subtotal
  FROM comanda_itens ci
  WHERE ci.comanda_id = p_comanda_id;
  
  -- Obter desconto da comanda
  SELECT desconto_tipo, desconto_valor
  INTO v_desconto_tipo, v_desconto_valor
  FROM comandas
  WHERE id = p_comanda_id;
  
  -- Aplicar desconto da comanda
  v_total := v_subtotal;
  IF v_desconto_tipo = 'percentual' THEN
    v_total := v_subtotal * (1 - v_desconto_valor/100);
  ELSIF v_desconto_tipo = 'fixo' THEN
    v_total := v_subtotal - v_desconto_valor;
  END IF;
  
  RETURN GREATEST(0, v_total);
END;
$$;


--
-- Name: clientes_next_codigo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clientes_next_codigo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  next_codigo integer;
begin
  if new.codigo is null then
    select coalesce(max(codigo), 0) + 1
      into next_codigo
      from public.clientes
     where codigo_empresa = new.codigo_empresa;
    new.codigo := next_codigo;
  end if;
  return new;
end $$;


--
-- Name: clientes_set_codigo_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clientes_set_codigo_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- ✅ PRIORIDADE 1: SE É CONSUMIDOR FINAL, SEMPRE USA CÓDIGO 0
    IF NEW.is_consumidor_final = true THEN
        NEW.codigo := 0;
        RETURN NEW;
    END IF;

    -- ✅ PRIORIDADE 2: SE JÁ TEM CÓDIGO DEFINIDO MANUALMENTE, MANTÉM
    IF NEW.codigo IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- ✅ PRIORIDADE 3: GERA PRÓXIMO CÓDIGO SEQUENCIAL
    SELECT next_cliente_codigo
    INTO NEW.codigo
    FROM public.empresa_counters ec
    JOIN public.empresas e ON e.id = ec.empresa_id
    WHERE e.codigo_empresa = NEW.codigo_empresa;

    -- Fallback: se não encontrou contador (empresa nova), começa em 1
    IF NEW.codigo IS NULL THEN
        NEW.codigo := 1;
    END IF;

    -- Incrementa contador para próximo cliente
    UPDATE public.empresa_counters
    SET next_cliente_codigo = next_cliente_codigo + 1
    WHERE empresa_id = (
        SELECT id FROM public.empresas 
        WHERE codigo_empresa = NEW.codigo_empresa
    );

    RETURN NEW;
END;
$$;


--
-- Name: colaboradores_enforce_codigo_empresa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.colaboradores_enforce_codigo_empresa() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_codigo text;
begin
  if NEW.empresa_id is not null then
    select e.codigo into v_codigo
    from public.empresas e
    where e.id = NEW.empresa_id;

    if v_codigo is null then
      raise foreign_key_violation using message = 'empresa_id inválido (empresa sem codigo)';
    end if;

    if NEW.codigo_empresa is null then
      NEW.codigo_empresa := v_codigo;
    elsif NEW.codigo_empresa <> v_codigo then
      raise insufficient_privilege using message = 'codigo_empresa não corresponde ao codigo da empresa_id';
    end if;
  end if;

  return NEW;
end
$$;


--
-- Name: create_company_full(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_company_full(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $_$
declare
  v_empresa_id uuid;
  v_codigo_empresa text;
  v_email text;
  v_nome_usuario text;
  v_cargo text;
  v_cnpj text;
  v_emp_nome text;
  v_emp_razao text;
  v_emp_email text;
  v_emp_tel text;
  v_emp_endereco text;
  v_uid uuid;
begin
  -- Extract user fields
  v_email := nullif(trim((payload->'user'->>'email')), '');
  v_nome_usuario := nullif(trim((payload->'user'->>'nome')), '');
  v_cargo := coalesce(nullif(trim((payload->'user'->>'cargo')), ''), 'admin');

  -- Extract empresa fields
  v_emp_razao := nullif(trim((payload->'empresa'->>'razao_social')), '');
  v_emp_nome := nullif(trim((payload->'empresa'->>'nome_fantasia')), '');
  v_cnpj := regexp_replace(coalesce(payload->'empresa'->>'cnpj',''), '[^0-9]', '', 'g');
  if v_cnpj = '' then v_cnpj := null; end if;
  v_emp_email := nullif(trim((payload->'empresa'->>'email')), '');
  v_emp_tel := nullif(trim((payload->'empresa'->>'telefone')), '');
  v_emp_endereco := nullif(trim((payload->'empresa'->>'endereco')), '');

  -- Próximo codigo_empresa sequencial numérico (em texto)
  select coalesce(max((codigo_empresa)::int), 0) + 1
    into strict v_codigo_empresa
  from public.empresas
  where codigo_empresa ~ '^[0-9]+$';

  v_codigo_empresa := v_codigo_empresa::text;

  -- Empresa
  insert into public.empresas (
    codigo_empresa, nome, razao_social, nome_fantasia, cnpj, email, telefone, endereco
  ) values (
    v_codigo_empresa, v_emp_nome, v_emp_razao, v_emp_nome, v_cnpj, v_emp_email, v_emp_tel, v_emp_endereco
  )
  returning id into v_empresa_id;

  -- Counters
  insert into public.empresa_counters (empresa_id, next_cliente_codigo, next_agendamento_codigo)
  values (v_empresa_id, 1, 1)
  on conflict (empresa_id) do nothing;

  -- agenda_settings
  insert into public.agenda_settings (empresa_id, auto_confirm_enabled, auto_start_enabled, auto_finish_enabled)
  values (v_empresa_id, false, true, true)
  on conflict (empresa_id) do nothing;

  -- Vincular usuario/colaborador se email existir no Auth
  if v_email is not null then
    select id into v_uid from auth.users where email = v_email;

    if v_uid is not null then
      insert into public.usuarios (id, email, nome, papel, codigo_empresa)
      values (v_uid, v_email, coalesce(v_nome_usuario, 'Administrador'), v_cargo, v_codigo_empresa)
      on conflict (id) do update
        set codigo_empresa = excluded.codigo_empresa,
            email = excluded.email,
            nome = coalesce(excluded.nome, public.usuarios.nome),
            papel = coalesce(excluded.papel, public.usuarios.papel);

      insert into public.colaboradores (id, nome, cargo, ativo, codigo_empresa)
      values (v_uid, coalesce(v_nome_usuario, 'Administrador'), v_cargo, true, v_codigo_empresa)
      on conflict (id) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'codigo_empresa', v_codigo_empresa,
    'empresa_id', v_empresa_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$_$;


--
-- Name: current_codigo_empresa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_codigo_empresa() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- usa codigo_empresa direto se já tiver na linha do usuário; senão, resolve via empresas
  select coalesce(c.codigo_empresa, e.codigo) as codigo
  from public.colaboradores c
  left join public.empresas e on e.id = c.empresa_id
  where c.id = auth.uid()
  limit 1
$$;


--
-- Name: current_empresa_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_empresa_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.empresa_id
  from public.colaboradores c
  where c.id = auth.uid()
  limit 1
$$;


--
-- Name: fix_invalid_comanda_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_invalid_comanda_status(target_comanda_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.comandas 
  SET status = 'open'
  WHERE id = target_comanda_id 
    AND (status IS NULL OR status = '' OR status NOT IN ('open', 'closed', 'cancelled'));
END;
$$;


--
-- Name: fn_mov_saldo_apply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mov_saldo_apply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  delta numeric(12,2);
begin
  if tg_op = 'INSERT' then
    delta := case when new.tipo = 'credito' then new.valor else -new.valor end;
    update public.clientes set saldo = coalesce(saldo,0) + delta
    where id = new.cliente_id and codigo_empresa = new.codigo_empresa;
    return new;

  elsif tg_op = 'DELETE' then
    delta := case when old.tipo = 'credito' then -old.valor else +old.valor end;
    update public.clientes set saldo = coalesce(saldo,0) + delta
    where id = old.cliente_id and codigo_empresa = old.codigo_empresa;
    return old;

  elsif tg_op = 'UPDATE' then
    delta := (case when old.tipo = 'credito' then -old.valor else +old.valor end)
           + (case when new.tipo = 'credito' then +new.valor else -new.valor end);
    update public.clientes set saldo = coalesce(saldo,0) + delta
    where id = new.cliente_id and codigo_empresa = new.codigo_empresa;
    return new;
  end if;

  return null;
end;
$$;


--
-- Name: gen_codigo_produto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_codigo_produto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_empresa text;
  v_next int;
begin
  -- definir empresa do registro (assumindo trigger/valor já define codigo_empresa)
  if new.codigo_empresa is null then
    -- tenta obter do contexto
    v_empresa := public.get_my_company_code();
    new.codigo_empresa := coalesce(new.codigo_empresa, v_empresa);
  else
    v_empresa := new.codigo_empresa;
  end if;

  -- Se não vier código, gerar a partir do maior existente
  if new.codigo_produto is null or btrim(new.codigo_produto) = '' then
    select coalesce(max((regexp_replace(codigo_produto, '\\D', '', 'g'))::int), 0) + 1
      into v_next
    from public.produtos
    where codigo_empresa = v_empresa
      and codigo_produto ~ '^[0-9]+$';

    new.codigo_produto := lpad(v_next::text, 4, '0');
  end if;

  return new;
end;
$_$;


--
-- Name: get_my_company_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_company_code() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_code text;
begin
  -- Preferir colaboradores (id = auth.uid())
  select c.codigo_empresa
    into v_code
  from public.colaboradores c
  where c.id = auth.uid()
  limit 1;

  if v_code is not null then
    return v_code;
  end if;

  -- Fallback: usuarios
  select u.codigo_empresa
    into v_code
  from public.usuarios u
  where u.id = auth.uid()
  limit 1;

  return v_code;
end;
$$;


--
-- Name: get_my_company_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_company_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select e.id
  from public.empresas e
  where e.codigo_empresa = public.get_my_company_code()
  limit 1
$$;


--
-- Name: normalize_codigo_produto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_codigo_produto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.codigo_produto is not null then
    new.codigo_produto := btrim(new.codigo_produto);
  end if;
  return new;
end;
$$;


--
-- Name: payment_status_eq_text(public.payment_status, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payment_status_eq_text(a public.payment_status, b text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
begin
  return a::text = b;
end
$$;


--
-- Name: produtos_set_company_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.produtos_set_company_code() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.codigo_empresa is null then
    new.codigo_empresa := public.get_my_company_code();
  end if;
  return new;
end;
$$;


--
-- Name: protect_consumidor_final(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_consumidor_final() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- ========================================
    -- PROTEÇÃO CONTRA DELETE
    -- ========================================
    IF TG_OP = 'DELETE' THEN
        IF OLD.is_consumidor_final = true THEN
            RAISE EXCEPTION 'Não é permitido excluir o cliente "Cliente Consumidor" (código 0). Este é um cliente especial do sistema.';
        END IF;
        RETURN OLD;
    END IF;

    -- ========================================
    -- PROTEÇÃO CONTRA UPDATE DE CAMPOS CRÍTICOS
    -- ========================================
    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_consumidor_final = true THEN
            -- Impede alterar campos críticos
            IF NEW.nome != OLD.nome THEN
                RAISE EXCEPTION 'Não é permitido alterar o nome do cliente "Cliente Consumidor"';
            END IF;
            
            IF NEW.cpf IS DISTINCT FROM OLD.cpf THEN
                RAISE EXCEPTION 'Não é permitido alterar o CPF do cliente "Cliente Consumidor"';
            END IF;
            
            IF NEW.email IS DISTINCT FROM OLD.email THEN
                RAISE EXCEPTION 'Não é permitido alterar o email do cliente "Cliente Consumidor"';
            END IF;
            
            IF NEW.is_consumidor_final != OLD.is_consumidor_final THEN
                RAISE EXCEPTION 'Não é permitido remover a flag is_consumidor_final';
            END IF;
            
            IF NEW.codigo != OLD.codigo THEN
                RAISE EXCEPTION 'Não é permitido alterar o código do cliente "Cliente Consumidor"';
            END IF;
            
            -- Permite atualizar: saldo, telefone, observações, timestamps
            -- Esses campos são permitidos para facilitar operações do sistema
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: quadra_funciona_na_data(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quadra_funciona_na_data(p_quadra_id uuid, p_data date) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    dia_semana_num INTEGER;
    fechamento_especifico BOOLEAN;
    funcionamento_semanal BOOLEAN;
BEGIN
    dia_semana_num := EXTRACT(DOW FROM p_data);
    
    -- 1. Verificar se há fechamento específico para esta data
    SELECT NOT funciona INTO fechamento_especifico
    FROM public.quadras_dias_funcionamento 
    WHERE quadra_id = p_quadra_id 
      AND tipo = 'data_fechamento'
      AND data_fechamento = p_data
      AND funciona = false;
    
    -- Se encontrou fechamento específico, quadra está fechada
    IF fechamento_especifico IS NOT NULL AND fechamento_especifico = true THEN
        RETURN false;
    END IF;
    
    -- 2. Verificar funcionamento do dia da semana
    SELECT funciona INTO funcionamento_semanal
    FROM public.quadras_dias_funcionamento 
    WHERE quadra_id = p_quadra_id 
      AND tipo = 'dia_semana'
      AND dia_semana = dia_semana_num;
    
    -- Se tem configuração para o dia da semana, usar ela
    IF funcionamento_semanal IS NOT NULL THEN
        RETURN funcionamento_semanal;
    END IF;
    
    -- 3. Fallback: se não tem configuração, assume que funciona (comportamento atual)
    RETURN true;
END;
$$;


--
-- Name: registrar_historico_comanda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_historico_comanda() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into comanda_historico (
    codigo_empresa,
    comanda_id,
    tipo_alteracao,
    descricao
  ) values (
    NEW.codigo_empresa::integer, -- CAST AQUI
    NEW.id,
    'observacao_adicionada',
    'Observação: ' || coalesce(NEW.observacoes, '')
  );

  return NEW;
end;
$$;


--
-- Name: set_ag_participantes_codigo_empresa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_ag_participantes_codigo_empresa() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if NEW.agendamento_id is not null then
    select a.codigo_empresa
      into NEW.codigo_empresa
    from public.agendamentos a
    where a.id = NEW.agendamento_id;
  end if;
  return NEW;
end
$$;


--
-- Name: set_agendamento_empresa_from_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_agendamento_empresa_from_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if NEW.codigo_empresa is null then
    NEW.codigo_empresa := public.get_my_company_code();
  end if;
  return NEW;
end
$$;


--
-- Name: set_company_code_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_company_code_default() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.codigo_empresa is null then
    new.codigo_empresa := public.get_my_company_code();
  end if;
  return new;
end;
$$;


--
-- Name: set_current_empresa(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_current_empresa(empresa_codigo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Define a empresa atual na sessão
    PERFORM set_config('app.current_empresa', empresa_codigo, false);
END;
$$;


--
-- Name: set_empresa_from_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_empresa_from_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Se o front não enviar, preencher pelo contexto do usuário
  if NEW.codigo_empresa is null then
    NEW.codigo_empresa := public.get_my_company_code();
  end if;
  return NEW;
end
$$;


--
-- Name: set_empresa_produto_categorias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_empresa_produto_categorias() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.codigo_empresa is null then
    new.codigo_empresa := public.get_my_company_code();
  end if;
  return new;
end;
$$;


--
-- Name: set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: text_eq_payment_status(text, public.payment_status); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.text_eq_payment_status(a text, b public.payment_status) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
begin
  return a = b::text;
end
$$;


--
-- Name: tg_set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.atualizado_em := now();
  return new;
end $$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: trg_comandas_baixar_estoque(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_comandas_baixar_estoque() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  -- quando status muda para 'closed', baixa estoque
  if (TG_OP = 'UPDATE')
     and new.status = 'closed'
     and coalesce(old.status, '') <> 'closed' then
    perform public.baixar_estoque_por_comanda(new.id);
  end if;
  return new;
end;
$$;


--
-- Name: trg_contas_pagar_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_contas_pagar_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


--
-- Name: trg_contas_receber_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_contas_receber_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


--
-- Name: update_compras_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_compras_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: =; Type: OPERATOR; Schema: public; Owner: -
--

CREATE OPERATOR public.= (
    FUNCTION = public.text_eq_payment_status,
    LEFTARG = text,
    RIGHTARG = public.payment_status,
    COMMUTATOR = OPERATOR(public.=),
    RESTRICT = eqsel,
    JOIN = eqjoinsel
);


--
-- Name: =; Type: OPERATOR; Schema: public; Owner: -
--

CREATE OPERATOR public.= (
    FUNCTION = public.payment_status_eq_text,
    LEFTARG = public.payment_status,
    RIGHTARG = text,
    COMMUTATOR = OPERATOR(public.=),
    RESTRICT = eqsel,
    JOIN = eqjoinsel
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agenda_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_settings (
    empresa_id uuid NOT NULL,
    auto_confirm_enabled boolean DEFAULT false NOT NULL,
    auto_confirm_hours integer,
    auto_cancel_if_not_confirmed_enabled boolean DEFAULT false NOT NULL,
    auto_cancel_hours integer,
    auto_start_enabled boolean DEFAULT true NOT NULL,
    auto_finish_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agenda_settings_auto_cancel_hours_check CHECK (((auto_cancel_hours IS NULL) OR ((auto_cancel_hours >= 0) AND (auto_cancel_hours <= 168)))),
    CONSTRAINT agenda_settings_auto_confirm_hours_check CHECK (((auto_confirm_hours IS NULL) OR ((auto_confirm_hours >= 0) AND (auto_confirm_hours <= 168))))
);


--
-- Name: TABLE agenda_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agenda_settings IS 'Configurações de automação da agenda por empresa (1:1 com empresas).';


--
-- Name: agendamento_participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agendamento_participantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agendamento_id uuid NOT NULL,
    cliente_id uuid,
    nome text,
    valor_cota numeric(10,2) DEFAULT 0 NOT NULL,
    status_pagamento public.payment_status DEFAULT 'Pendente'::public.payment_status NOT NULL,
    pago_em timestamp with time zone,
    metodo_pagamento text,
    codigo_empresa character varying(10),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    finalizadora_id uuid,
    aplicar_taxa boolean DEFAULT false,
    ordem integer DEFAULT 1,
    CONSTRAINT agendamento_participantes_valor_cota_check CHECK ((valor_cota >= (0)::numeric))
);


--
-- Name: TABLE agendamento_participantes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agendamento_participantes IS 'Cotas de valor por participante do agendamento';


--
-- Name: COLUMN agendamento_participantes.valor_cota; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamento_participantes.valor_cota IS 'Valor atribuído ao participante';


--
-- Name: COLUMN agendamento_participantes.ordem; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamento_participantes.ordem IS 'Ordem do participante no agendamento (1=representante/primeiro)';


--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quadra_id uuid NOT NULL,
    cliente_id uuid,
    clientes text[],
    inicio timestamp with time zone NOT NULL,
    fim timestamp with time zone NOT NULL,
    modalidade character varying(100),
    status character varying(20) DEFAULT 'scheduled'::character varying,
    valor_total numeric(10,2),
    criado_em timestamp with time zone DEFAULT now(),
    codigo_empresa text NOT NULL,
    auto_disabled boolean DEFAULT false NOT NULL,
    codigo bigint NOT NULL,
    CONSTRAINT agendamentos_valor_nonneg CHECK (((valor_total IS NULL) OR (valor_total >= (0)::numeric)))
);


--
-- Name: COLUMN agendamentos.clientes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamentos.clientes IS 'Participantes do agendamento (nomes livres)';


--
-- Name: COLUMN agendamentos.valor_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamentos.valor_total IS 'Preço total do agendamento para meia hora (R$)';


--
-- Name: COLUMN agendamentos.auto_disabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agendamentos.auto_disabled IS 'Quando true, desativa QUALQUER automação (auto-confirmar, auto-iniciar, auto-finalizar) para este agendamento.';


--
-- Name: caixa_movimentacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_movimentacoes (
    id bigint NOT NULL,
    codigo_empresa text NOT NULL,
    caixa_sessao_id uuid NOT NULL,
    tipo text NOT NULL,
    valor numeric(14,2) NOT NULL,
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caixa_movimentacoes_tipo_check CHECK ((tipo = ANY (ARRAY['sangria'::text, 'suprimento'::text, 'troco'::text, 'ajuste'::text])))
);


--
-- Name: caixa_movimentacoes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caixa_movimentacoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caixa_movimentacoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caixa_movimentacoes_id_seq OWNED BY public.caixa_movimentacoes.id;


--
-- Name: caixa_movimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_movimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text DEFAULT public.get_my_company_code() NOT NULL,
    caixa_id uuid NOT NULL,
    tipo public.caixa_mov_tipo NOT NULL,
    origem text,
    metodo public.payment_method,
    valor numeric(12,2) NOT NULL,
    referencia_id uuid,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caixa_movimentos_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: caixa_resumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_resumos (
    id bigint NOT NULL,
    codigo_empresa text NOT NULL,
    caixa_sessao_id uuid NOT NULL,
    periodo_de timestamp with time zone NOT NULL,
    periodo_ate timestamp with time zone NOT NULL,
    total_bruto numeric(14,2) DEFAULT 0 NOT NULL,
    total_descontos numeric(14,2) DEFAULT 0 NOT NULL,
    total_liquido numeric(14,2) DEFAULT 0 NOT NULL,
    total_entradas numeric(14,2) DEFAULT 0 NOT NULL,
    por_finalizadora jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    valor_final_dinheiro numeric,
    diferenca_dinheiro numeric
);


--
-- Name: COLUMN caixa_resumos.valor_final_dinheiro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.caixa_resumos.valor_final_dinheiro IS 'Valor contado informado no fechamento do caixa (em dinheiro total no caixa no momento do fechamento).';


--
-- Name: COLUMN caixa_resumos.diferenca_dinheiro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.caixa_resumos.diferenca_dinheiro IS 'Diferença entre o valor contado e o saldo final calculado (contado - saldo_final_calculado).';


--
-- Name: caixa_resumos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caixa_resumos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caixa_resumos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caixa_resumos_id_seq OWNED BY public.caixa_resumos.id;


--
-- Name: caixa_sessoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_sessoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text DEFAULT public.get_my_company_code() NOT NULL,
    usuario_id uuid,
    aberto_em timestamp with time zone DEFAULT now() NOT NULL,
    fechado_em timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    saldo_inicial numeric(12,2) DEFAULT 0 NOT NULL,
    saldo_final numeric(12,2),
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caixa_sessoes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(255) NOT NULL,
    cpf character varying(14),
    email character varying(255),
    telefone character varying(20),
    saldo numeric(10,2) DEFAULT 0.00,
    status character varying(20) DEFAULT 'active'::character varying,
    aniversario date,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    codigo integer NOT NULL,
    codigo_empresa text NOT NULL,
    tipo_pessoa text,
    apelido text,
    cnpj text,
    rg text,
    ie text,
    flag_cliente boolean DEFAULT true,
    flag_fornecedor boolean DEFAULT false,
    flag_funcionario boolean DEFAULT false,
    flag_administradora boolean DEFAULT false,
    flag_parceiro boolean DEFAULT false,
    flag_ccf_spc boolean DEFAULT false,
    fone2 text,
    celular1 text,
    celular2 text,
    whatsapp text,
    cep text,
    endereco text,
    numero text,
    complemento text,
    bairro text,
    cidade text,
    uf text,
    cidade_ibge text,
    limite_credito numeric(12,2) DEFAULT 0,
    tipo_recebimento text,
    regime_tributario text,
    tipo_contribuinte text,
    sexo text,
    estado_civil text,
    nome_mae text,
    nome_pai text,
    observacoes text,
    is_consumidor_final boolean DEFAULT false
);


--
-- Name: COLUMN clientes.is_consumidor_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clientes.is_consumidor_final IS 'Identifica cliente padrão "Consumidor Final" que não pode ser editado/excluído. Sempre recebe código 0.';


--
-- Name: colaboradores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaboradores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(255) NOT NULL,
    cargo character varying(50) DEFAULT 'user'::character varying,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    ativo boolean DEFAULT true NOT NULL,
    codigo_empresa text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: comanda_clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comanda_clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comanda_id uuid NOT NULL,
    cliente_id uuid,
    nome_livre text,
    codigo_empresa text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comanda_clientes_ck_nome CHECK (((cliente_id IS NOT NULL) OR ((nome_livre IS NOT NULL) AND (length(TRIM(BOTH FROM nome_livre)) > 0))))
);


--
-- Name: comanda_historico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comanda_historico (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa integer NOT NULL,
    comanda_id uuid NOT NULL,
    tipo_alteracao character varying(50) NOT NULL,
    descricao text,
    usuario_id uuid,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE comanda_historico; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comanda_historico IS 'Auditoria de alterações em comandas para rastreabilidade';


--
-- Name: comanda_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comanda_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text DEFAULT public.get_my_company_code() NOT NULL,
    comanda_id uuid NOT NULL,
    produto_id uuid NOT NULL,
    descricao text,
    quantidade numeric(12,3) NOT NULL,
    preco_unitario numeric(12,2) NOT NULL,
    desconto numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) GENERATED ALWAYS AS (((quantidade * preco_unitario) - desconto)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    desconto_tipo character varying(20) DEFAULT NULL::character varying,
    desconto_valor numeric(10,2) DEFAULT 0,
    desconto_motivo character varying(255) DEFAULT NULL::character varying,
    preco_com_desconto numeric(10,2) DEFAULT NULL::numeric,
    CONSTRAINT comanda_itens_desconto_check CHECK ((desconto >= (0)::numeric)),
    CONSTRAINT comanda_itens_preco_unitario_check CHECK ((preco_unitario >= (0)::numeric)),
    CONSTRAINT comanda_itens_quantidade_check CHECK ((quantidade > (0)::numeric))
);


--
-- Name: comandas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comandas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text DEFAULT public.get_my_company_code() NOT NULL,
    mesa_id uuid,
    cliente_id uuid,
    aberto_em timestamp with time zone DEFAULT now() NOT NULL,
    fechado_em timestamp with time zone,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_balcao boolean GENERATED ALWAYS AS ((mesa_id IS NULL)) STORED,
    tipo text GENERATED ALWAYS AS (
CASE
    WHEN (mesa_id IS NULL) THEN 'balcao'::text
    ELSE 'comanda'::text
END) STORED,
    status text DEFAULT 'open'::text NOT NULL,
    origem text DEFAULT 'manual'::text,
    xml_chave text,
    diferenca_pagamento numeric(12,2) DEFAULT 0,
    desconto_tipo character varying(20) DEFAULT NULL::character varying,
    desconto_valor numeric(10,2) DEFAULT 0,
    desconto_motivo character varying(255) DEFAULT NULL::character varying,
    total_com_desconto numeric(10,2) DEFAULT NULL::numeric,
    observacoes text,
    observacoes_atualizadas_em timestamp with time zone,
    vendedor_id uuid,
    comissao_percentual numeric(5,2) DEFAULT NULL::numeric,
    comissao_valor numeric(10,2) DEFAULT NULL::numeric,
    agendamento_id uuid,
    versao_sincronizacao integer DEFAULT 1,
    ultima_atualizacao timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_comandas_status_valid CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'cancelled'::text]))),
    CONSTRAINT comandas_origem_check CHECK (((origem = ANY (ARRAY['manual'::text, 'xml'::text, 'api'::text])) OR (origem IS NULL)))
);


--
-- Name: COLUMN comandas.is_balcao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.is_balcao IS 'True quando a comanda não possui mesa (Balcão).';


--
-- Name: COLUMN comandas.tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.tipo IS 'Tipo da comanda: balcao | comanda';


--
-- Name: COLUMN comandas.desconto_tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.desconto_tipo IS 'Tipo de desconto: percentual ou fixo';


--
-- Name: COLUMN comandas.desconto_valor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.desconto_valor IS 'Valor do desconto (% ou R$)';


--
-- Name: COLUMN comandas.observacoes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.observacoes IS 'Notas/observações da comanda (ex: sem cebola, urgente)';


--
-- Name: COLUMN comandas.vendedor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.vendedor_id IS 'Usuário que realizou a venda (para comissão)';


--
-- Name: COLUMN comandas.agendamento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.agendamento_id IS 'Agendamento vinculado (se venda relacionada a agendamento)';


--
-- Name: COLUMN comandas.versao_sincronizacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandas.versao_sincronizacao IS 'Versão para sincronização realtime';


--
-- Name: compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa integer NOT NULL,
    fornecedor_id uuid,
    chave_nfe character varying(44) NOT NULL,
    numero_nfe character varying(20) NOT NULL,
    serie_nfe character varying(10),
    data_emissao timestamp with time zone NOT NULL,
    data_entrada timestamp with time zone DEFAULT now(),
    tipo_operacao character varying(20) DEFAULT 'Entrada'::character varying,
    natureza_operacao character varying(100),
    valor_produtos numeric(15,2) DEFAULT 0 NOT NULL,
    valor_frete numeric(15,2) DEFAULT 0,
    valor_seguro numeric(15,2) DEFAULT 0,
    valor_desconto numeric(15,2) DEFAULT 0,
    valor_outras_despesas numeric(15,2) DEFAULT 0,
    valor_total numeric(15,2) DEFAULT 0 NOT NULL,
    valor_icms numeric(15,2) DEFAULT 0,
    valor_ipi numeric(15,2) DEFAULT 0,
    valor_pis numeric(15,2) DEFAULT 0,
    valor_cofins numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'processada'::character varying,
    observacoes text,
    xml_completo text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    criado_por uuid,
    forma_pagamento character varying(100),
    ativo boolean DEFAULT true,
    motivo_inativacao text,
    inativado_em timestamp with time zone,
    inativado_por uuid,
    modelo_nfe character(2),
    CONSTRAINT compras_codigo_empresa_check CHECK ((codigo_empresa > 0)),
    CONSTRAINT compras_valores_check CHECK ((valor_total >= (0)::numeric))
);


--
-- Name: TABLE compras; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compras IS 'Registro de compras (NF-es de entrada) importadas via XML';


--
-- Name: COLUMN compras.chave_nfe; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.chave_nfe IS 'Chave de acesso única da NF-e (44 dígitos)';


--
-- Name: COLUMN compras.xml_completo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.xml_completo IS 'XML completo da NF-e para auditoria (opcional)';


--
-- Name: COLUMN compras.forma_pagamento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.forma_pagamento IS 'Forma de pagamento da NF-e (Dinheiro, PIX, Cartão, etc)';


--
-- Name: COLUMN compras.ativo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.ativo IS 'Indicates if the purchase is active (true) or soft deleted (false)';


--
-- Name: COLUMN compras.motivo_inativacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.motivo_inativacao IS 'Reason for inactivating the purchase';


--
-- Name: COLUMN compras.inativado_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.inativado_em IS 'Timestamp when the purchase was inativated';


--
-- Name: COLUMN compras.inativado_por; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.inativado_por IS 'User who inactivated the purchase';


--
-- Name: COLUMN compras.modelo_nfe; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras.modelo_nfe IS 'Modelo da NF-e/NFC-e: 55 = NF-e, 65 = NFC-e';


--
-- Name: compras_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compras_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compra_id uuid NOT NULL,
    produto_id uuid,
    codigo_produto_xml character varying(60),
    nome_produto_xml character varying(255) NOT NULL,
    ean_xml character varying(14),
    ncm_xml character varying(8),
    cfop_xml character varying(4),
    unidade_xml character varying(6),
    quantidade numeric(15,4) NOT NULL,
    valor_unitario numeric(15,4) NOT NULL,
    valor_total numeric(15,2) NOT NULL,
    valor_desconto numeric(15,2) DEFAULT 0,
    valor_frete numeric(15,2) DEFAULT 0,
    valor_seguro numeric(15,2) DEFAULT 0,
    valor_outras_despesas numeric(15,2) DEFAULT 0,
    icms_aliquota numeric(5,2),
    icms_valor numeric(15,2),
    ipi_aliquota numeric(5,2),
    ipi_valor numeric(15,2),
    pis_aliquota numeric(5,2),
    pis_valor numeric(15,2),
    cofins_aliquota numeric(5,2),
    cofins_valor numeric(15,2),
    vinculado_manualmente boolean DEFAULT false,
    observacoes text,
    criado_em timestamp with time zone DEFAULT now(),
    selecionado_na_importacao boolean DEFAULT true NOT NULL,
    CONSTRAINT compras_itens_quantidade_check CHECK ((quantidade > (0)::numeric)),
    CONSTRAINT compras_itens_valores_check CHECK ((valor_total >= (0)::numeric))
);


--
-- Name: TABLE compras_itens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compras_itens IS 'Itens individuais de cada compra (NF-e)';


--
-- Name: COLUMN compras_itens.codigo_produto_xml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras_itens.codigo_produto_xml IS 'Código do produto conforme consta no XML';


--
-- Name: COLUMN compras_itens.vinculado_manualmente; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras_itens.vinculado_manualmente IS 'Indica se o produto foi vinculado manualmente pelo usuário';


--
-- Name: COLUMN compras_itens.selecionado_na_importacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compras_itens.selecionado_na_importacao IS 'Indica se este produto foi selecionado pelo usuário durante a importação original do XML. Usado para manter consistência no reprocessamento.';


--
-- Name: contas_pagar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_pagar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    fornecedor_id uuid,
    origem_tipo text,
    origem_id uuid,
    descricao text NOT NULL,
    categoria text,
    valor_total numeric(12,2) NOT NULL,
    valor_aberto numeric(12,2) NOT NULL,
    data_emissao date NOT NULL,
    data_vencimento date NOT NULL,
    status text DEFAULT 'aberto'::text NOT NULL,
    observacoes text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contas_pagar_baixas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_pagar_baixas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    conta_id uuid NOT NULL,
    data_baixa date NOT NULL,
    valor_baixa numeric(12,2) NOT NULL,
    forma_pagamento text,
    caixa_movimentacao_id bigint,
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contas_receber; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_receber (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    cliente_id uuid,
    origem_tipo text,
    origem_id uuid,
    descricao text NOT NULL,
    valor_total numeric(12,2) NOT NULL,
    valor_aberto numeric(12,2) NOT NULL,
    data_emissao date NOT NULL,
    data_vencimento date NOT NULL,
    status text DEFAULT 'aberto'::text NOT NULL,
    observacoes text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contas_receber_baixas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_receber_baixas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    conta_id uuid NOT NULL,
    data_baixa date NOT NULL,
    valor_baixa numeric(12,2) NOT NULL,
    finalizadora_id uuid,
    pagamento_id uuid,
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: empresa_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_counters (
    empresa_id uuid NOT NULL,
    next_cliente_codigo integer DEFAULT 1 NOT NULL,
    next_agendamento_codigo bigint DEFAULT 1 NOT NULL
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa character varying(10) NOT NULL,
    nome character varying(255) NOT NULL,
    telefone character varying(20),
    endereco text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    razao_social text,
    nome_fantasia text,
    cnpj character varying(18),
    email text,
    logo_url text
);


--
-- Name: estoque_baixa_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estoque_baixa_log (
    comanda_id uuid NOT NULL,
    baixado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estoque_reservado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estoque_reservado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa integer NOT NULL,
    produto_id uuid NOT NULL,
    comanda_id uuid NOT NULL,
    quantidade numeric(10,2) NOT NULL,
    reservado_em timestamp with time zone DEFAULT now(),
    liberado_em timestamp with time zone
);


--
-- Name: TABLE estoque_reservado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.estoque_reservado IS 'Controle de estoque reservado para evitar overselling';


--
-- Name: finalizadoras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finalizadoras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    nome text NOT NULL,
    tipo text DEFAULT 'outros'::text,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    taxa_percentual numeric(8,4),
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    codigo_interno text,
    codigo_sefaz text,
    CONSTRAINT finalizadoras_tipo_check CHECK ((tipo = ANY (ARRAY['dinheiro'::text, 'credito'::text, 'debito'::text, 'pix'::text, 'voucher'::text, 'outros'::text])))
);


--
-- Name: COLUMN finalizadoras.codigo_interno; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finalizadoras.codigo_interno IS 'Código interno sequencial (01, 02, 03...)';


--
-- Name: COLUMN finalizadoras.codigo_sefaz; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finalizadoras.codigo_sefaz IS 'Código oficial SEFAZ para XML NF-e/NFC-e';


--
-- Name: itens_venda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itens_venda (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venda_id uuid NOT NULL,
    produto_id uuid NOT NULL,
    quantidade integer NOT NULL,
    preco_unitario numeric(10,2) NOT NULL,
    preco_total numeric(10,2) NOT NULL,
    codigo_empresa character varying(10)
);


--
-- Name: mesas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mesas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text DEFAULT public.get_my_company_code() NOT NULL,
    numero integer NOT NULL,
    nome text,
    status public.mesa_status DEFAULT 'available'::public.mesa_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN mesas.nome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mesas.nome IS 'Nome amigável da mesa (ex.: Pátio 1)';


--
-- Name: movimentos_saldo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimentos_saldo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    cliente_id uuid NOT NULL,
    agendamento_id uuid,
    tipo text NOT NULL,
    valor numeric(12,2) NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT movimentos_saldo_tipo_check CHECK ((tipo = ANY (ARRAY['credito'::text, 'debito'::text]))),
    CONSTRAINT movimentos_saldo_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text DEFAULT public.get_my_company_code() NOT NULL,
    comanda_id uuid NOT NULL,
    caixa_id uuid,
    metodo text,
    valor numeric(12,2) NOT NULL,
    status text DEFAULT 'Pago'::text NOT NULL,
    recebido_em timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    finalizadora_id uuid,
    origem text DEFAULT 'manual'::text,
    xml_chave text,
    cliente_id uuid,
    CONSTRAINT pagamentos_origem_check CHECK (((origem = ANY (ARRAY['manual'::text, 'xml'::text, 'api'::text])) OR (origem IS NULL))),
    CONSTRAINT pagamentos_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: produto_categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_empresa text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(255) NOT NULL,
    valor_venda numeric(10,2) NOT NULL,
    categoria character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    criado_em timestamp with time zone DEFAULT now(),
    codigo_empresa character varying(10) NOT NULL,
    valor_custo numeric(10,2) DEFAULT 0 NOT NULL,
    validade date,
    estoque integer DEFAULT 0 NOT NULL,
    estoque_minimo integer DEFAULT 0 NOT NULL,
    tipo_produto character varying(20) DEFAULT 'venda'::character varying NOT NULL,
    codigo_produto text,
    codigo_barras character varying(13),
    codigo_barras_caixa character varying(13),
    referencia character varying(100),
    marca character varying(100),
    grupo character varying(100),
    unidade character varying(10),
    estoque_inicial integer,
    estoque_atual integer,
    peso numeric(10,3),
    preco_compra numeric(12,2),
    custos_percent numeric(7,4),
    preco_custo numeric(12,2),
    lucro_percent numeric(7,4),
    preco_venda numeric(12,2),
    qtd_atacado integer,
    preco_atacado numeric(12,2),
    comissao_percent numeric(7,4),
    desconto_percent numeric(7,4),
    cfop_interno character(4),
    cst_icms_interno character(3),
    csosn_interno character(3),
    aliquota_icms_interno numeric(7,4),
    cfop_externo character(4),
    cst_icms_externo character(3),
    csosn_externo character(3),
    aliquota_icms_externo numeric(7,4),
    cst_pis_entrada character(2),
    cst_pis_saida character(2),
    aliquota_pis_percent numeric(7,4),
    aliquota_cofins_percent numeric(7,4),
    cst_ipi character(2),
    aliquota_ipi_percent numeric(7,4),
    fcp_percent numeric(7,4),
    mva_percent numeric(7,4),
    base_reduzida_percent numeric(7,4),
    ncm character varying(10),
    descricao_ncm text,
    cest character(7),
    ativo boolean DEFAULT true NOT NULL,
    permite_venda boolean DEFAULT true NOT NULL,
    paga_comissao boolean DEFAULT false NOT NULL,
    preco_variavel boolean DEFAULT false NOT NULL,
    composicao boolean DEFAULT false NOT NULL,
    servico boolean DEFAULT false NOT NULL,
    grade boolean DEFAULT false NOT NULL,
    usar_tabela_preco boolean DEFAULT false NOT NULL,
    combustivel boolean DEFAULT false NOT NULL,
    usa_imei boolean DEFAULT false NOT NULL,
    controle_estoque_por_grade boolean DEFAULT false NOT NULL,
    mostrar_no_app boolean DEFAULT false NOT NULL,
    importado_via_xml boolean DEFAULT false NOT NULL,
    xml_chave text,
    xml_numero text,
    xml_serie text,
    xml_emissao timestamp with time zone,
    fornecedor_id uuid,
    data_importacao timestamp with time zone,
    xml_chave_nfe character varying(44),
    xml_numero_nfe character varying(20),
    CONSTRAINT produtos_estoque_check CHECK ((estoque >= 0)),
    CONSTRAINT produtos_estoque_minimo_check CHECK ((estoque_minimo >= 0)),
    CONSTRAINT produtos_tipo_produto_check CHECK (((tipo_produto)::text = ANY ((ARRAY['venda'::character varying, 'uso_interno'::character varying])::text[]))),
    CONSTRAINT produtos_valor_custo_check CHECK ((valor_custo >= (0)::numeric))
);


--
-- Name: COLUMN produtos.importado_via_xml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.produtos.importado_via_xml IS 'Indica se o produto foi importado de um XML de NF-e';


--
-- Name: COLUMN produtos.fornecedor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.produtos.fornecedor_id IS 'ID do fornecedor (cliente com flag_fornecedor=true)';


--
-- Name: COLUMN produtos.data_importacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.produtos.data_importacao IS 'Data/hora da última importação via XML';


--
-- Name: COLUMN produtos.xml_chave_nfe; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.produtos.xml_chave_nfe IS 'Chave de acesso da NF-e de origem (44 dígitos)';


--
-- Name: COLUMN produtos.xml_numero_nfe; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.produtos.xml_numero_nfe IS 'Número da NF-e de origem';


--
-- Name: quadras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quadras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(255) NOT NULL,
    modalidades text[] NOT NULL,
    tipo character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'Ativa'::character varying,
    criado_em timestamp with time zone DEFAULT now(),
    valor numeric(10,2),
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    codigo_empresa text NOT NULL,
    descricao text,
    CONSTRAINT quadras_horario_valido CHECK (((hora_fim > hora_inicio) OR ((hora_fim = '00:00:00'::time without time zone) AND (hora_inicio <> '00:00:00'::time without time zone)))),
    CONSTRAINT quadras_valor_nonneg CHECK (((valor IS NULL) OR (valor >= (0)::numeric)))
);


--
-- Name: COLUMN quadras.valor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras.valor IS 'Preço por meia hora (R$) para locação da quadra';


--
-- Name: COLUMN quadras.hora_inicio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras.hora_inicio IS 'Horário padrão de abertura da quadra';


--
-- Name: COLUMN quadras.hora_fim; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras.hora_fim IS 'Horário padrão de fechamento da quadra';


--
-- Name: COLUMN quadras.descricao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras.descricao IS 'Descrição detalhada da quadra (dimensões, características, comodidades)';


--
-- Name: quadras_dias_funcionamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quadras_dias_funcionamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quadra_id uuid NOT NULL,
    codigo_empresa text NOT NULL,
    tipo character varying(20) NOT NULL,
    dia_semana integer,
    data_fechamento date,
    funciona boolean DEFAULT true NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_data_fechamento_required CHECK (((((tipo)::text = 'data_fechamento'::text) AND (data_fechamento IS NOT NULL)) OR ((tipo)::text <> 'data_fechamento'::text))),
    CONSTRAINT check_dia_semana_required CHECK (((((tipo)::text = 'dia_semana'::text) AND (dia_semana IS NOT NULL)) OR ((tipo)::text <> 'dia_semana'::text))),
    CONSTRAINT quadras_dias_funcionamento_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6))),
    CONSTRAINT quadras_dias_funcionamento_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['dia_semana'::character varying, 'data_fechamento'::character varying])::text[])))
);


--
-- Name: TABLE quadras_dias_funcionamento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quadras_dias_funcionamento IS 'Configuração de dias de funcionamento das quadras por dia da semana e fechamentos específicos';


--
-- Name: COLUMN quadras_dias_funcionamento.tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras_dias_funcionamento.tipo IS 'Tipo de configuração: dia_semana ou data_fechamento';


--
-- Name: COLUMN quadras_dias_funcionamento.dia_semana; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras_dias_funcionamento.dia_semana IS 'Dia da semana (0=domingo, 1=segunda, ..., 6=sábado)';


--
-- Name: COLUMN quadras_dias_funcionamento.data_fechamento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras_dias_funcionamento.data_fechamento IS 'Data específica de fechamento';


--
-- Name: COLUMN quadras_dias_funcionamento.funciona; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quadras_dias_funcionamento.funciona IS 'Se a quadra funciona neste dia/data (true=aberta, false=fechada)';


--
-- Name: user_ui_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_ui_settings (
    user_id uuid NOT NULL,
    scope text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid NOT NULL,
    nome character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    papel character varying(50) DEFAULT 'user'::character varying,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    codigo_empresa character varying(10) NOT NULL
);


--
-- Name: v_agendamento_participantes; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: v_agendamentos_detalhado; Type: VIEW; Schema: public; Owner: -
--

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
            WHEN 'Pago'::text THEN '✅ Pago'::text
            WHEN 'Pendente'::text THEN '⏳ Pendente'::text
            WHEN 'Cancelado'::text THEN '❌ Cancelado'::text
            ELSE (ap.status_pagamento)::text
        END AS status_pagamento_legivel
   FROM ((((public.agendamentos a
     LEFT JOIN public.quadras q ON ((a.quadra_id = q.id)))
     LEFT JOIN public.agendamento_participantes ap ON ((a.id = ap.agendamento_id)))
     LEFT JOIN public.clientes c ON ((ap.cliente_id = c.id)))
     LEFT JOIN public.finalizadoras f ON ((ap.finalizadora_id = f.id)))
  ORDER BY a.inicio DESC, a.codigo DESC, ap.nome;


--
-- Name: VIEW v_agendamentos_detalhado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_agendamentos_detalhado IS 'View detalhada dos agendamentos com participantes e finalizadoras. 
Cada linha representa um participante do agendamento. 
Agendamentos sem participantes também aparecem (com dados de participante NULL).';


--
-- Name: v_agendamentos_isis; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: vendas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid,
    numero_mesa integer,
    valor_total numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    criado_em timestamp with time zone DEFAULT now(),
    codigo_empresa character varying(10) NOT NULL
);


--
-- Name: caixa_movimentacoes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_movimentacoes ALTER COLUMN id SET DEFAULT nextval('public.caixa_movimentacoes_id_seq'::regclass);


--
-- Name: caixa_resumos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_resumos ALTER COLUMN id SET DEFAULT nextval('public.caixa_resumos_id_seq'::regclass);


--
-- Name: agenda_settings agenda_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_settings
    ADD CONSTRAINT agenda_settings_pkey PRIMARY KEY (empresa_id);


--
-- Name: agendamento_participantes agendamento_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento_participantes
    ADD CONSTRAINT agendamento_participantes_pkey PRIMARY KEY (id);


--
-- Name: agendamentos bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: caixa_movimentacoes caixa_movimentacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_movimentacoes
    ADD CONSTRAINT caixa_movimentacoes_pkey PRIMARY KEY (id);


--
-- Name: caixa_movimentos caixa_movimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_movimentos
    ADD CONSTRAINT caixa_movimentos_pkey PRIMARY KEY (id);


--
-- Name: caixa_resumos caixa_resumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_resumos
    ADD CONSTRAINT caixa_resumos_pkey PRIMARY KEY (id);


--
-- Name: caixa_sessoes caixa_sessoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_sessoes
    ADD CONSTRAINT caixa_sessoes_pkey PRIMARY KEY (id);


--
-- Name: comanda_clientes comanda_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_clientes
    ADD CONSTRAINT comanda_clientes_pkey PRIMARY KEY (id);


--
-- Name: comanda_historico comanda_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_historico
    ADD CONSTRAINT comanda_historico_pkey PRIMARY KEY (id);


--
-- Name: comanda_itens comanda_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_itens
    ADD CONSTRAINT comanda_itens_pkey PRIMARY KEY (id);


--
-- Name: comandas comandas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT comandas_pkey PRIMARY KEY (id);


--
-- Name: empresas companies_company_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT companies_company_code_key UNIQUE (codigo_empresa);


--
-- Name: empresas companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: compras_itens compras_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_itens
    ADD CONSTRAINT compras_itens_pkey PRIMARY KEY (id);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- Name: contas_pagar_baixas contas_pagar_baixas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_pagar_baixas
    ADD CONSTRAINT contas_pagar_baixas_pkey PRIMARY KEY (id);


--
-- Name: contas_pagar contas_pagar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_pagar
    ADD CONSTRAINT contas_pagar_pkey PRIMARY KEY (id);


--
-- Name: contas_receber_baixas contas_receber_baixas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_receber_baixas
    ADD CONSTRAINT contas_receber_baixas_pkey PRIMARY KEY (id);


--
-- Name: contas_receber contas_receber_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_receber
    ADD CONSTRAINT contas_receber_pkey PRIMARY KEY (id);


--
-- Name: quadras courts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quadras
    ADD CONSTRAINT courts_pkey PRIMARY KEY (id);


--
-- Name: clientes customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: empresa_counters empresa_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_counters
    ADD CONSTRAINT empresa_counters_pkey PRIMARY KEY (empresa_id);


--
-- Name: empresas empresas_codigo_empresa_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_codigo_empresa_unique UNIQUE (codigo_empresa);


--
-- Name: estoque_baixa_log estoque_baixa_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_baixa_log
    ADD CONSTRAINT estoque_baixa_log_pkey PRIMARY KEY (comanda_id);


--
-- Name: estoque_reservado estoque_reservado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_reservado
    ADD CONSTRAINT estoque_reservado_pkey PRIMARY KEY (id);


--
-- Name: finalizadoras finalizadoras_empresa_nome_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finalizadoras
    ADD CONSTRAINT finalizadoras_empresa_nome_unique UNIQUE (codigo_empresa, nome);


--
-- Name: finalizadoras finalizadoras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finalizadoras
    ADD CONSTRAINT finalizadoras_pkey PRIMARY KEY (id);


--
-- Name: mesas mesas_codigo_empresa_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT mesas_codigo_empresa_numero_key UNIQUE (codigo_empresa, numero);


--
-- Name: mesas mesas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesas
    ADD CONSTRAINT mesas_pkey PRIMARY KEY (id);


--
-- Name: movimentos_saldo movimentos_saldo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimentos_saldo
    ADD CONSTRAINT movimentos_saldo_pkey PRIMARY KEY (id);


--
-- Name: pagamentos pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_pkey PRIMARY KEY (id);


--
-- Name: produtos products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: produto_categorias produto_categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_categorias
    ADD CONSTRAINT produto_categorias_pkey PRIMARY KEY (id);


--
-- Name: quadras_dias_funcionamento quadras_dias_funcionamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quadras_dias_funcionamento
    ADD CONSTRAINT quadras_dias_funcionamento_pkey PRIMARY KEY (id);


--
-- Name: itens_venda sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_venda
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: vendas sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: colaboradores user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaboradores
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_ui_settings user_ui_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ui_settings
    ADD CONSTRAINT user_ui_settings_pkey PRIMARY KEY (user_id, scope);


--
-- Name: usuarios users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: agendamento_participantes_agendamento_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agendamento_participantes_agendamento_id_idx ON public.agendamento_participantes USING btree (agendamento_id);


--
-- Name: agendamentos_codigo_empresa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agendamentos_codigo_empresa_idx ON public.agendamentos USING btree (codigo_empresa);


--
-- Name: clientes_codigo_empresa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clientes_codigo_empresa_idx ON public.clientes USING btree (codigo_empresa);


--
-- Name: colaboradores_codigo_empresa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX colaboradores_codigo_empresa_idx ON public.colaboradores USING btree (codigo_empresa);


--
-- Name: comanda_clientes_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comanda_clientes_cliente_idx ON public.comanda_clientes USING btree (cliente_id);


--
-- Name: comanda_clientes_comanda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comanda_clientes_comanda_idx ON public.comanda_clientes USING btree (comanda_id);


--
-- Name: comanda_clientes_empresa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comanda_clientes_empresa_idx ON public.comanda_clientes USING btree (codigo_empresa);


--
-- Name: companies_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_code_idx ON public.empresas USING btree (codigo_empresa);


--
-- Name: compras_chave_nfe_ativa_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX compras_chave_nfe_ativa_unique ON public.compras USING btree (chave_nfe) WHERE (ativo = true);


--
-- Name: INDEX compras_chave_nfe_ativa_unique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.compras_chave_nfe_ativa_unique IS 'Ensures only one active NF-e per chave_nfe. Allows multiple inactive records with same key.';


--
-- Name: gin_trgm_clientes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gin_trgm_clientes_email ON public.clientes USING gin (email public.gin_trgm_ops);


--
-- Name: gin_trgm_clientes_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gin_trgm_clientes_nome ON public.clientes USING gin (nome public.gin_trgm_ops);


--
-- Name: gin_trgm_clientes_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gin_trgm_clientes_telefone ON public.clientes USING gin (telefone public.gin_trgm_ops);


--
-- Name: idx_agendamento_participantes_ordem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamento_participantes_ordem ON public.agendamento_participantes USING btree (agendamento_id, ordem);


--
-- Name: idx_agp_agendamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agp_agendamento ON public.agendamento_participantes USING btree (agendamento_id);


--
-- Name: idx_agp_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agp_codigo_empresa ON public.agendamento_participantes USING btree (codigo_empresa);


--
-- Name: idx_agp_finalizadora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agp_finalizadora ON public.agendamento_participantes USING btree (finalizadora_id);


--
-- Name: idx_caixa_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_empresa ON public.caixa_sessoes USING btree (codigo_empresa);


--
-- Name: idx_caixa_mov_empresa_sessao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_mov_empresa_sessao ON public.caixa_movimentacoes USING btree (codigo_empresa, caixa_sessao_id);


--
-- Name: idx_caixa_mov_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_mov_tipo ON public.caixa_movimentacoes USING btree (tipo);


--
-- Name: idx_caixa_movimentos_caixa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_movimentos_caixa ON public.caixa_movimentos USING btree (caixa_id);


--
-- Name: idx_caixa_movimentos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_movimentos_empresa ON public.caixa_movimentos USING btree (codigo_empresa);


--
-- Name: idx_caixa_resumos_empresa_sessao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_resumos_empresa_sessao ON public.caixa_resumos USING btree (codigo_empresa, caixa_sessao_id);


--
-- Name: idx_caixa_resumos_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_resumos_periodo ON public.caixa_resumos USING btree (periodo_de, periodo_ate);


--
-- Name: idx_caixa_resumos_sessao_criado_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_resumos_sessao_criado_em ON public.caixa_resumos USING btree (caixa_sessao_id, criado_em DESC);


--
-- Name: idx_caixa_sessoes_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_sessoes_empresa ON public.caixa_sessoes USING btree (codigo_empresa);


--
-- Name: idx_caixa_sessoes_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_sessoes_empresa_status ON public.caixa_sessoes USING btree (codigo_empresa, status);


--
-- Name: idx_clientes_consumidor_final; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_consumidor_final ON public.clientes USING btree (codigo_empresa, is_consumidor_final) WHERE (is_consumidor_final = true);


--
-- Name: idx_clientes_empresa_aniversario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_empresa_aniversario ON public.clientes USING btree (codigo_empresa, aniversario);


--
-- Name: idx_clientes_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_empresa_nome ON public.clientes USING btree (codigo_empresa, nome);


--
-- Name: idx_clientes_empresa_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_empresa_telefone ON public.clientes USING btree (codigo_empresa, telefone);


--
-- Name: idx_colaboradores_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaboradores_ativo ON public.colaboradores USING btree (ativo);


--
-- Name: idx_colaboradores_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaboradores_codigo_empresa ON public.colaboradores USING btree (codigo_empresa);


--
-- Name: idx_comanda_clientes_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_clientes_cliente ON public.comanda_clientes USING btree (cliente_id);


--
-- Name: idx_comanda_clientes_comanda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_clientes_comanda ON public.comanda_clientes USING btree (comanda_id);


--
-- Name: idx_comanda_clientes_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_clientes_empresa ON public.comanda_clientes USING btree (codigo_empresa);


--
-- Name: idx_comanda_historico_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_historico_codigo_empresa ON public.comanda_historico USING btree (codigo_empresa);


--
-- Name: idx_comanda_historico_comanda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_historico_comanda_id ON public.comanda_historico USING btree (comanda_id);


--
-- Name: idx_comanda_historico_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_historico_tipo ON public.comanda_historico USING btree (tipo_alteracao);


--
-- Name: idx_comanda_itens_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_itens_codigo_empresa ON public.comanda_itens USING btree (codigo_empresa);


--
-- Name: idx_comanda_itens_comanda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_itens_comanda ON public.comanda_itens USING btree (comanda_id);


--
-- Name: idx_comanda_itens_comanda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_itens_comanda_id ON public.comanda_itens USING btree (comanda_id);


--
-- Name: idx_comanda_itens_desconto_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_itens_desconto_tipo ON public.comanda_itens USING btree (desconto_tipo) WHERE (desconto_tipo IS NOT NULL);


--
-- Name: idx_comanda_itens_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_itens_empresa ON public.comanda_itens USING btree (codigo_empresa);


--
-- Name: idx_comanda_itens_produto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_itens_produto ON public.comanda_itens USING btree (produto_id);


--
-- Name: idx_comandas_aberto_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_aberto_em ON public.comandas USING btree (aberto_em DESC);


--
-- Name: idx_comandas_agendamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_agendamento_id ON public.comandas USING btree (agendamento_id);


--
-- Name: idx_comandas_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_codigo_empresa ON public.comandas USING btree (codigo_empresa);


--
-- Name: idx_comandas_desconto_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_desconto_tipo ON public.comandas USING btree (desconto_tipo) WHERE (desconto_tipo IS NOT NULL);


--
-- Name: idx_comandas_empresa_fechado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_empresa_fechado ON public.comandas USING btree (codigo_empresa, fechado_em);


--
-- Name: idx_comandas_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_empresa_status ON public.comandas USING btree (codigo_empresa, status);


--
-- Name: idx_comandas_fechado_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_fechado_em ON public.comandas USING btree (fechado_em DESC) WHERE (fechado_em IS NOT NULL);


--
-- Name: idx_comandas_mesa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_mesa ON public.comandas USING btree (mesa_id);


--
-- Name: idx_comandas_mesa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_mesa_status ON public.comandas USING btree (mesa_id, status) WHERE (fechado_em IS NULL);


--
-- Name: idx_comandas_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_origem ON public.comandas USING btree (origem);


--
-- Name: idx_comandas_ultima_atualizacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_ultima_atualizacao ON public.comandas USING btree (ultima_atualizacao);


--
-- Name: idx_comandas_vendedor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_vendedor_id ON public.comandas USING btree (vendedor_id);


--
-- Name: idx_comandas_xml_chave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_xml_chave ON public.comandas USING btree (xml_chave);


--
-- Name: idx_compras_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_ativo ON public.compras USING btree (ativo) WHERE (ativo = true);


--
-- Name: idx_compras_chave_nfe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_chave_nfe ON public.compras USING btree (chave_nfe);


--
-- Name: idx_compras_data_emissao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_data_emissao ON public.compras USING btree (data_emissao DESC);


--
-- Name: idx_compras_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_empresa ON public.compras USING btree (codigo_empresa);


--
-- Name: idx_compras_empresa_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_empresa_ativo ON public.compras USING btree (codigo_empresa, ativo) WHERE (ativo = true);


--
-- Name: idx_compras_empresa_modelo_nfe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_empresa_modelo_nfe ON public.compras USING btree (codigo_empresa, modelo_nfe);


--
-- Name: idx_compras_fornecedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_fornecedor ON public.compras USING btree (fornecedor_id);


--
-- Name: idx_compras_itens_compra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_itens_compra ON public.compras_itens USING btree (compra_id);


--
-- Name: idx_compras_itens_produto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_itens_produto ON public.compras_itens USING btree (produto_id);


--
-- Name: idx_compras_itens_selecionado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_itens_selecionado ON public.compras_itens USING btree (selecionado_na_importacao);


--
-- Name: idx_compras_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_status ON public.compras USING btree (status);


--
-- Name: idx_contas_pagar_empresa_fornecedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contas_pagar_empresa_fornecedor ON public.contas_pagar USING btree (codigo_empresa, fornecedor_id);


--
-- Name: idx_contas_pagar_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contas_pagar_empresa_status ON public.contas_pagar USING btree (codigo_empresa, status);


--
-- Name: idx_contas_pagar_empresa_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contas_pagar_empresa_vencimento ON public.contas_pagar USING btree (codigo_empresa, data_vencimento);


--
-- Name: idx_contas_receber_empresa_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contas_receber_empresa_cliente ON public.contas_receber USING btree (codigo_empresa, cliente_id);


--
-- Name: idx_contas_receber_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contas_receber_empresa_status ON public.contas_receber USING btree (codigo_empresa, status);


--
-- Name: idx_contas_receber_empresa_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contas_receber_empresa_vencimento ON public.contas_receber USING btree (codigo_empresa, data_vencimento);


--
-- Name: idx_cp_baixas_empresa_conta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_baixas_empresa_conta ON public.contas_pagar_baixas USING btree (codigo_empresa, conta_id);


--
-- Name: idx_cp_baixas_empresa_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_baixas_empresa_data ON public.contas_pagar_baixas USING btree (codigo_empresa, data_baixa);


--
-- Name: idx_cr_baixas_empresa_conta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cr_baixas_empresa_conta ON public.contas_receber_baixas USING btree (codigo_empresa, conta_id);


--
-- Name: idx_cr_baixas_empresa_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cr_baixas_empresa_data ON public.contas_receber_baixas USING btree (codigo_empresa, data_baixa);


--
-- Name: idx_estoque_reservado_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estoque_reservado_ativo ON public.estoque_reservado USING btree (liberado_em) WHERE (liberado_em IS NULL);


--
-- Name: idx_estoque_reservado_comanda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estoque_reservado_comanda_id ON public.estoque_reservado USING btree (comanda_id);


--
-- Name: idx_estoque_reservado_produto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estoque_reservado_produto_id ON public.estoque_reservado USING btree (produto_id);


--
-- Name: idx_finalizadoras_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finalizadoras_ativo ON public.finalizadoras USING btree (ativo);


--
-- Name: idx_finalizadoras_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finalizadoras_codigo ON public.finalizadoras USING btree (codigo_interno);


--
-- Name: idx_finalizadoras_codigo_sefaz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finalizadoras_codigo_sefaz ON public.finalizadoras USING btree (codigo_sefaz);


--
-- Name: idx_finalizadoras_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finalizadoras_empresa ON public.finalizadoras USING btree (codigo_empresa);


--
-- Name: idx_finalizadoras_ordem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finalizadoras_ordem ON public.finalizadoras USING btree (ordem);


--
-- Name: idx_itens_venda_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_itens_venda_empresa ON public.itens_venda USING btree (codigo_empresa);


--
-- Name: idx_mesas_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mesas_codigo_empresa ON public.mesas USING btree (codigo_empresa);


--
-- Name: idx_mesas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mesas_empresa ON public.mesas USING btree (codigo_empresa);


--
-- Name: idx_mesas_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mesas_nome ON public.mesas USING gin (to_tsvector('simple'::regconfig, COALESCE(nome, ''::text)));


--
-- Name: idx_mov_saldo_agendamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_saldo_agendamento ON public.movimentos_saldo USING btree (agendamento_id);


--
-- Name: idx_mov_saldo_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_saldo_cliente ON public.movimentos_saldo USING btree (cliente_id);


--
-- Name: idx_mov_saldo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_saldo_empresa ON public.movimentos_saldo USING btree (codigo_empresa);


--
-- Name: idx_pagamentos_caixa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_caixa ON public.pagamentos USING btree (caixa_id);


--
-- Name: idx_pagamentos_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_codigo_empresa ON public.pagamentos USING btree (codigo_empresa);


--
-- Name: idx_pagamentos_comanda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_comanda ON public.pagamentos USING btree (comanda_id);


--
-- Name: idx_pagamentos_comanda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_comanda_id ON public.pagamentos USING btree (comanda_id);


--
-- Name: idx_pagamentos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_empresa ON public.pagamentos USING btree (codigo_empresa);


--
-- Name: idx_pagamentos_finalizadora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_finalizadora ON public.pagamentos USING btree (finalizadora_id);


--
-- Name: idx_pagamentos_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_origem ON public.pagamentos USING btree (origem);


--
-- Name: idx_pagamentos_recebido_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_recebido_em ON public.pagamentos USING btree (recebido_em);


--
-- Name: idx_pagamentos_xml_chave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_xml_chave ON public.pagamentos USING btree (xml_chave);


--
-- Name: idx_produtos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_categoria ON public.produtos USING btree (lower((categoria)::text));


--
-- Name: idx_produtos_codigo_barras; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_codigo_barras ON public.produtos USING btree (codigo_barras);


--
-- Name: idx_produtos_codigo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_codigo_empresa ON public.produtos USING btree (codigo_empresa);


--
-- Name: idx_produtos_fornecedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_fornecedor ON public.produtos USING btree (fornecedor_id) WHERE (fornecedor_id IS NOT NULL);


--
-- Name: idx_produtos_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_grupo ON public.produtos USING btree (grupo);


--
-- Name: idx_produtos_importado_via_xml; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_importado_via_xml ON public.produtos USING btree (importado_via_xml);


--
-- Name: idx_produtos_importados; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_importados ON public.produtos USING btree (importado_via_xml) WHERE (importado_via_xml = true);


--
-- Name: idx_produtos_marca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_marca ON public.produtos USING btree (marca);


--
-- Name: idx_produtos_ncm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_ncm ON public.produtos USING btree (ncm);


--
-- Name: idx_produtos_xml_chave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_xml_chave ON public.produtos USING btree (xml_chave);


--
-- Name: idx_quadras_dias_funcionamento_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quadras_dias_funcionamento_data ON public.quadras_dias_funcionamento USING btree (data_fechamento) WHERE ((tipo)::text = 'data_fechamento'::text);


--
-- Name: idx_quadras_dias_funcionamento_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quadras_dias_funcionamento_empresa ON public.quadras_dias_funcionamento USING btree (codigo_empresa);


--
-- Name: idx_quadras_dias_funcionamento_quadra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quadras_dias_funcionamento_quadra ON public.quadras_dias_funcionamento USING btree (quadra_id);


--
-- Name: idx_quadras_dias_funcionamento_quadra_data_fechamento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_quadras_dias_funcionamento_quadra_data_fechamento ON public.quadras_dias_funcionamento USING btree (quadra_id, data_fechamento) WHERE ((tipo)::text = 'data_fechamento'::text);


--
-- Name: idx_quadras_dias_funcionamento_quadra_dia_semana; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_quadras_dias_funcionamento_quadra_dia_semana ON public.quadras_dias_funcionamento USING btree (quadra_id, dia_semana) WHERE ((tipo)::text = 'dia_semana'::text);


--
-- Name: idx_vendas_criado_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_criado_em ON public.vendas USING btree (criado_em DESC);


--
-- Name: idx_vendas_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_empresa_status ON public.vendas USING btree (codigo_empresa, status);


--
-- Name: produtos_codigo_empresa_nome_unidade_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX produtos_codigo_empresa_nome_unidade_unique ON public.produtos USING btree (codigo_empresa, lower((nome)::text), COALESCE(upper((unidade)::text), ''::text));


--
-- Name: quadras_codigo_empresa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quadras_codigo_empresa_idx ON public.quadras USING btree (codigo_empresa);


--
-- Name: uq_caixa_aberto_por_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_caixa_aberto_por_empresa ON public.caixa_sessoes USING btree (codigo_empresa) WHERE (status = 'open'::text);


--
-- Name: uq_clientes_empresa_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clientes_empresa_codigo ON public.clientes USING btree (codigo_empresa, codigo);


--
-- Name: uq_clientes_empresa_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clientes_empresa_cpf ON public.clientes USING btree (codigo_empresa, cpf) WHERE (cpf IS NOT NULL);


--
-- Name: uq_clientes_empresa_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clientes_empresa_email_lower ON public.clientes USING btree (codigo_empresa, lower((email)::text)) WHERE (email IS NOT NULL);


--
-- Name: uq_finalizadoras_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_finalizadoras_empresa_nome ON public.finalizadoras USING btree (codigo_empresa, lower(nome));


--
-- Name: uq_mesas_empresa_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_mesas_empresa_numero ON public.mesas USING btree (codigo_empresa, numero);


--
-- Name: usuarios_codigo_empresa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuarios_codigo_empresa_idx ON public.usuarios USING btree (codigo_empresa);


--
-- Name: ux_agendamentos_empresa_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_agendamentos_empresa_codigo ON public.agendamentos USING btree (codigo_empresa, codigo);


--
-- Name: ux_produto_categorias_empresa_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_produto_categorias_empresa_nome ON public.produto_categorias USING btree (codigo_empresa, lower(nome));


--
-- Name: ux_produtos_empresa_codigo_produto; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_produtos_empresa_codigo_produto ON public.produtos USING btree (codigo_empresa, lower(codigo_produto)) WHERE (codigo_produto IS NOT NULL);


--
-- Name: agendamentos agendamentos_set_empresa_from_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agendamentos_set_empresa_from_user BEFORE INSERT ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.set_agendamento_empresa_from_user();


--
-- Name: clientes clientes_set_empresa_from_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clientes_set_empresa_from_user BEFORE INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_empresa_from_user();


--
-- Name: clientes clientes_set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clientes_set_timestamp BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();


--
-- Name: agendamento_participantes set_updated_at_agp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_agp BEFORE UPDATE ON public.agendamento_participantes FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- Name: agendamento_participantes trg_ag_participantes_set_empresa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ag_participantes_set_empresa BEFORE INSERT OR UPDATE OF agendamento_id ON public.agendamento_participantes FOR EACH ROW EXECUTE FUNCTION public.set_ag_participantes_codigo_empresa();


--
-- Name: agenda_settings trg_agenda_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agenda_settings_set_updated_at BEFORE UPDATE ON public.agenda_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comandas trg_baixa_estoque_on_close; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_baixa_estoque_on_close AFTER UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.trg_comandas_baixar_estoque();


--
-- Name: caixa_movimentos trg_caixa_movimentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_caixa_movimentos_updated_at BEFORE UPDATE ON public.caixa_movimentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: caixa_sessoes trg_caixa_sessoes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_caixa_sessoes_updated_at BEFORE UPDATE ON public.caixa_sessoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clientes trg_clientes_set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clientes_set_timestamp BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.tg_set_timestamp();


--
-- Name: colaboradores trg_colaboradores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_colaboradores_updated_at BEFORE UPDATE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comanda_itens trg_comanda_itens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comanda_itens_updated_at BEFORE UPDATE ON public.comanda_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comandas trg_comandas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comandas_updated_at BEFORE UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contas_pagar trg_contas_pagar_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contas_pagar_set_updated_at BEFORE UPDATE ON public.contas_pagar FOR EACH ROW EXECUTE FUNCTION public.trg_contas_pagar_set_updated_at();


--
-- Name: contas_receber trg_contas_receber_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contas_receber_set_updated_at BEFORE UPDATE ON public.contas_receber FOR EACH ROW EXECUTE FUNCTION public.trg_contas_receber_set_updated_at();


--
-- Name: finalizadoras trg_finalizadoras_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_finalizadoras_updated_at BEFORE UPDATE ON public.finalizadoras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mesas trg_mesas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mesas_updated_at BEFORE UPDATE ON public.mesas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: movimentos_saldo trg_mov_saldo_apply; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mov_saldo_apply AFTER INSERT OR DELETE OR UPDATE ON public.movimentos_saldo FOR EACH ROW EXECUTE FUNCTION public.fn_mov_saldo_apply();


--
-- Name: pagamentos trg_pagamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: produto_categorias trg_produto_categorias_set_empresa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_produto_categorias_set_empresa BEFORE INSERT ON public.produto_categorias FOR EACH ROW EXECUTE FUNCTION public.set_empresa_produto_categorias();


--
-- Name: produto_categorias trg_produto_categorias_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_produto_categorias_touch BEFORE UPDATE ON public.produto_categorias FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: produtos trg_produtos_autocode; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_produtos_autocode BEFORE INSERT ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.gen_codigo_produto();


--
-- Name: produtos trg_produtos_normalize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_produtos_normalize BEFORE INSERT OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.normalize_codigo_produto();


--
-- Name: produtos trg_produtos_set_company_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_produtos_set_company_code BEFORE INSERT ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.produtos_set_company_code();


--
-- Name: clientes trg_protect_consumidor_final; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_consumidor_final BEFORE DELETE OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.protect_consumidor_final();


--
-- Name: quadras_dias_funcionamento trg_quadras_dias_funcionamento_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quadras_dias_funcionamento_updated_at BEFORE UPDATE ON public.quadras_dias_funcionamento FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: caixa_sessoes trg_set_company_code_caixa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_caixa BEFORE INSERT ON public.caixa_sessoes FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: comanda_clientes trg_set_company_code_comanda_clientes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_comanda_clientes BEFORE INSERT ON public.comanda_clientes FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: comanda_itens trg_set_company_code_comanda_itens; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_comanda_itens BEFORE INSERT ON public.comanda_itens FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: comandas trg_set_company_code_comandas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_comandas BEFORE INSERT ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: finalizadoras trg_set_company_code_finalizadoras; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_finalizadoras BEFORE INSERT ON public.finalizadoras FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: mesas trg_set_company_code_mesas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_mesas BEFORE INSERT ON public.mesas FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: pagamentos trg_set_company_code_pagamentos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_company_code_pagamentos BEFORE INSERT ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.set_company_code_default();


--
-- Name: comandas trigger_atualizar_ultima_atualizacao_comanda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_atualizar_ultima_atualizacao_comanda BEFORE UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.atualizar_ultima_atualizacao_comanda();


--
-- Name: comanda_itens trigger_atualizar_ultima_atualizacao_item; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_atualizar_ultima_atualizacao_item AFTER INSERT OR DELETE OR UPDATE ON public.comanda_itens FOR EACH ROW EXECUTE FUNCTION public.atualizar_ultima_atualizacao_item();


--
-- Name: comandas trigger_registrar_historico_comanda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_registrar_historico_comanda AFTER UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_comanda();


--
-- Name: compras trigger_update_compras_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_compras_timestamp BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.update_compras_timestamp();


--
-- Name: agendamentos zz_agendamentos_set_codigo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zz_agendamentos_set_codigo BEFORE INSERT ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.agendamentos_set_codigo_fn();


--
-- Name: clientes zz_clientes_set_codigo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zz_clientes_set_codigo BEFORE INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.clientes_set_codigo_fn();


--
-- Name: agenda_settings agenda_settings_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_settings
    ADD CONSTRAINT agenda_settings_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: agendamento_participantes agendamento_participantes_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento_participantes
    ADD CONSTRAINT agendamento_participantes_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE CASCADE;


--
-- Name: agendamento_participantes agendamento_participantes_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento_participantes
    ADD CONSTRAINT agendamento_participantes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: agendamentos agendamentos_codigo_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_codigo_empresa_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: agendamento_participantes agp_codigo_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento_participantes
    ADD CONSTRAINT agp_codigo_empresa_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: agendamento_participantes agp_finalizadora_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento_participantes
    ADD CONSTRAINT agp_finalizadora_id_fkey FOREIGN KEY (finalizadora_id) REFERENCES public.finalizadoras(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: agendamentos bookings_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT bookings_court_id_fkey FOREIGN KEY (quadra_id) REFERENCES public.quadras(id);


--
-- Name: agendamentos bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: caixa_movimentacoes caixa_movimentacoes_caixa_sessao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_movimentacoes
    ADD CONSTRAINT caixa_movimentacoes_caixa_sessao_id_fkey FOREIGN KEY (caixa_sessao_id) REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE;


--
-- Name: caixa_movimentos caixa_movimentos_caixa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_movimentos
    ADD CONSTRAINT caixa_movimentos_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE;


--
-- Name: caixa_resumos caixa_resumos_caixa_sessao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_resumos
    ADD CONSTRAINT caixa_resumos_caixa_sessao_id_fkey FOREIGN KEY (caixa_sessao_id) REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE;


--
-- Name: clientes clientes_codigo_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_codigo_empresa_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: colaboradores colaboradores_codigo_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaboradores
    ADD CONSTRAINT colaboradores_codigo_empresa_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON DELETE RESTRICT;


--
-- Name: comanda_clientes comanda_clientes_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_clientes
    ADD CONSTRAINT comanda_clientes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: comanda_clientes comanda_clientes_comanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_clientes
    ADD CONSTRAINT comanda_clientes_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;


--
-- Name: comanda_historico comanda_historico_comanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_historico
    ADD CONSTRAINT comanda_historico_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;


--
-- Name: comanda_itens comanda_itens_comanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_itens
    ADD CONSTRAINT comanda_itens_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;


--
-- Name: comanda_itens comanda_itens_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_itens
    ADD CONSTRAINT comanda_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE RESTRICT;


--
-- Name: comandas comandas_mesa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT comandas_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES public.mesas(id) ON DELETE SET NULL;


--
-- Name: compras compras_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);


--
-- Name: compras compras_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: compras compras_inativado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_inativado_por_fkey FOREIGN KEY (inativado_por) REFERENCES auth.users(id);


--
-- Name: compras_itens compras_itens_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_itens
    ADD CONSTRAINT compras_itens_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;


--
-- Name: compras_itens compras_itens_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_itens
    ADD CONSTRAINT compras_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;


--
-- Name: contas_pagar_baixas contas_pagar_baixas_caixa_movimentacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_pagar_baixas
    ADD CONSTRAINT contas_pagar_baixas_caixa_movimentacao_id_fkey FOREIGN KEY (caixa_movimentacao_id) REFERENCES public.caixa_movimentacoes(id);


--
-- Name: contas_pagar_baixas contas_pagar_baixas_conta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_pagar_baixas
    ADD CONSTRAINT contas_pagar_baixas_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES public.contas_pagar(id) ON DELETE CASCADE;


--
-- Name: contas_pagar contas_pagar_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_pagar
    ADD CONSTRAINT contas_pagar_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.clientes(id);


--
-- Name: contas_receber_baixas contas_receber_baixas_conta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_receber_baixas
    ADD CONSTRAINT contas_receber_baixas_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES public.contas_receber(id) ON DELETE CASCADE;


--
-- Name: contas_receber_baixas contas_receber_baixas_finalizadora_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_receber_baixas
    ADD CONSTRAINT contas_receber_baixas_finalizadora_id_fkey FOREIGN KEY (finalizadora_id) REFERENCES public.finalizadoras(id);


--
-- Name: contas_receber_baixas contas_receber_baixas_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_receber_baixas
    ADD CONSTRAINT contas_receber_baixas_pagamento_id_fkey FOREIGN KEY (pagamento_id) REFERENCES public.pagamentos(id);


--
-- Name: contas_receber contas_receber_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_receber
    ADD CONSTRAINT contas_receber_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: estoque_reservado estoque_reservado_comanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_reservado
    ADD CONSTRAINT estoque_reservado_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;


--
-- Name: estoque_reservado estoque_reservado_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_reservado
    ADD CONSTRAINT estoque_reservado_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE CASCADE;


--
-- Name: agendamento_participantes fk_agp_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento_participantes
    ADD CONSTRAINT fk_agp_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: comanda_clientes fk_comanda_clientes_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_clientes
    ADD CONSTRAINT fk_comanda_clientes_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: comanda_itens fk_comanda_itens_comanda; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_itens
    ADD CONSTRAINT fk_comanda_itens_comanda FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;


--
-- Name: comanda_itens fk_comanda_itens_produto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_itens
    ADD CONSTRAINT fk_comanda_itens_produto FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;


--
-- Name: comandas fk_comandas_mesa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT fk_comandas_mesa FOREIGN KEY (mesa_id) REFERENCES public.mesas(id) ON DELETE SET NULL;


--
-- Name: movimentos_saldo fk_mov_saldo_agendamento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimentos_saldo
    ADD CONSTRAINT fk_mov_saldo_agendamento FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE CASCADE;


--
-- Name: movimentos_saldo fk_mov_saldo_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimentos_saldo
    ADD CONSTRAINT fk_mov_saldo_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: pagamentos fk_pagamentos_caixa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT fk_pagamentos_caixa FOREIGN KEY (caixa_id) REFERENCES public.caixa_sessoes(id) ON DELETE SET NULL;


--
-- Name: pagamentos fk_pagamentos_finalizadora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT fk_pagamentos_finalizadora FOREIGN KEY (finalizadora_id) REFERENCES public.finalizadoras(id) ON DELETE SET NULL;


--
-- Name: pagamentos pagamentos_caixa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES public.caixa_sessoes(id) ON DELETE SET NULL;


--
-- Name: pagamentos pagamentos_comanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;


--
-- Name: pagamentos pagamentos_finalizadora_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_finalizadora_id_fkey FOREIGN KEY (finalizadora_id) REFERENCES public.finalizadoras(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: produtos produtos_company_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_company_code_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: produtos produtos_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: quadras quadras_codigo_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quadras
    ADD CONSTRAINT quadras_codigo_empresa_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quadras_dias_funcionamento quadras_dias_funcionamento_quadra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quadras_dias_funcionamento
    ADD CONSTRAINT quadras_dias_funcionamento_quadra_id_fkey FOREIGN KEY (quadra_id) REFERENCES public.quadras(id) ON DELETE CASCADE;


--
-- Name: itens_venda sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_venda
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: itens_venda sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_venda
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id);


--
-- Name: vendas sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: user_ui_settings user_ui_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ui_settings
    ADD CONSTRAINT user_ui_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: usuarios users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: usuarios usuarios_codigo_empresa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_codigo_empresa_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendas vendas_company_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_company_code_fkey FOREIGN KEY (codigo_empresa) REFERENCES public.empresas(codigo_empresa) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: empresa_counters Acesso publico empresa_counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Acesso publico empresa_counters" ON public.empresa_counters TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: quadras Allow anonymous read access to quadras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous read access to quadras" ON public.quadras FOR SELECT TO anon USING (true);


--
-- Name: empresas Allow insert new companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert new companies" ON public.empresas FOR INSERT WITH CHECK (true);


--
-- Name: agenda_settings Allow public insert agenda_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert agenda_settings" ON public.agenda_settings FOR INSERT WITH CHECK (true);


--
-- Name: agendamento_participantes Allow public insert agendamento_participantes by codigo_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert agendamento_participantes by codigo_empresa" ON public.agendamento_participantes FOR INSERT TO anon WITH CHECK ((codigo_empresa IS NOT NULL));


--
-- Name: agendamentos Allow public insert agendamentos by codigo_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert agendamentos by codigo_empresa" ON public.agendamentos FOR INSERT TO anon WITH CHECK ((codigo_empresa IS NOT NULL));


--
-- Name: colaboradores Allow public insert colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert colaboradores" ON public.colaboradores FOR INSERT WITH CHECK (true);


--
-- Name: produto_categorias Allow public insert produto_categorias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert produto_categorias" ON public.produto_categorias FOR INSERT WITH CHECK (true);


--
-- Name: quadras Allow public insert quadras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert quadras" ON public.quadras FOR INSERT WITH CHECK (true);


--
-- Name: usuarios Allow public insert usuarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert usuarios" ON public.usuarios FOR INSERT WITH CHECK (true);


--
-- Name: agendamentos Allow public read agendamentos by codigo_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read agendamentos by codigo_empresa" ON public.agendamentos FOR SELECT TO anon USING ((codigo_empresa IS NOT NULL));


--
-- Name: clientes Allow public read by codigo_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read by codigo_empresa" ON public.clientes FOR SELECT TO anon USING ((codigo_empresa IS NOT NULL));


--
-- Name: empresas Anyone can read companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read companies" ON public.empresas FOR SELECT USING (true);


--
-- Name: clientes Isis pode buscar clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Isis pode buscar clientes" ON public.clientes FOR SELECT TO authenticated, anon USING (true);


--
-- Name: clientes Isis pode criar clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Isis pode criar clientes" ON public.clientes FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: quadras_dias_funcionamento Isis pode ler dias funcionamento; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Isis pode ler dias funcionamento" ON public.quadras_dias_funcionamento FOR SELECT TO authenticated, anon USING ((codigo_empresa IS NOT NULL));


--
-- Name: quadras Isis pode ler quadras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Isis pode ler quadras" ON public.quadras FOR SELECT TO authenticated, anon USING ((codigo_empresa IS NOT NULL));


--
-- Name: agenda_settings Users can create their company agenda settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their company agenda settings" ON public.agenda_settings FOR INSERT TO authenticated WITH CHECK ((empresa_id IN ( SELECT empresas.id
   FROM public.empresas
  WHERE ((empresas.codigo_empresa)::text = ( SELECT colaboradores.codigo_empresa
           FROM public.colaboradores
          WHERE (colaboradores.id = auth.uid()))))));


--
-- Name: agenda_settings Users can delete their company agenda settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their company agenda settings" ON public.agenda_settings FOR DELETE TO authenticated USING ((empresa_id IN ( SELECT empresas.id
   FROM public.empresas
  WHERE ((empresas.codigo_empresa)::text = ( SELECT colaboradores.codigo_empresa
           FROM public.colaboradores
          WHERE (colaboradores.id = auth.uid()))))));


--
-- Name: user_ui_settings Users can manage own ui settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own ui settings" ON public.user_ui_settings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: agenda_settings Users can update their company agenda settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their company agenda settings" ON public.agenda_settings FOR UPDATE TO authenticated USING ((empresa_id IN ( SELECT empresas.id
   FROM public.empresas
  WHERE ((empresas.codigo_empresa)::text = ( SELECT colaboradores.codigo_empresa
           FROM public.colaboradores
          WHERE (colaboradores.id = auth.uid())))))) WITH CHECK ((empresa_id IN ( SELECT empresas.id
   FROM public.empresas
  WHERE ((empresas.codigo_empresa)::text = ( SELECT colaboradores.codigo_empresa
           FROM public.colaboradores
          WHERE (colaboradores.id = auth.uid()))))));


--
-- Name: agenda_settings Users can view their company agenda settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company agenda settings" ON public.agenda_settings FOR SELECT TO authenticated USING ((empresa_id IN ( SELECT empresas.id
   FROM public.empresas
  WHERE ((empresas.codigo_empresa)::text = ( SELECT colaboradores.codigo_empresa
           FROM public.colaboradores
          WHERE (colaboradores.id = auth.uid()))))));


--
-- Name: empresa_counters Usuarios podem atualizar counters da propria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios podem atualizar counters da propria empresa" ON public.empresa_counters FOR UPDATE USING ((empresa_id IN ( SELECT e.id
   FROM (public.empresas e
     JOIN public.usuarios u ON (((u.codigo_empresa)::text = (e.codigo_empresa)::text)))
  WHERE (u.id = auth.uid())))) WITH CHECK ((empresa_id IN ( SELECT e.id
   FROM (public.empresas e
     JOIN public.usuarios u ON (((u.codigo_empresa)::text = (e.codigo_empresa)::text)))
  WHERE (u.id = auth.uid()))));


--
-- Name: empresa_counters Usuarios podem criar counters da propria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios podem criar counters da propria empresa" ON public.empresa_counters FOR INSERT WITH CHECK ((empresa_id IN ( SELECT e.id
   FROM (public.empresas e
     JOIN public.usuarios u ON (((u.codigo_empresa)::text = (e.codigo_empresa)::text)))
  WHERE (u.id = auth.uid()))));


--
-- Name: quadras_dias_funcionamento Usuarios podem gerenciar dias de funcionamento da propria empre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios podem gerenciar dias de funcionamento da propria empre" ON public.quadras_dias_funcionamento USING ((codigo_empresa IN ( SELECT u.codigo_empresa
   FROM public.usuarios u
  WHERE (u.id = auth.uid())))) WITH CHECK ((codigo_empresa IN ( SELECT u.codigo_empresa
   FROM public.usuarios u
  WHERE (u.id = auth.uid()))));


--
-- Name: empresa_counters Usuarios podem ler counters da propria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios podem ler counters da propria empresa" ON public.empresa_counters FOR SELECT USING ((empresa_id IN ( SELECT e.id
   FROM (public.empresas e
     JOIN public.usuarios u ON (((u.codigo_empresa)::text = (e.codigo_empresa)::text)))
  WHERE (u.id = auth.uid()))));


--
-- Name: compras Usuários podem atualizar compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar compras da própria empresa" ON public.compras FOR UPDATE USING ((codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer));


--
-- Name: compras_itens Usuários podem atualizar itens de compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar itens de compras da própria empresa" ON public.compras_itens FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.compras
  WHERE ((compras.id = compras_itens.compra_id) AND (compras.codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer)))));


--
-- Name: caixa_movimentacoes Usuários podem atualizar movimentações de caixa da sua empre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar movimentações de caixa da sua empre" ON public.caixa_movimentacoes FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos Usuários podem atualizar resumos de caixa da sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar resumos de caixa da sua empresa" ON public.caixa_resumos FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes Usuários podem criar movimentações de caixa na sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar movimentações de caixa na sua empresa" ON public.caixa_movimentacoes FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos Usuários podem criar resumos de caixa na sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar resumos de caixa na sua empresa" ON public.caixa_resumos FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: compras Usuários podem deletar compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar compras da própria empresa" ON public.compras FOR DELETE USING ((codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer));


--
-- Name: compras_itens Usuários podem deletar itens de compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar itens de compras da própria empresa" ON public.compras_itens FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.compras
  WHERE ((compras.id = compras_itens.compra_id) AND (compras.codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer)))));


--
-- Name: caixa_movimentacoes Usuários podem deletar movimentações de caixa da sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar movimentações de caixa da sua empresa" ON public.caixa_movimentacoes FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos Usuários podem deletar resumos de caixa da sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar resumos de caixa da sua empresa" ON public.caixa_resumos FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: compras Usuários podem inserir compras na própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir compras na própria empresa" ON public.compras FOR INSERT WITH CHECK ((codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer));


--
-- Name: compras_itens Usuários podem inserir itens de compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir itens de compras da própria empresa" ON public.compras_itens FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.compras
  WHERE ((compras.id = compras_itens.compra_id) AND (compras.codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer)))));


--
-- Name: compras Usuários podem ver compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver compras da própria empresa" ON public.compras FOR SELECT USING ((codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer));


--
-- Name: compras_itens Usuários podem ver itens de compras da própria empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver itens de compras da própria empresa" ON public.compras_itens FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.compras
  WHERE ((compras.id = compras_itens.compra_id) AND (compras.codigo_empresa = (( SELECT public.get_my_company_code() AS get_my_company_code))::integer)))));


--
-- Name: caixa_movimentacoes Usuários podem ver movimentações de caixa da sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver movimentações de caixa da sua empresa" ON public.caixa_movimentacoes FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos Usuários podem ver resumos de caixa da sua empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver resumos de caixa da sua empresa" ON public.caixa_resumos FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: agendamentos ag_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_delete_by_company ON public.agendamentos FOR DELETE TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: agendamentos ag_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_insert_by_company ON public.agendamentos FOR INSERT TO authenticated WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: agendamento_participantes ag_participantes_delete_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_participantes_delete_company ON public.agendamento_participantes FOR DELETE TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: agendamento_participantes ag_participantes_insert_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_participantes_insert_company ON public.agendamento_participantes FOR INSERT TO authenticated WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: agendamento_participantes ag_participantes_select_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_participantes_select_company ON public.agendamento_participantes FOR SELECT TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: agendamento_participantes ag_participantes_update_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_participantes_update_company ON public.agendamento_participantes FOR UPDATE TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code())) WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: agendamentos ag_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_select_by_company ON public.agendamentos FOR SELECT TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: agendamentos ag_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_update_by_company ON public.agendamentos FOR UPDATE TO authenticated USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: agenda_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agenda_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: agenda_settings agenda_settings_delete_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agenda_settings_delete_company ON public.agenda_settings FOR DELETE TO authenticated USING ((empresa_id = public.get_my_company_id()));


--
-- Name: agenda_settings agenda_settings_insert_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agenda_settings_insert_company ON public.agenda_settings FOR INSERT TO authenticated WITH CHECK ((empresa_id = public.get_my_company_id()));


--
-- Name: agenda_settings agenda_settings_select_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agenda_settings_select_company ON public.agenda_settings FOR SELECT TO authenticated USING ((empresa_id = public.get_my_company_id()));


--
-- Name: agenda_settings agenda_settings_update_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agenda_settings_update_company ON public.agenda_settings FOR UPDATE TO authenticated USING ((empresa_id = public.get_my_company_id())) WITH CHECK ((empresa_id = public.get_my_company_id()));


--
-- Name: agendamento_participantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agendamento_participantes ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamento_participantes agendamento_participantes_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamento_participantes_delete_policy ON public.agendamento_participantes FOR DELETE USING ((((codigo_empresa)::text = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: agendamento_participantes agendamento_participantes_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamento_participantes_insert_policy ON public.agendamento_participantes FOR INSERT WITH CHECK ((((codigo_empresa)::text = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: agendamento_participantes agendamento_participantes_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamento_participantes_select_policy ON public.agendamento_participantes FOR SELECT USING ((((codigo_empresa)::text = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL) OR (current_setting('app.current_empresa'::text, true) = ''::text)));


--
-- Name: agendamento_participantes agendamento_participantes_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamento_participantes_update_policy ON public.agendamento_participantes FOR UPDATE USING ((((codigo_empresa)::text = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL))) WITH CHECK ((((codigo_empresa)::text = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: agendamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamentos agendamentos_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamentos_delete_policy ON public.agendamentos FOR DELETE USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: agendamentos agendamentos_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamentos_insert_policy ON public.agendamentos FOR INSERT WITH CHECK (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: agendamentos agendamentos_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamentos_select_policy ON public.agendamentos FOR SELECT USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL) OR (current_setting('app.current_empresa'::text, true) = ''::text)));


--
-- Name: agendamentos agendamentos_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agendamentos_update_policy ON public.agendamentos FOR UPDATE USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL))) WITH CHECK (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: caixa_movimentacoes caixa_mov_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_mov_delete ON public.caixa_movimentacoes FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes caixa_mov_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_mov_insert ON public.caixa_movimentacoes FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes caixa_mov_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_mov_select ON public.caixa_movimentacoes FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes caixa_mov_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_mov_update ON public.caixa_movimentacoes FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_movimentacoes caixa_movimentacoes_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_movimentacoes_delete_by_company ON public.caixa_movimentacoes FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes caixa_movimentacoes_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_movimentacoes_insert_by_company ON public.caixa_movimentacoes FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes caixa_movimentacoes_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_movimentacoes_select_by_company ON public.caixa_movimentacoes FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentacoes caixa_movimentacoes_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_movimentacoes_update_by_company ON public.caixa_movimentacoes FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_movimentos caixa_movimentos_rls_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_movimentos_rls_all ON public.caixa_movimentos USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caixa_resumos ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_resumos caixa_resumos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_resumos_delete ON public.caixa_resumos FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos caixa_resumos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_resumos_insert ON public.caixa_resumos FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos caixa_resumos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_resumos_select ON public.caixa_resumos FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_resumos caixa_resumos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_resumos_update ON public.caixa_resumos FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_sessoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_sessoes caixa_sessoes_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_sessoes_delete_by_company ON public.caixa_sessoes FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_sessoes caixa_sessoes_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_sessoes_insert_by_company ON public.caixa_sessoes FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_sessoes caixa_sessoes_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_sessoes_select_by_company ON public.caixa_sessoes FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: caixa_sessoes caixa_sessoes_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caixa_sessoes_update_by_company ON public.caixa_sessoes FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes clientes_delete_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_delete_company ON public.clientes FOR DELETE TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: clientes clientes_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_delete_policy ON public.clientes FOR DELETE USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: clientes clientes_insert_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_insert_company ON public.clientes FOR INSERT TO authenticated WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: clientes clientes_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_insert_policy ON public.clientes FOR INSERT WITH CHECK (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: clientes clientes_select_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_select_company ON public.clientes FOR SELECT TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: clientes clientes_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_select_policy ON public.clientes FOR SELECT USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL) OR (current_setting('app.current_empresa'::text, true) = ''::text)));


--
-- Name: clientes clientes_update_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_update_company ON public.clientes FOR UPDATE TO authenticated USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: clientes clientes_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_update_policy ON public.clientes FOR UPDATE USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL))) WITH CHECK (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: colaboradores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

--
-- Name: colaboradores colaboradores_delete_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_delete_company ON public.colaboradores FOR DELETE TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: colaboradores colaboradores_insert_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_insert_company ON public.colaboradores FOR INSERT TO authenticated WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: colaboradores colaboradores_select_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_select_company ON public.colaboradores FOR SELECT TO authenticated USING (((codigo_empresa = public.get_my_company_code()) OR (id = auth.uid())));


--
-- Name: colaboradores colaboradores_update_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_update_company ON public.colaboradores FOR UPDATE TO authenticated USING (((codigo_empresa = public.get_my_company_code()) OR (id = auth.uid()))) WITH CHECK (((codigo_empresa = public.get_my_company_code()) OR (id = auth.uid())));


--
-- Name: comanda_clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comanda_clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: comanda_clientes comanda_clientes_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_clientes_delete_by_company ON public.comanda_clientes FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_clientes comanda_clientes_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_clientes_insert_by_company ON public.comanda_clientes FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_clientes comanda_clientes_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_clientes_select_by_company ON public.comanda_clientes FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_clientes comanda_clientes_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_clientes_update_by_company ON public.comanda_clientes FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: comanda_itens comanda_itens_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_itens_delete_by_company ON public.comanda_itens FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_itens comanda_itens_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_itens_insert_by_company ON public.comanda_itens FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_itens comanda_itens_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_itens_select_by_company ON public.comanda_itens FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comanda_itens comanda_itens_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comanda_itens_update_by_company ON public.comanda_itens FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comandas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

--
-- Name: comandas comandas_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comandas_delete_by_company ON public.comandas FOR DELETE TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comandas comandas_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comandas_insert_by_company ON public.comandas FOR INSERT TO authenticated WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comandas comandas_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comandas_select_by_company ON public.comandas FOR SELECT TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: comandas comandas_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comandas_update_by_company ON public.comandas FOR UPDATE TO authenticated USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: compras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

--
-- Name: compras_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compras_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: contas_pagar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

--
-- Name: contas_pagar_baixas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contas_pagar_baixas ENABLE ROW LEVEL SECURITY;

--
-- Name: contas_pagar_baixas contas_pagar_baixas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_baixas_delete ON public.contas_pagar_baixas FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar_baixas contas_pagar_baixas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_baixas_insert ON public.contas_pagar_baixas FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar_baixas contas_pagar_baixas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_baixas_select ON public.contas_pagar_baixas FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar_baixas contas_pagar_baixas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_baixas_update ON public.contas_pagar_baixas FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar contas_pagar_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_delete ON public.contas_pagar FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar contas_pagar_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_insert ON public.contas_pagar FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar contas_pagar_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_select ON public.contas_pagar FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_pagar contas_pagar_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_pagar_update ON public.contas_pagar FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;

--
-- Name: contas_receber_baixas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contas_receber_baixas ENABLE ROW LEVEL SECURITY;

--
-- Name: contas_receber_baixas contas_receber_baixas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_baixas_delete ON public.contas_receber_baixas FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber_baixas contas_receber_baixas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_baixas_insert ON public.contas_receber_baixas FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber_baixas contas_receber_baixas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_baixas_select ON public.contas_receber_baixas FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber_baixas contas_receber_baixas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_baixas_update ON public.contas_receber_baixas FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber contas_receber_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_delete ON public.contas_receber FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber contas_receber_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_insert ON public.contas_receber FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber contas_receber_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_select ON public.contas_receber FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: contas_receber contas_receber_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_receber_update ON public.contas_receber FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: empresa_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresa_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas empresas_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_by_company ON public.empresas FOR SELECT TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: empresas empresas_select_user_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_select_user_company ON public.empresas FOR SELECT TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: empresas empresas_update_user_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_update_user_company ON public.empresas FOR UPDATE TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code())) WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: finalizadoras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finalizadoras ENABLE ROW LEVEL SECURITY;

--
-- Name: finalizadoras finalizadoras_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finalizadoras_delete_by_company ON public.finalizadoras FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: finalizadoras finalizadoras_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finalizadoras_insert_by_company ON public.finalizadoras FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: finalizadoras finalizadoras_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finalizadoras_select_by_company ON public.finalizadoras FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: finalizadoras finalizadoras_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finalizadoras_update_by_company ON public.finalizadoras FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: itens_venda; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;

--
-- Name: itens_venda itens_venda_delete_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_venda_delete_empresa ON public.itens_venda FOR DELETE USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: itens_venda itens_venda_insert_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_venda_insert_empresa ON public.itens_venda FOR INSERT WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: itens_venda itens_venda_select_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_venda_select_empresa ON public.itens_venda FOR SELECT USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: itens_venda itens_venda_update_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_venda_update_empresa ON public.itens_venda FOR UPDATE USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: mesas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

--
-- Name: mesas mesas_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesas_delete_by_company ON public.mesas FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: mesas mesas_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesas_insert_by_company ON public.mesas FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: mesas mesas_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesas_select_by_company ON public.mesas FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: mesas mesas_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesas_update_by_company ON public.mesas FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: pagamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: pagamentos pagamentos_delete_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_delete_by_company ON public.pagamentos FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: pagamentos pagamentos_insert_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_insert_by_company ON public.pagamentos FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: pagamentos pagamentos_select_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_select_by_company ON public.pagamentos FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: pagamentos pagamentos_update_by_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_update_by_company ON public.pagamentos FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: produto_categorias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produto_categorias ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_categorias produto_categorias_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produto_categorias_delete ON public.produto_categorias FOR DELETE USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: produto_categorias produto_categorias_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produto_categorias_insert ON public.produto_categorias FOR INSERT WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: produto_categorias produto_categorias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produto_categorias_select ON public.produto_categorias FOR SELECT USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: produto_categorias produto_categorias_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produto_categorias_update ON public.produto_categorias FOR UPDATE USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos produtos_delete_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_delete_company ON public.produtos FOR DELETE TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: produtos produtos_insert_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_insert_company ON public.produtos FOR INSERT TO authenticated WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: produtos produtos_select_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_select_company ON public.produtos FOR SELECT TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: produtos produtos_update_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_update_company ON public.produtos FOR UPDATE TO authenticated USING (((codigo_empresa)::text = public.get_my_company_code())) WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: quadras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;

--
-- Name: quadras quadras_delete_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_delete_company ON public.quadras FOR DELETE TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: quadras quadras_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_delete_policy ON public.quadras FOR DELETE USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: quadras_dias_funcionamento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quadras_dias_funcionamento ENABLE ROW LEVEL SECURITY;

--
-- Name: quadras quadras_insert_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_insert_company ON public.quadras FOR INSERT TO authenticated WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: quadras quadras_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_insert_policy ON public.quadras FOR INSERT WITH CHECK (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: quadras quadras_select_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_select_company ON public.quadras FOR SELECT TO authenticated USING ((codigo_empresa = public.get_my_company_code()));


--
-- Name: quadras quadras_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_select_policy ON public.quadras FOR SELECT USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL) OR (current_setting('app.current_empresa'::text, true) = ''::text)));


--
-- Name: quadras quadras_update_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_update_company ON public.quadras FOR UPDATE TO authenticated USING ((codigo_empresa = public.get_my_company_code())) WITH CHECK ((codigo_empresa = public.get_my_company_code()));


--
-- Name: quadras quadras_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quadras_update_policy ON public.quadras FOR UPDATE USING (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL))) WITH CHECK (((codigo_empresa = current_setting('app.current_empresa'::text, true)) OR (current_setting('app.current_empresa'::text, true) IS NULL)));


--
-- Name: user_ui_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_ui_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios usuarios_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_select_self ON public.usuarios FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: vendas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

--
-- Name: vendas vendas_delete_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendas_delete_empresa ON public.vendas FOR DELETE USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: vendas vendas_insert_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendas_insert_empresa ON public.vendas FOR INSERT WITH CHECK (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: vendas vendas_select_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendas_select_empresa ON public.vendas FOR SELECT USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- Name: vendas vendas_update_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendas_update_empresa ON public.vendas FOR UPDATE USING (((codigo_empresa)::text = public.get_my_company_code()));


--
-- PostgreSQL database dump complete
--

\unrestrict xphx7gwY9Bsk7YcBsp8udCbC8fGxGTSbNZSxcs7C2Le90K7rLXYVkMgfboEDGmp

