// Lightweight client for Emissor Fiscal API
// Now proxied via Supabase Edge Function 'emissor' to avoid exposing ApiKey in the client.
import { supabase } from '@/lib/supabase';

async function httpPostJson({ url, body }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.message || json?.erro || res.statusText || 'Erro na API fiscal';
    const err = new Error(msg);
    err.status = res.status;
    err.response = json ?? text;
    throw err;
  }
  return json;
}

function deriveAmbienteFromBaseUrl(baseUrl) {
  const s = String(baseUrl || '').toLowerCase();
  if (s.includes('/producao')) return 'producao';
  if (s.includes('/produção')) return 'producao';
  return 'homologacao';
}

async function edgeInvoke({ acao, ambiente, cnpj, dados }) {
  const payload = { acao, ambiente: ambiente || 'homologacao', cnpj: (cnpj || '').replace(/\D/g, ''), dados: dados || {} };
  const { data, error } = await supabase.functions.invoke('emissor', { body: payload });
  if (error) {
    const e = new Error(error.message || 'Erro na API fiscal');
    e.response = error;
    throw e;
  }
  // O Edge Function normaliza erros em { message, status, response }
  if (data && data.status && data.status >= 400 && !data.ok) {
    const e = new Error(data.message || 'Erro na API fiscal');
    e.status = data.status;
    e.response = data.response;
    throw e;
  }
  return data;
}
 

function joinUrl(baseUrl, path) {
  const b = String(baseUrl || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

// Testar conexão: tenta acessar a API e diferenciar erros comuns
export async function testarConexaoTN({ baseUrl, apiKey, cnpj }) {
  try {
    const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
    const resp = await edgeInvoke({ acao: 'teste_conexao', ambiente, cnpj, dados: {} });
    const status = resp?.status;
    const meta = { via: resp?.via || 'edge', ambiente: resp?.ambiente || ambiente };
    if (status === 200) return { reachable: true, authorized: true, status, response: resp?.response, meta };
    if (status === 400) return { reachable: true, authorized: true, status, response: resp?.response, meta };
    if (status === 401 || status === 403) return { reachable: true, authorized: false, status, response: resp?.response, meta };
    if (status === 404) return { reachable: false, authorized: false, status, response: resp?.response, meta };
    return { reachable: true, authorized: null, status, response: resp?.response, meta };
  } catch (e) {
    return { reachable: false, authorized: false, error: e?.message || String(e) };
  }
}

export async function adicionarEmpresa({ baseUrl, apiKey, cnpj, dados }) {
  if (!cnpj) throw new Error('cnpj obrigatório');
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'adicionar_empresa', ambiente, cnpj, dados });
}

export async function enviarCertificado({ baseUrl, apiKey, cnpj, certificadoBase64, senhaCertificado }) {
  if (!cnpj) throw new Error('cnpj obrigatório');
  if (!certificadoBase64) throw new Error('certificadoBase64 obrigatório');
  if (!senhaCertificado) throw new Error('senhaCertificado obrigatório');
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  const dados = { arquivo_certificado_base64: certificadoBase64, senha_certificado: senhaCertificado };
  return edgeInvoke({ acao: 'enviar_certificado', ambiente, cnpj, dados });
}

export async function enviarNfce({ baseUrl, apiKey, cnpj, dados }) {
  if (!cnpj) throw new Error('cnpj obrigatório');
  if (!dados) throw new Error('dados obrigatório');
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfce_enviar', ambiente, cnpj, dados });
}

export async function alterarDadosNfce({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfce_alterar', ambiente, cnpj, dados });
}

export async function consultarEmissaoNfce({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfce_consultar', ambiente, cnpj, dados });
}

export async function cancelarNfce({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfce_cancelar', ambiente, cnpj, dados });
}

export async function consultarPdfNfce({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfce_pdf', ambiente, cnpj, dados });
}

export async function consultarXmlNfce({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfce_xml', ambiente, cnpj, dados });
}

// NF-e (modelo 55)
export async function enviarNfe({ baseUrl, apiKey, cnpj, dados }) {
  if (!cnpj) throw new Error('cnpj obrigatório');
  if (!dados) throw new Error('dados obrigatório');
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  const clean = { ...dados };
  try { delete clean.Numero; } catch {}
  try { delete clean.Serie; } catch {}
  return edgeInvoke({ acao: 'nfe_enviar', ambiente, cnpj, dados: clean });
}

export async function consultarEmissaoNfe({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfe_consultar', ambiente, cnpj, dados });
}

export async function cancelarNfe({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfe_cancelar', ambiente, cnpj, dados });
}

export async function consultarPdfNfe({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfe_pdf', ambiente, cnpj, dados });
}

export async function consultarXmlNfe({ baseUrl, apiKey, cnpj, dados }) {
  const ambiente = deriveAmbienteFromBaseUrl(baseUrl);
  return edgeInvoke({ acao: 'nfe_xml', ambiente, cnpj, dados });
}

// Helpers para ambiente/global
export function getTransmiteNotaConfigFromEmpresa(empresa) {
  const amb = (empresa?.ambiente || 'homologacao').toLowerCase();
  const isProd = amb === 'producao';
  const baseUrlRaw = isProd
    ? (empresa?.transmitenota_base_url_prod || empresa?.transmitenota_base_url || '')
    : (empresa?.transmitenota_base_url_hml || empresa?.transmitenota_base_url || '');
  const apiKey = isProd
    ? (empresa?.transmitenota_apikey_prod || empresa?.transmitenota_apikey || '')
    : (empresa?.transmitenota_apikey_hml || empresa?.transmitenota_apikey || '');
  const baseUrl = baseUrlRaw || (isProd ? '/api/producao' : '/api/homologacao');
  return {
    baseUrl,
    apiKey,
    ambiente: amb,
    cnpj: (empresa?.cnpj || '').replace(/\D/g, ''),
  };
}
