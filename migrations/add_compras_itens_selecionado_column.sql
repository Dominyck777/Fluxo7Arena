-- Adicionar coluna para armazenar se o produto foi selecionado na importação original
-- Isso permite que o reprocessamento mantenha o estado exato da importação

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'compras_itens' 
        AND column_name = 'selecionado_na_importacao'
    ) THEN
        ALTER TABLE public.compras_itens 
        ADD COLUMN selecionado_na_importacao boolean DEFAULT true NOT NULL;
        
        -- Comentário explicativo
        COMMENT ON COLUMN public.compras_itens.selecionado_na_importacao IS 'Indica se este produto foi selecionado pelo usuário durante a importação original do XML. Usado para manter consistência no reprocessamento.';
        
        RAISE NOTICE 'Coluna selecionado_na_importacao adicionada com sucesso.';
    ELSE
        RAISE NOTICE 'Coluna selecionado_na_importacao já existe.';
    END IF;
END $$;

-- Criar índice se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'compras_itens' 
        AND indexname = 'idx_compras_itens_selecionado'
    ) THEN
        CREATE INDEX idx_compras_itens_selecionado ON public.compras_itens (selecionado_na_importacao);
        RAISE NOTICE 'Índice idx_compras_itens_selecionado criado com sucesso.';
    ELSE
        RAISE NOTICE 'Índice idx_compras_itens_selecionado já existe.';
    END IF;
END $$;
