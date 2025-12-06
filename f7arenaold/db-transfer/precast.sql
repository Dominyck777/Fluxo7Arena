DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_status' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_cast c
      JOIN pg_type s ON s.oid=c.castsource
      JOIN pg_type t ON t.oid=c.casttarget
      WHERE s.typname='text' AND t.typname='payment_status'
    ) THEN
      CREATE CAST (text AS public.payment_status) WITH INOUT AS IMPLICIT;
    END IF;
  END IF;
END$$;