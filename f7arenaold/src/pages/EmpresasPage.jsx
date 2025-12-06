import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
        };
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
      };
      
      // 🔧 Contornar trigger de updated_at: usar UPSERT ao invés de UPDATE
      // UPSERT não ativa o mesmo trigger que UPDATE
      const { error } = await supabase
        .from('empresas')
        .upsert(
          {
            codigo_empresa: userProfile.codigo_empresa,
            ...payload,
          },
          { onConflict: 'codigo_empresa' }
        )
        .select('id')
        .single();
      
      if (error) throw error;
      
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
            <Input label="CNPJ" type="text" inputMode="numeric" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
            <Input label="Telefone" type="tel" inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" />
            <Input label="Endereço" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" className="md:col-span-2 lg:col-span-2" />

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
