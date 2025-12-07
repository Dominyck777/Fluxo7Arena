// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // Expor headers customizados para o browser conseguir ler
  "Access-Control-Expose-Headers": "x-isis-source, x-isis-duration-ms",
};

function toTitleCase(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function removeDiacritics(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function canonicalKey(str: string) {
  return removeDiacritics(str.trim().toLowerCase()).replace(/\s+/g, " ");
}

function fallbackParse(text: string) {
  const raw = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const extracted: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const cleaned = item.replace(/^[\W_]+|[\W_]+$/g, "");
    const key = canonicalKey(cleaned);
    const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(cleaned);
    const plausible = cleaned.length >= 2 && cleaned.length <= 60 && hasLetters && !/[0-9@]/.test(cleaned);
    if (!plausible || !key) {
      invalid.push(item);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      extracted.push(toTitleCase(cleaned));
    }
  }

  return { extracted, invalid };
}

serve(async (req: Request) => {
  const startedAt = Date.now();
  const reqId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { text, locale = "pt-BR" } = await req.json();
    if (!text || typeof text !== "string") {
      console.log(`[parse-participants][${reqId}] 400 Missing text`);
      return new Response(JSON.stringify({ error: "Missing 'text'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY_ISIS_PUBLIC");
    if (!apiKey) {
      const fb = fallbackParse(text);
      const duration = Date.now() - startedAt;
      console.log(`[parse-participants][${reqId}] source=fallback duration_ms=${duration} extracted=${fb.extracted.length} invalid=${fb.invalid.length}`);
      return new Response(JSON.stringify({ ...fb, source: "fallback", locale }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) },
      });
    }

    const systemPrompt = `Você extrairá nomes de participantes (pessoas) em pt-BR a partir de um texto colado (convocações, listas de jogadores/participantes/reserva).\n\nRegras obrigatórias:\n- Responda apenas com JSON válido no formato: {"extracted": string[], "invalid": string[]}\n- Inclua nomes completos OU apelidos de uma única palavra quando for claramente um nome/alcunha de pessoa no contexto da lista (ex.: "Peixe", "Fumaça", "Binho").\n- Aceite nomes de uma única palavra quando inseridos como participantes.\n- Remova duplicatas.\n- Ignore e-mails, telefones, apelidos com @, números isolados, nomes de times, emojis e qualquer linha que não represente uma pessoa.\n- Mantenha acentos.\n- Cada nome deve ter entre 2 e 60 caracteres.\n- Use Title Case apropriado em português (ex.: João da Silva, Ana Maria, Peixe).\n- Em caso de dúvida (ex.: apelido que parece animal/objeto como "Peixe"), se o contexto for de lista de jogadores/participantes/convocados, INCLUA em extracted.\n- Não inclua comentários ou texto fora do JSON.`;

    const fewShotUser = `Texto (locale=pt-BR):\n\n* Convocados:\n01) Victor\n02) Diney\n03) Ronaldo\n\n*JOGADORES*\n01) Brayon\n02) Peixe\n\nResponda apenas com JSON.`;
    const fewShotAssistant = { extracted: ["Victor", "Diney", "Ronaldo", "Brayon", "Peixe"], invalid: [] };

    const userPrompt = `Texto (locale=${locale}):\n\n${text}\n\nResponda apenas com JSON.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fewShotUser },
          { role: "assistant", content: JSON.stringify(fewShotAssistant) },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const fb = fallbackParse(text);
      const duration = Date.now() - startedAt;
      console.log(`[parse-participants][${reqId}] source=fallback openai_status=${resp.status} duration_ms=${duration} extracted=${fb.extracted.length} invalid=${fb.invalid.length}`);
      return new Response(JSON.stringify({ ...fb, source: "fallback", locale }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const fb = fallbackParse(text);
      return new Response(JSON.stringify({ ...fb, source: "fallback", locale }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let extracted: string[] = Array.isArray(parsed?.extracted) ? parsed.extracted : [];
    let invalid: string[] = Array.isArray(parsed?.invalid) ? parsed.invalid : [];

    const seen = new Set<string>();
    extracted = extracted
      .map((n) => toTitleCase(String(n || "").trim()))
      .filter((n) => {
        const key = canonicalKey(n);
        const ok = n.length >= 2 && n.length <= 60 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(n);
        if (!ok || !key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const duration = Date.now() - startedAt;
    console.log(`[parse-participants][${reqId}] source=openai duration_ms=${duration} extracted=${extracted.length} invalid=${invalid.length}`);
    return new Response(JSON.stringify({ extracted, invalid, source: "openai", locale }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "openai", "x-isis-duration-ms": String(duration) },
    });
  } catch (err) {
    const fb = fallbackParse("");
    const duration = Date.now() - startedAt;
    console.log(`[parse-participants][${reqId}] source=fallback error=${String(err)} duration_ms=${duration}`);
    return new Response(JSON.stringify({ ...fb, error: String(err), source: "fallback" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) },
    });
  }
});
