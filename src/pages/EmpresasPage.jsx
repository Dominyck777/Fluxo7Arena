import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { testarConexaoTN } from '@/lib/transmitenota';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { when: 'beforeChildren', staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function SectionCard({ children, className = '' }) {
  return (
    <motion.div variants={itemVariants} className={`fx-card ${className}`}>
      {children}
    </motion.div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-text-muted">{label}</span>
      <input {...props} className={`bg-surface-2 border border-border rounded-md px-3 py-2 text-sm ${props.className || ''}`} />
    </label>
  );
}

function formatCNPJ(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
}

function formatPhone(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 15);
}

function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }

export default function EmpresasPage() {
  const { toast } = useToast();
  const { company, userProfile, reloadCompany } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    logo_url: '',
    // Fiscais
    inscricao_estadual: '',
    regime_tributario: '',
    ambiente: 'homologacao',
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
    transmitenota_apikey: '',
    transmitenota_base_url: '',
    transmitenota_base_url_hml: '',
    transmitenota_apikey_hml: '',
    transmitenota_base_url_prod: '',
    transmitenota_apikey_prod: '',
  });
  const fileInputRef = useRef(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Carrega dados atuais da empresa com resiliência (cache + fallback + guarda de montagem)
  useEffect(() => {
    const load = async () => {
      try {
        const codigoEmpresa = userProfile?.codigo_empresa || null;
        if (!codigoEmpresa) return;
        const cacheKey = `empresa:form:${codigoEmpresa}`;
        // hydrate cache first
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached && typeof cached === 'object') {
              setForm((prev) => ({ ...prev, ...cached }));
              if (cached.logo_url) setLogoPreviewUrl(`${cached.logo_url.split('?')[0]}?v=${Date.now()}`);
            }
          }
        } catch {}
        // slow fallback: caso backend demore
        const slowFallback = setTimeout(() => {
          if (!mountedRef.current) return;
          try {
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
              const cached = JSON.parse(raw);
              if (cached && typeof cached === 'object') {
                console.warn('[Empresas] slow fallback: using cached form');
                setForm((prev) => ({ ...prev, ...cached }));
                if (cached.logo_url) setLogoPreviewUrl(`${cached.logo_url.split('?')[0]}?v=${Date.now()}`);
              }
            }
          } catch {}
        }, 5000);
        // fetch atual do banco (RLS por codigo_empresa)
        const { data: empresa, error } = await supabase
          .from('empresas')
          .select('*')
          .eq('codigo_empresa', codigoEmpresa)
          .single();
        clearTimeout(slowFallback);
        if (error) throw error;
        if (!mountedRef.current) return;
        const fresh = {
          razao_social: empresa?.razao_social || '',
          nome_fantasia: empresa?.nome_fantasia || empresa?.nome || '',
          cnpj: empresa?.cnpj || '',
          email: empresa?.email || '',
          telefone: empresa?.telefone || '',
          endereco: empresa?.endereco || '',
          logo_url: empresa?.logo_url || '',
          inscricao_estadual: empresa?.inscricao_estadual || '',
          regime_tributario: empresa?.regime_tributario != null ? String(empresa.regime_tributario) : '',
          ambiente: empresa?.ambiente || 'homologacao',
          logradouro: empresa?.logradouro || '',
          numero: empresa?.numero || '',
          complemento: empresa?.complemento || '',
          bairro: empresa?.bairro || '',
          cidade: empresa?.cidade || '',
          uf: empresa?.uf || '',
          cep: empresa?.cep || '',
          codigo_municipio_ibge: empresa?.codigo_municipio_ibge || '',
          nfce_serie: empresa?.nfce_serie != null ? String(empresa.nfce_serie) : '1',
          nfce_numeracao: empresa?.nfce_numeracao != null ? String(empresa.nfce_numeracao) : '1',
          nfce_itoken: empresa?.nfce_itoken || '',
          nfe_serie: empresa?.nfe_serie != null ? String(empresa.nfe_serie) : '',
          nfe_numeracao: empresa?.nfe_numeracao != null ? String(empresa.nfe_numeracao) : '',
          transmitenota_apikey: empresa?.transmitenota_apikey || '',
          transmitenota_base_url: empresa?.transmitenota_base_url || '',
          transmitenota_base_url_hml: empresa?.transmitenota_base_url_hml || '',
          transmitenota_apikey_hml: empresa?.transmitenota_apikey_hml || '',
          transmitenota_base_url_prod: empresa?.transmitenota_base_url_prod || '',
          transmitenota_apikey_prod: empresa?.transmitenota_apikey_prod || '',
        };

  // Testar conexão Transmite Nota por ambiente
  async function handleTestTN(env) {
    const cnpjNum = onlyDigits(form.cnpj);
    if (cnpjNum.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'Informe 14 dígitos para testar.', variant: 'destructive' });
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
      setLoading(true);
      const r = await testarConexaoTN({ baseUrl, apiKey, cnpj: cnpjNum });
      if (!r.reachable) {
        toast({ title: 'Sem conexão', description: r.error || `Endpoint inacessível (${r.status||'sem status'})`, variant: 'destructive' });
        return;
      }
      if (r.authorized === false) {
        toast({ title: 'Credenciais inválidas', description: `HTTP ${r.status}. Verifique ApiKey e CNPJ.`, variant: 'destructive' });
        return;
      }
      const okMsg = r.status === 200 ? 'OK' : (r.status === 400 ? 'Conectado (dados mínimos ausentes, mas credenciais e URL válidas)' : `Conectado (HTTP ${r.status})`);
      toast({ title: `Conexão ${isProd ? 'PROD' : 'HML'}: sucesso`, description: okMsg });
    } catch (e) {
      toast({ title: 'Falha no teste', description: e.message || 'Erro inesperado', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const normalize = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const handleBuscarCNPJ = async () => {
    const cnpjNum = onlyDigits(form.cnpj);
    if (cnpjNum.length !== 14) { toast({ title: 'CNPJ inválido', description: 'Informe 14 dígitos para buscar.', variant: 'destructive' }); return; }
    try {
      setLoading(true);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNum}`);
      if (!res.ok) throw new Error('Falha ao consultar CNPJ');
      const data = await res.json();
      const razao = data.razao_social || data.nome || '';
      const fantasia = data.nome_fantasia || '';
      const logradouro = data.logradouro || '';
      const numero = (data.numero || '').toString();
      const complemento = data.complemento || '';
      const bairro = data.bairro || '';
      const cidade = data.municipio || data.localidade || '';
      const uf = data.uf || '';
      const cep = onlyDigits(data.cep);
      let codigoIBGE = '';
      try {
        if (cidade && uf) {
          const r2 = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`);
          if (r2.ok) {
            const lista = await r2.json();
            const alvo = normalize(cidade);
            const found = (lista || []).find((m) => normalize(m.nome) === alvo);
            if (found?.codigo_ibge || found?.codigo) codigoIBGE = String(found.codigo_ibge || found.codigo);
          }
        }
      } catch {}
      const enderecoFull = `${logradouro}${numero ? ', ' + numero : ''}${bairro ? ' - ' + bairro : ''}${(cidade||uf) ? ' - ' + cidade + '/' + uf : ''}`;
      setForm((prev) => ({
        ...prev,
        razao_social: razao,
        nome_fantasia: fantasia || razao,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        cep,
        endereco: enderecoFull || prev.endereco,
        codigo_municipio_ibge: codigoIBGE || '',
      }));
      toast({ title: 'CNPJ carregado', description: 'Dados preenchidos automaticamente.' });
    } catch (e) {
      toast({ title: 'Falha ao buscar CNPJ', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }
        setForm(fresh);
        setLogoPreviewUrl(fresh.logo_url ? `${fresh.logo_url.split('?')[0]}?v=${Date.now()}` : '');
        try { localStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch {}
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Falha ao carregar empresa:', e);
      }
    };
    load();
  }, [userProfile?.codigo_empresa]);

  // Sempre que a URL da logo no form mudar (ex.: após salvar e recarregar do DB), renove o preview com cache-buster
  useEffect(() => {
    if (!form.logo_url) {
      setLogoPreviewUrl('');
      return;
    }
    // Evita acumular múltiplos ?v= na troca manual
    const base = form.logo_url.split('?')[0];
    setLogoPreviewUrl(`${base}?v=${Date.now()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.logo_url]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // evitar duplo submit
    if (!form.razao_social?.trim() || !form.cnpj?.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha Razão Social e CNPJ.' });
      return;
    }
    if (!userProfile?.codigo_empresa) {
      toast({ title: 'Empresa não vinculada', description: 'Não foi possível identificar a empresa do usuário para salvar.' });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        nome: form.nome_fantasia || form.razao_social || 'Empresa', // Campo obrigatório
        razao_social: form.razao_social || null,
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj?.replace(/\D/g, '') || null,
        email: form.email || null,
        telefone: form.telefone || null,
        endereco: form.endereco || null,
        logo_url: form.logo_url || null,
        // Fiscais
        inscricao_estadual: form.inscricao_estadual?.trim() || null,
        regime_tributario: form.regime_tributario ? Number(form.regime_tributario) : null,
        ambiente: form.ambiente || 'homologacao',
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        complemento: form.complemento?.trim() || null,
        bairro: form.bairro?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: (form.uf || '').toUpperCase().slice(0,2) || null,
        cep: onlyDigits(form.cep) || null,
        codigo_municipio_ibge: form.codigo_municipio_ibge?.trim() || null,
        nfce_serie: form.nfce_serie ? Number(form.nfce_serie) : null,
        nfce_numeracao: form.nfce_numeracao ? Number(form.nfce_numeracao) : null,
        nfce_itoken: form.nfce_itoken?.trim() || null,
        nfe_serie: form.nfe_serie ? Number(form.nfe_serie) : null,
        nfe_numeracao: form.nfe_numeracao ? Number(form.nfe_numeracao) : null,
        transmitenota_apikey: form.transmitenota_apikey?.trim() || null,
        transmitenota_base_url: form.transmitenota_base_url?.trim() || null,
        transmitenota_base_url_hml: form.transmitenota_base_url_hml?.trim() || null,
        transmitenota_apikey_hml: form.transmitenota_apikey_hml?.trim() || null,
        transmitenota_base_url_prod: form.transmitenota_base_url_prod?.trim() || null,
        transmitenota_apikey_prod: form.transmitenota_apikey_prod?.trim() || null,
      };
      
      // Upsert resiliente: remove colunas inexistentes reportadas pelo PostgREST e re-tenta
      const tryUpsert = async (pl, attempt = 1) => {
        try {
          const { error } = await supabase
            .from('empresas')
            .upsert(
              { codigo_empresa: userProfile.codigo_empresa, ...pl },
              { onConflict: 'codigo_empresa' }
            )
            .select('id')
            .single();
          if (error) throw error;
          return true;
        } catch (err) {
          const msg = String(err?.message || '');
          const colMatch = msg.match(/the '([^']+)' column|column\s+"([^"]+)"\s+of/i);
          const col = (colMatch && (colMatch[1] || colMatch[2])) ? (colMatch[1] || colMatch[2]) : null;
          if (col && pl.hasOwnProperty(col) && attempt <= 5) {
            console.warn('[Empresas] Removendo coluna inexistente e tentando novamente:', col);
            const next = { ...pl };
            delete next[col];
            return await tryUpsert(next, attempt + 1);
          }
          // Não conseguiu resolver: propaga erro
          throw err;
        }
      };

      await tryUpsert(payload);
      
      // Recarrega dados da empresa no contexto para refletir no header (logo/nome)
      await reloadCompany?.();
      toast({ title: 'Dados salvos', description: 'As informações da empresa foram atualizadas.' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const msg = (err?.message || err?.hint || '').toString() || 'Não foi possível salvar os dados. Verifique as permissões e tente novamente.';
      toast({ title: 'Erro ao salvar', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!userProfile?.codigo_empresa) {
        toast({ title: 'Empresa não vinculada', description: 'Seu usuário não está associado a uma empresa.' });
        return;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      // Usar o codigo_empresa como pasta no bucket
      const path = `${userProfile.codigo_empresa}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
      const baseUrl = pub?.publicUrl || '';
      // Mantém no form (DB) a URL base, e usa uma versão com cache-buster para o preview
      setForm((prev) => ({ ...prev, logo_url: baseUrl }));
      setLogoPreviewUrl(baseUrl ? `${baseUrl}?v=${Date.now()}` : '');
      toast({ title: 'Logo enviada', description: 'A imagem foi carregada com sucesso. Lembre-se de salvar.' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Falha no upload da logo:', e);
      toast({ title: 'Erro no upload', description: 'Não foi possível enviar a logo. Tente outro arquivo.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Buscar dados públicos do CNPJ (BrasilAPI) e preencher formulário
  function normalize(s) {
    return String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }
  async function handleBuscarCNPJ() {
    const cnpjNum = onlyDigits(form.cnpj);
    if (cnpjNum.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'Informe 14 dígitos para buscar.', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNum}`);
      if (!res.ok) {
        let msg = 'Falha ao consultar CNPJ';
        try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      try { console.info('[empresas] BuscarCNPJ:payload', data); } catch {}
      const razao = data.razao_social || data.nome || '';
      const fantasia = data.nome_fantasia || '';
      const logradouro = data.logradouro || '';
      const numero = (data.numero || '').toString();
      const complemento = data.complemento || '';
      const bairro = data.bairro || '';
      const cidade = data.municipio || data.localidade || '';
      const uf = data.uf || '';
      const cep = onlyDigits(data.cep);
      let codigoIBGE = '';
      try {
        if (cidade && uf) {
          const r2 = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`);
          if (r2.ok) {
            const lista = await r2.json();
            const alvo = normalize(cidade);
            const found = (lista || []).find((m) => normalize(m.nome) === alvo);
            if (found?.codigo_ibge || found?.codigo) codigoIBGE = String(found.codigo_ibge || found.codigo);
          }
        }
      } catch {}
      const enderecoFull = `${logradouro}${numero ? ', ' + numero : ''}${bairro ? ' - ' + bairro : ''}${(cidade||uf) ? ' - ' + cidade + '/' + uf : ''}`;
      setForm((prev) => ({
        ...prev,
        razao_social: razao,
        nome_fantasia: fantasia || razao,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        cep,
        endereco: enderecoFull || prev.endereco,
        codigo_municipio_ibge: codigoIBGE || '',
      }));
      try { console.info('[empresas] BuscarCNPJ:setForm', { razao, fantasia, logradouro, numero, complemento, bairro, cidade, uf, cep, codigoIBGE, enderecoFull }); } catch {}
      toast({ title: 'CNPJ carregado', description: 'Dados preenchidos automaticamente.' });
    } catch (e) {
      toast({ title: 'Falha ao buscar CNPJ', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-6">
        <SectionCard>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-text-primary">Cadastros • Empresa</h1>
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-bold text-text-primary mb-4">Dados da Empresa</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Razão Social" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Ex.: Fluxo7 Arena LTDA" />
            <Input label="Nome Fantasia" value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Ex.: Fluxo7 Arena" />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="CNPJ" type="text" inputMode="numeric" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" />
              </div>
              <Button type="button" variant="outline" onClick={handleBuscarCNPJ} disabled={loading}>Buscar CNPJ</Button>
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
            <Input label="Telefone" type="tel" inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" />
            <Input label="Endereço" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" className="md:col-span-2 lg:col-span-2" />

            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Inscrição Estadual" value={form.inscricao_estadual} onChange={(e)=>setForm({ ...form, inscricao_estadual: e.target.value })} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Regime Tributário (CRT)</span>
                <select value={form.regime_tributario} onChange={(e)=>setForm({ ...form, regime_tributario: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option value="">Selecione</option>
                  <option value="1">1 - Simples Nacional</option>
                  <option value="2">2 - Simples (excesso sublimite)</option>
                  <option value="3">3 - Regime Normal</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-muted">Ambiente</span>
                <select value={form.ambiente} onChange={(e)=>setForm({ ...form, ambiente: e.target.value })} className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm">
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </label>
            </div>

            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-3"><Input label="Logradouro" value={form.logradouro} onChange={(e)=>setForm({ ...form, logradouro: e.target.value })} /></div>
              <div className="md:col-span-1"><Input label="Número" value={form.numero} onChange={(e)=>setForm({ ...form, numero: e.target.value })} /></div>
              <div className="md:col-span-2"><Input label="Complemento" value={form.complemento} onChange={(e)=>setForm({ ...form, complemento: e.target.value })} /></div>
              <div className="md:col-span-2"><Input label="Bairro" value={form.bairro} onChange={(e)=>setForm({ ...form, bairro: e.target.value })} /></div>
              <div className="md:col-span-2"><Input label="Cidade" value={form.cidade} onChange={(e)=>setForm({ ...form, cidade: e.target.value })} /></div>
              <div className="md:col-span-1"><Input label="UF" value={form.uf} onChange={(e)=>setForm({ ...form, uf: (e.target.value || '').toUpperCase().slice(0,2) })} placeholder="UF" /></div>
              <div className="md:col-span-1"><Input label="CEP" value={form.cep} onChange={(e)=>setForm({ ...form, cep: onlyDigits(e.target.value).slice(0,8) })} placeholder="00000000" /></div>
              <div className="md:col-span-2"><Input label="Código IBGE Município (cMun)" value={form.codigo_municipio_ibge} onChange={(e)=>setForm({ ...form, codigo_municipio_ibge: onlyDigits(e.target.value).slice(0,7) })} /></div>
            </div>

            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="NFC-e Série" value={form.nfce_serie} onChange={(e)=>setForm({ ...form, nfce_serie: onlyDigits(e.target.value).slice(0,3) })} />
              <Input label="NFC-e Numeração Inicial" value={form.nfce_numeracao} onChange={(e)=>setForm({ ...form, nfce_numeracao: onlyDigits(e.target.value).slice(0,9) })} />
              <Input label="NFC-e IToken (CSC)" value={form.nfce_itoken} onChange={(e)=>setForm({ ...form, nfce_itoken: e.target.value })} />
            </div>

            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="NF-e Série (opcional)" value={form.nfe_serie} onChange={(e)=>setForm({ ...form, nfe_serie: onlyDigits(e.target.value).slice(0,3) })} />
              <Input label="NF-e Numeração (opcional)" value={form.nfe_numeracao} onChange={(e)=>setForm({ ...form, nfe_numeracao: onlyDigits(e.target.value).slice(0,9) })} />
            </div>


            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-3 p-3 rounded-md border border-border">
                <span className="text-xs text-text-muted">Transmite Nota • Homologação</span>
                <Input label="Base URL (HML)" value={form.transmitenota_base_url_hml} onChange={(e)=>setForm({ ...form, transmitenota_base_url_hml: e.target.value })} placeholder="https://..." />
                <Input label="ApiKey (HML)" value={form.transmitenota_apikey_hml} onChange={(e)=>setForm({ ...form, transmitenota_apikey_hml: e.target.value })} />
                <div>
                  <Button type="button" variant="outline" onClick={() => handleTestTN('hml')} disabled={loading}>
                    {loading ? 'Testando...' : 'Testar conexão HML'}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 p-3 rounded-md border border-border">
                <span className="text-xs text-text-muted">Transmite Nota • Produção</span>
                <Input label="Base URL (PROD)" value={form.transmitenota_base_url_prod} onChange={(e)=>setForm({ ...form, transmitenota_base_url_prod: e.target.value })} placeholder="https://..." />
                <Input label="ApiKey (PROD)" value={form.transmitenota_apikey_prod} onChange={(e)=>setForm({ ...form, transmitenota_apikey_prod: e.target.value })} />
                <div>
                  <Button type="button" variant="outline" onClick={() => handleTestTN('prod')} disabled={loading}>
                    {loading ? 'Testando...' : 'Testar conexão PROD'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 gap-3">
              <div className="flex items-center gap-4">
                {(logoPreviewUrl || form.logo_url) ? (
                  <img src={logoPreviewUrl || form.logo_url} alt="Logo da empresa" className="w-16 h-16 rounded-md object-cover border border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-md border border-dashed border-border/60 bg-surface-2/40 flex items-center justify-center text-xs text-text-muted">Sem logo</div>
                )}
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-text-muted">Upload da Logo</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="px-3">Escolher imagem</Button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                    {(logoPreviewUrl || form.logo_url) && (
                      <span className="text-xs text-text-muted truncate max-w-[260px]" title={form.logo_url || logoPreviewUrl}>Logo selecionada</span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted">Formatos: PNG/JPG. Tamanho recomendado: 256x256.</span>
                </div>
              </div>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </SectionCard>
      </motion.div>
    </>
  );
}
