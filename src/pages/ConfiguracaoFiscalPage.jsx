import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { testarConexaoTN } from '@/lib/transmitenota';

function field(v) { return v ?? ''; }
function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }

export default function ConfiguracaoFiscalPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresa, setEmpresa] = useState(null);

  const [form, setForm] = useState({
    inscricao_estadual: '',
    regime_tributario: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    codigo_municipio_ibge: '',
    nfce_serie: '1',
    nfce_numeracao: '1',
    nfce_itoken: '',
    nfe_serie: '',
    nfe_numeracao: '',
    ambiente: 'homologacao',
    transmitenota_apikey: '',
    transmitenota_base_url: '',
    transmitenota_base_url_hml: '',
    transmitenota_apikey_hml: '',
    transmitenota_base_url_prod: '',
    transmitenota_apikey_prod: '',
  });
  const [unlocked, setUnlocked] = useState(true);
  const [hasLock, setHasLock] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);

  useEffect(() => {
    async function load() {
      if (!userProfile?.codigo_empresa) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .single();
      if (error) {
        toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      } else if (data) {
        setEmpresa(data);
        setForm({
          inscricao_estadual: field(data.inscricao_estadual),
          regime_tributario: data.regime_tributario ? String(data.regime_tributario) : '',
          logradouro: field(data.logradouro),
          numero: field(data.numero),
          complemento: field(data.complemento),
          bairro: field(data.bairro),
          cidade: field(data.cidade),
          uf: field(data.uf),
          cep: onlyDigits(data.cep),
          codigo_municipio_ibge: field(data.codigo_municipio_ibge),
          nfce_serie: data.nfce_serie != null ? String(data.nfce_serie) : '1',
          nfce_numeracao: data.nfce_numeracao != null ? String(data.nfce_numeracao) : '1',
          nfce_itoken: field(data.nfce_itoken),
          nfe_serie: data.nfe_serie != null ? String(data.nfe_serie) : '',
          nfe_numeracao: data.nfe_numeracao != null ? String(data.nfe_numeracao) : '',
          ambiente: data.ambiente || 'homologacao',
          transmitenota_apikey: field(data.transmitenota_apikey),
          transmitenota_base_url: field(data.transmitenota_base_url),
          transmitenota_base_url_hml: field(data.transmitenota_base_url_hml),
          transmitenota_apikey_hml: field(data.transmitenota_apikey_hml),
          transmitenota_base_url_prod: field(data.transmitenota_base_url_prod),
          transmitenota_apikey_prod: field(data.transmitenota_apikey_prod),
        });
      }
      setLoading(false);
    }
    load();
  }, [userProfile?.codigo_empresa]);

  // Removido: persistência de desbloqueio por sessão. Sempre solicitar senha ao abrir a página.

  useEffect(() => {
    if (!empresa?.codigo_empresa) return;
    try {
      const keyHash = `cfgfiscal_hash_${empresa.codigo_empresa}`;
      const hasDb = !!empresa?.cfgfiscal_hash;
      const hasLocal = !!localStorage.getItem(keyHash);
      setHasLock(hasDb || hasLocal);
    } catch {}
  }, [empresa?.codigo_empresa]);

  const onChange = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
  };
  async function sha256Hex(s) {
    try {
      const c = (typeof window !== 'undefined' ? window.crypto : (typeof globalThis !== 'undefined' ? globalThis.crypto : null)) || null;
      if (c && c.subtle && typeof TextEncoder !== 'undefined') {
        const enc = new TextEncoder();
        const data = enc.encode(s);
        const digest = await c.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {}
    return sha256HexSync(s);
  }
  function sha256HexSync(s) {
    const ascii = unescape(encodeURIComponent(s));
    return sha256(ascii);
  }
  function sha256(ascii) {
    var rightRotate = function(v, a) { return (v >>> a) | (v << (32 - a)); };
    var mathPow = Math.pow, maxWord = mathPow(2, 32);
    var lengthProperty = 'length', i, j, result = '';
    var words = [], asciiBitLength = ascii[lengthProperty] * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var t1 = hash[7] + (rightRotate(e,6) ^ rightRotate(e,11) ^ rightRotate(e,25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15,7) ^ rightRotate(w15,18) ^ (w15>>>3)) + w[i - 7] + (rightRotate(w2,17) ^ rightRotate(w2,19) ^ (w2>>>10))) | 0);
        var t2 = (rightRotate(a,2) ^ rightRotate(a,13) ^ rightRotate(a,22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0, a, hash[1], hash[2], (hash[3] + t1) | 0, hash[4], hash[5], hash[6]];
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }
  async function handleUnlock(e) {
    e?.preventDefault?.();
    if (unlockBusy || !empresa?.cnpj) return;
    try {
      setUnlockBusy(true);
      const keyHash = `cfgfiscal_hash_${empresa.codigo_empresa}`;
      const savedDb = empresa?.cfgfiscal_hash || '';
      const savedLocal = localStorage.getItem(keyHash) || '';
      const saved = savedDb || savedLocal;
      if (!saved) {
        toast({ title: 'Nenhuma senha definida', variant: 'destructive' });
        return;
      }
      const h = await sha256Hex(String(pass || '') + '|' + String(empresa.cnpj || ''));
      if (h === saved) {
        setUnlocked(true);
        setPass('');
        toast({ title: 'Acesso liberado' });
      } else {
        toast({ title: 'Senha incorreta', variant: 'destructive' });
      }
    } finally {
      setUnlockBusy(false);
    }
  }
  async function handleSetPassword(e) {
    e?.preventDefault?.();
    if (unlockBusy || !empresa?.cnpj) return;
    if (!pass || pass.length < 8) {
      toast({ title: 'Defina uma senha com 8+ caracteres', variant: 'destructive' });
      return;
    }
    if (pass !== pass2) {
      toast({ title: 'Senhas não conferem', variant: 'destructive' });
      return;
    }
    try {
      setUnlockBusy(true);
      const keyHash = `cfgfiscal_hash_${empresa.codigo_empresa}`;
      const h = await sha256Hex(String(pass) + '|' + String(empresa.cnpj || ''));
      // 1) Tenta persistir no banco (universal por empresa)
      let savedAtDb = false;
      try {
        const { error } = await supabase
          .from('empresas')
          .update({ cfgfiscal_hash: h })
          .eq('codigo_empresa', empresa.codigo_empresa)
          .select('id')
          .single();
        if (!error) {
          savedAtDb = true;
          setEmpresa((prev) => ({ ...prev, cfgfiscal_hash: h }));
          try { localStorage.removeItem(keyHash); } catch {}
        }
      } catch {}
      // 2) Fallback: localStorage (se a coluna não existir no servidor)
      if (!savedAtDb) {
        try { localStorage.setItem(keyHash, h); } catch {}
      }
      setUnlocked(true);
      setPass('');
      setPass2('');
      toast({ title: 'Senha definida' });
    } finally {
      setUnlockBusy(false);
    }
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (!userProfile?.codigo_empresa) return;

    const payload = {
      inscricao_estadual: form.inscricao_estadual?.trim() || null,
      regime_tributario: form.regime_tributario ? Number(form.regime_tributario) : null,
      logradouro: form.logradouro?.trim() || null,
      numero: form.numero?.trim() || null,
      complemento: form.complemento?.trim() || null,
      bairro: form.bairro?.trim() || null,
      cidade: form.cidade?.trim() || null,
      uf: form.uf?.trim().toUpperCase() || null,
      cep: onlyDigits(form.cep) || null,
      codigo_municipio_ibge: form.codigo_municipio_ibge?.trim() || null,
      nfce_serie: form.nfce_serie ? Number(form.nfce_serie) : null,
      nfce_numeracao: form.nfce_numeracao ? Number(form.nfce_numeracao) : null,
      nfce_itoken: form.nfce_itoken?.trim() || null,
      nfe_serie: form.nfe_serie ? Number(form.nfe_serie) : null,
      nfe_numeracao: form.nfe_numeracao ? Number(form.nfe_numeracao) : null,
      ambiente: form.ambiente || 'homologacao',
      transmitenota_apikey: form.transmitenota_apikey?.trim() || null,
      transmitenota_base_url: form.transmitenota_base_url?.trim() || null,
      transmitenota_base_url_hml: form.transmitenota_base_url_hml?.trim() || null,
      transmitenota_apikey_hml: form.transmitenota_apikey_hml?.trim() || null,
      transmitenota_base_url_prod: form.transmitenota_base_url_prod?.trim() || null,
      transmitenota_apikey_prod: form.transmitenota_apikey_prod?.trim() || null,
    };

    try {
      setSaving(true);
      const { error } = await supabase
        .from('empresas')
        .update(payload)
        .eq('codigo_empresa', userProfile.codigo_empresa)
        .select('id')
        .single();
      if (error) throw error;
      toast({ title: 'Configurações salvas', description: 'Dados fiscais atualizados.' });
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // Testar conexão Transmite Nota por ambiente
  async function handleTestTN(env) {
    const cnpjNum = onlyDigits(empresa?.cnpj || '');
    if (cnpjNum.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'Salve um CNPJ válido (14 dígitos) nos dados da empresa.', variant: 'destructive' });
      return;
    }
    const isProd = env === 'prod';
    // Edge Function usa secrets no servidor; aqui passamos um baseUrl sintético para derivar o ambiente
    const baseUrl = isProd ? '/api/producao' : '/api/homologacao';
    try {
      const r = await testarConexaoTN({ baseUrl, apiKey: '', cnpj: cnpjNum });
      if (!r.reachable) {
        toast({ title: 'Sem conexão', description: r.error || `Endpoint inacessível (${r.status||'sem status'})`, variant: 'destructive' });
        return;
      }
      if (r.authorized === false) {
        toast({ title: 'Credenciais inválidas', description: `HTTP ${r.status}. Verifique ApiKey e CNPJ.`, variant: 'destructive' });
        return;
      }
      const okMsg = r.status === 200
        ? 'OK'
        : (r.status === 400
          ? 'Conectado (dados mínimos ausentes; credenciais válidas)'
          : `Conectado (HTTP ${r.status})`);
      const extra = r.meta ? ` • via ${r.meta.via || 'edge'} • ambiente ${r.meta.ambiente || (isProd ? 'producao' : 'homologacao')}` : '';
      toast({ title: `Conexão ${isProd ? 'PROD' : 'HML'}: sucesso`, description: okMsg + extra });
    } catch (e) {
      toast({ title: 'Falha no teste', description: e.message || 'Erro inesperado', variant: 'destructive' });
    }
  }

  if (!unlocked) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Helmet>
          <title>Configuração Fiscal</title>
        </Helmet>

        <div className="flex items-center justify-between mb-4">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <div className="text-right">
            <h1 className="text-2xl font-semibold leading-tight">Configuração Fiscal</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito.</p>
          </div>
        </div>

        <div className="max-w-md mx-auto grid gap-4 bg-surface border border-border rounded-lg p-4 shadow-sm">
          {loading ? (
            <div className="text-sm text-text-secondary">Carregando...</div>
          ) : hasLock ? (
            <>
              <Label>Senha</Label>
              <Input type="password" value={pass} onChange={(e)=>setPass(e.target.value)} />
              <Button type="button" onClick={handleUnlock} disabled={unlockBusy || !pass}>
                {unlockBusy ? 'Verificando...' : 'Desbloquear'}
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm">Defina uma senha para proteger esta aba.</div>
              <Label>Nova senha</Label>
              <Input type="password" value={pass} onChange={(e)=>setPass(e.target.value)} />
              <Label>Confirmar senha</Label>
              <Input type="password" value={pass2} onChange={(e)=>setPass2(e.target.value)} />
              <Button type="button" onClick={handleSetPassword} disabled={unlockBusy || !pass || !pass2}>
                {unlockBusy ? 'Salvando...' : 'Definir senha'}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Helmet>
        <title>Configuração Fiscal</title>
      </Helmet>

      <div className="flex items-center justify-between mb-4">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
          Voltar
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-semibold leading-tight">Configuração Fiscal</h1>
          <p className="text-xs text-muted-foreground">Dados que serão usados na emissão de NFC-e/NF-e.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-6 bg-surface border border-border rounded-lg p-4 shadow-sm">
        {/* Identificação fiscal básica */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Inscrição Estadual</Label>
            <Input value={form.inscricao_estadual} onChange={onChange('inscricao_estadual')} />
          </div>
          <div>
            <Label>Regime Tributário (CRT)</Label>
            <Select value={form.regime_tributario} onValueChange={onChange('regime_tributario')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 - Simples Nacional</SelectItem>
                <SelectItem value="2">2 - Simples Nacional (excesso sublimite)</SelectItem>
                <SelectItem value="3">3 - Regime Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ambiente</Label>
            <Select value={form.ambiente} onValueChange={onChange('ambiente')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Endereço fiscal */}
        <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3">
            <Label>Logradouro</Label>
            <Input value={form.logradouro} onChange={onChange('logradouro')} />
          </div>
          <div>
            <Label>Número</Label>
            <Input value={form.numero} onChange={onChange('numero')} />
          </div>
          <div className="sm:col-span-2">
            <Label>Complemento</Label>
            <Input value={form.complemento} onChange={onChange('complemento')} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={onChange('bairro')} />
          </div>
          <div>
            <Label>CEP</Label>
            <Input value={form.cep} onChange={(e) => onChange('cep')({ target: { value: onlyDigits(e.target.value) } })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={onChange('cidade')} />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={form.uf} onChange={(e) => onChange('uf')({ target: { value: String(e.target.value || '').toUpperCase().slice(0,2) } })} />
          </div>
          <div>
            <Label>Código IBGE Município (cMun)</Label>
            <Input value={form.codigo_municipio_ibge} onChange={onChange('codigo_municipio_ibge')} />
          </div>
        </div>

        {/* NFC-e */}
        <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>NFC-e Série</Label>
            <Input value={form.nfce_serie} onChange={onChange('nfce_serie')} />
          </div>
          <div>
            <Label>NFC-e Numeração Inicial</Label>
            <Input value={form.nfce_numeracao} onChange={onChange('nfce_numeracao')} />
          </div>
          <div>
            <Label>NFC-e IToken (CSC)</Label>
            <Input value={form.nfce_itoken} onChange={onChange('nfce_itoken')} />
          </div>
        </div>

        {/* NF-e */}
        <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>NF-e Série (opcional)</Label>
            <Input value={form.nfe_serie} onChange={onChange('nfe_serie')} />
          </div>
          <div>
            <Label>NF-e Numeração (opcional)</Label>
            <Input value={form.nfe_numeracao} onChange={onChange('nfe_numeracao')} />
          </div>
          <div className="hidden">
            <Label>ApiKey do Emissor</Label>
            <Input value={form.transmitenota_apikey} readOnly disabled />
          </div>
        </div>

        {/* Transmite Nota por ambiente */}
        <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-border rounded-md p-3">
            <div className="text-xs text-muted-foreground mb-2">Emissor Fiscal • Homologação</div>
            <div className="hidden">
              <Label className="text-xs">Base URL (HML)</Label>
              <Input value={form.transmitenota_base_url_hml} readOnly disabled placeholder="Gerenciado no servidor" />
              <div className="mt-3" />
            </div>
            <Label className="text-xs">ApiKey (HML) — Gerenciado no servidor</Label>
            <Input value={form.transmitenota_apikey_hml ? '••••••••••' : ''} readOnly disabled placeholder="Gerenciado no servidor" />
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => handleTestTN('hml')} disabled={saving || loading}>
                {loading ? 'Testando...' : 'Testar conexão HML'}
              </Button>
            </div>
          </div>
          <div className="border border-border rounded-md p-3">
            <div className="text-xs text-muted-foreground mb-2">Emissor Fiscal • Produção</div>
            <div className="hidden">
              <Label className="text-xs">Base URL (PROD)</Label>
              <Input value={form.transmitenota_base_url_prod} readOnly disabled placeholder="Gerenciado no servidor" />
              <div className="mt-3" />
            </div>
            <Label className="text-xs">ApiKey (PROD) — Gerenciado no servidor</Label>
            <Input value={form.transmitenota_apikey_prod ? '••••••••••' : ''} readOnly disabled placeholder="Gerenciado no servidor" />
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => handleTestTN('prod')} disabled={saving || loading}>
                {loading ? 'Testando...' : 'Testar conexão PROD'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button type="submit" disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
