-- Migration: Fix compras unique constraint to allow inactive duplicates
-- This allows the same chave_nfe to exist multiple times, but only one can be active

-- Remove the existing unique constraint
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_chave_nfe_key;

-- Drop the existing unique index
DROP INDEX IF EXISTS compras_chave_nfe_key;

-- Create a partial unique index that only applies to active records
-- This allows multiple inactive records with the same chave_nfe, but only one active
CREATE UNIQUE INDEX compras_chave_nfe_ativa_unique 
ON compras (chave_nfe) 
WHERE ativo = true;

-- Add a comment explaining the constraint
COMMENT ON INDEX compras_chave_nfe_ativa_unique IS 
'Ensures only one active NF-e per chave_nfe. Allows multiple inactive records with same key.';
