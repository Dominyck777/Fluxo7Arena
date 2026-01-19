import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateNfcePayloadPreview, generateNfcePayloadFromManual, generateNfePayloadFromManual } from '@/lib/fiscal-mapper';
import { listarTotaisPorComanda, listMesas, listarClientesPorComandas, listarFinalizadorasPorComandas, listarItensDaComanda, listarClientes, listarFinalizadoras } from '@/lib/store';
import { enviarNfce, consultarEmissaoNfce, cancelarNfce, consultarPdfNfce, consultarXmlNfce, getTransmiteNotaConfigFromEmpresa, enviarNfe, consultarEmissaoNfe, cancelarNfe, consultarPdfNfe, consultarXmlNfe } from '@/lib/transmitenota';
import { Settings, Search, Trash2, X, FileText, CheckCircle2, AlertTriangle, Copy, Download, Pencil, Loader2, Filter } from 'lucide-react';
import { gerarXMLNFe, gerarXMLNFeFromData } from '@/lib/nfe';
import { listProducts } from '@/lib/products';
import cfopList from '@/data/cfop.json';
import { listSuppliers } from '@/lib/suppliers';
import ComprasPage from '@/pages/ComprasPage';

function fmtMoney(v) { const n = Number(v||0); return n.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(iso){ if(!iso) return '—'; try{ const d=new Date(iso); return d.toLocaleString('pt-BR'); }catch{return '—';} }
function fmtDoc(doc){ const d=String(doc||'').replace(/\D/g,''); if(d.length===11){ return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); } if(d.length===14){ return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'); } return doc||''; }
const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

// Date selector with black/yellow calendar styling (uses Portal to avoid clipping)
function DateInput({ label, value, onChange }){
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);
  const btnRef = React.useRef(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const parseISO = (s) => { try { const [y,m,d] = String(s||'').split('-').map(Number); return y&&m&&d ? new Date(y,m-1,d) : null; } catch { return null; } };
  const formatYMD = (d) => { const p=(n)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const updatePos = React.useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 280; // largura um pouco menor para caber melhor no mobile
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = Math.min(r.bottom + 6, window.innerHeight - 8 - 260); // altura um pouco menor
    setPos({ top, left });
  }, []);

  React.useEffect(()=>{
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
  },[open, updatePos]);
  const selected = parseISO(value);
  return (
    <>
      <div className="relative" ref={wrapRef}>
        <button ref={btnRef} type="button" className="h-7 px-2 rounded-md bg-surface border border-border text-xs"
          onClick={()=>setOpen(v=>!v)}>
          {value ? new Date(value+'T00:00:00').toLocaleDateString('pt-BR') : label}
        </button>
      </div>
      {open && ReactDOM.createPortal(
        <div className="fixed z-[1000] p-2 bg-black text-white border border-warning/40 rounded-md shadow-xl" style={{ top: pos.top, left: pos.left, width: 280 }}>
          <Calendar
            mode="single"
            selected={selected || undefined}
            onSelect={(d)=>{ if (d) { onChange(formatYMD(d)); setOpen(false); } }}
            showOutsideDays
            classNames={{
              caption_label: 'text-[11px] font-medium text-white',
              head_cell: 'text-[10px] text-warning/80 w-7',
              day: 'h-7 w-7 p-0 font-normal text-white hover:bg-warning/10 rounded-md',
              day_selected: 'bg-warning text-black hover:bg-warning focus:bg-warning',
              day_today: 'border border-warning text-white',
              day_outside: 'text-white/30',
              nav_button: 'h-7 w-7 p-0 text-white hover:bg-warning/10 rounded-md',
              table: 'w-full',
            }}
          />
        </div>, document.body)}
    </>
  );
}

export default function FiscalHubPage(){
  const { userProfile } = useAuth();
  const codigoEmpresa = userProfile?.codigo_empresa;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nfeRows, setNfeRows] = useState([]);
  const [nfeLoading, setNfeLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  const [tab, setTab] = useState('nfce');
  const role = (userProfile && (userProfile.cargo || userProfile.papel)) || 'user';
  const canEmit = true; // DEV: liberar ações
  const canConsult = true; // DEV: liberar ações
  const canCancel = true; // DEV: liberar ações
  const [sortBy, setSortBy] = useState('aberto_em');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState([]);
  const isSelected = (id) => selectedIds.includes(id);
  const toggleRow = (id, checked) => {
    setSelectedIds(prev => (checked ? Array.from(new Set([...(prev||[]), id])) : (prev||[]).filter(x => x !== id)));
    setSelectedId(prevSel => (checked ? id : (prevSel === id ? null : prevSel)));
  };

  const exportNfeCsv = (scope = 'filtered') => {
    const delimiter = ';';
    const escapeCell = (v) => {
      let s = String(v ?? '');
      s = s.replaceAll('"','""');
      s = s.replaceAll(';','|');
      return `"${s}"`;
    };
    const headers = ['Numero','Serie','Status','Destinatario','Origem','Chave','DataEmissao','ValorTotal'];
    const lines = [headers.join(delimiter)];

    let base = [];
    if (scope === 'selected') {
      const set = new Set(selectedIds);
      if (selectedId) set.add(selectedId);
      // Apenas notas atualmente consideradas na visão NF-e (nfeSorted), filtradas e ordenadas
      base = (nfeSorted || []).filter(r => set.has(r.id));
    } else {
      // 'filtered' deve refletir exatamente o que está na tela (nfeSorted = filtradas + ordenadas)
      base = nfeSorted || [];
    }

    base.forEach(r => {
      const status = (r.status || 'pendente');
      const destNome = r.destinatario?.nome || '';
      const origemDesc = r.origem === 'comanda'
        ? `Comanda ${r.comanda_id ?? ''}`
        : (r.origem || 'manual');
      const dataRef = r.data_emissao || r.criado_em || r.created_at || '';
      const row = [
        r.numero ?? '',
        r.serie ?? '',
        status,
        destNome,
        origemDesc,
        r.xml_chave ?? '',
        dataRef,
        String(r.valor_total ?? ''),
      ];
      lines.push(row.map(escapeCell).join(delimiter));
    });

    const blob = new Blob(["\uFEFF" + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nfe-${scope}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const handleEditSelectedNfeDraft = async () => {
    try {
      const all = nfeRows || [];
      const pickId = selectedId || (selectedIds && selectedIds[0]);
      if (!pickId) { toast({ title: 'Nenhuma NF-e selecionada', variant: 'warning' }); return; }
      const row = all.find(r => r.id === pickId);
      if (!row) { toast({ title: 'NF-e não encontrada na lista', variant: 'warning' }); return; }
      const s = String(row.status || 'rascunho').toLowerCase();
      if (s !== 'rascunho') { toast({ title: 'Não é rascunho', description: 'Selecione uma NF-e com status rascunho para editar.', variant: 'warning' }); return; }
      await handleEditDraft(row);
    } catch (e) {
      toast({ title: 'Falha ao abrir rascunho', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleConsultRow = async (r) => {
    try {
      if (!empresaInfo) { toast({ title: 'Empresa não carregada', variant: 'warning' }); return; }
      const { baseUrl, cnpj } = getTransmiteNotaConfigFromEmpresa(empresaInfo);
      if (!cnpj) { toast({ title: 'CNPJ ausente', description: 'Preencha o CNPJ na Configuração Fiscal', variant: 'warning' }); return; }
      const chave = r.xml_chave || '';
      let dados;
      if (chave) dados = { chave_nota: chave, chave };
      else if (r.numero && r.serie) dados = { numero: r.numero, serie: r.serie };
      else { toast({ title: 'Sem referência para consultar', description: 'Preencha número/série ou emita para obter a chave', variant: 'warning' }); return; }
      toast({ title: 'Consultando status...', description: `NF-e ${r.numero || '—'}/${r.serie || '—'}` });
      let res = null;
      let st = '';
      let msg = '';
      let autorizada = false;
      let xmlUrl = r.xml_url || null;
      let pdfUrl = r.pdf_url || null;
      let chaveResp = r.xml_chave || null;
      let numeroResp = r.numero || null;
      let serieResp = r.serie || null;
      try {
        res = await consultarEmissaoNfe({ baseUrl, cnpj, dados });
        st = String(res?.status || res?.cStat || '');
        msg = res?.xMotivo || res?.mensagem || res?.message || 'Retorno da consulta';
        autorizada = (st === '100' || /autorizad/i.test(msg));
        xmlUrl = res?.url_xml || res?.xml_url || xmlUrl;
        pdfUrl = res?.url_pdf || res?.pdf_url || pdfUrl;
        chaveResp = res?.chave_nota || res?.chave || res?.Chave || chaveResp;
        numeroResp = res?.numero || res?.Numero || numeroResp;
        serieResp = res?.serie || res?.Serie || serieResp;
      } catch (e) {
        msg = e?.message || String(e);
      }
      // Fallback: tentar PDF/XML quando consulta não autoriza ou não retorna URLs
      if (!autorizada || (!pdfUrl && !xmlUrl)) {
        try {
          const rpdf = await consultarPdfNfe({ baseUrl, cnpj, dados: dados });
          pdfUrl = rpdf?.url_pdf || rpdf?.pdf_url || pdfUrl;
          chaveResp = rpdf?.chave || rpdf?.Chave || chaveResp;
        } catch {}
        try {
          const rxml = await consultarXmlNfe({ baseUrl, cnpj, dados: dados });
          xmlUrl = rxml?.url_xml || rxml?.xml_url || xmlUrl;
          chaveResp = chaveResp || rxml?.chave || rxml?.Chave || chaveResp;
        } catch {}
        if (pdfUrl || xmlUrl) autorizada = true;
      }
      const newStatus = autorizada ? 'autorizada' : (/rejeit/i.test(msg) ? 'rejeitada' : (st || r.status || 'pendente'));
      await supabase.from('notas_fiscais').update({ status: newStatus, xml_url: xmlUrl, pdf_url: pdfUrl, xml_chave: chaveResp, numero: numeroResp, serie: serieResp }).eq('id', r.id).eq('codigo_empresa', codigoEmpresa);
      await loadNfeRows();
      toast({ title: autorizada ? 'Autorizada' : `Status ${st || ''}`.trim(), description: msg || 'Consulta concluída', variant: autorizada ? 'success' : 'default' });
    } catch (e) {
      toast({ title: 'Falha ao consultar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleCancelNfeRow = async (r) => {
    try {
      if (!r) return;
      const motivo = (cancelNfeMotivo || '').trim();
      if (!motivo) { toast({ title: 'Informe o motivo do cancelamento', variant: 'warning' }); return; }
      if (!empresaInfo) { toast({ title: 'Empresa não carregada', variant: 'warning' }); return; }
      const { baseUrl, cnpj } = getTransmiteNotaConfigFromEmpresa(empresaInfo);
      if (!cnpj) { toast({ title: 'CNPJ ausente', description: 'Preencha o CNPJ na Configuração Fiscal', variant: 'warning' }); return; }
      const dados = r.xml_chave ? { chave_nota: r.xml_chave, chave: r.xml_chave, motivo } : { numero: r.numero, serie: r.serie, motivo };
      await cancelarNfe({ baseUrl, cnpj, dados });
      await supabase.from('notas_fiscais').update({ status: 'cancelada' }).eq('id', r.id).eq('codigo_empresa', codigoEmpresa);
      await loadNfeRows();
      toast({ title: 'NF-e cancelada' });
      setCancelNfeRow(null);
      setCancelNfeMotivo('');
    } catch (e) {
      toast({ title: 'Falha ao cancelar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleConsultSelectedNfe = async () => {
    try {
      const all = nfeRows || [];
      const pickId = selectedId || (selectedIds && selectedIds[0]);
      if (!pickId) { toast({ title: 'Nenhuma NF-e selecionada', variant: 'warning' }); return; }
      const row = all.find(r => r.id === pickId);
      if (!row) { toast({ title: 'NF-e não encontrada na lista', variant: 'warning' }); return; }
      await handleConsultRow(row);
    } catch (e) {
      toast({ title: 'Falha ao consultar NF-e', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleCancelSelectedNfe = async () => {
    try {
      const all = nfeRows || [];
      const pickId = selectedId || (selectedIds && selectedIds[0]);
      if (!pickId) { toast({ title: 'Nenhuma NF-e selecionada', variant: 'warning' }); return; }
      const row = all.find(r => r.id === pickId);
      if (!row) { toast({ title: 'NF-e não encontrada na lista', variant: 'warning' }); return; }
      setCancelNfeRow(row);
      setCancelNfeMotivo('');
    } catch (e) {
      toast({ title: 'Falha ao cancelar NF-e', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleEmitSelectedNfe = async () => {
    try {
      const all = nfeRows || [];
      const pickId = selectedId || (selectedIds && selectedIds[0]);
      if (!pickId) { toast({ title: 'Nenhuma NF-e selecionada', variant: 'warning' }); return; }
      const row = all.find(r => r.id === pickId);
      if (!row) { toast({ title: 'NF-e não encontrada na lista', variant: 'warning' }); return; }
      const form = row?.draft_data;
      if (!form || !Array.isArray(form.itens) || form.itens.length === 0) {
        setCurrentDraftId(row.id);
        if (row.draft_data) {
          setManualForm(row.draft_data);
        }
        setManualOpen(true);
        toast({ title: 'Rascunho incompleto', description: 'Abra o rascunho para revisar e emitir.', variant: 'warning' });
        return;
      }
      setManualEmitting(true);
      try {
        await emitirNota(form, row.id);
      } finally {
        setManualEmitting(false);
      }
    } catch (e) {
      toast({ title: 'Falha ao emitir NF-e', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleEditDraft = async (row) => {
    try {
      if (!row || !row.id) return;
      setCurrentDraftId(row.id);
      setManualTab('cliente');
      if (row.draft_data) {
        setManualForm(row.draft_data);
        setManualOpen(true);
        return;
      }
      if (row.origem === 'comanda' && row.comanda_id) {
        try { await openManualFromComanda(row.comanda_id); } catch {}
      }
      setManualOpen(true);
    } catch {}
  };

  const saveDraft = async () => {
    if (!currentDraftId || !codigoEmpresa) { toast({ title: 'Rascunho não iniciado', variant: 'warning' }); return; }
    try {
      setManualSaving(true);
      const itens = (manualForm.itens||[]).map(x=>{
        const pu = parseDec(x.preco_unitario)||0; const q = parseDec(x.quantidade)||1; const bruto = pu*q;
        const descP = parseDec(x.desconto_percent)||0; const descV = parseDec(x.desconto_valor)||0; const acres = parseDec(x.acrescimos_valor)||0;
        const desconto = descP ? (bruto*descP/100) : descV; const totalItem = bruto - desconto + acres; return { preco_total: totalItem };
      });
      const totalItens = itens.reduce((s,i)=> s + (Number(i.preco_total)||0), 0);
      const total = totalItens - (parseDec(manualForm.totais?.desconto_geral)||0) + (parseDec(manualForm.totais?.frete)||0) + (parseDec(manualForm.totais?.outras_despesas)||0);
      const dest = {
        tipo_pessoa: manualForm.tipo_pessoa,
        cpf_cnpj: manualForm.cpf_cnpj,
        nome: manualForm.nome,
        email: manualForm.email,
        telefone: manualForm.telefone,
        inscricao_estadual: manualForm.ie_isento ? 'ISENTO' : manualForm.inscricao_estadual,
        logradouro: manualForm.logradouro,
        numero: manualForm.numero,
        bairro: manualForm.bairro,
        cidade: manualForm.cidade,
        uf: manualForm.uf,
        cep: manualForm.cep,
        codigo_municipio_ibge: manualForm.codigo_municipio_ibge,
      };
      await supabase
        .from('notas_fiscais')
        .update({
          draft_data: manualForm,
          valor_total: Number.isFinite(total) ? total : null,
          destinatario: dest,
          numero: manualForm.nNF ? Number(manualForm.nNF) : null,
          serie: manualForm.serie ? Number(manualForm.serie) : null,
        })
        .eq('id', currentDraftId)
        .eq('codigo_empresa', codigoEmpresa);
      await loadNfeRows();
      toast({ title: 'Rascunho salvo' });
      setManualOpen(false);
    } catch (e) { toast({ title: 'Falha ao salvar rascunho', description: e?.message || String(e), variant: 'destructive' }); }
    finally { setManualSaving(false); }
  };

  const createDraftFromComanda = async (comandaId) => {
    if (!comandaId || !codigoEmpresa) return null;
    try {
      const row = (rows||[]).find(r => r.id === comandaId);
      const total = Number(row?.total || row?.total_com_desconto || 0) || 0;
      const { ambiente: amb } = getTransmiteNotaConfigFromEmpresa(empresaInfo || {});
      const { data, error } = await supabase.from('notas_fiscais').insert({
        codigo_empresa: codigoEmpresa,
        origem: 'comanda',
        comanda_id: comandaId,
        modelo: '55',
        numero: null,
        serie: null,
        status: 'rascunho',
        xml_url: null,
        pdf_url: null,
        valor_total: total,
        destinatario: null,
        ambiente: amb || 'homologacao',
      }).select('id').single();
      if (error) throw error;
      await loadNfeRows();
      const id = data?.id || null;
      if (id) setCurrentDraftId(id);
      return id;
    } catch (e) {
      toast({ title: 'Falha ao criar rascunho', description: e?.message || String(e), variant: 'destructive' });
      return null;
    }
  };

  const createManualDraft = async () => {
    if (!codigoEmpresa) return null;
    try {
      const { ambiente: amb } = getTransmiteNotaConfigFromEmpresa(empresaInfo || {});
      const { data, error } = await supabase.from('notas_fiscais').insert({
        codigo_empresa: codigoEmpresa,
        origem: 'manual',
        comanda_id: null,
        modelo: '55',
        numero: null,
        serie: null,
        status: 'rascunho',
        xml_url: null,
        pdf_url: null,
        valor_total: null,
        destinatario: null,
        ambiente: amb || 'homologacao',
      }).select('id').single();
      if (error) throw error;
      await loadNfeRows();
      const id = data?.id || null;
      if (id) setCurrentDraftId(id);
      // Resetar formulário manual para um rascunho novo em branco
      setManualForm({
        natOp: 'VENDA', serie: '1', nNF: '', indFinal: '1', indPres: '1', idDest: '1',
        modelo: '55',
        finNFe: '1',
        data_emissao: todayStr,
        data_saida: todayStr,
        tipo_nota: 'saida',
        baixar_estoque: true,
        destacar_st: false,
        cfop_padrao: '5102',
        indIntermed: '0',
        intermediador_cnpj: '',
        intermediador_id: '',
        parte_tipo: 'cliente',
        party_id: '',
        party_codigo: '',
        tipo_pessoa: 'PJ', cpf_cnpj: '', nome: '', email: '', telefone: '',
        inscricao_estadual: '', ie_isento: false,
        indIEDest: '9',
        logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', codigo_municipio_ibge: '',
        itens: [ {
          descricao: '', codigo: '', cod_barras: '', ncm: '', cest: '', cfop: '5102', unidade: 'UN',
          quantidade: '1', preco_unitario: '0.00', desconto_valor: '0.00', desconto_percent: '', acrescimos_valor: '0.00', frete_valor: '0.00', seguro_valor: '0.00', obs: '',
          dest_icms: false, dest_icms_info: false, benef_fiscal: false,
          impostos: {
            origem: '',
            icms: { cst: '', csosn: '', base: '', aliquota: '', valor: '', desonerado_valor:'', desoneracao_motivo:'', operacao_valor:'', aliq_diferimento:'', valor_diferido:'', reducao_percent:'', reducao_motivo:'', ad_rem:'', ad_rem_retencao:'', monofasico_bc:'', monofasico_valor:'', mono_retencao_bc:'', mono_retencao_valor:'', mono_cobrado_ant_bc:'', mono_cobrado_ant_valor:'', proprio_devido_valor:'' },
            icmsst: { base: '', aliquota: '', valor: '' },
            fcp: { base:'', aliquota:'', valor:'' },
            fcpst: { base:'', aliquota:'', valor:'' },
            pis: { cst: '', aliquota: '', valor: '' },
            cofins: { cst: '', aliquota: '', valor: '' },
            ipi: { cst: '', aliquota: '', valor: '', tipo_calculo: 'nenhum', valor_unit: '' },
            combustivel: { uf:'', perc_origem_uf:'', indicador_importacao:'' },
            cide: { base:'', aliq:'', valor:'' },
            iss: { aliquota: '', valor: '' },
          },
        } ],
        totais: { desconto_geral: '0.00', frete: '0.00', outras_despesas: '0.00' },
        pagamentos: [ { tipo: 'Dinheiro', bandeira: '', cnpj_credenciadora: '', autorizacao: '', valor: '', parcelas: '', troco: '' } ],
        transporte: { tipo_frete: '9', transportadora: '', placa: '', volumes: '', peso_liquido: '', peso_bruto: '' },
        adicionais: { obs_gerais: '', info_fisco: '', info_cliente: '', referencia_doc: '' },
      });
      setManualXml('');
      setManualOpen(true);
      return id;
    } catch (e) {
      toast({ title: 'Falha ao criar rascunho manual', description: e?.message || String(e), variant: 'destructive' });
      return null;
    }
  };
  const [openDetails, setOpenDetails] = useState([]);
  const isOpenDetails = (id) => openDetails.includes(id);
  const toggleDetails = (id) => setOpenDetails(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Maintenance overlay (specific for Central Fiscal)
  const [maintActive, setMaintActive] = useState(false);
  const [maintBypass, setMaintBypass] = useState(false);
  useEffect(() => {
    try {
      const env = String(import.meta.env.VITE_MAINTENANCE_MODE || '').toLowerCase() === 'true';
      const isActiveLS = localStorage.getItem('maintenance:active') === 'true';
      const end = localStorage.getItem('maintenance:end');
      const expired = end ? (new Date() > new Date(end)) : false;
      const activeNow = (false || env || isActiveLS) && !expired;
      const bypass = (() => {
        try {
          const ls = localStorage.getItem('maintenance:bypass') === '1';
          const ss = sessionStorage.getItem('maintenance:bypass') === '1';
          const ck = document.cookie.split(';').some(c => c.trim() === 'fx_maint_bypass=1');
          return ls || ss || ck;
        } catch { return false; }
      })();
      setMaintActive(false);
      setMaintBypass(true);
    } catch {
      setMaintActive(false);
      setMaintBypass(true);
    }
  }, []);

  const [preOpen, setPreOpen] = useState(false);
  const [preLoading, setPreLoading] = useState(false);
  const [prePayload, setPrePayload] = useState(null);
  const [preMissing, setPreMissing] = useState([]);
  const [preShowPayload, setPreShowPayload] = useState(false);
  const [preComandaId, setPreComandaId] = useState(null);
  const [preEmpresaCfgOk, setPreEmpresaCfgOk] = useState(false);
  const [preEligible, setPreEligible] = useState(false);
  const [preMissingCache, setPreMissingCache] = useState({});
  const [empresaMissing, setEmpresaMissing] = useState([]);

  const [nfeOpen, setNfeOpen] = useState(false);
  const [nfeGenerating, setNfeGenerating] = useState(false);
  const [nfeXml, setNfeXml] = useState('');
  const [nfeComandaId, setNfeComandaId] = useState(null);
  const [nfeForm, setNfeForm] = useState({ natOp: 'VENDA', serie: '1', nNF: '', indFinal: '1', indPres: '1', idDest: '' });
  const [nfeSaving, setNfeSaving] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualXml, setManualXml] = useState('');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const [manualForm, setManualForm] = useState({
    natOp: 'VENDA', serie: '1', nNF: '', indFinal: '1', indPres: '1', idDest: '1',
    modelo: '55',
    finNFe: '1', // 1-Normal, 2-Complementar, 3-Ajuste, 4-Devolução
    data_emissao: todayStr,
    data_saida: todayStr,
    tipo_nota: 'saida', // saida | entrada
    baixar_estoque: true,
    destacar_st: false,
    cfop_padrao: '5102',
    indIntermed: '0', // 0 - sem intermediador, 1 - com intermediador
    intermediador_cnpj: '',
    intermediador_id: '',
    parte_tipo: 'cliente', // mantido internamente; UI não exibe o seletor
    party_id: '',
    party_codigo: '',
    tipo_pessoa: 'PJ', cpf_cnpj: '', nome: '', email: '', telefone: '',
    inscricao_estadual: '', ie_isento: false,
    indIEDest: '9',
    logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', codigo_municipio_ibge: '',
    itens: [ {
      descricao: '', codigo: '', cod_barras: '', ncm: '', cest: '', cfop: '5102', unidade: 'UN',
      quantidade: '1', preco_unitario: '0.00', desconto_valor: '0.00', desconto_percent: '', acrescimos_valor: '0.00', frete_valor: '0.00', seguro_valor: '0.00', obs: '',
      dest_icms: false, dest_icms_info: false, benef_fiscal: false,
      impostos: {
        origem: '',
        icms: { cst: '', csosn: '', base: '', aliquota: '', valor: '', desonerado_valor:'', desoneracao_motivo:'', operacao_valor:'', aliq_diferimento:'', valor_diferido:'', reducao_percent:'', reducao_motivo:'', ad_rem:'', ad_rem_retencao:'', monofasico_bc:'', monofasico_valor:'', mono_retencao_bc:'', mono_retencao_valor:'', mono_cobrado_ant_bc:'', mono_cobrado_ant_valor:'', proprio_devido_valor:'' },
        icmsst: { base: '', aliquota: '', valor: '' },
        fcp: { base:'', aliquota:'', valor:'' },
        fcpst: { base:'', aliquota:'', valor:'' },
        pis: { cst: '', aliquota: '', valor: '' },
        cofins: { cst: '', aliquota: '', valor: '' },
        ipi: { cst: '', aliquota: '', valor: '', tipo_calculo: 'nenhum', valor_unit: '' },
        combustivel: { uf:'', perc_origem_uf:'', indicador_importacao:'' },
        cide: { base:'', aliq:'', valor:'' },
        iss: { aliquota: '', valor: '' },
      },
    } ],
    totais: { desconto_geral: '0.00', frete: '0.00', outras_despesas: '0.00' },
    pagamentos: [ { tipo: 'Dinheiro', bandeira: '', cnpj_credenciadora: '', autorizacao: '', valor: '', parcelas: '', troco: '' } ],
    transporte: { tipo_frete: '9', transportadora: '', placa: '', volumes: '', peso_liquido: '', peso_bruto: '' },
    adicionais: { obs_gerais: '', info_fisco: '', info_cliente: '', referencia_doc: '' },
  });
  const [cfopOptions, setCfopOptions] = useState([]);
  const [cfopModalOpen, setCfopModalOpen] = useState(false);
  const [cfopForm, setCfopForm] = useState({ codigo: '', descricao: '' });
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualEmitting, setManualEmitting] = useState(false);
  const [comandaPickerOpen, setComandaPickerOpen] = useState(false);
  const [comandaPickerSelectedId, setComandaPickerSelectedId] = useState(null);
  const [comandaPickerFilter, setComandaPickerFilter] = useState('');
  const [comandaPickerLoading, setComandaPickerLoading] = useState(false);
  const [nfeToolbarEmitting, setNfeToolbarEmitting] = useState(false);
  const [nfceConfirmEmitting, setNfceConfirmEmitting] = useState(false);
  const manualTabFlags = useMemo(() => {
    const f = manualForm || {};
    const itens = f.itens || [];
    const pagamentos = f.pagamentos || [];
    const isNFCe = String(f.modelo) === '65';

    const identOkBasic = !!(f.modelo && f.serie && f.natOp && f.data_emissao && f.tipo_nota && f.finNFe);
    const produtosTemItens = Array.isArray(itens) && itens.length > 0;
    const produtosImpostosOk = produtosTemItens && itens.every(it => {
      const imp = it.impostos || {}; const ic = imp.icms || {}; const pis = imp.pis || {}; const cof = imp.cofins || {};
      const okICMS = !!(imp.origem && (ic.cst || ic.csosn));
      const okPIS = !!(pis.aliquota !== undefined && String(pis.aliquota).trim() !== '');
      const okCOFINS = !!(cof.aliquota !== undefined && String(cof.aliquota).trim() !== '');
      return okICMS && okPIS && okCOFINS;
    });
    const produtosOkBasic = produtosTemItens && produtosImpostosOk;
    const transpOkBasic = !!(f.transporte && f.transporte.tipo_frete);

    let pagamentosOkBasic = true;
    if (isNFCe) {
      const totalProdutos = itens.reduce((s,it)=>{
        const pu = parseDec(it.preco_unitario)||0; const q = parseDec(it.quantidade)||1; const bruto = pu*q;
        const descP = parseDec(it.desconto_percent)||0; const descV = parseDec(it.desconto_valor)||0; const desconto = descP ? (bruto*descP/100) : descV; const acres = parseDec(it.acrescimos_valor)||0;
        const totalItem = Math.max(0, bruto - desconto + acres); return s + totalItem;
      },0);
      const descontoGeral = parseDec(f.totais?.desconto_geral)||0;
      const frete = parseDec(f.totais?.frete)||0;
      const outras = parseDec(f.totais?.outras_despesas)||0;
      const totalNota = totalProdutos - descontoGeral + frete + outras;
      const totalPago = pagamentos.reduce((s,p)=> s + (parseDec(p.valor)||0), 0);
      pagamentosOkBasic = pagamentos.length > 0 && (totalPago + 0.009) >= totalNota;
    }

    return {
      identOk: identOkBasic,
      produtosOk: produtosOkBasic,
      pagamentosOk: pagamentosOkBasic,
      totaisOk: true,
      transpOk: transpOkBasic,
    };
  }, [manualForm]);
  const [manualTab, setManualTab] = useState('cliente');
  const [manualStep, setManualStep] = useState('ident');
  const [manualCepLoading, setManualCepLoading] = useState(false);
  const [empresaUF, setEmpresaUF] = useState('');
  const [empresaInfo, setEmpresaInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [productFilter, setProductFilter] = useState('');
  const [pickerIndex, setPickerIndex] = useState(null); // legacy (não usado mais para inline)
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerTarget, setProductPickerTarget] = useState(null);
  const [deleteDraftId, setDeleteDraftId] = useState(null);
  const [cancelNfeRow, setCancelNfeRow] = useState(null);
  const [cancelNfeMotivo, setCancelNfeMotivo] = useState('');
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [partyQuickOpen, setPartyQuickOpen] = useState(false);
  const [partyQuery, setPartyQuery] = useState('');
  const [partyCodeInput, setPartyCodeInput] = useState('');
  const [partyList, setPartyList] = useState([]);
  const [partyModalTipo, setPartyModalTipo] = useState('cliente'); // 'cliente' | 'fornecedor'
  const [payMethods, setPayMethods] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);
  const [cfopFilter, setCfopFilter] = useState('');
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importComandaId, setImportComandaId] = useState('');
  const [cancelNfceId, setCancelNfceId] = useState(null);
  const [cancelNfceMotivo, setCancelNfceMotivo] = useState('');
  const [autoApplyCfop, setAutoApplyCfop] = useState(true);
  const [emitConfirmOpen, setEmitConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportZipFiscal = async ({ tipo, scope, includePdf }) => {
    try {
      if (!empresaInfo) { toast({ title: 'Empresa não carregada', variant: 'warning' }); return; }
      const cfg = getTransmiteNotaConfigFromEmpresa(empresaInfo);
      const ambiente = (cfg?.ambiente || 'homologacao');
      const cnpj = cfg?.cnpj || '';
      if (!cnpj) { toast({ title: 'CNPJ ausente', description: 'Preencha o CNPJ na Configuração Fiscal', variant: 'warning' }); return; }
      setExporting(true);

      let items = [];
      if (tipo === 'nfce') {
        let base = [];
        if (scope === 'selected') {
          const set = new Set(selectedIds);
          if (selectedId) set.add(selectedId);
          base = (rows||[]).filter(r => set.has(r.id));
        } else {
          base = (filtered||[]);
        }
        items = base.map(r => ({ tipo: 'nfce', chave: r.xml_chave, numero: r.nf_numero, serie: r.nf_serie, searchkey: r.xml_protocolo }));
      } else if (tipo === 'nfe') {
        let base = [];
        if (scope === 'selected') {
          const set = new Set(selectedIds);
          if (selectedId) set.add(selectedId);
          base = (nfeRows||[]).filter(r => set.has(r.id));
        } else {
          base = (nfeSorted||[]);
        }
        items = base.map(r => ({ tipo: 'nfe', chave: r.xml_chave, numero: r.numero, serie: r.serie }));
      }
      items = items.filter(it => (it.chave || (it.numero && it.serie) || it.searchkey));
      if (!items.length) { toast({ title: 'Nada para exportar', description: 'Nenhum documento elegível encontrado.', variant: 'warning' }); return; }

      const safe = (s) => String(s||'').replace(/[^0-9A-Za-z_-]/g,'');
      const zipName = `${tipo}-${scope}-${safe(from)}_a_${safe(to)}${includePdf?'-xml-pdf':'-xml'}.zip`;

      const fnUrl = `${supabase.supabaseUrl}/functions/v1/emissor`;
      const resp = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'apikey': supabase.supabaseKey,
          'Accept': 'application/zip',
        },
        body: JSON.stringify({ acao: 'export_zip', ambiente, cnpj, dados: { items, includePdf, zipName } }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || 'Falha ao gerar ZIP');
      }
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Exportação iniciada', description: `${items.length} documentos adicionados ao ZIP` });
    } catch (e) {
      toast({ title: 'Falha na exportação', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const onlyDigits = (v) => String(v||'').replace(/\D/g, '');
  const parseDec = (v) => {
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      // Formato tipo 1.234,56 -> remove pontos de milhar e usa vírgula como decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // Formato brasileiro simples 123,45 -> troca vírgula por ponto
      s = s.replace(',', '.');
    } else {
      // Só dígitos e/ou ponto -> já está em formato numérico padrão
      // não remover os pontos para não mudar escala (25.00 deve continuar 25)
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const spreadGlobalDiscountOnForm = (form) => {
    try {
      const descG = parseDec(form?.totais?.desconto_geral) || 0;
      const it = Array.isArray(form?.itens) ? form.itens : [];
      if (!descG || !it.length) return form;
      const bases = it.map((x) => {
        const q = parseDec(x.quantidade);
        const unit = parseDec(x.preco_unitario);
        const bruto = q * unit;
        const dperc = parseDec(x.desconto_percent);
        const dval = parseDec(x.desconto_valor);
        const acres = parseDec(x.acrescimos_valor);
        const frete = parseDec(x.frete_valor);
        const seguro = parseDec(x.seguro_valor);
        const vDescLocal = dperc ? (bruto * dperc / 100) : dval;
        return Math.max(0, bruto - vDescLocal + acres + frete + seguro);
      });
      const base = bases.reduce((s,v)=> s + v, 0);
      if (!(base > 0)) return form;
      const shares = bases.map(v => (descG * (v / base)));
      const rounded = shares.map(x => Number((x).toFixed(2)));
      let sum = rounded.reduce((s,v)=> s + v, 0);
      let diff = Number((descG - sum).toFixed(2));
      if (Math.abs(diff) >= 0.01) {
        const last = rounded.length - 1;
        rounded[last] = Number((rounded[last] + diff).toFixed(2));
        sum = rounded.reduce((s,v)=> s + v, 0);
      }
      const itensAdj = it.map((x, idx) => {
        const dperc = parseDec(x.desconto_percent);
        const unit = parseDec(x.preco_unitario);
        const q = parseDec(x.quantidade);
        const bruto = q * unit;
        const dvalExist = dperc ? (bruto * dperc / 100) : parseDec(x.desconto_valor);
        const novoDescVal = Number((dvalExist + (rounded[idx] || 0)).toFixed(2));
        return {
          ...x,
          desconto_percent: '',
          desconto_valor: novoDescVal.toFixed(2),
        };
      });
      return { ...form, itens: itensAdj, totais: { ...(form?.totais || {}), desconto_geral: '0.00' } };
    } catch { return form; }
  };

  // Ajusta baixar_estoque conforme tipo da nota (Saída:true, Entrada:false)
  useEffect(() => {
    setManualForm(f => ({ ...f, baixar_estoque: f.tipo_nota !== 'entrada' }));
  }, [manualForm.tipo_nota]);

  // Ajusta o tipo de parte sugerido conforme operação (Saída: cliente, Entrada: fornecedor)
  useEffect(() => {
    setPartyModalTipo(manualForm.tipo_nota === 'entrada' ? 'fornecedor' : 'cliente');
  }, [manualForm.tipo_nota]);

  useEffect(() => {
    setManualForm(f => ({ ...f, cfop_padrao: autoChooseCfop(f.uf) }));
  }, [manualForm.tipo_nota, empresaUF, manualForm.uf]);

  // Carrega CFOPs cadastrados para a empresa quando o modal de NF-e manual abre
  useEffect(() => {
    if (!manualOpen || !codigoEmpresa) return;
    let alive = true;
    (async () => {
      try {
        const fallback = [
          { id: '5102', codigo: '5102', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros', tipo_nota: 'saida' },
          { id: '5101', codigo: '5101', descricao: 'Venda de produção do estabelecimento', tipo_nota: 'saida' },
          { id: '6102', codigo: '6102', descricao: 'Venda de mercadoria para fora do estado (terceiros)', tipo_nota: 'saida' },
          { id: '6101', codigo: '6101', descricao: 'Venda de produção para fora do estado', tipo_nota: 'saida' },
        ];
        const { data, error } = await supabase
          .from('cfops')
          .select('id, codigo, descricao, tipo_nota')
          .eq('codigo_empresa', codigoEmpresa)
          .order('codigo');
        if (error) throw error;
        if (!alive) return;
        const fromDb = Array.isArray(data) ? data : [];
        const existing = new Set(fromDb.map(c => String(c.codigo)));
        const merged = [
          ...fromDb,
          ...fallback.filter(c => !existing.has(String(c.codigo))),
        ];
        setCfopOptions(merged);
      } catch (e) {
        console.error('[FiscalHub][CFOP] Falha ao carregar CFOPs', e);
        setCfopOptions([
          { id: '5102', codigo: '5102', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros', tipo_nota: 'saida' },
          { id: '5101', codigo: '5101', descricao: 'Venda de produção do estabelecimento', tipo_nota: 'saida' },
          { id: '6102', codigo: '6102', descricao: 'Venda de mercadoria para fora do estado (terceiros)', tipo_nota: 'saida' },
          { id: '6101', codigo: '6101', descricao: 'Venda de produção para fora do estado', tipo_nota: 'saida' },
        ]);
      }
    })();
    return () => { alive = false; };
  }, [manualOpen, codigoEmpresa]);

  // Quando CFOP padrão muda, aplica automaticamente aos itens que estavam com o CFOP anterior ou vazio
  const prevCfopRef = useRef(manualForm.cfop_padrao);
  useEffect(() => {
    const prev = prevCfopRef.current;
    const curr = manualForm.cfop_padrao || '';
    prevCfopRef.current = curr;
    if (!autoApplyCfop || !curr) return;
    // Evita loop: só altera se houver item com CFOP vazio ou igual ao anterior
    setManualForm(f => {
      const before = f.itens || [];
      let changed = false;
      const after = before.map(it => {
        const cf = String(it.cfop || '');
        if (cf === '' || (prev && cf === prev)) { changed = true; return { ...it, cfop: curr }; }
        return it;
      });
      return changed ? { ...f, itens: after } : f;
    });
  }, [manualForm.cfop_padrao, autoApplyCfop]);
  const handleItemClick = (idx) => (e) => {
    const tag = String(e?.target?.tagName || '').toLowerCase();
    if (['input','select','button','svg','path','textarea'].includes(tag)) return;
    setExpandedItem(prev => (prev === idx ? null : idx));
    setManualTab('impostos');
  };
  const moneyMaskBR = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    const cents = digits ? Number(digits) / 100 : 0;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents);
  };

  const emitirNota = async (formOverride = null, draftIdOverride = null) => {
    try {
      const isEventLike = formOverride && typeof formOverride === 'object' && (('nativeEvent' in formOverride) || ('preventDefault' in formOverride) || ('target' in formOverride));
      const form = (!formOverride || isEventLike) ? manualForm : formOverride;
      const itens = form.itens || [];
      try { console.log('[FiscalHub][emitirNota] start', { modelo: form.modelo, itensLen: Array.isArray(itens)?itens.length:0 }); } catch {}
      if (!Array.isArray(itens) || itens.length === 0) { try { console.warn('[FiscalHub][emitirNota] itens ausentes', { form }); } catch {} toast({ title: 'Sem itens', variant: 'warning' }); return; }
      if (!empresaInfo) { toast({ title: 'Empresa não carregada', variant: 'warning' }); return; }

      const { baseUrl, cnpj } = getTransmiteNotaConfigFromEmpresa(empresaInfo);
      if (!cnpj) { toast({ title: 'CNPJ ausente', description: 'Preencha o CNPJ na Configuração Fiscal', variant: 'warning' }); return; }

      const isNFCe = String(form.modelo) === '65';
      const formAdj = spreadGlobalDiscountOnForm(form);
      let Dados = isNFCe
        ? generateNfcePayloadFromManual({ form: formAdj, finalizadoras: payMethods || [] })
        : generateNfePayloadFromManual({ form: formAdj });
      // Número/série efetivamente usados na NF-e (apenas modelo 55)
      let numeroUsado = null;
      let serieUsada = null;
      try { console.log('[FiscalHub][emitirNota] payload gerado (antes do preflight)', { isNFCe, Dados }); } catch {}
      // Mantém Itens em array simples durante as validações; será envelopado em [[...]] antes do envio
      if (!isNFCe) {
        if (!Dados || typeof Dados !== 'object') Dados = {};
        if (!('forma_pagamento' in Dados)) Dados.forma_pagamento = 0;
        if (!('meio_pagamento' in Dados) || !Dados.meio_pagamento) {
          let mp = '99';
          const p = Array.isArray(formAdj?.pagamentos) ? formAdj.pagamentos[0] : null;
          if (p?.finalizadora_id && Array.isArray(payMethods) && payMethods.length) {
            const fin = payMethods.find(f => String(f.id) === String(p.finalizadora_id));
            if (fin?.codigo_sefaz) mp = String(fin.codigo_sefaz).padStart(2,'0');
          }
          Dados.meio_pagamento = mp;
        } else {
          Dados.meio_pagamento = String(Dados.meio_pagamento).padStart(2,'0');
        }
        if (!Dados.natureza_operacao || String(Dados.natureza_operacao).trim().length < 15) {
          Dados.natureza_operacao = 'Venda de mercadoria';
        }
        try {
          const itens = Array.isArray(Dados.Itens) ? Dados.Itens : [];
          const somaSemDesc = itens.reduce((s,i)=> s + (Number(i?.valor_total_sem_desconto)||0), 0);
          if (somaSemDesc > 0) Dados.valor_total_sem_desconto = (somaSemDesc).toFixed(2);
        } catch {}
        // Normalizar numero_destinatario: alguns provedores não aceitam 'SN'/'S/N' vazio
        if ('numero_destinatario' in Dados) {
          const nd = String(Dados.numero_destinatario || '').trim();
          if (!nd || /^s\/?n$/i.test(nd)) Dados.numero_destinatario = '0';
        }
        // Garantir Série e Número: reservar automaticamente se não informado
        let serieNum = Number(formAdj?.serie || 1) || 1;
        serieUsada = serieNum;
        const numeroAtual = formAdj?.nNF ? Number(formAdj.nNF) : 0;
        if (!numeroAtual) {
          try {
            try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'reservar_numero', modelo: '55', status: 'start', mensagem: `serie=${serieNum}` }); } catch {}
            const { data: nr, error: nrErr } = await supabase.rpc('reservar_numero_fiscal', { p_modelo: '55', p_serie: serieNum, p_codigo_empresa: codigoEmpresa });
            if (nrErr) throw nrErr;
            const numeroReservado = Number(nr);
            numeroUsado = numeroReservado;
            serieUsada = serieNum;
            // propagar para o formulário em tela e para o form ajustado usado nas consultas
            formAdj.nNF = String(numeroReservado);
            formAdj.serie = String(serieNum);
            setManualForm(f => ({ ...f, nNF: String(numeroReservado), serie: String(serieNum) }));
            Dados.Numero = numeroReservado;
            Dados.Serie = serieNum;
            try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'reservar_numero', modelo: '55', status: 'success', mensagem: `numero=${numeroReservado}` }); } catch {}
          } catch (e) {
            try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'reservar_numero', modelo: '55', status: 'error', mensagem: e?.message || String(e) }); } catch {}
            toast({ title: 'Falha ao reservar numeração NF-e', description: e?.message || String(e), variant: 'destructive' });
            return;
          }
        } else {
          numeroUsado = numeroAtual;
          serieUsada = serieNum;
          Dados.Numero = numeroUsado;
          Dados.Serie = serieUsada;
        }
        // Ajustar indicador_ie_destinatario conforme doc/IE
        try {
          const doc = String(formAdj?.cpf_cnpj || '').replace(/\D/g, '');
          const ieStr = String(formAdj?.inscricao_estadual || '').trim();
          if (doc.length === 14) {
            if (formAdj?.ie_isento) Dados.indicador_ie_destinatario = 2;
            else if (ieStr && ieStr.toUpperCase() !== 'ISENTO') Dados.indicador_ie_destinatario = 1;
            else Dados.indicador_ie_destinatario = 9;
          } else {
            Dados.indicador_ie_destinatario = 9;
          }
        } catch {}

        // Pré-validações bloqueantes para NF-e
        const errs = [];
        const onlyDigits = (s)=> String(s||'').replace(/\D/g,'');
        const doc = onlyDigits(formAdj?.cpf_cnpj);
        if (!doc) errs.push('Informe CPF/CNPJ do destinatário');
        if (!formAdj?.nome) errs.push('Informe o nome/razão social do destinatário');
        if (!formAdj?.logradouro) errs.push('Informe o logradouro do destinatário');
        // numero: vamos normalizar para '0' quando vazio/SN, então não bloquear
        if (!formAdj?.bairro) errs.push('Informe o bairro do destinatário');
        if (!formAdj?.cidade) errs.push('Informe a cidade do destinatário');
        if (!formAdj?.uf) errs.push('Informe a UF do destinatário');
        if (!formAdj?.cep) errs.push('Informe o CEP do destinatário');
        if (!formAdj?.codigo_municipio_ibge) errs.push('Informe o código IBGE do município do destinatário');
        if (doc.length === 14) {
          const ieStr = String(formAdj?.inscricao_estadual || '').trim();
          if (!formAdj?.ie_isento && (!ieStr || ieStr.toUpperCase()==='ISENTO')) errs.push('Informe a IE do destinatário ou marque ISENTO');
        }
        const itensChk = Array.isArray(formAdj?.itens) ? formAdj.itens : [];
        if (!itensChk.length) errs.push('Adicione ao menos 1 item');
        itensChk.forEach((it, idx) => {
          const ncm = String(it?.ncm||'').trim();
          const qtd = Number((it?.quantidade||'').toString().replace(',', '.'));
          const preco = String(it?.preco_unitario||'').trim();
          const cfop = String(it?.cfop||'').trim();
          const ic = (it?.impostos||{}).icms||{}; const pis = (it?.impostos||{}).pis||{}; const cof = (it?.impostos||{}).cofins||{};
          if (!ncm || /^0+$/.test(ncm)) errs.push(`Item ${idx+1}: NCM inválido`);
          if (!cfop) errs.push(`Item ${idx+1}: CFOP obrigatório`);
          if (!qtd || qtd<=0) errs.push(`Item ${idx+1}: quantidade inválida`);
          if (preco === '' || preco == null) errs.push(`Item ${idx+1}: preço unitário obrigatório`);
          if (!(ic.cst || ic.csosn)) errs.push(`Item ${idx+1}: preencha ICMS (CST/CSOSN)`);

          const csosnStr = String(ic.csosn || '').trim();
          const cestStr = String(it.cest || '').trim();
          if (csosnStr === '500' && !cestStr) {
            errs.push(`Item ${idx+1}: CEST obrigatório para operação com ICMS-ST (CSOSN 500)`);
          }

          const cstPis = String(pis.cst||'').trim();
          const cstCof = String(cof.cst||'').trim();
          if (cstPis === '01' && String(pis.aliquota||'').trim()==='') errs.push(`Item ${idx+1}: preencha alíquota de PIS (CST 01)`);
          if (cstCof === '01' && String(cof.aliquota||'').trim()==='') errs.push(`Item ${idx+1}: preencha alíquota de COFINS (CST 01)`);
        });
        // Ajuste de consistência PIS/COFINS no payload (se CST=01 e aliquota<=0, trocar para 07 e limpar bases/valores)
        try {
          if (Array.isArray(Dados?.Itens)) {
            if (Array.isArray(Dados.Itens[0])) {
              Dados.Itens[0] = Dados.Itens[0].map((it) => {
                const out = { ...it };
                const ap = Number(String(out.aliquota_pis||'').replace(',', '.')) || 0;
                const ac = Number(String(out.aliquota_cofins||'').replace(',', '.')) || 0;
                if (String(out.pis_situacao_tributaria||'').trim()==='01' && ap<=0) {
                  out.pis_situacao_tributaria = '07';
                  out.base_calculo_pis = '';
                  out.aliquota_pis = '';
                  out.valor_pis = '';
                }
                if (String(out.cofins_situacao_tributaria||'').trim()==='01' && ac<=0) {
                  out.cofins_situacao_tributaria = '07';
                  out.base_calculo_cofins = '';
                  out.aliquota_cofins = '';
                  out.valor_cofins = '';
                }
                return out;
              });
            } else {
              Dados.Itens = Dados.Itens.map((it) => {
                const out = { ...it };
                const ap = Number(String(out.aliquota_pis||'').replace(',', '.')) || 0;
                const ac = Number(String(out.aliquota_cofins||'').replace(',', '.')) || 0;
                if (String(out.pis_situacao_tributaria||'').trim()==='01' && ap<=0) {
                  out.pis_situacao_tributaria = '07';
                  out.base_calculo_pis = '';
                  out.aliquota_pis = '';
                  out.valor_pis = '';
                }
                if (String(out.cofins_situacao_tributaria||'').trim()==='01' && ac<=0) {
                  out.cofins_situacao_tributaria = '07';
                  out.base_calculo_cofins = '';
                  out.aliquota_cofins = '';
                  out.valor_cofins = '';
                }
                return out;
              });
            }
          }
        } catch {}
        if (errs.length) {
          toast({ title: 'Faltam dados para emitir NF-e', description: errs.slice(0,6).join(' • ')+(errs.length>6?` • (+${errs.length-6} itens)`:''), variant: 'destructive' });
          return;
        }
      }

      // marca como processando
      const draftId = draftIdOverride ?? currentDraftId;
      if (draftId && codigoEmpresa) {
        try { await supabase.from('notas_fiscais').update({ status: 'processando' }).eq('id', draftId).eq('codigo_empresa', codigoEmpresa); } catch {}
      }

      toast({ title: 'Enviando nota...', description: `Modelo ${form.modelo}` });
      try {
        if (isNFCe && Array.isArray(Dados?.Itens) && !Array.isArray(Dados.Itens[0])) {
          Dados.Itens = [Dados.Itens];
        }
        console.log('[FiscalHub][emitirNota] payload final (antes do envio)', { Dados });
      } catch {}

      let resp;
      let envioErro = null;
      try {
        if (isNFCe) resp = await enviarNfce({ baseUrl, cnpj, dados: Dados });
        else resp = await enviarNfe({ baseUrl, cnpj, dados: Dados });
      } catch (err) {
        envioErro = err;
      }
      try { console.log('[FiscalHub][emitirNota] resposta envio', { ok: !envioErro, resp, envioErro }); } catch {}

      // Se a API respondeu 200 com erro de negócio (e.g., { status: 'Erro', codigo, campo, descricao })
      if (!envioErro && resp && (typeof resp?.status === 'string') && /erro/i.test(resp.status)) {
        const cod = resp?.codigo || resp?.Codigo || '';
        const campo = resp?.campo || resp?.Campo || '';
        const descr = resp?.descricao || resp?.Descricao || resp?.mensagem || resp?.message || 'Falha na emissão';
        const msgErr = [campo, descr].filter(Boolean).join(' • ');
        toast({ title: `Erro na emissão${cod ? ` ${cod}` : ''}`, description: msgErr, variant: 'destructive' });
        const draftId = draftIdOverride ?? currentDraftId;
        if (draftId && codigoEmpresa) {
          try { await supabase.from('notas_fiscais').update({ status: 'erro' }).eq('id', draftId).eq('codigo_empresa', codigoEmpresa); await loadNfeRows(); } catch {}
        }
        return;
      }

      if (envioErro) {
        // Para NFC-e, ocultar toast de erro e seguir com fallback silencioso
        if (!isNFCe) {
          const http = envioErro?.status ? `HTTP ${envioErro.status}` : 'Erro de transporte';
          const descr = (typeof envioErro?.response === 'string' && envioErro.response) || envioErro?.response?.message || envioErro?.message || 'Tentando consultar status…';
          toast({ title: 'Envio com erro', description: `${http}. ${descr}`.trim(), variant: 'warning' });
        }
      } else {
        toast({ title: 'Envio solicitado', description: 'Consultando status...' });
      }

      // Algumas respostas já trazem o resultado completo dentro de "resultado"
      const respResultado = resp?.resultado || resp?.Resultado || null;
      let chave = resp?.chave_nota || resp?.chave || resp?.Chave || '';
      let numeroResp = resp?.numero || resp?.Numero || null;
      let serieResp = resp?.serie || resp?.Serie || null;
      let xmlUrlFromResp = resp?.url_xml || resp?.xml_url || null;
      let pdfUrlFromResp = resp?.url_pdf || resp?.pdf_url || null;
      if (respResultado) {
        chave = chave || respResultado.chave || respResultado.chave_nota || respResultado.Chave || '';
        numeroResp = numeroResp || respResultado.numero || respResultado.Numero || null;
        serieResp = serieResp || respResultado.serie || respResultado.Serie || null;
        xmlUrlFromResp = xmlUrlFromResp || respResultado.link_xml || respResultado.url_xml || respResultado.xml_url || null;
        pdfUrlFromResp = pdfUrlFromResp || respResultado.link_pdf || respResultado.url_pdf || respResultado.pdf_url || null;
      }

      let consulta = null;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 5; i++) {
        const dadosConsulta = chave
          ? { chave_nota: chave, chave }
          : { numero: numeroUsado || formAdj?.nNF, serie: serieUsada || formAdj?.serie };
        try {
          if (isNFCe) consulta = await consultarEmissaoNfce({ baseUrl, cnpj, dados: dadosConsulta });
          else consulta = await consultarEmissaoNfe({ baseUrl, cnpj, dados: dadosConsulta });
        } catch {}
        const stPeek = String(consulta?.status || consulta?.cStat || '');
        const msgPeek = consulta?.xMotivo || consulta?.mensagem || consulta?.message || '';
        if (stPeek === '100' || /autorizad/i.test(msgPeek)) break;
        await sleep(2000);
      }

      // Se ainda não autorizado ou sem URLs, tentar endpoints diretos de PDF/XML
      let xmlUrl = consulta?.url_xml || consulta?.xml_url || xmlUrlFromResp || null;
      let pdfUrl = consulta?.url_pdf || consulta?.pdf_url || pdfUrlFromResp || null;
      let chaveResp = chave || consulta?.chave_nota || consulta?.chave || consulta?.Chave || '';
      if (!pdfUrl || !xmlUrl) {
        // Só montar dadosFallback se tivermos chave ou número válido; evita chamadas com numero=""
        const baseNumero = numeroUsado || formAdj?.nNF;
        const hasNumero = !!(baseNumero && String(baseNumero).trim());
        if (!chaveResp && !hasNumero) {
          // Sem referência para PDF/XML, não tentar fallback
        } else {
          const dadosFallback = chaveResp
            ? { chave_nota: chaveResp, chave: chaveResp }
            : { numero: baseNumero, serie: serieUsada || formAdj?.serie };
          try {
          if (isNFCe) {
            const rpdf = await consultarPdfNfce({ baseUrl, cnpj, dados: dadosFallback });
            pdfUrl = pdfUrl || rpdf?.url_pdf || rpdf?.pdf_url || null;
            chaveResp = chaveResp || rpdf?.chave || rpdf?.Chave || '';
          } else {
            const rpdf = await consultarPdfNfe({ baseUrl, cnpj, dados: dadosFallback });
            pdfUrl = pdfUrl || rpdf?.url_pdf || rpdf?.pdf_url || null;
            chaveResp = chaveResp || rpdf?.chave || rpdf?.Chave || '';
          }
        } catch {}
        try {
          if (isNFCe) {
            const rxml = await consultarXmlNfce({ baseUrl, cnpj, dados: dadosFallback });
            xmlUrl = xmlUrl || rxml?.url_xml || rxml?.xml_url || null;
            chaveResp = chaveResp || rxml?.chave || rxml?.Chave || '';
          } else {
            const rxml = await consultarXmlNfe({ baseUrl, cnpj, dados: dadosFallback });
            xmlUrl = xmlUrl || rxml?.url_xml || rxml?.xml_url || null;
            chaveResp = chaveResp || rxml?.chave || rxml?.Chave || '';
          }
        } catch {}
        }
      }
      let st = String(consulta?.status || consulta?.cStat || '');
      let msg = consulta?.xMotivo || consulta?.mensagem || consulta?.message || 'Status retornado';

      // Alguns retornos trazem o status/motivo e URLs dentro de um bloco "resultado"
      const resultado = consulta?.resultado || consulta?.Resultado || null;
      if (resultado) {
        if (resultado.status != null) {
          st = String(resultado.status);
        }
        if (resultado.motivo || resultado.Motivo || resultado.descricao || resultado.Descricao) {
          msg = resultado.motivo || resultado.Motivo || resultado.descricao || resultado.Descricao || msg;
        }
        if (!xmlUrl) xmlUrl = resultado.link_xml || resultado.url_xml || resultado.xml_url || xmlUrl;
        if (!pdfUrl) pdfUrl = resultado.link_pdf || resultado.url_pdf || resultado.pdf_url || pdfUrl;
        if (!chaveResp) chaveResp = resultado.chave || resultado.chave_nota || resultado.Chave || chaveResp;
      }

      // Fallback: usar também o bloco resultado da resposta de envio quando a consulta não trouxer tudo
      if (!st && respResultado?.status != null) {
        st = String(respResultado.status);
      }
      if ((!msg || msg === 'Status retornado') && respResultado) {
        msg = respResultado.motivo || respResultado.Motivo || respResultado.descricao || respResultado.Descricao || resp?.descricao || resp?.Descricao || msg;
      }

      const autorizada = (st === '100' || /autorizad|aprovad/i.test(msg) || /aprovad/i.test(st));
      if (autorizada) {
        toast({ title: 'Autorizada', description: msg, variant: 'success' });
      } else if (st) {
        toast({ title: `Status: ${st}`, description: msg, variant: 'warning' });
      } else {
        toast({ title: 'Consulta retornada', description: msg });
      }

      // persistir no rascunho
      if (draftId && codigoEmpresa) {
        try {
          const newStatus = autorizada || (pdfUrl || xmlUrl) ? 'autorizada' : (/rejeit/i.test(msg) ? 'rejeitada' : (envioErro ? 'processando' : 'pendente'));
          await supabase.from('notas_fiscais').update({
            status: newStatus,
            xml_chave: (chaveResp || chave || null),
            xml_url: xmlUrl || null,
            pdf_url: pdfUrl || null,
            numero: numeroUsado != null ? Number(numeroUsado) : (form?.nNF ? Number(form.nNF) : null),
            serie: serieUsada != null ? Number(serieUsada) : (form?.serie ? Number(form.serie) : null),
            ambiente: (getTransmiteNotaConfigFromEmpresa(empresaInfo||{}).ambiente || null),
          }).eq('id', draftId).eq('codigo_empresa', codigoEmpresa);
          await loadNfeRows();
        } catch {}
      }
    } catch (e) {
      toast({ title: 'Falha na emissão', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const applyProductByCode = (idx, rawCode) => {
    const code = String(rawCode || '').trim().toLowerCase();
    if (!code) return;
    const prod = (products || []).find(p => String(p.code || '').trim().toLowerCase() === code);
    if (prod && idx != null) {
      applyProductToItem(idx, prod);
    }
  };

  const importFromComanda = async (overrideId) => {
    try {
      const cid = overrideId || importComandaId;
      if (!cid) { toast({ title: 'Selecione uma comanda para importar', variant: 'warning' }); return; }
      const itens = await listarItensDaComanda({ comandaId: cid, codigoEmpresa });
      if (!itens || !itens.length) {
        toast({ title: 'Nenhum item encontrado nesta comanda', variant: 'warning' });
        return;
      }
      console.log('[FiscalHub][NF-e manual] Itens da comanda para importação:', { comandaId: cid, itens });
      const prodIds = Array.from(new Set((itens || []).map(it => it.produto_id).filter(Boolean)));
      let prods = [];
      if (prodIds.length) {
        try {
          let q = supabase.from('produtos').select('id, nome, codigo_produto, unidade, ncm, cest, cfop_interno, cfop_externo, cst_icms_interno, csosn_interno, aliquota_icms_interno, cst_pis_saida, aliquota_pis_percent, aliquota_cofins_percent, cst_ipi, aliquota_ipi_percent').in('id', prodIds);
          if (codigoEmpresa) q = q.eq('codigo_empresa', codigoEmpresa);
          const { data } = await q;
          prods = data || [];
        } catch {
          prods = [];
        }
      }
      console.log('[FiscalHub][NF-e manual] Produtos carregados para os itens da comanda:', { prodIds, prods });
      const mapProd = new Map((prods || []).map(p => [p.id, p]));
      const mapped = (itens || []).map((it) => {
        const p = mapProd.get(it.produto_id) || null;
        const cfop = (p?.cfop_interno || p?.cfop_externo) || autoChooseCfop(manualForm.uf);
        const unidade = (p?.unidade || 'UN').toString().toUpperCase();
        const preco = Number(it.preco_unitario || 0) || 0;
        const pisAliq = p?.aliquota_pis_percent;
        const cofinsAliq = p?.aliquota_cofins_percent;
        const pisCst = (p?.cst_pis_saida) || ((pisAliq ?? null) != null ? '01' : '');
        const cofinsCst = ((cofinsAliq ?? null) != null ? '01' : '');
        const qtd = Number(it.quantidade || 1) || 1;
        const bruto = preco * qtd;
        const autoBaseStr = bruto > 0 ? bruto.toFixed(2) : '';
        const calcValor = (aliq) => {
          const a = Number(aliq ?? 0);
          if (!a || !bruto) return '';
          const v = bruto * (a / 100);
          return v.toFixed(2);
        };
        const icmsVal = calcValor(p?.aliquota_icms_interno);
        const pisVal = calcValor(pisAliq);
        const cofinsVal = calcValor(cofinsAliq);
        const ipiVal = calcValor(p?.aliquota_ipi_percent);
        return {
          descricao: it.descricao || p?.nome || 'Item',
          codigo: p?.codigo_produto || '',
          ncm: p?.ncm || '',
          cest: p?.cest || '',
          cfop: cfop || '5102',
          unidade,
          quantidade: String(qtd),
          preco_unitario: preco.toFixed(2),
          desconto_valor: '0.00',
          desconto_percent: '',
          acrescimos_valor: '0.00',
          obs: '',
          impostos: {
            origem: '',
            icms: { cst: p?.cst_icms_interno || '', csosn: p?.csosn_interno || '', base: autoBaseStr, aliquota: p?.aliquota_icms_interno != null ? String(p.aliquota_icms_interno) : '', valor: icmsVal },
            icmsst: { base: '', aliquota: '', valor: '' },
            pis: { cst: pisCst, aliquota: pisAliq != null ? String(pisAliq) : '', valor: pisVal },
            cofins: { cst: cofinsCst, aliquota: cofinsAliq != null ? String(cofinsAliq) : '', valor: cofinsVal },
            ipi: { cst: p?.cst_ipi || '', aliquota: p?.aliquota_ipi_percent != null ? String(p.aliquota_ipi_percent) : '', valor: ipiVal },
            iss: { aliquota: '', valor: '' },
          },
        };
      });
      console.log('[FiscalHub][NF-e manual] Itens mapeados para o construtor manual:', mapped);
      if (!mapped.length) { toast({ title: 'Nenhum item encontrado nesta comanda', variant: 'warning' }); return; }
      setManualForm(f => ({ ...f, itens: mapped }));
      setImportOpen(false);
      toast({ title: 'Itens importados' });
    } catch (e) {
      toast({ title: 'Falha ao importar itens', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const openManualFromComanda = async (id) => {
    console.log('[FiscalHub][NF-e manual] openManualFromComanda called with id:', id);
    if (!id) { toast({ title: 'Selecione uma comanda', variant: 'warning' }); return; }
    const row = (rows || []).find(r => r.id === id);
    console.log('[FiscalHub][NF-e manual] Comanda selecionada para NF-e:', row);
    setManualTab('cliente');
    setManualOpen(true);
    setManualForm(() => {
      const today = new Date();
      const todayStrLocal = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
      const total = Number(row?.total || 0) || 0;
      const finName = (row?.finalizadorasStr || '').trim();
      const finMatch = (payMethods || []).find(m => {
        const nome = (m?.nome || '').trim().toLowerCase();
        const target = finName.toLowerCase();
        if (!nome || !target) return false;
        return target === nome || target.startsWith(nome) || nome.startsWith(target);
      });
      return {
        natOp: 'VENDA', serie: '1', nNF: '', indFinal: '1', indPres: '1', idDest: '1',
        modelo: '55',
        finNFe: '1',
        data_emissao: todayStrLocal,
        data_saida: todayStrLocal,
        tipo_nota: 'saida',
        baixar_estoque: true,
        destacar_st: false,
        cfop_padrao: '5102',
        indIntermed: '0',
        intermediador_cnpj: '',
        intermediador_id: '',
        parte_tipo: 'cliente',
        party_id: '',
        party_codigo: '',
        tipo_pessoa: 'PJ', cpf_cnpj: '', nome: '', email: '', telefone: '',
        inscricao_estadual: '', ie_isento: false,
        indIEDest: '9',
        logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', codigo_municipio_ibge: '',
        itens: [ {
          descricao: '', codigo: '', cod_barras: '', ncm: '', cest: '', cfop: '5102', unidade: 'UN',
          quantidade: '1', preco_unitario: '0.00', desconto_valor: '0.00', desconto_percent: '', acrescimos_valor: '0.00', frete_valor: '0.00', seguro_valor: '0.00', obs: '',
          dest_icms: false, dest_icms_info: false, benef_fiscal: false,
          impostos: {
            origem: '',
            icms: { cst: '', csosn: '', base: '', aliquota: '', valor: '', desonerado_valor:'', desoneracao_motivo:'', operacao_valor:'', aliq_diferimento:'', valor_diferido:'', reducao_percent:'', reducao_motivo:'', ad_rem:'', ad_rem_retencao:'', monofasico_bc:'', monofasico_valor:'', mono_retencao_bc:'', mono_retencao_valor:'', mono_cobrado_ant_bc:'', mono_cobrado_ant_valor:'', proprio_devido_valor:'' },
            icmsst: { base: '', aliquota: '', valor: '' },
            fcp: { base:'', aliquota:'', valor:'' },
            fcpst: { base:'', aliquota:'', valor:'' },
            pis: { cst: '', aliquota: '', valor: '' },
            cofins: { cst: '', aliquota: '', valor: '' },
            ipi: { cst: '', aliquota: '', valor: '', tipo_calculo: 'nenhum', valor_unit: '' },
            combustivel: { uf:'', perc_origem_uf:'', indicador_importacao:'' },
            cide: { base:'', aliq:'', valor:'' },
            iss: { aliquota: '', valor: '' },
          },
        } ],
        totais: { desconto_geral: '0.00', frete: '0.00', outras_despesas: '0.00' },
        pagamentos: [ { finalizadora_id: finMatch?.id || '', tipo: finMatch?.nome || row?.finalizadorasStr || 'Dinheiro', bandeira: '', cnpj_credenciadora: '', autorizacao: '', valor: moneyMaskBR(total.toFixed(2)), parcelas: '', troco: '' } ],
        transporte: { tipo_frete: '9', transportadora: '', placa: '', volumes: '', peso_liquido: '', peso_bruto: '' },
        adicionais: { obs_gerais: '', info_fisco: '', info_cliente: '', referencia_doc: '' },
      };
    });
    // Tentar pré-preencher o destinatário a partir do cliente principal da comanda
    try {
      const mainClientName = (row?.clientesStr || '').split(',')[0].trim();
      if (mainClientName && codigoEmpresa) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('codigo_empresa', codigoEmpresa)
          .ilike('nome', mainClientName)
          .limit(1)
          .single();
        if (data) {
          console.log('[FiscalHub][NF-e manual] Cliente principal encontrado para pré-preenchimento do destinatário:', data);
          applyParty(data);
        }
      }
    } catch (e) {
      console.warn('[FiscalHub][NF-e manual] Falha ao pré-preencher destinatário a partir da comanda:', e);
    }
    setImportComandaId(String(id));
    console.log('[FiscalHub][NF-e manual] Preparando importação de itens da comanda para NF-e, comandaId=', String(id));
    try { await importFromComanda(String(id)); } catch (e) { console.error('[FiscalHub][NF-e manual] Erro ao importar itens da comanda para NF-e:', e); }
  };

  // CFOP catálogo (completo - JSON)
  const CFOP_CATALOG = Array.isArray(cfopList) ? cfopList : [];

  // Sugestões de natureza de operação
  const NATOP_SUGGESTIONS = ['VENDA', 'COMPRA', 'DEVOLUCAO', 'TRANSFERENCIA', 'BONIFICACAO', 'REMESSA', 'DEMONSTRACAO'];

  // Carregar empresa UF para decisão de CFOP interno/externo
  useEffect(() => {
    let ignore = false;
    async function run(){
      if (!codigoEmpresa) return;
      try{
        const { data } = await supabase.from('empresas').select('uf').eq('codigo_empresa', codigoEmpresa).single();
        if (!ignore) setEmpresaUF(data?.uf || '');
      }catch{}
    }
    run();
    return () => { ignore = true; };
  }, [codigoEmpresa]);

  // Carregar dados básicos da empresa para exibir como emitente na NF-e manual
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!codigoEmpresa) return;
      try {
        const { data } = await supabase
          .from('empresas')
          .select('razao_social, nome_fantasia, cnpj, inscricao_estadual, regime_tributario, endereco, logradouro, numero, bairro, cidade, uf, cep, codigo_municipio_ibge, nfe_serie, nfce_serie, ambiente, transmitenota_apikey, transmitenota_base_url, transmitenota_apikey_hml, transmitenota_base_url_hml, transmitenota_apikey_prod, transmitenota_base_url_prod')
          .eq('codigo_empresa', codigoEmpresa)
          .single();
        if (!cancelled) setEmpresaInfo(data || null);
      } catch {
        if (!cancelled) setEmpresaInfo(null);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [codigoEmpresa]);

  // Ajustar série padrão conforme modelo selecionado e cadastro da empresa
  useEffect(() => {
    if (!empresaInfo) return;
    setManualForm(f => {
      const serieEmpresa = f.modelo === '65' ? (empresaInfo.nfce_serie || f.serie) : (empresaInfo.nfe_serie || f.serie);
      const target = String(serieEmpresa || f.serie || '1');
      if (String(f.serie || '') === target) return f;
      return { ...f, serie: target };
    });
  }, [empresaInfo, manualForm.modelo]);

  // Carregar catálogo de produtos ao abrir o modal manual
  useEffect(() => {
    let active = true;
    async function loadProds(){
      if (!manualOpen || !codigoEmpresa) return;
      try{ const prods = await listProducts({ includeInactive: false, codigoEmpresa }); if (active) setProducts(prods || []); }
      catch{ if (active) setProducts([]); }
    }
    loadProds();
    return () => { active = false; };
  }, [manualOpen, codigoEmpresa]);

  const filteredProducts = useMemo(() => {
    const t = (productFilter||'').trim().toLowerCase();
    const base = (products||[]).slice().sort((a,b)=>{
      const ca = Number(String(a.code||0).replace(/\D/g,''))||0;
      const cb = Number(String(b.code||0).replace(/\D/g,''))||0;
      return ca - cb;
    });
    if (!t) return base.slice(0, 100);
    return base.filter(p => (p.name||'').toLowerCase().includes(t) || (p.code||'').toLowerCase().includes(t)).slice(0, 100);
  }, [products, productFilter]);

  const autoChooseCfop = (destUF, tipo = manualForm.tipo_nota) => {
    const emp = String(empresaUF||'').toUpperCase();
    const dest = String(destUF||'').toUpperCase();
    const haveUFs = !!emp && !!dest;
    const same = haveUFs ? dest === emp : true; // assume interna quando desconhecido
    const saida = tipo !== 'entrada';
    if (saida) return same ? '5102' : '6102';
    return same ? '1102' : '2102';
  };

  const natFromCfop = (code) => {
    const desc = CFOP_CATALOG.find(o=>o.code===code)?.desc || '';
    const d = desc.toLowerCase();
    if (manualForm.tipo_nota === 'entrada') {
      if (d.includes('compra') || d.includes('entrada')) return 'COMPRA';
    }
    if (d.includes('venda')) return 'VENDA';
    if (d.includes('devolu')) return 'DEVOLUCAO';
    if (d.includes('transfer')) return 'TRANSFERENCIA';
    if (d.includes('bonifica')) return 'BONIFICACAO';
    if (d.includes('remessa')) return 'REMESSA';
    if (d.includes('demonstra')) return 'DEMONSTRACAO';
    return manualForm.natOp || 'VENDA';
  };

  const applyProductToItem = (idx, p) => {
    setManualForm(f => {
      const a = [...f.itens];
      const cfop = p?.cfopInterno || p?.cfopExterno || autoChooseCfop(f.uf);
      const preco = Number(p?.price ?? p?.salePrice ?? 0) || 0;
      const sameUF = String(f.uf||'').toUpperCase() === String(empresaUF||'').toUpperCase();
      const icmsCst = sameUF ? (p?.cstIcmsInterno || '') : (p?.cstIcmsExterno || '');
      const csosn = sameUF ? (p?.csosnInterno || '') : (p?.csosnExterno || '');
      const icmsAliq = sameUF ? (p?.aliqIcmsInterno ?? null) : (p?.aliqIcmsExterno ?? null);
      const pisCst = p?.cstPisSaida || ((p?.aliqPisPercent ?? null) != null ? '01' : '');
      const pisAliq = p?.aliqPisPercent ?? null;
      const cofinsCst = ((p?.aliqCofinsPercent ?? null) != null ? '01' : '');
      const cofinsAliq = p?.aliqCofinsPercent ?? null;
      const ipiCst = p?.cstIpi || '';
      const ipiAliq = p?.aliqIpiPercent ?? null;
      a[idx] = {
        ...a[idx],
        descricao: p?.name || a[idx].descricao,
        codigo: p?.code || a[idx].codigo,
        cod_barras: p?.barcode || p?.ean || p?.gtin || p?.bar_code || a[idx].cod_barras,
        unidade: (p?.unit || 'UN').toString().toUpperCase(),
        ncm: p?.ncm || a[idx].ncm,
        cest: p?.cest || a[idx].cest,
        cfop: cfop || a[idx].cfop,
        preco_unitario: preco ? preco.toFixed(2) : a[idx].preco_unitario,
        impostos: {
          ...(a[idx].impostos || {}),
          icms: { ...(a[idx].impostos?.icms||{}), cst: icmsCst || a[idx].impostos?.icms?.cst || '', csosn: csosn || a[idx].impostos?.icms?.csosn || '', aliquota: icmsAliq != null ? String(icmsAliq) : (a[idx].impostos?.icms?.aliquota||'') },
          pis: { ...(a[idx].impostos?.pis||{}), cst: pisCst || a[idx].impostos?.pis?.cst || '', aliquota: pisAliq != null ? String(pisAliq) : (a[idx].impostos?.pis?.aliquota||'') },
          cofins: { ...(a[idx].impostos?.cofins||{}), cst: cofinsCst || a[idx].impostos?.cofins?.cst || '', aliquota: cofinsAliq != null ? String(cofinsAliq) : (a[idx].impostos?.cofins?.aliquota||'') },
          ipi: { ...(a[idx].impostos?.ipi||{}), cst: ipiCst || a[idx].impostos?.ipi?.cst || '', aliquota: ipiAliq != null ? String(ipiAliq) : (a[idx].impostos?.ipi?.aliquota||'') },
        },
      };
      const nextNat = natFromCfop(cfop || a[idx].cfop);
      return { ...f, itens: a, natOp: nextNat };
    });
    setPickerIndex(null);
  };

  // Carregar partes (clientes/fornecedores) para o picker
  useEffect(() => {
    let alive = true;
    async function loadParties(){
      if ((!partyPickerOpen && !manualOpen) || !codigoEmpresa) return;
      try {
        const [clientes, fornecedores] = await Promise.all([
          listarClientes({ searchTerm: null, limit: 200, codigoEmpresa }),
          listSuppliers(codigoEmpresa),
        ]);
        const all = [...(clientes || []), ...(fornecedores || [])];
        if (alive) setPartyList(all);
      } catch { if (alive) setPartyList([]); }
    }
    loadParties();
    return () => { alive = false; };
  }, [partyPickerOpen, manualOpen, codigoEmpresa]);

  useEffect(() => {
    if (partyPickerOpen) setPartyQuery('');
  }, [partyPickerOpen]);

  const filteredPartyList = useMemo(() => {
    const t = (partyQuery||'').trim().toLowerCase();
    const base = (partyList||[]).slice().sort((a,b) => {
      const ca = Number(String(a.codigo || a.codigo_cliente || a.codigo_fornecedor || a.code || 0).replace(/\D/g,''))||0;
      const cb = Number(String(b.codigo || b.codigo_cliente || b.codigo_fornecedor || b.code || 0).replace(/\D/g,''))||0;
      return ca - cb;
    });
    if (!t) return base;
    return base.filter(p => {
      const code = String(p.codigo || p.codigo_cliente || p.codigo_fornecedor || p.code || '').toLowerCase();
      const nome = String(p.nome || p.razao_social || p.apelido || '').toLowerCase();
      const doc = String(p.cnpj || p.cpf || '').toLowerCase();
      return code.includes(t) || nome.includes(t) || doc.includes(t);
    });
  }, [partyList, partyQuery]);

  const findPartyByCode = async (codeRaw) => {
    const code = String(codeRaw||'').replace(/\D/g,'');
    if (!code || !codigoEmpresa) return;
    try{
      let q = supabase.from('clientes').select('*').eq('codigo_empresa', codigoEmpresa).eq('codigo', Number(code)).limit(1);
      if (manualForm.tipo_nota === 'entrada') q = q.eq('is_fornecedor', true);
      const { data } = await q.single();
      if (data) applyParty(data);
    } catch{}
  };

  const applyParty = (p) => {
    if (!p) return;
    const isPJ = (p.tipo_pessoa || 'PJ') === 'PJ' || !!p.cnpj;
    setManualForm(f => ({
      ...f,
      parte_tipo: (p.is_fornecedor ? 'fornecedor' : 'cliente'),
      party_id: p.id || '',
      party_codigo: String(p.codigo || p.codigo_cliente || p.codigo_fornecedor || p.code || ''),
      tipo_pessoa: isPJ ? 'PJ' : 'PF',
      cpf_cnpj: (p.cnpj || p.cpf || '').toString(),
      nome: p.nome || p.razao_social || p.apelido || '',
      email: p.email || '',
      telefone: p.telefone || '',
      logradouro: p.endereco || p.logradouro || '',
      numero: p.numero || '',
      bairro: p.bairro || '',
      cidade: p.cidade || '',
      uf: p.uf || '',
      cep: p.cep || '',
      codigo_municipio_ibge: p.cidade_ibge || p.codigo_municipio_ibge || '',
      inscricao_estadual: p.ie || p.inscricao_estadual || '',
      ie_isento: p.ie === 'ISENTO' || false,
    }));
    setPartyPickerOpen(false);
  };
  // Carregar finalizadoras quando abrir a aba Pagamentos da NF-e manual
  useEffect(() => {
    let alive = true;
    async function loadFins(){
      if (!manualOpen || manualStep !== 'pagamentos') return;
      try {
        const fins = await listarFinalizadoras({ somenteAtivas: true, codigoEmpresa });
        if (alive) setPayMethods(Array.isArray(fins) ? fins : []);
      } catch { if (alive) setPayMethods([]); }
    }
    loadFins();
    return () => { alive = false; };
  }, [manualOpen, manualStep, codigoEmpresa]);
  const isEmail = (s) => /.+@.+\..+/.test(String(s||''));
  const lookupCep = async (cepRaw) => {
    const cep = onlyDigits(cepRaw);
    if (cep.length !== 8) return;
    try {
      setManualCepLoading(true);
      let data = null;
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        if (res.ok) data = await res.json();
      } catch {}
      if (!data) {
        try {
          const res2 = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          if (res2.ok) data = await res2.json();
        } catch {}
      }
      if (data) {
        const logradouro = data.street || data.logradouro || '';
        const bairro = data.neighborhood || data.bairro || '';
        const cidade = data.city || data.localidade || '';
        const uf = (data.state || data.uf || '').toString().toUpperCase().slice(0,2);
        const ibge = data.city_ibge_code || data.ibge || '';
        setManualForm(f => ({
          ...f,
          logradouro: logradouro || f.logradouro,
          bairro: bairro || f.bairro,
          cidade: cidade || f.cidade,
          uf: uf || f.uf,
          codigo_municipio_ibge: ibge || f.codigo_municipio_ibge,
        }));
      }
    } finally {
      setManualCepLoading(false);
    }
  };

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

      const enriched = base.map(r => {
        const bruto = Number(totals[r.id] || 0);
        const tipo = r?.desconto_tipo;
        const val = Number(r?.desconto_valor || 0);
        let desc = 0;
        if (tipo === 'percentual' && val > 0) desc = bruto * (val/100);
        else if (tipo === 'fixo' && val > 0) desc = val;
        const totalComDesconto = Math.max(0, bruto - desc);
        return {
          ...r,
          total_sem_desconto: bruto,
          total: totalComDesconto,
          mesaNumero: mapMesaNumero.get(r.mesa_id),
          clientesStr: Array.isArray(namesByComanda[r.id]) ? namesByComanda[r.id].join(', ') : (namesByComanda[r.id] || ''),
          finalizadorasStr: Array.isArray(finsByComanda[r.id]) ? finsByComanda[r.id].join(', ') : (finsByComanda[r.id] || ''),
        };
      });

      setRows(enriched);
    } catch (e) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [codigoEmpresa, from, to]);

  const loadNfeRows = async () => {
    if (!codigoEmpresa) return;
    setNfeLoading(true);
    try {
      let q = supabase
        .from('notas_fiscais')
        .select('*')
        .eq('codigo_empresa', codigoEmpresa)
        .eq('modelo', '55')
        .order('id', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      setNfeRows(data || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar NF-e', description: e.message, variant: 'destructive' });
    } finally {
      setNfeLoading(false);
    }
  };

  useEffect(() => { loadNfeRows(); }, [codigoEmpresa]);

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
    const t = (debouncedSearch||'').trim().toLowerCase();
    const statusOk = (r) => {
      const s = r.nf_status || 'pendente';
      if (focusPendRej) return (s === 'pendente' || s === 'rejeitada');
      if (statusFilter === 'all') return true;
      return s === statusFilter;
    };
    return (rows||[]).filter(r => statusOk(r)).filter(r => {
      if (!t) return true;
      const mesa = String(r.mesaNumero||'');
      const clientes = String(r.clientesStr||'');
      const fins = String(r.finalizadorasStr||'');
      return (r.xml_chave||'').toLowerCase().includes(t)
        || String(r.nf_numero||'').includes(t)
        || mesa.toLowerCase().includes(t)
        || clientes.toLowerCase().includes(t)
        || fins.toLowerCase().includes(t);
    });
  }, [rows, debouncedSearch, statusFilter, focusPendRej]);

  const nfeFiltered = useMemo(() => {
    const t = (debouncedSearch||'').trim().toLowerCase();
    return (nfeRows||[]).filter(r => {
      const rawStatus = (r.status || 'pendente').toLowerCase();
      if (focusPendRej) {
        if (!['pendente','rejeitada','rascunho'].includes(rawStatus)) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'pendente') {
          if (!['pendente','rascunho'].includes(rawStatus)) return false;
        } else if (statusFilter === 'processando') {
          if (rawStatus !== 'processando') return false;
        } else if (statusFilter === 'autorizada') {
          if (!['autorizada','emitida'].includes(rawStatus)) return false;
        } else if (statusFilter === 'rejeitada') {
          if (rawStatus !== 'rejeitada') return false;
        } else if (statusFilter === 'cancelada') {
          if (rawStatus !== 'cancelada') return false;
        }
      }

      if (from || to) {
        const dateStr = r.data_emissao || r.criado_em || r.created_at || null;
        if (dateStr) {
          const d = new Date(dateStr);
          if (from) {
            const f = new Date(from + 'T00:00:00');
            if (d < f) return false;
          }
          if (to) {
            const tt = new Date(to + 'T23:59:59.999');
            if (d > tt) return false;
          }
        }
      }

      if (!t) return true;
      const numero = String(r.numero ?? '').toLowerCase();
      const serie = String(r.serie ?? '').toLowerCase();
      const destinatarioNome = String(r.destinatario?.nome || '').toLowerCase();
      const origemDesc = r.origem === 'comanda' ? `comanda ${r.comanda_id ?? ''}` : 'manual';
      const origem = origemDesc.toLowerCase();
      return numero.includes(t)
        || serie.includes(t)
        || destinatarioNome.includes(t)
        || origem.includes(t);
    });
  }, [nfeRows, debouncedSearch, statusFilter, focusPendRej, from, to]);

  const sorted = useMemo(() => {
    const a = [...(filtered||[])];
    const dir = sortDir === 'asc' ? 1 : -1;
    return a.sort((x,y) => {
      const sx = (v) => (v==null? '' : String(v).toLowerCase());
      const nx = (v) => (v==null? 0 : Number(v)||0);
      if (sortBy === 'aberto_em') return ((new Date(x.aberto_em)).getTime() - (new Date(y.aberto_em)).getTime()) * dir;
      if (sortBy === 'nf_status') return (sx(x.nf_status).localeCompare(sx(y.nf_status))) * dir;
      if (sortBy === 'mesa') return (nx(x.mesaNumero) - nx(y.mesaNumero)) * dir;
      if (sortBy === 'nf_numero') return (nx(x.nf_numero) - nx(y.nf_numero)) * dir;
      if (sortBy === 'total') return ((Number(x.total||x.total_com_desconto||0)) - (Number(y.total||y.total_com_desconto||0))) * dir;
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  const nfeSorted = useMemo(() => {
    const a = [...(nfeFiltered||[])];
    return a.sort((x,y) => {
      const dx = x.data_emissao || x.criado_em || x.created_at || null;
      const dy = y.data_emissao || y.criado_em || y.created_at || null;
      const nx = dx ? new Date(dx).getTime() : 0;
      const ny = dy ? new Date(dy).getTime() : 0;
      return ny - nx;
    });
  }, [nfeFiltered]);

  const totalPages = Math.max(1, Math.ceil((sorted||[]).length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (sorted||[]).slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const nfePaged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (nfeSorted||[]).slice(start, start + pageSize);
  }, [nfeSorted, page, pageSize]);
  const nfeTotalPages = Math.max(1, Math.ceil((nfeSorted||[]).length / pageSize));
  const allPageSelected = useMemo(() => {
    if (!paged || paged.length === 0) return false;
    return paged.every(r => selectedIds.includes(r.id));
  }, [paged, selectedIds]);
  const toggleAllPage = (checked) => {
    setSelectedIds(prev => {
      if (checked) {
        const add = (paged||[]).map(r => r.id);
        return Array.from(new Set([...(prev||[]), ...add]));
      }
      const idsOnPage = new Set((paged||[]).map(r => r.id));
      return (prev||[]).filter(id => !idsOnPage.has(id));
    });
  };
  const onRowClick = (id) => {
    // Clique na linha: apenas focar a linha e abrir/fechar detalhes
    setSelectedId(id);
    setOpenDetails(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectedRows = useMemo(() => (rows||[]).filter(r => selectedIds.includes(r.id)), [rows, selectedIds]);
  const eligibleEmitIds = useMemo(
    () => selectedRows
      .filter(r => ['pendente','rejeitada'].includes(String(r.nf_status || 'pendente').toLowerCase()))
      .map(r => r.id),
    [selectedRows]
  );
  const eligibleConsultIds = useMemo(
    () => selectedRows
      .filter(r => ['processando','rejeitada','pendente','erro','autorizada'].includes(String(r.nf_status||'').toLowerCase()))
      .map(r=>r.id),
    [selectedRows]
  );
  const eligibleCancelIds = useMemo(
    () => selectedRows
      .filter(r => String(r.nf_status||'').toLowerCase() === 'autorizada')
      .map(r=>r.id),
    [selectedRows]
  );

  const hasSelection = selectedIds.length > 0;
  const allEmitEligible = hasSelection && eligibleEmitIds.length === selectedRows.length;
  const allConsultEligible = hasSelection && eligibleConsultIds.length === selectedRows.length;
  const allCancelEligible = hasSelection && eligibleCancelIds.length === selectedRows.length;

  const currentViewRow = useMemo(() => {
    const pickId = selectedId || (selectedIds && selectedIds[0]);
    if (!pickId) return null;
    return (rows||[]).find(r => r.id === pickId) || null;
  }, [rows, selectedId, selectedIds]);
  const canViewSelected = !!currentViewRow && ['autorizada','cancelada'].includes(String(currentViewRow.nf_status||'').toLowerCase());

  // Elegibilidade para ações na aba NF-e (usa nfeRows)
  const selectedNfeRows = useMemo(
    () => (nfeRows||[]).filter(r => selectedIds.includes(r.id)),
    [nfeRows, selectedIds]
  );
  const eligibleNfeEmitIds = useMemo(
    () => selectedNfeRows
      .filter(r => {
        const s = String(r.status || 'rascunho').toLowerCase();
        return ['rascunho','pendente','rejeitada'].includes(s);
      })
      .map(r => r.id),
    [selectedNfeRows]
  );
  const eligibleNfeConsultIds = useMemo(
    () => selectedNfeRows
      .filter(r => {
        const s = String(r.status || 'rascunho').toLowerCase();
        // Permite consulta para qualquer NF-e que já saiu do estado "puro rascunho"
        return s !== 'rascunho';
      })
      .map(r => r.id),
    [selectedNfeRows]
  );
  const eligibleNfeCancelIds = useMemo(
    () => selectedNfeRows
      .filter(r => {
        const s = String(r.status || 'rascunho').toLowerCase();
        // Para NF-e tratamos 'emitida' como equivalente a 'autorizada' para cancelamento
        return ['autorizada','emitida'].includes(s);
      })
      .map(r => r.id),
    [selectedNfeRows]
  );

  const hasNfeSelection = selectedNfeRows.length > 0;
  const allNfeEmitEligible = hasNfeSelection && eligibleNfeEmitIds.length === selectedNfeRows.length;
  const allNfeConsultEligible = hasNfeSelection && eligibleNfeConsultIds.length === selectedNfeRows.length;
  const allNfeCancelEligible = hasNfeSelection && eligibleNfeCancelIds.length === selectedNfeRows.length;

  const currentViewNfeRow = useMemo(() => {
    const pickId = selectedId || (selectedIds && selectedIds[0]);
    if (!pickId) return null;
    return (nfeRows||[]).find(r => r.id === pickId) || null;
  }, [nfeRows, selectedId, selectedIds]);
  const canViewSelectedNfe = !!currentViewNfeRow && ['autorizada','emitida','cancelada'].includes(String(currentViewNfeRow.status||'').toLowerCase());

  const handleEmitBulk = async () => {
    if (!eligibleEmitIds.length) { toast({ title: 'Nenhum elegível', description: 'Selecione notas pendentes/rejeitadas para emitir.', variant: 'destructive' }); return; }
    const skipped = selectedIds.length - eligibleEmitIds.length;
    const msg = `Emitindo ${eligibleEmitIds.length} NFC-e elegíveis${skipped>0?` (ignorando ${skipped} não elegíveis)`:''}...`;
    toast({ title: 'Emissão de NFC-e', description: msg });
    for (const id of eligibleEmitIds) {
      // eslint-disable-next-line no-await-in-loop
      await handleEmit(id);
    }
  };
  const handleConsultBulk = async () => {
    if (!eligibleConsultIds.length) { toast({ title: 'Nenhum elegível', description: 'Selecione notas para consultar.', variant: 'destructive' }); return; }
    const skipped = selectedIds.length - eligibleConsultIds.length;
    const msg = `Consultando ${eligibleConsultIds.length} NFC-e${skipped>0?` (ignorando ${skipped})`:''}...`;
    toast({ title: 'Consulta de NFC-e', description: msg });
    for (const id of eligibleConsultIds) {
      // eslint-disable-next-line no-await-in-loop
      await handleConsult(id);
    }
  };
  const handleCancelBulk = async () => {
    if (!eligibleCancelIds.length) { toast({ title: 'Nenhum elegível', description: 'Selecione NFC-e autorizadas para cancelar.', variant: 'destructive' }); return; }
    // Por enquanto, cancelar uma NFC-e por vez usando o diálogo de motivo
    const firstId = eligibleCancelIds[0];
    setCancelNfceId(firstId);
    setCancelNfceMotivo('');
  };

  const exportCsv = (scope = 'filtered') => {
    const delimiter = ';'; // pt-BR Excel geralmente espera ponto e vírgula
    const escapeCell = (v) => {
      let s = String(v ?? '');
      s = s.replaceAll('"','""');
      s = s.replaceAll(';','|'); // evita quebrar colunas
      return `"${s}"`;
    };
    const headers = ['Comanda','Mesa','Clientes','Finalizadoras','StatusNF','Numero','Serie','Chave','AutorizadoEm','CanceladoEm','Total'];
    const lines = [headers.join(delimiter)];

    let base = [];
    if (scope === 'selected') {
      const set = new Set(selectedIds);
      if (selectedId) set.add(selectedId);
      base = (rows || []).filter(r => set.has(r.id));
    } else {
      base = filtered || [];
    }

    base.forEach(r => {
      const comandaLabel = r.mesaNumero ? `Mesa ${r.mesaNumero}` : 'Balcão';
      const row = [
        comandaLabel,
        r.mesaNumero ?? '',
        (r.clientesStr||''),
        (r.finalizadorasStr||''),
        r.nf_status ?? '',
        r.nf_numero ?? '',
        r.nf_serie ?? '',
        r.xml_chave ?? '',
        r.nf_autorizado_em ?? '',
        r.nf_cancelado_em ?? '',
        String(r.total ?? '')
      ];
      lines.push(row.map(escapeCell).join(delimiter));
    });
    const blob = new Blob(["\uFEFF" + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `central-fiscal-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s) => {
    const v = (s || 'pendente').toLowerCase();
    const map = {
      // Rascunho: cinza neutro, distinto do amarelo de "pendente"
      rascunho: 'bg-surface-2 text-text-secondary border border-border/60',
      pendente: 'bg-amber-500/15 text-amber-400 border border-amber-400/30',
      processando: 'bg-blue-500/15 text-blue-400 border border-blue-400/30',
      autorizada: 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/30',
      rejeitada: 'bg-red-500/15 text-red-400 border border-red-400/30',
      cancelada: 'bg-red-500/15 text-red-400 border border-red-400/30',
    };
    return map[v] || map.pendente;
  };

  const openPreview = async (comandaId) => {
    try {
      setPreLoading(true);
      setPreComandaId(comandaId);
      const emp = codigoEmpresa || getEmpresaCodigoFromCache();
      const { empresa, payload, missing } = await generateNfcePayloadPreview({ comandaId, codigoEmpresa: emp });
      setPrePayload(payload);
      setPreMissing(missing || []);
      try {
        const cfg = getTransmiteNotaConfigFromEmpresa(empresa||{});
        const ok = !!cfg && (cfg.cnpj||'').length===14 && !!cfg.apiKey && !!cfg.baseUrl;
        setPreEmpresaCfgOk(ok);
        setPreEligible(ok && (!missing || missing.length===0));
      } catch { setPreEmpresaCfgOk(false); setPreEligible(false); }
      setPreMissingCache(prev => ({ ...prev, [comandaId]: (missing||[]).length }));
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

  const openNfe = async (id) => {
    setNfeComandaId(id);
    try {
      const { data: emp } = await supabase
        .from('empresas')
        .select('nfe_serie, ambiente, uf')
        .eq('codigo_empresa', codigoEmpresa)
        .single();
      setNfeForm(f => ({ ...f, serie: String(emp?.nfe_serie || '1') }));
    } catch {}
    setNfeXml('');
    setNfeOpen(true);
  };

  const generateNfe = async () => {
    if (!nfeComandaId) return;
    try {
      setNfeGenerating(true);
      // Reservar numeração NF-e (modelo 55) usando série atual do formulário/empresa
      const serieNum = Number(nfeForm.serie || 1) || 1;
      let numeroReservado = null;
      try {
        try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'reservar_numero', modelo: '55', comanda_id: nfeComandaId, status: 'start', mensagem: `serie=${serieNum}` }); } catch {}
        const { data: nr, error: nrErr } = await supabase.rpc('reservar_numero_fiscal', { p_modelo: '55', p_serie: serieNum, p_codigo_empresa: codigoEmpresa });
        if (nrErr) throw nrErr;
        numeroReservado = Number(nr);
        try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'reservar_numero', modelo: '55', comanda_id: nfeComandaId, status: 'success', mensagem: `numero=${numeroReservado}` }); } catch {}
      } catch (e) {
        try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'reservar_numero', modelo: '55', comanda_id: nfeComandaId, status: 'error', mensagem: e?.message || String(e) }); } catch {}
        toast({ title: 'Falha ao reservar numeração NF-e', description: e?.message || String(e), variant: 'destructive' });
        setNfeGenerating(false);
        return;
      }
      setNfeForm(f => ({ ...f, nNF: String(numeroReservado), serie: String(serieNum) }));
      const overrides = { ...nfeForm, nNF: String(numeroReservado), serie: String(serieNum), idDest: (nfeForm.idDest==='auto' || !nfeForm.idDest) ? undefined : nfeForm.idDest };
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'gerar_xml', modelo: '55', comanda_id: nfeComandaId, status: 'start', request: overrides }); } catch {}
      const xml = await gerarXMLNFe({ comandaId: nfeComandaId, codigoEmpresa, modelo: '55', overrides });
      setNfeXml(xml);
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'gerar_xml', modelo: '55', comanda_id: nfeComandaId, status: 'success' }); } catch {}
      toast({ title: 'XML NF-e gerado' });
    } catch (e) {
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'gerar_xml', modelo: '55', comanda_id: nfeComandaId, status: 'error', mensagem: e?.message || String(e) }); } catch {}
      toast({ title: 'Falha ao gerar XML', description: e.message, variant: 'destructive' });
    } finally { setNfeGenerating(false); }
  };

  const saveNfeXml = async () => {
    if (!nfeXml || !nfeComandaId) return;
    try {
      setNfeSaving(true);
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'salvar_xml', modelo: '55', comanda_id: nfeComandaId, status: 'start' }); } catch {}
      const path = `nfe/${codigoEmpresa}/${nfeComandaId}-${Date.now()}.xml`;
      const blob = new Blob([nfeXml], { type: 'text/xml;charset=utf-8' });
      const { error: upErr } = await supabase.storage.from('fiscal').upload(path, blob, { contentType: 'text/xml' });
      if (upErr) throw upErr;
      const { data: pub } = await supabase.storage.from('fiscal').getPublicUrl(path);
      const url = pub?.publicUrl || null;
      await supabase
        .from('comandas')
        .update({ nf_xml_url: url || path, nf_status: 'pendente' })
        .eq('id', nfeComandaId)
        .eq('codigo_empresa', codigoEmpresa);
      try {
        const row = rows.find(r => r.id === nfeComandaId);
        const total = Number(row?.total || 0);
        const { ambiente: amb } = getTransmiteNotaConfigFromEmpresa(empresaInfo || {});
        await supabase.from('notas_fiscais').insert({
          codigo_empresa: codigoEmpresa,
          origem: 'comanda',
          comanda_id: nfeComandaId,
          modelo: '55',
          numero: nfeForm.nNF ? Number(nfeForm.nNF) : null,
          serie: nfeForm.serie ? Number(nfeForm.serie) : null,
          status: 'pendente',
          xml_url: url || path,
          pdf_url: null,
          valor_total: isFinite(total) ? total : null,
          destinatario: null,
          ambiente: amb || 'homologacao',
        });
      } catch {}
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'salvar_xml', modelo: '55', comanda_id: nfeComandaId, status: 'success' }); } catch {}
      toast({ title: 'XML salvo', description: url ? 'Link público gerado.' : 'Arquivo salvo no Storage.' });
      await load();
    } catch (e) {
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'salvar_xml', modelo: '55', comanda_id: nfeComandaId, status: 'error', mensagem: e?.message || String(e) }); } catch {}
      toast({ title: 'Falha ao salvar XML', description: e.message, variant: 'destructive' });
    } finally { setNfeSaving(false); }
  };

  const handleEmit = async (id) => {
    try {
      setLoading(true);
      const { empresa, payload, missing } = await generateNfcePayloadPreview({ comandaId: id, codigoEmpresa });
      if (missing && missing.length) {
        toast({ title: 'Pendências para emissão', description: missing.join(', '), variant: 'destructive' });
        return;
      }
      // Se a comanda estiver em estado fiscal quebrado (erro/rejeitada sem chave/número/série), limpa antes de tentar emitir de novo
      try {
        const row = rows.find(r => r.id === id);
        const brokenStatus = row && (row.nf_status === 'erro' || row.nf_status === 'rejeitada');
        const noKey = !row?.xml_chave;
        const noNumber = !row?.nf_numero;
        const noSerie = !row?.nf_serie;
        if (row && brokenStatus && noKey && noNumber && noSerie) {
          await updateComanda(id, {
            nf_status: null,
            nf_modelo: null,
            nf_serie: null,
            nf_numero: null,
            nf_protocolo: null,
            xml_chave: null,
            nf_xml_url: null,
            nf_pdf_url: null,
            xml_protocolo: null,
          });
        }
      } catch {}
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'emitir', modelo: '65', comanda_id: id, status: 'start', request: payload?.Dados || null }); } catch {}
      const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
      if (!cfg.cnpj || cfg.cnpj.length !== 14) {
        toast({ title: 'CNPJ inválido', description: 'CNPJ da empresa está ausente ou inválido (14 dígitos).', variant: 'destructive' });
        return;
      }
      // Reserva de numeração (modelo 65 NFC-e)
      const serieNum = Number(empresa?.nfce_serie || empresa?.nfe_serie || 1) || 1;
      let reservado = null;
      try {
        const { data: nr, error: nrErr } = await supabase.rpc('reservar_numero_fiscal', { p_modelo: '65', p_serie: serieNum, p_codigo_empresa: codigoEmpresa });
        if (nrErr) throw nrErr;
        reservado = Number(nr);
      } catch (nrE) {
        toast({ title: 'Falha ao reservar numeração', description: nrE?.message || String(nrE), variant: 'destructive' });
        return;
      }
      // Persistir na comanda e injetar no payload
      await updateComanda(id, { nf_numero: reservado, nf_serie: serieNum });
      try {
        if (payload && payload.Dados) {
          payload.Dados.Numero = reservado;
          payload.Dados.Serie = serieNum;
        }
      } catch {}
      await updateComanda(id, { nf_status: 'processando' });
      let resp;
      try {
        resp = await enviarNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: payload.Dados });
        console.log('[FiscalHub][NFC-e emitir] resposta completa:', resp);
      } catch (err) {
        console.error('[FiscalHub][NFC-e emitir] erro ao enviar NFC-e:', err);
        // Não assumir rejeição fiscal; pode ter sido erro de transporte. Marcar como 'processando' até confirmar.
        await updateComanda(id, { nf_status: 'processando' });
        try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'emitir', modelo: '65', comanda_id: id, status: 'error', mensagem: err?.message || String(err) }); } catch {}
        // Fallback: consultar imediatamente, preferindo SearchKey (xml_protocolo). Se ausente, consultar por número/série para obtê-la, e depois buscar PDF/XML usando SearchKey.
        try {
          const row = rows.find(r => r.id === id) || {};
          let searchKey = row.xml_protocolo || null;
          let consulta = null;
          if (searchKey) {
            consulta = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { searchkey: searchKey, SearchKey: searchKey } });
          } else {
            const numeroF = row.nf_numero || reservado;
            const serieF = row.nf_serie || serieNum;
            const dc = numeroF && serieF ? { numero: numeroF, Numero: numeroF, serie: serieF, Serie: serieF } : (row.xml_chave ? { chave: row.xml_chave, Chave: row.xml_chave } : {});
            consulta = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: dc });
            const sk = consulta?.searchkey || consulta?.SearchKey || consulta?.searchKey || null;
            if (sk) { searchKey = sk; await updateComanda(id, { xml_protocolo: sk }); }
          }
          const rawStatus = String(consulta?.status || consulta?.Status || consulta?.cStat || '').toLowerCase();
          const authorized = !!(consulta?.autorizada || consulta?.Autorizada || consulta?.sucesso || consulta?.Sucesso || rawStatus === '100');
          if (authorized) {
            const chaveFb = consulta?.chave || consulta?.Chave || row.xml_chave || null;
            const pdfFb = consulta?.pdf_url || consulta?.PdfUrl || null;
            const xmlFb = consulta?.xml_url || consulta?.XmlUrl || null;
            const numeroFb = consulta?.numero || consulta?.Numero || row.nf_numero || null;
            const serieFb = consulta?.serie || consulta?.Serie || row.nf_serie || null;
            await updateComanda(id, { nf_status: 'autorizada', xml_chave: chaveFb, nf_pdf_url: pdfFb, nf_xml_url: xmlFb, nf_numero: numeroFb, nf_serie: serieFb });
            try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'consultar', modelo: '65', comanda_id: id, status: 'success', response: consulta || null }); } catch {}
            toast({ title: 'NFC-e autorizada', description: 'Documento autorizado após fallback de consulta.', variant: 'success' });
            await load();
            return; // evitar lançar erro
          }
          // Fallback 2: tentar PDF/XML com SearchKey se disponível; caso contrário, por número/série
          const numeroF = row.nf_numero || reservado;
          const serieF = row.nf_serie || serieNum;
          let pdf = null, xml = null, chave = row.xml_chave || null;
          if (searchKey) {
            try { const rpdf = await consultarPdfNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { searchkey: searchKey, SearchKey: searchKey } }); console.log('[FiscalHub][NFC-e emitir->PDF fallback] resp:', rpdf); pdf = rpdf?.pdf_url || rpdf?.PdfUrl || null; chave = rpdf?.chave || rpdf?.Chave || chave; } catch {}
            try { const rxml = await consultarXmlNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { searchkey: searchKey, SearchKey: searchKey } }); console.log('[FiscalHub][NFC-e emitir->XML fallback] resp:', rxml); xml = rxml?.xml_url || rxml?.XmlUrl || null; chave = chave || rxml?.chave || rxml?.Chave || chave; } catch {}
          } else {
            try { const rpdf = await consultarPdfNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { numero: numeroF, Numero: numeroF, serie: serieF, Serie: serieF } }); console.log('[FiscalHub][NFC-e emitir->PDF fallback] resp:', rpdf); pdf = rpdf?.pdf_url || rpdf?.PdfUrl || null; chave = rpdf?.chave || rpdf?.Chave || chave; } catch {}
            try { const rxml = await consultarXmlNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { numero: numeroF, Numero: numeroF, serie: serieF, Serie: serieF } }); console.log('[FiscalHub][NFC-e emitir->XML fallback] resp:', rxml); xml = rxml?.xml_url || rxml?.XmlUrl || null; chave = chave || rxml?.chave || rxml?.Chave || chave; } catch {}
          }
          if (pdf || xml || chave) {
            await updateComanda(id, { nf_status: (pdf||xml) ? 'autorizada' : 'processando', nf_pdf_url: pdf || row.nf_pdf_url, nf_xml_url: xml || row.nf_xml_url, xml_chave: chave || row.xml_chave, nf_numero: numeroF, nf_serie: serieF });
            if (pdf) { toast({ title: 'NFC-e autorizada', description: 'DANFE encontrada (fallback).', variant: 'success' }); window.open(pdf, '_blank'); }
            await load();
            return; // evitar lançar erro
          }
        } catch {}
        throw err;
      }
      const chave = resp?.chave || resp?.Chave || resp?.chaveAcesso || null;
      const numero = resp?.numero || resp?.Numero || null;
      const serie = resp?.serie || resp?.Serie || null;
      const pdf = resp?.pdf_url || resp?.PdfUrl || null;
      const xml = resp?.xml_url || resp?.XmlUrl || null;
      const protocolo = resp?.protocolo || resp?.Protocolo || null;
      const searchKeyResp = resp?.searchkey || resp?.SearchKey || resp?.searchKey || null;
      const authorized = !!(resp?.autorizada || resp?.Autorizada || resp?.sucesso || resp?.Sucesso || pdf || xml);
      await updateComanda(id, { nf_status: authorized ? 'autorizada' : 'processando', xml_chave: chave, nf_numero: numero, nf_serie: serie, nf_pdf_url: pdf, nf_xml_url: xml, xml_protocolo: protocolo || searchKeyResp });
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'emitir', modelo: '65', comanda_id: id, status: 'success', response: resp || null }); } catch {}
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
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'consultar', modelo: '65', comanda_id: id, status: 'start', request: row.xml_protocolo ? { searchkey: row.xml_protocolo } : { numero: row.nf_numero, serie: row.nf_serie } }); } catch {}

      let resp = null;
      let authorized = false;
      let rawStatus = '';
      let msg = 'Consulta retornada';
      let pdf = row.nf_pdf_url;
      let xml = row.nf_xml_url;
      let chave = row.xml_chave;
      let numero = row.nf_numero;
      let serie = row.nf_serie;
      const hasSearchKey = !!row.xml_protocolo; // usamos xml_protocolo para armazenar searchkey quando disponível

      // 1) Se já temos SearchKey, usar nfce_consultar corretamente
      if (hasSearchKey) {
        try {
          resp = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { SearchKey: row.xml_protocolo, searchkey: row.xml_protocolo } });
          console.log('[FiscalHub][NFC-e consulta] resposta completa:', resp);
          rawStatus = String(resp?.status || resp?.Status || resp?.cStat || '').toLowerCase();
          msg = resp?.xMotivo || resp?.mensagem || resp?.message || msg;
          const resultado = resp?.resultado || resp?.Resultado || null;
          if (resultado) {
            if (resultado.status) {
              rawStatus = String(resultado.status).toLowerCase();
            }
            if (resultado.motivo || resultado.Motivo) {
              msg = resultado.motivo || resultado.Motivo || msg;
            }
          }
          authorized = !!(resp?.autorizada || resp?.Autorizada || resp?.sucesso || resp?.Sucesso || rawStatus === '100');
          pdf = resp?.pdf_url || resp?.PdfUrl || pdf;
          xml = resp?.xml_url || resp?.XmlUrl || xml;
          chave = resp?.chave || resp?.Chave || chave;
          numero = resp?.numero || resp?.Numero || numero;
          serie = resp?.serie || resp?.Serie || serie;
        } catch (e) {
          console.warn('[FiscalHub][NFC-e consulta] consulta por SearchKey falhou, tentando PDF/XML direto', e);
        }
      }

      // 2) Se ainda sem PDF/XML, ir direto para PDF/XML por numero/serie (sem nfce_consultar)
      if (!pdf && !xml) {
        const baseDados = hasSearchKey
          ? { searchkey: (row.xml_protocolo || ''), SearchKey: (row.xml_protocolo || '') }
          : { numero, Numero: numero, serie, Serie: serie };
        try {
          const rpdf = await consultarPdfNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: baseDados });
          console.log('[FiscalHub][NFC-e consulta] PDF resp:', rpdf);
          pdf = rpdf?.pdf_url || rpdf?.PdfUrl || pdf;
          chave = rpdf?.chave || rpdf?.Chave || chave;
        } catch (e) { console.warn('[FiscalHub][NFC-e consulta] PDF erro:', e); }
        try {
          const rxml = await consultarXmlNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: baseDados });
          console.log('[FiscalHub][NFC-e consulta] XML resp:', rxml);
          xml = rxml?.xml_url || rxml?.XmlUrl || xml;
          chave = chave || rxml?.chave || rxml?.Chave || chave;
        } catch (e) { console.warn('[FiscalHub][NFC-e consulta] XML erro:', e); }
        authorized = !!(pdf || xml || authorized);
        rawStatus = authorized ? '100' : (row.nf_status || 'pendente');
        msg = authorized ? 'Documento localizado' : msg;
      }

      let finalStatus = row.nf_status || 'processando';
      if (authorized) finalStatus = 'autorizada';
      else if ((rawStatus && rawStatus.includes && rawStatus.includes('rejeit')) || (typeof msg === 'string' && msg.toLowerCase().includes('rejeicao'))) finalStatus = 'rejeitada';
      else if (rawStatus === 'erro') finalStatus = row.nf_status || 'pendente'; // não degradar para rejeitada sem evidência
      else if (typeof rawStatus === 'string' && rawStatus) finalStatus = rawStatus;

      await updateComanda(id, { nf_status: finalStatus, nf_pdf_url: pdf, nf_xml_url: xml, xml_chave: chave, nf_numero: numero, nf_serie: serie });
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'consultar', modelo: '65', comanda_id: id, status: 'success', response: resp || null }); } catch {}
      toast({ title: authorized ? 'NFC-e autorizada' : `Status: ${rawStatus || finalStatus}`, description: msg, variant: authorized ? 'success' : 'warning' });
      await load();
    } catch (e) { toast({ title: 'Falha ao consultar', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleCancel = async (id, motivoText) => {
    try {
      const motivo = (motivoText || '').trim();
      if (!motivo) { toast({ title: 'Informe o motivo do cancelamento', variant: 'warning' }); return; }
      setLoading(true);
      const { empresa } = await generateNfcePayloadPreview({ comandaId: id, codigoEmpresa });
      const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
      const row = rows.find(r => r.id === id);
      const baseDados = row && row.xml_chave
        ? { chave: row.xml_chave, motivo }
        : { numero: row?.nf_numero, serie: row?.nf_serie, motivo };
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'cancelar', modelo: '65', comanda_id: id, status: 'start', request: baseDados }); } catch {}

      let resp = await cancelarNfce({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, cnpj: cfg.cnpj, dados: baseDados });

      // Se provedor pedir SearchKey (erro 1301 / campo searchkey) e tivermos xml_protocolo, tentar novamente usando searchkey
      try {
        const isErroNegocio = resp && typeof resp.status === 'string' && /erro/i.test(resp.status);
        const cod = resp?.codigo || resp?.Codigo || '';
        const campo = (resp?.campo || resp?.Campo || '').toString().toLowerCase();
        const precisaSK = isErroNegocio && (cod === '1301' || campo === 'searchkey');
        if (precisaSK && row?.xml_protocolo) {
          const dadosSK = { searchkey: row.xml_protocolo, SearchKey: row.xml_protocolo, motivo };
          try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'cancelar', modelo: '65', comanda_id: id, status: 'retry_searchkey', request: dadosSK }); } catch {}
          resp = await cancelarNfce({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, cnpj: cfg.cnpj, dados: dadosSK });
        }
      } catch {}

      const isErroFinal = resp && typeof resp.status === 'string' && /erro/i.test(resp.status);
      if (isErroFinal) {
        const cod = resp?.codigo || resp?.Codigo || '';
        const campo = resp?.campo || resp?.Campo || '';
        const descr = resp?.descricao || resp?.Descricao || resp?.mensagem || resp?.message || 'Falha ao cancelar NFC-e';
        const msgErr = [campo, descr].filter(Boolean).join(' • ');
        toast({ title: `Erro ao cancelar${cod ? ` ${cod}` : ''}`, description: msgErr, variant: 'destructive' });
        try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'cancelar', modelo: '65', comanda_id: id, status: 'business_error', response: resp || null }); } catch {}
        return;
      }

      await updateComanda(id, { nf_status: 'cancelada' });
      try { await supabase.from('auditoria_fiscal').insert({ codigo_empresa: codigoEmpresa, acao: 'cancelar', modelo: '65', comanda_id: id, status: 'success', response: resp || null }); } catch {}
      toast({ title: 'NFC-e cancelada' });
      await load();
    } catch (e) { toast({ title: 'Falha ao cancelar', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="relative p-4">
      <Helmet><title>Central Fiscal</title></Helmet>
      {false && (
        <div className="absolute inset-0 z-[10] flex justify-center items-start pt-10 pb-8 pointer-events-auto">
          {/* Fundo escurecido e borrado, semelhante ao overlay da Ísis */}
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

          {/* Card central */}
          <div className="relative max-w-xl w-[min(92vw,640px)] rounded-2xl border border-warning/50 bg-gradient-to-br from-surface via-surface-2 to-surface shadow-2xl px-6 py-7 text-center flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-warning/10 border border-warning/40 text-warning text-xs font-semibold uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-warning text-black flex items-center justify-center text-[11px] font-black">NF</span>
              <span>Central Fiscal em desenvolvimento</span>
            </div>

            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-warning/15 border border-warning/50 text-warning shadow-lg">
              <FileText className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text-primary">
                Em breve: painel fiscal completo diretamente no F7 Arena
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Estamos construindo a nova Central Fiscal para acompanhar emissões de NFC-e e NF-e, revisar pendências
                e acessar detalhes das notas em um só lugar.
              </p>
            </div>

            <div className="w-full text-left text-xs md:text-sm text-text-secondary bg-surface/70 border border-white/5 rounded-xl p-4 space-y-2">
              <p className="font-semibold text-text-primary mb-1">Enquanto isso, você pode:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Ajustar as configurações fiscais da empresa na aba <strong>Configuração Fiscal</strong>;</li>
                <li>Validar CNPJ, inscrição estadual e parâmetros da NFC-e/NF-e;</li>
                <li>Integrar ou revisar os dados da API de emissão fiscal.</li>
              </ul>
            </div>

            <p className="text-[11px] text-text-muted">
              Esta aba está em modo de desenvolvimento e ainda não deve ser utilizada em produção.
            </p>
          </div>
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab} className="w-full">

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-xl font-semibold">Central Fiscal</h1>
                {/* Botões ao lado do título apenas no mobile */}
                <div className="flex items-center gap-2 sm:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={()=>exportCsv('filtered')}
                    title="Exportar CSV das comandas/NF"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    <span>CSV</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => navigate('/configuracao-fiscal')}
                    title="Configuração Fiscal da Empresa"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-text-secondary mt-1 hidden sm:block">
                Acompanhe NFC-e e NF-e, pendências e cancelamentos em um só lugar.
              </p>
              {(() => {
                const cfg = getTransmiteNotaConfigFromEmpresa(empresaInfo || {});
                const amb = (cfg?.ambiente || 'homologacao');
                const label = amb === 'producao' ? 'Produção' : 'Homologação';
                const cls = amb === 'producao' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-600/30' : 'bg-amber-500/15 text-amber-700 border-amber-600/30';
                return (
                  <div className={["mt-2 inline-flex items-center gap-2 text-[11px] px-2 py-0.5 rounded-full border hidden sm:inline-flex", cls].join(' ')}>
                    <span>Ambiente:</span>
                    <strong>{label}</strong>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <TabsList className="hidden sm:inline-flex rounded-full bg-surface-2 px-1 py-0.5">
                <TabsTrigger value="nfce">NFC-e</TabsTrigger>
                <TabsTrigger value="nfe">NF-e</TabsTrigger>
                <TabsTrigger value="compras">NF-e Entrada (Compras)</TabsTrigger>
              </TabsList>
              {/* Botões permanecem na direita apenas no desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={()=>exportCsv('filtered')}
                  title="Exportar CSV das comandas/NF"
                >
                  <Download className="w-4 h-4 mr-1" />
                  <span>CSV</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => navigate('/configuracao-fiscal')}
                  title="Configuração Fiscal da Empresa"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs para telas pequenas */}
          <TabsList className="sm:hidden w-full justify-start rounded-lg bg-surface-2 px-1 py-1 overflow-x-auto">
            <TabsTrigger value="nfce" className="flex-1 min-w-[90px]">NFC-e</TabsTrigger>
            <TabsTrigger value="nfe" className="flex-1 min-w-[100px]">NF-e</TabsTrigger>
            <TabsTrigger value="compras" className="flex-1 min-w-[130px]">NF-e Entrada</TabsTrigger>
          </TabsList>

          {/* Filtros globais - versão desktop/tablet */}
          <div className="hidden sm:flex bg-surface-2/60 border border-border/70 rounded-xl px-3 py-3 flex flex-wrap items-center gap-3">
            {/* Busca global - apenas desktop */}
            <div className="hidden sm:flex items-center gap-2 min-w-[220px]">
              <Label className="text-xs text-text-secondary">Buscar</Label>
              <Input
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                placeholder="Chave, número, cliente..."
                className="w-[200px] sm:w-60 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-text-secondary">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-8 rounded-full text-xs">
                  <SelectValue placeholder="Selecionar status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="processando">Em andamento</SelectItem>
                  <SelectItem value="autorizada">Autorizada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-text-secondary">Período</Label>
              <div className="inline-flex items-center gap-2">
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-7 px-2 rounded-md bg-surface border border-border text-xs inline-flex items-center gap-1"
                    >
                      <span>
                        {from ? new Date(from + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={from ? new Date(from + 'T00:00:00') : undefined}
                      onSelect={(d) => {
                        if (!d) return;
                        const y = d.getFullYear();
                        const m = pad(d.getMonth() + 1);
                        const dy = pad(d.getDate());
                        setFrom(`${y}-${m}-${dy}`);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-text-secondary text-xs">até</span>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-7 px-2 rounded-md bg-surface border border-border text-xs inline-flex items-center gap-1"
                    >
                      <span>
                        {to ? new Date(to + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={to ? new Date(to + 'T00:00:00') : undefined}
                      onSelect={(d) => {
                        if (!d) return;
                        const y = d.getFullYear();
                        const m = pad(d.getMonth() + 1);
                        const dy = pad(d.getDate());
                        setTo(`${y}-${m}-${dy}`);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="hidden sm:inline-flex items-center gap-2 text-xs ml-auto">
              <Checkbox checked={focusPendRej} onCheckedChange={setFocusPendRej} className="rounded-full border-warning data-[state=checked]:bg-warning" />
              <span>Somente pendentes/rejeitadas</span>
            </div>
          </div>

          {/* Busca + botão de filtros - apenas mobile */}
          <div className="sm:hidden mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  placeholder="Chave, número, cliente..."
                  className="h-9 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setMobileFiltersOpen(v => !v)}
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
            {mobileFiltersOpen && (
              <div className="mt-2 bg-surface-2/60 border border-border/70 rounded-xl px-3 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-text-secondary">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 flex-1 rounded-full text-xs">
                      <SelectValue placeholder="Selecionar status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="processando">Em andamento</SelectItem>
                      <SelectItem value="autorizada">Autorizada</SelectItem>
                      <SelectItem value="rejeitada">Rejeitada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-text-secondary">Período</Label>
                  <div className="inline-flex items-center gap-2">
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-7 px-2 rounded-md bg-surface border border-border text-xs inline-flex items-center gap-1"
                        >
                          <span>
                            {from ? new Date(from + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={from ? new Date(from + 'T00:00:00') : undefined}
                          onSelect={(d) => {
                            if (!d) return;
                            const y = d.getFullYear();
                            const m = pad(d.getMonth() + 1);
                            const dy = pad(d.getDate());
                            setFrom(`${y}-${m}-${dy}`);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-text-secondary text-xs">até</span>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-7 px-2 rounded-md bg-surface border border-border text-xs inline-flex items-center gap-1"
                        >
                          <span>
                            {to ? new Date(to + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={to ? new Date(to + 'T00:00:00') : undefined}
                          onSelect={(d) => {
                            if (!d) return;
                            const y = d.getFullYear();
                            const m = pad(d.getMonth() + 1);
                            const dy = pad(d.getDate());
                            setTo(`${y}-${m}-${dy}`);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}
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

        <TabsContent value="nfce">

          <div className="flex items-center gap-2 mb-2 flex-wrap sm:flex-nowrap whitespace-normal sm:whitespace-nowrap relative z-10">
            {/* Bloco de selecionadas só no desktop/tablet */}
            <div className="hidden sm:flex ml-auto items-center gap-2 text-xs text-text-secondary">
              <span>Selecionadas: <strong className="text-text-primary">{selectedIds.length}</strong></span>
              <Button size="sm" variant="outline" onClick={()=>setSelectedIds([])} disabled={selectedIds.length===0}>Limpar</Button>
              <Button size="sm" variant="outline" onClick={()=>setSelectedIds(Array.from(new Set((filtered||[]).map(r=>r.id))))} disabled={(filtered||[]).length===0}>Selecionar filtrados</Button>
            </div>

            {/* Ações principais no mobile: Visualizar, Emitir e menu de Mais ações */}
            <div className="flex sm:hidden items-center gap-2 w-full justify-start">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!canConsult || (selectedIds.length===0 && !selectedId)}
                onClick={() => (async () => {
                  const pickId = selectedId || selectedIds[0];
                  const row = rows.find(r => r.id === pickId);
                  if (!row) return;
                  if (row.nf_pdf_url) { window.open(row.nf_pdf_url, '_blank'); return; }
                  try {
                    setLoading(true);
                    const { empresa } = await generateNfcePayloadPreview({ comandaId: row.id, codigoEmpresa });
                    const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
                    let pdf = null, xml = null, chave = row.xml_chave || null; let authorized = false;

                    // 1) Se tivermos SearchKey salva (xml_protocolo), tentar consulta completa por ela
                    if (row.xml_protocolo) {
                      try {
                        const resp = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { SearchKey: row.xml_protocolo, searchkey: row.xml_protocolo } });
                        console.log('[FiscalHub][NFC-e visualizar->consulta] resposta completa:', resp);
                        const rawStatus = String(resp?.status || resp?.Status || resp?.cStat || '').toLowerCase();
                        authorized = !!(resp?.autorizada || resp?.Autorizada || resp?.sucesso || resp?.Sucesso || rawStatus === '100');
                        pdf = resp?.pdf_url || resp?.PdfUrl || null;
                        xml = resp?.xml_url || resp?.XmlUrl || null;
                        chave = resp?.chave || resp?.Chave || chave;
                      } catch (e) {
                        console.warn('[FiscalHub][NFC-e visualizar] consulta por SearchKey falhou, tentando PDF/XML direto', e);
                      }
                    }

                    // 2) Se ainda não temos PDF/XML, buscar direto por número/série
                    if (!pdf && !xml) {
                      const baseDados = { numero: row.nf_numero, Numero: row.nf_numero, serie: row.nf_serie, Serie: row.nf_serie };
                      try {
                        const rpdf = await consultarPdfNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: baseDados });
                        pdf = rpdf?.pdf_url || rpdf?.PdfUrl || pdf;
                        chave = rpdf?.chave || rpdf?.Chave || chave;
                      } catch {}
                      try {
                        const rxml = await consultarXmlNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: baseDados });
                        xml = rxml?.xml_url || rxml?.XmlUrl || xml;
                        chave = chave || rxml?.chave || rxml?.Chave || chave;
                      } catch {}
                      authorized = !!(pdf || xml || authorized);
                    }
                    if (pdf || xml || authorized || chave) {
                      await supabase.from('comandas').update({
                        nf_pdf_url: pdf || row.nf_pdf_url,
                        nf_xml_url: xml || row.nf_xml_url,
                        xml_chave: chave || row.xml_chave,
                        nf_status: authorized ? 'autorizada' : (row.nf_status || null),
                      }).eq('id', row.id).eq('codigo_empresa', codigoEmpresa);
                    }
                    if (pdf) { window.open(pdf, '_blank'); }
                    else { toast({ title: 'Sem PDF disponível', description: 'Documento ainda não possui DANFE.', variant: 'destructive' }); }
                    await load();
                  } catch (e) { toast({ title: 'Falha ao visualizar', description: e.message, variant: 'destructive' }); }
                  finally { setLoading(false); }
                })()}
              >
                Visualizar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!canEmit || !allEmitEligible}
                onClick={() => {
                  if (!eligibleEmitIds.length) {
                    toast({ title: 'Nenhum elegível', description: 'Selecione notas pendentes/rejeitadas para emitir.', variant: 'destructive' });
                    return;
                  }
                  setEmitConfirmOpen(true);
                }}
              >
                Emitir ({eligibleEmitIds.length||0})
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="px-2" disabled={exporting && !canConsult && !canCancel}>
                    Mais
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={!canConsult || !allConsultEligible} onClick={handleConsultBulk}>
                    Consultar ({eligibleConsultIds.length||0})
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canCancel || !allCancelEligible} onClick={handleCancelBulk}>
                    <span className="text-destructive">Cancelar ({eligibleCancelIds.length||0})</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>exportCsv('selected')}>
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'selected', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'selected', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(filtered||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'filtered', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (filtrados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(filtered||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'filtered', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (filtrados)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Ações completas só no desktop/tablet */}
            <div className="hidden sm:flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!canViewSelected} onClick={() => (async () => {
                const pickId = selectedId || selectedIds[0];
                const row = rows.find(r => r.id === pickId);
                if (!row) return;
                if (row.nf_pdf_url) { window.open(row.nf_pdf_url, '_blank'); return; }
                try {
                  setLoading(true);
                  const { empresa } = await generateNfcePayloadPreview({ comandaId: row.id, codigoEmpresa });
                  const cfg = getTransmiteNotaConfigFromEmpresa(empresa);
                  let pdf = null, xml = null, chave = row.xml_chave || null; let authorized = false;

                  // 1) Se tivermos SearchKey salva (xml_protocolo), tentar consulta completa por ela
                  if (row.xml_protocolo) {
                    try {
                      const resp = await consultarEmissaoNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: { SearchKey: row.xml_protocolo, searchkey: row.xml_protocolo } });
                      console.log('[FiscalHub][NFC-e visualizar->consulta] resposta completa:', resp);
                      const rawStatus = String(resp?.status || resp?.Status || resp?.cStat || '').toLowerCase();
                      authorized = !!(resp?.autorizada || resp?.Autorizada || resp?.sucesso || resp?.Sucesso || rawStatus === '100');
                      pdf = resp?.pdf_url || resp?.PdfUrl || null;
                      xml = resp?.xml_url || resp?.XmlUrl || null;
                      chave = resp?.chave || resp?.Chave || chave;
                    } catch (e) {
                      console.warn('[FiscalHub][NFC-e visualizar] consulta por SearchKey falhou, tentando PDF/XML direto', e);
                    }
                  }

                  // 2) Se ainda não temos PDF/XML, buscar direto por número/série
                  if (!pdf && !xml) {
                    const baseDados = { numero: row.nf_numero, Numero: row.nf_numero, serie: row.nf_serie, Serie: row.nf_serie };
                    try {
                      const rpdf = await consultarPdfNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: baseDados });
                      pdf = rpdf?.pdf_url || rpdf?.PdfUrl || pdf;
                      chave = rpdf?.chave || rpdf?.Chave || chave;
                    } catch {}
                    try {
                      const rxml = await consultarXmlNfce({ baseUrl: cfg.baseUrl, cnpj: cfg.cnpj, dados: baseDados });
                      xml = rxml?.xml_url || rxml?.XmlUrl || xml;
                      chave = chave || rxml?.chave || rxml?.Chave || chave;
                    } catch {}
                    authorized = !!(pdf || xml || authorized);
                  }
                  if (pdf || xml || authorized || chave) {
                    await supabase.from('comandas').update({
                      nf_pdf_url: pdf || row.nf_pdf_url,
                      nf_xml_url: xml || row.nf_xml_url,
                      xml_chave: chave || row.xml_chave,
                      nf_status: authorized ? 'autorizada' : (row.nf_status || null),
                    }).eq('id', row.id).eq('codigo_empresa', codigoEmpresa);
                  }
                  if (pdf) { window.open(pdf, '_blank'); }
                  else { toast({ title: 'Sem PDF disponível', description: 'Documento ainda não possui DANFE.', variant: 'destructive' }); }
                  await load();
                } catch (e) { toast({ title: 'Falha ao visualizar', description: e.message, variant: 'destructive' }); }
                finally { setLoading(false); }
              })()}>Visualizar</Button>
              <Button
                size="sm"
                disabled={!canEmit || !allEmitEligible}
                onClick={() => {
                  if (!eligibleEmitIds.length) {
                    toast({ title: 'Nenhum elegível', description: 'Selecione notas pendentes/rejeitadas para emitir.', variant: 'destructive' });
                    return;
                  }
                  setEmitConfirmOpen(true);
                }}
              >
                Emitir ({eligibleEmitIds.length||0})
              </Button>
              <Button size="sm" variant="outline" disabled={!canConsult || !allConsultEligible} onClick={handleConsultBulk}>Consultar ({eligibleConsultIds.length||0})</Button>
              <Button size="sm" variant="destructive" disabled={!canCancel || !allCancelEligible} onClick={handleCancelBulk}>Cancelar ({eligibleCancelIds.length||0})</Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(selectedIds.length===0 && !selectedId)}
                onClick={()=>exportCsv('selected')}
              >
                Exportar CSV
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={exporting}>Ações</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportCsv('selected')}>
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'selected', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'selected', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(filtered||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'filtered', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (filtrados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(filtered||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfce', scope: 'filtered', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (filtrados)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Lista em cards para mobile (usa margem negativa para aproveitar mais a largura da tela) */}
          <div className="sm:hidden space-y-2 -mx-2">
            {(!paged || paged.length === 0) && (
              <div className="px-3 py-4 text-center text-text-muted border border-border rounded-md bg-surface">
                {loading ? 'Carregando...' : 'Nada por aqui'}
              </div>
            )}
            {paged.map((r) => {
              const s = r.nf_status || 'pendente';
              const statusBg =
                s === 'autorizada'
                  ? 'bg-emerald-500/5 border-emerald-500/40'
                  : s === 'cancelada'
                    ? 'bg-red-500/5 border-red-500/40'
                    : s === 'rejeitada'
                      ? 'bg-orange-500/5 border-orange-500/40'
                      : s === 'processando' || s === 'em_andamento'
                        ? 'bg-sky-500/5 border-sky-500/40'
                        : s === 'pendente'
                          ? 'bg-amber-500/5 border-amber-500/40'
                          : 'bg-surface border-border/70';
              return (
                <div
                  key={r.id}
                  className={`rounded-lg px-3 py-2 text-xs flex flex-col gap-1 border ${statusBg}`}
                  onClick={() => toggleRow(r.id, !isSelected(r.id))}
                >
                  <div className="flex items-start gap-2">
                    <div onClick={(e)=>{ e.stopPropagation(); toggleRow(r.id, !isSelected(r.id)); }} className="pt-1">
                      <Checkbox checked={isSelected(r.id)} onCheckedChange={(v)=>toggleRow(r.id, Boolean(v))} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">
                          {r.mesaNumero ? `Mesa ${r.mesaNumero}` : 'Balcão'}
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusBadge(s)}`}>{s}</span>
                      </div>
                      <div className="text-xs text-text-secondary flex items-center justify-between gap-2 mt-0.5">
                        <span>{fmtDate(r.aberto_em)}</span>
                        <span className="font-semibold text-text-primary">R$ {fmtMoney(r.total || r.total_com_desconto)}</span>
                      </div>
                      <div className="mt-1 text-xs text-text-secondary truncate" title={r.clientesStr || ''}>
                        <span className="text-text-muted">Cliente(s): </span>
                        <span className="text-text-primary">{r.clientesStr || '—'}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-text-secondary flex items-center justify-between gap-2">
                        <div className="truncate" title={r.finalizadorasStr || ''}>
                          <span className="text-text-muted">Pagamento: </span>
                          <span className="text-text-primary">{r.finalizadorasStr || '—'}</span>
                        </div>
                        <span className="whitespace-nowrap text-text-primary text-[11px]">{(r.nf_numero ?? '—')}/{(r.nf_serie ?? '—')}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-secondary" title={r.xml_chave || ''}>
                        <span className="text-text-muted block mb-0.5">Chave:</span>
                        <span className="text-text-primary text-[10px] truncate block">{r.xml_chave || '—'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Bloco inferior no mobile: apenas botões de acesso aos documentos, sem repetir informações */}
                  {(r.nf_pdf_url || r.nf_xml_url) && (
                    <div className="mt-2 border-t border-border/60 pt-2 text-[11px]">
                      <div className="flex gap-2">
                        {r.nf_pdf_url && (
                          <a className="inline-flex flex-1" href={r.nf_pdf_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="w-full">Abrir DANFE</Button>
                          </a>
                        )}
                        {r.nf_xml_url && (
                          <a className="inline-flex flex-1" href={r.nf_xml_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="w-full">Baixar XML</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabela clássica apenas para desktop/tablet */}
          <div className="hidden sm:block bg-surface rounded border border-border overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-2 text-text-secondary">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <Checkbox checked={allPageSelected} onCheckedChange={(v)=>toggleAllPage(Boolean(v))} />
                  </th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>{ setSortDir(sortBy==='aberto_em' && sortDir==='asc'?'desc':'asc'); setSortBy('aberto_em'); }}>Abertura {sortBy==='aberto_em' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>{ setSortDir(sortBy==='nf_status' && sortDir==='asc'?'desc':'asc'); setSortBy('nf_status'); }}>Status {sortBy==='nf_status' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                  <th className="hidden text-left px-3 py-2 cursor-pointer select-none" onClick={()=>{ setSortDir(sortBy==='mesa' && sortDir==='asc'?'desc':'asc'); setSortBy('mesa'); }}>Mesa {sortBy==='mesa' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                  <th className="text-left px-3 py-2">Clientes</th>
                  <th className="text-left px-3 py-2">Finalizadoras</th>
                  <th className="text-left px-3 py-2">Número/Série</th>
                  <th className="text-left px-3 py-2">Chave</th>
                  <th className="text-right px-3 py-2 cursor-pointer select-none" onClick={()=>{ setSortDir(sortBy==='total' && sortDir==='asc'?'desc':'asc'); setSortBy('total'); }}>Total {sortBy==='total' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {(!paged || paged.length===0) && (
                  <tr><td colSpan={10} className="px-3 py-4 text-center text-text-muted">{loading ? 'Carregando...' : 'Nada por aqui'}</td></tr>
                )}
                {paged.map(r => {
                  const s = r.nf_status || 'pendente';
                  return (
                    <React.Fragment key={r.id}>
                    <tr className={`border-t border-border/60 transition-colors ${selectedId===r.id ? 'bg-surface-2 ring-2 ring-[#FF7A1A]/60 rounded-md' : 'hover:bg-surface-2/50'}`} onClick={() => onRowClick(r.id)}>
                      <td className="px-3 py-2" onClick={(e)=>e.stopPropagation()}>
                        <Checkbox checked={isSelected(r.id)} onCheckedChange={(v)=>toggleRow(r.id, Boolean(v))} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.aberto_em)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusBadge(s)}`}>{s}</span>
                      </td>
                      <td className="hidden px-3 py-2 whitespace-nowrap">{r.mesaNumero ? `Mesa ${r.mesaNumero}` : 'Balcão'}</td>
                      <td className="px-3 py-2 whitespace-nowrap max-w-[240px] truncate" title={r.clientesStr||''}>{r.clientesStr || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap max-w-[240px] truncate" title={r.finalizadorasStr||''}>{r.finalizadorasStr || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{(r.nf_numero ?? '—')}/{(r.nf_serie ?? '—')}</td>
                      <td className="px-3 py-2 whitespace-nowrap max-w-[220px] truncate" title={r.xml_chave || ''}>
                        {r.xml_chave
                          ? `${String(r.xml_chave).slice(0, 8)}...${String(r.xml_chave).slice(-4)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">R$ {fmtMoney(r.total || r.total_com_desconto)}</td>
                    </tr>
                    {isOpenDetails(r.id) && (
                      <tr>
                        <td colSpan={10} className="px-3 py-3 bg-surface-2/40 border-t border-border">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="space-y-1">
                              <div><span className="text-text-secondary">Mesa: </span><span className="text-text-primary">{r.mesaNumero ? `Mesa ${r.mesaNumero}` : 'Balcão'}</span></div>
                              <div><span className="text-text-secondary">Clientes: </span><span className="text-text-primary">{r.clientesStr || '—'}</span></div>
                              <div><span className="text-text-secondary">Finalizadoras: </span><span className="text-text-primary">{r.finalizadorasStr || '—'}</span></div>
                            </div>
                            <div className="space-y-1">
                              <div><span className="text-text-secondary">Número/Série: </span><span className="text-text-primary">{(r.nf_numero ?? '—')}/{(r.nf_serie ?? '—')}</span></div>
                              <div className="flex items-center gap-2">
                                <span className="text-text-secondary">Chave: </span>
                                <span className="text-text-primary" title={r.xml_chave || ''}>{r.xml_chave || '—'}</span>
                              </div>
                              <div className="text-text-secondary mt-1">Total: <span className="text-text-primary">R$ {fmtMoney(r.total || r.total_com_desconto)}</span></div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                {r.nf_pdf_url && (<a className="inline-flex" href={r.nf_pdf_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">Abrir DANFE</Button></a>)}
                                {r.nf_xml_url && (<a className="inline-flex" href={r.nf_xml_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">Baixar XML</Button></a>)}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            {/* Info de página: compacto no mobile, detalhado no desktop */}
            <div className="sm:hidden text-[11px] text-text-secondary">Pág. {page} de {totalPages}</div>
            <div className="hidden sm:block text-xs text-text-secondary">Página {page} de {totalPages} • {sorted.length} registros</div>
            <div className="flex items-center gap-2 ml-auto">
              {/* Seletor de itens por página apenas em desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <label className="text-xs text-text-secondary">Itens por página</label>
                <select className="h-7 rounded-md bg-surface border border-border text-xs px-2" value={pageSize} onChange={e=>{ setPage(1); setPageSize(Number(e.target.value)||50); }}>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              {/* No mobile ficam só os botões de navegação */}
              <Button size="sm" variant="outline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="nfe">
          <div className="flex items-center gap-2 mb-3 flex-wrap whitespace-nowrap relative z-10">
            {/* Bloco de selecionadas só no desktop/tablet */}
            <div className="hidden sm:flex ml-auto items-center gap-2 text-xs text-text-secondary">
              <span>Selecionadas: <strong className="text-text-primary">{selectedIds.length}</strong></span>
              <Button size="sm" variant="outline" onClick={()=>setSelectedIds([])} disabled={selectedIds.length===0}>Limpar</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={()=>{
                  const base = (nfeSorted || []);
                  setSelectedIds(Array.from(new Set(base.map(r => r.id))));
                }}
                disabled={(nfeSorted || []).length===0}
              >
                Selecionar filtrados
              </Button>
            </div>

            {/* Ações principais no mobile: Visualizar, Emitir e menu de Mais ações */}
            <div className="flex sm:hidden items-center gap-2 w-full justify-start">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!canViewSelectedNfe}
                onClick={() => (async () => {
                  try {
                    const all = nfeRows || [];
                    const pickId = selectedId || (selectedIds && selectedIds[0]);
                    const row = all.find(r => r.id === pickId);
                    if (!row) { toast({ title: 'NF-e não encontrada', variant: 'warning' }); return; }
                    if (row.pdf_url) { window.open(row.pdf_url, '_blank'); return; }
                    if (!empresaInfo) { toast({ title: 'Empresa não carregada', variant: 'warning' }); return; }
                    const { baseUrl, cnpj } = getTransmiteNotaConfigFromEmpresa(empresaInfo);
                    const dados = row.xml_chave ? { chave: row.xml_chave, chave_nota: row.xml_chave } : { numero: row.numero, serie: row.serie };
                    setLoading(true);
                    let pdf = null, xml = null, chave = row.xml_chave || null;
                    try { const r1 = await consultarEmissaoNfe({ baseUrl, cnpj, dados }); pdf = r1?.url_pdf || r1?.pdf_url || null; xml = r1?.url_xml || r1?.xml_url || null; chave = r1?.chave || r1?.Chave || chave; } catch {}
                    if (!pdf) { try { const r2 = await consultarPdfNfe({ baseUrl, cnpj, dados }); pdf = r2?.url_pdf || r2?.pdf_url || null; chave = r2?.chave || r2?.Chave || chave; } catch {} }
                    if (!xml) { try { const r3 = await consultarXmlNfe({ baseUrl, cnpj, dados }); xml = r3?.url_xml || r3?.xml_url || null; chave = chave || r3?.chave || r3?.Chave || chave; } catch {} }
                    if (pdf || xml || chave) {
                      await supabase.from('notas_fiscais').update({ pdf_url: pdf || row.pdf_url, xml_url: xml || row.xml_url, xml_chave: chave || row.xml_chave, status: (pdf||xml) ? 'autorizada' : row.status }).eq('id', row.id).eq('codigo_empresa', codigoEmpresa);
                    }
                    await loadNfeRows();
                    if (pdf) { window.open(pdf, '_blank'); }
                    else { toast({ title: 'Sem PDF disponível', description: 'Documento ainda não possui DANFE.', variant: 'destructive' }); }
                  } catch (e) {
                    toast({ title: 'Falha ao visualizar NF-e', description: e?.message || String(e), variant: 'destructive' });
                  } finally { setLoading(false); }
                })()}
              >
                Visualizar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!allNfeEmitEligible || nfeToolbarEmitting}
                onClick={async()=>{ setNfeToolbarEmitting(true); try { await handleEmitSelectedNfe(); } finally { setNfeToolbarEmitting(false); } }}
              >
                {nfeToolbarEmitting ? (
                  <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitindo…</span>
                ) : 'Emitir NF-e'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="px-2" disabled={exporting}>
                    Mais
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={!allNfeConsultEligible} onClick={handleConsultSelectedNfe}>
                    Consultar
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!allNfeCancelEligible} onClick={handleCancelSelectedNfe}>
                    <span className="text-destructive">Cancelar</span>
                  </DropdownMenuItem>
                  {/* Criar NF-e manual desabilitado no mobile enquanto em desenvolvimento */}
                  <DropdownMenuItem
                    disabled
                    className="opacity-60 cursor-not-allowed"
                  >
                    Nova NF-e (em desenvolvimento)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportNfeCsv('selected')}>
                    Exportar NF-e (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'selected', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'selected', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(nfeSorted||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'filtered', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (filtrados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(nfeSorted||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'filtered', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (filtrados)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Ações completas só no desktop/tablet */}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canViewSelectedNfe}
                onClick={() => (async () => {
                  try {
                    const all = nfeRows || [];
                    const pickId = selectedId || (selectedIds && selectedIds[0]);
                    const row = all.find(r => r.id === pickId);
                    if (!row) { toast({ title: 'NF-e não encontrada', variant: 'warning' }); return; }
                    if (row.pdf_url) { window.open(row.pdf_url, '_blank'); return; }
                    if (!empresaInfo) { toast({ title: 'Empresa não carregada', variant: 'warning' }); return; }
                    const { baseUrl, cnpj } = getTransmiteNotaConfigFromEmpresa(empresaInfo);
                    const dados = row.xml_chave ? { chave: row.xml_chave, chave_nota: row.xml_chave } : { numero: row.numero, serie: row.serie };
                    setLoading(true);
                    let pdf = null, xml = null, chave = row.xml_chave || null;
                    try { const r1 = await consultarEmissaoNfe({ baseUrl, cnpj, dados }); pdf = r1?.url_pdf || r1?.pdf_url || null; xml = r1?.url_xml || r1?.xml_url || null; chave = r1?.chave || r1?.Chave || chave; } catch {}
                    if (!pdf) { try { const r2 = await consultarPdfNfe({ baseUrl, cnpj, dados }); pdf = r2?.url_pdf || r2?.pdf_url || null; chave = r2?.chave || r2?.Chave || chave; } catch {} }
                    if (!xml) { try { const r3 = await consultarXmlNfe({ baseUrl, cnpj, dados }); xml = r3?.url_xml || r3?.xml_url || null; chave = chave || r3?.chave || r3?.Chave || chave; } catch {} }
                    if (pdf || xml || chave) {
                      await supabase.from('notas_fiscais').update({ pdf_url: pdf || row.pdf_url, xml_url: xml || row.xml_url, xml_chave: chave || row.xml_chave, status: (pdf||xml) ? 'autorizada' : row.status }).eq('id', row.id).eq('codigo_empresa', codigoEmpresa);
                    }
                    await loadNfeRows();
                    if (pdf) { window.open(pdf, '_blank'); }
                    else { toast({ title: 'Sem PDF disponível', description: 'Documento ainda não possui DANFE.', variant: 'destructive' }); }
                  } catch (e) {
                    toast({ title: 'Falha ao visualizar NF-e', description: e?.message || String(e), variant: 'destructive' });
                  } finally { setLoading(false); }
                })()}
              >
                Visualizar
              </Button>
              <Button
                size="sm"
                disabled={!allNfeEmitEligible || nfeToolbarEmitting}
                onClick={async()=>{ setNfeToolbarEmitting(true); try { await handleEmitSelectedNfe(); } finally { setNfeToolbarEmitting(false); } }}
              >
                {nfeToolbarEmitting ? (
                  <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitindo…</span>
                ) : 'Emitir NF-e'}
              </Button>
              <Button size="sm" variant="outline" disabled={!allNfeConsultEligible} onClick={handleConsultSelectedNfe}>Consultar</Button>
              <Button size="sm" variant="destructive" disabled={!allNfeCancelEligible} onClick={handleCancelSelectedNfe}>Cancelar</Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={async()=>{
                    setSelectedId(null);
                    setSelectedIds([]);
                    const id = await createManualDraft();
                    if (id) { setManualXml(''); setManualOpen(true); }
                  }}
                >
                  Nova NF-e
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={exporting}>Ações</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={(selectedIds.length===0 && !selectedId)}
                    onClick={()=>exportNfeCsv('selected')}
                  >
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'selected', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(selectedIds.length===0 && !selectedId)} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'selected', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (selecionados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(nfeSorted||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'filtered', includePdf: false })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML (filtrados)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={(nfeSorted||[]).length===0} onClick={()=>exportZipFiscal({ tipo: 'nfe', scope: 'filtered', includePdf: true })}>
                    <Download className="h-4 w-4 mr-2" /> Baixar XML + PDF (filtrados)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Lista em cards para mobile (NF-e) */}
          <div className="sm:hidden space-y-2 -mx-2">
            {(!nfePaged || nfePaged.length === 0) && (
              <div className="px-3 py-4 text-center text-text-muted border border-border rounded-md bg-surface">
                {nfeLoading ? 'Carregando...' : 'Nada por aqui'}
              </div>
            )}
            {nfePaged.map((r) => {
              const rawStatus = String(r.status || 'rascunho').toLowerCase();
              const s = rawStatus === 'emitida' ? 'autorizada' : rawStatus;
              const statusBg =
                s === 'autorizada'
                  ? 'bg-emerald-500/5 border-emerald-500/40'
                  : s === 'cancelada'
                    ? 'bg-red-500/5 border-red-500/40'
                    : s === 'rejeitada'
                      ? 'bg-orange-500/5 border-orange-500/40'
                      : s === 'processando' || s === 'em_andamento'
                        ? 'bg-sky-500/5 border-sky-500/40'
                        : s === 'pendente' || s === 'rascunho'
                          ? 'bg-amber-500/5 border-amber-500/40'
                          : 'bg-surface border-border/70';
              const dataRef = r.data_emissao || r.criado_em || r.created_at || null;
              return (
                <div
                  key={r.id}
                  className={`rounded-lg px-3 py-2 text-xs flex flex-col gap-1 border ${statusBg}`}
                  onClick={() => toggleRow(r.id, !isSelected(r.id))}
                >
                  <div className="flex items-start gap-2">
                    <div
                      onClick={(e)=>{ e.stopPropagation(); toggleRow(r.id, !isSelected(r.id)); }}
                      className="pt-1"
                    >
                      <Checkbox checked={isSelected(r.id)} onCheckedChange={(v)=>toggleRow(r.id, Boolean(v))} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-sm truncate">
                              NF-e {(r.numero ?? '—')}/{(r.serie ?? '—')}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusBadge(s)}`}>{s}</span>
                          </div>
                          <div className="text-xs text-text-secondary flex items-center justify-between gap-2 mt-0.5">
                            <span>{dataRef ? fmtDate(dataRef) : '—'}</span>
                            <span className="font-semibold text-text-primary">R$ {fmtMoney(r.valor_total || 0)}</span>
                          </div>
                          <div className="mt-1 text-xs text-text-secondary truncate" title={r.destinatario?.nome || ''}>
                            <span className="text-text-muted">Destinatário: </span>
                            <span className="text-text-primary">{r.destinatario?.nome || '—'}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-text-secondary" title={r.xml_chave || ''}>
                            <span className="text-text-muted block mb-0.5">Chave:</span>
                            <span className="text-text-primary text-[10px] truncate block">{r.xml_chave || '—'}</span>
                          </div>
                        </div>
                        {rawStatus === 'rascunho' && (
                          <div className="flex flex-col items-end gap-1 ml-1">
                            {false && (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-surface-2 text-text-secondary hover:text-text-primary"
                                onClick={(e)=>{ e.stopPropagation(); handleEditDraft(r); }}
                                title="Editar rascunho"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-surface-2 text-text-secondary hover:text-destructive"
                              onClick={(e)=>{ e.stopPropagation(); setDeleteDraftId(r.id); }}
                              title="Excluir rascunho"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {(r.pdf_url || r.xml_url) && (
                    <div className="mt-2 border-t border-border/60 pt-2 text-[11px]">
                      <div className="flex gap-2">
                        {r.pdf_url && (
                          <a className="inline-flex flex-1" href={r.pdf_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="w-full">Abrir DANFE</Button>
                          </a>
                        )}
                        {r.xml_url && (
                          <a className="inline-flex flex-1" href={r.xml_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="w-full">Baixar XML</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabela clássica apenas para desktop/tablet (NF-e) */}
          <div className="hidden sm:block bg-surface rounded border border-border overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-2 text-text-secondary">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <Checkbox checked={false} onCheckedChange={()=>{}} />
                  </th>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Destinatário</th>
                  <th className="text-left px-3 py-2">Número/Série</th>
                  <th className="text-right px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(!nfePaged || nfePaged.length===0) && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-text-muted">{nfeLoading ? 'Carregando...' : 'Nada por aqui'}</td></tr>
                )}
                {nfePaged.map(r => {
                  const s = String(r.status || 'rascunho').toLowerCase();
                  const sForBadge = (s === 'emitida') ? 'autorizada' : s;
                  const bcls = statusBadge(sForBadge);
                  const canEdit = ['rascunho','pendente','rejeitada'].includes(s);
                  const dataRef = r.data_emissao || r.criado_em || r.created_at || null;
                  return (
                    <React.Fragment key={r.id}>
                    <tr
                      className={`border-t border-border/60 transition-colors ${selectedId===r.id ? 'bg-surface-2 ring-2 ring-[#FF7A1A]/60 rounded-md' : 'hover:bg-surface-2/50'}`}
                      onClick={() => {
                        setSelectedId(r.id);
                        setSelectedIds(prev => {
                          if (!prev || prev.length === 0) return [r.id];
                          if (prev.length === 1 && prev[0] === r.id) return prev;
                          return prev;
                        });
                      }}
                    >
                      <td className="px-3 py-2" onClick={(e)=>e.stopPropagation()}>
                        <Checkbox checked={isSelected(r.id)} onCheckedChange={(v)=>toggleRow(r.id, Boolean(v))} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{dataRef ? fmtDate(dataRef) : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${bcls}`}
                          >
                            {s}
                          </span>
                          {(() => {
                            const ambVal = String(r.ambiente || (getTransmiteNotaConfigFromEmpresa(empresaInfo||{}).ambiente) || 'homologacao');
                            const clsAmb = ambVal === 'producao' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-600/30' : 'bg-amber-500/15 text-amber-700 border border-amber-600/30';
                            const labelAmb = ambVal === 'producao' ? 'Produção' : 'Homologação';
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${clsAmb}`}>{labelAmb}</span>
                            );
                          })()}
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-surface-2 text-text-secondary hover:text-text-primary"
                                onClick={(e)=>{ e.stopPropagation(); handleEditDraft(r); }}
                                title="Editar rascunho"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              {s === 'rascunho' && (
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-surface-2 text-text-secondary hover:text-destructive"
                                  onClick={(e)=>{ e.stopPropagation(); setDeleteDraftId(r.id); }}
                                  title="Excluir rascunho"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap max-w-[240px] truncate" title={r.destinatario?.nome || ''}>{r.destinatario?.nome || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {(r.numero ?? '—')}/{(r.serie ?? '—')}
                        {r.xml_chave && (
                          <div className="text-[10px] text-text-secondary truncate max-w-[220px] flex items-center gap-1">
                            <span className="truncate">
                              {`${String(r.xml_chave).slice(0, 8)}...${String(r.xml_chave).slice(-4)}`}
                            </span>
                            <button
                              type="button"
                              className="p-0.5 hover:text-text-primary"
                              onClick={(e)=>{ e.stopPropagation(); navigator.clipboard.writeText(r.xml_chave||''); toast({ title: 'Chave copiada' }); }}
                              title="Copiar chave"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">R$ {fmtMoney(r.valor_total || 0)}</td>
                    </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="sm:hidden text-[11px] text-text-secondary">Pág. {page} de {nfeTotalPages}</div>
            <div className="hidden sm:block text-xs text-text-secondary">Página {page} de {nfeTotalPages} • {(nfeSorted||[]).length} registros</div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                <label className="text-xs text-text-secondary">Itens por página</label>
                <select className="h-7 rounded-md bg-surface border border-border text-xs px-2" value={pageSize} onChange={e=>{ setPage(1); setPageSize(Number(e.target.value)||50); }}>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <Button size="sm" variant="outline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page>=nfeTotalPages} onClick={()=>setPage(p=>Math.min(nfeTotalPages,p+1))}>Próxima</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compras">
          <ComprasPage />
        </TabsContent>

      </Tabs>

      {/* Modal de confirmação de emissão em lote NFC-e */}
      <Dialog open={emitConfirmOpen} onOpenChange={setEmitConfirmOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Confirmar emissão de NFC-e</DialogTitle>
            <DialogDescription>
              As seguintes comandas serão enviadas para emissão agora. Revise rapidamente antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[320px] overflow-y-auto mt-2 border border-border/60 rounded-md divide-y divide-border/40 text-xs">
            {eligibleEmitIds.map(id => {
              const r = rows.find(x => x.id === id) || {};
              const mesaLabel = r.mesaNumero ? `Mesa ${r.mesaNumero}` : 'Balcão';
              return (
                <div key={id} className="flex items-center justify-between gap-3 px-3 py-2 bg-surface/40">
                  <div className="space-y-0.5">
                    <div className="font-medium text-text-primary">{mesaLabel}</div>
                    <div className="text-text-secondary truncate max-w-[260px]">{r.clientesStr || 'Cliente Consumidor'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-text-secondary">Total</div>
                    <div className="text-sm font-semibold text-text-primary">R$ {fmtMoney(r.total || r.total_com_desconto)}</div>
                  </div>
                </div>
              );
            })}
            {!eligibleEmitIds.length && (
              <div className="px-3 py-2 text-text-secondary">Nenhuma NFC-e elegível selecionada.</div>
            )}
          </div>
          <div className="flex justify-between items-center mt-3 text-[11px] text-text-secondary">
            <span>{eligibleEmitIds.length} NFC-e serão emitidas agora.</span>
            {selectedIds.length > eligibleEmitIds.length && (
              <span>{selectedIds.length - eligibleEmitIds.length} seleção(ões) serão ignoradas por não estarem pendentes/rejeitadas.</span>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={nfceConfirmEmitting} onClick={()=>setEmitConfirmOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="bg-[#FF7A1A] hover:bg-[#ff8f3b] text-black"
              disabled={nfceConfirmEmitting}
              onClick={async ()=>{
                setNfceConfirmEmitting(true);
                try {
                  await handleEmitBulk();
                  setEmitConfirmOpen(false);
                } finally {
                  setNfceConfirmEmitting(false);
                }
              }}
            >
              {nfceConfirmEmitting ? (
                <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitindo…</span>
              ) : 'Confirmar emissão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para cadastrar novo CFOP */}
      <Dialog open={cfopModalOpen} onOpenChange={setCfopModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo CFOP</DialogTitle>
            <DialogDescription>Cadastrar um código CFOP para esta empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Código CFOP</Label>
              <Input
                value={cfopForm.codigo}
                onChange={e => setCfopForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="Ex.: 5102"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={cfopForm.descricao}
                onChange={e => setCfopForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex.: Venda de mercadoria adquirida de terceiros"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCfopModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                const codigo = (cfopForm.codigo || '').trim();
                const descricao = (cfopForm.descricao || '').trim();
                if (!codigo || !descricao) {
                  toast({ title: 'Informe código e descrição do CFOP', variant: 'warning' });
                  return;
                }
                if (!codigoEmpresa) {
                  toast({ title: 'Empresa não encontrada para salvar CFOP', variant: 'destructive' });
                  return;
                }
                try {
                  const { data, error } = await supabase
                    .from('cfops')
                    .insert({
                      codigo_empresa: codigoEmpresa,
                      codigo,
                      descricao,
                      tipo_nota: manualForm.tipo_nota || 'saida',
                    })
                    .select()
                    .single();
                  if (error) throw error;
                  setCfopOptions(prev => [...prev, data]);
                  setManualForm(f => ({
                    ...f,
                    cfop_padrao: codigo,
                    natOp: descricao || f.natOp || '',
                  }));
                  setCfopModalOpen(false);
                } catch (e) {
                  toast({ title: 'Falha ao salvar CFOP', description: e.message, variant: 'destructive' });
                }
              }}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Seletor de Comandas para criação de NF-e */}
      <Dialog open={comandaPickerOpen} onOpenChange={setComandaPickerOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[760px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Selecionar Comanda</DialogTitle>
            <DialogDescription>Escolha a comanda de origem para criar o rascunho de NF-e.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2 space-y-2">
          {(() => {
            const txt = (comandaPickerFilter || '').trim().toLowerCase();
            const base = Array.isArray(sorted) ? sorted : [];
            const filteredComandas = base.filter(c => {
              if (!txt) return true;
              const mesaLabel = c.mesaNumero ? `mesa ${c.mesaNumero}` : 'balcao';
              const s = `${mesaLabel} ${(c.clientesStr||'')}`.toLowerCase();
              return s.includes(txt);
            });
            const usedSet = new Set((nfeRows||[])
              .filter(r => r.origem === 'comanda' && r.comanda_id)
              .map(r => r.comanda_id));
            return (
              <>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex-1 min-w-[180px] flex items-center gap-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Filtrar por cliente ou mesa"
                      value={comandaPickerFilter}
                      onChange={(e)=>setComandaPickerFilter(e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-text-secondary whitespace-nowrap">
                    {filteredComandas.length} comandas filtradas
                  </div>
                </div>
                <div className="border border-border rounded-md divide-y divide-border">
                  {filteredComandas.slice(0, 100).map(c => {
                    const jaTemNfe = usedSet.has(c.id);
                    return (
                      <label key={c.id} className="grid grid-cols-12 items-center px-3 py-2 hover:bg-surface-2 cursor-pointer gap-2">
                        <div className="col-span-1 flex items-center justify-center">
                          <Checkbox
                            checked={comandaPickerSelectedId === c.id}
                            onCheckedChange={(v)=>{
                              setComandaPickerSelectedId(prev => v ? c.id : (prev === c.id ? null : prev));
                            }}
                          />
                        </div>
                        <div className="col-span-3 text-sm">{fmtDate(c.aberto_em)}</div>
                        <div className="col-span-4 text-sm truncate" title={c.clientesStr||''}>{c.clientesStr || '—'}</div>
                        <div className="col-span-2 flex flex-col text-xs text-text-secondary">
                          <span>{c.mesaNumero ? `Mesa ${c.mesaNumero}` : 'Balcão'}</span>
                          {jaTemNfe && (
                            <span className="text-[10px] text-amber-500">Já possui NF-e vinculada</span>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-sm">R$ {fmtMoney(c.total || c.total_com_desconto)}</div>
                      </label>
                    );
                  })}
                  {filteredComandas.length === 0 && (
                    <div className="text-xs text-text-secondary px-3 py-2">Nenhuma comanda encontrada</div>
                  )}
                </div>
              </>
            );
          })()}
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-border/60">
            <Button variant="outline" onClick={()=>setComandaPickerOpen(false)}>Cancelar</Button>
            <Button onClick={async()=>{
              if (!comandaPickerSelectedId) { toast({ title:'Selecione uma comanda', variant:'warning' }); return; }
              const draftId = await createDraftFromComanda(comandaPickerSelectedId);
              if (draftId) {
                setManualXml('');
                await openManualFromComanda(comandaPickerSelectedId);
                setComandaPickerOpen(false);
              }
            }}>Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar cancelamento de NF-e */}
      <Dialog open={!!cancelNfeRow} onOpenChange={(open)=>{ if (!open) { setCancelNfeRow(null); setCancelNfeMotivo(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar NF-e</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento. Essa ação será enviada para a API fiscal e a nota será marcada como cancelada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Label htmlFor="motivo-cancel-nfe">Motivo do cancelamento</Label>
            <Input
              id="motivo-cancel-nfe"
              value={cancelNfeMotivo}
              onChange={(e)=>setCancelNfeMotivo(e.target.value)}
              placeholder="Ex.: Nota emitida em duplicidade"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={()=>{ setCancelNfeRow(null); setCancelNfeMotivo(''); }}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async()=>{
                if (!cancelNfeRow) { setCancelNfeRow(null); return; }
                await handleCancelNfeRow(cancelNfeRow);
              }}
            >
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelNfceId} onOpenChange={(open)=>{ if (!open) { setCancelNfceId(null); setCancelNfceMotivo(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar NFC-e</DialogTitle>
            <DialogDescription>Informe o motivo do cancelamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Label htmlFor="motivo-nfce">Motivo</Label>
            <Input
              id="motivo-nfce"
              value={cancelNfceMotivo}
              onChange={(e)=>setCancelNfceMotivo(e.target.value)}
              placeholder="Ex.: Cliente desistiu da compra"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={()=>{ setCancelNfceId(null); setCancelNfceMotivo(''); }}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={async ()=>{
                if (!cancelNfceId) { setCancelNfceId(null); return; }
                const motivo = (cancelNfceMotivo || '').trim();
                if (!motivo) { toast({ title: 'Informe o motivo do cancelamento', variant: 'warning' }); return; }
                await handleCancel(cancelNfceId, motivo);
                setCancelNfceId(null);
                setCancelNfceMotivo('');
              }}
            >
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={preOpen} onOpenChange={setPreOpen}>
        <DialogContent className="max-w-[880px]">
          <DialogHeader>
            <DialogTitle>Pré-Emissão NFC-e</DialogTitle>
            <DialogDescription>Revise os dados e pendências antes de emitir.</DialogDescription>
          </DialogHeader>
          {preLoading ? (
            <div className="p-4 text-center text-text-muted">Gerando prévia…</div>
          ) : (
            <div className="space-y-3">
              <div className="border border-border rounded p-2 bg-surface-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-text-secondary">Pendências</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={()=>setPreShowPayload(v=>!v)}>{preShowPayload ? 'Ocultar JSON' : 'Ver JSON'}</Button>
                    <Button size="sm" variant="outline" onClick={()=>navigate('/configuracao-fiscal')}>Corrigir Empresa</Button>
                    <Button size="sm" variant="outline" onClick={()=>setPartyPickerOpen(true)}>Selecionar Cliente</Button>
                    <Button size="sm" variant="outline" onClick={()=>{ if(selectedId) openPreview(selectedId); }}>Recarregar Prévia</Button>
                  </div>
                </div>
                {(!preMissing || preMissing.length===0) ? (
                  <div className="text-sm text-emerald-500">Nenhuma pendência encontrada.</div>
                ) : (
                  <ul className="list-disc pl-5 text-sm">
                    {preMissing.map((m,i)=> (<li key={i}>{m}</li>))}
                  </ul>
                )}
              </div>
              {preShowPayload && (
                <div className="border border-border rounded p-2 bg-surface-2">
                  <div className="text-xs text-text-secondary mb-1">JSON (EnviarNfce)</div>
                  <pre className="text-[11px] whitespace-pre-wrap break-all max-h-[360px] overflow-auto">{prePayload ? JSON.stringify(prePayload, null, 2) : '—'}</pre>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={()=>setPreOpen(false)}>Fechar</Button>
            <Button disabled>Emitir (desabilitado)</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Party Picker Modal (Destinatário unificado) */}
      <Dialog open={partyPickerOpen} onOpenChange={setPartyPickerOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar destinatário</DialogTitle>
            <DialogDescription>Busque pelo código, nome ou documento e escolha a parte.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={`Buscar por código, nome ou documento`} value={partyQuery} onChange={(e)=>setPartyQuery(e.target.value)} />
            </div>
            <span className="text-xs text-text-secondary">{filteredPartyList.length} itens</span>
          </div>
          <div className="border border-border rounded-md divide-y divide-border">
            {filteredPartyList.map(p => (
              <div key={p.id} className="grid grid-cols-12 items-center px-3 py-2 hover:bg-surface-2 cursor-pointer" onClick={()=>applyParty(p)}>
                <div className="col-span-2 text-xs font-medium">{String(p.codigo || p.codigo_cliente || p.codigo_fornecedor || p.code || '—')}</div>
                <div className="col-span-6 text-sm truncate" title={p.nome || p.razao_social || ''}>{(p.nome || p.razao_social || 'Sem nome')}</div>
                <div className="col-span-4 text-xs text-text-secondary text-right">{(p.cnpj || p.cpf || '').toString()} {p.cidade ? `• ${p.cidade}/${p.uf||''}` : ''}</div>
              </div>
            ))}
            {filteredPartyList.length===0 && (
              <div className="text-xs text-text-secondary px-3 py-2">Nenhum registro encontrado</div>
            )}
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="outline" onClick={()=>setPartyPickerOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Product Picker Modal */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar produto</DialogTitle>
            <DialogDescription>Busque pelo nome ou código para preencher o item.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-3">
            <Input placeholder="Buscar produto por nome ou código" value={productFilter} onChange={(e)=>setProductFilter(e.target.value)} />
            <span className="text-xs text-text-secondary">{filteredProducts.length} itens</span>
          </div>
          <div className="border border-border rounded-md divide-y divide-border">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-surface-2 cursor-pointer"
                onClick={()=>{ if (productPickerTarget!=null) applyProductToItem(productPickerTarget, p); setProductPickerOpen(false); }}
              >
                <div className="flex flex-col">
                  <div className="text-sm">
                    {p.code && (
                      <span className="text-text-secondary mr-1">[{p.code}]</span>
                    )}
                    <span>{p.name}</span>
                  </div>
                  <div className="text-[11px] text-text-secondary">R$ {fmtMoney(p.price ?? p.salePrice ?? 0)}</div>
                </div>
              </div>
            ))}
            {filteredProducts.length===0 && (
              <div className="text-xs text-text-secondary px-3 py-2">Nenhum produto encontrado</div>
            )}
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="outline" onClick={()=>setProductPickerOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de rascunho de NF-e */}
      <Dialog open={!!deleteDraftId} onOpenChange={(open)=>{ if (!open) setDeleteDraftId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover rascunho</DialogTitle>
            <DialogDescription>
              Essa ação remove definitivamente o rascunho de NF-e selecionado. Os dados não poderão ser recuperados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={()=>setDeleteDraftId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async()=>{
                if (!deleteDraftId || !codigoEmpresa) { setDeleteDraftId(null); return; }
                try {
                  await supabase.from('notas_fiscais').delete().eq('id', deleteDraftId).eq('codigo_empresa', codigoEmpresa);
                  await loadNfeRows();
                  toast({ title: 'Rascunho removido' });
                } catch (e) {
                  toast({ title: 'Falha ao remover rascunho', description: e.message, variant: 'destructive' });
                } finally {
                  setDeleteDraftId(null);
                }
              }}
            >
              Remover rascunho
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="w-[960px] max-w-[96vw] h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Criar NF-e (manual)</DialogTitle>
            <DialogDescription>Vamos montar do zero.</DialogDescription>
          </DialogHeader>
          <Tabs value={manualStep} onValueChange={setManualStep} className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 gap-2">
              {/* Navegação por etapas: Select no mobile, abas no desktop */}
              <div className="flex-1 flex items-center gap-2">
                {/* Select compacto para mobile */}
                <div className="w-full sm:hidden">
                  <Select value={manualStep} onValueChange={setManualStep}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecionar etapa" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="ident">Identificação</SelectItem>
                      <SelectItem value="produtos">Produtos</SelectItem>
                      <SelectItem value="pagamentos">Pagamentos</SelectItem>
                      <SelectItem value="totais">Totais &amp; Impostos</SelectItem>
                      <SelectItem value="transporte">Transporte</SelectItem>
                      <SelectItem value="resumo">Resumo &amp; Emissão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Abas clássicas apenas em desktop/tablet */}
                <TabsList className="hidden sm:inline-flex">
                  <TabsTrigger value="ident">
                    <span className="flex items-center gap-1">
                      {!manualTabFlags.identOk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span>Identificação</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="produtos">
                    <span className="flex items-center gap-1">
                      {!manualTabFlags.produtosOk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span>Produtos</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="pagamentos">
                    <span className="flex items-center gap-1">
                      {!manualTabFlags.pagamentosOk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span>Pagamentos</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="totais">
                    <span className="flex items-center gap-1">
                      {!manualTabFlags.totaisOk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span>Totais &amp; Impostos</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="transporte">
                    <span className="flex items-center gap-1">
                      {!manualTabFlags.transpOk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span>Transporte</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="resumo">Resumo &amp; Emissão</TabsTrigger>
                </TabsList>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={()=>{ setComandaPickerSelectedId(null); setComandaPickerOpen(true); }}
              >
                Selecionar comanda…
              </Button>
            </div>
            <TabsContent value="ident">
              <div className="space-y-3">
                <div className="border border-border rounded-md bg-surface p-3">
                  <div className="text-sm font-medium mb-2">Identificação da Nota</div>
                  {/* No mobile usamos 2 colunas para reduzir altura; em md+ mantemos 4 colunas como antes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-1 max-w-[210px]">
                      <Label className={isEmpty(manualForm.modelo) ? 'text-red-400' : ''}>Tipo de Documento</Label>
                      <Select value={manualForm.modelo} onValueChange={(v)=>setManualForm(f=>({...f, modelo: v}))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.modelo) ? 'border-red-500 text-red-400' : ''}`}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="55">55 - NF-e</SelectItem>
                          <SelectItem value="65">65 - NFC-e</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1 max-w-[190px]">
                      <Label className={isEmpty(manualForm.tipo_nota) ? 'text-red-400' : ''}>Tipo de Operação</Label>
                      <Select value={manualForm.tipo_nota} onValueChange={(v)=>setManualForm(f=>({...f, tipo_nota: v}))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.tipo_nota) ? 'border-red-500 text-red-400' : ''}`}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="saida">Saída</SelectItem>
                          <SelectItem value="entrada">Entrada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1 max-w-[210px]">
                      <Label className={isEmpty(manualForm.finNFe) ? 'text-red-400' : ''}>Finalidade</Label>
                      <Select value={manualForm.finNFe} onValueChange={(v)=>setManualForm(f=>({...f, finNFe: v}))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.finNFe) ? 'border-red-500 text-red-400' : ''}`}>
                          <SelectValue placeholder="Normal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Normal</SelectItem>
                          <SelectItem value="2">2 - Complementar</SelectItem>
                          <SelectItem value="3">3 - Ajuste</SelectItem>
                          <SelectItem value="4">4 - Devolução</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Natureza da Operação: visível apenas em telas >= sm; no mobile removemos para simplificar */}
                    <div className="md:col-span-1 col-span-2 hidden sm:block">
                      <Label className={isEmpty(manualForm.natOp) ? 'text-red-400' : ''}>Natureza da Operação</Label>
                      <Input
                        className={`h-8 text-xs ${isEmpty(manualForm.natOp) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`}
                        value={manualForm.natOp}
                        onChange={(e)=>{
                          const val = e.target.value;
                          setManualForm(f=>({...f, natOp: val}));
                        }}
                        placeholder="Ex.: Venda de mercadoria"
                      />
                    </div>
                    <div className="md:col-span-1 max-w-[200px]">
                      <Label className={!manualForm.cfop_padrao ? 'text-red-400' : ''}>CFOP</Label>
                      <Select
                        value={manualForm.cfop_padrao || ''}
                        onValueChange={(v)=>{
                          if (v === '__novo_cfop__') {
                            setCfopForm({ codigo: '', descricao: '' });
                            setCfopModalOpen(true);
                            return;
                          }
                          setManualForm(f=>{
                            const found = (cfopOptions||[]).find(c => String(c.codigo) === String(v));
                            const descr = found?.descricao || '';
                            return {
                              ...f,
                              cfop_padrao: v,
                              natOp: descr || f.natOp || '',
                            };
                          });
                        }}
                      >
                        <SelectTrigger className={`h-8 text-xs ${!manualForm.cfop_padrao ? 'border-red-500 text-red-400' : ''}`}>
                          <span className="truncate">
                            {manualForm.cfop_padrao || 'Selecione'}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(cfopOptions||[]).map(c => (
                            <SelectItem key={c.id || c.codigo} value={c.codigo}>
                              {c.codigo} - {c.descricao}
                            </SelectItem>
                          ))}
                          <SelectItem value="__novo_cfop__">+ Cadastrar novo CFOP…</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1 max-w-[200px]">
                      <Label className={isEmpty(manualForm.data_emissao) ? 'text-red-400' : ''}>Data de Emissão</Label>
                      <DateInput label="Selecione" value={manualForm.data_emissao} onChange={(v)=>setManualForm(f=>({...f, data_emissao: v}))} />
                    </div>
                    <div className="md:col-span-1 max-w-[200px]">
                      <Label>Data Saída/Entrada</Label>
                      <DateInput label="Selecione" value={manualForm.data_saida} onChange={(v)=>setManualForm(f=>({...f, data_saida: v}))} />
                    </div>
                    <div className="md:col-span-1 max-w-[120px]">
                      <Label className={isEmpty(manualForm.serie) ? 'text-red-400' : ''}>Série</Label>
                      <Input className={`h-8 text-xs ${isEmpty(manualForm.serie) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`} value={manualForm.serie} onChange={(e)=>setManualForm(f=>({...f, serie: e.target.value}))} />
                    </div>
                    <div className="md:col-span-1 max-w-[140px]">
                      <Label>Número</Label>
                      <Input className="h-8 text-xs" value={manualForm.nNF} onChange={(e)=>setManualForm(f=>({...f, nNF: e.target.value}))} placeholder="automático" />
                    </div>
                    <div className="md:col-span-1">
                      <Label className={isEmpty(manualForm.idDest) ? 'text-red-400' : ''}>Destino da Operação</Label>
                      <Select value={manualForm.idDest || 'auto'} onValueChange={(v)=>setManualForm(f=>({...f, idDest: v==='auto' ? '' : v}))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.idDest) ? 'border-red-500 text-red-400' : ''}`}><SelectValue placeholder="Automático" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="1">1 - Interna (mesmo estado)</SelectItem>
                          <SelectItem value="2">2 - Interestadual</SelectItem>
                          <SelectItem value="3">3 - Exterior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label className={isEmpty(manualForm.indFinal) ? 'text-red-400' : ''}>Consumidor Final</Label>
                      <Select value={manualForm.indFinal ?? ''} onValueChange={(v)=>setManualForm(f=>({...f, indFinal: v}))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.indFinal) ? 'border-red-500 text-red-400' : ''}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Sim</SelectItem>
                          <SelectItem value="0">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label className={isEmpty(manualForm.indPres) ? 'text-red-400' : ''}>Presença do Comprador</Label>
                      <Select value={manualForm.indPres ?? ''} onValueChange={(v)=>setManualForm(f=>({...f, indPres: v}))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.indPres) ? 'border-red-500 text-red-400' : ''}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Operação presencial</SelectItem>
                          <SelectItem value="2">2 - Não presencial, internet</SelectItem>
                          <SelectItem value="4">4 - Entrega em domicílio</SelectItem>
                          <SelectItem value="9">9 - Não se aplica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-md bg-surface p-3">
                  <div className="text-sm font-medium mb-2">Emitente (Empresa)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div><div className="text-text-secondary">CNPJ</div><div className="text-text-primary">{empresaInfo?.cnpj || '—'}</div></div>
                    <div><div className="text-text-secondary">Inscrição Estadual</div><div className="text-text-primary">{empresaInfo?.inscricao_estadual || '—'}</div></div>
                    <div><div className="text-text-secondary">Regime Tributário</div><div className="text-text-primary">{empresaInfo?.regime_tributario || '—'}</div></div>
                    <div className="md:col-span-3"><div className="text-text-secondary">Razão Social</div><div className="text-text-primary">{empresaInfo?.razao_social || '—'}</div></div>
                    <div className="md:col-span-3"><div className="text-text-secondary">Nome Fantasia</div><div className="text-text-primary">{empresaInfo?.nome_fantasia || '—'}</div></div>
                    <div className="md:col-span-3"><div className="text-text-secondary">Endereço</div><div className="text-text-primary">{empresaInfo ? `${empresaInfo.logradouro||empresaInfo.endereco||''} ${empresaInfo.numero||''} ${empresaInfo.bairro||''} - ${empresaInfo.cidade||''}/${empresaInfo.uf||''} • CEP ${empresaInfo.cep||''}`.trim() : '—'}</div></div>
                  </div>
                </div>

                <div className="border border-border rounded-md bg-surface p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Destinatário</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Input
                          className="h-8 text-xs w-full"
                          placeholder="Nome, código, CPF ou CNPJ"
                          value={partyQuery}
                          onChange={(e)=>setPartyQuery(e.target.value)}
                        />
                      </div>
                      <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={()=>setPartyPickerOpen(true)}>
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {(partyQuery||'').trim().length > 0 && filteredPartyList.length > 0 && (
                    <div className="border border-border rounded-md mb-3 max-h-40 overflow-y-auto text-xs">
                      {filteredPartyList.slice(0, 8).map(p => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-2 py-1 hover:bg-surface-2 cursor-pointer"
                          onClick={()=>applyParty(p)}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[220px]">{p.nome || p.razao_social || 'Sem nome'}</span>
                            <span className="text-text-secondary truncate max-w-[220px]">{(p.cnpj || p.cpf || '').toString()}</span>
                          </div>
                          <span className="text-[10px] text-text-secondary ml-2">
                            {p.is_fornecedor ? 'Fornecedor' : 'Cliente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Tipo de Pessoa</Label>
                      <Select value={manualForm.tipo_pessoa} onValueChange={(v)=>setManualForm(f=>({...f, tipo_pessoa: v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PF">Pessoa Física</SelectItem>
                          <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <Label className={isEmpty(manualForm.cpf_cnpj) ? 'text-red-400' : ''}>{manualForm.tipo_pessoa==='PF' ? 'CPF' : 'CNPJ'}</Label>
                      <Input className={isEmpty(manualForm.cpf_cnpj) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.cpf_cnpj} onChange={(e)=>setManualForm(f=>({...f, cpf_cnpj: e.target.value}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.nome) ? 'text-red-400' : ''}>Nome/Razão Social</Label>
                      <Input className={isEmpty(manualForm.nome) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.nome} onChange={(e)=>setManualForm(f=>({...f, nome: e.target.value}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.indIEDest) ? 'text-red-400' : ''}>Indicador de IE</Label>
                      <Select value={manualForm.indIEDest || '9'} onValueChange={(v)=>setManualForm(f=>({...f, indIEDest: v, ie_isento: v==='2', inscricao_estadual: v==='2' ? 'ISENTO' : f.inscricao_estadual}))}>
                        <SelectTrigger className={isEmpty(manualForm.indIEDest) ? 'border-red-500 text-red-400' : ''}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Contribuinte</SelectItem>
                          <SelectItem value="2">Isento</SelectItem>
                          <SelectItem value="9">Não Contribuinte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <Label>Inscrição Estadual</Label>
                      <div className="flex items-center gap-2">
                        <Input value={manualForm.ie_isento ? 'ISENTO' : (manualForm.inscricao_estadual||'')} onChange={(e)=>setManualForm(f=>({...f, inscricao_estadual: e.target.value, ie_isento: String(e.target.value||'').toUpperCase()==='ISENTO'}))} />
                        <Button type="button" size="sm" variant={manualForm.ie_isento ? 'default' : 'outline'} onClick={()=>setManualForm(f=>({...f, ie_isento: true, inscricao_estadual: 'ISENTO', indIEDest: '2'}))}>ISENTO</Button>
                      </div>
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.cep) ? 'text-red-400' : ''}>CEP</Label>
                      <Input className={isEmpty(manualForm.cep) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.cep} onChange={(e)=>setManualForm(f=>({...f, cep: e.target.value}))} onBlur={()=>lookupCep(manualForm.cep)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className={isEmpty(manualForm.logradouro) ? 'text-red-400' : ''}>Logradouro</Label>
                      <Input className={isEmpty(manualForm.logradouro) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.logradouro} onChange={(e)=>setManualForm(f=>({...f, logradouro: e.target.value}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.numero) ? 'text-red-400' : ''}>Número</Label>
                      <Input className={isEmpty(manualForm.numero) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.numero} onChange={(e)=>setManualForm(f=>({...f, numero: e.target.value}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.bairro) ? 'text-red-400' : ''}>Bairro</Label>
                      <Input className={isEmpty(manualForm.bairro) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.bairro} onChange={(e)=>setManualForm(f=>({...f, bairro: e.target.value}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.cidade) ? 'text-red-400' : ''}>Cidade</Label>
                      <Input className={isEmpty(manualForm.cidade) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.cidade} onChange={(e)=>setManualForm(f=>({...f, cidade: e.target.value}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.uf) ? 'text-red-400' : ''}>UF</Label>
                      <Input className={isEmpty(manualForm.uf) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''} value={manualForm.uf} onChange={(e)=>setManualForm(f=>({...f, uf: (e.target.value||'').toUpperCase().slice(0,2)}))} />
                    </div>
                    <div>
                      <Label className={isEmpty(manualForm.codigo_municipio_ibge) ? 'text-red-400' : ''}>Código IBGE</Label>
                      <Input
                        className={`h-8 text-xs ${isEmpty(manualForm.codigo_municipio_ibge) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`}
                        value={manualForm.codigo_municipio_ibge}
                        onChange={(e)=>setManualForm(f=>({...f, codigo_municipio_ibge: e.target.value}))}
                        placeholder="Ex.: 3550308"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="produtos">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={()=>{
                    setManualForm(f=>{
                      const newItem = {
                        descricao: '', codigo: '', cod_barras: '', ncm: '', cest: '', cfop: f.cfop_padrao || '5102', unidade: 'UN',
                        quantidade: '1', preco_unitario: '0,00', desconto_valor: '0,00', desconto_percent: '', acrescimos_valor: '0,00', frete_valor: '0,00', seguro_valor: '0,00', obs: '',
                        impostos: { origem: '', icms: { cst:'', csosn:'', base:'', aliquota:'', valor:'' }, pis: { cst:'', aliquota:'', valor:'' }, cofins: { cst:'', aliquota:'', valor:'' }, ipi: { cst:'', aliquota:'', valor:'', tipo_calculo:'nenhum', valor_unit:'' } }
                      };
                      return { ...f, itens: [...f.itens, newItem] };
                    });
                  }}>Adicionar item</Button>
                </div>

                <div className="border border-border rounded-md overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-surface-2 text-text-secondary">
                      <tr>
                        <th className="text-left px-2 py-2">Produto</th>
                        <th className="text-center px-2 py-2 w-[80px]">Qtd</th>
                        <th className="text-center px-2 py-2 w-[110px]">V. Unit</th>
                        <th className="text-center px-2 py-2 w-[110px]">Desconto</th>
                        <th className="text-center px-2 py-2 w-[110px]">Total</th>
                        <th className="text-center px-2 py-2 w-[180px]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualForm.itens.map((it, idx) => {
                        const pu = parseDec(it.preco_unitario)||0; const q = parseDec(it.quantidade)||1; const bruto = pu*q;
                        const descP = parseDec(it.desconto_percent)||0; const descV = parseDec(it.desconto_valor)||0;
                        const desconto = descP ? (bruto*descP/100) : descV; const totalItem = Math.max(0, bruto - desconto + (parseDec(it.acrescimos_valor)||0));
                        return (
                          <React.Fragment key={idx}>
                            <tr className="border-t border-border/60">
                              <td className="px-2 py-1">
                                <div className="flex items-center gap-1">
                                  <Input className="h-7 text-xs flex-1" value={it.descricao} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx] = { ...a[idx], descricao: e.target.value }; return { ...f, itens: a }; })} placeholder="Descrição" />
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7 flex-shrink-0"
                                    title="Buscar produto"
                                    onClick={()=>{ setProductPickerTarget(idx); setProductPickerOpen(true); }}
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                                <div className="text-[10px] text-text-secondary">{it.codigo || '—'} • UN {String(it.unidade||'UN')}</div>
                              </td>
                              <td className="px-2 py-1 text-center">
                                <div className="w-[80px] mx-auto">
                                  <Input className="h-7 text-right text-xs" value={it.quantidade} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx] = { ...a[idx], quantidade: e.target.value }; return { ...f, itens: a }; })} />
                                </div>
                              </td>
                              <td className="px-2 py-1 text-center">
                                <div className="w-[110px] mx-auto">
                                  <Input
                                    className="h-7 text-right text-xs"
                                    value={it.preco_unitario}
                                    onChange={(e)=>setManualForm(f=>{
                                      const a = [...f.itens];
                                      const formatted = moneyMaskBR(e.target.value || '');
                                      a[idx] = { ...a[idx], preco_unitario: formatted };
                                      return { ...f, itens: a };
                                    })}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                                      if (allowed.includes(e.key)) return;
                                      if (!/^[0-9]$/.test(e.key)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onBeforeInput={(e) => {
                                      const data = e.data ?? '';
                                      if (data && /\D/.test(data)) e.preventDefault();
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-1 text-center">
                                <div className="w-[110px] mx-auto">
                                  <Input
                                    className="h-7 text-right text-xs"
                                    value={it.desconto_valor}
                                    onChange={(e)=>setManualForm(f=>{
                                      const a = [...f.itens];
                                      const formatted = moneyMaskBR(e.target.value || '');
                                      a[idx] = { ...a[idx], desconto_valor: formatted, desconto_percent: '' };
                                      return { ...f, itens: a };
                                    })}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                                      if (allowed.includes(e.key)) return;
                                      if (!/^[0-9]$/.test(e.key)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onBeforeInput={(e) => {
                                      const data = e.data ?? '';
                                      if (data && /\D/.test(data)) e.preventDefault();
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-1 text-right">R$ {fmtMoney(totalItem)}</td>
                              <td className="px-2 py-1 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {(() => {
                                    const imp = it.impostos || {};
                                    const ic = imp.icms || {};
                                    const pis = imp.pis || {};
                                    const cof = imp.cofins || {};
                                    const ok = imp.origem && (ic.cst || ic.csosn) &&
                                      (pis.aliquota !== undefined && String(pis.aliquota).trim() !== '') &&
                                      (cof.aliquota !== undefined && String(cof.aliquota).trim() !== '');
                                    return !ok ? <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> : null;
                                  })()}
                                  <Button size="sm" variant="outline" className="h-7" onClick={()=>setExpandedItem(expandedItem===idx?null:idx)}>{expandedItem===idx?'Ocultar':'Detalhes'}</Button>
                                  <Button size="sm" variant="outline" className="h-7" onClick={()=>{
                                    setManualForm(f=>{ const a=[...f.itens]; a.splice(idx,1); return { ...f, itens: a }; });
                                  }}>Remover</Button>
                                </div>
                              </td>
                            </tr>
                            {expandedItem===idx && (
                              <tr className="border-t border-border/60 bg-surface-2/40">
                                <td colSpan={6} className="px-2 py-2">
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                    <div>
                                      <Label>NCM</Label>
                                      <Input className="h-7 text-xs" value={it.ncm||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], ncm:e.target.value}; return {...f, itens:a}; })} />
                                    </div>
                                    <div>
                                      <Label>CFOP</Label>
                                      <Input className="h-7 text-xs" value={it.cfop||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx]={...a[idx], cfop:e.target.value}; return {...f, itens:a}; })} />
                                    </div>
                                    <div>
                                      <Label className={isEmpty(it.impostos?.icms?.cst) && isEmpty(it.impostos?.icms?.csosn) ? 'text-red-400' : ''}>CST/CSOSN</Label>
                                      <Input
                                        className={`h-7 text-xs ${isEmpty(it.impostos?.icms?.cst) && isEmpty(it.impostos?.icms?.csosn) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`}
                                        value={it.impostos?.icms?.cst || it.impostos?.icms?.csosn || ''}
                                        onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const imp={...(a[idx].impostos||{}), icms:{...(a[idx].impostos?.icms||{}), cst:e.target.value, csosn:e.target.value}}; a[idx]={...a[idx], impostos: imp}; return {...f, itens:a}; })}
                                      />
                                    </div>
                                    <div>
                                      <Label className={isEmpty(it.impostos?.origem) ? 'text-red-400' : ''}>Origem</Label>
                                      <Input
                                        className={`h-7 text-xs ${isEmpty(it.impostos?.origem) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`}
                                        value={it.impostos?.origem||''}
                                        onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const imp={...(a[idx].impostos||{}), origem:e.target.value}; a[idx]={...a[idx], impostos:imp}; return {...f, itens:a}; })}
                                      />
                                    </div>
                                    <div>
                                      <Label>ICMS %</Label>
                                      <Input className="h-7 text-xs" value={it.impostos?.icms?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const ic={...(a[idx].impostos?.icms||{}), aliquota:e.target.value}; a[idx]={...a[idx], impostos:{...(a[idx].impostos||{}), icms:ic}}; return {...f, itens:a}; })} />
                                    </div>
                                    <div>
                                      <Label>ICMS Base</Label>
                                      <Input className="h-7 text-xs" value={it.impostos?.icms?.base||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const ic={...(a[idx].impostos?.icms||{}), base:e.target.value}; a[idx]={...a[idx], impostos:{...(a[idx].impostos||{}), icms:ic}}; return {...f, itens:a}; })} />
                                    </div>
                                    <div>
                                      <Label className={isEmpty(it.impostos?.pis?.aliquota) ? 'text-red-400' : ''}>PIS %</Label>
                                      <Input
                                        className={`h-7 text-xs ${isEmpty(it.impostos?.pis?.aliquota) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`}
                                        value={it.impostos?.pis?.aliquota||''}
                                        onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const ps={...(a[idx].impostos?.pis||{}), aliquota:e.target.value}; a[idx]={...a[idx], impostos:{...(a[idx].impostos||{}), pis:ps}}; return {...f, itens:a}; })}
                                      />
                                    </div>
                                    <div>
                                      <Label className={isEmpty(it.impostos?.cofins?.aliquota) ? 'text-red-400' : ''}>COFINS %</Label>
                                      <Input
                                        className={`h-7 text-xs ${isEmpty(it.impostos?.cofins?.aliquota) ? 'border-red-500 text-red-400 placeholder:text-red-400' : ''}`}
                                        value={it.impostos?.cofins?.aliquota||''}
                                        onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const cf={...(a[idx].impostos?.cofins||{}), aliquota:e.target.value}; a[idx]={...a[idx], impostos:{...(a[idx].impostos||{}), cofins:cf}}; return {...f, itens:a}; })}
                                      />
                                    </div>
                                    <div>
                                      <Label>IPI %</Label>
                                      <Input className="h-7 text-xs" value={it.impostos?.ipi?.aliquota||''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; const ip={...(a[idx].impostos?.ipi||{}), aliquota:e.target.value}; a[idx]={...a[idx], impostos:{...(a[idx].impostos||{}), ipi:ip}}; return {...f, itens:a}; })} />
                                    </div>
                                    <div className="md:col-span-4">
                                      <Label>Observação do item</Label>
                                      <Input className="h-7 text-xs" value={it.obs || ''} onChange={(e)=>setManualForm(f=>{ const a=[...f.itens]; a[idx] = { ...a[idx], obs: e.target.value }; return { ...f, itens: a }; })} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {manualForm.itens.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-2 py-3 text-center text-text-secondary">Nenhum item. Use "Adicionar item" para inserir.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Desconto Geral</Label>
                    <Input
                      className="h-8 text-xs text-right"
                      value={manualForm.totais.desconto_geral}
                      onChange={(e)=>setManualForm(f=>({
                        ...f,
                        totais: { ...f.totais, desconto_geral: moneyMaskBR(e.target.value || '') },
                      }))}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                        if (allowed.includes(e.key)) return;
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onBeforeInput={(e) => {
                        const data = e.data ?? '';
                        if (data && /\D/.test(data)) e.preventDefault();
                      }}
                    />
                  </div>
                  <div>
                    <Label>Frete</Label>
                    <Input
                      className="h-8 text-xs text-right"
                      value={manualForm.totais.frete}
                      onChange={(e)=>setManualForm(f=>({
                        ...f,
                        totais: { ...f.totais, frete: moneyMaskBR(e.target.value || '') },
                      }))}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                        if (allowed.includes(e.key)) return;
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onBeforeInput={(e) => {
                        const data = e.data ?? '';
                        if (data && /\D/.test(data)) e.preventDefault();
                      }}
                    />
                  </div>
                  <div>
                    <Label>Outras Despesas</Label>
                    <Input
                      className="h-8 text-xs text-right"
                      value={manualForm.totais.outras_despesas}
                      onChange={(e)=>setManualForm(f=>({
                        ...f,
                        totais: { ...f.totais, outras_despesas: moneyMaskBR(e.target.value || '') },
                      }))}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                        if (allowed.includes(e.key)) return;
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onBeforeInput={(e) => {
                        const data = e.data ?? '';
                        if (data && /\D/.test(data)) e.preventDefault();
                      }}
                    />
                  </div>
                  <div className="text-right self-end">
                    {(() => {
                      const rows = manualForm.itens || [];
                      let soma = 0; rows.forEach(it=>{ const pu = parseDec(it.preco_unitario)||0; const q = parseDec(it.quantidade)||1; const bruto = pu*q; const descP = parseDec(it.desconto_percent)||0; const descV = parseDec(it.desconto_valor)||0; const desconto = descP ? (bruto*descP/100) : descV; const totalItem = Math.max(0, bruto - desconto + (parseDec(it.acrescimos_valor)||0)); soma += totalItem; });
                      const dg = parseDec(manualForm.totais.desconto_geral)||0; const fr = parseDec(manualForm.totais.frete)||0; const od = parseDec(manualForm.totais.outras_despesas)||0;
                      const nota = soma - dg + fr + od;
                      return (
                        <div className="text-sm">
                          <div className="text-text-secondary">Total dos Produtos</div>
                          <div className="text-xl font-semibold">R$ {fmtMoney(soma)}</div>
                          <div className="text-text-secondary mt-1">Total da Nota</div>
                          <div className="text-xl font-semibold">R$ {fmtMoney(nota)}</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pagamentos">
              {(() => {
                const itens = manualForm.itens || [];
                let totalProdutos = 0;
                itens.forEach((it, idx) => {
                  const pu = parseDec(it.preco_unitario)||0;
                  const q = parseDec(it.quantidade)||1;
                  const bruto = pu*q;
                  const descP = parseDec(it.desconto_percent)||0;
                  const descV = parseDec(it.desconto_valor)||0;
                  const desconto = descP ? (bruto*descP/100) : descV;
                  const acres = parseDec(it.acrescimos_valor)||0;
                  const totalItem = Math.max(0, bruto - desconto + acres);
                  totalProdutos += totalItem;
                });
                const descontoGeral = parseDec(manualForm.totais.desconto_geral)||0;
                const frete = parseDec(manualForm.totais.frete)||0;
                const outras = parseDec(manualForm.totais.outras_despesas)||0;
                const totalNota = totalProdutos - descontoGeral + frete + outras;

                const pagamentos = manualForm.pagamentos || [];
                const totalPago = pagamentos.reduce((s,p) => s + (parseDec(p.valor)||0), 0);
                const diff = (totalPago || 0) - (totalNota || 0);

                const addPagamento = () => {
                  setManualForm(f => {
                    const arr = Array.isArray(f.pagamentos) ? [...f.pagamentos] : [];
                    const baseTotal = totalNota || 0;
                    arr.push({
                      finalizadora_id: '',
                      tipo: 'Dinheiro',
                      valor: moneyMaskBR(baseTotal.toFixed(2)),
                      bandeira: '',
                      autorizacao: '',
                      parcelas: '',
                      troco: '',
                    });
                    return { ...f, pagamentos: arr };
                  });
                };

                const removePagamento = (idx) => {
                  setManualForm(f => {
                    const arr = Array.isArray(f.pagamentos) ? [...f.pagamentos] : [];
                    arr.splice(idx,1);
                    return { ...f, pagamentos: arr };
                  });
                };

                const handleChangeValor = (idx, raw) => {
                  setManualForm(f => {
                    const arr = Array.isArray(f.pagamentos) ? [...f.pagamentos] : [];
                    const formatted = moneyMaskBR(raw || '');
                    arr[idx] = { ...(arr[idx] || {}), valor: formatted };
                    return { ...f, pagamentos: arr };
                  });
                };

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Formas de pagamento</div>
                      <Button size="sm" onClick={addPagamento}>Adicionar pagamento</Button>
                    </div>

                    <div className="border border-border rounded-md overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-surface-2 text-text-secondary">
                          <tr>
                            <th className="text-left px-2 py-2">Forma</th>
                            <th className="text-left px-2 py-2 w-[180px]">Bandeira / Autorização</th>
                            <th className="text-right px-2 py-2 w-[140px]">Valor</th>
                            <th className="text-center px-2 py-2 w-[80px]">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagamentos.map((pg, idx) => {
                            const fin = (payMethods || []).find(m => String(m.id) === String(pg.finalizadora_id));
                            return (
                              <tr key={idx} className="border-t border-border/60">
                                <td className="px-2 py-1">
                                  <select
                                    className="h-7 text-xs bg-surface border border-border rounded-md px-1 w-full"
                                    value={pg.finalizadora_id || ''}
                                    onChange={(e)=>setManualForm(f=>{
                                      const arr = Array.isArray(f.pagamentos) ? [...f.pagamentos] : [];
                                      const id = e.target.value || '';
                                      const fm = (payMethods || []).find(m => String(m.id) === String(id));
                                      arr[idx] = {
                                        ...(arr[idx] || {}),
                                        finalizadora_id: id,
                                        tipo: fm?.nome || (arr[idx]?.tipo || ''),
                                      };
                                      return { ...f, pagamentos: arr };
                                    })}
                                  >
                                    <option value="">Selecione</option>
                                    {(payMethods || []).map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.codigo_interno ? `[${m.codigo_interno}] ` : ''}{m.nome}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-[10px] text-text-secondary truncate">{pg.tipo || fin?.nome || '—'}</div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex flex-col gap-1">
                                    <Input
                                      className="h-7 text-xs"
                                      placeholder="Bandeira (Visa, Master...)"
                                      value={pg.bandeira || ''}
                                      onChange={(e)=>setManualForm(f=>{
                                        const arr = Array.isArray(f.pagamentos) ? [...f.pagamentos] : [];
                                        arr[idx] = { ...(arr[idx] || {}), bandeira: e.target.value };
                                        return { ...f, pagamentos: arr };
                                      })}
                                    />
                                    <Input
                                      className="h-7 text-xs"
                                      placeholder="Nº autorização (opcional)"
                                      value={pg.autorizacao || ''}
                                      onChange={(e)=>setManualForm(f=>{
                                        const arr = Array.isArray(f.pagamentos) ? [...f.pagamentos] : [];
                                        arr[idx] = { ...(arr[idx] || {}), autorizacao: e.target.value };
                                        return { ...f, pagamentos: arr };
                                      })}
                                    />
                                  </div>
                                </td>
                                <td className="px-2 py-1 text-right">
                                  <Input
                                    className="h-7 text-right text-xs"
                                    value={pg.valor || '0,00'}
                                    onChange={(e)=>handleChangeValor(idx, e.target.value)}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
                                      if (allowed.includes(e.key)) return;
                                      if (!/^[0-9]$/.test(e.key)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onBeforeInput={(e) => {
                                      const data = e.data ?? '';
                                      if (data && /\D/.test(data)) e.preventDefault();
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={()=>removePagamento(idx)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                          {pagamentos.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-2 py-3 text-center text-text-secondary text-xs">Nenhum pagamento. Use "Adicionar pagamento".</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div><span className="text-text-secondary">Total da Nota:</span> <span className="font-semibold">R$ {fmtMoney(totalNota)}</span></div>
                        <div><span className="text-text-secondary">Total Pago:</span> <span className="font-semibold">R$ {fmtMoney(totalPago)}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-text-secondary mb-0.5">Diferença (Pago - Nota)</div>
                        <div className={Math.abs(diff) < 0.009 ? 'font-semibold text-emerald-500' : 'font-semibold text-amber-500'}>
                          R$ {fmtMoney(diff)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="transporte">
              <div className="space-y-4">
                <div className="border border-border rounded-md bg-surface p-3">
                  <div className="text-sm font-medium mb-2">Transporte</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <Label className={isEmpty(manualForm.transporte?.tipo_frete) ? 'text-red-400' : ''}>Modalidade do Frete</Label>
                      <Select value={manualForm.transporte?.tipo_frete || '9'} onValueChange={(v)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), tipo_frete: v } }))}>
                        <SelectTrigger className={`h-8 text-xs ${isEmpty(manualForm.transporte?.tipo_frete) ? 'border-red-500 text-red-400' : ''}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Por conta do Emitente</SelectItem>
                          <SelectItem value="1">Por conta do Destinatário</SelectItem>
                          <SelectItem value="9">Sem Frete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <Label>Transportadora (se houver)</Label>
                      <Input className="h-8 text-xs" value={manualForm.transporte?.transportadora || ''} onChange={(e)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), transportadora: e.target.value } }))} />
                    </div>
                    <div>
                      <Label>Placa do Veículo</Label>
                      <Input className="h-8 text-xs" value={manualForm.transporte?.placa || ''} onChange={(e)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), placa: (e.target.value||'').toUpperCase() } }))} placeholder="ABC1D23" />
                    </div>
                    <div>
                      <Label>UF da Placa</Label>
                      <Input className="h-8 text-xs" value={manualForm.transporte?.uf_placa || ''} onChange={(e)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), uf_placa: (e.target.value||'').toUpperCase().slice(0,2) } }))} placeholder="UF" />
                    </div>
                    <div>
                      <Label>Qtd. de Volumes</Label>
                      <Input className="h-8 text-xs" value={manualForm.transporte?.volumes || ''} onChange={(e)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), volumes: e.target.value } }))} />
                    </div>
                    <div>
                      <Label>Peso Bruto (kg)</Label>
                      <Input className="h-8 text-xs" value={manualForm.transporte?.peso_bruto || ''} onChange={(e)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), peso_bruto: e.target.value } }))} />
                    </div>
                    <div>
                      <Label>Peso Líquido (kg)</Label>
                      <Input className="h-8 text-xs" value={manualForm.transporte?.peso_liquido || ''} onChange={(e)=>setManualForm(f=>({ ...f, transporte: { ...(f.transporte||{}), peso_liquido: e.target.value } }))} />
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-md bg-surface p-3">
                  <div className="text-sm font-medium mb-2">Informações Adicionais</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>Observações Fiscais</Label>
                      <textarea className="w-full h-20 text-xs rounded-md border border-border bg-surface px-2 py-1" value={manualForm.adicionais?.info_fisco || ''} onChange={(e)=>setManualForm(f=>({ ...f, adicionais: { ...(f.adicionais||{}), info_fisco: e.target.value } }))} />
                    </div>
                    <div>
                      <Label>Informações Complementares</Label>
                      <textarea className="w-full h-20 text-xs rounded-md border border-border bg-surface px-2 py-1" value={manualForm.adicionais?.obs_gerais || ''} onChange={(e)=>setManualForm(f=>({ ...f, adicionais: { ...(f.adicionais||{}), obs_gerais: e.target.value } }))} />
                    </div>
                    <div>
                      <Label>Observações Legais</Label>
                      <textarea className="w-full h-20 text-xs rounded-md border border-border bg-surface px-2 py-1" value={manualForm.adicionais?.obs_legais || ''} onChange={(e)=>setManualForm(f=>({ ...f, adicionais: { ...(f.adicionais||{}), obs_legais: e.target.value } }))} />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="totais">
              {(() => {
                const itens = manualForm.itens || [];
                let totalProdutos = 0;
                let totalDescontos = 0;
                let baseICMS = 0;
                let valorICMS = 0;
                let valorPIS = 0;
                let valorCOFINS = 0;
                let valorIPI = 0;
                let freteItens = 0;
                let seguroItens = 0;
                let outrasDespesasItens = 0;

                itens.forEach(it => {
                  const pu = parseDec(it.preco_unitario)||0;
                  const q = parseDec(it.quantidade)||1;
                  const bruto = pu*q;
                  const descP = parseDec(it.desconto_percent)||0;
                  const descV = parseDec(it.desconto_valor)||0;
                  const desconto = descP ? (bruto*descP/100) : descV;
                  const acres = parseDec(it.acrescimos_valor)||0;
                  const totalItem = Math.max(0, bruto - desconto + acres);
                  totalProdutos += totalItem;
                  totalDescontos += desconto;

                  const baseItemICMS = parseDec(it.impostos?.icms?.base) || totalItem;
                  const aliqICMS = parseDec(it.impostos?.icms?.aliquota) || 0;
                  const valICMS = baseItemICMS * aliqICMS / 100;
                  baseICMS += baseItemICMS;
                  valorICMS += valICMS;

                  const aliqPIS = parseDec(it.impostos?.pis?.aliquota) || 0;
                  const aliqCOFINS = parseDec(it.impostos?.cofins?.aliquota) || 0;
                  const aliqIPI = parseDec(it.impostos?.ipi?.aliquota) || 0;
                  valorPIS += totalItem * aliqPIS / 100;
                  valorCOFINS += totalItem * aliqCOFINS / 100;
                  valorIPI += totalItem * aliqIPI / 100;

                  freteItens += parseDec(it.frete_valor)||0;
                  seguroItens += parseDec(it.seguro_valor)||0;
                  outrasDespesasItens += acres;
                });

                const descontoGeral = parseDec(manualForm.totais.desconto_geral)||0;
                const freteNota = parseDec(manualForm.totais.frete)||0;
                const outrasDespesaNota = parseDec(manualForm.totais.outras_despesas)||0;

                const freteTotal = freteItens + freteNota;
                const seguroTotal = seguroItens; // ainda não há campo de seguro na nota
                const outrasDespesasTotal = outrasDespesasItens + outrasDespesaNota;

                const valorTotalNota = totalProdutos - descontoGeral + freteTotal + seguroTotal + outrasDespesasTotal;

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="border border-border rounded-md p-3 bg-surface">
                        <div className="text-xs text-text-secondary mb-1">Total dos Produtos</div>
                        <div className="text-lg font-semibold">R$ {fmtMoney(totalProdutos)}</div>
                      </div>
                      <div className="border border-border rounded-md p-3 bg-surface">
                        <div className="text-xs text-text-secondary mb-1">Total de Descontos</div>
                        <div className="text-lg font-semibold">R$ {fmtMoney(totalDescontos + descontoGeral)}</div>
                      </div>
                      <div className="border border-border rounded-md p-3 bg-surface">
                        <div className="text-xs text-text-secondary mb-1">Valor Total da Nota</div>
                        <div className="text-lg font-semibold">R$ {fmtMoney(valorTotalNota)}</div>
                      </div>
                    </div>

                    <div className="border border-border rounded-md p-3 bg-surface space-y-3">
                      <div className="text-sm font-medium mb-1">ICMS / PIS / COFINS / IPI</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-text-secondary mb-0.5">Base de Cálculo ICMS</div>
                          <div className="font-semibold">R$ {fmtMoney(baseICMS)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Valor do ICMS</div>
                          <div className="font-semibold">R$ {fmtMoney(valorICMS)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Valor do PIS</div>
                          <div className="font-semibold">R$ {fmtMoney(valorPIS)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Valor do COFINS</div>
                          <div className="font-semibold">R$ {fmtMoney(valorCOFINS)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Valor do IPI</div>
                          <div className="font-semibold">R$ {fmtMoney(valorIPI)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-border rounded-md p-3 bg-surface space-y-2 text-xs">
                      <div className="text-sm font-medium mb-1">Outros Valores</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <div className="text-text-secondary mb-0.5">Frete</div>
                          <div className="font-semibold">R$ {fmtMoney(freteTotal)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Seguro</div>
                          <div className="font-semibold">R$ {fmtMoney(seguroTotal)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Outras Despesas</div>
                          <div className="font-semibold">R$ {fmtMoney(outrasDespesasTotal)}</div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-0.5">Desconto Geral</div>
                          <div className="font-semibold">R$ {fmtMoney(descontoGeral)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="resumo">
              {(() => {
                const itens = manualForm.itens || [];
                let soma = 0; let descontosItens = 0;
                itens.forEach(it => {
                  const pu = parseDec(it.preco_unitario)||0; const q = parseDec(it.quantidade)||1; const bruto = pu*q;
                  const descP = parseDec(it.desconto_percent)||0; const descV = parseDec(it.desconto_valor)||0; const desconto = descP ? (bruto*descP/100) : descV; const acres = parseDec(it.acrescimos_valor)||0;
                  const totalItem = Math.max(0, bruto - desconto + acres); soma += totalItem; descontosItens += desconto;
                });
                const descontoGeral = parseDec(manualForm.totais?.desconto_geral)||0;
                const frete = parseDec(manualForm.totais?.frete)||0;
                const outras = parseDec(manualForm.totais?.outras_despesas)||0;
                const totalNota = soma - descontoGeral + frete + outras;
                const totalPago = (manualForm.pagamentos||[]).reduce((s,p)=> s + (parseDec(p.valor)||0), 0);
                const diff = totalPago - totalNota;

                const isNFCe = String(manualForm.modelo) === '65';
                const isNFe = String(manualForm.modelo) === '55';

                // ide checks (subset available at this stage)
                const ideOk = !!(manualForm.modelo && manualForm.serie && manualForm.natOp && manualForm.data_emissao && manualForm.tipo_nota && manualForm.idDest && (manualForm.indFinal ?? '') !== '' && (manualForm.indPres ?? '') !== '' && manualForm.finNFe && manualForm.cfop_padrao);

                // emit checks (empresa)
                const empresaIBGE = empresaInfo?.cidade_ibge || empresaInfo?.codigo_municipio_ibge || empresaInfo?.codigo_ibge_municipio || empresaInfo?.ibge || empresaInfo?.cod_municipio || '';
                const emitOk = !!(empresaInfo && empresaInfo.cnpj && empresaInfo.razao_social && empresaInfo.regime_tributario && empresaInfo.inscricao_estadual && empresaInfo.logradouro && (empresaInfo.numero||empresaInfo.nro) && empresaInfo.bairro && empresaInfo.cidade && empresaInfo.uf && empresaInfo.cep && empresaIBGE);

                // dest checks: required for NF-e; optional for NFC-e (if provided, must be complete)
                const destHasAny = !!(manualForm?.nome || manualForm?.cpf_cnpj);
                const destRequired = isNFe;
                const destFilled = !!(manualForm?.cpf_cnpj && manualForm?.nome && manualForm?.indIEDest && manualForm?.logradouro && manualForm?.numero && manualForm?.bairro && manualForm?.cidade && manualForm?.uf && manualForm?.cep);
                const destOk = destRequired ? destFilled : (destHasAny ? destFilled : true);

                // items + product fields
                const itensOk = Array.isArray(itens) && itens.length > 0;
                const produtosCompletos = itensOk && itens.every(it => (it.codigo || it.descricao) && it.ncm && it.cfop && it.unidade && parseDec(it.quantidade) > 0 && (it.preco_unitario || it.preco_unitario === '0,00'));

                // impostos: exigir ao menos origem, ICMS (CST/CSOSN) e alíquotas de PIS/COFINS
                const impostosOk = itensOk && itens.every(it => {
                  const imp = it.impostos||{}; const ic = imp.icms||{}; const pis = imp.pis||{}; const cof = imp.cofins||{};
                  const okICMS = !!(imp.origem !== undefined && imp.origem !== '' && (ic.cst || ic.csosn));
                  const okPIS = !!(pis.aliquota !== undefined && String(pis.aliquota).trim() !== '');
                  const okCOFINS = !!(cof.aliquota !== undefined && String(cof.aliquota).trim() !== '');
                  return okICMS && okPIS && okCOFINS;
                });

                // totais (zero é válido, nulo não)
                const baseICMS = (()=>{
                  let v=0; itens.forEach(it=>{ const totalItem = (parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1) - (parseDec(it.desconto_percent)||0 ? ((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)*(parseDec(it.desconto_percent)||0)/100) : (parseDec(it.desconto_valor)||0)) + (parseDec(it.acrescimos_valor)||0); const baseItem = parseDec(it.impostos?.icms?.base); v += isFinite(baseItem) && baseItem>0 ? baseItem : totalItem; }); return v; })();
                const valorICMS = itens.reduce((s,it)=> s + (((parseDec(it.impostos?.icms?.base) || ((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1))) * (parseDec(it.impostos?.icms?.aliquota)||0))/100), 0);
                const valorPIS = itens.reduce((s,it)=> s + (((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)) * (parseDec(it.impostos?.pis?.aliquota)||0))/100, 0);
                const valorCOFINS = itens.reduce((s,it)=> s + (((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)) * (parseDec(it.impostos?.cofins?.aliquota)||0))/100, 0);
                const valorIPI = itens.reduce((s,it)=> s + (((parseDec(it.preco_unitario)||0)*(parseDec(it.quantidade)||1)) * (parseDec(it.impostos?.ipi?.aliquota)||0))/100, 0);
                const vTotTrib = valorICMS + valorPIS + valorCOFINS + valorIPI;
                const totaisOk = [totalNota, baseICMS, valorICMS, valorPIS, valorCOFINS, valorIPI, frete, descontoGeral, outras, vTotTrib].every(v => v !== null && v !== undefined && !Number.isNaN(v));

                // transporte
                const transpOk = !!(manualForm.transporte && manualForm.transporte.tipo_frete);

                // pagamento (apenas NFC-e obrigatório)
                // Para NFC-e, aceitar troco: totalPago >= totalNota
                const pagamentosAdequados = (totalPago + 0.009) >= totalNota;
                const requiresCard = isNFCe && (manualForm.pagamentos||[]).some(pg => {
                  const fin = (payMethods || []).find(m => String(m.id) === String(pg.finalizadora_id));
                  const t = String(pg.tipo || fin?.nome || '').toLowerCase();
                  return t.includes('cart') || t.includes('crédit') || t.includes('credit') || t.includes('déb') || t.includes('deb');
                });
                const cardDetailsOk = !requiresCard || (manualForm.pagamentos||[]).every(pg => {
                  const fin = (payMethods || []).find(m => String(m.id) === String(pg.finalizadora_id));
                  const t = String(pg.tipo || fin?.nome || '').toLowerCase();
                  const isCard = t.includes('cart') || t.includes('crédit') || t.includes('credit') || t.includes('déb') || t.includes('deb');
                  return !isCard || !!(pg.bandeira && pg.bandeira.trim());
                });
                const pagOk = isNFCe ? ((manualForm.pagamentos||[]).length > 0 && pagamentosAdequados && cardDetailsOk) : true;

                const allOk = ideOk && emitOk && itensOk && produtosCompletos && impostosOk && totaisOk && transpOk && destOk && pagOk;

                const Row = ({ ok, label, extra }) => (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 last:border-b-0">
                    <div className="flex items-center gap-2">
                      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      <div className="text-sm">{label}</div>
                    </div>
                    {extra ? <div className="text-xs text-text-secondary">{extra}</div> : null}
                  </div>
                );

                return (
                  <div className="space-y-3">
                    <div className="border border-border rounded-md bg-surface">
                      <div className="text-sm font-medium px-3 py-2">Checklist</div>
                      <div>
                        <Row ok={ideOk} label="Identificação" />
                        <Row ok={emitOk} label="Emitente" />
                        <Row ok={destOk} label="Destinatário" extra={isNFCe && !destHasAny ? 'Opcional na NFC-e' : (manualForm?.nome || '')} />
                        <Row ok={itensOk} label="Itens" extra={`${itens.length} item(ns)`} />
                        <Row ok={produtosCompletos} label="Produtos completos" />
                        <Row ok={impostosOk} label="Impostos por item" />
                        <Row ok={totaisOk} label="Totais" />
                        <Row ok={transpOk} label="Transporte" />
                        <Row ok={pagOk} label="Pagamento" extra={isNFCe ? `Pago R$ ${fmtMoney(totalPago)} • Nota R$ ${fmtMoney(totalNota)}` : undefined} />
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                      <div className="text-sm text-text-secondary">
                        <div>Total da Nota: <span className="text-text-primary font-semibold">R$ {fmtMoney(totalNota)}</span></div>
                        <div>Total Pago: <span className="text-text-primary font-semibold">R$ {fmtMoney(totalPago)}</span></div>
                        <div>Diferença: <span className={Math.abs(diff) < 0.009 ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>R$ {fmtMoney(diff)}</span></div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={async()=>{
                          const errs = [];
                          if (!ideOk) errs.push('Preencha os dados de identificação da nota');
                          if (!emitOk) errs.push('Complete os dados da empresa (CNPJ, endereço, inscrição, regime)');
                          if (!destOk) errs.push(isNFe ? 'Informe os dados do destinatário' : 'Revise os dados do destinatário preenchidos');
                          if (!itensOk) errs.push('Adicione pelo menos um item na nota');
                          if (!produtosCompletos) errs.push('Revise os campos obrigatórios dos itens (produto, NCM, CFOP, unidade, quantidade, preço)');
                          if (!impostosOk) errs.push('Preencha os impostos de todos os itens (origem, ICMS, PIS e COFINS)');
                          if (!totaisOk) errs.push('Verifique os totais da nota');
                          if (!transpOk) errs.push('Informe a modalidade do frete em Transporte');
                          if (!pagOk) errs.push('Revise a forma de pagamento e o valor pago');
                          if (errs.length) toast({ title: 'Ainda faltam dados para emitir', description: errs.join(' • '), variant: 'warning' });
                          else toast({ title: 'Tudo certo', description: 'A nota está pronta para emitir', variant: 'success' });
                        }}>Validar Nota</Button>
                        <Button
                          size="sm"
                          disabled={!allOk || manualEmitting}
                          onClick={async()=>{ setManualEmitting(true); try { await emitirNota(); } finally { setManualEmitting(false); } }}
                        >
                          {manualEmitting ? (
                            <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitindo…</span>
                          ) : 'Emitir Nota'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={saveDraft}>Salvar Rascunho</Button>
                        <Button size="sm" variant="outline" onClick={()=>setManualOpen(false)}>Cancelar Emissão</Button>
                      </div>
                    </div>

                    <div className="border border-border rounded-md bg-surface p-3 text-xs text-text-secondary">
                      <div className="mb-1 font-medium text-text-primary">Pós-Emissão</div>
                      <div>Após a emissão, exibiremos o status SEFAZ, chave de acesso, links do XML e DANFE, e opções de envio por e-mail ou WhatsApp.</div>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-3">
            <Button onClick={saveDraft} disabled={manualSaving}>{manualSaving ? 'Salvando...' : 'Salvar rascunho'}</Button>
            <Button variant="outline" onClick={()=>setManualOpen(false)}>Fechar</Button>
          </div>
          {false && manualXml && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-secondary">Prévia do XML Gerado</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=>downloadText(`nfe-manual-${Date.now()}.xml`, manualXml)}>Baixar XML</Button>
                  <Button size="sm" onClick={async()=>{
                    try {
                      setManualSaving(true);
                      const path = `nfe/${codigoEmpresa}/manual-${Date.now()}.xml`;
                      const blob = new Blob([manualXml], { type: 'text/xml;charset=utf-8' });
                      const { error: upErr } = await supabase.storage.from('fiscal').upload(path, blob, { contentType: 'text/xml' });
                      if (upErr) throw upErr;
                      try {
                        const { ambiente: amb } = getTransmiteNotaConfigFromEmpresa(empresaInfo || {});
                        const itens = manualForm.itens.map(x=>{
                          const pu = parseDec(x.preco_unitario)||0; const q = parseDec(x.quantidade)||1; const bruto = pu*q;
                          const descP = parseDec(x.desconto_percent)||0; const descV = parseDec(x.desconto_valor)||0; const acres = parseDec(x.acrescimos_valor)||0;
                          const desconto = descP ? (bruto*descP/100) : descV; const totalItem = bruto - desconto + acres; return { preco_total: totalItem };
                        });
                        const totalItens = itens.reduce((s,i)=> s + (Number(i.preco_total)||0), 0);
                        const total = totalItens - (parseDec(manualForm.totais.desconto_geral)||0) + (parseDec(manualForm.totais.frete)||0) + (parseDec(manualForm.totais.outras_despesas)||0);
                        await supabase.from('notas_fiscais').insert({
                          codigo_empresa: codigoEmpresa,
                          origem: 'manual',
                          comanda_id: null,
                          modelo: '55',
                          numero: manualForm.nNF ? Number(manualForm.nNF) : null,
                          serie: manualForm.serie ? Number(manualForm.serie) : null,
                          status: 'pendente',
                          xml_url: path,
                          pdf_url: null,
                          valor_total: isFinite(total) ? total : null,
                          destinatario: {
                            tipo_pessoa: manualForm.tipo_pessoa,
                            cpf_cnpj: manualForm.cpf_cnpj,
                            nome: manualForm.nome,
                            email: manualForm.email,
                            telefone: manualForm.telefone,
                            inscricao_estadual: manualForm.ie_isento ? 'ISENTO' : manualForm.inscricao_estadual,
                            logradouro: manualForm.logradouro,
                            numero: manualForm.numero,
                            bairro: manualForm.bairro,
                            cidade: manualForm.cidade,
                            uf: manualForm.uf,
                            cep: manualForm.cep,
                            codigo_municipio_ibge: manualForm.codigo_municipio_ibge,
                          },
                          ambiente: amb || 'homologacao',
                        });
                      } catch {}
                      toast({ title: 'XML salvo' });
                    } catch (e) { toast({ title: 'Falha ao salvar', description: e.message, variant: 'destructive' }); }
                    finally { setManualSaving(false); }
                  }} disabled={manualSaving}>{manualSaving ? 'Salvando...' : 'Salvar no Supabase'}</Button>
                </div>
              </div>
              <pre className="text-[11px] whitespace-pre-wrap break-all max-h-[360px] overflow-auto border border-border rounded p-2 bg-surface-2">{manualXml}</pre>
              <datalist id="natop-list">
                <option value="VENDA" />
                <option value="DEVOLUCAO" />
                <option value="TRANSFERENCIA" />
                <option value="BONIFICACAO" />
                <option value="REMESSA" />
                <option value="DEMONSTRACAO" />
              </datalist>
              <datalist id="unid-list">
                <option value="UN" />
                <option value="KG" />
                <option value="LT" />
                <option value="CX" />
                <option value="PC" />
                <option value="MT" />
                <option value="M2" />
                <option value="M3" />
              </datalist>
              <datalist id="cfop-list">
                <option value="5102" />
                <option value="5101" />
                <option value="5405" />
                <option value="5949" />
                <option value="5915" />
                <option value="6102" />
                <option value="6915" />
              </datalist>
              <datalist id="unid-list">
                <option value="UN" />
                <option value="PC" />
                <option value="CX" />
                <option value="KG" />
                <option value="LT" />
                <option value="MT" />
                <option value="M2" />
                <option value="M3" />
              </datalist>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Loading simples durante emissão manual de NF-e/NFC-e */}
      <Dialog open={manualEmitting} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Emitindo NF-e...</DialogTitle>
            <DialogDescription>Aguarde enquanto consultamos o status na SEFAZ.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-text-secondary text-center">
              Este processo pode levar alguns segundos. Não feche esta tela.
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* XML Preview Dialog */}
      <Dialog open={xmlPreviewOpen} onOpenChange={setXmlPreviewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>XML gerado</DialogTitle>
            <DialogDescription>Faça o download ou salve no Supabase.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-text-secondary">Prévia do XML</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={()=>downloadText(`nfe-manual-${Date.now()}.xml`, manualXml)}>Baixar XML</Button>
              <Button size="sm" onClick={async()=>{
                try {
                  setManualSaving(true);
                  const path = `nfe/${codigoEmpresa}/manual-${Date.now()}.xml`;
                  const blob = new Blob([manualXml], { type: 'text/xml;charset=utf-8' });
                  const { error: upErr } = await supabase.storage.from('fiscal').upload(path, blob, { contentType: 'text/xml' });
                  if (upErr) throw upErr;
                  toast({ title: 'XML salvo no Supabase' });
                } catch (e) { toast({ title: 'Falha ao salvar', description: e.message, variant: 'destructive' }); }
                finally { setManualSaving(false); }
              }} disabled={manualSaving}>{manualSaving ? 'Salvando...' : 'Salvar no Supabase'}</Button>
            </div>
          </div>
          <pre className="text-[11px] whitespace-pre-wrap break-all max-h-[360px] overflow-auto border border-border rounded p-2 bg-surface-2">{manualXml}</pre>
        </DialogContent>
      </Dialog>

      <Dialog open={nfeOpen} onOpenChange={setNfeOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[680px] md:max-w-[860px] lg:max-w-[900px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emissão NF-e (XML offline)</DialogTitle>
            <DialogDescription>Preencha os campos abaixo e gere o XML da NF-e. Transmissão para SEFAZ ficará para a próxima etapa.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Natureza da Operação (natOp)</Label>
              <Input value={nfeForm.natOp} onChange={(e)=>setNfeForm(f=>({...f, natOp: e.target.value}))} placeholder="VENDA" />
            </div>
            <div>
              <Label>Série</Label>
              <Input value={nfeForm.serie} onChange={(e)=>setNfeForm(f=>({...f, serie: e.target.value}))} />
            </div>
            <div>
              <Label>Número (nNF)</Label>
              <Input value={nfeForm.nNF} onChange={(e)=>setNfeForm(f=>({...f, nNF: e.target.value}))} placeholder="(opcional)" />
            </div>
            <div>
              <Label>Destino da Operação (idDest)</Label>
              <Select value={nfeForm.idDest || 'auto'} onValueChange={(v)=>setNfeForm(f=>({...f, idDest: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Automático" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="1">Interna (mesmo estado)</SelectItem>
                  <SelectItem value="2">Interestadual</SelectItem>
                  <SelectItem value="3">Exterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Consumidor Final (indFinal)</Label>
              <Select value={nfeForm.indFinal} onValueChange={(v)=>setNfeForm(f=>({...f, indFinal: v}))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Sim</SelectItem>
                  <SelectItem value="0">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Presença do Comprador (indPres)</Label>
              <Select value={nfeForm.indPres} onValueChange={(v)=>setNfeForm(f=>({...f, indPres: v}))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Operação presencial</SelectItem>
                  <SelectItem value="2">Não presencial, internet</SelectItem>
                  <SelectItem value="4">Entrega em domicílio</SelectItem>
                  <SelectItem value="9">Não se aplica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={()=>setNfeOpen(false)}>Fechar</Button>
            <Button onClick={generateNfe} disabled={nfeGenerating}>{nfeGenerating ? 'Gerando...' : 'Gerar XML'}</Button>
          </div>
          {nfeXml && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-secondary">Prévia do XML Gerado</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=>downloadText(`nfe-${nfeComandaId||'doc'}.xml`, nfeXml)}>Baixar XML</Button>
                  <Button size="sm" onClick={saveNfeXml} disabled={nfeSaving}>{nfeSaving ? 'Salvando...' : 'Salvar no Supabase'}</Button>
                </div>
              </div>
              <pre className="text-[11px] whitespace-pre-wrap break-all max-h-[360px] overflow-auto border border-border rounded p-2 bg-surface-2">{nfeXml}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {}
}

