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

  const onChange = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
  };

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
    const baseUrl = isProd ? (form.transmitenota_base_url_prod || '') : (form.transmitenota_base_url_hml || '');
    const apiKey = isProd ? (form.transmitenota_apikey_prod || '') : (form.transmitenota_apikey_hml || '');
    if (!baseUrl || !apiKey) {
      toast({ title: 'Configuração incompleta', description: 'Preencha Base URL e ApiKey do ambiente selecionado.', variant: 'destructive' });
      return;
    }
    try {
      const r = await testarConexaoTN({ baseUrl, apiKey, cnpj: cnpjNum });
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
          ? 'Conectado (dados mínimos ausentes, mas credenciais e URL válidas)'
          : `Conectado (HTTP ${r.status})`);
      toast({ title: `Conexão ${isProd ? 'PROD' : 'HML'}: sucesso`, description: okMsg });
    } catch (e) {
      toast({ title: 'Falha no teste', description: e.message || 'Erro inesperado', variant: 'destructive' });
    }
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
          <div>
            <Label>ApiKey Transmite Nota (opcional)</Label>
            <Input value={form.transmitenota_apikey} onChange={onChange('transmitenota_apikey')} />
          </div>
        </div>

        {/* Transmite Nota por ambiente */}
        <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-border rounded-md p-3">
            <div className="text-xs text-muted-foreground mb-2">Transmite Nota • Homologação</div>
            <Label className="text-xs">Base URL (HML)</Label>
            <Input value={form.transmitenota_base_url_hml} onChange={onChange('transmitenota_base_url_hml')} placeholder="https://..." />
            <div className="mt-3" />
            <Label className="text-xs">ApiKey (HML)</Label>
            <Input value={form.transmitenota_apikey_hml} onChange={onChange('transmitenota_apikey_hml')} />
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => handleTestTN('hml')} disabled={saving || loading}>
                {loading ? 'Testando...' : 'Testar conexão HML'}
              </Button>
            </div>
          </div>
          <div className="border border-border rounded-md p-3">
            <div className="text-xs text-muted-foreground mb-2">Transmite Nota • Produção</div>
            <Label className="text-xs">Base URL (PROD)</Label>
            <Input value={form.transmitenota_base_url_prod} onChange={onChange('transmitenota_base_url_prod')} placeholder="https://..." />
            <div className="mt-3" />
            <Label className="text-xs">ApiKey (PROD)</Label>
            <Input value={form.transmitenota_apikey_prod} onChange={onChange('transmitenota_apikey_prod')} />
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
