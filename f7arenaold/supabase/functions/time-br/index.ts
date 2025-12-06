// @ts-nocheck
// deno-lint-ignore-file
// Supabase Edge Function: time-br
// Returns server time in milliseconds and ISO, to be used for client time offset.
// This uses the server clock (reliable) and also provides a Sao_Paulo formatted string
// purely for debugging/observability.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const now = new Date();
    const nowMs = now.getTime();
    // Format in America/Sao_Paulo for observability
    let nowSaoPaulo = null as string | null;
    try {
      const fmt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      nowSaoPaulo = fmt.format(now);
    } catch {
      nowSaoPaulo = null;
    }
    const body = { nowMs, nowISO: now.toISOString(), nowSaoPaulo };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 });
  }
});
