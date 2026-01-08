-- Add fiscal fields to comandas (safe to run multiple times)
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS nf_modelo smallint,
  ADD COLUMN IF NOT EXISTS nf_serie smallint,
  ADD COLUMN IF NOT EXISTS nf_numero integer,
  ADD COLUMN IF NOT EXISTS nf_status varchar(20),
  ADD COLUMN IF NOT EXISTS nf_protocolo text,
  ADD COLUMN IF NOT EXISTS nf_xml text,
  ADD COLUMN IF NOT EXISTS nf_xml_url text,
  ADD COLUMN IF NOT EXISTS nf_pdf_url text,
  ADD COLUMN IF NOT EXISTS nf_autorizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS nf_cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS nf_motivo_cancelamento text;

-- Helpful indexes for fiscal workflow
CREATE INDEX IF NOT EXISTS idx_comandas_aberto_em ON public.comandas (aberto_em DESC);
CREATE INDEX IF NOT EXISTS idx_comandas_fechado_em ON public.comandas (fechado_em DESC) WHERE fechado_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comandas_codigo_empresa ON public.comandas (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_comandas_origem ON public.comandas (origem);
CREATE INDEX IF NOT EXISTS idx_comandas_nf_status ON public.comandas (nf_status);

-- Keep existing common indexes if missing
CREATE INDEX IF NOT EXISTS idx_comandas_mesa ON public.comandas (mesa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_empresa_status ON public.comandas (codigo_empresa, status);

-- Optionally, if xml_chave exists, index it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='comandas' AND column_name='xml_chave'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comandas_xml_chave ON public.comandas (xml_chave)';
  END IF;
END$$;
