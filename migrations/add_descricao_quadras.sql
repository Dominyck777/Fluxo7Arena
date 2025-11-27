-- Adiciona campo de descrição na tabela quadras
-- Executar no Supabase SQL Editor

ALTER TABLE public.quadras 
ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT NULL;

-- Adiciona comentário explicativo na coluna
COMMENT ON COLUMN public.quadras.descricao IS 'Descrição detalhada da quadra (dimensões, características, comodidades)';

-- Exemplo de update (opcional - remover se não quiser dados de exemplo)
-- UPDATE public.quadras 
-- SET descricao = 'Quadra oficial com grama sintética, iluminação LED e vestiários'
-- WHERE nome = 'Quadra 1';
