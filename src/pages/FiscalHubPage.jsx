import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateNfcePayloadPreview } from '@/lib/fiscal-mapper';
import { listarTotaisPorComanda, listMesas, listarClientesPorComandas, listarFinalizadorasPorComandas } from '@/lib/store';
import { enviarNfce, consultarEmissaoNfce, cancelarNfce, getTransmiteNotaConfigFromEmpresa } from '@/lib/transmitenota';
import { Settings } from 'lucide-react';

function fmtMoney(v) { const n = Number(v||0); return n.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(iso){ if(!iso) return '—'; try{ const d=new Date(iso); return d.toLocaleString('pt-BR'); }catch{return '—';} }

// Date selector with black/yellow calendar styling (consistent with app)
function DateInput({ label, value, onChange }){
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const parseISO = (s) => { try { const [y,m,d] = String(s||'').split('-').map(Number); return y&&m&&d ? new Date(y,m-1,d) : null; } catch { return null; } };
  const formatYMD = (d) => { const p=(n)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  React.useEffect(()=>{
    const onDoc = (e)=>{ if (open && ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  },[open]);
  const selected = parseISO(value);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="h-9 px-3 rounded-full bg-surface border border-border text-sm"
        onClick={()=>setOpen(v=>!v)}>
        {value ? new Date(value+'T00:00:00').toLocaleDateString('pt-BR') : label}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 p-2 bg-black text-white border border-warning/40 rounded-md shadow-xl">
          <Calendar
            mode="single"
            selected={selected || undefined}
            onSelect={(d)=>{ if (d) { onChange(formatYMD(d)); setOpen(false); } }}
            showOutsideDays
            classNames={{
              caption_label: 'text-sm font-medium text-white',
              head_cell: 'text-xs text-warning/80 w-9',
              day: 'h-9 w-9 p-0 font-normal text-white hover:bg-warning/10 rounded-md',
              day_selected: 'bg-warning text-black hover:bg-warning focus:bg-warning',
              day_today: 'border border-warning text-white',
              day_outside: 'text-white/30',
              nav_button: 'h-7 w-7 p-0 text-white hover:bg-warning/10 rounded-md',
              table: 'w-full',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function FiscalHubPage(){
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pendente | processando | autorizada | rejeitada | cancelada
  // Default período: mês corrente (01 até último dia)
  const pad = (n) => String(n).padStart(2, '0');
  const now0 = new Date();
  const y0 = now0.getFullYear();
  const m0 = now0.getMonth() + 1; // 1-12
  const firstDayStr = `${y0}-${pad(m0)}-01`;
  const lastDayStr = `${y0}-${pad(m0)}-${pad(new Date(y0, m0, 0).getDate())}`;
  const [from, setFrom] = useState(firstDayStr);
  const [to, setTo] = useState(lastDayStr);
  const [focusPendRej, setFocusPendRej] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [modelo, setModelo] = useState('nfce');

  const [preOpen, setPreOpen] = useState(false);
  const [preLoading, setPreLoading] = useState(false);
  const [prePayload, setPrePayload] = useState(null);
  const [preMissing, setPreMissing] = useState([]);
  const [empresaMissing, setEmpresaMissing] = useState([]);

  const codigoEmpresa = userProfile?.codigo_empresa;
  const getEmpresaCodigoFromCache = () => {
    try {
      const raw = localStorage.getItem('auth:userProfile');
      return raw ? (JSON.parse(raw)?.codigo_empresa || null) : null;
    } catch { return null; }
  };

  const computeRange = () => {
    let fromISO = null;
    let toISOExclusive = null;
    if (from) fromISO = new Date(from + 'T00:00:00').toISOString();
    if (to) { const dt = new Date(to + 'T00:00:00'); dt.setDate(dt.getDate() + 1); toISOExclusive = dt.toISOString(); }
    return { fromISO, toISOExclusive };
  };

  const load = async () => {
    if (!codigoEmpresa) return;
    setLoading(true);
    try {
      // Lista sequencial: comandas FECHADAS (sem canceladas), período opcional
      let q = supabase
        .from('comandas')
        .select('*')
        .eq('codigo_empresa', codigoEmpresa)
        .not('fechado_em', 'is', null)
        .neq('status', 'cancelled')
        .order('aberto_em', { ascending: false })
        .limit(300);
      const { fromISO, toISOExclusive } = computeRange();
      if (fromISO) q = q.gte('aberto_em', fromISO);
      if (toISOExclusive) q = q.lt('aberto_em', toISOExclusive);
      const { data, error } = await q;
      if (error) throw error;

      const base = data || [];
      const ids = base.map(r => r.id);
      let totals = {};
      if (ids.length) {
        try { totals = await listarTotaisPorComanda(ids, codigoEmpresa); } catch { totals = {}; }
      }
      let mesas = [];
      try { mesas = await listMesas(codigoEmpresa); } catch { mesas = []; }
      const mapMesaNumero = new Map((mesas || []).map(m => [m.id, m.numero]));
      let namesByComanda = {};
      let finsByComanda = {};
      try { namesByComanda = await listarClientesPorComandas(ids); } catch { namesByComanda = {}; }
      try { finsByComanda = await listarFinalizadorasPorComandas(ids); } catch { finsByComanda = {}; }

      const enriched = base.map(r => ({
        ...r,
        total: Number(totals[r.id] || 0),
        mesaNumero: mapMesaNumero.get(r.mesa_id),
        clientesStr: Array.isArray(namesByComanda[r.id]) ? namesByComanda[r.id].join(', ') : (namesByComanda[r.id] || ''),
        finalizadorasStr: Array.isArray(finsByComanda[r.id]) ? finsByComanda[r.id].join(', ') : (finsByComanda[r.id] || ''),
      }));

      setRows(enriched);
    } catch (e) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [codigoEmpresa, from, to]);

  // Load minimal empresa config to show missing banner
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!codigoEmpresa) return;
      try {
        const { data } = await supabase
          .from('empresas')
          .select('cnpj, inscricao_estadual, regime_tributario, cidade, uf, codigo_municipio_ibge, nfce_serie, nfce_itoken, ambiente, transmitenota_apikey, transmitenota_base_url, transmitenota_apikey_hml, transmitenota_base_url_hml, transmitenota_apikey_prod, transmitenota_base_url_prod')
          .eq('codigo_empresa', codigoEmpresa)
          .single();
        if (ignore) return;
        const miss = [];
        const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
        if (!onlyDigits(data?.cnpj) || onlyDigits(data?.cnpj).length !== 14) miss.push('CNPJ');
        if (!data?.inscricao_estadual) miss.push('Inscrição Estadual');
        if (!data?.regime_tributario) miss.push('CRT');
        if (!data?.cidade || !data?.uf) miss.push('Cidade/UF');
        if (!data?.codigo_municipio_ibge) miss.push('cMun IBGE');
        if (!data?.nfce_serie) miss.push('Série NFC-e');
        const amb = String(data?.ambiente || 'homologacao');
        if (amb === 'producao' && !data?.nfce_itoken) miss.push('CSC/IToken');
        // Verificação por ambiente para Transmite Nota
        const needProd = amb === 'producao';
        const apiOk = needProd ? !!data?.transmitenota_apikey_prod || !!data?.transmitenota_apikey : !!data?.transmitenota_apikey_hml || !!data?.transmitenota_apikey;
        const urlOk = needProd ? !!data?.transmitenota_base_url_prod || !!data?.transmitenota_base_url : !!data?.transmitenota_base_url_hml || !!data?.transmitenota_base_url;
        if (!apiOk) miss.push(needProd ? 'ApiKey (PROD)' : 'ApiKey (HML)');
        if (!urlOk) miss.push(needProd ? 'Base URL (PROD)' : 'Base URL (HML)');
        setEmpresaMissing(miss);
      } catch {}
    }
    run();
    return () => { ignore = true; };
  }, [codigoEmpresa]);

  // Polling auto-refresh a cada 20s
  useEffect(() => {
    if (!codigoEmpresa) return;
    const id = setInterval(() => {
      load();
    }, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoEmpresa, from, to]);

  const filtered = useMemo(() => {
    const t = (search||'').trim().toLowerCase();
    const statusOk = (r) => {
      const s = r.nf_status || 'pendente';
      if (focusPendRej) return (s === 'pendente' || s === 'rejeitada');
      if (statusFilter === 'all') return true;
      return s === statusFilter;
    };
    return (rows||[]).filter(r => statusOk(r)).filter(r => {
      if (!t) return true;
      return (r.xml_chave||'').toLowerCase().includes(t) || String(r.nf_numero||'').includes(t);
    });
  }, [rows, search, statusFilter, focusPendRej]);

  const statusBadge = (s) => {
    const v = (s || 'pendente').toLowerCase();
    const map = {
      pendente: 'bg-amber-500/15 text-amber-400 border border-amber-400/30',
      processando: 'bg-blue-500/15 text-blue-400 border border-blue-400/30',
      autorizada: 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/30',
      rejeitada: 'bg-red-500/15 text-red-400 border border-red-400/30',
      cancelada: 'bg-gray-500/15 text-gray-400 border border-gray-400/30',
    };
    return map[v] || map.pendente;
  };

  const openPreview = async (comandaId) => {
    try {
      setPreLoading(true);
      const emp = codigoEmpresa || getEmpresaCodigoFromCache();
      const { payload, missing } = await generateNfcePayloadPreview({ comandaId, codigoEmpresa: emp });
      setPrePayload(payload);
      setPreMissing(missing || []);
      setPreOpen(true);
    } catch (e) {
      toast({ title: 'Falha ao gerar prévia', description: e.message, variant: 'destructive' });
    } finally {
      setPreLoading(false);
    }
  };

  const updateComanda = async (id, patch) => {
    await supabase.from('comandas').update(patch).eq('id', id).eq('codigo_empresa', codigoEmpresa);
  };

  const handleEmit = async (id) => {
    try {
      setLoading(true);
      const { empresa, payload, missing } = await generateNfcePayloadPreview({ comandaId: id, codigoEmpresa });
      if (missing && missing.length) {
        toast({ title: 'Pendências para emissão', description: missing.join(', '), variant: 'destructive' });
        return;
      }
      const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
      if (!cfg.cnpj || cfg.cnpj.length !== 14) {
        toast({ title: 'CNPJ inválido', description: 'CNPJ da empresa está ausente ou inválido (14 dígitos).', variant: 'destructive' });
        return;
      }
      if (!cfg.apiKey || !cfg.baseUrl) {
        toast({ title: 'Configuração fiscal incompleta', description: 'Preencha Base URL e ApiKey do ambiente atual nas Configurações.', variant: 'destructive' });
        return;
      }
      await updateComanda(id, { nf_status: 'processando' });
      let resp;
      try {
        resp = await enviarNfce({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, cnpj: cfg.cnpj, dados: payload.Dados });
      } catch (err) {
        await updateComanda(id, { nf_status: 'rejeitada' });
        throw err;
      }
      const chave = resp?.chave || resp?.Chave || resp?.chaveAcesso || null;
      const numero = resp?.numero || resp?.Numero || null;
      const serie = resp?.serie || resp?.Serie || null;
      const pdf = resp?.pdf_url || resp?.PdfUrl || null;
      const xml = resp?.xml_url || resp?.XmlUrl || null;
      const protocolo = resp?.protocolo || resp?.Protocolo || null;
      const authorized = !!(resp?.autorizada || resp?.Autorizada || resp?.sucesso || resp?.Sucesso || chave);
      await updateComanda(id, { nf_status: authorized ? 'autorizada' : 'processando', xml_chave: chave, nf_numero: numero, nf_serie: serie, nf_pdf_url: pdf, nf_xml_url: xml, xml_protocolo: protocolo });
      toast({ title: authorized ? 'NFC-e autorizada' : 'Emissão enviada', description: authorized ? 'Documento autorizado.' : 'Aguardando autorização.' });
      await load();
    } catch (e) {
      toast({ title: 'Falha ao emitir', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleConsult = async (id) => {
    try {
      setLoading(true);
      const row = rows.find(r => r.id === id);
      if (!row) return;
      const { empresa } = await generateNfcePayloadPreview({ comandaId: id, codigoEmpresa });
      const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
      const dados = row.xml_chave ? { chave: row.xml_chave } : { numero: row.nf_numero, serie: row.nf_serie };
      const resp = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, cnpj: cfg.cnpj, dados });
      const status = resp?.status || resp?.Status || (resp?.autorizada ? 'autorizada' : row.nf_status);
      const pdf = resp?.pdf_url || resp?.PdfUrl || row.nf_pdf_url;
      const xml = resp?.xml_url || resp?.XmlUrl || row.nf_xml_url;
      const chave = resp?.chave || resp?.Chave || row.xml_chave;
      const numero = resp?.numero || resp?.Numero || row.nf_numero;
      const serie = resp?.serie || resp?.Serie || row.nf_serie;
      await updateComanda(id, { nf_status: status, nf_pdf_url: pdf, nf_xml_url: xml, xml_chave: chave, nf_numero: numero, nf_serie: serie });
      toast({ title: 'Consulta concluída' });
      await load();
    } catch (e) { toast({ title: 'Falha ao consultar', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleCancel = async (id) => {
    try {
      const motivo = window.prompt('Informe o motivo do cancelamento:');
      if (!motivo) return;
      setLoading(true);
      const { empresa } = await generateNfcePayloadPreview({ comandaId: id, codigoEmpresa });
      const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
      const row = rows.find(r => r.id === id);
      const dados = row.xml_chave ? { chave: row.xml_chave, motivo } : { numero: row.nf_numero, serie: row.nf_serie, motivo };
      await cancelarNfce({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, cnpj: cfg.cnpj, dados });
      await updateComanda(id, { nf_status: 'cancelada' });
      toast({ title: 'NFC-e cancelada' });
      await load();
    } catch (e) { toast({ title: 'Falha ao cancelar', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-4">
      <Helmet><title>Central Fiscal</title></Helmet>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Central Fiscal</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate('/configuracao-fiscal')}
            title="Configuração Fiscal"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Label className="text-sm">Buscar</Label>
          <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Chave, número..." className="w-60" />
        </div>
      </div>

      {empresaMissing.length > 0 && (
        <div className="mb-4 p-3 rounded-md border border-warning/40 bg-warning/10 text-warning">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">Pendências fiscais da empresa</p>
              <p className="text-xs">Preencha: {empresaMissing.join(', ')}.</p>
            </div>
            <Button size="sm" className="bg-warning text-black hover:bg-warning/90" onClick={()=>navigate('/configuracao-fiscal')}>
              Corrigir agora
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Label className="text-sm">Status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px] rounded-full">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Em andamento</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-sm ml-2">Modelo</Label>
        <Select value={modelo} onValueChange={setModelo}>
          <SelectTrigger className="w-[140px] rounded-full">
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="nfce">NFC-e</SelectItem>
            <SelectItem value="nfe" disabled>NF-e</SelectItem>
            <SelectItem value="nfse" disabled>NFS-e</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-sm ml-2">Período</Label>
        <div className="inline-flex items-center gap-2">
          <DateInput label="Período inicial" value={from} onChange={setFrom} />
          <span className="text-text-secondary">até</span>
          <DateInput label="Período final" value={to} onChange={setTo} />
        </div>
        <div className="inline-flex items-center gap-2 ml-2 text-sm">
          <Checkbox checked={focusPendRej} onCheckedChange={setFocusPendRej} className="rounded-full border-warning data-[state=checked]:bg-warning" />
          <span>Somente pendentes/rejeitadas</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" variant="outline" disabled={!selectedId} onClick={() => (async () => {
          // Visualizar PDF/DANFE
          const row = rows.find(r => r.id === selectedId);
          if (!row) return;
          if (row.nf_pdf_url) { window.open(row.nf_pdf_url, '_blank'); return; }
          try {
            setLoading(true);
            const { empresa } = await generateNfcePayloadPreview({ comandaId: row.id, codigoEmpresa });
            const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
            const dados = row.xml_chave ? { chave: row.xml_chave } : { numero: row.nf_numero, serie: row.nf_serie };
            const resp = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, cnpj: cfg.cnpj, dados });
            const pdf = resp?.pdf_url || resp?.PdfUrl;
            if (pdf) { await supabase.from('comandas').update({ nf_pdf_url: pdf }).eq('id', row.id).eq('codigo_empresa', codigoEmpresa); window.open(pdf, '_blank'); }
            else { toast({ title: 'Sem PDF disponível', description: 'Documento ainda não possui DANFE.', variant: 'destructive' }); }
            await load();
          } catch (e) { toast({ title: 'Falha ao visualizar', description: e.message, variant: 'destructive' }); }
          finally { setLoading(false); }
        })()}>Visualizar</Button>
        <Button size="sm" disabled={!selectedId || !(['pendente','rejeitada'].includes((rows.find(r=>r.id===selectedId)?.nf_status)||'pendente'))} onClick={() => handleEmit(selectedId)}>Emitir</Button>
        <Button size="sm" variant="outline" disabled={!selectedId || (rows.find(r=>r.id===selectedId)?.nf_status)!=='processando'} onClick={() => handleConsult(selectedId)}>Consultar</Button>
        <Button size="sm" variant="destructive" disabled={!selectedId || (rows.find(r=>r.id===selectedId)?.nf_status)!=='autorizada'} onClick={() => handleCancel(selectedId)}>Cancelar</Button>
      </div>

      <div className="bg-surface rounded border border-border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-text-secondary">
            <tr>
              <th className="text-left px-3 py-2">Abertura</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Chave</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(!filtered || filtered.length===0) && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-text-muted">{loading ? 'Carregando...' : 'Nada por aqui'}</td></tr>
            )}
            {filtered.map(r => {
              const s = r.nf_status || 'pendente';
              return (
                <tr key={r.id} className={`border-t border-border/60 transition-colors ${selectedId===r.id ? 'bg-surface-2 ring-2 ring-[#FF7A1A]/60 rounded-md' : 'hover:bg-surface-2/50'}`} onClick={() => setSelectedId(r.id)}>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.aberto_em)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusBadge(s)}`}>{s}</span>
                  </td>
                  <td className="px-3 py-2 break-all max-w-[380px]">{r.xml_chave || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">R$ {fmtMoney(r.total || r.total_com_desconto)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap flex gap-2 justify-end">
                    {(s==='pendente' || s==='rejeitada') && (
                      <>
                        <Button size="sm" variant="outline" onClick={()=>openPreview(r.id)}>Pré-Emissão</Button>
                        <Button size="sm" onClick={()=>handleEmit(r.id)}>Emitir</Button>
                      </>
                    )}
                    {s==='processando' && (
                      <Button size="sm" variant="outline" onClick={()=>handleConsult(r.id)}>Consultar</Button>
                    )}
                    {s==='autorizada' && (
                      <Button size="sm" variant="destructive" onClick={()=>handleCancel(r.id)}>Cancelar</Button>
                    )}
                    {r.nf_pdf_url && (
                      <a className="inline-flex" href={r.nf_pdf_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">DANFE</Button>
                      </a>
                    )}
                    {r.nf_xml_url && (
                      <a className="inline-flex" href={r.nf_xml_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">XML</Button>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={preOpen} onOpenChange={setPreOpen}>
        <DialogContent className="max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Pré-Emissão NFC-e</DialogTitle>
            <DialogDescription>Revise os dados e pendências antes de emitir.</DialogDescription>
          </DialogHeader>
          {preLoading ? (
            <div className="p-4 text-center text-text-muted">Gerando prévia…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-border rounded p-2 bg-surface-2">
                <div className="text-xs text-text-secondary mb-1">JSON (EnviarNfce)</div>
                <pre className="text-[11px] whitespace-pre-wrap break-all max-h-[360px] overflow-auto">{prePayload ? JSON.stringify(prePayload, null, 2) : '—'}</pre>
              </div>
              <div className="border border-border rounded p-2 bg-surface-2">
                <div className="text-xs text-text-secondary mb-1">Pendências</div>
                {(!preMissing || preMissing.length===0) ? (
                  <div className="text-sm text-emerald-500">Nenhuma pendência encontrada.</div>
                ) : (
                  <ul className="list-disc pl-5 text-sm">
                    {preMissing.map((m,i)=> (<li key={i}>{m}</li>))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={()=>setPreOpen(false)}>Fechar</Button>
            <Button disabled>Emitir (desabilitado)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
