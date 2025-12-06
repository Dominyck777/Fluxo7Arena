-- Migração SEGURA: Apenas ADD, sem ALTER destrutivo
-- Data: 2025-11-26
-- Descrição: Adiciona suporte a descontos por item e por comanda

-- ============================================
-- 1. Adicionar campos de desconto em comanda_itens
-- ============================================
ALTER TABLE comanda_itens
ADD COLUMN IF NOT EXISTS desconto_tipo VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS desconto_motivo VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preco_com_desconto NUMERIC(10,2) DEFAULT NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comanda_itens_desconto_tipo 
ON comanda_itens(desconto_tipo) 
WHERE desconto_tipo IS NOT NULL;

-- ============================================
-- 2. Adicionar campos de desconto em comandas
-- ============================================
ALTER TABLE comandas
ADD COLUMN IF NOT EXISTS desconto_tipo VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS desconto_motivo VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_com_desconto NUMERIC(10,2) DEFAULT NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comandas_desconto_tipo 
ON comandas(desconto_tipo) 
WHERE desconto_tipo IS NOT NULL;

-- ============================================
-- 3. Adicionar campos de observações na comanda
-- ============================================
ALTER TABLE comandas
ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS observacoes_atualizadas_em TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ============================================
-- 4. Adicionar campos de auditoria (histórico de alterações)
-- ============================================
CREATE TABLE IF NOT EXISTS comanda_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_empresa INTEGER NOT NULL,
  comanda_id UUID NOT NULL,
  tipo_alteracao VARCHAR(50) NOT NULL, -- 'item_adicionado', 'item_removido', 'desconto_aplicado', 'observacao_adicionada', etc.
  descricao TEXT,
  usuario_id UUID,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Relacionamentos
  FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_comanda_historico_comanda_id 
ON comanda_historico(comanda_id);

CREATE INDEX IF NOT EXISTS idx_comanda_historico_codigo_empresa 
ON comanda_historico(codigo_empresa);

CREATE INDEX IF NOT EXISTS idx_comanda_historico_tipo 
ON comanda_historico(tipo_alteracao);

-- ============================================
-- 5. Tabela para controle de estoque reservado (lock pessimista)
-- ============================================
CREATE TABLE IF NOT EXISTS estoque_reservado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_empresa INTEGER NOT NULL,
  produto_id UUID NOT NULL,
  comanda_id UUID NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL,
  reservado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  liberado_em TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Relacionamentos
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_estoque_reservado_produto_id 
ON estoque_reservado(produto_id);

CREATE INDEX IF NOT EXISTS idx_estoque_reservado_comanda_id 
ON estoque_reservado(comanda_id);

CREATE INDEX IF NOT EXISTS idx_estoque_reservado_ativo 
ON estoque_reservado(liberado_em) 
WHERE liberado_em IS NULL;

-- ============================================
-- 6. Adicionar campos de vendedor e comissão
-- ============================================
ALTER TABLE comandas
ADD COLUMN IF NOT EXISTS vendedor_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comissao_valor NUMERIC(10,2) DEFAULT NULL;

-- Índice para vendedor
CREATE INDEX IF NOT EXISTS idx_comandas_vendedor_id 
ON comandas(vendedor_id);

-- ============================================
-- 7. Adicionar campo para vincular com agendamento
-- ============================================
ALTER TABLE comandas
ADD COLUMN IF NOT EXISTS agendamento_id UUID DEFAULT NULL;

-- Índice para agendamento
CREATE INDEX IF NOT EXISTS idx_comandas_agendamento_id 
ON comandas(agendamento_id);

-- ============================================
-- 8. Adicionar campos de sincronização realtime
-- ============================================
ALTER TABLE comandas
ADD COLUMN IF NOT EXISTS versao_sincronizacao INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Índice para sincronização
CREATE INDEX IF NOT EXISTS idx_comandas_ultima_atualizacao 
ON comandas(ultima_atualizacao);

-- ============================================
-- 9. Trigger para atualizar ultima_atualizacao automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_ultima_atualizacao_comanda()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_atualizacao = NOW();
  NEW.versao_sincronizacao = COALESCE(NEW.versao_sincronizacao, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_ultima_atualizacao_comanda ON comandas;
CREATE TRIGGER trigger_atualizar_ultima_atualizacao_comanda
BEFORE UPDATE ON comandas
FOR EACH ROW
EXECUTE FUNCTION atualizar_ultima_atualizacao_comanda();

-- ============================================
-- 10. Trigger para atualizar ultima_atualizacao em itens
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_ultima_atualizacao_item()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE comandas 
  SET ultima_atualizacao = NOW(), versao_sincronizacao = versao_sincronizacao + 1
  WHERE id = NEW.comanda_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_ultima_atualizacao_item ON comanda_itens;
CREATE TRIGGER trigger_atualizar_ultima_atualizacao_item
AFTER INSERT OR UPDATE OR DELETE ON comanda_itens
FOR EACH ROW
EXECUTE FUNCTION atualizar_ultima_atualizacao_item();

-- ============================================
-- 11. Trigger para registrar histórico de alterações
-- ============================================
CREATE OR REPLACE FUNCTION registrar_historico_comanda()
RETURNS TRIGGER AS $$
BEGIN
  -- Registra mudanças em desconto
  IF OLD.desconto_valor IS DISTINCT FROM NEW.desconto_valor THEN
    INSERT INTO comanda_historico (codigo_empresa, comanda_id, tipo_alteracao, descricao)
    VALUES (
      NEW.codigo_empresa,
      NEW.id,
      'desconto_aplicado',
      'Desconto alterado de ' || COALESCE(OLD.desconto_valor::text, '0') || ' para ' || NEW.desconto_valor::text
    );
  END IF;
  
  -- Registra mudanças em observações
  IF OLD.observacoes IS DISTINCT FROM NEW.observacoes THEN
    INSERT INTO comanda_historico (codigo_empresa, comanda_id, tipo_alteracao, descricao)
    VALUES (
      NEW.codigo_empresa,
      NEW.id,
      'observacao_adicionada',
      'Observação: ' || COALESCE(NEW.observacoes, '')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_registrar_historico_comanda ON comandas;
CREATE TRIGGER trigger_registrar_historico_comanda
AFTER UPDATE ON comandas
FOR EACH ROW
EXECUTE FUNCTION registrar_historico_comanda();

-- ============================================
-- 12. Função para calcular total com descontos (SQL)
-- ============================================
CREATE OR REPLACE FUNCTION calcular_total_comanda_com_desconto(p_comanda_id UUID)
RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 13. Comentários para documentação
-- ============================================
COMMENT ON TABLE comanda_historico IS 'Auditoria de alterações em comandas para rastreabilidade';
COMMENT ON TABLE estoque_reservado IS 'Controle de estoque reservado para evitar overselling';
COMMENT ON COLUMN comandas.desconto_tipo IS 'Tipo de desconto: percentual ou fixo';
COMMENT ON COLUMN comandas.desconto_valor IS 'Valor do desconto (% ou R$)';
COMMENT ON COLUMN comandas.observacoes IS 'Notas/observações da comanda (ex: sem cebola, urgente)';
COMMENT ON COLUMN comandas.vendedor_id IS 'Usuário que realizou a venda (para comissão)';
COMMENT ON COLUMN comandas.agendamento_id IS 'Agendamento vinculado (se venda relacionada a agendamento)';
COMMENT ON COLUMN comandas.versao_sincronizacao IS 'Versão para sincronização realtime';

-- ============================================
-- 14. Verificação final
-- ============================================
-- Confirmar que tudo foi criado
SELECT 
  'Migração concluída com sucesso!' as status,
  COUNT(*) as tabelas_criadas
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('comanda_historico', 'estoque_reservado');
