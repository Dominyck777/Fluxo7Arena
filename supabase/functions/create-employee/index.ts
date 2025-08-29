/// <reference path="./deno-globals.d.ts" />
/// <reference path="./deno-std-http.d.ts" />
/// <reference path="./deno-supabase-js.d.ts" />

// Deno Edge Function - Create Employee (Auth user + colaboradores)
// Requisitos de ambiente no projeto Supabase (Edge Functions):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  allowOrigin: ["http://localhost:5173", "http://192.168.100.25:5173"], // ajuste se tiver outro domínio
  allowMethods: "POST,OPTIONS",
  allowHeaders: "content-type, authorization",
};

function corsHeaders(origin: string | null) {
  const allowed = cors.allowOrigin.includes(origin ?? "")
    ? origin!
    : cors.allowOrigin[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": cors.allowMethods,
    "Access-Control-Allow-Headers": cors.allowHeaders,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    ...(origin ? corsHeaders(origin) : {}),
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({ error: "Missing env SUPABASE_URL or SERVICE_ROLE" }),
        { status: 500, headers },
      );
    }

    const { codigo_empresa, nome, cargo, email, password, status } = await req.json();

    // validação mínima
    if (!codigo_empresa || !nome || !cargo || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }),
        { status: 400, headers },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Cria usuário no Auth
    const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, cargo },
    });

    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: userErr?.message ?? "Falha ao criar usuário" }),
        { status: 400, headers },
      );
    }

    const auth_user_id = userRes.user.id;

    // 2) Insere colaborador na tabela pública (schema migrado para codigo_empresa)
    const { data: insertRes, error: insertErr } = await admin
      .from("colaboradores")
      .insert({
        id: auth_user_id,
        codigo_empresa,
        nome,
        cargo,
        ativo: status ? String(status).toLowerCase() !== "inactive" : true,
      })
      .select()
      .single();

    if (insertErr) {
      // rollback simples: opcionalmente você pode desativar o usuário criado
      await admin.auth.admin.updateUserById(auth_user_id, { banned_until: "2100-01-01T00:00:00Z" }).catch(() => {});
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 400, headers },
      );
    }

    return new Response(
      JSON.stringify({ id: insertRes.id, user_id: auth_user_id }),
      { status: 201, headers },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers,
    });
  }
});