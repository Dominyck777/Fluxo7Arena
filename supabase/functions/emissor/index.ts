// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Hint TS in local IDE about Deno global (Supabase provides it at runtime)
declare const Deno: any;
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

// Simple CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders() },
    ...init,
  });
}

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function getBaseUrl(ambiente: string) {
  const isProd = String(ambiente || "").toLowerCase() === "producao";
  const key = isProd ? "TN_BASE_URL_PROD" : "TN_BASE_URL_HML";
  const v = Deno.env.get(key) || "";
  return v;
}

function getApiKey() {
  return Deno.env.get("TN_APIKEY") || "";
}

// Map ação -> endpoint path
const rotaPorAcao: Record<string, string> = {
  // Empresa / Certificado
  adicionar_empresa: "/AdicionarEmpresa/",
  enviar_certificado: "/EnviarCertificado/",
  // NF-e
  nfe_enviar: "/EnviarNfe/",
  nfe_consultar: "/ConsultarEmissaoNotaNfe/",
  nfe_cancelar: "/CancelarNfe/",
  nfe_pdf: "/ConsultarPDFNfe/",
  nfe_xml: "/ConsultarXMLNfe/",
  // NFC-e
  nfce_enviar: "/EnviarNfce/",
  nfce_consultar: "/ConsultarEmissaoNotaNfce/",
  nfce_cancelar: "/CancelarNfce/",
  nfce_alterar: "/AlterarDadosNfce/",
  nfce_pdf: "/ConsultarPDFNfce/",
  nfce_xml: "/ConsultarXMLNfce/",
  // util
  teste_conexao: "/ConsultarEmissaoNotaNfce/",
};

type ModeloTipo = "nfce" | "nfe" | "entrada";

async function fetchProviderJSON(ambiente: "homologacao" | "producao", cnpj: string, path: string, dados: any) {
  const baseUrl = getBaseUrl(ambiente);
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ApiKey do emissor não configurada no servidor");
  if (!baseUrl) throw new Error("Base URL do emissor não configurada no servidor");
  const url = joinUrl(baseUrl, path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ApiKey: apiKey, Cnpj: cnpj, Dados: dados || {} }),
  });
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.message || json?.erro || res.statusText || "Erro na API fiscal";
    throw new Error(msg);
  }
  return json;
}

async function downloadBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  } catch (_) {
    return null;
  }
}

function sanitizeChave(v: string | null | undefined) {
  return String(v || "").replace(/[^0-9A-Za-z_-]/g, "");
}

async function handleExportZip(
  ambiente: "homologacao" | "producao",
  cnpj: string,
  dados: any,
): Promise<Response> {
  const items: any[] = Array.isArray(dados?.items) ? dados.items : [];
  const includePdf: boolean = !!dados?.includePdf;
  const zipName: string = (dados?.zipName && String(dados.zipName).trim()) || "fiscal_export.zip";
  if (!items.length) {
    return jsonResponse({ message: "Itens obrigatórios para exportação" }, { status: 400 });
  }

  const zip = new JSZip();

  for (const it of items) {
    try {
      const tipo: ModeloTipo = String(it?.tipo || it?.modelo || "").toLowerCase().includes("65") ? "nfce"
        : String(it?.tipo || it?.modelo || "").toLowerCase().includes("entrada") ? "entrada"
        : String(it?.tipo || it?.modelo || "").toLowerCase().includes("nfce") ? "nfce"
        : "nfe";

      const chaveRaw = it?.chave || it?.Chave || it?.xml_chave || it?.chave_nfe || null;
      const chave = sanitizeChave(chaveRaw);
      const numero = it?.numero || it?.Numero || it?.nf_numero || null;
      const serie = it?.serie || it?.Serie || it?.nf_serie || null;
      const searchKey = it?.searchkey || it?.SearchKey || it?.xml_protocolo || null;

      const suffix = tipo === "nfce" ? "nfce" : "nfe";

      // 1) XML
      let xmlBytes: Uint8Array | null = null;
      let xmlStr: string | null = null;

      if (tipo === "entrada") {
        // Entrada: usar XML inline se fornecido; caso contrário, ignorar (frontend deve enviar)
        xmlStr = (it?.xml || it?.xml_completo || null) as string | null;
      } else {
        // Consultar XML via provedor
        const xmlPath = tipo === "nfce" ? rotaPorAcao["nfce_xml"] : rotaPorAcao["nfe_xml"];
        const payload = searchKey
          ? { searchkey: searchKey, SearchKey: searchKey }
          : (chave
              ? { chave: chave, Chave: chave }
              : { numero: numero, Numero: numero, serie: serie, Serie: serie });
        try {
          const rxml: any = await fetchProviderJSON(ambiente, cnpj, xmlPath, payload);
          const url_xml = rxml?.url_xml || rxml?.xml_url || rxml?.XmlUrl || null;
          if (url_xml) {
            xmlBytes = await downloadBinary(url_xml);
          }
        } catch (_) {}
      }

      if (xmlStr || xmlBytes) {
        const xmlFileName = `${chave || numero || "semchave"}-${suffix}.xml`;
        if (xmlBytes) zip.file(xmlFileName, xmlBytes);
        else if (xmlStr) zip.file(xmlFileName, xmlStr);
      }

      // 2) PDF (opcional)
      if (includePdf && tipo !== "entrada") {
        try {
          const pdfPath = tipo === "nfce" ? rotaPorAcao["nfce_pdf"] : rotaPorAcao["nfe_pdf"];
          const payloadPdf = searchKey
            ? { searchkey: searchKey, SearchKey: searchKey }
            : (chave
                ? { chave: chave, Chave: chave }
                : { numero: numero, Numero: numero, serie: serie, Serie: serie });
          const rpdf: any = await fetchProviderJSON(ambiente, cnpj, pdfPath, payloadPdf);
          const url_pdf = rpdf?.url_pdf || rpdf?.pdf_url || rpdf?.PdfUrl || null;
          if (url_pdf) {
            const pdfBytes = await downloadBinary(url_pdf);
            if (pdfBytes) {
              const pdfFileName = `${chave || numero || "semchave"}-${suffix}.pdf`;
              zip.file(pdfFileName, pdfBytes);
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      const err: any = e as any;
      try { console.warn("[emissor][export_zip] erro item:", err?.message || String(e)); } catch {}
      continue;
    }
  }

  const bytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });
  const headers = {
    ...corsHeaders(),
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${zipName}"`,
  } as Record<string, string>;
  return new Response(bytes as any, { headers, status: 200 });
}

interface ReqBody {
  acao: string;
  ambiente?: "homologacao" | "producao";
  cnpj?: string;
  dados?: unknown;
}

console.info("[emissor] edge function started");

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders() });
    }

    if (req.method !== "POST") {
      return jsonResponse({ message: "Método não permitido" }, { status: 405 });
    }

    let body: ReqBody | null = null;
    try {
      body = await req.json();
    } catch {}

    const acao = body?.acao || "";
    const ambiente = (body?.ambiente || "homologacao") as "homologacao" | "producao";
    const cnpj = String(body?.cnpj || "").replace(/\D/g, "");
    const dados = body?.dados ?? {};

    // Rota customizada: exportação de ZIP (não mapeada em rotaPorAcao)
    if (acao === "export_zip") {
      const items: any[] = Array.isArray((dados as any)?.items) ? (dados as any).items : [];
      const needsProvider = items.some((it) => {
        const s = String(it?.tipo || it?.modelo || "").toLowerCase();
        return !(s.includes("entrada"));
      });
      if (needsProvider && !cnpj) {
        return jsonResponse({ message: "CNPJ obrigatório" }, { status: 400 });
      }
      return await handleExportZip(ambiente, cnpj, dados);
    }

    if (!acao || !rotaPorAcao[acao]) {
      return jsonResponse({ message: "Ação inválida" }, { status: 400 });
    }

    if (!cnpj) {
      return jsonResponse({ message: "CNPJ obrigatório" }, { status: 400 });
    }

    const baseUrl = getBaseUrl(ambiente);
    const apiKey = getApiKey();

    if (!apiKey) {
      return jsonResponse({ message: "ApiKey do emissor não configurada no servidor" }, { status: 500 });
    }
    if (!baseUrl) {
      return jsonResponse({ message: "Base URL do emissor não configurada no servidor" }, { status: 500 });
    }

    const url = joinUrl(baseUrl, rotaPorAcao[acao]);

    const safeReq = { ApiKey: "***", Cnpj: cnpj, Dados: dados } as any;
    try { console.log("[emissor] request", acao, url, JSON.stringify(safeReq)); } catch {}

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ApiKey: apiKey, Cnpj: cnpj, Dados: dados }),
    });

    const text = await res.text();
    try { console.log("[emissor] response", acao, res.status, (text || "").slice(0, 4000)); } catch {}
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    // Para a ação de teste, sempre retornar estrutura padronizada com status
    if (acao === "teste_conexao") {
      const ok = res.ok;
      return jsonResponse({ status: res.status, ok, response: json, via: "edge", ambiente });
    }

    if (!res.ok) {
      const j: any = json as any;
      const msg = j?.message || j?.erro || res.statusText || "Erro na API fiscal";
      return jsonResponse({ message: msg, status: res.status, response: json }, { status: 200 });
    }

    return jsonResponse(json ?? { ok: true });
  } catch (e) {
    const err: any = e as any;
    try { console.error("[emissor] exception", err?.message || String(e)); } catch {}
    return jsonResponse({ message: err?.message || String(e) }, { status: 200 });
  }
});
