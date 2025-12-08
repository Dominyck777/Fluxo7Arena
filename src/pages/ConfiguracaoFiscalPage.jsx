import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

function field(v) { return v ?? ''; }
function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }

export default function ConfiguracaoFiscalPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
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

  return (
    <div className="container mx-auto p-4">
      <Helmet>
        <title>Configuração Fiscal</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-3">Configuração Fiscal</h1>
      <p className="text-sm text-muted-foreground mb-6">Preencha os dados fiscais da empresa. Esses dados serão usados na emissão de NFC-e/NF-e.</p>

      <form onSubmit={handleSave} className="grid gap-4 max-w-3xl">
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

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Label>Transmite Nota Base URL</Label>
            <Input value={form.transmitenota_base_url} onChange={onChange('transmitenota_base_url')} placeholder="https://api.transmitenota.com.br" />
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
