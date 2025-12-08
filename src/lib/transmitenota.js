// Lightweight client for Transmite Nota API
// Usage: provide baseUrl from your env/dashboard (e.g., https://api.transmitenota.com.br)

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
    const msg = json?.message || json?.erro || res.statusText || 'Erro na API Transmite Nota';
    const err = new Error(msg);
    err.status = res.status;
    err.response = json ?? text;
    throw err;
  }
  return json;
}

function joinUrl(baseUrl, path) {
  const b = String(baseUrl || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

// Testar conexão: tenta acessar a API e diferenciar erros comuns
export async function testarConexaoTN({ baseUrl, apiKey, cnpj }) {
  const url = joinUrl(baseUrl, '/ConsultarEmissaoNotaNfce/');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ApiKey: apiKey || '', Cnpj: (cnpj || '').replace(/\D/g, ''), Dados: {} }),
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : null; } catch {}
    // Heurística: 401/403 => credenciais inválidas; 404 => URL incorreta; 200 => ok; 400 => alcançou o endpoint (provável credenciais ok, dados faltando)
    const status = res.status;
    if (status === 200) return { reachable: true, authorized: true, status, response: json ?? text };
    if (status === 400) return { reachable: true, authorized: true, status, response: json ?? text };
    if (status === 401 || status === 403) return { reachable: true, authorized: false, status, response: json ?? text };
    if (status === 404) return { reachable: false, authorized: false, status, response: json ?? text };
    return { reachable: true, authorized: null, status, response: json ?? text };
  } catch (e) {
    return { reachable: false, authorized: false, error: e?.message || String(e) };
  }
}

export async function adicionarEmpresa({ baseUrl, apiKey, cnpj, dados }) {
  if (!baseUrl) throw new Error('baseUrl obrigatório');
  if (!apiKey) throw new Error('apiKey obrigatório');
  if (!cnpj) throw new Error('cnpj obrigatório');
  const url = joinUrl(baseUrl, '/AdicionarEmpresa/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados || {} } });
}

export async function enviarCertificado({ baseUrl, apiKey, cnpj, certificadoBase64, senhaCertificado }) {
  if (!baseUrl) throw new Error('baseUrl obrigatório');
  if (!apiKey) throw new Error('apiKey obrigatório');
  if (!cnpj) throw new Error('cnpj obrigatório');
  if (!certificadoBase64) throw new Error('certificadoBase64 obrigatório');
  if (!senhaCertificado) throw new Error('senhaCertificado obrigatório');
  const url = joinUrl(baseUrl, '/EnviarCertificado/');
  return httpPostJson({
    url,
    body: { ApiKey: apiKey, Cnpj: cnpj, Dados: { arquivo_certificado_base64: certificadoBase64, senha_certificado: senhaCertificado } },
  });
}

export async function enviarNfce({ baseUrl, apiKey, cnpj, dados }) {
  if (!baseUrl) throw new Error('baseUrl obrigatório');
  if (!apiKey) throw new Error('apiKey obrigatório');
  if (!cnpj) throw new Error('cnpj obrigatório');
  if (!dados) throw new Error('dados obrigatório');
  const url = joinUrl(baseUrl, '/EnviarNfce/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados } });
}

export async function alterarDadosNfce({ baseUrl, apiKey, cnpj, dados }) {
  const url = joinUrl(baseUrl, '/AlterarDadosNfce/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados } });
}

export async function consultarEmissaoNfce({ baseUrl, apiKey, cnpj, dados }) {
  const url = joinUrl(baseUrl, '/ConsultarEmissaoNotaNfce/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados } });
}

export async function cancelarNfce({ baseUrl, apiKey, cnpj, dados }) {
  const url = joinUrl(baseUrl, '/CancelarNfce/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados } });
}

export async function consultarPdfNfce({ baseUrl, apiKey, cnpj, dados }) {
  const url = joinUrl(baseUrl, '/ConsultarPDFNfce/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados } });
}

export async function consultarXmlNfce({ baseUrl, apiKey, cnpj, dados }) {
  const url = joinUrl(baseUrl, '/ConsultarXMLNfce/');
  return httpPostJson({ url, body: { ApiKey: apiKey, Cnpj: cnpj, Dados: dados } });
}

// Helpers para ambiente/global
export function getTransmiteNotaConfigFromEmpresa(empresa) {
  const amb = (empresa?.ambiente || 'homologacao').toLowerCase();
  const isProd = amb === 'producao';
  const baseUrl = isProd
    ? (empresa?.transmitenota_base_url_prod || empresa?.transmitenota_base_url || '')
    : (empresa?.transmitenota_base_url_hml || empresa?.transmitenota_base_url || '');
  const apiKey = isProd
    ? (empresa?.transmitenota_apikey_prod || empresa?.transmitenota_apikey || '')
    : (empresa?.transmitenota_apikey_hml || empresa?.transmitenota_apikey || '');
  return {
    baseUrl,
    apiKey,
    cnpj: (empresa?.cnpj || '').replace(/\D/g, ''),
  };
}
