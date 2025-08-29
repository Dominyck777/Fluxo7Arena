// Ambient declaration to satisfy Node/TS language server for esm.sh Supabase import.
// This is for editor/type-checking only and does not affect runtime in Supabase Edge (Deno).
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: any;
}
