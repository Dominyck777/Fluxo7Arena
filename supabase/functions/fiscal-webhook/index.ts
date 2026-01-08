// Deno Edge Function - Fiscal Webhook (TransmiteNota callbacks)
// Env required in Supabase project:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// Optional security: A shared secret header X-Webhook-Secret

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  allowOrigin: ["http://localhost:5173"],
  allowMethods: "POST,OPTIONS",
  allowHeaders: "content-type, authorization, x-webhook-secret",
};

function corsHeaders(origin: string | null) {
  const allowed = cors.allowOrigin.includes(origin ?? "") ? origin! : cors.allowOrigin[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": cors.allowMethods,
    "Access-Control-Allow-Headers": cors.allowHeaders,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { "Content-Type": "application/json", ...(origin ? corsHeaders(origin) : {}) };

  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "Missing env SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), { status: 500, headers });
    }

    // Optional shared secret validation
    const expectedSecret = Deno.env.get("WEBHOOK_SHARED_SECRET");
    const gotSecret = req.headers.get("x-webhook-secret") || undefined;
    if (expectedSecret && gotSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({}));
    // Normalize possible payload fields from provider
    const cnpj = body.cnpj || body.CNPJ || body.emitterCnpj || null;
    const status = (body.status || body.Status || body.situacao || body.Situacao || "").toString().toLowerCase();
    const chave = body.chave || body.Chave || body.chaveAcesso || null;
    const numero = body.numero || body.Numero || null;
    const serie = body.serie || body.Serie || null;
    const pdf_url = body.pdf_url || body.PdfUrl || null;
    const xml_url = body.xml_url || body.XmlUrl || null;
    const protocolo = body.protocolo || body.Protocolo || null;
    const comanda_id = body.comanda_id || body.referenceId || null;
    // status mapping
    const mapStatus = (s: string): string => {
      if (!s) return "processando";
      if (["autorizada", "autorizado", "sucesso", "aprovada", "authorized"].includes(s)) return "autorizada";
      if (["rejeitada", "erro", "failed", "denied"].includes(s)) return "rejeitada";
      if (["cancelada", "canceled"].includes(s)) return "cancelada";
      if (["processando", "pendente", "processing", "enviado"].includes(s)) return "processando";
      return s;
    };
    const nf_status = mapStatus(status);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

    // Resolve codigo_empresa by CNPJ (empresas table) if possible
    let codigo_empresa: string | null = null;
    if (cnpj) {
      const { data: emp } = await admin.from("empresas").select("codigo_empresa, cnpj").ilike("cnpj", `%${String(cnpj).replace(/\D/g, '')}%`).maybeSingle();
      if (emp?.codigo_empresa) codigo_empresa = emp.codigo_empresa;
    }

    // Locate the comanda to update
    let comanda: any = null;
    if (comanda_id) {
      const { data } = await admin.from("comandas").select("id, codigo_empresa").eq("id", comanda_id).maybeSingle();
      comanda = data;
      if (data?.codigo_empresa) codigo_empresa = data.codigo_empresa;
    }
    if (!comanda && (codigo_empresa && (chave || (numero && serie)))) {
      const q = admin.from("comandas").select("id").eq("codigo_empresa", codigo_empresa);
      if (chave) q.eq("xml_chave", chave);
      else q.eq("nf_numero", numero).eq("nf_serie", serie);
      const { data } = await q.order("aberto_em", { ascending: false }).limit(1);
      comanda = (data && data[0]) || null;
    }

    if (!comanda) {
      // Log only
      await admin.from("auditoria_fiscal").insert({ codigo_empresa: codigo_empresa || 'unknown', acao: 'webhook', modelo: '65', comanda_id: comanda_id, status: 'error', mensagem: 'Comanda não localizada para reconcile', request: body });
      return new Response(JSON.stringify({ ok: true, note: "comanda not found" }), { status: 200, headers });
    }

    // Prepare patch
    const patch: Record<string, any> = { nf_status };
    if (pdf_url) patch.nf_pdf_url = pdf_url;
    if (xml_url) patch.nf_xml_url = xml_url;
    if (chave) patch.xml_chave = chave;
    if (numero) patch.nf_numero = numero;
    if (serie) patch.nf_serie = serie;
    if (protocolo) patch.xml_protocolo = protocolo;

    await admin.from("comandas").update(patch).eq("id", comanda.id);

    await admin.from("auditoria_fiscal").insert({ codigo_empresa: codigo_empresa || 'unknown', acao: 'webhook', modelo: '65', comanda_id: comanda.id, status: 'success', response: { status: nf_status, chave, numero, serie, pdf_url, xml_url, protocolo } });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
